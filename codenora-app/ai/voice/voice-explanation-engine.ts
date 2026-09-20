/**
 * Voice Explanation Engine for Cognora
 *
 * Coordinates speech preprocessing, TTS synthesis, caching, and audio playback.
 * Enforces transformation-level synchronization and race-condition immunity.
 */

import { AudioPlayer } from "./audio-player";
import { ChatterboxProvider } from "./chatterbox-provider";
import { SpeechDirector } from "./speech-director";
import { SpeechPreprocessor } from "./speech-preprocessor";
import { VoiceCache } from "./voice-cache";
import { VoiceQueue } from "./voice-queue";

import type { TTSProvider } from "./tts-provider";
import {
  type TTSAudio,
  type TTSOptions,
  VoicePriority,
  type VoiceDiagnostics,
  type VoiceExplanationContext,
  type VoiceState,
} from "./voice-contract";

export type VoiceStateListener = (
  state: VoiceState,
  context?: VoiceExplanationContext | null,
  error?: string | null,
) => void;

export class VoiceExplanationEngine {
  private static instance: VoiceExplanationEngine | null = null;

  private state: VoiceState = "idle";
  private currentContext: VoiceExplanationContext | null = null;
  private currentAudio: TTSAudio | null = null;
  private activeSessionToken: number = 0;
  private abortController: AbortController | null = null;
  private errorMessage: string | null = null;

  private ttsProvider: TTSProvider;
  private cache: VoiceCache;
  private queue: VoiceQueue;
  private player: AudioPlayer;
  private listeners = new Set<VoiceStateListener>();
  private onAudioEndedListeners = new Set<(sessionToken: number) => void>();
  private prepAbortController: AbortController | null = null;
  private prepLessonId: string | null = null;

  // Authoritative lifecycle identifiers for stale audio isolation
  private activeGenerationId: string = "GEN-INIT";
  private activeWorldVersion: number = 1;
  private activeBranchId: string = "MAIN";

  constructor(customProvider?: TTSProvider) {
    this.ttsProvider = customProvider || new ChatterboxProvider();
    this.cache = new VoiceCache(100);
    this.queue = new VoiceQueue(this.ttsProvider, this.cache);
    this.player = new AudioPlayer({
      onStatusChange: (status) => {
        if (status === "playing") {
          this.setState("PLAYING");
          console.info(
            `[COGNORA][VOICE][AUDIO][PLAY] session=${this.activeSessionToken}`,
          );
        } else if (status === "paused") {
          this.setState("PAUSED");
          console.info(
            `[COGNORA][VOICE][AUDIO][PAUSE] session=${this.activeSessionToken}`,
          );
        } else if (status === "ended") {
          this.setState("READY");
          console.info(
            `[COGNORA][VOICE][AUDIO][FINISH] session=${this.activeSessionToken}`,
          );
          const currentToken = this.activeSessionToken;
          for (const cb of this.onAudioEndedListeners) {
            try {
              cb(currentToken);
            } catch (err) {
              console.error("[COGNORA][VOICE] onAudioEnded error:", err);
            }
          }
        } else if (status === "idle") {
          if (this.state === "PLAYING" || this.state === "PAUSED") {
            this.setState("IDLE");
            console.info(
              `[COGNORA][VOICE][AUDIO][STOP] session=${this.activeSessionToken}`,
            );
          }
        }
      },
      onError: (err) => {
        console.error(
          `[COGNORA][VOICE][AUDIO][ERROR] session=${this.activeSessionToken} error="${err.message}"`,
        );
        this.errorMessage = err.message;
        this.setState("FAILED");
        const currentToken = this.activeSessionToken;
        for (const cb of this.onAudioEndedListeners) {
          try {
            cb(currentToken);
          } catch (e) {
            // safe ignore
          }
        }
      },
    });
  }

  public static getInstance(): VoiceExplanationEngine {
    if (!this.instance) {
      this.instance = new VoiceExplanationEngine();
    }
    return this.instance;
  }

  public getState(): VoiceState {
    return this.state;
  }

  public getActiveSessionToken(): number {
    return this.activeSessionToken;
  }

  public getCache(): VoiceCache {
    return this.cache;
  }

  public getProvider(): TTSProvider {
    return this.ttsProvider;
  }

  public addOnAudioEndedListener(
    listener: (sessionToken: number) => void,
  ): () => void {
    this.onAudioEndedListeners.add(listener);
    return () => {
      this.onAudioEndedListeners.delete(listener);
    };
  }

  public getCurrentContext(): VoiceExplanationContext | null {
    return this.currentContext;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.player.getAudioElement();
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state, this.currentContext, this.errorMessage);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: VoiceState): void {
    if (this.state === newState) {
      return;
    }
    this.state = newState;
    for (const listener of this.listeners) {
      try {
        listener(this.state, this.currentContext, this.errorMessage);
      } catch (err) {
        console.error("[VoiceExplanationEngine] Listener error:", err);
      }
    }
  }

  public setAuthoritativeContext(
    generationId: string,
    worldVersion: number = 1,
    branchId: string = "MAIN",
  ): void {
    this.activeGenerationId = generationId;
    this.activeWorldVersion = worldVersion;
    this.activeBranchId = branchId;
    this.queue.setAuthoritativeContext(generationId, worldVersion, branchId);
  }

  public getDiagnostics(): VoiceDiagnostics {
    return this.queue.getDiagnostics();
  }

  public getQueue(): VoiceQueue {
    return this.queue;
  }

  /**
   * Prepares and speaks the authoritative explanation for the given context.
   */
  public async play(
    context: VoiceExplanationContext,
    options?: TTSOptions,
  ): Promise<void> {
    // 1. Advance session token to invalidate any previous in-flight requests
    const sessionToken = ++this.activeSessionToken;
    this.cancelPendingRequest();

    this.currentContext = context;
    this.errorMessage = null;

    if (context.generationId) {
      this.activeGenerationId = context.generationId;
    }
    if (context.worldVersion !== undefined) {
      this.activeWorldVersion = context.worldVersion;
    }
    if (context.branchId) {
      this.activeBranchId = context.branchId;
    }

    console.info(
      `[COGNORA][VOICE][PLAY] session=${sessionToken} lessonId=${context.lessonId} transformationId=${context.transformationId} stepIndex=${context.stepIndex}`,
    );

    // 2. Preprocess text into natural tutor phrasing
    const prep = SpeechPreprocessor.prepare(context);
    console.info(
      `[COGNORA][VOICE][PREPARE] session=${sessionToken} spokenText="${prep.spokenText}"`,
    );

    // 3. Check voice cache
    const cacheKey = VoiceCache.generateKey(
      context.lessonId,
      context.transformationId,
      prep.spokenText,
      this.ttsProvider.name,
      options?.voiceId,
    );

    let cached = this.cache.get(cacheKey);
    if (!cached) {
      cached = this.cache.getByTransformation(
        context.lessonId,
        context.transformationId,
      );
    }
    if (cached && cached.audioUrl) {
      console.info(
        `[COGNORA][VOICE][CACHE][HIT] session=${sessionToken} key=${cacheKey}`,
      );
      this.currentAudio = cached;
      await this.player.play(cached.audioUrl, String(sessionToken));
      return;
    }

    // 4. Synthesize via TTS Provider
    this.setState("preparing");
    this.abortController = new AbortController();
    const t0 = Date.now();

    console.info(
      `[COGNORA][VOICE][TTS][START] session=${sessionToken} provider=${this.ttsProvider.name}`,
    );

    try {
      const audio = await this.ttsProvider.synthesize(
        prep.spokenText,
        options,
        this.abortController.signal,
      );

      // Verify this session is still current (guards against race conditions)
      if (this.activeSessionToken !== sessionToken) {
        console.info(
          `[COGNORA][VOICE][DISCARD] Stale TTS response for session ${sessionToken} discarded.`,
        );
        return;
      }

      // Check authoritative stale isolation
      if (
        context.generationId &&
        this.queue.isAudioStale(
          context.generationId,
          context.worldVersion ?? 1,
          context.branchId ?? "MAIN",
          context.transformationId,
        )
      ) {
        console.warn(
          `[COGNORA][VOICE][STALE] Audio arrived for outdated generation or branch: ${context.generationId}/${context.branchId}`,
        );
        return;
      }

      const durationMs = Date.now() - t0;
      console.info(
        `[COGNORA][VOICE][TTS][SUCCESS] session=${sessionToken} durationMs=${durationMs}`,
      );

      // Store in cache
      audio.cacheKey = cacheKey;
      this.cache.set(cacheKey, audio);
      this.currentAudio = audio;

      // Play audio
      if (audio.audioUrl) {
        await this.player.play(audio.audioUrl, String(sessionToken));
      }
    } catch (err: unknown) {
      if (this.activeSessionToken !== sessionToken) {
        return;
      }
      if (err instanceof Error && err.name === "AbortError") {
        console.info(
          `[COGNORA][VOICE][ABORT] Synthesis for session ${sessionToken} was aborted.`,
        );
        this.setState("idle");
        return;
      }

      const msg = err instanceof Error ? err.message : "Voice playback failed";
      console.error(
        `[COGNORA][VOICE][TTS][ERROR] session=${sessionToken} error="${msg}"`,
      );
      this.errorMessage = msg;
      this.setState("error");
    } finally {
      this.abortController = null;
    }
  }

  public pause(): void {
    this.player.pause();
  }

  public resume(): void {
    this.player.resume();
  }

  public stop(): void {
    this.activeSessionToken++;
    this.cancelPendingRequest();
    this.player.stop();
    this.setState("stopped");
  }

  public replay(): void {
    if (this.currentAudio && this.currentAudio.audioUrl) {
      console.info(
        `[COGNORA][VOICE][REPLAY] session=${this.activeSessionToken}`,
      );
      this.player.replay();
    } else if (this.currentContext) {
      this.play(this.currentContext);
    }
  }

  /**
   * Called when user navigates to a new transformation or changes lessons.
   * Immediately stops audio and cancels pending synthesis so voice never speaks stale step.
   */
  public onTransformationChange(
    newContext?: VoiceExplanationContext | null,
  ): void {
    if (!this.currentContext && !newContext) {
      return;
    }

    if (
      this.currentContext &&
      newContext &&
      this.currentContext.lessonId === newContext.lessonId &&
      this.currentContext.transformationId === newContext.transformationId &&
      this.currentContext.stepIndex === newContext.stepIndex
    ) {
      return;
    }

    // Invalidate current session
    this.activeSessionToken++;
    this.cancelPendingRequest();
    this.player.stop();
    this.currentContext = newContext || null;
    this.setState("idle");

    if (newContext) {
      this.queue.updatePlaybackPosition(newContext.stepIndex);
    }
  }

  private cancelPendingRequest(): void {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // Safe ignore
      }
      this.abortController = null;
    }
  }

  public async prepareLessonAudio(
    timeline: {
      lessonId: string;
      topic?: string;
      currentIndex?: number;
      generationId?: string;
      worldVersion?: number;
      branchId?: string;
      meta?: readonly {
        id: string;
        title: string;
        explanation?: string;
        calculations?: string;
        insight?: string;
        semanticTarget?: string;
        narration?: string;
      }[];
    },
    options?: TTSOptions,
  ): Promise<void> {
    if (!timeline || !timeline.meta || timeline.meta.length === 0) {
      return;
    }

    // Update authoritative context
    const genId = timeline.generationId || this.activeGenerationId;
    const worldVer = timeline.worldVersion ?? this.activeWorldVersion;
    const branch = timeline.branchId || this.activeBranchId;
    this.setAuthoritativeContext(genId, worldVer, branch);

    // Convert metas to items for the prioritized, bounded queue
    const items = timeline.meta.map((m, idx) => {
      const ctx: VoiceExplanationContext = {
        lessonId: timeline.lessonId,
        transformationId: m.id || `t-${idx}`,
        stepIndex: idx,
        totalSteps: timeline.meta!.length,
        title: m.title || `Step ${idx + 1}`,
        explanation: m.explanation || "",
        calculations: m.calculations,
        insight: m.insight,
        topic: timeline.topic || "Concept",
        concept: timeline.topic || "Concept",
        semanticFocus: m.semanticTarget,
      };
      const prep = SpeechPreprocessor.prepare(ctx);
      return {
        transformationId: m.id || `t-${idx}`,
        narration: m.narration || prep.spokenText,
        stepIndex: idx,
      };
    });

    // Schedule current + next
    await this.queue.prepareCurrentAndNext(
      timeline.lessonId,
      timeline.currentIndex ?? 0,
      items,
      options,
    );
  }

  public isAudioReady(
    contextOrLessonId: VoiceExplanationContext | string,
    transformationIdOrOptions?: string | TTSOptions,
    options?: TTSOptions,
  ): boolean {
    if (typeof contextOrLessonId === "string") {
      const lessonId = contextOrLessonId;
      const transformationId = transformationIdOrOptions as string;
      const audio = this.cache.getByTransformation(lessonId, transformationId);
      return Boolean(audio && audio.audioUrl);
    }

    const context = contextOrLessonId;
    const opts = transformationIdOrOptions as TTSOptions | undefined;
    const prep = SpeechPreprocessor.prepare(context);
    const cacheKey = VoiceCache.generateKey(
      context.lessonId,
      context.transformationId,
      prep.spokenText,
      this.ttsProvider.name,
      opts?.voiceId,
    );
    const cached = this.cache.get(cacheKey);
    if (cached && cached.audioUrl) {
      return true;
    }
    const fallback = this.cache.getByTransformation(
      context.lessonId,
      context.transformationId,
    );
    return Boolean(fallback && fallback.audioUrl);
  }

  public getPreparedAudio(
    contextOrLessonId: VoiceExplanationContext | string,
    transformationIdOrOptions?: string | TTSOptions,
    options?: TTSOptions,
  ): TTSAudio | null {
    if (typeof contextOrLessonId === "string") {
      const lessonId = contextOrLessonId;
      const transformationId = transformationIdOrOptions as string;
      return this.cache.getByTransformation(lessonId, transformationId);
    }

    const context = contextOrLessonId;
    const opts = transformationIdOrOptions as TTSOptions | undefined;
    const prep = SpeechPreprocessor.prepare(context);
    const cacheKey = VoiceCache.generateKey(
      context.lessonId,
      context.transformationId,
      prep.spokenText,
      this.ttsProvider.name,
      opts?.voiceId,
    );
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    return this.cache.getByTransformation(
      context.lessonId,
      context.transformationId,
    );
  }

  public cleanup(): void {
    if (this.prepAbortController) {
      try {
        this.prepAbortController.abort();
      } catch {
        // Safe ignore
      }
      this.prepAbortController = null;
    }
    this.stop();
    this.queue.cleanup();
    this.cache.clear();
    this.player.cleanup();
    this.listeners.clear();
    this.onAudioEndedListeners.clear();
  }
}
