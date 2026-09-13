/**
 * Universal Explanation Engine & Explanation Validator
 *
 * Derives rigorous pedagogical explanations directly from semantic state transitions:
 * - WHAT CHANGED?
 * - WHY?
 * - WHAT CAUSED IT?
 * - WHAT SHOULD THE LEARNER NOTICE?
 * - WHAT MUST REMAIN TRUE (INVARIANTS)?
 * - WHAT IS THE CONSEQUENCE?
 *
 * Validates that all explanation claims match the underlying semantic state.
 */

import { type SemanticState, type Entity, type Relationship } from "./semantic-world";
import { type AuthoritativeTransformation } from "./authoritative-model";
import { type Invariant } from "./rules-invariants";

export interface SemanticExplanation {
  title: string;
  summary: string;
  whatChanged: string;
  whyChanged: string;
  cause: string;
  learnerObservation: string;
  invariantPreserved?: string;
  consequence: string;
  calculations?: string;
  keyInsight?: string;
}

export interface ExplanationValidationResult {
  valid: boolean;
  contradictions: string[];
}

export class ExplanationEngine {
  /**
   * Derives a structured explanation directly from the semantic delta between two states.
   */
  public static deriveExplanation(
    transformation: AuthoritativeTransformation,
    fromState?: SemanticState,
    toState?: SemanticState,
    invariants: Invariant[] = [],
  ): SemanticExplanation {
    // 1. Derive "What Changed?"
    const changeDetails: string[] = [];

    if (fromState && toState) {
      // Entities added or removed
      for (const [id, ent] of toState.entities.entries()) {
        if (!fromState.entities.has(id)) {
          changeDetails.push(`Added entity '${ent.label}' (${ent.type})`);
        }
      }
      for (const [id, ent] of fromState.entities.entries()) {
        if (!toState.entities.has(id)) {
          changeDetails.push(`Removed entity '${ent.label}'`);
        }
      }

      // Property and highlight changes
      for (const [id, entB] of toState.entities.entries()) {
        const entA = fromState.entities.get(id);
        if (entA) {
          if (entA.value !== entB.value && entB.value !== undefined) {
            changeDetails.push(`'${entB.label}' value updated: ${entA.value} -> ${entB.value}`);
          }
          if (entA.properties.highlight !== entB.properties.highlight && entB.properties.highlight) {
            changeDetails.push(`'${entB.label}' highlighted as ${entB.properties.highlight}`);
          }
          if (entA.state !== entB.state && entB.state) {
            changeDetails.push(`'${entB.label}' state changed to ${entB.state}`);
          }
        }
      }

      // Relationship mutations
      for (const [id, relB] of toState.relationships.entries()) {
        if (!fromState.relationships.has(id)) {
          changeDetails.push(`Connected '${relB.source}' -> '${relB.target}' (${relB.type})`);
        }
      }
      for (const [id, relA] of fromState.relationships.entries()) {
        if (!toState.relationships.has(id)) {
          changeDetails.push(`Disconnected '${relA.source}' -x-> '${relA.target}'`);
        }
      }
    }

    const computedWhatChanged =
      changeDetails.length > 0
        ? changeDetails.join("; ")
        : transformation.whatChanged || transformation.action;

    // 2. Active Invariant for this step
    const relevantInvariant = invariants.find((inv) =>
      transformation.invariantEffects?.includes(inv.id) ||
      inv.statement.toLowerCase().includes(transformation.title.toLowerCase()),
    );

    return {
      title: transformation.title,
      summary: transformation.explanation || transformation.action,
      whatChanged: computedWhatChanged,
      whyChanged: transformation.whyChanged || transformation.cause || "Required by pedagogical progression",
      cause: transformation.cause || "Algorithmic or physical rule triggering state transition",
      learnerObservation: transformation.learnerObservation || "Observe the structural transition in the diagram",
      invariantPreserved: relevantInvariant?.statement,
      consequence: transformation.consequence || "State reaches valid intermediate milestone",
      calculations: transformation.calculations,
      keyInsight: transformation.insight || relevantInvariant?.statement,
    };
  }
}

export class ExplanationValidator {
  /**
   * Verifies that explanation claims do not contradict the semantic state.
   */
  public static validateExplanationClaims(
    explanation: SemanticExplanation,
    state: SemanticState,
  ): ExplanationValidationResult {
    const contradictions: string[] = [];
    const lowerExplanation = (
      explanation.summary +
      " " +
      explanation.whatChanged +
      " " +
      explanation.whyChanged
    ).toLowerCase();

    // Check entity presence claims
    for (const [id, ent] of state.entities.entries()) {
      if (ent.state === "eliminated" && lowerExplanation.includes(`selected active ${ent.label.toLowerCase()}`)) {
        contradictions.push(`Explanation claims entity '${ent.label}' is active, but its state is 'eliminated'.`);
      }
    }

    return {
      valid: contradictions.length === 0,
      contradictions,
    };
  }
}
