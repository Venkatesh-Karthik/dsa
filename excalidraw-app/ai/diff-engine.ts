/**
 * Semantic Transition Diff Engine
 *
 * Computes semantic differences between whiteboard teaching states (Step N-1 -> Step N).
 * Supports both legacy action-based diffing and canonical SceneState diffing.
 */

import type { VisualAction } from "./visual-dsl";
import type {
  SemanticEntity,
  SemanticRelationship,
  SemanticAnnotation,
  SemanticEntityId,
  SemanticRelationshipId,
} from "./scene-graph";
import type { SceneState } from "./scene-state";

// ============================================================================
// Canonical Scene Diff Types
// ============================================================================

export interface EntityDiff {
  id: SemanticEntityId;
  from: SemanticEntity;
  to: SemanticEntity;
  positionChanged: boolean;
  valueChanged: boolean;
  labelChanged: boolean;
  stateChanged: boolean;
  highlightChanged: boolean;
}

export interface RelationshipDiff {
  id: SemanticRelationshipId;
  from: SemanticRelationship;
  to: SemanticRelationship;
  endpointsChanged: boolean;
  stateChanged: boolean;
}

export interface SceneDiff {
  stepFrom?: number;
  stepTo?: number;
  addedEntities: SemanticEntity[];
  removedEntities: SemanticEntity[];
  updatedEntities: EntityDiff[];
  addedRelationships: SemanticRelationship[];
  removedRelationships: SemanticRelationship[];
  updatedRelationships: RelationshipDiff[];
  addedAnnotations: SemanticAnnotation[];
  removedAnnotations: SemanticAnnotation[];
  summary: string;
}

/**
 * Computes the semantic diff between two complete canonical SceneStates.
 * Identifies added, removed, and mutated entities/relationships by stable semantic ID.
 */
export function computeSceneGraphDiff(
  fromState: SceneState,
  toState: SceneState,
  stepFrom: number = 0,
  stepTo: number = 1,
): SceneDiff {
  const fromEntities = fromState.graph.entities;
  const toEntities = toState.graph.entities;
  const fromRels = fromState.graph.relationships;
  const toRels = toState.graph.relationships;
  const fromAnns = fromState.graph.annotations;
  const toAnns = toState.graph.annotations;

  const addedEntities: SemanticEntity[] = [];
  const removedEntities: SemanticEntity[] = [];
  const updatedEntities: EntityDiff[] = [];

  // Check entities in toState
  for (const [id, toEntity] of toEntities.entries()) {
    const fromEntity = fromEntities.get(id);
    if (!fromEntity) {
      addedEntities.push(toEntity);
    } else {
      const fromPos = fromState.layoutState?.get(id);
      const toPos = toState.layoutState?.get(id);
      const positionChanged =
        fromPos && toPos
          ? Math.abs(fromPos.x - toPos.x) > 0.5 || Math.abs(fromPos.y - toPos.y) > 0.5
          : false;

      const valueChanged = fromEntity.value !== toEntity.value;
      const labelChanged = fromEntity.label !== toEntity.label;
      const stateChanged = fromEntity.state !== toEntity.state;
      const highlightChanged =
        fromEntity.properties?.highlight !== toEntity.properties?.highlight;

      if (
        positionChanged ||
        valueChanged ||
        labelChanged ||
        stateChanged ||
        highlightChanged ||
        JSON.stringify(fromEntity.properties) !== JSON.stringify(toEntity.properties)
      ) {
        updatedEntities.push({
          id,
          from: fromEntity,
          to: toEntity,
          positionChanged,
          valueChanged,
          labelChanged,
          stateChanged,
          highlightChanged,
        });
      }
    }
  }

  // Check entities removed from fromState
  for (const [id, fromEntity] of fromEntities.entries()) {
    if (!toEntities.has(id)) {
      removedEntities.push(fromEntity);
    }
  }

  // Check relationships
  const addedRelationships: SemanticRelationship[] = [];
  const removedRelationships: SemanticRelationship[] = [];
  const updatedRelationships: RelationshipDiff[] = [];

  for (const [id, toRel] of toRels.entries()) {
    const fromRel = fromRels.get(id);
    if (!fromRel) {
      addedRelationships.push(toRel);
    } else {
      const endpointsChanged =
        fromRel.sourceEntityId !== toRel.sourceEntityId ||
        fromRel.targetEntityId !== toRel.targetEntityId;
      const stateChanged = fromRel.state !== toRel.state;

      if (
        endpointsChanged ||
        stateChanged ||
        fromRel.label !== toRel.label ||
        JSON.stringify(fromRel.properties) !== JSON.stringify(toRel.properties)
      ) {
        updatedRelationships.push({
          id,
          from: fromRel,
          to: toRel,
          endpointsChanged,
          stateChanged,
        });
      }
    }
  }

  for (const [id, fromRel] of fromRels.entries()) {
    if (!toRels.has(id)) {
      removedRelationships.push(fromRel);
    }
  }

  // Check annotations
  const addedAnnotations: SemanticAnnotation[] = [];
  const removedAnnotations: SemanticAnnotation[] = [];

  for (const [id, toAnn] of toAnns.entries()) {
    if (!fromAnns.has(id)) {
      addedAnnotations.push(toAnn);
    }
  }

  for (const [id, fromAnn] of fromAnns.entries()) {
    if (!toAnns.has(id)) {
      removedAnnotations.push(fromAnn);
    }
  }

  const summaryParts: string[] = [];
  if (addedEntities.length > 0) summaryParts.push(`+${addedEntities.length} entities`);
  if (removedEntities.length > 0) summaryParts.push(`-${removedEntities.length} entities`);
  if (updatedEntities.length > 0) summaryParts.push(`~${updatedEntities.length} entities`);
  if (addedRelationships.length > 0) summaryParts.push(`+${addedRelationships.length} edges`);
  if (removedRelationships.length > 0) summaryParts.push(`-${removedRelationships.length} edges`);

  return {
    stepFrom,
    stepTo,
    addedEntities,
    removedEntities,
    updatedEntities,
    addedRelationships,
    removedRelationships,
    updatedRelationships,
    addedAnnotations,
    removedAnnotations,
    summary: summaryParts.length > 0 ? summaryParts.join(", ") : "No semantic changes",
  };
}

// ============================================================================
// Legacy Action-Based Diff (Backwards Compatibility)
// ============================================================================

export interface SemanticTransitionDiff {
  stepFrom: number;
  stepTo: number;
  created: string[];
  updated: string[];
  deleted: string[];
  highlighted: string[];
  summary: string;
}

function getActionKey(action: VisualAction): string {
  if ("id" in action && action.id) {
    return action.id;
  }
  if ("target" in action && action.target) {
    return `action-${action.type}-${action.target}`;
  }
  return `anon-${action.type}-${JSON.stringify(action)}`;
}

/**
 * Computes the semantic diff between two sets of VisualActions representing states.
 */
export function computeSemanticDiff(
  beforeActions: VisualAction[],
  afterActions: VisualAction[],
  stepFrom: number = 0,
  stepTo: number = 1,
): SemanticTransitionDiff {
  const beforeMap = new Map<string, VisualAction>();
  for (const a of beforeActions) {
    beforeMap.set(getActionKey(a), a);
  }

  const afterMap = new Map<string, VisualAction>();
  for (const a of afterActions) {
    afterMap.set(getActionKey(a), a);
  }

  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];
  const highlighted: string[] = [];

  // Check for highlights in after actions
  for (const a of afterActions) {
    if (a.type === "highlight") {
      highlighted.push(a.target);
    }
  }

  // Detect created and updated
  for (const [key, afterAction] of afterMap.entries()) {
    const beforeAction = beforeMap.get(key);
    if (!beforeAction) {
      created.push(key);
    } else {
      // Check if deep serialized content changed
      const beforeStr = JSON.stringify(beforeAction);
      const afterStr = JSON.stringify(afterAction);
      if (beforeStr !== afterStr) {
        updated.push(key);
      }
    }
  }

  // Detect deleted
  for (const key of beforeMap.keys()) {
    if (!afterMap.has(key)) {
      deleted.push(key);
    }
  }

  const summaryParts: string[] = [];
  if (created.length > 0) {
    summaryParts.push(`Created: [${created.join(", ")}]`);
  }
  if (updated.length > 0) {
    summaryParts.push(`Updated: [${updated.join(", ")}]`);
  }
  if (deleted.length > 0) {
    summaryParts.push(`Deleted: [${deleted.join(", ")}]`);
  }
  if (highlighted.length > 0) {
    summaryParts.push(`Highlighted: [${highlighted.join(", ")}]`);
  }

  return {
    stepFrom,
    stepTo,
    created,
    updated,
    deleted,
    highlighted,
    summary:
      summaryParts.length > 0
        ? summaryParts.join(" | ")
        : "No visual state changes.",
  };
}
