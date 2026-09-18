import { newArrowElement, newTextElement } from "@excalidraw/element";

import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";

export interface PointerProps {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  label: string;
  highlight?: string;
  placement: "above" | "below" | "left" | "right";
}

export interface PointerPrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createPointer(props: PointerProps): PointerPrimitive {
  const { id, x, y, targetX, targetY, label, highlight, placement } = props;

  const style = mapSemanticStateToNodeTokens(highlight);
  const groupId = `${id}-group`;

  // Draw arrow from x,y to targetX,targetY
  const dx = targetX - x;
  const dy = targetY - y;

  const arrow = newArrowElement({
    type: "arrow",
    x,
    y,
    width: Math.max(Math.abs(dx), 1),
    height: Math.max(Math.abs(dy), 1),
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(dx, dy)],
    startArrowhead: null,
    endArrowhead: "arrow",
    strokeColor: style.stroke,
    strokeWidth: 2,
    roughness: 0,
    groupIds: [groupId],
    customData: {
      dslId: id,
      role: "pointer",
      semanticType: "pointer",
      label,
    },
  });

  // Calculate text position
  // If pointing down (placed above), text is at x, y - 15
  let textY = y;
  let textX = x;

  if (placement === "above") {
    textY -= 15;
  } else if (placement === "below") {
    textY += 15;
  } else if (placement === "left") {
    textX -= 30;
  } else if (placement === "right") {
    textX += 30;
  }

  const textLabel = newTextElement({
    text: label,
    x: textX,
    y: textY,
    fontSize: TOKENS.TYPOGRAPHY.Annotation.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.Annotation.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.stroke, // match pointer color
    groupIds: [groupId],
    customData: { dslId: `${id}-label` },
  });

  return {
    primaryElement: arrow,
    allElements: [arrow, textLabel],
  };
}
