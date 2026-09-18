/**
 * Cognora Glimpse Extractor
 *
 * Pedagogical Philosophy:
 * CANVAS   -> Visual glimpse / minimal contextual hint ("What is happening right now?")
 * INSPECTOR -> Complete lesson explanation, causal reasoning, invariants & step details
 *
 * This module dynamically extracts a concise 1-2 sentence glimpse from the current
 * semantic transformation without any concept-specific hardcoding.
 */

import { ExplanationEngine } from "../ai/explanation-engine";

export interface GlimpseSource {
  title?: string;
  explanation?: string;
  whatChanged?: string;
  action?: string;
  learnerObservation?: string;
  calculations?: string;
  insight?: string;
  topic?: string;
}

export interface DerivedGlimpse {
  title: string;
  glimpse: string;
  fullExplanation: string;
}

export interface GlimpseDimensions {
  width: number;
  height: number;
}

/**
 * Strips markdown asterisks, backticks, underscores, and excessive whitespace.
 */
function cleanFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes title by removing generic "Step N: " or "Transformation N: " prefixes.
 */
function normalizeTitle(rawTitle?: string, fallbackTopic?: string): string {
  if (!rawTitle || !rawTitle.trim()) {
    return fallbackTopic ? `${fallbackTopic}` : "Visual Insight";
  }

  let cleaned = rawTitle
    .replace(
      /^(?:Step|Transformation|State|Phase)\s+\d+(?:\s*(?:of|\/)\s*\d+)?(?::|\s*-)?\s*/i,
      "",
    )
    .replace(/^Execution Step(?::|\s*-)?\s*/i, "")
    .trim();

  cleaned = cleanFormatting(ExplanationEngine.scrubMetadata(cleaned));

  // If title was stripped down to nothing or too generic
  if (!cleaned || /^(?:Transformation|State Update|Step)$/i.test(cleaned)) {
    return fallbackTopic || "Visual Insight";
  }

  // Capitalize first character if needed
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Extracts a compact 1-2 sentence glimpse answering "What is happening right now?".
 * Visual budget: <= 110-120 characters.
 */
export function deriveCompactGlimpse(source: GlimpseSource): DerivedGlimpse {
  const fullExplanation = source.explanation?.trim() || "";
  const title = normalizeTitle(source.title, source.topic);

  // 1. Check if explanation has structured multi-line labels like "WHAT:" or "WHAT CHANGED:"
  if (fullExplanation) {
    const whatMatch = fullExplanation.match(
      /(?:^|\n)(?:WHAT|SUMMARY|WHAT CHANGED):\s*([^\n]+)/i,
    );
    if (whatMatch && whatMatch[1]) {
      const candidate = cleanFormatting(
        ExplanationEngine.scrubMetadata(whatMatch[1]),
      );
      if (candidate.length > 10 && candidate.length <= 120) {
        return {
          title,
          glimpse: ensureSentencePunctuation(candidate),
          fullExplanation,
        };
      }
    }
  }

  // 2. Check if source.whatChanged provides a clean, natural single sentence
  if (source.whatChanged && source.whatChanged.trim()) {
    const whatChangedClean = cleanFormatting(
      ExplanationEngine.scrubMetadata(source.whatChanged),
    );
    // Ignore raw graph/entity mutation debug dumps (e.g. "Added entity '25'; Connected...")
    const isRawDebugDump =
      whatChangedClean.includes(";") ||
      whatChangedClean.includes("->") ||
      /^(?:Added entity|Removed entity|Connected|Disconnected)/i.test(
        whatChangedClean,
      );

    if (
      !isRawDebugDump &&
      whatChangedClean.length >= 10 &&
      whatChangedClean.length <= 110
    ) {
      return {
        title,
        glimpse: ensureSentencePunctuation(whatChangedClean),
        fullExplanation,
      };
    }
  }

  // 3. Fallback to extracting the primary sentence(s) from the full explanation
  if (fullExplanation) {
    const scrubbed = cleanFormatting(
      ExplanationEngine.scrubMetadata(fullExplanation),
    );

    // Split on sentence boundaries
    const rawSentences = scrubbed
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    if (rawSentences.length > 0) {
      const firstSentence = rawSentences[0];

      // If the first sentence is short (< 40 chars) and a second exists, combine them if <= 110 chars
      if (
        firstSentence.length < 40 &&
        rawSentences.length > 1 &&
        firstSentence.length + rawSentences[1].length + 1 <= 110
      ) {
        return {
          title,
          glimpse: `${ensureSentencePunctuation(
            firstSentence,
          )} ${ensureSentencePunctuation(rawSentences[1])}`,
          fullExplanation,
        };
      }

      // If the first sentence is within the budget
      if (firstSentence.length <= 110) {
        return {
          title,
          glimpse: ensureSentencePunctuation(firstSentence),
          fullExplanation,
        };
      }

      // If the sentence is long (> 110 chars), summarize cleanly at a natural clause boundary
      const naturalClause = truncateAtClauseBoundary(firstSentence, 105);
      return {
        title,
        glimpse: ensureSentencePunctuation(naturalClause),
        fullExplanation,
      };
    }
  }

  // 4. Default fallback when no explanation text exists
  const fallback = source.title
    ? `Focus on ${title.toLowerCase()}.`
    : "Observing visual state transition.";
  return {
    title,
    glimpse: fallback,
    fullExplanation,
  };
}

/**
 * Truncates long text cleanly at a natural clause boundary (comma, semicolon, dash, conjunction)
 * or word boundary, avoiding awkward breaks.
 */
function truncateAtClauseBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }

  const sub = text.slice(0, maxLen);

  // Look for natural clause boundary: comma, semicolon, dash, " so ", " because ", " where "
  const clauseMatches = [
    sub.lastIndexOf(", "),
    sub.lastIndexOf("; "),
    sub.lastIndexOf(" — "),
    sub.lastIndexOf(" - "),
    sub.lastIndexOf(" so "),
    sub.lastIndexOf(" where "),
    sub.lastIndexOf(" because "),
  ].filter((idx) => idx > 30);

  if (clauseMatches.length > 0) {
    const bestIdx = Math.max(...clauseMatches);
    return sub.slice(0, bestIdx).trim();
  }

  // Fallback to last word boundary
  const lastSpace = sub.lastIndexOf(" ");
  if (lastSpace > 35) {
    return sub.slice(0, lastSpace).trim();
  }

  return sub.trim();
}

/**
 * Ensures text ends with a valid sentence punctuation mark (. ! ?).
 */
function ensureSentencePunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}

/**
 * Dynamically estimates compact card dimensions based on measured character budget.
 *
 * Guarantees:
 * - Never a huge 220px card
 * - Adapts to actual content width and line count
 * - Always fits inside container bounds
 */
export function estimateGlimpseDimensions(
  glimpse: DerivedGlimpse,
  containerWidth: number,
): GlimpseDimensions {
  const maxSafeWidth = Math.min(310, Math.max(220, containerWidth - 48));

  // Title: ~26 chars per line at 13px bold
  const titleChars = glimpse.title.length;
  const titleLines = Math.ceil(titleChars / 26) || 1;

  // Glimpse: ~36 chars per line at 12px regular
  const glimpseChars = glimpse.glimpse.length;
  const glimpseLines = Math.ceil(glimpseChars / 36) || 1;

  // Vertical budget:
  // padding-top (10px) + indicator/title (titleLines * 18px) + gap (6px) +
  // glimpse text (glimpseLines * 17px) + affordance link (18px) + padding-bottom (10px)
  const estHeight = Math.min(
    115,
    Math.max(68, 20 + titleLines * 18 + 6 + glimpseLines * 17 + 18),
  );

  return {
    width: maxSafeWidth,
    height: estHeight,
  };
}
