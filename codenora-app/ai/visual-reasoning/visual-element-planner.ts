/**
 * Universal Visual Element Planner — Cognora 5.0
 *
 * Chooses the appropriate visual representation and affordances for each semantic entity
 * based on its role, type, evidence priority, and composition plan.
 * Does NOT default everything to generic rectangle boxes.
 */

import { VisualCapabilityRegistry } from "./visual-capability-registry";

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type { Entity } from "../semantic-world";
import type {
  VisualCompositionPlan,
  VisualElementPlan,
  VisualElementPlanItem,
  VisualEvidencePlan,
  VisualPriority,
} from "./visual-reasoning-model";

export class VisualElementPlanner {
  /**
   * Plans the visual representation for all entities in the authoritative model.
   */
  public static plan(
    model: AuthoritativeSemanticModel,
    evidencePlan: VisualEvidencePlan,
    compositionPlan: VisualCompositionPlan,
  ): VisualElementPlan {
    const elements = new Map<string, VisualElementPlanItem>();
    const entities =
      model.world?.entities ||
      (Array.isArray(model.states?.[0]?.entities)
        ? model.states[0].entities
        : Array.from(model.states?.[0]?.entities?.values() || []));

    for (const ent of entities) {
      const evidence = evidencePlan.items.get(ent.id);
      if (evidence && !evidence.shouldRender) {
        continue;
      }

      // Map evidence priority to visual priority
      let priority: VisualPriority = "SECONDARY";
      if (evidence?.priority === "PRIMARY") {
        priority = "PRIMARY";
      } else if (
        evidence?.priority === "CONTEXT" ||
        evidence?.priority === "TEMPORARY"
      ) {
        priority = "TERTIARY";
      }

      // Dynamically resolve visual capability
      const cap = VisualCapabilityRegistry.resolveMatchingCapability(
        ent.semanticRole,
        ent.type,
        ent.label,
      );

      // Sizing rules based on capability and content
      const label = ent.label || ent.id;
      const displayValue =
        typeof ent.value === "string" || typeof ent.value === "number"
          ? ent.value
          : undefined;

      const approxTextWidth = Math.max(60, label.length * 9);
      const width = Math.max(cap.sizing.defaultWidth, approxTextWidth + 24);
      const height = cap.sizing.defaultHeight;

      // Dynamic highlight derivation from semantic state
      let highlight = ent.properties?.highlight as string | undefined;
      if (!highlight) {
        if (ent.state === "failed" || ent.state === "error") {
          highlight = "danger";
        } else if (
          ent.state === "success" ||
          ent.state === "resolved" ||
          ent.state === "established"
        ) {
          highlight = "success";
        } else if (ent.state === "active" || priority === "PRIMARY") {
          highlight = "primary";
        } else if (ent.state === "pending" || ent.state === "decision") {
          highlight = "warning";
        }
      }

      elements.set(ent.id, {
        entityId: ent.id,
        capabilityId: cap.id,
        visualRole: ent.semanticRole || cap.category,
        priority,
        label,
        displayValue,
        state: ent.state,
        shape: cap.shape,
        minDimensions: { width, height },
        containerId: ent.properties?.containerId as string | undefined,
        highlight,
        properties: {
          ...(ent.properties || {}),
          visualCategory: cap.category,
          semanticAffordance: cap.semanticAffordance,
        },
      });
    }

    return { elements };
  }
}
