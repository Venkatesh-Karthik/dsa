/**
 * Voice Explanation Engine for Cognora
 *
 * Coordinates speech preprocessing, TTS synthesis, caching, and audio playback.
 * Enforces transformation-level synchronization and race-condition immunity.
 */

import { AudioPlayer } from "./audio-player";
import { ChatterboxProvider } from "./chatterbox-provider";
import { SpeechPreprocessor } from "./speech-preprocessor";
import { VoiceCache } from "./voice-cache";

import type { TTSProvider } from "./tts-provider";
import type {
  TTSAudio,
  TTSOptions,
  VoiceExplanationContext,
  VoiceState,
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
  private player: AudioPlayer;
  private listeners = new Set<VoiceStateListener>();
  private onAudioEndedListeners = new Set<(sessionToken: number) => void>();
  private prepAbortController: AbortController | null = null;
  private prepLessonId: string | null = null;

  constructor(customProvider?: TTSProvider) {
    this.ttsProvider = customProvider || new ChatterboxProvider();
    this.cache = new VoiceCache(50);
    this.player = new AudioPlayer({
      onStatusChange: (status) => {
        if (status === "playing") {
          this.setState("speaking");
          console.info(
            `[COGNORA][VOICE][AUDIO][PLAY] session=${this.activeSessionToken}`,
          );
        } else if (status === "paused") {
          this.setState("paused");
          console.info(
            `[COGNORA][VOICE][AUDIO][PAUSE] session=${this.activeSessionToken}`,
          );
        } else if (status === "ended") {
          this.setState("finished");
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
          if (this.state === "speaking" || this.state === "paused") {
            this.setState("stopped");
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
        this.setState("error");
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
      meta?: readonly {
        id: string;
        title: string;
        explanation?: string;
        calculations?: string;
        insight?: string;
        semanticTarget?: string;
      }[];
    },
    options?: TTSOptions,
  ): Promise<void> {
    if (!timeline || !timeline.meta || timeline.meta.length === 0) {
      return;
    }

    // Cancel any in-flight background queue from previous lesson
    if (this.prepAbortController) {
      this.prepAbortController.abort();
      this.prepAbortController = null;
    }

    const abortController = new AbortController();
    this.prepAbortController = abortController;
    this.prepLessonId = timeline.lessonId;

    const metas = [...timeline.meta];
    const totalSteps = metas.length;
    const startIdx = Math.max(
      0,
      Math.min(timeline.currentIndex ?? 0, totalSteps - 1),
    );

    // Order items: priority to current step, then sequential remaining steps
    const orderedIndices = [startIdx];
    for (let i = 0; i < totalSteps; i++) {
      if (i !== startIdx) {
        orderedIndices.push(i);
      }
    }

    console.info(
      `[COGNORA][VOICE][PREPARE_QUEUE][START] lessonId=${timeline.lessonId} totalSteps=${totalSteps} prioritizedStep=${startIdx}`,
    );

    // Process sequentially (concurrency = 1) to respect local Chatterbox-Turbo single-worker
    (async () => {
      // HEALTH CHECK FIRST: probe the provider before attempting any synthesis.
      // If the service is down, we abort immediately rather than spamming N failed fetches.
      const isAvailable = await this.ttsProvider.isAvailable();
      if (!isAvailable) {
        console.warn(
          `[COGNORA][VOICE][PREPARE_QUEUE][CHATTERBOX_UNAVAILABLE] lessonId=${timeline.lessonId} — Chatterbox service is not reachable. Skipping preparation queue. Start with: .\\cognora-voice\\start_voice_service.ps1`,
        );
        return;
      }

      // Cap consecutive failures to prevent retry storms when service goes down mid-queue
      const MAX_CONSECUTIVE_FAILURES = 2;
      let consecutiveFailures = 0;

      for (const idx of orderedIndices) {
        if (abortController.signal.aborted) {
          console.info(
            `[COGNORA][VOICE][PREPARE_QUEUE][ABORT] Preparation for lessonId=${timeline.lessonId} aborted.`,
          );
          break;
        }

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.warn(
            `[COGNORA][VOICE][PREPARE_QUEUE][ABORT_CONSECUTIVE_FAILURES] lessonId=${timeline.lessonId} — ${consecutiveFailures} consecutive failures. Aborting preparation queue to prevent retry storm.`,
          );
          break;
        }

        const meta = metas[idx];
        if (!meta) {
          continue;
        }

        const context: VoiceExplanationContext = {
          lessonId: timeline.lessonId,
          transformationId: meta.id || `t-${idx}`,
          stepIndex: idx,
          totalSteps,
          title: meta.title || `Step ${idx + 1}`,
          explanation: meta.explanation || "",
          calculations: meta.calculations,
          insight: meta.insight,
          topic: timeline.topic || "Concept",
          concept: timeline.topic || "Concept",
          semanticFocus: meta.semanticTarget,
        };

        const prep = SpeechPreprocessor.prepare(context);
        const cacheKey = VoiceCache.generateKey(
          context.lessonId,
          context.transformationId,
          prep.spokenText,
          this.ttsProvider.name,
          options?.voiceId,
        );

        if (this.cache.get(cacheKey)) {
          consecutiveFailures = 0; // Reset on cache hit (success path)
          continue; // Already synthesized and cached
        }

        try {
          console.info(
            `[COGNORA][VOICE][PREPARE_QUEUE][SYNTH_START] step=${idx} transformationId=${context.transformationId}`,
          );
          const audio = await this.ttsProvider.synthesize(
            prep.spokenText,
            options,
            abortController.signal,
          );
          if (abortController.signal.aborted) {
            break;
          }
          audio.cacheKey = cacheKey;
          this.cache.set(cacheKey, audio);
          consecutiveFailures = 0; // Reset on success
          console.info(
            `[COGNORA][VOICE][PREPARE_QUEUE][SYNTH_SUCCESS] step=${idx} transformationId=${context.transformationId} cached`,
          );
        } catch (err: unknown) {
          if (abortController.signal.aborted) {
            break;
          }
          consecutiveFailures++;
          const errorName = err instanceof Error ? err.name : "UnknownError";
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.warn(
            `[COGNORA][VOICE][PREPARE_QUEUE][SYNTH_FAIL] step=${idx} transformationId=${context.transformationId} consecutiveFailures=${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} errorName=${errorName} errorMessage="${errorMessage}"`,
          );
        }
      }
    })();
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
    this.cache.clear();
    this.player.cleanup();
    this.listeners.clear();
    this.onAudioEndedListeners.clear();
  }
}
