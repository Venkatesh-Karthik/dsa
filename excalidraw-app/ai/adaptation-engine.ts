/**
 * Cognora Local Adaptation & Semantic Object Intelligence Engine
 *
 * Powers 100% local, instant responses with ZERO subsequent AI network requests:
 * 1. Semantic Object Intelligence ("What is this?", "Why is this here?", "What does it connect to?", "What changes next?")
 * 2. Scene Diff Explanation ("What changed?")
 * 3. Causal Chain Drilldown ("Why did it happen?")
 * 4. Mechanism Explanation ("How does it work?")
 * 5. Parameter Mutation ("What if?")
 * 6. Concept Comparison
 * 7. Counterexample Construction
 * 8. Dynamic Practice Generation and Immediate Verification
 */

import type {
  ConceptModel,
  ConceptEntity,
  ConceptRelationship,
  ConceptTransformation,
  PracticeOpportunity,
} from "./concept-model";
import type { SceneState } from "./scene-state";
import { computeSceneGraphDiff, type SceneDiff } from "./diff-engine";

// ============================================================================
// Semantic Object Inspection
// ============================================================================

export interface EntityInspectionDetails {
  id: string;
  label: string;
  type: string;
  role?: string;
  value?: unknown;
  state?: string;
  incomingConnections: Array<{ fromId: string; type: string; label?: string }>;
  outgoingConnections: Array<{ toId: string; type: string; label?: string }>;
  purposeInCurrentStep: string;
  nextChangeSummary?: string;
}

/**
 * Inspects a selected entity by stable ID across the semantic model without pixel inspection.
 */
export function inspectSelectedEntity(
  entityId: string,
  model: ConceptModel,
  currentStepIndex: number,
): EntityInspectionDetails | null {
  const entity = model.entities.find((e) => e.id === entityId);
  if (!entity) {
    return null;
  }

  // Find incoming & outgoing relationships
  const incoming: Array<{ fromId: string; type: string; label?: string }> = [];
  const outgoing: Array<{ toId: string; type: string; label?: string }> = [];

  for (const rel of model.relationships) {
    if (rel.targetEntityId === entityId) {
      incoming.push({ fromId: rel.sourceEntityId, type: rel.type, label: rel.label });
    }
    if (rel.sourceEntityId === entityId) {
      outgoing.push({ toId: rel.targetEntityId, type: rel.type, label: rel.label });
    }
  }

  // Purpose in current step
  const currentT = model.transformations[currentStepIndex] || model.transformations[0];
  let purpose = `Represents active semantic ${entity.type} in the ${model.concept} model.`;
  if (currentT && currentT.relevantEntityIds.includes(entityId)) {
    purpose = `Actively participating in step "${currentT.title}": ${currentT.action}`;
  }

  // Next change for this entity
  let nextChangeSummary: string | undefined = undefined;
  for (let i = currentStepIndex + 1; i < model.transformations.length; i++) {
    const nextT = model.transformations[i];
    if (nextT.relevantEntityIds.includes(entityId)) {
      nextChangeSummary = `In Step ${i + 1} ("${nextT.title}"): ${nextT.action}`;
      break;
    }
  }

  return {
    id: entity.id,
    label: entity.label,
    type: entity.type,
    role: entity.semanticRole,
    value: entity.value,
    state: entity.state,
    incomingConnections: incoming,
    outgoingConnections: outgoing,
    purposeInCurrentStep: purpose,
    nextChangeSummary,
  };
}

// ============================================================================
// Local "What Changed?" Diff Explanations
// ============================================================================

/**
 * Derives a human-readable "What Changed?" summary between two states using SceneDiff or model deltas.
 */
export function deriveWhatChangedExplanation(
  transformation: ConceptTransformation,
  fromState?: SceneState,
  toState?: SceneState,
): string {
  // If complete SceneStates are available, run the diff engine
  if (fromState && toState) {
    const diff: SceneDiff = computeSceneGraphDiff(fromState, toState);
    const parts: string[] = [];

    if (diff.addedEntities.length > 0) {
      parts.push(`Added: ${diff.addedEntities.map((e) => e.label || e.id).join(", ")}`);
    }
    if (diff.removedEntities.length > 0) {
      parts.push(`Removed: ${diff.removedEntities.map((e) => e.label || e.id).join(", ")}`);
    }
    if (diff.updatedEntities.length > 0) {
      const updates = diff.updatedEntities.map((u) => {
        if (u.valueChanged) return `${u.id} value -> ${u.to.value}`;
        if (u.stateChanged) return `${u.id} state -> ${u.to.state}`;
        if (u.highlightChanged) return `${u.id} highlighted`;
        return `${u.id} updated`;
      });
      parts.push(`Modified: ${updates.join("; ")}`);
    }
    if (diff.addedRelationships.length > 0) {
      parts.push(`Connected: ${diff.addedRelationships.map((r) => `${r.sourceEntityId} -> ${r.targetEntityId}`).join(", ")}`);
    }
    if (diff.removedRelationships.length > 0) {
      parts.push(`Disconnected: ${diff.removedRelationships.map((r) => `${r.sourceEntityId} -x- ${r.targetEntityId}`).join(", ")}`);
    }

    if (parts.length > 0) {
      return parts.join(". ") + ".";
    }
  }

  // Fall back to semantic transformation model
  return (
    transformation.whatChanged ||
    transformation.action ||
    `Step ${transformation.stepNumber} executed.`
  );
}

// ============================================================================
// Local "Why?" Causal Chain Explanations
// ============================================================================

export function deriveWhyExplanation(
  transformation: ConceptTransformation,
  model: ConceptModel,
): string {
  const parts: string[] = [];

  if (transformation.cause) {
    parts.push(`Cause: ${transformation.cause}`);
  }
  if (transformation.reason) {
    parts.push(transformation.reason);
  }
  if (transformation.mechanism) {
    parts.push(`Mechanism: ${transformation.mechanism}`);
  }
  if (transformation.consequence) {
    parts.push(`Consequence: ${transformation.consequence}`);
  }

  // Check explicit causal chains in the model
  if (model.causalRelationships) {
    const relevantCausal = model.causalRelationships.find(
      (c) => c.transformationId === transformation.id,
    );
    if (relevantCausal) {
      parts.push(`Direct causal rule: ${relevantCausal.cause} -> ${relevantCausal.effect} (${relevantCausal.mechanism})`);
    }
  }

  return parts.filter(Boolean).join(" ") || "Advances algorithmic state toward target invariant.";
}

// ============================================================================
// Local Counterexample Generator
// ============================================================================

export interface CounterexampleResult {
  ruleViolated: string;
  counterexampleScenario: string;
  observableConsequence: string;
}

export function generateCounterexample(model: ConceptModel): CounterexampleResult {
  const primaryInvariant = model.invariants[0];
  if (!primaryInvariant) {
    return {
      ruleViolated: "Monotonic State Progression",
      counterexampleScenario: "An operation modifies downstream connections before establishing upstream references.",
      observableConsequence: "Memory leakage or unreachable orphaned sub-elements occur.",
    };
  }

  return {
    ruleViolated: primaryInvariant.rule,
    counterexampleScenario: `If the system omitted invariant "${primaryInvariant.rule}" during transformation:`,
    observableConsequence: `The concept enters an invalid state: ${primaryInvariant.description}`,
  };
}

// ============================================================================
// Local Parameter Mutation ("What If?")
// ============================================================================

export interface ParameterMutationResult {
  modifiedParam: string;
  originalValue: unknown;
  newValue: unknown;
  affectedEntityIds: string[];
  semanticPrediction: string;
}

export function evaluateParameterMutation(
  paramName: string,
  newValue: unknown,
  model: ConceptModel,
): ParameterMutationResult {
  // Find if an entity or property matches
  const matchingEntity = model.entities.find(
    (e) => e.label.toLowerCase() === paramName.toLowerCase() || e.id === paramName,
  );

  const affected: string[] = matchingEntity ? [matchingEntity.id] : [];
  if (matchingEntity) {
    // Collect entities connected to it
    for (const rel of model.relationships) {
      if (rel.sourceEntityId === matchingEntity.id) affected.push(rel.targetEntityId);
      if (rel.targetEntityId === matchingEntity.id) affected.push(rel.sourceEntityId);
    }
  }

  return {
    modifiedParam: paramName,
    originalValue: matchingEntity?.value ?? "default",
    newValue,
    affectedEntityIds: Array.from(new Set(affected)),
    semanticPrediction: `Mutating ${paramName} to ${String(newValue)} affects ${affected.length} connected entities and triggers re-evaluation of invariants.`,
  };
}

// ============================================================================
// Dynamic Practice Generator & Verifier
// ============================================================================

export interface ActivePracticeItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function derivePracticeItem(
  model: ConceptModel,
  stepIndex: number,
): ActivePracticeItem {
  if (model.practiceOpportunities && model.practiceOpportunities.length > 0) {
    const opp = model.practiceOpportunities[stepIndex % model.practiceOpportunities.length];
    return {
      id: opp.id,
      question: opp.prompt,
      options: opp.options || [
        "Maintains invariant correctness",
        "Breaks connection flow",
        "Duplicates node without updating pointers",
        "Resets system state",
      ],
      correctIndex: opp.correctOptionIndex ?? 0,
      explanation: opp.explanation,
    };
  }

  // Derive dynamically from current transformation
  const t = model.transformations[stepIndex] || model.transformations[0];
  const nextT = model.transformations[stepIndex + 1];

  if (nextT) {
    return {
      id: `practice-predict-${t.id}`,
      question: `After "${t.title}", what is the next logical action required in ${model.concept}?`,
      options: [
        nextT.action,
        "Immediately terminate the process",
        "Revert all previous transformations",
        "Arbitrarily disconnect remaining nodes",
      ],
      correctIndex: 0,
      explanation: nextT.reason || `Following "${t.title}", ${nextT.action} is necessary to advance toward completion.`,
    };
  }

  return {
    id: `practice-invariant-${model.concept}`,
    question: `Which fundamental invariant must remain true throughout ${model.concept}?`,
    options: [
      model.invariants[0]?.rule || "Every entity reference must point to a valid target",
      "Nodes must never change their states",
      "Pointers must always point in reverse order",
      "Operations must execute without checking constraints",
    ],
    correctIndex: 0,
    explanation: model.invariants[0]?.description || "Invariant rules guarantee structural and logical consistency.",
  };
}
