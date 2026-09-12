/**
 * Scene Reconciler
 *
 * Reconciles a canonical SceneState with the Excalidraw canvas elements.
 * Maintains stable element identities, preserves selections, and ensures
 * connectors dynamically follow semantic entity movements.
 */

import {
  newArrowElement,
  newElementWith,
  syncInvalidIndices,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  ExcalidrawArrowElement,
} from "@excalidraw/element/types";

import type { SceneState } from "./scene-state";
import type { SemanticEntityId } from "./scene-graph";
import { computePerimeterPoint } from "./connector-renderer";
import {
  createVisualPrimitive,
  updateVisualPrimitive,
} from "./visual-primitives/primitive-factory";
import { TOKENS, mapSemanticStateToEdgeTokens } from "./visual-primitives/design-tokens";

export interface ReconcileResult {
  elements: ExcalidrawElement[];
  entityElementMap: Map<SemanticEntityId, ExcalidrawElement[]>;
  primaryElementMap: Map<SemanticEntityId, ExcalidrawElement>;
}

/**
 * Reconciles a target SceneState against current canvas elements.
 */
export function reconcileSceneState(
  targetState: SceneState,
  currentElements: readonly ExcalidrawElement[],
  lessonId?: string,
): ReconcileResult {
  // Index existing elements by semanticId / dslId
  const existingBySemanticId = new Map<string, ExcalidrawElement[]>();
  const existingConnectors = new Map<string, ExcalidrawElement>();
  const unmanagedElements: ExcalidrawElement[] = [];

  for (const el of currentElements) {
    const semanticId =
      (el.customData?.semanticId as string | undefined) ??
      (el.customData?.dslId as string | undefined);

    if (el.type === "arrow" && semanticId) {
      existingConnectors.set(semanticId, el);
    } else if (semanticId) {
      const list = existingBySemanticId.get(semanticId) ?? [];
      list.push(el);
      existingBySemanticId.set(semanticId, list);
    } else {
      // User manual drawings or unmanaged elements
      unmanagedElements.push(el);
    }
  }

  const resultElements: ExcalidrawElement[] = [];
  const entityElementMap = new Map<SemanticEntityId, ExcalidrawElement[]>();
  const primaryElementMap = new Map<SemanticEntityId, ExcalidrawElement>();

  const activeSemanticIds = new Set<string>();

  // 1. Reconcile Entities
  for (const [entityId, entity] of targetState.graph.entities.entries()) {
    activeSemanticIds.add(entityId);
    const pos = targetState.layoutState?.get(entityId) ?? { x: 100, y: 100 };
    const existing = existingBySemanticId.get(entityId);

    let renderedEls: ExcalidrawElement[];
    let primaryEl: ExcalidrawElement;

    if (existing && existing.length > 0) {
      // Update existing primitive in place
      renderedEls = updateVisualPrimitive(existing, entity, pos);
      primaryEl =
        renderedEls.find((e) => e.type !== "text" && e.type !== "arrow") ??
        renderedEls[0];
    } else {
      // Create new primitive
      const primitive = createVisualPrimitive(entity, pos);
      renderedEls = primitive.allElements;
      primaryEl = primitive.primaryElement;
    }

    if (lessonId) {
      renderedEls = renderedEls.map((el) =>
        newElementWith(el, {
          customData: {
            ...(el.customData ?? {}),
            lessonId,
          },
        }),
      );
      primaryEl =
        renderedEls.find((e) => e.id === primaryEl.id) ?? renderedEls[0];
    }

    entityElementMap.set(entityId, renderedEls);
    primaryElementMap.set(entityId, primaryEl);
    resultElements.push(...renderedEls);
  }

  // 2. Mark removed entities as deleted
  for (const [semanticId, els] of existingBySemanticId.entries()) {
    if (!activeSemanticIds.has(semanticId)) {
      for (const el of els) {
        if (!el.isDeleted) {
          resultElements.push(newElementWith(el, { isDeleted: true }));
        }
      }
    }
  }

  // 3. Reconcile Relationships (Connectors follow entities)
  const activeRelationshipIds = new Set<string>();

  for (const [relId, rel] of targetState.graph.relationships.entries()) {
    activeRelationshipIds.add(relId);
    const sourceEl = primaryElementMap.get(rel.sourceEntityId);
    const targetEl = primaryElementMap.get(rel.targetEntityId);

    if (!sourceEl || !targetEl) {
      continue;
    }

    const sourceShape = sourceEl.type === "ellipse" ? "ellipse" : "rectangle";
    const targetShape = targetEl.type === "ellipse" ? "ellipse" : "rectangle";

    const startPt = computePerimeterPoint(
      {
        x: sourceEl.x,
        y: sourceEl.y,
        width: sourceEl.width,
        height: sourceEl.height,
      },
      {
        x: targetEl.x + targetEl.width / 2,
        y: targetEl.y + targetEl.height / 2,
      },
      sourceShape,
    );

    const endPt = computePerimeterPoint(
      {
        x: targetEl.x,
        y: targetEl.y,
        width: targetEl.width,
        height: targetEl.height,
      },
      {
        x: sourceEl.x + sourceEl.width / 2,
        y: sourceEl.y + sourceEl.height / 2,
      },
      targetShape,
    );

    const arrowStartX = startPt.x;
    const arrowStartY = startPt.y;
    const arrowDx = endPt.x - startPt.x;
    const arrowDy = endPt.y - startPt.y;

    const edgeStyle = mapSemanticStateToEdgeTokens(rel.properties?.highlight as string | undefined);
    const strokeColor =
      (rel.properties?.color as string | undefined) ?? edgeStyle.stroke;
    const isDirected = rel.properties?.directed !== false;

    const existingArrow = existingConnectors.get(relId);

    if (existingArrow) {
      // In-place update existing connector
      const updatedArrow = newElementWith(existingArrow as ExcalidrawArrowElement, {
        x: arrowStartX,
        y: arrowStartY,
        points: [
          pointFrom(0, 0) as LocalPoint,
          pointFrom(arrowDx, arrowDy) as LocalPoint,
        ],
        strokeColor,
        strokeWidth: edgeStyle.strokeWidth,
        isDeleted: false,
        endArrowhead: isDirected ? "arrow" : null,
        customData: {
          ...(existingArrow.customData ?? {}),
          dslId: relId,
          semanticId: relId,
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          lessonId,
          isAiTeaching: true,
        },
      });
      resultElements.push(updatedArrow);
    } else {
      // Create new connector arrow
      const newArrow = newArrowElement({
        type: "arrow",
        x: arrowStartX,
        y: arrowStartY,
        points: [
          pointFrom(0, 0) as LocalPoint,
          pointFrom(arrowDx, arrowDy) as LocalPoint,
        ],
        strokeColor,
        strokeWidth: edgeStyle.strokeWidth,
        endArrowhead: isDirected ? "arrow" : null,
        roughness: 0,
        customData: {
          dslId: relId,
          semanticId: relId,
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          lessonId,
          isAiTeaching: true,
        },
      });
      resultElements.push(newArrow);
    }
  }

  // 4. Mark removed connectors as deleted
  for (const [relId, arrow] of existingConnectors.entries()) {
    if (!activeRelationshipIds.has(relId) && !arrow.isDeleted) {
      resultElements.push(newElementWith(arrow, { isDeleted: true }));
    }
  }

  // 5. Preserve unmanaged manual user elements
  for (const el of unmanagedElements) {
    resultElements.push(el);
  }

  const finalSynchronized = syncInvalidIndices(resultElements);

  return {
    elements: finalSynchronized,
    entityElementMap,
    primaryElementMap,
  };
}
