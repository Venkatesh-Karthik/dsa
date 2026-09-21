/**
 * Browser Speech Synthesis Provider for Cognora
 *
 * Fast, reliable, local speech synthesis using window.speechSynthesis
 * and SpeechSynthesisUtterance. Eliminates external model download, CUDA,
 * and Python service dependencies from the default voice experience.
 */

import { SpeechDirector } from "./speech-director";

import type { TTSProvider } from "./tts-provider";
import type { TTSAudio, TTSOptions } from "./voice-contract";

export interface BrowserSpeechOptions extends TTSOptions {
  transformationId?: string;
  worldVersion?: number;
  branchId?: string;
  semanticFocus?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (errorType: string) => void;
  onBoundary?: (charIndex: number) => void;
}

export class BrowserSpeechProvider implements TTSProvider {
  public readonly name = "browser-speech";

  private ownerWindow: Window | undefined;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private currentSessionToken = 0;
  private isPausedState = false;

  constructor(ownerWindow?: Window) {
    this.ownerWindow =
      ownerWindow ?? (typeof window !== "undefined" ? window : undefined);

    this.initVoices();
  }

  public setOwnerWindow(win: Window): void {
    this.ownerWindow = win;
    this.initVoices();
  }

  private get synth(): SpeechSynthesis | undefined {
    return this.ownerWindow?.speechSynthesis;
  }

  private get UtteranceClass():
    | (new (text?: string) => SpeechSynthesisUtterance)
    | undefined {
    const win = this.ownerWindow as any;
    if (win && win.SpeechSynthesisUtterance) {
      return win.SpeechSynthesisUtterance;
    }
    if (typeof SpeechSynthesisUtterance !== "undefined") {
      return SpeechSynthesisUtterance;
    }
    return undefined;
  }

  private initVoices(): void {
    const s = this.synth;
    if (!s) {
      return;
    }

    const loadVoices = () => {
      try {
        const voices = s.getVoices();
        if (voices && voices.length > 0) {
          this.selectBestVoice(voices);
        }
      } catch {
        // Safe ignore
      }
    };

    loadVoices();
    if (typeof s.addEventListener === "function") {
      s.addEventListener("voiceschanged", loadVoices);
    } else if ("onvoiceschanged" in s) {
      s.onvoiceschanged = loadVoices;
    }
  }

  private selectBestVoice(voices: SpeechSynthesisVoice[]): void {
    if (this.selectedVoice) {
      return;
    }

    // Prefer English voices
    const englishVoices = voices.filter((v) =>
      v.lang.toLowerCase().startsWith("en"),
    );

    const pool = englishVoices.length > 0 ? englishVoices : voices;

    // Preference hierarchy for natural, smooth browser voices
    const preferredPatterns = [
      /\b(natural|neural|online|enhanced)\b/i,
      /\b(google|samantha|karen|daniel|moira|serena|alex)\b/i,
      /\b(jenny|guy|aria|david|zira)\b/i,
    ];

    for (const pattern of preferredPatterns) {
      const match = pool.find((v) => pattern.test(v.name));
      if (match) {
        this.selectedVoice = match;
        return;
      }
    }

    // Default voice fallback
    this.selectedVoice = pool.find((v) => v.default) ?? pool[0] ?? null;
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(this.synth && this.UtteranceClass);
  }

  public getSelectedVoice(): SpeechSynthesisVoice | null {
    if (!this.selectedVoice && this.synth) {
      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        this.selectBestVoice(voices);
      }
    }
    return this.selectedVoice;
  }

  /**
   * TTSProvider interface compliance.
   * Produces a lightweight representation of the speech operation.
   */
  public async synthesize(
    text: string,
    options?: TTSOptions,
    signal?: AbortSignal,
  ): Promise<TTSAudio> {
    if (signal?.aborted) {
      const err = new Error("Speech synthesis was aborted.");
      err.name = "AbortError";
      throw err;
    }

    const available = await this.isAvailable();
    if (!available) {
      throw new Error(
        "Browser SpeechSynthesis is not supported in this environment.",
      );
    }

    const cleanedText = SpeechDirector.polishSpokenText(text);
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
    const durationMs = Math.round((wordCount / 2.3) * 1000);

    return {
      mimeType: "audio/speech-synthesis",
      durationMs,
      provider: this.name,
      cacheKey: `browser:${cleanedText.slice(0, 40)}`,
    };
  }

  /**
   * Directly speaks narration using sentence segmentation and controlled pacing.
   * Never throws uncaught errors to caller; logs observability events cleanly.
   */
  public async speak(
    text: string,
    options: BrowserSpeechOptions = {},
  ): Promise<void> {
    const s = this.synth;
    const Utterance = this.UtteranceClass;

    if (!s || !Utterance) {
      console.warn(
        "[COGNORA][VOICE][UNAVAILABLE] SpeechSynthesis is unavailable. Skipping speech gracefully.",
      );
      options.onError?.("UNAVAILABLE");
      return;
    }

    this.cancel();
    const sessionToken = ++this.currentSessionToken;
    this.isPausedState = false;

    const segments = SpeechDirector.splitIntoSemanticSegments(text, 12);
    if (segments.length === 0) {
      options.onEnd?.();
      return;
    }

    const transformationId = options.transformationId || "unknown";
    const worldVersion = options.worldVersion ?? 1;
    const voice = this.getSelectedVoice();
    const rate = Math.max(0.75, Math.min(1.4, (options.speed ?? 1.0) * 0.98));
    const pitch = 1.0;

    const tStart = Date.now();

    for (let i = 0; i < segments.length; i++) {
      if (this.currentSessionToken !== sessionToken) {
        return; // Interrupted or cancelled
      }

      const segmentText = segments[i];

      console.info(
        `[COGNORA][VOICE][BROWSER][START] transformationId=${transformationId} worldVersion=${worldVersion} segmentIndex=${
          i + 1
        }/${segments.length}`,
      );

      if (i === 0) {
        options.onStart?.();
      }

      await new Promise<void>((resolve) => {
        if (this.currentSessionToken !== sessionToken) {
          resolve();
          return;
        }

        try {
          const utterance = new Utterance(segmentText);
          if (voice) {
            utterance.voice = voice;
          }
          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.lang = voice?.lang || "en-US";

          this.activeUtterance = utterance;

          utterance.onend = () => {
            this.activeUtterance = null;
            resolve();
          };

          utterance.onerror = (evt) => {
            this.activeUtterance = null;
            const errorType = (evt as any)?.error || "browser_speech_error";
            if (errorType !== "canceled" && errorType !== "interrupted") {
              console.warn(
                `[COGNORA][VOICE][ERROR] error type: ${errorType} segment=${
                  i + 1
                }`,
              );
              options.onError?.(errorType);
            }
            resolve();
          };

          utterance.onboundary = (evt) => {
            options.onBoundary?.(evt.charIndex);
          };

          s.speak(utterance);
        } catch (err: any) {
          console.warn(
            `[COGNORA][VOICE][ERROR] error type: ${
              err?.message || "exception"
            }`,
          );
          options.onError?.(err?.name || "Exception");
          resolve();
        }
      });

      // Brief pause between sentences for natural phrasing (~180ms)
      if (
        i < segments.length - 1 &&
        this.currentSessionToken === sessionToken
      ) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }

    if (this.currentSessionToken === sessionToken) {
      const duration = Date.now() - tStart;
      console.info(`[COGNORA][VOICE][BROWSER][END] duration=${duration}ms`);
      options.onEnd?.();
    }
  }

  public pause(): void {
    try {
      if (this.synth && !this.isPausedState) {
        this.synth.pause();
        this.isPausedState = true;
      }
    } catch {
      // Safe ignore
    }
  }

  public resume(): void {
    try {
      if (this.synth && this.isPausedState) {
        this.synth.resume();
        this.isPausedState = false;
      }
    } catch {
      // Safe ignore
    }
  }

  public cancel(): void {
    this.currentSessionToken++;
    this.activeUtterance = null;
    this.isPausedState = false;
    try {
      if (this.synth) {
        this.synth.cancel();
      }
    } catch {
      // Safe ignore
    }
  }

  public isSpeaking(): boolean {
    return Boolean(this.synth?.speaking && !this.isPausedState);
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }
}
