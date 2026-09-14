import { newElement, newTextElement } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { TOKENS } from "./design-tokens";
import { ROUNDNESS } from "@excalidraw/common";

export interface AnnotationProps {
  id: string;
  x: number;
  y: number;
  text: string;
  type?: "annotation" | "callout" | "step-info";
}

export interface AnnotationPrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createAnnotation(props: AnnotationProps): AnnotationPrimitive {
  const { id, x, y, text, type = "annotation" } = props;

  const style = TOKENS.ANNOTATION;
  const groupId = `${id}-group`;

  // Estimate text width/height since we don't have exact text measurements in pure Node
  // Rough estimate: 8px per character width for Sans 14, ~24px height
  const estimatedWidth = Math.max(100, text.length * 8 + 32); 
  const estimatedHeight = 40;

  const rect = newElement({
    type: "rectangle",
    x,
    y,
    width: estimatedWidth,
    height: estimatedHeight,
    strokeColor: style.stroke,
    backgroundColor: style.fill,
    fillStyle: "solid",
    strokeWidth: style.strokeWidth,
    roughness: 0,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS }, 
    groupIds: [groupId],
    customData: {
      dslId: id,
      role: type,
      semanticType: "annotation",
      text,
    },
  });

  const valueLabel = newTextElement({
    text,
    x: x + estimatedWidth / 2,
    y: y + estimatedHeight / 2,
    fontSize: TOKENS.TYPOGRAPHY.Annotation.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.Annotation.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.text,
    groupIds: [groupId],
    customData: { dslId: `${id}-label` },
  });

  return {
    primaryElement: rect,
    allElements: [rect, valueLabel],
  };
}
