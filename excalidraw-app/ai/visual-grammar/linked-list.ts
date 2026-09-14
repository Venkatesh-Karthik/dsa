import type { ExcalidrawElement } from "@excalidraw/element/types";
import { newElement, newTextElement } from "@excalidraw/element";
import type { CreateLinkedListAction, ArrayElementHighlight } from "../visual-dsl";
import type { RenderContext } from "../visual-renderer";
import { LAYOUT } from "../visual-renderer";
import { createLinkedListNode } from "../visual-primitives/linked-list-node";
import { commitSemanticConnector } from "../visual-renderer";
import { TOKENS } from "../visual-primitives/design-tokens";

export function renderLinkedListGrammar(
  action: CreateLinkedListAction,
  context: RenderContext
): ExcalidrawElement[] {
  const {
    ARRAY_ELEMENT_WIDTH: W,
    ARRAY_ELEMENT_HEIGHT: H,
    ARRAY_ELEMENT_GAP: GAP,
    ARRAY_LABEL_OFFSET: LBL_OFF,
  } = LAYOUT;

  const NODE_GAP = GAP + 40; // Space for arrows
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
      fontSize: TOKENS.TYPOGRAPHY.Title.fontSize,
      fontFamily: TOKENS.TYPOGRAPHY.Title.fontFamily,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: TOKENS.NODE.DEFAULT.textPrimary,
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  if (n === 0) return elements;

  let lastNodeX = originX;
  for (let i = 0; i < n; i++) {
    const el = action.elements[i];
    const cellX = originX + i * (W * 1.5 + NODE_GAP); // Nodes are wider
    const cellY = originY;
    lastNodeX = cellX;

    const primitive = createLinkedListNode({
      id: `${action.id}-${i}`,
      x: cellX,
      y: cellY,
      width: W * 1.5,
      height: H,
      value: el.value,
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

  // Null node
  const nullX = lastNodeX + W * 1.5 + NODE_GAP;
  const nullY = originY + H / 2;
  const nullText = newTextElement({
    text: "NULL",
    x: nullX,
    y: nullY - 9,
    fontSize: 14,
    fontFamily: TOKENS.TYPOGRAPHY.NodeSecondary.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: "#868e96",
    customData: { dslId: `${action.id}-null` },
  });
  elements.push(nullText);
  context.register(`${action.id}-null`, nullText, nullText, [nullText]);

  // Connect adjacent nodes
  for (let i = 0; i < n - 1; i++) {
    const connectorEls = commitSemanticConnector(context, {
      id: `${action.id}-edge-${i}`,
      from: `${action.id}-${i}`,
      to: `${action.id}-${i + 1}`,
      direction: action.variant === "doubly" ? "bidirectional" : "forward",
      role: "relationship",
      style: { color: "default" },
    });
    elements.push(...connectorEls);
  }

  // Connect last node to NULL
  const nullConnectorEls = commitSemanticConnector(context, {
    id: `${action.id}-edge-null`,
    from: `${action.id}-${n - 1}`,
    to: `${action.id}-null`,
    direction: "forward",
    role: "relationship",
    style: { color: "neutral" },
  });
  elements.push(...nullConnectorEls);

  const totalWidth = nullX + 40 - originX;
  const listContainer = newElement({
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
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(listContainer);
  context.register(action.id, listContainer, undefined, [listContainer]);

  context.cursor.x = originX + totalWidth + context.options.horizontalGap;
  context.cursor.y = originY;

  return elements;
}
