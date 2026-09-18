/**
 * Transformation Validator & Semantic Fingerprinting Tests
 *
 * Verifies that:
 * 1. Semantic fingerprints are deterministic and independent of canvas coordinates.
 * 2. Semantic diffs detect real pedagogical changes.
 * 3. Adjacent identical states are rejected or repaired.
 * 4. Lessons with identical first and final states are rejected.
 * 5. Trees require a minimum meaningful depth of >= 2 levels (unless triviality is explicitly requested).
 * 6. Requested tree height (e.g. height 5) is enforced.
 * 7. AVL rotation transformations are validated structurally (root changes, pointers reconnect, IDs preserved).
 * 8. BFS traversal evolutions are verified (queue/visited evolution; first != final).
 */

import { describe, it, expect } from "vitest";

import {
  computeSemanticFingerprint,
  computeSemanticDiff,
  calculateTreeDepth,
  validateTreeComplexity,
  validateAVLRotation,
  validateBFSTraversal,
  validateTransformationTimeline,
} from "../ai/transformation-validator";
import { compileVisualLesson } from "../ai/transformation-timeline";
import { createSceneGraphFromActions } from "../ai/scene-state";
import { createSceneState } from "../ai/scene-state";

import type { VisualLesson } from "../ai/visual-dsl";

describe("Semantic Fingerprinting & Diffing", () => {
  it("produces identical fingerprints for identical semantic content regardless of spatial layout", () => {
    const actions = [
      {
        type: "create_box" as const,
        id: "box-1",
        label: "Server",
        role: "generic" as const,
        style: { color: "primary" as const },
      },
    ];

    const graphA = createSceneGraphFromActions(actions);
    const graphB = createSceneGraphFromActions(actions);

    const stateA = createSceneState(
      graphA,
      new Map([["box-1", { x: 100, y: 100 }]]),
    );
    const stateB = createSceneState(
      graphB,
      new Map([["box-1", { x: 999, y: 999 }]]),
    );

    const fpA = computeSemanticFingerprint(stateA);
    const fpB = computeSemanticFingerprint(stateB);

    expect(fpA).toBe(fpB);
  });

  it("produces different fingerprints when semantic properties, highlights, or values change", () => {
    const graphA = createSceneGraphFromActions([
      {
        type: "create_box" as const,
        id: "box-1",
        label: "Server",
        style: { color: "primary" as const },
      },
    ]);
    const graphB = createSceneGraphFromActions([
      {
        type: "create_box" as const,
        id: "box-1",
        label: "Server",
        style: { color: "success" as const },
      },
    ]);

    const stateA = createSceneState(graphA);
    const stateB = createSceneState(graphB);

    expect(computeSemanticFingerprint(stateA)).not.toBe(
      computeSemanticFingerprint(stateB),
    );

    const diff = computeSemanticDiff(stateA, stateB);
    expect(diff.hasChanges).toBe(true);
  });
});

describe("Tree Depth & Complexity Validation", () => {
  it("computes tree depth correctly across different structures", () => {
    // 3-level tree (depth 3)
    const treeGraph = createSceneGraphFromActions([
      {
        type: "create_tree" as const,
        id: "tree",
        root: "n30",
        nodes: [
          { id: "n30", value: 30, left: "n20" },
          { id: "n20", value: 20, left: "n10" },
          { id: "n10", value: 10 },
        ],
      },
    ]);

    const state = createSceneState(treeGraph);
    expect(calculateTreeDepth(treeGraph, "tree-n30")).toBe(3);
  });

  it("rejects tree lessons with fewer than 2 levels unless triviality is explicitly requested", () => {
    const singleNodeGraph = createSceneGraphFromActions([
      {
        type: "create_tree" as const,
        id: "tree",
        root: "n1",
        nodes: [{ id: "n1", value: 1 }],
      },
    ]);

    const singleNodeState = createSceneState(singleNodeGraph);

    // Default conceptual request should reject 1-node tree
    const res1 = validateTreeComplexity(
      singleNodeState,
      "Explain AVL tree rotation",
    );
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain(
      "minimum meaningful depth of at least 2 levels",
    );

    // Explicit trivial request should accept single node
    const res2 = validateTreeComplexity(
      singleNodeState,
      "Show a single node tree example",
    );
    expect(res2.valid).toBe(true);
  });

  it("verifies requested tree complexity (e.g. height 5)", () => {
    const treeGraphDepth3 = createSceneGraphFromActions([
      {
        type: "create_tree" as const,
        id: "tree",
        root: "n30",
        nodes: [
          { id: "n30", value: 30, left: "n20" },
          { id: "n20", value: 20, left: "n10" },
          { id: "n10", value: 10 },
        ],
      },
    ]);

    const state = createSceneState(treeGraphDepth3);

    const check = validateTreeComplexity(
      state,
      "Explain AVL rotation using a height-5 tree",
    );
    expect(check.valid).toBe(false);
    expect(check.error).toContain("height 5");
  });
});

describe("AVL Rotation Validation", () => {
  it("validates a correct right rotation where node 20 becomes root and parent-child pointers update", () => {
    const avlLesson: VisualLesson = {
      id: "avl-valid-rotation",
      title: "Explain an AVL right rotation",
      initialScene: [
        {
          type: "create_tree",
          id: "avl",
          root: "n30",
          nodes: [
            { id: "n30", value: 30, left: "n20" },
            { id: "n20", value: 20, left: "n10" },
            { id: "n10", value: 10 },
          ],
        },
      ],
      transformations: [
        {
          id: "t1",
          title: "Right Rotation",
          explanation: "Rotate right around 30. Pivot 20 becomes root.",
          operations: [
            {
              type: "create_tree",
              id: "avl",
              root: "n20",
              nodes: [
                { id: "n20", value: 20, left: "n10", right: "n30" },
                { id: "n10", value: 10 },
                { id: "n30", value: 30 },
              ],
            },
          ],
        },
      ],
    };

    const timeline = compileVisualLesson(avlLesson);
    const valResult = validateAVLRotation(
      timeline,
      "Explain an AVL right rotation",
    );
    expect(valResult.valid).toBe(true);

    const overall = validateTransformationTimeline(timeline, {
      prompt: "Explain an AVL right rotation",
    });
    expect(overall.valid).toBe(true);
  });

  it("catches an incomplete AVL rotation where the tree remained unrotated", () => {
    const fakeRotationLesson: VisualLesson = {
      id: "avl-fake-rotation",
      title: "Explain an AVL right rotation",
      initialScene: [
        {
          type: "create_tree",
          id: "avl",
          root: "n30",
          nodes: [
            { id: "n30", value: 30, left: "n20" },
            { id: "n20", value: 20, left: "n10" },
            { id: "n10", value: 10 },
          ],
        },
      ],
      transformations: [
        {
          id: "t1",
          title: "Right Rotation",
          explanation: "We claim rotation is done, but tree is unchanged.",
          operations: [
            // No structural change at all
            { type: "highlight", target: "avl-n30", color: "primary" },
          ],
        },
      ],
    };

    const timeline = compileVisualLesson(fakeRotationLesson);
    const valResult = validateAVLRotation(
      timeline,
      "Explain an AVL right rotation",
    );
    expect(valResult.valid).toBe(false);
    expect(valResult.error).toContain("rotation claimed, but root remained");
  });
});

describe("BFS Traversal Validation", () => {
  it("validates a progressive BFS lesson where queue, visited set, and node highlights evolve", () => {
    const bfsLesson: VisualLesson = {
      id: "bfs-valid",
      title: "Explain BFS traversal",
      initialScene: [
        {
          type: "create_graph",
          id: "g",
          nodes: [
            { id: "A", label: "A", highlight: "warning" },
            { id: "B", label: "B" },
            { id: "C", label: "C" },
          ],
          edges: [
            { from: "A", to: "B" },
            { from: "A", to: "C" },
          ],
        },
      ],
      transformations: [
        {
          id: "t1",
          title: "Visit A and Discover B, C",
          explanation: "A dequeued and marked visited. B and C enqueued.",
          operations: [
            { type: "highlight", target: "g-A", color: "success" },
            { type: "highlight", target: "g-B", color: "warning" },
            { type: "highlight", target: "g-C", color: "warning" },
          ],
        },
        {
          id: "t2",
          title: "Visit B and C (Completed Traversal)",
          explanation: "B and C visited. All nodes explored.",
          operations: [
            { type: "highlight", target: "g-B", color: "success" },
            { type: "highlight", target: "g-C", color: "success" },
          ],
        },
      ],
    };

    const timeline = compileVisualLesson(bfsLesson);
    const bfsRes = validateBFSTraversal(timeline);
    expect(bfsRes.valid).toBe(true);

    const overall = validateTransformationTimeline(timeline, {
      prompt: "Explain BFS traversal",
    });
    expect(overall.valid).toBe(true);
  });

  it("rejects BFS lessons where initial and final states are identical", () => {
    const brokenBFSLesson: VisualLesson = {
      id: "bfs-broken",
      title: "Explain BFS traversal",
      initialScene: [
        {
          type: "create_graph",
          id: "g",
          nodes: [
            { id: "A", label: "A" },
            { id: "B", label: "B" },
          ],
          edges: [{ from: "A", to: "B" }],
        },
      ],
      transformations: [
        {
          id: "t1",
          title: "Fake transformation with zero operations",
          explanation: "Nothing changes.",
          operations: [],
        },
      ],
    };

    const timeline = compileVisualLesson(brokenBFSLesson);
    const bfsRes = validateBFSTraversal(timeline);
    expect(bfsRes.valid).toBe(false);
    expect(bfsRes.error).toContain(
      "initial state and final state are identical",
    );
  });
});

describe("Timeline Monotonicity & Redundant State Auto-Repair", () => {
  it("auto-prunes redundant transformations where state does not change", () => {
    const redundantLesson: VisualLesson = {
      id: "redundant-lesson",
      title: "Array Search",
      initialScene: [
        {
          type: "create_array",
          id: "arr",
          elements: [{ value: 10 }, { value: 20 }, { value: 30 }],
        },
      ],
      transformations: [
        {
          id: "t1",
          title: "Empty redundant step",
          explanation: "This step does not change anything.",
          operations: [],
        },
        {
          id: "t2",
          title: "Meaningful step",
          explanation: "Highlight target.",
          operations: [
            { type: "highlight", target: "arr-1", color: "success" },
          ],
        },
      ],
    };

    const timeline = compileVisualLesson(redundantLesson);
    expect(timeline.states).toHaveLength(3);

    const validation = validateTransformationTimeline(timeline, {
      prompt: "Explain search in an array",
    });

    // Auto-repair should prune the redundant step t1
    expect(validation.repaired).toBe(true);
    expect(validation.timeline.states).toHaveLength(2); // State 0 and State 2
  });
});
