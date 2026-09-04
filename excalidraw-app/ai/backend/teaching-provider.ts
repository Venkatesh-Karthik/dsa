/**
 * Teaching Provider Interface
 *
 * Pluggable provider abstraction for generating pedagogical explanations
 * and Visual Teaching DSL actions.
 */

import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export interface TeachingProvider {
  /** Unique provider identifier (e.g. 'mock', 'featherless') */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /** Returns whether required credentials / configs are available */
  isConfigured(): boolean;

  /** Generates a validated TeachingResponse for a given user request */
  generateTeachingResponse(request: TeachingRequest): Promise<TeachingResponse>;
}
