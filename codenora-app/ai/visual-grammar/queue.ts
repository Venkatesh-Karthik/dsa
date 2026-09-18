import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { LAYOUT } from "../visual-renderer";
import { createArrayCell } from "../visual-primitives/array-cell";
import { TYPOGRAPHY } from "../visual-primitives/typography";

// Forward declare to avoid circular dependency right now, or import from visual-renderer
import { renderAnnotatePointer } from "../visual-renderer";

import type {
  CreateQueueAction,
  ArrayElementHighlight,
  SemanticColor,
  AnnotatePointerAction,
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

export function renderQueueGrammar(
  action: CreateQueueAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];
  const n = action.elements ? action.elements.length : 0;
  const {
    ARRAY_ELEMENT_WIDTH: W,
    ARRAY_ELEMENT_HEIGHT: H,
    ARRAY_ELEMENT_GAP: GAP,
    ARRAY_LABEL_OFFSET: LBL_OFF,
  } = LAYOUT;

  const titleHeight = action.label ? LBL_OFF : 0;
  const originX = context.cursor.x;
  const originY = context.cursor.y + titleHeight;

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

    const primitive = createArrayCell({
      id: `${action.id}-${i}`,
      x: cellX,
      y: cellY,
      width: W,
      height: H,
      value: el.value,
      highlight: el.highlight,
    });

    elements.push(...primitive.allElements);
    context.register(
      `${action.id}-${i}`,
      primitive.primaryElement,
      primitive.allElements.find((e) => e.type === "text") as any,
      primitive.allElements,
    );
  }

  const totalWidth = n * W + Math.max(0, n - 1) * GAP;
  const queueContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: totalWidth || W,
    height: H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container", semanticType: "queue" },
  });
  elements.push(queueContainer);
  context.register(action.id, queueContainer, undefined, [queueContainer]);

  if (n > 0) {
    const frontPtr: AnnotatePointerAction = {
      type: "annotate_pointer",
      id: `${action.id}-front-ptr`,
      label: "FRONT",
      target: `${action.id}-0`,
      placement: "above",
      color: "primary",
    };
    elements.push(...renderAnnotatePointer(frontPtr, context));

    const rearPtr: AnnotatePointerAction = {
      type: "annotate_pointer",
      id: `${action.id}-rear-ptr`,
      label: "REAR",
      target: `${action.id}-${n - 1}`,
      placement: "below",
      color: "accent",
      offset: 16,
    };
    elements.push(...renderAnnotatePointer(rearPtr, context));
  }

  context.cursor.x = originX + totalWidth + 100 + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}
