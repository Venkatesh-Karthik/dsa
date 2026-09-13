/**
 * Cognora Multi-Dimensional Intent Intelligence
 *
 * Classifies learner intent along multiple pedagogical and semantic dimensions:
 * - Goal (e.g. understand mechanism, compare, debug confusion, explore what-if, verify mastery)
 * - Depth (overview, standard, deep, exhaustive)
 * - Scope (full concept, sub-component, single transition, entity, relationship, invariant)
 * - Mode (visual walkthrough, interactive practice, comparative analysis, causal drilldown, what-if)
 * - Pedagogical Dimensions (intuition, implementation, mathematical, causal, practice, what-if)
 *
 * Universal and domain-agnostic: operates on semantic intent cues rather than topic registries.
 */

import type { TeachingRequestContext } from "./teaching-contract";

export type IntentGoal =
  | "understand_mechanism"
  | "compare_alternatives"
  | "debug_confusion"
  | "explore_what_if"
  | "verify_mastery"
  | "intuition_building"
  | "implementation_guide"
  | "trace_flow"
  | "general_explanation";

export type IntentDepth = "overview" | "standard" | "deep" | "exhaustive";

export type IntentScope =
  | "full_concept"
  | "sub_component"
  | "transition"
  | "entity"
  | "relationship"
  | "invariant";

export type IntentMode =
  | "visual_walkthrough"
  | "interactive_practice"
  | "comparative_analysis"
  | "causal_drilldown"
  | "what_if_mutation";

export interface IntentDimensions {
  intuition: boolean;
  implementation: boolean;
  mathematical: boolean;
  causal: boolean;
  practice: boolean;
  whatIf: boolean;
  comparison: boolean;
  debugging: boolean;
}

export interface DetailedIntent {
  goal: IntentGoal;
  depth: IntentDepth;
  scope: IntentScope;
  mode: IntentMode;
  dimensions: IntentDimensions;
  targetConcept: string;
  targetSubConcept?: string;
  targetElementId?: string;
  confidence: number;
  reason: string;
}

/**
 * Analyzes raw prompt and context to extract a multi-dimensional semantic intent.
 */
export function classifyDetailedIntent(
  prompt: string,
  context?: TeachingRequestContext,
): DetailedIntent {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  // Dimensions
  const isComparison =
    /\b(compare|vs\.?|versus|difference between|trade-?offs?|contrast)\b/i.test(lower);
  const isWhatIf =
    /\b(what if|what happens if|suppose we change|if we change|modify|mutate|swap)\b/i.test(lower);
  const isCausal =
    /\b(why|how come|cause of|reason for|why does|what makes)\b/i.test(lower);
  const isIntuition =
    /\b(intuition|intuitive|mental model|in simple terms|eli5|high level|big picture)\b/i.test(lower);
  const isImplementation =
    /\b(code|implementation|implement|syntax|program|write (a|the) (code|function))\b/i.test(lower);
  const isMath =
    /\b(math|mathematical|formula|equation|proof|derive|derivation|complexity|o\(|theta\()\b/i.test(lower);
  const isPractice =
    /\b(practice|quiz|test me|exercise|question|challenge|verify my)\b/i.test(lower);
  const isDebugging =
    /\b(bug|fix|wrong|incorrect|doesn't work|failing|error|confusion|stuck)\b/i.test(lower);

  // Depth
  let depth: IntentDepth = "standard";
  if (/\b(briefly|quick|overview|summary|tldr|nutshell)\b/i.test(lower)) {
    depth = "overview";
  } else if (/\b(deep|in-?depth|thorough|detailed|rigorous|comprehensive|step by step)\b/i.test(lower)) {
    depth = "deep";
  } else if (/\b(exhaustive|every detail|all cases|under the hood|internals)\b/i.test(lower)) {
    depth = "exhaustive";
  }

  // Goal & Mode
  let goal: IntentGoal = "understand_mechanism";
  let mode: IntentMode = "visual_walkthrough";

  if (isPractice) {
    goal = "verify_mastery";
    mode = "interactive_practice";
  } else if (isComparison) {
    goal = "compare_alternatives";
    mode = "comparative_analysis";
  } else if (isWhatIf) {
    goal = "explore_what_if";
    mode = "what_if_mutation";
  } else if (isCausal) {
    goal = "understand_mechanism";
    mode = "causal_drilldown";
  } else if (isDebugging) {
    goal = "debug_confusion";
    mode = "visual_walkthrough";
  } else if (isIntuition) {
    goal = "intuition_building";
    mode = "visual_walkthrough";
  } else if (isImplementation) {
    goal = "implementation_guide";
    mode = "visual_walkthrough";
  }

  // Scope
  let scope: IntentScope = "full_concept";
  let targetElementId: string | undefined = undefined;

  if (Array.isArray(context?.selectedElements) && context.selectedElements.length > 0) {
    const firstSelected = context.selectedElements[0];
    targetElementId = firstSelected.dslId;
    if (firstSelected.role === "relationship" || firstSelected.type === "arrow") {
      scope = "relationship";
    } else {
      scope = "entity";
    }
  } else if (/\b(this step|current step|this transition)\b/i.test(lower)) {
    scope = "transition";
  } else if (/\b(invariant|rule|constraint)\b/i.test(lower)) {
    scope = "invariant";
  }

  // Extract clean target concept title
  let targetConcept = text
    .replace(/^(explain(\s+how(\s+an?)?)?|teach\s+me(\s+how(\s+an?)?)?|how\s+does|what\s+is|visualize|show\s+me|walk\s+me\s+through|compare|why\s+does)\s+/i, "")
    .replace(/\s+(step by step|visually|in depth|works?|algorithm|concept|in simple terms)\b/gi, "")
    .trim();

  if (!targetConcept) {
    targetConcept = text;
  }
  targetConcept = targetConcept.charAt(0).toUpperCase() + targetConcept.slice(1);

  return {
    goal,
    depth,
    scope,
    mode,
    dimensions: {
      intuition: isIntuition,
      implementation: isImplementation,
      mathematical: isMath,
      causal: isCausal,
      practice: isPractice,
      whatIf: isWhatIf,
      comparison: isComparison,
      debugging: isDebugging,
    },
    targetConcept,
    targetElementId,
    confidence: 0.9,
    reason: `Multi-dimensional analysis inferred goal=${goal}, depth=${depth}, mode=${mode}.`,
  };
}
