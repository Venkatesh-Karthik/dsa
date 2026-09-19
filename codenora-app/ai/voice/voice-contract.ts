/**
 * Cognora Voice Foundation & Contract
 *
 * Establishes the authoritative types and state machine for voice explanations
 * in Cognora. Designed for Phase 1 TTS playback and future voice agent integration.
 */

export type VoiceState =
  | "idle"
  | "preparing"
  | "speaking"
  | "paused"
  | "stopped"
  | "finished"
  | "error";

export interface VoiceExplanationContext {
  lessonId: string;
  transformationId: string;
  stepIndex: number;
  totalSteps: number;
  title: string;
  explanation: string;
  answerText?: string;
  calculations?: string;
  insight?: string;
  topic?: string;
  concept?: string;
  semanticFocus?: string;
  primaryTargetLabel?: string;
}

export interface TTSOptions {
  voiceId?: string;
  speed?: number;
  exaggeration?: number;
  cfgWeight?: number;
  seed?: number;
}

export interface TTSAudio {
  audioUrl?: string;
  audioBuffer?: ArrayBuffer;
  mimeType: string;
  durationMs?: number;
  provider: string;
  cacheKey: string;
}

export interface SpeechPreparationResult {
  spokenText: string;
  originalText: string;
  scrubbedTokens: string[];
  transformationId: string;
  stepIndex: number;
}

export interface VoiceServiceHealth {
  status: "ok" | "unavailable" | "error";
  modelReady: boolean;
  device: "cuda" | "cpu";
  vramUsedMb?: number;
  modelName?: string;
}

export interface CognoraVoiceConfig {
  provider: "chatterbox" | "fallback";
  voiceId: string;
  speed: number;
  autoSpeakOnNavigation: boolean;
}
