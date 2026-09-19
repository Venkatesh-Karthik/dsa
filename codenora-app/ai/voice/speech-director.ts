/**
 * Cognora Speech Director
 *
 * Converts structured TeachingMoment states and pedagogical transitions
 * into natural, conversational, and causal educational narration.
 *
 * Directs:
 * - WHAT happened?
 * - WHY did it happen?
 * - WHAT changed visually?
 * - WHAT should the learner notice?
 */

import { ExplanationEngine } from "../explanation-engine";

import type { TeachingMoment } from "../teaching-moment";
import type { VoiceExplanationContext } from "./voice-contract";

export class SpeechDirector {
  /**
   * Directs and synthesizes a polished spoken narration script from a TeachingMoment.
   */
  public static directNarration(
    moment: TeachingMoment,
    context?: { topic?: string; totalMoments?: number; momentIndex?: number },
  ): string {
    // 1. If explicit crafted narration is already present and complete, scrub and polish it
    if (moment.narration && moment.narration.trim().length > 10) {
      return this.polishSpokenText(moment.narration);
    }

    // 2. Synthesize pedagogical narration from structured causal fields
    const parts: string[] = [];

    const title = ExplanationEngine.scrubMetadata(moment.title || "");
    const explanation = ExplanationEngine.scrubMetadata(
      moment.explanation || "",
    );
    const why = moment.why ? ExplanationEngine.scrubMetadata(moment.why) : "";
    const consequence = moment.consequence
      ? ExplanationEngine.scrubMetadata(moment.consequence)
      : "";

    // What happened (Action)
    if (explanation) {
      parts.push(explanation);
    } else if (title) {
      parts.push(title);
    }

    // Why did it happen (Causal rationale)
    if (
      why &&
      !explanation.toLowerCase().includes(why.toLowerCase().slice(0, 20))
    ) {
      parts.push(`This is because ${why.replace(/^(because|since)\s+/i, "")}.`);
    }

    // Consequence / What changed
    if (
      consequence &&
      !explanation
        .toLowerCase()
        .includes(consequence.toLowerCase().slice(0, 20))
    ) {
      parts.push(
        `As a result, ${consequence.replace(/^(so|as a result)\s+/i, "")}.`,
      );
    }

    const combined = parts.join(" ");
    return this.polishSpokenText(
      combined || title || "We observe the current visual state.",
    );
  }

  /**
   * Converts a generic VoiceExplanationContext into natural spoken prose.
   */
  public static directContext(context: VoiceExplanationContext): string {
    if (context.answerText) {
      return this.polishSpokenText(context.answerText);
    }

    const parts: string[] = [];
    if (context.title && context.stepIndex === 0) {
      parts.push(
        `Let's explore ${ExplanationEngine.scrubMetadata(
          context.topic || context.title,
        )}.`,
      );
    }

    if (context.explanation) {
      parts.push(ExplanationEngine.scrubMetadata(context.explanation));
    } else if (context.title) {
      parts.push(ExplanationEngine.scrubMetadata(context.title));
    }

    if (context.calculations) {
      parts.push(ExplanationEngine.scrubMetadata(context.calculations));
    }

    if (context.insight) {
      parts.push(
        `Key takeaway: ${ExplanationEngine.scrubMetadata(context.insight)}`,
      );
    }

    return this.polishSpokenText(parts.join(" "));
  }

  /**
   * Polishes text specifically for neural text-to-speech cadence:
   * - Expands technical math/code symbols (-> becomes "points to", == becomes "equals")
   * - Strips debug tokens, hashes, and internal identifiers
   * - Ensures complete sentence punctuation for natural prosody
   */
  public static polishSpokenText(text: string): string {
    let s = ExplanationEngine.scrubMetadata(text);

    // Expand common technical symbols for natural audio pronunciation
    s = s.replace(/->/g, " points to ");
    s = s.replace(/=>/g, " leads to ");
    s = s.replace(/===?/g, " equals ");
    s = s.replace(/!=/g, " does not equal ");
    s = s.replace(/<=/g, " is less than or equal to ");
    s = s.replace(/>=/g, " is greater than or equal to ");
    s = s.replace(/<([^>]+)>/g, " $1 ");

    // Remove markdown code fences and backticks
    s = s.replace(/`([^`]+)`/g, "$1");
    s = s.replace(/```[\s\S]*?```/g, "");

    // Clean whitespace
    s = s.replace(/\s+/g, " ").trim();

    // Ensure ending punctuation for audio cadence
    if (s.length > 0 && !/[.!?]$/.test(s)) {
      s += ".";
    }

    return s;
  }
}
