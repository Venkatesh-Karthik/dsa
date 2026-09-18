import {
  newElement,
  newTextElement,
  newElementWith,
} from "@excalidraw/element";

import { ROUNDNESS } from "@excalidraw/common";

import type { ExcalidrawElement, FillStyle } from "@excalidraw/element/types";

import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";

export interface GenericEntityProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  shape: "rectangle" | "ellipse" | "diamond";
  highlight?: string;
  role?: string;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  fillStyle?: FillStyle;
}

export interface GenericEntityPrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

export function createGenericEntity(
  props: GenericEntityProps,
): GenericEntityPrimitive {
  const {
    id,
    x,
    y,
    width,
    height,
    label,
    shape,
    highlight,
    role = "entity",
    strokeColor,
    backgroundColor,
    strokeWidth,
    fillStyle = "solid",
  } = props;

  const style = mapSemanticStateToNodeTokens(highlight);
  const groupId = `${id}-group`;

  const entity = newElement({
    type: shape,
    x,
    y,
    width,
    height,
    strokeColor: strokeColor ?? style.stroke,
    backgroundColor: backgroundColor ?? style.fill,
    fillStyle,
    strokeWidth: strokeWidth ?? style.strokeWidth,
    roughness: 0,
    roundness:
      shape === "rectangle" ? { type: ROUNDNESS.ADAPTIVE_RADIUS } : null,
    groupIds: [groupId],
    customData: {
      dslId: id,
      role,
      semanticType: "entity",
      label,
    },
  });

  const textLabel = newTextElement({
    text: label,
    x: x + width / 2,
    y: y + height / 2,
    fontSize: TOKENS.TYPOGRAPHY.NodePrimary.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.NodePrimary.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: style.textPrimary,
    containerId: shape === "rectangle" ? entity.id : undefined,
    groupIds: [groupId],
    customData: { dslId: `${id}-label` },
  });

  const finalEntity =
    shape === "rectangle"
      ? newElementWith(entity, {
          boundElements: [{ type: "text", id: textLabel.id }],
        })
      : entity;

  return {
    primaryElement: finalEntity,
    allElements: [finalEntity, textLabel],
  };
}
