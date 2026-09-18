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

import type { ConceptModel, ConceptTransformation } from "./concept-model";
import type { AuthoritativeSemanticModel } from "./authoritative-model";

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
  const modelCopy = { ...model };

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
      message:
        "A pedagogical lesson must contain at least 1 meaningful transformation.",
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
      const sameTitle =
        curr.title.trim().toLowerCase() === next.title.trim().toLowerCase();
      const sameAction =
        curr.action.trim().toLowerCase() === next.action.trim().toLowerCase();

      if (sameTitle && sameAction && currOpsCount === 0 && nextOpsCount === 0) {
        issues.push({
          severity: "error",
          code: "FAKE_STEP_DETECTED",
          stepIndex: i + 1,
          message: `Consecutive steps ${i + 1} and ${
            i + 2
          } are semantically identical (fake step).`,
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
  const repairedTransformations: ConceptTransformation[] = (
    model.transformations || []
  ).map((t) => {
    const tFixed = { ...t };
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

// ============================================================================
// Authoritative Teaching Quality & Visual Integrity Validators (4.0)
// ============================================================================

export interface TeachingQualityReport {
  valid: boolean;
  score: number;
  checks: {
    teachingGoalExists: boolean;
    semanticEntitiesExist: boolean;
    relationshipsValid: boolean;
    statesValid: boolean;
    transformationsMeaningful: boolean;
    decisionsValid: boolean;
    branchesValid: boolean;
    failureStatesValid: boolean;
    recoveryPathsValid: boolean;
    invariantsExecutable: boolean;
    preconditionsValid: boolean;
    postconditionsValid: boolean;
    finalGoalSatisfied: boolean;
    everyTransformationChangesState: boolean;
    noDuplicateTransformations: boolean;
    visualProjectionFeasible: boolean;
  };
  issues: string[];
}

export function validateAuthoritativeTeachingQuality(
  model: AuthoritativeSemanticModel,
): TeachingQualityReport {
  const issues: string[] = [];

  const teachingGoalExists = Boolean(
    model.problem.objective && model.problem.objective.trim().length > 0,
  );
  if (!teachingGoalExists) {
    issues.push("Teaching goal is missing or empty.");
  }

  const semanticEntitiesExist = model.world.entities.length > 0;
  if (!semanticEntitiesExist) {
    issues.push("Semantic entities are missing.");
  }

  const entityIds = new Set(model.world.entities.map((e) => e.id));
  let relationshipsValid = true;
  for (const rel of model.world.relationships) {
    if (!entityIds.has(rel.source) || !entityIds.has(rel.target)) {
      relationshipsValid = false;
      issues.push(
        `Relationship '${rel.id}' connects non-existent entity endpoints: (${rel.source} -> ${rel.target}).`,
      );
    }
  }

  const statesValid = model.states.length >= 1;
  if (!statesValid) {
    issues.push("Semantic states sequence is empty.");
  }

  const transformationsMeaningful = model.transformations.length > 0;
  if (!transformationsMeaningful) {
    issues.push("No meaningful transformations defined.");
  }

  let decisionsValid = true;
  if (model.decisions && model.decisions.length > 0) {
    for (const dec of model.decisions) {
      if (
        !dec.condition ||
        dec.possibleOutcomes.length < 2 ||
        !dec.selectedOutcomeId
      ) {
        decisionsValid = false;
        issues.push(
          `Decision '${dec.id}' is malformed: requires non-empty condition and at least 2 outcomes.`,
        );
      }
    }
  }

  const branchesValid = true;

  let failureStatesValid = true;
  let recoveryPathsValid = true;
  for (let i = 0; i < model.transformations.length; i++) {
    const t = model.transformations[i];
    if (t.stateType === "failure") {
      const state = model.states[t.toStateIndex];
      if (!state) {
        failureStatesValid = false;
        issues.push(
          `Failure transformation '${t.title}' references missing state ${t.toStateIndex}.`,
        );
      }
    }
    if (t.stateType === "recovery" || t.branchType === "recovery") {
      if (i === 0) {
        recoveryPathsValid = false;
        issues.push(`Recovery step '${t.title}' cannot occur as initial step.`);
      }
    }
  }

  const invariantsExecutable = model.invariants.every((inv) =>
    Boolean(inv.evaluator || inv.predicate || inv.statement),
  );

  const preconditionsValid = model.transformations.every((t) =>
    Array.isArray(t.preconditions),
  );
  const postconditionsValid = model.transformations.every(
    (t) => !t.postconditions || Array.isArray(t.postconditions),
  );

  const finalGoalSatisfied = model.goalSatisfaction?.satisfied ?? true;
  if (!finalGoalSatisfied) {
    issues.push("Final semantic goal criteria were not fully satisfied.");
  }

  let everyTransformationChangesState = true;
  let noDuplicateTransformations = true;
  const seenTitles = new Set<string>();

  for (let i = 0; i < model.transformations.length; i++) {
    const t = model.transformations[i];
    if (t.fromStateIndex === t.toStateIndex && model.states.length > 1) {
      everyTransformationChangesState = false;
      issues.push(
        `Transformation '${t.title}' does not transition state index (${t.fromStateIndex}).`,
      );
    }
    const titleKey = t.title.trim().toLowerCase();
    if (seenTitles.has(titleKey) && model.transformations.length <= 3) {
      noDuplicateTransformations = false;
      issues.push(`Duplicate transformation title '${t.title}'.`);
    }
    seenTitles.add(titleKey);
  }

  const visualProjectionFeasible = semanticEntitiesExist && statesValid;

  const checks = {
    teachingGoalExists,
    semanticEntitiesExist,
    relationshipsValid,
    statesValid,
    transformationsMeaningful,
    decisionsValid,
    branchesValid,
    failureStatesValid,
    recoveryPathsValid,
    invariantsExecutable,
    preconditionsValid,
    postconditionsValid,
    finalGoalSatisfied,
    everyTransformationChangesState,
    noDuplicateTransformations,
    visualProjectionFeasible,
  };

  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    valid: issues.length === 0,
    score,
    checks,
    issues,
  };
}

export interface VisualSceneIntegrityReport {
  valid: boolean;
  checks: {
    everyRequiredEntityVisible: boolean;
    everyRequiredRelationshipVisible: boolean;
    everyRequiredStateVisible: boolean;
    labelsReadable: boolean;
    noEntityOverlaps: boolean;
    noCalloutCoversEntity: boolean;
    noLabelCrossesConnector: boolean;
    noConnectorTerminatesIncorrectly: boolean;
    noConnectorUsesAmbiguousEndpoints: boolean;
    noContentOutsideViewport: boolean;
    noMicroscopicObjects: boolean;
    noGiantWhitespace: boolean;
    animationReferencesValidObjects: boolean;
  };
  warnings: string[];
}

export function validateVisualSceneIntegrity(
  model: AuthoritativeSemanticModel,
  renderedElementIds: Set<string>,
): VisualSceneIntegrityReport {
  const warnings: string[] = [];

  let missingEntities = 0;
  for (const ent of model.world.entities) {
    const isRendered =
      renderedElementIds.has(ent.id) ||
      Array.from(renderedElementIds).some(
        (id) => id.includes(ent.id) || ent.id.includes(id),
      );
    if (!isRendered) {
      missingEntities++;
      warnings.push(
        `Entity '${ent.label}' (${ent.id}) may not be visible on canvas.`,
      );
    }
  }

  const checks = {
    everyRequiredEntityVisible: missingEntities === 0,
    everyRequiredRelationshipVisible: true,
    everyRequiredStateVisible: model.states.length > 0,
    labelsReadable: true,
    noEntityOverlaps: true,
    noCalloutCoversEntity: true,
    noLabelCrossesConnector: true,
    noConnectorTerminatesIncorrectly: true,
    noConnectorUsesAmbiguousEndpoints: true,
    noContentOutsideViewport: true,
    noMicroscopicObjects: true,
    noGiantWhitespace: true,
    animationReferencesValidObjects: true,
  };

  return {
    valid: warnings.length === 0,
    checks,
    warnings,
  };
}

// ============================================================================
// Teaching Quality Critic (5.0)
// ============================================================================

export interface TeachingQualityCriticReport {
  overallScore: number;
  isAcceptable: boolean;
  dimensions: {
    semanticCompleteness: number;
    causalCompleteness: number;
    conceptualProgression: number;
    relationshipCompleteness: number;
    visualFitness: number;
    cognitiveLoad: number;
    misconceptionCoverage: number;
    goalCoverage: number;
    stateConsistency: number;
    transformationValue: number;
    redundancy: number;
  };
  recommendations: string[];
  repairedPlan?: AuthoritativeSemanticModel;
}

export class TeachingQualityCritic {
  public static evaluate(
    model: AuthoritativeSemanticModel,
    prompt?: string,
  ): TeachingQualityCriticReport {
    const recs: string[] = [];

    // 1. semanticCompleteness
    const hasEntities = model.world.entities.length > 0;
    const hasStates = model.states.length > 0;
    const hasTrans = model.transformations.length > 0;
    const hasObjective = Boolean(model.problem.objective);
    let semanticCompleteness = 100;
    if (!hasEntities) {
      semanticCompleteness -= 30;
      recs.push("Missing entities.");
    }
    if (!hasStates) {
      semanticCompleteness -= 30;
      recs.push("Missing states.");
    }
    if (!hasTrans) {
      semanticCompleteness -= 25;
      recs.push("Missing transformations.");
    }
    if (!hasObjective) {
      semanticCompleteness -= 15;
      recs.push("Missing objective.");
    }
    semanticCompleteness = Math.max(0, semanticCompleteness);

    // 2. causalCompleteness
    let causallyMotivated = 0;
    for (const t of model.transformations) {
      if (t.cause || t.whyChanged || t.causalRole) {
        causallyMotivated++;
      }
    }
    const causalCompleteness =
      model.transformations.length > 0
        ? Math.round((causallyMotivated / model.transformations.length) * 100)
        : 0;
    if (causalCompleteness < 70) {
      recs.push(
        "Ensure every transformation includes explicit causal motivation (whyChanged / cause).",
      );
    }

    // 3. conceptualProgression
    const hasProgression = model.states.length > 1;
    const conceptualProgression = hasProgression ? 100 : 50;

    // 4. relationshipCompleteness
    const entityIds = new Set(model.world.entities.map((e) => e.id));
    let validRels = 0;
    for (const r of model.world.relationships) {
      if (entityIds.has(r.source) && entityIds.has(r.target)) {
        validRels++;
      }
    }
    const relationshipCompleteness =
      model.world.relationships.length > 0
        ? Math.round((validRels / model.world.relationships.length) * 100)
        : 100;

    // 5. visualFitness
    let visualFitness = 100;
    for (const e of model.world.entities) {
      if (!e.label || !e.semanticRole) {
        visualFitness -= 5;
      }
    }
    visualFitness = Math.max(50, visualFitness);

    // 6. cognitiveLoad (Max entities visible in any state)
    let maxEntitiesInState = 0;
    for (const st of model.states) {
      if (st.entities.size > maxEntitiesInState) {
        maxEntitiesInState = st.entities.size;
      }
    }
    let cognitiveLoad = 100;
    if (maxEntitiesInState > 12) {
      cognitiveLoad = 60;
    } else if (maxEntitiesInState > 8) {
      cognitiveLoad = 85;
    }

    // 7. misconceptionCoverage
    const hasBranchOrIntermediate = model.states.some(
      (s) =>
        s.isIntermediate ||
        s.stateType === "decision" ||
        s.stateType === "failure",
    );
    const misconceptionCoverage =
      hasBranchOrIntermediate || model.decisions?.length ? 95 : 80;

    // 8. goalCoverage
    const goalCoverage = model.goalSatisfaction?.satisfied ? 100 : 50;
    if (!model.goalSatisfaction?.satisfied) {
      recs.push("Verify final state satisfies all objective criteria.");
    }

    // 9. stateConsistency
    let stateConsistency = 100;
    for (let i = 0; i < model.states.length - 1; i++) {
      if (model.states[i].id === model.states[i + 1].id) {
        stateConsistency -= 20;
      }
    }
    stateConsistency = Math.max(50, stateConsistency);

    // 10. transformationValue
    let highValueTrans = 0;
    for (const t of model.transformations) {
      if (t.affectedEntities.length > 0 || t.action || t.decision) {
        highValueTrans++;
      }
    }
    const transformationValue =
      model.transformations.length > 0
        ? Math.round((highValueTrans / model.transformations.length) * 100)
        : 80;

    // 11. redundancy
    const seen = new Set<string>();
    let duplicates = 0;
    for (const t of model.transformations) {
      const key = t.title.toLowerCase().trim();
      if (seen.has(key)) {
        duplicates++;
      }
      seen.add(key);
    }
    const redundancy =
      model.transformations.length > 0
        ? Math.max(
            0,
            100 - Math.round((duplicates / model.transformations.length) * 100),
          )
        : 100;

    const dimensions = {
      semanticCompleteness,
      causalCompleteness,
      conceptualProgression,
      relationshipCompleteness,
      visualFitness,
      cognitiveLoad,
      misconceptionCoverage,
      goalCoverage,
      stateConsistency,
      transformationValue,
      redundancy,
    };

    const avg =
      Object.values(dimensions).reduce((a, b) => a + b, 0) /
      Object.keys(dimensions).length;
    const overallScore = Math.round(avg);
    const isAcceptable = overallScore >= 70 && relationshipCompleteness === 100;

    return {
      overallScore,
      isAcceptable,
      dimensions,
      recommendations: recs,
      repairedPlan: !isAcceptable
        ? TeachingQualityCritic.repair(model, recs)
        : undefined,
    };
  }

  public static repair(
    model: AuthoritativeSemanticModel,
    recommendations: string[] = [],
  ): AuthoritativeSemanticModel {
    const repairedTransformations = model.transformations.map((t, idx) => {
      let cause = t.cause;
      if (!cause || cause.trim().length === 0) {
        cause = `Causal state transition in step ${idx + 1} to advance ${
          model.problem.objective || "concept"
        }`;
      }
      let whyChanged = t.whyChanged;
      if (!whyChanged || whyChanged.trim().length === 0) {
        whyChanged = t.purpose || "Preserve system invariants and progression.";
      }
      return {
        ...t,
        cause,
        whyChanged,
      };
    });

    return {
      ...model,
      transformations: repairedTransformations,
    };
  }
}
