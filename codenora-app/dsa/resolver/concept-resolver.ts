/**
 * Cognora DSA Acceleration Layer - Deterministic Concept Resolver
 *
 * Fast, deterministic intent and concept resolution using canonical names,
 * common aliases, operation keywords, and normalized token scoring.
 *
 * Runs locally in <2ms with zero external network or LLM dependencies.
 */

import { type DSAConceptId, type ResolvedConcept } from "../types/dsa-concept";
import { DSAConceptRegistry } from "../registry/concept-registry";
import { resolveOperation, resolveVariant } from "../intent/dsa-vocabulary";

export class DSAConceptResolver {
  /**
   * Normalizes raw user prompt by stripping punctuation (except brackets/commas for values),
   * lowercasing, and collapsing whitespace.
   */
  public static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[''`]/g, "") // remove apostrophes: "dijkstra's" -> "dijkstras"
      .replace(/[^\w\s\-,.\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Resolves whether a question matches a registered DSA concept.
   * Returns a ResolvedConcept descriptor or null if confidence is too low or not a DSA topic.
   *
   * NOTE: The returned ResolvedConcept includes operationIntent and variantIntent.
   * These MUST be used in capability matching — concept alone is not sufficient for routing.
   */
  public static resolve(prompt: string): ResolvedConcept | null {
    if (!prompt || typeof prompt !== "string") {
      return null;
    }

    const normalized = this.normalizeText(prompt);
    if (!normalized) {
      return null;
    }

    const registry = DSAConceptRegistry.getInstance();
    const catalog = registry.getAll();

    let bestMatch: {
      conceptId: DSAConceptId;
      confidence: number;
      matchedTerms: string[];
      operationIntent?: string;
    } | null = null;

    // Use vocabulary table for operation detection (covers 'eliminate', 'remove', etc.)
    const resolvedOp = resolveOperation(prompt);
    const detectedOp = resolvedOp;

    // Use vocabulary table for variant detection
    const detectedVariant = resolveVariant(prompt);

    for (const item of catalog) {
      const matchedTerms: string[] = [];
      let score = 0;

      // 1. Exact canonical ID match with word boundary
      const idRegex = new RegExp(`\\b${item.id.replace(/-/g, "[\\s\\-_]?")}\\b`, "i");
      if (idRegex.test(normalized)) {
        score = Math.max(score, 0.95);
        matchedTerms.push(item.id);
      }

      // 2. Display name match
      const nameRegex = new RegExp(
        `\\b${item.displayName.toLowerCase().replace(/['']/g, "").replace(/\s+/g, "\\s+")}\\b`,
        "i",
      );
      if (nameRegex.test(normalized)) {
        score = Math.max(score, 0.96);
        matchedTerms.push(item.displayName);
      }

      // 3. Alias checks
      for (const alias of item.aliases) {
        const normAlias = alias.toLowerCase().replace(/['']/g, "");
        const escaped = normAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
        const aliasRegex = new RegExp(`\\b${escaped}\\b`, "i");
        if (aliasRegex.test(normalized)) {
          // Longer alias matches give higher confidence
          const matchConfidence = Math.min(0.98, 0.85 + normAlias.length * 0.015);
          if (matchConfidence > score) {
            score = matchConfidence;
          }
          if (!matchedTerms.includes(alias)) {
            matchedTerms.push(alias);
          }
        }
      }

      // 4. Boost score if recognized operation fits this concept category
      if (score > 0.5 && detectedOp) {
        if (
          (item.category === "sorting" && detectedOp === "sort") ||
          (item.category === "searching" && detectedOp === "search") ||
          (item.id === "avl" && detectedOp === "rotate") ||
          (item.category === "graph" &&
            (detectedOp === "traverse" || detectedOp === "shortest_path"))
        ) {
          score = Math.min(1.0, score + 0.04);
        }
      }

      if (score >= 0.7) {
        if (!bestMatch || score > bestMatch.confidence) {
          bestMatch = {
            conceptId: item.id,
            confidence: Math.round(score * 100) / 100,
            matchedTerms,
            operationIntent: detectedOp,
          };
        }
      }
    }

    // Special syntax-based intent recognition for linked list chains (e.g. 10 -> 20 -> 30)
    if (/(?:\d+|[a-zA-Z])\s*(?:->|→)\s*(?:\d+|[a-zA-Z])/.test(prompt)) {
      if (!bestMatch || bestMatch.confidence < 0.9) {
        bestMatch = {
          conceptId: "linked-list",
          confidence: 0.96,
          matchedTerms: ["pointer-chain (->)"],
          operationIntent: detectedOp,
        };
      }
    }

    // Handle doubly/circular linked list phrases that may not match catalog aliases
    // These resolve to "linked-list" conceptId but with a variant — the capability
    // registry will then gate routing correctly (→ Nemotron).
    if (!bestMatch || bestMatch.confidence < 0.9) {
      if (/\b(doubly|double)[-\s]?linked[-\s]?list\b/i.test(normalized)) {
        bestMatch = {
          conceptId: "linked-list",
          confidence: 0.97,
          matchedTerms: ["doubly linked list"],
          operationIntent: detectedOp,
        };
      } else if (/\bcircular[-\s]?linked[-\s]?list\b/i.test(normalized)) {
        bestMatch = {
          conceptId: "linked-list",
          confidence: 0.97,
          matchedTerms: ["circular linked list"],
          operationIntent: detectedOp,
        };
      }
    }

    if (!bestMatch) {
      return null;
    }


    // Extract raw input candidate string (bracketed expressions or sequence of numbers)
    const bracketMatch = prompt.match(/\[[^\]]+\]/);
    const rawInputCandidate = bracketMatch ? bracketMatch[0] : undefined;

    return {
      conceptId: bestMatch.conceptId,
      confidence: bestMatch.confidence,
      matchedTerms: bestMatch.matchedTerms,
      operationIntent: bestMatch.operationIntent,
      variantIntent: detectedVariant,
      rawInputCandidate,
    };
  }
}
