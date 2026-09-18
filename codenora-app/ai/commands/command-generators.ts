/**
 * Cognora DSA Command System - Generators
 *
 * Deterministically constructs VisualAction DSL payloads from parsed command arguments.
 */

import type {
  VisualAction,
  CreateArrayAction,
  CreateLinkedListAction,
  CreateStackAction,
  CreateQueueAction,
  CreateTreeAction,
  CreateGraphAction,
  CreateMatrixAction,
} from "../visual-dsl";
import type { CommandArgs, CommandExecutionContext } from "./command-types";

/**
 * Generates an Array structure.
 * Syntax: /array(10) or /array(1,2,3,4,5)
 */
export function generateArray(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const arrId = context.nextId("arr");
  let values: (number | string)[];

  if (args.isSizeOnly && args.numericArgs.length === 1) {
    const size = Math.min(Math.max(args.numericArgs[0], 1), 20);
    values = Array.from({ length: size }, (_, i) => i);
  } else if (args.numericArgs.length > 0) {
    values = args.numericArgs;
  } else if (args.stringArgs.length > 0) {
    values = args.stringArgs;
  } else {
    values = [10, 20, 30, 40, 50];
  }

  const action: CreateArrayAction = {
    type: "create_array",
    id: arrId,
    elements: values.map((v) => ({ value: v })),
    label: `Array (n = ${values.length})`,
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}

/**
 * Generates a Linked List structure.
 * Syntax: /linked-list(10,20,30) or /ll(1,2,3)
 */
export function generateLinkedList(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const listId = context.nextId("ll");
  let values: (number | string)[];

  if (args.isSizeOnly && args.numericArgs.length === 1) {
    const size = Math.min(Math.max(args.numericArgs[0], 1), 15);
    values = Array.from({ length: size }, (_, i) => (i + 1) * 10);
  } else if (args.numericArgs.length > 0) {
    values = args.numericArgs;
  } else if (args.stringArgs.length > 0) {
    values = args.stringArgs;
  } else {
    values = [10, 20, 30, 40];
  }

  const action: CreateLinkedListAction = {
    type: "create_linked_list",
    id: listId,
    elements: values.map((v) => ({ value: v })),
    label: `Linked List (n = ${values.length})`,
    variant: "singly",
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}

/**
 * Generates a Stack structure.
 * Syntax: /stack(1,2,3)
 */
export function generateStack(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const stackId = context.nextId("stack");
  let values: (number | string)[];

  if (args.isSizeOnly && args.numericArgs.length === 1) {
    const size = Math.min(Math.max(args.numericArgs[0], 1), 10);
    values = Array.from({ length: size }, (_, i) => i + 1);
  } else if (args.numericArgs.length > 0) {
    values = args.numericArgs;
  } else if (args.stringArgs.length > 0) {
    values = args.stringArgs;
  } else {
    values = [1, 2, 3, 4];
  }

  const action: CreateStackAction = {
    type: "create_stack",
    id: stackId,
    elements: values.map((v) => ({ value: v })),
    label: `Stack [Top -> Bottom]`,
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}

/**
 * Generates a Queue structure.
 * Syntax: /queue(10,20,30)
 */
export function generateQueue(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const queueId = context.nextId("queue");
  let values: (number | string)[];

  if (args.isSizeOnly && args.numericArgs.length === 1) {
    const size = Math.min(Math.max(args.numericArgs[0], 1), 10);
    values = Array.from({ length: size }, (_, i) => (i + 1) * 10);
  } else if (args.numericArgs.length > 0) {
    values = args.numericArgs;
  } else if (args.stringArgs.length > 0) {
    values = args.stringArgs;
  } else {
    values = [10, 20, 30, 40];
  }

  const action: CreateQueueAction = {
    type: "create_queue",
    id: queueId,
    elements: values.map((v) => ({ value: v })),
    label: `Queue [Front -> Back]`,
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}

/**
 * Helper to construct a Binary Search Tree from values.
 */
interface BSTNode {
  id: string;
  value: number;
  left?: BSTNode;
  right?: BSTNode;
}

function insertBST(
  root: BSTNode,
  val: number,
  idCounter: { count: number },
): void {
  if (val < root.value) {
    if (root.left) {
      insertBST(root.left, val, idCounter);
    } else {
      root.left = { id: `node_${idCounter.count++}`, value: val };
    }
  } else if (root.right) {
    insertBST(root.right, val, idCounter);
  } else {
    root.right = { id: `node_${idCounter.count++}`, value: val };
  }
}

/**
 * Generates a Binary Tree / BST structure.
 * Syntax: /binary-tree(10,5,15,3,7) or /tree(10,5,15) or /bst(10,5,15)
 */
export function generateBinaryTree(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const treeId = context.nextId("tree");
  let values: number[];

  if (args.numericArgs.length > 0) {
    values = args.numericArgs;
  } else {
    values = [10, 5, 15, 3, 7, 12, 18];
  }

  // Build BST
  const idCounter = { count: 1 };
  const rootNode: BSTNode = { id: `node_0`, value: values[0] };
  for (let i = 1; i < values.length; i++) {
    insertBST(rootNode, values[i], idCounter);
  }

  // Flatten BST into TreeNodes
  const flatNodes: CreateTreeAction["nodes"] = [];
  function traverse(node: BSTNode) {
    flatNodes.push({
      id: node.id,
      value: node.value,
      left: node.left?.id,
      right: node.right?.id,
    });
    if (node.left) {
      traverse(node.left);
    }
    if (node.right) {
      traverse(node.right);
    }
  }
  traverse(rootNode);

  const action: CreateTreeAction = {
    type: "create_tree",
    id: treeId,
    root: rootNode.id,
    nodes: flatNodes,
    label: `Binary Search Tree (n = ${values.length})`,
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}

/**
 * Generates a Complete Binary Heap from an array.
 * Syntax: /heap(10,5,20,3,8,12)
 */
export function generateHeap(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const heapId = context.nextId("heap");
  let values: (number | string)[];

  if (args.numericArgs.length > 0) {
    values = args.numericArgs;
  } else {
    values = [20, 15, 18, 10, 12, 14, 16];
  }

  const nodes: CreateTreeAction["nodes"] = values.map((val, idx) => {
    const leftIdx = 2 * idx + 1;
    const rightIdx = 2 * idx + 2;
    return {
      id: `h_${idx}`,
      value: val,
      left: leftIdx < values.length ? `h_${leftIdx}` : undefined,
      right: rightIdx < values.length ? `h_${rightIdx}` : undefined,
    };
  });

  const action: CreateTreeAction = {
    type: "create_tree",
    id: heapId,
    root: "h_0",
    nodes,
    label: `Binary Heap (n = ${values.length})`,
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}

/**
 * Generates a Graph structure.
 * Syntax: /graph(A-B,B-C,C-A) or /graph(A->B, B->C) or /graph(A-B:5,B-C:10)
 */
export function generateGraph(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const graphId = context.nextId("graph");

  const edges =
    args.graphEdges && args.graphEdges.length > 0
      ? args.graphEdges
      : [
          { from: "A", to: "B", directed: false },
          { from: "B", to: "C", directed: false },
          { from: "C", to: "D", directed: false },
          { from: "D", to: "A", directed: false },
          { from: "A", to: "C", directed: false },
        ];

  // Extract unique node labels
  const nodeSet = new Set<string>();
  let hasDirected = false;
  for (const edge of edges) {
    nodeSet.add(edge.from);
    nodeSet.add(edge.to);
    if (edge.directed) {
      hasDirected = true;
    }
  }

  const nodes = Array.from(nodeSet).map((name) => ({
    id: name,
    label: name,
  }));

  const action: CreateGraphAction = {
    type: "create_graph",
    id: graphId,
    nodes,
    edges: edges.map((e) => ({
      from: e.from,
      to: e.to,
      weight: typeof e.weight === "number" ? e.weight : undefined,
      label: typeof e.weight === "string" ? e.weight : undefined,
      directed: e.directed,
    })),
    directed: hasDirected,
    label: `Graph (|V| = ${nodes.length}, |E| = ${edges.length})`,
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}

/**
 * Generates a 2D Matrix / Grid structure.
 * Syntax: /matrix(3,4) or /matrix(1,2,3;4,5,6)
 */
export function generateMatrix(
  args: CommandArgs,
  context: CommandExecutionContext,
): VisualAction[] {
  const matrixId = context.nextId("mat");
  let rows: (number | string)[][];

  if (args.matrixRows && args.matrixRows.length > 0) {
    rows = args.matrixRows;
  } else if (args.numericArgs.length === 2) {
    const numRows = Math.min(Math.max(args.numericArgs[0], 1), 10);
    const numCols = Math.min(Math.max(args.numericArgs[1], 1), 10);
    rows = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => 0),
    );
  } else {
    rows = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
  }

  const action: CreateMatrixAction = {
    type: "create_matrix",
    id: matrixId,
    rows,
    label: `Matrix (${rows.length} × ${rows[0]?.length || 0})`,
    x: context.origin.x,
    y: context.origin.y,
  };

  return [action];
}
