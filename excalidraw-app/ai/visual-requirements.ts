/**
 * Dynamic Visual Requirement Extraction — Cognora 6.0
 *
 * Derives WHAT the learner must see from:
 * - Question Understanding (intent, scope, depth, goal, requirements)
 * - Teaching Blueprint (core mechanism, causal chain, decisions, invariants)
 * - Authoritative Semantic Model (states, entities, relationships, diffs)
 *
 * Translates semantic pedagogical facts into explicit visual requirements.
 */

import type { QuestionUnderstandingResult } from "./question-understanding";
import type { TeachingBlueprint } from "./teaching-planner";
import type { AuthoritativeSemanticModel } from "./authoritative-model";
import { compoundComponents, type SemanticContext } from "./compound-components";
import type { SupportedLayoutStrategy } from "./visual-capabilities";

export interface VisualEntityRequirement {
  id: string;
  label: string;
  visualType: string;
  semanticRole: string;
  importance: "primary" | "secondary" | "background";
  persistent: boolean;
  value?: unknown;
  state?: string;
  properties?: Record<string, unknown>;
}

export interface VisualRelationshipRequirement {
  id: string;
  source: string;
  target: string;
  type: string;
  direction: "forward" | "backward" | "bidirectional" | "none";
  importance: "primary" | "secondary" | "temporary" | "background";
  label?: string;
  style?: "solid" | "dashed" | "dotted";
  color?: string;
}

export interface VisualEvidenceRequirement {
  claim: string;
  requiredEntityId?: string;
  expectedState?: string;
  expectedValue?: unknown;
  requiredConnection?: { from: string; to: string };
}

export interface VisualRequirements {
  concept: string;
  bestCompoundComponent: string;
  layoutStrategy: SupportedLayoutStrategy;
  requiredEntities: VisualEntityRequirement[];
  requiredRelationships: VisualRelationshipRequirement[];
  requiredStates: Array<{
    stateIndex: number;
    name: string;
    stateType: string;
    decisionBadge?: string;
    invariantBadges: string[];
  }>;
  causalFlows: Array<{
    sourceId: string;
    targetId: string;
    cause: string;
    consequence?: string;
  }>;
  evidenceRequirements: VisualEvidenceRequirement[];
  focus: {
    primaryFocusId?: string;
    secondaryFocusIds: string[];
    backgroundEntityIds: string[];
  };
  cognitiveLoad: {
    density: "low" | "medium" | "high" | "dense";
    maxPrimaryItems: number;
    omittedEntityIds: string[];
  };
}

/**
 * Universal extractor deriving visual requirements from pedagogical and semantic state.
 */
export function extractVisualRequirements(params: {
  understanding?: Partial<QuestionUnderstandingResult> & { concept?: string; [key: string]: any };
  blueprint?: TeachingBlueprint;
  model: AuthoritativeSemanticModel;
  stepIndex?: number;
}): VisualRequirements {
  const { understanding, blueprint, model, stepIndex = 0 } = params;
  const concept = understanding?.concept || model.problem.objective;
  const currentState = model.states[stepIndex] || model.states[0] || model.world.states[0];

  // 1. Build Semantic Context for Compound Component matching
  const hasCycles =
    blueprint?.coreMechanism?.type === "FEEDBACK_CONTROL" ||
    (blueprint?.causalChain || []).some((c) =>
      (blueprint?.causalChain || []).some((c2) => c2.sourceId === c.targetId && c2.targetId === c.sourceId),
    );

  const entArray = currentState ? Array.from(currentState.entities.values()) : model.world.entities;
  const relArray = currentState ? Array.from(currentState.relationships.values()) : model.world.relationships;

  const hasActors = entArray.some(
    (e) =>
      e.type === "Actor" ||
      e.semanticRole === "actor" ||
      e.semanticRole === "client" ||
      e.semanticRole === "server" ||
      /\b(client|server|peer|sender|receiver)\b/i.test(e.label || e.id),
  );

  const hasTreeHierarchy =
    relArray.some((r) => r.type === "parentOf" || r.type === "childOf") ||
    entArray.some((e) => e.type === "TreeNode" || e.semanticRole === "root" || e.semanticRole === "leaf");

  const hasMemoryPointers =
    relArray.some((r) => r.type === "pointsTo" || r.type === "reference") ||
    entArray.some((e) => e.type === "MemoryBlock" || e.type === "Pointer" || e.semanticRole === "pointer");

  const hasTabularData =
    entArray.some((e) => e.type === "Table" || e.type === "Database") ||
    /\b(table|database|sql|record)\b/i.test(concept);

  const hasScientificRays =
    entArray.some((e) => e.type === "Ray" || e.type === "Particle") ||
    /\b(refraction|ray|optics|light|wave|photon)\b/i.test(concept);

  const hasCallStack =
    entArray.some((e) => e.type === "CallFrame" || e.type === "StackFrame") ||
    /\b(recursion|call stack|stack frame)\b/i.test(concept);

  const hasDecisions =
    (model.decisions && model.decisions.length > 0) ||
    model.states.some((s) => s.activeDecision !== undefined || s.stateType === "decision");

  const semCtx: SemanticContext = {
    concept,
    intent: understanding?.userIntent,
    entityCount: entArray.length,
    hasCycles,
    hasActors,
    hasTreeHierarchy,
    hasOrderedSequence: understanding?.scope === "interaction" || understanding?.scope === "end-to-end",
    hasDecisions,
    hasMemoryPointers,
    hasTabularData,
    hasScientificRays,
    hasCallStack,
    hasInputOutput: /\b(input|output|encoder|decoder|transform)\b/i.test(concept),
    hasComparison: understanding?.userIntent === "COMPARE",
  };

  // 2. Determine best compound component and layout strategy
  const matchedCompound = compoundComponents.findBestMatch(semCtx);
  const layoutStrategy: SupportedLayoutStrategy = matchedCompound.supportedLayout;

  // 3. Classify entity visual importance & persistence
  const requiredEntities: VisualEntityRequirement[] = [];
  const primaryFocusId =
    stepIndex > 0 && model.transformations[stepIndex - 1]?.affectedEntities?.[0]
      ? model.transformations[stepIndex - 1].affectedEntities[0]
      : entArray[0]?.id;

  const secondaryFocusIds: string[] = [];
  const backgroundEntityIds: string[] = [];

  for (const ent of entArray) {
    let importance: "primary" | "secondary" | "background" = "secondary";
    const isAffected =
      stepIndex > 0 &&
      model.transformations[stepIndex - 1]?.affectedEntities?.includes(ent.id);

    if (ent.id === primaryFocusId || isAffected) {
      importance = "primary";
    } else if (ent.semanticRole === "root" || ent.semanticRole === "actor" || ent.semanticRole === "server") {
      importance = "primary";
    } else if (ent.semanticRole === "background" || ent.properties?.background === true) {
      importance = "background";
      backgroundEntityIds.push(ent.id);
    } else {
      secondaryFocusIds.push(ent.id);
    }

    // Determine visual primitive type from semantic cues
    let visualType = "Node";
    if (ent.type === "TreeNode" || hasTreeHierarchy) visualType = "TreeNode";
    else if (ent.type === "ArrayCell" || /\barray\b/i.test(concept)) visualType = "ArrayCell";
    else if (ent.type === "Client" || /\bclient\b/i.test(ent.id)) visualType = "Client";
    else if (ent.type === "Server" || /\bserver\b/i.test(ent.id)) visualType = "Server";
    else if (ent.type === "CallFrame" || hasCallStack) visualType = "CallFrame";
    else if (ent.type === "MemoryBlock" || hasMemoryPointers) visualType = "MemoryBlock";
    else if (ent.type === "Table" || hasTabularData) visualType = "Table";
    else if (ent.type === "Ray" || hasScientificRays) visualType = "Ray";
    else if (ent.type === "Decision" || ent.semanticRole === "decision") visualType = "Decision";
    else if (ent.type === "GraphNode") visualType = "GraphNode";

    const isPersistent = ent.properties?.persistence !== "temporary" && ent.semanticRole !== "message";

    requiredEntities.push({
      id: ent.id,
      label: ent.label || ent.id,
      visualType,
      semanticRole: ent.semanticRole || "component",
      importance,
      persistent: isPersistent,
      value: ent.value,
      state: ent.state,
      properties: ent.properties,
    });
  }

  // 4. Classify relationship importance
  const requiredRelationships: VisualRelationshipRequirement[] = [];
  for (const rel of relArray) {
    let relImportance: "primary" | "secondary" | "temporary" | "background" = "secondary";
    if (rel.properties?.importance === "primary" || rel.type === "causes" || rel.type === "sends") {
      relImportance = "primary";
    } else if (rel.properties?.importance === "background") {
      relImportance = "background";
    } else if (rel.properties?.temporary === true) {
      relImportance = "temporary";
    }

    requiredRelationships.push({
      id: rel.id,
      source: rel.source,
      target: rel.target,
      type: rel.type,
      direction: rel.direction || "forward",
      importance: relImportance,
      label: rel.label,
      style: rel.properties?.style as any,
      color: (rel.properties as any)?.color,
    });
  }

  // 5. Causal Flows & Evidence Requirements
  const causalFlows: Array<{ sourceId: string; targetId: string; cause: string }> = [];
  for (const rel of relArray) {
    if (rel.type === "causes" || rel.category === "causes") {
      causalFlows.push({
        sourceId: rel.source,
        targetId: rel.target,
        cause: rel.label || "Causal dependency",
      });
    }
  }

  const evidenceRequirements: VisualEvidenceRequirement[] = [];
  if (stepIndex > 0 && model.transformations[stepIndex - 1]) {
    const t = model.transformations[stepIndex - 1];
    evidenceRequirements.push({
      claim: t.title,
      requiredEntityId: t.affectedEntities?.[0],
      expectedState: t.stateType,
    });

    if (t.postconditions && t.postconditions.length > 0) {
      for (const post of t.postconditions) {
        evidenceRequirements.push({ claim: post });
      }
    }
  }

  // 6. Cognitive Load Estimation
  const density: "low" | "medium" | "high" | "dense" =
    entArray.length <= 4
      ? "low"
      : entArray.length <= 8
      ? "medium"
      : entArray.length <= 14
      ? "high"
      : "dense";

  return {
    concept,
    bestCompoundComponent: matchedCompound.id,
    layoutStrategy,
    requiredEntities,
    requiredRelationships,
    requiredStates: model.states.map((s, idx) => ({
      stateIndex: idx,
      name: s.name || `State ${idx}`,
      stateType: s.stateType || "normal",
      decisionBadge: s.activeDecision ? `Decision: ${s.activeDecision.condition}` : undefined,
      invariantBadges: (model.invariants || []).slice(0, 2).map((inv) => inv.statement),
    })),
    causalFlows,
    evidenceRequirements,
    focus: {
      primaryFocusId,
      secondaryFocusIds,
      backgroundEntityIds,
    },
    cognitiveLoad: {
      density,
      maxPrimaryItems: density === "dense" ? 6 : 10,
      omittedEntityIds: density === "dense" ? backgroundEntityIds : [],
    },
  };
}
