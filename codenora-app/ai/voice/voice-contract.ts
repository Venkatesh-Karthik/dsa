/**
 * Cognora Voice Foundation & Contract
 *
 * Establishes the authoritative types and state machine for voice explanations
 * in Cognora. Designed for Phase 1 TTS playback and future voice agent integration.
 */

export type LessonState =
  | "IDLE"
  | "GENERATING"
  | "VALIDATING"
  | "COMPILING"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED";

export type VoiceState =
  | "OFF"
  | "IDLE"
  | "QUEUED"
  | "SYNTHESIZING"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "INTERRUPTED"
  | "DEGRADED"
  | "TIMEOUT"
  | "FAILED"
  | "UNAVAILABLE"
  // Legacy aliases for backward compatibility with UI
  | "idle"
  | "preparing"
  | "speaking"
  | "paused"
  | "stopped"
  | "finished"
  | "error";

export type VoiceQueueStatus =
  | "PENDING"
  | "QUEUED"
  | "SYNTHESIZING"
  | "AUDIO_READY"
  | "PLAYING"
  | "COMPLETE"
  | "CANCELLED"
  | "STALE"
  | "TIMEOUT"
  | "FAILED";

export enum VoicePriority {
  CURRENT_STEP = 100,
  USER_REQUEST = 90,
  CURRENT_EXPLANATION = 80,
  NEXT_STEP = 60,
  REPLAY = 50,
  PREFETCH = 30,
  BACKGROUND = 10,
}

export interface VoiceExplanationContext {
  lessonId: string;
  transformationId: string;
  stepIndex: number;
  totalSteps: number;
  title: string;
  explanation: string;
  generationId?: string;
  worldVersion?: number;
  branchId?: string;
  priority?: number;
  answerText?: string;
  calculations?: string;
  insight?: string;
  topic?: string;
  concept?: string;
  semanticFocus?: string;
  primaryTargetLabel?: string;
}

export interface SpeechSegment {
  lessonId: string;
  generationId: string;
  transformationId: string;
  worldVersion: number;
  branchId: string;
  narration: string;
  semanticFocus?: string;
  priority: number;
  estimatedDuration?: number;
  status: VoiceQueueStatus;
}

export interface VoiceQueueItem {
  requestId: string;
  lessonId: string;
  generationId: string;
  transformationId: string;
  stepIndex?: number;
  worldVersion: number;
  branchId: string;
  narration: string;
  narrationHash: string;
  voiceConfigHash: string;
  priority: number;
  status: VoiceQueueStatus;
  retryCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  abortReason?: string;
  audio?: TTSAudio;
  error?: Error;
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
  generationId?: string;
  transformationId?: string;
  worldVersion?: number;
  branchId?: string;
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

export interface VoiceDiagnostics {
  serviceStatus: "READY" | "BUSY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
  circuitBreakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
  queueLength: number;
  totalRequests?: number;
  activeItem: { transformationId: string; priority: number } | null;
  currentStep: number;
  nextStep: number;
  isSynthesizing: boolean;
  cacheHits: number;
  cacheMisses: number;
  lastLatencyMs: number;
  totalSuccesses: number;
  totalFailures: number;
  totalTimeouts: number;
  totalStaleDropped: number;
}
