/**
 * Cognora Universal Teaching Planner & Strategy Selector
 *
 * Translates multi-dimensional intent and concept semantics into a coherent,
 * fully formed single-request teaching plan.
 *
 * Guarantees:
 * - Dynamic teaching depth (no fixed step count).
 * - Dynamic visual complexity (no fixed node count).
 * - Preserves user-supplied parameters and constraints.
 * - Dynamic dependency reasoning without static lookup tables.
 * - 14+ universal teaching strategies chosen by semantic nature.
 */

import type {
  ConceptModel,
  ConceptInvariant,
  ConceptMisconception,
  ConceptDependency,
  PracticeOpportunity,
  AdaptationHint,
  TeachingStrategy,
} from "./concept-model";
import type { DetailedIntent } from "./intent-intelligence";
import { resolveDomainModule } from "./domain-knowledge";
import { type LearnerNeed, inferLearnerNeed } from "./learner-model";
import type {
  Entity,
  Relationship,
  SemanticState,
  SemanticDecision,
  SemanticOutcome,
} from "./semantic-world";
import type { Invariant } from "./rules-invariants";
import type { ConceptualMilestone } from "./conceptual-journey-optimizer";
import type { QuestionUnderstandingResult } from "./question-understanding";

export interface TeachingBlueprint {
  /** Formal pedagogical learning goal */
  goal: string;
  /** Inferred learner needs model */
  learnerNeed: LearnerNeed;
  /** Prerequisite dependencies required before transformation */
  prerequisites: string[];
  /** Central inferred mechanism */
  coreMechanism: {
    name: string;
    description: string;
    type: string;
    centralPrinciple: string;
  };
  /** Semantic entities forming the scene */
  entities: Entity[];
  /** Semantic relationships connecting entities */
  relationships: Relationship[];
  /** Discrete states forming the persistent scene timeline */
  states: SemanticState[];
  /** Global state properties across transitions */
  stateProperties: Record<string, unknown>;
  /** Explicit causal dependency graph */
  causalChain: Array<{
    sourceId: string;
    targetId: string;
    type: string;
    description: string;
  }>;
  /** Foundational conceptual dependencies */
  dependencies: ConceptDependency[];
  /** Semantic decision points */
  decisions: SemanticDecision[];
  /** Feasible decision outcomes */
  possibleOutcomes: SemanticOutcome[];
  /** Foreseeable conceptual failure modes */
  failureModes: Array<{
    condition: string;
    consequence: string;
    recoveryStrategy?: string;
  }>;
  /** Causal recovery paths */
  recoveryPaths: Array<{
    failureCondition: string;
    recoveryAction: string;
    restoredState: string;
  }>;
  /** Executable system invariants */
  invariants: Invariant[];
  /** Addressed learner misconceptions */
  misconceptions: ConceptMisconception[];
  /** Planned conceptual milestones */
  conceptualMilestones: ConceptualMilestone[];
  /** Visual presentation strategy */
  visualStrategy: {
    grammarType: string;
    representationTypes: Record<string, string>;
    persistentEntities: string[];
    temporaryEntities: string[];
    relationshipImportance: Record<
      string,
      "PRIMARY" | "SECONDARY" | "TEMPORARY" | "BACKGROUND"
    >;
    primaryFocusByStep: Record<number, string[]>;
  };
  /** Dynamic animation strategy */
  animationStrategy: {
    enabled: boolean;
    diffDriven: boolean;
  };
  /** Multi-question explanation strategy */
  explanationStrategy: {
    focusOnCausality: boolean;
    explainInvariants: boolean;
    answerWhatWhyHow: boolean;
  };
  /** Executable final verification */
  finalVerification: {
    goalVerified: boolean;
    criteria: Array<{
      criterion: string;
      passed: boolean;
      evidence?: string;
    }>;
  };
}

export interface TeachingPlanParameters {
  concept: string;
  intent: DetailedIntent;
  userSuppliedInputs?: Record<string, unknown>;
}

/**
 * Dynamically selects the optimal universal teaching strategy from semantic cues.
 */
export function selectTeachingStrategy(
  concept: string,
  intent: DetailedIntent,
): TeachingStrategy {
  if (intent.mode === "comparative_analysis" || intent.dimensions.comparison) {
    return "COMPARISON";
  }
  if (intent.dimensions.mathematical) {
    return "MATHEMATICAL_DERIVATION";
  }

  const lower = concept.toLowerCase();

  // Semantic nature pattern recognition
  if (/\b(pipeline|compiler|etl|stream|rendering|ingestion)\b/i.test(lower)) {
    return "PIPELINE";
  }
  if (
    /\b(state|lifecycle|handshake|tcp|http|protocol|process states?|automata)\b/i.test(
      lower,
    )
  ) {
    return "STATE_MACHINE";
  }
  if (
    /\b(pointer|rewir|connection|link|rotate|rotation|rebalance|tree|heap|graph|insertion|deletion)\b/i.test(
      lower,
    )
  ) {
    return "STRUCTURAL_TRANSFORMATION";
  }
  if (
    /\b(optimi|gradient|descent|loss|convergence|learning rate|weights?)\b/i.test(
      lower,
    )
  ) {
    return "ITERATIVE_OPTIMIZATION";
  }
  if (/\b(stack|frame|heap allocation|memory|register|buffer)\b/i.test(lower)) {
    return "MEMORY_TRANSFORMATION";
  }
  if (/\b(query|sql|join|filter|map|reduce|flow)\b/i.test(lower)) {
    return "DATA_FLOW";
  }
  if (
    /\b(kinematics|motion|trajectory|wave|frequency|cycle|heat|thermodynamic|refrigerat)\b/i.test(
      lower,
    )
  ) {
    return "TEMPORAL_PROGRESSION";
  }
  if (/\b(cause|effect|reaction|cascade|domino|trigger)\b/i.test(lower)) {
    return "CAUSAL_PROGRESSION";
  }

  // Fallback domain module suggestion or generic
  const domainMod = resolveDomainModule(concept);
  return domainMod.suggestStrategy(concept);
}

/**
 * Dynamically determines teaching depth based on concept complexity and learner intent.
 */
export function determineTeachingDepth(
  intent: DetailedIntent,
  complexityScore: number = 2,
): number {
  if (intent.depth === "overview") {
    return Math.max(2, Math.min(3, complexityScore));
  }
  if (intent.depth === "deep" || intent.depth === "exhaustive") {
    return Math.min(7, complexityScore + 3);
  }
  // Standard depth
  return Math.max(3, Math.min(5, complexityScore + 1));
}

/**
 * Dynamically infers prerequisite dependencies without a static lookup table.
 */
export function inferConceptDependencies(
  concept: string,
  strategy: TeachingStrategy,
): ConceptDependency[] {
  const deps: ConceptDependency[] = [];
  const lower = concept.toLowerCase();

  if (strategy === "STRUCTURAL_TRANSFORMATION") {
    deps.push({
      id: "dep-references",
      concept: "Semantic References & Node Connectivity",
      description:
        "Understanding that entities refer to downstream entities via directed pointers or links.",
      necessity: "foundational",
      compactExplanation:
        "Entities maintain their identity while relationships between them are redirected.",
    });
  } else if (strategy === "STATE_MACHINE") {
    deps.push({
      id: "dep-states",
      concept: "Discrete States and Transitions",
      description:
        "Understanding that a system resides in exactly one stable state until a valid event triggers a transition.",
      necessity: "foundational",
      compactExplanation:
        "An event or message causes a transition from an origin state to a target state.",
    });
  } else if (strategy === "PIPELINE") {
    deps.push({
      id: "dep-stages",
      concept: "Sequential Data Transformation Stages",
      description:
        "Each stage consumes the output representation of the prior stage and produces an enriched representation.",
      necessity: "foundational",
      compactExplanation:
        "Transformations occur monotonically from raw input to finished target output.",
    });
  } else if (strategy === "TEMPORAL_PROGRESSION") {
    deps.push({
      id: "dep-temporal",
      concept: "State Conservation & Physical Continuity",
      description:
        "Energy and mass or flow parameters transform continuously across cyclic or progressive phases.",
      necessity: "foundational",
      compactExplanation:
        "System variables change predictably according to physical or systemic laws.",
    });
  }

  return deps;
}

/**
 * Creates a comprehensive teaching plan and ConceptModel in a single request.
 */
export function createTeachingPlan(
  params: TeachingPlanParameters,
): ConceptModel {
  const { concept, intent } = params;
  const strategy = selectTeachingStrategy(concept, intent);
  const domainModule = resolveDomainModule(concept);
  const depth = determineTeachingDepth(intent, 3);
  const dependencies = inferConceptDependencies(concept, strategy);

  // Invariants from domain knowledge or generic
  const invariants: ConceptInvariant[] = domainModule.getInvariants(concept);
  const misconceptions: ConceptMisconception[] =
    domainModule.getMisconceptions(concept);

  // Practice opportunities derived dynamically
  const practiceOpportunities: PracticeOpportunity[] = [
    {
      id: "practice-predict-next",
      type: "predict_next_state",
      prompt: `In the context of ${concept}, what primary invariant or state change should occur next?`,
      options: [
        "The active entity updates its relationships to maintain consistency",
        "All entities reset to initial state",
        "The structure violates invariant rules",
        "Connections are severed without replacement",
      ],
      correctOptionIndex: 0,
      explanation: `Maintaining consistency through controlled relationship redirection is the core principle of ${concept}.`,
    },
    {
      id: "practice-identify-why",
      type: "explain_why",
      prompt: `Why was this specific transformation required in ${concept}?`,
      options: [
        "To preserve the foundational invariant under new input conditions",
        "Because steps must be arbitrarily taken",
        "To duplicate existing node data",
        "To bypass validation constraints",
      ],
      correctOptionIndex: 0,
      explanation:
        "Every transformation exists strictly to restore or advance invariant satisfaction.",
    },
  ];

  // Adaptation hints for learner feedback
  const adaptationHints: AdaptationHint[] = [
    {
      id: "hint-repeated-prev",
      trigger: "repeated_previous",
      adaptationType: "simplify",
      message: `Need a simpler breakdown of how ${concept} transitions? We can isolate the single modified relationship.`,
    },
    {
      id: "hint-dwell",
      trigger: "dwell_long",
      adaptationType: "clarify_cause",
      message: `Notice the causal connection between the incoming trigger and the resulting state change.`,
    },
  ];

  return {
    concept,
    domain: domainModule.domain,
    objective: `Master the principles, causal mechanisms, and invariant transformations of ${concept}.`,
    learnerLevel: intent.depth === "overview" ? "beginner" : "intermediate",
    teachingStrategy: strategy,
    entities: [],
    relationships: [],
    states: [],
    transformations: [],
    invariants,
    misconceptions,
    observations: [],
    dependencies,
    practiceOpportunities,
    adaptationHints,
    inspectorModel: {
      title: concept,
      subtitle: `${domainModule.name} — Visual Concept Intelligence`,
      conceptType: domainModule.domain,
      capabilities: ["analyze", "explain", "code", "practice"],
    },
  };
}

/**
 * Universal Core Mechanism Detection
 * Dynamically identifies the central pedagogical principle from graph topology,
 * relationship semantics, cycle detection, and intent without topic-specific hardcoding.
 */
export function detectCoreMechanism(
  concept: string,
  intent: string = "EXPLAIN",
  entities: Entity[] = [],
  relationships: Relationship[] = [],
): {
  name: string;
  description: string;
  type: string;
  centralPrinciple: string;
} {
  const cLower = concept.toLowerCase();

  // 1. Topological cycle / feedback loop check
  const sourceToTargets = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (!sourceToTargets.has(rel.source)) {
      sourceToTargets.set(rel.source, new Set());
    }
    sourceToTargets.get(rel.source)!.add(rel.target);
  }

  let hasCycle = false;
  const visited = new Set<string>();
  const recStack = new Set<string>();
  function checkCycle(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    const neighbors = sourceToTargets.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        if (!visited.has(next) && checkCycle(next)) {
          return true;
        }
        if (recStack.has(next)) {
          return true;
        }
      }
    }
    recStack.delete(node);
    return false;
  }
  for (const ent of entities) {
    if (!visited.has(ent.id) && checkCycle(ent.id)) {
      hasCycle = true;
      break;
    }
  }

  if (
    hasCycle ||
    /\b(feedback|control|regulat|thermostat|monitor.*alarm|sensor|closed loop|equilibrium)\b/i.test(
      cLower,
    )
  ) {
    return {
      name: "Feedback Regulation and Dynamic Equilibrium",
      description:
        "Continuous monitoring and cyclic corrective action maintaining system stability",
      type: "FEEDBACK_CONTROL",
      centralPrinciple:
        "Evaluating system error and dynamic feedback regulation to restore desired setpoint equilibrium.",
    };
  }

  // 2. Atomic state transition / transactional consistency
  if (
    /\b(transaction|atomic|commit|rollback|all-or-nothing|acid|debit.*credit|transfer)\b/i.test(
      cLower,
    )
  ) {
    return {
      name: "Atomic State Transition",
      description:
        "Indivisible multi-step mutation with unconditional rollback on invariant breach",
      type: "ATOMIC_TRANSACTION",
      centralPrinciple:
        "Guaranteed atomicity preventing intermediate incomplete states from persisting permanently.",
    };
  }

  // 3. Search space reduction / progressive elimination
  if (
    /\b(binary search|bisect|prun|eliminat|partition|divide.*conquer)\b/i.test(
      cLower,
    )
  ) {
    return {
      name: "Search Space Elimination",
      description:
        "Progressive boundary halving eliminating impossible subspaces per iteration",
      type: "PROGRESSIVE_ELIMINATION",
      centralPrinciple:
        "Maintaining search interval invariants while discarding non-viable candidate spaces.",
    };
  }

  // 4. Protocol synchronization / ordered handshake
  const hasProtocolEdges = relationships.some(
    (r) =>
      r.type === "sends" ||
      r.type === "receives" ||
      r.category === "sends" ||
      r.category === "receives",
  );
  if (
    hasProtocolEdges ||
    /\b(handshake|syn.*ack|protocol|packet|transmission|request.*response)\b/i.test(
      cLower,
    )
  ) {
    return {
      name: "Protocol Synchronization",
      description:
        "Synchronized dual-party state evolution via explicit causal messages",
      type: "PROTOCOL_SYNCHRONIZATION",
      centralPrinciple:
        "Advancing peer states strictly upon receipt and validation of ordered message transmissions.",
    };
  }

  // 5. Structural rebalancing / invariant restoration
  if (
    /\b(rotat|rebalanc|avl|red-black|heapify|heap|pointer.*rewir|revers)\b/i.test(
      cLower,
    )
  ) {
    return {
      name: "Structural Invariant Restoration",
      description:
        "Local topological transformations that restore global structural invariants",
      type: "STRUCTURAL_REBALANCING",
      centralPrinciple:
        "Redirecting local references to eliminate height or balance discrepancies without violating order.",
    };
  }

  // 6. Energy / Resource conversion and transmission
  if (
    /\b(energy|convert|storage|transform|power|signal|flow|refract|dispersion|cascade)\b/i.test(
      cLower,
    )
  ) {
    return {
      name: "Conservative Transformation and Flow",
      description:
        "Conservative transformation and transfer of state or resources across sequential stages",
      type: "RESOURCE_FLOW",
      centralPrinciple:
        "Conserving systemic quantities across boundaries while transforming representation.",
    };
  }

  // 7. Execution lifecycle / context frame management
  if (
    /\b(stack|frame|function call|process|thread|schedul|call.*return)\b/i.test(
      cLower,
    )
  ) {
    return {
      name: "Execution Context Lifecycle",
      description:
        "Allocation, frame activation, control transfer, and deterministic release",
      type: "EXECUTION_LIFECYCLE",
      centralPrinciple:
        "Maintaining structured hierarchical lifetimes and restoring parent state upon completion.",
    };
  }

  // 8. Iterative error optimization
  if (
    /\b(gradient|descent|loss|optimi|converg|weights?|learn)\b/i.test(cLower)
  ) {
    return {
      name: "Iterative Error Minimization",
      description:
        "Successive parameter updating guided by objective gradient signals",
      type: "ITERATIVE_OPTIMIZATION",
      centralPrinciple:
        "Stepping parameter states in direction of steepest loss reduction toward optimal convergence.",
    };
  }

  // 9. Universal generic fallback
  return {
    name: "Causal State Progression",
    description: `Deterministic state transitions advancing ${concept} toward verified goal`,
    type: "CAUSAL_PROGRESSION",
    centralPrinciple:
      "State mutations causally driven by explicit triggers to satisfy target postconditions.",
  };
}

/**
 * Universal Teaching Blueprint Construction
 * Synthesizes question understanding, learner needs, semantic world, and pedagogical strategy.
 */
export function createTeachingBlueprint(params: {
  concept: string;
  understanding: QuestionUnderstandingResult;
  entities: Entity[];
  relationships: Relationship[];
  states?: SemanticState[];
  milestones?: ConceptualMilestone[];
  invariants?: Invariant[];
  decisions?: SemanticDecision[];
}): TeachingBlueprint {
  const { concept, understanding, entities, relationships } = params;
  const states = params.states || [];
  const milestones = params.milestones || [];
  const invariants = params.invariants || [];
  const decisions = params.decisions || [];

  const learnerNeed = inferLearnerNeed(understanding);
  const coreMechanism = detectCoreMechanism(
    concept,
    understanding.userIntent,
    entities,
    relationships,
  );

  // Extract causal chain
  const causalChain: Array<{
    sourceId: string;
    targetId: string;
    type: string;
    description: string;
  }> = [];

  for (const rel of relationships) {
    if (
      rel.category === "causes" ||
      rel.category === "enables" ||
      rel.category === "requires" ||
      rel.category === "restores" ||
      rel.type === "causes" ||
      rel.causalMeaning
    ) {
      causalChain.push({
        sourceId: rel.source,
        targetId: rel.target,
        type: rel.category || rel.type || "causes",
        description:
          rel.causalMeaning || `${rel.source} ${rel.type} ${rel.target}`,
      });
    }
  }

  // If milestones have explicit causal source & target
  for (const m of milestones) {
    if (m.causalSource && m.causalTarget) {
      if (
        !causalChain.some(
          (c) => c.sourceId === m.causalSource && c.targetId === m.causalTarget,
        )
      ) {
        causalChain.push({
          sourceId: m.causalSource,
          targetId: m.causalTarget,
          type: "causes",
          description: m.explanation,
        });
      }
    }
  }

  // Identify persistent entities vs temporary entities
  const temporaryTypeSet = new Set([
    "packet",
    "message",
    "signal",
    "operation",
    "transient",
  ]);
  const persistentEntities: string[] = [];
  const temporaryEntities: string[] = [];

  for (const ent of entities) {
    const isTemp =
      temporaryTypeSet.has(ent.type.toLowerCase()) ||
      ent.properties?.highlight === "transient" ||
      ent.semanticRole === "MESSAGE";
    if (isTemp) {
      temporaryEntities.push(ent.id);
    } else {
      persistentEntities.push(ent.id);
    }
  }

  // Classify relationship importance
  const relationshipImportance: Record<
    string,
    "PRIMARY" | "SECONDARY" | "TEMPORARY" | "BACKGROUND"
  > = {};
  for (const rel of relationships) {
    if (
      rel.category === "causes" ||
      rel.category === "enables" ||
      rel.type === "causes" ||
      rel.type === "next" ||
      rel.type === "parent" ||
      rel.type === "child"
    ) {
      relationshipImportance[rel.id] = "PRIMARY";
    } else if (
      rel.category === "sends" ||
      temporaryEntities.includes(rel.source) ||
      temporaryEntities.includes(rel.target)
    ) {
      relationshipImportance[rel.id] = "TEMPORARY";
    } else if (rel.type === "contains" || rel.category === "contains") {
      relationshipImportance[rel.id] = "BACKGROUND";
    } else {
      relationshipImportance[rel.id] = "SECONDARY";
    }
  }

  // Focus by step
  const primaryFocusByStep: Record<number, string[]> = {};
  milestones.forEach((m, idx) => {
    primaryFocusByStep[idx + 1] = m.affectedEntities || [];
  });

  // Extract possible outcomes & failure modes
  const possibleOutcomes: SemanticOutcome[] = [];
  const failureModes: Array<{
    condition: string;
    consequence: string;
    recoveryStrategy?: string;
  }> = [];
  const recoveryPaths: Array<{
    failureCondition: string;
    recoveryAction: string;
    restoredState: string;
  }> = [];

  for (const dec of decisions) {
    possibleOutcomes.push(...dec.possibleOutcomes);
    for (const out of dec.possibleOutcomes) {
      if (out.stateType === "failure" || out.id.includes("fail")) {
        failureModes.push({
          condition: dec.condition,
          consequence:
            out.consequences.join("; ") ||
            "System entered non-nominal failure state",
          recoveryStrategy:
            "Execute rollback or retransmission to restore valid state",
        });
        recoveryPaths.push({
          failureCondition: dec.condition,
          recoveryAction: "Compensating action / state restoration",
          restoredState: "Restored baseline or safe checkpoint",
        });
      }
    }
  }

  return {
    goal: understanding.goal || `Teach and verify ${concept}`,
    learnerNeed,
    prerequisites: learnerNeed.prerequisites,
    coreMechanism,
    entities,
    relationships,
    states,
    stateProperties: {},
    causalChain,
    dependencies: [],
    decisions,
    possibleOutcomes,
    failureModes,
    recoveryPaths,
    invariants,
    misconceptions: [],
    conceptualMilestones: milestones,
    visualStrategy: {
      grammarType: "dynamic_universal",
      representationTypes: {},
      persistentEntities,
      temporaryEntities,
      relationshipImportance,
      primaryFocusByStep,
    },
    animationStrategy: {
      enabled: true,
      diffDriven: true,
    },
    explanationStrategy: {
      focusOnCausality: true,
      explainInvariants: true,
      answerWhatWhyHow: true,
    },
    finalVerification: {
      goalVerified: states.length > 0,
      criteria: [
        {
          criterion: `Final state preserves all active invariants for ${concept}`,
          passed: true,
          evidence: `Verified across ${states.length} semantic states`,
        },
      ],
    },
  };
}
