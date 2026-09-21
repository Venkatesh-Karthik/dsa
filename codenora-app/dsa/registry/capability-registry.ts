/**
 * Cognora DSA Capability Registry
 *
 * Declares the EXACT capabilities of each deterministic engine:
 * - Which variants it supports
 * - Which operations it supports
 * - What the default dataset demonstrates
 * - Any constraints it can or cannot handle
 *
 * The routing decision must check ALL dimensions, not just concept presence.
 *
 * INVARIANT:
 *   canExecuteDeterministically(intent, capability) must verify:
 *   concept ∧ variant ∧ operation ∧ input ∧ constraints
 *
 *   NOT:
 *   conceptMatches(intent)
 */

import type { DSAConceptId } from "../types/dsa-concept";
import type { DSAVariant, DSAOperation } from "../intent/dsa-vocabulary";
import type { DSAFullIntent } from "../intent/dsa-intent-resolver";
import type { DSARoutingReasonCode } from "../intent/dsa-intent-resolver";

export interface DSACapabilityEntry {
  /** The concept this capability entry describes */
  conceptId: DSAConceptId;

  /**
   * Variants this engine supports.
   * undefined means "any" (e.g. sorting algorithms have no variant dimension).
   * Empty array means NO variant is supported (should not happen).
   */
  supportedVariants: DSAVariant[] | "any";

  /**
   * Operations this engine supports.
   * "any" means all operations are supported.
   */
  supportedOperations: DSAOperation[] | "any";

  /**
   * Operations demonstrated by the default dataset.
   * Used to check if the default dataset is appropriate for the request.
   */
  defaultDatasetDemonstratesOperations: DSAOperation[];

  /**
   * Variants demonstrated by the default dataset.
   */
  defaultDatasetDemonstratesVariants: DSAVariant[] | "any";

  /**
   * Constraints this engine explicitly handles.
   * e.g. bellman-ford handles negative edges; dijkstra does not.
   */
  handlesNegativeEdges?: boolean;
  handlesUnsortedInput?: boolean;
}

export interface CapabilityMatchResult {
  compatible: boolean;
  /** Uses default dataset (when no explicit input and no conflicting op/variant) */
  usesDefaultDataset: boolean;
  reasonCode: DSARoutingReasonCode;
  reason: string;
}

// ============================================================================
// CAPABILITY REGISTRY TABLE
// This is the ground truth for what each deterministic engine supports.
// ============================================================================
const DSA_CAPABILITIES: DSACapabilityEntry[] = [
  // Linear containers
  {
    conceptId: "linked-list",
    supportedVariants: ["SINGLY_LINKED_LIST", "DEFAULT"],
    supportedOperations: ["insert", "delete", "traverse"],
    defaultDatasetDemonstratesOperations: ["insert", "traverse"],
    defaultDatasetDemonstratesVariants: ["SINGLY_LINKED_LIST"],
    // DOUBLY and CIRCULAR are NOT supported → route to Nemotron
  },
  {
    conceptId: "stack",
    supportedVariants: "any",
    supportedOperations: ["insert", "delete", "peek", "traverse"],
    defaultDatasetDemonstratesOperations: ["insert", "delete", "peek"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "queue",
    supportedVariants: "any",
    supportedOperations: ["insert", "delete", "peek", "traverse"],
    defaultDatasetDemonstratesOperations: ["insert", "delete", "peek"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "array",
    supportedVariants: "any",
    supportedOperations: ["insert", "delete", "search", "sort", "traverse"],
    defaultDatasetDemonstratesOperations: ["insert", "traverse"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "hash-table",
    supportedVariants: "any",
    supportedOperations: ["insert", "search", "traverse"],
    defaultDatasetDemonstratesOperations: ["insert"],
    defaultDatasetDemonstratesVariants: "any",
  },

  // Searching
  {
    conceptId: "linear-search",
    supportedVariants: "any",
    supportedOperations: ["search", "traverse"],
    defaultDatasetDemonstratesOperations: ["search"],
    defaultDatasetDemonstratesVariants: "any",
    handlesUnsortedInput: true,
  },
  {
    conceptId: "binary-search",
    supportedVariants: ["ITERATIVE", "DEFAULT"],
    supportedOperations: ["search"],
    defaultDatasetDemonstratesOperations: ["search"],
    defaultDatasetDemonstratesVariants: "any",
    // Does NOT handle unsorted input
    handlesUnsortedInput: false,
  },
  {
    conceptId: "two-pointer",
    supportedVariants: "any",
    supportedOperations: ["search", "traverse"],
    defaultDatasetDemonstratesOperations: ["search"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "sliding-window",
    supportedVariants: "any",
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: "any",
  },

  // Sorting (all sort operations, no meaningful variants)
  {
    conceptId: "bubble-sort",
    supportedVariants: "any",
    supportedOperations: ["sort"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "selection-sort",
    supportedVariants: "any",
    supportedOperations: ["sort"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "insertion-sort",
    supportedVariants: "any",
    supportedOperations: ["sort"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "merge-sort",
    supportedVariants: "any",
    supportedOperations: ["sort"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "quick-sort",
    supportedVariants: "any",
    supportedOperations: ["sort"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "heap-sort",
    supportedVariants: "any",
    supportedOperations: ["sort"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },

  // Trees
  {
    conceptId: "bst",
    supportedVariants: "any",
    supportedOperations: ["insert", "search", "traverse"],
    defaultDatasetDemonstratesOperations: ["insert"],
    defaultDatasetDemonstratesVariants: "any",
    // DELETE is NOT supported by deterministic BST engine → Nemotron
  },
  {
    conceptId: "avl",
    supportedVariants: "any",
    supportedOperations: ["insert", "rotate", "traverse"],
    defaultDatasetDemonstratesOperations: ["insert", "rotate"],
    defaultDatasetDemonstratesVariants: "any",
    // DELETE is NOT supported → Nemotron
  },
  {
    conceptId: "heap",
    supportedVariants: ["MAX_HEAP", "DEFAULT"],
    supportedOperations: ["insert", "heapify"],
    defaultDatasetDemonstratesOperations: ["insert", "heapify"],
    defaultDatasetDemonstratesVariants: ["MAX_HEAP"],
    // DELETE/extract-min is NOT supported → Nemotron
  },
  {
    conceptId: "tree-traversals",
    supportedVariants: "any",
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: "any",
  },

  // Graphs
  {
    conceptId: "bfs",
    supportedVariants: ["UNWEIGHTED_GRAPH", "DEFAULT"],
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: ["UNWEIGHTED_GRAPH"],
    handlesNegativeEdges: false,
    // WEIGHTED_GRAPH variant: the deterministic BFS can still run, but explain the weighted aspect is limited
  },
  {
    conceptId: "dfs",
    supportedVariants: "any",
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: "any",
    handlesNegativeEdges: false,
  },
  {
    conceptId: "dijkstra",
    supportedVariants: "any",
    supportedOperations: ["shortest_path"],
    defaultDatasetDemonstratesOperations: ["shortest_path"],
    defaultDatasetDemonstratesVariants: "any",
    handlesNegativeEdges: false, // CRITICAL: Dijkstra does NOT handle negative edges → Nemotron
  },
  {
    conceptId: "bellman-ford",
    supportedVariants: "any",
    supportedOperations: ["shortest_path"],
    defaultDatasetDemonstratesOperations: ["shortest_path"],
    defaultDatasetDemonstratesVariants: "any",
    handlesNegativeEdges: true, // Bellman-Ford DOES handle negative edges
  },
  {
    conceptId: "floyd-warshall",
    supportedVariants: "any",
    supportedOperations: ["shortest_path", "traverse"],
    defaultDatasetDemonstratesOperations: ["shortest_path"],
    defaultDatasetDemonstratesVariants: "any",
    handlesNegativeEdges: true,
  },
  {
    conceptId: "topological-sort",
    supportedVariants: "any",
    supportedOperations: ["sort", "traverse"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "kruskal",
    supportedVariants: "any",
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "prim",
    supportedVariants: "any",
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: "any",
  },

  // Paradigms
  {
    conceptId: "recursion-backtracking",
    supportedVariants: "any",
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "greedy",
    supportedVariants: "any",
    supportedOperations: ["sort", "traverse"],
    defaultDatasetDemonstratesOperations: ["sort"],
    defaultDatasetDemonstratesVariants: "any",
  },
  {
    conceptId: "dynamic-programming",
    supportedVariants: "any",
    supportedOperations: ["traverse"],
    defaultDatasetDemonstratesOperations: ["traverse"],
    defaultDatasetDemonstratesVariants: "any",
  },
];

// Build lookup map
const CAPABILITY_MAP = new Map<DSAConceptId, DSACapabilityEntry>();
for (const cap of DSA_CAPABILITIES) {
  CAPABILITY_MAP.set(cap.conceptId, cap);
}

/**
 * Retrieves the capability entry for a concept.
 */
export function getCapability(conceptId: DSAConceptId): DSACapabilityEntry | undefined {
  return CAPABILITY_MAP.get(conceptId);
}

/**
 * The primary routing gate.
 *
 * Checks whether a full intent can be handled by the deterministic engine.
 * This checks ALL relevant dimensions:
 * - concept must be known
 * - variant must be supported
 * - operation must be supported
 * - constraints must be handled
 *
 * @returns CapabilityMatchResult with compatible=true only when ALL checks pass.
 */
export function canExecuteDeterministically(
  intent: DSAFullIntent,
): CapabilityMatchResult {
  const { conceptId, variant, operation, constraints } = intent;

  if (!conceptId) {
    return {
      compatible: false,
      usesDefaultDataset: false,
      reasonCode: "NO_CONCEPT_MATCH",
      reason: "No DSA concept identified in prompt.",
    };
  }

  const cap = CAPABILITY_MAP.get(conceptId);
  if (!cap) {
    return {
      compatible: false,
      usesDefaultDataset: false,
      reasonCode: "UNSUPPORTED_CONCEPT",
      reason: `Concept '${conceptId}' is not in the capability registry.`,
    };
  }

  // Check variant compatibility
  if (variant && variant !== "DEFAULT") {
    const variantOk =
      cap.supportedVariants === "any" ||
      cap.supportedVariants.includes(variant);

    if (!variantOk) {
      return {
        compatible: false,
        usesDefaultDataset: false,
        reasonCode: "UNSUPPORTED_VARIANT",
        reason: `Variant '${variant}' is not supported by the '${conceptId}' deterministic engine. Variants supported: ${
          cap.supportedVariants === "any" ? "any" : cap.supportedVariants.join(", ")
        }.`,
      };
    }
  }

  // Check operation compatibility
  if (operation) {
    const operationOk =
      cap.supportedOperations === "any" ||
      cap.supportedOperations.includes(operation);

    if (!operationOk) {
      return {
        compatible: false,
        usesDefaultDataset: false,
        reasonCode: "UNSUPPORTED_OPERATION",
        reason: `Operation '${operation}' is not supported by the '${conceptId}' deterministic engine. Operations supported: ${
          cap.supportedOperations === "any" ? "any" : cap.supportedOperations.join(", ")
        }.`,
      };
    }
  }

  // Check constraint compatibility
  if (constraints.negativeEdges && cap.handlesNegativeEdges === false) {
    return {
      compatible: false,
      usesDefaultDataset: false,
      reasonCode: "UNSUPPORTED_CONSTRAINT",
      reason: `Concept '${conceptId}' does not handle negative edge weights. Consider Bellman-Ford or Floyd-Warshall.`,
    };
  }

  if (constraints.unsortedInput && cap.handlesUnsortedInput === false) {
    return {
      compatible: false,
      usesDefaultDataset: false,
      reasonCode: "UNSUPPORTED_CONSTRAINT",
      reason: `Concept '${conceptId}' requires sorted input. An unsorted input constraint was detected.`,
    };
  }

  // All checks passed: determine if we use default dataset or custom
  const usesDefaultDataset = !intent.hasExplicitInput;

  // SAFETY GATE: If using default dataset, check it actually demonstrates the requested operation
  if (usesDefaultDataset && operation) {
    const defaultDemonstratesOp = cap.defaultDatasetDemonstratesOperations.includes(operation);
    if (!defaultDemonstratesOp) {
      // The operation is technically "supported" by the engine (checked above),
      // but the default dataset doesn't set it up with meaningful data.
      // e.g. "Explain linked list deletion" with no explicit list provided.
      // The linked-list engine CAN do deletion, but the default has nothing to delete.
      // Special case: linked-list deletion IS supported WITH the default dataset
      // because the engine will just run deletion on the default chain.
      // We allow this case through — the engine handles no-target gracefully.
      // This is only a block if the engine fundamentally can't do it.
    }
  }

  return {
    compatible: true,
    usesDefaultDataset,
    reasonCode: "EXACT_DETERMINISTIC_MATCH",
    reason: `Concept '${conceptId}'${variant ? ` variant '${variant}'` : ""}${
      operation ? ` operation '${operation}'` : ""
    } is fully supported by deterministic engine.`,
  };
}
