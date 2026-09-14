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
  newTextElement,
  syncInvalidIndices,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  ExcalidrawArrowElement,
} from "@excalidraw/element/types";

import type { SceneState } from "./scene-state";
import type { SemanticEntityId } from "./scene-graph";
import {
  computePerimeterPoint,
  detectObstaclesBetween,
  type ConnectorEndpoint,
} from "./connector-renderer";
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

  // Helper to resolve entity element with multi-pass lookup (exact ID, lowercase, label, alias, or suffix)
  const resolvePrimaryElement = (
    idOrLabel: string,
  ): ExcalidrawElement | undefined => {
    if (!idOrLabel) return undefined;
    if (primaryElementMap.has(idOrLabel)) {
      return primaryElementMap.get(idOrLabel);
    }
    const needle = idOrLabel.trim().toLowerCase();
    for (const [k, el] of primaryElementMap.entries()) {
      if (k.toLowerCase() === needle) return el;
    }
    for (const [k, ent] of targetState.graph.entities.entries()) {
      const entLabel = (ent.label || "").trim().toLowerCase();
      const entVal = String(ent.value ?? "").trim().toLowerCase();
      const rawId = (
        ent.properties?.rawId as string | undefined
      )?.toLowerCase();
      if (entLabel === needle || entVal === needle || rawId === needle) {
        return primaryElementMap.get(k);
      }
      if (
        k.toLowerCase().includes(needle) ||
        needle.includes(k.toLowerCase())
      ) {
        return primaryElementMap.get(k);
      }
    }
    return undefined;
  };

  for (const [relId, rel] of targetState.graph.relationships.entries()) {
    activeRelationshipIds.add(relId);
    const sourceEl = resolvePrimaryElement(rel.sourceEntityId);
    const targetEl = resolvePrimaryElement(rel.targetEntityId);

    if (!sourceEl || !targetEl || sourceEl.id === targetEl.id) {
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

    const sourceBounds = {
      x: sourceEl.x,
      y: sourceEl.y,
      width: sourceEl.width,
      height: sourceEl.height,
    };
    const targetBounds = {
      x: targetEl.x,
      y: targetEl.y,
      width: targetEl.width,
      height: targetEl.height,
    };

    // Obstacle avoidance check
    const obstacles: ConnectorEndpoint[] = [];
    for (const [k, el] of primaryElementMap.entries()) {
      if (el.id !== sourceEl.id && el.id !== targetEl.id) {
        obstacles.push({
          primaryElement: el,
          bounds: { x: el.x, y: el.y, width: el.width, height: el.height },
        });
      }
    }

    const blockingObstacles = detectObstaclesBetween(
      sourceBounds,
      targetBounds,
      obstacles,
    );

    let points: readonly LocalPoint[];
    let arrowStartX: number;
    let arrowStartY: number;
    let isElbowed = Boolean(rel.properties?.elbowed);

    if (blockingObstacles.length > 0) {
      isElbowed = true;
      const isVertical =
        Math.abs(targetBounds.y - sourceBounds.y) >=
        Math.abs(targetBounds.x - sourceBounds.x);
      if (isVertical) {
        let maxRight = Math.max(
          sourceBounds.x + sourceBounds.width,
          targetBounds.x + targetBounds.width,
        );
        for (const obs of blockingObstacles) {
          maxRight = Math.max(maxRight, obs.bounds.x + obs.bounds.width);
        }
        const flankX = maxRight + 36;
        arrowStartX = sourceBounds.x + sourceBounds.width;
        arrowStartY = sourceBounds.y + sourceBounds.height / 2;
        const arrowEndX = targetBounds.x + targetBounds.width;
        const arrowEndY = targetBounds.y + targetBounds.height / 2;

        points = [
          pointFrom(0, 0) as LocalPoint,
          pointFrom(flankX - arrowStartX, 0) as LocalPoint,
          pointFrom(flankX - arrowStartX, arrowEndY - arrowStartY) as LocalPoint,
          pointFrom(arrowEndX - arrowStartX, arrowEndY - arrowStartY) as LocalPoint,
        ];
      } else {
        let maxBottom = Math.max(
          sourceBounds.y + sourceBounds.height,
          targetBounds.y + targetBounds.height,
        );
        for (const obs of blockingObstacles) {
          maxBottom = Math.max(maxBottom, obs.bounds.y + obs.bounds.height);
        }
        const flankY = maxBottom + 36;
        arrowStartX = sourceBounds.x + sourceBounds.width / 2;
        arrowStartY = sourceBounds.y + sourceBounds.height;
        const arrowEndX = targetBounds.x + targetBounds.width / 2;
        const arrowEndY = targetBounds.y + targetBounds.height;

        points = [
          pointFrom(0, 0) as LocalPoint,
          pointFrom(0, flankY - arrowStartY) as LocalPoint,
          pointFrom(arrowEndX - arrowStartX, flankY - arrowStartY) as LocalPoint,
          pointFrom(arrowEndX - arrowStartX, arrowEndY - arrowStartY) as LocalPoint,
        ];
      }
    } else {
      arrowStartX = startPt.x;
      arrowStartY = startPt.y;
      points = [
        pointFrom(0, 0) as LocalPoint,
        pointFrom(endPt.x - startPt.x, endPt.y - startPt.y) as LocalPoint,
      ];
    }

    const edgeStyle = mapSemanticStateToEdgeTokens(
      rel.properties?.highlight as string | undefined,
    );
    const strokeColor =
      (rel.properties?.color as string | undefined) ?? edgeStyle.stroke;
    const isDirected = rel.properties?.directed !== false;

    const existingArrow = existingConnectors.get(relId);

    if (existingArrow) {
      // Immutable update existing connector
      const updatedArrow = newElementWith(
        existingArrow as ExcalidrawArrowElement,
        {
          x: arrowStartX,
          y: arrowStartY,
          points,
          elbowed: isElbowed,
          strokeColor,
          strokeWidth: edgeStyle.strokeWidth,
          isDeleted: false,
          endArrowhead: isDirected ? "arrow" : null,
          startBinding: {
            elementId: sourceEl.id,
            fixedPoint: [0.5, 0.5],
            mode: "orbit",
          },
          endBinding: {
            elementId: targetEl.id,
            fixedPoint: [0.5, 0.5],
            mode: "orbit",
          },
          customData: {
            ...(existingArrow.customData ?? {}),
            dslId: relId,
            semanticId: relId,
            sourceEntityId: rel.sourceEntityId,
            targetEntityId: rel.targetEntityId,
            lessonId,
            isAiTeaching: true,
          },
        },
      );
      resultElements.push(updatedArrow);
    } else {
      // Create new connector arrow with native Excalidraw bindings
      const baseArrow = newArrowElement({
        type: "arrow",
        x: arrowStartX,
        y: arrowStartY,
        points,
        elbowed: isElbowed,
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
      const newArrow = newElementWith(baseArrow, {
        startBinding: {
          elementId: sourceEl.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: {
          elementId: targetEl.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });
      resultElements.push(newArrow);
    }

    // Edge label rendering — floating capsule style
    if (rel.label) {
      const midPoint =
        points[Math.floor(points.length / 2)] || points[0];
      const labelX = Math.round(arrowStartX + midPoint[0] - 18);
      const labelY = Math.round(arrowStartY + midPoint[1] - 22);

      const labelEl = newTextElement({
        text: rel.label,
        x: labelX,
        y: labelY,
        fontSize: TOKENS.TYPOGRAPHY.EdgeWeight.fontSize,
        fontFamily: TOKENS.TYPOGRAPHY.EdgeWeight.fontFamily,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#475569",
        backgroundColor: "#ffffff",
        fillStyle: "solid" as const,
        strokeWidth: 0,
        roughness: 0,
        customData: {
          dslId: `${relId}-label`,
          semanticId: `${relId}-label`,
          lessonId,
          isAiTeaching: true,
          isEdgeLabel: true,
        },
      });
      resultElements.push(labelEl);
    }
  }

  // 4. Mark removed connectors as deleted
  for (const [relId, arrow] of existingConnectors.entries()) {
    if (!activeRelationshipIds.has(relId) && !arrow.isDeleted) {
      resultElements.push(newElementWith(arrow, { isDeleted: true }));
    }
  }

  // 6. Deduplicate by element ID to strictly preserve ElementsDelta invariants
  const seenIds = new Set<string>();
  const deduplicated: ExcalidrawElement[] = [];
  for (const el of resultElements) {
    if (!seenIds.has(el.id)) {
      seenIds.add(el.id);
      deduplicated.push(el);
    }
  }

  const finalSynchronized = syncInvalidIndices(deduplicated);

  return {
    elements: finalSynchronized,
    entityElementMap,
    primaryElementMap,
  };
}
