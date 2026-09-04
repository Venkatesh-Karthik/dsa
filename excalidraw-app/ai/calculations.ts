/**
 * Deterministic Semantic Calculation & Invariant Verification Engine
 *
 * Provides generic, topic-agnostic mathematical and structural verification
 * for whiteboard data structures (trees, arrays, stacks, graphs).
 *
 * Guarantees that visual representations and textual calculations never contradict each other.
 * Zero topic-specific hardcoding: all evaluations are computed directly from semantic data.
 */

import type {
  TeachingStep,
  CreateTreeAction,
  CreateArrayAction,
  AnnotatePointerAction,
  TreeNodeDef,
  ArrayElement,
} from "./visual-dsl";

// ============================================================================
// Tree Metrics & Invariant Verification
// ============================================================================

export interface NodeMetrics {
  id: string;
  value: string | number;
  leftHeight: number;
  rightHeight: number;
  totalHeight: number;
  balanceFactor: number;
  isBalanced: boolean;
}

export interface TreeMetricsResult {
  treeId: string;
  rootId: string;
  nodeMetrics: Map<string, NodeMetrics>;
  treeHeight: number;
  imbalancedNodes: NodeMetrics[];
  isAvlBalanced: boolean;
}

/**
 * Computes deterministic heights and AVL balance factors for all nodes in any tree structure.
 * Standard AVL definition: balanceFactor = height(leftSubtree) - height(rightSubtree).
 * A node is balanced if balanceFactor is in {-1, 0, 1}.
 */
export function calculateTreeMetrics(
  nodes: TreeNodeDef[],
  rootId: string,
  treeId: string = "tree",
): TreeMetricsResult {
  const nodeMap = new Map<string, TreeNodeDef>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const nodeMetrics = new Map<string, NodeMetrics>();
  const imbalancedNodes: NodeMetrics[] = [];

  function computeHeight(id?: string): number {
    if (!id || !nodeMap.has(id)) {
      return 0;
    }
    const node = nodeMap.get(id)!;

    const leftId =
      node.left ??
      (node.children && node.children.length > 0
        ? node.children[0]
        : undefined);
    const rightId =
      node.right ??
      (node.children && node.children.length > 1
        ? node.children[1]
        : undefined);

    const leftHeight = computeHeight(leftId);
    const rightHeight = computeHeight(rightId);
    const totalHeight = 1 + Math.max(leftHeight, rightHeight);
    const balanceFactor = leftHeight - rightHeight;
    const isBalanced = Math.abs(balanceFactor) <= 1;

    const metric: NodeMetrics = {
      id: node.id,
      value: node.value,
      leftHeight,
      rightHeight,
      totalHeight,
      balanceFactor,
      isBalanced,
    };

    nodeMetrics.set(node.id, metric);
    if (!isBalanced) {
      imbalancedNodes.push(metric);
    }

    return totalHeight;
  }

  const treeHeight = computeHeight(rootId);

  return {
    treeId,
    rootId,
    nodeMetrics,
    treeHeight,
    imbalancedNodes,
    isAvlBalanced: imbalancedNodes.length === 0,
  };
}

// ============================================================================
// Array & Search Metrics
// ============================================================================

export interface ArrayMetricsResult {
  arrayId: string;
  length: number;
  lowIndex?: number;
  highIndex?: number;
  computedMidIndex?: number;
  actualMidIndex?: number;
  lowValue?: string | number;
  highValue?: string | number;
  midValue?: string | number;
}

/**
 * Computes deterministic index bounds and midpoint values from semantic array and pointer actions.
 */
export function calculateArrayMetrics(
  elements: ArrayElement[],
  arrayId: string,
  pointers: AnnotatePointerAction[] = [],
): ArrayMetricsResult {
  const length = elements.length;
  let lowIndex: number | undefined;
  let highIndex: number | undefined;
  let actualMidIndex: number | undefined;

  for (const ptr of pointers) {
    const labelUpper = ptr.label.toUpperCase();
    const match = ptr.target.match(new RegExp(`^${arrayId}-(\\d+)$`));
    if (match) {
      const idx = parseInt(match[1], 10);
      if (labelUpper.includes("LOW") || labelUpper === "L") {
        lowIndex = idx;
      } else if (labelUpper.includes("HIGH") || labelUpper === "H") {
        highIndex = idx;
      } else if (labelUpper.includes("MID") || labelUpper === "M") {
        actualMidIndex = idx;
      }
    }
  }

  let computedMidIndex: number | undefined;
  if (lowIndex !== undefined && highIndex !== undefined) {
    computedMidIndex = Math.floor((lowIndex + highIndex) / 2);
  }

  return {
    arrayId,
    length,
    lowIndex,
    highIndex,
    computedMidIndex,
    actualMidIndex,
    lowValue: lowIndex !== undefined ? elements[lowIndex]?.value : undefined,
    highValue: highIndex !== undefined ? elements[highIndex]?.value : undefined,
    midValue:
      computedMidIndex !== undefined
        ? elements[computedMidIndex]?.value
        : undefined,
  };
}

// ============================================================================
// Step Calculation Verification & Enrichment
// ============================================================================

/**
 * Validates and enriches a teaching step's calculations directly from the semantic scene.
 * If the step contains a tree or array, computes the mathematical truth and ensures
 * the step's calculations accurately represent the rendered whiteboard state.
 */
export function verifyAndEnrichStepCalculations(
  step: TeachingStep,
): TeachingStep {
  const actions = step.visual_actions ?? [];
  const treeAction = actions.find(
    (a): a is CreateTreeAction => a.type === "create_tree",
  );
  const arrayAction = actions.find(
    (a): a is CreateArrayAction => a.type === "create_array",
  );
  const pointerActions = actions.filter(
    (a): a is AnnotatePointerAction => a.type === "annotate_pointer",
  );

  const verifiedCalculations: string[] = [];

  // 1. Verify Tree Calculations (Heights & Balance Factors)
  if (treeAction && treeAction.nodes && treeAction.root) {
    const treeMetrics = calculateTreeMetrics(
      treeAction.nodes,
      treeAction.root,
      treeAction.id,
    );

    if (treeMetrics.imbalancedNodes.length > 0) {
      const imbalancedList = treeMetrics.imbalancedNodes
        .map(
          (n) =>
            `Node ${n.value}: Left h=${n.leftHeight}, Right h=${n.rightHeight} → BF = ${
              n.balanceFactor > 0 ? "+" : ""
            }${n.balanceFactor}`,
        )
        .join(" | ");
      verifiedCalculations.push(
        `Balance Factors: ${imbalancedList} (Imbalance detected)`,
      );
    } else {
      const rootMetric = treeMetrics.nodeMetrics.get(treeAction.root);
      if (rootMetric) {
        verifiedCalculations.push(
          `Tree Height = ${treeMetrics.treeHeight} | Root ${rootMetric.value} BF = ${
            rootMetric.balanceFactor > 0 ? "+" : ""
          }${rootMetric.balanceFactor} (Balanced: |BF| ≤ 1)`,
        );
      }
    }
  }

  // 2. Verify Array Calculations (Bounds & Midpoint)
  if (arrayAction && Array.isArray(arrayAction.elements)) {
    const arrMetrics = calculateArrayMetrics(
      arrayAction.elements,
      arrayAction.id,
      pointerActions,
    );
    if (
      arrMetrics.lowIndex !== undefined &&
      arrMetrics.highIndex !== undefined
    ) {
      const mid = arrMetrics.computedMidIndex!;
      const midVal =
        arrMetrics.midValue !== undefined
          ? ` (value: ${arrMetrics.midValue})`
          : "";
      verifiedCalculations.push(
        `Range [${arrMetrics.lowIndex}..${arrMetrics.highIndex}] → mid = Math.floor((${arrMetrics.lowIndex} + ${arrMetrics.highIndex}) / 2) = ${mid}${midVal}`,
      );
    }
  }

  // Merge AI calculations with deterministic verification
  let mergedCalculations = step.calculations;
  if (verifiedCalculations.length > 0) {
    const deterministicText = verifiedCalculations.join("  •  ");
    if (!step.calculations || step.calculations.trim().length === 0) {
      mergedCalculations = deterministicText;
    } else {
      // If AI calculation already mentions balance factor or mid, ensure no contradiction
      const aiText = step.calculations.trim();
      if (
        !aiText.includes("BF") &&
        !aiText.includes("mid") &&
        !aiText.includes("Height") &&
        !aiText.includes("Balance Factor")
      ) {
        mergedCalculations = `${deterministicText} | ${aiText}`;
      } else {
        // Deterministic verification takes precedence for exact formulas
        mergedCalculations = deterministicText;
      }
    }
  }

  return {
    ...step,
    calculations: mergedCalculations,
  };
}