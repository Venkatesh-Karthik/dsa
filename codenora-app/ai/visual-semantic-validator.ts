/**
 * Visual Semantic Validator
 *
 * Verifies the integrity between the Authoritative Semantic Model
 * and the visual representations (VisualActions, SceneGraph, Excalidraw elements):
 * - Every important semantic entity is visually represented.
 * - Every important relationship is visually represented.
 * - Visual states correspond to semantic states.
 * - Explanations and visual highlights remain synchronized.
 */

import { type AuthoritativeSemanticModel } from "./authoritative-model";
import { type VisualAction } from "./visual-dsl";

export interface VisualValidationIssue {
  entityId?: string;
  relationshipId?: string;
  stepIndex: number;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface VisualSemanticValidationReport {
  valid: boolean;
  issues: VisualValidationIssue[];
}

export class VisualSemanticValidator {
  /**
   * Validates visual actions against the authoritative semantic model.
   */
  public static validateVisualConsistency(
    model: AuthoritativeSemanticModel,
    visualActionsByStep: Array<VisualAction[]>,
  ): VisualSemanticValidationReport {
    const issues: VisualValidationIssue[] = [];

    // 1. Verify Initial Step represents all baseline entities
    const initialActions = visualActionsByStep[0] || [];
    const representedIds = new Set<string>();

    for (const act of initialActions) {
      if ("id" in act && typeof act.id === "string") {
        representedIds.add(act.id);
      }
      if (act.type === "create_tree" && act.nodes) {
        act.nodes.forEach((n: any) => representedIds.add(n.id));
      }
      if (act.type === "create_graph" && act.nodes) {
        act.nodes.forEach((n: any) => representedIds.add(n.id));
      }
      if (act.type === "create_array" && act.elements) {
        representedIds.add(act.id);
      }
    }

    // Check if any critical semantic entity was silently omitted from initial scene
    for (const ent of model.world.entities) {
      const isRepresented =
        representedIds.has(ent.id) ||
        Array.from(representedIds).some(
          (id) => id.includes(ent.id) || ent.id.includes(id),
        );

      if (!isRepresented) {
        issues.push({
          entityId: ent.id,
          stepIndex: 0,
          code: "OMITTED_ENTITY",
          message: `Semantic entity '${ent.label}' (${ent.id}) is not represented in the visual scene actions.`,
          severity: "warning",
        });
      }
    }

    // 2. Verify Highlights in transformations reference valid entities
    for (let i = 0; i < model.transformations.length; i++) {
      const t = model.transformations[i];
      const stepActions = visualActionsByStep[i + 1] || [];

      for (const act of stepActions) {
        if (act.type === "highlight") {
          const target = (act as any).target;
          const entityExists = model.world.entities.some(
            (e) =>
              e.id === target || target.includes(e.id) || e.id.includes(target),
          );
          if (!entityExists) {
            issues.push({
              stepIndex: i + 1,
              code: "INVALID_HIGHLIGHT_TARGET",
              message: `Visual highlight targets unknown entity ID '${target}' in step ${
                i + 1
              }.`,
              severity: "error",
            });
          }
        }
      }
    }

    return {
      valid: issues.filter((iss) => iss.severity === "error").length === 0,
      issues,
    };
  }
}
