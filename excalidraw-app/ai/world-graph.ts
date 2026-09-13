/**
 * Semantic World Graph & Why Engine
 *
 * Graph-theoretic unified model of the educational concept:
 * Nodes represent entities, states, concepts, rules, constraints, derived values, goals, and observations.
 * Edges represent semantic connections: depends_on, causes, affects, contains, references,
 * transforms_into, satisfies, violates, derived_from, connected_to, compared_with.
 */

import { type AuthoritativeSemanticModel, type AuthoritativeTransformation } from "./authoritative-model";
import { type SemanticState } from "./semantic-world";

export type WorldGraphNodeType =
  | "entity"
  | "state"
  | "concept"
  | "rule"
  | "constraint"
  | "derived_value"
  | "goal"
  | "observation";

export type WorldGraphEdgeType =
  | "depends_on"
  | "causes"
  | "affects"
  | "contains"
  | "references"
  | "transforms_into"
  | "satisfies"
  | "violates"
  | "derived_from"
  | "connected_to"
  | "compared_with";

export interface WorldGraphNode {
  id: string;
  type: WorldGraphNodeType;
  label: string;
  properties?: Record<string, unknown>;
}

export interface WorldGraphEdge {
  id: string;
  source: string;
  target: string;
  type: WorldGraphEdgeType;
  label?: string;
}

export class SemanticWorldGraph {
  public nodes = new Map<string, WorldGraphNode>();
  public edges: WorldGraphEdge[] = [];
  public adjacency = new Map<string, WorldGraphEdge[]>();

  public addNode(node: WorldGraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
  }

  public addEdge(edge: WorldGraphEdge): void {
    this.edges.push(edge);
    const existing = this.adjacency.get(edge.source) || [];
    existing.push(edge);
    this.adjacency.set(edge.source, existing);
  }

  /**
   * Constructs a full SemanticWorldGraph from an AuthoritativeSemanticModel.
   */
  public static fromAuthoritativeModel(model: AuthoritativeSemanticModel): SemanticWorldGraph {
    const graph = new SemanticWorldGraph();

    // 1. Concept Root Node
    graph.addNode({
      id: `concept-${model.problem.id}`,
      type: "concept",
      label: model.problem.objective,
    });

    // 2. Entity Nodes
    for (const ent of model.world.entities) {
      graph.addNode({
        id: ent.id,
        type: "entity",
        label: ent.label,
        properties: { ...ent.properties, role: ent.semanticRole, entityType: ent.type },
      });
      graph.addEdge({
        id: `rel-concept-contains-${ent.id}`,
        source: `concept-${model.problem.id}`,
        target: ent.id,
        type: "contains",
      });
    }

    // 3. Relationships as edges between entities
    for (const rel of model.world.relationships) {
      graph.addEdge({
        id: rel.id,
        source: rel.source,
        target: rel.target,
        type: (rel.type as WorldGraphEdgeType) || "connected_to",
        label: rel.label,
      });
    }

    // 4. Invariant Nodes
    for (const inv of model.invariants) {
      graph.addNode({
        id: inv.id,
        type: "constraint",
        label: inv.statement,
        properties: { severity: inv.severity },
      });
    }

    // 5. Transformations & Causal links
    for (let i = 0; i < model.transformations.length; i++) {
      const t = model.transformations[i];
      const tNodeId = `trans-${t.id}`;
      graph.addNode({
        id: tNodeId,
        type: "observation",
        label: t.title,
        properties: { action: t.action, cause: t.cause, consequence: t.consequence },
      });

      // Connect affected entities
      for (const entId of t.affectedEntities) {
        if (graph.nodes.has(entId)) {
          graph.addEdge({
            id: `edge-affects-${t.id}-${entId}`,
            source: tNodeId,
            target: entId,
            type: "affects",
          });
        }
      }

      // Connect sequence
      if (i > 0) {
        const prevT = model.transformations[i - 1];
        graph.addEdge({
          id: `edge-causes-${prevT.id}-${t.id}`,
          source: `trans-${prevT.id}`,
          target: tNodeId,
          type: "causes",
        });
      }
    }

    return graph;
  }
}

export class WhyEngine {
  /**
   * Traces the causal reasoning chain for why a transformation occurred:
   * Transformation <- reason <- preconditions <- invariant/goal.
   */
  public static traceCausalReasoning(
    transformation: AuthoritativeTransformation,
    model: AuthoritativeSemanticModel,
  ): {
    primaryCause: string;
    preconditionsSatisfied: string[];
    invariantProtected?: string;
    goalAdvanced: string;
    causalChainSummary: string;
  } {
    const inv = model.invariants.find((i) =>
      transformation.invariantEffects?.includes(i.id) ||
      i.statement.toLowerCase().includes(transformation.title.toLowerCase()),
    );

    const primaryCause =
      transformation.cause ||
      transformation.whyChanged ||
      "Required by algorithmic invariant preservation";

    const preconditions =
      transformation.preconditions && transformation.preconditions.length > 0
        ? transformation.preconditions
        : ["Previous step completed validly", "Entity states established"];

    const goalAdvanced = `Advances toward '${model.problem.objective}'`;

    const causalChainSummary = `Because ${primaryCause}, step '${transformation.title}' was executed. This preserves invariant: "${inv?.statement || 'Structural integrity'}" and ${goalAdvanced.toLowerCase()}.`;

    return {
      primaryCause,
      preconditionsSatisfied: preconditions,
      invariantProtected: inv?.statement,
      goalAdvanced,
      causalChainSummary,
    };
  }
}
