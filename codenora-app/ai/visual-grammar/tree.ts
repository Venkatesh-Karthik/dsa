import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { computeTreeLayout, TREE_LAYOUT } from "../layout-engine";
import { LAYOUT } from "../visual-renderer";
import { createTreeNode } from "../visual-primitives/tree-node";
import { commitSemanticConnector } from "../visual-renderer";
import { TYPOGRAPHY } from "../visual-primitives/typography";

import type {
  CreateTreeAction,
  ArrayElementHighlight,
  SemanticColor,
} from "../visual-dsl";
import type { RenderContext } from "../visual-renderer";

function highlightToColor(
  h?: ArrayElementHighlight,
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
    default:
      return undefined;
  }
}

export function renderTreeGrammar(
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
      fontSize: TYPOGRAPHY.Title.fontSize,
      fontFamily: TYPOGRAPHY.Title.fontFamily,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  const nodeMap = new Map(action.nodes.map((n) => [n.id, n]));
  const layoutNodes = action.nodes.map((n) => ({
    id: n.id,
    value: n.value,
    left: n.left,
    right: n.right,
    children: n.children || ([n.left, n.right].filter(Boolean) as string[]),
  }));

  const layout = computeTreeLayout(layoutNodes, action.root, {
    x: originX,
    y: originY,
  });

  for (const [lnId, pos] of layout.positions) {
    const nodeDef = nodeMap.get(lnId);
    if (!nodeDef) {
      continue;
    }

    const primitive = createTreeNode({
      id: `${action.id}-${lnId}`,
      x: pos.x,
      y: pos.y,
      value: nodeDef.value,
      highlight: nodeDef.highlight,
      diameter: TREE_LAYOUT.NODE_DIAMETER,
    });

    elements.push(...primitive.allElements);
    context.register(
      `${action.id}-${lnId}`,
      primitive.primaryElement,
      primitive.allElements.find((e) => e.type === "text") as any,
      primitive.allElements,
    );
  }

  for (const [lnId] of layout.positions) {
    const nodeDef = nodeMap.get(lnId);
    if (!nodeDef) {
      continue;
    }

    const children =
      nodeDef.children ||
      ([nodeDef.left, nodeDef.right].filter(Boolean) as string[]);
    for (const childId of children) {
      const edgeEls = commitSemanticConnector(context, {
        id: `${action.id}-edge-${lnId}-${childId}`,
        from: `${action.id}-${lnId}`,
        to: `${action.id}-${childId}`,
        direction: "forward",
        role: "hierarchy",
        style: { color: "default" },
      });
      elements.push(...edgeEls);
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
