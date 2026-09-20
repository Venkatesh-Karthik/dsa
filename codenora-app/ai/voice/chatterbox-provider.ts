/**
 * Chatterbox TTS Provider
 *
 * Communicates with the local Chatterbox Python service via the Cognora backend proxy.
 * Every request carries a unique requestId for end-to-end tracing.
 */

import { AudioValidator } from "./audio-validator";
import { circuitBreaker } from "./circuit-breaker";
import type { TTSProvider } from "./tts-provider";
import type { TTSAudio, TTSOptions } from "./voice-contract";

let _chatterboxReqCounter = 0;

/** Typed error with a `code` property for the voice error taxonomy. */
export class ChatterboxError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ChatterboxError";
    this.code = code;
  }
}

export class ChatterboxProvider implements TTSProvider {
  public readonly name = "chatterbox";
  private endpoint = "/api/voice/synthesize";
  private healthEndpoint = "/api/voice/health";

  constructor(customEndpoint?: string) {
    if (customEndpoint) {
      this.endpoint = customEndpoint;
    }
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const timeoutController = new AbortController();
      const tid = setTimeout(() => timeoutController.abort(), 5_000);
      let res: Response;
      try {
        res = await fetch(this.healthEndpoint, {
          method: "GET",
          signal: timeoutController.signal,
        });
      } finally {
        clearTimeout(tid);
      }
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as { modelReady?: boolean };
      return Boolean(data.modelReady);
    } catch {
      return false;
    }
  }

  public async synthesize(
    text: string,
    options?: TTSOptions,
    signal?: AbortSignal,
  ): Promise<TTSAudio> {
    if (!circuitBreaker.canAttempt()) {
      throw new ChatterboxError(
        "Chatterbox circuit breaker is OPEN due to repeated failures/timeouts.",
        "CHATTERBOX_CIRCUIT_OPEN",
      );
    }

    const requestId = `CB-${Date.now()}-${(++_chatterboxReqCounter).toString(
      36,
    )}`;
    const t0 = Date.now();
    const url = this.endpoint;

    const payload = {
      text,
      voiceId: options?.voiceId || "tutor_default",
      speed: options?.speed ?? 1.0,
      exaggeration: options?.exaggeration ?? 0.5,
      cfgWeight: options?.cfgWeight ?? 0.5,
    };

    console.info(
      `[COGNORA][VOICE][BACKEND][FETCH_START] requestId=${requestId} url=${url} method=POST textLength=${text.length}`,
    );

    // Bounded safety timeout: 45 seconds if no external signal provided
    let internalController: AbortController | null = null;
    let internalTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let effectiveSignal = signal;
    if (!signal) {
      internalController = new AbortController();
      internalTimeoutId = setTimeout(() => internalController!.abort(), 45_000);
      effectiveSignal = internalController.signal;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: effectiveSignal,
      });
    } catch (err: unknown) {
      if (internalTimeoutId) {
        clearTimeout(internalTimeoutId);
      }
      const durationMs = Date.now() - t0;
      const errorName = err instanceof Error ? err.name : "UnknownError";
      const errorMessage = err instanceof Error ? err.message : String(err);

      const isTimeout =
        errorName === "AbortError" ||
        errorMessage.includes("timed out") ||
        errorMessage.includes("abort");
      const isUnavailable =
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("ENOTFOUND");

      const code = isTimeout
        ? "CHATTERBOX_TIMEOUT"
        : isUnavailable
        ? "CHATTERBOX_SERVICE_UNAVAILABLE"
        : "VOICE_INTERNAL_ERROR";

      circuitBreaker.recordFailure(isTimeout);

      console.warn(
        `[COGNORA][VOICE][BACKEND][FETCH_ERROR] requestId=${requestId} url=${url} errorName=${errorName} errorMessage="${errorMessage}" code=${code} durationMs=${durationMs}`,
      );

      throw new ChatterboxError(
        isTimeout
          ? "Voice synthesis timed out."
          : isUnavailable
          ? `Chatterbox service is not reachable. Start it with: .\\cognora-voice\\start_voice_service.ps1`
          : errorMessage,
        code,
      );
    } finally {
      if (internalTimeoutId) {
        clearTimeout(internalTimeoutId);
      }
    }

    if (!response.ok) {
      circuitBreaker.recordFailure(false);
      const durationMs = Date.now() - t0;
      let errMsg = `Chatterbox synthesis failed with HTTP ${response.status}`;
      let errCode = "CHATTERBOX_HTTP_ERROR";

      try {
        const errJson = (await response.json()) as {
          error?: string;
          detail?: string;
          code?: string;
        };
        const detail = errJson?.error || errJson?.detail;
        if (detail) {
          errMsg = detail;
        }
        if (errJson?.code) {
          errCode = errJson.code;
        } else if (response.status === 503) {
          errCode = "CHATTERBOX_SERVICE_UNAVAILABLE";
        }
      } catch {
        // Fallback to HTTP status
      }

      console.warn(
        `[COGNORA][VOICE][BACKEND][FETCH_ERROR] requestId=${requestId} url=${url} httpStatus=${response.status} code=${errCode} message="${errMsg}" durationMs=${durationMs}`,
      );

      throw new ChatterboxError(errMsg, errCode);
    }

    const blob = await response.blob();
    const durationMs = Date.now() - t0;

    if (blob.size === 0) {
      circuitBreaker.recordFailure(false);
      console.warn(
        `[COGNORA][VOICE][BACKEND][FETCH_ERROR] requestId=${requestId} url=${url} code=CHATTERBOX_EMPTY_AUDIO durationMs=${durationMs}`,
      );
      throw new ChatterboxError(
        "Chatterbox returned an empty audio payload.",
        "CHATTERBOX_EMPTY_AUDIO",
      );
    }

    // Validate MIME type (expect audio/*)
    if (blob.type && !blob.type.startsWith("audio/")) {
      circuitBreaker.recordFailure(false);
      console.warn(
        `[COGNORA][VOICE][BACKEND][FETCH_ERROR] requestId=${requestId} url=${url} code=CHATTERBOX_INVALID_AUDIO unexpectedMimeType=${blob.type} durationMs=${durationMs}`,
      );
      throw new ChatterboxError(
        `Chatterbox returned unexpected content type: ${blob.type}`,
        "CHATTERBOX_INVALID_AUDIO",
      );
    }

    // Structural validation of audio bytes
    const arrayBuffer = await blob.arrayBuffer();
    const validation = AudioValidator.validateWav(arrayBuffer);
    if (!validation.valid) {
      circuitBreaker.recordFailure(false);
      console.warn(
        `[COGNORA][VOICE][BACKEND][FETCH_ERROR] requestId=${requestId} url=${url} code=CHATTERBOX_INVALID_AUDIO reason="${validation.reason}" durationMs=${durationMs}`,
      );
      throw new ChatterboxError(
        `Audio validation failed: ${validation.reason}`,
        "CHATTERBOX_INVALID_AUDIO",
      );
    }

    circuitBreaker.recordSuccess();

    console.info(
      `[COGNORA][VOICE][BACKEND][FETCH_SUCCESS] requestId=${requestId} durationMs=${durationMs} mimeType=${
        blob.type || "audio/wav"
      } contentLength=${blob.size} estimatedDuration=${validation.durationSeconds}s`,
    );

    const audioUrl =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(blob)
        : "";

    return {
      audioUrl,
      mimeType: blob.type || "audio/wav",
      durationMs,
      provider: this.name,
      cacheKey: `${this.name}:${text.length}:${options?.voiceId || "default"}`,
    };
  }
}
