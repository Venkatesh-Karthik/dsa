/**
 * Semantic State & Diff Engine Unit Tests
 */

import { describe, it, expect } from "vitest";

import { SemanticStateManager } from "../ai/semantic-state";
import { computeSemanticDiff } from "../ai/diff-engine";

import type { TeachingStep, VisualAction } from "../ai/visual-dsl";

describe("SemanticStateManager", () => {
  it("accumulates objects across steps without dropping previous structures", () => {
    const manager = new SemanticStateManager();

    const steps: TeachingStep[] = [
      {
        id: "step-0",
        title: "Create Array",
        explanation: "Initialize array with 5 elements.",
        visual_actions: [
          {
            type: "create_array",
            id: "arr-1",
            elements: [
              { value: 10 },
              { value: 20 },
              { value: 30 },
              { value: 40 },
              { value: 50 },
            ],
          },
        ],
      },
      {
        id: "step-1",
        title: "Place Pointer",
        explanation: "Set MID pointer to index 2.",
        visual_actions: [
          {
            type: "annotate_pointer",
            id: "ptr-mid",
            label: "MID",
            target: "arr-1-2",
            placement: "above",
          },
        ],
      },
      {
        id: "step-2",
        title: "Highlight Match",
        explanation: "Value 30 matches the target.",
        visual_actions: [
          {
            type: "highlight",
            target: "arr-1-2",
            color: "success",
          },
        ],
      },
    ];

    const result = manager.processSteps(steps);

    expect(result).toHaveLength(3);

    // Step 0 has array
    expect(result[0].cumulativeActions).toHaveLength(1);
    expect(result[0].cumulativeActions[0].type).toBe("create_array");

    // Step 1 has array + pointer
    expect(result[1].cumulativeActions).toHaveLength(2);
    expect(result[1].cumulativeActions[0].type).toBe("create_array");
    expect(result[1].cumulativeActions[1].type).toBe("annotate_pointer");

    // Step 2 has array + pointer + highlight
    expect(result[2].cumulativeActions).toHaveLength(3);
    const types = result[2].cumulativeActions.map((a) => a.type);
    expect(types).toContain("create_array");
    expect(types).toContain("annotate_pointer");
    expect(types).toContain("highlight");
  });

  it("updates existing object in-place when matching ID is re-emitted", () => {
    const manager = new SemanticStateManager();

    const steps: TeachingStep[] = [
      {
        id: "step-0",
        title: "BST with Root",
        explanation: "Root 20 inserted.",
        visual_actions: [
          {
            type: "create_tree",
            id: "tree-1",
            root: "node-20",
            nodes: [{ id: "node-20", value: 20 }],
          },
        ],
      },
      {
        id: "step-1",
        title: "Insert Left Child",
        explanation: "Insert 10 to the left of 20.",
        visual_actions: [
          {
            type: "create_tree",
            id: "tree-1",
            root: "node-20",
            nodes: [
              { id: "node-20", value: 20, left: "node-10" },
              { id: "node-10", value: 10 },
            ],
          },
        ],
      },
    ];

    const result = manager.processSteps(steps);

    expect(result).toHaveLength(2);
    expect(result[1].cumulativeActions).toHaveLength(1);
    const tree = result[1].cumulativeActions[0];
    expect(tree.type).toBe("create_tree");
    if (tree.type === "create_tree") {
      expect(tree.nodes).toHaveLength(2);
    }
  });

  it("cleans up cascading pointers and arrows when target is deleted", () => {
    const manager = new SemanticStateManager();

    const steps: TeachingStep[] = [
      {
        id: "step-0",
        title: "Create Box and Pointer",
        explanation: "Create node and point to it.",
        visual_actions: [
          {
            type: "create_box",
            id: "box-A",
            label: "Node A",
          },
          {
            type: "annotate_pointer",
            id: "ptr-A",
            label: "HEAD",
            target: "box-A",
            placement: "above",
          },
        ],
      },
      {
        id: "step-1",
        title: "Delete Node A",
        explanation: "Delete Node A.",
        visual_actions: [
          {
            type: "delete",
            target: "box-A",
          },
        ],
      },
    ];

    const result = manager.processSteps(steps);
    expect(result).toHaveLength(2);
    // After delete, both box-A and ptr-A pointing to box-A should be removed
    expect(result[1].cumulativeActions).toHaveLength(0);
  });

  it("deduplicates arrows with matching from and to endpoints", () => {
    const manager = new SemanticStateManager();

    const steps: TeachingStep[] = [
      {
        id: "step-0",
        title: "Create Initial Arrow",
        explanation: "Arrow from A to B.",
        visual_actions: [
          { type: "create_box", id: "box-A", label: "A" },
          { type: "create_box", id: "box-B", label: "B" },
          {
            type: "create_arrow",
            id: "arr-1",
            from: "box-A",
            to: "box-B",
            label: "weight 5",
          },
        ],
      },
      {
        id: "step-1",
        title: "Update Arrow Label",
        explanation: "Arrow updated with weight 8.",
        visual_actions: [
          {
            type: "create_arrow",
            id: "arr-2",
            from: "box-A",
            to: "box-B",
            label: "weight 8",
          },
        ],
      },
    ];

    const result = manager.processSteps(steps);
    const arrows = result[1].cumulativeActions.filter(
      (a) => a.type === "create_arrow",
    );
    expect(arrows).toHaveLength(1);
    expect(arrows[0].id).toBe("arr-2");
    if (arrows[0].type === "create_arrow") {
      expect(arrows[0].label).toBe("weight 8");
    }
  });
});

describe("computeSemanticDiff", () => {
  it("detects created and deleted objects between states", () => {
    const before: VisualAction[] = [
      { type: "create_box", id: "box-1", label: "Box 1" },
      { type: "create_box", id: "box-2", label: "Box 2" },
    ];

    const after: VisualAction[] = [
      { type: "create_box", id: "box-2", label: "Box 2" },
      { type: "create_box", id: "box-3", label: "Box 3" },
    ];

    const diff = computeSemanticDiff(before, after, 0, 1);

    expect(diff.created).toEqual(["box-3"]);
    expect(diff.deleted).toEqual(["box-1"]);
    expect(diff.updated).toHaveLength(0);
  });

  it("detects modified properties and active highlights", () => {
    const before: VisualAction[] = [
      { type: "create_box", id: "box-1", label: "Old Value" },
    ];

    const after: VisualAction[] = [
      { type: "create_box", id: "box-1", label: "New Value" },
      { type: "highlight", target: "box-1", color: "warning" },
    ];

    const diff = computeSemanticDiff(before, after, 0, 1);

    expect(diff.updated).toEqual(["box-1"]);
    expect(diff.highlighted).toEqual(["box-1"]);
  });
});
