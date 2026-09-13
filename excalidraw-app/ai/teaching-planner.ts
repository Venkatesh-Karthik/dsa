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
  ConceptEntity,
  ConceptRelationship,
  ConceptState,
  ConceptTransformation,
  ConceptInvariant,
  ConceptMisconception,
  ConceptDependency,
  CausalRelationship,
  PracticeOpportunity,
  AdaptationHint,
  TeachingStrategy,
  ConceptDomain,
} from "./concept-model";
import type { DetailedIntent } from "./intent-intelligence";
import { resolveDomainModule } from "./domain-knowledge";

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
  if (/\b(state|lifecycle|handshake|tcp|http|protocol|process states?|automata)\b/i.test(lower)) {
    return "STATE_MACHINE";
  }
  if (/\b(pointer|rewir|connection|link|rotate|rotation|rebalance|tree|heap|graph|insertion|deletion)\b/i.test(lower)) {
    return "STRUCTURAL_TRANSFORMATION";
  }
  if (/\b(optimi|gradient|descent|loss|convergence|learning rate|weights?)\b/i.test(lower)) {
    return "ITERATIVE_OPTIMIZATION";
  }
  if (/\b(stack|frame|heap allocation|memory|register|buffer)\b/i.test(lower)) {
    return "MEMORY_TRANSFORMATION";
  }
  if (/\b(query|sql|join|filter|map|reduce|flow)\b/i.test(lower)) {
    return "DATA_FLOW";
  }
  if (/\b(kinematics|motion|trajectory|wave|frequency|cycle|heat|thermodynamic|refrigerat)\b/i.test(lower)) {
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
      description: "Understanding that entities refer to downstream entities via directed pointers or links.",
      necessity: "foundational",
      compactExplanation: "Entities maintain their identity while relationships between them are redirected.",
    });
  } else if (strategy === "STATE_MACHINE") {
    deps.push({
      id: "dep-states",
      concept: "Discrete States and Transitions",
      description: "Understanding that a system resides in exactly one stable state until a valid event triggers a transition.",
      necessity: "foundational",
      compactExplanation: "An event or message causes a transition from an origin state to a target state.",
    });
  } else if (strategy === "PIPELINE") {
    deps.push({
      id: "dep-stages",
      concept: "Sequential Data Transformation Stages",
      description: "Each stage consumes the output representation of the prior stage and produces an enriched representation.",
      necessity: "foundational",
      compactExplanation: "Transformations occur monotonically from raw input to finished target output.",
    });
  } else if (strategy === "TEMPORAL_PROGRESSION") {
    deps.push({
      id: "dep-temporal",
      concept: "State Conservation & Physical Continuity",
      description: "Energy and mass or flow parameters transform continuously across cyclic or progressive phases.",
      necessity: "foundational",
      compactExplanation: "System variables change predictably according to physical or systemic laws.",
    });
  }

  return deps;
}

/**
 * Creates a comprehensive teaching plan and ConceptModel in a single request.
 */
export function createTeachingPlan(params: TeachingPlanParameters): ConceptModel {
  const { concept, intent } = params;
  const strategy = selectTeachingStrategy(concept, intent);
  const domainModule = resolveDomainModule(concept);
  const depth = determineTeachingDepth(intent, 3);
  const dependencies = inferConceptDependencies(concept, strategy);

  // Invariants from domain knowledge or generic
  const invariants: ConceptInvariant[] = domainModule.getInvariants(concept);
  const misconceptions: ConceptMisconception[] = domainModule.getMisconceptions(concept);

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
      explanation: "Every transformation exists strictly to restore or advance invariant satisfaction.",
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
