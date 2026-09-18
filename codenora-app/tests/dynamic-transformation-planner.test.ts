// @vitest-environment jsdom
import "vitest-canvas-mock";
import { describe, it, expect } from "vitest";

import {
  ConceptualJourneyOptimizer,
  type RawProposalStep,
} from "../ai/conceptual-journey-optimizer";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { reconcileSceneState } from "../ai/scene-reconciler";
import {
  createSceneState,
  createSceneGraphFromActions,
} from "../ai/scene-state";
import { ExplanationEngine } from "../ai/explanation-engine";
import { validateTransformationTimeline } from "../ai/transformation-validator";
import { createSemanticEntity } from "../ai/semantic-world";
import { TeachingEventGraph } from "../ai/teaching-event-graph";

describe("Cognora Dynamic Transformation Planner & Visual Intelligence Upgrade", () => {
  // ==========================================================================
  // Test 1: 9-Node AVL Insertion Test (Conservation & Rotations)
  // ==========================================================================
  describe("1. 9-Node AVL Tree Insertion & Entity Conservation", () => {
    it("preserves all 9 requested values across transitions and in terminal state", () => {
      const prompt =
        "Insert 9 elements into AVL tree: 30, 20, 10, 25, 28, 27, 50, 60, 55. Show balance factor checks and rebalancing rotations.";

      const avlValues = [30, 20, 10, 25, 28, 27, 50, 60, 55];

      // Simulated progressive steps representing the AVL construction
      const rawSteps: RawProposalStep[] = [
        {
          title: "Initial root: 30",
          explanation: "Root node 30 is established as the baseline tree.",
          operations: [{ type: "create_circle", id: "n30", value: 30 }],
        },
        {
          title: "Insert 20 and 10 causing Left-Left Imbalance at 30",
          explanation:
            "Left-left chain formed: 30 -> 20 -> 10. Balance factor of 30 is +2.",
          role: "diagnosis",
          operations: [
            { type: "create_circle", id: "n20", value: 20 },
            {
              type: "connect",
              source: "n30",
              target: "n20",
              relationType: "left",
            },
            { type: "create_circle", id: "n10", value: 10 },
            {
              type: "connect",
              source: "n20",
              target: "n10",
              relationType: "left",
            },
            { type: "highlight", target: "n30", state: "warning" },
          ],
        },
        {
          title: "Right Rotation at 30 with pivot 20",
          explanation:
            "Node 20 ascends to become the subtree root. 30 descends as right child of 20.",
          role: "mechanism",
          operations: [
            { type: "disconnect", source: "n30", target: "n20" },
            {
              type: "connect",
              source: "n20",
              target: "n30",
              relationType: "right",
            },
            { type: "unhighlight", target: "n30" },
          ],
        },
        {
          title: "Insert 25, 28, 27 with Double Rotation",
          explanation:
            "Nodes 25, 28, 27 inserted. Imbalance detected and resolved via rotation.",
          role: "mechanism",
          operations: [
            { type: "create_circle", id: "n25", value: 25 },
            { type: "create_circle", id: "n28", value: 28 },
            { type: "create_circle", id: "n27", value: 27 },
            {
              type: "connect",
              source: "n30",
              target: "n28",
              relationType: "left",
            },
            {
              type: "connect",
              source: "n28",
              target: "n27",
              relationType: "left",
            },
            {
              type: "connect",
              source: "n27",
              target: "n25",
              relationType: "left",
            },
          ],
        },
        {
          title: "Insert 50, 60, 55 into Right Subtree",
          explanation:
            "Nodes 50, 60, 55 inserted. Right-left rotation restores balance.",
          role: "mechanism",
          operations: [
            { type: "create_circle", id: "n50", value: 50 },
            { type: "create_circle", id: "n60", value: 60 },
            { type: "create_circle", id: "n55", value: 55 },
            {
              type: "connect",
              source: "n30",
              target: "n55",
              relationType: "right",
            },
            {
              type: "connect",
              source: "n55",
              target: "n50",
              relationType: "left",
            },
            {
              type: "connect",
              source: "n55",
              target: "n60",
              relationType: "right",
            },
          ],
        },
        {
          title: "Final Verified AVL Tree",
          explanation:
            "All 9 nodes are positioned in balanced equilibrium. Invariants verified.",
          role: "proof",
          operations: [{ type: "highlight", target: "n20", color: "success" }],
        },
      ];

      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          topic: "AVL Tree 9-Node Insertion",
          steps: rawSteps as any,
        },
      );

      // Verify the final model
      expect(result.authoritativeModel).toBeDefined();
      const finalState =
        result.timeline.states[result.timeline.states.length - 1];

      // Extract all values present in the final state
      const finalValues = Array.from(finalState.graph.entities.values()).map(
        (ent) => Number(ent.value ?? ent.label),
      );

      // Verify strict conservation: every single one of the 9 requested values exists!
      for (const val of avlValues) {
        expect(finalValues).toContain(val);
      }
      expect(finalValues.length).toBeGreaterThanOrEqual(9);

      // Verify non-empty, progressive timeline
      expect(result.timeline.states.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ==========================================================================
  // Test 2: Linked List Insertion & Stale Connector Cleanup
  // ==========================================================================
  describe("2. Linked List Insertion & Connector Lifecycle Verification", () => {
    it("deletes stale edge 10->40 when inserting 25, creating 10->25 and 25->40 with zero ghost arrows", () => {
      // State 0: 10 -> 40 -> 60
      const initialActions = [
        { type: "create_box" as const, id: "node-10", label: "10" },
        { type: "create_box" as const, id: "node-40", label: "40" },
        { type: "create_box" as const, id: "node-60", label: "60" },
        {
          type: "create_arrow" as const,
          id: "edge-10-40",
          from: "node-10",
          to: "node-40",
        },
        {
          type: "create_arrow" as const,
          id: "edge-40-60",
          from: "node-40",
          to: "node-60",
        },
      ];

      const graph0 = createSceneGraphFromActions(initialActions);
      const state0 = createSceneState(
        graph0,
        new Map([
          ["node-10", { x: 100, y: 100 }],
          ["node-40", { x: 300, y: 100 }],
          ["node-60", { x: 500, y: 100 }],
        ]),
      );

      // Initial reconcile to create canvas elements
      const initialReconcile = reconcileSceneState(state0, [], "ll-lesson");
      const canvasElementsState0 = initialReconcile.elements;

      // Verify initial arrow 10->40 exists and is active
      const arrow10to40Initial = canvasElementsState0.find(
        (el) => el.type === "arrow" && el.customData?.dslId === "edge-10-40",
      );
      expect(arrow10to40Initial).toBeDefined();
      expect(arrow10to40Initial?.isDeleted).toBeFalsy();

      // State 1: Insert 25 between 10 and 40
      // Redirection: 10 -> 25 -> 40 -> 60
      const nextActions = [
        { type: "create_box" as const, id: "node-10", label: "10" },
        { type: "create_box" as const, id: "node-25", label: "25" },
        { type: "create_box" as const, id: "node-40", label: "40" },
        { type: "create_box" as const, id: "node-60", label: "60" },
        {
          type: "create_arrow" as const,
          id: "edge-10-25",
          from: "node-10",
          to: "node-25",
        },
        {
          type: "create_arrow" as const,
          id: "edge-25-40",
          from: "node-25",
          to: "node-40",
        },
        {
          type: "create_arrow" as const,
          id: "edge-40-60",
          from: "node-40",
          to: "node-60",
        },
      ];

      const graph1 = createSceneGraphFromActions(nextActions);
      const state1 = createSceneState(
        graph1,
        new Map([
          ["node-10", { x: 100, y: 100 }],
          ["node-25", { x: 250, y: 100 }],
          ["node-40", { x: 400, y: 100 }],
          ["node-60", { x: 550, y: 100 }],
        ]),
      );

      // Reconcile State 1 against State 0 elements
      const updatedReconcile = reconcileSceneState(
        state1,
        canvasElementsState0,
        "ll-lesson",
      );
      const canvasElementsState1 = updatedReconcile.elements;

      // 1. Verify that stale arrow edge-10-40 is explicitly marked isDeleted: true!
      const deletedArrow10to40 = canvasElementsState1.find(
        (el) => el.type === "arrow" && el.customData?.dslId === "edge-10-40",
      );
      expect(deletedArrow10to40).toBeDefined();
      expect(deletedArrow10to40?.isDeleted).toBe(true);

      // 2. Verify new connectors 10->25 and 25->40 are active with valid bindings
      const newArrow10to25 = canvasElementsState1.find(
        (el) => el.type === "arrow" && el.customData?.dslId === "edge-10-25",
      );
      const newArrow25to40 = canvasElementsState1.find(
        (el) => el.type === "arrow" && el.customData?.dslId === "edge-25-40",
      );
      expect(newArrow10to25).toBeDefined();
      expect(newArrow10to25?.isDeleted).toBeFalsy();
      expect((newArrow10to25 as any).startBinding).toBeDefined();
      expect((newArrow10to25 as any).endBinding).toBeDefined();

      expect(newArrow25to40).toBeDefined();
      expect(newArrow25to40?.isDeleted).toBeFalsy();
      expect((newArrow25to40 as any).startBinding).toBeDefined();
      expect((newArrow25to40 as any).endBinding).toBeDefined();

      // 3. Count active arrows: exactly 3 active arrows (10->25, 25->40, 40->60)
      const activeArrows = canvasElementsState1.filter(
        (el) => el.type === "arrow" && !el.isDeleted,
      );
      expect(activeArrows.length).toBe(3);
    });
  });

  // ==========================================================================
  // Test 3: Dynamic Transformation Count (No Hardcoded Limits)
  // ==========================================================================
  describe("3. Dynamic Transformation Count", () => {
    it("dynamically generates concise steps for simple queries without arbitrary padding", () => {
      const simpleMilestones = ConceptualJourneyOptimizer.optimize({
        concept: "Stack Push Operation",
        rawSteps: [
          {
            title: "Allocate Element",
            explanation: "Create new element 42.",
            operations: [{ type: "create_box", id: "elem-42", value: 42 }],
          },
          {
            title: "Push onto Stack",
            explanation: "Place element 42 at the top of the stack.",
            role: "proof",
            operations: [{ type: "update", target: "elem-42", state: "top" }],
          },
        ],
      });

      // Simple concepts must NOT be artificially padded to 5 or 6 steps
      expect(simpleMilestones.length).toBeLessThanOrEqual(3);
      expect(simpleMilestones.length).toBeGreaterThanOrEqual(1);
    });

    it("dynamically preserves extensive sequence for complex algorithmic queries", () => {
      const complexRawSteps: RawProposalStep[] = Array.from(
        { length: 10 },
        (_, i) => ({
          title: `Algorithmic State ${i + 1}`,
          explanation: `System performs distinct transformation stage ${i + 1}`,
          role: i === 0 ? "setup" : i === 9 ? "proof" : "mechanism",
          operations: [
            {
              type: "update_entity",
              entityId: `node-${i + 1}`,
              value: (i + 1) * 10,
            },
          ],
        }),
      );

      const complexMilestones = ConceptualJourneyOptimizer.optimize({
        concept: "Multi-Stage Distributed Byzantine Consensus",
        rawSteps: complexRawSteps,
      });

      // Complex concepts with distinct entities must NOT be arbitrarily compressed to a fixed clamp
      expect(complexMilestones.length).toBeGreaterThanOrEqual(7);
    });
  });

  // ==========================================================================
  // Test 4: Zero Metadata Leakage Across Explanations and Titles
  // ==========================================================================
  describe("4. Zero Metadata Leakage", () => {
    it("rigorously scrubs all implementation IDs and machine tokens", () => {
      const dirtyTexts = [
        "Introducing t2-op0: Allocating memory for node-30.",
        "Step 4: merge-array-element-5 is compared with merge-array-element-6.",
        "Updating focusComponent to active state in dll-e1.",
        "Component Client transmits request to Component Server.",
        "Connecting node-10 to node-20 via t1-op3.",
      ];

      for (const dirty of dirtyTexts) {
        const clean = ExplanationEngine.scrubMetadata(dirty);

        expect(clean).not.toMatch(/\bt\d+[-_]op\d+\b/i);
        expect(clean).not.toMatch(/\bnode-\d+\b/i);
        expect(clean).not.toMatch(/\bmerge-array-element-\d+\b/i);
        expect(clean).not.toMatch(/\bfocusComponent\b/i);
        expect(clean).not.toMatch(/\bComponent\s+\w+/i);
      }
    });

    it("formats a rich 4-7 line structured explanation answering WHAT, WHY, WHAT CHANGED, WHAT TO NOTICE, WHAT HAPPENS NEXT", () => {
      const explanation = ExplanationEngine.deriveExplanation({
        id: "trans-1",
        stepNumber: 1,
        title: "AVL Tree Right Rotation",
        action: "Rotate right around pivot 20",
        explanation:
          "Promote node 20 to subtree root to restore balance factor invariant.",
        whyChanged:
          "Left subtree height exceeded right subtree height by 2 (|BF| > 1).",
        cause: "Left-left imbalance diagnosed at node 30.",
        consequence: "Subtree balance factor restored to 0.",
        learnerObservation:
          "Notice how node 20 becomes the new parent of node 30.",
        whatChanged:
          "Pointers updated: 20 becomes root, 30 becomes right child.",
      } as any);

      const formatted =
        ExplanationEngine.formatMultiLineExplanation(explanation);
      const lines = formatted.split("\n");

      // Verify 4-7 lines
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines.length).toBeLessThanOrEqual(7);

      expect(formatted).toContain("WHAT:");
      expect(formatted).toContain("WHY:");
      expect(formatted).toContain("WHAT CHANGED:");
      expect(formatted).toContain("WHAT TO NOTICE:");
      expect(formatted).toContain("WHAT HAPPENS NEXT:");
    });
  });

  // ==========================================================================
  // Test 5: Executable Entity Conservation Across Transitions
  // ==========================================================================
  describe("5. Executable Entity Conservation Verification", () => {
    it("auto-repairs and preserves entities if an intermediate step omits them without explicit deletion", () => {
      const entity10 = createSemanticEntity(
        "n10",
        "TreeNode",
        "10",
        {},
        { value: 10 },
      );
      const entity20 = createSemanticEntity(
        "n20",
        "TreeNode",
        "20",
        {},
        { value: 20 },
      );
      const entity30 = createSemanticEntity(
        "n30",
        "TreeNode",
        "30",
        {},
        { value: 30 },
      );

      // State 0: 10, 20, 30
      const actions0 = [
        { type: "create_circle" as const, id: "n10", label: "10", value: 10 },
        { type: "create_circle" as const, id: "n20", label: "20", value: 20 },
        { type: "create_circle" as const, id: "n30", label: "30", value: 30 },
      ];
      // State 1: Flawed AI omitted n10 without an explicit delete operation!
      const actions1 = [
        { type: "create_circle" as const, id: "n20", label: "20", value: 20 },
        { type: "create_circle" as const, id: "n30", label: "30", value: 30 },
      ];

      const graph0 = createSceneGraphFromActions(actions0);
      const graph1 = createSceneGraphFromActions(actions1);

      const timeline = {
        lessonId: "test-conservation",
        topic: "Entity Conservation Test",
        states: [createSceneState(graph0), createSceneState(graph1)],
        meta: [
          { id: "s0", title: "Initial", explanation: "All 3 nodes exist" },
          {
            id: "s1",
            title: "Flawed Transition",
            explanation: "Dropped n10 accidentally",
          },
        ],
        currentIndex: 0,
      };

      const validated = validateTransformationTimeline(timeline);

      // Verify that n10 was auto-restored in state 1!
      expect(validated.timeline.states[1].graph.entities.has("n10")).toBe(true);
      expect(validated.repaired).toBe(true);
    });
  });

  // ==========================================================================
  // Test 6: Dijkstra Shortest Path & Supporting Table State
  // ==========================================================================
  describe("6. Dijkstra Shortest Path & Supporting State Table", () => {
    it("generates progressive relaxation steps and updates supporting distance table without collapsing to 2 states", () => {
      const prompt =
        "Trace Dijkstra shortest path algorithm on graph with vertices A, B, C, D, E from start vertex A. Show edge relaxations and distance table updates.";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      // Verify model and states exist
      expect(result.authoritativeModel).toBeDefined();
      expect(result.timeline.states.length).toBeGreaterThanOrEqual(4);

      // Verify supporting distance table entity exists in scene
      const finalState =
        result.timeline.states[result.timeline.states.length - 1];
      const hasTable = Array.from(finalState.graph.entities.values()).some(
        (ent) =>
          ent.id.includes("table") ||
          ent.semanticRole === "table" ||
          ent.primitiveType === "table" ||
          ent.primitiveType === "TablePrimitive",
      );
      expect(hasTable).toBe(true);

      // Verify diagnostics
      expect(result.authoritativeModel.diagnostics).toBeDefined();
      expect(
        result.authoritativeModel.diagnostics!.essentialEventsCovered,
      ).toBeGreaterThanOrEqual(80);
    });
  });

  // ==========================================================================
  // Test 7: Quick Sort Lomuto 15-Element Partitioning
  // ==========================================================================
  describe("7. Quick Sort Lomuto 15-Element Partitioning", () => {
    it("generates 10+ transformations showing pivot, comparisons, pointer movements, and swaps", () => {
      const prompt =
        "Demonstrate Quick Sort Lomuto partitioning on [38, 27, 43, 3, 9, 82, 10, 19, 50, 61, 72, 15, 4, 33, 8] with pivot, i and j pointers.";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(result.authoritativeModel).toBeDefined();
      // For 15 elements, Lomuto partitioning must generate at least 10 discrete transformations
      expect(
        result.authoritativeModel.transformations.length,
      ).toBeGreaterThanOrEqual(10);
      expect(result.timeline.states.length).toBeGreaterThanOrEqual(10);

      // Verify all 15 elements are preserved across the partition
      const finalState =
        result.timeline.states[result.timeline.states.length - 1];
      const finalValues = Array.from(finalState.graph.entities.values()).map(
        (ent) => Number(ent.value ?? ent.label),
      );
      const originalValues = [
        38, 27, 43, 3, 9, 82, 10, 19, 50, 61, 72, 15, 4, 33, 8,
      ];
      for (const val of originalValues) {
        expect(finalValues).toContain(val);
      }
    });
  });

  // ==========================================================================
  // Test 8: BST Ordered Operations (15 Inserts + 3 Deletes in Sequence)
  // ==========================================================================
  describe("8. BST Ordered Operations (15 Inserts then 3 Deletions in Sequence)", () => {
    it("executes 15 inserts followed by 3 deletions in exact chronological order", () => {
      const prompt =
        "Insert 50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45, 65, 75, 85, 90 into BST, then delete 20, 70, 50 in order.";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(result.authoritativeModel).toBeDefined();
      // Must generate discrete progressive operations
      expect(result.timeline.states.length).toBeGreaterThanOrEqual(10);

      // Verify that the final state contains exactly the 12 remaining elements,
      // and that the 3 deleted elements (20, 70, 50) are no longer present
      const finalState =
        result.timeline.states[result.timeline.states.length - 1];
      const finalValues = Array.from(finalState.graph.entities.values()).map(
        (ent) => Number(ent.value ?? ent.label),
      );

      expect(finalValues).not.toContain(20);
      expect(finalValues).not.toContain(70);
      expect(finalValues).not.toContain(50);

      const remaining = [30, 40, 60, 80, 10, 25, 35, 45, 65, 75, 85, 90];
      for (const rem of remaining) {
        expect(finalValues).toContain(rem);
      }
    });
  });

  // ==========================================================================
  // Test 9: Baseline Initial State & Zero Premature Leakage
  // ==========================================================================
  describe("9. Baseline Initial State & Zero Premature Leakage", () => {
    it("starts genuinely empty at State 0 when inserting elements from scratch", () => {
      const prompt =
        "Insert 30, 20, 10, 25, 28, 27, 50, 60, 55 into AVL tree step by step.";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      // State 0 MUST be empty: 0 entities rendered prematurely!
      const state0 = result.timeline.states[0];
      expect(state0.graph.entities.size).toBe(0);

      // State 1 has 1 entity (node 30)
      const state1 = result.timeline.states[1];
      expect(state1.graph.entities.size).toBe(1);
    });
  });

  // ==========================================================================
  // Test 10: Teaching Event Graph & Essential Event Coverage
  // ==========================================================================
  describe("10. Teaching Event Graph & Essential Event Coverage", () => {
    it("tracks fine-grained events, dependencies, and verifies essential event coverage", () => {
      const graph = new TeachingEventGraph();

      graph.addEvent({
        id: "evt-cmp-1",
        type: "comparison",
        value: 30,
        importance: "supportive",
        cause: "Compare 20 with 30",
        order: 1,
        dependencies: [],
      });

      graph.addEvent({
        id: "evt-ins-1",
        type: "insert",
        entityId: "node-20",
        value: 20,
        importance: "essential",
        cause: "Insert node 20 into left subtree",
        order: 2,
        dependencies: ["evt-cmp-1"],
      });

      graph.addEvent({
        id: "evt-rot-1",
        type: "rotation",
        entityId: "node-30",
        targetEntityId: "node-20",
        importance: "essential",
        cause: "Right rotation to restore balance",
        order: 3,
        dependencies: ["evt-ins-1"],
      });

      expect(graph.getAllEvents().length).toBe(3);
      expect(graph.getEssentialEvents().length).toBe(2);
      expect(graph.getDependents("evt-ins-1").map((e) => e.id)).toContain(
        "evt-rot-1",
      );

      const milestones = [
        {
          id: "m1",
          title: "Insert Node 20",
          explanation: "Node 20 is inserted as the left child of 30.",
          affectedEntities: ["node-20"],
          action: "Insert node 20",
          importance: "primary" as const,
        },
        {
          id: "m2",
          title: "Right Rotation at Node 30",
          explanation: "Right rotation around pivot 20 restores balance.",
          affectedEntities: ["node-30", "node-20"],
          action: "Rotate right",
          importance: "primary" as const,
        },
      ];

      const report = graph.evaluateCoverage(milestones as any);
      expect(report.isFullyCovered).toBe(true);
      expect(report.coveragePercentage).toBe(100);
      expect(report.missingEventIds.length).toBe(0);
    });
  });

  // ==========================================================================
  // Test 11: Multi-Operation Min-Heap Insertion & Removal (End-to-End Visual Intelligence)
  // ==========================================================================
  describe("11. Multi-Operation Min-Heap Insertion and Extraction", () => {
    it("synthesizes all 9 insertions and 3 removals from the user prompt into valid Visual DSL", () => {
      const prompt =
        "10, 15, 30, 5, 25, 40, 8, 12, 3 After all insertions, remove the minimum element three times. Show the important transformations from the empty heap through all insertions and removals. Make the current element, parent-child comparisons, swaps, heap-property violations, and restored heap states visually understandable. Explain why each important transformation happens and how the heap changes as a result.";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(result.visualLesson).toBeDefined();
      expect(result.visualLesson.transformations.length).toBeGreaterThanOrEqual(
        12,
      );

      // Verify that operations include both insertions and extractions/removals
      const explanations = result.visualLesson.transformations.map(
        (t) => `${t.title} ${t.explanation}`,
      );
      const hasInsertions = explanations.some((e) => /insert/i.test(e));
      const hasRemovals = explanations.some((e) => /extract|remove/i.test(e));
      const hasViolationsOrSwaps = explanations.some((e) =>
        /swap|bubble|violate/i.test(e),
      );

      expect(hasInsertions).toBe(true);
      expect(hasRemovals).toBe(true);
      expect(hasViolationsOrSwaps).toBe(true);

      // Verify that all actions conform to Visual DSL
      const allActions = [
        ...result.visualLesson.initialScene,
        ...result.visualLesson.transformations.flatMap(
          (t) => t.operations || [],
        ),
      ];
      expect(allActions.length).toBeGreaterThan(0);
      for (const act of allActions) {
        expect(act.type).toBeDefined();
      }
    });
  });
});
