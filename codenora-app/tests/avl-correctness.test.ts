import { describe, it, expect } from "vitest";

import { OrderedOperationEngine } from "../ai/ordered-operation-engine";
import { extractOrderedOperations } from "../ai/question-understanding";
import { BranchManager } from "../ai/intelligence/branch-manager";

import type { CognoraWorldState } from "../ai/intelligence/cognora-world-model";

describe("AVL Tree Correctness and Invariant Verification", () => {
  const avlPrompt =
    "Teach me how an AVL tree maintains balance while inserting 50, 30, 70, 20, 40, 10, 25, 35, 45, and 5 in that exact order. Show each meaningful state change, explain why the tree changes, and pause before every rotation to explain what became unbalanced and why that specific rotation fixes it.";

  it("extracts ordered operations for all 10 insertions from the prompt", () => {
    const ops = extractOrderedOperations(avlPrompt);
    expect(ops.length).toBe(10);
    expect(ops.map((o) => o.value)).toEqual([
      50, 30, 70, 20, 40, 10, 25, 35, 45, 5,
    ]);
  });

  it("shouldSynthesize returns true for AVL prompts requiring rotation analysis", () => {
    const ops = extractOrderedOperations(avlPrompt);
    // Even if upstream provides some raw steps without rotations, shouldSynthesize must be true
    const shouldSynth = OrderedOperationEngine.shouldSynthesize(
      ops,
      [{ title: "Step 1" }],
      "AVL Tree",
      avlPrompt,
    );
    expect(shouldSynth).toBe(true);
  });

  it("synthesizes full progressive AVL steps with rotations and preserves AVL invariants", () => {
    const ops = extractOrderedOperations(avlPrompt);
    const steps = OrderedOperationEngine.synthesizeOrderedSteps(
      "AVL Tree",
      ops,
      [],
      avlPrompt,
    );

    expect(steps.length).toBeGreaterThan(10);

    // Verify presence of rotation diagnosis and equilibrium steps
    const diagnosisSteps = steps.filter((s) => s.role === "diagnosis");
    const equilibriumSteps = steps.filter((s) => s.role === "equilibrium");
    expect(diagnosisSteps.length).toBeGreaterThan(0);
    expect(equilibriumSteps.length).toBeGreaterThan(0);

    // Verify final step has all 10 nodes and correct root
    const finalStep = steps[steps.length - 1];
    const treeOp = finalStep.operations?.find(
      (op: any) => op.type === "create_tree",
    );
    expect(treeOp).toBeDefined();
    expect(treeOp.root).toBe("node-30"); // Root of AVL tree after these insertions is 30!
    expect(treeOp.nodes.length).toBe(10);

    const nodeValues = treeOp.nodes
      .map((n: any) => n.value)
      .sort((a: number, b: number) => a - b);
    expect(nodeValues).toEqual([5, 10, 20, 25, 30, 35, 40, 45, 50, 70]);

    // Verify all balance factors in the final step are between -1 and 1
    for (const node of treeOp.nodes) {
      if (node.balanceFactor !== undefined) {
        expect(Math.abs(node.balanceFactor)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("correctly resolves What-If edge weight changes in graphs", () => {
    const mockWorldState: CognoraWorldState = {
      worldVersion: 1,
      branchId: "MAIN",
      generationId: "GEN-1",
      activeBranch: null,
      branches: new Map(),
      detours: new Map(),
      activeDetour: null,
      studentState: {
        confusionSignals: 0,
        confusionSignal: 0,
        confidence: 0.8,
        pace: "normal",
        playbackSpeed: 1.0,
        preferredExplanationDepth: "standard",
        preferredGranularity: "normal",
        consecutiveFastForwards: 0,
        consecutiveReplays: 0,
        lastInteractionTime: Date.now(),
      },
      playback: {
        status: "READY",
        currentIndex: 0,
        totalSteps: 1,
        speed: 1.0,
      },
      timeline: {
        lessonId: "dijkstra-test",
        topic: "Dijkstra",
        states: [],
        meta: [],
        currentIndex: 0,
      },
      currentMoment: {
        id: "m-0",
        transformationId: "t-0",
        stepIndex: 0,
        totalSteps: 1,
        title: "Dijkstra Graph",
        visualState: {
          graph: {
            entities: new Map([
              [
                "node-C",
                {
                  id: "node-C",
                  primitiveType: "Node",
                  label: "C",
                  value: 2,
                  properties: {},
                },
              ],
              [
                "node-D",
                {
                  id: "node-D",
                  primitiveType: "Node",
                  label: "D",
                  value: 8,
                  properties: {},
                },
              ],
            ]),
            relationships: new Map([
              [
                "edge-C-D",
                {
                  id: "edge-C-D",
                  type: "directed",
                  sourceEntityId: "node-C",
                  targetEntityId: "node-D",
                  properties: { weight: 8, label: "8" },
                },
              ],
            ]),
            annotations: new Map(),
          },
        },
        affectedEntities: ["node-C", "node-D"],
        affectedRelationships: ["edge-C-D"],
        explanation: "Edge C to D has weight 8",
        narration: "Edge C to D has weight 8",
        importance: "NORMAL",
      },
      conversation: [],
    } as unknown as CognoraWorldState;

    const branch = BranchManager.createBranch(
      "What if the edge C→D had weight 1 instead of 8?",
      mockWorldState,
    );

    expect(branch).not.toBeNull();
    expect(branch!.branchMoments.length).toBeGreaterThan(0);
    const updatedRel =
      branch!.branchSceneState.graph.relationships.get("edge-C-D");
    expect(updatedRel).toBeDefined();
    expect(updatedRel!.properties?.weight).toBe(1);
  });
});
