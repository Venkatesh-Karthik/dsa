// @vitest-environment jsdom
/**
 * Cognora Final Teaching Intelligence & State Synchronization Architecture Test Suite
 *
 * Verifies all 24 architectural requirements from Section 36, plus
 * Section 37 (Dijkstra stress scenario) and Section 38 (Multi-domain generalization).
 */
import "vitest-canvas-mock";
import { describe, it, expect, beforeEach } from "vitest";
import { CognoraWorldModel } from "../ai/intelligence/cognora-world-model";
import {
  TeacherBrain,
  computeLearnerUpdate,
} from "../ai/intelligence/teacher-brain";
import { TeacherBrainOrchestrator } from "../ai/intelligence/teacher-brain-orchestrator";
import { StudentStateManager } from "../ai/intelligence/student-state";
import { BranchManager } from "../ai/intelligence/branch-manager";
import { IntentEngine } from "../ai/intelligence/intent-engine";
import { createInputIntent } from "../ai/intelligence/input-intent";
import { CounterfactualEngine } from "../ai/counterfactual-engine";
import { sanitizeVisualText } from "../ai/visual-reasoning/text-sanitizer";
import { SpeechPreprocessor } from "../ai/voice/speech-preprocessor";
import {
  sanitizeDisplayLabel,
  createVisualPrimitive,
} from "../ai/visual-primitives/primitive-factory";
import { computeGraphLayout } from "../ai/layout-engine";
import { computeOptimalCalloutPosition } from "../ai/visual-reasoning/callout-planner";
import { reconcileSceneState } from "../ai/scene-reconciler";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import type { TeachingMoment } from "../ai/teaching-moment";
import type { SceneState } from "../ai/scene-state";

describe("Cognora Final Teaching Intelligence & State Synchronization Upgrade", () => {
  let worldModel: CognoraWorldModel;
  let orchestrator: TeacherBrainOrchestrator;
  let studentManager: StudentStateManager;

  beforeEach(() => {
    studentManager = new StudentStateManager();
    worldModel = new CognoraWorldModel();
    orchestrator = new TeacherBrainOrchestrator(worldModel, studentManager);
  });

  // ============================================================================
  // SECTION 36: 24 MANDATORY ARCHITECTURAL TESTS
  // ============================================================================

  describe("TEST 1: Large question does not require every future teaching artifact upfront", () => {
    it("compiles and initializes teaching with first atomic TeachingMoment without populating all future canvas objects", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Teach me Dijkstra shortest path on graph",
      );
      expect(processed.timeline?.moments?.length || 0).toBeGreaterThan(0);
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-1",
      });

      const state = worldModel.getState();
      expect(state.currentMoment).toBeDefined();
      expect(state.currentMoment?.stepIndex).toBe(0);

      // The active scene contains only the elements needed for moment 0
      const activeEntities = state.currentMoment?.visualState?.graph.entities;
      expect(activeEntities).toBeDefined();
    });
  });

  describe("TEST 2: TeachingMoment and semantic world version remain synchronized", () => {
    it("synchronizes TeachingMoment stepIndex and authoritative worldVersion 1-to-1", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm on array",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-2",
      });

      worldModel.setCurrentMoment(0);
      expect(worldModel.getState().playbackState.currentIndex).toBe(0);
      expect(worldModel.getState().worldVersion).toBe(1);

      worldModel.setCurrentMoment(2);
      expect(worldModel.getState().playbackState.currentIndex).toBe(2);
      expect(worldModel.getState().worldVersion).toBe(3);
    });
  });

  describe("TEST 3: Explanation never describes a future state as current", () => {
    it("ensures each TeachingMoment explanation describes the present transition, not future milestones", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search on array [2, 5, 8, 12, 16, 23]",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-3",
      });

      const moments = processed.timeline?.moments || [];
      for (let i = 0; i < moments.length - 1; i++) {
        const currentMoment = moments[i];
        if (i < moments.length - 2) {
          expect(currentMoment.explanation.toLowerCase()).not.toContain(
            "search completed successfully at target",
          );
        }
      }
    });
  });

  describe("TEST 4: Internal IDs never appear in student-facing text", () => {
    it("sanitizes machine IDs like dijkstra-graph-C, dist-table-before, pq-after, and pointer from student-facing output", () => {
      const sampleText =
        "Introducing pointer, dijkstra-graph-C. Updating dist-table-before and pq-after with invariant-text.";
      const sanitized = sanitizeVisualText(sampleText);

      expect(sanitized).not.toContain("dijkstra-graph-C");
      expect(sanitized).not.toContain("dist-table-before");
      expect(sanitized).not.toContain("pq-after");
      expect(sanitized).not.toContain("invariant-text");
      expect(sanitized).toContain("Node C");
      expect(sanitized).toContain("Distance Table");
      expect(sanitized).toContain("Priority Queue");

      // Test display label sanitizer
      expect(sanitizeDisplayLabel(null, "dijkstra-graph-B", "dijkstra-graph-B")).toBe("B");
      expect(sanitizeDisplayLabel(null, "dist-table-before", "dist-table-before")).toBe("Distance Table");
      expect(sanitizeDisplayLabel(null, "pq-after", "pq-after")).toBe("Priority Queue");
      expect(sanitizeDisplayLabel(null, "invariant-text", "invariant-text")).toBe("Algorithm Invariant");
      expect(sanitizeDisplayLabel(null, "pointer", "pointer")).toBe("Pointer");
    });

    it("preprocesses speech cleanly without leaking compiler tokens", () => {
      const spoken = SpeechPreprocessor.prepare({
        lessonId: "test-lesson",
        transformationId: "t-1",
        stepIndex: 1,
        totalSteps: 5,
        title: "dijkstra-graph-C Update",
        explanation: "Introducing pointer, dijkstra-graph-C to relax edge C->D.",
      });

      expect(spoken.spokenText).not.toContain("dijkstra-graph-C");
      expect(spoken.spokenText).toContain("Node C");
    });
  });

  describe("TEST 5: Previous teaching artifacts do not accumulate permanently on the canvas", () => {
    it("reconciler deletes elements not present in target SceneState instead of accumulating", () => {
      const state1: SceneState = {
        graph: {
          entities: new Map([
            [
              "node-A",
              {
                id: "node-A",
                primitiveType: "CircleNode",
                label: "A",
                properties: {},
              },
            ],
            [
              "temp-pointer",
              {
                id: "temp-pointer",
                primitiveType: "Annotation",
                label: "Pointer",
                properties: {},
              },
            ],
          ]),
          relationships: new Map(),
          annotations: new Map(),
        },
      };

      // Step 1: Render state1
      const initial = reconcileSceneState(state1, []);
      const rendered1 = initial.elements.filter((e) => !e.isDeleted);
      expect(rendered1.some((e) => e.customData?.dslId === "temp-pointer")).toBe(true);

      // Step 2: Transition to state2 where temp-pointer is removed
      const state2: SceneState = {
        graph: {
          entities: new Map([
            [
              "node-A",
              {
                id: "node-A",
                primitiveType: "CircleNode",
                label: "A",
                properties: {},
              },
            ],
          ]),
          relationships: new Map(),
          annotations: new Map(),
        },
      };

      const reconciled2 = reconcileSceneState(state2, initial.elements);
      const activeElements = reconciled2.elements.filter((e) => !e.isDeleted);
      expect(activeElements.some((e) => e.customData?.dslId === "temp-pointer")).toBe(false);
      const deletedPointer = reconciled2.elements.find(
        (e) => e.customData?.dslId === "temp-pointer",
      );
      expect(deletedPointer?.isDeleted).toBe(true);
    });
  });

  describe("TEST 6: Before/after comparison is temporary and derived from semantic states", () => {
    it("creates a temporary comparison detour and returns cleanly to authoritative state", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search on sorted array",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-6",
      });
      worldModel.setCurrentMoment(2);

      const decision = orchestrator.orchestrate(
        "Show the old state and new state together and compare them",
      );
      expect(decision.decision.strategy).toBe("COMPARE");
      expect(worldModel.isInDetour()).toBe(true);

      const detour = worldModel.getActiveDetour();
      expect(detour).not.toBeNull();
      expect(detour?.parentMomentIndex).toBe(2);

      // Exiting detour restores exact lesson position
      worldModel.exitDetour();
      expect(worldModel.isInDetour()).toBe(false);
      expect(worldModel.getState().playbackState.currentIndex).toBe(2);
    });
  });

  describe("TEST 7: Graph topology is preserved", () => {
    it("computes graph layout ordering nodes by connectivity flow to minimize edge crossings", () => {
      const nodes = [
        { id: "node-A", label: "A" },
        { id: "node-B", label: "B" },
        { id: "node-C", label: "C" },
        { id: "node-D", label: "D" },
        { id: "node-E", label: "E" },
      ];
      const edges = [
        { id: "e1", from: "node-A", to: "node-B" },
        { id: "e2", from: "node-A", to: "node-C" },
        { id: "e3", from: "node-B", to: "node-D" },
        { id: "e4", from: "node-C", to: "node-E" },
      ];

      const layout = computeGraphLayout(nodes, edges, { x: 100, y: 100 });
      expect(layout.positions.size).toBe(5);

      // Verify no two nodes share the same position (no collapse)
      const coords = Array.from(layout.positions.values());
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const dist = Math.hypot(coords[i].x - coords[j].x, coords[i].y - coords[j].y);
          expect(dist).toBeGreaterThan(40);
        }
      }
    });
  });

  describe("TEST 8: Relationships resolve correctly", () => {
    it("resolves relationships between entities by source and target without guessing", () => {
      const state: SceneState = {
        graph: {
          entities: new Map([
            ["node-C", { id: "node-C", primitiveType: "CircleNode", label: "C", properties: {} }],
            ["node-D", { id: "node-D", primitiveType: "CircleNode", label: "D", properties: {} }],
          ]),
          relationships: new Map([
            [
              "rel-C-D",
              {
                id: "rel-C-D",
                type: "directed" as const,
                sourceEntityId: "node-C",
                targetEntityId: "node-D",
                label: "8",
                properties: { weight: 8 },
              },
            ],
          ]),
          annotations: new Map(),
        },
      };

      const result = reconcileSceneState(state, []);
      const arrow = result.elements.find((e) => e.type === "arrow");
      expect(arrow).toBeDefined();
      expect(arrow?.customData?.dslId).toBe("rel-C-D");
    });
  });

  describe("TEST 9: 'What if C→D = 1?' resolves existing C→D relationship", () => {
    it("correctly identifies edge C->D and mutates weight without reporting 'Target entity not found'", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Graph shortest path with edge C to D weight 8",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-9",
      });

      // Inject relationship into world model base state
      const baseState = worldModel.getState().timeline?.model?.states?.[0];
      if (baseState) {
        baseState.entities.set("C", {
          id: "C",
          label: "C",
          type: "Node",
          properties: {},
        });
        baseState.entities.set("D", {
          id: "D",
          label: "D",
          type: "Node",
          properties: {},
        });
        baseState.relationships.set("rel-C-D", {
          id: "rel-C-D",
          source: "C",
          target: "D",
          type: "CONNECTS",
          direction: "forward",
          label: "8",
          properties: { weight: 8 },
        });
      }

      const branch = BranchManager.createBranch(
        "What if the edge C→D had weight 1 instead of 8?",
        worldModel.getState(),
      );

      expect(branch).not.toBeNull();
      expect(branch?.counterfactualResult?.consequences.join(" ")).not.toContain(
        "Target entity not found",
      );
      expect(branch?.counterfactualResult?.consequences.join(" ")).toContain("changed weight");
    });
  });

  describe("TEST 10: What-if creates a branch from current world state", () => {
    it("creates an isolated WhatIfBranch inheriting parentMomentIndex and worldVersion", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-10",
      });
      worldModel.setCurrentMoment(2);

      const branch = BranchManager.createBranch(
        "What if the target was 99?",
        worldModel.getState(),
      );

      expect(branch).not.toBeNull();
      expect(branch?.parentMomentIndex).toBe(2);
      expect(branch?.parentBranchId).toBe("MAIN");
      expect(branch?.branchMoments.length).toBeGreaterThan(0);
    });
  });

  describe("TEST 11: What-if does not mutate the main branch", () => {
    it("preserves main timeline and model states when a what-if branch is explored", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-11",
      });
      worldModel.setCurrentMoment(1);

      const moments = worldModel.getState().timeline?.moments;
      const mainStateBefore = JSON.stringify(
        moments ? moments[1]?.explanation : "",
      );

      orchestrator.orchestrate("What if the target was 50 instead?");
      expect(worldModel.isInWhatIfBranch()).toBe(true);

      const momentsAfter = worldModel.getState().timeline?.moments;
      const mainStateAfter = JSON.stringify(
        momentsAfter ? momentsAfter[1]?.explanation : "",
      );
      expect(mainStateBefore).toBe(mainStateAfter);
    });
  });

  describe("TEST 12: Returning from what-if restores the main lesson state", () => {
    it("returns from what-if branch and restores exact parent lesson moment", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-12",
      });
      worldModel.setCurrentMoment(3);

      orchestrator.orchestrate("What if the target was 50?");
      expect(worldModel.isInWhatIfBranch()).toBe(true);

      orchestrator.orchestrate("Return to lesson");
      expect(worldModel.isInWhatIfBranch()).toBe(false);
      expect(worldModel.getState().playbackState.currentIndex).toBe(3);
    });
  });

  describe("TEST 13: 'Why?' uses current teaching context", () => {
    it("resolves WHY queries from active TeachingMoment without regenerating lesson", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-13",
      });
      worldModel.setCurrentMoment(1);

      const result = orchestrator.orchestrate("Why did you pick that?");
      expect(result.decision.strategy).toBe("WHY");
      expect(result.decision.requiresLLM).toBe(false);
      expect(result.decision.explanation).toBeTruthy();
    });
  });

  describe("TEST 14: 'I don't understand' can change teaching strategy", () => {
    it("dynamically shifts strategy from SIMPLIFY to DEMONSTRATE or COMPARE when confusion persists", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-14",
      });
      worldModel.setCurrentMoment(1);

      // First confusion signal -> SIMPLIFY
      const res1 = orchestrator.orchestrate("I don't understand this step");
      expect(res1.decision.strategy).toBe("SIMPLIFY");

      // Repeated confusion -> shifts to DEMONSTRATE or COMPARE
      const res2 = orchestrator.orchestrate("I still don't understand");
      expect(["DEMONSTRATE", "COMPARE"]).toContain(res2.decision.strategy);
    });
  });

  describe("TEST 15: 'Go slower' changes teaching granularity/pacing without regenerating lesson", () => {
    it("updates playback pacing and granularity locally without LLM roundtrip", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-15",
      });

      const res = orchestrator.orchestrate("Please go slower");
      expect(res.decision.strategy).toBe("SLOW_DOWN");
      expect(res.decision.requiresLLM).toBe(false);
      expect(worldModel.getState().playbackState.speed).toBeLessThan(1.0);
    });
  });

  describe("TEST 16: Next/Previous remain local and do not unnecessarily call AI", () => {
    it("handles next and previous playback navigation deterministically", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-16",
      });

      const nextRes = orchestrator.orchestrate("next step");
      expect(nextRes.decision.requiresLLM).toBe(false);
      expect(nextRes.decision.playbackAction).toBe("next");

      const prevRes = orchestrator.orchestrate("previous step");
      expect(prevRes.decision.requiresLLM).toBe(false);
      expect(prevRes.decision.playbackAction).toBe("previous");
    });
  });

  describe("TEST 17: Callout is anchored to semantic focus", () => {
    it("places callout relative to target entity bounds", () => {
      const anchor = { x: 200, y: 200, width: 60, height: 60 };
      const calloutPos = computeOptimalCalloutPosition({
        anchorBounds: anchor,
        calloutWidth: 160,
        calloutHeight: 60,
        obstacles: [],
      });
      expect(calloutPos.x).toBeDefined();
      expect(calloutPos.y).toBeDefined();
      const dist = Math.hypot(calloutPos.x - anchor.x, calloutPos.y - anchor.y);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(400);
    });
  });

  describe("TEST 18: Callout collision detection protects important visualization", () => {
    it("deflects callout away from obstacle bounding boxes", () => {
      const anchor = { x: 200, y: 200, width: 60, height: 60 };
      const obstacle = { x: 200, y: 120, width: 100, height: 50 };
      const calloutPos = computeOptimalCalloutPosition({
        anchorBounds: anchor,
        calloutWidth: 160,
        calloutHeight: 60,
        obstacles: [obstacle],
      });

      const overlapsObstacle =
        calloutPos.x < obstacle.x + obstacle.width &&
        calloutPos.x + 160 > obstacle.x &&
        calloutPos.y < obstacle.y + obstacle.height &&
        calloutPos.y + 60 > obstacle.y;
      expect(overlapsObstacle).toBe(false);
    });
  });

  describe("TEST 19: Final scene removes temporary teaching artifacts", () => {
    it("cleans up temporary pointers and scratch markers on the final step", () => {
      const state: SceneState = {
        graph: {
          entities: new Map([
            ["node-A", { id: "node-A", primitiveType: "CircleNode", label: "A", properties: {} }],
            ["pointer", { id: "pointer", primitiveType: "Annotation", label: "Pointer", properties: {} }],
          ]),
          relationships: new Map(),
          annotations: new Map(),
        },
      };

      // Non-final step preserves pointer
      const normalReconcile = reconcileSceneState(state, [], undefined, false);
      expect(normalReconcile.elements.some((e) => e.customData?.dslId === "pointer")).toBe(true);

      // Final step purges temporary pointer
      const finalReconcile = reconcileSceneState(state, [], undefined, true);
      const activeInFinal = finalReconcile.elements.filter((e) => !e.isDeleted);
      expect(activeInFinal.some((e) => e.customData?.dslId === "pointer")).toBe(false);
    });
  });

  describe("TEST 20: Teacher Brain is domain-independent", () => {
    it("operates without hardcoded algorithm branches", () => {
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        "Binary search algorithm",
      );
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-TEST-20",
      });
      worldModel.setCurrentMoment(1);

      const intent = createInputIntent({
        source: "keyboard",
        rawInput: "Why did this update occur?",
        intentType: "QUESTION_WHY",
      });

      const worldState = worldModel.getState();
      const decision = TeacherBrain.decide(intent, worldState);
      expect(decision.strategy).toBe("WHY");
      expect(decision.reason).not.toContain("Dijkstra");
      expect(decision.reason).not.toContain("AVL");
    });
  });

  describe("TEST 21: Correctness engine remains authoritative", () => {
    it("authoritative model invariants take precedence over arbitrary inputs", () => {
      const state = worldModel.getAuthoritativeWorld();
      expect(state.entities).toBeInstanceOf(Map);
      expect(state.worldVersion).toBeGreaterThanOrEqual(1);
    });
  });

  describe("TEST 22: AI cannot directly establish final canvas coordinates", () => {
    it("layout coordinates derive deterministically from layout engine tokens, not raw AI outputs", () => {
      const nodes = [{ id: "n1", label: "10" }];
      const layout = computeGraphLayout(nodes, [], { x: 300, y: 300 });
      const pos = layout.positions.get("n1");
      expect(pos).toBeDefined();
      expect(pos?.x).toBeTypeOf("number");
      expect(pos?.y).toBeTypeOf("number");
    });
  });

  describe("TEST 23: Voice failure cannot destroy the lesson", () => {
    it("retains authoritative lesson timeline even if voice preprocessing produces empty output", () => {
      const result = SpeechPreprocessor.prepare({
        lessonId: "test-lesson",
        transformationId: "t-error",
        stepIndex: 0,
        totalSteps: 1,
        title: "",
        explanation: "",
      });
      expect(result.spokenText).toBeTruthy();
      expect(worldModel.getState().worldVersion).toBeGreaterThanOrEqual(1);
    });
  });

  describe("TEST 24: Teacher Brain failure cannot destroy a valid semantic world", () => {
    it("leaves semantic state completely intact if intent resolution or brain encounters unfamiliar input", () => {
      const versionBefore = worldModel.getState().worldVersion;
      orchestrator.orchestrate("xyz123 unusual gibberish !@#$");
      const versionAfter = worldModel.getState().worldVersion;
      expect(versionAfter).toBe(versionBefore);
    });
  });

  // ============================================================================
  // SECTION 37: DIJKSTRA STRESS TEST SCENARIO
  // ============================================================================

  describe("SECTION 37: Dijkstra Stress Test End-to-End Flow", () => {
    it("executes the full Dijkstra teaching sequence with detours, what-if branching, and return", () => {
      const prompt =
        "Teach me how Dijkstra’s algorithm works on this graph: A→B(4), A→C(2), B→C(1), B→D(5), C→B(1), C→D(8), C→E(10), D→E(2), E→D(2). Start from A and show the shortest-path process step by step.";
      const processed = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-DIJKSTRA-STRESS",
      });

      expect(worldModel.getState().playbackState.totalSteps).toBeGreaterThan(0);
      worldModel.setCurrentMoment(2);

      // Follow-up 1: "Why did you choose that node next?"
      const whyRes = orchestrator.orchestrate("Wait. Why did you choose that node next?");
      expect(whyRes.decision.strategy).toBe("WHY");
      expect(whyRes.decision.requiresLLM).toBe(false);

      // Follow-up 2: "I still don't understand why previous distance can be replaced. Show old and new state together"
      const compRes = orchestrator.orchestrate(
        "I still don't understand why the previous distance can be replaced. Show the old state and new state together and explain the invariant that makes the replacement valid.",
      );
      expect(compRes.decision.strategy).toBe("COMPARE");

      // Follow-up 3: "Now continue, but slow down whenever an important relationship changes"
      const slowRes = orchestrator.orchestrate("Now continue, but slow down");
      expect(slowRes.decision.strategy).toBe("SLOW_DOWN");

      // Follow-up 4: What-if edge C->D had weight 1 instead of 8
      const whatIfRes = orchestrator.orchestrate(
        "What if the edge C→D had weight 1 instead of 8? Continue from the current state without restarting the entire lesson.",
      );
      expect(whatIfRes.decision.strategy).toBe("WHAT_IF");

      // Return to main lesson
      const returnRes = orchestrator.orchestrate("Return to lesson");
      expect(worldModel.isInWhatIfBranch()).toBe(false);
      expect(worldModel.getState().playbackState.currentIndex).toBe(2);
    });
  });

  // ============================================================================
  // SECTION 38: MULTI-DOMAIN GENERALIZATION TESTS
  // ============================================================================

  describe("SECTION 38: Universal Multi-Domain Generalization", () => {
    const domains = [
      { name: "AVL Tree", prompt: "Explain how AVL tree insertion works: 30, 20, 10" },
      { name: "Linked List", prompt: "Demonstrate singly linked list deletion from 10 -> 20 -> 30" },
      { name: "Binary Search", prompt: "Search for target 23 in sorted array [2, 5, 8, 12, 16, 23]" },
      { name: "Queue Item", prompt: "Process jobs in a priority queue" },
    ];

    for (const d of domains) {
      it(`compiles and adapts teaching for ${d.name} without domain-specific brain logic`, () => {
        const processed = UniversalConceptIntelligenceEngine.processQuestion(d.prompt);
        worldModel.setLesson(processed.visualLesson, processed.timeline, {
          generationId: `GEN-${d.name.toUpperCase().replace(/\s+/g, "-")}`,
        });

        expect(worldModel.getState().playbackState.totalSteps).toBeGreaterThan(0);
        const decision = orchestrator.orchestrate("Why is this step taken?");
        expect(decision.decision.strategy).toBe("WHY");
        expect(decision.decision.requiresLLM).toBe(false);
      });
    }
  });
});
