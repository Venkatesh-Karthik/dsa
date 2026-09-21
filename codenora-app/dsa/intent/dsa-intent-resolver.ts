/**
 * Cognora DSA Full-Intent Resolver
 *
 * Resolves a user prompt into a structured DSAFullIntent object BEFORE
 * any routing decision is made.
 *
 * This is the architectural fix for concept-only routing:
 * Instead of "does prompt contain 'linked list'?", we ask:
 * "What EXACTLY is the user asking me to teach?"
 *
 * Resolution order:
 * 1. concept (via DSAConceptResolver existing logic)
 * 2. variant (via vocabulary table – DOUBLY, CIRCULAR, etc.)
 * 3. operation (via vocabulary table – delete, insert, rotate, etc.)
 * 4. action (via vocabulary table – EXPLAIN, DELETE, INSERT, etc.)
 * 5. input/target (via existing DSAInputExtractor)
 * 6. constraints (NEGATIVE_EDGES, UNSORTED_INPUT, etc.)
 * 7. request flags (visualize, code, stepByStep)
 *
 * Zero LLM calls. Runs in < 2ms.
 */

import type { DSAConceptId } from "../types/dsa-concept";
import {
  type DSAAction,
  type DSAVariant,
  type DSAOperation,
  resolveAction,
  resolveVariant,
  resolveOperation,
} from "./dsa-vocabulary";

export type DSARoutingReasonCode =
  | "EXACT_DETERMINISTIC_MATCH"
  | "UNSUPPORTED_VARIANT"
  | "UNSUPPORTED_OPERATION"
  | "UNSUPPORTED_INPUT"
  | "UNSUPPORTED_CONSTRAINT"
  | "AMBIGUOUS_INTENT"
  | "UNSUPPORTED_CONCEPT"
  | "DYNAMIC_CONCEPT"
  | "NO_CONCEPT_MATCH"
  | "INPUT_ERROR"
  | "EXECUTION_ERROR"
  | "MALFORMED_INPUT";

export interface DSAFullIntent {
  /** The raw user prompt */
  rawPrompt: string;

  /** Normalized prompt for matching */
  normalizedPrompt: string;

  /** Primary teaching action (EXPLAIN, INSERT, DELETE, etc.) */
  action: DSAAction;

  /** Resolved DSA concept ID (e.g. "linked-list", "avl") */
  conceptId: DSAConceptId | null;

  /** Resolved variant (e.g. DOUBLY_LINKED_LIST, MAX_HEAP) */
  variant: DSAVariant | undefined;

  /** Resolved canonical operation (e.g. "delete", "insert", "rotate") */
  operation: DSAOperation | undefined;

  /** Whether user provided explicit input values */
  hasExplicitInput: boolean;

  /** Whether operation conflicts with default dataset purpose */
  conflictsWithDefault: boolean;

  /** Detected constraint modifiers */
  constraints: {
    negativeEdges: boolean;
    unsortedInput: boolean;
    weighted: boolean;
  };

  /** What the user wants to receive */
  requestedVisualization: boolean;
  requestedExplanation: boolean;
  requestedCode: boolean;
  requestedStepByStep: boolean;

  /** Confidence in the resolution */
  confidence: number;
}

/**
 * Resolves a user prompt into a full structured intent.
 * This is the single source of truth for routing decisions.
 */
export function resolveDSAFullIntent(prompt: string, explicitConceptId?: DSAConceptId | null): DSAFullIntent {
  const normalized = prompt
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/->/g, "→") // Preserve -> as → before stripping
    .replace(/[^\w\s\-,.\[\]→]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Resolve dimensions via vocabulary table (use original prompt for regex matching)
  const action = resolveAction(prompt);
  const variant = resolveVariant(prompt);
  const operation = resolveOperation(prompt);

  // Resolve concept ID — use explicitConceptId if provided, otherwise resolve from prompt
  const conceptId = explicitConceptId !== undefined ? explicitConceptId : resolveConceptIdFromPrompt(prompt);

  // Detect explicit input
  const hasExplicitInput =
    /\[[\s\d,\-.]+\]/.test(prompt) ||
    /\d+\s*(?:->|→)\s*\d+/.test(prompt) ||
    /\b(?:using|with|values?|elements?)\s+[-\d\s,]+/.test(prompt);

  // Detect constraints
  const negativeEdges = /\b(negative edges?|negative weights?|negative cycle|with negative)\b/i.test(prompt);
  const unsortedInput = /\b(unsorted|unordered|not sorted)\b/i.test(prompt);
  const weighted = /\bweighted\b/i.test(prompt);

  // Detect what user wants
  const requestedVisualization =
    /\b(visualize|draw|diagram|animate|illustrate|visually)\b/i.test(prompt);
  const requestedCode =
    /\b(code|implement|implementation|write code|show code|give code)\b/i.test(prompt);
  const requestedStepByStep =
    /\b(step by step|step-by-step|each step|walk me through)\b/i.test(prompt);
  const requestedExplanation =
    /\b(explain|teach|understand|learn|what is|how does|how do)\b/i.test(prompt) || action === "EXPLAIN";

  // Check if operation conflicts with what the default dataset demonstrates
  const conflictsWithDefault = computeDefaultConflict(conceptId, operation, variant);

  return {
    rawPrompt: prompt,
    normalizedPrompt: normalized,
    action,
    conceptId,
    variant,
    operation,
    hasExplicitInput,
    conflictsWithDefault,
    constraints: {
      negativeEdges,
      unsortedInput,
      weighted,
    },
    requestedVisualization,
    requestedExplanation,
    requestedCode,
    requestedStepByStep,
    confidence: 0.9,
  };
}

/**
 * Lightweight concept ID resolver (inline, no dependency on full DSAConceptResolver).
 * Uses the same logic as DSAConceptResolver but returns just the conceptId.
 * The full resolver is used in the router for score-based matching.
 */
function resolveConceptIdFromPrompt(normalized: string): DSAConceptId | null {
  // Quick concept keyword detection in priority order
  // (Same keywords as the full resolver, but faster for conflict-check purposes)
  if (/\b(doubly|double)[-\s]?linked[-\s]?list\b/i.test(normalized)) {
    return "linked-list"; // concept = linked-list, but variant = DOUBLY
  }
  if (/\b(circular[-\s]?linked[-\s]?list)\b/i.test(normalized)) {
    return "linked-list"; // concept = linked-list, but variant = CIRCULAR
  }
  if (/\b(linked[-\s]?list|linkedlist)\b/i.test(normalized)) {
    return "linked-list";
  }
  if (/\b(avl|avl[-\s]?tree|avl[-\s]?rotation)\b/i.test(normalized)) {
    return "avl";
  }
  if (/\b(binary[-\s]?search[-\s]?tree|bst)\b/i.test(normalized)) {
    return "bst";
  }
  if (/\b(binary[-\s]?search|bsearch|bisect)\b/i.test(normalized)) {
    return "binary-search";
  }
  if (/\b(heap|binary[-\s]?heap|max[-\s]?heap|min[-\s]?heap|priority[-\s]?queue)\b/i.test(normalized)) {
    return "heap";
  }
  if (/\b(quick[-\s]?sort|quicksort|qsort)\b/i.test(normalized)) {
    return "quick-sort";
  }
  if (/\b(merge[-\s]?sort|mergesort)\b/i.test(normalized)) {
    return "merge-sort";
  }
  if (/\b(bubble[-\s]?sort|bubblesort)\b/i.test(normalized)) {
    return "bubble-sort";
  }
  if (/\b(selection[-\s]?sort|selectionsort)\b/i.test(normalized)) {
    return "selection-sort";
  }
  if (/\b(insertion[-\s]?sort|insertionsort)\b/i.test(normalized)) {
    return "insertion-sort";
  }
  if (/\b(heap[-\s]?sort|heapsort)\b/i.test(normalized)) {
    return "heap-sort";
  }
  if (/\b(bellman[-\s]?ford)\b/i.test(normalized)) {
    return "bellman-ford";
  }
  if (/\b(dijkstra)\b/i.test(normalized)) {
    return "dijkstra";
  }
  if (/\b(floyd[-\s]?warshall|all[-\s]?pairs)\b/i.test(normalized)) {
    return "floyd-warshall";
  }
  if (/\b(breadth[-\s]?first|bfs)\b/i.test(normalized)) {
    return "bfs";
  }
  if (/\b(depth[-\s]?first|dfs)\b/i.test(normalized)) {
    return "dfs";
  }
  if (/\b(topological[-\s]?sort|toposort|kahn)\b/i.test(normalized)) {
    return "topological-sort";
  }
  if (/\b(kruskal)\b/i.test(normalized)) {
    return "kruskal";
  }
  if (/\b(prim)\b/i.test(normalized)) {
    return "prim";
  }
  if (/\b(stack|lifo)\b/i.test(normalized)) {
    return "stack";
  }
  if (/\b(queue|fifo|dequeue)\b/i.test(normalized)) {
    return "queue";
  }
  if (/\b(array)\b/i.test(normalized)) {
    return "array";
  }
  if (/\b(hash[-\s]?table|hash[-\s]?map|hashmap|hashing)\b/i.test(normalized)) {
    return "hash-table";
  }
  if (/\b(linear[-\s]?search|sequential[-\s]?search)\b/i.test(normalized)) {
    return "linear-search";
  }
  if (/\b(tree[-\s]?traversal|inorder|preorder|postorder|level[-\s]?order)\b/i.test(normalized)) {
    return "tree-traversals";
  }
  if (/\b(two[-\s]?pointer)\b/i.test(normalized)) {
    return "two-pointer";
  }
  if (/\b(sliding[-\s]?window)\b/i.test(normalized)) {
    return "sliding-window";
  }
  if (/\b(dynamic[-\s]?programming|dp|memoization|tabulation)\b/i.test(normalized)) {
    return "dynamic-programming";
  }
  if (/\b(greedy)\b/i.test(normalized)) {
    return "greedy";
  }
  if (/\b(recursion|backtracking)\b/i.test(normalized)) {
    return "recursion-backtracking";
  }
  // Arrow-chain syntax recognition for linked lists (e.g. 10 -> 20 -> 30) as fallback
  // Only evaluated if no named concept matched, preventing graph edge specifications (e.g. A→B=4) from misclassifying
  if (/(?:\d+|[a-zA-Z])\s*(?:->|→)\s*(?:\d+|[a-zA-Z])/.test(normalized)) {
    return "linked-list";
  }
  return null;
}

/**
 * Determines whether the resolved operation conflicts with what the default
 * dataset for this concept demonstrates. Used to block silent downgrade.
 */
function computeDefaultConflict(
  conceptId: DSAConceptId | null,
  operation: DSAOperation | undefined,
  variant: DSAVariant | undefined,
): boolean {
  if (!conceptId || !operation) {
    return false; // No conflict if no specific operation
  }

  // Default dataset demonstrations per concept:
  const defaultDemonstratesOps: Partial<Record<DSAConceptId, DSAOperation[]>> = {
    "linked-list": ["insert", "traverse"],
    "avl": ["insert", "rotate"],
    "bst": ["insert"],
    "heap": ["insert"],
    "binary-search": ["search"],
    "stack": ["insert"],
    "queue": ["insert"],
    "array": ["insert"],
    // Sorting: all demonstrate sort
    "bubble-sort": ["sort"],
    "selection-sort": ["sort"],
    "insertion-sort": ["sort"],
    "merge-sort": ["sort"],
    "quick-sort": ["sort"],
    "heap-sort": ["sort"],
    // Graph: traverse / shortest_path
    "bfs": ["traverse"],
    "dfs": ["traverse"],
    "dijkstra": ["shortest_path"],
    "bellman-ford": ["shortest_path"],
    "floyd-warshall": ["shortest_path"],
    "topological-sort": ["traverse"],
    "kruskal": ["traverse"],
    "prim": ["traverse"],
  };

  const supportedOps = defaultDemonstratesOps[conceptId];
  if (!supportedOps) return false;

  return !supportedOps.includes(operation);
}

/**
 * Formats the full intent as a structured log string (dev-only, not exposed to user).
 */
export function formatIntentLog(intent: DSAFullIntent): string {
  return [
    `[COGNORA][INTENT]`,
    `  rawPrompt="${intent.rawPrompt}"`,
    `  action=${intent.action}`,
    `  conceptId=${intent.conceptId ?? "NONE"}`,
    `  variant=${intent.variant ?? "DEFAULT"}`,
    `  operation=${intent.operation ?? "NONE"}`,
    `  hasExplicitInput=${intent.hasExplicitInput}`,
    `  conflictsWithDefault=${intent.conflictsWithDefault}`,
    `  constraints.negativeEdges=${intent.constraints.negativeEdges}`,
    `  constraints.unsortedInput=${intent.constraints.unsortedInput}`,
    `  constraints.weighted=${intent.constraints.weighted}`,
  ].join("\n");
}
