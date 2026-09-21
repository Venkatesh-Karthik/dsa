/**
 * Cognora DSA Acceleration Layer - Transformation Model
 *
 * Represents an actual, verified semantic change in the algorithm's world state.
 * Contains enough pedagogical rationale to derive WHAT happened, WHY it happened,
 * and WHAT resulted.
 */

export type DSATransformationType =
  | "INITIALIZE"
  | "INSERT"
  | "DELETE"
  | "COMPARE"
  | "SEARCH"
  | "VISIT"
  | "SWAP"
  | "SHIFT"
  | "PARTITION"
  | "MERGE"
  | "ENQUEUE"
  | "DEQUEUE"
  | "PUSH"
  | "POP"
  | "ROTATE"
  | "REBALANCE"
  | "RELAX_EDGE"
  | "UPDATE_DISTANCE"
  | "MARK_VISITED"
  | "CONNECT"
  | "DISCONNECT"
  | "EXPLANATION_PAUSE"
  | "FINAL_STATE"
  | "FOUND"
  | "NOT_FOUND"
  | "SELECT_PIVOT"
  | "PARTITION_COMPLETE"
  | "DIVIDE_MERGE"
  | "MERGE_COMPLETE"
  | "SORT_COMPLETE"
  | "SELECT_MIN"
  | "INSERT_SORTED"
  | "HEAPIFY"
  | "EXTRACT_MAX"
  | "MOVE_POINTER"
  | "SLIDE_WINDOW"
  | "LOCATE_NODE"
  | "DELETE_NODE"
  | "INSERT_NODE"
  | "TRAVERSE"
  | "PEEK"
  | "COLLISION"
  | "BASE_CASE"
  | "TABULATION_STEP"
  | "GREEDY_SELECT"
  | "REJECT"
  | "SOLUTION_FOUND"
  | "CHOOSE"
  | "BACKTRACK"
  | "DETECT_IMBALANCE"
  | "ROTATE_RIGHT"
  | "ROTATE_LEFT"
  | "SWAP_BUBBLE_UP"
  | "DEQUEUE_VISIT"
  | "DFS_VISIT"
  | "NEGATIVE_CYCLE_CHECK";

export interface DSASemanticFocus {
  entityIds?: string[];
  relationshipIds?: string[];
  operationId?: string;
  label?: string;
  anchorPreference?: "center" | "top" | "bottom" | "left" | "right";
}

export interface TeachingTransformation {
  /** Unique ID for this transformation (e.g. "t-1") */
  id: string;
  type: DSATransformationType;
  stepNumber: number;
  beforeStateIndex: number;
  afterStateIndex: number;

  /** Stable IDs of entities mutated or created in this step */
  affectedEntityIds: string[];
  /** IDs of relationships mutated, created, or removed in this step */
  affectedRelationshipIds: string[];

  /** Primary visual and cognitive focus target */
  semanticFocus: DSASemanticFocus;

  /** WHAT: Direct concise summary of the action */
  whatHappened: string;
  /** WHY: Underlying algorithmic rule or condition */
  reason: string;
  /** RESULT: Impact on algorithm state */
  consequence: string;

  /** Full pedagogically rich explanation */
  title: string;
  explanation: string;
  calculations?: Record<string, string | number>;
  insight?: string;
  codeSnippet?: string;
  codeLanguage?: string;

  /** Flag indicating whether this represents a visual/state change or pedagogical emphasis */
  isStateChange?: boolean;
  importance?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
}
