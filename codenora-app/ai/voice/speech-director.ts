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
import {
  type SpeechSegment,
  VoicePriority,
  type VoiceExplanationContext,
} from "./voice-contract";

export class SpeechDirector {
  /**
   * Directs and synthesizes a polished spoken narration script from a TeachingMoment.
   * Ensures natural WHAT + WHY + RESULT pedagogical structure.
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
    const whatChanged = (moment as any).whatChanged
      ? ExplanationEngine.scrubMetadata((moment as any).whatChanged)
      : "";
    const explanation = ExplanationEngine.scrubMetadata(
      moment.explanation || "",
    );
    const why = (moment as any).whyItChanged
      ? ExplanationEngine.scrubMetadata((moment as any).whyItChanged)
      : moment.why
      ? ExplanationEngine.scrubMetadata(moment.why)
      : "";
    const consequence = moment.consequence
      ? ExplanationEngine.scrubMetadata(moment.consequence)
      : "";

    // What happened (Action / What Changed)
    if (whatChanged) {
      parts.push(whatChanged);
    } else if (explanation) {
      parts.push(explanation);
    } else if (title) {
      parts.push(title);
    }

    // Why did it happen (Causal rationale)
    if (
      why &&
      !explanation.toLowerCase().includes(why.toLowerCase().slice(0, 20)) &&
      (!whatChanged || !whatChanged.toLowerCase().includes(why.toLowerCase().slice(0, 20)))
    ) {
      const cleanedWhy = why.replace(/^(because|since|due to)\s+/i, "");
      parts.push(`This is because ${cleanedWhy}.`);
    }

    // Consequence / What changed as a result
    if (
      consequence &&
      !explanation
        .toLowerCase()
        .includes(consequence.toLowerCase().slice(0, 20))
    ) {
      const cleanedConsequence = consequence.replace(
        /^(so|as a result|consequently|therefore)\s+/i,
        "",
      );
      parts.push(`As a result, ${cleanedConsequence}.`);
    }

    const combined = parts.join(" ");
    return this.polishSpokenText(
      combined || title || "We observe the current visual state.",
    );
  }

  /**
   * Directs a structured SpeechSegment from a TeachingMoment and lesson metadata.
   */
  public static directSpeechSegment(
    moment: TeachingMoment,
    context: {
      lessonId: string;
      generationId: string;
      worldVersion?: number;
      branchId?: string;
      priority?: VoicePriority;
    },
  ): SpeechSegment {
    const narration = this.directNarration(moment);
    // Estimate ~140 words per minute -> ~2.33 words per second (approx 60 / 140 = ~0.43 sec/word)
    const wordCount = narration.split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.max(1.5, Math.round((wordCount / 2.33) * 10) / 10);

    return {
      lessonId: context.lessonId,
      generationId: context.generationId,
      transformationId: moment.transformationId || moment.stepId || `step-${moment.stepIndex ?? 0}`,
      worldVersion: context.worldVersion ?? (moment as any).worldVersion ?? 1,
      branchId: context.branchId ?? (moment as any).branchId ?? "MAIN",
      narration,
      semanticFocus:
        typeof moment.semanticFocus === "string"
          ? moment.semanticFocus
          : moment.semanticFocus?.label || moment.semanticFocus?.operationId || moment.title,
      priority: context.priority ?? VoicePriority.CURRENT_STEP,
      estimatedDuration,
      status: "PENDING",
    };
  }

  /**
   * Dynamically splits a long narration at semantic sentence boundaries
   * instead of arbitrary character cuts.
   */
  public static splitIntoSemanticSegments(narration: string, maxSegmentWords = 35): string[] {
    const cleaned = this.polishSpokenText(narration);
    if (!cleaned) return [];

    // Split at sentence terminators (. ! ?)
    const rawSentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleaned];
    const sentences = rawSentences.map((s) => s.trim()).filter(Boolean);

    if (sentences.length <= 1) {
      return sentences;
    }

    const segments: string[] = [];
    let currentChunk: string[] = [];
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;

      if (currentWordCount + sentenceWords > maxSegmentWords && currentChunk.length > 0) {
        segments.push(currentChunk.join(" "));
        currentChunk = [sentence];
        currentWordCount = sentenceWords;
      } else {
        currentChunk.push(sentence);
        currentWordCount += sentenceWords;
      }
    }

    if (currentChunk.length > 0) {
      segments.push(currentChunk.join(" "));
    }

    return segments;
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
