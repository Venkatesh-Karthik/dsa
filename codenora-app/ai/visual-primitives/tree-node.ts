import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";

export interface TreeNodeProps {
  id: string;
  x: number;
  y: number;
  value: string | number;
  highlight?: string;
  diameter?: number;
  balanceFactor?: number;
  badge?: string;
}

export interface TreeNodePrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createTreeNode(props: TreeNodeProps): TreeNodePrimitive {
  const {
    id,
    x,
    y,
    value,
    highlight,
    diameter = TOKENS.GEOMETRY.nodeDiameter,
    balanceFactor,
    badge,
  } = props;

  const style = mapSemanticStateToNodeTokens(highlight);
  const groupId = `${id}-group`;

  const circle = newElement({
    type: "ellipse",
    x,
    y,
    width: diameter,
    height: diameter,
    strokeColor: style.stroke,
    backgroundColor: style.fill,
    fillStyle: "solid",
    strokeWidth: style.strokeWidth,
    roughness: 0,
    groupIds: [groupId],
    customData: {
      dslId: id,
      semanticId: id,
      role: "tree-node",
      semanticType: "tree_node",
      value,
    },
  });

  const valueLabel = newTextElement({
    text: String(value),
    x: x + diameter / 2,
    y: y + diameter / 2,
    fontSize: TOKENS.TYPOGRAPHY.NodePrimary.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.NodePrimary.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.textPrimary,
    groupIds: [groupId],
    customData: {
      dslId: `${id}-val`,
      semanticId: id,
      subRole: "value",
    },
  });

  const allElements: ExcalidrawElement[] = [circle, valueLabel];

  // Render native balance factor or state badge directly on node perimeter
  const badgeContent =
    balanceFactor !== undefined
      ? `BF: ${balanceFactor > 0 ? `+${balanceFactor}` : balanceFactor}`
      : badge;

  if (badgeContent) {
    const isImbalanced =
      balanceFactor !== undefined && Math.abs(balanceFactor) > 1;
    const badgeBg = isImbalanced ? "#ef4444" : "#475569";
    const badgeWidth = 44;
    const badgeHeight = 16;
    const badgeX = x + diameter - 14;
    const badgeY = y - 4;

    const badgeRect = newElement({
      type: "rectangle",
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      strokeColor: badgeBg,
      backgroundColor: badgeBg,
      fillStyle: "solid",
      roundness: { type: 3 },
      groupIds: [groupId],
      customData: {
        dslId: `${id}-bf-badge`,
        semanticId: id,
        subRole: "badge",
      },
    });

    const badgeLabel = newTextElement({
      text: badgeContent,
      x: badgeX + badgeWidth / 2,
      y: badgeY + badgeHeight / 2,
      fontSize: 10,
      fontFamily: TOKENS.TYPOGRAPHY.NodePrimary.fontFamily,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: "#ffffff",
      groupIds: [groupId],
      customData: {
        dslId: `${id}-bf-lbl`,
        semanticId: id,
        subRole: "badge-text",
      },
    });

    allElements.push(badgeRect, badgeLabel);
  }

  return {
    primaryElement: circle,
    allElements,
  };
}
