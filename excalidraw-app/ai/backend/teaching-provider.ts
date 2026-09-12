/**
 * Teaching Provider Interface
 *
 * Pluggable provider abstraction for generating pedagogical explanations
 * and Visual Teaching DSL actions.
 */

import type { AIProvider } from "./ai-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export type { AIProvider };
export { isRecoverableProviderError } from "./ai-provider";

export interface TeachingProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  /** Generates a validated TeachingResponse for a given user request */
  generateTeachingResponse(request: TeachingRequest): Promise<TeachingResponse>;

  /** Generates a validated TeachingResponse for a given user request (AIProvider standard) */
  generateTeachingLesson?(request: TeachingRequest): Promise<TeachingResponse>;
}
