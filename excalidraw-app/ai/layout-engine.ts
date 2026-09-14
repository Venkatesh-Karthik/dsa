/**
 * Pure layout computation module for DSA visualization.
 * Computes coordinates and bounds for various data structures without external dependencies.
 */

import type { SceneGraph } from "./scene-graph";

// ==========================================
// Types
// ==========================================

/** Represents a 2D point for layout positioning */
export interface LayoutPoint {
  x: number;
  y: number;
}

/** Represents an axis-aligned bounding box */
export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// -- Tree Layout Types --

/** Input representation for a node in a tree layout */
export interface TreeNodeInput {
  id: string;
  value: string | number;
  left?: string; // ID of left child
  right?: string; // ID of right child
  children?: string[]; // For general trees
}

/** Output result of computing a tree layout */
export interface TreeLayoutResult {
  positions: Map<string, LayoutPoint>;
  bounds: LayoutBounds;
  levels: Map<string, number>; // node ID -> depth level
}

// -- Graph Layout Types --

/** Input representation for a node in a graph layout */
export interface GraphNodeInput {
  id: string;
  label: string;
}

/** Input representation for an edge in a graph layout */
export interface GraphEdgeInput {
  from: string;
  to: string;
  weight?: number;
  label?: string;
  directed?: boolean;
}

/** Output result of computing a graph layout */
export interface GraphLayoutResult {
  positions: Map<string, LayoutPoint>;
  bounds: LayoutBounds;
}

// -- Grid Layout Types --

/** Output result of computing a grid layout */
export interface GridLayoutResult {
  cellPositions: Map<string, LayoutPoint>; // key: `${row}-${col}`
  bounds: LayoutBounds;
  headerPositions?: {
    rows: Map<number, LayoutPoint>;
    cols: Map<number, LayoutPoint>;
  };
}

// ==========================================
// Constants
// ==========================================

export const TREE_LAYOUT = {
  NODE_RADIUS: 35,
  NODE_DIAMETER: 70,
  LEVEL_GAP: 100, // vertical gap between levels
  SIBLING_GAP: 25, // minimum horizontal gap between siblings
  SUBTREE_GAP: 50, // minimum horizontal gap between subtrees
} as const;

export const GRAPH_LAYOUT = {
  NODE_RADIUS: 30,
  NODE_DIAMETER: 60,
  CIRCLE_RADIUS: 120, // radius of circular arrangement
  GRID_GAP: 100, // gap for grid fallback
  MAX_CIRCLE_NODES: 12,
} as const;

export const GRID_LAYOUT = {
  CELL_WIDTH: 60,
  CELL_HEIGHT: 40,
  CELL_GAP: 2,
  HEADER_OFFSET: 30, // space for row/col headers
} as const;

// ==========================================
// Functions
// ==========================================

/**
 * Computes a Reingold-Tilford inspired layout for trees.
 *
 * @param nodes List of nodes in the tree
 * @param rootId ID of the root node
 * @param origin Starting coordinate for the layout
 * @returns TreeLayoutResult containing positions, bounds, and level assignments
 */
export function computeTreeLayout(
  nodes: TreeNodeInput[],
  rootId: string,
  origin: LayoutPoint,
): TreeLayoutResult {
  const nodeMap = new Map<string, TreeNodeInput>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const positions = new Map<string, LayoutPoint>();
  const levels = new Map<string, number>();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  interface LayoutNode {
    id: string;
    width: number;
    children: LayoutNode[];
    isLeft?: boolean;
    isRight?: boolean;
  }

  // 1. Build tree structure and compute subtree widths (bottom-up)
  function buildTree(id: string, depth: number): LayoutNode | null {
    if (depth >= 5) return null; // Cap depth at 5

    const node = nodeMap.get(id);
    if (!node) return null;

    levels.set(id, depth);

    const children: LayoutNode[] = [];
    let width = 0;

    if (node.children && node.children.length > 0) {
      // General tree handling
      for (const childId of node.children) {
        const childNode = buildTree(childId, depth + 1);
        if (childNode) {
          children.push(childNode);
          width += childNode.width;
        }
      }
      if (children.length > 1) {
        width += (children.length - 1) * TREE_LAYOUT.SIBLING_GAP;
      }
    } else {
      // Binary tree handling
      let leftNode: LayoutNode | null = null;
      let rightNode: LayoutNode | null = null;

      if (node.left) {
        leftNode = buildTree(node.left, depth + 1);
        if (leftNode) {
          leftNode.isLeft = true;
          children.push(leftNode);
        }
      }
      if (node.right) {
        rightNode = buildTree(node.right, depth + 1);
        if (rightNode) {
          rightNode.isRight = true;
          children.push(rightNode);
        }
      }

      if (leftNode && rightNode) {
        width = leftNode.width + TREE_LAYOUT.SUBTREE_GAP + rightNode.width;
      } else if (leftNode) {
        width = leftNode.width;
      } else if (rightNode) {
        width = rightNode.width;
      }
    }

    return {
      id,
      width: Math.max(width, TREE_LAYOUT.NODE_DIAMETER),
      children,
    };
  }

  const root = buildTree(rootId, 0);

  // 2. Position nodes (top-down)
  function positionTree(node: LayoutNode, x: number, y: number) {
    positions.set(node.id, { x, y });

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + TREE_LAYOUT.NODE_DIAMETER);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + TREE_LAYOUT.NODE_DIAMETER);

    if (node.children.length === 0) return;

    if (
      node.children.length === 2 &&
      node.children[0].isLeft &&
      node.children[1].isRight
    ) {
      // Explicit binary placement
      const left = node.children[0];
      const right = node.children[1];
      const totalWidth = left.width + TREE_LAYOUT.SUBTREE_GAP + right.width;

      const startX = x + TREE_LAYOUT.NODE_DIAMETER / 2 - totalWidth / 2;

      const leftX = startX + left.width / 2 - TREE_LAYOUT.NODE_DIAMETER / 2;
      positionTree(left, leftX, y + TREE_LAYOUT.LEVEL_GAP);

      const rightX =
        startX +
        left.width +
        TREE_LAYOUT.SUBTREE_GAP +
        right.width / 2 -
        TREE_LAYOUT.NODE_DIAMETER / 2;
      positionTree(right, rightX, y + TREE_LAYOUT.LEVEL_GAP);
    } else {
      // Linear or general children placement
      let totalWidth = 0;
      for (const child of node.children) {
        totalWidth += child.width;
      }
      totalWidth +=
        Math.max(0, node.children.length - 1) * TREE_LAYOUT.SIBLING_GAP;

      let currentX = x + TREE_LAYOUT.NODE_DIAMETER / 2 - totalWidth / 2;
      for (const child of node.children) {
        const childX =
          currentX + child.width / 2 - TREE_LAYOUT.NODE_DIAMETER / 2;
        positionTree(child, childX, y + TREE_LAYOUT.LEVEL_GAP);
        currentX += child.width + TREE_LAYOUT.SIBLING_GAP;
      }
    }
  }

  if (root) {
    positionTree(root, origin.x, origin.y);
  }

  return {
    positions,
    bounds: {
      x: minX === Infinity ? origin.x : minX,
      y: minY === Infinity ? origin.y : minY,
      width: maxX === -Infinity ? 0 : maxX - minX,
      height: maxY === -Infinity ? 0 : maxY - minY,
    },
    levels,
  };
}

/**
 * Computes deterministic layouts for graphs.
 * Circles small numbers of nodes; uses grid for larger sets.
 *
 * @param nodes List of nodes in the graph
 * @param edges List of edges in the graph
 * @param origin Starting coordinate for the layout
 * @returns GraphLayoutResult containing positions and bounds
 */
export function computeGraphLayout(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  origin: LayoutPoint,
): GraphLayoutResult {
  const positions = new Map<string, LayoutPoint>();
  const n = nodes.length;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  if (n <= GRAPH_LAYOUT.MAX_CIRCLE_NODES) {
    // Circle Layout: dynamically size radius to prevent overlaps
    const dynamicRadius = Math.max(
      GRAPH_LAYOUT.CIRCLE_RADIUS,
      (n * GRAPH_LAYOUT.NODE_DIAMETER * 1.5) / (2 * Math.PI),
    );
    const cx = origin.x + dynamicRadius;
    const cy = origin.y + dynamicRadius;

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2; // Start top, go clockwise
      const x = cx + dynamicRadius * Math.cos(angle) - GRAPH_LAYOUT.NODE_RADIUS;
      const y = cy + dynamicRadius * Math.sin(angle) - GRAPH_LAYOUT.NODE_RADIUS;
      positions.set(nodes[i].id, { x, y });

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + GRAPH_LAYOUT.NODE_DIAMETER);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + GRAPH_LAYOUT.NODE_DIAMETER);
    }
  } else {
    // Grid Layout Fallback
    const cols = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = origin.x + c * GRAPH_LAYOUT.GRID_GAP;
      const y = origin.y + r * GRAPH_LAYOUT.GRID_GAP;
      positions.set(nodes[i].id, { x, y });

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + GRAPH_LAYOUT.NODE_DIAMETER);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + GRAPH_LAYOUT.NODE_DIAMETER);
    }
  }

  return {
    positions,
    bounds: {
      x: minX === Infinity ? origin.x : minX,
      y: minY === Infinity ? origin.y : minY,
      width: maxX === -Infinity ? 0 : maxX - minX,
      height: maxY === -Infinity ? 0 : maxY - minY,
    },
  };
}

/**
 * Computes coordinates for a 2D grid matrix layout.
 *
 * @param rows Number of rows
 * @param cols Number of columns
 * @param origin Starting coordinate
 * @returns GridLayoutResult with positions for cells and optional headers
 */
export function computeGridLayout(
  rows: number,
  cols: number,
  origin: LayoutPoint,
): GridLayoutResult {
  const cellPositions = new Map<string, LayoutPoint>();
  const rowHeaders = new Map<number, LayoutPoint>();
  const colHeaders = new Map<number, LayoutPoint>();

  let minX = origin.x;
  let minY = origin.y;
  let maxX = origin.x;
  let maxY = origin.y;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x =
        origin.x +
        GRID_LAYOUT.HEADER_OFFSET +
        c * (GRID_LAYOUT.CELL_WIDTH + GRID_LAYOUT.CELL_GAP);
      const y =
        origin.y +
        GRID_LAYOUT.HEADER_OFFSET +
        r * (GRID_LAYOUT.CELL_HEIGHT + GRID_LAYOUT.CELL_GAP);
      cellPositions.set(`${r}-${c}`, { x, y });

      maxX = Math.max(maxX, x + GRID_LAYOUT.CELL_WIDTH);
      maxY = Math.max(maxY, y + GRID_LAYOUT.CELL_HEIGHT);
    }

    const ry =
      origin.y +
      GRID_LAYOUT.HEADER_OFFSET +
      r * (GRID_LAYOUT.CELL_HEIGHT + GRID_LAYOUT.CELL_GAP);
    rowHeaders.set(r, { x: origin.x, y: ry });
  }

  for (let c = 0; c < cols; c++) {
    const cx =
      origin.x +
      GRID_LAYOUT.HEADER_OFFSET +
      c * (GRID_LAYOUT.CELL_WIDTH + GRID_LAYOUT.CELL_GAP);
    colHeaders.set(c, { x: cx, y: origin.y });
  }

  return {
    cellPositions,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    headerPositions: {
      rows: rowHeaders,
      cols: colHeaders,
    },
  };
}

// ==========================================
// Collision & Bounds Helpers
// ==========================================

/**
 * Checks if two bounding boxes overlap.
 * Touching edges do not count as overlap.
 */
export function doRectsOverlap(a: LayoutBounds, b: LayoutBounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Checks if two bounding boxes overlap with an additional clearance margin.
 */
export function doRectsOverlapWithMargin(
  a: LayoutBounds,
  b: LayoutBounds,
  marginX = 0,
  marginY = 0,
): boolean {
  return (
    a.x < b.x + b.width + marginX &&
    a.x + a.width + marginX > b.x &&
    a.y < b.y + b.height + marginY &&
    a.y + a.height + marginY > b.y
  );
}

export interface SceneLayoutNode {
  id: string;
  bounds: LayoutBounds;
  relativeTo?: string;
  placement?: "below" | "above" | "right_of" | "left_of";
}

export function estimateTextDimensions(
  text: string,
  fontSize = 16,
): { width: number; height: number; lineCount: number } {
  if (!text) {
    return { width: 0, height: 0, lineCount: 0 };
  }
  const lines = text.split("\n");
  const lineCount = lines.length;
  const maxLineLength = Math.max(...lines.map((l) => l.length));
  const charWidth = fontSize * 0.65;
  const lineHeight = fontSize * 1.5;
  const width = Math.ceil(maxLineLength * charWidth);
  const height = Math.ceil(lineCount * lineHeight);
  return { width, height, lineCount };
}

export function computeContainerDimensions(
  text: string,
  baseWidth: number,
  baseHeight: number,
  padding = 20,
): { width: number; height: number } {
  const textDims = estimateTextDimensions(text);
  const width = Math.max(baseWidth, textDims.width + padding * 2);
  const height = Math.max(baseHeight, textDims.height + padding * 2);
  return { width, height };
}

export class PlacementSlotTracker {
  private slots = new Map<string, LayoutBounds>();

  getNextPlacementBounds(
    anchorId: string,
    placement: "below" | "above" | "right_of" | "left_of",
    anchorBounds: LayoutBounds,
  ): LayoutBounds {
    const key = `${anchorId}-${placement}`;
    const recorded = this.slots.get(key);
    if (!recorded) {
      return { ...anchorBounds };
    }
    return { ...recorded };
  }

  record(
    anchorId: string,
    placement: "below" | "above" | "right_of" | "left_of",
    itemBounds: LayoutBounds,
  ): void {
    const key = `${anchorId}-${placement}`;
    const existing = this.slots.get(key);
    if (!existing) {
      const envelopeY =
        itemBounds.y >= 0
          ? Math.min(itemBounds.y, itemBounds.y - 120)
          : itemBounds.y;
      this.slots.set(key, {
        x: itemBounds.x,
        y: envelopeY,
        width: itemBounds.width,
        height: itemBounds.y + itemBounds.height - envelopeY,
      });
    } else {
      const topY = Math.min(existing.y, itemBounds.y);
      const bottomY = Math.max(
        existing.y + existing.height,
        itemBounds.y + itemBounds.height,
      );
      existing.y = topY;
      existing.height = bottomY - topY;
    }
  }
}

export function resolveSceneCollisions(
  nodes: SceneLayoutNode[],
  options?: { minGapY?: number },
): {
  nodes: SceneLayoutNode[];
  totalShifts: number;
  shifts: Map<string, { dx: number; dy: number }>;
} {
  const minGapY = options?.minGapY ?? 30;
  const cloned: SceneLayoutNode[] = nodes.map((n) => ({
    ...n,
    bounds: { ...n.bounds },
  }));
  let totalShifts = 0;
  const shiftMap = new Map<string, { dx: number; dy: number }>();
  for (const n of nodes) {
    shiftMap.set(n.id, { dx: 0, dy: 0 });
  }

  const childrenMap = new Map<string, string[]>();
  for (const n of cloned) {
    if (n.relativeTo) {
      const list = childrenMap.get(n.relativeTo) ?? [];
      list.push(n.id);
      childrenMap.set(n.relativeTo, list);
    }
  }

  const shiftNodeAndDescendants = (nodeId: string, dy: number) => {
    const node = cloned.find((n) => n.id === nodeId);
    if (!node) return;
    node.bounds.y += dy;
    totalShifts += Math.abs(dy);
    const curr = shiftMap.get(nodeId) ?? { dx: 0, dy: 0 };
    shiftMap.set(nodeId, { dx: curr.dx, dy: curr.dy + dy });
    const children = childrenMap.get(nodeId) ?? [];
    for (const childId of children) {
      shiftNodeAndDescendants(childId, dy);
    }
  };

  for (let iter = 0; iter < 20; iter++) {
    let hadCollision = false;
    for (let i = 0; i < cloned.length; i++) {
      for (let j = 0; j < cloned.length; j++) {
        if (i === j) continue;
        const a = cloned[i];
        const b = cloned[j];
        if (b.relativeTo === a.id && !doRectsOverlap(a.bounds, b.bounds)) {
          continue;
        }
        if (doRectsOverlapWithMargin(a.bounds, b.bounds, 0, minGapY)) {
          // If b is placed below a or b.y >= a.y
          if (b.bounds.y >= a.bounds.y) {
            const requiredY = a.bounds.y + a.bounds.height + minGapY;
            const shiftY = requiredY - b.bounds.y;
            if (shiftY > 0) {
              hadCollision = true;
              shiftNodeAndDescendants(b.id, shiftY);
            }
          }
        }
      }
    }
    if (!hadCollision) break;
  }

  return { nodes: cloned, totalShifts, shifts: shiftMap };
}

export function balanceElementPositions(
  elements: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[],
): Map<string, LayoutPoint> {
  const boxes: CollisionBox[] = elements.map((el) => ({
    id: el.id,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
  }));
  return resolveLayoutCollisions(boxes, 24);
}

/**
 * Computes the minimum bounding box containing an array of rectangles.
 */
export function computeSceneBounds(rects: LayoutBounds[]): LayoutBounds {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ==========================================
// Vertical Multi-Step Lesson Layout
// ==========================================

export interface StepLayoutInput {
  stepId: string;
  stepIndex: number;
  diagramBounds: LayoutBounds;
  explanationHeight: number;
  headerHeight?: number;
}

export interface StepLayoutResult {
  stepId: string;
  stepIndex: number;
  bounds: LayoutBounds;
  headerY: number;
  diagramY: number;
  explanationY: number;
  dividerY?: number;
}

export interface VerticalLessonLayoutResult {
  steps: StepLayoutResult[];
  totalBounds: LayoutBounds;
}

export const STEP_LAYOUT = {
  START_X: 100,
  START_Y: 80,
  STEP_GAP: 120, // vertical gap between steps
  HEADER_HEIGHT: 40,
  DIAGRAM_GAP: 20,
  EXPLANATION_GAP: 32,
  DIVIDER_OFFSET: 55,
  MIN_STEP_WIDTH: 720,
} as const;

/**
 * Computes deterministic vertical layout regions for a multi-step lesson.
 * Each step is stacked vertically below the previous one with calculated bounds,
 * ensuring no steps overlap and ample reading room is preserved.
 */
export function computeStepVerticalLayout(
  steps: StepLayoutInput[],
  startX: number = STEP_LAYOUT.START_X,
  startY: number = STEP_LAYOUT.START_Y,
  stepGap: number = STEP_LAYOUT.STEP_GAP,
): VerticalLessonLayoutResult {
  const results: StepLayoutResult[] = [];
  let currentY = startY;

  let minX = startX;
  let maxX = startX + STEP_LAYOUT.MIN_STEP_WIDTH;
  const minY = startY;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const headerHeight = step.headerHeight ?? STEP_LAYOUT.HEADER_HEIGHT;
    const headerY = currentY;

    const diagramY = headerY + headerHeight + STEP_LAYOUT.DIAGRAM_GAP;
    const diagramH = Math.max(step.diagramBounds.height, 0);
    const diagramW = Math.max(step.diagramBounds.width, 0);

    const explanationY = diagramY + diagramH + STEP_LAYOUT.EXPLANATION_GAP;
    const explanationH = Math.max(step.explanationHeight, 100);

    const stepBottom = explanationY + explanationH;
    const stepHeight = stepBottom - currentY;
    const stepWidth = Math.max(
      diagramW,
      STEP_LAYOUT.MIN_STEP_WIDTH,
      step.diagramBounds.width,
    );

    const stepBounds: LayoutBounds = {
      x: startX,
      y: currentY,
      width: stepWidth,
      height: stepHeight,
    };

    maxX = Math.max(maxX, startX + stepWidth);

    const isLast = i === steps.length - 1;
    const dividerY = isLast
      ? undefined
      : stepBottom + STEP_LAYOUT.DIVIDER_OFFSET;

    results.push({
      stepId: step.stepId,
      stepIndex: step.stepIndex,
      bounds: stepBounds,
      headerY,
      diagramY,
      explanationY,
      dividerY,
    });

    currentY = stepBottom + stepGap;
  }

  const maxY = currentY - stepGap;

  return {
    steps: results,
    totalBounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: Math.max(0, maxY - minY),
    },
  };
}

/**
 * Universal layout computation for any canonical SceneGraph.
 * Dynamically identifies structure (Tree, Array, Graph, Linked List, Stack, or Generic Concept)
 * and computes deterministic positions with layout stability across transformations.
 */
export function computeSceneGraphLayout(
  graph: SceneGraph,
  origin: LayoutPoint = { x: 100, y: 100 },
  previousLayout?: Map<string, LayoutPoint>,
): { positions: Map<string, LayoutPoint>; bounds: LayoutBounds } {
  const positions = new Map<string, LayoutPoint>();
  const entityList = Array.from(graph.entities.values());

  if (entityList.length === 0) {
    return {
      positions,
      bounds: { x: origin.x, y: origin.y, width: 0, height: 0 },
    };
  }

  const conceptType = graph.metadata?.conceptType;
  const isTree =
    conceptType === "tree" ||
    entityList.some((e) => e.primitiveType === "TreeNode");
  const isArray =
    conceptType === "array" ||
    entityList.some((e) => e.primitiveType === "ArrayCell");
  const isLinkedList =
    conceptType === "linked_list" ||
    entityList.some((e) => e.primitiveType === "LinkedListNode");
  const isStack =
    conceptType === "stack" ||
    entityList.some((e) => e.primitiveType === "StackFrame");
  const isGraph =
    conceptType === "graph" ||
    entityList.some((e) => e.primitiveType === "GraphNode");

  if (isTree) {
    // 1. Build tree structure from entities & relationships
    const treeNodes = entityList.filter((e) => e.primitiveType === "TreeNode");
    const childSet = new Set<string>();

    const treeInputs: TreeNodeInput[] = treeNodes.map((entity) => {
      let left: string | undefined = entity.properties?.left as
        | string
        | undefined;
      let right: string | undefined = entity.properties?.right as
        | string
        | undefined;
      let children: string[] | undefined = entity.properties?.children as
        | string[]
        | undefined;

      // Extract from relationships if not explicitly on properties
      for (const rel of graph.relationships.values()) {
        if (rel.sourceEntityId === entity.id) {
          childSet.add(rel.targetEntityId);
          if (rel.type === "leftOf") {
            left = rel.targetEntityId;
          } else if (rel.type === "rightOf") {
            right = rel.targetEntityId;
          } else if (rel.type === "parentOf") {
            children = children
              ? [...children, rel.targetEntityId]
              : [rel.targetEntityId];
          }
        }
      }

      return {
        id: entity.id,
        value:
          typeof entity.value === "string" || typeof entity.value === "number"
            ? entity.value
            : String(entity.value ?? entity.label ?? ""),
        left,
        right,
        children,
      };
    });

    // Identify root
    let rootId = graph.metadata?.rootEntityId;
    if (!rootId || !treeNodes.some((n) => n.id === rootId)) {
      // Pick first node with in-degree 0 among tree relationships
      const potentialRoot = treeNodes.find((n) => !childSet.has(n.id));
      rootId = potentialRoot ? potentialRoot.id : treeNodes[0].id;
    }

    // Use an appropriately centered tree anchor to prevent left-subtree clipping
    const treeOrigin: LayoutPoint = {
      x: Math.max(origin.x, 420),
      y: origin.y,
    };

    const rawLayout = computeTreeLayout(treeInputs, rootId, treeOrigin);

    // Tree Layout Anti-Drift:
    // Anchor root to treeOrigin.x and treeOrigin.y across all states to completely eliminate drift.
    // When AVL rotation promotes a new root, it takes the root anchor coordinate and subtrees position symmetrically below.
    for (const [id, pos] of rawLayout.positions) {
      positions.set(id, pos);
    }

    const bounds: LayoutBounds = {
      x: rawLayout.bounds.x,
      y: rawLayout.bounds.y,
      width: rawLayout.bounds.width,
      height: rawLayout.bounds.height,
    };

    // Position any annotations or auxiliary entities alongside the tree
    const annotations = entityList.filter(
      (e) => e.primitiveType === "Annotation" || e.primitiveType === "Callout",
    );
    for (const ann of annotations) {
      const targetId = ann.properties?.targetEntityId as string | undefined;
      const targetPos = targetId ? positions.get(targetId) : null;
      if (targetPos) {
        positions.set(ann.id, {
          x: targetPos.x + 90,
          y: targetPos.y - 10,
        });
      } else {
        positions.set(ann.id, {
          x: bounds.x + bounds.width + 40,
          y: bounds.y + 10,
        });
      }
    }

    // Ensure all entities in the graph have deterministic positions
    for (const entity of entityList) {
      if (!positions.has(entity.id)) {
        const prev = previousLayout?.get(entity.id);
        if (prev) {
          positions.set(entity.id, prev);
        } else {
          // Gracefully place auxiliary entity below the tree
          positions.set(entity.id, {
            x: bounds.x,
            y: bounds.y + bounds.height + 40,
          });
        }
      }
    }

    // Run collision resolution across all positioned items
    const collisionBoxes: CollisionBox[] = [];
    for (const entity of entityList) {
      const pos = positions.get(entity.id);
      if (!pos) continue;
      const isAnn =
        entity.primitiveType === "Annotation" ||
        entity.primitiveType === "Callout";
      collisionBoxes.push({
        id: entity.id,
        x: pos.x,
        y: pos.y,
        width: isAnn ? 180 : 70,
        height: isAnn ? 60 : 70,
        fixed: !isAnn,
        priority: isAnn ? 1 : 10,
      });
    }
    const resolvedPos = resolveLayoutCollisions(collisionBoxes, 20);
    for (const [id, pos] of resolvedPos) {
      positions.set(id, pos);
    }

    return { positions, bounds };
  }

  if (isArray) {
    const cells = entityList.filter((e) => e.primitiveType === "ArrayCell");
    cells.sort((a, b) => {
      const idxA = (a.properties?.index as number) ?? 0;
      const idxB = (b.properties?.index as number) ?? 0;
      return idxA - idxB;
    });

    const startX = previousLayout?.get(cells[0].id)?.x ?? origin.x;
    const startY = previousLayout?.get(cells[0].id)?.y ?? origin.y;
    const cellW = 60;
    const cellH = 40;
    const gap = 2;

    for (let i = 0; i < cells.length; i++) {
      positions.set(cells[i].id, {
        x: startX + i * (cellW + gap),
        y: startY,
      });
    }

    return {
      positions,
      bounds: {
        x: startX,
        y: startY,
        width: cells.length * (cellW + gap),
        height: cellH,
      },
    };
  }

  if (isLinkedList) {
    const nodes = entityList.filter(
      (e) => e.primitiveType === "LinkedListNode",
    );
    const startX = previousLayout?.get(nodes[0].id)?.x ?? origin.x;
    const startY = previousLayout?.get(nodes[0].id)?.y ?? origin.y;
    const nodeW = 80;
    const gap = 60;

    for (let i = 0; i < nodes.length; i++) {
      positions.set(nodes[i].id, {
        x: startX + i * (nodeW + gap),
        y: startY,
      });
    }

    return {
      positions,
      bounds: {
        x: startX,
        y: startY,
        width: nodes.length * (nodeW + gap),
        height: 60,
      },
    };
  }

  if (isStack) {
    const frames = entityList.filter((e) => e.primitiveType === "StackFrame");
    const startX = previousLayout?.get(frames[0].id)?.x ?? origin.x;
    const startY = previousLayout?.get(frames[0].id)?.y ?? origin.y;
    const frameH = 40;
    const gap = 8;

    for (let i = 0; i < frames.length; i++) {
      positions.set(frames[i].id, {
        x: startX,
        y: startY + i * (frameH + gap),
      });
    }

    return {
      positions,
      bounds: {
        x: startX,
        y: startY,
        width: 140,
        height: frames.length * (frameH + gap),
      },
    };
  }

  if (isGraph) {
    const graphNodes = entityList.filter(
      (e) => e.primitiveType === "GraphNode",
    );
    const graphEdges = Array.from(graph.relationships.values()).map((r) => ({
      from: r.sourceEntityId,
      to: r.targetEntityId,
      weight: r.properties?.weight as number | undefined,
      label: r.label,
      directed: r.properties?.directed !== false,
    }));

    const rawResult = computeGraphLayout(
      graphNodes.map((n) => ({
        id: n.id,
        label: n.label ?? String(n.value ?? ""),
      })),
      graphEdges,
      origin,
    );

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of graphNodes) {
      // Graph Layout Persistence: preserve previously assigned node positions
      const pos =
        previousLayout?.get(node.id) ??
        rawResult.positions.get(node.id) ??
        origin;
      positions.set(node.id, pos);
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + GRAPH_LAYOUT.NODE_DIAMETER);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + GRAPH_LAYOUT.NODE_DIAMETER);
    }

    // Ensure auxiliary entities also have positions
    for (const entity of entityList) {
      if (!positions.has(entity.id)) {
        const pos = previousLayout?.get(entity.id) ?? {
          x: minX === Infinity ? origin.x : minX,
          y: (maxY === -Infinity ? origin.y : maxY) + 40,
        };
        positions.set(entity.id, pos);
      }
    }

    return {
      positions,
      bounds: {
        x: minX === Infinity ? origin.x : minX,
        y: minY === Infinity ? origin.y : minY,
        width: maxX === -Infinity ? 0 : maxX - minX,
        height: maxY === -Infinity ? 0 : maxY - minY,
      },
    };
  }

  // 6. Two-party / Client-Server Protocol Layout (e.g. TCP Handshake, HTTP, Client/Server)
  const partyA = entityList.find((e) => {
    const idOrLabel = (e.label || e.id).toLowerCase();
    return idOrLabel.includes("client") || idOrLabel.includes("sender");
  });
  const partyB = entityList.find((e) => {
    const idOrLabel = (e.label || e.id).toLowerCase();
    return idOrLabel.includes("server") || idOrLabel.includes("receiver");
  });

  if (partyA && partyB && partyA.id !== partyB.id) {
    const posA = previousLayout?.get(partyA.id) ?? { x: origin.x, y: origin.y };
    const posB = previousLayout?.get(partyB.id) ?? {
      x: origin.x + 380,
      y: origin.y,
    };
    positions.set(partyA.id, posA);
    positions.set(partyB.id, posB);

    let currentY = origin.y + 70;
    for (const entity of entityList) {
      if (entity.id === partyA.id || entity.id === partyB.id) continue;
      const prevPos = previousLayout?.get(entity.id);
      if (prevPos) {
        positions.set(entity.id, prevPos);
      } else {
        positions.set(entity.id, {
          x: (posA.x + posB.x) / 2 - 40,
          y: currentY,
        });
        currentY += 60;
      }
    }

    return {
      positions,
      bounds: {
        x: posA.x,
        y: posA.y,
        width: 380 + 140,
        height: Math.max(160, currentY - origin.y + 40),
      },
    };
  }

  // 7. Generic / Arbitrary Concept Layout (Flow, Pipeline, Cycle, or DAG)
  // Handles completely arbitrary subjects (e.g. Refrigerator, Photosynthesis, HTTP, SQL)
  const inDegrees = new Map<string, number>();
  const outDegrees = new Map<string, number>();

  for (const entity of entityList) {
    inDegrees.set(entity.id, 0);
    outDegrees.set(entity.id, 0);
  }

  for (const rel of graph.relationships.values()) {
    inDegrees.set(
      rel.targetEntityId,
      (inDegrees.get(rel.targetEntityId) ?? 0) + 1,
    );
    outDegrees.set(
      rel.sourceEntityId,
      (outDegrees.get(rel.sourceEntityId) ?? 0) + 1,
    );
  }

  // Check for 4-node or closed cycle (e.g. Refrigerator compressor -> condenser -> expansion -> evaporator)
  const isLoop =
    entityList.length >= 3 &&
    entityList.length <= 6 &&
    Array.from(inDegrees.values()).every((d) => d >= 1) &&
    Array.from(outDegrees.values()).every((d) => d >= 1);

  if (isLoop) {
    // Layout in a clear cycle / 2x2 perimeter loop
    const n = entityList.length;
    const radius = 140;
    const cx = origin.x + radius;
    const cy = origin.y + radius;

    for (let i = 0; i < n; i++) {
      const prevPos = previousLayout?.get(entityList[i].id);
      if (prevPos) {
        positions.set(entityList[i].id, prevPos);
      } else {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = cx + radius * Math.cos(angle) - 60;
        const y = cy + radius * Math.sin(angle) - 30;
        positions.set(entityList[i].id, { x, y });
      }
    }

    return {
      positions,
      bounds: {
        x: origin.x,
        y: origin.y,
        width: radius * 2 + 120,
        height: radius * 2 + 60,
      },
    };
  }

  // Linear / Topological Rank Pipeline (Input -> Process -> Output)
  const ranks = new Map<string, number>();
  for (const entity of entityList) {
    if ((inDegrees.get(entity.id) ?? 0) === 0) {
      ranks.set(entity.id, 0);
    }
  }

  // Propagate ranks along outgoing relationships
  for (let iter = 0; iter < entityList.length; iter++) {
    for (const rel of graph.relationships.values()) {
      const srcRank = ranks.get(rel.sourceEntityId);
      if (srcRank != null) {
        const currTargetRank = ranks.get(rel.targetEntityId) ?? 0;
        ranks.set(rel.targetEntityId, Math.max(currTargetRank, srcRank + 1));
      }
    }
  }

  // Group by rank
  const rankGroups = new Map<number, string[]>();
  for (const entity of entityList) {
    const rank = ranks.get(entity.id) ?? 0;
    const group = rankGroups.get(rank) ?? [];
    group.push(entity.id);
    rankGroups.set(rank, group);
  }

  const colWidth = 220;
  const rowHeight = 110;
  let maxX = origin.x;
  let maxY = origin.y;

  for (const [rank, ids] of rankGroups.entries()) {
    const x = origin.x + rank * colWidth;
    for (let row = 0; row < ids.length; row++) {
      const id = ids[row];
      // Layout stability: if entity had previous position, ALWAYS preserve it
      const prevPos = previousLayout?.get(id);
      if (prevPos) {
        positions.set(id, prevPos);
        maxX = Math.max(maxX, prevPos.x + 140);
        maxY = Math.max(maxY, prevPos.y + 70);
      } else {
        const y = origin.y + row * rowHeight;
        positions.set(id, { x, y });
        maxX = Math.max(maxX, x + 140);
        maxY = Math.max(maxY, y + 70);
      }
    }
  }

  return {
    positions,
    bounds: {
      x: origin.x,
      y: origin.y,
      width: Math.max(140, maxX - origin.x),
      height: Math.max(70, maxY - origin.y),
    },
  };
}

// ==========================================
// Text Measurement & Collision Types
// ==========================================

export interface TextMeasurement {
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
}

export interface CollisionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority?: number;
  fixed?: boolean;
}

/**
 * Wraps text into lines with word boundaries respecting maxCharsPerLine.
 */
export function wrapText(text: string, maxCharsPerLine = 36): string[] {
  if (!text) return [];
  const rawLines = text.split("\n");
  const result: string[] = [];

  for (const rawLine of rawLines) {
    if (rawLine.length <= maxCharsPerLine) {
      result.push(rawLine);
      continue;
    }
    const words = rawLine.split(" ");
    let currentLine = "";

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += " " + word;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result;
}

/**
 * Estimates text dimensions based on font size and character width.
 */
export function measureTextBounds(
  text: string,
  fontSize = 14,
  maxCharWidth = 36,
): TextMeasurement {
  const lines = wrapText(text, maxCharWidth);
  const approxCharWidth = fontSize * 0.58;
  const lineHeight = Math.round(fontSize * 1.35);

  let maxLineWidth = 0;
  for (const line of lines) {
    const lineW = Math.round(line.length * approxCharWidth);
    if (lineW > maxLineWidth) {
      maxLineWidth = lineW;
    }
  }

  return {
    width: Math.max(60, maxLineWidth),
    height: Math.max(lineHeight, lines.length * lineHeight),
    lines,
    lineHeight,
  };
}

/**
 * Computes content-aware bounds for annotations / callouts so text never overflows.
 */
export function computeAdaptiveAnnotationBounds(
  text: string,
  title?: string,
  fontSize = 14,
): LayoutBounds {
  const textMeasurement = measureTextBounds(text, fontSize, 40);
  const titleMeasurement = title
    ? measureTextBounds(title, fontSize + 2, 35)
    : null;

  const hPadding = 24; // 12px on each side
  const vPadding = 20; // 10px on top and bottom

  const contentWidth = Math.max(
    textMeasurement.width,
    titleMeasurement ? titleMeasurement.width : 0,
  );
  const contentHeight =
    textMeasurement.height +
    (titleMeasurement ? titleMeasurement.height + 6 : 0);

  return {
    x: 0,
    y: 0,
    width: Math.min(380, Math.max(120, contentWidth + hPadding)),
    height: Math.max(48, contentHeight + vPadding),
  };
}

/**
 * Checks whether two axis-aligned bounding boxes collide or overlap within a margin.
 */
export function checkAABBCollision(
  a: LayoutBounds,
  b: LayoutBounds,
  margin = 16,
): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

/**
 * Resolves layout collisions by shifting colliding non-fixed items with semantic clearance.
 */
export function resolveLayoutCollisions(
  boxes: CollisionBox[],
  clearance = 20,
): Map<string, LayoutPoint> {
  const resolved = new Map<string, LayoutPoint>();
  const currentBoxes = boxes.map((b) => ({ ...b }));

  // Sort boxes by priority (higher priority/fixed stays first)
  currentBoxes.sort((a, b) => {
    if (a.fixed && !b.fixed) return -1;
    if (!a.fixed && b.fixed) return 1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });

  const maxPasses = 5;
  for (let pass = 0; pass < maxPasses; pass++) {
    let hadCollision = false;

    for (let i = 0; i < currentBoxes.length; i++) {
      for (let j = i + 1; j < currentBoxes.length; j++) {
        const boxA = currentBoxes[i];
        const boxB = currentBoxes[j];

        if (checkAABBCollision(boxA, boxB, clearance)) {
          hadCollision = true;
          // Target box is non-fixed
          const targetBox = boxB.fixed && !boxA.fixed ? boxA : boxB;
          const anchorBox = targetBox === boxB ? boxA : boxB;

          // Displace primarily vertically downwards or horizontally to the right
          const overlapY =
            anchorBox.y + anchorBox.height + clearance - targetBox.y;
          const overlapX =
            anchorBox.x + anchorBox.width + clearance - targetBox.x;

          if (Math.abs(overlapY) <= Math.abs(overlapX)) {
            targetBox.y = anchorBox.y + anchorBox.height + clearance;
          } else {
            targetBox.x = anchorBox.x + anchorBox.width + clearance;
          }
        }
      }
    }

    if (!hadCollision) break;
  }

  for (const b of currentBoxes) {
    resolved.set(b.id, { x: b.x, y: b.y });
  }

  return resolved;
}
