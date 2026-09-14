/**
 * Cognora AI Provider Abstraction
 *
 * Core interface and utilities for pluggable AI providers.
 * Decouples the Cognora teaching pipeline from any specific LLM host.
 */

import type { TeachingRequest, TeachingResponse } from "../teaching-contract";
import { ProviderSchemaError } from "./provider-errors";

export interface AIProvider {
  /** Unique provider identifier (e.g. 'nvidia', 'openrouter', 'mock') */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /** Returns whether required credentials and configurations are available */
  isConfigured(): boolean;

  /** Generates a validated TeachingResponse for a given user request */
  generateTeachingLesson(request: TeachingRequest): Promise<TeachingResponse>;

  /** Backward-compatible alias for generateTeachingLesson */
  generateTeachingResponse?(request: TeachingRequest): Promise<TeachingResponse>;
}

/**
 * Determines whether an error is an operational provider-level failure
 * that warrants attempting failover to a fallback provider.
 *
 * Recoverable provider failures:
 * - Network errors, DNS failures, connection timeouts (ProviderNetworkError)
 * - Upstream request timeouts (ProviderTimeoutError)
 * - Rate limits / HTTP 429 (ProviderRateLimitError)
 * - Credit capacity limits / HTTP 402 (ProviderCreditCapacityError)
 * - Provider 5xx HTTP gateway or server crashes
 * - Unconfigured / missing credentials for the primary provider
 *
 * Non-recoverable failures (MUST NOT fallback):
 * - Schema / Visual DSL validation errors (ProviderSchemaError)
 *   -> These represent model comprehension or prompting bugs, not provider outages.
 * - Application code bugs, syntax errors, or assertions
 */
export function isRecoverableProviderError(err: unknown): boolean {
  if (!err) {
    return false;
  }

  // Schema errors must NOT trigger fallback — surface them directly for diagnosis
  if (err instanceof ProviderSchemaError) {
    return false;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // Explicit non-recoverable schema indicator
    if (
      msg.includes("invalid visual dsl") ||
      msg.includes("schema validation failed") ||
      msg.includes("does not conform to visual dsl")
    ) {
      return false;
    }

    // Check for operational provider errors
    const isNetworkOrTimeout =
      err.name === "ProviderNetworkError" ||
      err.name === "ProviderTimeoutError" ||
      err.name === "AbortError" ||
      msg.includes("timed out") ||
      msg.includes("network error") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("fetch failed");

    const isRateOrCredit =
      err.name === "ProviderRateLimitError" ||
      err.name === "ProviderCreditCapacityError" ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("402") ||
      msg.includes("requires more credits") ||
      msg.includes("fewer max_tokens") ||
      msg.includes("can only afford");

    const isUnconfigured =
      msg.includes("not configured") ||
      msg.includes("missing api key") ||
      msg.includes("unconfigured");

    const statusCode =
      typeof (err as unknown as { statusCode?: unknown }).statusCode === "number"
        ? (err as unknown as { statusCode: number }).statusCode
        : undefined;
    const is5xxStatusCode =
      typeof statusCode === "number" && statusCode >= 500 && statusCode <= 599;
    const is429StatusCode = statusCode === 429;
    const is402StatusCode = statusCode === 402;

    const isOverloadedOrUnavailable =
      msg.includes("overloaded") ||
      msg.includes("service unavailable") ||
      msg.includes("bad gateway") ||
      msg.includes("gateway timeout") ||
      msg.includes("upstream");

    if (
      isNetworkOrTimeout ||
      isRateOrCredit ||
      isUnconfigured ||
      is5xxStatusCode ||
      is429StatusCode ||
      is402StatusCode ||
      isOverloadedOrUnavailable
    ) {
      return true;
    }
  }

  return false;
}
