/**
 * Pure layout computation module for DSA visualization.
 * Computes coordinates and bounds for various data structures without external dependencies.
 */

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
  left?: string;       // ID of left child
  right?: string;      // ID of right child
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
  LEVEL_GAP: 100,     // vertical gap between levels
  SIBLING_GAP: 25,    // minimum horizontal gap between siblings
  SUBTREE_GAP: 50,    // minimum horizontal gap between subtrees
} as const;

export const GRAPH_LAYOUT = {
  NODE_RADIUS: 30,
  NODE_DIAMETER: 60,
  CIRCLE_RADIUS: 120,  // radius of circular arrangement
  GRID_GAP: 100,       // gap for grid fallback
  MAX_CIRCLE_NODES: 12,
} as const;

export const GRID_LAYOUT = {
  CELL_WIDTH: 60,
  CELL_HEIGHT: 40,
  CELL_GAP: 2,
  HEADER_OFFSET: 30,   // space for row/col headers
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
  origin: LayoutPoint
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
      children
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

    if (node.children.length === 2 && node.children[0].isLeft && node.children[1].isRight) {
      // Explicit binary placement
      const left = node.children[0];
      const right = node.children[1];
      const totalWidth = left.width + TREE_LAYOUT.SUBTREE_GAP + right.width;
      
      const startX = x + (TREE_LAYOUT.NODE_DIAMETER / 2) - (totalWidth / 2);
      
      const leftX = startX + (left.width / 2) - (TREE_LAYOUT.NODE_DIAMETER / 2);
      positionTree(left, leftX, y + TREE_LAYOUT.LEVEL_GAP);
      
      const rightX = startX + left.width + TREE_LAYOUT.SUBTREE_GAP + (right.width / 2) - (TREE_LAYOUT.NODE_DIAMETER / 2);
      positionTree(right, rightX, y + TREE_LAYOUT.LEVEL_GAP);
    } else {
      // Linear or general children placement
      let totalWidth = 0;
      for (const child of node.children) {
        totalWidth += child.width;
      }
      totalWidth += Math.max(0, node.children.length - 1) * TREE_LAYOUT.SIBLING_GAP;
      
      let currentX = x + (TREE_LAYOUT.NODE_DIAMETER / 2) - (totalWidth / 2);
      for (const child of node.children) {
        const childX = currentX + (child.width / 2) - (TREE_LAYOUT.NODE_DIAMETER / 2);
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
      height: maxY === -Infinity ? 0 : maxY - minY
    },
    levels
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
  origin: LayoutPoint
): GraphLayoutResult {
  const positions = new Map<string, LayoutPoint>();
  const n = nodes.length;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  if (n <= GRAPH_LAYOUT.MAX_CIRCLE_NODES) {
    // Circle Layout
    const cx = origin.x + GRAPH_LAYOUT.CIRCLE_RADIUS;
    const cy = origin.y + GRAPH_LAYOUT.CIRCLE_RADIUS;

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - (Math.PI / 2); // Start top, go clockwise
      const x = cx + GRAPH_LAYOUT.CIRCLE_RADIUS * Math.cos(angle) - GRAPH_LAYOUT.NODE_RADIUS;
      const y = cy + GRAPH_LAYOUT.CIRCLE_RADIUS * Math.sin(angle) - GRAPH_LAYOUT.NODE_RADIUS;
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
      height: maxY === -Infinity ? 0 : maxY - minY
    }
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
  origin: LayoutPoint
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
      const x = origin.x + GRID_LAYOUT.HEADER_OFFSET + c * (GRID_LAYOUT.CELL_WIDTH + GRID_LAYOUT.CELL_GAP);
      const y = origin.y + GRID_LAYOUT.HEADER_OFFSET + r * (GRID_LAYOUT.CELL_HEIGHT + GRID_LAYOUT.CELL_GAP);
      cellPositions.set(`${r}-${c}`, { x, y });

      maxX = Math.max(maxX, x + GRID_LAYOUT.CELL_WIDTH);
      maxY = Math.max(maxY, y + GRID_LAYOUT.CELL_HEIGHT);
    }

    const ry = origin.y + GRID_LAYOUT.HEADER_OFFSET + r * (GRID_LAYOUT.CELL_HEIGHT + GRID_LAYOUT.CELL_GAP);
    rowHeaders.set(r, { x: origin.x, y: ry });
  }

  for (let c = 0; c < cols; c++) {
    const cx = origin.x + GRID_LAYOUT.HEADER_OFFSET + c * (GRID_LAYOUT.CELL_WIDTH + GRID_LAYOUT.CELL_GAP);
    colHeaders.set(c, { x: cx, y: origin.y });
  }

  return {
    cellPositions,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    },
    headerPositions: {
      rows: rowHeaders,
      cols: colHeaders
    }
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
    height: maxY - minY
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
    const dividerY = isLast ? undefined : stepBottom + STEP_LAYOUT.DIVIDER_OFFSET;

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
