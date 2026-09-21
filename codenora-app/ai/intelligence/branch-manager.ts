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

import { type SceneState, cloneSceneState } from "../scene-state";

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type { TeachingMoment } from "../teaching-moment";
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
    const baseModel =
      timeline?.model ||
      ({
        id: timeline?.lessonId || "lesson-model",
        topic: timeline?.topic || "Concept",
        invariants: [],
        states: [],
        transformations: [],
      } as unknown as AuthoritativeSemanticModel);

    if (!currentMoment) {
      console.warn(
        "[COGNORA][BRANCH] Cannot branch: no active TeachingMoment.",
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

      // Check for edge / relationship hypothesis
      // e.g. "What if the edge C→D had weight 1 instead of 8?", "C->D had weight 1", "edge A-B was 3"
      const edgePattern =
        /(?:edge\s+)?([A-Za-z0-9_-]+)\s*(?:->|→|to|-)\s*([A-Za-z0-9_-]+)[^\d]*?(?:had\s+weight|weight|was|=|is|to)?\s*(\d+)(?:\s*(?:instead of|rather than)\s*(\d+))?/i;
      const edgeMatch = hypothesis.match(edgePattern);

      if (edgeMatch) {
        const src = edgeMatch[1];
        const tgt = edgeMatch[2];
        const hypVal = parseInt(edgeMatch[3], 10);
        mutation = {
          mutationType: "property_change",
          sourceEntityId: src,
          targetEntityId: tgt,
          propertyKey: "weight",
          hypotheticalValue: hypVal,
          description: `Hypothetical weight of ${hypVal} on edge ${src}→${tgt}`,
        };
      } else if (/remove|delete/i.test(lower) && val !== undefined) {
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

    // Populate base state directly from current visual graph if missing
    const currentGraph = currentMoment.visualState?.graph;
    if (baseState.entities.size === 0 && currentGraph) {
      for (const [eid, ent] of currentGraph.entities.entries()) {
        baseState.entities.set(eid, {
          id: ent.id,
          label: ent.label || String(ent.value ?? eid),
          value: ent.value,
          state: (ent.properties?.state as any) || "active",
          type: ent.primitiveType || "node",
          properties: { ...ent.properties } as any,
        });
      }
      for (const [rid, rel] of currentGraph.relationships.entries()) {
        baseState.relationships.set(rid, {
          id: rel.id,
          type: rel.type,
          direction: "forward" as const,
          source: rel.sourceEntityId,
          target: rel.targetEntityId,
          label:
            typeof rel.properties?.label === "string"
              ? rel.properties.label
              : rel.properties?.weight !== undefined
              ? String(rel.properties.weight)
              : undefined,
          properties: { ...rel.properties } as any,
        });
      }
    }

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
          }. Notice how this alters the path and structural values.`
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

    // Mutate branch visual state to reflect counterfactual simulation
    if (counterfactualResult.simulatedState && branchSceneState.graph) {
      const sim = counterfactualResult.simulatedState;
      for (const [rid, rel] of sim.relationships.entries()) {
        const existingRel = branchSceneState.graph.relationships.get(rid);
        if (existingRel) {
          existingRel.properties = {
            ...(existingRel.properties || {}),
            ...rel.properties,
            label: String(
              rel.properties?.weight ??
                rel.label ??
                existingRel.properties?.label ??
                "",
            ),
            highlight: "active",
          };
        }
      }
      for (const [eid, ent] of sim.entities.entries()) {
        const existingEnt = branchSceneState.graph.entities.get(eid);
        if (existingEnt) {
          existingEnt.value = ent.value;
          existingEnt.label = ent.label;
          existingEnt.properties = {
            ...(existingEnt.properties || {}),
            ...ent.properties,
            highlight: "active",
          };
        }
      }
    }

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

    const parentBranch = worldState.activeBranch?.branchId || "MAIN";
    const branch: WhatIfBranch = {
      branchId,
      parentBranchId: parentBranch,
      parentWorldVersion: parentMomentIndex,
      worldVersion: parentMomentIndex + 1,
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
      `[COGNORA][BRANCH][CREATE] parentBranch=${parentBranch} branchId=${branchId} parentWorldVersion=${parentMomentIndex} reason="${hypothesis}"`,
    );

    return branch;
  }
}
