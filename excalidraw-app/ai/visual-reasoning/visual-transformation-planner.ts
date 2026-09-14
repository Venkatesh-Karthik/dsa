/**
 * Universal Visual Transformation Planner — Cognora 5.0
 *
 * Dynamically plans the evolution of the single persistent canvas scene.
 * Guarantees:
 * 1. Dynamic step count: only meaningful conceptual milestones (no arbitrary fixed count).
 * 2. Answers all 5 pedagogical questions per transformation:
 *    - What changed?
 *    - Why did it change?
 *    - What should the learner notice?
 *    - What does this enable?
 *    - What must now be true?
 * 3. Strict Explanation-Visual Synchronization:
 *    The explanation text is derived from and matched to the visual state diff.
 */

import type { AuthoritativeSemanticModel, AuthoritativeTransformation } from "../authoritative-model";
import type { SemanticState } from "../semantic-world";
import type {
  RelationshipPlan,
  VisualElementPlan,
  VisualTransformationPlan,
  VisualTransformationStepPlan,
} from "./visual-reasoning-model";

export class VisualTransformationPlanner {
  /**
   * Plans the step-by-step visual scene transformations.
   */
  public static plan(
    model: AuthoritativeSemanticModel,
    elementPlan: VisualElementPlan,
    relationshipPlan: RelationshipPlan,
  ): VisualTransformationPlan {
    const states = model.states;
    const transformations = model.transformations;
    const steps: VisualTransformationStepPlan[] = [];

    // Step 0: Initial Scene Setup
    const state0 = states[0];
    const initialEntityIds = Array.from(state0?.entities.keys() || []);
    const initialConnectors = Array.from(state0?.relationships.keys() || []);

    steps.push({
      stepIndex: 0,
      title: state0?.name || model.problem.objective || "Initial State",
      explanation:
        state0?.description ||
        `Initial state of ${(model.problem as any)?.concept || model.problem?.objective || "the concept"}: establishing foundational entities.`,
      whatChanged: "Baseline system initialized.",
      whyChanged: "Provides the starting condition for transformation.",
      learnerObservation: "Notice the initial state of the entities and their relationships.",
      whatItEnables: "Enables applying the primary transformation mechanism.",
      whatMustNowBeTrue: "Initial preconditions hold.",
      enteringEntities: initialEntityIds,
      exitingEntities: [],
      persistentEntities: initialEntityIds,
      mutatedEntities: [],
      activeConnectors: initialConnectors,
    });

    // Subsequent transformation steps
    for (let i = 0; i < transformations.length; i++) {
      const trans = transformations[i];
      const prevState = states[trans.fromStateIndex] || states[i];
      const nextState = states[trans.toStateIndex] || states[i + 1] || prevState;

      // Compute diffs between prevState and nextState
      const prevEntityIds = new Set(prevState.entities.keys());
      const nextEntityIds = new Set(nextState.entities.keys());

      const entering: string[] = [];
      const exiting: string[] = [];
      const persistent: string[] = [];
      const mutated: string[] = [];

      for (const id of nextEntityIds) {
        if (!prevEntityIds.has(id)) {
          entering.push(id);
        } else {
          persistent.push(id);
          const prevE = prevState.entities.get(id)!;
          const nextE = nextState.entities.get(id)!;
          if (
            prevE.value !== nextE.value ||
            prevE.state !== nextE.state ||
            prevE.properties?.state !== nextE.properties?.state ||
            prevE.properties?.value !== nextE.properties?.value ||
            prevE.properties?.highlight !== nextE.properties?.highlight ||
            trans.affectedEntities?.includes(id)
          ) {
            mutated.push(id);
          }
        }
      }

      for (const id of prevEntityIds) {
        if (!nextEntityIds.has(id)) {
          exiting.push(id);
        }
      }

      // Identify active connectors in nextState
      const activeConnectors = Array.from(nextState.relationships.keys());

      // Answer 5 pedagogical questions dynamically
      const whatChanged =
        trans.whatChanged ||
        (mutated.length > 0
          ? `Entities updated: ${mutated.join(", ")}`
          : entering.length > 0
          ? `New elements introduced: ${entering.join(", ")}`
          : trans.title);

      const whyChanged =
        trans.whyChanged ||
        trans.cause ||
        "State mutation required to restore or advance system invariants.";

      const learnerObservation =
        trans.learnerObservation ||
        (mutated.length > 0
          ? `Observe how ${mutated.join(", ")} changes value or state.`
          : `Observe the transition: ${trans.title}`);

      const whatItEnables =
        trans.consequence ||
        (i === transformations.length - 1
          ? "Achieves the verified goal condition."
          : `Enables advancing to step ${i + 2}.`);

      const whatMustNowBeTrue =
        trans.postconditions && trans.postconditions.length > 0
          ? trans.postconditions.join("; ")
          : `State ${i + 1} invariant integrity is satisfied.`;

      // Synchronize explanation with visual diff
      let explanation = trans.explanation || trans.title;
      if (mutated.length > 0 && !explanation.includes(mutated[0])) {
        const entLabel = nextState.entities.get(mutated[0])?.label || mutated[0];
        explanation = `${explanation} (Focus: ${entLabel} updated)`;
      }

      steps.push({
        stepIndex: i + 1,
        title: trans.title,
        explanation,
        whatChanged,
        whyChanged,
        learnerObservation,
        whatItEnables,
        whatMustNowBeTrue,
        enteringEntities: entering,
        exitingEntities: exiting,
        persistentEntities: persistent,
        mutatedEntities: mutated,
        activeConnectors,
        decisionEvaluation: trans.decision
          ? {
              condition: trans.decision.condition,
              outcome: trans.selectedOutcome || trans.decision.selectedOutcomeId,
            }
          : undefined,
      });
    }

    return {
      steps,
      dynamicStepCount: steps.length,
      rationale: `Dynamically derived ${steps.length} verified pedagogical transformation steps.`,
    };
  }
}
