/**
 * Canonical Scene Graph
 *
 * The single authoritative semantic representation of a Cognora visual scene.
 * Decouples pedagogical meaning, entities, and connectivity from raw canvas coordinates.
 */

export type SemanticEntityId = string;
export type SemanticRelationshipId = string;

export type SemanticPrimitiveType =
  | "TreeNode"
  | "GraphNode"
  | "ArrayCell"
  | "LinkedListNode"
  | "StackFrame"
  | "CallFrame"
  | "Pointer"
  | "Annotation"
  | "Container"
  | "GenericEntity"
  | string;

export interface SemanticEntity {
  /** Stable semantic identifier that persists across all transformations (e.g. 'node-20') */
  id: SemanticEntityId;
  /** High-level structural primitive classification */
  primitiveType: SemanticPrimitiveType;
  /** Semantic role in the concept (e.g. 'root', 'pivot', 'endpoint', 'input', 'process') */
  semanticRole?: string;
  /** Underlying algorithmic or pedagogical value (e.g. 20, "GET /api", 42) */
  value?: unknown;
  /** Human-readable display label */
  label?: string;
  /** Dynamic pedagogical state (e.g. 'active', 'visited', 'balanced', 'highlighted') */
  state?: string;
  /** Semantic style and layout properties */
  properties?: {
    highlight?: string;
    color?: string;
    size?: string;
    shape?: "rectangle" | "ellipse" | "diamond";
    index?: number;
    containerId?: string;
    level?: number;
    balanceFactor?: number;
    height?: number;
    [key: string]: unknown;
  };
}

export type SemanticRelationshipType =
  | "parentOf"
  | "leftOf"
  | "rightOf"
  | "childOf"
  | "next"
  | "previous"
  | "pointsTo"
  | "connects"
  | "sendsTo"
  | "calls"
  | "produces"
  | "transforms"
  | string;

export interface SemanticRelationship {
  /** Unique relationship identifier (e.g. 'edge-20-30') */
  id: SemanticRelationshipId;
  /** Relationship semantic classification */
  type: SemanticRelationshipType;
  /** Source entity ID (must exist in graph.entities) */
  sourceEntityId: SemanticEntityId;
  /** Target entity ID (must exist in graph.entities) */
  targetEntityId: SemanticEntityId;
  /** Optional edge label (e.g. weight, protocol method, transition condition) */
  label?: string;
  /** State of this connection (e.g. 'active', 'traversed', 'reversed') */
  state?: string;
  /** Edge styling and geometry hints */
  properties?: {
    directed?: boolean;
    weight?: number;
    color?: string;
    style?: "solid" | "dashed" | "dotted";
    elbowed?: boolean;
    [key: string]: unknown;
  };
}

export interface SemanticAnnotation {
  id: string;
  targetEntityId?: SemanticEntityId;
  type: "callout" | "badge" | "pointer" | "label" | "formula";
  text: string;
  placement?: "above" | "below" | "left" | "right";
  color?: string;
  properties?: Record<string, unknown>;
}

export interface SceneGraph {
  entities: Map<SemanticEntityId, SemanticEntity>;
  relationships: Map<SemanticRelationshipId, SemanticRelationship>;
  annotations: Map<string, SemanticAnnotation>;
  metadata?: {
    conceptType?: string;
    grammars?: string[];
    title?: string;
    rootEntityId?: string;
    [key: string]: unknown;
  };
}

/**
 * Creates an empty canonical SceneGraph
 */
export function createEmptySceneGraph(
  metadata?: SceneGraph["metadata"],
): SceneGraph {
  return {
    entities: new Map(),
    relationships: new Map(),
    annotations: new Map(),
    metadata: metadata ? { ...metadata } : undefined,
  };
}

/**
 * Performs a deep clone of a SceneGraph to guarantee state immutability
 */
export function cloneSceneGraph(graph: SceneGraph): SceneGraph {
  const cloned: SceneGraph = {
    entities: new Map(),
    relationships: new Map(),
    annotations: new Map(),
    metadata: graph.metadata
      ? JSON.parse(JSON.stringify(graph.metadata))
      : undefined,
  };

  for (const [id, entity] of graph.entities.entries()) {
    cloned.entities.set(id, {
      ...entity,
      properties: entity.properties
        ? JSON.parse(JSON.stringify(entity.properties))
        : undefined,
    });
  }

  for (const [id, rel] of graph.relationships.entries()) {
    cloned.relationships.set(id, {
      ...rel,
      properties: rel.properties
        ? JSON.parse(JSON.stringify(rel.properties))
        : undefined,
    });
  }

  for (const [id, ann] of graph.annotations.entries()) {
    cloned.annotations.set(id, {
      ...ann,
      properties: ann.properties
        ? JSON.parse(JSON.stringify(ann.properties))
        : undefined,
    });
  }

  return cloned;
}

/**
 * Adds or updates an entity in the graph
 */
export function addEntity(graph: SceneGraph, entity: SemanticEntity): void {
  graph.entities.set(entity.id, {
    ...entity,
    properties: entity.properties ? { ...entity.properties } : {},
  });
}

/**
 * Patches an existing entity in the graph
 */
export function updateEntity(
  graph: SceneGraph,
  id: SemanticEntityId,
  patch: Partial<SemanticEntity>,
): boolean {
  const existing = graph.entities.get(id);
  if (!existing) {
    return false;
  }

  graph.entities.set(id, {
    ...existing,
    ...patch,
    id, // Enforce stable ID
    properties: {
      ...(existing.properties ?? {}),
      ...(patch.properties ?? {}),
    },
  });
  return true;
}

/**
 * Removes an entity and cascades deletion to all attached relationships
 */
export function removeEntity(graph: SceneGraph, id: SemanticEntityId): boolean {
  if (!graph.entities.has(id)) {
    return false;
  }
  graph.entities.delete(id);

  // Cascade to relationships
  for (const [relId, rel] of graph.relationships.entries()) {
    if (rel.sourceEntityId === id || rel.targetEntityId === id) {
      graph.relationships.delete(relId);
    }
  }

  // Cascade to annotations targeting this entity
  for (const [annId, ann] of graph.annotations.entries()) {
    if (ann.targetEntityId === id) {
      graph.annotations.delete(annId);
    }
  }

  return true;
}

/**
 * Adds or updates a relationship in the graph
 */
export function addRelationship(
  graph: SceneGraph,
  rel: SemanticRelationship,
): void {
  graph.relationships.set(rel.id, {
    ...rel,
    properties: rel.properties ? { ...rel.properties } : {},
  });
}

/**
 * Removes a relationship from the graph
 */
export function removeRelationship(
  graph: SceneGraph,
  id: SemanticRelationshipId,
): boolean {
  return graph.relationships.delete(id);
}

/**
 * Retrieves all relationships connected to a given entity
 */
export function getRelationshipsForEntity(
  graph: SceneGraph,
  id: SemanticEntityId,
): SemanticRelationship[] {
  const results: SemanticRelationship[] = [];
  for (const rel of graph.relationships.values()) {
    if (rel.sourceEntityId === id || rel.targetEntityId === id) {
      results.push(rel);
    }
  }
  return results;
}

/**
 * Retrieves incoming relationships for an entity
 */
export function getIncomingRelationships(
  graph: SceneGraph,
  id: SemanticEntityId,
): SemanticRelationship[] {
  const results: SemanticRelationship[] = [];
  for (const rel of graph.relationships.values()) {
    if (rel.targetEntityId === id) {
      results.push(rel);
    }
  }
  return results;
}

/**
 * Retrieves outgoing relationships for an entity
 */
export function getOutgoingRelationships(
  graph: SceneGraph,
  id: SemanticEntityId,
): SemanticRelationship[] {
  const results: SemanticRelationship[] = [];
  for (const rel of graph.relationships.values()) {
    if (rel.sourceEntityId === id) {
      results.push(rel);
    }
  }
  return results;
}
