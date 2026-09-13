/**
 * Universal Problem Model
 *
 * Formalizes what must be answered, constructed, or derived.
 * Decoupled from topic-specific or domain-specific structures.
 */

import { type IntentClass, type Ambiguity, type QuestionUnderstandingResult } from "./question-understanding";
import { type Entity, type Relationship } from "./semantic-world";
import { type Confidence, CONFIDENCE_INFERRED, CONFIDENCE_KNOWN } from "./confidence-model";

export interface ProblemConstraint {
  id: string;
  statement: string;
  scope?: string;
  isHard: boolean;
}

export interface ProblemModel {
  /** Unique problem formalization identifier */
  id: string;
  /** The natural language question or request */
  question: string;
  /** Primary objective formulated from the question */
  objective: string;
  /** Classified intent */
  intent: IntentClass;
  /** Parsed or given inputs */
  inputs: unknown[];
  /** Expected outputs or results */
  outputs: unknown[];
  /** Candidate semantic entities identified */
  entities: Entity[];
  /** Candidate relationships identified */
  relationships: Relationship[];
  /** Explicit or inferred constraints */
  constraints: ProblemConstraint[];
  /** Necessary assumptions made */
  assumptions: string[];
  /** Desired result or target state description */
  desiredResult?: unknown;
  /** Ambiguities identified during understanding */
  ambiguity: Ambiguity[];
  /** Conventions applied (e.g. 0-based indexing, big-endian, ASCII) */
  conventions: string[];
  /** Verifiable success criteria for the solution */
  successCriteria: string[];
  /** Epistemic confidence */
  confidence: Confidence;
  /** Extensible domain metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Formalizes a user question and understanding into a generic ProblemModel.
 */
export function formalizeProblem(
  understanding: QuestionUnderstandingResult,
  proposal?: {
    entities?: Entity[];
    relationships?: Relationship[];
    constraints?: string[];
    objective?: string;
    successCriteria?: string[];
  },
): ProblemModel {
  const id = `prob-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const constraints: ProblemConstraint[] = [
    ...understanding.constraints.map((c, i) => ({
      id: `c-inferred-${i + 1}`,
      statement: c,
      isHard: true,
    })),
    ...(proposal?.constraints || []).map((c, i) => ({
      id: `c-prop-${i + 1}`,
      statement: c,
      isHard: true,
    })),
  ];

  if (constraints.length === 0) {
    constraints.push({
      id: "c-universal-consistency",
      statement: "State transitions must preserve causal consistency and entity identity",
      isHard: true,
    });
  }

  const conventions: string[] = [
    "Preserve object identity across all state transitions",
    "Preserve causality: state mutations must be justified by operations",
  ];

  const successCriteria: string[] = proposal?.successCriteria || [
    `Concept '${understanding.concept}' is clearly explained and verified`,
    "All intermediate transformations satisfy active invariants",
    "Final state satisfies the problem objective",
  ];

  const objective =
    proposal?.objective ||
    `Understand and visualize ${understanding.concept}${
      understanding.requestedOperation ? ` through ${understanding.requestedOperation}` : ""
    }`;

  return {
    id,
    question: understanding.rawQuestion,
    objective,
    intent: understanding.userIntent,
    inputs: understanding.inputs,
    outputs: understanding.expectedResult !== undefined ? [understanding.expectedResult] : [],
    entities: proposal?.entities || [],
    relationships: proposal?.relationships || [],
    constraints,
    assumptions: understanding.assumptions,
    desiredResult: understanding.expectedResult,
    ambiguity: understanding.ambiguity,
    conventions,
    successCriteria,
    confidence: understanding.confidence,
  };
}
