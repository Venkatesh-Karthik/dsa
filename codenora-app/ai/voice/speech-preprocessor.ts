/**
 * Speech Preprocessor for Cognora
 *
 * Converts internal algorithm explanations, mathematical notations, and
 * visual state descriptions into natural, calm, and educational tutor speech.
 *
 * Strictly eliminates:
 * - Internal DSL identifiers (arr1, sll, ptr-left, t-1, op-0, node-25, etc.)
 * - Raw JSON or code snippets
 * - Reasoning content and system diagnostics
 * - Markdown formatting artifacts
 */

import type {
  VoiceExplanationContext,
  SpeechPreparationResult,
} from "./voice-contract";

export class SpeechPreprocessor {
  private static readonly INTERNAL_ID_PATTERNS = [
    /\b(?:sll|arr\d*|tree\d*|graph\d*|heap\d*|queue\d*|stack\d*)[_-][a-zA-Z0-9_-]+\b/gi,
    /\b(?:ptr[_-](?:left|right|mid|curr|prev|next|head|tail))\b/gi,
    /\b(?:rel|arrow|edge|node|container|dsl|item)[_-][a-zA-Z0-9_-]+\b/gi,
    /\bt\d+-(?:op\d+|step\d+|action\d+)\b/gi,
    /\b(?:generationId|requestId|dslId|containerId)=[a-zA-Z0-9_-]+\b/gi,
    /\b(?:focusComponent|activeComponents|evidenceValidation)\b/gi,
  ];

  /**
   * Transforms raw explanation text and contextual metadata into speech-ready prose.
   */
  public static prepare(
    context: VoiceExplanationContext,
  ): SpeechPreparationResult {
    const rawText = context.explanation || context.title || "";
    const scrubbedTokens: string[] = [];

    // 1. Guard against JSON payloads
    let text = this.stripJsonPayloads(rawText);

    // 2. Remove markdown code blocks and backticks
    text = this.cleanMarkdown(text);

    // 2b. Translate internal compiler / domain IDs to spoken English
    text = text.replace(
      /\b(?:dijkstra[-_]graph|graph[-_]main)[-_]([A-Za-z0-9]+)\b/gi,
      "Node $1",
    );
    text = text.replace(
      /\bdist[-_]table(?:[-_](?:before|after))?\b/gi,
      "the distance table",
    );
    text = text.replace(
      /\bpq(?:[-_](?:before|after))?\b/gi,
      "the priority queue",
    );
    text = text.replace(/\binvariant[-_]text\b/gi, "the invariant");
    text = text.replace(
      /\b(?:Introducing\s+)?pointer,\s*(Node\s+[A-Za-z0-9]+)/gi,
      "Current $1",
    );

    // 3. Remove internal IDs and debug tokens
    for (const pattern of this.INTERNAL_ID_PATTERNS) {
      text = text.replace(pattern, (match) => {
        scrubbedTokens.push(match);
        return "";
      });
    }

    // 4. Translate data structure and algorithmic notations to natural language
    text = this.translateNotations(text);

    // 5. Clean punctuation, spacing, and ensure complete natural phrasing
    text = this.formatSpokenSentences(text, context);

    return {
      spokenText: text.trim(),
      originalText: rawText,
      scrubbedTokens,
      transformationId: context.transformationId,
      stepIndex: context.stepIndex,
    };
  }

  /**
   * Strips raw JSON objects or arrays if present in text
   */
  private static stripJsonPayloads(input: string): string {
    return input
      .replace(/\{[\s\S]*?\}/g, " ")
      .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, " ");
  }

  /**
   * Cleans markdown formatting, headers, links, and code fences
   */
  private static cleanMarkdown(input: string): string {
    return input
      .replace(/```[\s\S]*?```/g, " ") // code fences
      .replace(/`([^`]+)`/g, "$1") // inline code
      .replace(/!\[.*?\]\(.*?\)/g, "") // images
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // links -> link text
      .replace(/^#{1,6}\s+/gm, "") // headers
      .replace(/^\s*[-*+]\s+/gm, "") // bullet points
      .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
      .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      .replace(/\*([^*]+)\*/g, "$1") // italic
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1");
  }

  /**
   * Translates symbolic and technical notations into natural conversational speech
   */
  private static translateNotations(input: string): string {
    let out = input;

    // Pointer arrows: 20 -> 25 -> 30 => "node 20 points to 25, which points to 30"
    out = out.replace(
      /(\d+)\s*->\s*(\d+)\s*->\s*(\d+)/g,
      "node $1 points to $2, which connects to $3",
    );
    out = out.replace(/(\d+)\s*->\s*(\d+)/g, "node $1 points to $2");
    out = out.replace(/\s*->\s*/g, " points to ");
    out = out.replace(/\s*<-\s*/g, " points back to ");

    // Array indexing: arr[i] or array[0] or [mid]
    out = out.replace(
      /\b(?:arr|array)\[([a-zA-Z0-9_+-]+)\]/gi,
      "the element at index $1",
    );
    out = out.replace(/\[mid\]/gi, "at the middle index");

    // Equality and comparisons in algorithms
    out = out.replace(/===?/g, " equals ");
    out = out.replace(/!==?/g, " does not equal ");
    out = out.replace(/<=/g, " is less than or equal to ");
    out = out.replace(/>=/g, " is greater than or equal to ");
    out = out.replace(/</g, " is less than ");
    out = out.replace(/>/g, " is greater than ");

    // Big-O notation
    out = out.replace(/\bO\(1\)/gi, "constant time");
    out = out.replace(/\bO\(log\s*n\)/gi, "order of log n time");
    out = out.replace(/\bO\(n\s*\*\s*log\s*n\)/gi, "order of n log n time");
    out = out.replace(/\bO\(n\)/gi, "linear time");
    out = out.replace(/\bO\(n\^2\)/gi, "quadratic time");

    // Common abbreviations
    out = out.replace(/\bptr\b/gi, "pointer");
    out = out.replace(/\bidx\b/gi, "index");
    out = out.replace(/\bval\b/gi, "value");
    out = out.replace(/\belem\b/gi, "element");

    return out;
  }

  /**
   * Formats into complete, well-paced tutor sentences.
   */
  private static formatSpokenSentences(
    input: string,
    context: VoiceExplanationContext,
  ): string {
    // Collapse multi-whitespace
    let text = input.replace(/\s+/g, " ").trim();

    // If empty or purely a generic title like 'Initial State', synthesize a sensible fallback
    const isGenericTitle =
      !text ||
      text.length < 5 ||
      text.toLowerCase() === "initial state" ||
      (!context.explanation?.trim() && context.stepIndex === 0);

    if (isGenericTitle) {
      if (context.stepIndex === 0) {
        text = `Here is the initial empty state for ${
          context.concept || context.topic || context.title || "this structure"
        }.`;
      } else {
        text = `In this step, we perform ${
          context.title || "the next transformation"
        }.`;
      }
    }

    // Ensure terminal punctuation for proper TTS sentence cadence
    if (!/[.!?]$/.test(text)) {
      text += ".";
    }

    return text;
  }
}
