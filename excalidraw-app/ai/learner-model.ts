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

export interface LearnerNeed {
  /** What must the learner know before understanding the answer? */
  prerequisites: string[];
  /** What is likely to be confusing or misunderstood? */
  likelyMisconceptions: string[];
  /** Minimum baseline prerequisite knowledge needed */
  minimumPrerequisiteKnowledge: string;
  /** Requested level of detail */
  requestedDetailLevel: "overview" | "standard" | "deep_dive" | "rigorous";
  /** What should be explicitly demonstrated? */
  explicitlyDemonstrate: string[];
  /** What should be omitted because it adds cognitive noise? */
  omitAsNoise: string[];
}

/**
 * Universal dynamic learner needs inference without sensitive profiling.
 */
export function inferLearnerNeed(
  understanding: {
    concept: string;
    desiredExplanationDepth: "overview" | "standard" | "deep_dive" | "rigorous";
    assumedKnowledge?: string[];
    explicitRequirements?: string[];
    intents?: string[];
    scope?: string;
  },
  session?: LearnerSession,
): LearnerNeed {
  const depth = understanding.desiredExplanationDepth || "standard";
  const prerequisites = [...(understanding.assumedKnowledge || [])];
  if (prerequisites.length === 0) {
    prerequisites.push(`Fundamental concepts of ${understanding.concept}`);
  }

  const likelyMisconceptions: string[] = [
    "Assuming intermediate/in-flight states represent final committed truth",
    "Assuming initiating an operation or sending a message guarantees completion",
    "Assuming local element changes preserve global system invariants automatically",
  ];

  if (understanding.intents?.includes("COUNTERFACTUAL")) {
    likelyMisconceptions.push(
      "Assuming failures immediately terminate systems without recovery or rollback mechanisms",
    );
  }

  let minimumPrerequisiteKnowledge = `Basic structural awareness of ${understanding.concept}`;
  if (depth === "deep_dive" || depth === "rigorous") {
    minimumPrerequisiteKnowledge = `Detailed knowledge of state invariants, causal triggers, and protocol rules in ${understanding.concept}`;
  } else if (depth === "overview") {
    minimumPrerequisiteKnowledge = `High-level operational intuition of ${understanding.concept}`;
  }

  const explicitlyDemonstrate: string[] = [
    `Initial baseline configuration of ${understanding.concept}`,
    `Core causal mechanism triggering state transition`,
    `Final state satisfying system invariants and learning goals`,
  ];

  if (
    understanding.explicitRequirements &&
    understanding.explicitRequirements.length > 0
  ) {
    explicitlyDemonstrate.push(...understanding.explicitRequirements);
  }

  if (understanding.intents?.includes("COUNTERFACTUAL")) {
    explicitlyDemonstrate.push(
      "Alternative branch, failure trigger, and recovery path",
    );
  }

  const omitAsNoise: string[] = [
    "Sub-pixel layout jitter and arbitrary coordinate movements",
    "Decorative styling animations without conceptual meaning",
    "Duplicate intermediate snapshots where no semantic state or relationship changed",
    "Internal implementation boilerplate unrelated to pedagogical understanding",
  ];

  // If learner session indicates confusion or struggle, prioritize causal clarification
  if (session?.lastConfusionAssessment?.isStruggling) {
    explicitlyDemonstrate.push(
      "Explicit step-by-step causal link between previous trigger and next state",
    );
    likelyMisconceptions.push(
      "Confusion arising from rapid multi-element simultaneous mutations",
    );
  }

  return {
    prerequisites,
    likelyMisconceptions,
    minimumPrerequisiteKnowledge,
    requestedDetailLevel: depth,
    explicitlyDemonstrate,
    omitAsNoise,
  };
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
  const confusion = assessConfusion(
    consecutivePrev,
    consecutiveReplay,
    updatedDwellTimes[nextStepIndex] || 0,
  );

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
    signals.push(
      "Repeated backward navigation indicates potential step confusion",
    );
  }
  if (consecutiveReplayCount >= 2) {
    signals.push(
      "Repeated replay of current transformation indicates desire for visual clarification",
    );
  }
  if (dwellTimeMs > 45000) {
    signals.push("Extended dwell time on current state");
  }

  if (consecutivePreviousCount >= 2 || consecutiveReplayCount >= 2) {
    return {
      isStruggling: true,
      confidence: "LIKELY_STRUGGLING",
      signals,
      recommendedAdaptation:
        consecutivePreviousCount >= 2 ? "simplify" : "clarify_cause",
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
