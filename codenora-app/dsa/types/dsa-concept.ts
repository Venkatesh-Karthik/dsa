/**
 * Cognora DSA Acceleration Layer - Concept Types & Configuration
 *
 * Defines the strongly typed identifiers, categories, metadata,
 * and per-concept limits for deterministic algorithm execution.
 *
 * NOTE: This is an isolated, temporary hackathon acceleration layer.
 */

export type DSAConceptId =
  // Linear & Containers
  | "array"
  | "linked-list"
  | "stack"
  | "queue"
  | "hash-table"
  // Searching & Pointers
  | "linear-search"
  | "binary-search"
  | "two-pointer"
  | "sliding-window"
  // Sorting
  | "bubble-sort"
  | "selection-sort"
  | "insertion-sort"
  | "merge-sort"
  | "quick-sort"
  | "heap-sort"
  // Trees & Heaps
  | "bst"
  | "avl"
  | "heap"
  | "tree-traversals"
  // Graphs
  | "bfs"
  | "dfs"
  | "dijkstra"
  | "bellman-ford"
  | "floyd-warshall"
  | "topological-sort"
  | "kruskal"
  | "prim"
  // Algorithmic Paradigms
  | "recursion-backtracking"
  | "greedy"
  | "dynamic-programming";

export type DSAConceptCategory =
  | "linear"
  | "tree"
  | "graph"
  | "sorting"
  | "searching"
  | "container"
  | "technique"
  | "advanced";

export interface DSAInputLimits {
  /** Maximum number of values or elements allowed in input */
  maxElements: number;
  /** Maximum number of nodes (for graphs / trees) */
  maxNodes: number;
  /** Maximum number of edges */
  maxEdges: number;
  /** Maximum number of algorithm steps generated */
  maxOperations: number;
}

export interface DSAConceptRegistration {
  id: DSAConceptId;
  displayName: string;
  category: DSAConceptCategory;
  aliases: string[];
  supported: boolean;
  description: string;
  defaultLimits: DSAInputLimits;
  teachingGoal: string;
}

/**
 * Result of resolving a user prompt to a DSA concept.
 * Extended to include variant, action, and operation for full-intent routing.
 *
 * IMPORTANT: conceptId alone is NOT sufficient for routing.
 * All dimensions (conceptId + variant + operationIntent) must be checked.
 */
export interface ResolvedConcept {
  /** The resolved DSA concept ID */
  conceptId: DSAConceptId;
  /** Confidence score (0–1) */
  confidence: number;
  /** The alias terms that triggered the match */
  matchedTerms: string[];
  /**
   * Canonical operation detected from user prompt.
   * e.g. "delete", "insert", "rotate", "search"
   * NOTE: This is detected but does NOT gate routing by itself —
   * use canExecuteDeterministically() from capability-registry.ts.
   */
  operationIntent?: string;
  /**
   * Canonical variant detected from user prompt.
   * e.g. "DOUBLY_LINKED_LIST", "MAX_HEAP", "WEIGHTED_GRAPH"
   * If present, routing MUST verify the engine supports this variant.
   */
  variantIntent?: string;
  /**
   * Raw input candidate (e.g. bracketed expression "[10,20,30]")
   */
  rawInputCandidate?: string;
}
