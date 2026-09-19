import { describe, it, expect, vi, beforeEach } from "vitest";

import { VoiceCache } from "../ai/voice/voice-cache";
import { VoiceExplanationEngine } from "../ai/voice/voice-explanation-engine";

import type { TTSProvider } from "../ai/voice/tts-provider";
import type {
  TTSAudio,
  VoiceExplanationContext,
  VoiceState,
} from "../ai/voice/voice-contract";

describe("VoiceCache", () => {
  it("generates stable composite cache keys", () => {
    const key1 = VoiceCache.generateKey(
      "lesson-1",
      "t-1",
      "Explain binary search",
      "chatterbox",
      "default",
    );
    const key2 = VoiceCache.generateKey(
      "lesson-1",
      "t-1",
      "Explain binary search",
      "chatterbox",
      "default",
    );
    const key3 = VoiceCache.generateKey(
      "lesson-1",
      "t-2",
      "Explain binary search",
      "chatterbox",
      "default",
    );

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it("caches and retrieves TTSAudio entries", () => {
    const cache = new VoiceCache(5);
    const audio: TTSAudio = {
      audioUrl: "blob:mock-url",
      mimeType: "audio/wav",
      durationMs: 1200,
      provider: "chatterbox",
      cacheKey: "key-1",
    };

    cache.set("key-1", audio);
    const retrieved = cache.get("key-1");
    expect(retrieved).toBe(audio);
    expect(cache.get("non-existent")).toBeNull();
  });

  it("evicts oldest entries when exceeding maxEntries limit", () => {
    const cache = new VoiceCache(2);
    const createAudio = (id: string): TTSAudio => ({
      audioUrl: `blob:mock-url-${id}`,
      mimeType: "audio/wav",
      provider: "chatterbox",
      cacheKey: id,
    });

    cache.set("k1", createAudio("1"));
    cache.set("k2", createAudio("2"));
    cache.set("k3", createAudio("3"));

    expect(cache.get("k1")).toBeNull(); // Evicted
    expect(cache.get("k2")).not.toBeNull();
    expect(cache.get("k3")).not.toBeNull();
  });
});

describe("VoiceExplanationEngine", () => {
  let mockProvider: TTSProvider;
  let engine: VoiceExplanationEngine;

  const mockContext: VoiceExplanationContext = {
    lessonId: "lesson-test",
    transformationId: "t-1",
    stepIndex: 1,
    totalSteps: 3,
    title: "Split array in half",
    explanation: "We examine the pivot 42 and split the array.",
  };

  beforeEach(() => {
    mockProvider = {
      name: "mock-tts",
      isAvailable: vi.fn().mockResolvedValue(true),
      synthesize: vi.fn().mockResolvedValue({
        audioUrl: "blob:test-audio-url",
        mimeType: "audio/wav",
        durationMs: 1500,
        provider: "mock-tts",
        cacheKey: "mock-key",
      } as any as TTSAudio),
    };

    engine = new VoiceExplanationEngine(mockProvider);
  });

  it("initializes in idle state", () => {
    expect(engine.getState()).toBe("idle");
  });

  it("orchestrates play flow and notifies subscribers", async () => {
    const states: VoiceState[] = [];
    engine.subscribe((state) => {
      states.push(state);
    });

    await engine.play(mockContext);

    expect(mockProvider.synthesize).toHaveBeenCalledTimes(1);
    expect(states).toContain("preparing");
  });

  it("invalidates in-flight synthesis when user navigates to next step", async () => {
    let resolveSynthesis: (audio: TTSAudio) => void;
    const delayedSynthesis = new Promise<TTSAudio>((resolve) => {
      resolveSynthesis = resolve;
    });

    mockProvider.synthesize = vi.fn().mockReturnValue(delayedSynthesis);

    // Start playback for step 1
    const playPromise = engine.play(mockContext);
    expect(engine.getState()).toBe("preparing");

    // User navigates to step 2 before step 1 finishes synthesizing
    const nextContext: VoiceExplanationContext = {
      ...mockContext,
      transformationId: "t-2",
      stepIndex: 2,
      explanation: "Now we inspect the left half.",
    };
    engine.onTransformationChange(nextContext);

    // Complete the delayed synthesis
    resolveSynthesis!({
      audioUrl: "blob:stale-audio",
      mimeType: "audio/wav",
      provider: "mock-tts",
      cacheKey: "stale-key",
    });

    await playPromise;

    // Engine must not have set state to speaking for the stale step
    expect(engine.getState()).toBe("idle");
    expect(engine.getCurrentContext()?.transformationId).toBe("t-2");
  });

  it("gracefully catches provider errors without throwing", async () => {
    mockProvider.synthesize = vi
      .fn()
      .mockRejectedValue(new Error("Local TTS service unavailable"));

    await engine.play(mockContext);

    expect(engine.getState()).toBe("error");
    expect(engine.getErrorMessage()).toBe("Local TTS service unavailable");
  });

  it("prepares lesson audio asynchronously in background and reuses cached audio on play", async () => {
    const mockTimeline = {
      lessonId: "test-prepare-lesson",
      topic: "Binary Search",
      meta: [
        {
          id: "t-0",
          title: "Step 0",
          explanation: "Initial state",
        },
        {
          id: "t-1",
          title: "Step 1",
          explanation: "Middle element inspected",
        },
      ],
    };

    await engine.prepareLessonAudio(mockTimeline);

    // Wait a tick for the async sequential background worker to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(mockProvider.synthesize).toHaveBeenCalledTimes(2);

    const context0: VoiceExplanationContext = {
      lessonId: "test-prepare-lesson",
      transformationId: "t-0",
      stepIndex: 0,
      totalSteps: 2,
      title: "Step 0",
      explanation: "Initial state",
    };

    expect(engine.isAudioReady(context0)).toBe(true);

    const synthCallCountBefore = vi.mocked(mockProvider.synthesize).mock.calls
      .length;

    // Playing prepared audio should hit cache with ZERO new synthesis calls
    await engine.play(context0);

    expect(vi.mocked(mockProvider.synthesize).mock.calls.length).toBe(
      synthCallCountBefore,
    );
  });
});
