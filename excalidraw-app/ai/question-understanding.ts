/**
 * Universal Question Understanding Layer
 *
 * Dynamically analyzes ANY valid educational question to formalize:
 * - Intent class (EXPLAIN, SOLVE, DERIVE, CONSTRUCT, SIMULATE, COMPARE, etc.)
 * - Concept / Subject domain
 * - Requested operation, inputs, targets, and constraints
 * - Desired pedagogical depth and ambiguity resolution
 *
 * Operates without hardcoded topic branching.
 */

import { type Confidence, createConfidence, CONFIDENCE_INFERRED, CONFIDENCE_ASSUMED } from "./confidence-model";

export type IntentClass =
  | "EXPLAIN"
  | "SOLVE"
  | "DERIVE"
  | "CONSTRUCT"
  | "SIMULATE"
  | "COMPARE"
  | "ANALYZE"
  | "DEBUG"
  | "TRACE"
  | "PREDICT"
  | "PROVE"
  | "TRANSFORM"
  | "OPTIMIZE"
  | "PRACTICE"
  | "VISUALIZE"
  | string;

export type ExplanationDepth = "overview" | "standard" | "deep_dive" | "rigorous";

export interface Ambiguity {
  issue: string;
  alternatives: string[];
  impact: "low" | "medium" | "high";
  resolution?: string;
}

export interface QuestionUnderstandingResult {
  /** Primary intent classification */
  userIntent: IntentClass;
  /** Secondary or compound intents */
  secondaryIntents?: IntentClass[];
  /** Core subject or concept identified */
  subject: string;
  /** High-level conceptual domain */
  concept: string;
  /** Specific mathematical, logical, or structural operation requested */
  requestedOperation?: string;
  /** Parsed inputs (e.g. initial array, numbers, system parameters) */
  inputs: unknown[];
  /** Target value, state, or goal */
  target?: unknown;
  /** Explicit or inferred constraints */
  constraints: string[];
  /** Expected final result or format */
  expectedResult?: unknown;
  /** Desired depth of explanation */
  desiredExplanationDepth: ExplanationDepth;
  /** Detected ambiguities and their resolutions */
  ambiguity: Ambiguity[];
  /** Explicit assumptions made */
  assumptions: string[];
  /** Additional pedagogical context */
  relevantContext?: string;
  /** Whether the concept requires interactive timeline simulation */
  requiresSimulation: boolean;
  /** Whether the concept requires discrete step-by-step state changes */
  requiresStepByStep: boolean;
  /** Original user prompt */
  rawQuestion: string;
  /** Epistemic confidence in this understanding */
  confidence: Confidence;
}

/**
 * Universal question understanding engine.
 * Reasons from semantic keywords, syntax, grammar, and intent structure.
 */
export function understandQuestion(
  prompt: string,
  context?: {
    theme?: string;
    existingElementCount?: number;
    selectedEntities?: string[];
  },
): QuestionUnderstandingResult {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // 1. Detect Intent Class
  let userIntent: IntentClass = "EXPLAIN";
  const secondaryIntents: IntentClass[] = [];

  if (/\b(compare|contrast|vs|versus|difference between)\b/i.test(lower)) {
    userIntent = "COMPARE";
  } else if (/\b(solve|find|calculate|compute|evaluate|determine)\b/i.test(lower)) {
    userIntent = "SOLVE";
  } else if (/\b(derive|derivation|proof|prove|formula for)\b/i.test(lower)) {
    userIntent = "DERIVE";
  } else if (/\b(construct|build|create|implement|design|architecture)\b/i.test(lower)) {
    userIntent = "CONSTRUCT";
  } else if (/\b(simulate|run|execute|step through|lifecycle|flow)\b/i.test(lower)) {
    userIntent = "SIMULATE";
  } else if (/\b(debug|fix|why is.*failing|error|bug|issue)\b/i.test(lower)) {
    userIntent = "DEBUG";
  } else if (/\b(trace|walkthrough|step by step|steps of)\b/i.test(lower)) {
    userIntent = "TRACE";
  } else if (/\b(predict|what happens next|what if)\b/i.test(lower)) {
    userIntent = "PREDICT";
  } else if (/\b(optimize|improve|faster|compress|reduce complexity)\b/i.test(lower)) {
    userIntent = "OPTIMIZE";
  } else if (/\b(practice|quiz|test me|challenge|exercise)\b/i.test(lower)) {
    userIntent = "PRACTICE";
  } else if (/\b(visualize|draw|show me|illustrate|diagram)\b/i.test(lower)) {
    userIntent = "VISUALIZE";
  } else if (/\b(analyze|inspect|metrics|properties of)\b/i.test(lower)) {
    userIntent = "ANALYZE";
  } else if (/\b(transform|rotate|balance|insert|delete|reverse)\b/i.test(lower)) {
    userIntent = "TRANSFORM";
  }

  // Detect secondary intents
  if (/practice|quiz/i.test(lower) && userIntent !== "PRACTICE") {
    secondaryIntents.push("PRACTICE");
  }
  if (/visual/i.test(lower) && userIntent !== "VISUALIZE") {
    secondaryIntents.push("VISUALIZE");
  }

  // 2. Extract Subject and Concept
  // Clean punctuation and common prefixes
  const cleanSubject = p
    .replace(/^(explain|how does|what is|how do|show me|visualize|teach me|simulate|trace|compare)\s+/i, "")
    .replace(/\s+(work|function|operate|behave)\??$/i, "")
    .replace(/[?.!]+$/, "")
    .trim();

  const subject = cleanSubject || p;
  const concept = cleanSubject.split(/\s+with|\s+for|\s+using|\s+in/i)[0]?.trim() || subject;

  // 3. Extract Requested Operation & Numerical / Literal Inputs
  let requestedOperation: string | undefined;
  const opMatch = lower.match(/\b(insert|delete|remove|search|lookup|rotate|sort|traverse|send|receive|route|dispatch|expand|condense|parse|lex|compile|optimize)\b/i);
  if (opMatch) {
    requestedOperation = opMatch[1];
  }

  // Extract explicit inputs (e.g. array [1, 2, 3], key 42, numbers)
  const inputs: unknown[] = [];
  const arrayMatch = p.match(/\[([\d\s,.-]+)\]/);
  if (arrayMatch) {
    const parsed = arrayMatch[1].split(",").map((n) => Number(n.trim())).filter((n) => !isNaN(n));
    if (parsed.length > 0) inputs.push(parsed);
  }
  const numMatches = p.match(/\b\d+\b/g);
  if (numMatches && inputs.length === 0) {
    numMatches.slice(0, 5).forEach((n) => inputs.push(Number(n)));
  }

  // 4. Inferred Constraints
  const constraints: string[] = [];
  if (/\b(sorted|ascending|descending)\b/i.test(lower)) {
    constraints.push("Elements must maintain sorted ordering");
  }
  if (/\b(balanced|avl|red-black)\b/i.test(lower)) {
    constraints.push("Balance invariants must be preserved across mutations");
  }
  if (/\b(closed cycle|conservation)\b/i.test(lower)) {
    constraints.push("Conservation of mass and energy must be preserved");
  }
  if (/\b(acyclic|dag|tree)\b/i.test(lower)) {
    constraints.push("Graph must remain strictly acyclic");
  }
  if (/\b(non-negative|positive weights?)\b/i.test(lower)) {
    constraints.push("Edge weights must be non-negative");
  }

  // 5. Desired Explanation Depth
  let desiredExplanationDepth: ExplanationDepth = "standard";
  if (/\b(rigorous|mathematical proof|formal|axiom|theorem)\b/i.test(lower)) {
    desiredExplanationDepth = "rigorous";
  } else if (/\b(deep dive|in-depth|detailed|thorough|internals|under the hood)\b/i.test(lower)) {
    desiredExplanationDepth = "deep_dive";
  } else if (/\b(simple|overview|eli5|beginner|briefly|summary)\b/i.test(lower)) {
    desiredExplanationDepth = "overview";
  }

  // 6. Ambiguity Handling
  const ambiguity: Ambiguity[] = [];
  const assumptions: string[] = [];

  if (userIntent === "TRANSFORM" && inputs.length === 0) {
    ambiguity.push({
      issue: "No initial input state or target value specified",
      alternatives: ["Select canonical pedagogical example", "Request user input"],
      impact: "medium",
      resolution: "Selected representative pedagogical sample state to illustrate invariant behavior clearly",
    });
    assumptions.push("Using canonical pedagogical values for initial demonstration");
  }

  if (/\b(tree|graph)\b/i.test(lower) && !/\b(binary|avl|directed|undirected|weighted)\b/i.test(lower)) {
    ambiguity.push({
      issue: "Graph or tree variant unspecified",
      alternatives: ["Directed acyclic graph", "Binary search tree", "General undirected graph"],
      impact: "low",
      resolution: "Standard directed hierarchy assumed for optimal visual clarity",
    });
    assumptions.push("Assumed standard directed hierarchy");
  }

  const requiresSimulation = [
    "SIMULATE",
    "TRACE",
    "TRANSFORM",
    "SOLVE",
    "OPTIMIZE",
    "PREDICT",
  ].includes(userIntent) || /\b(step|step-by-step|lifecycle|process|algorithm)\b/i.test(lower);

  const requiresStepByStep = requiresSimulation || userIntent === "EXPLAIN";

  return {
    userIntent,
    secondaryIntents: secondaryIntents.length > 0 ? secondaryIntents : undefined,
    subject,
    concept,
    requestedOperation,
    inputs,
    constraints,
    desiredExplanationDepth,
    ambiguity,
    assumptions,
    relevantContext: context?.selectedEntities?.length
      ? `Selected entities: ${context.selectedEntities.join(", ")}`
      : undefined,
    requiresSimulation,
    requiresStepByStep,
    rawQuestion: prompt,
    confidence: ambiguity.length > 0 ? CONFIDENCE_ASSUMED : CONFIDENCE_INFERRED,
  };
}
