/**
 * Generic Concept Grammar
 *
 * Structural visual grammar for arbitrary concepts that do not fit
 * specialized data structure templates (e.g. Photosynthesis, Refrigeration,
 * HTTP protocols, CPU scheduling, Machine Learning pipelines, System Design).
 */

import {
  type SceneGraph,
  createEmptySceneGraph,
  addEntity,
  addRelationship,
} from "../scene-graph";

export interface ConceptEntityDef {
  id: string;
  label: string;
  role?: string;
  value?: unknown;
  shape?: "rectangle" | "ellipse" | "diamond";
  highlight?: string;
  properties?: Record<string, unknown>;
}

export interface ConceptRelationshipDef {
  id?: string;
  from: string;
  to: string;
  label?: string;
  type?: string;
  directed?: boolean;
  highlight?: string;
  properties?: Record<string, unknown>;
}

/**
 * Compiles an arbitrary conceptual model into a canonical SceneGraph.
 */
export function compileGenericConceptGraph(
  entities: ConceptEntityDef[],
  relationships: ConceptRelationshipDef[] = [],
  metadata?: { title?: string; conceptType?: string; [key: string]: unknown },
): SceneGraph {
  const graph = createEmptySceneGraph({
    conceptType: "generic_concept",
    ...(metadata || {}),
  });

  for (const ent of entities) {
    addEntity(graph, {
      id: ent.id,
      primitiveType: "GenericEntity",
      semanticRole: ent.role || "entity",
      value: ent.value,
      label: ent.label,
      properties: {
        shape: ent.shape || "rectangle",
        highlight: ent.highlight,
        ...(ent.properties || {}),
      },
    });
  }

  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i];
    const relId = rel.id || `rel-${rel.from}-${rel.to}-${i}`;
    addRelationship(graph, {
      id: relId,
      type: rel.type || "connects",
      sourceEntityId: rel.from,
      targetEntityId: rel.to,
      label: rel.label,
      properties: {
        directed: rel.directed ?? true,
        highlight: rel.highlight,
        ...(rel.properties || {}),
      },
    });
  }

  return graph;
}
