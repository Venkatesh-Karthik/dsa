/**
 * Scene Reconciler
 *
 * Reconciles a canonical SceneState with the Excalidraw canvas elements.
 * Maintains stable element identities, preserves selections, and ensures
 * connectors dynamically follow semantic entity movements.
 */

import {
  newArrowElement,
  newElement,
  newElementWith,
  newTextElement,
  syncInvalidIndices,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import {
  computePerimeterPoint,
  detectObstaclesBetween,
  type ConnectorEndpoint,
  type BoundingBox,
} from "./connector-renderer";
import {
  createVisualPrimitive,
  updateVisualPrimitive,
  sanitizeDisplayLabel,
} from "./visual-primitives/primitive-factory";
import {
  TOKENS,
  mapSemanticStateToEdgeTokens,
} from "./visual-primitives/design-tokens";
import {
  computeOptimalRoute,
  planRelationshipLabel,
  computeOptimalCalloutPosition,
  sanitizeVisualText,
  isVisualDebugEnabled,
  generateDiagnosticsElements,
  type DiagnosticsBox,
} from "./visual-reasoning";

import type { SemanticEntityId } from "./scene-graph";
import type { SceneState } from "./scene-state";

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
  const existingEdgeLabels = new Map<string, ExcalidrawElement>();
  const existingAnnotations = new Map<string, ExcalidrawElement>();
  const unmanagedElements: ExcalidrawElement[] = [];

  for (const el of currentElements) {
    if (el.customData?.isEdgeLabel) {
      const dslId =
        (el.customData?.dslId as string | undefined) ??
        (el.customData?.semanticId as string | undefined) ??
        el.id;
      existingEdgeLabels.set(dslId, el);
    } else if (el.customData?.isAnnotation) {
      const dslId =
        (el.customData?.dslId as string | undefined) ??
        (el.customData?.semanticId as string | undefined) ??
        el.id;
      existingAnnotations.set(dslId, el);
    } else if (el.type === "arrow") {
      const semanticId =
        (el.customData?.semanticId as string | undefined) ??
        (el.customData?.dslId as string | undefined) ??
        (el.customData?.isAiTeaching ? el.id : undefined);
      if (semanticId) {
        existingConnectors.set(semanticId, el);
      }
    } else {
      const rawSemanticId =
        (el.customData?.semanticId as string | undefined) ??
        (el.customData?.dslId as string | undefined);
      if (rawSemanticId) {
        // Strip child sub-element suffixes (e.g. "-val", "-idx", "-label", "-group", "-divider")
        // so all sub-elements belong to the parent entity's element list.
        const normalizedSemanticId = rawSemanticId.replace(
          /-(?:val|idx|label|group|box|bg|divider)$/,
          "",
        );
        const list = existingBySemanticId.get(normalizedSemanticId) ?? [];
        list.push(el);
        existingBySemanticId.set(normalizedSemanticId, list);
        if (normalizedSemanticId !== rawSemanticId) {
          const rawList = existingBySemanticId.get(rawSemanticId) ?? [];
          rawList.push(el);
          existingBySemanticId.set(rawSemanticId, rawList);
        }
      } else {
        // User manual drawings or unmanaged elements
        unmanagedElements.push(el);
      }
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
  const activeEdgeLabelIds = new Set<string>();

  // Helper to resolve entity element with strict multi-pass priority:
  // 1. Authoritative semantic ID (exact)
  // 2. Case-insensitive exact ID
  // 3. Unique alias (rawId)
  // 4. Unique exact semantic reference (label or value)
  // Never guess when multiple candidates exist (reject ambiguous references).
  const resolvePrimaryElement = (
    idOrLabel: string,
  ): ExcalidrawElement | undefined => {
    if (!idOrLabel) {
      return undefined;
    }

    // Priority 1: Authoritative semantic ID (exact)
    if (primaryElementMap.has(idOrLabel)) {
      return primaryElementMap.get(idOrLabel);
    }

    const needle = idOrLabel.trim().toLowerCase();

    // Priority 2: Exact case-insensitive ID
    for (const [k, el] of primaryElementMap.entries()) {
      if (k.toLowerCase() === needle) {
        return el;
      }
    }

    // Priority 3: Unique alias (rawId)
    const aliasMatches: string[] = [];
    for (const [k, ent] of targetState.graph.entities.entries()) {
      const rawId = (
        ent.properties?.rawId as string | undefined
      )?.toLowerCase();
      if (rawId === needle) {
        aliasMatches.push(k);
      }
    }
    if (aliasMatches.length === 1) {
      return primaryElementMap.get(aliasMatches[0]);
    } else if (aliasMatches.length > 1) {
      // Ambiguous alias - do not guess
      return undefined;
    }

    // Priority 4: Unique exact semantic reference (label or value)
    const refMatches: string[] = [];
    for (const [k, ent] of targetState.graph.entities.entries()) {
      const entLabel = (ent.label || "").trim().toLowerCase();
      const entVal = String(ent.value ?? "")
        .trim()
        .toLowerCase();
      if (entLabel === needle || entVal === needle) {
        refMatches.push(k);
      }
    }
    if (refMatches.length === 1) {
      return primaryElementMap.get(refMatches[0]);
    }

    // No unique candidate found
    return undefined;
  };

  const placedLabelBoxes: BoundingBox[] = [];

  // Pre-compute parallel lane assignments for all relationships ONCE before the loop.
  // This guarantees stable, consistent lane indices regardless of Map iteration order.
  const endpointPairCounts = new Map<string, number>();
  const relationshipLanes = new Map<
    string,
    { laneIndex: number; totalLanes: number }
  >();
  if (targetState.graph.relationships) {
    for (const [rId, r] of targetState.graph.relationships.entries()) {
      const key = [r.sourceEntityId, r.targetEntityId].sort().join("<->");
      endpointPairCounts.set(key, (endpointPairCounts.get(key) ?? 0) + 1);
    }
    const currentLaneCounter = new Map<string, number>();
    for (const [rId, r] of targetState.graph.relationships.entries()) {
      const key = [r.sourceEntityId, r.targetEntityId].sort().join("<->");
      const laneIndex = currentLaneCounter.get(key) ?? 0;
      currentLaneCounter.set(key, laneIndex + 1);
      relationshipLanes.set(rId, {
        laneIndex,
        totalLanes: endpointPairCounts.get(key) ?? 1,
      });
    }
  }

  if (targetState.graph.relationships) {
    for (const [relId, rel] of targetState.graph.relationships.entries()) {
      const sourceEl = resolvePrimaryElement(rel.sourceEntityId);
      const targetEl = resolvePrimaryElement(rel.targetEntityId);

      // Connector Safety: strictly reject missing, self-referential, or deleted endpoints
      if (
        !sourceEl ||
        !targetEl ||
        sourceEl.id === targetEl.id ||
        sourceEl.isDeleted ||
        targetEl.isDeleted
      ) {
        const existingArrow = existingConnectors.get(relId);
        if (existingArrow && !existingArrow.isDeleted) {
          resultElements.push(
            newElementWith(existingArrow, { isDeleted: true }),
          );
        }
        continue;
      }

      activeRelationshipIds.add(relId);

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

      const getEntityFullBounds = (
        entityId: string,
        fallbackEl: ExcalidrawElement,
      ): BoundingBox => {
        const els = entityElementMap.get(entityId);
        if (!els || els.length === 0) {
          return {
            x: fallbackEl.x,
            y: fallbackEl.y,
            width: fallbackEl.width,
            height: fallbackEl.height,
          };
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of els) {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      };

      const sourceBounds = getEntityFullBounds(rel.sourceEntityId, sourceEl);
      const targetBounds = getEntityFullBounds(rel.targetEntityId, targetEl);

      // Obstacle avoidance check: include full entity footprints (both containers and text elements)
      const obstacleBoxes: BoundingBox[] = [];
      for (const [k, els] of entityElementMap.entries()) {
        if (k !== rel.sourceEntityId && k !== rel.targetEntityId) {
          for (const el of els) {
            obstacleBoxes.push({
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
            });
          }
        }
      }

      // Use pre-computed lane assignments (hoisted above this loop for consistency)
      const laneInfo = relationshipLanes.get(relId) || {
        laneIndex: 0,
        totalLanes: 1,
      };
      const route = computeOptimalRoute(
        sourceBounds,
        targetBounds,
        obstacleBoxes,
        {
          laneIndex: laneInfo.laneIndex,
          totalLanes: laneInfo.totalLanes,
          preferredRouting: rel.properties?.elbowed ? "elbowed" : "auto",
        },
      );

      const arrowStartX = route.startX;
      const arrowStartY = route.startY;
      const points = route.points;
      const isElbowed = route.isElbowed;

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

      // Edge label rendering — intelligent collision-free capsule style
      if (rel.label) {
        const labelResult = planRelationshipLabel({
          id: relId,
          rawLabel: rel.label,
          route,
          sourceBounds,
          targetBounds,
          obstacles: obstacleBoxes,
          existingLabels: placedLabelBoxes,
          highlight: rel.properties?.highlight as string | undefined,
          lessonId,
        });

        if (labelResult) {
          placedLabelBoxes.push({
            x: labelResult.x,
            y: labelResult.y,
            width: labelResult.width,
            height: labelResult.height,
          });

          for (const labelEl of labelResult.elements) {
            const dslId = (labelEl.customData?.dslId as string) || labelEl.id;
            activeEdgeLabelIds.add(dslId);
            const existing = existingEdgeLabels.get(dslId);
            if (existing) {
              resultElements.push(
                newElementWith(existing as any, {
                  ...labelEl,
                  x: labelEl.x,
                  y: labelEl.y,
                  isDeleted: false,
                }),
              );
            } else {
              resultElements.push(labelEl);
            }
          }
        }
      }
    }
  }

  // Mark removed edge labels as deleted
  for (const [labelDslId, labelEl] of existingEdgeLabels.entries()) {
    if (!activeEdgeLabelIds.has(labelDslId) && !labelEl.isDeleted) {
      resultElements.push(newElementWith(labelEl, { isDeleted: true }));
    }
  }

  // 3.5 Reconcile Annotations (Decision badges, constraint callouts, invariant markers)
  const activeAnnotationIds = new Set<string>();
  if (targetState.graph.annotations && targetState.graph.annotations.size > 0) {
    let annIdx = 0;
    for (const [annId, ann] of targetState.graph.annotations.entries()) {
      activeAnnotationIds.add(annId);
      let posX = 120;
      let posY = 60 + annIdx * 32;

      if (ann.targetEntityId) {
        const targetEl = resolvePrimaryElement(ann.targetEntityId);
        if (targetEl) {
          const anchorBounds: BoundingBox = {
            x: targetEl.x,
            y: targetEl.y,
            width: targetEl.width,
            height: targetEl.height,
          };
          const obstacleBoxes: BoundingBox[] = [];
          for (const [k, el] of primaryElementMap.entries()) {
            if (el.id !== targetEl.id) {
              obstacleBoxes.push({
                x: el.x,
                y: el.y,
                width: el.width,
                height: el.height,
              });
            }
          }
          const calloutPos = computeOptimalCalloutPosition({
            anchorBounds,
            calloutWidth: Math.max(140, (ann.text || "").length * 7.5 + 24),
            calloutHeight: (ann.text || "").split("\n").length > 1 ? 52 : 32,
            obstacles: obstacleBoxes,
            preferredPlacement: (ann.placement as any) || "above",
          });
          posX = calloutPos.x;
          posY = calloutPos.y;
        }
      }

      const existingAnn = existingAnnotations.get(annId);
      if (existingAnn) {
        const updatedAnn = newElementWith(existingAnn as any, {
          text: ann.text,
          x: posX,
          y: posY,
          strokeColor: ann.color || "#9333ea",
          isDeleted: false,
          customData: {
            ...(existingAnn.customData ?? {}),
            dslId: annId,
            semanticId: annId,
            lessonId,
            isAiTeaching: true,
            isAnnotation: true,
          },
        });
        resultElements.push(updatedAnn);
      } else {
        const badgeTextEl = newTextElement({
          text: ann.text,
          x: posX,
          y: posY,
          fontSize: TOKENS.TYPOGRAPHY.Annotation.fontSize,
          fontFamily: TOKENS.TYPOGRAPHY.Annotation.fontFamily,
          textAlign: "left",
          verticalAlign: "middle",
          strokeColor: ann.color || "#9333ea",
          backgroundColor: "#faf5ff",
          fillStyle: "solid" as const,
          strokeWidth: 0,
          roughness: 0,
          customData: {
            dslId: annId,
            semanticId: annId,
            lessonId,
            isAiTeaching: true,
            isAnnotation: true,
          },
        });
        resultElements.push(badgeTextEl);
      }
      annIdx++;
    }
  }

  // Mark removed annotations as deleted
  for (const [annId, annEl] of existingAnnotations.entries()) {
    if (!activeAnnotationIds.has(annId) && !annEl.isDeleted) {
      resultElements.push(newElementWith(annEl, { isDeleted: true }));
    }
  }

  // 4. Mark removed connectors as deleted
  for (const [relId, arrow] of existingConnectors.entries()) {
    if (!activeRelationshipIds.has(relId) && !arrow.isDeleted) {
      resultElements.push(newElementWith(arrow, { isDeleted: true }));
    }
  }

  // 5. Developer Diagnostics Overlay
  if (isVisualDebugEnabled()) {
    const diagBoxes: DiagnosticsBox[] = [];
    for (const [entId, el] of primaryElementMap.entries()) {
      const ent = targetState.graph.entities.get(entId);
      diagBoxes.push({
        id: entId,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        primitiveType: ent?.primitiveType,
      });
    }
    const diagEls = generateDiagnosticsElements(diagBoxes);
    resultElements.push(...diagEls);
  }

  // 5.5 Pre-Render Semantic Consistency Assertion
  // Guarantee that every rendered element corresponding to a semantic entity with an explicit value
  // displays the exact authoritative semantic value (never 0, empty, or an ID).
  for (const [entityId, entity] of targetState.graph.entities.entries()) {
    if (entity.value !== undefined && entity.value !== null) {
      const renderedList = entityElementMap.get(entityId);
      if (renderedList) {
        const textEls = renderedList.filter(
          (e) => e.type === "text",
        ) as ExcalidrawTextElement[];
        const valTextEl =
          textEls.find(
            (t) =>
              t.customData?.subRole === "value" ||
              (t.customData?.dslId as string | undefined)?.endsWith("-val"),
          ) ||
          textEls.find(
            (t) =>
              !t.customData?.isSecondary && t.customData?.subRole !== "index",
          ) ||
          textEls[0];

        if (valTextEl) {
          const expectedValStr = sanitizeDisplayLabel(
            entity.value,
            entity.label,
            entityId,
          );
          if (valTextEl.text !== expectedValStr && expectedValStr !== "") {
            const updated = newElementWith(valTextEl, { text: expectedValStr });
            const idxInRendered = renderedList.findIndex(
              (e) => e.id === valTextEl.id,
            );
            if (idxInRendered >= 0) {
              renderedList[idxInRendered] = updated;
            }
            const idxInResults = resultElements.findIndex(
              (e) => e.id === valTextEl.id,
            );
            if (idxInResults >= 0) {
              resultElements[idxInResults] = updated;
            }
          }
        }
      }
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
