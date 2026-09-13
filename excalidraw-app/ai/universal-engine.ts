/**
 * Universal Concept Intelligence Engine (Root Layer)
 *
 * Coordinates the entire domain-agnostic semantic pipeline:
 * QUESTION
 * ↓ UNDERSTAND
 * ↓ FORMALIZE
 * ↓ MODEL
 * ↓ INVARIANTS & RULES
 * ↓ SOLVE
 * ↓ VERIFY (CorrectnessEngine & SemanticRepair)
 * ↓ AUTHORITATIVE SEMANTIC MODEL
 * ↓ EXPLAIN
 * ↓ VISUALIZE (GenericConceptGrammar fallback / VisualLesson)
 * ↓ LOCAL PLAYBACK & ADAPTATION
 */

import { understandQuestion, type QuestionUnderstandingResult } from "./question-understanding";
import { formalizeProblem, type ProblemModel } from "./problem-model";
import { createConfidence } from "./confidence-model";
import {
  type SemanticWorld,
  type SemanticState,
  type Entity,
  type Relationship,
  createSemanticState,
} from "./semantic-world";
import { InvariantEngine, type Invariant, type Rule } from "./rules-invariants";
import { SolutionEngine } from "./solution-engine";
import { CorrectnessEngine, SemanticRepairEngine } from "./correctness-engine";
import {
  type AuthoritativeSemanticModel,
  type AuthoritativeTransformation,
} from "./authoritative-model";
import { ExplanationEngine, type SemanticExplanation } from "./explanation-engine";
import { SemanticWorldGraph, WhyEngine } from "./world-graph";
import { CounterfactualEngine, type CounterfactualMutation, type CounterfactualResult } from "./counterfactual-engine";
import { ComparisonEngine, type SemanticComparisonReport } from "./comparison-engine";
import { VisualSemanticValidator } from "./visual-semantic-validator";
import { type VisualLesson, type VisualAction, type Transformation } from "./visual-dsl";
import { compileAuthoritativeTimeline, type CompiledTimeline } from "./transformation-timeline";
import { createSceneGraphFromActions } from "./scene-state";

export class UniversalConceptIntelligenceEngine {
  /**
   * Main entry point: Processes ANY educational question into an authoritative
   * validated semantic lesson with 100% local playback capabilities.
   */
  public static processQuestion(
    prompt: string,
    rawProposal?: {
      topic?: string;
      entities?: Entity[];
      relationships?: Relationship[];
      visual_actions?: VisualAction[];
      initialScene?: VisualAction[];
      initial_scene?: VisualAction[];
      visualLesson?: VisualLesson;
      visual_lesson?: VisualLesson;
      steps?: Array<{
        title: string;
        explanation: string;
        visual_actions?: VisualAction[];
        operations?: any[];
        calculations?: string;
        insight?: string;
      }>;
      transformations?: any[];
      invariants?: Array<{ statement?: string; description?: string; rule?: string }>;
      misconceptions?: any[];
    },
  ): {
    authoritativeModel: AuthoritativeSemanticModel;
    visualLesson: VisualLesson;
    worldGraph: SemanticWorldGraph;
    timeline: CompiledTimeline;
  } {
    // 1. Understand the Question
    const understanding = understandQuestion(prompt);

    // 2. Formalize the Problem
    const candidateEntities: Entity[] = [...(rawProposal?.entities || [])];
    const candidateRelationships: Relationship[] = [...(rawProposal?.relationships || [])];

    // Identify all sources of initial visual actions
    const initialActions: VisualAction[] =
      rawProposal?.visual_actions ||
      (rawProposal as any)?.initialScene ||
      (rawProposal as any)?.initial_scene ||
      (rawProposal as any)?.visualLesson?.initialScene ||
      (rawProposal as any)?.visualLesson?.initial_scene ||
      (rawProposal as any)?.steps?.[0]?.visual_actions ||
      [];

    // If no explicit semantic entities were provided in raw proposal, extract them universally from visual actions
    if (candidateEntities.length === 0 && initialActions.length > 0) {
      const parsedGraph = createSceneGraphFromActions(initialActions);
      for (const ent of parsedGraph.entities.values()) {
        candidateEntities.push({
          id: ent.id,
          type: ent.primitiveType || "GenericEntity",
          label: ent.label || ent.id,
          properties: ent.properties as any,
          state: ent.state,
          value: ent.value,
          semanticRole: ent.semanticRole || "component",
        });
      }
      for (const rel of parsedGraph.relationships.values()) {
        candidateRelationships.push({
          id: rel.id,
          source: rel.sourceEntityId,
          target: rel.targetEntityId,
          type: rel.type || "connects",
          direction: (rel.properties?.directed !== false) ? "forward" : "none",
          label: rel.label,
          properties: rel.properties || {},
        });
      }

      // Universal fallback for any action with an id not captured by scene graph
      for (const act of initialActions) {
        if ("id" in act && typeof (act as any).id === "string") {
          const actId = (act as any).id;
          if (!candidateEntities.some((e) => e.id === actId)) {
            const label =
              ("label" in act && typeof (act as any).label === "string"
                ? (act as any).label
                : "text" in act && typeof (act as any).text === "string"
                ? (act as any).text
                : actId) || actId;
            candidateEntities.push({
              id: actId,
              type: act.type.replace("create_", ""),
              label,
              properties: (act as any).style || {},
              semanticRole: (act as any).role || "component",
            });
          }
        }
      }
    }

    const problem = formalizeProblem(understanding, {
      entities: candidateEntities,
      relationships: candidateRelationships,
      objective: `Understand and verify ${understanding.concept}`,
    });

    // 3. Construct Semantic World
    const state0Entities = new Map<string, Entity>();
    candidateEntities.forEach((e) => state0Entities.set(e.id, { ...e }));
    const state0Rels = new Map<string, Relationship>();
    candidateRelationships.forEach((r) => state0Rels.set(r.id, { ...r }));

    const initialSemanticState = createSemanticState(0, "state-0", {
      name: `${understanding.concept} Baseline`,
      description: "Initial state of the concept",
      entities: state0Entities,
      relationships: state0Rels,
      properties: { phase: "initial" },
    });

    const states: SemanticState[] = [initialSemanticState];
    const rawTransformations: AuthoritativeTransformation[] = [];

    // If steps or transformations exist, map them into semantic states
    const rawSteps =
      rawProposal?.steps ||
      rawProposal?.transformations ||
      (rawProposal as any)?.visualLesson?.transformations ||
      (rawProposal as any)?.visual_lesson?.transformations ||
      [];

    let currentState = initialSemanticState;
    for (let i = 0; i < rawSteps.length; i++) {
      const s = rawSteps[i];
      const nextIndex = i + 1;

      // Mutate state for step
      const nextEntities = new Map<string, Entity>();
      for (const [id, e] of currentState.entities.entries()) {
        nextEntities.set(id, { ...e, properties: { ...e.properties } });
      }
      const nextRels = new Map<string, Relationship>();
      for (const [id, r] of currentState.relationships.entries()) {
        nextRels.set(id, { ...r, properties: r.properties ? { ...r.properties } : undefined });
      }

      // Mark affected entities from operations and visual actions
      const affectedEntities: string[] = [];

      // Combine operations and visual actions into a unified operational stream
      const allOperations = [...(s.operations || []), ...(s.visual_actions || [])];
      for (const op of allOperations) {
        if (!op || typeof op !== "object") continue;
        const opType = (op.type || "").toLowerCase();

        if (
          opType === "update" ||
          opType === "update_entity" ||
          opType === "update_node"
        ) {
          const tgt = op.target || op.entityId || op.id || (op as any).nodeId;
          const existing = nextEntities.get(tgt);
          if (existing) {
            nextEntities.set(tgt, {
              ...existing,
              label: op.label ?? op.name ?? existing.label,
              value: op.value ?? existing.value,
              state: op.state ?? existing.state,
              properties: {
                ...existing.properties,
                ...(op.properties || {}),
                color: op.color ?? op.style?.color ?? existing.properties?.color,
                highlight:
                  op.style?.color ??
                  op.properties?.highlight ??
                  op.highlight ??
                  existing.properties?.highlight,
              },
            });
            affectedEntities.push(tgt);
          }
        } else if (opType === "highlight") {
          const tgt = op.target || op.entityId || op.id;
          const existing = nextEntities.get(tgt);
          if (existing) {
            existing.properties.highlight = op.color || op.highlight || "accent";
            affectedEntities.push(tgt);
          }
        } else if (opType === "unhighlight") {
          const tgt = op.target || op.entityId || op.id;
          const existing = nextEntities.get(tgt);
          if (existing) {
            delete existing.properties.highlight;
            affectedEntities.push(tgt);
          }
        } else if (
          opType === "connect" ||
          opType === "connect_relation" ||
          opType === "connect_entities" ||
          opType === "create_arrow" ||
          opType === "create_edge"
        ) {
          const src = op.source || op.from;
          const tgt = op.target || op.to;
          if (src && tgt) {
            const relId =
              op.id || `rel-${src}-${tgt}-${Math.random().toString(36).slice(2, 6)}`;
            nextRels.set(relId, {
              id: relId,
              source: src,
              target: tgt,
              type: op.relationType || op.role || op.type || "connects",
              direction:
                op.direction === "none" || op.directed === false
                  ? "none"
                  : op.direction || "forward",
              label: op.label,
              properties: {
                ...(op.properties || {}),
                color: op.color || op.style?.color,
                highlight: op.highlight,
              },
            });
            affectedEntities.push(src, tgt);
          }
        } else if (
          opType === "disconnect" ||
          opType === "disconnect_relation" ||
          opType === "disconnect_entities" ||
          opType === "delete_edge"
        ) {
          if (op.id) {
            nextRels.delete(op.id);
          } else if (op.source && op.target) {
            for (const [rid, r] of nextRels.entries()) {
              if (r.source === op.source && r.target === op.target) {
                nextRels.delete(rid);
              }
            }
          }
        } else if (
          opType === "create_entity" ||
          opType === "add_entity" ||
          opType === "create_box" ||
          opType === "create_circle"
        ) {
          const entId = op.id || op.entity?.id;
          if (entId) {
            nextEntities.set(entId, {
              id: entId,
              type:
                op.entityType ||
                op.entity?.type ||
                (opType === "create_circle" ? "CircleEntity" : "GenericEntity"),
              label: op.label || op.entity?.label || entId,
              value: op.value ?? op.entity?.value,
              properties: op.properties || op.entity?.properties || op.style || {},
              semanticRole: op.role || op.semanticRole || "component",
            });
            affectedEntities.push(entId);
          }
        } else if (
          opType === "delete_entity" ||
          opType === "remove_entity" ||
          opType === "delete" ||
          opType === "delete_node"
        ) {
          const entId = op.entityId || op.id || op.target;
          if (entId) {
            nextEntities.delete(entId);
            for (const [rid, r] of nextRels.entries()) {
              if (r.source === entId || r.target === entId) {
                nextRels.delete(rid);
              }
            }
            affectedEntities.push(entId);
          }
        }
      }

      const nextState = createSemanticState(nextIndex, `state-${nextIndex}`, {
        name: s.title || `Step ${nextIndex}`,
        description: s.explanation,
        entities: nextEntities,
        relationships: nextRels,
        properties: { step: nextIndex },
      });

      states.push(nextState);

      rawTransformations.push({
        id: `t-${nextIndex}`,
        stepNumber: nextIndex,
        title: s.title || `Transition ${nextIndex}`,
        purpose: s.explanation || `Advance ${understanding.concept}`,
        cause: `Algorithmic rule execution in step ${nextIndex}`,
        action: s.explanation || s.title || "State mutation",
        preconditions: [`State ${i} completed`],
        affectedEntities,
        affectedRelationships: [],
        fromStateIndex: i,
        toStateIndex: nextIndex,
        whatChanged: affectedEntities.length > 0 ? `Entities updated: ${affectedEntities.join(", ")}` : s.title,
        whyChanged: s.explanation || "State transition required",
        learnerObservation: `Observe the transition to step ${nextIndex}`,
        consequence: "Preserves invariant integrity",
        invariantEffects: [],
        explanation: s.explanation || s.title,
        calculations: s.calculations,
        insight: s.insight,
      });

      currentState = nextState;
    }

    const world: SemanticWorld = {
      entities: candidateEntities,
      relationships: candidateRelationships,
      properties: {},
      states,
      rules: [],
      constraints: problem.constraints,
      goals: [{ id: "goal-main", description: problem.objective, targetCondition: "Final verified state" }],
      observations: [],
      derivedValues: [],
      dependencies: [],
      transformations: rawTransformations,
      confidence: understanding.confidence,
    };

    // 4. Invariants
    const customInvariants: Invariant[] = (rawProposal?.invariants || []).map((inv, idx) => ({
      id: `inv-custom-${idx + 1}`,
      statement: inv.statement || inv.rule || inv.description || "System Invariant",
      scope: "global",
      severity: "critical",
      source: "proposal",
    }));

    const { model: authoritativeModel, report } = CorrectnessEngine.validateAndSynthesize(
      problem,
      world,
      rawTransformations,
      [],
      customInvariants,
    );

    const model: AuthoritativeSemanticModel = authoritativeModel ?? {
      id: `unverified-${problem.id}`,
      problem,
      world,
      rules: [],
      invariants: customInvariants,
      states: world.states,
      transformations: rawTransformations,
      derivedValuesByState: {},
      goalSatisfaction: {
        satisfied: false,
        objective: problem.objective,
        verifiedCriteria: [{ criterion: problem.objective, passed: false, evidence: "Validation failed critical checks" }],
        summary: "Validation failed critical checks",
      },
      strategy: problem.intent,
      confidence: createConfidence(0.2, "UNCERTAIN", "Rejected by correctness engine"),
      timestamp: Date.now(),
    };

    // 6. Build World Graph
    const worldGraph = SemanticWorldGraph.fromAuthoritativeModel(model);

    // 7. Compile into canonical VisualLesson with attached authoritativeModel
    const visualLesson: VisualLesson = {
      id: model.id,
      title: understanding.concept,
      concept: understanding.concept,
      topic: understanding.concept,
      initialScene:
        initialActions.length > 0
          ? initialActions
          : candidateEntities.map((e) => ({
              type: "create_box" as const,
              id: e.id,
              label: e.label,
              role: (e.semanticRole as any) || "component",
            })),
      transformations: model.transformations.map((t, idx) => {
        const matchingStep = rawSteps[idx];
        return {
          id: t.id,
          title: t.title,
          explanation: t.explanation,
          visual_actions: matchingStep?.visual_actions,
          operations: matchingStep?.operations || [],
          calculations: t.calculations,
          insight: t.insight,
          highlights: t.affectedEntities,
        };
      }),
      capabilities: ["explain", "code", "analyze", "practice"],
    };

    (visualLesson as any).authoritativeModel = model;

    // 8. Compile authoritative timeline directly from validated semantic model
    const timeline = compileAuthoritativeTimeline(model, { prompt });

    return {
      authoritativeModel: model,
      visualLesson,
      worldGraph,
      timeline,
    };
  }

  /**
   * Local Semantic Entity Inspection (0 AI calls)
   */
  public static inspectEntity(
    entityId: string,
    model: AuthoritativeSemanticModel,
    stepIndex: number = 0,
  ) {
    const ent = model.world.entities.find((e) => e.id === entityId);
    if (!ent) return null;

    const currentState = model.states[stepIndex] || model.states[0];
    const stateEnt = currentState?.entities.get(entityId) || ent;

    // Outgoing & incoming connections
    const incoming = model.world.relationships.filter((r) => r.target === entityId);
    const outgoing = model.world.relationships.filter((r) => r.source === entityId);

    const relevantInvariants = model.invariants.filter(
      (inv) => inv.scope === "global" || inv.scope === entityId,
    );

    return {
      id: ent.id,
      label: ent.label,
      type: ent.type,
      role: ent.semanticRole,
      value: stateEnt.value,
      state: stateEnt.state,
      properties: stateEnt.properties,
      incomingConnections: incoming.map((r) => ({ from: r.source, type: r.type })),
      outgoingConnections: outgoing.map((r) => ({ to: r.target, type: r.type })),
      invariants: relevantInvariants.map((i) => i.statement),
    };
  }

  /**
   * Local "What Changed?" explanation derived from semantic diffs (0 AI calls)
   */
  public static getWhatChanged(
    stepIndex: number,
    model: AuthoritativeSemanticModel,
  ): SemanticExplanation | null {
    if (stepIndex <= 0 || stepIndex > model.transformations.length) {
      return null;
    }
    const t = model.transformations[stepIndex - 1];
    const fromState = model.states[t.fromStateIndex];
    const toState = model.states[t.toStateIndex];

    return ExplanationEngine.deriveExplanation(t, fromState, toState, model.invariants);
  }

  /**
   * Local "Why?" causal path tracing (0 AI calls)
   */
  public static getWhy(stepIndex: number, model: AuthoritativeSemanticModel) {
    if (stepIndex <= 0 || stepIndex > model.transformations.length) {
      return null;
    }
    const t = model.transformations[stepIndex - 1];
    return WhyEngine.traceCausalReasoning(t, model);
  }

  /**
   * Local Counterfactual "What If?" evaluation (0 AI calls)
   */
  public static evaluateWhatIf(
    mutation: CounterfactualMutation,
    stepIndex: number,
    model: AuthoritativeSemanticModel,
  ): CounterfactualResult {
    const currentState = model.states[stepIndex] || model.states[0];
    return CounterfactualEngine.evaluateWhatIf(mutation, currentState, model);
  }

  /**
   * Local Interactive Practice Quiz derived from model invariants (0 AI calls)
   */
  public static getPracticeQuiz(stepIndex: number, model: AuthoritativeSemanticModel) {
    const inv = model.invariants[0];
    const question = `Which fundamental invariant must remain true throughout ${model.problem.objective}?`;
    const correctAnswer = inv
      ? inv.statement
      : "Every consecutive state transition must preserve identity of continuing entities.";

    const options = [
      correctAnswer,
      "Nodes must never change their states",
      "Pointers must always point in reverse order",
      "Operations must execute without checking constraints",
    ];

    return {
      question,
      options,
      correctIndex: 0,
      explanation: `Correct: "${correctAnswer}" is an essential correctness invariant of this concept.`,
    };
  }
}
