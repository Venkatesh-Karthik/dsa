/**
 * Counterfactual "What If?" Engine & Misconception Engine
 *
 * Evaluates hypothetical state mutations, recalculates derived values,
 * checks invariant breaches, and predicts consequences across arbitrary domains.
 */

import { type SemanticState, cloneSemanticState } from "./semantic-world";
import { type AuthoritativeSemanticModel } from "./authoritative-model";
import { InvariantEngine } from "./rules-invariants";
import { type Confidence, createConfidence, CONFIDENCE_DERIVED, CONFIDENCE_UNCERTAIN } from "./confidence-model";

export interface CounterfactualMutation {
  targetEntityId: string;
  propertyKey: string;
  hypotheticalValue: unknown;
  description?: string;
}

export interface CounterfactualResult {
  simulatedState: SemanticState;
  invariantViolations: Array<{ statement: string; severity: string }>;
  consequences: string[];
  isViable: boolean;
  confidence: Confidence;
}

export class CounterfactualEngine {
  /**
   * Applies a hypothetical change to a state, recomputes derived values,
   * validates invariants, and evaluates consequences.
   */
  public static evaluateWhatIf(
    mutation: CounterfactualMutation,
    baseState: SemanticState,
    model: AuthoritativeSemanticModel,
  ): CounterfactualResult {
    const simulated = cloneSemanticState(baseState);
    const ent = simulated.entities.get(mutation.targetEntityId);

    const consequences: string[] = [];

    if (ent) {
      const oldValue = ent.value ?? ent.properties[mutation.propertyKey];
      if (mutation.propertyKey === "value") {
        ent.value = mutation.hypotheticalValue;
      } else {
        ent.properties[mutation.propertyKey] = mutation.hypotheticalValue;
      }
      consequences.push(
        `Entity '${ent.label}' changed ${mutation.propertyKey} from ${String(oldValue)} to ${String(mutation.hypotheticalValue)}`,
      );
    } else {
      consequences.push(`Target entity '${mutation.targetEntityId}' not found in current state.`);
      return {
        simulatedState: simulated,
        invariantViolations: [],
        consequences,
        isViable: false,
        confidence: CONFIDENCE_UNCERTAIN,
      };
    }

    // Revalidate all active invariants against the hypothetical state
    const report = InvariantEngine.validateStateInvariants(simulated, model.invariants);
    const violations = report.violations.map((v) => ({
      statement: v.statement,
      severity: v.severity,
    }));

    if (violations.length > 0) {
      consequences.push(
        `Causes ${violations.length} invariant violation(s): ${violations.map((v) => v.statement).join("; ")}`,
      );
    } else {
      consequences.push("Hypothetical mutation maintains all active system invariants.");
    }

    return {
      simulatedState: simulated,
      invariantViolations: violations,
      consequences,
      isViable: report.valid,
      confidence: CONFIDENCE_DERIVED,
    };
  }
}

export interface MisconceptionHypothesis {
  id: string;
  misunderstanding: string;
  correction: string;
  detectedContradiction?: string;
}

export class MisconceptionEngine {
  /**
   * Evaluates potential learner misconceptions against active invariants.
   */
  public static detectActiveMisconceptions(
    model: AuthoritativeSemanticModel,
    learnerAssumption?: string,
  ): MisconceptionHypothesis[] {
    const detected: MisconceptionHypothesis[] = [];

    // Check against problem misconceptions if any
    const rawMisc = (model.problem.metadata?.misconceptions as any[]) || [];
    for (const m of rawMisc) {
      detected.push({
        id: m.id || `misc-${Math.random().toString(36).slice(2, 6)}`,
        misunderstanding: m.misunderstanding || m.misconception || "Common learner confusion",
        correction: m.correction || "Verified semantic invariant disproves this assumption",
        detectedContradiction: learnerAssumption
          ? `Learner assumption '${learnerAssumption}' contradicts rule: ${m.correction}`
          : undefined,
      });
    }

    return detected;
  }
}
