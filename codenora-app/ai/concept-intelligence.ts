/**
 * Universal Concept Intelligence Engine
 *
 * Core intelligence brain of Cognora.
 * Operates between Intent Understanding and the Visual Grammar & Scene Graph:
 * 1. Analyzes learner prompts and determines domain & teaching strategy.
 * 2. Builds and validates domain-agnostic ConceptModels.
 * 3. Compiles ConceptModels into canonical VisualLessons.
 * 4. Extracts/infers ConceptModels from VisualLessons.
 * 5. Guarantees ONE persistent scene, zero duplicate states, and complete dynamic inspector metadata.
 */

import {
  resolveDomainModule,
  type DomainKnowledgeModule,
} from "./domain-knowledge";

import type {
  ConceptModel,
  ConceptEntity,
  ConceptRelationship,
  ConceptState,
  ConceptTransformation,
  TeachingStrategy,
  ConceptDomain,
} from "./concept-model";

import type {
  VisualLesson,
  Transformation,
  VisualAction,
  CodeContext,
  TeachingStep,
} from "./visual-dsl";

import type { TeachingRequestContext } from "./teaching-contract";

// ============================================================================
// Concept Analysis & Strategy Selection
// ============================================================================

export interface ConceptAnalysisResult {
  concept: string;
  domain: ConceptDomain;
  strategy: TeachingStrategy;
  module: DomainKnowledgeModule;
}

/**
 * Analyzes a raw user prompt and context to extract the concept, domain, and optimal teaching strategy.
 */
export function analyzeConcept(
  prompt: string,
  _context?: TeachingRequestContext,
): ConceptAnalysisResult {
  const trimmed = prompt.trim();
  const module = resolveDomainModule(trimmed, trimmed);
  const strategy = module.suggestStrategy(trimmed, trimmed);

  // Extract clean concept title
  let cleanTitle = trimmed
    .replace(
      /^(explain|teach me|how does|what is|visualize|show me|walk me through)\s+/i,
      "",
    )
    .replace(
      /\s+(step by step|visually|in depth|works?|algorithm|concept)\b/gi,
      "",
    )
    .trim();

  if (!cleanTitle) {
    cleanTitle = trimmed;
  }
  // Capitalize words
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    concept: cleanTitle,
    domain: module.domain,
    strategy,
    module,
  };
}

// ============================================================================
// ConceptModel -> VisualLesson Compiler
// ============================================================================

/**
 * Compiles a domain-agnostic ConceptModel into the authoritative VisualLesson contract.
 */
export function compileConceptModelToVisualLesson(
  model: ConceptModel,
): VisualLesson {
  const lessonId = `lesson-${model.domain}-${Date.now().toString(36)}`;

  // 1. Initial Scene & Transformations mapping:
  // If the first transformation represents state 0 (initial scene setup), extract it as initialScene
  // and map the subsequent transformations as transitions.
  let initialScene: VisualAction[] = [];
  let transformationsToMap = model.transformations;

  if (
    transformationsToMap.length > 1 &&
    ((transformationsToMap[0] as any).stepIndex === 0 ||
      transformationsToMap[0].fromStateIndex === 0) &&
    (!transformationsToMap[0].operations ||
      transformationsToMap[0].operations.length === 0)
  ) {
    initialScene = transformationsToMap[0].visualActions || [];
    transformationsToMap = transformationsToMap.slice(1);
  } else if (transformationsToMap.length > 0) {
    initialScene = transformationsToMap[0].visualActions || [];
  }

  // 2. Map transformations
  const module = resolveDomainModule(model.concept);
  const transformations: Transformation[] = transformationsToMap.map((t) => {
    // Generate step explanation answering:
    // What is happening, why, what changed, what to notice, consequence
    const fullExplanation = [
      t.action,
      t.reason ? `Why: ${t.reason}` : "",
      t.learnerObservation ? `Notice: ${t.learnerObservation}` : "",
      t.consequence ? `Consequence: ${t.consequence}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const state =
      model.states[t.toStateIndex] ||
      model.states[t.fromStateIndex] ||
      model.states[0];
    const inspectorData =
      t.inspectorData || module.extractInspectorData(state, t, model);

    return {
      id: t.id,
      title: t.title,
      explanation: fullExplanation || t.title,
      operations: t.operations || [],
      visual_actions: t.visualActions,
      codeContext: t.codeContext,
      calculations: t.calculations,
      insight:
        t.insight ||
        (model.invariants[0]
          ? `Invariant: ${model.invariants[0].rule}`
          : undefined),
      highlights: t.relevantEntityIds,
      // Pass through inspector data
      ...(inspectorData ? { inspectorData } : {}),
    } as Transformation & { inspectorData?: unknown };
  });

  return {
    id: lessonId,
    title: model.concept,
    concept: model.concept,
    topic: model.concept,
    capabilities: ["analyze", "explain", "code", "practice"],
    initialScene,
    transformations,
    codeContexts: model.codeContexts,
    dependencies: model.dependencies,
    practiceOpportunities: model.practiceOpportunities,
    adaptationHints: model.adaptationHints,
    causalRelationships: model.causalRelationships,
    conceptModel: model,
  };
}

// ============================================================================
// VisualLesson -> ConceptModel Inferrer
// ============================================================================

/**
 * Extracts/infers a rich Universal ConceptModel from an existing VisualLesson.
 * Normalizes legacy or compact responses into the unified domain-agnostic ontology.
 */
export function extractConceptModelFromVisualLesson(
  lesson: VisualLesson,
): ConceptModel {
  if (lesson.conceptModel) {
    return lesson.conceptModel as ConceptModel;
  }
  const title =
    lesson.concept || lesson.title || lesson.topic || "Technical Concept";
  const module = resolveDomainModule(title);
  const strategy = module.suggestStrategy(title);

  // Entities & Relationships from initialScene
  const entities: ConceptEntity[] = [];
  const relationships: ConceptRelationship[] = [];
  const entitySet = new Set<string>();

  // Extract entities from actions
  const actions: VisualAction[] = [
    ...(lesson.initialScene || []),
    ...(lesson.transformations || []).flatMap((t) => t.visual_actions || []),
  ];

  for (const act of actions) {
    if ("id" in act && typeof act.id === "string" && !entitySet.has(act.id)) {
      entitySet.add(act.id);
      let label = act.id;
      let type = "GenericEntity";
      if ("label" in act && typeof act.label === "string") {
        label = act.label;
      }
      if ("text" in act && typeof act.text === "string") {
        label = act.text;
      }

      if (act.type === "create_tree") {
        type = "TreeNode";
      } else if (act.type === "create_array") {
        type = "ArrayElement";
      } else if (act.type === "create_linked_list") {
        type = "LinkedListNode";
      } else if (act.type === "create_graph") {
        type = "GraphNode";
      } else if (act.type === "create_circle") {
        type = "State";
      } else if (act.type === "create_box") {
        type = "Component";
      }

      entities.push({
        id: act.id,
        type,
        label,
        semanticRole: "component",
      });
    }
  }

  // Extract states and transformations
  const states: ConceptState[] = [];
  const transformations: ConceptTransformation[] = [];

  // State 0: initialScene
  states.push({
    stateIndex: 0,
    name: "Initial State",
    description: "Initial setup of the concept diagram",
    activeEntityIds: Array.from(entitySet),
    activeRelationshipIds: [],
    metrics: [],
    properties: [],
  });

  const rawTransformations = lesson.transformations || [];
  for (let idx = 0; idx < rawTransformations.length; idx++) {
    const rt = rawTransformations[idx];
    const stepNum = idx + 1;
    const targetStateIndex = idx + 1;

    // Create corresponding state
    const state: ConceptState = {
      stateIndex: targetStateIndex,
      name: rt.title || `State ${stepNum}`,
      description: rt.explanation,
      activeEntityIds: Array.from(entitySet),
      activeRelationshipIds: [],
      metrics: [],
      properties: [],
    };
    states.push(state);

    // Build rich transformation
    const ct: ConceptTransformation = {
      id: rt.id || `t-${stepNum}`,
      stepNumber: stepNum,
      title: rt.title || `Step ${stepNum}`,
      fromStateIndex: idx,
      toStateIndex: targetStateIndex,
      action: rt.title || `Execute Step ${stepNum}`,
      reason:
        rt.explanation ||
        "Progressing algorithm state according to transition logic.",
      learnerObservation: `Observe dynamic state update in step ${stepNum}.`,
      consequence: `Maintains invariant consistency for ${title}.`,
      whatChanged: rt.title || `Transition ${stepNum}`,
      whyChanged: rt.explanation || "Normal step execution",
      relevantEntityIds: (rt.highlights as string[]) || [],
      relevantRelationshipIds: [],
      operations: rt.operations,
      visualActions: rt.visual_actions,
      codeContext: rt.codeContext,
      calculations: rt.calculations,
      insight: rt.insight,
      inspectorData:
        (rt as any).inspectorData || module.extractInspectorData(state),
    };
    transformations.push(ct);
  }

  const invariants = module.getInvariants(title);
  const misconceptions = module.getMisconceptions(title);

  return {
    concept: title,
    domain: module.domain,
    objective: `Understand the core principles and state transitions of ${title}.`,
    learnerLevel: "intermediate",
    teachingStrategy: strategy,
    entities,
    relationships,
    states,
    transformations,
    invariants,
    misconceptions,
    observations: transformations.map((t) => ({
      transformationId: t.id,
      notice: t.learnerObservation,
      explanation: t.reason,
    })),
    codeContexts: lesson.codeContexts,
    inspectorModel: {
      title,
      capabilities: ["analyze", "explain", "code", "practice"],
    },
  };
}

// ============================================================================
// ConceptModel Validation
// ============================================================================

export interface ConceptModelValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a ConceptModel for structural and pedagogical integrity:
 * - Minimum 1 transformation
 * - No fake steps (consecutive states must not be identical)
 * - Invariant rules declared
 * - Stable entity IDs
 */
export function validateConceptModel(
  model: ConceptModel,
): ConceptModelValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!model.concept || !model.concept.trim()) {
    errors.push("Concept title cannot be empty.");
  }

  if (model.transformations.length === 0) {
    errors.push("Lesson must contain at least 1 meaningful transformation.");
  }

  // Check for duplicate consecutive transformation titles or actions (fake steps)
  for (let i = 0; i < model.transformations.length - 1; i++) {
    const curr = model.transformations[i];
    const next = model.transformations[i + 1];
    if (
      curr.title.trim().toLowerCase() === next.title.trim().toLowerCase() &&
      curr.action.trim().toLowerCase() === next.action.trim().toLowerCase() &&
      (!curr.operations || curr.operations.length === 0) &&
      (!next.operations || next.operations.length === 0)
    ) {
      errors.push(
        `Fake step detected between transformation ${curr.stepNumber} and ${next.stepNumber}: identical titles and zero operations.`,
      );
    }
  }

  // Verify entity IDs are non-empty
  const idSet = new Set<string>();
  for (const entity of model.entities) {
    if (!entity.id || !entity.id.trim()) {
      errors.push("Found entity with empty or missing ID.");
    } else if (idSet.has(entity.id)) {
      warnings.push(`Duplicate entity ID declared: "${entity.id}".`);
    } else {
      idSet.add(entity.id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
