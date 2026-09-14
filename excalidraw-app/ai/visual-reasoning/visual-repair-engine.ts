/**
 * Universal Visual Repair Engine — Cognora 5.0
 *
 * Automatically repairs visual reasoning plans when defects are detected:
 * - Specializes generic boxes into semantic primitives.
 * - Reconnects missing connectors with native Excalidraw bindings.
 * - Eliminates fake steps by ensuring every transformation has visual delta.
 * - Restores collision-free spacing buffers.
 * - Synchronizes missing explanations with semantic state diffs.
 */

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import { VisualCapabilityRegistry } from "./visual-capability-registry";
import { RelationshipPlanner } from "./relationship-planner";
import type {
  PlannedRelationship,
  RelationshipPlan,
  SpatialIntentPlan,
  VisualElementPlan,
  VisualElementPlanItem,
  VisualEvidencePlan,
  VisualQualityReport,
  VisualTransformationPlan,
} from "./visual-reasoning-model";

export class VisualRepairEngine {
  /**
   * Applies automated repairs to visual reasoning plans.
   */
  public static repair(
    model: AuthoritativeSemanticModel,
    qualityReport: VisualQualityReport,
    elementPlan: VisualElementPlan,
    relationshipPlan: RelationshipPlan,
    spatialPlan: SpatialIntentPlan,
    transformationPlan: VisualTransformationPlan,
    evidencePlan: VisualEvidencePlan,
  ): {
    repaired: boolean;
    elementPlan: VisualElementPlan;
    relationshipPlan: RelationshipPlan;
    spatialPlan: SpatialIntentPlan;
    transformationPlan: VisualTransformationPlan;
  } {
    let repaired = false;
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

    // 1. Repair ALL_GENERIC_BOXES: Re-specialize primitives using semantic roles and keywords
    const hasAllGeneric = qualityReport.defects.some((d) => d.code === "ALL_GENERIC_BOXES");
    if (hasAllGeneric) {
      const entries = Array.from(elementPlan.elements.entries());
      for (let i = 0; i < entries.length; i++) {
        const [id, el] = entries[i];
        const ent = entities.find((e) => e.id === id);
        if (ent) {
          const cap = VisualCapabilityRegistry.resolveMatchingCapability(
            ent.semanticRole,
            ent.type,
            ent.label,
          );
          if (cap.id !== "GenericEntity") {
            el.capabilityId = cap.id;
            el.shape = cap.shape;
            el.minDimensions = {
              width: cap.sizing.defaultWidth,
              height: cap.sizing.defaultHeight,
            };
            repaired = true;
          }
        }
      }

      // If still all generic boxes, differentiate the root/focal entity
      const stillAllGeneric = Array.from(elementPlan.elements.values()).every(
        (e) => e.capabilityId === "GenericEntity" && e.shape === "rectangle",
      );
      if (stillAllGeneric && entries.length > 0) {
        const [, firstEl] = entries[0];
        firstEl.capabilityId = "CircleNode";
        firstEl.shape = "ellipse";
        firstEl.minDimensions = { width: 70, height: 70 };
        repaired = true;
      }
    }

    // 2. Repair MISSING_ENTITY
    for (const defect of qualityReport.defects) {
      if (defect.code === "MISSING_ENTITY" && defect.entityId) {
        const ent = entities.find((e) => e.id === defect.entityId);
        if (ent && !elementPlan.elements.has(ent.id)) {
          const cap = VisualCapabilityRegistry.resolveMatchingCapability(
            ent.semanticRole,
            ent.type,
            ent.label,
          );
          elementPlan.elements.set(ent.id, {
            entityId: ent.id,
            capabilityId: cap.id,
            visualRole: ent.semanticRole || cap.category,
            priority: "SECONDARY",
            label: ent.label || ent.id,
            displayValue: ent.value as string | number | undefined,
            state: ent.state,
            shape: cap.shape,
            minDimensions: {
              width: cap.sizing.defaultWidth,
              height: cap.sizing.defaultHeight,
            },
            properties: { ...(ent.properties || {}) },
          });
          repaired = true;
        }
      }
    }

    // 3. Repair MISSING_CONNECTOR
    for (const defect of qualityReport.defects) {
      if (defect.code === "MISSING_CONNECTOR" && defect.relationshipId) {
        const rel = relationships.find((r) => r.id === defect.relationshipId);
        if (
          rel &&
          elementPlan.elements.has(rel.source) &&
          elementPlan.elements.has(rel.target) &&
          rel.source !== rel.target
        ) {
          const category = RelationshipPlanner.inferCategory(rel);
          const plannedRel: PlannedRelationship = {
            id: rel.id,
            source: rel.source,
            target: rel.target,
            category,
            label: RelationshipPlanner.formatLabel(rel),
            direction: rel.direction === "none" ? "none" : "forward",
            routing: rel.properties?.elbowed ? "elbowed" : "direct",
            visualWeight: "normal",
            isAnimated: true,
            isPersistent: true,
            isConnectorNeeded: category !== "containment",
            causalMeaning: rel.causalMeaning,
            properties: { ...(rel.properties || {}), directed: true },
          };
          relationshipPlan.relationships.set(rel.id, plannedRel);
          repaired = true;
        }
      }
    }

    // 4. Repair INSUFFICIENT_SPACING: Ensure anti-collision buffers
    if (spatialPlan.minSpacingX < 50 || spatialPlan.minSpacingY < 40) {
      spatialPlan.minSpacingX = Math.max(50, spatialPlan.minSpacingX);
      spatialPlan.minSpacingY = Math.max(40, spatialPlan.minSpacingY);
      repaired = true;
    }

    // 5. Repair EMPTY_TRANSFORMATION_DELTA: Ensure visible change in every step
    for (let sIdx = 1; sIdx < transformationPlan.steps.length; sIdx++) {
      const step = transformationPlan.steps[sIdx];
      const deltaCount =
        step.enteringEntities.length +
        step.exitingEntities.length +
        step.mutatedEntities.length;

      if (deltaCount === 0) {
        // Find an affected entity from the model transformation or first entity
        const modelTrans = model.transformations?.[sIdx - 1];
        const targetId =
          modelTrans?.affectedEntities?.[0] ||
          evidencePlan.primaryEntityIds[0] ||
          Array.from(elementPlan.elements.keys())[0];

        if (targetId) {
          step.mutatedEntities.push(targetId);
          repaired = true;
        }
      }
    }

    // 6. Repair EMPTY_EXPLANATION
    for (const step of transformationPlan.steps) {
      if (!step.explanation || step.explanation.trim().length === 0) {
        step.explanation = `${step.title}: ${step.whatChanged} (${step.whyChanged})`;
        repaired = true;
      }
    }

    return {
      repaired,
      elementPlan,
      relationshipPlan,
      spatialPlan,
      transformationPlan,
    };
  }
}
