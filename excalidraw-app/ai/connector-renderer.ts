import { TYPOGRAPHY } from "./visual-primitives/typography";
import { TOKENS, mapSemanticStateToEdgeTokens } from "./visual-primitives/design-tokens";
import { createEdgeWeight } from "./visual-primitives/edge-weight";

/**
 * Semantic Connector Renderer
 *
 * Resolves semantic source/target IDs into bound Excalidraw arrow elements.
 * The renderer owns geometry; the AI only specifies from/to relationships.
 */

import {
  newArrowElement,
  newElementWith,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  Arrowhead,
  FixedPoint,
  StrokeStyle,
} from "@excalidraw/element/types";

import type {
  ArrowDirection,
  BaseStyleOptions,
  ConnectorRole,
  SemanticColor,
  SemanticStrokeStyle,
} from "./visual-dsl";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConnectorEndpoint {
  primaryElement: ExcalidrawElement;
  bounds: BoundingBox;
}

export interface ConnectionPoints {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface SemanticConnectorSpec {
  id: string;
  from: string;
  to: string;
  label?: string;
  direction?: ArrowDirection;
  role?: ConnectorRole;
  highlight?: string; // Replace color with semantic highlight
  color?: SemanticColor;
  strokeStyle?: SemanticStrokeStyle;
  elbowed?: boolean;
  style?: BaseStyleOptions & {
    elbowed?: boolean;
  };
}

export interface ConnectorRenderResult {
  elements: ExcalidrawElement[];
  primary: ExcalidrawElement;
  labelText?: ExcalidrawTextElement;
  updatedEndpoints: Map<string, ExcalidrawElement>;
}

/**
 * Computes the intersection of a ray starting at the center of a bounding box
 * pointing towards targetCenter, with the perimeter of the shape (rectangle or ellipse).
 */
export function computePerimeterPoint(
  bounds: BoundingBox,
  targetOrShapeOrAngle:
    | { x: number; y: number }
    | number
    | "rectangle"
    | "ellipse"
    | boolean,
  shapeOrAngle?: "rectangle" | "ellipse" | boolean | number,
): { x: number; y: number } {
  let targetCenter: { x: number; y: number } | undefined;
  let angle: number | undefined;
  let shape: "rectangle" | "ellipse" = "rectangle";

  if (
    typeof targetOrShapeOrAngle === "string" ||
    typeof targetOrShapeOrAngle === "boolean"
  ) {
    shape =
      targetOrShapeOrAngle === "ellipse" || targetOrShapeOrAngle === true
        ? "ellipse"
        : "rectangle";
    if (typeof shapeOrAngle === "number") {
      angle = shapeOrAngle;
    }
  } else if (typeof targetOrShapeOrAngle === "number") {
    angle = targetOrShapeOrAngle;
    if (typeof shapeOrAngle === "string" || typeof shapeOrAngle === "boolean") {
      shape =
        shapeOrAngle === "ellipse" || shapeOrAngle === true
          ? "ellipse"
          : "rectangle";
    }
  } else {
    targetCenter = targetOrShapeOrAngle;
    if (typeof shapeOrAngle === "string" || typeof shapeOrAngle === "boolean") {
      shape =
        shapeOrAngle === "ellipse" || shapeOrAngle === true
          ? "ellipse"
          : "rectangle";
    }
  }

  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  let dx: number;
  let dy: number;

  if (angle !== undefined) {
    dx = Math.cos(angle);
    dy = Math.sin(angle);
  } else if (targetCenter) {
    dx = targetCenter.x - cx;
    dy = targetCenter.y - cy;
  } else {
    return { x: cx, y: cy };
  }

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy };
  }

  const rx = Math.max(bounds.width / 2, 1);
  const ry = Math.max(bounds.height / 2, 1);

  if (shape === "ellipse") {
    const theta = Math.atan2(dy, dx);
    return {
      x: cx + rx * Math.cos(theta),
      y: cy + ry * Math.sin(theta),
    };
  }

  const tx = Math.abs(dx) > 0.0001 ? rx / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 0.0001 ? ry / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);

  return {
    x: cx + t * dx,
    y: cy + t * dy,
  };
}

export function computeConnectionPoints(
  fromBounds: BoundingBox,
  toBounds: BoundingBox,
  options?: {
    fromShape?: "rectangle" | "ellipse";
    toShape?: "rectangle" | "ellipse";
  },
): ConnectionPoints {
  const cx1 = fromBounds.x + fromBounds.width / 2;
  const cy1 = fromBounds.y + fromBounds.height / 2;
  const cx2 = toBounds.x + toBounds.width / 2;
  const cy2 = toBounds.y + toBounds.height / 2;

  const fromIsEllipse = options?.fromShape === "ellipse";
  const toIsEllipse = options?.toShape === "ellipse";

  const start = computePerimeterPoint(
    fromBounds,
    { x: cx2, y: cy2 },
    fromIsEllipse,
  );
  const end = computePerimeterPoint(toBounds, { x: cx1, y: cy1 }, toIsEllipse);

  return {
    startX: Math.round(start.x),
    startY: Math.round(start.y),
    endX: Math.round(end.x),
    endY: Math.round(end.y),
  };
}

export function computeBindingFixedPoints(
  fromBounds: BoundingBox,
  toBounds: BoundingBox,
  connectionPoints?: ConnectionPoints,
): {
  from: FixedPoint;
  to: FixedPoint;
  startFixedPoint: FixedPoint;
  endFixedPoint: FixedPoint;
} {
  const pts = connectionPoints ?? computeConnectionPoints(fromBounds, toBounds);
  const clamp = (val: number) => Math.max(0, Math.min(1, val));
  const fromW = Math.max(fromBounds.width, 1);
  const fromH = Math.max(fromBounds.height, 1);
  const toW = Math.max(toBounds.width, 1);
  const toH = Math.max(toBounds.height, 1);

  const fromRatioX = clamp((pts.startX - fromBounds.x) / fromW);
  const fromRatioY = clamp((pts.startY - fromBounds.y) / fromH);
  const toRatioX = clamp((pts.endX - toBounds.x) / toW);
  const toRatioY = clamp((pts.endY - toBounds.y) / toH);

  const fromPt: FixedPoint = [
    Number(fromRatioX.toFixed(3)),
    Number(fromRatioY.toFixed(3)),
  ];
  const toPt: FixedPoint = [
    Number(toRatioX.toFixed(3)),
    Number(toRatioY.toFixed(3)),
  ];

  return {
    from: fromPt,
    to: toPt,
    startFixedPoint: fromPt,
    endFixedPoint: toPt,
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

function mapStrokeStyle(style?: SemanticStrokeStyle): StrokeStyle {
  if (style === "dashed" || style === "dotted") {
    return style;
  }
  return "solid";
}

function addBoundReference(
  element: ExcalidrawElement,
  arrowId: string,
): ExcalidrawElement {
  const existing = element.boundElements ?? [];
  if (existing.some((b) => b.id === arrowId)) {
    return element;
  }
  return newElementWith(element, {
    boundElements: [...existing, { type: "arrow", id: arrowId }],
  });
}

function directionForRole(
  role: ConnectorRole | undefined,
  direction?: ArrowDirection,
): ArrowDirection | undefined {
  if (role === "undirected") {
    return "none";
  }
  if (role === "hierarchy" || role === "directed" || role === "flow") {
    return direction ?? "forward";
  }
  if (role === "pointer" || role === "reference") {
    return direction ?? "forward";
  }
  return direction;
}

/**
 * Tests whether a line segment from p1 to p2 intersects an axis-aligned box
 * with optional safety clearance padding (Liang-Barsky algorithm).
 */
export function lineIntersectsBox(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  box: BoundingBox,
  padding: number = 8,
): boolean {
  const minX = box.x - padding;
  const maxX = box.x + box.width + padding;
  const minY = box.y - padding;
  const maxY = box.y + box.height + padding;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];

  let u1 = 0;
  let u2 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) {
        return false;
      }
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0 && u1 < t) {
        u1 = t;
      } else if (p[i] > 0 && u2 > t) {
        u2 = t;
      }
    }
  }

  return u1 <= u2 && u1 < 0.99 && u2 > 0.01;
}

/**
 * Finds all obstacles that intersect the direct ray between fromBounds and toBounds.
 */
export function detectObstaclesBetween(
  fromBounds: BoundingBox,
  toBounds: BoundingBox,
  obstacles: ConnectorEndpoint[],
): ConnectorEndpoint[] {
  const cx1 = fromBounds.x + fromBounds.width / 2;
  const cy1 = fromBounds.y + fromBounds.height / 2;
  const cx2 = toBounds.x + toBounds.width / 2;
  const cy2 = toBounds.y + toBounds.height / 2;

  return obstacles.filter((obs) => {
    // Skip source and target endpoints themselves
    if (
      Math.abs(obs.bounds.x - fromBounds.x) < 2 &&
      Math.abs(obs.bounds.y - fromBounds.y) < 2
    ) {
      return false;
    }
    if (
      Math.abs(obs.bounds.x - toBounds.x) < 2 &&
      Math.abs(obs.bounds.y - toBounds.y) < 2
    ) {
      return false;
    }
    return lineIntersectsBox(
      { x: cx1, y: cy1 },
      { x: cx2, y: cy2 },
      obs.bounds,
    );
  });
}

/**
 * Creates a bound Excalidraw arrow between two rendered semantic endpoints.
 * Automatically detects intermediate obstacles and routes along the outer flank
 * with elbowed paths to prevent cutting through unrelated elements.
 */
export function renderSemanticConnector(
  spec: SemanticConnectorSpec,
  fromRecord: ConnectorEndpoint,
  toRecord: ConnectorEndpoint,
  obstacles?: ConnectorEndpoint[],
): ConnectorRenderResult {
  const fromShape =
    fromRecord.primaryElement.type === "ellipse" ? "ellipse" : "rectangle";
  const toShape =
    toRecord.primaryElement.type === "ellipse" ? "ellipse" : "rectangle";

  const directPoints = computeConnectionPoints(
    fromRecord.bounds,
    toRecord.bounds,
    { fromShape, toShape },
  );

  // Check for intermediate obstacles
  const blockingObstacles =
    obstacles && obstacles.length > 0
      ? detectObstaclesBetween(fromRecord.bounds, toRecord.bounds, obstacles)
      : [];

  let startX = directPoints.startX;
  let startY = directPoints.startY;
  let endX = directPoints.endX;
  let endY = directPoints.endY;

  let points: readonly LocalPoint[];
  let isElbowed = Boolean(spec.elbowed ?? spec.style?.elbowed);

  if (blockingObstacles.length > 0) {
    // Route around obstacles via outer flank
    isElbowed = true;

    // Check if flow is predominantly vertical
    const isVerticalFlow =
      Math.abs(toRecord.bounds.y - fromRecord.bounds.y) >=
      Math.abs(toRecord.bounds.x - fromRecord.bounds.x);

    if (isVerticalFlow) {
      // Route along the right flank with clearance
      let maxRight = Math.max(
        fromRecord.bounds.x + fromRecord.bounds.width,
        toRecord.bounds.x + toRecord.bounds.width,
      );
      for (const obs of blockingObstacles) {
        if (obs.bounds.x + obs.bounds.width > maxRight) {
          maxRight = obs.bounds.x + obs.bounds.width;
        }
      }
      const flankX = maxRight + 36;

      startX = fromRecord.bounds.x + fromRecord.bounds.width;
      startY = fromRecord.bounds.y + fromRecord.bounds.height / 2;
      endX = toRecord.bounds.x + toRecord.bounds.width;
      endY = toRecord.bounds.y + toRecord.bounds.height / 2;

      const p0 = pointFrom<LocalPoint>(0, 0);
      const p1 = pointFrom<LocalPoint>(flankX - startX, 0);
      const p2 = pointFrom<LocalPoint>(flankX - startX, endY - startY);
      const p3 = pointFrom<LocalPoint>(endX - startX, endY - startY);
      points = [p0, p1, p2, p3];
    } else {
      // Route along the bottom flank with clearance
      let maxBottom = Math.max(
        fromRecord.bounds.y + fromRecord.bounds.height,
        toRecord.bounds.y + toRecord.bounds.height,
      );
      for (const obs of blockingObstacles) {
        if (obs.bounds.y + obs.bounds.height > maxBottom) {
          maxBottom = obs.bounds.y + obs.bounds.height;
        }
      }
      const flankY = maxBottom + 36;

      startX = fromRecord.bounds.x + fromRecord.bounds.width / 2;
      startY = fromRecord.bounds.y + fromRecord.bounds.height;
      endX = toRecord.bounds.x + toRecord.bounds.width / 2;
      endY = toRecord.bounds.y + toRecord.bounds.height;

      const p0 = pointFrom<LocalPoint>(0, 0);
      const p1 = pointFrom<LocalPoint>(0, flankY - startY);
      const p2 = pointFrom<LocalPoint>(endX - startX, flankY - startY);
      const p3 = pointFrom<LocalPoint>(endX - startX, endY - startY);
      points = [p0, p1, p2, p3];
    }
  } else {
    // Direct path
    const dx = endX - startX;
    const dy = endY - startY;
    points = [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(dx, dy)];
  }

  const resolvedDirection = directionForRole(spec.role, spec.direction);
  const isUndirected =
    spec.role === "undirected" || resolvedDirection === "none";
  const { startArrowhead, endArrowhead } = isUndirected
    ? {
        startArrowhead: null as Arrowhead | null,
        endArrowhead: null as Arrowhead | null,
      }
    : resolveArrowheads(resolvedDirection);

  const edgeStyle = mapSemanticStateToEdgeTokens(spec.highlight);
  const strokeStyle = mapStrokeStyle(
    spec.strokeStyle ?? spec.style?.strokeStyle,
  );

  const dxTotal = endX - startX;
  const dyTotal = endY - startY;

  let arrow = newArrowElement({
    type: "arrow",
    x: startX,
    y: startY,
    width: Math.max(Math.abs(dxTotal), 1),
    height: Math.max(Math.abs(dyTotal), 1),
    points,
    startArrowhead,
    endArrowhead,
    elbowed: isElbowed,
    strokeColor: edgeStyle.stroke,
    strokeStyle,
    strokeWidth: edgeStyle.strokeWidth,
    roughness: 0,
    customData: {
      dslId: spec.id,
      from: spec.from,
      to: spec.to,
      role: spec.role ?? "relationship",
      semanticType: "connector",
      ownedBy: "cognora",
    },
  });

  const connectionPoints: ConnectionPoints = { startX, startY, endX, endY };
  const { from: fromFp, to: toFp } = computeBindingFixedPoints(
    fromRecord.bounds,
    toRecord.bounds,
    connectionPoints,
  );

  arrow = newElementWith(arrow, {
    startBinding: {
      elementId: fromRecord.primaryElement.id,
      fixedPoint: fromFp,
      mode: "orbit",
    },
    endBinding: {
      elementId: toRecord.primaryElement.id,
      fixedPoint: toFp,
      mode: "orbit",
    },
  });

  const updatedFrom = addBoundReference(fromRecord.primaryElement, arrow.id);
  const updatedTo = addBoundReference(toRecord.primaryElement, arrow.id);

  const updatedEndpoints = new Map<string, ExcalidrawElement>();
  updatedEndpoints.set(spec.from, updatedFrom);
  updatedEndpoints.set(spec.to, updatedTo);

  const elements: ExcalidrawElement[] = [arrow];
  let labelText: ExcalidrawTextElement | undefined;

  if (spec.label) {
    const midX = Math.round((startX + endX) / 2);
    const midY = Math.round((startY + endY) / 2);
    
    const weightPrimitive = createEdgeWeight({
      id: `${spec.id}-label`,
      x: midX,
      y: midY,
      value: spec.label,
      highlight: spec.highlight,
      arrowId: arrow.id,
    });
    
    labelText = weightPrimitive.textElement;
    
    // Bind the text to the arrow so it stays with the edge
    arrow = newElementWith(arrow, {
      boundElements: [...(arrow.boundElements ?? []), { type: "text", id: labelText.id }]
    });
    
    // Replace the arrow in the elements array
    elements[0] = arrow;
    elements.push(labelText);
  }

  return {
    elements,
    primary: arrow,
    labelText,
    updatedEndpoints,
  };
}

/**
 * Deterministic Z-Ordering:
 * 1. Background surfaces / containers
 * 2. Connectors / arrows
 * 3. Primary structural nodes / cards
 * 4. Secondary elements / badges / cell dividers
 * 5. Text labels and values
 * 6. Annotations, callouts, pointers
 * 7. Glow / highlights
 */
export function layerElementsWithConnectors(
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const containers: ExcalidrawElement[] = [];
  const connectors: ExcalidrawElement[] = [];
  const nodes: ExcalidrawElement[] = [];
  const secondary: ExcalidrawElement[] = [];
  const labels: ExcalidrawElement[] = [];
  const annotations: ExcalidrawElement[] = [];
  const highlights: ExcalidrawElement[] = [];

  for (const el of elements) {
    const role = el.customData?.role as string | undefined;
    const dslId = (el.customData?.dslId as string) ?? "";

    if (
      role === "container" ||
      role === "explanation-card" ||
      (el.type === "rectangle" && el.strokeWidth === 0 && el.opacity === 0)
    ) {
      containers.push(el);
    } else if (el.type === "arrow" || el.type === "line") {
      connectors.push(el);
    } else if (dslId.startsWith("highlight-") || role === "highlight") {
      highlights.push(el);
    } else if (
      (role === "pointer" || role === "callout" || role === "annotation") &&
      el.type !== "rectangle" &&
      el.type !== "ellipse"
    ) {
      annotations.push(el);
    } else if (el.type === "text") {
      labels.push(el);
    } else if (role === "badge" || role === "cell-divider") {
      secondary.push(el);
    } else {
      nodes.push(el);
    }
  }

  return [
    ...containers,
    ...connectors,
    ...nodes,
    ...secondary,
    ...labels,
    ...annotations,
    ...highlights,
  ];
}
