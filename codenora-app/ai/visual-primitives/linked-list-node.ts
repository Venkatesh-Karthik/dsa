import { newElement, newTextElement } from "@excalidraw/element";

import { ROUNDNESS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";

export interface LinkedListNodeProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | number;
  highlight?: string;
}

export interface LinkedListNodePrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createLinkedListNode(
  props: LinkedListNodeProps,
): LinkedListNodePrimitive {
  const { id, x, y, width, height, value, highlight } = props;

  const style = mapSemanticStateToNodeTokens(highlight);
  const groupId = `${id}-group`;

  // Draw the main container
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
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS }, // Subtle rounding like other nodes
    groupIds: [groupId],
    customData: {
      dslId: id,
      semanticId: id,
      role: "linked-list-node",
      semanticType: "linked_list_node",
      value,
    },
  });

  // Draw the divider line for the pointer section
  const dividerX = x + width * 0.7; // 70% value, 30% pointer
  const divider = newElement({
    type: "rectangle",
    x: dividerX,
    y,
    width: 2,
    height,
    strokeColor: style.stroke,
    backgroundColor: style.stroke,
    fillStyle: "solid",
    strokeWidth: 0,
    roughness: 0,
    groupIds: [groupId],
    customData: {
      dslId: `${id}-divider`,
      semanticId: id,
      subRole: "divider",
    },
  });

  const valueLabel = newTextElement({
    text: String(value),
    x: x + width * 0.35, // Center of the value portion
    y: y + height / 2,
    fontSize: TOKENS.TYPOGRAPHY.NodePrimary.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.NodePrimary.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.textPrimary,
    groupIds: [groupId],
    customData: {
      dslId: `${id}-val`,
      semanticId: id,
      subRole: "value",
    },
  });

  return {
    primaryElement: rect,
    allElements: [rect, divider, valueLabel],
  };
}
