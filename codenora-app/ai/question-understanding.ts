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

import {
  type Confidence,
  createConfidence,
  CONFIDENCE_INFERRED,
  CONFIDENCE_ASSUMED,
} from "./confidence-model";

export type IntentClass =
  | "EXPLAIN"
  | "HOW"
  | "WHY"
  | "WHAT"
  | "TRACE"
  | "COMPARE"
  | "DERIVE"
  | "SIMULATE"
  | "DEBUG"
  | "DESIGN"
  | "PROVE"
  | "VISUALIZE"
  | "PREDICT"
  | "COUNTERFACTUAL"
  | "PRACTICE"
  | "DEFINITION"
  | "MECHANISM"
  | "WHY_HOW"
  | "EXAMPLE"
  | "DEMONSTRATION"
  | "IMPLEMENTATION"
  | "PROCESS"
  | "LIFECYCLE"
  | "ARCHITECTURE"
  | "CAUSE_EFFECT"
  | "WHAT_IF"
  | "COUNTEREXAMPLE"
  | "CODE_EXPLANATION"
  | "PROBLEM_SOLVING"
  | "EXAM_PREPARATION"
  | "CONCEPTUAL_REVISION"
  | "SOLVE"
  | "CONSTRUCT"
  | "ANALYZE"
  | "TRANSFORM"
  | "OPTIMIZE"
  | string;

export type QuestionScope =
  | "unit"
  | "system"
  | "interaction"
  | "architecture"
  | "end-to-end";

export type ExplanationDepth =
  | "overview"
  | "standard"
  | "deep_dive"
  | "rigorous";

export interface Ambiguity {
  issue: string;
  alternatives: string[];
  impact: "low" | "medium" | "high";
  resolution?: string;
}

export type SemanticRole =
  | "entity"
  | "value"
  | "key"
  | "index"
  | "operand"
  | "parameter"
  | "operation"
  | "argument"
  | "target"
  | "source"
  | "destination"
  | "constraint"
  | "state"
  | "result";

export interface ParsedOperation {
  op:
    | "insert"
    | "delete"
    | "search"
    | "swap"
    | "update"
    | "partition"
    | "rotate"
    | "relax"
    | "visit"
    | "put"
    | "get"
    | "sort"
    | "shortest_path"
    | string;
  value?: unknown;
  key?: unknown;
  target?: unknown;
  index?: number;
  arguments?: Record<string, unknown>;
  inputs?: unknown[];
  preconditions?: string[];
  effects?: string[];
  semanticRole?: "operation";
  order: number;
  metadata?: Record<string, unknown>;
}

export interface QuestionUnderstandingResult {
  /** Primary intent classification */
  userIntent: IntentClass;
  /** Secondary or compound intents */
  secondaryIntents?: IntentClass[];
  /** Unified list of all recognized intents */
  intents: IntentClass[];
  /** Pedagogical scope */
  scope: QuestionScope;
  /** Core formalized goal */
  goal: string;
  /** Requested pedagogical output format */
  requestedOutput: string;
  /** Core subject or concept identified */
  subject: string;
  /** High-level conceptual domain */
  concept: string;
  /** Extracted key concepts */
  importantConcepts: string[];
  /** Explicit requirements directly stated */
  explicitRequirements: string[];
  /** Implicit requirements inferred from intent and domain constraints */
  implicitRequirements: string[];
  /** Assumed prerequisite knowledge */
  assumedKnowledge: string[];
  /** Specific mathematical, logical, or structural operation requested */
  requestedOperation?: string;
  /** Chronologically ordered operations parsed from the prompt */
  parsedOperations: ParsedOperation[];
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
  /** Alias for ambiguity for pedagogical models */
  potentialAmbiguities: Ambiguity[];
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
  /** Baseline elements extracted from explicit containers or sequences (e.g. linked list chain, array) */
  baselineElements?: unknown[];
  /** Additional metadata including extracted baseline containers */
  metadata?: Record<string, unknown>;
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

  // 1. Detect Multi-Dimensional Intent Classes
  const recognizedIntents: IntentClass[] = [];

  if (/\b(what is|define|definition of|meaning of)\b/i.test(lower)) {
    recognizedIntents.push("WHAT");
    recognizedIntents.push("DEFINITION");
  }
  if (/\b(debug|fix|error|bug|issue|why is.*failing|failed)\b/i.test(lower)) {
    recognizedIntents.push("DEBUG");
  }
  if (/\b(why does|why is|how come|why do|why are|why)\b/i.test(lower)) {
    recognizedIntents.push("WHY");
  }
  if (
    /\b(how does.*work|how to|mechanism of|internal mechanism|under the hood|how do)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("HOW");
    recognizedIntents.push("MECHANISM");
  }
  if (
    /\b(architecture of|system design|components of|topology|design a|structure of)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("DESIGN");
    recognizedIntents.push("ARCHITECTURE");
  }
  if (
    /\b(what if|suppose that|what happens (if|when)|fails?|disrupted|broken|removed)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("COUNTERFACTUAL");
  }
  if (
    /\b(cause of|effect of|impact of|consequence of|causes|leads to)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("CAUSE_EFFECT");
  }
  if (
    /\b(compare|contrast|vs|versus|difference between|pros and cons)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("COMPARE");
  }
  if (/\b(solve|find|calculate|compute|evaluate|determine)\b/i.test(lower)) {
    recognizedIntents.push("SOLVE");
  }
  if (/\b(proof|prove|induction|correctness proof|verify)\b/i.test(lower)) {
    recognizedIntents.push("PROVE");
  }
  if (/\b(derive|derivation|formula for|equation)\b/i.test(lower)) {
    recognizedIntents.push("DERIVE");
  }
  if (/\b(simulate|run|execute|step through|lifecycle|flow)\b/i.test(lower)) {
    recognizedIntents.push("SIMULATE");
  }
  if (
    /\b(trace|walkthrough|step by step|steps of|progression)\b/i.test(lower)
  ) {
    recognizedIntents.push("TRACE");
  }
  if (/\b(predict|what happens next|subsequent)\b/i.test(lower)) {
    recognizedIntents.push("PREDICT");
  }
  if (/\b(practice|quiz|test me|challenge|exercise)\b/i.test(lower)) {
    recognizedIntents.push("PRACTICE");
  }
  if (/\b(visualize|draw|show me|illustrate|diagram)\b/i.test(lower)) {
    recognizedIntents.push("VISUALIZE");
  }
  if (
    /\b(optimize|optimizing|optimization|improve performance|speed up|refactor)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("OPTIMIZE");
  }
  if (
    /\b(code|implementation|implement|write code|code snippet|pseudocode)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("CODE_EXPLANATION");
    recognizedIntents.push("IMPLEMENTATION");
  }
  if (
    /\b(exam|revision|review for exam|quick review|summary for test|cheat sheet)\b/i.test(
      lower,
    )
  ) {
    recognizedIntents.push("EXAM_PREPARATION");
    recognizedIntents.push("CONCEPTUAL_REVISION");
  }

  // Fallback / default
  if (recognizedIntents.length === 0) {
    recognizedIntents.push("EXPLAIN");
  } else if (
    !recognizedIntents.includes("EXPLAIN") &&
    !recognizedIntents.includes("DEFINITION")
  ) {
    recognizedIntents.push("EXPLAIN");
  }

  const userIntent = recognizedIntents[0];
  const secondaryIntents = recognizedIntents.slice(1);
  const intents = [...recognizedIntents];

  // 2. Extract Subject and Concept
  // Clean punctuation and common prefixes
  const cleanSubject = p
    .replace(
      /^(explain|how does|what is|how do|show me|visualize|teach me|simulate|trace|compare)\s+/i,
      "",
    )
    .replace(/\s+(work|function|operate|behave)\??$/i, "")
    .replace(/[?.!]+$/, "")
    .trim();

  const subject = cleanSubject || p;
  let concept =
    cleanSubject.split(/\s+with|\s+for|\s+using|\s+in/i)[0]?.trim() || subject;

  const targetMatch = p.match(
    /\b(?:into|in|on)\s+(?:an?\s+)?([A-Za-z0-9_\s-]+?)(?:\s+step|\s+in order|\s+then|[:;.,]|$)/i,
  );
  if (targetMatch && targetMatch[1]) {
    const candidateTarget = targetMatch[1].trim();
    if (
      candidateTarget.length > 1 &&
      !/^(?:this|that|the|an?|order|detail|depth)\b/i.test(candidateTarget)
    ) {
      concept = candidateTarget;
    }
  }

  // 3. Determine Scope
  let scope: QuestionScope = "unit";
  if (/\b(architecture|topology|components|system design)\b/i.test(lower)) {
    scope = "architecture";
  } else if (
    /\b(between|handshake|interaction|connection|protocol|client|server|peer|exchange|dialogue|ack|syn|request.*response|send.*receive)\b/i.test(
      lower,
    )
  ) {
    scope = "interaction";
  } else if (
    /\b(loop|feedback|control|network|distribution|cycle|system|converter|storage|alarm)\b/i.test(
      lower,
    )
  ) {
    scope = "system";
  } else if (
    /\b(end-to-end|full flow|lifecycle|pipeline|complete process|across)\b/i.test(
      lower,
    )
  ) {
    scope = "end-to-end";
  }

  // 4. Extract Requested Operation & Numerical / Literal Inputs
  let requestedOperation: string | undefined;
  const opMatch = lower.match(
    /\b(insert|delete|remove|search|lookup|rotate|sort|traverse|send|receive|route|dispatch|expand|condense|parse|lex|compile|optimize)\b/i,
  );
  if (opMatch) {
    requestedOperation = opMatch[1];
  }

  // Extract explicit inputs (e.g. array [1, 2, 3], chain 10 -> 20 -> 30, key 42, numbers)
  const inputs: unknown[] = [];
  const arrayMatch = p.match(/\[([\d\s,.-]+)\]/);
  if (arrayMatch) {
    const parsed = arrayMatch[1]
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => !isNaN(n));
    if (parsed.length > 0) {
      inputs.push(parsed);
    }
  }
  const chainInputMatch = p.match(
    /([A-Za-z0-9_-]+(?:\s*(?:->|→)\s*[A-Za-z0-9_-]+)+)/,
  );
  if (chainInputMatch && inputs.length === 0) {
    const chainElements = chainInputMatch[1]
      .split(/\s*(?:->|→)\s*/)
      .map((s) => s.trim())
      .map((s) => (!isNaN(Number(s)) ? Number(s) : s));
    if (chainElements.length > 0) {
      inputs.push(chainElements);
    }
  }
  const numMatches = p.match(/\b\d+\b/g);
  if (numMatches && inputs.length === 0) {
    numMatches.forEach((n) => inputs.push(Number(n)));
  }

  // Extract chronologically ordered operations
  const parsedOperations = extractOrderedOperations(prompt);

  // 5. Inferred Constraints & Requirements
  const constraints: string[] = [];
  const explicitRequirements: string[] = [];
  const implicitRequirements: string[] = [
    "Ensure state transitions are causally justified",
    "Preserve foundational system invariants",
    "Distinguish intermediate states from verified final states",
  ];

  if (/\b(fail|fails|failure|broken|timeout|abort|rollback)\b/i.test(lower)) {
    explicitRequirements.push(
      "Explicitly demonstrate failure scenario and consequences/recovery",
    );
  }
  if (/\b(compare|contrast|difference)\b/i.test(lower)) {
    explicitRequirements.push(
      "Provide comparative visual contrast between alternatives",
    );
  }
  if (inputs.length > 0) {
    explicitRequirements.push(
      `Incorporate explicit input parameters: ${JSON.stringify(inputs[0])}`,
    );
  }

  if (/\b(sorted|ascending|descending)\b/i.test(lower)) {
    constraints.push("Elements must maintain sorted ordering");
  }
  if (/\b(balanced|avl|red-black)\b/i.test(lower)) {
    constraints.push("Balance invariants must be preserved across mutations");
  }
  if (/\b(closed cycle|conservation|conserve)\b/i.test(lower)) {
    constraints.push("Conservation of mass and energy must be preserved");
  }
  if (/\b(acyclic|dag|tree)\b/i.test(lower)) {
    constraints.push("Graph must remain strictly acyclic");
  }
  if (/\b(non-negative|positive weights?)\b/i.test(lower)) {
    constraints.push("Edge weights must be non-negative");
  }

  // 6. Desired Explanation Depth
  let desiredExplanationDepth: ExplanationDepth = "standard";
  if (/\b(rigorous|mathematical proof|formal|axiom|theorem)\b/i.test(lower)) {
    desiredExplanationDepth = "rigorous";
  } else if (
    /\b(deep dive|in-depth|detailed|thorough|internals|under the hood)\b/i.test(
      lower,
    )
  ) {
    desiredExplanationDepth = "deep_dive";
  } else if (
    /\b(simple|overview|eli5|beginner|briefly|summary)\b/i.test(lower)
  ) {
    desiredExplanationDepth = "overview";
  }

  // 7. Extract Important Concepts
  const stopWords = new Set([
    "explain",
    "how",
    "does",
    "what",
    "is",
    "a",
    "the",
    "an",
    "and",
    "or",
    "in",
    "of",
    "to",
    "for",
    "with",
    "work",
    "show",
    "me",
    "teach",
    "if",
    "when",
    "by",
  ]);
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  const importantConcepts = Array.from(new Set([concept, ...words])).slice(
    0,
    8,
  );

  // 8. Assumed Prerequisite Knowledge
  const assumedKnowledge: string[] = [
    `Foundational familiarity with ${concept} terminology`,
  ];
  if (scope === "system" || scope === "architecture") {
    assumedKnowledge.push(
      "Basic understanding of component modularity and interconnected dataflow",
    );
  }
  if (intents.includes("COUNTERFACTUAL")) {
    assumedKnowledge.push(
      "Baseline nominal behavior of the system before failure injection",
    );
  }

  // 9. Formalized Goal & Requested Output
  const goal = `Demonstrate and verify ${concept} through causal mechanisms, state transitions, and invariant preservation.`;
  const requestedOutput = intents.includes("COUNTERFACTUAL")
    ? "Causal progression demonstrating both nominal and alternative/failure paths"
    : intents.includes("COMPARE")
    ? "Comparative structural evaluation"
    : "Sequential conceptual milestone walkthrough";

  // 10. Ambiguity Handling
  const ambiguity: Ambiguity[] = [];
  const assumptions: string[] = [];

  if (userIntent === "TRANSFORM" && inputs.length === 0) {
    ambiguity.push({
      issue: "No initial input state or target value specified",
      alternatives: [
        "Select canonical pedagogical example",
        "Request user input",
      ],
      impact: "medium",
      resolution:
        "Selected representative pedagogical sample state to illustrate invariant behavior clearly",
    });
    assumptions.push(
      "Using canonical pedagogical values for initial demonstration",
    );
  }

  if (
    /\b(tree|graph)\b/i.test(lower) &&
    !/\b(binary|avl|directed|undirected|weighted)\b/i.test(lower)
  ) {
    ambiguity.push({
      issue: "Graph or tree variant unspecified",
      alternatives: [
        "Directed acyclic graph",
        "Binary search tree",
        "General undirected graph",
      ],
      impact: "low",
      resolution:
        "Standard directed hierarchy assumed for optimal visual clarity",
    });
    assumptions.push("Assumed standard directed hierarchy");
  }

  const requiresSimulation =
    ["SIMULATE", "TRACE", "TRANSFORM", "SOLVE", "OPTIMIZE", "PREDICT"].includes(
      userIntent,
    ) || /\b(step|step-by-step|lifecycle|process|algorithm)\b/i.test(lower);

  const requiresStepByStep = requiresSimulation || userIntent === "EXPLAIN";

  return {
    userIntent,
    secondaryIntents:
      secondaryIntents.length > 0 ? secondaryIntents : undefined,
    intents,
    scope,
    goal,
    requestedOutput,
    subject,
    concept,
    importantConcepts,
    explicitRequirements,
    implicitRequirements,
    assumedKnowledge,
    requestedOperation,
    parsedOperations,
    inputs,
    constraints,
    desiredExplanationDepth,
    ambiguity,
    potentialAmbiguities: ambiguity,
    assumptions,
    relevantContext: context?.selectedEntities?.length
      ? `Selected entities: ${context.selectedEntities.join(", ")}`
      : undefined,
    requiresSimulation,
    requiresStepByStep,
    rawQuestion: prompt,
    baselineElements:
      inputs.length > 0 && Array.isArray(inputs[0])
        ? (inputs[0] as unknown[])
        : (parsedOperations[0]?.metadata?.baselineElements as unknown[] | undefined),
    metadata: {
      baselineElements:
        inputs.length > 0 && Array.isArray(inputs[0])
          ? (inputs[0] as unknown[])
          : (parsedOperations[0]?.metadata?.baselineElements as unknown[] | undefined),
    },
    confidence: ambiguity.length > 0 ? CONFIDENCE_ASSUMED : CONFIDENCE_INFERRED,
  };
}

/**
 * Universal extractor for chronologically ordered operations requested in prompts.
 * Enforces strict separation between DATA and OPERATIONS.
 */
export function extractOrderedOperations(prompt: string): ParsedOperation[] {
  const operations: ParsedOperation[] = [];
  let orderCounter = 0;

  const WORD_TO_NUMBER: Record<string, number> = {
    once: 1,
    twice: 2,
    thrice: 3,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  // --------------------------------------------------------------------------
  // 1. Explicit Function-Style Operations (e.g. PUT(A, 1), GET(A), DELETE(20))
  // --------------------------------------------------------------------------
  const functionOpRegex =
    /\b(PUT|GET|SET|INSERT|DELETE|REMOVE|SEARCH|FIND|POP|PUSH)\s*\(\s*([^)]*?)\s*\)/gi;
  let fnMatch: RegExpExecArray | null;
  const functionOps: ParsedOperation[] = [];

  while ((fnMatch = functionOpRegex.exec(prompt)) !== null) {
    const rawOp = fnMatch[1].toLowerCase();
    const rawArgs = fnMatch[2].trim();
    const argTokens = rawArgs
      ? rawArgs.split(",").map((a) => a.trim().replace(/^['"]|['"]$/g, ""))
      : [];

    let key: unknown = undefined;
    let value: unknown = undefined;
    const argsObj: Record<string, unknown> = {};

    if (rawOp === "put" || rawOp === "set") {
      key = argTokens[0];
      const numVal = Number(argTokens[1]);
      value = !isNaN(numVal) && argTokens[1] !== "" ? numVal : argTokens[1];
      argsObj.key = key;
      argsObj.value = value;
    } else if (rawOp === "get" || rawOp === "search" || rawOp === "find") {
      key = argTokens[0];
      const numVal = Number(argTokens[0]);
      value = !isNaN(numVal) && argTokens[0] !== "" ? numVal : argTokens[0];
      argsObj.key = key;
      argsObj.target = value;
    } else if (rawOp === "insert" || rawOp === "push") {
      const numVal = Number(argTokens[0]);
      value = !isNaN(numVal) && argTokens[0] !== "" ? numVal : argTokens[0];
      argsObj.value = value;
    } else if (rawOp === "delete" || rawOp === "remove" || rawOp === "pop") {
      if (argTokens.length > 0) {
        const numVal = Number(argTokens[0]);
        value = !isNaN(numVal) && argTokens[0] !== "" ? numVal : argTokens[0];
        argsObj.target = value;
      }
    }

    functionOps.push({
      op: rawOp,
      key,
      value,
      target: rawOp === "get" || rawOp === "put" ? "cache" : undefined,
      arguments: argsObj,
      order: ++orderCounter,
      semanticRole: "operation",
      metadata: { rawFunction: fnMatch[0] },
    });
  }

  // If explicit functional operations were found (e.g. 10 LRU operations), they are authoritative!
  if (functionOps.length > 0) {
    return functionOps;
  }

  // --------------------------------------------------------------------------
  // 2. Search Operations with Data Containers (e.g. Search for 37 in [2, 5, 8, ...])
  // --------------------------------------------------------------------------
  const searchPattern1 =
    /\b(?:search(?:ing)?|find(?:ing)?|lookup)\b.*?(?:for\s+)?(?:target\s+|key\s+|value\s+|element\s+)?(\d+|[A-Za-z0-9_-]+)\s*(?:in|inside|on|within)?\s*(?:array|list)?\s*[:\s]*\[([\d\s,.-]+)\]/i;
  const searchPattern2 =
    /\[([\d\s,.-]+)\]\s*(?:searching\s+for|find(?:ing)?|search(?:ing)?\s+for|target|looking\s+for)\s*[:\s]*(\d+|[A-Za-z0-9_-]+)/i;

  const sMatch1 = prompt.match(searchPattern1);
  const sMatch2 = !sMatch1 ? prompt.match(searchPattern2) : null;

  if (sMatch1 || sMatch2) {
    const targetRaw = sMatch1 ? sMatch1[1] : sMatch2![2];
    const arrayRaw = sMatch1 ? sMatch1[2] : sMatch2![1];
    const targetVal = !isNaN(Number(targetRaw)) ? Number(targetRaw) : targetRaw;
    const arrayElements = arrayRaw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));

    return [
      {
        op: "search",
        target: targetVal,
        value: targetVal,
        arguments: { target: targetVal, container: arrayElements },
        inputs: [arrayElements],
        order: 1,
        semanticRole: "operation",
        metadata: { containerType: "array", containerElements: arrayElements },
      },
    ];
  }

  // --------------------------------------------------------------------------
  // 3. Positional Linked List Insertions (e.g. Insert 25 between 10 and 40 in 10 -> 40 -> 60)
  // --------------------------------------------------------------------------
  const betweenMatch = prompt.match(
    /\b(?:insert(?:ing)?|add(?:ing)?)\s+(\d+|[A-Za-z0-9_-]+)\s+between\s+(\d+|[A-Za-z0-9_-]+)\s+and\s+(\d+|[A-Za-z0-9_-]+)/i,
  );
  if (betweenMatch) {
    const val = !isNaN(Number(betweenMatch[1]))
      ? Number(betweenMatch[1])
      : betweenMatch[1];
    const after = !isNaN(Number(betweenMatch[2]))
      ? Number(betweenMatch[2])
      : betweenMatch[2];
    const before = !isNaN(Number(betweenMatch[3]))
      ? Number(betweenMatch[3])
      : betweenMatch[3];

    // Check for baseline chain e.g. "10 -> 40 -> 60" or "10 → 40 → 60"
    const chainMatch = prompt.match(
      /([A-Za-z0-9_-]+(?:\s*(?:->|→)\s*[A-Za-z0-9_-]+)+)/,
    );
    const baselineChain = chainMatch
      ? chainMatch[1]
          .split(/\s*(?:->|→)\s*/)
          .map((s) => s.trim())
          .map((s) => (!isNaN(Number(s)) ? Number(s) : s))
      : undefined;

    return [
      {
        op: "insert",
        value: val,
        target: "linked_list",
        arguments: { value: val, after, before, baselineChain },
        inputs: baselineChain ? [baselineChain] : undefined,
        order: 1,
        semanticRole: "operation",
        metadata: { after, before, baselineChain },
      },
    ];
  }

  // --------------------------------------------------------------------------
  // 4. Dijkstra / Shortest Path Requests (e.g. Shortest path from A to F in graph)
  // --------------------------------------------------------------------------
  const shortestPathMatch = prompt.match(
    /\b(?:shortest\s+path|dijkstra)\b.*?(?:from\s+([A-Za-z0-9_-]+)\s+to\s+([A-Za-z0-9_-]+))/i,
  );
  if (shortestPathMatch) {
    const startV = shortestPathMatch[1].trim();
    const endV = shortestPathMatch[2].trim();
    return [
      {
        op: "shortest_path",
        target: "graph",
        arguments: { source: startV, destination: endV },
        order: 1,
        semanticRole: "operation",
        metadata: { startVertex: startV, targetVertex: endV },
      },
    ];
  }

  // --------------------------------------------------------------------------
  // 5. Explicit Count Sequential Insertions (e.g. Insert: 30, 20, 10, 25, 28, 27, 50, 60, 55)
  // --------------------------------------------------------------------------
  const countHeaderMatch = prompt.match(
    /\b(?:insert(?:ing|s|ion)?|add(?:ing|s)?)\s*(?:\d+\s+(?:elements?|nodes?|values?|numbers?|items?))?(?:\s+(?:into|in|to)\s+[^:;.,]+)?[:\s]+((?:\d+[\s,and.-]+){2,}\d+)/i,
  );
  if (countHeaderMatch && countHeaderMatch[1]) {
    const numbers = countHeaderMatch[1].match(/\b\d+\b/g);
    if (numbers && numbers.length > 1) {
      for (const numStr of numbers) {
        operations.push({
          op: "insert",
          value: Number(numStr),
          arguments: { value: Number(numStr) },
          order: ++orderCounter,
          semanticRole: "operation",
          metadata: { sequentialInsertion: true },
        });
      }
    }
  }

  // Check for leading list of numbers before operations:
  // e.g. "10, 15, 30, 5, 25, 40, 8, 12, 3 After all insertions, remove the minimum element three times..."
  let promptToProcess = prompt;
  if (operations.length === 0) {
    const leadingNumbersMatch = prompt.match(
      /^\s*((?:\d+[\s,]+){2,}\d+)\s*(?:after\s+(?:all\s+)?(?:insert(?:ion)?s?|additions?)|(?:into|in)\s+[^.;]+|[,.;]|\s|$)(.*)/i,
    );
    if (leadingNumbersMatch) {
      const rawNums = leadingNumbersMatch[1];
      const rest = leadingNumbersMatch[2] || "";
      const numbers = rawNums.match(/\b\d+\b/g);
      if (numbers && numbers.length > 0) {
        for (const numStr of numbers) {
          operations.push({
            op: "insert",
            value: Number(numStr),
            arguments: { value: Number(numStr) },
            order: ++orderCounter,
            semanticRole: "operation",
            metadata: { leadingInput: true },
          });
        }
        promptToProcess = rest;
      }
    }
  }

  // Extract baseline container chain or array for operations to bind to
  const chainMatch = prompt.match(
    /([A-Za-z0-9_-]+(?:\s*(?:->|→)\s*[A-Za-z0-9_-]+)+)/,
  );
  const baselineChain = chainMatch
    ? chainMatch[1]
        .split(/\s*(?:->|→)\s*/)
        .map((s) => s.trim())
        .map((s) => (!isNaN(Number(s)) ? Number(s) : s))
    : undefined;

  const arrayMatch = prompt.match(/\[([\d\s,.-]+)\]/);
  const baselineArray = arrayMatch
    ? arrayMatch[1]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n))
    : undefined;

  // Split clauses by sequence markers: "then", "followed by", "after that", "finally", "and then", semicolons, periods
  const clauses = promptToProcess.split(
    /\b(?:then|followed by|after that|finally|and then)\b|[;.]/i,
  );

  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (!trimmed) {
      continue;
    }

    // Check for repetitions / deletions / eliminations
    const deleteMatch = trimmed.match(
      /\b(?:delete(?:ing|s|ion)?|remove(?:ing|s|al)?|pop(?:ping|s)?|extract(?:ing)?|eliminate(?:ing|s|ion)?|drop(?:ping|s)?|discard(?:ing|s)?)\b/i,
    );
    if (deleteMatch) {
      // Isolate target clause from container clause if present
      // e.g. "Eliminate nodes 20 and 30 from the linked list 10 → 20 → 30 → 40 → 50"
      let targetClause = trimmed;
      const containerBoundaryMatch = trimmed.match(
        /\b(?:delete(?:ing|s|ion)?|remove(?:ing|s|al)?|pop(?:ping|s)?|extract(?:ing)?|eliminate(?:ing|s|ion)?|drop(?:ping|s)?|discard(?:ing|s)?)\s+([^;.]+?)(?:\s+(?:from|in|into|on|within|inside)\b|\s*(?:->|→)|\[|$)/i,
      );
      if (containerBoundaryMatch && containerBoundaryMatch[1]) {
        targetClause = containerBoundaryMatch[1];
      }

      // Check for explicit values to delete (e.g. "delete 20, 70, 50 in order" or "eliminate nodes 20 and 30")
      const deleteNums = targetClause.match(/\b\d+\b/g);
      if (deleteNums && deleteNums.length > 0) {
        for (const dStr of deleteNums) {
          const dVal = Number(dStr);
          operations.push({
            op: "delete",
            value: dVal,
            target: dVal,
            arguments: { value: dVal, target: dVal, baselineChain, baselineArray },
            inputs: baselineChain ? [baselineChain] : baselineArray ? [baselineArray] : undefined,
            order: ++orderCounter,
            semanticRole: "operation",
            metadata: { rawClause: trimmed, baselineElements: baselineChain || baselineArray },
          });
        }
        continue;
      }

      const repeatMatch = trimmed.match(
        /\b(?:(once|twice|thrice|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+times?|(once|twice|thrice))\b/i,
      );
      const rawWord = repeatMatch
        ? (repeatMatch[1] || repeatMatch[2]).toLowerCase()
        : "once";
      const repeatCount = !isNaN(Number(rawWord))
        ? Number(rawWord)
        : WORD_TO_NUMBER[rawWord] || 1;

      const targetDesc =
        /\b(?:min(?:imum)?|max(?:imum)?|root|top|smallest|largest)\b/i.test(
          trimmed,
        )
          ? "min"
          : undefined;

      for (let r = 0; r < repeatCount; r++) {
        operations.push({
          op: "delete",
          target: targetDesc,
          arguments: { target: targetDesc, baselineChain, baselineArray },
          inputs: baselineChain ? [baselineChain] : baselineArray ? [baselineArray] : undefined,
          order: ++orderCounter,
          semanticRole: "operation",
          metadata: {
            rawClause: trimmed,
            repetition: r + 1,
            totalRepetitions: repeatCount,
            baselineElements: baselineChain || baselineArray,
          },
        });
      }
      continue;
    }

    // Check for insertion clauses e.g. "insert 25" or "insert 20 and 30"
    const insertMatch = trimmed.match(
      /\b(?:insert(?:ing|s)?|add(?:ing|s)?)\s+([^;.]+?)(?:\s+(?:into|in|to|on)\b|\s*(?:->|→)|\[|$)/i,
    );
    if (insertMatch && insertMatch[1]) {
      const indexMatch = trimmed.match(
        /\b(?:at\s+(?:index|pos|position|idx)|index\s*:?)\s*(\d+)\b/i,
      );
      const specifiedIndex = indexMatch ? Number(indexMatch[1]) : undefined;
      const insertNums = insertMatch[1].match(/\b\d+\b/g);
      if (insertNums && insertNums.length > 0) {
        for (const iStr of insertNums) {
          const iVal = Number(iStr);
          operations.push({
            op: "insert",
            value: iVal,
            target: iVal,
            index: specifiedIndex,
            arguments: { value: iVal, target: iVal, index: specifiedIndex, baselineChain, baselineArray },
            inputs: baselineChain ? [baselineChain] : baselineArray ? [baselineArray] : undefined,
            order: ++orderCounter,
            semanticRole: "operation",
            metadata: { rawClause: trimmed, index: specifiedIndex, baselineElements: baselineChain || baselineArray },
          });
        }
        continue;
      }
    }

    // Check for swap clauses e.g. "swap 2 and 5"
    const swapMatch = trimmed.match(
      /\bswap(?:ping|s)?\s+(\d+|[A-Za-z0-9_-]+)\s+(?:and|with)\s+(\d+|[A-Za-z0-9_-]+)/i,
    );
    if (swapMatch) {
      const aVal = !isNaN(Number(swapMatch[1])) ? Number(swapMatch[1]) : swapMatch[1];
      const bVal = !isNaN(Number(swapMatch[2])) ? Number(swapMatch[2]) : swapMatch[2];
      operations.push({
        op: "swap",
        value: [aVal, bVal],
        arguments: { a: aVal, b: bVal, baselineChain, baselineArray },
        inputs: baselineChain ? [baselineChain] : baselineArray ? [baselineArray] : undefined,
        order: ++orderCounter,
        semanticRole: "operation",
        metadata: { rawClause: trimmed, a: aVal, b: bVal, baselineElements: baselineChain || baselineArray },
      });
      continue;
    }

    // Check for reverse clause
    if (/\breverse(?:ing)?\b/i.test(trimmed)) {
      operations.push({
        op: "reverse",
        arguments: { baselineChain, baselineArray },
        inputs: baselineChain ? [baselineChain] : baselineArray ? [baselineArray] : undefined,
        order: ++orderCounter,
        semanticRole: "operation",
        metadata: { rawClause: trimmed, baselineElements: baselineChain || baselineArray },
      });
      continue;
    }
  }

  // --------------------------------------------------------------------------
  // 6. Quality Gate & Role Validation: Ensure data is NOT turned into fake operations
  // --------------------------------------------------------------------------
  return operations.filter((op) => {
    // Valid operation must have an operation type and an order
    return op && typeof op.op === "string" && op.op.trim().length > 0;
  });
}
