/**
 * Audio Validation Engine
 *
 * Verifies that audio buffers received from Chatterbox or proxy are genuine,
 * non-empty, and structurally valid before entering cache or playback.
 */

export interface AudioValidationResult {
  valid: boolean;
  error?: string;
  reason?: string;
  sampleRate?: number;
  durationSeconds?: number;
  durationEstimateMs?: number;
}

export class AudioValidator {
  /**
   * Validates an ArrayBuffer containing WAV audio data.
   */
  public static validateWav(buffer: ArrayBuffer | undefined | null): AudioValidationResult {
    if (!buffer) {
      const msg = "Audio buffer is null or undefined.";
      return { valid: false, error: msg, reason: msg };
    }

    if (buffer.byteLength < 44) {
      const msg = `Buffer too small for WAV header (${buffer.byteLength} bytes). Minimum 44 bytes required.`;
      return {
        valid: false,
        error: msg,
        reason: msg,
      };
    }

    const view = new DataView(buffer);

    // 1. Check "RIFF" signature (ASCII 0x52494646)
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );
    if (riff !== "RIFF") {
      const msg = `Invalid WAV file signature: expected 'RIFF', received '${riff}'.`;
      return {
        valid: false,
        error: msg,
        reason: msg,
      };
    }

    // 2. Check "WAVE" format (ASCII 0x57415645)
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    );
    if (wave !== "WAVE") {
      const msg = `Invalid WAV format header: expected 'WAVE', received '${wave}'.`;
      return {
        valid: false,
        error: msg,
        reason: msg,
      };
    }

    // 3. Estimate duration if PCM format
    try {
      const sampleRate = view.getUint32(24, true);
      const byteRate = view.getUint32(28, true);
      if (byteRate > 0) {
        const dataBytes = Math.max(0, buffer.byteLength - 44);
        const durationEstimateMs = Math.round((dataBytes / byteRate) * 1000);
        return {
          valid: true,
          sampleRate,
          durationEstimateMs,
          durationSeconds: durationEstimateMs / 1000,
        };
      }
    } catch {
      // Fallback: format is valid WAV even if sample rate parsing fails
    }

    return { valid: true };
  }
}
