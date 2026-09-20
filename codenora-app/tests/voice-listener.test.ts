/**
 * Cognora Voice 2: VoiceListener Unit Tests
 *
 * Tests:
 * 1. State machine transitions (IDLE, LISTENING, INTERRUPTED, PROCESSING)
 * 2. Instant Interruption callback on speech onset
 * 3. Turn commit on final transcript
 * 4. Graceful handling when Web Audio / SpeechRecognition are unavailable
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoiceListener, type VoiceListenerCallbacks } from "../ai/voice/voice-listener";

describe("VoiceListener", () => {
  let callbacks: VoiceListenerCallbacks;

  beforeEach(() => {
    callbacks = {
      onStateChange: vi.fn(),
      onSpeechStart: vi.fn(),
      onInterimTranscript: vi.fn(),
      onFinalTranscript: vi.fn(),
      onError: vi.fn(),
    };
  });

  it("initializes in IDLE state", () => {
    const listener = new VoiceListener(callbacks);
    expect(listener.getState()).toBe("IDLE");
    expect(listener.isListening()).toBe(false);
  });

  it("handles environment without Web Speech or MediaDevices gracefully", async () => {
    const mockWindow = {} as Window;
    const listener = new VoiceListener(callbacks, mockWindow);
    const success = await listener.start();
    expect(success).toBe(true);
    expect(listener.getState()).toBe("LISTENING");
    listener.stop();
    expect(listener.getState()).toBe("IDLE");
  });

  it("emits interruption on speech start when speech activity occurs", () => {
    const listener = new VoiceListener(callbacks);
    // Directly test private handleSpeechOnset method invocation through prototype or mock
    (listener as any).handleSpeechOnset();

    expect(callbacks.onSpeechStart).toHaveBeenCalledTimes(1);
    expect(listener.getState()).toBe("INTERRUPTED");
  });

  it("commits spoken turns cleanly", () => {
    const listener = new VoiceListener(callbacks);
    (listener as any).currentTranscript = "Why did we eliminate the left side?";
    (listener as any).commitTurn();

    expect(callbacks.onFinalTranscript).toHaveBeenCalledWith("Why did we eliminate the left side?");
    expect(listener.getState()).toBe("LISTENING");
  });
});
