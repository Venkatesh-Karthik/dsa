import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { LAYOUT, mapStrokeColor, mapBackgroundColor } from "../visual-renderer";
import { createArrayCell } from "../visual-primitives/array-cell";
import { TYPOGRAPHY } from "../visual-primitives/typography";

import type {
  CreateArrayAction,
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

export function renderArrayGrammar(
  action: CreateArrayAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const {
    ARRAY_ELEMENT_WIDTH: W,
    ARRAY_ELEMENT_HEIGHT: H,
    ARRAY_ELEMENT_GAP: GAP,
    ARRAY_LABEL_OFFSET: LBL_OFF,
  } = LAYOUT;

  const elements: ExcalidrawElement[] = [];
  const n = action.elements.length;
  if (n === 0) {
    context.addError(`create_array '${action.id}' has no elements`);
    return [];
  }

  const titleHeight = action.label ? LBL_OFF : 0;
  const originX = action.x !== undefined ? action.x : context.cursor.x;
  const originY =
    action.y !== undefined ? action.y : context.cursor.y + titleHeight;

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

  for (let i = 0; i < n; i++) {
    const el = action.elements[i];
    const cellX = originX + i * (W + GAP);
    const cellY = originY;

    const mappedColor = highlightToColor(el.highlight as ArrayElementHighlight);
    const strokeColor = mappedColor
      ? mapStrokeColor(mappedColor)
      : mapStrokeColor(undefined);
    const backgroundColor = mappedColor
      ? mapBackgroundColor(mappedColor)
      : undefined;

    const primitive = createArrayCell({
      id: `${action.id}-${i}`,
      x: cellX,
      y: cellY,
      width: W,
      height: H,
      value: el.value,
      index: i,
      highlight: el.highlight,
      strokeColor,
      backgroundColor,
    });

    elements.push(...primitive.allElements);
    context.register(
      `${action.id}-${i}`,
      primitive.primaryElement,
      primitive.allElements.find((e) => e.type === "text") as any,
      primitive.allElements,
    );
  }

  const totalWidth = n * W + (n - 1) * GAP;

  const arrayContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: totalWidth,
    height: H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: {
      dslId: action.id,
      role: "container",
      arrayId: action.id,
    },
  });
  elements.push(arrayContainer);

  const metadata: ExcalidrawElement[] = [arrayContainer];
  if (action.label && elements.length > 0) {
    const title = elements.find(
      (e) => (e.customData as any)?.dslId === `${action.id}-title`,
    );
    if (title) {
      metadata.push(title);
    }
  }

  context.register(action.id, arrayContainer, undefined, metadata);

  context.cursor.x = originX + totalWidth + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}
