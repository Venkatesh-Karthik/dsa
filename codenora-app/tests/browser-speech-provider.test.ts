import { describe, it, expect, vi, beforeEach } from "vitest";

import { BrowserSpeechProvider } from "../ai/voice/browser-speech-provider";

describe("BrowserSpeechProvider", () => {
  let mockWindow: any;
  let mockVoices: any[];
  let spokeUtterances: any[];

  beforeEach(() => {
    spokeUtterances = [];
    mockVoices = [
      {
        name: "Microsoft David - English (United States)",
        lang: "en-US",
        default: true,
      },
      { name: "Google US English Natural", lang: "en-US", default: false },
    ];

    class MockSpeechSynthesisUtterance {
      public text: string;
      public rate: number = 1.0;
      public pitch: number = 1.0;
      public voice: any = null;
      public lang: string = "en-US";
      public onend: (() => void) | null = null;
      public onerror: ((evt: any) => void) | null = null;
      public onboundary: ((evt: any) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    const mockSynth = {
      speaking: false,
      paused: false,
      getVoices: () => mockVoices,
      speak: vi.fn((utterance: any) => {
        spokeUtterances.push(utterance);
        // Automatically trigger end asynchronously to simulate speech finishing
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      addEventListener: vi.fn(),
    };

    mockWindow = {
      speechSynthesis: mockSynth,
      SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
    };
  });

  it("identifies availability accurately based on window objects", async () => {
    const provider = new BrowserSpeechProvider(mockWindow);
    const available = await provider.isAvailable();
    expect(available).toBe(true);

    const emptyProvider = new BrowserSpeechProvider({} as Window);
    const emptyAvailable = await emptyProvider.isAvailable();
    expect(emptyAvailable).toBe(false);
  });

  it("selects the best natural English voice from available options", () => {
    const provider = new BrowserSpeechProvider(mockWindow);
    const voice = provider.getSelectedVoice();
    expect(voice).toBeDefined();
    expect(voice?.name).toBe("Google US English Natural");
  });

  it("speaks segmented sentences smoothly without blocking", async () => {
    const provider = new BrowserSpeechProvider(mockWindow);
    let started = false;
    let ended = false;

    await provider.speak(
      "Now we insert twenty. Twenty is smaller than fifty, so we move left. Thirty is the next node.",
      {
        transformationId: "t-1",
        worldVersion: 1,
        onStart: () => {
          started = true;
        },
        onEnd: () => {
          ended = true;
        },
      },
    );

    expect(started).toBe(true);
    expect(ended).toBe(true);
    expect(spokeUtterances.length).toBeGreaterThanOrEqual(2);
  });

  it("gracefully isolates errors when speech synthesis is unsupported", async () => {
    const provider = new BrowserSpeechProvider({} as Window);
    let errorReported = "";

    await provider.speak("Testing unsupported environment", {
      onError: (err) => {
        errorReported = err;
      },
    });

    expect(errorReported).toBe("UNAVAILABLE");
  });

  it("cancels active speech when requested", () => {
    const provider = new BrowserSpeechProvider(mockWindow);
    provider.cancel();
    expect(mockWindow.speechSynthesis.cancel).toHaveBeenCalled();
  });
});
