/**
 * Cognora DSA Acceleration Layer - State Transition Integrity Validator
 *
 * Enforces strict mathematical and pedagogical invariants across
 * deterministic algorithm execution before emitting teaching moments.
 */

import type { DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAValidationResult } from "../types/dsa-engine";

export class DSAStateIntegrityValidator {
  /**
   * Validates state continuity, ID stability, relationship integrity,
   * and absence of duplicate non-transformations.
   */
  public static validate(
    states: DSASemanticState[],
    transformations: TeachingTransformation[],
  ): DSAValidationResult {
    const errors: string[] = [];

    // 1. Must contain at least initial state
    if (!states || states.length === 0) {
      errors.push("Validation Failure: Execution produced zero semantic states.");
      return { valid: false, errors };
    }

    // 2. Transformation count must match state transitions (if transformations exist)
    if (transformations.length > 0 && transformations.length !== states.length - 1) {
      errors.push(
        `State Transition Count Mismatch: states=${states.length}, transformations=${transformations.length}. Expected transformations = states - 1.`,
      );
    }

    // 3. Transformation ordering and index continuity
    for (let i = 0; i < transformations.length; i++) {
      const t = transformations[i];
      if (t.beforeStateIndex !== i) {
        errors.push(
          `Transformation #${i} has invalid beforeStateIndex ${t.beforeStateIndex}; expected ${i}.`,
        );
      }
      if (t.afterStateIndex !== i + 1) {
        errors.push(
          `Transformation #${i} has invalid afterStateIndex ${t.afterStateIndex}; expected ${i + 1}.`,
        );
      }
      if (t.stepNumber !== i + 1) {
        errors.push(
          `Transformation #${i} stepNumber is ${t.stepNumber}; expected ${i + 1}.`,
        );
      }
    }

    // 4. Consecutive State Identity Check (Failure 1: No identical consecutive states unless non-state-changing)
    for (let i = 0; i < states.length - 1; i++) {
      const sBefore = states[i];
      const sAfter = states[i + 1];
      const t = transformations[i];

      const isIdentical = this.areStatesIdentical(sBefore, sAfter);
      if (isIdentical && t && t.isStateChange) {
        errors.push(
          `Consecutive Duplicate State: Step ${i + 1} (${t.title}) was marked as state-changing, but beforeState (v${sBefore.version}) and afterState (v${sAfter.version}) are identical.`,
        );
      }
    }

    // 5. Entity ID Stability & Relationship Referencing
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      const entityIds = new Set(state.entities.keys());

      // Relationships must only connect extant entities
      for (const rel of state.relationships) {
        if (!entityIds.has(rel.sourceId)) {
          errors.push(
            `Dangling Relationship in State ${i}: Relationship ${rel.id} sourceId '${rel.sourceId}' does not exist in active entities.`,
          );
        }
        if (!entityIds.has(rel.targetId)) {
          errors.push(
            `Dangling Relationship in State ${i}: Relationship ${rel.id} targetId '${rel.targetId}' does not exist in active entities.`,
          );
        }
      }
    }

    // 6. Conservation of Stable Entities across steps
    for (let i = 0; i < states.length - 1; i++) {
      const sBefore = states[i];
      const sAfter = states[i + 1];
      const t = transformations[i];

      // Check if entities disappeared without being in affected/deleted list
      for (const [id] of sBefore.entities) {
        if (!sAfter.entities.has(id)) {
          const isExpectedRemoval =
            t &&
            (t.type === "DELETE" ||
              t.type === "POP" ||
              t.type === "DEQUEUE" ||
              t.affectedEntityIds.includes(id));
          if (!isExpectedRemoval) {
            errors.push(
              `Accidental Entity Disappearance at step ${i + 1}: Entity '${id}' existed in state ${i} but disappeared in state ${i + 1} without explicit deletion.`,
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static areStatesIdentical(
    a: DSASemanticState,
    b: DSASemanticState,
  ): boolean {
    if (a.entities.size !== b.entities.size) {
      return false;
    }
    if (a.relationships.length !== b.relationships.length) {
      return false;
    }

    for (const [id, entA] of a.entities) {
      const entB = b.entities.get(id);
      if (!entB) {
        return false;
      }
      if (
        entA.value !== entB.value ||
        entA.status !== entB.status ||
        entA.label !== entB.label
      ) {
        return false;
      }
      // Compare custom properties if present
      if (entA.properties || entB.properties) {
        const pA = JSON.stringify(entA.properties || {});
        const pB = JSON.stringify(entB.properties || {});
        if (pA !== pB) {
          return false;
        }
      }
    }

    for (let i = 0; i < a.relationships.length; i++) {
      const rA = a.relationships[i];
      const rB = b.relationships[i];
      if (
        rA.id !== rB.id ||
        rA.sourceId !== rB.sourceId ||
        rA.targetId !== rB.targetId ||
        rA.status !== rB.status ||
        rA.weight !== rB.weight
      ) {
        return false;
      }
    }

    return true;
  }
}
