import { newElement, newTextElement } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";
import { ROUNDNESS } from "@excalidraw/common";

export interface CallFrameProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  highlight?: string;
}

export interface CallFramePrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createCallFrame(props: CallFrameProps): CallFramePrimitive {
  const { id, x, y, width, height, label, highlight } = props;

  const style = mapSemanticStateToNodeTokens(highlight);
  const groupId = `${id}-group`;

  const rect = newElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: style.stroke,
    backgroundColor: style.fill,
    fillStyle: "solid",
    strokeWidth: style.strokeWidth,
    roughness: 0,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS }, // Rounded corners for call frames
    groupIds: [groupId],
    customData: {
      dslId: id,
      role: "stack-frame",
      semanticType: "call_frame",
      label,
    },
  });

  const valueLabel = newTextElement({
    text: label,
    x: x + width / 2,
    y: y + height / 2,
    fontSize: TOKENS.TYPOGRAPHY.NodePrimary.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.NodePrimary.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.textPrimary,
    groupIds: [groupId],
    customData: { dslId: `${id}-label` },
  });

  return {
    primaryElement: rect,
    allElements: [rect, valueLabel],
  };
}
