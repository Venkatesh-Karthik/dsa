/**
 * Cognora Generic Learner Model & Non-Invasive Interaction Signals
 *
 * Models learner state strictly from in-session learning signals (dwell time,
 * step navigation, repeated replays, element selections, tab switches, practice responses).
 *
 * Strict Privacy Guarantee:
 * - NO personal identity or sensitive profiling.
 * - NO invasive tracking.
 * - Operates purely on cognitive state estimation using probabilistic confidence levels:
 *   LIKELY_UNDERSTOOD | POSSIBLY_UNDERSTOOD | UNCERTAIN | LIKELY_STRUGGLING.
 */

export type CognitiveConfidence =
  | "LIKELY_UNDERSTOOD"
  | "POSSIBLY_UNDERSTOOD"
  | "UNCERTAIN"
  | "LIKELY_STRUGGLING";

export type InteractionActionType =
  | "next"
  | "prev"
  | "replay"
  | "seek"
  | "select_entity"
  | "open_tab"
  | "why_request"
  | "what_changed_request"
  | "practice_submit";

export interface LearnerInteractionEvent {
  timestamp: number;
  action: InteractionActionType;
  stepIndex?: number;
  entityId?: string;
  tab?: string;
  details?: Record<string, unknown>;
}

export interface ConceptMasteryRecord {
  concept: string;
  confidence: CognitiveConfidence;
  lastUpdated: number;
  demonstratedCorrectly?: boolean;
}

export interface ConfusionAssessment {
  isStruggling: boolean;
  confidence: CognitiveConfidence;
  signals: string[];
  recommendedAdaptation?:
    | "simplify"
    | "deepen"
    | "clarify_cause"
    | "show_counterexample"
    | "highlight_prerequisite";
}

export interface LearnerSession {
  sessionId: string;
  currentConcept?: string;
  currentStepIndex: number;
  dwellStartTimestamp: number;
  dwellTimesByStep: Record<number, number>; // stepIndex -> total ms spent
  history: LearnerInteractionEvent[];
  conceptMastery: Record<string, ConceptMasteryRecord>;
  consecutivePreviousCount: number;
  consecutiveReplayCount: number;
  lastConfusionAssessment?: ConfusionAssessment;
}

/**
 * Initializes a new clean session for the current concept.
 */
export function createLearnerSession(initialConcept?: string): LearnerSession {
  return {
    sessionId: `learner-session-${Date.now().toString(36)}`,
    currentConcept: initialConcept,
    currentStepIndex: 0,
    dwellStartTimestamp: Date.now(),
    dwellTimesByStep: {},
    history: [],
    conceptMastery: {},
    consecutivePreviousCount: 0,
    consecutiveReplayCount: 0,
  };
}

/**
 * Records an interaction event and non-invasively updates learner signals.
 */
export function recordInteraction(
  session: LearnerSession,
  event: Omit<LearnerInteractionEvent, "timestamp">,
): LearnerSession {
  const now = Date.now();
  const fullEvent: LearnerInteractionEvent = {
    ...event,
    timestamp: now,
  };

  // Update dwell time for current step
  const elapsed = Math.max(0, now - session.dwellStartTimestamp);
  const prevDwell = session.dwellTimesByStep[session.currentStepIndex] || 0;
  const updatedDwellTimes = {
    ...session.dwellTimesByStep,
    [session.currentStepIndex]: prevDwell + elapsed,
  };

  let consecutivePrev = session.consecutivePreviousCount;
  let consecutiveReplay = session.consecutiveReplayCount;
  let nextStepIndex = session.currentStepIndex;

  if (event.action === "prev") {
    consecutivePrev += 1;
    if (typeof event.stepIndex === "number") {
      nextStepIndex = event.stepIndex;
    }
  } else if (event.action === "replay") {
    consecutiveReplay += 1;
  } else {
    consecutivePrev = 0;
    consecutiveReplay = 0;
    if (typeof event.stepIndex === "number") {
      nextStepIndex = event.stepIndex;
    }
  }

  const updatedHistory = [...session.history, fullEvent];

  // Perform lightweight confusion assessment
  const confusion = assessConfusion(consecutivePrev, consecutiveReplay, updatedDwellTimes[nextStepIndex] || 0);

  return {
    ...session,
    currentStepIndex: nextStepIndex,
    dwellStartTimestamp: now,
    dwellTimesByStep: updatedDwellTimes,
    history: updatedHistory,
    consecutivePreviousCount: consecutivePrev,
    consecutiveReplayCount: consecutiveReplay,
    lastConfusionAssessment: confusion,
  };
}

/**
 * Assesses cognitive signals without invading privacy.
 */
export function assessConfusion(
  consecutivePreviousCount: number,
  consecutiveReplayCount: number,
  dwellTimeMs: number,
): ConfusionAssessment {
  const signals: string[] = [];

  if (consecutivePreviousCount >= 2) {
    signals.push("Repeated backward navigation indicates potential step confusion");
  }
  if (consecutiveReplayCount >= 2) {
    signals.push("Repeated replay of current transformation indicates desire for visual clarification");
  }
  if (dwellTimeMs > 45000) {
    signals.push("Extended dwell time on current state");
  }

  if (consecutivePreviousCount >= 2 || consecutiveReplayCount >= 2) {
    return {
      isStruggling: true,
      confidence: "LIKELY_STRUGGLING",
      signals,
      recommendedAdaptation: consecutivePreviousCount >= 2 ? "simplify" : "clarify_cause",
    };
  }

  if (signals.length > 0) {
    return {
      isStruggling: false,
      confidence: "UNCERTAIN",
      signals,
      recommendedAdaptation: "clarify_cause",
    };
  }

  return {
    isStruggling: false,
    confidence: "LIKELY_UNDERSTOOD",
    signals: [],
  };
}
