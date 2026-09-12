import { newElement, newTextElement } from "@excalidraw/element";
import type { ExcalidrawElement, ExcalidrawTextElement } from "@excalidraw/element/types";
import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";

export interface GraphNodeProps {
  id: string;
  x: number;
  y: number;
  label: string;
  value?: string | number;
  highlight?: string;
  diameter?: number;
}

export interface GraphNodePrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createGraphNode(props: GraphNodeProps): GraphNodePrimitive {
  const { id, x, y, label, value, highlight, diameter = TOKENS.GEOMETRY.nodeDiameter } = props;

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
      role: "graph-node",
      semanticType: "graph_node",
      label,
    },
  });

  const elements: ExcalidrawElement[] = [circle];

  // Primary Label (e.g. "A")
  const primaryTextY = value !== undefined ? y + diameter / 2 - 10 : y + diameter / 2;
  
  const primaryLabel = newTextElement({
    text: label,
    x: x + diameter / 2,
    y: primaryTextY,
    fontSize: TOKENS.TYPOGRAPHY.NodePrimary.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.NodePrimary.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.textPrimary,
    groupIds: [groupId],
    customData: { dslId: `${id}-label` },
  });
  elements.push(primaryLabel);

  // Secondary Value (e.g. "0" or "∞")
  if (value !== undefined) {
    const valueText = newTextElement({
      text: String(value),
      x: x + diameter / 2,
      y: y + diameter / 2 + 12,
      fontSize: TOKENS.TYPOGRAPHY.NodeSecondary.fontSize,
      fontFamily: TOKENS.TYPOGRAPHY.NodeSecondary.fontFamily,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: style.textSecondary,
      groupIds: [groupId],
      customData: { dslId: `${id}-val` },
    });
    elements.push(valueText);
  }

  return {
    primaryElement: circle,
    allElements: elements,
  };
}
