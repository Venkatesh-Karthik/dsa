import { newElement, newTextElement } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { TOKENS, mapSemanticStateToNodeTokens, PALETTE } from "./design-tokens";

export interface ArrayCellProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | number;
  index?: number;
  highlight?: string;
  strokeColor?: string;
  backgroundColor?: string;
}

export interface ArrayCellPrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createArrayCell(props: ArrayCellProps): ArrayCellPrimitive {
  const {
    id,
    x,
    y,
    width,
    height,
    value,
    index,
    highlight,
    strokeColor,
    backgroundColor,
  } = props;

  const style = mapSemanticStateToNodeTokens(highlight);
  const groupId = `${id}-group`;

  const rect = newElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: strokeColor ?? style.stroke,
    backgroundColor: backgroundColor ?? style.fill,
    fillStyle: "solid",
    strokeWidth: style.strokeWidth,
    roughness: 0,
    roundness: null, // Sharp corners for array cells
    groupIds: [groupId],
    customData: {
      dslId: id,
      role: "array-element",
      semanticType: "array_element",
      index,
      value,
    },
  });

  const elements: ExcalidrawElement[] = [rect];

  const valueLabel = newTextElement({
    text: String(value),
    x: x + width / 2,
    y: y + height / 2,
    fontSize: TOKENS.TYPOGRAPHY.NodePrimary.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.NodePrimary.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.textPrimary,
    groupIds: [groupId],
    customData: { dslId: `${id}-val` },
  });
  elements.push(valueLabel);

  if (index !== undefined) {
    const indexLabel = newTextElement({
      text: String(index),
      x: x + width / 2,
      y: y + height + 6, // OFFSET
      fontSize: TOKENS.TYPOGRAPHY.IndexLabel.fontSize,
      fontFamily: TOKENS.TYPOGRAPHY.IndexLabel.fontFamily,
      textAlign: "center",
      verticalAlign: "top",
      strokeColor: PALETTE.slate300, // Neutral gray
      groupIds: [groupId],
      customData: { dslId: `${id}-idx` },
    });
    elements.push(indexLabel);
  }

  return {
    primaryElement: rect,
    allElements: elements,
  };
}
