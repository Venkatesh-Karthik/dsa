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
import {
  type SemanticWorld,
  type SemanticState,
  type Entity,
  type Relationship,
  type SemanticDecision,
  type SemanticOutcome,
  type SemanticStateType,
  type StatePersistence,
} from "./semantic-world";
import {
  type Rule,
  type Invariant,
  type DerivedValue,
} from "./rules-invariants";
import { type Confidence } from "./confidence-model";
import { type PlanningDiagnostics } from "./transformation-diagnostics";

export type JourneyType =
  | "linear"
  | "branching"
  | "merging"
  | "cyclic"
  | "conditional"
  | "failure"
  | "recovery"
  | "retry"
  | "terminal"
  | "counterfactual";

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
  postconditions?: string[];
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
  codeContext?: any;
  /** Active decision evaluated in this transformation */
  decision?: SemanticDecision;
  /** Outcome selected when advancing from this step */
  selectedOutcome?: string;
  /** Unselected alternative outcomes (e.g. failure path when success is taken, or vice versa) */
  alternativeOutcomes?: SemanticOutcome[];
  /** Branch category of this transformation */
  branchType?: "primary" | "failure" | "recovery" | "counterfactual";
  /** Classification of resulting state */
  stateType?: SemanticStateType;
  /** Persistence of changes produced */
  persistence?: StatePersistence;
  /** Causal relationship role */
  causalRole?: "causes" | "enables" | "requires" | "prevents" | "restores";
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
  /** Decisions captured across the conceptual journey */
  decisions?: SemanticDecision[];
  /** Overall conceptual journey topology */
  journeyType?: JourneyType;
  /** Pedagogical teaching strategy metadata */
  strategy: string;
  /** Epistemic confidence in this authoritative model */
  confidence: Confidence;
  /** Universal teaching blueprint */
  blueprint?: any;
  /** Internal planning telemetry & diagnostics (never shown to user) */
  diagnostics?: PlanningDiagnostics;
  /** Timestamp when validated and locked */
  timestamp: number;
}
