/**
 * Cognora DSA Acceleration Layer - Deterministic Engine Contract
 *
 * All deterministic DSA engines implement this interface.
 * Represents REAL, step-by-step algorithm execution on dynamic user input.
 */

import type { DSASemanticState } from "./dsa-state";
import type { TeachingTransformation } from "./dsa-transformation";
import type { DSAInputLimits } from "./dsa-concept";

export interface DSAValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DSAExecutionResult<TState = DSASemanticState> {
  success: boolean;
  conceptId: string;
  initialState: TState;
  finalState: TState;
  states: TState[];
  transformations: TeachingTransformation[];
  validation: DSAValidationResult;
  metadata?: Record<string, unknown>;
}

export interface DSAConceptEngine<TInput = unknown, TState = DSASemanticState> {
  /** Canonical concept identifier implemented by this engine */
  readonly conceptId: string;

  /**
   * Initializes the engine with user or default input and runs the deterministic
   * algorithm execution to produce verified semantic states and transformations.
   */
  execute(input: TInput, limits?: DSAInputLimits): DSAExecutionResult<TState>;

  /** Retrieves all produced semantic states in execution order */
  getAllStates(): TState[];

  /** Retrieves all produced teaching transformations in sequence */
  getTransformations(): TeachingTransformation[];

  /** Current state of the engine */
  getCurrentState(): TState;

  /** Final terminal state of the algorithm */
  getFinalState(): TState;

  /** Validates algorithm-specific invariants on the produced execution */
  validate(): DSAValidationResult;

  /** Whether the algorithm has executed to completion */
  isComplete(): boolean;
}
