/**
 * Cognora Live Intelligence & Teaching Loop Unit Tests
 *
 * Tests:
 * 1. CognoraWorldModel: Authoritative state, subscribers, branches, bounded history
 * 2. IntentEngine: Multimodal convergence, interruption, navigation, what-if, focus
 * 3. ContextEngine: Indexical resolution, compact prompt construction
 * 4. TeacherBrain: Strategy selection, misconception detection, local execution
 * 5. BranchManager: Counterfactual branch creation & safe restoration
 * 6. StudentState: Lesson-scoped learner tracking & adaptation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CognoraWorldModel,
  type CognoraWorldState,
} from "../ai/intelligence/cognora-world-model";
import { IntentEngine } from "../ai/intelligence/intent-engine";
import { ContextEngine } from "../ai/intelligence/context-engine";
import { TeacherBrain } from "../ai/intelligence/teacher-brain";
import { BranchManager } from "../ai/intelligence/branch-manager";
import {
  StudentStateManager,
  createInitialStudentState,
} from "../ai/intelligence/student-state";
import type { TeachingMoment } from "../ai/teaching-moment";
import type { CompiledTimeline } from "../ai/transformation-timeline";
import type { AuthoritativeSemanticModel } from "../ai/authoritative-model";

function createMockTeachingMoment(index: number, total: number = 3): TeachingMoment {
  return {
    id: `moment-${index}`,
    transformationId: `trans-${index}`,
    stepIndex: index,
    totalSteps: total,
    beforeState: {
      elements: [],
      stateId: `before-${index}`,
    } as any,
    afterState: {
      elements: [],
      stateId: `after-${index}`,
    } as any,
    semanticChanges: {
      addedEntities: [`node-${index}`],
      removedEntities: [],
      updatedEntities: [],
      addedRelationships: [],
      removedRelationships: [],
    },
    visualState: {
      graph: {
        entities: new Map(),
        relationships: new Map(),
        annotations: new Map(),
      },
      elements: [],
      stateId: `scene-${index}`,
    } as any,
    affectedEntities: [`node-${index}`],
    affectedRelationships: [],
    semanticFocus: {
      type: "entity",
      entityIds: [`node-${index}`],
      label: `Node ${index * 10 + 10}`,
    },
    title: `Step ${index + 1}`,
    explanation: `Step ${index + 1}: Compare middle element with target.`,
    why: `Since target is greater than mid, eliminate the left half.`,
    consequence: `Search space is halved from 10 to 5 elements.`,
    narration: `We compare target 23 with middle element 16. Since 23 is larger, search right.`,
    importance: "HIGH",
  };
}

describe("Cognora Live Intelligence Suite", () => {
  describe("CognoraWorldModel", () => {
    let world: CognoraWorldModel;

    beforeEach(() => {
      world = new CognoraWorldModel();
    });

    it("initializes with clean authoritative state", () => {
      const state = world.getState();
      expect(state.lesson).toBeNull();
      expect(state.currentMoment).toBeNull();
      expect(state.voiceState).toBe("idle");
      expect(state.orbState).toBe("IDLE");
      expect(state.activeBranch).toBeNull();
    });

    it("notifies subscribers atomically on moment changes", () => {
      const moments = [
        createMockTeachingMoment(0),
        createMockTeachingMoment(1),
        createMockTeachingMoment(2),
      ];
      const mockTimeline: CompiledTimeline = {
        lessonId: "test-bs",
        topic: "Binary Search",
        states: [],
        meta: [],
        moments,
        currentIndex: 0,
      };

      const listener = vi.fn();
      const unsub = world.subscribe(listener);

      world.setLesson({ id: "test-bs", title: "Binary Search", transformations: [] } as any, mockTimeline);
      expect(listener).toHaveBeenCalled();
      expect(world.getState().currentMoment?.id).toBe("moment-0");

      world.setCurrentMoment(1);
      expect(world.getState().currentMoment?.id).toBe("moment-1");
      expect(world.getState().previousMoment?.id).toBe("moment-0");
      expect(world.getState().nextMoment?.id).toBe("moment-2");
      expect(world.getState().focusState.focusedEntityId).toBe("node-1");

      unsub();
    });

    it("maintains bounded conversation history (max 12 turns)", () => {
      for (let i = 0; i < 15; i++) {
        world.appendConversation({
          id: `msg-${i}`,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
        });
      }
      const history = world.getBoundedConversation();
      expect(history.length).toBe(12);
      expect(history[history.length - 1].content).toBe("Message 14");
    });
  });

  describe("IntentEngine", () => {
    it("detects immediate interruption triggers with highest priority", () => {
      const triggers = ["wait", "Wait", "hold on", "STOP", "pause", "give me a second"];
      for (const text of triggers) {
        const intent = IntentEngine.resolveIntent(text, "voice");
        expect(intent.intentType).toBe("INTERRUPT");
        expect(intent.confidence).toBe(1.0);
        expect(intent.riskLevel).toBe("SAFE");
      }
    });

    it("detects playback navigation controls deterministically", () => {
      expect(IntentEngine.resolveIntent("next").intentType).toBe("PLAYBACK_CONTROL");
      expect(IntentEngine.resolveIntent("go to next step").intentType).toBe("PLAYBACK_CONTROL");
      expect(IntentEngine.resolveIntent("previous").intentType).toBe("PLAYBACK_CONTROL");
      expect(IntentEngine.resolveIntent("actually go back").intentType).toBe("PLAYBACK_CONTROL");
      expect(IntentEngine.resolveIntent("replay").intentType).toBe("PLAYBACK_CONTROL");
    });

    it("detects pacing controls", () => {
      const slower = IntentEngine.resolveIntent("slow down");
      expect(slower.intentType).toBe("PACE_CONTROL");
      expect(slower.parameters.pace).toBe("slower");

      const faster = IntentEngine.resolveIntent("go faster");
      expect(faster.intentType).toBe("PACE_CONTROL");
      expect(faster.parameters.pace).toBe("faster");
    });

    it("detects pedagogical requests: Simplify and Why", () => {
      expect(IntentEngine.resolveIntent("I don't understand").intentType).toBe("QUESTION_SIMPLIFY");
      expect(IntentEngine.resolveIntent("explain simpler").intentType).toBe("QUESTION_SIMPLIFY");
      expect(IntentEngine.resolveIntent("Why did it rotate?").intentType).toBe("QUESTION_WHY");
      expect(IntentEngine.resolveIntent("why?").intentType).toBe("QUESTION_WHY");
    });

    it("detects What-If branching inquiries", () => {
      const whatIf = IntentEngine.resolveIntent("What if target was 70?");
      expect(whatIf.intentType).toBe("QUESTION_WHAT_IF");
      expect(whatIf.parameters.hypotheticalValue).toBe(70);

      const tryWith = IntentEngine.resolveIntent("Try 40 instead");
      expect(tryWith.intentType).toBe("QUESTION_WHAT_IF");
    });

    it("detects branch exit when in an active branch", () => {
      const worldState: any = {
        activeBranch: { branchId: "b-1" },
      };
      const exitIntent = IntentEngine.resolveIntent("go back", "voice", worldState);
      expect(exitIntent.intentType).toBe("BRANCH_EXIT");
    });
  });

  describe("ContextEngine", () => {
    it("resolves target entity and indexicals from current TeachingMoment", () => {
      const moment = createMockTeachingMoment(1);
      const worldState: any = {
        currentMoment: moment,
        studentState: createInitialStudentState("Binary Search"),
        timeline: { moments: [moment], invariants: [{ statement: "Array must be sorted" }] },
        activeBranch: null,
      };

      const intent = IntentEngine.resolveIntent("Why is this node here?");
      const context = ContextEngine.resolveContext(intent, worldState);

      expect(context.concept).toBe("Binary Search");
      expect(context.targetEntityId).toBe("node-1");
      expect(context.whyCurrentStep).toContain("target is greater than mid");
      expect(context.relevantInvariants).toContain("Array must be sorted");
    });

    it("formats compact prompt context stripping raw coordinates", () => {
      const moment = createMockTeachingMoment(0);
      const worldState: any = {
        currentMoment: moment,
        studentState: createInitialStudentState("AVL Tree"),
        timeline: { moments: [moment], invariants: [] },
        activeBranch: null,
      };

      const intent = IntentEngine.resolveIntent("Why?");
      const context = ContextEngine.resolveContext(intent, worldState);
      const formatted = ContextEngine.formatCompactPromptContext(context);

      expect(formatted).toContain("[COGNORA_CONTEXT]");
      expect(formatted).toContain("Concept: AVL Tree");
      expect(formatted).not.toContain('"x":');
      expect(formatted).not.toContain('"y":');
      expect(formatted).not.toContain("width:");
    });
  });

  describe("TeacherBrain", () => {
    it("executes local deterministic operations with zero LLM overhead", () => {
      const moment = createMockTeachingMoment(1);
      const worldState: any = {
        currentMoment: moment,
        studentState: createInitialStudentState("Binary Search"),
        timeline: { moments: [moment] },
        activeBranch: null,
      };

      // Navigation
      const nextIntent = IntentEngine.resolveIntent("next");
      const nextDecision = TeacherBrain.decide(nextIntent, worldState);
      expect(nextDecision.isLocal).toBe(true);
      expect(nextDecision.requiresLLM).toBe(false);
      expect(nextDecision.playbackAction).toBe("next");

      // Why question
      const whyIntent = IntentEngine.resolveIntent("why did we eliminate the left side?");
      const whyDecision = TeacherBrain.decide(whyIntent, worldState);
      expect(whyDecision.isLocal).toBe(true);
      expect(whyDecision.strategy).toBe("WHY");
      expect(whyDecision.explanation).toContain("Since target is greater than mid");

      // Simplify question
      const simplifyIntent = IntentEngine.resolveIntent("I don't understand");
      const simplifyDecision = TeacherBrain.decide(simplifyIntent, worldState);
      expect(simplifyDecision.isLocal).toBe(true);
      expect(simplifyDecision.strategy).toBe("SIMPLIFY");
      expect(simplifyDecision.narration).toContain("Let's break this down simply");
    });

    it("detects numerical misconception and formulates gentle correction", () => {
      const moment = createMockTeachingMoment(1);
      const worldState: any = {
        currentMoment: moment,
        studentState: createInitialStudentState("Binary Search"),
        timeline: { moments: [moment] },
        activeBranch: null,
      };

      const falseStatement = IntentEngine.resolveIntent("Since 16 is greater than 23 we search right");
      const decision = TeacherBrain.decide(falseStatement, worldState);

      expect(decision.strategy).toBe("CORRECT");
      expect(decision.isLocal).toBe(true);
      expect(decision.explanation).toContain("16 is actually less than 23");
    });
  });

  describe("BranchManager", () => {
    it("creates a safe What-If branch without mutating the original model", () => {
      const moment = createMockTeachingMoment(1);
      const mockModel: AuthoritativeSemanticModel = {
        id: "model-test-bs",
        problem: {
          id: "prob-1",
          question: "Binary Search",
          concept: "binary_search",
        } as any,
        world: {
          entities: [],
          relationships: [],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: {
          satisfied: true,
          objective: "Complete Search",
          verifiedCriteria: [],
          summary: "Satisfied",
        },
        strategy: "binary_search",
        confidence: { score: 1, level: "high", reason: "verified" } as any,
        timestamp: Date.now(),
      };

      const worldState: any = {
        currentMoment: moment,
        timeline: { moments: [moment], model: mockModel },
        activeBranch: null,
        studentState: createInitialStudentState(),
      };

      const branch = BranchManager.createBranch("What if target was 70?", worldState);
      expect(branch).not.toBeNull();
      expect(branch?.description).toBe("What if target was 70?");
      expect(branch?.parentMomentIndex).toBe(1);
      expect(branch?.branchMoments.length).toBe(1);
      expect(branch?.branchMoments[0].importance).toBe("HIGH");
    });
  });

  describe("StudentStateManager", () => {
    it("adapts explanation depth upon repeated confusion signals", () => {
      const mgr = new StudentStateManager("Heap Sort");
      expect(mgr.getState().preferredExplanationDepth).toBe("normal");

      mgr.recordConfusionSignal();
      expect(mgr.getState().confusionSignals).toBe(1);
      expect(mgr.getState().preferredExplanationDepth).toBe("normal");

      mgr.recordConfusionSignal();
      expect(mgr.getState().confusionSignals).toBe(2);
      expect(mgr.getState().preferredExplanationDepth).toBe("simple");
    });

    it("tracks pacing preferences accurately", () => {
      const mgr = new StudentStateManager("Dijkstra");
      mgr.recordPacingChange("slower");
      expect(mgr.getState().pace).toBe("slower");
      expect(mgr.getState().playbackSpeed).toBe(0.8);

      mgr.recordPacingChange("faster");
      expect(mgr.getState().pace).toBe("faster");
      expect(mgr.getState().playbackSpeed).toBe(1.25);
    });
  });
});
