/**
 * Visual Scene Composition Engine — Cognora 6.0
 *
 * Converts abstract visual requirements into a complete canonical SceneGraph.
 * Enforces stable semantic IDs, visual hierarchy, cognitive load constraints,
 * and attaches appropriate state badges and annotations without cluttering primary entities.
 */

import {
  type SceneGraph,
  type SemanticEntity,
  type SemanticRelationship,
  type SemanticAnnotation,
  createEmptySceneGraph,
  cloneSceneGraph,
} from "./scene-graph";

import { visualCapabilities } from "./visual-capabilities";

import type { VisualRequirements } from "./visual-requirements";

export interface SceneCompositionContext {
  stepIndex?: number;
  totalSteps?: number;
  activeExplanation?: string;
  activeDiffSummary?: string;
}

/**
 * Universal scene composition: transforms VisualRequirements into an authoritative SceneGraph.
 */
export function composeVisualScene(
  requirements: VisualRequirements,
  previousScene?: SceneGraph,
  context?: SceneCompositionContext,
): SceneGraph {
  const metadata = {
    title: requirements.concept,
    conceptType: requirements.concept,
    layoutStrategy: requirements.layoutStrategy,
    compoundComponent: requirements.bestCompoundComponent,
    primaryFocusId: requirements.focus.primaryFocusId,
    density: requirements.cognitiveLoad.density,
    stepIndex: context?.stepIndex ?? 0,
    totalSteps: context?.totalSteps ?? 1,
  };

  const graph = createEmptySceneGraph(metadata);
  const omittedSet = new Set(requirements.cognitiveLoad.omittedEntityIds);

  // 1. Compose Entities
  for (const req of requirements.requiredEntities) {
    // Cognitive load management: omit deeply nested or background entities if dense
    if (omittedSet.has(req.id) && req.importance === "background") {
      continue;
    }

    // Retrieve visual capability metadata
    const cap = visualCapabilities.findMatching(
      req.visualType || req.semanticRole || req.label,
    );

    const prevEntity = previousScene?.entities.get(req.id);

    // Compute dynamic highlight styling
    let highlight = req.properties?.highlight as string | undefined;
    if (
      !highlight &&
      req.importance === "primary" &&
      req.id === requirements.focus.primaryFocusId
    ) {
      highlight = "active";
    }

    const isSupporting =
      req.semanticRole === "supporting" ||
      req.semanticRole === "table" ||
      req.id.includes("dist-table") ||
      req.id.includes("table") ||
      req.id.includes("priority-queue");

    const entity: SemanticEntity = {
      id: req.id, // Mandatory stable semantic identity
      primitiveType: req.visualType || cap.id,
      semanticRole: req.semanticRole,
      label: req.label,
      value: req.value,
      state: req.state || prevEntity?.state,
      properties: {
        ...(prevEntity?.properties || {}),
        ...(req.properties || {}),
        importance: req.importance,
        highlight,
        isSupporting,
        shape:
          (req.properties?.shape as any) ||
          (cap.id === "TreeNode" ? "ellipse" : "rectangle"),
        layer: isSupporting
          ? 2
          : req.importance === "primary"
          ? 1
          : req.importance === "secondary"
          ? 2
          : 3,
      },
    };

    graph.entities.set(entity.id, entity);
  }

  // 2. Compose Relationships
  for (const relReq of requirements.requiredRelationships) {
    // Only connect if both source and target are actively rendered in the scene
    if (
      !graph.entities.has(relReq.source) ||
      !graph.entities.has(relReq.target)
    ) {
      continue;
    }

    const prevRel = previousScene?.relationships.get(relReq.id);

    let relHighlight: string | undefined;
    let relColor = relReq.color;

    const isRelaxation =
      relReq.type === "relax" ||
      relReq.label?.toLowerCase().includes("relax") ||
      relReq.properties?.highlight === "active";

    if (isRelaxation) {
      relHighlight = "active";
      relColor = relColor || "#10b981"; // Emerald highlight for shortest-path edge relaxation
    } else if (relReq.importance === "primary") {
      relHighlight = "active";
    } else if (relReq.importance === "temporary") {
      relHighlight = "temporary";
    }

    const relationship: SemanticRelationship = {
      id: relReq.id,
      type: relReq.type,
      sourceEntityId: relReq.source,
      targetEntityId: relReq.target,
      label: relReq.label,
      state: prevRel?.state,
      properties: {
        ...(prevRel?.properties || {}),
        directed: relReq.direction !== "none",
        style: relReq.style || "solid",
        color: relColor,
        highlight: relHighlight,
        importance: relReq.importance,
      },
    };

    graph.relationships.set(relationship.id, relationship);
  }

  // 3. Compose Annotations & Badges
  // Decision Badge
  const stepIdx = context?.stepIndex ?? 0;
  const currStateReq = requirements.requiredStates[stepIdx];
  if (currStateReq?.decisionBadge) {
    const annId = `ann-decision-${stepIdx}`;
    const ann: SemanticAnnotation = {
      id: annId,
      type: "badge",
      text: currStateReq.decisionBadge,
      placement: "above",
      color: "#9333ea",
      targetEntityId: requirements.focus.primaryFocusId,
    };
    graph.annotations.set(annId, ann);
  }

  // Invariant Badge
  if (
    currStateReq?.invariantBadges &&
    currStateReq.invariantBadges.length > 0
  ) {
    const invText = currStateReq.invariantBadges[0];
    const annId = `ann-inv-${stepIdx}`;
    const ann: SemanticAnnotation = {
      id: annId,
      type: "badge",
      text: `Invariant: ${invText}`,
      placement: "below",
      color: "#059669",
    };
    graph.annotations.set(annId, ann);
  }

  // Explanatory callout for active primary transformation
  if (context?.activeDiffSummary) {
    const annId = `ann-callout-${stepIdx}`;
    const ann: SemanticAnnotation = {
      id: annId,
      type: "callout",
      text: context.activeDiffSummary,
      placement: "right",
      targetEntityId: requirements.focus.primaryFocusId,
    };
    graph.annotations.set(annId, ann);
  }

  return graph;
}
