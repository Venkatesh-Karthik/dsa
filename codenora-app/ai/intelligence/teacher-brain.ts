/**
 * Cognora Teacher Brain & Pedagogical Conductor
 *
 * Above raw LLM output, responsible for:
 * 1. Understanding learner intent & context
 * 2. Choosing pedagogical strategy (EXPLAIN, WHY, SIMPLIFY, WHAT_IF, CORRECT, etc.)
 * 3. Detecting misconceptions and formulating respectful corrections
 * 4. Executing deterministic local operations (<5ms) without calling the LLM
 * 5. Guiding Nemotron 3 Ultra with compact structured context when reasoning is required
 */

import type { CognoraWorldState, WhatIfBranch } from "./cognora-world-model";
import type { InputIntent } from "./input-intent";
import { ContextEngine, type ResolvedContext } from "./context-engine";
import { BranchManager } from "./branch-manager";

export type TeachingStrategy =
  | "EXPLAIN"
  | "WHY"
  | "SIMPLIFY"
  | "ELABORATE"
  | "COMPARE"
  | "TRACE"
  | "DEMONSTRATE"
  | "WHAT_IF"
  | "CORRECT"
  | "REPEAT"
  | "REPLAY"
  | "SLOW_DOWN"
  | "SPEED_UP"
  | "FOCUS"
  | "INSPECT"
  | "SUMMARIZE"
  | "PREDICT"
  | "VERIFY";

export interface TeacherDecision {
  strategy: TeachingStrategy;
  isLocal: boolean; // Can be satisfied immediately without calling Nemotron
  explanation: string;
  narration: string;
  focusEntityId?: string;
  focusEntityLabel?: string;
  branchToCreate?: WhatIfBranch | null;
  shouldExitBranch?: boolean;
  paceChange?: "slower" | "faster" | "normal";
  playbackAction?: "next" | "previous" | "pause" | "resume" | "replay";
  confidence: number;
  requiresLLM: boolean;
  llmPrompt?: string;
}

export class TeacherBrain {
  /**
   * Decides the pedagogical action and strategy for the current learner input
   */
  public static decide(
    intent: InputIntent,
    worldState: Readonly<CognoraWorldState>,
  ): TeacherDecision {
    const context = ContextEngine.resolveContext(intent, worldState);
    const currentMoment = worldState.currentMoment;
    const student = worldState.studentState;

    console.log(
      `[COGNORA][TEACHER] evaluating intent=${intent.intentType} concept="${
        context.concept
      }" step=${context.stepIndex + 1}/${context.totalSteps}`,
    );

    // 1. Interruption / Pause ("Wait", "Stop", "Hold on")
    if (intent.intentType === "INTERRUPT") {
      return {
        strategy: "PAUSE" as any,
        isLocal: true,
        requiresLLM: false,
        explanation: "Paused. Listening to you...",
        narration: "",
        playbackAction: "pause",
        confidence: 1.0,
      };
    }

    // 2. What-If Branch Exit ("Go back", "Return to lesson")
    if (intent.intentType === "BRANCH_EXIT") {
      return {
        strategy: "REPLAY",
        isLocal: true,
        requiresLLM: false,
        explanation: "Returning to main lesson timeline.",
        narration: "Returning to where we were in the lesson.",
        shouldExitBranch: true,
        confidence: 1.0,
      };
    }

    // 3. Playback Navigation Controls ("Next", "Back", "Replay")
    if (intent.intentType === "PLAYBACK_CONTROL") {
      const action = intent.parameters.action as
        | "next"
        | "previous"
        | "replay"
        | "pause"
        | "resume";
      return {
        strategy: action === "replay" ? "REPLAY" : "TRACE",
        isLocal: true,
        requiresLLM: false,
        explanation: `Advancing playback: ${action}`,
        narration: "",
        playbackAction: action,
        confidence: 1.0,
      };
    }

    // 4. Pacing Controls ("Slower", "Faster")
    if (intent.intentType === "PACE_CONTROL") {
      const pace = intent.parameters.pace as "slower" | "faster";
      return {
        strategy: pace === "slower" ? "SLOW_DOWN" : "SPEED_UP",
        isLocal: true,
        requiresLLM: false,
        explanation:
          pace === "slower" ? "Slowing down pacing." : "Speeding up pacing.",
        narration:
          pace === "slower"
            ? "I'll explain more slowly."
            : "Picking up the pace.",
        paceChange: pace,
        confidence: 1.0,
      };
    }

    // 5. Focus Inquiries ("Show me the node", "Focus on 30", "Look at B")
    if (intent.intentType === "QUESTION_FOCUS") {
      const target = intent.target || context.targetEntityId;
      const label = context.targetEntityLabel || target;
      return {
        strategy: "FOCUS",
        isLocal: true,
        requiresLLM: false,
        explanation: `Focusing on ${label || "target entity"}.`,
        narration: `Here is ${
          label || "the element"
        } on the canvas. Notice its connections and state.`,
        focusEntityId: target,
        focusEntityLabel: label,
        confidence: 0.95,
      };
    }

    // 6. Misconception Detection
    // Check if the learner made an assertion that contradicts known state
    const misconception = this.detectMisconception(
      intent.rawInput,
      context,
      currentMoment,
    );
    if (misconception) {
      return {
        strategy: "CORRECT",
        isLocal: true,
        requiresLLM: false,
        explanation: misconception.explanation,
        narration: misconception.narration,
        focusEntityId: misconception.focusEntityId,
        focusEntityLabel: misconception.focusEntityLabel,
        confidence: 0.95,
      };
    }

    // 7. Counterfactual "What If" Branching ("What if target was 70?")
    if (intent.intentType === "QUESTION_WHAT_IF") {
      const branch = BranchManager.createBranch(
        intent.parameters.fullHypothesis || intent.rawInput,
        worldState,
      );
      if (branch && branch.branchMoments.length > 0) {
        const moment = branch.branchMoments[0];
        return {
          strategy: "WHAT_IF",
          isLocal: true,
          requiresLLM: false,
          explanation: moment.explanation,
          narration: moment.narration,
          branchToCreate: branch,
          focusEntityId: moment.semanticFocus?.entityIds?.[0],
          focusEntityLabel: moment.semanticFocus?.label,
          confidence: 0.95,
        };
      }
    }

    // 8. Adaptive Explanation ("I don't understand", "Simplify")
    if (intent.intentType === "QUESTION_SIMPLIFY") {
      const simplified = this.formulateSimplifiedExplanation(
        context,
        currentMoment,
      );
      return {
        strategy: "SIMPLIFY",
        isLocal: true,
        requiresLLM: false,
        explanation: simplified.explanation,
        narration: simplified.narration,
        focusEntityId: context.targetEntityId,
        focusEntityLabel: context.targetEntityLabel,
        confidence: 0.95,
      };
    }

    // 9. Causal "Why" Questions ("Why did it rotate?", "Why eliminate left side?")
    if (intent.intentType === "QUESTION_WHY") {
      const whyExplanation = this.formulateWhyExplanation(
        context,
        currentMoment,
        intent.rawInput,
      );
      return {
        strategy: "WHY",
        isLocal: true,
        requiresLLM: false,
        explanation: whyExplanation.explanation,
        narration: whyExplanation.narration,
        focusEntityId: context.targetEntityId,
        focusEntityLabel: context.targetEntityLabel,
        confidence: 0.95,
      };
    }

    // 10. For complex or new conceptual questions, route to Nemotron 3 Ultra with compact structured context
    const compactContext = ContextEngine.formatCompactPromptContext(context);
    const llmPrompt = `${compactContext}\n\nLearner Question: ${intent.rawInput}\n\nProvide a concise, direct pedagogical explanation (2-3 sentences max) answering this question about the current step.`;

    return {
      strategy: "EXPLAIN",
      isLocal: false,
      requiresLLM: true,
      explanation: "Analyzing question in context...",
      narration: "",
      confidence: 0.85,
      llmPrompt,
    };
  }

  /**
   * Evaluates learner text for misconceptions against verified step properties
   */
  private static detectMisconception(
    rawText: string,
    context: ResolvedContext,
    currentMoment: any,
  ): {
    explanation: string;
    narration: string;
    focusEntityId?: string;
    focusEntityLabel?: string;
  } | null {
    const lower = rawText.toLowerCase();

    // Check numerical inverted comparisons: "X is greater than Y" when X < Y
    const compMatch = lower.match(/(\d+)\s+is\s+greater\s+than\s+(\d+)/i);
    if (compMatch) {
      const num1 = parseInt(compMatch[1], 10);
      const num2 = parseInt(compMatch[2], 10);
      if (num1 < num2) {
        return {
          explanation: `Clarification: ${num1} is actually less than ${num2}, not greater.`,
          narration: `Notice that ${num1} is actually less than ${num2}. Because ${num1} is smaller, the logic moves in the opposite direction.`,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
        };
      }
    }

    const compMatch2 = lower.match(/(\d+)\s+is\s+less\s+than\s+(\d+)/i);
    if (compMatch2) {
      const num1 = parseInt(compMatch2[1], 10);
      const num2 = parseInt(compMatch2[2], 10);
      if (num1 > num2) {
        return {
          explanation: `Clarification: ${num1} is actually greater than ${num2}, not less.`,
          narration: `Notice that ${num1} is actually greater than ${num2}. Because ${num1} is larger, we look to the other half.`,
          focusEntityId: context.targetEntityId,
          focusEntityLabel: context.targetEntityLabel,
        };
      }
    }

    return null;
  }

  /**
   * Generates a concrete simplified explanation for "I don't understand"
   */
  private static formulateSimplifiedExplanation(
    context: ResolvedContext,
    currentMoment: any,
  ): { explanation: string; narration: string } {
    if (!currentMoment) {
      return {
        explanation: "Think of this step like narrowing down clues in a game.",
        narration:
          "Let's simplify this. Think of it like a guessing game where every step cuts our search space in half.",
      };
    }

    const why = currentMoment.why || "";
    const explanation = currentMoment.explanation || "";

    return {
      explanation: `Simplified: ${explanation}. In simple terms: ${
        why || "we take this step to maintain order and structure."
      }`,
      narration: `Let's break this down simply. We compare what we have with our target. Since it doesn't match, we can safely ignore the part that will never contain the answer.`,
    };
  }

  /**
   * Formulates a direct causal explanation for "Why"
   */
  private static formulateWhyExplanation(
    context: ResolvedContext,
    currentMoment: any,
    userQuery: string,
  ): { explanation: string; narration: string } {
    if (!currentMoment) {
      return {
        explanation: "This action establishes the baseline state.",
        narration: "We start here to establish our baseline structure.",
      };
    }

    const why = currentMoment.why;
    const consequence = currentMoment.consequence;

    if (why && consequence) {
      return {
        explanation: `Why: ${why}. Consequence: ${consequence}`,
        narration: `${why}. Because of this, ${consequence}`,
      };
    }

    if (why) {
      return {
        explanation: `Why: ${why}`,
        narration: `${why}`,
      };
    }

    return {
      explanation: `Reason: ${currentMoment.explanation}`,
      narration: `${currentMoment.explanation}`,
    };
  }
}
