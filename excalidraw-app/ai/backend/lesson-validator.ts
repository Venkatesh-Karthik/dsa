/**
 * Generic Lesson Quality Validator & Complexity Estimator
 *
 * Evaluates whether a prompt requires multi-step progressive teaching,
 * and validates that the generated lesson provides genuine progressive visual states.
 *
 * ZERO TOPIC HARDCODING:
 * Uses generic linguistic analysis, structural complexity metrics,
 * and visual state delta comparisons.
 */

import type { TeachingResponse, TeachingStep } from "../teaching-contract";

export interface PromptComplexity {
  /** 1 (trivial factual lookup) to 5 (complex multi-case / multi-stage process) */
  complexity: number;
  /** Whether the user explicitly requested step-by-step or progressive breakdown */
  isStepByStepRequested: boolean;
  /** Whether the user requested conceptual teaching / explanation */
  isConceptual: boolean;
  /** Suggested target step range */
  targetStepRange: { min: number; target: number; max: number };
  /** Minimum acceptable steps before considering the lesson under-expanded */
  minExpectedSteps: number;
  /** Linguistic reason for complexity assessment */
  reason: string;
}

export interface LessonQualityResult {
  /** Whether the lesson meets minimum quality thresholds */
  valid: boolean;
  /** Whether the lesson is under-expanded and should trigger generic expansion repair */
  needsExpansion: boolean;
  /** Quality issues or warnings detected */
  issues: string[];
  /** Actual number of steps in the response */
  stepCount: number;
  /** Recommended minimum steps */
  targetMinSteps: number;
  /** Whether steps show meaningful visual progression (not identical duplicates) */
  hasVisualDelta: boolean;
}

/**
 * Estimates prompt complexity generically based on linguistic indicators,
 * question structure, and requested pedagogical depth.
 *
 * NO topic-specific strings (NO "binary tree", NO "sliding window", NO "AVL").
 */
export function estimatePromptComplexity(prompt: string): PromptComplexity {
  const normalized = prompt.trim().toLowerCase();

  // Explicit step-by-step / progressive intent indicators
  const stepByStepPatterns = [
    /\bstep[\s-]by[\s-]step\b/,
    /\bin\s+steps\b/,
    /\bprogressiv(e|ely)\b/,
    /\bwalk(\s+me)?\s+through\b/,
    /\btrace\b/,
    /\bstages?\b/,
    /\bbreak\s+down\b/,
    /\bone\s+by\s+one\b/,
    /\bphases?\b/,
  ];

  const isStepByStepRequested = stepByStepPatterns.some((pattern) =>
    pattern.test(normalized),
  );

  // Conceptual / educational intent indicators
  const conceptualPatterns = [
    /\bexplain\b/,
    /\bteach\b/,
    /\bhow\s+does\b/,
    /\bhow\s+do\b/,
    /\bwhy\s+does\b/,
    /\bwhat\s+is\b/,
    /\bwhat\s+are\b/,
    /\bunderstand\b/,
    /\bvisualiz(e|ation)\b/,
    /\bdemonstrat(e|ion)\b/,
    /\billustrat(e|ion)\b/,
    /\bconcept\b/,
    /\bintuition\b/,
    /\bworking\s+of\b/,
    /\bworkflow\b/,
    /\barchitecture\b/,
    /\bcompare\b/,
    /\bdiffer(ence|ent)\b/,
    /\boverview\b/,
  ];

  const isConceptual = conceptualPatterns.some((pattern) =>
    pattern.test(normalized),
  );

  // Multi-part / multi-case / exhaustive coverage cues
  const multiPartPatterns = [
    /\ball\s+(\d+|cases|types|rotations|operations|scenarios)\b/,
    /\bcompare\b.*\band\b/,
    /\bdifference\s+between\b/,
    /\bpros\s+and\s+cons\b/,
    /\btrade[\s-]offs?\b/,
    /\bfrom\s+scratch\b/,
    /\bcomplete(ly)?\b/,
    /\bdeep\s+dive\b/,
    /\bcomprehensive\b/,
  ];

  const isMultiPart = multiPartPatterns.some((pattern) =>
    pattern.test(normalized),
  );

  // Trivial / one-shot factual lookup cues
  const trivialPatterns = [
    /^(what\s+is\s+the\s+)?(time|space)\s+complexity\s+of\s+[^?]+(\?)?$/,
    /^is\s+\d+\s+(in|greater|less)\b/,
    /^what\s+does\s+\w+\s+return\b/,
    /^give\s+me\s+a\s+(single\s+)?number\b/,
    /^true\s+or\s+false\b/,
  ];

  const isTrivial = trivialPatterns.some((pattern) => pattern.test(normalized));

  let complexity = 3;
  let reason = "Standard conceptual request";

  if (isTrivial && !isStepByStepRequested) {
    complexity = 1;
    reason = "Trivial factual property query";
  } else if (isMultiPart || (isStepByStepRequested && isConceptual && normalized.length > 50)) {
    complexity = 5;
    reason = "Exhaustive multi-part or detailed process query";
  } else if (isStepByStepRequested || (isConceptual && normalized.includes(" and "))) {
    complexity = 4;
    reason = "Step-by-step or compound conceptual request";
  } else if (isConceptual) {
    complexity = 3;
    reason = "Conceptual teaching request";
  } else if (normalized.split(/\s+/).length <= 3 && !normalized.includes("?")) {
    complexity = 2;
    reason = "Brief subject inquiry";
  }

  // Map complexity to step ranges:
  // Map complexity to step ranges:
  // Default for normal conceptual/step-by-step
  const targetStepRanges: Record<
    number,
    { min: number; target: number; max: number; minExpected: number }
  > = {
    1: { min: 1, target: 1, max: 2, minExpected: 1 },
    2: { min: 2, target: 2, max: 3, minExpected: 1 },
    3: { min: 2, target: 3, max: 5, minExpected: 2 },
    4: { min: 2, target: 4, max: 6, minExpected: 2 },
    5: { min: 2, target: 5, max: 10, minExpected: 2 },
  };

  const range = targetStepRanges[complexity] ?? targetStepRanges[3];

  return {
    complexity,
    isStepByStepRequested,
    isConceptual,
    targetStepRange: { min: range.min, target: range.target, max: range.max },
    minExpectedSteps: range.minExpected,
    reason,
  };
}

/**
 * Validates lesson quality, step count adequacy, and visual progression.
 * Generically detects when an LLM compressed a multi-step concept into a single step.
 */
export function validateLessonQuality(
  response: TeachingResponse,
  prompt: string,
): LessonQualityResult {
  const issues: string[] = [];
  const steps: TeachingStep[] = Array.isArray(response.steps)
    ? response.steps
    : Array.isArray(response.lesson?.steps)
    ? response.lesson.steps
    : [];

  const stepCount = steps.length;
  const promptComplexity = estimatePromptComplexity(prompt);
  const targetMinSteps = promptComplexity.targetStepRange.min;

  // Visual delta checking: ensure steps don't just repeat identical diagrams
  let hasVisualDelta = true;
  if (stepCount > 1) {
    const actionSignatures = steps.map((s) =>
      JSON.stringify(s.visual_actions || []),
    );
    const uniqueSignatures = new Set(actionSignatures);

    // If 3+ steps exist but all action sets are identical, flag lack of visual delta
    if (actionSignatures.length >= 3 && uniqueSignatures.size === 1) {
      hasVisualDelta = false;
      issues.push(
        "All lesson steps contain identical visual diagrams with no visual progression.",
      );
    }
  }

  // Check step metadata quality
  steps.forEach((step, idx) => {
    if (!step.title || step.title.trim().length === 0) {
      issues.push(`Step ${idx + 1} has an empty title.`);
    }
    if (!step.explanation || step.explanation.trim().length === 0) {
      issues.push(`Step ${idx + 1} has an empty explanation.`);
    }
    if (!step.visual_actions || step.visual_actions.length === 0) {
      issues.push(`Step ${idx + 1} contains no visual actions.`);
    }
  });

  // Determine whether generic expansion repair is needed:
  // Trigger when a conceptual prompt produces only 1 step (compressed lesson),
  // or when step-by-step is explicitly requested but fewer than 2 steps are returned.
  let needsExpansion = false;
  if (
    stepCount === 1 &&
    (promptComplexity.complexity >= 3 || promptComplexity.isStepByStepRequested)
  ) {
    needsExpansion = true;
    issues.push(
      `Teaching prompt requires progressive multi-step explanation (${promptComplexity.reason}), but only 1 step was generated. Target is multiple steps.`,
    );
  } else if (stepCount === 0 && promptComplexity.isStepByStepRequested) {
    needsExpansion = true;
    issues.push(
      `Step-by-step lesson was requested, but 0 steps were generated. Target is multiple steps.`,
    );
  }

  const valid = issues.length === 0 && !needsExpansion;

  return {
    valid,
    needsExpansion,
    issues,
    stepCount,
    targetMinSteps,
    hasVisualDelta,
  };
}
