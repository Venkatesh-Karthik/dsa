import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { computeGraphLayout } from "../layout-engine";
import { LAYOUT } from "../visual-renderer";
import { createGraphNode } from "../visual-primitives/graph-node";
import { commitSemanticConnector } from "../visual-renderer";
import { TYPOGRAPHY } from "../visual-primitives/typography";

import type {
  CreateGraphAction,
  ArrayElementHighlight,
  SemanticColor,
} from "../visual-dsl";
import type { RenderContext } from "../visual-renderer";

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
    case "success":
    case "warning":
    case "danger":
    case "info":
    case "neutral":
    case "accent":
      return h;
    default:
      return undefined;
  }
}

export function renderGraphGrammar(
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
      fontSize: TYPOGRAPHY.Title.fontSize,
      fontFamily: TYPOGRAPHY.Title.fontFamily,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  const layoutNodes = action.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    x: n.x,
    y: n.y,
  }));
  const layoutEdges = action.edges.map((e) => ({
    from: e.from,
    to: e.to,
    weight: e.weight,
    label: e.label,
    directed: e.directed,
  }));

  const layout = computeGraphLayout(layoutNodes, layoutEdges, {
    x: originX,
    y: originY,
  });
  const nodeMap = new Map(action.nodes.map((n) => [n.id, n]));

  // First pass: render nodes
  for (const [lnId, pos] of layout.positions) {
    const nodeDef = nodeMap.get(lnId);
    if (!nodeDef) {
      continue;
    }

    const color = highlightToColor(nodeDef.highlight);

    // Some graphs store value in custom data or we use an explicit property if added to visual-dsl
    // But currently Visual DSL GraphNodeDef doesn't have a value property, only label.
    // Wait, the user said "A \n 0". In Dijkstra, the AI might put "0" in some property,
    // or maybe it uses the `value` property if we add it, or it uses the `label` as "A" and we need to pass value.
    // Let's assume `value` is an optional property the AI might provide now since we're refactoring.
    // The user explicitly provided example: `label: "A", value: 0`.
    // Let's read `any` to allow AI to supply it before updating visual-dsl formally.

    const aiNode = nodeDef as any;

    const primitive = createGraphNode({
      id: `${action.id}-${lnId}`,
      x: pos.x,
      y: pos.y,
      label: nodeDef.label,
      value: aiNode.value, // Extract value if AI provides it
      highlight: nodeDef.highlight,
      diameter: 70, // consistent geometry
    });

    elements.push(...primitive.allElements);
    context.register(
      `${action.id}-${lnId}`,
      primitive.primaryElement,
      primitive.allElements.find((e) => e.type === "text") as any,
      primitive.allElements,
    );
  }

  // Second pass: render edges
  for (const edge of action.edges) {
    const isDirected = edge.directed ?? action.directed ?? true;
    const color = highlightToColor(edge.highlight);
    const edgeLabel =
      edge.label ||
      (edge.weight !== undefined ? String(edge.weight) : undefined);

    const edgeEls = commitSemanticConnector(context, {
      id: `${action.id}-edge-${edge.from}-${edge.to}`,
      from: `${action.id}-${edge.from}`,
      to: `${action.id}-${edge.to}`,
      direction: isDirected ? "forward" : "none",
      role: "relationship",
      label: edgeLabel,
      style: { color: color || "default" },
    });
    elements.push(...edgeEls);
  }

  // Invisible container
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
  context.register(action.id, graphContainer, undefined, [graphContainer]);

  context.cursor.x = bounds.x + bounds.width + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}
