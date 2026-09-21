/**
 * Cognora DSA Vocabulary Table
 *
 * Canonical synonym normalization for DSA intent resolution.
 * ALL synonym→canonical mappings live here.
 * No string comparisons should be scattered in other files.
 *
 * Supports:
 * - Action normalization (eliminate → DELETE)
 * - Variant normalization (double linked list → DOUBLY_LINKED_LIST)
 * - Constraint normalization (weighted → WEIGHTED_GRAPH)
 * - Operation normalization (excise → delete)
 */

// ============================================================================
// ACTION SYNONYMS
// Maps various user verbs to canonical action identifiers.
// ============================================================================
export type DSAAction =
  | "EXPLAIN"
  | "INSERT"
  | "DELETE"
  | "SEARCH"
  | "TRACE"
  | "COMPARE"
  | "CODE"
  | "WHY"
  | "SORT"
  | "TRAVERSE"
  | "ROTATE"
  | "VISUALIZE"
  | "BUILD"
  | "RUN"
  | "SHOW";

const ACTION_SYNONYMS: Array<{ patterns: RegExp[]; action: DSAAction }> = [
  {
    patterns: [
      /\b(delet(e|ion|ions?|ed|ing)?|remov(e|al|als?|ed|ing)?|eliminat(e|ion|ions?|ed|ing)?|excis(e|ion|ions?|ed)?|eras(e|ure|ed)?|drop|del)\b/i,
    ],
    action: "DELETE",
  },
  {
    patterns: [
      /\b(insert(ion|ions?|ed|ing)?|add(ing|ed|ition|itions?)?|append(ing|ed)?|prepend(ing|ed)?|push(ing|ed)?|enqueue(d|ing)?|put)\b/i,
    ],
    action: "INSERT",
  },
  {
    patterns: [
      /\b(search|find|lookup|locate|query|look for)\b/i,
    ],
    action: "SEARCH",
  },
  {
    patterns: [
      /\b(sort|order|arrange|partition)\b/i,
    ],
    action: "SORT",
  },
  {
    patterns: [
      /\b(traverse|walk|visit|iteration)\b/i,
    ],
    action: "TRAVERSE",
  },
  {
    patterns: [
      /\b(rotate|rotation|rebalance|balance)\b/i,
    ],
    action: "ROTATE",
  },
  {
    patterns: [
      /\b(trace|step[ -]through|walk[ -]through|trace through)\b/i,
    ],
    action: "TRACE",
  },
  {
    patterns: [
      /\b(compare|versus|vs\.?|contrast|difference between|vs)\b/i,
    ],
    action: "COMPARE",
  },
  {
    patterns: [
      /\b(code|implement|implementation|write code|show code|give code|program)\b/i,
    ],
    action: "CODE",
  },
  {
    patterns: [
      /\b(why|how come|reason|cause of)\b/i,
    ],
    action: "WHY",
  },
  {
    patterns: [
      /\b(visualize|draw|diagram|animate|illustrate)\b/i,
    ],
    action: "VISUALIZE",
  },
  {
    patterns: [
      /\b(build|construct|create|make)\b/i,
    ],
    action: "BUILD",
  },
  {
    patterns: [
      /\b(run|execute|apply|perform)\b/i,
    ],
    action: "RUN",
  },
  {
    patterns: [
      /\b(show|demonstrate|demo)\b/i,
    ],
    action: "SHOW",
  },
  // EXPLAIN is the default / catch-all for teaching requests
  {
    patterns: [
      /\b(explain|teach|how does|what is|what are|how do|describe|overview of)\b/i,
    ],
    action: "EXPLAIN",
  },
];

// ============================================================================
// VARIANT SYNONYMS
// Maps user phrases to canonical variant identifiers.
// ============================================================================
export type DSAVariant =
  | "SINGLY_LINKED_LIST"
  | "DOUBLY_LINKED_LIST"
  | "CIRCULAR_LINKED_LIST"
  | "MAX_HEAP"
  | "MIN_HEAP"
  | "WEIGHTED_GRAPH"
  | "UNWEIGHTED_GRAPH"
  | "DIRECTED_GRAPH"
  | "UNDIRECTED_GRAPH"
  | "RECURSIVE"
  | "ITERATIVE"
  | "ASCENDING"
  | "DESCENDING"
  | "NEGATIVE_EDGES"
  | "UNSORTED_INPUT"
  | "DEFAULT";

const VARIANT_SYNONYMS: Array<{ patterns: RegExp[]; variant: DSAVariant }> = [
  // Doubly Linked List variants (check BEFORE generic linked list)
  {
    patterns: [
      /\b(doubly[ -]?linked[ -]?list|double[ -]?linked[ -]?list|dll|doubly linked|double linked)\b/i,
    ],
    variant: "DOUBLY_LINKED_LIST",
  },
  // Circular Linked List variants (check BEFORE generic linked list)
  {
    patterns: [
      /\b(circular[ -]?linked[ -]?list|circular list)\b/i,
    ],
    variant: "CIRCULAR_LINKED_LIST",
  },
  // Singly Linked List (explicit)
  {
    patterns: [
      /\b(singly[ -]?linked[ -]?list|single[ -]?linked[ -]?list|sll)\b/i,
    ],
    variant: "SINGLY_LINKED_LIST",
  },
  // Heap variants
  {
    patterns: [
      /\b(max[ -]?heap|maximum heap)\b/i,
    ],
    variant: "MAX_HEAP",
  },
  {
    patterns: [
      /\b(min[ -]?heap|minimum heap)\b/i,
    ],
    variant: "MIN_HEAP",
  },
  // Graph variants
  {
    patterns: [
      /\b(weighted graph|with weights|weight graph)\b/i,
    ],
    variant: "WEIGHTED_GRAPH",
  },
  {
    patterns: [
      /\b(unweighted graph|without weights)\b/i,
    ],
    variant: "UNWEIGHTED_GRAPH",
  },
  {
    patterns: [
      /\b(directed graph|digraph)\b/i,
    ],
    variant: "DIRECTED_GRAPH",
  },
  {
    patterns: [
      /\b(undirected graph)\b/i,
    ],
    variant: "UNDIRECTED_GRAPH",
  },
  // Algorithm variants
  {
    patterns: [
      /\b(recursive|recursively|using recursion)\b/i,
    ],
    variant: "RECURSIVE",
  },
  {
    patterns: [
      /\b(iterative|iteratively|using iteration|non[ -]?recursive)\b/i,
    ],
    variant: "ITERATIVE",
  },
  // Sort variants
  {
    patterns: [
      /\b(descending|decreasing order|reverse order)\b/i,
    ],
    variant: "DESCENDING",
  },
  {
    patterns: [
      /\b(ascending|increasing order)\b/i,
    ],
    variant: "ASCENDING",
  },
  // NOTE: NEGATIVE_EDGES and UNSORTED_INPUT are NOT variants — they are constraints.
  // They are detected via constraints.negativeEdges and constraints.unsortedInput
  // in resolveDSAFullIntent(), NOT via resolveVariant().
  // This ensures binary-search + unsorted returns UNSUPPORTED_CONSTRAINT, not UNSUPPORTED_VARIANT.

];

// ============================================================================
// OPERATION SYNONYMS
// Maps user words to canonical operation names (used in capability matching).
// ============================================================================
export type DSAOperation =
  | "insert"
  | "delete"
  | "search"
  | "traverse"
  | "rotate"
  | "sort"
  | "shortest_path"
  | "heapify"
  | "peek"
  | "explain";  // generic "explain" with no specific operation

const OPERATION_SYNONYMS: Array<{ patterns: RegExp[]; operation: DSAOperation }> = [
  {
    // Covers: delete, deletion, remove, removal, eliminate, elimination, excise, erase, drop
    patterns: [/\b(delet(e|ion|ions?|ed|ing)?|remov(e|al|als?|ed|ing)?|eliminat(e|ion|ions?|ed|ing)?|excis(e|ion|ions?|ed)?|eras(e|ure|ed)?|drop|del)\b/i],
    operation: "delete",
  },
  {
    // Covers: insert, insertion, add, append, prepend, push, enqueue, put
    patterns: [/\b(insert(ion|ions?|ed|ing)?|add(ing|ed|ition|itions?)?|append(ing|ed)?|prepend(ing|ed)?|push(ing|ed)?|enqueue(d|ing)?|put)\b/i],
    operation: "insert",
  },
  // shortest_path must come BEFORE search because 'find' in 'find shortest paths'
  // would otherwise match the 'search' entry via the 'find' keyword.
  {
    patterns: [/\b(shortest[ -]?paths?|single[ -]?source[ -]?shortest|relax(ation)?)\b/i],
    operation: "shortest_path",
  },
  {
    patterns: [/\b(search(ing|ed)?|find|lookup|locate|query|look for)\b/i],
    operation: "search",
  },
  {
    patterns: [/\b(travers(e|al|als?|ed|ing)?|walk(ing|ed)?|visit(ing|ed|s)?)\b/i],
    operation: "traverse",
  },
  {
    // Covers: rotate, rotation, rotations, rebalance
    patterns: [/\b(rotat(e|ion|ions?|ed|ing)?|rebalanc(e|ing|ed)?)\b/i],
    operation: "rotate",
  },
  {
    patterns: [/\b(sort(ing|ed|s)?|order(ing|ed)?|partition(ing|ed)?|merge sort|quick sort|bubble sort)\b/i],
    operation: "sort",
  },
  {
    patterns: [/\b(heapif(y|ied|ying)|sift|bubble up|sift up|extract)\b/i],
    operation: "heapify",
  },
  {
    patterns: [/\b(peek|top|front|rear)\b/i],
    operation: "peek",
  },
];

// ============================================================================
// PUBLIC RESOLUTION FUNCTIONS
// ============================================================================

/**
 * Resolves the primary action from a prompt.
 * Returns the first matching action in priority order (DELETE before EXPLAIN etc.)
 */
export function resolveAction(prompt: string): DSAAction {
  for (const { patterns, action } of ACTION_SYNONYMS) {
    if (patterns.some((p) => p.test(prompt))) {
      return action;
    }
  }
  return "EXPLAIN";
}

/**
 * Resolves the variant from a prompt. Returns undefined if no variant detected.
 * Checks in specificity order (doubly/circular before generic singly).
 */
export function resolveVariant(prompt: string): DSAVariant | undefined {
  for (const { patterns, variant } of VARIANT_SYNONYMS) {
    if (patterns.some((p) => p.test(prompt))) {
      return variant;
    }
  }
  return undefined;
}

/**
 * Resolves the canonical operation from a prompt.
 * Similar to resolveAction but maps to operation names used in capability matching.
 */
export function resolveOperation(prompt: string): DSAOperation | undefined {
  for (const { patterns, operation } of OPERATION_SYNONYMS) {
    if (patterns.some((p) => p.test(prompt))) {
      return operation;
    }
  }
  return undefined;
}

/**
 * Checks if prompt contains a generic concept mention with no specific operation/variant.
 * Used to determine if the default dataset is acceptable.
 */
export function isGenericExplainRequest(prompt: string): boolean {
  const hasSpecificOp = resolveOperation(prompt);
  const hasVariant = resolveVariant(prompt);
  // Generic explain: no specific operation AND no variant qualifier
  return !hasSpecificOp && !hasVariant;
}
