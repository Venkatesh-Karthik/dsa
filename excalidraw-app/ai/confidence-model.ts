/**
 * Universal Confidence and Uncertainty Model
 *
 * Distinguishes the epistemic status of all semantic claims:
 * KNOWN, DERIVED, INFERRED, ASSUMED, or UNCERTAIN.
 */

export type ConfidenceLevel =
  | "KNOWN"      // Directly stated by user or proven mathematically
  | "DERIVED"    // Calculated deterministically from known state
  | "INFERRED"   // Reasoned through semantic domain knowledge
  | "ASSUMED"    // Default convention selected due to underspecification
  | "UNCERTAIN"; // Boundary condition or ambiguous question requiring caveat

export interface Confidence {
  /** Numeric score between 0.0 (total unknown) and 1.0 (absolute certainty) */
  value: number;
  /** Qualitative epistemic status */
  level: ConfidenceLevel;
  /** Rationale for this confidence level */
  reason: string;
  /** Source of truth: 'axiom' | 'computation' | 'heuristics' | 'convention' | 'ai_proposal' */
  source: string;
}

export function createConfidence(
  value: number,
  level: ConfidenceLevel,
  reason: string,
  source: string = "computation",
): Confidence {
  return {
    value: Math.max(0, Math.min(1, value)),
    level,
    reason,
    source,
  };
}

export const CONFIDENCE_KNOWN = createConfidence(1.0, "KNOWN", "Directly verified", "axiom");
export const CONFIDENCE_DERIVED = createConfidence(0.95, "DERIVED", "Deterministically computed", "computation");
export const CONFIDENCE_INFERRED = createConfidence(0.85, "INFERRED", "Semantically inferred", "heuristics");
export const CONFIDENCE_ASSUMED = createConfidence(0.7, "ASSUMED", "Standard convention assumed", "convention");
export const CONFIDENCE_UNCERTAIN = createConfidence(0.4, "UNCERTAIN", "Ambiguous or partially specified", "heuristics");
