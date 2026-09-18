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
      for (const aff of t.affectedEntities || []) {
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

      // An entity is only suppressed as a transient action if it:
      // 1. Has an action-verb label AND
      // 2. Has no structural/persistent type that indicates it is a real canvas entity AND
      // 3. Has no persistent properties (columns, rows, values, state, etc.)
      const hasPersistentType =
        ent.type === "Table" ||
        ent.type === "Record" ||
        ent.type === "MemoryBlock" ||
        ent.type === "StackFrame" ||
        ent.type === "Packet" ||
        ent.type === "MessagePacket" ||
        ent.type === "TreeNode" ||
        ent.type === "ArrayCell" ||
        ent.type === "LinkedListNode";
      const hasPersistentProperties =
        ent.properties &&
        (ent.properties.columns !== undefined ||
          ent.properties.rows !== undefined ||
          ent.properties.values !== undefined ||
          ent.properties.state !== undefined ||
          ent.properties.capacity !== undefined);
      const isTrulyTransient =
        isAction && !hasPersistentType && !hasPersistentProperties;

      let priority: InformationPriority = "SUPPORTING";
      let reason = "Supporting conceptual element";
      let visualWeight: "heavy" | "medium" | "light" | "hidden" = "medium";
      let shouldRender = true;

      if (isTrulyTransient) {
        // Pure transient action/operation: suppress the box but keep as metadata
        priority = "TEMPORARY";
        reason =
          "Pure transient operation; should appear as a temporary flow indicator, not a permanent box.";
        visualWeight = "hidden";
        shouldRender = false;
        temporaryEntityIds.push(ent.id);
      } else if (
        isRoot ||
        isMutated ||
        ent.type === "Table" ||
        ent.type === "TreeNode"
      ) {
        priority = "PRIMARY";
        reason =
          "Core stateful entity directly conveying the concept mechanism.";
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
        reason =
          "Duplicate or alias representation; suppressed to avoid canvas clutter.";
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
      const toPromote = supportingEntityIds.splice(
        0,
        Math.min(2, supportingEntityIds.length),
      );
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
        sourceItem?.priority === "PRIMARY" &&
        targetItem?.priority === "PRIMARY";
      const isActionFlow =
        actionLikeEntityIds.has(rel.source) ||
        actionLikeEntityIds.has(rel.target);

      let priority: InformationPriority = "SUPPORTING";
      let reason = "Structural relationship between entities.";
      let visualWeight: "heavy" | "medium" | "light" | "hidden" = "medium";
      // Relationships involving suppressed entities are kept rendered to preserve connector chains.
      // A relationship is only suppressed if BOTH endpoints are redundant (not just one).
      let shouldRender = true;

      if (isBothPrimary) {
        priority = "PRIMARY";
        reason = "Critical connection between primary entities.";
        visualWeight = "heavy";
      } else if (isActionFlow) {
        priority = "TEMPORARY";
        reason = "Flow of operation or message across entities.";
        visualWeight = "medium";
        // Keep shouldRender=true: even transient flows need a visible connector
      } else if (
        sourceItem?.priority === "REDUNDANT" &&
        targetItem?.priority === "REDUNDANT"
      ) {
        // Only suppress when BOTH endpoints are redundant (e.g. alias pairs)
        priority = "REDUNDANT";
        reason = "Connects two redundant entities; suppressed.";
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
