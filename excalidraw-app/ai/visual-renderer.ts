/**
 * Deterministic Visual Renderer
 *
 * Translates semantic Visual Teaching DSL actions into native Excalidraw elements.
 *
 * Architecture:
 *   AI (Featherless) -> Visual DSL -> THIS RENDERER -> Excalidraw Elements
 *
 * Key Design Principles:
 * 1. Pure & Deterministic: Same DSL input always yields the exact same Excalidraw elements.
 * 2. Decoupled from React & DOM: No hooks, no window/document references, runs anywhere.
 * 3. Native Constructors: Uses authentic `newElement`, `newTextElement`, `newArrowElement`
 *    from `@excalidraw/element`.
 * 4. Separate Semantic & Internal IDs: Excalidraw generates internal IDs; the renderer
 *    tracks semantic DSL IDs in a registry for relationship resolution (arrows, highlights).
 * 5. Robust Error Handling: Missing references (e.g. invalid arrow endpoints) log errors
 *    gracefully without crashing.
 */

import {
  newElement,
  newTextElement,
  newArrowElement,
  newElementWith,
} from "@excalidraw/element";

import { pointFrom, type LocalPoint } from "@excalidraw/math";
import { ROUNDNESS } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FillStyle,
  StrokeStyle,
  Arrowhead,
} from "@excalidraw/element/types";

import type {
  VisualAction,
  CreateBoxAction,
  CreateTextAction,
  CreateCircleAction,
  CreateArrowAction,
  HighlightAction,
  DeleteAction,
  MoveAction,
  ResizeAction,
  CreateArrayAction,
  AnnotatePointerAction,
  ArrayElementHighlight,
  SemanticColor,
  SemanticFill,
  SemanticStrokeStyle,
  SemanticSize,
  SemanticPosition,
  ArrowDirection,
  ConnectorRole,
  BaseStyleOptions,
  CreateLinkedListAction,
  CreateStackAction,
  CreateQueueAction,
  CreateTreeAction,
  CreateGraphAction,
  CreateMatrixAction,
  CreateExplanationBlockAction,
  CreateDividerAction,
} from "./visual-dsl";

import {
  computeTreeLayout,
  computeGraphLayout,
  computeGridLayout,
  doRectsOverlap,
  computeSceneBounds,
  TREE_LAYOUT,
} from "./layout-engine";
import { createGenericEntity } from "./visual-primitives/generic-entity";
import type {
  TreeNodeInput,
  GraphNodeInput,
  GraphEdgeInput,
  LayoutBounds
} from "./layout-engine";

import {
  renderSemanticConnector,
  type ConnectorEndpoint,
} from "./connector-renderer";
import { renderArrayGrammar } from "./visual-grammar/array";
import { renderLinkedListGrammar } from "./visual-grammar/linked-list";
import { renderStackGrammar } from "./visual-grammar/stack";
import { renderQueueGrammar } from "./visual-grammar/queue";
import { renderTreeGrammar } from "./visual-grammar/tree";
import { renderGraphGrammar } from "./visual-grammar/graph";
import { renderMatrixGrammar } from "./visual-grammar/matrix";
import { TOKENS, FONT_FAMILY } from "./visual-primitives/design-tokens";

// ============================================================================
// Centralized Style Mappings
// ============================================================================

export const SEMANTIC_STROKE_COLORS: Record<SemanticColor, string> = {
  default: "#1e1e1e",
  primary: "#1971c2", // Excalidraw Blue
  secondary: "#6741d9", // Excalidraw Violet
  success: "#2f9e44", // Excalidraw Green
  warning: "#f08c00", // Excalidraw Amber
  danger: "#e03131", // Excalidraw Red
  info: "#0c8599", // Excalidraw Cyan
  neutral: "#495057", // Dark Gray
  accent: "#e8590c", // Excalidraw Orange
};

export const SEMANTIC_BG_COLORS: Record<SemanticColor, string> = {
  default: "#ffffff",
  primary: "#e7f5ff",
  secondary: "#f3f0ff",
  success: "#ebfbee",
  warning: "#fff9db",
  danger: "#fff5f5",
  info: "#e3fafc",
  neutral: "#f8f9fa",
  accent: "#fff4e6",
};

export interface SizeDimensions {
  width: number;
  height: number;
  fontSize: number;
}

export const BOX_SIZES: Record<SemanticSize, SizeDimensions> = {
  xs: { width: 110, height: 50, fontSize: 14 },
  sm: { width: 140, height: 65, fontSize: 16 },
  md: { width: 180, height: 80, fontSize: 20 },
  lg: { width: 230, height: 100, fontSize: 24 },
  xl: { width: 280, height: 120, fontSize: 28 },
};

export const CIRCLE_SIZES: Record<SemanticSize, SizeDimensions> = {
  xs: { width: 50, height: 50, fontSize: 14 },
  sm: { width: 65, height: 65, fontSize: 16 },
  md: { width: 85, height: 85, fontSize: 20 },
  lg: { width: 110, height: 110, fontSize: 24 },
  xl: { width: 140, height: 140, fontSize: 28 },
};

export const TEXT_FONT_SIZES: Record<SemanticSize, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export function mapStrokeColor(color?: SemanticColor): string {
  return color
    ? SEMANTIC_STROKE_COLORS[color] ?? SEMANTIC_STROKE_COLORS.default
    : SEMANTIC_STROKE_COLORS.default;
}

export function mapBackgroundColor(color?: SemanticColor): string {
  return color
    ? SEMANTIC_BG_COLORS[color] ?? SEMANTIC_BG_COLORS.default
    : SEMANTIC_BG_COLORS.default;
}

export function mapFillStyle(fill?: SemanticFill): FillStyle {
  switch (fill) {
    case "hachure":
      return "hachure";
    case "transparent":
    case "semi":
    case "solid":
    default:
      return "solid";
  }
}

export function mapStrokeStyle(style?: SemanticStrokeStyle): StrokeStyle {
  switch (style) {
    case "dashed":
      return "dashed";
    case "dotted":
      return "dotted";
    case "solid":
    default:
      return "solid";
  }
}

// ============================================================================
// Layout Constants (canonical dimensions for deterministic layout)
// ============================================================================

export const LAYOUT = {
  /** Width of a single array cell in pixels */
  ARRAY_ELEMENT_WIDTH: 60,
  /** Height of a single array cell in pixels */
  ARRAY_ELEMENT_HEIGHT: 60,
  /** Gap between adjacent array cells */
  ARRAY_ELEMENT_GAP: 4,
  /** Distance from cell bottom edge to the top of the index label */
  ARRAY_INDEX_OFFSET: 8,
  /** Distance from cell top edge to the bottom of an optional array title */
  ARRAY_LABEL_OFFSET: 40,
  /** Vertical distance between pointer label bottom and target element top */
  ARRAY_POINTER_OFFSET: 12,
  STACK_ELEMENT_WIDTH: 120,
  STACK_ELEMENT_HEIGHT: 50,
  STACK_GAP: 4,
} as const;

// ============================================================================
// Bounding-Box Helpers (operate on the registry map)
// ============================================================================

/**
 * Retrieves the bounding box for a registered DSL element.
 * Returns null if the element is not found in the registry.
 */
export function getElementBounds(
  id: string,
  registry: ReadonlyMap<string, RenderedRecord>,
): BoundingBox | null {
  return registry.get(id)?.bounds ?? null;
}

/** Returns the center point of a bounding box. */
export function getCenter(bounds: BoundingBox): { x: number; y: number } {
  return {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
  };
}

/** Returns the top-center point of a bounding box. */
export function getTop(bounds: BoundingBox): { x: number; y: number } {
  return {
    x: Math.round(bounds.x + bounds.width / 2),
    y: bounds.y,
  };
}

/** Returns the bottom-center point of a bounding box. */
export function getBottom(bounds: BoundingBox): { x: number; y: number } {
  return {
    x: Math.round(bounds.x + bounds.width / 2),
    y: bounds.y + bounds.height,
  };
}



export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderedRecord {
  dslId: string;
  primaryElement: ExcalidrawElement;
  textElement?: ExcalidrawTextElement;
  allElements: ExcalidrawElement[];
  bounds: BoundingBox;
}

export interface RenderOptions {
  startX: number;
  startY: number;
  horizontalGap: number;
  verticalGap: number;
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  startX: 100,
  startY: 100,
  horizontalGap: 60,
  verticalGap: 60,
};

export class RenderContext {
  private registry = new Map<string, RenderedRecord>();
  private aliasMap = new Map<string, string>();
  private allElements: ExcalidrawElement[] = [];
  private errors: string[] = [];
  private lastRenderedId: string | null = null;
  public cursor: { x: number; y: number };
  public options: RenderOptions;

  constructor(options?: Partial<RenderOptions>) {
    this.options = { ...DEFAULT_RENDER_OPTIONS, ...options };
    this.cursor = { x: this.options.startX, y: this.options.startY };
  }

  getRecord(dslId: string): RenderedRecord | undefined {
    if (!dslId) {
      return undefined;
    }
    // 1. Direct exact match
    const exact = this.registry.get(dslId);
    if (exact) {
      return exact;
    }

    // 2. Lowercase direct match
    const lower = dslId.toLowerCase().trim();
    if (this.aliasMap.has(lower)) {
      const mappedId = this.aliasMap.get(lower)!;
      const rec = this.registry.get(mappedId);
      if (rec) {
        return rec;
      }
    }

    // 3. Suffix / prefix matches (e.g. 'arr-30' -> '30' or 'node-1-label' -> 'node-1')
    if (lower.endsWith("-label")) {
      const base = dslId.slice(0, -6);
      const rec = this.getRecord(base);
      if (rec) {
        return rec;
      }
    }

    const numMatch = lower.match(/\d+$/);
    if (numMatch && this.aliasMap.has(numMatch[0])) {
      const mappedId = this.aliasMap.get(numMatch[0])!;
      const rec = this.registry.get(mappedId);
      if (rec) {
        return rec;
      }
    }

    return undefined;
  }

  hasRecord(dslId: string): boolean {
    return this.getRecord(dslId) !== undefined;
  }

  getLastRenderedRecord(): RenderedRecord | undefined {
    return this.lastRenderedId
      ? this.getRecord(this.lastRenderedId)
      : undefined;
  }

  getLastRenderedId(): string | null {
    return this.lastRenderedId;
  }

  getGap(axis: "horizontal" | "vertical" = "horizontal"): number {
    return axis === "horizontal"
      ? this.options.horizontalGap
      : this.options.verticalGap;
  }

  private registerAliases(dslId: string, role?: string, text?: string): void {
    const idLower = dslId.toLowerCase().trim();
    this.aliasMap.set(idLower, dslId);

    // Number extraction from ID (e.g. "arr-30" or "item-2" -> "30" or "2")
    const idNum = idLower.match(/\d+$/);
    if (idNum) {
      this.aliasMap.set(idNum[0], dslId);
      this.aliasMap.set(`arr-${idNum[0]}`, dslId);
      this.aliasMap.set(`array-${idNum[0]}`, dslId);
    }

    if (role) {
      this.aliasMap.set(role.toLowerCase().trim(), dslId);
    }

    if (text) {
      const cleanText = text.toLowerCase().trim();
      this.aliasMap.set(cleanText, dslId);
      const textNum = cleanText.match(/^\d+/);
      if (textNum) {
        this.aliasMap.set(textNum[0], dslId);
        this.aliasMap.set(`arr-${textNum[0]}`, dslId);
        this.aliasMap.set(`array-${textNum[0]}`, dslId);
      }
      if (cleanText.includes("mid")) {
        this.aliasMap.set("mid", dslId);
        this.aliasMap.set("midpoint", dslId);
      }
      if (cleanText.includes("root")) {
        this.aliasMap.set("root", dslId);
      }
      if (cleanText.includes("head")) {
        this.aliasMap.set("head", dslId);
      }
      if (cleanText.includes("top")) {
        this.aliasMap.set("top", dslId);
      }
    }
  }

  register(
    dslId: string,
    primaryElement: ExcalidrawElement,
    textElement: ExcalidrawTextElement | undefined,
    allElements: ExcalidrawElement[],
  ): RenderedRecord {
    const record: RenderedRecord = {
      dslId,
      primaryElement,
      textElement,
      allElements,
      bounds: {
        x: primaryElement.x,
        y: primaryElement.y,
        width: primaryElement.width,
        height: primaryElement.height,
      },
    };
    this.registry.set(dslId, record);
    this.registerAliases(
      dslId,
      primaryElement.customData?.role as string | undefined,
      textElement?.text,
    );
    this.lastRenderedId = dslId;
    this.allElements.push(...allElements);
    this.updateCursor(record.bounds);
    return record;
  }

  addOverlayElements(elements: ExcalidrawElement[]) {
    this.allElements.push(...elements);
  }

  seedRecord(dslId: string, element: ExcalidrawElement): void {
    if (this.registry.has(dslId)) {
      return;
    }
    const record: RenderedRecord = {
      dslId,
      primaryElement: element,
      textElement:
        element.type === "text"
          ? (element as ExcalidrawTextElement)
          : undefined,
      allElements: [element],
      bounds: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      },
    };
    this.registry.set(dslId, record);
    this.registerAliases(
      dslId,
      element.customData?.role as string | undefined,
      element.type === "text"
        ? (element as ExcalidrawTextElement).text
        : undefined,
    );
  }

  updateRecordElements(
    dslId: string,
    newElements: ExcalidrawElement[],
    newBounds: BoundingBox,
  ) {
    const existing = this.registry.get(dslId);
    if (!existing) {
      return;
    }

    const oldIds = new Set(existing.allElements.map((e) => e.id));
    this.allElements = this.allElements.filter((e) => !oldIds.has(e.id));
    this.allElements.push(...newElements);

    existing.allElements = newElements;
    existing.primaryElement = newElements[0];
    existing.bounds = newBounds;
    this.updateCursor(newBounds);
  }

  updateEndpointElement(dslId: string, updatedEl: ExcalidrawElement): void {
    const existing = this.getRecord(dslId);
    if (!existing) {
      return;
    }
    existing.primaryElement = updatedEl;
    if (existing.allElements) {
      existing.allElements = existing.allElements.map((e) =>
        e.id === updatedEl.id ? updatedEl : e,
      );
    } else {
      existing.allElements = [updatedEl];
    }
    this.allElements = this.allElements.map((e) =>
      e.id === updatedEl.id ? updatedEl : e,
    );
  }

  deleteRecord(dslId: string): boolean {
    const existing = this.getRecord(dslId);
    if (!existing) {
      return false;
    }

    const actualId = existing.dslId;
    const oldIds = new Set(existing.allElements.map((e) => e.id));
    this.allElements = this.allElements.filter((e) => !oldIds.has(e.id));
    this.registry.delete(actualId);
    if (this.lastRenderedId === actualId) {
      this.lastRenderedId = null;
    }
    return true;
  }

  updateCursor(bounds: BoundingBox) {
    this.cursor.x = bounds.x + bounds.width + this.options.horizontalGap;
    this.cursor.y = bounds.y;
  }

  addError(error: string) {
    this.errors.push(error);
  }

  getErrors(): readonly string[] {
    return this.errors;
  }

  getAllElements(): readonly ExcalidrawElement[] {
    return this.allElements;
  }

  getRegistry(): ReadonlyMap<string, RenderedRecord> {
    return this.registry;
  }
}

// ============================================================================
// Layout Positioning System
// ============================================================================

export function computePosition(
  context: RenderContext,
  width: number,
  height: number,
  position?: SemanticPosition,
): { x: number; y: number } {
  const gapX = context.getGap("horizontal");
  const gapY = context.getGap("vertical");

  // If explicit anchor is specified, or placement is provided with last element as anchor
  const anchorId =
    position?.relativeTo ??
    (position?.placement || position?.slot !== undefined
      ? context.getLastRenderedId()
      : null);
  const anchor = anchorId ? context.getRecord(anchorId) : null;

  if (anchor) {
    const ab = anchor.bounds;
    const placement = position?.placement ?? "right_of";
    const align = position?.align ?? "center";

    let x = 0;
    let y = 0;

    switch (placement) {
      case "right_of":
        x = ab.x + ab.width + gapX;
        y =
          align === "start"
            ? ab.y
            : align === "end"
            ? ab.y + ab.height - height
            : ab.y + (ab.height - height) / 2;
        break;

      case "left_of":
        x = ab.x - width - gapX;
        y =
          align === "start"
            ? ab.y
            : align === "end"
            ? ab.y + ab.height - height
            : ab.y + (ab.height - height) / 2;
        break;

      case "below":
        x =
          align === "start"
            ? ab.x
            : align === "end"
            ? ab.x + ab.width - width
            : ab.x + (ab.width - width) / 2;
        y = ab.y + ab.height + gapY;
        break;

      case "above":
        x =
          align === "start"
            ? ab.x
            : align === "end"
            ? ab.x + ab.width - width
            : ab.x + (ab.width - width) / 2;
        y = ab.y - height - gapY;
        break;

      case "inside":
      case "center":
        x = ab.x + (ab.width - width) / 2;
        y = ab.y + (ab.height - height) / 2;
        break;
    }

    if (position?.slot !== undefined) {
      // Slot offset: for arrays or sequential slots (anchored at base element)
      x = ab.x + position.slot * (width + Math.floor(gapX / 4));
      y = ab.y;
    }

    return { x: Math.round(x), y: Math.round(y) };
  }

  // Fallback 1: if there is a previous element, place right_of previous
  const prev = context.getLastRenderedRecord();
  if (prev) {
    return {
      x: Math.round(prev.bounds.x + prev.bounds.width + gapX),
      y: Math.round(prev.bounds.y),
    };
  }

  // Fallback 2: initial cursor location
  return {
    x: Math.round(context.cursor.x),
    y: Math.round(context.cursor.y),
  };
}

// ============================================================================
// Arrow Geometry Helpers
// ============================================================================

export interface ConnectionPoints {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function computeConnectionPoints(
  fromBounds: BoundingBox,
  toBounds: BoundingBox,
): ConnectionPoints {
  const cx1 = fromBounds.x + fromBounds.width / 2;
  const cy1 = fromBounds.y + fromBounds.height / 2;
  const cx2 = toBounds.x + toBounds.width / 2;
  const cy2 = toBounds.y + toBounds.height / 2;

  const dx = cx2 - cx1;
  const dy = cy2 - cy1;

  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant
    if (dx > 0) {
      startX = fromBounds.x + fromBounds.width;
      startY = cy1;
      endX = toBounds.x;
      endY = cy2;
    } else {
      startX = fromBounds.x;
      startY = cy1;
      endX = toBounds.x + toBounds.width;
      endY = cy2;
    }
  } else if (dy > 0) {
    // Vertical dominant
    startX = cx1;
    startY = fromBounds.y + fromBounds.height;
    endX = cx2;
    endY = toBounds.y;
  } else {
    startX = cx1;
    startY = fromBounds.y;
    endX = cx2;
    endY = toBounds.y + toBounds.height;
  }

  return {
    startX: Math.round(startX),
    startY: Math.round(startY),
    endX: Math.round(endX),
    endY: Math.round(endY),
  };
}

export function resolveArrowheads(direction?: ArrowDirection): {
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
} {
  switch (direction) {
    case "backward":
      return { startArrowhead: "arrow", endArrowhead: null };
    case "bidirectional":
      return { startArrowhead: "arrow", endArrowhead: "arrow" };
    case "none":
      return { startArrowhead: null, endArrowhead: null };
    case "forward":
    default:
      return { startArrowhead: null, endArrowhead: "arrow" };
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

function renderCreateBox(
  action: CreateBoxAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const sizeConfig = BOX_SIZES[action.style?.size || "md"];
  const { x, y } = computePosition(
    context,
    sizeConfig.width,
    sizeConfig.height,
    action.position,
  );

  const strokeColor = action.style?.color
    ? mapStrokeColor(action.style.color)
    : undefined;
  const backgroundColor =
    action.style?.fill === "transparent"
      ? "transparent"
      : action.style?.color
      ? mapBackgroundColor(action.style.color)
      : undefined;

  const primitive = createGenericEntity({
    id: action.id,
    x,
    y,
    width: sizeConfig.width,
    height: sizeConfig.height,
    label: action.label,
    shape: "rectangle",
    role: action.role,
    strokeColor,
    backgroundColor,
    fillStyle: action.style?.fill ? mapFillStyle(action.style.fill) : undefined,
  });

  context.register(action.id, primitive.primaryElement, primitive.allElements.find(e => e.type === "text") as any, primitive.allElements);
  return primitive.allElements;
}

function renderCreateCircle(
  action: CreateCircleAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const sizeConfig = CIRCLE_SIZES[action.style?.size || "md"];
  const { x, y } = computePosition(
    context,
    sizeConfig.width,
    sizeConfig.height,
    action.position,
  );

  const strokeColor = action.style?.color
    ? mapStrokeColor(action.style.color)
    : undefined;
  const backgroundColor =
    action.style?.fill === "transparent"
      ? "transparent"
      : action.style?.color
      ? mapBackgroundColor(action.style.color)
      : undefined;

  const primitive = createGenericEntity({
    id: action.id,
    x,
    y,
    width: sizeConfig.width,
    height: sizeConfig.height,
    label: action.label ?? "",
    shape: "ellipse",
    role: action.role,
    strokeColor,
    backgroundColor,
    fillStyle: action.style?.fill ? mapFillStyle(action.style.fill) : undefined,
  });

  context.register(action.id, primitive.primaryElement, primitive.allElements.find(e => e.type === "text") as any, primitive.allElements);
  return primitive.allElements;
}

function renderCreateText(
  action: CreateTextAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const fontSize =
    TEXT_FONT_SIZES[
      action.style?.size || (action.role === "callout" ? "sm" : "md")
    ];
  // Approximate height/width for positioning
  const estWidth = action.text.length * fontSize * 0.6;
  const estHeight = fontSize * 1.5;

  const { x, y } = computePosition(
    context,
    estWidth,
    estHeight,
    action.position,
  );
  
  const isTitle = action.role === "title" || action.role === "heading";
  const fontFamily = isTitle ? TOKENS.TYPOGRAPHY.Title.fontFamily : FONT_FAMILY.SANS;
  const textColor = TOKENS.NODE.DEFAULT.textPrimary;

  const textEl = newTextElement({
    text: action.text,
    x,
    y,
    fontSize: isTitle ? TOKENS.TYPOGRAPHY.Title.fontSize : fontSize,
    fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: textColor,
    customData: {
      dslId: action.id,
      role: action.role ?? "text",
    },
  });

  context.register(action.id, textEl, textEl, [textEl]);
  return [textEl];
}

export function commitSemanticConnector(
  context: RenderContext,
  opts: {
    id: string;
    from: string;
    to: string;
    direction?: ArrowDirection;
    role?: ConnectorRole;
    label?: string;
    style?: BaseStyleOptions & { elbowed?: boolean };
  },
): ExcalidrawElement[] {
  const fromRecord = context.getRecord(opts.from);
  const toRecord = context.getRecord(opts.to);

  if (!fromRecord || !toRecord) {
    const missing = !fromRecord
      ? `source '${opts.from}'`
      : `target '${opts.to}'`;
    context.addError(`Connector '${opts.id}' could not resolve ${missing}`);
    return [];
  }

  const obstacles: ConnectorEndpoint[] = [];
  for (const [recId, rec] of context.getRegistry()) {
    if (
      recId !== opts.from &&
      recId !== opts.to &&
      rec.primaryElement.type !== "arrow"
    ) {
      obstacles.push({
        primaryElement: rec.primaryElement,
        bounds: rec.bounds,
      });
    }
  }

  const result = renderSemanticConnector(
    {
      id: opts.id,
      from: opts.from,
      to: opts.to,
      direction: opts.direction,
      role: opts.role,
      label: opts.label,
      style: opts.style,
      elbowed: opts.style?.elbowed,
    },
    { primaryElement: fromRecord.primaryElement, bounds: fromRecord.bounds },
    { primaryElement: toRecord.primaryElement, bounds: toRecord.bounds },
    obstacles,
  );

  for (const [endId, updatedEl] of result.updatedEndpoints) {
    context.updateEndpointElement(endId, updatedEl);
  }

  context.register(opts.id, result.primary, result.labelText, result.elements);
  return result.elements;
}

function renderCreateArrow(
  action: CreateArrowAction,
  context: RenderContext,
): ExcalidrawElement[] {
  return commitSemanticConnector(context, {
    id: action.id,
    from: action.from,
    to: action.to,
    direction: action.direction,
    role: action.role,
    label: action.label,
    style: action.style,
  });
}

function renderHighlight(
  action: HighlightAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const targetRecord = context.getRecord(action.target);
  if (!targetRecord) {
    context.addError(
      `Highlight target '${action.target}' not found in registry`,
    );
    return [];
  }

  // Use a tight 4px pad so the highlight matches the element exactly
  const pad = 4;
  const highlightColor = mapStrokeColor(action.color || "accent");
  const highlightBg = mapBackgroundColor(action.color || "accent");

  const highlightRect = newElement({
    type: "rectangle",
    x: targetRecord.bounds.x - pad,
    y: targetRecord.bounds.y - pad,
    width: targetRecord.bounds.width + pad * 2,
    height: targetRecord.bounds.height + pad * 2,
    strokeColor: highlightColor,
    backgroundColor: highlightBg,
    fillStyle: "solid",
    opacity: 30,
    strokeWidth: 2,
    strokeStyle: action.emphasis === "subtle" ? "dotted" : "dashed",
    roughness: 0,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    customData: {
      dslId: `highlight-${action.target}`,
      targetId: action.target,
    },
  });

  const elements: ExcalidrawElement[] = [highlightRect];

  if (action.message) {
    const msgY = targetRecord.bounds.y - pad - 22;
    const messageText = newTextElement({
      text: action.message,
      x: targetRecord.bounds.x,
      y: msgY,
      fontSize: 13,
      fontFamily: 1,
      strokeColor: highlightColor,
      customData: {
        dslId: `highlight-msg-${action.target}`,
      },
    });
    elements.push(messageText);
  }

  context.addOverlayElements(elements);
  return elements;
}


function renderDelete(
  action: DeleteAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const success = context.deleteRecord(action.target);
  if (!success) {
    context.addError(`Delete target '${action.target}' not found in registry`);
  }
  return [];
}

function renderMove(
  action: MoveAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const targetRecord = context.getRecord(action.target);
  if (!targetRecord) {
    context.addError(`Move target '${action.target}' not found in registry`);
    return [];
  }

  const newPos = computePosition(
    context,
    targetRecord.bounds.width,
    targetRecord.bounds.height,
    action.destination,
  );

  const dx = newPos.x - targetRecord.bounds.x;
  const dy = newPos.y - targetRecord.bounds.y;

  const updatedElements: ExcalidrawElement[] = targetRecord.allElements.map(
    (el) =>
      newElementWith(el, {
        x: el.x + dx,
        y: el.y + dy,
      }),
  );

  const newBounds: BoundingBox = {
    x: newPos.x,
    y: newPos.y,
    width: targetRecord.bounds.width,
    height: targetRecord.bounds.height,
  };

  context.updateRecordElements(action.target, updatedElements, newBounds);
  return updatedElements;
}

function renderResize(
  action: ResizeAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const targetRecord = context.getRecord(action.target);
  if (!targetRecord) {
    context.addError(`Resize target '${action.target}' not found in registry`);
    return [];
  }

  const isEllipse = targetRecord.primaryElement.type === "ellipse";
  const sizeConfig = isEllipse
    ? CIRCLE_SIZES[action.size]
    : BOX_SIZES[action.size];

  const updatedPrimary = newElementWith(targetRecord.primaryElement, {
    width: sizeConfig.width,
    height: sizeConfig.height,
  });

  const updatedAll: ExcalidrawElement[] = [updatedPrimary];

  if (targetRecord.textElement) {
    const updatedText = newElementWith(targetRecord.textElement, {
      x: targetRecord.bounds.x + sizeConfig.width / 2,
      y: targetRecord.bounds.y + sizeConfig.height / 2,
      fontSize: sizeConfig.fontSize,
    });
    updatedAll.push(updatedText);
  }

  const newBounds: BoundingBox = {
    x: targetRecord.bounds.x,
    y: targetRecord.bounds.y,
    width: sizeConfig.width,
    height: sizeConfig.height,
  };

  context.updateRecordElements(action.target, updatedAll, newBounds);
  return updatedAll;
}

// ============================================================================
// Semantic Array Renderer
// ============================================================================

/** Maps an ArrayElementHighlight or SemanticColor to a SemanticColor for the cell stroke/bg */
function highlightToColor(
  h?: ArrayElementHighlight | SemanticColor,
): SemanticColor | undefined {
  switch (h) {
    case "low":
    case "high":
      return "accent";
    case "mid":
      return "warning";
    case "target":
    case "found":
      return "success";
    case "eliminated":
      return "neutral";
    case "default":
    case "primary":
    case "secondary":
    case "accent":
    case "neutral":
    case "success":
    case "warning":
    case "danger":
    case "info":
      return h;
    default:
      return undefined;
  }
}

/**
 * Renders a `create_array` action into a deterministic horizontal layout.
 *
 * Layout (from left to right):
 *   [optional title above]
 *   ┌──┬──┬──┬──┐
 *   │  │  │  │  │   ← ARRAY_ELEMENT_HEIGHT px tall
 *   └──┴──┴──┴──┘
 *    0  1  2  3     ← index labels below, ARRAY_INDEX_OFFSET px gap
 *
 * Registry:
 *   ${id}          → full array bounding box
 *   ${id}-${index} → per-element bounding box
 */
function renderCreateArray(
  action: CreateArrayAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const {
    ARRAY_ELEMENT_WIDTH: W,
    ARRAY_ELEMENT_HEIGHT: H,
    ARRAY_ELEMENT_GAP: GAP,
    ARRAY_INDEX_OFFSET: IDX_OFF,
    ARRAY_LABEL_OFFSET: LBL_OFF,
  } = LAYOUT;

  const elements: ExcalidrawElement[] = [];
  const n = action.elements.length;
  if (n === 0) {
    context.addError(`create_array '${action.id}' has no elements`);
    return [];
  }

  // Determine origin. Use explicit x/y if provided, otherwise cursor position.
  const titleHeight = action.label ? LBL_OFF : 0;
  const originX = action.x !== undefined ? action.x : context.cursor.x;
  const originY =
    action.y !== undefined ? action.y : context.cursor.y + titleHeight;

  // Optional title above array
  if (action.label) {
    const titleEl = newTextElement({
      text: action.label,
      x: originX,
      y: originY - titleHeight,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  for (let i = 0; i < n; i++) {
    const el = action.elements[i];
    const cellX = originX + i * (W + GAP);
    const cellY = originY;

    const color = highlightToColor(el.highlight);
    const strokeColor = mapStrokeColor(color);
    const backgroundColor = color ? mapBackgroundColor(color) : "#ffffff";

    // Cell rectangle
    const rect = newElement({
      type: "rectangle",
      x: cellX,
      y: cellY,
      width: W,
      height: H,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: null,
      customData: {
        dslId: `${action.id}-${i}`,
        role: "array-element",
        semanticType: "array_element",
        arrayId: action.id,
        index: i,
        value: el.value,
      },
    });

    // Value label centered in cell
    const valueText = newTextElement({
      text: String(el.value),
      x: cellX + W / 2,
      y: cellY + H / 2,
      fontSize: 18,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: rect.id,
      strokeColor,
      customData: { dslId: `${action.id}-${i}-val` },
    });

    const boundRect = newElementWith(rect, {
      boundElements: [{ type: "text", id: valueText.id }],
    });

    elements.push(boundRect, valueText);

    // Index label below the cell (gray, small)
    const indexLabel = newTextElement({
      text: String(i),
      x: cellX + W / 2,
      y: cellY + H + IDX_OFF,
      fontSize: 13,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "top",
      strokeColor: "#868e96",
      customData: { dslId: `${action.id}-${i}-idx` },
    });
    elements.push(indexLabel);

    // Register the per-element record
    context.register(
      `${action.id}-${i}`,
      boundRect,
      valueText,
      [boundRect, valueText, indexLabel],
    );
  }

  // Register the full-array record spanning all elements
  const totalWidth = n * W + (n - 1) * GAP;

  // Invisible container element for the full-array registry entry
  const arrayContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: totalWidth,
    height: H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: {
      dslId: action.id,
      role: "container",
      arrayId: action.id,
    },
  });
  elements.push(arrayContainer);

  const metadata: ExcalidrawElement[] = [arrayContainer];
  if (action.label && elements.length > 0) {
    // find titleEl in elements since we don't have it in scope
    const title = elements.find((e) => (e.customData as any)?.dslId === `${action.id}-title`);
    if (title) metadata.push(title);
  }

  context.register(action.id, arrayContainer, undefined, metadata);

  // Set cursor to the right of the full array
  context.cursor.x = originX + totalWidth + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}


function renderCreateLinkedList(
  action: CreateLinkedListAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const {
    ARRAY_ELEMENT_WIDTH: W,
    ARRAY_ELEMENT_HEIGHT: H,
    ARRAY_ELEMENT_GAP: GAP,
    ARRAY_LABEL_OFFSET: LBL_OFF,
  } = LAYOUT;
  
  const NODE_GAP = GAP + 40; // Space for arrows

  const elements: ExcalidrawElement[] = [];
  const n = action.elements.length;

  const titleHeight = action.label ? LBL_OFF : 0;
  const originX = context.cursor.x;
  const originY = context.cursor.y + titleHeight;

  if (action.label) {
    const titleEl = newTextElement({
      text: action.label,
      x: originX,
      y: originY - titleHeight,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }
  
  if (n === 0) return elements;

  let lastNodeX = originX;
  const nodeElements: ExcalidrawElement[] = [];

  for (let i = 0; i < n; i++) {
    const el = action.elements[i];
    const cellX = originX + i * (W + NODE_GAP);
    const cellY = originY;
    lastNodeX = cellX;

    const color = highlightToColor(el.highlight);
    const strokeColor = mapStrokeColor(color);
    const backgroundColor = color ? mapBackgroundColor(color) : "#ffffff";

    const rect = newElement({
      type: "rectangle",
      x: cellX,
      y: cellY,
      width: W,
      height: H,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: null,
      customData: {
        dslId: `${action.id}-${i}`,
        role: "linked-list-node",
        semanticType: "linked_list_node",
        listId: action.id,
        index: i,
        value: el.value,
      },
    });

    const valueText = newTextElement({
      text: String(el.value),
      x: cellX + W / 2,
      y: cellY + H / 2,
      fontSize: 18,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: rect.id,
      strokeColor,
      customData: { dslId: `${action.id}-${i}-val` },
    });

    const boundRect = newElementWith(rect, {
      boundElements: [{ type: "text", id: valueText.id }],
    });

    elements.push(boundRect, valueText);
    nodeElements.push(boundRect);
    context.register(`${action.id}-${i}`, boundRect, valueText, [boundRect, valueText]);

    if (i < n - 1) {
      const arrowStartX = cellX + W;
      const arrowEndX = arrowStartX + NODE_GAP;
      const arrowY = cellY + H / 2;
      const dx = arrowEndX - arrowStartX;
      
      const arrow = newArrowElement({
        type: "arrow",
        x: arrowStartX,
        y: arrowY,
        width: Math.max(Math.abs(dx), 1),
        height: 1,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(dx, 0)],
        startArrowhead: action.variant === "doubly" ? "arrow" : null,
        endArrowhead: "arrow",
        strokeColor: "#1e1e1e",
        strokeWidth: 2,
        roughness: 0,
        customData: { dslId: `${action.id}-edge-${i}` },
      });
      elements.push(arrow);
    }
  }

  // Null node
  const nullX = lastNodeX + W + NODE_GAP;
  const nullY = originY + H / 2;
  const nullText = newTextElement({
    text: "NULL",
    x: nullX,
    y: nullY - 9, // adjust for center
    fontSize: 14,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: "#868e96",
    customData: { dslId: `${action.id}-null` },
  });
  
  const lastArrowStartX = lastNodeX + W;
  const dx = nullX - lastArrowStartX - 10;
  const lastArrow = newArrowElement({
    type: "arrow",
    x: lastArrowStartX,
    y: originY + H / 2,
    width: Math.max(Math.abs(dx), 1),
    height: 1,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(dx, 0)],
    startArrowhead: null,
    endArrowhead: "arrow",
    strokeColor: "#1e1e1e",
    strokeWidth: 2,
    roughness: 0,
    customData: { dslId: `${action.id}-edge-null` },
  });
  
  elements.push(nullText, lastArrow);
  context.register(`${action.id}-null`, nullText, nullText, [nullText]);

  const totalWidth = nullX + 40 - originX;
  const listContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: totalWidth,
    height: H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(listContainer);
  context.register(action.id, listContainer, undefined, [listContainer]);

  context.cursor.x = originX + totalWidth + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}

function renderCreateStack(
  action: CreateStackAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const { STACK_ELEMENT_WIDTH: W, STACK_ELEMENT_HEIGHT: H, STACK_GAP: GAP, ARRAY_LABEL_OFFSET: LBL_OFF } = LAYOUT;
  const elements: ExcalidrawElement[] = [];
  const n = action.elements.length;

  const titleHeight = action.label ? LBL_OFF : 0;
  const originX = context.cursor.x;
  const originY = context.cursor.y + titleHeight;

  if (action.label) {
    const titleEl = newTextElement({
      text: action.label,
      x: originX,
      y: originY - titleHeight,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  for (let i = 0; i < n; i++) {
    const el = action.elements[i];
    const cellX = originX;
    const cellY = originY + i * (H + GAP);

    const color = highlightToColor(el.highlight);
    const strokeColor = mapStrokeColor(color);
    const backgroundColor = color ? mapBackgroundColor(color) : "#ffffff";

    const rect = newElement({
      type: "rectangle",
      x: cellX,
      y: cellY,
      width: W,
      height: H,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: null,
      customData: {
        dslId: `${action.id}-${i}`,
        role: "stack-element",
        semanticType: "stack_element",
        stackId: action.id,
        index: i,
        value: el.value,
      },
    });

    const valueText = newTextElement({
      text: String(el.value),
      x: cellX + W / 2,
      y: cellY + H / 2,
      fontSize: 18,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: rect.id,
      strokeColor,
      customData: { dslId: `${action.id}-${i}-val` },
    });

    const boundRect = newElementWith(rect, {
      boundElements: [{ type: "text", id: valueText.id }],
    });

    elements.push(boundRect, valueText);
    context.register(`${action.id}-${i}`, boundRect, valueText, [boundRect, valueText]);
  }

  const totalHeight = n * H + Math.max(0, n - 1) * GAP;
  const stackContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: W,
    height: totalHeight || H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(stackContainer);
  context.register(action.id, stackContainer, undefined, [stackContainer]);

  if (n > 0) {
    const pointerAction: AnnotatePointerAction = {
      type: "annotate_pointer",
      id: `${action.id}-top-ptr`,
      label: "TOP",
      target: `${action.id}-0`,
      placement: "right"
    };
    elements.push(...renderAnnotatePointer(pointerAction, context));
  }

  context.cursor.x = originX + W + 100 + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}

function renderCreateTree(
  action: CreateTreeAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];
  const titleHeight = action.label ? LAYOUT.ARRAY_LABEL_OFFSET : 0;
  const originX = context.cursor.x;
  const originY = context.cursor.y + titleHeight;

  if (action.label) {
    const titleEl = newTextElement({
      text: action.label,
      x: originX,
      y: originY - titleHeight,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  const nodeMap = new Map(action.nodes.map(n => [n.id, n]));
  const layoutNodes: TreeNodeInput[] = action.nodes.map(n => ({
    id: n.id,
    value: n.value,
    children: n.children || [n.left, n.right].filter(Boolean) as string[]
  }));

  const layout = computeTreeLayout(layoutNodes, action.root, { x: originX, y: originY });

  const renderedNodes = new Map<string, ExcalidrawElement>();

  for (const [lnId, pos] of layout.positions) {
    const nodeDef = nodeMap.get(lnId);
    if (!nodeDef) continue;
    
    const color = highlightToColor(nodeDef.highlight);
    const strokeColor = mapStrokeColor(color);
    const backgroundColor = color ? mapBackgroundColor(color) : "#ffffff";

    const circle = newElement({
      type: "ellipse",
      x: pos.x,
      y: pos.y,
      width: TREE_LAYOUT.NODE_DIAMETER,
      height: TREE_LAYOUT.NODE_DIAMETER,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      customData: {
        dslId: `${action.id}-${lnId}`,
        role: "tree-node",
        semanticType: "tree_node",
        treeId: action.id,
        nodeId: lnId,
        value: nodeDef.value,
        left: nodeDef.left,
        right: nodeDef.right,
        children: nodeDef.children,
      },
    });

    const valueText = newTextElement({
      text: String(nodeDef.value),
      x: pos.x + TREE_LAYOUT.NODE_RADIUS,
      y: pos.y + TREE_LAYOUT.NODE_RADIUS,
      fontSize: 18,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: circle.id,
      strokeColor,
      customData: { dslId: `${action.id}-${lnId}-val` },
    });

    const boundCircle = newElementWith(circle, {
      boundElements: [{ type: "text", id: valueText.id }],
    });

    elements.push(boundCircle, valueText);
    context.register(`${action.id}-${lnId}`, boundCircle, valueText, [boundCircle, valueText]);
    renderedNodes.set(lnId, boundCircle);
  }

  for (const [lnId, pos] of layout.positions) {
    const nodeDef = nodeMap.get(lnId);
    if (!nodeDef) continue;
    const parentEl = renderedNodes.get(lnId);
    if (!parentEl) continue;

    const children = nodeDef.children || [nodeDef.left, nodeDef.right].filter(Boolean) as string[];
    for (const childId of children) {
      const childEl = renderedNodes.get(childId);
      if (!childEl) continue;
      
      const { startX, startY, endX, endY } = computeConnectionPoints(
        { x: parentEl.x, y: parentEl.y, width: parentEl.width, height: parentEl.height },
        { x: childEl.x, y: childEl.y, width: childEl.width, height: childEl.height }
      );
      
      const dx = endX - startX;
      const dy = endY - startY;

      const arrow = newArrowElement({
        type: "arrow",
        x: startX,
        y: startY,
        width: Math.max(Math.abs(dx), 1),
        height: Math.max(Math.abs(dy), 1),
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(dx, dy)],
        startArrowhead: null,
        endArrowhead: "arrow",
        strokeColor: "#1e1e1e",
        strokeWidth: 2,
        roughness: 0,
        customData: { dslId: `${action.id}-edge-${lnId}-${childId}` },
      });
      elements.push(arrow);
    }
  }

  const bounds = layout.bounds;
  const treeContainer = newElement({
    type: "rectangle",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width || 60,
    height: bounds.height || 60,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(treeContainer);
  const metadata: ExcalidrawElement[] = [treeContainer];
  context.register(action.id, treeContainer, undefined, metadata);

  context.cursor.x = bounds.x + bounds.width + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}

function renderCreateGraph(
  action: CreateGraphAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];
  const titleHeight = action.label ? LAYOUT.ARRAY_LABEL_OFFSET : 0;
  const originX = context.cursor.x;
  const originY = context.cursor.y + titleHeight;

  if (action.label) {
    const titleEl = newTextElement({
      text: action.label,
      x: originX,
      y: originY - titleHeight,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  const layoutNodes: GraphNodeInput[] = action.nodes.map(n => ({
    id: n.id,
    label: n.label,
  }));
  const layoutEdges: GraphEdgeInput[] = action.edges.map(e => ({
    from: e.from,
    to: e.to,
    weight: e.weight,
    label: e.label,
    directed: e.directed,
  }));

  const layout = computeGraphLayout(layoutNodes, layoutEdges, { x: originX, y: originY });
  const nodeMap = new Map(action.nodes.map(n => [n.id, n]));
  const renderedNodes = new Map<string, ExcalidrawElement>();

  for (const [lnId, pos] of layout.positions) {
    const nodeDef = nodeMap.get(lnId);
    if (!nodeDef) continue;
    
    const color = highlightToColor(nodeDef.highlight);
    const strokeColor = mapStrokeColor(color);
    const backgroundColor = color ? mapBackgroundColor(color) : "#ffffff";

    const circle = newElement({
      type: "ellipse",
      x: pos.x,
      y: pos.y,
      width: 60,
      height: 60,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      customData: {
        dslId: `${action.id}-${lnId}`,
        role: "graph-node",
        semanticType: "graph_node",
        graphId: action.id,
        nodeId: lnId,
        label: nodeDef.label,
      },
    });

    const valueText = newTextElement({
      text: nodeDef.label,
      x: pos.x + 30,
      y: pos.y + 30,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: circle.id,
      strokeColor,
      customData: { dslId: `${action.id}-${lnId}-val` },
    });

    const boundCircle = newElementWith(circle, {
      boundElements: [{ type: "text", id: valueText.id }],
    });

    elements.push(boundCircle, valueText);
    context.register(`${action.id}-${lnId}`, boundCircle, valueText, [boundCircle, valueText]);
    renderedNodes.set(lnId, boundCircle);
  }

  for (const edge of action.edges) {
    const fromEl = renderedNodes.get(edge.from);
    const toEl = renderedNodes.get(edge.to);
    if (!fromEl || !toEl) continue;

    const { startX, startY, endX, endY } = computeConnectionPoints(
      { x: fromEl.x, y: fromEl.y, width: fromEl.width, height: fromEl.height },
      { x: toEl.x, y: toEl.y, width: toEl.width, height: toEl.height }
    );
    
    const dx = endX - startX;
    const dy = endY - startY;

    const isDirected = edge.directed ?? action.directed ?? true;
    const color = highlightToColor(edge.highlight);
    const strokeColor = mapStrokeColor(color);

    const arrow = newArrowElement({
      type: "arrow",
      x: startX,
      y: startY,
      width: Math.max(Math.abs(dx), 1),
      height: Math.max(Math.abs(dy), 1),
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(dx, dy)],
      startArrowhead: null,
      endArrowhead: isDirected ? "arrow" : null,
      strokeColor,
      strokeWidth: 2,
      roughness: 0,
      customData: {
        dslId: `${action.id}-edge-${edge.from}-${edge.to}`,
        role: "graph-edge",
        semanticType: "graph_edge",
        graphId: action.id,
        from: edge.from,
        to: edge.to,
        weight: edge.weight,
      },
    });
    elements.push(arrow);

    const edgeLabel = edge.label || (edge.weight !== undefined ? String(edge.weight) : undefined);
    if (edgeLabel) {
      const midX = startX + dx / 2;
      const midY = startY + dy / 2;
      const textEl = newTextElement({
        text: edgeLabel,
        x: midX,
        y: midY - 10,
        fontSize: 14,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor,
        customData: { dslId: `${action.id}-edge-${edge.from}-${edge.to}-label` },
      });
      elements.push(textEl);
    }
  }

  const bounds = layout.bounds;
  const graphContainer = newElement({
    type: "rectangle",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width || 60,
    height: bounds.height || 60,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(graphContainer);
  const metadata: ExcalidrawElement[] = [graphContainer];
  context.register(action.id, graphContainer, undefined, metadata);

  context.cursor.x = bounds.x + bounds.width + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}

function renderCreateMatrix(
  action: CreateMatrixAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const { ARRAY_ELEMENT_WIDTH: W, ARRAY_ELEMENT_HEIGHT: H, ARRAY_ELEMENT_GAP: GAP } = LAYOUT;
  const elements: ExcalidrawElement[] = [];
  const titleHeight = action.label ? LAYOUT.ARRAY_LABEL_OFFSET : 0;
  
  const hasRowHeaders = action.rowHeaders && action.rowHeaders.length > 0;
  const hasColHeaders = action.colHeaders && action.colHeaders.length > 0;
  
  const headerOffset = 40;
  const originX = context.cursor.x + (hasRowHeaders ? headerOffset : 0);
  const originY = context.cursor.y + titleHeight + (hasColHeaders ? headerOffset : 0);

  if (action.label) {
    const titleEl = newTextElement({
      text: action.label,
      x: context.cursor.x,
      y: context.cursor.y,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  const numRows = action.rows.length;
  const numCols = numRows > 0 ? action.rows[0].length : 0;
  
  const layout = computeGridLayout(numRows, numCols, { x: originX, y: originY });

  if (hasColHeaders) {
    for (let c = 0; c < numCols; c++) {
      const text = action.colHeaders![c];
      const cx = originX + c * (W + GAP) + W / 2;
      const cy = originY - headerOffset / 2;
      const headerEl = newTextElement({
        text,
        x: cx,
        y: cy - 9,
        fontSize: 14,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#868e96",
        customData: { dslId: `${action.id}-col-header-${c}` },
      });
      elements.push(headerEl);
    }
  }

  if (hasRowHeaders) {
    for (let r = 0; r < numRows; r++) {
      const text = action.rowHeaders![r];
      const cx = originX - headerOffset / 2;
      const cy = originY + r * (H + GAP) + H / 2;
      const headerEl = newTextElement({
        text,
        x: cx,
        y: cy - 9,
        fontSize: 14,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#868e96",
        customData: { dslId: `${action.id}-row-header-${r}` },
      });
      elements.push(headerEl);
    }
  }

  const highlights = new Map(action.highlights?.map(h => [`${h.row}-${h.col}`, h.color]));

  for (const [key, pos] of layout.cellPositions) {
    const parts = key.split("-");
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    const value = action.rows[row]?.[col] ?? "";
    
    const highlight = highlights.get(`${row}-${col}`);
    const color = highlightToColor(highlight);
    const strokeColor = mapStrokeColor(color);
    const backgroundColor = color ? mapBackgroundColor(color) : "#ffffff";

    const rect = newElement({
      type: "rectangle",
      x: pos.x,
      y: pos.y,
      width: W,
      height: H,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: null,
      customData: {
        dslId: `${action.id}-${row}-${col}`,
        role: "matrix-cell",
        semanticType: "matrix_cell",
        matrixId: action.id,
        row,
        col,
        value,
      },
    });

    const valueText = newTextElement({
      text: String(value),
      x: pos.x + W / 2,
      y: pos.y + H / 2,
      fontSize: 18,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: rect.id,
      strokeColor,
      customData: { dslId: `${action.id}-${row}-${col}-val` },
    });

    const boundRect = newElementWith(rect, {
      boundElements: [{ type: "text", id: valueText.id }],
    });

    elements.push(boundRect, valueText);
    context.register(`${action.id}-${row}-${col}`, boundRect, valueText, [boundRect, valueText]);
  }

  const bounds = layout.bounds;
  const matrixContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: bounds.width || W,
    height: bounds.height || H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(matrixContainer);
  const metadata: ExcalidrawElement[] = [matrixContainer];
  context.register(action.id, matrixContainer, undefined, metadata);

  context.cursor.x = originX + (bounds.width || W) + context.options.horizontalGap;

  return elements;
}

// ============================================================================
// Annotate Pointer Renderer
// ============================================================================

/**
 * Renders a `annotate_pointer` action as a label + downward (or upward) arrow
 * that points at the exact bounding box of the target element.
 *
 * For placement: "above":
 *   label text
 *      ↓         ← arrow from label bottom to target top-center
 *   [target]
 *
 * For placement: "below":
 *   [target]
 *      ↓         ← arrow from target bottom-center downward, label below
 *   label text
 */
export function renderAnnotatePointer(
  action: AnnotatePointerAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const targetRecord = context.getRecord(action.target);
  if (!targetRecord) {
    context.addError(
      `annotate_pointer '${action.id}': target '${action.target}' not found in registry`,
    );
    return [];
  }

  const { ARRAY_POINTER_OFFSET: PTR_OFF } = LAYOUT;
  const tb = targetRecord.bounds;
  const strokeColor = mapStrokeColor(action.color ?? "neutral");
  const offset = action.offset ?? 0;

  const elements: ExcalidrawElement[] = [];

  const targetCenterX = Math.round(tb.x + tb.width / 2);
  const targetCenterY = Math.round(tb.y + tb.height / 2);
  const labelFontSize = 14;

  if (action.placement === "above") {
    const arrowEndY = tb.y;
    const arrowStartY = arrowEndY - PTR_OFF - offset;
    const dy = arrowEndY - arrowStartY;

    const arrowEl = newArrowElement({
      type: "arrow",
      x: targetCenterX,
      y: arrowStartY,
      width: 1,
      height: Math.max(Math.abs(dy), 1),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(0, dy),
      ],
      startArrowhead: null,
      endArrowhead: "arrow",
      strokeColor,
      strokeWidth: 2,
      roughness: 0,
      customData: { dslId: `${action.id}-arrow` },
    });

    const labelEl = newTextElement({
      text: action.label,
      x: targetCenterX,
      y: arrowStartY - labelFontSize - 4,
      fontSize: labelFontSize,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "top",
      strokeColor,
      customData: { dslId: `${action.id}-label` },
    });

    elements.push(arrowEl, labelEl);
    context.register(action.id, arrowEl, labelEl, elements);
  } else if (action.placement === "below") {
    const arrowStartY = tb.y + tb.height;
    const arrowEndY = arrowStartY + PTR_OFF + offset;
    const dy = arrowEndY - arrowStartY;

    const arrowEl = newArrowElement({
      type: "arrow",
      x: targetCenterX,
      y: arrowStartY,
      width: 1,
      height: Math.max(Math.abs(dy), 1),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(0, dy),
      ],
      startArrowhead: null,
      endArrowhead: "arrow",
      strokeColor,
      strokeWidth: 2,
      roughness: 0,
      customData: { dslId: `${action.id}-arrow` },
    });

    const labelEl = newTextElement({
      text: action.label,
      x: targetCenterX,
      y: arrowEndY + 4,
      fontSize: labelFontSize,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "top",
      strokeColor,
      customData: { dslId: `${action.id}-label` },
    });

    elements.push(arrowEl, labelEl);
    context.register(action.id, arrowEl, labelEl, elements);
  } else if (action.placement === "left") {
    const arrowEndX = tb.x;
    const arrowStartX = arrowEndX - PTR_OFF - offset;
    const dx = arrowEndX - arrowStartX;

    const arrowEl = newArrowElement({
      type: "arrow",
      x: arrowStartX,
      y: targetCenterY,
      width: Math.max(Math.abs(dx), 1),
      height: 1,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(dx, 0),
      ],
      startArrowhead: null,
      endArrowhead: "arrow",
      strokeColor,
      strokeWidth: 2,
      roughness: 0,
      customData: { dslId: `${action.id}-arrow` },
    });

    const labelEl = newTextElement({
      text: action.label,
      x: arrowStartX - 4,
      y: targetCenterY - labelFontSize / 2,
      fontSize: labelFontSize,
      fontFamily: 1,
      textAlign: "right",
      verticalAlign: "middle",
      strokeColor,
      customData: { dslId: `${action.id}-label` },
    });
    
    elements.push(arrowEl, labelEl);
    context.register(action.id, arrowEl, labelEl, elements);
  } else if (action.placement === "right") {
    const arrowStartX = tb.x + tb.width;
    const arrowEndX = arrowStartX + PTR_OFF + offset;
    const dx = arrowEndX - arrowStartX;

    const arrowEl = newArrowElement({
      type: "arrow",
      x: arrowStartX,
      y: targetCenterY,
      width: Math.max(Math.abs(dx), 1),
      height: 1,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(dx, 0),
      ],
      startArrowhead: null,
      endArrowhead: "arrow",
      strokeColor,
      strokeWidth: 2,
      roughness: 0,
      customData: { dslId: `${action.id}-arrow` },
    });

    const labelEl = newTextElement({
      text: action.label,
      x: arrowEndX + 4,
      y: targetCenterY - labelFontSize / 2,
      fontSize: labelFontSize,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "middle",
      strokeColor,
      customData: { dslId: `${action.id}-label` },
    });

    elements.push(arrowEl, labelEl);
    context.register(action.id, arrowEl, labelEl, elements);
  }

  return elements;
}

/**
 * Renders an educational explanation card directly below or near the main data structure.
 * Displays step title, formatted pedagogical explanation, calculations, and insights.
 */
export function renderCreateExplanationBlock(
  action: CreateExplanationBlockAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];

  // Determine anchor bounds from context registry
  const reg = context.getRegistry();
  const boundsList: LayoutBounds[] = [];
  for (const record of reg.values()) {
    if (record.primaryElement.customData?.role !== "explanation-card") {
      boundsList.push(record.bounds);
    }
  }

  let anchorBounds = {
    x: context.cursor.x,
    y: context.cursor.y,
    width: 520,
    height: 100,
  };

  if (action.relativeTo) {
    const relRecord = context.getRecord(action.relativeTo);
    if (relRecord) {
      anchorBounds = relRecord.bounds;
    }
  } else if (boundsList.length > 0) {
    anchorBounds = computeSceneBounds(boundsList);
  }

  // Card placement: 36px below the bottom of the data structure
  const CARD_WIDTH = Math.min(Math.max(anchorBounds.width, 680), 840);
  const cardX = anchorBounds.x;
  const cardY = anchorBounds.y + anchorBounds.height + 36;

  const PADDING = 22;
  let currentY = cardY + PADDING;

  // 1. Title & Step Badge text
  const stepBadge = action.stepNumber
    ? `Step ${action.stepNumber}${action.totalSteps ? ` of ${action.totalSteps}` : ""}: `
    : "";
  const titleTextStr = `${stepBadge}${action.title}`;

  const titleEl = newTextElement({
    text: titleTextStr,
    x: cardX + PADDING,
    y: currentY,
    fontSize: 18,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    strokeColor: "#1971c2", // Primary blue
    customData: { dslId: `${action.id}-title` },
  });
  elements.push(titleEl);
  currentY += 32;

  // 2. Explanation body text
  const bodyEl = newTextElement({
    text: action.explanation,
    x: cardX + PADDING,
    y: currentY,
    fontSize: 15,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    strokeColor: "#212529",
    width: CARD_WIDTH - PADDING * 2,
    customData: { dslId: `${action.id}-body` },
  });
  elements.push(bodyEl);
  currentY += Math.max(bodyEl.height, 40) + 14;

  // 3. Optional Calculation / Formula section
  if (action.calculations) {
    const calcEl = newTextElement({
      text: `📐 ${action.calculations}`,
      x: cardX + PADDING,
      y: currentY,
      fontSize: 14,
      fontFamily: 3, // monospace
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#0c8599", // cyan/teal
      width: CARD_WIDTH - PADDING * 2,
      customData: { dslId: `${action.id}-calc` },
    });
    elements.push(calcEl);
    currentY += Math.max(calcEl.height, 24) + 10;
  }

  // 4. Optional Pedagogical Insight callout
  if (action.insight) {
    const insightEl = newTextElement({
      text: `💡 Key Insight: ${action.insight}`,
      x: cardX + PADDING,
      y: currentY,
      fontSize: 14,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#e8590c", // orange accent
      width: CARD_WIDTH - PADDING * 2,
      customData: { dslId: `${action.id}-insight` },
    });
    elements.push(insightEl);
    currentY += Math.max(insightEl.height, 24) + 10;
  }

  const CARD_HEIGHT = Math.max(currentY - cardY + PADDING / 2, 90);

  // 5. Card background rectangle (rendered underneath texts)
  const cardBg = newElement({
    type: "rectangle",
    x: cardX,
    y: cardY,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    strokeColor: "#ced4da",
    backgroundColor: "#f8f9fa",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    customData: {
      dslId: action.id,
      role: "explanation-card",
      semanticType: "explanation_card",
    },
  });

  elements.unshift(cardBg);
  context.register(action.id, cardBg, titleEl, elements);
  return elements;
}

/**
 * Renders a clean divider line separating vertical lesson steps.
 */
export function renderCreateDivider(
  action: CreateDividerAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const x = action.x ?? context.options.startX;
  const y = action.y ?? context.cursor.y;
  const width = action.width ?? 780;

  const line = newArrowElement({
    type: "arrow",
    x,
    y,
    width,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(width, 0)],
    startArrowhead: null,
    endArrowhead: null,
    strokeColor: action.style?.color
      ? mapStrokeColor(action.style.color)
      : "#dee2e6",
    strokeStyle: action.style?.strokeStyle
      ? mapStrokeStyle(action.style.strokeStyle)
      : "dashed",
    strokeWidth: 2,
    roughness: 0,
    customData: {
      dslId: action.id,
      role: "step-divider",
      semanticType: "divider",
    },
  });

  const elements: ExcalidrawElement[] = [line];

  if (action.label) {
    const labelEl = newTextElement({
      text: action.label,
      x: x + 16,
      y: y - 22,
      fontSize: 12,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "bottom",
      strokeColor: "#868e96",
      customData: { dslId: `${action.id}-label` },
    });
    elements.push(labelEl);
  }

  context.register(action.id, line, undefined, elements);
  return elements;
}

// ============================================================================
// Public Dispatcher API
// ============================================================================

export interface RenderResult {
  elements: ExcalidrawElement[];
  registry: ReadonlyMap<string, RenderedRecord>;
  errors: readonly string[];
}

/**
 * Renders a single VisualAction into native Excalidraw elements.
 */
export function renderAction(
  action: VisualAction,
  context: RenderContext,
): ExcalidrawElement[] {
  switch (action.type) {
    case "create_box":
      return renderCreateBox(action, context);
    case "create_circle":
      return renderCreateCircle(action, context);
    case "create_text":
      return renderCreateText(action, context);
    case "create_arrow":
      return renderCreateArrow(action, context);
    case "highlight":
      return renderHighlight(action, context);
    case "delete":
      return renderDelete(action, context);
    case "move":
      return renderMove(action, context);
    case "resize":
      return renderResize(action, context);
    case "create_array":
      return renderArrayGrammar(action, context);
    case "create_linked_list":
      return renderLinkedListGrammar(action, context);
    case "create_stack":
      return renderStackGrammar(action, context);
    case "create_queue":
      return renderQueueGrammar(action, context);
    case "create_tree":
      return renderTreeGrammar(action, context);
    case "create_graph":
      return renderGraphGrammar(action, context);
    case "create_matrix":
      return renderMatrixGrammar(action, context);
    case "create_explanation_block":
      return renderCreateExplanationBlock(action, context);
    case "create_divider":
      return renderCreateDivider(action, context);
    case "annotate_pointer":
      return renderAnnotatePointer(action, context);
    default: {
      const exhaustiveCheck: never = action;
      context.addError(
        `Unsupported action type: ${(exhaustiveCheck as any)?.type}`,
      );
      return [];
    }
  }
}

/**
 * Topologically sorts VisualActions into a valid dependency execution order:
 * 1. Independent creation actions (boxes, circles, text)
 * 2. Relative creation actions (anchors resolved before dependents)
 * 3. Arrows (connecting created nodes)
 * 4. Highlights, moves, resizes (targeting created nodes)
 * 5. Deletions
 */
export function sortActionsByDependency(
  actions: VisualAction[],
): VisualAction[] {
  const creations: VisualAction[] = [];
  const arrows: VisualAction[] = [];
  const overlays: VisualAction[] = [];
  const deletions: VisualAction[] = [];

  for (const act of actions) {
    if (act.type === "create_arrow" || act.type === "annotate_pointer") {
      arrows.push(act);
    } else if (act.type === "delete") {
      deletions.push(act);
    } else if (
      act.type === "highlight" ||
      act.type === "move" ||
      act.type === "resize"
    ) {
      overlays.push(act);
    } else {
      creations.push(act);
    }
  }

  // Topologically sort creation actions based on position.relativeTo
  const sortedCreations: VisualAction[] = [];
  const createdIds = new Set<string>();

  // Pass 1: Creations with no relativeTo anchor come first
  const pendingRelative: VisualAction[] = [];
  for (const act of creations) {
    const id = "id" in act ? (act as { id?: string }).id : undefined;
    const rel =
      "position" in act && act.position ? act.position.relativeTo : undefined;

    if (!rel) {
      sortedCreations.push(act);
      if (id) {
        createdIds.add(id);
      }
    } else {
      pendingRelative.push(act);
    }
  }

  // Pass 2: Iteratively resolve relative creations as their anchors become available
  let maxPasses = pendingRelative.length + 2;
  while (pendingRelative.length > 0 && maxPasses-- > 0) {
    let progressed = false;
    for (let i = pendingRelative.length - 1; i >= 0; i--) {
      const act = pendingRelative[i];
      const id = "id" in act ? (act as { id?: string }).id : undefined;
      const rel =
        "position" in act && act.position ? act.position.relativeTo : undefined;

      if (rel && createdIds.has(rel)) {
        sortedCreations.push(act);
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
 * Deterministically renders a batch of VisualAction commands into Excalidraw elements.
 */
export function renderActions(
  actions: VisualAction[],
  context?: RenderContext,
): RenderResult {
  const ctx = context ?? new RenderContext();
  const sorted = sortActionsByDependency(actions);

  for (const action of sorted) {
    renderAction(action, ctx);
  }

  return {
    elements: [...ctx.getAllElements()],
    registry: ctx.getRegistry(),
    errors: ctx.getErrors(),
  };
}

// ============================================================================
// Hardcoded Example Test Helper
// ============================================================================

export const EXAMPLE_BINARY_SEARCH_ACTIONS: VisualAction[] = [
  {
    type: "create_box",
    id: "node-1",
    label: "Binary Search",
    role: "generic",
  },
  {
    type: "create_box",
    id: "node-2",
    label: "Sorted Array",
    role: "array-element",
    position: {
      relativeTo: "node-1",
      placement: "below",
    },
  },
  {
    type: "create_arrow",
    id: "arrow-1",
    from: "node-1",
    to: "node-2",
    direction: "forward",
  },
];

/**
 * Executes the standard hardcoded example to verify the renderer pipeline.
 */
export function runExampleBinarySearchTest(): RenderResult {
  return renderActions(EXAMPLE_BINARY_SEARCH_ACTIONS);
}
