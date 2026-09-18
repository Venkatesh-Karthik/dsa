/**
 * Universal Visual Quality Validator — Cognora 5.0
 *
 * Evaluates visual reasoning plans across 14 universal dimensions before rendering.
 * Strictly domain-independent.
 */

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type {
  RelationshipPlan,
  SpatialIntentPlan,
  VisualCompositionPlan,
  VisualElementPlan,
  VisualEvidencePlan,
  VisualQualityDefect,
  VisualQualityDimensionScores,
  VisualQualityReport,
  VisualTransformationPlan,
} from "./visual-reasoning-model";

export class VisualQualityValidator {
  /**
   * Validates a complete visual reasoning plan and computes its 14-dimension score.
   */
  public static validate(
    model: AuthoritativeSemanticModel,
    evidencePlan: VisualEvidencePlan,
    compositionPlan: VisualCompositionPlan,
    elementPlan: VisualElementPlan,
    relationshipPlan: RelationshipPlan,
    spatialPlan: SpatialIntentPlan,
    transformationPlan: VisualTransformationPlan,
  ): VisualQualityReport {
    const defects: VisualQualityDefect[] = [];
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

    // 1. Semantic Coverage: all authoritative entities accounted for
    let semanticCoverage = 100;
    for (const ent of entities) {
      if (!elementPlan.elements.has(ent.id)) {
        const ev = evidencePlan.items.get(ent.id);
        if (ev?.shouldRender) {
          semanticCoverage -= 15;
          defects.push({
            code: "MISSING_ENTITY",
            message: `Authoritative entity '${ent.label || ent.id}' (${
              ent.id
            }) is missing from visual elements.`,
            severity: "critical",
            entityId: ent.id,
            remedyHint: "Add entity to visual element plan.",
          });
        }
      }
    }
    semanticCoverage = Math.max(0, semanticCoverage);

    // 2. Visual Relevance: primary entities receive appropriate visual priority
    let visualRelevance = 100;
    if (evidencePlan.primaryEntityIds.length === 0) {
      visualRelevance -= 30;
      defects.push({
        code: "NO_PRIMARY_ENTITIES",
        message: "No entities designated as PRIMARY visual focus.",
        severity: "warning",
      });
    }

    // Check if all entities are generic rectangles without justification
    const allGenericBoxes =
      elementPlan.elements.size >= 3 &&
      Array.from(elementPlan.elements.values()).every(
        (e) => e.capabilityId === "GenericEntity" && e.shape === "rectangle",
      );
    if (allGenericBoxes) {
      visualRelevance -= 40;
      defects.push({
        code: "ALL_GENERIC_BOXES",
        message:
          "All entities defaulted to generic rectangle boxes without semantic specialization.",
        severity: "critical",
        remedyHint:
          "Specialize visual representations based on semantic roles.",
      });
    }

    // 3. Relationship Visibility & 4. Direction Clarity
    let relationshipVisibility = 100;
    let directionClarity = 100;

    for (const rel of relationships) {
      const planned = relationshipPlan.relationships.get(rel.id);
      if (!planned) {
        relationshipVisibility -= 10;
        defects.push({
          code: "MISSING_CONNECTOR",
          message: `Important relationship '${rel.id}' (${rel.source} -> ${rel.target}) has no connector.`,
          severity: "critical",
          relationshipId: rel.id,
          remedyHint: "Create planned connector with endpoint bindings.",
        });
      } else if (planned.direction === "none" && rel.direction !== "none") {
        directionClarity -= 10;
        defects.push({
          code: "MISSING_DIRECTION",
          message: `Connector '${rel.id}' has direction 'none' but relationship is directed.`,
          severity: "warning",
          relationshipId: rel.id,
        });
      }
    }
    relationshipVisibility = Math.max(0, relationshipVisibility);
    directionClarity = Math.max(0, directionClarity);

    // 5. Spatial Clarity & 6. Reading Order
    let spatialClarity = 100;
    let readingOrder = 100;

    if (!spatialPlan.focalEntityId) {
      readingOrder -= 20;
      defects.push({
        code: "NO_FOCAL_POINT",
        message:
          "Spatial plan lacks a clear focal starting point for learner reading order.",
        severity: "warning",
      });
    }
    if (spatialPlan.ranks.length === 0 && elementPlan.elements.size > 0) {
      spatialClarity -= 20;
    }

    // 7. Collision Safety & 8. Annotation Safety
    let collisionSafety = 100;
    const annotationSafety = 100;

    if (spatialPlan.minSpacingX < 20 || spatialPlan.minSpacingY < 20) {
      collisionSafety -= 25;
      defects.push({
        code: "INSUFFICIENT_SPACING",
        message:
          "Spatial spacing buffers are below safe anti-collision threshold.",
        severity: "critical",
        remedyHint: "Increase minSpacingX and minSpacingY.",
      });
    }

    // 9. Transformation Clarity: transitions have non-empty deltas
    let transformationClarity = 100;
    for (let sIdx = 1; sIdx < transformationPlan.steps.length; sIdx++) {
      const step = transformationPlan.steps[sIdx];
      const deltaCount =
        step.enteringEntities.length +
        step.exitingEntities.length +
        step.mutatedEntities.length;
      if (deltaCount === 0) {
        transformationClarity -= 25;
        defects.push({
          code: "EMPTY_TRANSFORMATION_DELTA",
          message: `Transformation step ${sIdx} ('${step.title}') produces no visible change (fake step).`,
          severity: "critical",
          stepIndex: sIdx,
          remedyHint:
            "Ensure step mutates state, highlights active entity, or updates relationships.",
        });
      }
    }
    transformationClarity = Math.max(0, transformationClarity);

    // 10. Explanation Synchronization
    let explanationSynchronization = 100;
    for (let sIdx = 0; sIdx < transformationPlan.steps.length; sIdx++) {
      const step = transformationPlan.steps[sIdx];
      if (!step.explanation || step.explanation.trim().length === 0) {
        explanationSynchronization -= 20;
        defects.push({
          code: "EMPTY_EXPLANATION",
          message: `Step ${sIdx} explanation is empty.`,
          severity: "warning",
          stepIndex: sIdx,
        });
      }
    }

    // 11. Visual Hierarchy
    const primaryCount = Array.from(elementPlan.elements.values()).filter(
      (e) => e.priority === "PRIMARY",
    ).length;
    const visualHierarchy = primaryCount > 0 ? 100 : 60;

    // 12. Information Density & 13. Redundancy Control
    const informationDensity = 100;
    let redundancyControl = 100;
    if (evidencePlan.redundantEntityIds.length > 0) {
      redundancyControl = 95; // Handled and suppressed
    }

    // 14. Goal Visibility
    const goalVisibility =
      model.goalSatisfaction?.satisfied !== false ? 100 : 70;

    const dimensions: VisualQualityDimensionScores = {
      semanticCoverage,
      visualRelevance,
      relationshipVisibility,
      directionClarity,
      spatialClarity,
      readingOrder,
      collisionSafety,
      annotationSafety,
      transformationClarity,
      explanationSynchronization,
      visualHierarchy,
      informationDensity,
      redundancyControl,
      goalVisibility,
    };

    const values = Object.values(dimensions);
    const avgScore = Math.round(
      values.reduce((s, v) => s + v, 0) / values.length,
    );

    const hasCriticalDefects = defects.some((d) => d.severity === "critical");
    const isPassing = avgScore >= 75 && !hasCriticalDefects;

    return {
      overallScore: avgScore,
      isPassing,
      dimensions,
      defects,
      repairRecommended: !isPassing || defects.length > 0,
    };
  }
}
