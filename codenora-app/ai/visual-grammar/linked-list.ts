import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { LAYOUT } from "../visual-renderer";
import { createLinkedListNode } from "../visual-primitives/linked-list-node";
import { commitSemanticConnector } from "../visual-renderer";
import { TOKENS } from "../visual-primitives/design-tokens";

import type {
  CreateLinkedListAction,
  ArrayElementHighlight,
} from "../visual-dsl";
import type { RenderContext } from "../visual-renderer";

/**
 * Generates a stable semantic ID for a linked list node.
 *
 * Uses the VALUE of the node, not its position index, so that:
 *   - Moving a node (e.g. inserting before it) does not change its ID
 *   - The reconciler sees the node as the same element across transformations
 *   - Duplicate values get a numeric suffix: value=56 appears as "56-1", "56-2"
 *
 * This is the root fix for: duplication, distortion, and zombie elements
 * when a linked list is recreated after insertion/deletion.
 */
function stableNodeId(
  listId: string,
  value: string | number,
  occurrenceMap: Map<string, number>,
): string {
  const safeVal = String(value)
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const key = `${listId}::${safeVal}`;
  const count = (occurrenceMap.get(key) ?? 0) + 1;
  occurrenceMap.set(key, count);
  return count === 1
    ? `${listId}-node-${safeVal}`
    : `${listId}-node-${safeVal}-${count}`;
}

export function renderLinkedListGrammar(
  action: CreateLinkedListAction,
  context: RenderContext,
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

  if (n === 0) {
    return elements;
  }

  // Track occurrence counts for stable value-based IDs
  const occurrenceMap = new Map<string, number>();
  const nodeIds: string[] = [];

  let lastNodeX = originX;
  for (let i = 0; i < n; i++) {
    const el = action.elements[i];
    const cellX = originX + i * (W * 1.5 + NODE_GAP); // Nodes are wider
    const cellY = originY;
    lastNodeX = cellX;

    // Use stable value-based ID instead of fragile index-based ID
    const nodeId = stableNodeId(action.id, el.value, occurrenceMap);
    nodeIds.push(nodeId);

    const primitive = createLinkedListNode({
      id: nodeId,
      x: cellX,
      y: cellY,
      width: W * 1.5,
      height: H,
      value: el.value,
      highlight: el.highlight,
    });

    elements.push(...primitive.allElements);
    context.register(
      nodeId,
      primitive.primaryElement,
      primitive.allElements.find((e) => e.type === "text") as any,
      primitive.allElements,
    );

    // Also register a positional alias (e.g. "mylist-0") for backwards
    // compatibility with AI-generated DSL that uses index-based references.
    // This alias points to the same element without creating a duplicate.
    const indexAlias = `${action.id}-${i}`;
    if (indexAlias !== nodeId && !context.hasDirect(indexAlias)) {
      context.register(
        indexAlias,
        primitive.primaryElement,
        primitive.allElements.find((e) => e.type === "text") as any,
        primitive.allElements,
      );
    }
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

  // Connect adjacent nodes using their stable value-based IDs
  for (let i = 0; i < n - 1; i++) {
    const connectorEls = commitSemanticConnector(context, {
      id: `${action.id}-edge-${nodeIds[i]}-${nodeIds[i + 1]}`,
      from: nodeIds[i],
      to: nodeIds[i + 1],
      direction: action.variant === "doubly" ? "bidirectional" : "forward",
      role: "relationship",
      style: { color: "default" },
    });
    elements.push(...connectorEls);
  }

  // Connect last node to NULL
  const nullConnectorEls = commitSemanticConnector(context, {
    id: `${action.id}-edge-null`,
    from: nodeIds[n - 1],
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
