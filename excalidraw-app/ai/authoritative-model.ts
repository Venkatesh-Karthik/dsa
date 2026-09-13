/**
 * Authoritative Semantic Model
 *
 * The single source of truth for an educational lesson in Cognora.
 * The AI response is NOT authoritative.
 * The renderer is NOT authoritative.
 * The UI is NOT authoritative.
 * The validated AuthoritativeSemanticModel is authoritative.
 */

import { type ProblemModel } from "./problem-model";
import { type SemanticWorld, type SemanticState, type Entity, type Relationship } from "./semantic-world";
import { type Rule, type Invariant, type DerivedValue } from "./rules-invariants";
import { type Confidence } from "./confidence-model";

export interface GoalSatisfactionReport {
  satisfied: boolean;
  objective: string;
  verifiedCriteria: Array<{
    criterion: string;
    passed: boolean;
    evidence?: string;
  }>;
  summary: string;
}

export interface AuthoritativeTransformation {
  id: string;
  stepNumber: number;
  title: string;
  purpose: string;
  cause: string;
  action: string;
  preconditions: string[];
  affectedEntities: string[];
  affectedRelationships: string[];
  fromStateIndex: number;
  toStateIndex: number;
  whatChanged: string;
  whyChanged: string;
  learnerObservation: string;
  consequence: string;
  invariantEffects: string[];
  explanation: string;
  calculations?: string;
  insight?: string;
  codeSnippet?: string;
  codeLanguage?: string;
}

export interface AuthoritativeSemanticModel {
  id: string;
  /** Formal problem definition */
  problem: ProblemModel;
  /** Semantic world of the concept */
  world: SemanticWorld;
  /** All verified rules */
  rules: Rule[];
  /** Active invariants that must hold */
  invariants: Invariant[];
  /** Authoritative immutable semantic states */
  states: SemanticState[];
  /** Meaningful validated transformations between states */
  transformations: AuthoritativeTransformation[];
  /** Deterministic derived values evaluated across states */
  derivedValuesByState: Record<number, Record<string, DerivedValue>>;
  /** Independent goal satisfaction report */
  goalSatisfaction: GoalSatisfactionReport;
  /** Pedagogical teaching strategy metadata */
  strategy: string;
  /** Epistemic confidence in this authoritative model */
  confidence: Confidence;
  /** Timestamp when validated and locked */
  timestamp: number;
}
