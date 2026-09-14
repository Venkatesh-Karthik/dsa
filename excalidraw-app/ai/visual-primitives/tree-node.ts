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
}

export interface TreeNodePrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createTreeNode(props: TreeNodeProps): TreeNodePrimitive {
  const { id, x, y, value, highlight, diameter = TOKENS.GEOMETRY.nodeDiameter } = props;

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
    customData: { dslId: `${id}-val` },
  });

  return {
    primaryElement: circle,
    allElements: [circle, valueLabel],
  };
}
