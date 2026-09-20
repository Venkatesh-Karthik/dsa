/**
 * Cognora What-If Branch Manager
 *
 * Coordinates counterfactual exploration without destroying or corrupting
 * the primary lesson timeline.
 *
 * Examples:
 * - "What if the target was 70?"
 * - "What if we inserted 27 instead?"
 * - "What if we remove 40?"
 * - "What if edge B-D had weight 1?"
 *
 * Evaluates hypothesis via CounterfactualEngine, compiles branch TeachingMoments,
 * and seamlessly restores the original timeline on "Go back".
 */

import {
  CounterfactualEngine,
  type CounterfactualMutation,
  type CounterfactualResult,
} from "../counterfactual-engine";
import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type { TeachingMoment } from "../teaching-moment";
import { type SceneState, cloneSceneState } from "../scene-state";
import type { SemanticState } from "../semantic-world";
import type { CognoraWorldState, WhatIfBranch } from "./cognora-world-model";

export class BranchManager {
  /**
   * Creates a counterfactual What-If branch from a user query or parameters
   */
  public static createBranch(
    hypothesis: string,
    worldState: Readonly<CognoraWorldState>,
    explicitMutation?: CounterfactualMutation,
  ): WhatIfBranch | null {
    const currentMoment = worldState.currentMoment;
    const timeline = worldState.timeline;
    const baseModel = timeline?.model;

    if (!currentMoment || !baseModel) {
      console.warn(
        "[COGNORA][BRANCH] Cannot branch: no active TeachingMoment or model.",
      );
      return null;
    }

    const branchId = `branch-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const parentMomentIndex = currentMoment.stepIndex;
    const parentMomentId = currentMoment.id;

    // 1. Determine mutation details
    let mutation: CounterfactualMutation = explicitMutation || {};
    if (!explicitMutation) {
      const lower = hypothesis.toLowerCase();
      const numMatch = lower.match(/(\d+)/);
      const val = numMatch ? parseInt(numMatch[1], 10) : undefined;

      if (/remove|delete/i.test(lower) && val !== undefined) {
        mutation = {
          mutationType: "entity_removal",
          targetEntityId: `node-${val}`,
          description: `Hypothetical removal of ${val}`,
        };
      } else if (/insert|add/i.test(lower) && val !== undefined) {
        mutation = {
          mutationType: "property_change",
          targetEntityId: `new-node-${val}`,
          propertyKey: "value",
          hypotheticalValue: val,
          description: `Hypothetical insertion of ${val}`,
        };
      } else if (
        /target\s+(?:is|was|=|to)\s+(\d+)/i.test(lower) ||
        val !== undefined
      ) {
        mutation = {
          mutationType: "property_change",
          propertyKey: "target",
          hypotheticalValue: val,
          description: `Hypothetical target of ${val}`,
        };
      } else {
        mutation = {
          mutationType: "condition_flip",
          description: hypothesis,
        };
      }
    }

    // 2. Evaluate counterfactual simulation
    const existingState =
      baseModel.states?.[parentMomentIndex] || baseModel.states?.[0];
    const baseState: SemanticState = existingState
      ? {
          ...existingState,
          entities: new Map(existingState.entities),
          relationships: new Map(existingState.relationships),
        }
      : {
          id: `state-branch-base-${branchId}`,
          index: parentMomentIndex,
          entities: new Map(),
          relationships: new Map(),
          properties: {},
          derivedValues: {},
          conditions: [],
          observations: [],
        };

    const counterfactualResult: CounterfactualResult =
      CounterfactualEngine.evaluateWhatIf(mutation, baseState, baseModel);

    // 3. Construct branched TeachingMoment
    const branchExplanation =
      counterfactualResult.consequences.length > 0
        ? `What-If Analysis: ${counterfactualResult.consequences.join(". ")}`
        : `Exploring scenario: ${hypothesis}`;

    const branchWhy =
      counterfactualResult.causalChain &&
      counterfactualResult.causalChain.length > 0
        ? counterfactualResult.causalChain.join(" -> ")
        : `Evaluating invariant impacts for hypothetical condition.`;

    const branchNarration =
      counterfactualResult.consequences.length > 0
        ? `If ${mutation.description || hypothesis}, then ${
            counterfactualResult.consequences[0]
          }. Notice how this alters the search or structural balance.`
        : `Let's see what happens if ${hypothesis}. Notice the change on canvas.`;

    // Clone visual state for branch presentation
    const branchSceneState: SceneState = currentMoment.visualState?.graph
      ? cloneSceneState(currentMoment.visualState)
      : {
          graph: {
            entities: new Map(),
            relationships: new Map(),
            annotations: new Map(),
          },
        };

    const branchMoment: TeachingMoment = {
      id: `moment-${branchId}-0`,
      transformationId: `trans-${branchId}`,
      stepIndex: 0,
      totalSteps: 1,
      title: `What-If: ${hypothesis}`,
      beforeState: currentMoment.visualState,
      afterState: branchSceneState,
      semanticChanges: {
        addedEntities: mutation.targetEntityId ? [mutation.targetEntityId] : [],
        removedEntities: [],
        updatedEntities: [],
        addedRelationships: [],
        removedRelationships: [],
      },
      visualState: branchSceneState,
      affectedEntities: currentMoment.affectedEntities,
      affectedRelationships: currentMoment.affectedRelationships,
      semanticFocus: currentMoment.semanticFocus,
      explanation: branchExplanation,
      why: branchWhy,
      consequence:
        counterfactualResult.consequences[0] || "Branch state explored.",
      narration: branchNarration,
      importance: "HIGH",
    };

    const branch: WhatIfBranch = {
      branchId,
      description: hypothesis,
      parentMomentIndex,
      parentMomentId,
      baseModel,
      mutatedModel: baseModel,
      branchMoments: [branchMoment],
      branchSceneState,
      counterfactualResult,
      createdAt: Date.now(),
    };

    console.log(
      `[COGNORA][BRANCH][CREATED] id=${branchId} parentStep=${parentMomentIndex} hypothesis="${hypothesis}"`,
    );

    return branch;
  }
}
