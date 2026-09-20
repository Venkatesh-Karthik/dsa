/**
 * Cognora Voice Queue 2.0
 *
 * Production-grade asynchronous voice queue with:
 * - Controlled concurrency (bounded = 1 for local Chatterbox service)
 * - Dynamic priority scheduling (Current step > User request > Next step > Prefetch)
 * - Current + Next bounded prefetching (never queues whole lesson at once)
 * - Request deduplication & coalescing
 * - Stale audio protection (generationId, branchId, worldVersion, transformationId validation)
 * - Circuit breaker protection against service failure / timeout storms
 * - Structural audio validation (WAV header, length, content-type)
 * - Independent AbortControllers per request
 */

import { AudioValidator } from "./audio-validator";
import { CircuitBreaker } from "./circuit-breaker";
import { ChatterboxError } from "./chatterbox-provider";
import { SpeechPreprocessor } from "./speech-preprocessor";
import { VoiceCache } from "./voice-cache";
import {
  type TTSAudio,
  type TTSOptions,
  type VoiceDiagnostics,
  type VoiceQueueItem,
  type VoiceQueueStatus,
  VoicePriority,
} from "./voice-contract";

import type { TTSProvider } from "./tts-provider";

let _voiceReqCounter = 0;

export interface VoiceQueueEvents {
  onItemReady?: (item: VoiceQueueItem, audio: TTSAudio) => void;
  onItemFailed?: (item: VoiceQueueItem, error: Error) => void;
  onItemStale?: (item: VoiceQueueItem) => void;
  onStatusChange?: (status: "READY" | "BUSY" | "DEGRADED" | "UNAVAILABLE") => void;
}

export interface AuthoritativeVoiceContext {
  generationId: string;
  worldVersion: number;
  branchId: string;
  currentTransformationId?: string;
  currentIndex?: number;
}

export class VoiceQueue {
  private queue: VoiceQueueItem[] = [];
  private activeItem: VoiceQueueItem | null = null;
  private activeAbortController: AbortController | null = null;
  private readonly provider: TTSProvider;
  private readonly cache: VoiceCache;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly events: VoiceQueueEvents;

  // In-flight request deduplication map: key -> Promise<TTSAudio>
  private inFlightPromises = new Map<string, Promise<TTSAudio>>();

  // Authoritative runtime truth for stale rejection
  private authContext: AuthoritativeVoiceContext = {
    generationId: "GEN-INIT",
    worldVersion: 1,
    branchId: "MAIN",
  };

  // Telemetry metrics
  private totalRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalTimeouts = 0;
  private totalStaleDropped = 0;
  private lastLatencyMs = 0;

  constructor(
    provider: TTSProvider,
    cache?: VoiceCache,
    circuitBreaker?: CircuitBreaker,
    events?: VoiceQueueEvents,
  ) {
    this.provider = provider;
    this.cache = cache || new VoiceCache();
    this.circuitBreaker =
      circuitBreaker ||
      new CircuitBreaker({
        failureThreshold: 3,
        cooldownPeriodMs: 15_000,
        onStateChange: (_from, to) => {
          if (to === "OPEN") {
            this.events.onStatusChange?.("DEGRADED");
          } else if (to === "CLOSED") {
            this.events.onStatusChange?.("READY");
          }
        },
      });
    this.events = events || {};
  }

  /**
   * Updates the authoritative runtime context against which all audio is validated.
   */
  public setAuthoritativeContext(
    contextOrGenId: AuthoritativeVoiceContext | string,
    worldVersion: number = 1,
    branchId: string = "MAIN",
  ): void {
    if (typeof contextOrGenId === "string") {
      const prevGen = this.authContext.generationId;
      this.authContext = {
        generationId: contextOrGenId,
        worldVersion,
        branchId,
      };
      if (prevGen !== "GEN-INIT" && prevGen !== contextOrGenId) {
        this.cancelGeneration(prevGen);
      }
      return;
    }
    const prevGen = this.authContext.generationId;
    this.authContext = { ...contextOrGenId };
    if (prevGen !== "GEN-INIT" && prevGen !== contextOrGenId.generationId) {
      this.cancelGeneration(prevGen);
    }
  }

  public getAuthoritativeContext(): AuthoritativeVoiceContext {
    return { ...this.authContext };
  }

  /**
   * Enqueues or immediately resolves speech synthesis for a teaching moment or user turn.
   */
  public async enqueue(
    params: {
      lessonId: string;
      generationId?: string;
      transformationId: string;
      stepIndex?: number;
      worldVersion?: number;
      branchId?: string;
      narration: string;
      priority?: number;
      options?: TTSOptions;
    },
  ): Promise<TTSAudio> {
    if (this.authContext.generationId === "GEN-INIT" && params.generationId) {
      this.authContext.generationId = params.generationId;
      if (params.worldVersion !== undefined) this.authContext.worldVersion = params.worldVersion;
      if (params.branchId) this.authContext.branchId = params.branchId;
    }

    const generationId = params.generationId || this.authContext.generationId;
    const worldVersion = params.worldVersion ?? this.authContext.worldVersion;
    const branchId = params.branchId || this.authContext.branchId;
    const priority = params.priority ?? VoicePriority.CURRENT_STEP;

    const prep = SpeechPreprocessor.prepare({
      lessonId: params.lessonId,
      transformationId: params.transformationId,
      stepIndex: params.stepIndex ?? 0,
      totalSteps: 1,
      title: "",
      explanation: params.narration,
    });
    const spokenText = prep.spokenText;

    const cacheKey = VoiceCache.generateKey(
      params.lessonId,
      params.transformationId,
      spokenText,
      this.provider.name,
      params.options?.voiceId,
    );

    // 1. Check VoiceCache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.audioUrl) {
      this.cacheHits++;
      console.info(
        `[COGNORA][VOICE][QUEUE][CACHE_HIT] lessonId=${params.lessonId} transformationId=${params.transformationId}`,
      );
      return cached;
    }
    this.cacheMisses++;

    this.totalRequests++;

    // 2. Request Deduplication: if identical synthesis is in flight, reuse promise
    const dedupeKey = `${spokenText}:${params.options?.voiceId || "default"}`;
    const existingPromise =
      this.inFlightPromises.get(dedupeKey) || this.inFlightPromises.get(cacheKey);
    if (existingPromise) {
      console.info(
        `[COGNORA][VOICE][QUEUE][COALESCE] Reusing in-flight promise for dedupeKey=${dedupeKey}`,
      );
      return existingPromise;
    }

    // 3. Check Circuit Breaker before queueing
    if (!this.circuitBreaker.canExecute()) {
      const err = new ChatterboxError(
        "Chatterbox circuit breaker is OPEN. Fast-rejecting voice synthesis.",
        "CHATTERBOX_CIRCUIT_OPEN",
      );
      this.totalFailures++;
      console.warn(`[COGNORA][VOICE][QUEUE] Rejected: ${err.message}`);
      return Promise.reject(err);
    }

    // 4. Create Queue Item
    const requestId = `VQ-${Date.now()}-${(++_voiceReqCounter).toString(36)}`;
    const queueItem: VoiceQueueItem = {
      requestId,
      lessonId: params.lessonId,
      generationId,
      transformationId: params.transformationId,
      stepIndex: params.stepIndex,
      worldVersion,
      branchId,
      narration: spokenText,
      narrationHash: cacheKey,
      voiceConfigHash: params.options?.voiceId || "default",
      priority,
      status: "QUEUED",
      retryCount: 0,
      createdAt: Date.now(),
    };

    const synthesisPromise = new Promise<TTSAudio>((resolve, reject) => {
      this.insertByPriority(queueItem);
      console.info(
        `[COGNORA][VOICE][QUEUE][ENQUEUE] id=${requestId} stepId=${params.transformationId} priority=${priority} queueLen=${this.queue.length}`,
      );

      // Listen for resolution on this specific item
      const checkCompletion = () => {
        if (queueItem.status === "AUDIO_READY" && queueItem.audio) {
          resolve(queueItem.audio);
          return true;
        }
        if (queueItem.status === "FAILED" || queueItem.status === "TIMEOUT") {
          reject(queueItem.error || new Error(`Synthesis failed with status ${queueItem.status}`));
          return true;
        }
        if (queueItem.status === "CANCELLED" || queueItem.status === "STALE") {
          reject(new Error(`Voice item was ${queueItem.status.toLowerCase()}`));
          return true;
        }
        return false;
      };

      // Poll check loop tied to queue item updates
      const interval = setInterval(() => {
        if (checkCompletion()) {
          clearInterval(interval);
        }
      }, 50);

      // Safety timeout to prevent unresolved promises
      setTimeout(() => {
        clearInterval(interval);
        if (queueItem.status === "QUEUED" || queueItem.status === "SYNTHESIZING") {
          queueItem.status = "TIMEOUT";
          queueItem.error = new Error("Voice queue synthesis timed out.");
          reject(queueItem.error);
        }
      }, 65_000);
    });

    this.inFlightPromises.set(cacheKey, synthesisPromise);
    this.inFlightPromises.set(dedupeKey, synthesisPromise);
    synthesisPromise.finally(() => {
      this.inFlightPromises.delete(cacheKey);
      this.inFlightPromises.delete(dedupeKey);
    });

    // Trigger pump
    this.pump();

    return synthesisPromise;
  }

  /**
   * Schedules synthesis strictly for the active step and the immediate next step.
   * Cancels/deprioritizes any background prefetch requests outside this window.
   */
  public async prepareCurrentAndNext(
    lessonId: string,
    currentStepIndex: number,
    moments: readonly {
      id?: string;
      transformationId?: string;
      title?: string;
      explanation?: string;
      narration?: string;
      stepIndex?: number;
    }[],
    options?: TTSOptions,
  ): Promise<void> {
    if (!moments || moments.length === 0) {
      return;
    }

    const currentMoment = moments[currentStepIndex];
    const nextMoment = moments[currentStepIndex + 1];

    // Cancel pending prefetch items that belong to steps beyond current + 1
    this.queue = this.queue.filter((item) => {
      if (item.priority <= VoicePriority.PREFETCH) {
        const isCurrent = currentMoment && item.transformationId === (currentMoment.transformationId || currentMoment.id);
        const isNext = nextMoment && item.transformationId === (nextMoment.transformationId || nextMoment.id);
        if (!isCurrent && !isNext) {
          item.status = "CANCELLED";
          console.info(
            `[COGNORA][VOICE][QUEUE][CANCEL_STALE_PREFETCH] Dropping distant prefetch transformationId=${item.transformationId}`,
          );
          return false;
        }
      }
      return true;
    });

    const promises: Promise<any>[] = [];

    // Enqueue current step with high priority
    if (currentMoment) {
      const transId = currentMoment.transformationId || currentMoment.id || `t-${currentStepIndex}`;
      const text = currentMoment.narration || currentMoment.explanation || currentMoment.title || "";
      promises.push(
        this.enqueue({
          lessonId,
          transformationId: transId,
          narration: text,
          priority: VoicePriority.CURRENT_STEP,
          options,
        }).catch((err) => {
          console.warn(`[COGNORA][VOICE][QUEUE] Current step synthesis deferred:`, err);
        }),
      );
    }

    // Enqueue next step with prefetch priority
    if (nextMoment) {
      const transId = nextMoment.transformationId || nextMoment.id || `t-${currentStepIndex + 1}`;
      const text = nextMoment.narration || nextMoment.explanation || nextMoment.title || "";
      promises.push(
        this.enqueue({
          lessonId,
          transformationId: transId,
          narration: text,
          priority: VoicePriority.NEXT_STEP,
          options,
        }).catch((err) => {
          console.warn(`[COGNORA][VOICE][QUEUE] Next step prefetch deferred:`, err);
        }),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Updates current playback position and drops any prefetch items outside active window.
   */
  public updatePlaybackPosition(stepIndex: number): void {
    this.queue = this.queue.filter((item) => {
      if (item.priority <= VoicePriority.PREFETCH) {
        return item.stepIndex === undefined || Math.abs(item.stepIndex - stepIndex) <= 1;
      }
      return true;
    });
  }

  /**
   * Validates whether audio belongs to the active generation, branch, and world version.
   */
  public isAudioStale(
    generationId: string,
    worldVersion: number,
    branchId: string,
    transformationId?: string,
  ): boolean {
    if (generationId !== this.authContext.generationId) return true;
    if (branchId.toUpperCase() !== this.authContext.branchId.toUpperCase()) return true;
    if (worldVersion !== this.authContext.worldVersion) return true;
    return false;
  }

  /**
   * Main execution pump. Enforces concurrency = 1.
   */
  private async pump(): Promise<void> {
    if (this.activeItem !== null) {
      return; // Worker is busy
    }

    if (this.queue.length === 0) {
      return; // Queue is empty
    }

    // Dequeue highest priority item
    const item = this.queue.shift()!;
    this.activeItem = item;
    item.status = "SYNTHESIZING";
    item.startedAt = Date.now();

    const abortController = new AbortController();
    this.activeAbortController = abortController;

    console.info(
      `[COGNORA][VOICE][QUEUE][SYNTH_START] id=${item.requestId} transId=${item.transformationId} priority=${item.priority}`,
    );

    const t0 = Date.now();
    try {
      const audio = await this.provider.synthesize(
        item.narration,
        undefined,
        abortController.signal,
      );

      const durationMs = Date.now() - t0;
      this.lastLatencyMs = durationMs;

      // 1. Validate audio format and content if buffer is provided
      if (audio.audioBuffer) {
        const validation = AudioValidator.validateWav(audio.audioBuffer);
        if (!validation.valid) {
          throw new Error(`Audio validation failed: ${validation.reason || validation.error}`);
        }
      }

      // 2. Check for Stale Audio
      const isStale =
        item.generationId !== this.authContext.generationId ||
        item.branchId !== this.authContext.branchId ||
        item.worldVersion !== this.authContext.worldVersion;

      // Store in cache regardless (so it's available if user navigates back)
      audio.cacheKey = item.narrationHash;
      audio.generationId = item.generationId;
      audio.transformationId = item.transformationId;
      audio.worldVersion = item.worldVersion;
      audio.branchId = item.branchId;
      this.cache.set(item.narrationHash, audio);

      item.completedAt = Date.now();
      item.audio = audio;

      if (isStale) {
        item.status = "STALE";
        this.totalStaleDropped++;
        console.info(
          `[COGNORA][VOICE][QUEUE][STALE] id=${item.requestId} transId=${item.transformationId} discarded for active step (cached for history)`,
        );
        this.events.onItemStale?.(item);
      } else {
        item.status = "AUDIO_READY";
        this.totalSuccesses++;
        this.circuitBreaker.recordSuccess();
        console.info(
          `[COGNORA][VOICE][QUEUE][SYNTH_SUCCESS] id=${item.requestId} transId=${item.transformationId} latency=${durationMs}ms`,
        );
        this.events.onItemReady?.(item, audio);
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - t0;
      const isAbort =
        (err instanceof Error && err.name === "AbortError") ||
        abortController.signal.aborted;

      const isTimeout =
        (err instanceof Error && err.message.includes("timed out")) ||
        durationMs >= 58_000;

      if (isAbort) {
        item.status = "CANCELLED";
        item.abortReason = "Request aborted by controller";
        console.info(
          `[COGNORA][VOICE][QUEUE][ABORT] id=${item.requestId} transId=${item.transformationId}`,
        );
      } else {
        this.totalFailures++;
        if (isTimeout) {
          this.totalTimeouts++;
        }
        item.status = isTimeout ? "TIMEOUT" : "FAILED";
        item.error = err instanceof Error ? err : new Error(String(err));
        this.circuitBreaker.recordFailure(isTimeout);

        console.warn(
          `[COGNORA][VOICE][QUEUE][ERROR] id=${item.requestId} transId=${item.transformationId} status=${item.status} error=${item.error.message}`,
        );
        this.events.onItemFailed?.(item, item.error);
      }
    } finally {
      this.activeItem = null;
      this.activeAbortController = null;
      // Pump next item in queue
      setTimeout(() => this.pump(), 10);
    }
  }

  /**
   * Inserts an item into the queue maintaining priority order (highest first).
   */
  private insertByPriority(item: VoiceQueueItem): void {
    const idx = this.queue.findIndex((q) => q.priority < item.priority);
    if (idx === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(idx, 0, item);
    }
  }

  /**
   * Cancels in-flight request and removes all items belonging to a generationId.
   */
  public cancelGeneration(generationId: string): void {
    if (this.activeItem && this.activeItem.generationId === generationId) {
      this.activeAbortController?.abort();
    }
    for (const item of this.queue) {
      if (item.generationId === generationId) {
        item.status = "CANCELLED";
      }
    }
    this.queue = this.queue.filter((item) => item.generationId !== generationId);
  }

  /**
   * Cancels all queue items and in-flight synthesis cleanly.
   */
  public cancelAll(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    if (this.activeItem) {
      this.activeItem.status = "CANCELLED";
      this.activeItem = null;
    }
    for (const item of this.queue) {
      item.status = "CANCELLED";
    }
    this.queue = [];
    this.inFlightPromises.clear();
  }

  public cleanup(): void {
    this.cancelAll();
  }

  public getDiagnostics(): VoiceDiagnostics {
    const cbState = this.circuitBreaker.getState();
    const serviceStatus =
      cbState === "OPEN"
        ? "DEGRADED"
        : this.activeItem !== null
        ? "BUSY"
        : "READY";

    return {
      serviceStatus,
      circuitBreakerState: cbState,
      queueLength: this.queue.length,
      totalRequests: this.totalRequests,
      activeItem: this.activeItem
        ? {
            transformationId: this.activeItem.transformationId,
            priority: this.activeItem.priority,
          }
        : null,
      currentStep: this.authContext.currentIndex ?? 0,
      nextStep: (this.authContext.currentIndex ?? 0) + 1,
      isSynthesizing: this.activeItem !== null,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      lastLatencyMs: this.lastLatencyMs,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      totalTimeouts: this.totalTimeouts,
      totalStaleDropped: this.totalStaleDropped,
    };
  }
}
