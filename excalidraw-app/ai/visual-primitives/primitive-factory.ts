/**
 * Visual Primitive Factory
 *
 * Maps abstract semantic entities to concrete Cognora visual primitives on the Excalidraw canvas.
 * Encapsulates primitive creation and in-place updates while preserving stable element identities.
 */

import { newElementWith } from "@excalidraw/element";
import type { ExcalidrawElement, ExcalidrawTextElement } from "@excalidraw/element/types";
import type { SemanticEntity } from "../scene-graph";
import type { LayoutPoint } from "../layout-engine";

import { createTreeNode } from "./tree-node";
import { createGraphNode } from "./graph-node";
import { createArrayCell } from "./array-cell";
import { createLinkedListNode } from "./linked-list-node";
import { createCallFrame } from "./call-frame";
import { createGenericEntity } from "./generic-entity";
import { createAnnotationPrimitive } from "./annotation-primitive";
import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";

export interface RenderedPrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

/**
 * Creates a visual primitive from a semantic entity at a specified layout position.
 */
export function createVisualPrimitive(
  entity: SemanticEntity,
  pos: LayoutPoint,
): RenderedPrimitive {
  const highlight = entity.properties?.highlight as string | undefined;
  const rawId = entity.id;

  let primitive: RenderedPrimitive;

  switch (entity.primitiveType) {
    case "TreeNode": {
      const diameter =
        (entity.properties?.diameter as number | undefined) ??
        TOKENS.GEOMETRY.nodeDiameter;
      primitive = createTreeNode({
        id: rawId,
        x: pos.x,
        y: pos.y,
        value:
          typeof entity.value === "string" || typeof entity.value === "number"
            ? entity.value
            : String(entity.value ?? entity.label ?? ""),
        highlight,
        diameter,
      });
      break;
    }

    case "GraphNode": {
      const diameter =
        (entity.properties?.diameter as number | undefined) ??
        TOKENS.GEOMETRY.nodeDiameter;
      primitive = createGraphNode({
        id: rawId,
        x: pos.x,
        y: pos.y,
        label: entity.label ?? String(entity.value ?? ""),
        value: entity.value as string | number | undefined,
        highlight,
        diameter,
      });
      break;
    }

    case "ArrayCell": {
      const width =
        (entity.properties?.width as number | undefined) ??
        TOKENS.GEOMETRY.cellWidth;
      const height =
        (entity.properties?.height as number | undefined) ??
        TOKENS.GEOMETRY.cellHeight;
      primitive = createArrayCell({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        value:
          typeof entity.value === "string" || typeof entity.value === "number"
            ? entity.value
            : String(entity.value ?? entity.label ?? ""),
        index: entity.properties?.index as number | undefined,
        highlight,
      });
      break;
    }

    case "LinkedListNode": {
      primitive = createLinkedListNode({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width: 80,
        height: 40,
        value:
          typeof entity.value === "string" || typeof entity.value === "number"
            ? entity.value
            : String(entity.value ?? entity.label ?? ""),
        highlight,
      });
      break;
    }

    case "CallFrame":
    case "StackFrame": {
      primitive = createCallFrame({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width: 140,
        height: 40,
        label: entity.label ?? String(entity.value ?? "Frame"),
        highlight,
      });
      break;
    }

    case "Annotation":
    case "Callout": {
      const text =
        (entity.properties?.text as string | undefined) ??
        entity.label ??
        String(entity.value ?? "");
      const title = entity.properties?.title as string | undefined;

      primitive = createAnnotationPrimitive({
        id: rawId,
        x: pos.x,
        y: pos.y,
        text,
        title,
        highlight,
        role: entity.semanticRole ?? "annotation",
      });
      break;
    }

    case "GenericEntity":
    default: {
      const width =
        (entity.properties?.width as number | undefined) ?? 120;
      const height =
        (entity.properties?.height as number | undefined) ?? 60;
      const shape =
        (entity.properties?.shape as "rectangle" | "ellipse" | "diamond" | undefined) ??
        "rectangle";

      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: entity.label ?? String(entity.value ?? ""),
        shape,
        highlight,
        role: entity.semanticRole,
      });
      break;
    }
  }

  // Tag every created element with canonical semantic identity
  const taggedElements = primitive.allElements.map((el) =>
    newElementWith(el, {
      customData: {
        ...(el.customData ?? {}),
        dslId: entity.id,
        semanticId: entity.id,
        primitiveType: entity.primitiveType,
        role: entity.semanticRole,
        isAiTeaching: true,
      },
    }),
  );

  const primaryElement =
    taggedElements.find((e) => e.id === primitive.primaryElement.id) ??
    taggedElements[0];

  return {
    primaryElement,
    allElements: taggedElements,
  };
}

/**
 * In-place update of existing Excalidraw elements for a semantic entity.
 * Preserves exact element IDs while updating positions, text labels, and styles.
 */
export function updateVisualPrimitive(
  existingElements: readonly ExcalidrawElement[],
  entity: SemanticEntity,
  targetPos: LayoutPoint,
): ExcalidrawElement[] {
  if (existingElements.length === 0) return [];

  // Identify the primary container or shape
  const primaryEl =
    existingElements.find((el) => el.type !== "text" && el.type !== "arrow") ??
    existingElements[0];

  const dx = targetPos.x - primaryEl.x;
  const dy = targetPos.y - primaryEl.y;

  const highlight = entity.properties?.highlight as string | undefined;
  const style = mapSemanticStateToNodeTokens(highlight);
  const newText = entity.label ?? (entity.value != null ? String(entity.value) : undefined);

  return existingElements.map((el) => {
    const updates: Record<string, unknown> = {
      x: el.x + dx,
      y: el.y + dy,
      isDeleted: false,
    };

    // Update style on shape elements
    if (el.type !== "text" && el.type !== "arrow" && el.type !== "line") {
      updates.strokeColor = style.stroke;
      updates.backgroundColor = style.fill;
      updates.strokeWidth = style.strokeWidth;
    }

    // Update text content on label elements
    if (el.type === "text" && newText != null) {
      // Only replace primary value text, not sub-labels unless appropriate
      const textEl = el as ExcalidrawTextElement;
      if (!textEl.customData?.isSecondary) {
        updates.text = newText;
        updates.strokeColor = style.textPrimary;
      }
    }

    // Refresh customData
    updates.customData = {
      ...(el.customData ?? {}),
      dslId: entity.id,
      semanticId: entity.id,
      primitiveType: entity.primitiveType,
      role: entity.semanticRole,
      isAiTeaching: true,
    };

    return newElementWith(el, updates);
  });
}
