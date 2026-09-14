import { newElement, newTextElement, newElementWith } from "@excalidraw/element";
import type { ExcalidrawElement, FillStyle } from "@excalidraw/element/types";
import { ROUNDNESS } from "@excalidraw/common";
import { TOKENS } from "./design-tokens";
import { computeAdaptiveAnnotationBounds, wrapText } from "../layout-engine";

export interface AnnotationPrimitiveProps {
  id: string;
  x: number;
  y: number;
  text: string;
  title?: string;
  highlight?: string;
  role?: string;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  fillStyle?: FillStyle;
}

export interface AnnotationPrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

/**
 * Creates a content-aware annotation or callout primitive whose dimensions
 * adapt to the measured text length, guaranteeing text never escapes the container.
 */
export function createAnnotationPrimitive(
  props: AnnotationPrimitiveProps,
): AnnotationPrimitive {
  const {
    id,
    x,
    y,
    text,
    title,
    highlight,
    role = "annotation",
    strokeColor = "#94a3b8",
    backgroundColor = "#f8fafc",
    strokeWidth = 1,
    fillStyle = "solid",
  } = props;

  const fontSize = 13;
  const bounds = computeAdaptiveAnnotationBounds(text, title, fontSize);
  const width = bounds.width;
  const height = bounds.height;
  const groupId = `${id}-group`;

  // Wrap text cleanly
  const wrappedLines = wrapText(text, 36);
  const displayText = title
    ? `${title}\n${wrappedLines.join("\n")}`
    : wrappedLines.join("\n");

  const container = newElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: highlight ? "#3b82f6" : strokeColor,
    backgroundColor: highlight ? "#eff6ff" : backgroundColor,
    fillStyle,
    strokeWidth: highlight ? 1.5 : strokeWidth,
    roughness: 0,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    groupIds: [groupId],
    customData: {
      dslId: id,
      role,
      semanticType: "annotation",
    },
  });

  const textLabel = newTextElement({
    text: displayText,
    x: x + 12,
    y: y + 10,
    fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.Annotation.fontFamily,
    textAlign: "left",
    verticalAlign: "top",
    strokeColor: "#1e293b",
    containerId: container.id,
    groupIds: [groupId],
    customData: { dslId: `${id}-text` },
  });

  const finalContainer = newElementWith(container, {
    boundElements: [{ type: "text", id: textLabel.id }],
  });

  return {
    primaryElement: finalContainer,
    allElements: [finalContainer, textLabel],
  };
}
