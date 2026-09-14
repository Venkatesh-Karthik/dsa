/**
 * Universal Visual Evidence Planner — Cognora 5.0
 *
 * Before rendering a lesson, determines:
 * "What does the learner actually need to SEE to understand this explanation?"
 *
 * Classifies all semantic components into:
 * - PRIMARY: Foundational conceptual entities; receive the strongest visual weight.
 * - SUPPORTING: Necessary structure/metadata; remains visible with moderate visual weight.
 * - CONTEXT: Ambient boundaries, environment labels; low visual weight, non-distracting.
 * - TEMPORARY: In-transit packets, ephemeral highlights, active delta indicators.
 * - DERIVED: Computed values (e.g. balance factor, checksum, sum); shown as badges.
 * - REDUNDANT: Duplicate representations, intermediate artifacts that add clutter; suppressed.
 */

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type { Entity, Relationship } from "../semantic-world";
import type {
  InformationPriority,
  VisualEvidenceItem,
  VisualEvidencePlan,
} from "./visual-reasoning-model";

export class VisualEvidencePlanner {
  /**
   * Plans information priority across the authoritative semantic model.
   */
  public static plan(model: AuthoritativeSemanticModel): VisualEvidencePlan {
    const items = new Map<string, VisualEvidenceItem>();
    const primaryEntityIds: string[] = [];
    const supportingEntityIds: string[] = [];
    const contextEntityIds: string[] = [];
    const temporaryEntityIds: string[] = [];
    const redundantEntityIds: string[] = [];

    const entities =
      model.world?.entities ||
      (Array.isArray(model.states?.[0]?.entities)
        ? model.states[0].entities
        : Array.from(model.states?.[0]?.entities?.values() || []));
    const relationships =
      model.world?.relationships ||
      (Array.isArray(model.states?.[0]?.relationships)
        ? model.states[0].relationships
        : Array.from(model.states?.[0]?.relationships?.values() || []));
    const transformations = model.transformations || [];

    // Track which entities are actively mutated across transformations
    const affectedEntitySet = new Set<string>();
    for (const t of transformations) {
      for (const aff of (t.affectedEntities || [])) {
        affectedEntitySet.add(aff);
      }
    }

    // Set of IDs that represent actions/operations disguised as entities
    const actionLikeEntityIds = new Set<string>();
    for (const e of entities) {
      const labelLower = (e.label || e.id).toLowerCase();
      const typeLower = (e.type || "").toLowerCase();
      const roleLower = (e.semanticRole || "").toLowerCase();

      // Action verbs or operation nouns (e.g. "debit", "credit", "commit", "rollback", "read", "write")
      if (
        /\b(debit|credit|commit|rollback|send|receive|read|write|rotate|swap|insert|delete)\b/i.test(
          labelLower,
        ) ||
        /\b(operation|action|transition|step)\b/i.test(typeLower) ||
        roleLower === "action" ||
        roleLower === "operation"
      ) {
        actionLikeEntityIds.add(e.id);
      }
    }

    // Classify Entities
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      const isAction = actionLikeEntityIds.has(ent.id);
      const isMutated = affectedEntitySet.has(ent.id);
      const isRoot = ent.semanticRole === "root" || i === 0;

      let priority: InformationPriority = "SUPPORTING";
      let reason = "Supporting conceptual element";
      let visualWeight: "heavy" | "medium" | "light" | "hidden" = "medium";
      let shouldRender = true;

      if (isAction) {
        // Actions/operations shouldn't be rendered as permanent boxes!
        priority = "TEMPORARY";
        reason =
          "Represents an operation or state transition; should appear as a temporary flow/badge during transformation.";
        visualWeight = "hidden";
        shouldRender = false;
        temporaryEntityIds.push(ent.id);
      } else if (isRoot || isMutated || ent.type === "Table" || ent.type === "TreeNode") {
        priority = "PRIMARY";
        reason = "Core stateful entity directly conveying the concept mechanism.";
        visualWeight = "heavy";
        primaryEntityIds.push(ent.id);
      } else if (
        ent.type === "Annotation" ||
        ent.semanticRole === "annotation" ||
        ent.semanticRole === "context"
      ) {
        priority = "CONTEXT";
        reason = "Ambient contextual annotation or boundary.";
        visualWeight = "light";
        contextEntityIds.push(ent.id);
      } else if (ent.properties?.isRedundant || ent.properties?.isAliasOf) {
        priority = "REDUNDANT";
        reason = "Duplicate or alias representation; suppressed to avoid canvas clutter.";
        visualWeight = "hidden";
        shouldRender = false;
        redundantEntityIds.push(ent.id);
      } else {
        priority = "SUPPORTING";
        reason = "Provides structural context to the primary entities.";
        visualWeight = "medium";
        supportingEntityIds.push(ent.id);
      }

      items.set(ent.id, {
        id: ent.id,
        kind: "entity",
        priority,
        reason,
        shouldRender,
        visualWeight,
      });
    }

    // If no entity was classified as PRIMARY, promote the first two supporting entities
    if (primaryEntityIds.length === 0 && supportingEntityIds.length > 0) {
      const toPromote = supportingEntityIds.splice(0, Math.min(2, supportingEntityIds.length));
      for (const id of toPromote) {
        primaryEntityIds.push(id);
        const item = items.get(id);
        if (item) {
          item.priority = "PRIMARY";
          item.visualWeight = "heavy";
          item.reason = "Promoted to primary focal entity.";
        }
      }
    }

    // Classify Relationships
    for (const rel of relationships) {
      const sourceItem = items.get(rel.source);
      const targetItem = items.get(rel.target);

      const isBothPrimary =
        sourceItem?.priority === "PRIMARY" && targetItem?.priority === "PRIMARY";
      const isActionFlow =
        actionLikeEntityIds.has(rel.source) || actionLikeEntityIds.has(rel.target);

      let priority: InformationPriority = "SUPPORTING";
      let reason = "Structural relationship between entities.";
      let visualWeight: "heavy" | "medium" | "light" | "hidden" = "medium";
      let shouldRender = true;

      if (isBothPrimary) {
        priority = "PRIMARY";
        reason = "Critical connection between primary entities.";
        visualWeight = "heavy";
      } else if (isActionFlow) {
        priority = "TEMPORARY";
        reason = "Flow of operation or message across entities.";
        visualWeight = "medium";
      } else if (
        sourceItem?.priority === "REDUNDANT" ||
        targetItem?.priority === "REDUNDANT"
      ) {
        priority = "REDUNDANT";
        reason = "Connects redundant entity; suppressed.";
        visualWeight = "hidden";
        shouldRender = false;
      }

      items.set(rel.id, {
        id: rel.id,
        kind: "relationship",
        priority,
        reason,
        shouldRender,
        visualWeight,
      });
    }

    return {
      items,
      primaryEntityIds,
      supportingEntityIds,
      contextEntityIds,
      temporaryEntityIds,
      redundantEntityIds,
    };
  }
}
