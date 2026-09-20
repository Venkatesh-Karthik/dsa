/**
 * Counterfactual "What If?" Engine & Misconception Engine
 *
 * Evaluates hypothetical state mutations, recalculates derived values,
 * checks invariant breaches, and predicts consequences across arbitrary domains.
 */

import { type SemanticState, cloneSemanticState } from "./semantic-world";
import { type AuthoritativeSemanticModel } from "./authoritative-model";
import { InvariantEngine } from "./rules-invariants";
import {
  type Confidence,
  createConfidence,
  CONFIDENCE_DERIVED,
  CONFIDENCE_UNCERTAIN,
} from "./confidence-model";

export type CounterfactualMutationType =
  | "property_change"
  | "entity_removal"
  | "relationship_break"
  | "step_failure"
  | "condition_flip"
  | "skip_transformation";

export interface CounterfactualMutation {
  mutationType?: CounterfactualMutationType;
  targetEntityId?: string;
  sourceEntityId?: string;
  propertyKey?: string;
  hypotheticalValue?: unknown;
  targetRelationshipId?: string;
  stepIndex?: number;
  conditionId?: string;
  description?: string;
}

export interface CounterfactualResult {
  simulatedState: SemanticState;
  invariantViolations: Array<{
    statement: string;
    severity: string;
    details?: string;
  }>;
  consequences: string[];
  isViable: boolean;
  confidence: Confidence;
  causalChain?: string[];
  restorationSuggestion?: string;
}

export class CounterfactualEngine {
  /**
   * Applies a hypothetical change to a state, recomputes derived values,
   * validates invariants, and evaluates consequences across 6 mutation categories.
   */
  public static evaluateWhatIf(
    mutation: CounterfactualMutation,
    baseState: SemanticState,
    model: AuthoritativeSemanticModel,
  ): CounterfactualResult {
    const simulated = cloneSemanticState(baseState);
    const consequences: string[] = [];
    const causalChain: string[] = [];
    const type =
      mutation.mutationType ||
      (mutation.targetRelationshipId
        ? "relationship_break"
        : "property_change");

    switch (type) {
      case "entity_removal": {
        const entId = mutation.targetEntityId || "";
        const ent = simulated.entities.get(entId);
        if (!ent) {
          consequences.push(
            `Target entity '${entId}' not found in current state.`,
          );
          return {
            simulatedState: simulated,
            invariantViolations: [],
            consequences,
            isViable: false,
            confidence: CONFIDENCE_UNCERTAIN,
          };
        }
        simulated.entities.delete(entId);
        let severedCount = 0;
        for (const [rid, r] of simulated.relationships.entries()) {
          if (r.source === entId || r.target === entId) {
            simulated.relationships.delete(rid);
            severedCount++;
          }
        }
        consequences.push(
          `Entity '${ent.label}' was removed from the active system.`,
          `Severed ${severedCount} connected relationship(s).`,
        );
        causalChain.push(
          `Removal of '${ent.label}'`,
          `Breaks ${severedCount} connection path(s)`,
          `Downstream consumers of '${ent.label}' cannot receive inputs or state updates`,
        );
        break;
      }

      case "relationship_break": {
        const relId = mutation.targetRelationshipId || "";
        const rel = simulated.relationships.get(relId);
        if (rel) {
          simulated.relationships.delete(relId);
          consequences.push(
            `Relationship '${rel.label || rel.type}' between '${
              rel.source
            }' and '${rel.target}' was severed.`,
          );
          causalChain.push(
            `Broken link '${rel.source}' -> '${rel.target}'`,
            `Message or energy transmission halted`,
          );
        } else {
          // If source and target provided
          let found = false;
          for (const [rid, r] of simulated.relationships.entries()) {
            if (r.source === mutation.targetEntityId) {
              simulated.relationships.delete(rid);
              consequences.push(
                `Disconnected outgoing relationship from '${r.source}'.`,
              );
              found = true;
              break;
            }
          }
          if (!found) {
            consequences.push(`Specified relationship not found to sever.`);
          }
        }
        break;
      }

      case "step_failure": {
        simulated.stateType = "failure";
        if (mutation.targetEntityId) {
          const ent = simulated.entities.get(mutation.targetEntityId);
          if (ent) {
            ent.state = "failed";
            consequences.push(`Operation on entity '${ent.label}' failed.`);
          }
        }
        consequences.push(
          `System entered failure state at step ${
            mutation.stepIndex ?? baseState.index
          }.`,
          `Pending mutations were halted before commit.`,
        );
        causalChain.push(
          `Operation failed unexpectedly`,
          `Atomicity prevents partial commitment`,
          `Requires rollback or recovery action to restore valid baseline`,
        );
        break;
      }

      case "condition_flip": {
        simulated.stateType = "decision";
        const dec = simulated.activeDecision || model.decisions?.[0];
        if (dec) {
          const altOutcome =
            dec.possibleOutcomes.find((o) => o.id !== dec.selectedOutcomeId) ||
            dec.possibleOutcomes[1];
          if (altOutcome) {
            simulated.decisionOutcome = altOutcome.id;
            consequences.push(
              `Condition '${dec.condition}' evaluated to alternative outcome: '${altOutcome.label}'.`,
              ...altOutcome.consequences,
            );
            causalChain.push(
              `Alternative outcome '${altOutcome.label}' selected`,
              `Follows alternative branch: ${
                altOutcome.consequences.join(", ") || "branch switch"
              }`,
            );
          }
        } else {
          consequences.push(
            `Alternative outcome evaluated. System branched away from primary path.`,
          );
        }
        break;
      }

      case "skip_transformation": {
        consequences.push(
          `Transformation ${mutation.stepIndex ?? 1} was skipped.`,
          `Required preconditions for subsequent milestones remain unestablished.`,
        );
        causalChain.push(
          `Step skipped`,
          `Intermediary invariants and state mutations not performed`,
          `Target goal cannot be reached directly`,
        );
        break;
      }

      case "property_change":
      default: {
        const propKey = mutation.propertyKey || "value";

        // 1. Check if this mutation targets a relationship (e.g., edge weight change)
        let matchedRel: import("./semantic-world").Relationship | undefined;

        if (mutation.targetRelationshipId) {
          matchedRel = simulated.relationships.get(mutation.targetRelationshipId);
        }

        if (!matchedRel && (mutation.sourceEntityId || (mutation.targetEntityId && mutation.propertyKey === "weight"))) {
          const srcTerm = (mutation.sourceEntityId || "").toLowerCase();
          const tgtTerm = (mutation.targetEntityId || "").toLowerCase();

          const srcCandidates = new Set<string>();
          const tgtCandidates = new Set<string>();
          if (srcTerm) srcCandidates.add(srcTerm);
          if (tgtTerm) tgtCandidates.add(tgtTerm);

          for (const [eid, ent] of simulated.entities.entries()) {
            const eIdLower = eid.toLowerCase();
            const eLabelLower = (ent.label || "").toLowerCase();
            if (srcTerm && (eIdLower === srcTerm || eLabelLower === srcTerm || eIdLower.endsWith("-" + srcTerm))) {
              srcCandidates.add(eid);
            }
            if (tgtTerm && (eIdLower === tgtTerm || eLabelLower === tgtTerm || eIdLower.endsWith("-" + tgtTerm))) {
              tgtCandidates.add(eid);
            }
          }

          for (const rel of simulated.relationships.values()) {
            const rSrc = rel.source.toLowerCase();
            const rTgt = rel.target.toLowerCase();
            const rId = rel.id.toLowerCase();
            const rLabel = (rel.label || "").toLowerCase();

            const srcMatch = srcTerm ? (srcCandidates.has(rSrc) || rSrc === srcTerm || rSrc.endsWith("-" + srcTerm)) : true;
            const tgtMatch = tgtTerm ? (tgtCandidates.has(rTgt) || rTgt === tgtTerm || rTgt.endsWith("-" + tgtTerm)) : true;

            if (srcMatch && tgtMatch) {
              matchedRel = rel;
              break;
            }

            if (
              srcTerm &&
              tgtTerm &&
              (rId.includes(`${srcTerm}-${tgtTerm}`) ||
                rId.includes(`${srcTerm}_${tgtTerm}`) ||
                rLabel.includes(`${srcTerm}->${tgtTerm}`) ||
                rLabel.includes(`${srcTerm}→${tgtTerm}`))
            ) {
              matchedRel = rel;
              break;
            }
          }
        }

        if (matchedRel) {
          if (!matchedRel.properties) {
            matchedRel.properties = {};
          }
          const oldValue = matchedRel.properties[propKey] ?? matchedRel.label ?? "unknown";
          matchedRel.properties[propKey] = mutation.hypotheticalValue;
          if (propKey === "weight") {
            matchedRel.label = String(mutation.hypotheticalValue);
          }
          const srcLabel = simulated.entities.get(matchedRel.source)?.label || matchedRel.source;
          const tgtLabel = simulated.entities.get(matchedRel.target)?.label || matchedRel.target;
          consequences.push(
            `Relationship '${srcLabel} → ${tgtLabel}' changed ${propKey} from ${String(oldValue)} to ${String(mutation.hypotheticalValue)}`,
          );
          causalChain.push(
            `Mutation of relationship '${srcLabel} → ${tgtLabel}.${propKey}'`,
            `Alters edge weights, path traversals, and optimal costs`,
          );
          break;
        }

        // 2. Entity property mutation fallback
        const entId = mutation.targetEntityId || "";
        let ent = simulated.entities.get(entId);
        if (!ent && entId) {
          const lowerEntId = entId.toLowerCase();
          for (const [eId, candidate] of simulated.entities.entries()) {
            if (candidate.label.toLowerCase() === lowerEntId || eId.toLowerCase().endsWith("-" + lowerEntId)) {
              ent = candidate;
              break;
            }
          }
        }

        if (ent) {
          const oldValue = ent.value ?? ent.properties[propKey];
          if (propKey === "value") {
            ent.value = mutation.hypotheticalValue;
          } else {
            ent.properties[propKey] = mutation.hypotheticalValue;
          }
          consequences.push(
            `Entity '${ent.label}' changed ${propKey} from ${String(
              oldValue,
            )} to ${String(mutation.hypotheticalValue)}`,
          );
          causalChain.push(
            `Mutation of '${ent.label}.${propKey}'`,
            `Alters local computation and derived values`,
          );
        } else {
          consequences.push(
            `Target element '${entId || mutation.description || "unknown"}' not found in current state.`,
          );
          return {
            simulatedState: simulated,
            invariantViolations: [],
            consequences,
            isViable: false,
            confidence: CONFIDENCE_UNCERTAIN,
          };
        }
        break;
      }
    }

    // Revalidate all active invariants against the hypothetical state
    const report = InvariantEngine.validateStateInvariants(
      simulated,
      model.invariants,
      model.states,
    );
    const violations = report.violations.map((v) => ({
      statement: v.statement,
      severity: v.severity,
      details: v.details,
    }));

    let restorationSuggestion: string | undefined;

    if (violations.length > 0) {
      consequences.push(
        `Causes ${violations.length} invariant violation(s): ${violations
          .map((v) => v.statement)
          .join("; ")}`,
      );
      if (report.explanations && report.explanations.length > 0) {
        restorationSuggestion = report.explanations[0].restorationAction;
      }
    } else {
      consequences.push(
        "Hypothetical mutation maintains all active system invariants.",
      );
    }

    return {
      simulatedState: simulated,
      invariantViolations: violations,
      consequences,
      isViable: report.valid,
      confidence: CONFIDENCE_DERIVED,
      causalChain,
      restorationSuggestion,
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
        misunderstanding:
          m.misunderstanding || m.misconception || "Common learner confusion",
        correction:
          m.correction ||
          "Verified semantic invariant disproves this assumption",
        detectedContradiction: learnerAssumption
          ? `Learner assumption '${learnerAssumption}' contradicts rule: ${m.correction}`
          : undefined,
      });
    }

    return detected;
  }
}
