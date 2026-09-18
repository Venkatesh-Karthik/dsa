/**
 * Universal Spatial Intent Planner — Cognora 5.0
 *
 * Formulates the high-level spatial directives before deterministic coordinate calculation:
 * - Natural reading order (Where to look first -> next -> result).
 * - Visual center and focal anchor.
 * - Semantic ranks (e.g. Rank 0 inputs, Rank 1 processing, Rank 2 outputs).
 * - Grouping containers and cluster boundaries.
 * - Anti-collision spacing and density buffers.
 */

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type {
  ReadingDirection,
  RelationshipPlan,
  SpatialGroup,
  SpatialIntentPlan,
  SpatialRank,
  VisualCompositionPlan,
  VisualElementPlan,
  VisualEvidencePlan,
} from "./visual-reasoning-model";

export class SpatialIntentPlanner {
  /**
   * Plans spatial layout intent based on composition strategy, evidence priority, and graph topology.
   */
  public static plan(
    model: AuthoritativeSemanticModel,
    compositionPlan: VisualCompositionPlan,
    elementPlan: VisualElementPlan,
    relationshipPlan: RelationshipPlan,
    evidencePlan: VisualEvidencePlan,
  ): SpatialIntentPlan {
    const readingDirection = compositionPlan.readingDirection;
    const elements = Array.from(elementPlan.elements.values());

    // 1. Identify Focal / Anchor Entity (Where the learner looks first)
    let focalEntityId = evidencePlan.primaryEntityIds[0];
    if (!focalEntityId && elements.length > 0) {
      focalEntityId = elements[0].entityId;
    }

    // 2. Compute Semantic Ranks (Multi-Rank DAG or Stage Partition)
    const inDegrees = new Map<string, number>();
    for (const el of elements) {
      inDegrees.set(el.entityId, 0);
    }
    for (const rel of relationshipPlan.relationships.values()) {
      if (inDegrees.has(rel.target)) {
        inDegrees.set(rel.target, (inDegrees.get(rel.target) ?? 0) + 1);
      }
    }

    // Topological rank propagation
    const rankMap = new Map<string, number>();
    for (const el of elements) {
      if ((inDegrees.get(el.entityId) ?? 0) === 0) {
        rankMap.set(el.entityId, 0);
      }
    }

    // Propagate ranks forward along relationships
    for (let iter = 0; iter < elements.length; iter++) {
      for (const rel of relationshipPlan.relationships.values()) {
        const srcRank = rankMap.get(rel.source);
        if (srcRank !== undefined && inDegrees.has(rel.target)) {
          const currentTgtRank = rankMap.get(rel.target) ?? 0;
          rankMap.set(rel.target, Math.max(currentTgtRank, srcRank + 1));
        }
      }
    }

    // Fallback for isolated or cycle nodes
    for (const el of elements) {
      if (!rankMap.has(el.entityId)) {
        rankMap.set(el.entityId, 0);
      }
    }

    // Group elements by rank
    const rankBuckets = new Map<number, string[]>();
    for (const [id, r] of rankMap.entries()) {
      const bucket = rankBuckets.get(r) ?? [];
      bucket.push(id);
      rankBuckets.set(r, bucket);
    }

    const sortedRankIndices = Array.from(rankBuckets.keys()).sort(
      (a, b) => a - b,
    );
    const ranks: SpatialRank[] = sortedRankIndices.map((idx) => ({
      rankIndex: idx,
      entityIds: rankBuckets.get(idx) ?? [],
      alignment: "center",
    }));

    // 3. Formulate Semantic Groups (e.g. container groupings)
    const groups: SpatialGroup[] = [];
    const containerGroups = new Map<string, string[]>();
    for (const el of elements) {
      if (el.containerId) {
        const list = containerGroups.get(el.containerId) ?? [];
        list.push(el.entityId);
        containerGroups.set(el.containerId, list);
      }
    }

    for (const [contId, members] of containerGroups.entries()) {
      const containerEl = elementPlan.elements.get(contId);
      groups.push({
        id: contId,
        label: containerEl?.label,
        entityIds: members,
        style: "box",
      });
    }

    // 4. Compute Spacing & Density Buffers (No Overlapping Invariant)
    const entityCount = elements.length;
    let minSpacingX = 50;
    let minSpacingY = 40;

    if (compositionPlan.primaryStrategy === "interaction") {
      minSpacingX = 360; // Wide swimlane spacing between client and server
      minSpacingY = 80;
    } else if (compositionPlan.primaryStrategy === "hierarchical") {
      minSpacingX = 40;
      minSpacingY = 100; // Deep vertical level separation for trees
    } else if (compositionPlan.primaryStrategy === "tabular") {
      minSpacingX = 60;
      minSpacingY = 50;
    } else if (entityCount > 8) {
      minSpacingX = 40;
      minSpacingY = 35;
    }

    return {
      readingDirection,
      focalEntityId,
      ranks,
      groups,
      minSpacingX,
      minSpacingY,
    };
  }
}
