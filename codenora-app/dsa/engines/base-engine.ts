/**
 * Cognora DSA Acceleration Layer - Base Engine Abstraction
 *
 * Provides shared state lifecycle, validation, and contract implementation
 * for all deterministic DSA engines.
 */

import type { DSAConceptEngine, DSAExecutionResult, DSAValidationResult } from "../types/dsa-engine";
import type { DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAInputLimits } from "../types/dsa-concept";
import { DSAStateIntegrityValidator } from "../validation/state-integrity-validator";

export abstract class BaseDSAEngine<TInput = unknown> implements DSAConceptEngine<TInput, DSASemanticState> {
  public abstract readonly conceptId: string;
  protected states: DSASemanticState[] = [];
  protected transformations: TeachingTransformation[] = [];
  protected complete = false;

  public abstract execute(input: TInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState>;

  public getAllStates(): DSASemanticState[] {
    return this.states;
  }

  public getTransformations(): TeachingTransformation[] {
    return this.transformations;
  }

  public getCurrentState(): DSASemanticState {
    return this.states[this.states.length - 1];
  }

  public getFinalState(): DSASemanticState {
    return this.states[this.states.length - 1];
  }

  public validate(): DSAValidationResult {
    return DSAStateIntegrityValidator.validate(this.states, this.transformations);
  }

  public isComplete(): boolean {
    return this.complete;
  }

  protected formatResult(metadata?: Record<string, unknown>): DSAExecutionResult<DSASemanticState> {
    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
      metadata,
    };
  }
}
