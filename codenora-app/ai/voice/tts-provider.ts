/**
 * Universal TTS Provider Interface
 *
 * Provides a clean abstraction boundary between Cognora's teaching UI
 * and concrete speech synthesis engines (Chatterbox, Kokoro, Web Speech fallback, etc.).
 */

import type { TTSAudio, TTSOptions } from "./voice-contract";

export interface TTSProvider {
  readonly name: string;

  /**
   * Checks whether the underlying TTS service/engine is ready and healthy.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Synthesizes natural speech audio from preprocessed text.
   */
  synthesize(
    text: string,
    options?: TTSOptions,
    signal?: AbortSignal,
  ): Promise<TTSAudio>;
}
