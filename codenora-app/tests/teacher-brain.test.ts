/**
 * Adaptive Teacher Brain — Comprehensive Test Suite
 *
 * Tests:
 *  1. Strategy selection from InputIntent types
 *  2. LearnerState-driven adaptive strategy (confusion → SIMPLIFY)
 *  3. Follow-up WHY resolution from TeachingMoment (local, no LLM)
 *  4. Follow-up HOW resolution from TeachingMoment (local, no LLM)
 *  5. Adaptive granularity computation
 *  6. Misconception detection (numerical inversion + AVL balance factor)
 *  7. computeLearnerUpdate purity verification
 *  8. LLM prompt tone calibration to preferredExplanationDepth
 *  9. TeacherBrainOrchestrator integration: orchestrate() pipeline
 * 10. Orchestrator side-effects (pacing, focus, playback)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TeacherBrain,
  computeLearnerUpdate,
  type TeacherDecision,
} from "../ai/intelligence/teacher-brain";
import { TeacherBrainOrchestrator } from "../ai/intelligence/teacher-brain-orchestrator";
import { CognoraWorldModel } from "../ai/intelligence/cognora-world-model";
import { IntentEngine } from "../ai/intelligence/intent-engine";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { createInputIntent } from "../ai/intelligence/input-intent";
import type { CognoraWorldState } from "../ai/intelligence/cognora-world-model";
import type { TeachingMoment } from "../ai/teaching-moment";
import type { SceneState } from "../ai/scene-state";

// ============================================================================
// Test Utilities
// ============================================================================

function buildMinimalWorldState(
  overrides: Partial<CognoraWorldState> = {},
): CognoraWorldState {
  return {
    generationId: "GEN-TEST",
    worldVersion: 1,
    branchId: "MAIN",
    entities: new Map(),
    relationships: new Map(),
    currentState: null,
    transformations: [],
    selectedEntityIds: [],
    learnerContext: {
      currentConcept: "Binary Search",
      confidence: 0.7,
      confusionSignals: 0,
      pace: "normal",
      playbackSpeed: 1.0,
      preferredExplanationDepth: "normal",
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 0,
      lastInteractionTime: Date.now(),
    },
    lesson: null,
    timeline: null,
    currentTransformation: null,
    currentMoment: null,
    previousMoment: null,
    nextMoment: null,
    visualState: null,
    canvasBoundIds: [],
    focusState: {},
    voiceState: "idle",
    orbState: "IDLE",
    conversationState: [],
    studentState: {
      currentConcept: "Binary Search",
      confidence: 0.7,
      confusionSignals: 0,
      pace: "normal",
      playbackSpeed: 1.0,
      preferredExplanationDepth: "normal",
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 0,
      lastInteractionTime: Date.now(),
    },
    playbackState: {
      status: "IDLE",
      currentIndex: 0,
      totalSteps: 5,
      speed: 1.0,
    },
    activeBranch: null,
    verificationState: { isValid: true, lastChecked: Date.now(), errors: [] },
    ...overrides,
  } as CognoraWorldState;
}

function buildTeachingMoment(partial: Partial<TeachingMoment> = {}): TeachingMoment {
  const emptyScene: SceneState = {
    graph: {
      entities: new Map(),
      relationships: new Map(),
      annotations: new Map(),
    },
  };
  return {
    id: "moment-test-1",
    transformationId: "trans-test-1",
    stepIndex: 1,
    totalSteps: 5,
    title: "Compare mid = 5 with target = 23",
    beforeState: emptyScene,
    afterState: emptyScene,
    semanticChanges: {
      addedEntities: [],
      removedEntities: [],
      updatedEntities: [],
      addedRelationships: [],
      removedRelationships: [],
    },
    visualState: emptyScene,
    affectedEntities: ["node-mid", "node-target"],
    affectedRelationships: [],
    semanticFocus: { type: "entity", entityIds: ["node-mid"], label: "mid=5" },
    explanation: "We compare the middle element 5 with our target 23.",
    why: "Binary search eliminates half the array at each step by comparing the midpoint.",
    consequence: "Since 23 > 5, we discard the left half and search only the right portion.",
    narration: "Comparing mid element 5 with target 23. 23 is greater, so we move right.",
    importance: "HIGH",
    ...partial,
  };
}

// ============================================================================
// 1. Strategy Selection from InputIntent Types
// ============================================================================

describe("TeacherBrain — Strategy Selection", () => {
  it("returns REPEAT + pause for INTERRUPT intent", () => {
    const intent = createInputIntent({
      source: "voice",
      rawInput: "wait",
      intentType: "INTERRUPT",
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("REPEAT");
    expect(decision.isLocal).toBe(true);
    expect(decision.requiresLLM).toBe(false);
    expect(decision.playbackAction).toBe("pause");
    expect(decision.confidence.score).toBe(1.0);
  });

  it("returns REPLAY + shouldExitBranch for BRANCH_EXIT intent", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "go back",
      intentType: "BRANCH_EXIT",
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("REPLAY");
    expect(decision.shouldExitBranch).toBe(true);
    expect(decision.isLocal).toBe(true);
    expect(decision.requiresLLM).toBe(false);
  });

  it("returns SLOW_DOWN + paceChange='slower' for PACE_CONTROL/slower", () => {
    const intent = createInputIntent({
      source: "voice",
      rawInput: "slow down",
      intentType: "PACE_CONTROL",
      parameters: { pace: "slower" },
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("SLOW_DOWN");
    expect(decision.paceChange).toBe("slower");
    expect(decision.isLocal).toBe(true);
  });

  it("returns SPEED_UP + paceChange='faster' for PACE_CONTROL/faster", () => {
    const intent = createInputIntent({
      source: "voice",
      rawInput: "faster",
      intentType: "PACE_CONTROL",
      parameters: { pace: "faster" },
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("SPEED_UP");
    expect(decision.paceChange).toBe("faster");
  });

  it("returns REPLAY for replay PLAYBACK_CONTROL", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "replay",
      intentType: "PLAYBACK_CONTROL",
      parameters: { action: "replay" },
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("REPLAY");
    expect(decision.playbackAction).toBe("replay");
  });

  it("returns TRACE for next PLAYBACK_CONTROL", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "next",
      intentType: "PLAYBACK_CONTROL",
      parameters: { action: "next" },
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("TRACE");
    expect(decision.playbackAction).toBe("next");
  });

  it("returns FOCUS with entity ID for QUESTION_FOCUS", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "focus on mid",
      intentType: "QUESTION_FOCUS",
      target: "mid",
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("FOCUS");
    expect(decision.focusEntityId).toBe("mid");
    expect(decision.isLocal).toBe(true);
  });

  it("returns SIMPLIFY locally for QUESTION_SIMPLIFY", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "I don't understand",
      intentType: "QUESTION_SIMPLIFY",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("SIMPLIFY");
    expect(decision.isLocal).toBe(true);
    expect(decision.requiresLLM).toBe(false);
    expect(decision.explanation).toContain("Binary search");
  });

  it("routes QUESTION_ELABORATE to LLM with enriched prompt", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "go deeper",
      intentType: "QUESTION_ELABORATE",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("ELABORATE");
    expect(decision.requiresLLM).toBe(true);
    expect(decision.llmPrompt).toContain("invariant");
  });

  it("falls back to EXPLAIN via LLM for unrecognized general question", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "Tell me about quicksort",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState();
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("EXPLAIN");
    expect(decision.requiresLLM).toBe(true);
    expect(decision.llmPrompt).toBeDefined();
  });
});

// ============================================================================
// 2. LearnerState-Driven Adaptive Strategy
// ============================================================================

describe("TeacherBrain — LearnerState Adaptation", () => {
  it("proactively selects SIMPLIFY when confusion >= 3 and confidence < 0.4 on a general question", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "I still don't really get it",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
      studentState: {
        currentConcept: "Binary Search",
        confidence: 0.3,
        confusionSignals: 4,
        pace: "slower",
        playbackSpeed: 0.8,
        preferredExplanationDepth: "simple",
        recentQuestions: [],
        misconceptions: [],
        consecutiveSuccessfulPredictions: 0,
        lastInteractionTime: Date.now(),
      },
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("SIMPLIFY");
    expect(decision.isLocal).toBe(true);
    expect(decision.confidence.basis).toContain("Confusion signals");
  });

  it("does NOT trigger adaptive SIMPLIFY when confidence is high (no confusion)", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "Cool, what is next?",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      studentState: {
        currentConcept: "Binary Search",
        confidence: 0.85,
        confusionSignals: 0,
        pace: "normal",
        playbackSpeed: 1.0,
        preferredExplanationDepth: "normal",
        recentQuestions: [],
        misconceptions: [],
        consecutiveSuccessfulPredictions: 3,
        lastInteractionTime: Date.now(),
      },
    });
    const decision = TeacherBrain.decide(intent, world);

    // Should NOT be SIMPLIFY — learner is doing well
    expect(decision.strategy).not.toBe("SIMPLIFY");
  });

  it("calibrates LLM prompt to 'simple' when preferredExplanationDepth is simple", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "What happens next in binary search?",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      studentState: {
        currentConcept: "Binary Search",
        confidence: 0.5,
        confusionSignals: 1,
        pace: "normal",
        playbackSpeed: 1.0,
        preferredExplanationDepth: "simple",
        recentQuestions: [],
        misconceptions: [],
        consecutiveSuccessfulPredictions: 0,
        lastInteractionTime: Date.now(),
      },
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.requiresLLM).toBe(true);
    expect(decision.llmPrompt).toContain("beginner");
  });

  it("calibrates LLM prompt to 'technical' when preferredExplanationDepth is technical", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "What is the time complexity proof here?",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      studentState: {
        currentConcept: "Binary Search",
        confidence: 0.9,
        confusionSignals: 0,
        pace: "faster",
        playbackSpeed: 1.25,
        preferredExplanationDepth: "technical",
        recentQuestions: [],
        misconceptions: [],
        consecutiveSuccessfulPredictions: 5,
        lastInteractionTime: Date.now(),
      },
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.requiresLLM).toBe(true);
    expect(decision.llmPrompt).toContain("rigorous");
  });
});

// ============================================================================
// 3. Follow-up WHY Resolution (local, from TeachingMoment)
// ============================================================================

describe("TeacherBrain — Follow-up WHY Resolution", () => {
  it("resolves WHY fully locally from moment.why + moment.consequence", () => {
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment({
        why: "Binary search eliminates half the array at each step by comparing the midpoint.",
        consequence: "Since 23 > 5, we discard the left half and search only the right portion.",
      }),
    });

    const result = TeacherBrain.resolveFollowUp("WHY", world);

    expect(result).not.toBeNull();
    expect(result!.explanation).toContain("Why:");
    expect(result!.explanation).toContain("Binary search eliminates");
    expect(result!.explanation).toContain("Consequence:");
    expect(result!.explanation).toContain("discard the left half");
    expect(result!.narration).toContain("Binary search eliminates");
  });

  it("resolves WHY from moment.why alone when no consequence", () => {
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment({
        why: "We maintain BST order invariant.",
        consequence: undefined,
      }),
    });

    const result = TeacherBrain.resolveFollowUp("WHY", world);

    expect(result).not.toBeNull();
    expect(result!.explanation).toContain("BST order invariant");
    expect(result!.narration).toContain("BST order invariant");
  });

  it("falls back to explanation when neither why nor consequence is set", () => {
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment({
        why: undefined,
        consequence: undefined,
        explanation: "The pointer is shifted.",
        narration: "We shift the pointer.",
      }),
    });

    const result = TeacherBrain.resolveFollowUp("WHY", world);

    expect(result).not.toBeNull();
    expect(result!.explanation).toContain("The pointer is shifted");
  });

  it("returns null when no currentMoment is set", () => {
    const world = buildMinimalWorldState({ currentMoment: null });
    const result = TeacherBrain.resolveFollowUp("WHY", world);
    expect(result).toBeNull();
  });

  it("TeacherBrain.decide selects WHY strategy via QUESTION_WHY intent", () => {
    const intent = createInputIntent({
      source: "voice",
      rawInput: "why did we move right?",
      intentType: "QUESTION_WHY",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("WHY");
    expect(decision.isLocal).toBe(true);
    expect(decision.requiresLLM).toBe(false);
    expect(decision.narration).toContain("Binary search eliminates");
    expect(decision.confidence.score).toBeGreaterThanOrEqual(0.9);
  });
});

// ============================================================================
// 4. Follow-up HOW Resolution
// ============================================================================

describe("TeacherBrain — Follow-up HOW Resolution", () => {
  it("resolves HOW locally, listing affected entities", () => {
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment({
        affectedEntities: ["node-mid", "node-lo", "node-hi"],
        title: "Update lo pointer",
        explanation: "Lo advances past mid to narrow right half.",
      }),
    });

    const result = TeacherBrain.resolveFollowUp("HOW", world);

    expect(result).not.toBeNull();
    expect(result!.explanation).toContain("node-mid");
    expect(result!.explanation).toContain("Lo advances");
    expect(result!.narration).toContain("In this step, we work on");
  });

  it("falls back to explanation when no affected entities", () => {
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment({
        affectedEntities: [],
        explanation: "The search space is initialized.",
      }),
    });

    const result = TeacherBrain.resolveFollowUp("HOW", world);

    expect(result).not.toBeNull();
    expect(result!.explanation).toContain("The search space is initialized");
  });
});

// ============================================================================
// 5. Adaptive Granularity Computation
// ============================================================================

describe("TeacherBrain — Adaptive Granularity", () => {
  const complexRotationMoment = buildTeachingMoment({
    title: "AVL Right Rotation",
    explanation: "Perform right rotation at unbalanced node. Balance factor check.",
  });

  const simpleInsertMoment = buildTeachingMoment({
    title: "Insert node 15",
    explanation: "Insert new node 15 to the right of 10.",
  });

  it("returns 1 (no split) for fluent learner (0 confusion, high confidence)", () => {
    const student = {
      currentConcept: "AVL",
      confidence: 0.9,
      confusionSignals: 0,
      pace: "normal" as const,
      playbackSpeed: 1.0,
      preferredExplanationDepth: "normal" as const,
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 3,
      lastInteractionTime: Date.now(),
    };
    expect(TeacherBrain.computeAdaptiveGranularity(student, complexRotationMoment)).toBe(1);
  });

  it("returns 2 for mild confusion on a complex (rotation) step", () => {
    const student = {
      currentConcept: "AVL",
      confidence: 0.55,
      confusionSignals: 2,
      pace: "slower" as const,
      playbackSpeed: 0.8,
      preferredExplanationDepth: "simple" as const,
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 0,
      lastInteractionTime: Date.now(),
    };
    expect(TeacherBrain.computeAdaptiveGranularity(student, complexRotationMoment)).toBe(2);
  });

  it("returns 1 for mild confusion on a simple (non-complex) step", () => {
    const student = {
      currentConcept: "AVL",
      confidence: 0.55,
      confusionSignals: 2,
      pace: "normal" as const,
      playbackSpeed: 1.0,
      preferredExplanationDepth: "normal" as const,
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 0,
      lastInteractionTime: Date.now(),
    };
    expect(TeacherBrain.computeAdaptiveGranularity(student, simpleInsertMoment)).toBe(1);
  });

  it("returns 3 for moderate confusion on a complex (rotation) step", () => {
    const student = {
      currentConcept: "AVL",
      confidence: 0.4,
      confusionSignals: 3,
      pace: "slower" as const,
      playbackSpeed: 0.75,
      preferredExplanationDepth: "simple" as const,
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 0,
      lastInteractionTime: Date.now(),
    };
    expect(TeacherBrain.computeAdaptiveGranularity(student, complexRotationMoment)).toBe(3);
  });

  it("returns 4 for heavily confused learner (very low confidence)", () => {
    const student = {
      currentConcept: "AVL",
      confidence: 0.1,
      confusionSignals: 5,
      pace: "slower" as const,
      playbackSpeed: 0.75,
      preferredExplanationDepth: "simple" as const,
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 0,
      lastInteractionTime: Date.now(),
    };
    expect(TeacherBrain.computeAdaptiveGranularity(student, complexRotationMoment)).toBe(4);
  });

  it("returns 1 when no currentMoment exists", () => {
    const student = {
      currentConcept: "AVL",
      confidence: 0.1,
      confusionSignals: 5,
      pace: "slower" as const,
      playbackSpeed: 0.75,
      preferredExplanationDepth: "simple" as const,
      recentQuestions: [],
      misconceptions: [],
      consecutiveSuccessfulPredictions: 0,
      lastInteractionTime: Date.now(),
    };
    expect(TeacherBrain.computeAdaptiveGranularity(student, null)).toBe(1);
  });

  it("SIMPLIFY decision includes granularityRecommendation > 1 for confused learner on complex step", () => {
    const intent = createInputIntent({
      source: "voice",
      rawInput: "I don't understand",
      intentType: "QUESTION_SIMPLIFY",
    });
    const world = buildMinimalWorldState({
      currentMoment: complexRotationMoment,
      studentState: {
        currentConcept: "AVL",
        confidence: 0.4,
        confusionSignals: 3,
        pace: "slower",
        playbackSpeed: 0.75,
        preferredExplanationDepth: "simple",
        recentQuestions: [],
        misconceptions: [],
        consecutiveSuccessfulPredictions: 0,
        lastInteractionTime: Date.now(),
      },
    });

    const decision = TeacherBrain.decide(intent, world);
    expect(decision.granularityRecommendation).toBeGreaterThan(1);
  });
});

// ============================================================================
// 6. Misconception Detection
// ============================================================================

describe("TeacherBrain — Misconception Detection", () => {
  it("detects inverted greater-than comparison and returns CORRECT strategy", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "5 is greater than 23",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("CORRECT");
    expect(decision.isLocal).toBe(true);
    expect(decision.explanation).toContain("5 is actually less than 23");
    expect(decision.narration).toContain("5 is actually less than 23");
  });

  it("detects inverted less-than comparison", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "30 is less than 10",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("CORRECT");
    expect(decision.explanation).toContain("30 is actually greater than 10");
  });

  it("detects AVL balance factor wrong rotation direction (bf=2, said 'left')", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "Balance factor is 2 so we rotate left",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("CORRECT");
    expect(decision.explanation).toContain("right rotation");
    expect(decision.narration).toContain("right rotation");
  });

  it("detects AVL balance factor wrong rotation direction (bf=-2, said 'right')", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "balance factor is -2 so we rotate right",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    expect(decision.strategy).toBe("CORRECT");
    expect(decision.explanation).toContain("left rotation");
  });

  it("does NOT flag correct comparison as misconception (5 is less than 23)", () => {
    const intent = createInputIntent({
      source: "keyboard",
      rawInput: "5 is less than 23",
      intentType: "GENERAL_EXPLANATION",
    });
    const world = buildMinimalWorldState({
      currentMoment: buildTeachingMoment(),
    });
    const decision = TeacherBrain.decide(intent, world);

    // Should NOT be CORRECT — comparison is factually true
    expect(decision.strategy).not.toBe("CORRECT");
  });
});

// ============================================================================
// 7. computeLearnerUpdate Purity
// ============================================================================

describe("computeLearnerUpdate — Pure function verification", () => {
  const baseStudent = {
    currentConcept: "Binary Search",
    confidence: 0.7,
    confusionSignals: 0,
    pace: "normal" as const,
    playbackSpeed: 1.0,
    preferredExplanationDepth: "normal" as const,
    recentQuestions: [],
    misconceptions: [],
    consecutiveSuccessfulPredictions: 0,
    lastInteractionTime: Date.now(),
  };

  it("SIMPLIFY strategy increments confusionDelta and decreases confidence", () => {
    const decision: TeacherDecision = {
      strategy: "SIMPLIFY",
      isLocal: true,
      requiresLLM: false,
      explanation: "test",
      narration: "test",
      confidence: { score: 0.9, basis: "test" },
    };
    const update = computeLearnerUpdate(decision, baseStudent);

    expect(update.confusionDelta).toBe(1);
    expect(update.confidenceDelta).toBeLessThan(0);
    expect(update.shouldSwitchDepth).toBe("simple");
  });

  it("CORRECT strategy increments confusionDelta and decreases confidence", () => {
    const decision: TeacherDecision = {
      strategy: "CORRECT",
      isLocal: true,
      requiresLLM: false,
      explanation: "test",
      narration: "test",
      confidence: { score: 0.9, basis: "test" },
    };
    const update = computeLearnerUpdate(decision, baseStudent);

    expect(update.confusionDelta).toBe(1);
    expect(update.confidenceDelta).toBeLessThan(0);
  });

  it("SPEED_UP strategy increases confidence and sets paceChange=faster", () => {
    const decision: TeacherDecision = {
      strategy: "SPEED_UP",
      isLocal: true,
      requiresLLM: false,
      explanation: "test",
      narration: "test",
      confidence: { score: 1.0, basis: "test" },
    };
    const update = computeLearnerUpdate(decision, baseStudent);

    expect(update.confidenceDelta).toBeGreaterThan(0);
    expect(update.paceChange).toBe("faster");
  });

  it("WHY strategy with no prior confusion has zero confusionDelta", () => {
    const decision: TeacherDecision = {
      strategy: "WHY",
      isLocal: true,
      requiresLLM: false,
      explanation: "Why: ...",
      narration: "Because...",
      confidence: { score: 0.95, basis: "test" },
    };
    // No prior confusion signals
    const update = computeLearnerUpdate(decision, { ...baseStudent, confusionSignals: 0 });
    expect(update.confusionDelta).toBe(0);
  });

  it("WHY strategy with confusionSignals >= 2 increments confusionDelta", () => {
    const decision: TeacherDecision = {
      strategy: "WHY",
      isLocal: true,
      requiresLLM: false,
      explanation: "Why: ...",
      narration: "Because...",
      confidence: { score: 0.95, basis: "test" },
    };
    const update = computeLearnerUpdate(decision, { ...baseStudent, confusionSignals: 3 });
    expect(update.confusionDelta).toBe(1);
  });

  it("ELABORATE strategy switches depth to 'detailed'", () => {
    const decision: TeacherDecision = {
      strategy: "ELABORATE",
      isLocal: false,
      requiresLLM: true,
      explanation: "test",
      narration: "",
      confidence: { score: 0.9, basis: "test" },
    };
    const update = computeLearnerUpdate(decision, baseStudent);
    expect(update.shouldSwitchDepth).toBe("detailed");
    expect(update.confidenceDelta).toBeGreaterThan(0);
  });

  it("does NOT mutate the original student state object", () => {
    const decision: TeacherDecision = {
      strategy: "SIMPLIFY",
      isLocal: true,
      requiresLLM: false,
      explanation: "test",
      narration: "test",
      confidence: { score: 0.9, basis: "test" },
    };
    const originalConfusion = baseStudent.confusionSignals;
    computeLearnerUpdate(decision, baseStudent);

    // Pure function must not mutate input
    expect(baseStudent.confusionSignals).toBe(originalConfusion);
  });
});

// ============================================================================
// 8. Full Real-Lesson Integration (TeacherBrainOrchestrator)
// ============================================================================

describe("TeacherBrainOrchestrator — Integration", () => {
  let worldModel: CognoraWorldModel;
  let orchestrator: TeacherBrainOrchestrator;

  beforeEach(() => {
    worldModel = new CognoraWorldModel();

    // Compile a real binary search lesson and load it into the world model
    const processed = UniversalConceptIntelligenceEngine.processQuestion(
      "Explain binary search on [2,5,8,12,16,23,38,56,72,91] searching for 23.",
    );
    worldModel.setLesson(processed.visualLesson, processed.timeline, {
      generationId: "GEN-BS-TEST",
    });
    worldModel.setCurrentMoment(1); // Move to step 1

    orchestrator = new TeacherBrainOrchestrator(worldModel);
  });

  it("WHY follow-up resolves locally without LLM round-trip on real lesson", () => {
    const result = orchestrator.orchestrate("why did we move there?", "voice");

    expect(result.decision.strategy).toBe("WHY");
    expect(result.decision.isLocal).toBe(true);
    expect(result.requiresLLM).toBe(false);
    expect(result.decision.narration.length).toBeGreaterThan(10);
    expect(result.llmPrompt).toBeUndefined();
  });

  it("HOW follow-up resolves locally without LLM round-trip on real lesson", () => {
    const result = orchestrator.orchestrate("how does this step work?", "keyboard");

    expect(result.decision.strategy).toBe("HOW");
    expect(result.decision.isLocal).toBe(true);
    expect(result.requiresLLM).toBe(false);
  });

  it("SIMPLIFY updates confusion signals in world model state", () => {
    const initialConfusion = worldModel.getState().studentState.confusionSignals;

    orchestrator.orchestrate("I don't understand", "keyboard");

    const updatedConfusion = worldModel.getState().studentState.confusionSignals;
    expect(updatedConfusion).toBeGreaterThan(initialConfusion);
  });

  it("SLOW_DOWN updates playback speed in world model state", () => {
    orchestrator.orchestrate("slow down", "voice");

    const speed = worldModel.getState().playbackState.speed;
    expect(speed).toBeLessThan(1.0);
  });

  it("SPEED_UP updates playback speed to > 1.0", () => {
    orchestrator.orchestrate("faster", "voice");

    const speed = worldModel.getState().playbackState.speed;
    expect(speed).toBeGreaterThan(1.0);
  });

  it("resolveFollowUp('WHY') returns structured explanation from orchestrator", () => {
    const result = orchestrator.resolveFollowUp("WHY");
    expect(result).not.toBeNull();
    expect(result!.explanation.length).toBeGreaterThan(5);
    expect(result!.narration.length).toBeGreaterThan(5);
  });

  it("getGranularityRecommendation() returns 1 for a non-confused student on a simple step", () => {
    // Default student state has 0 confusion signals and confidence 0.7
    const recommendation = orchestrator.getGranularityRecommendation();
    expect(recommendation).toBe(1);
  });

  it("applyLLMResponse decrements confusion signals and adds assistant message", () => {
    // First, artificially trigger confusion
    orchestrator.orchestrate("I don't understand", "keyboard");
    orchestrator.orchestrate("I'm confused", "keyboard");

    const confusionBefore = worldModel.getState().studentState.confusionSignals;
    const convBefore = worldModel.getBoundedConversation().length;

    orchestrator.applyLLMResponse("Here is a simple explanation of binary search.");

    const confusionAfter = worldModel.getState().studentState.confusionSignals;
    const convAfter = worldModel.getBoundedConversation().length;

    expect(confusionAfter).toBeLessThanOrEqual(confusionBefore);
    expect(convAfter).toBeGreaterThan(convBefore);
  });

  it("orchestrate() appends user question to conversation history", () => {
    const convBefore = worldModel.getBoundedConversation().length;
    orchestrator.orchestrate("Why did we go right?", "keyboard");
    const convAfter = worldModel.getBoundedConversation().length;

    expect(convAfter).toBeGreaterThan(convBefore);
    const lastMsg = worldModel.getBoundedConversation().slice(-1)[0];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content).toBe("Why did we go right?");
  });

  it("misconception CORRECT strategy does not require LLM", () => {
    const result = orchestrator.orchestrate("5 is greater than 23", "keyboard");

    expect(result.decision.strategy).toBe("CORRECT");
    expect(result.requiresLLM).toBe(false);
    expect(result.decision.explanation).toContain("5 is actually less than 23");
  });
});
