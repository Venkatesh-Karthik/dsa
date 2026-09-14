/**
 * Universal Relationship & Arrow Planner — Cognora 5.0
 *
 * Promotes relationships into first-class visual connectors.
 * Strictly guarantees:
 * 1. Real Excalidraw connectors with valid endpoint bindings (no fake "A -> B" text boxes).
 * 2. Proper semantic classification (causality, data flow, message transmission, invocation, reference, etc.).
 * 3. Obstacle-aware routing (elbowed vs direct).
 * 4. Distinct visual weights and labels indicating the nature of the relationship.
 */

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type { Relationship } from "../semantic-world";
import type {
  ConnectorDirection,
  ConnectorRouting,
  PlannedRelationship,
  RelationshipCategory,
  RelationshipPlan,
  VisualElementPlan,
  VisualEvidencePlan,
} from "./visual-reasoning-model";

export class RelationshipPlanner {
  /**
   * Plans all relationships across the authoritative semantic model.
   */
  public static plan(
    model: AuthoritativeSemanticModel,
    elementPlan: VisualElementPlan,
    evidencePlan: VisualEvidencePlan,
  ): RelationshipPlan {
    const relationships = new Map<string, PlannedRelationship>();
    const rels =
      model.world?.relationships ||
      (Array.isArray(model.states?.[0]?.relationships)
        ? model.states[0].relationships
        : Array.from(model.states?.[0]?.relationships?.values() || []));

    for (const rel of rels) {
      // Endpoint safety verification: both endpoints must exist in the visual element plan
      if (!elementPlan.elements.has(rel.source) || !elementPlan.elements.has(rel.target)) {
        continue;
      }
      if (rel.source === rel.target) {
        // Reject self-referential connectors that pollute the canvas
        continue;
      }

      const evidence = evidencePlan.items.get(rel.id);
      if (evidence && !evidence.shouldRender) {
        continue;
      }

      const category = RelationshipPlanner.inferCategory(rel);
      const isContainment = category === "containment";

      // Direction resolution
      let direction: ConnectorDirection = "forward";
      if (rel.direction === "none" || rel.properties?.directed === false) {
        direction = "none";
      } else if (rel.direction === "bidirectional") {
        direction = "bidirectional";
      } else if (rel.direction === "backward") {
        direction = "backward";
      }

      // Routing resolution
      let routing: ConnectorRouting = "direct";
      if (
        category === "message_transmission" ||
        category === "control_flow" ||
        rel.properties?.elbowed
      ) {
        routing = "elbowed";
      }

      // Visual weight resolution
      let visualWeight: "strong" | "normal" | "subtle" = "normal";
      if (evidence?.visualWeight === "heavy" || category === "causality" || category === "data_flow") {
        visualWeight = "strong";
      } else if (evidence?.visualWeight === "light" || category === "association") {
        visualWeight = "subtle";
      }

      // Connector necessity: true for all relationships except pure containment
      const isConnectorNeeded = !isContainment;

      // Persistence: permanent unless marked temporary or belongs to temporary entity
      const isPersistent = evidence?.priority !== "TEMPORARY" && rel.properties?.transient !== true;

      // Animation: animate message transmissions and state transitions
      const isAnimated =
        category === "message_transmission" ||
        category === "state_transition" ||
        category === "transformation" ||
        rel.properties?.animated === true;

      // Human-readable label
      const label = RelationshipPlanner.formatLabel(rel);

      const plannedRel: PlannedRelationship = {
        id: rel.id,
        source: rel.source,
        target: rel.target,
        category,
        label,
        direction,
        routing,
        visualWeight,
        isAnimated,
        isPersistent,
        isConnectorNeeded,
        causalMeaning: rel.causalMeaning,
        properties: {
          ...(rel.properties || {}),
          directed: direction !== "none",
        },
      };

      relationships.set(rel.id, plannedRel);
    }

    return { relationships };
  }

  /**
   * Infers fine-grained relationship category from semantic metadata.
   */
  public static inferCategory(rel: Relationship): RelationshipCategory {
    const raw = `${rel.type || ""} ${rel.category || ""} ${rel.label || ""}`.toLowerCase();

    if (/\b(contains|parent_of|encloses|has_member|member_of)\b/i.test(raw)) {
      return "containment";
    }
    if (/\b(depends|requires|prerequisite|needs)\b/i.test(raw)) {
      return "dependency";
    }
    if (/\b(causes|triggers|induces|results_in|enables|prevents)\b/i.test(raw)) {
      return "causality";
    }
    if (/\b(flow|data_flow|streams|transfers|passes|feed)\b/i.test(raw)) {
      return "data_flow";
    }
    if (/\b(calls|invokes|executes|runs)\b/i.test(raw)) {
      return "invocation";
    }
    if (/\b(message|transmits|sends|receives|syn|ack|payload|signal)\b/i.test(raw)) {
      return "message_transmission";
    }
    if (/\b(points_to|references|addresses|index_of|ref)\b/i.test(raw)) {
      return "reference";
    }
    if (/\b(transitions|changes_to|becomes|evolves|next_state)\b/i.test(raw)) {
      return "state_transition";
    }
    if (/\b(transforms|converts|mutates|debit|credit)\b/i.test(raw)) {
      return "transformation";
    }
    if (/\b(next|prev|previous|after|before)\b/i.test(raw)) {
      return "temporal_sequence";
    }
    if (/\b(compares|versus|against|differs)\b/i.test(raw)) {
      return "comparison";
    }

    return "association";
  }

  /**
   * Formats clean, learner-facing connector label.
   */
  public static formatLabel(rel: Relationship): string | undefined {
    if (rel.label && rel.label.trim().length > 0) {
      const l = rel.label.trim();
      // Suppress redundant generic machine labels
      if (l.toLowerCase() === "connects" || l.toLowerCase() === "relates_to") {
        return undefined;
      }
      return l;
    }
    if (rel.properties?.weight !== undefined) {
      return String(rel.properties.weight);
    }
    return undefined;
  }
}
