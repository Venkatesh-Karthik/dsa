/**
 * Cognora Voice Audio Analyzer
 *
 * Real-time Web Audio API signal processor for the Cognora Liquid Glass Voice ORB.
 *
 * Pipeline:
 * HTMLAudioElement -> AudioContext -> AnalyserNode -> Filtered Frequencies -> Smoothed Energy
 *
 * Features:
 * - Anti-jitter / anti-cut attack & release smoothing
 * - Noise-floor gating (disregards room noise / silence)
 * - Safe WeakMap-based MediaElementAudioSourceNode caching
 * - Browser audio unlock handling
 */

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceMap = new WeakMap<
    HTMLAudioElement,
    MediaElementAudioSourceNode
  >();
  private currentElement: HTMLAudioElement | null = null;
  private freqData: Uint8Array | null = null;
  private smoothedEnergy: number = 0;
  private isInitialized: boolean = false;

  private initContext(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    if (this.audioContext && this.analyser) {
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }
      return true;
    }

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        return false;
      }

      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      this.audioContext = ctx;
      this.analyser = analyser;
      this.freqData = new Uint8Array(analyser.frequencyBinCount);
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.warn(
        "[COGNORA][AUDIO_ANALYZER] Web Audio initialization failed:",
        e,
      );
      return false;
    }
  }

  /**
   * Attaches the analyzer to an active HTMLAudioElement.
   */
  public attach(audio: HTMLAudioElement | null): void {
    if (!audio) {
      this.currentElement = null;
      return;
    }

    if (this.currentElement === audio) {
      return;
    }

    if (!this.initContext() || !this.audioContext || !this.analyser) {
      this.currentElement = audio;
      return;
    }

    try {
      this.currentElement = audio;

      // HTMLAudioElement can only be connected to createMediaElementSource once per element
      let source = this.sourceMap.get(audio);
      if (!source) {
        source = this.audioContext.createMediaElementSource(audio);
        this.sourceMap.set(audio, source);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }
    } catch (err) {
      // If element is already connected or CORS blocked, handle gracefully
      console.warn(
        "[COGNORA][AUDIO_ANALYZER] Audio node connection warning:",
        err,
      );
    }
  }

  /**
   * Returns a smoothed amplitude/energy value between 0.0 and 1.0.
   * Uses asymmetric attack and decay filters to prevent visual stuttering and jumping.
   */
  public getEnergy(): number {
    if (
      !this.initContext() ||
      !this.analyser ||
      !this.freqData ||
      !this.currentElement
    ) {
      // Smoothly decay to zero when no active audio
      this.smoothedEnergy = Math.max(0, this.smoothedEnergy * 0.9);
      return this.smoothedEnergy;
    }

    if (this.currentElement.paused || this.currentElement.ended) {
      this.smoothedEnergy = Math.max(0, this.smoothedEnergy * 0.85);
      return this.smoothedEnergy;
    }

    try {
      this.analyser.getByteFrequencyData(this.freqData as any);

      // Focus on speech frequency band (approx 100Hz to 3500Hz)
      const speechBinCount = Math.min(this.freqData.length, 48);
      let sum = 0;
      for (let i = 0; i < speechBinCount; i++) {
        sum += this.freqData[i];
      }

      const raw = sum / (speechBinCount * 255);

      // Noise floor gate
      const gated = raw < 0.03 ? 0 : (raw - 0.03) / 0.97;

      // Asymmetric smoothing: fast attack (responsive), smooth decay (liquid-like)
      const attackFactor = 0.45;
      const decayFactor = 0.12;

      if (gated > this.smoothedEnergy) {
        this.smoothedEnergy += (gated - this.smoothedEnergy) * attackFactor;
      } else {
        this.smoothedEnergy += (gated - this.smoothedEnergy) * decayFactor;
      }

      return Math.max(0, Math.min(1, this.smoothedEnergy));
    } catch {
      return 0;
    }
  }

  /**
   * Closes the AudioContext on teardown.
   */
  public destroy(): void {
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.analyser = null;
    this.currentElement = null;
    this.isInitialized = false;
  }
}
