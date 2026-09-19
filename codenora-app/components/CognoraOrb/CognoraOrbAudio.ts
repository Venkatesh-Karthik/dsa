/**
 * Cognora Voice ORB Audio Processor
 *
 * Tier 2 & Tier 3 Multi-Band Audio Analyzer.
 * Extracts frequency bands (low, mid, high) and RMS energy with
 * asymmetric attack/decay smoothing to prevent visual jitter.
 */

import type { AudioBands } from "./CognoraOrbState";
import type { AudioAnalyzer } from "../../ai/voice/audio-analyzer";

export class OrbAudioProcessor {
  private smoothedBands: AudioBands = {
    low: 0,
    mid: 0,
    high: 0,
    energy: 0,
  };

  private rawFreqData: Uint8Array | null = null;

  /**
   * Processes the current audio frame from the attached AudioAnalyzer or returns smoothed resting state.
   */
  public process(
    analyzer: AudioAnalyzer | null | undefined,
    audioElement: HTMLAudioElement | null | undefined,
    isPlaying: boolean,
  ): AudioBands {
    if (
      !analyzer ||
      !isPlaying ||
      !audioElement ||
      audioElement.paused ||
      audioElement.ended
    ) {
      // Natural exponential decay to rest
      this.smoothedBands.low = Math.max(0, this.smoothedBands.low * 0.88);
      this.smoothedBands.mid = Math.max(0, this.smoothedBands.mid * 0.86);
      this.smoothedBands.high = Math.max(0, this.smoothedBands.high * 0.82);
      this.smoothedBands.energy = Math.max(0, this.smoothedBands.energy * 0.85);
      return { ...this.smoothedBands };
    }

    try {
      // Access internal analyser node if available
      const anyAnalyzer = analyzer as any;
      const analyserNode = anyAnalyzer.analyser as AnalyserNode | undefined;

      if (!analyserNode) {
        const energy = analyzer.getEnergy();
        this.smoothedBands.energy = energy;
        this.smoothedBands.low = energy * 0.8;
        this.smoothedBands.mid = energy;
        this.smoothedBands.high = energy * 0.5;
        return { ...this.smoothedBands };
      }

      if (
        !this.rawFreqData ||
        this.rawFreqData.length !== analyserNode.frequencyBinCount
      ) {
        this.rawFreqData = new Uint8Array(analyserNode.frequencyBinCount);
      }

      analyserNode.getByteFrequencyData(this.rawFreqData as any);

      // Total bins (usually 128 for fftSize 256)
      // Sampling rate typically 44.1kHz or 48kHz -> bin resolution ~180Hz
      // Low (Bass/Fundamental): bins 0 - 3 (~0 to 600Hz)
      // Mid (Vowels/Formants): bins 4 - 14 (~600Hz to 2500Hz)
      // High (Sibilants/Consonants): bins 15 - 32 (~2500Hz to 6000Hz)

      let sumLow = 0;
      const lowCount = Math.min(4, this.rawFreqData.length);
      for (let i = 0; i < lowCount; i++) {
        sumLow += this.rawFreqData[i];
      }
      const rawLow = sumLow / (lowCount * 255);

      let sumMid = 0;
      const midStart = lowCount;
      const midEnd = Math.min(15, this.rawFreqData.length);
      const midCount = Math.max(1, midEnd - midStart);
      for (let i = midStart; i < midEnd; i++) {
        sumMid += this.rawFreqData[i];
      }
      const rawMid = sumMid / (midCount * 255);

      let sumHigh = 0;
      const highStart = midEnd;
      const highEnd = Math.min(32, this.rawFreqData.length);
      const highCount = Math.max(1, highEnd - highStart);
      for (let i = highStart; i < highEnd; i++) {
        sumHigh += this.rawFreqData[i];
      }
      const rawHigh = sumHigh / (highCount * 255);

      // Noise floor gating
      const gate = (val: number, threshold: number) =>
        val < threshold ? 0 : (val - threshold) / (1 - threshold);

      const gatedLow = gate(rawLow, 0.05);
      const gatedMid = gate(rawMid, 0.04);
      const gatedHigh = gate(rawHigh, 0.03);
      const rawEnergy = analyzer.getEnergy();

      // Asymmetric attack & release filtering:
      // Fast attack ensures the ORB responds dynamically with the human voice
      // Gentle decay produces physical liquid relaxation rather than abrupt cuts
      const applyFilter = (
        current: number,
        target: number,
        attack: number,
        decay: number,
      ) => {
        return target > current
          ? current + (target - current) * attack
          : current + (target - current) * decay;
      };

      this.smoothedBands.low = applyFilter(
        this.smoothedBands.low,
        gatedLow,
        0.45,
        0.12,
      );
      this.smoothedBands.mid = applyFilter(
        this.smoothedBands.mid,
        gatedMid,
        0.5,
        0.14,
      );
      this.smoothedBands.high = applyFilter(
        this.smoothedBands.high,
        gatedHigh,
        0.55,
        0.16,
      );
      this.smoothedBands.energy = rawEnergy;

      return { ...this.smoothedBands };
    } catch {
      return { ...this.smoothedBands };
    }
  }

  public reset(): void {
    this.smoothedBands = { low: 0, mid: 0, high: 0, energy: 0 };
  }
}
