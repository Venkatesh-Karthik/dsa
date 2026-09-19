/**
 * Visual Teaching DSL Validator
 *
 * Validates incoming requests and outgoing LLM responses against the
 * Visual Teaching DSL schema before they reach the frontend or canvas.
 */

import type { TeachingRequest, TeachingResponse } from "../teaching-contract";
import type {
  SemanticColor,
  SemanticFill,
  SemanticStrokeStyle,
  SemanticSize,
  LayoutPlacement,
  LayoutAlignment,
  ArrowDirection,
  ArrayElementHighlight,
} from "../visual-dsl";

const VALID_ACTION_TYPES = new Set<string>([
  "create_box",
  "create_text",
  "create_circle",
  "create_arrow",
  "connect",
  "disconnect",
  "update",
  "create_array",
  "create_linked_list",
  "create_stack",
  "create_queue",
  "create_tree",
  "create_graph",
  "create_matrix",
  "create_explanation_block",
  "create_divider",
  "annotate_pointer",
  "highlight",
  "delete",
  "move",
  "resize",
]);

const VALID_COLORS = new Set<SemanticColor>([
  "default",
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
  "info",
]);

const VALID_SIZES = new Set<SemanticSize>(["xs", "sm", "md", "lg", "xl"]);

const VALID_PLACEMENTS = new Set<LayoutPlacement>([
  "right_of",
  "left_of",
  "below",
  "above",
  "inside",
  "center",
]);

const VALID_POINTER_PLACEMENTS = new Set<string>([
  "above",
  "below",
  "left",
  "right",
]);

const VALID_FILLS = new Set<SemanticFill>([
  "solid",
  "semi",
  "transparent",
  "hachure",
]);

const VALID_STROKE_STYLES = new Set<SemanticStrokeStyle>([
  "solid",
  "dashed",
  "dotted",
]);

const VALID_HIGHLIGHTS = new Set<ArrayElementHighlight>([
  "low",
  "mid",
  "high",
  "target",
  "found",
  "eliminated",
]);

const VALID_ALIGNMENTS = new Set<LayoutAlignment>(["start", "center", "end"]);

const VALID_DIRECTIONS = new Set<ArrowDirection>([
  "forward",
  "backward",
  "bidirectional",
  "none",
]);

export const MAX_VISUAL_ACTIONS = 80;
export const MAX_EXPLANATION_STEPS = 50;
export const MAX_LABEL_LENGTH = 300;

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  data?: T;
}

/**
 * Validates an incoming TeachingRequest
 */
export function validateTeachingRequest(
  input: unknown,
): ValidationResult<TeachingRequest> {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Request body must be a JSON object."] };
  }

  const req = input as Record<string, unknown>;

  if (typeof req.prompt !== "string" || req.prompt.trim().length === 0) {
    errors.push("Field 'prompt' must be a non-empty string.");
  } else if (req.prompt.length > 4000) {
    errors.push("Field 'prompt' exceeds maximum length of 4000 characters.");
  }

  if (req.context !== undefined) {
    if (
      typeof req.context !== "object" ||
      req.context === null ||
      Array.isArray(req.context)
    ) {
      errors.push("Field 'context', if provided, must be an object.");
    } else {
      const ctx = req.context as Record<string, unknown>;
      if (ctx.conversationHistory !== undefined) {
        if (!Array.isArray(ctx.conversationHistory)) {
          errors.push("Field 'context.conversationHistory' must be an array.");
        } else {
          for (let i = 0; i < ctx.conversationHistory.length; i++) {
            const m = ctx.conversationHistory[i];
            if (
              !m ||
              typeof m !== "object" ||
              !("role" in m) ||
              !("content" in m)
            ) {
              errors.push(
                `context.conversationHistory[${i}] must have role and content.`,
              );
              break;
            }
          }
        }
      }
      if (ctx.existingAIElements !== undefined) {
        if (
          !Array.isArray(ctx.existingAIElements) ||
          !ctx.existingAIElements.every((id) => typeof id === "string")
        ) {
          errors.push(
            "Field 'context.existingAIElements' must be an array of string IDs.",
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      prompt: (req.prompt as string).trim(),
      context: req.context as TeachingRequest["context"],
    },
  };
}

/**
 * Generically normalizes raw color names, hex codes, or casing to valid SemanticColors.
 */
export function normalizeSemanticColor(
  raw: unknown,
): SemanticColor | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (clean.length === 0) {
    return undefined;
  }
  if (VALID_COLORS.has(clean as SemanticColor)) {
    return clean as SemanticColor;
  }

  // Blue / primary family
  if (
    clean === "blue" ||
    clean === "navy" ||
    clean === "sky" ||
    clean === "royalblue" ||
    clean === "cobalt" ||
    clean === "indigo" ||
    clean === "steelblue" ||
    clean === "deepskyblue" ||
    clean === "dodgerblue"
  ) {
    return "primary";
  }

  // Cyan / info family
  if (
    clean === "cyan" ||
    clean === "teal" ||
    clean === "aqua" ||
    clean === "turquoise" ||
    clean === "lightblue"
  ) {
    return "info";
  }

  // Red / danger family
  if (
    clean === "red" ||
    clean === "crimson" ||
    clean === "darkred" ||
    clean === "rose" ||
    clean === "scarlet" ||
    clean === "ruby" ||
    clean === "salmon" ||
    clean === "coral" ||
    clean === "maroon" ||
    clean === "pink"
  ) {
    return "danger";
  }

  // Green / success family
  if (
    clean === "green" ||
    clean === "darkgreen" ||
    clean === "lightgreen" ||
    clean === "lime" ||
    clean === "emerald" ||
    clean === "forestgreen" ||
    clean === "olive" ||
    clean === "mint"
  ) {
    return "success";
  }

  // Yellow / warning family
  if (
    clean === "yellow" ||
    clean === "amber" ||
    clean === "gold" ||
    clean === "mustard" ||
    clean === "lemon"
  ) {
    return "warning";
  }

  // Orange / accent family
  if (
    clean === "orange" ||
    clean === "darkorange" ||
    clean === "tangerine" ||
    clean === "peach"
  ) {
    return "accent";
  }

  // Purple / secondary family
  if (
    clean === "purple" ||
    clean === "violet" ||
    clean === "magenta" ||
    clean === "plum" ||
    clean === "lavender" ||
    clean === "fuchsia"
  ) {
    return "secondary";
  }

  // Gray / neutral family
  if (
    clean === "gray" ||
    clean === "grey" ||
    clean === "lightgray" ||
    clean === "lightgrey" ||
    clean === "darkgray" ||
    clean === "darkgrey" ||
    clean === "silver" ||
    clean === "slate" ||
    clean === "charcoal" ||
    clean === "black" ||
    clean === "dimgray" ||
    clean === "dimgrey"
  ) {
    return "neutral";
  }

  // White / transparent / default family
  if (
    clean === "white" ||
    clean === "transparent" ||
    clean === "none" ||
    clean === "clear" ||
    clean === "inherit"
  ) {
    return "default";
  }

  // Hex / rgb / hsl color formats or fallback strings
  if (
    clean.startsWith("#") ||
    clean.startsWith("rgb") ||
    clean.startsWith("hsl")
  ) {
    return "default";
  }

  // Unknown string fallback to default
  return "default";
}

/**
 * Generically normalizes spatial layout placements to valid LayoutPlacement tokens.
 */
export function normalizePlacement(raw: unknown): LayoutPlacement | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (VALID_PLACEMENTS.has(clean as LayoutPlacement)) {
    return clean as LayoutPlacement;
  }

  if (clean === "right" || clean === "to_right" || clean === "east") {
    return "right_of";
  }
  if (clean === "left" || clean === "to_left" || clean === "west") {
    return "left_of";
  }
  if (
    clean === "top" ||
    clean === "up" ||
    clean === "above" ||
    clean === "north" ||
    clean === "over"
  ) {
    return "above";
  }
  if (
    clean === "bottom" ||
    clean === "down" ||
    clean === "below" ||
    clean === "south" ||
    clean === "under"
  ) {
    return "below";
  }
  if (clean === "center" || clean === "middle" || clean === "in_center") {
    return "center";
  }
  if (clean === "inside" || clean === "in" || clean === "within") {
    return "inside";
  }

  return undefined;
}

/**
 * Generically normalizes pointer placements for annotate_pointer.
 */
export function normalizePointerPlacement(
  raw: unknown,
): "above" | "below" | "left" | "right" | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (VALID_POINTER_PLACEMENTS.has(clean)) {
    return clean as "above" | "below" | "left" | "right";
  }
  if (clean === "top" || clean === "up" || clean === "over") {
    return "above";
  }
  if (clean === "bottom" || clean === "down" || clean === "under") {
    return "below";
  }
  if (clean === "left_of" || clean === "west") {
    return "left";
  }
  if (clean === "right_of" || clean === "east") {
    return "right";
  }
  return undefined;
}

/**
 * Generically normalizes arrow directions.
 */
export function normalizeArrowDirection(
  raw: unknown,
): ArrowDirection | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (VALID_DIRECTIONS.has(clean as ArrowDirection)) {
    return clean as ArrowDirection;
  }
  if (
    clean === "to" ||
    clean === "right" ||
    clean === "forward" ||
    clean === "ahead" ||
    clean === "pointing_to"
  ) {
    return "forward";
  }
  if (
    clean === "from" ||
    clean === "left" ||
    clean === "backward" ||
    clean === "back" ||
    clean === "pointing_from"
  ) {
    return "backward";
  }
  if (
    clean === "both" ||
    clean === "two-way" ||
    clean === "twoway" ||
    clean === "bi" ||
    clean === "bidirectional"
  ) {
    return "bidirectional";
  }
  if (
    clean === "none" ||
    clean === "line" ||
    clean === "undirected" ||
    clean === "neither"
  ) {
    return "none";
  }
  return undefined;
}

/**
 * Generically normalizes semantic sizes.
 */
export function normalizeSemanticSize(raw: unknown): SemanticSize | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (VALID_SIZES.has(clean as SemanticSize)) {
    return clean as SemanticSize;
  }
  if (clean === "extra-small" || clean === "extra_small" || clean === "tiny") {
    return "xs";
  }
  if (clean === "small") {
    return "sm";
  }
  if (clean === "medium" || clean === "normal" || clean === "regular") {
    return "md";
  }
  if (clean === "large" || clean === "big") {
    return "lg";
  }
  if (
    clean === "extra-large" ||
    clean === "extra_large" ||
    clean === "huge" ||
    clean === "giant"
  ) {
    return "xl";
  }
  return undefined;
}

/**
 * Generically normalizes semantic fills.
 */
export function normalizeSemanticFill(raw: unknown): SemanticFill | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (VALID_FILLS.has(clean as SemanticFill)) {
    return clean as SemanticFill;
  }
  if (clean === "filled" || clean === "fill") {
    return "solid";
  }
  if (
    clean === "outline" ||
    clean === "empty" ||
    clean === "none" ||
    clean === "clear"
  ) {
    return "transparent";
  }
  if (clean === "half") {
    return "semi";
  }
  if (clean === "crosshatch" || clean === "sketch") {
    return "hachure";
  }
  return undefined;
}

/**
 * Generically normalizes semantic stroke styles.
 */
export function normalizeSemanticStrokeStyle(
  raw: unknown,
): SemanticStrokeStyle | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (VALID_STROKE_STYLES.has(clean as SemanticStrokeStyle)) {
    return clean as SemanticStrokeStyle;
  }
  if (clean === "dash") {
    return "dashed";
  }
  if (clean === "dot") {
    return "dotted";
  }
  return undefined;
}

/**
 * Generically normalizes element highlights.
 */
export function normalizeArrayElementHighlight(
  raw: unknown,
): ArrayElementHighlight | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const clean = raw.trim().toLowerCase();
  if (VALID_HIGHLIGHTS.has(clean as ArrayElementHighlight)) {
    return clean as ArrayElementHighlight;
  }
  if (
    clean === "active" ||
    clean === "current" ||
    clean === "selected" ||
    clean === "focus" ||
    clean === "focused" ||
    clean === "blue" ||
    clean === "primary"
  ) {
    return "target";
  }
  if (
    clean === "yellow" ||
    clean === "amber" ||
    clean === "warning" ||
    clean === "middle" ||
    clean === "pivot"
  ) {
    return "mid";
  }
  if (
    clean === "green" ||
    clean === "success" ||
    clean === "done" ||
    clean === "visited" ||
    clean === "match"
  ) {
    return "found";
  }
  if (
    clean === "red" ||
    clean === "danger" ||
    clean === "deleted" ||
    clean === "discarded" ||
    clean === "removed" ||
    clean === "stale"
  ) {
    return "eliminated";
  }
  if (clean === "start" || clean === "min" || clean === "left") {
    return "low";
  }
  if (clean === "end" || clean === "max" || clean === "right") {
    return "high";
  }
  return "target";
}

/**
 * Normalizes a single VisualAction, mapping raw color names and positions
 * to canonical Visual DSL tokens.
 */
export function normalizeVisualAction(action: unknown): unknown {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return action;
  }
  const act = { ...(action as Record<string, unknown>) };

  // Convert connect -> create_arrow
  if (act.type === "connect") {
    act.type = "create_arrow";
    act.from = act.from || act.source || "";
    act.to = act.to || act.target || "";
    act.id =
      act.id || `arrow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Convert disconnect -> delete
  if (act.type === "disconnect") {
    act.type = "delete";
    act.target = act.target || act.id || "";
  }

  // Convert update -> highlight with state / label message
  if (act.type === "update") {
    act.type = "highlight";
    act.target = act.target || act.id || "";
    act.color = act.color || "primary";
    act.message = act.state || act.label || "";
  }

  // Convert shorthand model primitive creation types
  if (act.type === "box") {
    act.type = "create_box";
  }
  if (act.type === "circle") {
    act.type = "create_circle";
  }
  if (act.type === "arrow") {
    act.type = "create_arrow";
  }
  if (act.type === "text") {
    act.type = "create_text";
    act.text = act.text || act.content || "";
    act.id = act.id || act.target;
  }
  if (act.type === "array") {
    act.type = "create_array";
    if (Array.isArray(act.values) && !act.elements) {
      act.elements =
        act.values.length > 0
          ? act.values.map((v) =>
              typeof v === "object" && v !== null ? v : { value: String(v) },
            )
          : [{ value: "" }];
    }
    if (
      !act.elements ||
      !Array.isArray(act.elements) ||
      act.elements.length === 0
    ) {
      act.elements = [{ value: "" }];
    }
    act.id = act.id || act.target;
  }
  if (act.type === "tree") {
    act.type = "create_tree";
    if (!Array.isArray(act.nodes) || act.nodes.length === 0) {
      act.nodes = [{ id: "root", value: "" }];
      act.root = "root";
    }
    const nodesArr = act.nodes as Array<Record<string, unknown>>;
    if (!act.root && Array.isArray(nodesArr) && nodesArr.length > 0) {
      const firstNode = nodesArr[0];
      act.root = (firstNode?.id as string) || "root";
    }
    act.id = act.id || act.target;
  }
  if (act.type === "linked_list") {
    act.type = "create_linked_list";
    if (Array.isArray(act.values) && !act.elements) {
      act.elements =
        act.values.length > 0
          ? act.values.map((v) => ({ value: String(v) }))
          : [{ value: "" }];
    }
    if (
      !act.elements ||
      !Array.isArray(act.elements) ||
      act.elements.length === 0
    ) {
      act.elements = [{ value: "" }];
    }
    act.id = act.id || act.target;
  }
  if (act.type === "stack") {
    act.type = "create_stack";
    if (Array.isArray(act.values) && !act.elements) {
      act.elements =
        act.values.length > 0
          ? act.values.map((v) => ({ value: String(v) }))
          : [{ value: "" }];
    }
    if (
      !act.elements ||
      !Array.isArray(act.elements) ||
      act.elements.length === 0
    ) {
      act.elements = [{ value: "" }];
    }
    act.id = act.id || act.target;
  }
  if (act.type === "queue") {
    act.type = "create_queue";
    if (Array.isArray(act.values) && !act.elements) {
      act.elements =
        act.values.length > 0
          ? act.values.map((v) => ({ value: String(v) }))
          : [{ value: "" }];
    }
    if (
      !act.elements ||
      !Array.isArray(act.elements) ||
      act.elements.length === 0
    ) {
      act.elements = [{ value: "" }];
    }
    act.id = act.id || act.target;
  }
  if (act.type === "graph") {
    act.type = "create_graph";
    if (!Array.isArray(act.nodes) || act.nodes.length === 0) {
      act.nodes = [{ id: "n0", value: "" }];
    }
    if (!Array.isArray(act.edges)) {
      act.edges = [];
    }
    act.id = act.id || act.target;
  }
  if (act.type === "matrix") {
    act.type = "create_matrix";
  }
  if (act.type === "node") {
    act.type = "create_circle";
    act.id =
      act.id || act.target || `node-${Math.random().toString(36).slice(2, 6)}`;
    act.label = String(act.value ?? act.label ?? "");
  }
  if (act.type === "edge") {
    act.type = "create_arrow";
    act.from = String(act.from || act.source || "");
    act.to = String(act.to || act.target || "");
    act.id = act.id || `edge-${act.from}-${act.to}`;
  }
  if (act.type === "table" || act.type === "grid") {
    act.type = "create_matrix";
  }
  if (
    act.type === "container" ||
    act.type === "panel" ||
    act.type === "system" ||
    act.type === "timeline"
  ) {
    act.type = "create_box";
    act.label = String(act.label || act.title || act.id || "");
  }
  if (act.type === "divider") {
    act.type = "create_divider";
  }
  if (act.type === "pointer") {
    act.type = "annotate_pointer";
  }

  // Convert model step mutation actions
  if (act.type === "addNode") {
    act.type = "create_circle";
    const nodeId =
      act.nodeId || act.id || `node-${Math.random().toString(36).slice(2, 6)}`;
    act.id = act.target ? `${act.target}-${nodeId}` : String(nodeId);
    act.label = String(act.value ?? act.label ?? "");
  }
  if (act.type === "addEdge") {
    act.type = "create_arrow";
    act.from = act.target
      ? `${act.target}-${act.from}`
      : String(act.from || "");
    act.to = act.target ? `${act.target}-${act.to}` : String(act.to || "");
    act.id =
      act.id ||
      `arrow-${act.from}-${act.to}-${Math.random().toString(36).slice(2, 5)}`;
  }
  if (
    act.type === "removeNode" ||
    act.type === "deleteNode" ||
    act.type === "removeEdge" ||
    act.type === "deleteEdge"
  ) {
    act.type = "delete";
    act.target = String(act.nodeId || act.edgeId || act.target || act.id || "");
  }
  if (act.type === "updateArray") {
    act.type = "create_array";
    act.id = act.target || act.id || "array";
    act.elements = Array.isArray(act.values)
      ? act.values.length > 0
        ? act.values.map((v) => ({ value: String(v) }))
        : [{ value: "" }]
      : [{ value: "" }];
  }
  if (act.type === "updateText") {
    act.type = "create_text";
    act.id = act.target || act.id || "text";
    act.text = act.content || act.text || "";
  }
  if (act.type === "swapNodes") {
    act.type = "highlight";
    const nIds = Array.isArray(act.nodeIds) ? act.nodeIds : [];
    act.target =
      nIds.length > 0
        ? act.target
          ? `${act.target}-${nIds[0]}`
          : String(nIds[0])
        : String(act.target || "node");
    act.color = "warning";
    act.message =
      act.message ||
      (nIds.length >= 2 ? `Swap ${nIds[0]} and ${nIds[1]}` : "Swap nodes");
  }
  if (act.type === "highlight") {
    const nIds = Array.isArray(act.nodeIds) ? act.nodeIds : [];
    if (!act.target && nIds.length > 0) {
      act.target = nIds[0];
    } else if (
      act.target &&
      nIds.length > 0 &&
      !String(act.target).includes(String(nIds[0]))
    ) {
      act.target = `${act.target}-${nIds[0]}`;
    }
    if (act.style === "violation") {
      act.color = "danger";
    } else if (act.style === "compare") {
      act.color = "warning";
    } else if (act.style === "success") {
      act.color = "success";
    } else if (act.style === "active") {
      act.color = "primary";
    } else if (act.style === "info") {
      act.color = "info";
    } else if (!act.color && typeof act.style === "string") {
      act.color = normalizeSemanticColor(act.style) || "primary";
    }
  }

  if (
    typeof act.type === "string" &&
    !VALID_ACTION_TYPES.has(act.type) &&
    (act.type.startsWith("create_") ||
      act.type.startsWith("make_") ||
      Boolean(act.label) ||
      Boolean(act.text))
  ) {
    act.label = String(act.label || act.text || act.title || act.type || "");
    act.type = "create_box";
    if (!act.id && act.target) {
      act.id = act.target;
    }
  }

  // If creation action was translated from a mutation action targeting an ID, preserve that ID
  if (
    typeof act.type === "string" &&
    act.type.startsWith("create_") &&
    (!act.id || typeof act.id !== "string" || act.id.trim().length === 0)
  ) {
    if (typeof act.target === "string" && act.target.trim().length > 0) {
      act.id = act.target;
    }
  }

  // Normalize style
  if (act.style && typeof act.style === "object" && !Array.isArray(act.style)) {
    const st = { ...(act.style as Record<string, unknown>) };
    if (st.color !== undefined) {
      st.color = normalizeSemanticColor(st.color);
    }
    if (st.size !== undefined) {
      const normSize = normalizeSemanticSize(st.size);
      if (normSize !== undefined) {
        st.size = normSize;
      }
    }
    if (st.fill !== undefined) {
      const normFill = normalizeSemanticFill(st.fill);
      if (normFill !== undefined) {
        st.fill = normFill;
      }
    }
    if (st.strokeStyle !== undefined) {
      const normStroke = normalizeSemanticStrokeStyle(st.strokeStyle);
      if (normStroke !== undefined) {
        st.strokeStyle = normStroke;
      }
    }
    act.style = st;
  }

  // Normalize action-level color
  if (act.type === "highlight" && act.color !== undefined) {
    act.color = normalizeSemanticColor(act.color);
  }
  if (act.type === "annotate_pointer") {
    if (act.color !== undefined) {
      act.color = normalizeSemanticColor(act.color);
    }
    if (act.placement !== undefined) {
      const normPointerPlacement = normalizePointerPlacement(act.placement);
      if (normPointerPlacement !== undefined) {
        act.placement = normPointerPlacement;
      }
    }
  }

  // Normalize arrow direction
  if (act.type === "create_arrow" && act.direction !== undefined) {
    const normDir = normalizeArrowDirection(act.direction);
    if (normDir !== undefined) {
      act.direction = normDir;
    }
  }

  // Normalize resize size
  if (act.type === "resize" && typeof act.size === "string") {
    const normResize = normalizeSemanticSize(act.size);
    if (normResize !== undefined) {
      act.size = normResize;
    }
  }

  // Normalize position
  if (
    act.position &&
    typeof act.position === "object" &&
    !Array.isArray(act.position)
  ) {
    const pos = { ...(act.position as Record<string, unknown>) };
    if (pos.placement !== undefined) {
      const norm = normalizePlacement(pos.placement);
      if (norm !== undefined) {
        pos.placement = norm;
      }
    }
    act.position = pos;
  }

  // Normalize destination (for move action)
  if (
    act.destination &&
    typeof act.destination === "object" &&
    !Array.isArray(act.destination)
  ) {
    const dest = { ...(act.destination as Record<string, unknown>) };
    if (dest.placement !== undefined) {
      const norm = normalizePlacement(dest.placement);
      if (norm !== undefined) {
        dest.placement = norm;
      }
    }
    act.destination = dest;
  }

  // Normalize elements in compound structures
  if (act.type === "create_array" && Array.isArray(act.elements)) {
    act.elements = act.elements.map((el) => {
      if (!el || typeof el !== "object") {
        return el;
      }
      const elem = { ...(el as Record<string, unknown>) };
      if (elem.highlight !== undefined) {
        elem.highlight = normalizeArrayElementHighlight(elem.highlight);
      }
      return elem;
    });
  } else if (act.type === "create_linked_list" && Array.isArray(act.elements)) {
    act.elements = act.elements.map((el) => {
      if (!el || typeof el !== "object") {
        return el;
      }
      const elem = { ...(el as Record<string, unknown>) };
      if (elem.highlight !== undefined) {
        elem.highlight = normalizeArrayElementHighlight(elem.highlight);
      }
      return elem;
    });
  } else if (act.type === "create_stack" && Array.isArray(act.elements)) {
    act.elements = act.elements.map((el) => {
      if (!el || typeof el !== "object") {
        return el;
      }
      const elem = { ...(el as Record<string, unknown>) };
      if (elem.highlight !== undefined) {
        elem.highlight = normalizeArrayElementHighlight(elem.highlight);
      }
      return elem;
    });
  } else if (act.type === "create_tree" && Array.isArray(act.nodes)) {
    act.nodes = act.nodes.map((n) => {
      if (!n || typeof n !== "object") {
        return n;
      }
      const node = { ...(n as Record<string, unknown>) };
      if (node.highlight !== undefined) {
        node.highlight = normalizeArrayElementHighlight(node.highlight);
      }
      return node;
    });
  } else if (act.type === "create_graph") {
    if (Array.isArray(act.nodes)) {
      act.nodes = act.nodes.map((n) => {
        if (!n || typeof n !== "object") {
          return n;
        }
        const node = { ...(n as Record<string, unknown>) };
        if (node.highlight !== undefined) {
          node.highlight = normalizeArrayElementHighlight(node.highlight);
        }
        return node;
      });
    }
    if (Array.isArray(act.edges)) {
      act.edges = act.edges.map((e) => {
        if (!e || typeof e !== "object") {
          return e;
        }
        const edge = { ...(e as Record<string, unknown>) };
        if (edge.highlight !== undefined) {
          edge.highlight = normalizeArrayElementHighlight(edge.highlight);
        }
        return edge;
      });
    }
  } else if (act.type === "create_matrix" && Array.isArray(act.highlights)) {
    act.highlights = act.highlights.map((h) => {
      if (!h || typeof h !== "object") {
        return h;
      }
      const hl = { ...(h as Record<string, unknown>) };
      if (hl.color !== undefined) {
        hl.color = normalizeArrayElementHighlight(hl.color);
      }
      return hl;
    });
  }

  return act;
}

/**
 * Normalizes an entire TeachingResponse payload before validation.
 */
export function normalizeTeachingResponse(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }
  if (Array.isArray(input)) {
    const actions = input.map((act) => normalizeVisualAction(act));
    return {
      topic: "Visual Demonstration",
      message: "Here is the visual demonstration.",
      visual_actions: actions,
      visualLesson: {
        id: `vl-${Date.now()}`,
        title: "Visual Demonstration",
        initialScene: actions,
        transformations: [],
        capabilities: ["explain", "code", "analyze", "practice"],
      },
    };
  }
  const res = { ...(input as Record<string, unknown>) };

  // If model returned a single VisualAction directly (e.g. { type: "create_tree", ... })
  if (
    typeof res.type === "string" &&
    (res.type.startsWith("create_") ||
      res.type === "highlight" ||
      res.type === "move" ||
      res.type === "delete" ||
      res.type === "annotate_pointer")
  ) {
    const singleAction = normalizeVisualAction(res);
    const conceptTitle =
      typeof res.id === "string" && res.id.length > 0
        ? res.id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Visual Demonstration";
    return {
      topic: conceptTitle,
      message: `Here is the visual demonstration of ${conceptTitle}.`,
      visual_actions: [singleAction],
      visualLesson: {
        id: typeof res.id === "string" ? res.id : `vl-${Date.now()}`,
        title: conceptTitle,
        initialScene: [singleAction],
        transformations: [],
        capabilities: ["explain", "code", "analyze", "practice"],
      },
    };
  }

  if (
    res.lesson &&
    typeof res.lesson === "object" &&
    !Array.isArray(res.lesson)
  ) {
    const lessonObj = { ...(res.lesson as Record<string, unknown>) };
    if (Array.isArray(lessonObj.steps) && !Array.isArray(res.steps)) {
      res.steps = lessonObj.steps;
    }
    if (typeof lessonObj.title === "string" && typeof res.topic !== "string") {
      res.topic = lessonObj.title;
    }
    res.lesson = lessonObj;
  }

  // Map alternative fields for topic and message if present
  if (typeof res.topic !== "string" || !res.topic.trim()) {
    if (typeof (res.lesson as any)?.title === "string") {
      res.topic = (res.lesson as any).title;
    }
  }

  if (typeof res.message !== "string" || !res.message.trim()) {
    if (typeof res.explanation === "string" && res.explanation.trim()) {
      res.message = res.explanation;
    } else if (typeof res.description === "string" && res.description.trim()) {
      res.message = res.description;
    } else if (
      Array.isArray(res.explanation_steps) &&
      res.explanation_steps.length > 0
    ) {
      res.message = (res.explanation_steps as unknown[]).map(String).join(" ");
    }
  }

  if (Array.isArray(res.visual_actions)) {
    res.visual_actions = res.visual_actions.map((act) =>
      normalizeVisualAction(act),
    );
  }

  if (Array.isArray(res.steps)) {
    const stepsList = res.steps.map((step) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) {
        return step;
      }
      const s = { ...(step as Record<string, unknown>) };
      if (Array.isArray(s.visual_actions)) {
        s.visual_actions = s.visual_actions.map((act) =>
          normalizeVisualAction(act),
        );
      }
      return s;
    });
    res.steps = stepsList;

    if (
      (!res.visual_actions ||
        !Array.isArray(res.visual_actions) ||
        res.visual_actions.length === 0) &&
      stepsList.length > 0
    ) {
      const firstStep = stepsList[0] as Record<string, unknown>;
      if (Array.isArray(firstStep?.visual_actions)) {
        res.visual_actions = [...firstStep.visual_actions];
      }
    }

    if (!res.lesson) {
      res.lesson = {
        title: typeof res.topic === "string" ? res.topic : "Guided Lesson",
        steps: stepsList,
      };
    }
  }

  // Handle flattened visual lesson where initialScene or transformations are at top-level
  if (
    !res.visualLesson &&
    !res.visual_lesson &&
    (Array.isArray(res.initialScene) ||
      Array.isArray(res.initial_scene) ||
      Array.isArray(res.transformations))
  ) {
    res.visualLesson = {
      id: typeof res.id === "string" ? res.id : `vl-${Date.now()}`,
      title:
        typeof res.title === "string"
          ? res.title
          : typeof res.topic === "string"
          ? res.topic
          : "Visual Lesson",
      initialScene: (res.initialScene || res.initial_scene || []) as unknown[],
      transformations: (res.transformations || []) as unknown[],
      capabilities: Array.isArray(res.capabilities)
        ? res.capabilities
        : ["explain", "code", "analyze", "practice"],
    };
  } else if (
    !res.visualLesson &&
    !res.visual_lesson &&
    res.lesson &&
    typeof res.lesson === "object" &&
    !Array.isArray(res.lesson) &&
    (Array.isArray((res.lesson as Record<string, unknown>).initialScene) ||
      Array.isArray((res.lesson as Record<string, unknown>).initial_scene) ||
      Array.isArray((res.lesson as Record<string, unknown>).transformations))
  ) {
    const l = res.lesson as Record<string, unknown>;
    res.visualLesson = {
      id: typeof l.id === "string" ? l.id : `vl-${Date.now()}`,
      title:
        typeof l.title === "string"
          ? l.title
          : typeof res.topic === "string"
          ? res.topic
          : "Visual Lesson",
      initialScene: (l.initialScene || l.initial_scene || []) as unknown[],
      transformations: (l.transformations || []) as unknown[],
      capabilities: Array.isArray(l.capabilities)
        ? l.capabilities
        : ["explain", "code", "analyze", "practice"],
    };
  }

  const rawLesson = (res.visualLesson || res.visual_lesson) as
    | Record<string, unknown>
    | undefined;
  if (rawLesson && typeof rawLesson === "object") {
    res.visualLesson = rawLesson;

    if (typeof res.topic !== "string" || !res.topic.trim()) {
      if (typeof rawLesson.title === "string" && rawLesson.title.trim()) {
        res.topic = rawLesson.title;
      } else if (
        typeof rawLesson.concept === "string" &&
        rawLesson.concept.trim()
      ) {
        res.topic = rawLesson.concept;
      }
    }

    if (typeof res.message !== "string" || !res.message.trim()) {
      if (
        typeof rawLesson.explanation === "string" &&
        rawLesson.explanation.trim()
      ) {
        res.message = rawLesson.explanation;
      } else if (
        typeof rawLesson.title === "string" &&
        rawLesson.title.trim()
      ) {
        res.message = `Visual explanation of ${rawLesson.title}`;
      } else if (typeof res.topic === "string" && res.topic.trim()) {
        res.message = `Visual explanation of ${res.topic}`;
      } else {
        res.message = "Visual lesson generated successfully.";
      }
    }

    if (
      !res.visual_actions ||
      !Array.isArray(res.visual_actions) ||
      res.visual_actions.length === 0
    ) {
      const initialScene = (rawLesson.initialScene ||
        rawLesson.initial_scene) as unknown[];
      if (Array.isArray(initialScene)) {
        res.visual_actions = initialScene.map((act) =>
          normalizeVisualAction(act),
        );
      } else {
        res.visual_actions = [];
      }
    }

    const rawTransformations = rawLesson.transformations as unknown[];
    if (Array.isArray(rawTransformations)) {
      const normalizedTransList = rawTransformations
        .map((trans, tIdx) => {
          if (!trans || typeof trans !== "object") {
            return null;
          }
          const t = { ...(trans as Record<string, unknown>) };
          const rawOps = (t.operations ||
            t.actions ||
            t.visual_actions) as unknown[];
          const opArray = Array.isArray(rawOps) ? rawOps : [];

          t.id =
            typeof t.id === "string" && t.id.trim().length > 0
              ? t.id
              : `t-${t.step ?? tIdx + 1}`;

          if (typeof t.explanation !== "string" || !t.explanation.trim()) {
            t.explanation =
              typeof t.description === "string" && t.description.trim()
                ? t.description
                : `Transformation ${tIdx + 1}`;
          }

          if (typeof t.title !== "string" || !t.title.trim()) {
            t.title =
              typeof t.description === "string" && t.description.trim()
                ? t.description.split(/[:.]/)[0].slice(0, 50)
                : `Step ${tIdx + 1}`;
          }

          const normalizedOps = opArray
            .map((op, opIdx) => {
              if (!op || typeof op !== "object") {
                return null;
              }
              const o = normalizeVisualAction(op) as Record<string, unknown>;
              if (typeof o.id !== "string" || o.id.trim().length === 0) {
                o.id = `t${tIdx}-op${opIdx}`;
              }
              return o;
            })
            .filter((o): o is Record<string, unknown> => o !== null);

          t.operations = normalizedOps;
          t.visual_actions = normalizedOps;
          return t;
        })
        .filter((t): t is Record<string, unknown> => t !== null);

      // If the last transformation was cut off due to token limits, prune incomplete trailing step
      if (
        normalizedTransList.length > 1 &&
        normalizedTransList[normalizedTransList.length - 1]
      ) {
        const lastT = normalizedTransList[normalizedTransList.length - 1];
        const lastOps = lastT.operations as unknown[];
        // Check if last step has 0 operations or truncated explanation ending in incomplete punctuation
        const isTruncated =
          !Array.isArray(lastOps) ||
          lastOps.length === 0 ||
          (typeof lastT.explanation === "string" &&
            (lastT.explanation.endsWith(",") ||
              lastT.explanation.endsWith(":") ||
              lastT.explanation.endsWith("→")));
        if (isTruncated) {
          normalizedTransList.pop();
        }
      }

      rawLesson.transformations = normalizedTransList;
    }
  }

  // Safety net: ensure message is present when visualLesson exists
  if (
    res.visualLesson &&
    typeof res.visualLesson === "object" &&
    (typeof res.message !== "string" || !res.message.trim())
  ) {
    if (typeof res.topic === "string" && res.topic.trim()) {
      res.message = `Visual explanation of ${res.topic}`;
    } else {
      res.message = "Visual lesson generated successfully.";
    }
  }

  // Safety net: ensure visual_actions is at least an empty array if visualLesson exists
  if (
    res.visualLesson &&
    (!res.visual_actions || !Array.isArray(res.visual_actions))
  ) {
    const vl = res.visualLesson as Record<string, unknown>;
    const initScene = (vl.initialScene || vl.initial_scene) as unknown[];
    res.visual_actions = Array.isArray(initScene)
      ? initScene.map((act) => normalizeVisualAction(act))
      : [];
  }

  // Safety net: ensure visualLesson exists whenever visual_actions are present
  if (
    !res.visualLesson &&
    !res.visual_lesson &&
    Array.isArray(res.visual_actions) &&
    res.visual_actions.length > 0
  ) {
    const actList = res.visual_actions.map((act) => normalizeVisualAction(act));
    res.visualLesson = {
      id: `lesson-${Date.now()}`,
      title:
        typeof res.topic === "string" && res.topic.trim()
          ? res.topic
          : "Visual Lesson",
      initialScene: actList,
      transformations: [],
      capabilities: ["explain", "code", "analyze", "practice"],
    };
  }

  return res;
}

/**
 * Validates a single VisualAction
 */
export function validateVisualAction(
  action: unknown,
  index: number,
  seenIds: Set<string>,
): string[] {
  const errors: string[] = [];
  const prefix = `visual_actions[${index}]`;

  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return [`${prefix} must be an action object.`];
  }

  const act = normalizeVisualAction(action) as Record<string, unknown>;

  if (typeof act.type !== "string" || !VALID_ACTION_TYPES.has(act.type)) {
    errors.push(
      `${prefix}.type must be one of: ${Array.from(VALID_ACTION_TYPES).join(
        ", ",
      )}. Received: "${act.type}".`,
    );
    return errors;
  }

  // Creation actions must have unique ID
  const isCreation = [
    "create_box",
    "create_text",
    "create_circle",
    "create_arrow",
    "create_array",
    "create_linked_list",
    "create_stack",
    "create_queue",
    "create_tree",
    "create_graph",
    "create_matrix",
    "create_explanation_block",
    "create_divider",
    "annotate_pointer",
  ].includes(act.type);
  if (isCreation) {
    if (typeof act.id !== "string" || act.id.trim().length === 0) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    } else if (seenIds.has(act.id)) {
      errors.push(
        `${prefix}.id '${act.id}' is duplicated. IDs must be unique within a batch.`,
      );
    } else {
      seenIds.add(act.id);
    }
  }

  // Manipulation actions must have target ID
  const isManipulation = ["highlight", "delete", "move", "resize"].includes(
    act.type,
  );
  if (isManipulation) {
    if (typeof act.target !== "string" || act.target.trim().length === 0) {
      errors.push(`${prefix}.target must be a non-empty string.`);
    }
  }

  // Type-specific validation
  switch (act.type) {
    case "create_box": {
      if (act.label !== undefined && typeof act.label !== "string") {
        errors.push(`${prefix}.label must be a string.`);
      } else if (
        typeof act.label === "string" &&
        act.label.length > MAX_LABEL_LENGTH
      ) {
        errors.push(
          `${prefix}.label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`,
        );
      }
      break;
    }

    case "create_text": {
      if (typeof act.text !== "string") {
        errors.push(`${prefix}.text must be a string.`);
      } else if (act.text.length > MAX_LABEL_LENGTH) {
        errors.push(
          `${prefix}.text exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`,
        );
      }
      break;
    }

    case "create_circle": {
      if (act.label !== undefined && typeof act.label !== "string") {
        errors.push(`${prefix}.label must be a string.`);
      } else if (
        typeof act.label === "string" &&
        act.label.length > MAX_LABEL_LENGTH
      ) {
        errors.push(
          `${prefix}.label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`,
        );
      }
      break;
    }

    case "create_arrow": {
      if (typeof act.from !== "string" || act.from.trim().length === 0) {
        errors.push(`${prefix}.from must be a non-empty string.`);
      }
      if (typeof act.to !== "string" || act.to.trim().length === 0) {
        errors.push(`${prefix}.to must be a non-empty string.`);
      }
      if (
        act.direction !== undefined &&
        !VALID_DIRECTIONS.has(act.direction as ArrowDirection)
      ) {
        errors.push(
          `${prefix}.direction must be one of: ${Array.from(
            VALID_DIRECTIONS,
          ).join(", ")}.`,
        );
      }
      break;
    }

    case "create_array": {
      if (!Array.isArray(act.elements)) {
        errors.push(
          `${prefix}.elements must be an array of { value, highlight? }.`,
        );
      } else {
        act.elements.forEach((el: unknown, elIdx: number) => {
          if (!el || typeof el !== "object") {
            errors.push(`${prefix}.elements[${elIdx}] must be an object.`);
          } else if ((el as any).value === undefined) {
            errors.push(`${prefix}.elements[${elIdx}].value must be defined.`);
          }
        });
      }
      if (act.label !== undefined && typeof act.label !== "string") {
        errors.push(`${prefix}.label must be a string if provided.`);
      }
      break;
    }

    case "create_linked_list": {
      if (!Array.isArray(act.elements)) {
        errors.push(`${prefix}.elements must be an array of items.`);
      } else {
        act.elements.forEach((el: unknown, elIdx: number) => {
          if (!el || typeof el !== "object") {
            errors.push(`${prefix}.elements[${elIdx}] must be an object.`);
          } else if ((el as any).value === undefined) {
            errors.push(`${prefix}.elements[${elIdx}].value must be defined.`);
          }
        });
      }
      break;
    }

    case "create_stack": {
      if (!Array.isArray(act.elements)) {
        errors.push(`${prefix}.elements must be an array of items.`);
      } else {
        act.elements.forEach((el: unknown, elIdx: number) => {
          if (!el || typeof el !== "object") {
            errors.push(`${prefix}.elements[${elIdx}] must be an object.`);
          } else if ((el as any).value === undefined) {
            errors.push(`${prefix}.elements[${elIdx}].value must be defined.`);
          }
        });
      }
      break;
    }

    case "create_queue": {
      if (!Array.isArray(act.elements)) {
        errors.push(`${prefix}.elements must be an array of items.`);
      } else {
        act.elements.forEach((el: unknown, elIdx: number) => {
          if (!el || typeof el !== "object") {
            errors.push(`${prefix}.elements[${elIdx}] must be an object.`);
          } else if ((el as any).value === undefined) {
            errors.push(`${prefix}.elements[${elIdx}].value must be defined.`);
          }
        });
      }
      break;
    }

    case "create_tree": {
      if (!Array.isArray(act.nodes)) {
        errors.push(`${prefix}.nodes must be an array of nodes.`);
      } else if (act.nodes.length === 0) {
        if (act.root !== undefined && typeof act.root !== "string") {
          errors.push(`${prefix}.root, if provided, must be a string.`);
        }
      } else if (typeof act.root !== "string") {
        errors.push(`${prefix}.root must be a string.`);
      } else {
        const nodeIds = new Set(
          (act.nodes as Record<string, unknown>[]).map((n) => n.id),
        );
        if (!nodeIds.has(act.root)) {
          errors.push(`${prefix}.root must exist in nodes.`);
        }
        for (const node of act.nodes as Record<string, unknown>[]) {
          if (node.left && !nodeIds.has(node.left)) {
            errors.push(
              `${prefix} node ${node.id} left reference ${node.left} must exist in nodes.`,
            );
          }
          if (node.right && !nodeIds.has(node.right)) {
            errors.push(
              `${prefix} node ${node.id} right reference ${node.right} must exist in nodes.`,
            );
          }
          if (Array.isArray(node.children)) {
            for (const childId of node.children) {
              if (!nodeIds.has(childId)) {
                errors.push(
                  `${prefix} node ${node.id} child reference ${childId} must exist in nodes.`,
                );
              }
            }
          }
        }
      }
      break;
    }

    case "create_graph": {
      if (!Array.isArray(act.nodes)) {
        errors.push(`${prefix}.nodes must be an array of nodes.`);
      }
      if (!Array.isArray(act.edges)) {
        errors.push(`${prefix}.edges must be an array.`);
      }
      if (Array.isArray(act.nodes) && Array.isArray(act.edges)) {
        const nodeIds = new Set(
          (act.nodes as Record<string, unknown>[]).map((n) => n.id),
        );
        for (const edge of act.edges as Record<string, unknown>[]) {
          if (!nodeIds.has(edge.from)) {
            errors.push(
              `${prefix} edge from reference ${edge.from} must exist in nodes.`,
            );
          }
          if (!nodeIds.has(edge.to)) {
            errors.push(
              `${prefix} edge to reference ${edge.to} must exist in nodes.`,
            );
          }
        }
      }
      break;
    }

    case "create_matrix": {
      if (
        !Array.isArray(act.rows) ||
        act.rows.length === 0 ||
        !Array.isArray(act.rows[0])
      ) {
        errors.push(`${prefix}.rows must be a non-empty 2D array.`);
      }
      break;
    }

    case "annotate_pointer": {
      if (typeof act.label !== "string" || act.label.trim().length === 0) {
        errors.push(`${prefix}.label must be a non-empty string.`);
      }
      if (typeof act.target !== "string" || act.target.trim().length === 0) {
        errors.push(`${prefix}.target must be a non-empty string.`);
      }
      if (!VALID_POINTER_PLACEMENTS.has(act.placement as string)) {
        errors.push(
          `${prefix}.placement must be one of: ${Array.from(
            VALID_POINTER_PLACEMENTS,
          ).join(", ")}.`,
        );
      }
      if (
        act.color !== undefined &&
        !VALID_COLORS.has(act.color as SemanticColor)
      ) {
        errors.push(
          `${prefix}.color must be a valid SemanticColor (${Array.from(
            VALID_COLORS,
          ).join(", ")}).`,
        );
      }
      break;
    }

    case "highlight": {
      if (
        act.color !== undefined &&
        !VALID_COLORS.has(act.color as SemanticColor)
      ) {
        errors.push(
          `${prefix}.color must be a valid SemanticColor (${Array.from(
            VALID_COLORS,
          ).join(", ")}).`,
        );
      }
      break;
    }

    case "move": {
      if (!act.destination && !act.to) {
        errors.push(
          `${prefix}: must have a destination or to field specifying placement.`,
        );
      }
      break;
    }

    case "resize": {
      if (
        act.size === undefined &&
        (!act.dimensions || typeof act.dimensions !== "object")
      ) {
        errors.push(
          `${prefix}: must have a 'size' string (sm/md/lg/xl) or 'dimensions' object.`,
        );
      }
      break;
    }

    case "create_explanation_block": {
      if (typeof act.title !== "string" || act.title.trim().length === 0) {
        errors.push(`${prefix}.title must be a non-empty string.`);
      }
      if (
        typeof act.explanation !== "string" ||
        act.explanation.trim().length === 0
      ) {
        errors.push(`${prefix}.explanation must be a non-empty string.`);
      }
      break;
    }
  }

  // Position validation
  if (act.position !== undefined) {
    if (typeof act.position !== "object" || act.position === null) {
      errors.push(`${prefix}.position must be an object.`);
    } else {
      const pos = act.position as Record<string, unknown>;
      if (
        pos.placement !== undefined &&
        !VALID_PLACEMENTS.has(pos.placement as LayoutPlacement)
      ) {
        errors.push(
          `${prefix}.position.placement must be one of: ${Array.from(
            VALID_PLACEMENTS,
          ).join(", ")}.`,
        );
      }
      if (
        pos.align !== undefined &&
        !VALID_ALIGNMENTS.has(pos.align as LayoutAlignment)
      ) {
        errors.push(
          `${prefix}.position.align must be one of: ${Array.from(
            VALID_ALIGNMENTS,
          ).join(", ")}.`,
        );
      }
    }
  }

  // Style validation
  if (act.style !== undefined) {
    if (typeof act.style !== "object" || act.style === null) {
      errors.push(`${prefix}.style must be an object.`);
    } else {
      const st = act.style as Record<string, unknown>;
      if (
        st.color !== undefined &&
        !VALID_COLORS.has(st.color as SemanticColor)
      ) {
        errors.push(
          `${prefix}.style.color must be a valid SemanticColor (${Array.from(
            VALID_COLORS,
          ).join(", ")}).`,
        );
      }
      if (st.size !== undefined && !VALID_SIZES.has(st.size as SemanticSize)) {
        errors.push(
          `${prefix}.style.size must be a valid SemanticSize (${Array.from(
            VALID_SIZES,
          ).join(", ")}).`,
        );
      }
      if (st.fill !== undefined && !VALID_FILLS.has(st.fill as SemanticFill)) {
        errors.push(
          `${prefix}.style.fill must be a valid SemanticFill (${Array.from(
            VALID_FILLS,
          ).join(", ")}).`,
        );
      }
      if (
        st.strokeStyle !== undefined &&
        !VALID_STROKE_STYLES.has(st.strokeStyle as SemanticStrokeStyle)
      ) {
        errors.push(
          `${prefix}.style.strokeStyle must be a valid SemanticStrokeStyle (${Array.from(
            VALID_STROKE_STYLES,
          ).join(", ")}).`,
        );
      }
    }
  }

  return errors;
}

/**
 * Validates that an individual action's referenced targets (from, to, target, relativeTo)
 * resolve to known IDs (either from prior canvas elements or creation actions in the batch).
 */
export function validateSingleActionReferences(
  action: Record<string, unknown>,
  index: number,
  knownIds: Set<string>,
): string[] {
  const errors: string[] = [];
  const prefix = `Action ${index} (${action.type})`;
  const knownList = Array.from(knownIds).sort().join(", ");

  if (action.type === "create_arrow") {
    if (typeof action.from === "string" && !knownIds.has(action.from)) {
      errors.push(
        `${prefix} references unknown source '${action.from}'. Known IDs: [${knownList}].`,
      );
    }
    if (typeof action.to === "string" && !knownIds.has(action.to)) {
      errors.push(
        `${prefix} references unknown target '${action.to}'. Known IDs: [${knownList}].`,
      );
    }
  }

  if (action.type === "annotate_pointer") {
    if (typeof action.target === "string" && !knownIds.has(action.target)) {
      errors.push(
        `${prefix} references unknown target '${action.target}'. Known IDs: [${knownList}].`,
      );
    }
  }

  if (
    ["highlight", "delete", "move", "resize"].includes(action.type as string)
  ) {
    if (typeof action.target === "string" && !knownIds.has(action.target)) {
      const actType = action.type as string;
      const capitalized = actType.charAt(0).toUpperCase() + actType.slice(1);
      errors.push(
        `${capitalized} target '${action.target}' does not exist in visual actions or canvas. Known IDs: [${knownList}].`,
      );
    }
  }

  if (
    action.position &&
    typeof action.position === "object" &&
    "relativeTo" in (action.position as Record<string, unknown>)
  ) {
    const rel = (action.position as Record<string, unknown>).relativeTo;
    if (typeof rel === "string" && !knownIds.has(rel)) {
      errors.push(
        `${prefix} references unknown relativeTo anchor '${rel}'. Known IDs: [${knownList}].`,
      );
    }
  }

  return errors;
}

/**
 * Validates that all referenced targets in an array of actions resolve to known IDs.
 */
export function validateActionReferences<T = Record<string, unknown>>(
  actions: T[],
  existingIds: string[] = [],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const knownIds = new Set<string>(existingIds);

  for (const act of actions) {
    const a = act as Record<string, unknown>;
    const id = a.id;
    if (typeof id === "string") {
      knownIds.add(id);
    }
    // Expand compound element IDs so downstream actions can reference them
    if (
      a.type === "create_array" &&
      typeof id === "string" &&
      Array.isArray(a.elements)
    ) {
      for (let i = 0; i < (a.elements as unknown[]).length; i++) {
        knownIds.add(`${id}-${i}`);
      }
    } else if (
      a.type === "create_linked_list" &&
      typeof id === "string" &&
      Array.isArray(a.elements)
    ) {
      for (let i = 0; i < (a.elements as unknown[]).length; i++) {
        const el = (a.elements as any)[i];
        knownIds.add(`${id}-${i}`);
        if (el && typeof el === "object" && el.id) {
          knownIds.add(`${id}-${el.id}`);
        }
      }
      knownIds.add(`${id}-null`);
    } else if (
      a.type === "create_stack" &&
      typeof id === "string" &&
      Array.isArray(a.elements)
    ) {
      for (let i = 0; i < (a.elements as unknown[]).length; i++) {
        knownIds.add(`${id}-${i}`);
      }
    } else if (
      a.type === "create_tree" &&
      typeof id === "string" &&
      Array.isArray(a.nodes)
    ) {
      for (const node of a.nodes as Record<string, unknown>[]) {
        if (typeof node.id === "string") {
          knownIds.add(`${id}-${node.id}`);
        }
      }
    } else if (
      a.type === "create_graph" &&
      typeof id === "string" &&
      Array.isArray(a.nodes)
    ) {
      for (const node of a.nodes as Record<string, unknown>[]) {
        if (typeof node.id === "string") {
          knownIds.add(`${id}-${node.id}`);
        }
      }
      if (Array.isArray(a.edges)) {
        for (const edge of a.edges as Record<string, unknown>[]) {
          if (typeof edge.from === "string" && typeof edge.to === "string") {
            knownIds.add(`${id}-edge-${edge.from}-${edge.to}`);
          }
        }
      }
    } else if (
      a.type === "create_matrix" &&
      typeof id === "string" &&
      Array.isArray(a.rows)
    ) {
      const rows = a.rows as unknown[][];
      for (let r = 0; r < rows.length; r++) {
        if (Array.isArray(rows[r])) {
          for (let c = 0; c < rows[r].length; c++) {
            knownIds.add(`${id}-${r}-${c}`);
          }
        }
      }
    }
  }

  actions.forEach((act, idx) => {
    if (act && typeof act === "object") {
      const errs = validateSingleActionReferences(
        act as Record<string, unknown>,
        idx,
        knownIds,
      );
      errors.push(...errs);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Topologically sorts VisualActions into a valid dependency execution order:
 * 1. Creation actions with independent / anchor positioning
 * 2. Creation actions with relative positioning (topologically ordered)
 * 3. Arrow connections (which depend on created elements)
 * 4. Highlights, moves, resizes (which depend on created elements)
 * 5. Deletions
 */
export function sortActionsByDependency<T = Record<string, unknown>>(
  actions: T[],
): T[] {
  const creations: T[] = [];
  const arrows: T[] = [];
  const overlays: T[] = [];
  const deletions: T[] = [];

  for (const item of actions) {
    const act = item as Record<string, unknown>;
    if (act.type === "create_arrow") {
      arrows.push(item);
    } else if (act.type === "delete") {
      deletions.push(item);
    } else if (["highlight", "move", "resize"].includes(act.type as string)) {
      overlays.push(item);
    } else {
      creations.push(item);
    }
  }

  // Topologically sort creation actions based on position.relativeTo
  const sortedCreations: T[] = [];
  const createdIds = new Set<string>();

  // Pass 1: Creations with no relativeTo anchor come first
  const pendingRelative: T[] = [];
  for (const item of creations) {
    const act = item as Record<string, unknown>;
    const id = act.id as string | undefined;
    const rel = (act.position as Record<string, unknown> | undefined)
      ?.relativeTo as string | undefined;

    if (!rel) {
      sortedCreations.push(item);
      if (id) {
        createdIds.add(id);
      }
    } else {
      pendingRelative.push(item);
    }
  }

  // Pass 2: Iteratively resolve relative creations as their anchors become available
  let maxPasses = pendingRelative.length + 2;
  while (pendingRelative.length > 0 && maxPasses-- > 0) {
    let progressed = false;
    for (let i = pendingRelative.length - 1; i >= 0; i--) {
      const item = pendingRelative[i];
      const act = item as Record<string, unknown>;
      const id = act.id as string | undefined;
      const rel = (act.position as Record<string, unknown> | undefined)
        ?.relativeTo as string | undefined;

      if (rel && createdIds.has(rel)) {
        sortedCreations.push(item);
        if (id) {
          createdIds.add(id);
        }
        pendingRelative.splice(i, 1);
        progressed = true;
      }
    }
    if (!progressed) {
      // Break cycle or unresolved anchor by appending remaining items
      sortedCreations.push(...pendingRelative);
      break;
    }
  }

  return [...sortedCreations, ...arrows, ...overlays, ...deletions];
}

/**
 * Repairs dangling references using semantic aliases and topologically sorts actions by dependency.
 * Returns the repaired, ordered array of actions.
 */
export function repairOrReorderActions<T = Record<string, unknown>>(
  actions: T[],
  existingIds: string[] = [],
): T[] {
  return repairOrReorderActionsDetails(actions, existingIds).actions;
}

/**
 * Normalizes and repairs action targets using semantic aliases (labels, roles)
 * when an exact DSL ID has a known semantic counterpart. Returns detailed repair metadata.
 */
export function repairOrReorderActionsDetails<T = Record<string, unknown>>(
  actions: T[],
  existingIds: string[] = [],
): { actions: T[]; repaired: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let repaired = false;

  const allKnownIds = new Set<string>(existingIds);
  const aliasToId = new Map<string, string>();

  // Seed aliases from existing IDs
  for (const id of existingIds) {
    allKnownIds.add(id);
    aliasToId.set(id.toLowerCase(), id);
  }

  // Pass 1: Index all creations in this batch and build semantic aliases
  for (const item of actions) {
    const act = item as Record<string, unknown>;
    const id = act.id as string | undefined;
    if (id) {
      allKnownIds.add(id);
      aliasToId.set(id.toLowerCase(), id);

      // Expand compound element IDs so downstream actions can reference them
      if (act.type === "create_array" && Array.isArray(act.elements)) {
        for (let i = 0; i < (act.elements as unknown[]).length; i++) {
          const elemId = `${id}-${i}`;
          allKnownIds.add(elemId);
          aliasToId.set(elemId.toLowerCase(), elemId);
        }
      } else if (
        act.type === "create_linked_list" &&
        Array.isArray(act.elements)
      ) {
        for (let i = 0; i < (act.elements as unknown[]).length; i++) {
          const el = (act.elements as any)[i];
          const elemId = `${id}-${i}`;
          allKnownIds.add(elemId);
          aliasToId.set(elemId.toLowerCase(), elemId);
          if (el && typeof el === "object" && el.id) {
            const rawElemId = `${id}-${el.id}`;
            allKnownIds.add(rawElemId);
            aliasToId.set(rawElemId.toLowerCase(), elemId);
          }
        }
        const nullId = `${id}-null`;
        allKnownIds.add(nullId);
        aliasToId.set(nullId.toLowerCase(), nullId);
      } else if (act.type === "create_stack" && Array.isArray(act.elements)) {
        for (let i = 0; i < (act.elements as unknown[]).length; i++) {
          const elemId = `${id}-${i}`;
          allKnownIds.add(elemId);
          aliasToId.set(elemId.toLowerCase(), elemId);
        }
      } else if (act.type === "create_tree" && Array.isArray(act.nodes)) {
        for (const node of act.nodes as Record<string, unknown>[]) {
          if (typeof node.id === "string") {
            const elemId = `${id}-${node.id}`;
            allKnownIds.add(elemId);
            aliasToId.set(elemId.toLowerCase(), elemId);

            // Map node semantic values
            const label = (node.label ?? node.value) as string | undefined;
            if (typeof label === "string" && label.trim().length > 0) {
              aliasToId.set(label.trim().toLowerCase(), elemId);
            }
          }
        }
      } else if (act.type === "create_graph" && Array.isArray(act.nodes)) {
        for (const node of act.nodes as Record<string, unknown>[]) {
          if (typeof node.id === "string") {
            const elemId = `${id}-${node.id}`;
            allKnownIds.add(elemId);
            aliasToId.set(elemId.toLowerCase(), elemId);

            const label = (node.label ?? node.value) as string | undefined;
            if (typeof label === "string" && label.trim().length > 0) {
              aliasToId.set(label.trim().toLowerCase(), elemId);
            }
          }
        }
        if (Array.isArray(act.edges)) {
          for (const edge of act.edges as Record<string, unknown>[]) {
            if (typeof edge.from === "string" && typeof edge.to === "string") {
              const edgeId = `${id}-edge-${edge.from}-${edge.to}`;
              allKnownIds.add(edgeId);
              aliasToId.set(edgeId.toLowerCase(), edgeId);
            }
          }
        }
      } else if (act.type === "create_matrix" && Array.isArray(act.rows)) {
        const rows = act.rows as unknown[][];
        for (let r = 0; r < rows.length; r++) {
          if (Array.isArray(rows[r])) {
            for (let c = 0; c < rows[r].length; c++) {
              const cellId = `${id}-${r}-${c}`;
              allKnownIds.add(cellId);
              aliasToId.set(cellId.toLowerCase(), cellId);
            }
          }
        }
      }

      // Map text label or number
      const label = (act.label ?? act.text) as string | undefined;
      if (typeof label === "string" && label.trim().length > 0) {
        const clean = label.trim().toLowerCase();
        aliasToId.set(clean, id);
        // Extract numbers e.g. "30 [MID]" -> "30"
        const numMatch = clean.match(/^\d+/);
        if (numMatch) {
          aliasToId.set(numMatch[0], id);
          aliasToId.set(`arr-${numMatch[0]}`, id);
          aliasToId.set(`array-${numMatch[0]}`, id);
        }
      }

      // Map role if present
      const role = act.role as string | undefined;
      if (typeof role === "string") {
        aliasToId.set(role.toLowerCase(), id);
      }
    }
  }

  // Pass 2: Repair dangling targets if a clear semantic alias exists
  const repairedActions: T[] = actions.map((item) => {
    const act = { ...(item as Record<string, unknown>) };

    const resolveAlias = (target: string): string | null => {
      if (allKnownIds.has(target)) {
        return target;
      }
      const lower = target.toLowerCase();
      if (aliasToId.has(lower)) {
        return aliasToId.get(lower)!;
      }
      // Check number suffix e.g. "arr-30" -> alias for "30"
      const numMatch = lower.match(/\d+$/);
      if (numMatch && aliasToId.has(numMatch[0])) {
        return aliasToId.get(numMatch[0])!;
      }
      return null;
    };

    if (act.type === "annotate_pointer" && typeof act.target === "string") {
      const resolved = resolveAlias(act.target);
      if (resolved && resolved !== act.target) {
        warnings.push(
          `Repaired annotate_pointer target from '${act.target}' to '${resolved}'.`,
        );
        repaired = true;
        act.target = resolved;
      }
    }

    if (
      ["highlight", "delete", "move", "resize"].includes(act.type as string) &&
      typeof act.target === "string"
    ) {
      const resolved = resolveAlias(act.target);
      if (resolved && resolved !== act.target) {
        warnings.push(
          `Repaired ${act.type} target from '${act.target}' to resolved ID '${resolved}'.`,
        );
        repaired = true;
        act.target = resolved;
      }
    }

    if (act.type === "create_arrow") {
      if (typeof act.from === "string") {
        const resolvedFrom = resolveAlias(act.from);
        if (resolvedFrom && resolvedFrom !== act.from) {
          warnings.push(
            `Repaired arrow source from '${act.from}' to resolved ID '${resolvedFrom}'.`,
          );
          repaired = true;
          act.from = resolvedFrom;
        }
      }
      if (typeof act.to === "string") {
        const resolvedTo = resolveAlias(act.to);
        if (resolvedTo && resolvedTo !== act.to) {
          warnings.push(
            `Repaired arrow target from '${act.to}' to resolved ID '${resolvedTo}'.`,
          );
          repaired = true;
          act.to = resolvedTo;
        }
      }
    }

    return act as T;
  });

  // Sort by dependency
  const sorted = sortActionsByDependency(repairedActions);

  return { actions: sorted, repaired, warnings };
}

export interface TeachingResponseValidationOptions {
  existingIds?: string[];
  validateReferences?: boolean;
}

/**
 * Validates a complete TeachingResponse
 */
export function validateTeachingResponse(
  input: unknown,
  options?: TeachingResponseValidationOptions,
): ValidationResult<TeachingResponse> {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Teaching response must be an object."] };
  }

  const res = normalizeTeachingResponse(input) as Record<string, unknown>;

  if (typeof res.message !== "string" || res.message.trim().length === 0) {
    if (res.visualLesson && typeof res.visualLesson === "object") {
      res.message = `Visual explanation of ${
        (res.visualLesson as Record<string, unknown>).title ||
        res.topic ||
        "concept"
      }`;
    } else {
      errors.push(
        "Field 'message' must be a non-empty string explaining the concept.",
      );
    }
  }

  if (res.visual_actions === undefined) {
    if (res.visualLesson && typeof res.visualLesson === "object") {
      const vl = res.visualLesson as Record<string, unknown>;
      res.visual_actions = Array.isArray(vl.initialScene)
        ? vl.initialScene
        : [];
    } else if (res.steps === undefined) {
      errors.push(
        "Field 'visual_actions' must be an array of VisualAction items.",
      );
    }
  } else if (!Array.isArray(res.visual_actions)) {
    if (res.visualLesson && typeof res.visualLesson === "object") {
      const vl = res.visualLesson as Record<string, unknown>;
      res.visual_actions = Array.isArray(vl.initialScene)
        ? vl.initialScene
        : [];
    } else {
      errors.push(
        "Field 'visual_actions' must be an array of VisualAction items.",
      );
    }
  } else {
    if (res.visual_actions.length > MAX_VISUAL_ACTIONS) {
      errors.push(
        `Field 'visual_actions' exceeds safety limit of ${MAX_VISUAL_ACTIONS} actions (received ${res.visual_actions.length}).`,
      );
    }
    const seenIds = new Set<string>();
    const createdInBatch = new Set<string>();

    // Pass 1: Collect created IDs
    res.visual_actions.forEach((act) => {
      if (act && typeof act === "object" && typeof act.id === "string") {
        const id = act.id;
        createdInBatch.add(id);
        const a = act as Record<string, unknown>;
        if (a.type === "create_array" && Array.isArray(a.elements)) {
          for (let i = 0; i < (a.elements as unknown[]).length; i++) {
            createdInBatch.add(`${id}-${i}`);
          }
        } else if (
          a.type === "create_linked_list" &&
          Array.isArray(a.elements)
        ) {
          for (let i = 0; i < (a.elements as unknown[]).length; i++) {
            const el = (a.elements as any)[i];
            createdInBatch.add(`${id}-${i}`);
            if (el && typeof el === "object" && el.id) {
              createdInBatch.add(`${id}-${el.id}`);
            }
          }
          createdInBatch.add(`${id}-null`);
        } else if (a.type === "create_stack" && Array.isArray(a.elements)) {
          for (let i = 0; i < (a.elements as unknown[]).length; i++) {
            createdInBatch.add(`${id}-${i}`);
          }
        } else if (a.type === "create_queue" && Array.isArray(a.elements)) {
          for (let i = 0; i < (a.elements as unknown[]).length; i++) {
            createdInBatch.add(`${id}-${i}`);
          }
        } else if (a.type === "create_tree" && Array.isArray(a.nodes)) {
          for (const node of a.nodes as Record<string, unknown>[]) {
            if (typeof node.id === "string") {
              createdInBatch.add(`${id}-${node.id}`);
            }
          }
        } else if (a.type === "create_graph" && Array.isArray(a.nodes)) {
          for (const node of a.nodes as Record<string, unknown>[]) {
            if (typeof node.id === "string") {
              createdInBatch.add(`${id}-${node.id}`);
            }
          }
          if (Array.isArray(a.edges)) {
            for (const edge of a.edges as Record<string, unknown>[]) {
              if (
                typeof edge.from === "string" &&
                typeof edge.to === "string"
              ) {
                createdInBatch.add(`${id}-edge-${edge.from}-${edge.to}`);
              }
            }
          }
        } else if (a.type === "create_matrix" && Array.isArray(a.rows)) {
          const rows = a.rows as unknown[][];
          for (let r = 0; r < rows.length; r++) {
            if (Array.isArray(rows[r])) {
              for (let c = 0; c < rows[r].length; c++) {
                createdInBatch.add(`${id}-${r}-${c}`);
              }
            }
          }
        }
      }
    });

    // Pass 2: Schema validation on each action
    res.visual_actions.forEach((act, idx) => {
      const actErrors = validateVisualAction(act, idx, seenIds);
      errors.push(...actErrors);
    });

    // Pass 3: Reference validation if requested or existingIds supplied
    if (options?.validateReferences || options?.existingIds !== undefined) {
      const knownIds = new Set<string>([
        ...(options?.existingIds ?? []),
        ...Array.from(createdInBatch),
      ]);

      res.visual_actions.forEach((act, idx) => {
        if (act && typeof act === "object") {
          const refErrors = validateSingleActionReferences(
            act as Record<string, unknown>,
            idx,
            knownIds,
          );
          errors.push(...refErrors);
        }
      });
    }
  }

  if (res.topic !== undefined && typeof res.topic !== "string") {
    errors.push("Field 'topic', if provided, must be a string.");
  }

  if (res.explanation_steps !== undefined) {
    if (
      !Array.isArray(res.explanation_steps) ||
      !res.explanation_steps.every((s) => typeof s === "string")
    ) {
      errors.push(
        "Field 'explanation_steps', if provided, must be an array of strings.",
      );
    } else if (res.explanation_steps.length > MAX_EXPLANATION_STEPS) {
      errors.push(
        `Field 'explanation_steps' exceeds safety limit of ${MAX_EXPLANATION_STEPS} steps (received ${res.explanation_steps.length}).`,
      );
    }
  }

  if (res.steps !== undefined) {
    if (!Array.isArray(res.steps)) {
      errors.push(
        "Field 'steps', if provided, must be an array of TeachingStep objects.",
      );
    } else {
      res.steps.forEach((step, sIdx) => {
        const stepPrefix = `steps[${sIdx}]`;
        if (!step || typeof step !== "object") {
          errors.push(`${stepPrefix} must be an object.`);
          return;
        }
        const s = step as Record<string, unknown>;
        if (typeof s.id !== "string" || s.id.trim().length === 0) {
          errors.push(`${stepPrefix}.id must be a non-empty string.`);
        }
        if (typeof s.title !== "string" || s.title.trim().length === 0) {
          errors.push(`${stepPrefix}.title must be a non-empty string.`);
        }
        if (
          typeof s.explanation !== "string" ||
          s.explanation.trim().length === 0
        ) {
          errors.push(`${stepPrefix}.explanation must be a non-empty string.`);
        }
        if (s.step_number !== undefined && typeof s.step_number !== "number") {
          errors.push(
            `${stepPrefix}.step_number, if provided, must be a number.`,
          );
        }
        if (
          s.calculations !== undefined &&
          typeof s.calculations !== "string"
        ) {
          errors.push(
            `${stepPrefix}.calculations, if provided, must be a string.`,
          );
        }
        if (s.insight !== undefined && typeof s.insight !== "string") {
          errors.push(`${stepPrefix}.insight, if provided, must be a string.`);
        }
        if (!Array.isArray(s.visual_actions)) {
          errors.push(
            `${stepPrefix}.visual_actions must be an array of VisualAction items.`,
          );
        } else {
          const stepSeenIds = new Set<string>();
          s.visual_actions.forEach((act, actIdx) => {
            const actErrors = validateVisualAction(act, actIdx, stepSeenIds);
            errors.push(...actErrors.map((e) => `${stepPrefix}.${e}`));
          });
        }
      });
    }
  }

  if (res.lesson !== undefined) {
    if (
      !res.lesson ||
      typeof res.lesson !== "object" ||
      Array.isArray(res.lesson)
    ) {
      errors.push("Field 'lesson', if provided, must be an object.");
    } else {
      const l = res.lesson as Record<string, unknown>;
      if (typeof l.title !== "string" || l.title.trim().length === 0) {
        errors.push("Field 'lesson.title' must be a non-empty string.");
      }
      if (l.objective !== undefined && typeof l.objective !== "string") {
        errors.push("Field 'lesson.objective', if provided, must be a string.");
      }
      if (!Array.isArray(l.steps)) {
        errors.push(
          "Field 'lesson.steps' must be an array of TeachingStep objects.",
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: res as unknown as TeachingResponse,
  };
}
