import { describe, it, expect } from "vitest";

import {
  parseCommand,
  parseGraphEdges,
  parseMatrixRows,
  findCommand,
  getAutocompleteSuggestions,
  executeCommand,
  computeCanvasPlacement,
} from "../ai/commands";
import { renderActions } from "../ai/visual-renderer";
import { validateActionReferences } from "../ai/backend/dsl-validator";

describe("Cognora DSA Command Parser", () => {
  it("parses array with size only", () => {
    const args = parseCommand("/array(10)");
    expect(args.commandName).toBe("array");
    expect(args.isSizeOnly).toBe(true);
    expect(args.numericArgs).toEqual([10]);
  });

  it("parses array with specific elements", () => {
    const args = parseCommand("/array(1, 2, 3, 4, 5)");
    expect(args.commandName).toBe("array");
    expect(args.isSizeOnly).toBe(false);
    expect(args.numericArgs).toEqual([1, 2, 3, 4, 5]);
  });

  it("parses linked-list and alias /ll", () => {
    const args1 = parseCommand("/linked-list(10, 20, 30)");
    expect(args1.commandName).toBe("linked-list");
    expect(args1.numericArgs).toEqual([10, 20, 30]);

    const args2 = parseCommand("/ll(5, 15, 25)");
    expect(args2.commandName).toBe("ll");
    expect(args2.numericArgs).toEqual([5, 15, 25]);
  });

  it("parses stack and queue", () => {
    const stackArgs = parseCommand("/stack(1, 2, 3)");
    expect(stackArgs.commandName).toBe("stack");
    expect(stackArgs.numericArgs).toEqual([1, 2, 3]);

    const queueArgs = parseCommand("/queue(10, 20, 30)");
    expect(queueArgs.commandName).toBe("queue");
    expect(queueArgs.numericArgs).toEqual([10, 20, 30]);
  });

  it("parses binary tree and alias /bst", () => {
    const args = parseCommand("/bst(10, 5, 15, 3, 7)");
    expect(args.commandName).toBe("bst");
    expect(args.numericArgs).toEqual([10, 5, 15, 3, 7]);
  });

  it("parses heap", () => {
    const args = parseCommand("/heap(20, 15, 18, 10, 12)");
    expect(args.commandName).toBe("heap");
    expect(args.numericArgs).toEqual([20, 15, 18, 10, 12]);
  });

  it("parses undirected and directed graph edges", () => {
    const edges1 = parseGraphEdges("A-B, B-C, C-A");
    expect(edges1).toEqual([
      { from: "A", to: "B", weight: undefined, directed: false },
      { from: "B", to: "C", weight: undefined, directed: false },
      { from: "C", to: "A", weight: undefined, directed: false },
    ]);

    const edges2 = parseGraphEdges("A->B, B->C, C->A");
    expect(edges2).toEqual([
      { from: "A", to: "B", weight: undefined, directed: true },
      { from: "B", to: "C", weight: undefined, directed: true },
      { from: "C", to: "A", weight: undefined, directed: true },
    ]);
  });

  it("parses weighted graph edges", () => {
    const edges = parseGraphEdges("A-B:5, B-C:10, C-A:15");
    expect(edges[0]).toEqual({
      from: "A",
      to: "B",
      weight: 5,
      directed: false,
    });
    expect(edges[1]).toEqual({
      from: "B",
      to: "C",
      weight: 10,
      directed: false,
    });
    expect(edges[2]).toEqual({
      from: "C",
      to: "A",
      weight: 15,
      directed: false,
    });
  });

  it("parses matrix dimensions and semicolon rows", () => {
    const rows = parseMatrixRows("1,2,3;4,5,6;7,8,9");
    expect(rows).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  it("supports space-separated syntax without parens", () => {
    const args = parseCommand("/array 10, 20, 30");
    expect(args.commandName).toBe("array");
    expect(args.numericArgs).toEqual([10, 20, 30]);
  });
});

describe("Cognora DSA Command Registry & Autocomplete", () => {
  it("resolves built-in commands and aliases", () => {
    expect(findCommand("array")?.name).toBe("array");
    expect(findCommand("arr")?.name).toBe("array");
    expect(findCommand("ll")?.name).toBe("linked-list");
    expect(findCommand("bst")?.name).toBe("binary-tree");
    expect(findCommand("dag")?.name).toBe("graph");
    expect(findCommand("grid")?.name).toBe("matrix");
  });

  it("returns suggestions for partial slash inputs", () => {
    const all = getAutocompleteSuggestions("/");
    expect(all.length).toBeGreaterThanOrEqual(8);

    const arr = getAutocompleteSuggestions("/arr");
    expect(arr.some((s) => s.name === "array")).toBe(true);

    const tree = getAutocompleteSuggestions("/tr");
    expect(tree.some((s) => s.name === "binary-tree")).toBe(true);
  });
});

describe("Cognora DSA Command Execution Pipeline", () => {
  it("executes /array and renders into Excalidraw elements", () => {
    const res = executeCommand("/array(1, 2, 3, 4)");
    expect(res.success).toBe(true);
    expect(res.actions.length).toBe(1);
    expect(res.actions[0].type).toBe("create_array");

    const valid = validateActionReferences(res.actions);
    expect(valid.valid).toBe(true);

    const renderRes = renderActions(res.actions);
    expect(renderRes.errors).toHaveLength(0);
    expect(renderRes.elements.length).toBeGreaterThan(0);
  });

  it("executes /linked-list and renders bound connectors and NULL node", () => {
    const res = executeCommand("/linked-list(10, 20, 30)");
    expect(res.success).toBe(true);
    expect(res.actions[0].type).toBe("create_linked_list");

    const renderRes = renderActions(res.actions);
    expect(renderRes.errors).toHaveLength(0);

    // Look for arrows and null node
    const arrows = renderRes.elements.filter(
      (el) => el.type === "arrow",
    ) as any[];
    expect(arrows.length).toBe(3); // 2 between nodes + 1 to NULL
    expect(arrows[0].startBinding).toBeDefined();
    expect(arrows[0].endBinding).toBeDefined();
  });

  it("executes /binary-tree and renders BST with bound hierarchy connectors", () => {
    const res = executeCommand("/bst(10, 5, 15)");
    expect(res.success).toBe(true);
    expect(res.actions[0].type).toBe("create_tree");

    const renderRes = renderActions(res.actions);
    expect(renderRes.errors).toHaveLength(0);

    const arrows = renderRes.elements.filter(
      (el) => el.type === "arrow",
    ) as any[];
    expect(arrows.length).toBe(2); // 10->5 and 10->15
    for (const arrow of arrows) {
      expect(arrow.startBinding).toBeDefined();
      expect(arrow.endBinding).toBeDefined();
    }
  });

  it("executes /graph and renders bound relationship connectors", () => {
    const res = executeCommand("/graph(A-B, B-C, C-A)");
    expect(res.success).toBe(true);
    expect(res.actions[0].type).toBe("create_graph");

    const renderRes = renderActions(res.actions);
    expect(renderRes.errors).toHaveLength(0);

    const arrows = renderRes.elements.filter(
      (el) => el.type === "arrow",
    ) as any[];
    expect(arrows.length).toBe(3);
    for (const arrow of arrows) {
      expect(arrow.startBinding).toBeDefined();
      expect(arrow.endBinding).toBeDefined();
    }
  });

  it("executes /matrix and renders grid cells", () => {
    const res = executeCommand("/matrix(2, 3)");
    expect(res.success).toBe(true);
    expect(res.actions[0].type).toBe("create_matrix");

    const renderRes = renderActions(res.actions);
    expect(renderRes.errors).toHaveLength(0);
    expect(renderRes.elements.length).toBeGreaterThan(0);
  });

  it("computes non-overlapping placement offset when canvas has elements", () => {
    const mockElements: any[] = [
      { id: "e1", x: 100, y: 100, width: 200, height: 150, isDeleted: false },
    ];
    const placement = computeCanvasPlacement(mockElements);
    expect(placement.y).toBe(100 + 150 + 80); // bottom + margin
  });
});
