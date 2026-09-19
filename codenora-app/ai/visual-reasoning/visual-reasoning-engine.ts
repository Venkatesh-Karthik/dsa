/**
 * Universal Visual Reasoning Engine — Cognora 5.0
 *
 * Master coordinator orchestrating the full visual reasoning pipeline:
 * Semantic World
 *       ↓
 * Teaching Objective
 *       ↓
 * Learner Information Priority (Visual Evidence Planning)
 *       ↓
 * Visual Composition Selection (Composition Planning)
 *       ↓
 * Visual Element Selection (Element Planning)
 *       ↓
 * Relationship / Connector Planning (Relationship & Arrow Planning)
 *       ↓
 * Spatial Hierarchy & Intent Planning (Spatial Intent Planning)
 *       ↓
 * Transformation Visual Planning (Transformation Planning)
 *       ↓
 * Visual Quality Validation & Auto-Repair
 *       ↓
 * Scene Graph & Layout Compilation
 *       ↓
 * Excalidraw Scene Reconciler
 */

import { type SceneGraph, createEmptySceneGraph } from "../scene-graph";

import { VisualCapabilityRegistry } from "./visual-capability-registry";
import { VisualEvidencePlanner } from "./visual-evidence-planner";
import { VisualCompositionPlanner } from "./visual-composition-planner";
import { VisualElementPlanner } from "./visual-element-planner";
import { RelationshipPlanner } from "./relationship-planner";
import { SpatialIntentPlanner } from "./spatial-intent-planner";
import { VisualTransformationPlanner } from "./visual-transformation-planner";
import { VisualQualityValidator } from "./visual-quality-validator";
import { VisualRepairEngine } from "./visual-repair-engine";

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type {
  PlannedRelationship,
  VisualQualityReport,
  VisualReasoningPlan,
} from "./visual-reasoning-model";

export class VisualReasoningEngine {
  /**
   * Plans the complete visual reasoning pipeline for an authoritative semantic model.
   */
  public static plan(
    model: AuthoritativeSemanticModel,
    options?: { prompt?: string },
  ): VisualReasoningPlan {
    const concept =
      (model.problem as any)?.concept ||
      model.problem?.question ||
      options?.prompt ||
      "Concept";
    const teachingObjective = model.problem.objective || concept;
    const intent = model.problem.intent || "EXPLAIN";

    // 1. Visual Evidence Planning
    const evidencePlan = VisualEvidencePlanner.plan(model);

    // 2. Visual Composition Planning
    const compositionPlan = VisualCompositionPlanner.plan(model, evidencePlan);

    // 3. Visual Element Planning
    let elementPlan = VisualElementPlanner.plan(
      model,
      evidencePlan,
      compositionPlan,
    );

    // 4. Relationship & Arrow Planning
    let relationshipPlan = RelationshipPlanner.plan(
      model,
      elementPlan,
      evidencePlan,
    );

    // 5. Spatial Intent Planning
    let spatialIntentPlan = SpatialIntentPlanner.plan(
      model,
      compositionPlan,
      elementPlan,
      relationshipPlan,
      evidencePlan,
    );

    // 6. Visual Transformation Planning
    let transformationPlan = VisualTransformationPlanner.plan(
      model,
      elementPlan,
      relationshipPlan,
    );

    // 7. Visual Quality Validation
    let qualityReport = VisualQualityValidator.validate(
      model,
      evidencePlan,
      compositionPlan,
      elementPlan,
      relationshipPlan,
      spatialIntentPlan,
      transformationPlan,
    );

    // 8. Automatic Repair if needed
    if (qualityReport.repairRecommended) {
      const repaired = VisualRepairEngine.repair(
        model,
        qualityReport,
        elementPlan,
        relationshipPlan,
        spatialIntentPlan,
        transformationPlan,
        evidencePlan,
      );

      elementPlan = repaired.elementPlan;
      relationshipPlan = repaired.relationshipPlan;
      spatialIntentPlan = repaired.spatialPlan;
      transformationPlan = repaired.transformationPlan;

      // Re-validate after repair
      qualityReport = VisualQualityValidator.validate(
        model,
        evidencePlan,
        compositionPlan,
        elementPlan,
        relationshipPlan,
        spatialIntentPlan,
        transformationPlan,
      );
    }

    return {
      id: `vrp-${model.id}`,
      concept,
      teachingObjective,
      intent,
      evidencePlan,
      compositionPlan,
      elementPlan,
      relationshipPlan,
      spatialIntentPlan,
      transformationPlan,
      qualityReport,
      timestamp: Date.now(),
    };
  }

  /**
   * Compiles an authoritative SceneGraph for a specific state index using the visual reasoning plan.
   */
  public static compileSceneGraphForState(
    model: AuthoritativeSemanticModel,
    plan: VisualReasoningPlan,
    stateIndex: number,
  ): SceneGraph {
    const semState = model.states[stateIndex] || model.states[0];
    const trans =
      stateIndex > 0 ? model.transformations[stateIndex - 1] : undefined;

    let stateRootId: string | undefined = semState.properties?.rootEntityId as
      | string
      | undefined;
    if (!stateRootId) {
      for (const ent of semState.entities.values()) {
        if (ent.semanticRole === "root") {
          stateRootId = ent.id;
          break;
        }
      }
    }

    const layoutStrat =
      plan.compositionPlan.primaryStrategy === "hierarchical"
        ? "tree"
        : plan.compositionPlan.primaryStrategy;

    const graph = createEmptySceneGraph({
      title: semState.name || model.problem.objective,
      conceptType: plan.compositionPlan.primaryStrategy,
      layoutStrategy: layoutStrat as any,
      readingDirection: plan.spatialIntentPlan.readingDirection,
      stepIndex: stateIndex,
      totalSteps: model.states.length,
      focalEntityId: plan.spatialIntentPlan.focalEntityId,
      rootEntityId: stateRootId,
    });

    // 1. Populate Entities for this state from elementPlan or dynamic fallback
    for (const [id, semEnt] of semState.entities.entries()) {
      let plannedEl = plan.elementPlan.elements.get(id);
      if (!plannedEl) {
        const cap = VisualCapabilityRegistry.resolveMatchingCapability(
          semEnt.semanticRole,
          semEnt.type,
          semEnt.label,
        );
        plannedEl = {
          entityId: id,
          capabilityId: cap.id,
          visualRole: semEnt.semanticRole || cap.category,
          priority: "SECONDARY",
          label: semEnt.label || id,
          displayValue:
            typeof semEnt.value === "string" || typeof semEnt.value === "number"
              ? semEnt.value
              : undefined,
          state: semEnt.state,
          shape: cap.shape,
          minDimensions: {
            width: cap.sizing.defaultWidth,
            height: cap.sizing.defaultHeight,
          },
          containerId: semEnt.properties?.containerId as string | undefined,
          highlight: semEnt.properties?.highlight as string | undefined,
          properties: {
            ...(semEnt.properties || {}),
            visualCategory: cap.category,
          },
        };
      }

      // Dynamic highlight derivation
      let effectiveHighlight = plannedEl.highlight;
      if (semEnt.properties?.highlight) {
        effectiveHighlight = String(semEnt.properties.highlight);
      } else if (trans?.affectedEntities?.includes(id)) {
        effectiveHighlight = "primary";
      } else if (
        semEnt.state === "failed" ||
        semState.stateType === "failure"
      ) {
        effectiveHighlight = "failure";
      } else if (
        semEnt.state === "recovered" ||
        semEnt.state === "rolled_back" ||
        semState.stateType === "recovery"
      ) {
        effectiveHighlight = "recovery";
      }
      const mappedShape =
        plannedEl.shape === "diamond"
          ? "diamond"
          : plannedEl.shape === "ellipse"
          ? "ellipse"
          : "rectangle";

      graph.entities.set(id, {
        id,
        primitiveType: plannedEl.capabilityId,
        semanticRole: plannedEl.visualRole,
        label: semEnt.label || plannedEl.label,
        value: semEnt.value ?? semEnt.label ?? plannedEl.displayValue,
        state:
          semEnt.state ||
          (semEnt.properties?.state as string | undefined) ||
          plannedEl.state,
        properties: {
          ...plannedEl.properties,
          ...(semEnt.properties || {}),
          highlight: effectiveHighlight,
          shape: mappedShape,
          priority: plannedEl.priority,
          containerId: plannedEl.containerId,
        },
      });
    }

    // 2. Populate Relationships for this state from relationshipPlan or dynamic fallback
    for (const [id, semRel] of semState.relationships.entries()) {
      const plannedRel: PlannedRelationship =
        plan.relationshipPlan.relationships.get(id) || {
          id,
          source: semRel.source,
          target: semRel.target,
          category: RelationshipPlanner.inferCategory(semRel),
          direction:
            semRel.direction === "none" || semRel.properties?.directed === false
              ? "none"
              : "forward",
          routing: semRel.properties?.elbowed ? "elbowed" : "direct",
          visualWeight: "normal",
          isConnectorNeeded: true,
          isPersistent: true,
          isAnimated: false,
          label: RelationshipPlanner.formatLabel(semRel),
          properties: {},
        };

      if (!plannedRel.isConnectorNeeded) {
        continue;
      }

      // Only add if both endpoints are in the current state's graph
      if (
        !graph.entities.has(plannedRel.source) ||
        !graph.entities.has(plannedRel.target)
      ) {
        continue;
      }

      let relHighlight: string | undefined = semRel.properties?.highlight as
        | string
        | undefined;
      if (!relHighlight && plannedRel.isAnimated) {
        relHighlight = "active";
      }

      const effectiveType =
        (plannedRel.properties?.originalType as string) ||
        semRel.type ||
        plannedRel.category;

      graph.relationships.set(id, {
        id,
        sourceEntityId: plannedRel.source,
        targetEntityId: plannedRel.target,
        type: effectiveType,
        label: plannedRel.label,
        properties: {
          directed: plannedRel.direction !== "none",
          routing: plannedRel.routing,
          elbowed: plannedRel.routing === "elbowed",
          visualWeight: plannedRel.visualWeight,
          highlight: relHighlight,
          color: (semRel.properties?.color as string | undefined) || undefined,
          originalType: effectiveType,
          branch: plannedRel.properties?.branch,
          ...(semRel.properties || {}),
        },
      });
    }

    // 3. Attach Contextual Annotations / Badges if relevant
    if (semState.activeDecision) {
      graph.annotations.set(`ann-dec-${stateIndex}`, {
        id: `ann-dec-${stateIndex}`,
        type: "badge",
        text: `Decision: ${semState.activeDecision.condition}`,
        placement: "above",
        color: "#9333ea",
      });
    }

    return graph;
  }
}
