/**
 * Universal Semantic World and State Model
 *
 * Domain-agnostic semantic ontology representing what a concept lesson is about.
 * Decouples semantic truth from rendering/visual representations.
 */

import { type Confidence, CONFIDENCE_KNOWN } from "./confidence-model";

// ============================================================================
// Universal Semantic Entity
// ============================================================================

export interface SemanticEntityPropertyMap {
  highlight?: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  containerId?: string;
  index?: number;
  [key: string]: unknown;
}

export interface Entity {
  /** Stable semantic identifier that persists across ALL state transitions */
  id: string;
  /** Semantic type (e.g. 'Process', 'Packet', 'TreeNode', 'Stage', 'Variable', 'Component', 'Molecule') */
  type: string;
  /** Human-readable display label */
  label: string;
  /** Semantic properties and attributes */
  properties: SemanticEntityPropertyMap;
  /** Optional state tag (e.g. 'active', 'visited', 'eliminated', 'pending', 'resolved') */
  state?: string;
  /** Computational or educational value (e.g. 42, "200 OK", 0.05) */
  value?: unknown;
  /** Semantic role within the system (e.g. 'root', 'pivot', 'source', 'target', 'accumulator') */
  semanticRole?: string;
  /** Extensible domain metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Universal Semantic Relationship
// ============================================================================

export type RelationshipDirection = "forward" | "backward" | "bidirectional" | "none";

export interface Relationship {
  /** Stable identifier for this connection */
  id: string;
  /** Source entity ID */
  source: string;
  /** Target entity ID */
  target: string;
  /** Semantic relationship category (e.g. 'depends_on', 'points_to', 'contains', 'causes', 'connects', 'flows_to') */
  type: string;
  /** Visual or semantic direction */
  direction: RelationshipDirection;
  /** Semantic properties (weight, flow rate, protocol, style) */
  properties?: Record<string, unknown>;
  /** Optional display label */
  label?: string;
  /** Extensible metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Universal Semantic State
// ============================================================================

export interface SemanticState {
  /** Unique state identifier (e.g. 'state-0', 'state-1') */
  id: string;
  /** 0-based sequential index */
  index: number;
  /** Human-readable title of this state */
  name?: string;
  /** Pedagogical description of this state */
  description?: string;
  /** Entities active in this state, indexed by entity ID */
  entities: Map<string, Entity>;
  /** Relationships active in this state, indexed by relationship ID */
  relationships: Map<string, Relationship>;
  /** Global state properties (e.g. active phase, round, loop iteration) */
  properties: Record<string, unknown>;
  /** Deterministically derived or computed values for this state */
  derivedValues: Record<string, unknown>;
  /** Active conditions or invariants holding in this state */
  conditions: string[];
  /** Pedagogical observations for the learner in this state */
  observations: string[];
}

// ============================================================================
// Semantic World: Full Universe of the Concept
// ============================================================================

export interface Goal {
  id: string;
  description: string;
  targetCondition: string;
  isSatisfied?: (state: SemanticState, history?: SemanticState[]) => boolean;
  evaluator?: (state: SemanticState, history?: SemanticState[]) => { satisfied: boolean; evidence?: string };
}

// ============================================================================
// Universal Semantic Operations (State Transitions)
// ============================================================================

export type SemanticOperation =
  | {
      type: "create_entity";
      id: string;
      entityType: string;
      label?: string;
      value?: unknown;
      semanticRole?: string;
      properties?: SemanticEntityPropertyMap;
    }
  | {
      type: "update_entity";
      entityId: string;
      label?: string;
      value?: unknown;
      state?: string;
      semanticRole?: string;
      properties?: SemanticEntityPropertyMap;
    }
  | {
      type: "delete_entity";
      entityId: string;
    }
  | {
      type: "connect_relation";
      id?: string;
      source: string;
      target: string;
      relationType: string;
      direction?: RelationshipDirection;
      label?: string;
      properties?: Record<string, unknown>;
    }
  | {
      type: "update_relation";
      relationId: string;
      state?: string;
      label?: string;
      properties?: Record<string, unknown>;
    }
  | {
      type: "disconnect_relation";
      relationId?: string;
      source?: string;
      target?: string;
    }
  | {
      type: "mutate_property";
      entityId: string;
      key: string;
      value: unknown;
    }
  | {
      type: "transfer_entity";
      entityId: string;
      fromContainerId?: string;
      toContainerId?: string;
      newIndex?: number;
    }
  | {
      type: "highlight";
      target: string;
      color?: string;
    }
  | {
      type: "clear_highlights";
    };

export interface SemanticWorld {
  /** All unique entities in the concept universe */
  entities: Entity[];
  /** All unique relationships */
  relationships: Relationship[];
  /** Global world properties */
  properties: Record<string, unknown>;
  /** Sequential snapshot states across time/steps */
  states: SemanticState[];
  /** Rules governing behavior */
  rules: any[]; // Extended in rules-invariants.ts
  /** Invariant constraints */
  constraints: any[];
  /** Overall learning and task goals */
  goals: Goal[];
  /** Key observations */
  observations: string[];
  /** Derived value definitions */
  derivedValues: any[];
  /** Concept dependencies */
  dependencies: any[];
  /** Transformations connecting consecutive states */
  transformations: any[];
  /** Epistemic confidence */
  confidence: Confidence;
}

// ============================================================================
// Factory Helpers
// ============================================================================

export function createSemanticEntity(
  id: string,
  type: string,
  label: string,
  properties: SemanticEntityPropertyMap = {},
  options?: Partial<Entity>,
): Entity {
  return {
    id,
    type,
    label,
    properties,
    ...options,
  };
}

export function createSemanticRelationship(
  id: string,
  source: string,
  target: string,
  type: string,
  direction: RelationshipDirection = "forward",
  options?: Partial<Relationship>,
): Relationship {
  return {
    id,
    source,
    target,
    type,
    direction,
    ...options,
  };
}

export function createSemanticState(
  index: number,
  id: string = `state-${index}`,
  options?: Partial<SemanticState>,
): SemanticState {
  return {
    id,
    index,
    entities: options?.entities instanceof Map ? options.entities : new Map(),
    relationships: options?.relationships instanceof Map ? options.relationships : new Map(),
    properties: options?.properties || {},
    derivedValues: options?.derivedValues || {},
    conditions: options?.conditions || [],
    observations: options?.observations || [],
    ...options,
  };
}

export function cloneSemanticState(state: SemanticState): SemanticState {
  const clonedEntities = new Map<string, Entity>();
  for (const [id, ent] of state.entities.entries()) {
    clonedEntities.set(id, {
      ...ent,
      properties: { ...ent.properties },
      metadata: ent.metadata ? { ...ent.metadata } : undefined,
    });
  }

  const clonedRelationships = new Map<string, Relationship>();
  for (const [id, rel] of state.relationships.entries()) {
    clonedRelationships.set(id, {
      ...rel,
      properties: rel.properties ? { ...rel.properties } : undefined,
      metadata: rel.metadata ? { ...rel.metadata } : undefined,
    });
  }

  return {
    id: `${state.id}-clone`,
    index: state.index,
    name: state.name,
    description: state.description,
    entities: clonedEntities,
    relationships: clonedRelationships,
    properties: { ...state.properties },
    derivedValues: { ...state.derivedValues },
    conditions: [...state.conditions],
    observations: [...state.observations],
  };
}

/**
 * Deterministically applies a universal SemanticOperation to a SemanticState.
 * Returns a new immutable SemanticState.
 */
export function applySemanticOperation(
  state: SemanticState,
  op: SemanticOperation,
): SemanticState {
  const next = cloneSemanticState(state);

  switch (op.type) {
    case "create_entity": {
      const newEntity: Entity = {
        id: op.id,
        type: op.entityType,
        label: op.label || op.id,
        value: op.value,
        semanticRole: op.semanticRole,
        properties: { ...(op.properties || {}) },
      };
      next.entities.set(op.id, newEntity);
      break;
    }

    case "update_entity": {
      const existing = next.entities.get(op.entityId);
      if (existing) {
        next.entities.set(op.entityId, {
          ...existing,
          label: op.label !== undefined ? op.label : existing.label,
          value: op.value !== undefined ? op.value : existing.value,
          state: op.state !== undefined ? op.state : existing.state,
          semanticRole: op.semanticRole !== undefined ? op.semanticRole : existing.semanticRole,
          properties: {
            ...existing.properties,
            ...(op.properties || {}),
          },
        });
      }
      break;
    }

    case "delete_entity": {
      next.entities.delete(op.entityId);
      // Remove any relationships attached to this entity
      for (const [relId, rel] of next.relationships.entries()) {
        if (rel.source === op.entityId || rel.target === op.entityId) {
          next.relationships.delete(relId);
        }
      }
      break;
    }

    case "connect_relation": {
      const relId = op.id || `rel-${op.source}-${op.target}-${op.relationType}`;
      const newRel: Relationship = {
        id: relId,
        source: op.source,
        target: op.target,
        type: op.relationType,
        direction: op.direction || "forward",
        label: op.label,
        properties: op.properties ? { ...op.properties } : undefined,
      };
      next.relationships.set(relId, newRel);
      break;
    }

    case "update_relation": {
      const existing = next.relationships.get(op.relationId);
      if (existing) {
        next.relationships.set(op.relationId, {
          ...existing,
          label: op.label !== undefined ? op.label : existing.label,
          properties: {
            ...(existing.properties || {}),
            ...(op.state ? { state: op.state } : {}),
            ...(op.properties || {}),
          },
        });
      }
      break;
    }

    case "disconnect_relation": {
      if (op.relationId) {
        next.relationships.delete(op.relationId);
      } else if (op.source && op.target) {
        for (const [relId, rel] of next.relationships.entries()) {
          if (rel.source === op.source && rel.target === op.target) {
            next.relationships.delete(relId);
          }
        }
      }
      break;
    }

    case "mutate_property": {
      const ent = next.entities.get(op.entityId);
      if (ent) {
        ent.properties[op.key] = op.value;
      }
      break;
    }

    case "transfer_entity": {
      const ent = next.entities.get(op.entityId);
      if (ent) {
        if (op.toContainerId !== undefined) {
          ent.properties.containerId = op.toContainerId;
        }
        if (op.newIndex !== undefined) {
          ent.properties.index = op.newIndex;
        }
      }
      break;
    }

    case "highlight": {
      const ent = next.entities.get(op.target);
      if (ent) {
        ent.properties.highlight = op.color || "#3b82f6";
      } else {
        const rel = next.relationships.get(op.target);
        if (rel) {
          rel.properties = { ...(rel.properties || {}), highlight: op.color || "#3b82f6" };
        }
      }
      break;
    }

    case "clear_highlights": {
      for (const ent of next.entities.values()) {
        delete ent.properties.highlight;
      }
      for (const rel of next.relationships.values()) {
        if (rel.properties) {
          delete rel.properties.highlight;
        }
      }
      break;
    }
  }

  return next;
}

/**
 * Applies an ordered list of semantic operations sequentially to a state.
 */
export function applySemanticOperations(
  state: SemanticState,
  ops: SemanticOperation[],
): SemanticState {
  let current = state;
  for (const op of ops) {
    current = applySemanticOperation(current, op);
  }
  return current;
}

