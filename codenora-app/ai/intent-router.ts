/**
 * Cognora Intent Router
 *
 * Classifies learner input prompts and interaction contexts into distinct intents
 * BEFORE making provider completion calls.
 *
 * Supported Intents:
 * - 'command': Direct slash command (e.g. /array, /bst, /clear) -> zero-LLM local deterministic execution.
 * - 'coding_problem': Competitive programming problems (CodeChef, LeetCode, Codeforces, constraints, test cases, submission-ready code).
 * - 'visual_teaching': Full multi-step interactive whiteboard lessons (default for concepts, algorithms, data structures).
 * - 'follow_up': Context-dependent questions referencing active selections, current lesson steps, or recent visual changes.
 * - 'general_question': Factual lookups or definitions that don't require full multi-step whiteboard construction.
 */

import type { TeachingRequestContext } from "./teaching-contract";

export type UserIntent =
  | "command"
  | "coding_problem"
  | "visual_teaching"
  | "follow_up"
  | "general_question";

export type CognoraIntentClass =
  | "COMMAND"
  | "QUESTION"
  | "TEACHING_REQUEST"
  | "PLAYBACK_CONTROL"
  | "VIEW_CONTROL"
  | "OBSERVATION"
  | "ORDINARY_TEXT";

export type ProgrammingLanguage =
  | "cpp"
  | "java"
  | "python"
  | "c"
  | "javascript";

export interface IntentClassification {
  intent: UserIntent;
  intentClass?: CognoraIntentClass;
  resolvedCommand?: string;
  confidence: number;
  reason: string;
  recommendedReasoningEffort: "low" | "medium" | "high";
  detectedLanguage?: ProgrammingLanguage;
}

const CODING_PLATFORMS = [
  "codechef",
  "leetcode",
  "codeforces",
  "hackerrank",
  "atcoder",
  "geeksforgeeks",
  "gfg",
  "spoj",
  "hackerearth",
];

const CODING_PROBLEM_PHRASES = [
  "given an array",
  "given a string",
  "given two integers",
  "given an integer",
  "given a binary tree",
  "given a matrix",
  "given n integers",
  "test cases",
  "sample input",
  "sample output",
  "time limit",
  "memory limit",
  "modulo 10^9+7",
  "modulo 1000000007",
  "solve this problem",
  "optimal solution for",
  "submission-ready code",
  "submission ready code",
  "write code for",
  "write a solution in",
  "optimal code for",
  "problem statement",
];

const FOLLOW_UP_PHRASES = [
  "why did",
  "what if",
  "next step",
  "previous step",
  "what happens next",
  "explain this",
  "why is this",
  "explain the selected",
  "explain the highlighted",
  "change this",
  "what does this node mean",
  "how come",
  "show another step",
  "why is that",
  "what is that",
];

const GENERAL_QUESTION_PATTERNS = [
  /^what is the (time|space) complexity of/i,
  /^what does O\(.+\) mean/i,
  /^what is the difference between/i,
  /^define\b/i,
  /^who invented\b/i,
  /^is .+ stable/i,
  /^why is .+ faster than/i,
];

const VISUAL_KEYWORDS = [
  "draw",
  "visualize",
  "show",
  "illustrate",
  "step by step",
  "walk me through",
  "teach me",
  "explain how",
  "how does",
  "demonstrate",
  "diagram",
  "animate",
];

/**
 * Extracts requested programming language from prompt or defaults to "cpp" for CP problems.
 */
export function detectProgrammingLanguage(
  prompt: string,
): ProgrammingLanguage | undefined {
  const lower = prompt.toLowerCase();

  // Check C++ first (note: '+' is a non-word char, so \b does not match after '+')
  if (/(?:^|[^\w])(c\+\+|cpp)(?:[^\w+]|$)/i.test(lower)) {
    return "cpp";
  }
  if (/\b(python|py)\b/i.test(lower)) {
    return "python";
  }
  if (/\bjava\b/i.test(lower) && !/javascript/i.test(lower)) {
    return "java";
  }
  if (/\b(javascript|js|typescript|ts)\b/i.test(lower)) {
    return "javascript";
  }
  if (
    /\b(c language)\b/i.test(lower) ||
    /(?:^|[^\w])in c(?:[^\w+]|$)/i.test(lower)
  ) {
    return "c";
  }

  return undefined;
}

/**
 * Deterministically parses natural language instructions into canonical slash commands
 * with zero AI/LLM requests.
 *
 * Strict Disambiguation:
 * - Direct commands ("Create an array with 10 elements", "Insert 40 into the heap") -> returns command string
 * - Questions ("How do I create an array?", "What happens if I insert 40?") -> returns null
 * - Commentary ("The command /array(10) creates an array") -> returns null
 */
export function parseNaturalLanguageToCommand(prompt: string): string | null {
  const raw = prompt.trim();
  if (raw.startsWith("/")) {
    return raw;
  }

  const lower = raw
    .toLowerCase()
    .replace(/[.!?;]+$/, "")
    .trim();

  // Guard: Questions or hypothetical inquiries must NEVER be converted to commands
  if (
    /^(how do i|how to|how can i|what is|what are|what happens|if i|why|can you explain|tell me about|could you explain)/i.test(
      lower,
    ) ||
    /^(the command|a command|using \/|type \/)/i.test(lower) ||
    raw.includes("?")
  ) {
    return null;
  }

  // 1. Array creation: "create an array with 10 elements", "create array of 10"
  const arrCountMatch = lower.match(
    /^(?:create|make|build|generate|initialize)\s+(?:an?\s+)?array\s+(?:with|of)\s+(\d+)(?:\s+elements?)?$/i,
  );
  if (arrCountMatch) {
    return `/array ${arrCountMatch[1]}`;
  }

  const arrLiteralMatch = lower.match(
    /^(?:create|make|build|generate|initialize)\s+(?:an?\s+)?array(?:\s+(?:with|of))?\s+(\[[^\]]+\])$/i,
  );
  if (arrLiteralMatch) {
    return `/array ${arrLiteralMatch[1]}`;
  }

  // 2. Heap creation: "create a max heap with [40, 35, 25]", "create heap [10, 20]"
  const heapLiteralMatch = lower.match(
    /^(?:create|make|build)\s+(?:a\s+)?(max|min)\s+heap(?:\s+(?:with|of))?\s+(\[[^\]]+\])$/i,
  );
  if (heapLiteralMatch) {
    return `/heap ${heapLiteralMatch[1]} ${heapLiteralMatch[2]}`;
  }
  const heapGenericMatch = lower.match(
    /^(?:create|make|build)\s+(?:a\s+)?heap(?:\s+(?:with|of))?\s+(\[[^\]]+\])$/i,
  );
  if (heapGenericMatch) {
    return `/heap max ${heapGenericMatch[1]}`;
  }

  // 3. Linked list creation: "create a linked list with [10, 20, 30]"
  const llMatch = lower.match(
    /^(?:create|make|build)\s+(?:a\s+)?linked\s*list(?:\s+(?:with|of))?\s+(\[[^\]]+\])$/i,
  );
  if (llMatch) {
    return `/linked-list ${llMatch[1]}`;
  }

  // 4. Insert commands: "insert 40 into the heap", "insert 40 into array", "insert 40"
  const insertMatch = lower.match(
    /^(?:insert|add)\s+(\d+|[a-zA-Z0-9_-]+)(?:\s+into\s+(?:the\s+)?(?:[a-zA-Z0-9_-]+))?$/i,
  );
  if (insertMatch) {
    return `/insert ${insertMatch[1]}`;
  }

  // 5. Delete commands: "delete 25 from heap", "delete 25", "remove 25"
  const deleteMatch = lower.match(
    /^(?:delete|remove)\s+(\d+|[a-zA-Z0-9_-]+)(?:\s+from\s+(?:the\s+)?(?:[a-zA-Z0-9_-]+))?$/i,
  );
  if (deleteMatch) {
    return `/delete ${deleteMatch[1]}`;
  }

  if (/^(?:delete|remove)\s+(?:selected|selection|this|that)$/i.test(lower)) {
    return `/delete`;
  }

  // 6. Stack / Queue operations
  const pushMatch = lower.match(
    /^push\s+(\d+|[a-zA-Z0-9_-]+)(?:\s+(?:onto|to|in)\s+(?:the\s+)?stack)?$/i,
  );
  if (pushMatch) {
    return `/push ${pushMatch[1]}`;
  }
  if (/^pop(?:\s+from\s+(?:the\s+)?stack)?$/i.test(lower)) {
    return `/pop`;
  }

  // 7. View / Playback Controls
  if (/^(?:zoom\s+in)$/i.test(lower)) {
    return `/zoom in`;
  }
  if (/^(?:zoom\s+out)$/i.test(lower)) {
    return `/zoom out`;
  }
  if (
    /^(?:fit\s+to\s+screen|fit\s+viewport|fit\s+view|fit\s+canvas)$/i.test(
      lower,
    )
  ) {
    return `/fit`;
  }
  if (/^(?:next\s+step|go\s+to\s+next\s+step|next)$/i.test(lower)) {
    return `/next`;
  }
  if (
    /^(?:previous\s+step|go\s+to\s+previous\s+step|previous|back)$/i.test(lower)
  ) {
    return `/previous`;
  }
  if (/^(?:pause\s+lesson|pause)$/i.test(lower)) {
    return `/pause`;
  }
  if (/^(?:play\s+lesson|play|resume)$/i.test(lower)) {
    return `/play`;
  }
  if (/^(?:replay\s+lesson|replay|restart\s+lesson)$/i.test(lower)) {
    return `/replay`;
  }

  // 8. Session Destructive
  if (
    /^(?:clear\s+canvas|clear\s+workspace|clear\s+screen|clear\s+all)$/i.test(
      lower,
    )
  ) {
    return `/clear`;
  }
  if (/^(?:reset\s+canvas|reset\s+workspace|reset\s+lesson)$/i.test(lower)) {
    return `/reset`;
  }

  return null;
}

/**
 * Classifies learner prompt and context into a user intent.
 */
export function detectUserIntent(
  prompt: string,
  context?: Partial<TeachingRequestContext>,
): IntentClassification {
  const raw = prompt.trim();
  const lower = raw.toLowerCase();

  // 1. Direct slash commands
  if (raw.startsWith("/")) {
    return {
      intent: "command",
      intentClass: "COMMAND",
      resolvedCommand: raw,
      confidence: 1.0,
      reason: "Prompt starts with slash command operator '/'",
      recommendedReasoningEffort: "low",
    };
  }

  // 1.5. Deterministic Natural Language Command Translation (Zero AI Calls)
  const nlCommand = parseNaturalLanguageToCommand(raw);
  if (nlCommand) {
    let intentClass: CognoraIntentClass = "COMMAND";
    if (
      nlCommand.startsWith("/next") ||
      nlCommand.startsWith("/previous") ||
      nlCommand.startsWith("/play") ||
      nlCommand.startsWith("/pause") ||
      nlCommand.startsWith("/replay")
    ) {
      intentClass = "PLAYBACK_CONTROL";
    } else if (
      nlCommand.startsWith("/zoom") ||
      nlCommand.startsWith("/fit") ||
      nlCommand.startsWith("/focus") ||
      nlCommand.startsWith("/see")
    ) {
      intentClass = "VIEW_CONTROL";
    }

    return {
      intent: "command",
      intentClass,
      resolvedCommand: nlCommand,
      confidence: 0.95,
      reason: `Deterministic natural language instruction mapped to '${nlCommand}'`,
      recommendedReasoningEffort: "low",
    };
  }

  // 2. Competitive Programming / Coding Problem detection
  const hasPlatformMention = CODING_PLATFORMS.some((p) => lower.includes(p));
  const hasCodingPhrase = CODING_PROBLEM_PHRASES.some((phrase) =>
    lower.includes(phrase),
  );
  const hasConstraintPattern =
    /1\s*(?:<=|≤)\s*[a-z0-9_]+\s*(?:<=|≤)\s*10\^?[0-9]+/i.test(lower) ||
    /10\^5|10\^9|10\*\*5/i.test(lower) ||
    /\b(subarrays?|subsequences?|knapsack|two sum|three sum|longest common)\b/i.test(
      lower,
    );
  const hasExplicitCodeRequest =
    /(?:write|give|provide|show)\s+(?:me\s+)?(?:the\s+)?(?:optimal\s+)?(?:c\+\+|cpp|python|java|c|javascript)\s+code/i.test(
      lower,
    ) ||
    /(?:solution|code)\s+in\s+(?:c\+\+|cpp|python|java|c|javascript)/i.test(
      lower,
    );

  if (
    hasPlatformMention ||
    (hasCodingPhrase && (hasConstraintPattern || hasExplicitCodeRequest)) ||
    (hasExplicitCodeRequest && hasConstraintPattern)
  ) {
    const lang = detectProgrammingLanguage(lower) ?? "cpp";
    return {
      intent: "coding_problem",
      intentClass: "QUESTION",
      confidence: 0.95,
      reason: hasPlatformMention
        ? "Explicit competitive programming platform referenced"
        : "Coding problem statement patterns and constraints detected",
      recommendedReasoningEffort: "high",
      detectedLanguage: lang,
    };
  }

  // 3. Follow-up question referencing active context or selections
  const hasSelectionContext = Boolean(
    (context?.selectedElementsContext &&
      context.selectedElementsContext.length > 0) ||
      (context?.selectedElementIds && context.selectedElementIds.length > 0),
  );
  const hasActiveLesson = Boolean(
    context?.activeLessonState &&
      typeof context.activeLessonState.currentStepIndex === "number",
  );
  const hasConversation = Boolean(
    context?.conversationHistory && context.conversationHistory.length > 0,
  );

  const hasFollowUpPhrases = FOLLOW_UP_PHRASES.some((phrase) =>
    lower.includes(phrase),
  );
  const hasDeicticWords = /\b(this|that|these|those|it|here)\b/i.test(lower);

  if (
    (hasSelectionContext || hasActiveLesson || hasConversation) &&
    (hasFollowUpPhrases || (hasDeicticWords && lower.split(/\s+/).length <= 8))
  ) {
    return {
      intent: "follow_up",
      intentClass: "QUESTION",
      confidence: 0.88,
      reason:
        "Follow-up query referencing active canvas selection or lesson step",
      recommendedReasoningEffort: "low",
    };
  }

  // 4. General / Factual Question (No visual lesson needed)
  const isGeneralQuestion = GENERAL_QUESTION_PATTERNS.some((regex) =>
    regex.test(lower),
  );
  const hasExplicitVisualRequest = VISUAL_KEYWORDS.some((kw) =>
    lower.includes(kw),
  );

  if (isGeneralQuestion && !hasExplicitVisualRequest) {
    return {
      intent: "general_question",
      intentClass: "QUESTION",
      confidence: 0.82,
      reason:
        "Factual/definitional query without explicit visualization request",
      recommendedReasoningEffort: "low",
    };
  }

  // 5. Visual Teaching (Default for Cognora)
  return {
    intent: "visual_teaching",
    intentClass: "TEACHING_REQUEST",
    confidence: 0.9,
    reason: "Standard conceptual visual lesson request",
    recommendedReasoningEffort: "low",
  };
}

/**
 * Convenient facade for classifying intent into Cognora's canonical intent classes.
 */
export function classifyCognoraIntent(
  prompt: string,
  context?: Partial<TeachingRequestContext>,
): {
  intentClass: CognoraIntentClass;
  resolvedCommand?: string;
  confidence: number;
  reason: string;
} {
  const result = detectUserIntent(prompt, context);
  return {
    intentClass: result.intentClass || "TEACHING_REQUEST",
    resolvedCommand: result.resolvedCommand,
    confidence: result.confidence,
    reason: result.reason,
  };
}
