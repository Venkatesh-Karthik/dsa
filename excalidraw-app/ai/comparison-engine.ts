/**
 * Universal Semantic Comparison Engine
 *
 * Compares two semantic states, concepts, or solutions:
 * Identifies similarities, differences, tradeoffs, changed properties,
 * changed relationships, and differing outcomes.
 */

import { type SemanticState, type Entity, type Relationship } from "./semantic-world";
import { type AuthoritativeSemanticModel } from "./authoritative-model";

export interface SemanticComparisonReport {
  subjectA: string;
  subjectB: string;
  similarities: string[];
  differences: string[];
  addedEntities: string[];
  removedEntities: string[];
  modifiedEntities: Array<{
    id: string;
    label: string;
    beforeValue: unknown;
    afterValue: unknown;
  }>;
  addedRelationships: string[];
  removedRelationships: string[];
  tradeoffs: Array<{
    dimension: string;
    optionAAdvantage: string;
    optionBAdvantage: string;
  }>;
  summary: string;
}

export class ComparisonEngine {
  /**
   * Semantically compares two states (State A vs State B).
   */
  public static compareStates(
    stateA: SemanticState,
    stateB: SemanticState,
  ): SemanticComparisonReport {
    const similarities: string[] = [];
    const differences: string[] = [];
    const addedEntities: string[] = [];
    const removedEntities: string[] = [];
    const modifiedEntities: SemanticComparisonReport["modifiedEntities"] = [];
    const addedRelationships: string[] = [];
    const removedRelationships: string[] = [];

    // Entities in B not in A
    for (const [id, entB] of stateB.entities.entries()) {
      if (!stateA.entities.has(id)) {
        addedEntities.push(`${entB.label} (${entB.type})`);
        differences.push(`Added entity: ${entB.label}`);
      } else {
        const entA = stateA.entities.get(id)!;
        if (entA.value !== entB.value || entA.state !== entB.state) {
          modifiedEntities.push({
            id,
            label: entB.label,
            beforeValue: entA.value ?? entA.state,
            afterValue: entB.value ?? entB.state,
          });
          differences.push(
            `Modified '${entB.label}': ${String(entA.value ?? entA.state)} -> ${String(entB.value ?? entB.state)}`,
          );
        } else {
          similarities.push(`Preserved entity: ${entB.label}`);
        }
      }
    }

    // Entities in A not in B
    for (const [id, entA] of stateA.entities.entries()) {
      if (!stateB.entities.has(id)) {
        removedEntities.push(entA.label);
        differences.push(`Removed entity: ${entA.label}`);
      }
    }

    // Relationships in B not in A
    for (const [id, relB] of stateB.relationships.entries()) {
      if (!stateA.relationships.has(id)) {
        addedRelationships.push(`${relB.source} -> ${relB.target} (${relB.type})`);
        differences.push(`Established link: ${relB.source} -> ${relB.target}`);
      }
    }

    // Relationships in A not in B
    for (const [id, relA] of stateA.relationships.entries()) {
      if (!stateB.relationships.has(id)) {
        removedRelationships.push(`${relA.source} -> ${relA.target}`);
        differences.push(`Removed link: ${relA.source} -> ${relA.target}`);
      }
    }

    const summary = `Comparison between State ${stateA.index} and State ${stateB.index}: ${addedEntities.length} added, ${removedEntities.length} removed, ${modifiedEntities.length} modified entities.`;

    return {
      subjectA: `State ${stateA.index} (${stateA.name || stateA.id})`,
      subjectB: `State ${stateB.index} (${stateB.name || stateB.id})`,
      similarities,
      differences,
      addedEntities,
      removedEntities,
      modifiedEntities,
      addedRelationships,
      removedRelationships,
      tradeoffs: [],
      summary,
    };
  }

  /**
   * Semantically compares two models or architectural paradigms.
   */
  public static compareModels(
    modelA: AuthoritativeSemanticModel,
    modelB: AuthoritativeSemanticModel,
  ): SemanticComparisonReport {
    const finalA = modelA.states[modelA.states.length - 1];
    const finalB = modelB.states[modelB.states.length - 1];

    const stateDiff = this.compareStates(finalA, finalB);

    const tradeoffs = [
      {
        dimension: "Structural Complexity",
        optionAAdvantage: `${modelA.world.entities.length} total components`,
        optionBAdvantage: `${modelB.world.entities.length} total components`,
      },
      {
        dimension: "Transformation Steps",
        optionAAdvantage: `${modelA.transformations.length} step progression`,
        optionBAdvantage: `${modelB.transformations.length} step progression`,
      },
    ];

    return {
      ...stateDiff,
      subjectA: modelA.problem.objective,
      subjectB: modelB.problem.objective,
      tradeoffs,
      summary: `Tradeoff comparison between '${modelA.problem.objective}' and '${modelB.problem.objective}'.`,
    };
  }
}
