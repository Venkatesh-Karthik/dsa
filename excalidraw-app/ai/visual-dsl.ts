/**
 * Visual Teaching DSL
 *
 * This module defines the formal contract between the AI teaching agent
 * and the Excalidraw visual renderer.
 *
 * Design Principles:
 * 1. Semantic over Geometric: The AI specifies WHAT concepts to visualize and
 *    their conceptual relationships, NOT raw pixel coordinates (x, y, width, height).
 * 2. Pure JSON-serializable: Zero functions, classes, or DOM/React/Excalidraw dependencies.
 *    Directly compatible with LLM structured JSON output.
 * 3. Discriminated Unions: Every VisualAction is strictly typed and discriminated
 *    by its `type` property.
 * 4. Pedagogical Flow: Supports step-by-step teaching progression with explanations,
 *    narratives, and camera focus targets.
 */

// ============================================================================
// Semantic Design Tokens
// ============================================================================

export type SemanticColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

export type SemanticFill = "solid" | "semi" | "transparent" | "hachure";

export type SemanticStrokeStyle = "solid" | "dashed" | "dotted";

export type SemanticSize = "xs" | "sm" | "md" | "lg" | "xl";

export type ElementSemanticRole =
  | "array-element"
  | "array-index"
  | "pointer"
  | "variable"
  | "tree-node"
  | "graph-node"
  | "stack-frame"
  | "queue-item"
  | "container"
  | "callout"
  | "label"
  | "annotation"
  | "step-badge"
  | "title"
  | "heading"
  | "endpoint"
  | "process"
  | "generic";

export type ArrowDirection = "forward" | "backward" | "bidirectional" | "none";

export type ConnectorRole =
  | "relationship"
  | "directed"
  | "undirected"
  | "hierarchy"
  | "flow"
  | "pointer"
  | "reference"
  | "generic";

export type HighlightEmphasis = "glow" | "badge" | "focus" | "pulse" | "subtle";

// ============================================================================
// High-Level Layout Hints (No Absolute Canvas Coordinates)
// ============================================================================

export type LayoutPlacement =
  | "right_of"
  | "left_of"
  | "above"
  | "below"
  | "inside"
  | "center";

export type LayoutAlignment = "start" | "center" | "end";

export interface SemanticPosition {
  /** Relative positioning anchored to another element */
  relativeTo?: string;
  /** Spatial placement relative to the anchor */
  placement?: LayoutPlacement;
  /** Alignment along the secondary axis */
  align?: LayoutAlignment;
  /** Logical slot index (e.g. index inside an array or list) */
  slot?: number;
  /** Parent container or group ID (e.g. array container) */
  containerId?: string;
}

export interface BaseStyleOptions {
  color?: SemanticColor;
  fill?: SemanticFill;
  strokeStyle?: SemanticStrokeStyle;
  size?: SemanticSize;
}

// ============================================================================
// Visual Action Discriminated Union
// ============================================================================

export interface CreateBoxAction {
  type: "create_box";
  id: string;
  label: string;
  role?: ElementSemanticRole;
  style?: BaseStyleOptions;
  position?: SemanticPosition;
}

export interface CreateTextAction {
  type: "create_text";
  id: string;
  text: string;
  role?: ElementSemanticRole;
  style?: BaseStyleOptions;
  position?: SemanticPosition;
}

export interface CreateCircleAction {
  type: "create_circle";
  id: string;
  label?: string;
  role?: ElementSemanticRole;
  style?: BaseStyleOptions;
  position?: SemanticPosition;
}

export interface CreateArrowAction {
  type: "create_arrow";
  id: string;
  from: string;
  to: string;
  label?: string;
  direction?: ArrowDirection;
  role?: ConnectorRole;
  style?: BaseStyleOptions & {
    elbowed?: boolean;
  };
}

export interface HighlightAction {
  type: "highlight";
  target: string;
  emphasis?: HighlightEmphasis;
  color?: SemanticColor;
  message?: string;
}

export interface DeleteAction {
  type: "delete";
  target: string;
}

export interface MoveAction {
  type: "move";
  target: string;
  destination: SemanticPosition;
}

export interface ResizeAction {
  type: "resize";
  target: string;
  size: SemanticSize;
}

// ============================================================================
// Semantic Compound Actions (renderer owns ALL layout decisions)
// ============================================================================

/** Semantic highlight for individual array elements */
export type ArrayElementHighlight =
  | "low"
  | "mid"
  | "high"
  | "target"
  | "found"
  | "eliminated";

export interface ArrayElement {
  /** Display value rendered inside the cell */
  value: string | number;
  /** Optional semantic highlight for this element */
  highlight?: ArrayElementHighlight;
}

/** Definition of a single node in a tree structure */
export interface TreeNodeDef {
  /** Unique node identifier within this tree */
  id: string;
  /** Display value */
  value: string | number;
  /** ID of left child node (for binary trees) */
  left?: string;
  /** ID of right child node (for binary trees) */
  right?: string;
  /** IDs of child nodes (for general trees) */
  children?: string[];
  /** Optional semantic highlight */
  highlight?: ArrayElementHighlight | SemanticColor;
}

/** Definition of a graph node */
export interface GraphNodeDef {
  /** Unique node identifier within this graph */
  id: string;
  /** Display label */
  label: string;
  /** Optional value / distance / cost displayed below or next to the label */
  value?: string | number;
  /** Optional absolute or layout coordinates */
  x?: number;
  y?: number;
  /** Optional semantic highlight */
  highlight?: ArrayElementHighlight | SemanticColor;
}

/** Definition of a graph edge */
export interface GraphEdgeDef {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Optional edge weight */
  weight?: number;
  /** Optional edge label */
  label?: string;
  /** Whether this is a directed edge (default: true if graph is directed) */
  directed?: boolean;
  /** Optional semantic highlight */
  highlight?: ArrayElementHighlight;
}

/** Highlight specification for a matrix cell */
export interface MatrixCellHighlight {
  row: number;
  col: number;
  color: ArrayElementHighlight;
}

/**
 * Renders a full array as a horizontal sequence of equally-sized cells.
 * The renderer owns ALL layout decisions: cell size, gap, index labels, colors.
 * The AI only specifies the data and per-element semantics.
 *
 * Registry entries created:
 *   `${id}`          → full bounding box spanning all elements
 *   `${id}-${index}` → individual element bounding box (0-based)
 */
export interface CreateArrayAction {
  type: "create_array";
  id: string;
  /** Optional title rendered above the array */
  label?: string;
  /** The array data — each entry maps to one rendered cell */
  elements: ArrayElement[];
  /** Optional absolute X origin (renderer default used when omitted) */
  x?: number;
  /** Optional absolute Y origin (renderer default used when omitted) */
  y?: number;
  style?: Pick<BaseStyleOptions, "color">;
}

/**
 * Renders a labeled pointer (label text + arrow) pointing at a registered
 * element from above or below. The arrow tip aligns to the exact bounding box
 * of the target — never overlapping, never giant.
 */
export interface AnnotatePointerAction {
  type: "annotate_pointer";
  id: string;
  /** Text shown near the arrow tail — e.g. "LOW", "MID", "HIGH", "TARGET" */
  label: string;
  /** DSL ID of the target element (must already be in the registry) */
  target: string;
  /** Whether the pointer originates from above, below, left, or right of the target element */
  placement: "above" | "below" | "left" | "right";
  color?: SemanticColor;
  /** Offset in pixels for stacking multiple pointers at the same position */
  offset?: number;
}

export interface CreateLinkedListAction {
  type: "create_linked_list";
  id: string;
  elements: ArrayElement[];  // reuse existing ArrayElement type
  variant?: "singly" | "doubly";
  label?: string;
  x?: number;
  y?: number;
  style?: Pick<BaseStyleOptions, "color">;
}

export interface CreateStackAction {
  type: "create_stack";
  id: string;
  elements: ArrayElement[];  // top element is index 0
  label?: string;
  x?: number;
  y?: number;
  style?: Pick<BaseStyleOptions, "color">;
}

export interface CreateQueueAction {
  type: "create_queue";
  id: string;
  elements: ArrayElement[];
  label?: string;
  x?: number;
  y?: number;
  style?: Pick<BaseStyleOptions, "color">;
}

export interface CreateTreeAction {
  type: "create_tree";
  id: string;
  nodes: TreeNodeDef[];
  root: string;  // ID of root node
  label?: string;
  x?: number;
  y?: number;
  style?: Pick<BaseStyleOptions, "color">;
}

export interface CreateGraphAction {
  type: "create_graph";
  id: string;
  nodes: GraphNodeDef[];
  edges: GraphEdgeDef[];
  directed?: boolean;
  label?: string;
  x?: number;
  y?: number;
  style?: Pick<BaseStyleOptions, "color">;
}

export interface CreateMatrixAction {
  type: "create_matrix";
  id: string;
  rows: (string | number)[][];
  rowHeaders?: string[];
  colHeaders?: string[];
  highlights?: MatrixCellHighlight[];
  label?: string;
  x?: number;
  y?: number;
  style?: Pick<BaseStyleOptions, "color">;
}

export interface CreateExplanationBlockAction {
  type: "create_explanation_block";
  id: string;
  title: string;
  stepNumber?: number;
  totalSteps?: number;
  explanation: string;
  calculations?: string;
  insight?: string;
  /** Optional element ID below which this explanation card will be anchored */
  relativeTo?: string;
}

export interface CreateDividerAction {
  type: "create_divider";
  id: string;
  x?: number;
  y?: number;
  width?: number;
  label?: string;
  style?: Pick<BaseStyleOptions, "color" | "strokeStyle">;
}

export type VisualAction =
  | CreateBoxAction
  | CreateTextAction
  | CreateCircleAction
  | CreateArrowAction
  | HighlightAction
  | DeleteAction
  | MoveAction
  | ResizeAction
  | CreateArrayAction
  | AnnotatePointerAction
  | CreateLinkedListAction
  | CreateStackAction
  | CreateQueueAction
  | CreateTreeAction
  | CreateGraphAction
  | CreateMatrixAction
  | CreateExplanationBlockAction
  | CreateDividerAction;

export type VisualActionType = VisualAction["type"];

// ============================================================================
// Domain-Level Concept Specifications (Lightweight Semantic Types)
// ============================================================================

export type DataStructureType =
  | "array"
  | "linked_list"
  | "stack"
  | "queue"
  | "tree"
  | "bst"
  | "heap"
  | "graph"
  | "hash_table"
  | "matrix";

export interface DataStructureMetadata {
  id: string;
  type: DataStructureType;
  label?: string;
  orientation?: "horizontal" | "vertical";
  capacity?: number;
}

// ============================================================================
// Teaching Step & Response Structures
// ============================================================================

export interface StepRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TeachingStep {
  /** Unique identifier for the step (e.g. 'step-1') */
  id: string;
  /** 1-based sequential step number */
  step_number?: number;
  /** Human-readable title of the step */
  title: string;
  /** Detailed pedagogical explanation for the learner (1-2 paragraphs when needed) */
  explanation: string;
  /** Optional dynamic calculations, formula evaluations, or state transitions */
  calculations?: string;
  /** Optional pedagogical takeaway, algorithmic rule, or invariant insight */
  insight?: string;
  /** Optional high-level summary of the semantic state at this step */
  state_summary?: string;
  /** Visual actions to execute on the whiteboard during this step */
  visual_actions: VisualAction[];
  /** Optional target element ID(s) for the camera/viewport to zoom/focus on */
  focus_target?: string | string[];
  /** Optional calculated vertical bounding region for this step */
  region?: StepRegion;
}

export interface TeachingLesson {
  /** Title of the multi-step lesson */
  title: string;
  /** Core learning objective */
  objective?: string;
  /** Sequence of teaching steps */
  steps: TeachingStep[];
}

export interface CodeContext {
  language: string;
  code: string;
  highlightLines?: number[];
  variables?: Record<string, string | number>;
  callStack?: string[];
  explanation?: string;
  problem_summary?: string;
  functionName?: string;
}

export interface UpdateOperation {
  type: "update";
  target: string;
  label?: string;
  value?: string | number;
  style?: BaseStyleOptions;
}

export interface ConnectOperation {
  type: "connect";
  id?: string;
  from: string;
  to: string;
  label?: string;
  direction?: ArrowDirection;
  role?: ConnectorRole;
  style?: BaseStyleOptions;
}

export interface DisconnectOperation {
  type: "disconnect";
  target?: string;
  from?: string;
  to?: string;
}

export interface UnhighlightOperation {
  type: "unhighlight";
  target: string;
}

export interface ReorderOperation {
  type: "reorder";
  target: string;
  swapWith?: string;
  newIndex?: number;
}

export interface GroupOperation {
  type: "group";
  id: string;
  targets: string[];
  label?: string;
  style?: BaseStyleOptions;
}

export interface UngroupOperation {
  type: "ungroup";
  target: string;
}

export type TransformationOperation =
  | VisualAction
  | UpdateOperation
  | ConnectOperation
  | DisconnectOperation
  | UnhighlightOperation
  | ReorderOperation
  | GroupOperation
  | UngroupOperation;

export interface Transformation {
  id: string;
  title: string;
  explanation: string;
  operations: TransformationOperation[];
  visual_actions?: VisualAction[];
  codeContext?: CodeContext;
  calculations?: string;
  insight?: string;
  highlights?: ArrayElementHighlight[] | string[];
}

export interface TeachingResponse {
  /** High-level summary explanation from the AI tutor */
  message: string;
  /** Initial canvas actions, or entire batch if not stepped */
  visual_actions: VisualAction[];
  /** Phased sequential steps for guided interactive whiteboard learning */
  steps?: TeachingStep[];
  /** Optional structured multi-step lesson */
  lesson?: TeachingLesson;
  /** Optional structured visual transformation lesson */
  visualLesson?: VisualLesson;
  /** Optional topic or concept name */
  topic?: string;
  /** High-level step-by-step textual explanation points */
  explanation_steps?: string[];
  /** Optional data structure domain hint */
  domain?: DataStructureMetadata;
}

export interface VisualLesson {
  id: string;
  title: string;
  topic?: string;
  concept?: string;
  domain?: DataStructureMetadata;
  capabilities?: string[];
  initialScene: VisualAction[];
  transformations: Transformation[];
  codeContexts?: Record<string, CodeContext> | CodeContext[];
  steps?: TeachingStep[];
  dependencies?: unknown[];
  practiceOpportunities?: unknown[];
  adaptationHints?: unknown[];
  causalRelationships?: unknown[];
  conceptModel?: unknown;
}
