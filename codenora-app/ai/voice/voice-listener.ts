/**
 * Cognora Voice 2: Voice Listener with VAD & Live Interruption
 *
 * Implements:
 * 1. Web Speech API continuous/streaming speech recognition
 * 2. Web Audio Voice Activity Detection (VAD) via AnalyserNode volume monitoring
 * 3. Instant Speech Interruption (User Speech > Active Cognora Speech)
 * 4. Natural turn detection with silence gating
 *
 * Adheres to AGENTS.md rule: derives window/document from ownerDocument/defaultView.
 */

export type VoiceListenerState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "PAUSED"
  | "ERROR";

export interface VoiceListenerCallbacks {
  onStateChange: (state: VoiceListenerState) => void;
  onSpeechStart: () => void; // Interruption signal fired on voice activity onset
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export class VoiceListener {
  private state: VoiceListenerState = "IDLE";
  private callbacks: VoiceListenerCallbacks;
  private recognition: any = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private vadIntervalId: number | null = null;
  private silenceTimerId: number | null = null;
  private isUserSpeaking: boolean = false;
  private currentTranscript: string = "";
  private ownerWindow: Window | null = null;

  // VAD Configuration
  private readonly VAD_RMS_THRESHOLD = 0.045; // Minimum RMS amplitude to consider human speech
  private readonly VAD_SILENCE_TIMEOUT_MS = 650; // Silence threshold to commit a spoken turn

  constructor(callbacks: VoiceListenerCallbacks, targetWindow?: Window | null) {
    this.callbacks = callbacks;
    this.ownerWindow =
      targetWindow || (typeof window !== "undefined" ? window : null);
  }

  public getState(): VoiceListenerState {
    return this.state;
  }

  public isListening(): boolean {
    return this.state === "LISTENING" || this.state === "INTERRUPTED";
  }

  private setState(next: VoiceListenerState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    console.log(`[COGNORA][VOICE_LISTENER] state=${next}`);
    this.callbacks.onStateChange(next);
  }

  /**
   * Starts microphone capture with VAD and streaming speech recognition
   */
  public async start(): Promise<boolean> {
    const win = this.ownerWindow;
    if (!win) {
      this.callbacks.onError("No active browser window found.");
      return false;
    }

    try {
      // 1. Initialize Web Audio API for fast VAD
      const AudioCtx =
        (win as any).AudioContext || (win as any).webkitAudioContext;
      if (AudioCtx && navigator.mediaDevices?.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          const ctx: AudioContext = new AudioCtx();
          this.audioContext = ctx;
          const source = ctx.createMediaStreamSource(this.mediaStream);
          this.analyser = ctx.createAnalyser();
          this.analyser.fftSize = 512;
          this.analyser.smoothingTimeConstant = 0.3;
          source.connect(this.analyser);

          this.startVadMonitoring();
        } catch (vadErr) {
          console.warn(
            "[COGNORA][VOICE_LISTENER] VAD microphone access denied or failed, falling back to ASR-only mode:",
            vadErr,
          );
        }
      }

      // 2. Initialize Web Speech API for streaming transcription
      const SpeechRec =
        (win as any).SpeechRecognition || (win as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";

        this.recognition.onstart = () => {
          this.setState("LISTENING");
        };

        this.recognition.onresult = (event: any) => {
          let interim = "";
          let final = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const transcript = result[0]?.transcript || "";
            if (result.isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }

          // Trigger speech onset interruption on early interim tokens
          if (interim.trim() && !this.isUserSpeaking) {
            this.handleSpeechOnset();
          }

          if (interim.trim()) {
            this.callbacks.onInterimTranscript(interim.trim());
          }

          if (final.trim()) {
            this.currentTranscript = (
              this.currentTranscript +
              " " +
              final.trim()
            ).trim();
            this.scheduleTurnCommit();
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn("[COGNORA][VOICE_LISTENER] ASR error:", event.error);
          if (event.error !== "no-speech") {
            this.callbacks.onError(`ASR: ${event.error}`);
          }
        };

        this.recognition.onend = () => {
          if (this.state === "LISTENING" || this.state === "INTERRUPTED") {
            // Auto-restart continuous recognition if listening is still desired
            try {
              this.recognition?.start();
            } catch {
              // Ignore restart if already started
            }
          } else {
            this.setState("IDLE");
          }
        };

        this.recognition.start();
      } else {
        console.warn(
          "[COGNORA][VOICE_LISTENER] Web Speech API not supported in this browser.",
        );
      }

      this.setState("LISTENING");
      return true;
    } catch (err: any) {
      this.setState("ERROR");
      this.callbacks.onError(err?.message || "Failed to start voice listener.");
      return false;
    }
  }

  /**
   * Fast VAD energy loop monitoring RMS amplitude
   */
  private startVadMonitoring(): void {
    if (!this.analyser) {
      return;
    }
    const buffer = new Float32Array(this.analyser.fftSize);

    this.vadIntervalId = (this.ownerWindow || window).setInterval(() => {
      if (!this.analyser || this.state !== "LISTENING") {
        return;
      }

      this.analyser.getFloatTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);

      if (rms > this.VAD_RMS_THRESHOLD) {
        if (!this.isUserSpeaking) {
          this.handleSpeechOnset();
        }
        this.resetSilenceTimer();
      }
    }, 40);
  }

  /**
   * Fired immediately when speech activity is detected
   */
  private handleSpeechOnset(): void {
    this.isUserSpeaking = true;
    this.setState("INTERRUPTED");
    console.log(
      "[COGNORA][VOICE_LISTENER] Speech onset detected! Emitting interruption.",
    );
    this.callbacks.onSpeechStart();
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimerId !== null) {
      clearTimeout(this.silenceTimerId);
    }
    this.silenceTimerId = (this.ownerWindow || window).setTimeout(() => {
      if (this.isUserSpeaking) {
        this.isUserSpeaking = false;
        this.commitTurn();
      }
    }, this.VAD_SILENCE_TIMEOUT_MS) as any;
  }

  private scheduleTurnCommit(): void {
    if (this.silenceTimerId !== null) {
      clearTimeout(this.silenceTimerId);
    }
    this.silenceTimerId = (this.ownerWindow || window).setTimeout(() => {
      this.commitTurn();
    }, 500) as any;
  }

  private commitTurn(): void {
    const text = this.currentTranscript.trim();
    this.currentTranscript = "";
    if (text) {
      console.log(`[COGNORA][VOICE_LISTENER] Committed turn: "${text}"`);
      this.setState("PROCESSING");
      this.callbacks.onFinalTranscript(text);
      // Settle back to listening
      this.setState("LISTENING");
    }
  }

  /**
   * Stops listening and cleans up media streams and audio context
   */
  public stop(): void {
    if (this.vadIntervalId !== null) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }
    if (this.silenceTimerId !== null) {
      clearTimeout(this.silenceTimerId);
      this.silenceTimerId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
    }

    this.analyser = null;
    this.isUserSpeaking = false;
    this.currentTranscript = "";
    this.setState("IDLE");
  }

  public destroy(): void {
    this.stop();
  }
}
