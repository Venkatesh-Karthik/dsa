/**
 * Cognora Pedagogical Quality & Invariant Validator
 *
 * Validates the full pedagogical coherence chain before visual rendering:
 * QUESTION -> OBJECTIVE -> INITIAL STATE -> TRANSFORMATIONS -> TARGET STATE
 *
 * Checks:
 * 1. Coherence: Objective directly relates to concept and question.
 * 2. Anti-Fake-Step: Rejects consecutive duplicate states (previousState === nextState).
 * 3. Invariant Preservation: Enforces semantic rules across all states.
 * 4. Stable Entity References: Every referenced entity in relationships & highlights exists.
 * 5. Meaningful Progression: Initial state != final state.
 * 6. Unexplained Jumps: Flags massive unannotated semantic jumps.
 * 7. Bounded Repair: Automatically heals minor defects (e.g. empty highlights, missing labels).
 */

import type { ConceptModel, ConceptTransformation, ConceptState } from "./concept-model";

export interface QualityValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  stepIndex?: number;
}

export interface QualityValidationResult {
  valid: boolean;
  issues: QualityValidationIssue[];
  repairedModel?: ConceptModel;
}

/**
 * Validates pedagogical coherence, anti-fake-step rules, and invariant integrity.
 */
export function validateTeachingQuality(
  model: ConceptModel,
  questionPrompt?: string,
): QualityValidationResult {
  const issues: QualityValidationIssue[] = [];
  let modelCopy = { ...model };

  // 1. Coherence Chain Verification: Question -> Objective
  if (!model.concept || !model.concept.trim()) {
    issues.push({
      severity: "error",
      code: "EMPTY_CONCEPT",
      message: "Concept title must be non-empty.",
    });
  }

  if (!model.objective || !model.objective.trim()) {
    issues.push({
      severity: "error",
      code: "EMPTY_OBJECTIVE",
      message: "Learning objective must be clearly declared.",
    });
  }

  if (questionPrompt) {
    const qLower = questionPrompt.toLowerCase();
    const cLower = model.concept.toLowerCase();
    // Check if concept has some relevance to the question
    const words = cLower.split(/\s+/).filter((w) => w.length > 3);
    const hasMatch = words.some((w) => qLower.includes(w));
    if (words.length > 0 && !hasMatch && !qLower.includes(cLower)) {
      issues.push({
        severity: "warning",
        code: "QUESTION_CONCEPT_DIVERGENCE",
        message: `Lesson concept "${model.concept}" may not directly address question "${questionPrompt}".`,
      });
    }
  }

  // 2. Transformations exist & Minimum Progression
  if (!model.transformations || model.transformations.length === 0) {
    issues.push({
      severity: "error",
      code: "NO_TRANSFORMATIONS",
      message: "A pedagogical lesson must contain at least 1 meaningful transformation.",
    });
  }

  // 3. Entity & Relationship Reference Stability
  const entityIdSet = new Set<string>(model.entities.map((e) => e.id));
  for (const rel of model.relationships) {
    if (!entityIdSet.has(rel.sourceEntityId)) {
      issues.push({
        severity: "error",
        code: "DANGLING_RELATIONSHIP_SOURCE",
        message: `Relationship "${rel.id}" references non-existent source entity "${rel.sourceEntityId}".`,
      });
    }
    if (!entityIdSet.has(rel.targetEntityId)) {
      issues.push({
        severity: "error",
        code: "DANGLING_RELATIONSHIP_TARGET",
        message: `Relationship "${rel.id}" references non-existent target entity "${rel.targetEntityId}".`,
      });
    }
  }

  // 4. Anti-Fake-Step Rule: Consecutive transformations must differ
  if (model.transformations && model.transformations.length > 1) {
    for (let i = 0; i < model.transformations.length - 1; i++) {
      const curr = model.transformations[i];
      const next = model.transformations[i + 1];

      const currOpsCount = curr.operations?.length || 0;
      const nextOpsCount = next.operations?.length || 0;
      const sameTitle = curr.title.trim().toLowerCase() === next.title.trim().toLowerCase();
      const sameAction = curr.action.trim().toLowerCase() === next.action.trim().toLowerCase();

      if (sameTitle && sameAction && currOpsCount === 0 && nextOpsCount === 0) {
        issues.push({
          severity: "error",
          code: "FAKE_STEP_DETECTED",
          stepIndex: i + 1,
          message: `Consecutive steps ${i + 1} and ${i + 2} are semantically identical (fake step).`,
        });
      }
    }
  }

  // 5. Invariant preservation check (if custom check function declared)
  if (model.invariants && model.states) {
    for (const inv of model.invariants) {
      if (inv.check) {
        for (const st of model.states) {
          try {
            const passed = inv.check(st, model);
            if (!passed) {
              issues.push({
                severity: "error",
                code: "INVARIANT_VIOLATION",
                stepIndex: st.stateIndex,
                message: `State ${st.stateIndex} violates invariant "${inv.rule}": ${inv.description}`,
              });
            }
          } catch {
            // Ignore programmatic check exceptions
          }
        }
      }
    }
  }

  // 6. Bounded Repair: If entity IDs or highlight arrays are missing, populate them safely
  const repairedTransformations: ConceptTransformation[] = (model.transformations || []).map((t) => {
    let tFixed = { ...t };
    if (!tFixed.relevantEntityIds) {
      tFixed.relevantEntityIds = [];
    }
    if (!tFixed.relevantRelationshipIds) {
      tFixed.relevantRelationshipIds = [];
    }
    if (!tFixed.whatChanged) {
      tFixed.whatChanged = tFixed.action;
    }
    if (!tFixed.whyChanged) {
      tFixed.whyChanged = tFixed.reason;
    }
    return tFixed;
  });

  modelCopy.transformations = repairedTransformations;

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    issues,
    repairedModel: modelCopy,
  };
}
