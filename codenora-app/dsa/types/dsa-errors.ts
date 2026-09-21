/**
 * Cognora DSA Acceleration Layer - Error Handling
 *
 * Clear, structured error classifications for deterministic DSA operations.
 * NOTE: DSA_CONCEPT_NOT_SUPPORTED is NOT a fatal error; it signals smooth
 * fallback to the universal Nemotron AI pipeline.
 */

export type DSAErrorCode =
  | "DSA_CONCEPT_NOT_SUPPORTED"
  | "DSA_INPUT_INVALID"
  | "DSA_INPUT_TOO_LARGE"
  | "DSA_ENGINE_FAILURE"
  | "DSA_VALIDATION_FAILURE"
  | "DSA_TRANSFORMATION_FAILURE"
  | "DSA_INTEGRATION_FAILURE";

export class DSAError extends Error {
  readonly code: DSAErrorCode;
  readonly conceptId?: string;
  readonly details?: unknown;

  constructor(
    code: DSAErrorCode,
    message: string,
    options?: { conceptId?: string; details?: unknown },
  ) {
    super(message);
    this.name = "DSAError";
    this.code = code;
    this.conceptId = options?.conceptId;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
