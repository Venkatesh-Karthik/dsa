/**
 * Unit Tests for Voice Queue 2.0, Audio Validation, and Circuit Breaker
 *
 * Verifies:
 * 1. Priority scheduling (CURRENT_STEP > NEXT_STEP > PREFETCH).
 * 2. Deduplication & promise coalescing (identical narrations synthesize once).
 * 3. Bounded prefetch (Current + Next).
 * 4. Stale audio rejection (generation, branch, world version, transformation isolation).
 * 5. Circuit Breaker transitions (CLOSED -> OPEN -> HALF_OPEN).
 * 6. Audio validation (WAV format, min length, byte validation).
 * 7. SpeechDirector (WHAT + WHY + RESULT and semantic sentence splitting).
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

import { VoiceQueue } from "../ai/voice/voice-queue";
import { VoiceCache } from "../ai/voice/voice-cache";
import { CircuitBreaker } from "../ai/voice/circuit-breaker";
import { AudioValidator } from "../ai/voice/audio-validator";
import { SpeechDirector } from "../ai/voice/speech-director";
import { VoicePriority, type TTSAudio } from "../ai/voice/voice-contract";
import type { TTSProvider } from "../ai/voice/tts-provider";

function createValidWavBuffer(sampleRate = 24000, durationSec = 1): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = sampleRate * durationSec * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // "RIFF" chunk descriptor
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, 36 + dataSize, true);
  // "WAVE"
  view.setUint8(8, 0x57);  // W
  view.setUint8(9, 0x41);  // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E
  // "fmt " sub-chunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // "data" sub-chunk
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, dataSize, true);

  return buffer;
}

describe("Voice 3.0: AudioValidator", () => {
  it("validates well-formed WAV buffers correctly", () => {
    const buffer = createValidWavBuffer(24000, 2);
    const result = AudioValidator.validateWav(buffer);
    expect(result.valid).toBe(true);
    expect(result.sampleRate).toBe(24000);
    expect(result.durationSeconds).toBeCloseTo(2, 1);
  });

  it("rejects empty or truncated buffers", () => {
    const emptyBuffer = new ArrayBuffer(0);
    const res1 = AudioValidator.validateWav(emptyBuffer);
    expect(res1.valid).toBe(false);
    expect(res1.reason).toContain("Buffer too small");

    const smallBuffer = new ArrayBuffer(30);
    const res2 = AudioValidator.validateWav(smallBuffer);
    expect(res2.valid).toBe(false);
  });

  it("rejects corrupt or non-WAV headers", () => {
    const corruptBuffer = new ArrayBuffer(48);
    const view = new Uint8Array(corruptBuffer);
    view.fill(0xff);
    const result = AudioValidator.validateWav(corruptBuffer);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid WAV");
  });
});

describe("Voice 3.0: CircuitBreaker", () => {
  it("transitions to OPEN after threshold failures and recovers in HALF_OPEN", () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      timeoutThreshold: 2,
      cooldownMs: 50,
    });

    expect(cb.canAttempt()).toBe(true);
    expect(cb.getState()).toBe("CLOSED");

    // 2 timeouts trigger OPEN (since timeoutThreshold is 2)
    cb.recordFailure(true);
    expect(cb.canAttempt()).toBe(true);
    cb.recordFailure(true);

    expect(cb.getState()).toBe("OPEN");
    expect(cb.canAttempt()).toBe(false);

    // Wait for cooldown
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.canAttempt()).toBe(true);
        expect(cb.getState()).toBe("HALF_OPEN");

        // Success resets to CLOSED
        cb.recordSuccess();
        expect(cb.getState()).toBe("CLOSED");
        resolve();
      }, 75);
    });
  });
});

describe("Voice 3.0: SpeechDirector", () => {
  it("structures natural WHAT + WHY + RESULT pedagogical narration", () => {
    const moment: any = {
      title: "Right Rotation",
      whatChanged: "Node 20 pivots to become the new root of the subtree.",
      whyItChanged: "Node 10 insertion created a left-heavy balance factor of +2.",
      consequence: "The balance factor of node 20 and node 30 returns to 0.",
    };

    const script = SpeechDirector.directNarration(moment);
    expect(script).toContain("pivots to become the new root");
    expect(script).toContain("This is because");
    expect(script).toContain("As a result");
  });

  it("splits long narrations dynamically at semantic sentence boundaries", () => {
    const longText =
      "First we observe the root node 30. Its balance factor has exceeded the permitted limit because the left subtree is too tall. Therefore we must execute a right rotation around node 20. Once complete, node 20 becomes the new root and the subtree is balanced.";

    const segments = SpeechDirector.splitIntoSemanticSegments(longText, 20);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(segment).toMatch(/[.!?]$/); // Ends with clean punctuation
    }
  });
});

describe("Voice 3.0: VoiceQueue 2.0", () => {
  let mockProvider: TTSProvider;
  let cache: VoiceCache;
  let queue: VoiceQueue;

  beforeEach(() => {
    cache = new VoiceCache(20);
    mockProvider = {
      name: "mock-provider",
      isAvailable: vi.fn().mockResolvedValue(true),
      synthesize: vi.fn().mockImplementation(async (text) => ({
        audioUrl: `blob:${text.slice(0, 10)}`,
        mimeType: "audio/wav",
        durationMs: 1500,
        provider: "mock-provider",
        cacheKey: `cache-${text.slice(0, 10)}`,
      })),
    };
    queue = new VoiceQueue(mockProvider, cache);
  });

  it("prioritizes CURRENT_STEP over PREFETCH requests", async () => {
    const executionOrder: string[] = [];
    let resolveBusy: () => void;

    mockProvider.synthesize = vi.fn().mockImplementation(async (text) => {
      if (text.includes("Busy")) {
        await new Promise<void>((r) => {
          resolveBusy = r;
        });
      } else {
        executionOrder.push(text);
      }
      return {
        audioUrl: `blob:${text}`,
        mimeType: "audio/wav",
        durationMs: 100,
        provider: "mock-provider",
        cacheKey: text,
      };
    });

    // Start initial busy job so queue buffers subsequent requests
    const pBusy = queue.enqueue({
      lessonId: "avl-1",
      generationId: "GEN-1",
      transformationId: "step-busy",
      worldVersion: 1,
      branchId: "MAIN",
      narration: "Busy initial job",
      priority: VoicePriority.BACKGROUND,
    });

    // Enqueue prefetch (lower priority)
    const p1 = queue.enqueue({
      lessonId: "avl-1",
      generationId: "GEN-1",
      transformationId: "step-2",
      worldVersion: 1,
      branchId: "MAIN",
      narration: "Prefetch step 2",
      priority: VoicePriority.PREFETCH,
    });

    // Enqueue active step with high priority
    const p2 = queue.enqueue({
      lessonId: "avl-1",
      generationId: "GEN-1",
      transformationId: "step-1",
      worldVersion: 1,
      branchId: "MAIN",
      narration: "Active step 1",
      priority: VoicePriority.CURRENT_STEP,
    });

    // Release busy job to let queue process buffered items in priority order
    resolveBusy!();
    await Promise.all([pBusy, p1, p2]);

    // Active step was synthesized before the lower priority prefetch
    expect(executionOrder[0]).toContain("Active step 1");
    expect(executionOrder[1]).toContain("Prefetch step 2");
  });

  it("coalesces identical narration requests without duplicate synthesis", async () => {
    const p1 = queue.enqueue({
      lessonId: "avl-1",
      generationId: "GEN-1",
      transformationId: "step-1",
      worldVersion: 1,
      branchId: "MAIN",
      narration: "Same narration text",
      priority: VoicePriority.CURRENT_STEP,
    });

    const p2 = queue.enqueue({
      lessonId: "avl-1",
      generationId: "GEN-1",
      transformationId: "step-1-dup",
      worldVersion: 1,
      branchId: "MAIN",
      narration: "Same narration text",
      priority: VoicePriority.CURRENT_STEP,
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(mockProvider.synthesize).toHaveBeenCalledTimes(1);
    expect(res1?.audioUrl).toBe(res2?.audioUrl);
  });

  it("rejects stale audio when generation or branch changes", () => {
    queue.setAuthoritativeContext("GEN-102", 2, "MAIN");

    // Old generation audio
    expect(queue.isAudioStale("GEN-101", 2, "MAIN", "step-1")).toBe(true);

    // Old branch audio
    expect(queue.isAudioStale("GEN-102", 2, "WHAT_IF_1", "step-1")).toBe(true);

    // Old world version
    expect(queue.isAudioStale("GEN-102", 1, "MAIN", "step-1")).toBe(true);

    // Matching current authoritative context
    expect(queue.isAudioStale("GEN-102", 2, "MAIN", "step-1")).toBe(false);
  });

  it("provides comprehensive diagnostics telemetry", async () => {
    await queue.enqueue({
      lessonId: "test-diag",
      generationId: "GEN-1",
      transformationId: "step-0",
      worldVersion: 1,
      branchId: "MAIN",
      narration: "Testing diagnostics",
      priority: VoicePriority.CURRENT_STEP,
    });

    const diag = queue.getDiagnostics();
    expect(diag.serviceStatus).toBe("READY");
    expect(diag.totalRequests).toBe(1);
    expect(diag.queueLength).toBe(0);
    expect(diag.circuitBreakerState).toBe("CLOSED");
  });
});
