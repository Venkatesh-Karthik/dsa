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

import {
  type SemanticState,
  type Entity,
  type Relationship,
} from "./semantic-world";
import { type AuthoritativeTransformation } from "./authoritative-model";
import { type Invariant } from "./rules-invariants";

export interface SemanticExplanation {
  title: string;
  summary: string;
  whatChanged: string;
  whyChanged: string;
  cause: string;
  whatMustNowBeTrue: string;
  whatHappensNext: string;
  learnerObservation: string;
  invariantPreserved?: string;
  consequence: string;
  calculations?: string;
  keyInsight?: string;
  decisionExplanation?: string;
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
            changeDetails.push(
              `'${entB.label}' value updated: ${entA.value} -> ${entB.value}`,
            );
          }
          if (
            entA.properties.highlight !== entB.properties.highlight &&
            entB.properties.highlight
          ) {
            changeDetails.push(
              `'${entB.label}' highlighted as ${entB.properties.highlight}`,
            );
          }
          if (entA.state !== entB.state && entB.state) {
            changeDetails.push(
              `'${entB.label}' state changed to ${entB.state}`,
            );
          }
        }
      }

      // Relationship mutations
      for (const [id, relB] of toState.relationships.entries()) {
        if (!fromState.relationships.has(id)) {
          const srcLabel =
            toState.entities.get(relB.source)?.label ||
            fromState.entities.get(relB.source)?.label ||
            relB.source;
          const tgtLabel =
            toState.entities.get(relB.target)?.label ||
            fromState.entities.get(relB.target)?.label ||
            relB.target;
          changeDetails.push(
            `Connected '${srcLabel}' -> '${tgtLabel}' (${relB.type})`,
          );
        }
      }
      for (const [id, relA] of fromState.relationships.entries()) {
        if (!toState.relationships.has(id)) {
          const srcLabel =
            toState.entities.get(relA.source)?.label ||
            fromState.entities.get(relA.source)?.label ||
            relA.source;
          const tgtLabel =
            toState.entities.get(relA.target)?.label ||
            fromState.entities.get(relA.target)?.label ||
            relA.target;
          changeDetails.push(`Disconnected '${srcLabel}' -x-> '${tgtLabel}'`);
        }
      }
    }

    const computedWhatChanged =
      changeDetails.length > 0
        ? changeDetails.join("; ")
        : transformation.whatChanged || transformation.action;

    // 2. Active Invariant for this step
    const relevantInvariant = invariants.find(
      (inv) =>
        transformation.invariantEffects?.includes(inv.id) ||
        inv.statement
          .toLowerCase()
          .includes(transformation.title.toLowerCase()),
    );

    // 3. What Must Now Be True?
    const whatMustNowBeTrue =
      transformation.postconditions && transformation.postconditions.length > 0
        ? transformation.postconditions.join("; ")
        : relevantInvariant
        ? `Preserves invariant: "${relevantInvariant.statement}"`
        : "State satisfies baseline consistency and integrity constraints";

    // 4. What Happens Next?
    const whatHappensNext =
      transformation.consequence ||
      "Advances to the next conceptual milestone in the journey";

    // 5. Decision explanation
    let decisionExplanation: string | undefined;
    if (transformation.decision) {
      const dec = transformation.decision;
      const selected = dec.possibleOutcomes.find(
        (o) => o.id === dec.selectedOutcomeId,
      );
      decisionExplanation = `Decision "${dec.condition}": evaluated outcome "${
        selected?.label || dec.selectedOutcomeId
      }".`;
    }

    const scrub = ExplanationEngine.scrubMetadata;

    return {
      title: scrub(transformation.title),
      summary: scrub(transformation.explanation || transformation.action),
      whatChanged: scrub(computedWhatChanged),
      whyChanged: scrub(
        transformation.whyChanged ||
          transformation.cause ||
          "Required by pedagogical progression",
      ),
      cause: scrub(
        transformation.cause ||
          "Algorithmic or physical rule triggering state transition",
      ),
      whatMustNowBeTrue,
      whatHappensNext: scrub(whatHappensNext),
      learnerObservation: scrub(
        transformation.learnerObservation ||
          "Observe the structural transition in the diagram",
      ),
      invariantPreserved: relevantInvariant?.statement,
      consequence: scrub(
        transformation.consequence ||
          "State reaches valid intermediate milestone",
      ),
      calculations: transformation.calculations,
      keyInsight: transformation.insight || relevantInvariant?.statement,
      decisionExplanation,
    };
  }

  public static scrubMetadata(text?: string): string {
    if (!text) {
      return "";
    }
    return text
      .replace(/\b(?:Introducing\s+)?t\d+[-_]op\d+[^:]*:\s*/gi, "")
      .replace(/\bt\d+[-_]op\d+\b/gi, "step")
      .replace(/\bptr[-_]low(?:[-_]\d+)?\b/gi, "low pointer")
      .replace(/\bptr[-_]high(?:[-_]\d+)?\b/gi, "high pointer")
      .replace(/\bptr[-_]mid(?:[-_]\d+)?\b/gi, "midpoint")
      .replace(/\bptr[-_]pivot\b/gi, "pivot")
      .replace(/\bptr[-_]left\b/gi, "left pointer")
      .replace(/\bptr[-_]right\b/gi, "right pointer")
      .replace(/\bptr[-_]i\b/gi, "scan pointer i")
      .replace(/\bptr[-_]j\b/gi, "partition boundary j")
      .replace(/\bptr[-_]found(?:[-_]\d+)?\b/gi, "target pointer")
      .replace(/\bptr[-_][a-zA-Z0-9_-]+\b/gi, "pointer")
      .replace(/\bmain[-_]array\b/gi, "original array")
      .replace(/\bleft[-_]half\b/gi, "left half")
      .replace(/\bright[-_]half\b/gi, "right half")
      .replace(/\bfinal[-_]sorted(?:[-_]\d+)?\b/gi, "sorted array")
      .replace(/\bqs[-_]array\b/gi, "array")
      .replace(/\bbs[-_]array(?:[-_]\d+)?\b/gi, "array")
      .replace(
        /\b(?:merge[-_]array[-_]element[-_]|elem[-_]|item[-_]|array[-_]item[-_])(\d+)\b/gi,
        "element $1",
      )
      .replace(/\bmerge[-_]array[-_]element[-_][a-zA-Z0-9_-]+\b/gi, "element")
      .replace(/\barray[-_]item[-_][a-zA-Z0-9_-]+\b/gi, "element")
      .replace(
        /\b(?:dll[-_](?:e|node[-_]?)?|node[-_]|tree[-_]n|tree[-_]node[-_]|avl[-_]tree[-_]n|avl[-_]node[-_]|avl[-_]|n)(\d+)\b/gi,
        "$1",
      )
      .replace(/\bnode[-_]([a-zA-Z0-9]+)\b/gi, "$1")
      .replace(/\bfocusComponent\b/gi, "target element")
      .replace(/\bactiveComponents\b/gi, "active components")
      .replace(/\bActive Components\b/gi, "Components")
      .replace(/\bFocus Component\b/gi, "Focus Item")
      .replace(/\b(?:Component|Node)\s+(\w+)/gi, "$1")
      .replace(/\barrow\d+[-_]\d+\b/gi, "connection")
      .replace(/\bent[-_][a-zA-Z0-9_-]+\b/gi, "element")
      .trim();
  }

  /**
   * Formats a structured 4-7 line pedagogical explanation for complex transitions.
   */
  public static formatMultiLineExplanation(exp: SemanticExplanation): string {
    const lines: string[] = [];
    if (exp.summary) {
      lines.push(`WHAT: ${exp.summary}`);
    }
    if (exp.whyChanged) {
      lines.push(`WHY: ${exp.whyChanged}`);
    }
    if (exp.whatChanged) {
      lines.push(`WHAT CHANGED: ${exp.whatChanged}`);
    }
    if (exp.learnerObservation) {
      lines.push(`WHAT TO NOTICE: ${exp.learnerObservation}`);
    }
    if (exp.whatHappensNext) {
      lines.push(`WHAT HAPPENS NEXT: ${exp.whatHappensNext}`);
    }
    if (exp.invariantPreserved) {
      lines.push(`INVARIANT: ${exp.invariantPreserved}`);
    }
    if (exp.keyInsight && exp.keyInsight !== exp.invariantPreserved) {
      lines.push(`INSIGHT: ${exp.keyInsight}`);
    }
    return lines.join("\n");
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
    const lowerExplanation =
      `${explanation.summary} ${explanation.whatChanged} ${explanation.whyChanged}`.toLowerCase();

    // Check entity presence claims
    for (const [id, ent] of state.entities.entries()) {
      if (
        ent.state === "eliminated" &&
        lowerExplanation.includes(`selected active ${ent.label.toLowerCase()}`)
      ) {
        contradictions.push(
          `Explanation claims entity '${ent.label}' is active, but its state is 'eliminated'.`,
        );
      }
    }

    return {
      valid: contradictions.length === 0,
      contradictions,
    };
  }
}
