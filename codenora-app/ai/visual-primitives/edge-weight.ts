import { newElement, newTextElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { TOKENS, PALETTE } from "./design-tokens";

export interface EdgeWeightProps {
  id: string;
  x: number;
  y: number;
  value: string | number;
  highlight?: string;
  arrowId: string;
}

export interface EdgeWeightPrimitive {
  textElement: ExcalidrawTextElement;
  allElements: ExcalidrawElement[];
}

export function createEdgeWeight(props: EdgeWeightProps): EdgeWeightPrimitive {
  const { id, x, y, value, highlight, arrowId } = props;

  const style =
    highlight === "path" ? TOKENS.WEIGHT.IN_PATH : TOKENS.WEIGHT.DEFAULT;
  const groupId = `${id}-weight-group`;

  // Excalidraw natively centers text bounded to an arrow.
  // We don't need a separate background box if we use a text element with a background color?
  // Wait, Excalidraw text elements don't have a background color natively, but you can render a rectangle behind it.
  // However, grouping them won't auto-flow along the arrow curve. Binding text to the arrow WILL auto-flow.
  // For the purest Excalidraw experience, we just use text bound to the arrow.
  // Wait! We can give the text element a background color if Excalidraw doesn't support it, but actually Excalidraw added text backgrounds recently? No, usually it doesn't.
  // Let's use a standard bound text element which Excalidraw natively supports keeping attached to lines/arrows.

  const textLabel = newTextElement({
    text: String(value),
    x,
    y,
    fontSize: TOKENS.TYPOGRAPHY.EdgeWeight.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.EdgeWeight.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.text,
    containerId: arrowId, // This makes it a bound text!
    groupIds: [groupId],
    customData: { dslId: id, role: "edge-weight", semanticType: "edge_weight" },
  });

  return {
    textElement: textLabel,
    allElements: [textLabel],
  };
}
