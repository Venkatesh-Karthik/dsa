/**
 * Cognora DSA Acceleration Layer - Semantic State Model
 *
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * The deterministic engine produces PURE SEMANTIC STATES, not Excalidraw coordinates.
 * No canvas coordinates (x, y, width, height) are decided by the DSA engine.
 * Coordinates and layout belong strictly to the existing Cognora layout/composition engine.
 */

export type DSASemanticRole =
  | "primary"
  | "element"
  | "pointer"
  | "auxiliary"
  | "pivot"
  | "target"
  | "comparison"
  | "boundary"
  | "top"
  | "front"
  | "rear"
  | "container"
  | "entry"
  | "candidate"
  | "queen"
  | "square"
  | "node";

export interface DSASemanticEntity {
  /** Stable unique identifier across all transformations (e.g. "cell-0", "node-30") */
  id: string;
  /** Primitive entity type consumed by Cognora visual primitives */
  type:
    | "ArrayCell"
    | "LinkedListNode"
    | "TreeNode"
    | "GraphNode"
    | "StackFrame"
    | "CallFrame"
    | "Table"
    | "Pointer"
    | "GenericEntity"
    | "QueueItem"
    | "StackItem"
    | "HashBucket"
    | "HashEntry"
    | "DPCell"
    | "Activity"
    | "BoardCell";
  label: string;
  value?: string | number;
  role: DSASemanticRole;
  /** Visual/semantic status flags (active, visited, resolved, highlighted, etc.) */
  status?:
    | "default"
    | "active"
    | "visited"
    | "highlighted"
    | "sorted"
    | "pivot"
    | "found"
    | "eliminated"
    | "imbalanced"
    | "collision";
  /** Auxiliary algorithmic properties (balanceFactor, distance, inDegree, etc.) */
  properties?: Record<string, unknown>;
}

export interface DSASemanticRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type:
    | "points_to"
    | "left_child"
    | "right_child"
    | "child"
    | "edge"
    | "connects"
    | "next"
    | "stacked_on"
    | "queue_link"
    | "chain"
    | "dependency";
  label?: string;
  weight?: number;
  directed?: boolean;
  status?: "default" | "active" | "highlighted" | "traversed" | "relaxed" | "cut";
  style?: "solid" | "dashed" | "dotted";
}

export interface DSASemanticState {
  version: number;
  title: string;
  entities: Map<string, DSASemanticEntity>;
  relationships: DSASemanticRelationship[];
  metadata?: Record<string, unknown>;
}
