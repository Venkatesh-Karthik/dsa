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

export type ProgrammingLanguage =
  | "cpp"
  | "java"
  | "python"
  | "c"
  | "javascript";

export interface IntentClassification {
  intent: UserIntent;
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
      confidence: 1.0,
      reason: "Prompt starts with slash command operator '/'",
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
      confidence: 0.82,
      reason:
        "Factual/definitional query without explicit visualization request",
      recommendedReasoningEffort: "low",
    };
  }

  // 5. Visual Teaching (Default for Cognora)
  return {
    intent: "visual_teaching",
    confidence: 0.9,
    reason: "Standard conceptual visual lesson request",
    recommendedReasoningEffort: "low",
  };
}
