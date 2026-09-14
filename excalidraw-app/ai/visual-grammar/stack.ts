import type { ExcalidrawElement } from "@excalidraw/element/types";
import { newElement, newTextElement } from "@excalidraw/element";
import type { CreateStackAction, ArrayElementHighlight, SemanticColor, AnnotatePointerAction } from "../visual-dsl";
import type { RenderContext } from "../visual-renderer";
import { LAYOUT } from "../visual-renderer";
import { createCallFrame } from "../visual-primitives/call-frame";
import { TYPOGRAPHY } from "../visual-primitives/typography";

// Forward declare to avoid circular dependency right now, or import from visual-renderer
import { renderAnnotatePointer } from "../visual-renderer"; 

function highlightToColor(h?: ArrayElementHighlight): SemanticColor | undefined {
  switch (h) {
    case "low":
    case "high": return "accent";
    case "mid": return "warning";
    case "target":
    case "found": return "success";
    case "eliminated": return "neutral";
    default: return undefined;
  }
}

export function renderStackGrammar(
  action: CreateStackAction,
  context: RenderContext
): ExcalidrawElement[] {
  const {
    STACK_ELEMENT_WIDTH: W,
    STACK_ELEMENT_HEIGHT: H,
    STACK_GAP: GAP,
    ARRAY_LABEL_OFFSET: LBL_OFF,
  } = LAYOUT;
  const elements: ExcalidrawElement[] = [];
  const n = action.elements.length;

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
    const cellX = originX;
    const cellY = originY + i * (H + GAP);

    const primitive = createCallFrame({
      id: `${action.id}-${i}`,
      x: cellX,
      y: cellY,
      width: W,
      height: H,
      label: String(el.value),
      highlight: el.highlight,
    });

    elements.push(...primitive.allElements);
    context.register(
      `${action.id}-${i}`,
      primitive.primaryElement,
      primitive.allElements.find(e => e.type === "text") as any,
      primitive.allElements
    );
  }

  const totalHeight = n * H + Math.max(0, n - 1) * GAP;
  const stackContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: W,
    height: totalHeight || H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(stackContainer);
  context.register(action.id, stackContainer, undefined, [stackContainer]);

  if (n > 0) {
    const pointerAction: AnnotatePointerAction = {
      type: "annotate_pointer",
      id: `${action.id}-top-ptr`,
      label: "TOP",
      target: `${action.id}-0`,
      placement: "right",
    };
    elements.push(...renderAnnotatePointer(pointerAction, context));
  }

  context.cursor.x = originX + W + 100 + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}
