/**
 * Frontend AI Teaching Service Client
 *
 * Provides a typed interface for frontend components to communicate with
 * the /api/ai/teach backend endpoint without coupling to the underlying
 * AI provider implementation.
 */

import { MockTeachingProvider } from "./backend/mock-provider";

import type {
  TeachingRequest,
  TeachingResponse,
  TeachingErrorResponse,
} from "./teaching-contract";

const TEACHING_API_ENDPOINT = "/api/ai/teach";

// Fallback provider for environments where the HTTP server is not available (e.g. offline unit tests)
const localFallbackProvider = new MockTeachingProvider({ simulateDelayMs: 0 });

export interface RequestTeachingOptions {
  /** Enable automatic offline fallback to local mock provider if network/backend fails */
  fallbackToLocalMock?: boolean;
}

/**
 * Dispatches a teaching explanation request to the backend service.
 */
export async function requestTeachingExplanation(
  request: TeachingRequest,
  options?: RequestTeachingOptions,
): Promise<TeachingResponse> {
  try {
    const response = await fetch(TEACHING_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = `AI teaching service returned status ${response.status} (${response.statusText})`;
      try {
        const errorData = (await response.json()) as TeachingErrorResponse;
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Body was not JSON, retain HTTP status message
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as TeachingResponse;
    return data;
  } catch (error: unknown) {
    if (options?.fallbackToLocalMock) {
      // eslint-disable-next-line no-console
      console.warn(
        "[ai-service] Backend call failed, using local mock fallback:",
        error,
      );
      return localFallbackProvider.generateTeachingResponse(request);
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to connect to AI teaching service.";
    throw new Error(message);
  }
}

/**
 * Convenience helper that generates mock teaching responses directly.
 * Useful for tests and offline demonstrations.
 */
export async function getMockTeachingResponse(
  prompt: string,
): Promise<TeachingResponse> {
  return localFallbackProvider.generateTeachingResponse({ prompt });
}
