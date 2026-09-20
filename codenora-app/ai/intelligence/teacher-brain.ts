/**
 * Cognora Teacher Brain — Adaptive Pedagogical Conductor
 *
 * Sits above raw LLM output and is responsible for:
 * 1. Classifying incoming InputIntent into a TeachingStrategy
 * 2. Reading LearnerState signals to adapt strategy selection dynamically
 * 3. Resolving follow-up questions ("Why?") from the current TeachingMoment
 *    WITHOUT regenerating the lesson (purely local, <5 ms)
 * 4. Computing adaptive granularity — recommending step splits when confusion detected
 * 5. Detecting misconceptions and formulating respectful corrections
 * 6. Emitting structured observability logs for every decision
 *
 * Decision priority order:
 *   INTERRUPT → BRANCH_EXIT → PLAYBACK_CONTROL → PACE_CONTROL →
 *   FOCUS_INQUIRY → MISCONCEPTION_DETECTION → WHAT_IF →
 *   LEARNER_ADAPTIVE (SIMPLIFY / ELABORATE based on LearnerState) →
 *   FOLLOW_UP_WHY → FOLLOW_UP_HOW →
 *   LLM_DELEGATION (EXPLAIN, complex questions)
 */

import type {
  CognoraWorldState,
  WhatIfBranch,
  TeachingDetour,
} from "./cognora-world-model";
import type { InputIntent } from "./input-intent";
import { ContextEngine, type ResolvedContext } from "./context-engine";
import { BranchManager } from "./branch-manager";
import type { StudentState } from "./student-state";
import type { SemanticFocusTarget } from "../teaching-moment";

// ============================================================================
// Teaching Strategy Contract
// ============================================================================

export type TeachingStrategy =
  | "EXPLAIN"
  | "WHY"
  | "HOW"
  | "SIMPLIFY"
  | "ELABORATE"
  | "COMPARE"
  | "TRACE"
  | "DEMONSTRATE"
  | "WHAT_IF"
  | "CORRECT"
  | "REPEAT"
  | "REPLAY"
  | "SLOW_DOWN"
  | "SPEED_UP"
  | "FOCUS"
  | "INSPECT"
  | "SUMMARIZE"
  | "PREDICT"
  | "VERIFY"
  | "DEEPEN";

/**
 * How confident the TeacherBrain is about its own decision.
 * Used for observability and circuit-breaking on low-confidence paths.
 */
export interface TeacherConfidence {
  score: number; // 0.0 – 1.0
  basis: string; // Human-readable justification
}

/**
 * Encapsulates a single resolved pedagogical action.
 */
export interface TeacherDecision {
  strategy: TeachingStrategy;

  /** True = satisfied entirely locally, no Nemotron round-trip needed */
  isLocal: boolean;

  /** Plain-text explanation surfaced to the inspector / chat panel */
  explanation: string;

  /** Sentence(s) the TTS voice will speak */
  narration: string;

  /** Rationale for pedagogical decision */
  reason?: string;

  /** Target entity or concept */
  target?: string;

  /** Optional entity spotlight to trigger on the canvas */
  focusEntityId?: string;
  focusEntityLabel?: string;

  /** First-class semantic focus target */
  semanticFocus?: SemanticFocusTarget;

  /** Entities and relationships primarily affected by this decision */
  affectedEntities?: string[];
  affectedRelationships?: string[];

  /** Counterfactual branch to create, if strategy === "WHAT_IF" */
  branchToCreate?: WhatIfBranch | null;

  /** True = teacher decided the learner should exit the active What-If branch */
  shouldExitBranch?: boolean;

  /** Temporary teaching detour (e.g. WHY comparison) that returns to parent step */
  detourToCreate?: TeachingDetour | null;

  /** Pacing directive to forward to the playback controller */
  paceChange?: "slower" | "faster" | "normal";
  pacing?: "slower" | "faster" | "normal";

  /** Playback action to dispatch */
  playbackAction?: "next" | "previous" | "pause" | "resume" | "replay";

  /** Pedagogical explanation mode */
  explanationMode?: "concept" | "step" | "detour" | "comparison";

  /** Next pedagogical action */
  nextAction?:
    | "SHOW_NEXT"
    | "SPLIT"
    | "PAUSE_AND_EXPLAIN"
    | "COMPARE"
    | "PREDICT"
    | "SUMMARIZE"
    | "CONTINUE";

  /**
   * Adaptive granularity recommendation.
   * If > 1, the playback orchestrator should split the current step into
   * `granularityRecommendation` sub-steps before advancing.
   */
  granularityRecommendation?: number;
  desiredGranularity?: number;

  confidence: TeacherConfidence;

  /** True = caller must follow up with Nemotron 3 Ultra */
  requiresLLM: boolean;

  /** Compact structured prompt to send to Nemotron, if requiresLLM === true */
  llmPrompt?: string;
}

// ============================================================================
// Learner State Update — fired as a side-effect of each decision
// ============================================================================

export interface LearnerStateUpdate {
  confusionDelta: number; // +ve increases confusionSignals, -ve decreases
  confidenceDelta: number; // Signed adjustment to learner.confidence
  paceChange?: "slower" | "faster" | "normal";
  shouldSwitchDepth?: "simple" | "normal" | "detailed" | "technical";
  reason: string;
}

/**
 * Computes the LearnerStateUpdate that should be applied after `decision`.
 * Kept pure so tests can verify it without touching real state.
 */
export function computeLearnerUpdate(
  decision: TeacherDecision,
  student: Readonly<StudentState>,
): LearnerStateUpdate {
  const update: LearnerStateUpdate = {
    confusionDelta: 0,
    confidenceDelta: 0,
    reason: `strategy=${decision.strategy}`,
  };

  switch (decision.strategy) {
    case "SIMPLIFY":
      update.confusionDelta = +1;
      update.confidenceDelta = -0.05;
      update.shouldSwitchDepth = "simple";
      update.reason = "Learner requested simplification — increasing confusion signal";
      break;

    case "CORRECT":
      update.confusionDelta = +1;
      update.confidenceDelta = -0.1;
      update.reason = "Misconception detected and corrected";
      break;

    case "REPLAY":
    case "REPEAT":
      update.confusionDelta = +1;
      update.confidenceDelta = -0.05;
      update.reason = "Replay / Repeat requested — possible confusion";
      break;

    case "SLOW_DOWN":
      update.paceChange = "slower";
      update.confidenceDelta = -0.03;
      update.reason = "Pacing reduced at learner request";
      break;

    case "SPEED_UP":
      update.paceChange = "faster";
      update.confidenceDelta = +0.05;
      update.reason = "Pacing increased — confident learner signal";
      break;

    case "ELABORATE":
      update.shouldSwitchDepth = "detailed";
      update.confidenceDelta = +0.03;
      update.reason = "Learner requested elaboration — curiosity signal";
      break;

    case "PREDICT":
      update.confidenceDelta = +0.05;
      update.reason = "Learner engaged in active prediction";
      break;

    case "DEMONSTRATE":
      update.confusionDelta = +1;
      update.confidenceDelta = -0.05;
      update.reason = "Demonstrating concrete execution for clarity";
      break;

    case "COMPARE":
      update.confusionDelta = 0;
      update.confidenceDelta = +0.02;
      update.reason = "Comparing before/after state to solidify invariant";
      break;

    case "DEEPEN":
      update.shouldSwitchDepth = "detailed";
      update.confidenceDelta = +0.03;
      update.reason = "Deepening conceptual understanding";
      break;

    case "WHY":
    case "HOW":
      // "Why/How" can be either confusion or intellectual curiosity.
      // If the learner already has high confusion signals, treat as confusion.
      if (student.confusionSignals >= 2) {
        update.confusionDelta = +1;
        update.confidenceDelta = -0.05;
        update.reason = "Why/How question with existing confusion signals";
      } else {
        update.reason = "Why/How question — neutral engagement signal";
      }
      break;

    default:
      // EXPLAIN, FOCUS, TRACE, WHAT_IF, SUMMARIZE, VERIFY → neutral / positive
      update.reason = `Strategy ${decision.strategy} applied — no state degradation`;
  }

  return update;
}

// ============================================================================
// TeacherBrain — static decision engine
// ============================================================================

export class TeacherBrain {
  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Main entry point.
   * Resolves a `TeacherDecision` from the current intent and world state.
   * All local decisions are returned synchronously in < 5 ms.
   */
  public static decide(
    intent: InputIntent,
    worldState: Readonly<CognoraWorldState>,
  ): TeacherDecision {
    const context = ContextEngine.resolveContext(intent, worldState);
    const student = worldState.studentState;
    const currentMoment = worldState.currentMoment;

    const decision = this._route(intent, context, student, worldState);

    // Structured observability log per Section 35: [COGNORA][TEACHER][DECISION]
    const worldVersion = worldState.worldVersion;
    const transformationId = currentMoment?.transformationId || "none";
    const semanticFocusLabel =
      decision.semanticFocus?.label ||
      currentMoment?.semanticFocus?.label ||
      context.targetEntityLabel ||
      "none";
    const granularity =
      decision.desiredGranularity ?? decision.granularityRecommendation ?? 1;
    const decisionReason = decision.reason || decision.confidence.basis;

    console.log(
      `[COGNORA][TEACHER][DECISION] strategy=${decision.strategy} worldVersion=${worldVersion} transformationId=${transformationId} semanticFocus=${semanticFocusLabel} granularity=${granularity} reason="${decisionReason}" isLocal=${decision.isLocal} requiresLLM=${decision.requiresLLM} confidence=${decision.confidence.score.toFixed(2)} basis="${decision.confidence.basis}" intent=${intent.intentType} concept="${context.concept}" step=${context.stepIndex + 1}/${context.totalSteps}`,
    );

    // Compute learner state update (caller applies it to StudentStateManager)
    const update = computeLearnerUpdate(decision, student);
    if (update.confusionDelta !== 0 || update.confidenceDelta !== 0 || update.paceChange) {
      console.log(
        `[COGNORA][LEARNER][UPDATE] confusionDelta=${update.confusionDelta > 0 ? "+" : ""}${update.confusionDelta} confidenceDelta=${update.confidenceDelta > 0 ? "+" : ""}${update.confidenceDelta.toFixed(2)} reason="${update.reason}"`,
      );
    }

    return decision;
  }

  /**
   * Resolves a follow-up "Why?" or "How?" entirely from the current
   * TeachingMoment, without calling the LLM. Returns null if no moment is
   * available (caller should fall back to LLM delegation).
   */
  public static resolveFollowUp(
    query: "WHY" | "HOW" | "WHAT",
    worldState: Readonly<CognoraWorldState>,
  ): { explanation: string; narration: string } | null {
    const moment = worldState.currentMoment;
    if (!moment) {
      return null;
    }

    if (query === "WHY") {
      return this._buildWhyAnswer(moment);
    }

    if (query === "HOW") {
      return this._buildHowAnswer(moment);
    }

    // "WHAT" — describe the current state
    return {
      explanation: moment.explanation || "The canvas is showing the current algorithmic state.",
      narration: moment.narration || moment.explanation || "Here is the current state.",
    };
  }

  /**
   * Computes an adaptive granularity recommendation for the current step.
   *
   * Returns 1 (no split needed) for fluent learners, up to 4 for heavily
   * confused learners who have shown confusion signals and are on a complex step.
   *
   * This number is a HINT to the playback orchestrator; it does not actually
   * split TeachingMoments — that is the orchestrator's responsibility.
   */
  public static computeAdaptiveGranularity(
    student: Readonly<StudentState>,
    currentMoment: CognoraWorldState["currentMoment"],
  ): number {
    if (!currentMoment) {
      return 1;
    }

    const confusion = student.confusionSignals;
    const confidence = student.confidence;

    // Learner is doing well — no extra splits
    if (confusion === 0 && confidence >= 0.75) {
      return 1;
    }

    // Mild confusion
    if (confusion >= 1 && confusion < 3 && confidence < 0.65) {
      const isComplexStep = /rotat|balance|heapif|bubble|pivot|partition/i.test(
        `${currentMoment.title} ${currentMoment.explanation}`,
      );
      return isComplexStep ? 2 : 1;
    }

    // Heavy confusion — max granularity (must be checked BEFORE moderate tier)
    if (confusion >= 4 || confidence <= 0.2) {
      return 4;
    }

    // Moderate confusion
    if (confusion >= 3 && confidence < 0.5) {
      const isComplexStep = /rotat|balance|heapif|bubble|pivot|partition/i.test(
        `${currentMoment.title} ${currentMoment.explanation}`,
      );
      return isComplexStep ? 3 : 2;
    }

    return 1;
  }

  // ── Private Routing ────────────────────────────────────────────────────────

  private static _route(
    intent: InputIntent,
    context: ResolvedContext,
    student: Readonly<StudentState>,
    worldState: Readonly<CognoraWorldState>,
  ): TeacherDecision {
    const currentMoment = worldState.currentMoment;

    // ── Priority 1: Interruption ───────────────────────────────────────────
    if (intent.intentType === "INTERRUPT") {
      return {
        strategy: "REPEAT",
        isLocal: true,
        requiresLLM: false,
        explanation: "Paused. Listening to you...",
        narration: "",
        playbackAction: "pause",
        confidence: { score: 1.0, basis: "Deterministic interrupt signal" },
      };
    }

    // ── Priority 2: Branch Exit ────────────────────────────────────────────
    if (intent.intentType === "BRANCH_EXIT") {
      return {
        strategy: "REPLAY",
        isLocal: true,
        requiresLLM: false,
        explanation: "Returning to main lesson timeline.",
        narration: "Returning to where we were in the lesson.",
        shouldExitBranch: true,
        confidence: { score: 1.0, basis: "Deterministic branch exit" },
      };
    }

    // ── Priority 3: Playback Navigation ───────────────────────────────────
    if (intent.intentType === "PLAYBACK_CONTROL") {
      const action = intent.parameters.action as
        | "next"
        | "previous"
        | "replay"
        | "pause"
        | "resume";
      return {
        strategy: action === "replay" ? "REPLAY" : "TRACE",
        isLocal: true,
        requiresLLM: false,
        explanation: `Playback: ${action}`,
        narration: "",
        playbackAction: action,
        confidence: { score: 1.0, basis: "Deterministic playback signal" },
      };
    }

    // ── Priority 4: Pacing Controls ────────────────────────────────────────
    if (intent.intentType === "PACE_CONTROL") {
      const pace = intent.parameters.pace as "slower" | "faster";
      return {
        strategy: pace === "slower" ? "SLOW_DOWN" : "SPEED_UP",
        isLocal: true,
        requiresLLM: false,
        explanation: pace === "slower" ? "Slowing down pacing." : "Speeding up pacing.",
        narration:
          pace === "slower"
            ? "I'll explain more slowly from here."
            : "Picking up the pace.",
        paceChange: pace,
        confidence: { score: 1.0, basis: "Deterministic pace signal" },
      };
    }

    // ── Priority 5: Focus Inquiry ──────────────────────────────────────────
    if (intent.intentType === "QUESTION_FOCUS") {
      const target = intent.target || context.targetEntityId;
      const label = context.targetEntityLabel || target;
      return {
        strategy: "FOCUS",
        isLocal: true,
        requiresLLM: false,
        explanation: `Focusing on ${label || "target entity"}.`,
        narration: `Here is ${label || "the element"} on the canvas. Notice its connections and state.`,
        focusEntityId: target,
        focusEntityLabel: label,
        confidence: { score: 0.95, basis: "Entity focus resolved from context" },
      };
    }

    // ── Priority 6: Misconception Detection ───────────────────────────────
    const misconception = this._detectMisconception(intent.rawInput, context, currentMoment);
    if (misconception) {
      return {
        strategy: "CORRECT",
        isLocal: true,
        requiresLLM: false,
        explanation: misconception.explanation,
        narration: misconception.narration,
        focusEntityId: misconception.focusEntityId,
        focusEntityLabel: misconception.focusEntityLabel,
        confidence: { score: 0.95, basis: "Pattern-matched misconception" },
      };
    }

    // ── Priority 7: What-If Branching ─────────────────────────────────────
    if (intent.intentType === "QUESTION_WHAT_IF") {
      const branch = BranchManager.createBranch(
        intent.parameters.fullHypothesis || intent.rawInput,
        worldState,
      );
      if (branch && branch.branchMoments.length > 0) {
        const moment = branch.branchMoments[0];
        return {
          strategy: "WHAT_IF",
          isLocal: true,
          requiresLLM: false,
          explanation: moment.explanation,
          narration: moment.narration,
          branchToCreate: branch,
          focusEntityId: moment.semanticFocus?.entityIds?.[0],
          focusEntityLabel: moment.semanticFocus?.label,
          confidence: { score: 0.92, basis: "Counterfactual branch created locally" },
        };
      }
    }

    // ── Priority 8: Learner-Adaptive Pedagogical Shift (LearnerState-driven) ─
    if (
      intent.intentType === "QUESTION_SIMPLIFY" ||
      this._isConfusionSignalStrong(student) ||
      this._isConfusionExpression(intent.rawInput)
    ) {
      const adaptedStrategy = this._resolveAdaptivePedagogyStrategy(
        intent.rawInput,
        student,
      );

      const granularity = this.computeAdaptiveGranularity(student, currentMoment);

      if (adaptedStrategy === "COMPARE") {
        const comparison = this._buildComparisonAnswer(currentMoment);
        const detour: TeachingDetour | null = currentMoment
          ? {
              detourId: `detour-${Date.now()}`,
              parentMomentIndex: currentMoment.stepIndex,
              parentMomentId: currentMoment.id,
              reason: "Before/After comparison of state transition",
              detourMoment: {
                ...currentMoment,
                id: `detour-${currentMoment.id}`,
                title: `Comparison: ${currentMoment.title}`,
                explanation: comparison.explanation,
                narration: comparison.narration,
              },
              createdAt: Date.now(),
            }
          : null;

        return {
          strategy: "COMPARE",
          isLocal: true,
          requiresLLM: false,
          explanation: comparison.explanation,
          narration: comparison.narration,
          reason: "Learner requested old vs new comparison or previous explanation was insufficient",
          semanticFocus: currentMoment?.semanticFocus,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
          granularityRecommendation: granularity,
          desiredGranularity: granularity,
          explanationMode: "comparison",
          nextAction: "COMPARE",
          detourToCreate: detour,
          confidence: {
            score: 0.95,
            basis: "Pedagogical shift to COMPARE based on learner signal and strategy history",
          },
        };
      }

      if (adaptedStrategy === "DEMONSTRATE") {
        const demonstration = this._buildDemonstrationAnswer(currentMoment);
        return {
          strategy: "DEMONSTRATE",
          isLocal: true,
          requiresLLM: false,
          explanation: demonstration.explanation,
          narration: demonstration.narration,
          reason: "Learner remained confused after simplification — stepping through concrete demonstration",
          semanticFocus: currentMoment?.semanticFocus,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
          granularityRecommendation: granularity,
          desiredGranularity: granularity,
          explanationMode: "step",
          nextAction: "SHOW_NEXT",
          confidence: {
            score: 0.93,
            basis: "Pedagogical shift to DEMONSTRATE following prior simplification",
          },
        };
      }

      // Default: SIMPLIFY
      const simplified = this._buildSimplifiedExplanation(context, currentMoment, student);
      return {
        strategy: "SIMPLIFY",
        isLocal: true,
        requiresLLM: false,
        explanation: simplified.explanation,
        narration: simplified.narration,
        reason: "Learner requested simplification or confusion signals detected",
        semanticFocus: currentMoment?.semanticFocus,
        focusEntityId: context.targetEntityId,
        focusEntityLabel: context.targetEntityLabel,
        granularityRecommendation: granularity,
        desiredGranularity: granularity,
        explanationMode: "concept",
        nextAction: "PAUSE_AND_EXPLAIN",
        confidence: {
          score: 0.92,
          basis:
            intent.intentType === "QUESTION_SIMPLIFY"
              ? "Explicit simplification request"
              : `Confusion signals: ${student.confusionSignals}, confidence: ${student.confidence.toFixed(2)}`,
        },
      };
    }

    // ── Priority 9: Elaborate (depth increase) ────────────────────────────
    if (intent.intentType === "QUESTION_ELABORATE") {
      return {
        strategy: "ELABORATE",
        isLocal: false,
        requiresLLM: true,
        explanation: "Providing a deeper explanation...",
        narration: "",
        llmPrompt: `${ContextEngine.formatCompactPromptContext(context)}\n\nLearner Request: ${intent.rawInput}\n\nProvide a technically deeper explanation (3-4 sentences) of this step. Include the underlying invariant, why it holds, and what would break if it didn't.`,
        confidence: {
          score: 0.9,
          basis: "Explicit elaboration request — Nemotron enrichment required",
        },
      };
    }

    // ── Priority 10: Causal WHY — fully local resolution with Detour support ──
    if (intent.intentType === "QUESTION_WHY") {
      const followUp = this.resolveFollowUp("WHY", worldState);
      if (followUp) {
        // Create a temporary teaching detour if the query is asking about alternative choices or why a specific node was picked
        const isChoiceDetour =
          /choose|chose|pick|picked|select|selected|alternative|other|instead/i.test(
            intent.rawInput,
          );
        let detourToCreate: TeachingDetour | null = null;
        if (isChoiceDetour && currentMoment) {
          detourToCreate = {
            detourId: `detour-${Date.now()}`,
            parentMomentIndex: currentMoment.stepIndex,
            parentMomentId: currentMoment.id,
            reason: `Explaining candidate choice for ${currentMoment.title}`,
            detourMoment: {
              ...currentMoment,
              id: `detour-${currentMoment.id}`,
              title: `Why chosen: ${currentMoment.title}`,
              explanation: followUp.explanation,
              narration: followUp.narration,
            },
            createdAt: Date.now(),
          };
        }

        return {
          strategy: "WHY",
          isLocal: true,
          requiresLLM: false,
          explanation: followUp.explanation,
          narration: followUp.narration,
          reason: "WHY resolved from TeachingMoment causal chain without lesson regeneration",
          semanticFocus: currentMoment?.semanticFocus,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
          detourToCreate,
          explanationMode: detourToCreate ? "detour" : "step",
          nextAction: "PAUSE_AND_EXPLAIN",
          desiredGranularity: this.computeAdaptiveGranularity(student, currentMoment),
          confidence: { score: 0.95, basis: "WHY resolved from TeachingMoment.why + consequence" },
        };
      }
      // No current moment — fall through to LLM
    }

    // ── Priority 11: Procedural HOW — local then LLM ──────────────────────
    if (intent.intentType === "QUESTION_HOW") {
      const followUp = this.resolveFollowUp("HOW", worldState);
      if (followUp) {
        return {
          strategy: "HOW",
          isLocal: true,
          requiresLLM: false,
          explanation: followUp.explanation,
          narration: followUp.narration,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
          confidence: { score: 0.9, basis: "HOW resolved from TeachingMoment trace" },
        };
      }
    }

    // ── Fallback: Delegate to Nemotron 3 Ultra ─────────────────────────────
    const compactContext = ContextEngine.formatCompactPromptContext(context);

    // Tailor the prompt style based on learner's preferred depth
    let promptSuffix =
      "Provide a concise, direct pedagogical explanation (2-3 sentences) answering this question about the current step.";
    if (student.preferredExplanationDepth === "simple") {
      promptSuffix =
        "Provide an extremely simple, jargon-free answer (1-2 sentences) suitable for a beginner.";
    } else if (student.preferredExplanationDepth === "technical") {
      promptSuffix =
        "Provide a rigorous, technically precise answer (3-4 sentences) including edge cases.";
    }

    const llmPrompt = `${compactContext}\n\nLearner Question: ${intent.rawInput}\n\n${promptSuffix}`;

    return {
      strategy: "EXPLAIN",
      isLocal: false,
      requiresLLM: true,
      explanation: "Analyzing question in context...",
      narration: "",
      llmPrompt,
      confidence: {
        score: 0.8,
        basis: "No local resolution found — delegating to Nemotron 3 Ultra",
      },
    };
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * True when the LearnerState has accumulated enough confusion signals
   * that the TeacherBrain should proactively suggest simplification,
   * even without an explicit "simplify" intent from the learner.
   */
  private static _isConfusionSignalStrong(student: Readonly<StudentState>): boolean {
    return student.confusionSignals >= 3 && student.confidence < 0.4;
  }

  /**
   * Pattern-matches the learner's raw assertion for factual inversions and
   * domain-specific misconceptions.
   */
  private static _detectMisconception(
    rawText: string,
    context: ResolvedContext,
    _currentMoment: CognoraWorldState["currentMoment"],
  ): {
    explanation: string;
    narration: string;
    focusEntityId?: string;
    focusEntityLabel?: string;
  } | null {
    const lower = rawText.toLowerCase();

    // Inverted numerical comparison: "X is greater than Y" when X < Y
    const gtMatch = lower.match(/(\d+)\s+is\s+greater\s+than\s+(\d+)/i);
    if (gtMatch) {
      const a = parseInt(gtMatch[1], 10);
      const b = parseInt(gtMatch[2], 10);
      if (a < b) {
        return {
          explanation: `Clarification: ${a} is actually less than ${b}, not greater.`,
          narration: `Notice that ${a} is actually less than ${b}. Because ${a} is smaller, the comparison directs us in the opposite way.`,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
        };
      }
    }

    const ltMatch = lower.match(/(\d+)\s+is\s+less\s+than\s+(\d+)/i);
    if (ltMatch) {
      const a = parseInt(ltMatch[1], 10);
      const b = parseInt(ltMatch[2], 10);
      if (a > b) {
        return {
          explanation: `Clarification: ${a} is actually greater than ${b}, not less.`,
          narration: `Notice that ${a} is actually greater than ${b}. Because ${a} is larger, we navigate to the other partition.`,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
        };
      }
    }

    // AVL balance factor misconception (e.g. "balance factor is -1 so we rotate right")
    const bfMatch = lower.match(
      /balance\s+factor\s+(?:is\s+)?([+-]?\d+)\s+so\s+(?:we\s+)?rotate\s+(left|right)/i,
    );
    if (bfMatch) {
      const bf = parseInt(bfMatch[1], 10);
      const rotDir = bfMatch[2].toLowerCase();
      const correctDir = bf > 1 ? "right" : bf < -1 ? "left" : null;
      if (correctDir && correctDir !== rotDir) {
        return {
          explanation: `Clarification: a balance factor of ${bf} triggers a ${correctDir} rotation, not ${rotDir}.`,
          narration: `Actually, when the balance factor is ${bf}, we perform a ${correctDir} rotation, not ${rotDir}. The sign tells us which subtree is heavier.`,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
        };
      }
    }

    return null;
  }

  /**
   * Builds a simplified local explanation calibrated to the learner's
   * current confusion level and the semantic content of the active step.
   */
  private static _buildSimplifiedExplanation(
    context: ResolvedContext,
    currentMoment: CognoraWorldState["currentMoment"],
    student: Readonly<StudentState>,
  ): { explanation: string; narration: string } {
    if (!currentMoment) {
      return {
        explanation: "Think of this step like narrowing down clues in a game.",
        narration:
          "Let's simplify this. Imagine a guessing game where every step cuts our search in half.",
      };
    }

    const concept = context.concept;
    const why = currentMoment.why || "";
    const explanation = currentMoment.explanation || "";
    const consequence = currentMoment.consequence || "";

    // Heavy confusion — stripped-down single-sentence focus
    if (student.confusionSignals >= 4 || student.confidence <= 0.2) {
      return {
        explanation: `Simplified to basics: ${explanation}`,
        narration: `Let's go one tiny step at a time. Right now we are doing one thing: ${
          explanation.split(".")[0] || explanation
        }. That's all you need to focus on.`,
      };
    }

    // Moderate confusion — keep the why but drop jargon
    return {
      explanation: `Simplified: ${explanation}. Reason: ${why || "to maintain the correct structure."}`,
      narration: `Let's break this down. In ${concept}, we take this action because ${
        why || "it keeps the structure valid and sorted"
      }. ${consequence ? `As a result, ${consequence}` : "This keeps everything in the right order."}`,
    };
  }

  /**
   * Builds the "Why did this happen?" answer from TeachingMoment fields.
   * Prioritises why → consequence → explanation — all pre-compiled,
   * so this is always local and instant.
   */
  private static _buildWhyAnswer(
    moment: NonNullable<CognoraWorldState["currentMoment"]>,
  ): { explanation: string; narration: string } {
    const why = moment.why;
    const consequence = moment.consequence;

    if (why && consequence) {
      return {
        explanation: `Why: ${why}. Consequence: ${consequence}`,
        narration: `${why}. Because of this, ${consequence}`,
      };
    }

    if (why) {
      return {
        explanation: `Why: ${why}`,
        narration: why,
      };
    }

    return {
      explanation: `Reason: ${moment.explanation}`,
      narration: moment.narration || moment.explanation,
    };
  }

  /**
   * Builds the "How does this work?" answer from TeachingMoment fields.
   * Steps through affected entities and the change summary.
   */
  private static _buildHowAnswer(
    moment: NonNullable<CognoraWorldState["currentMoment"]>,
  ): { explanation: string; narration: string } {
    const affected = moment.affectedEntities || [];
    const title = moment.title || "this step";
    const explanation = moment.explanation || "";

    if (affected.length > 0) {
      const entityList = affected.slice(0, 3).join(", ");
      return {
        explanation: `How: In "${title}", the following elements are involved: ${entityList}. ${explanation}`,
        narration: `In this step, we work on ${entityList}. ${explanation}`,
      };
    }

    return {
      explanation: `How: ${explanation}`,
      narration: explanation,
    };
  }

  private static _isConfusionExpression(input: string): boolean {
    if (!input) return false;
    const lower = input.toLowerCase();
    return (
      lower.includes("don't understand") ||
      lower.includes("do not understand") ||
      lower.includes("still don't understand") ||
      lower.includes("still do not understand") ||
      lower.includes("don't get it") ||
      lower.includes("do not get it") ||
      lower.includes("i'm confused") ||
      lower.includes("i am confused") ||
      lower.includes("makes no sense") ||
      lower.includes("lost")
    );
  }

  private static _resolveAdaptivePedagogyStrategy(
    input: string,
    student: Readonly<StudentState>,
  ): TeachingStrategy {
    const lower = (input || "").toLowerCase();

    // If learner explicitly requests comparison or old vs new state
    if (
      lower.includes("compare") ||
      lower.includes("old state") ||
      lower.includes("new state") ||
      lower.includes("together") ||
      lower.includes("difference")
    ) {
      return "COMPARE";
    }

    // If learner explicitly requests demonstration
    if (
      lower.includes("show me") ||
      lower.includes("demonstrate") ||
      lower.includes("walk through") ||
      lower.includes("step through")
    ) {
      return "DEMONSTRATE";
    }

    // Adaptively cycle strategy if learner remains confused
    const history = student.strategyHistory || [];
    const lastStrategy = history.length > 0 ? history[history.length - 1] : undefined;

    if (lastStrategy === "SIMPLIFY") {
      return "DEMONSTRATE";
    }
    if (lastStrategy === "DEMONSTRATE") {
      return "COMPARE";
    }
    if (lastStrategy === "COMPARE") {
      return "SIMPLIFY";
    }

    return "SIMPLIFY";
  }

  private static _buildComparisonAnswer(
    moment: CognoraWorldState["currentMoment"],
  ): { explanation: string; narration: string } {
    if (!moment) {
      return {
        explanation: "Comparing current state with the previous state to see what changed.",
        narration: "Let's compare the previous state with what we have now.",
      };
    }

    const title = moment.title || "this step";
    const why = moment.why || "to maintain optimality";
    const consequence = moment.consequence || "the state is updated";
    const explanation = moment.explanation || "";

    return {
      explanation: `Old vs New State Comparison in "${title}": Before this step, values were tentative. Now, ${explanation}. The invariant holds because ${why}. Consequence: ${consequence}.`,
      narration: `Comparing the old state and new state together: Notice what changed in ${title}. ${why}. As a consequence, ${consequence}.`,
    };
  }

  private static _buildDemonstrationAnswer(
    moment: CognoraWorldState["currentMoment"],
  ): { explanation: string; narration: string } {
    if (!moment) {
      return {
        explanation: "Stepping through a concrete demonstration of this transformation.",
        narration: "Let's step through this action concretely.",
      };
    }

    const entities = moment.affectedEntities?.length
      ? moment.affectedEntities.join(", ")
      : "the active entities";
    const title = moment.title || "this step";
    const explanation = moment.explanation || "";

    return {
      explanation: `Step-by-step Demonstration of "${title}": Focusing on ${entities}. Action: ${explanation}. We verify the transformation directly on these elements.`,
      narration: `Let's watch this happen step-by-step. Focus on ${entities}. In ${title}, ${explanation}.`,
    };
  }
}

