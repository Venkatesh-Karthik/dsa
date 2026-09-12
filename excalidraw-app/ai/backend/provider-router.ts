/**
 * Cognora AI Provider Router
 *
 * Implements single-dispatch provider routing with automatic operational failover:
 * 1. Dispatches teaching requests to the PRIMARY provider (NVIDIA Nemotron 3 Ultra).
 * 2. On recoverable provider failure (rate limit, credit constraint, timeout, network error),
 *    fails over cleanly to the FALLBACK provider (OpenRouter).
 * 3. Never falls back on application bugs or schema/DSL validation errors.
 * 4. Never calls providers simultaneously.
 */

import { isRecoverableProviderError } from "./ai-provider";
import { NvidiaNemotronProvider } from "./nvidia-provider";
import { OpenRouterTeachingProvider } from "./openrouter-provider";
import { MockTeachingProvider } from "./mock-provider";

import type { AIProvider } from "./ai-provider";
import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export interface ProviderRouterOptions {
  primaryProvider?: AIProvider | TeachingProvider;
  fallbackProvider?: AIProvider | TeachingProvider;
}

export class ProviderRouter implements AIProvider, TeachingProvider {
  readonly id = "provider-router";
  readonly name = "Cognora Provider Router";

  private primary: AIProvider | TeachingProvider;
  private fallback: (AIProvider | TeachingProvider) | null;

  constructor(options?: ProviderRouterOptions) {
    this.primary = options?.primaryProvider ?? resolvePrimaryProvider();
    this.fallback =
      options && "fallbackProvider" in options
        ? (options.fallbackProvider ?? null)
        : resolveFallbackProvider();
  }

  isConfigured(): boolean {
    return this.primary.isConfigured() || Boolean(this.fallback?.isConfigured());
  }

  getPrimaryProvider(): AIProvider | TeachingProvider {
    return this.primary;
  }

  getFallbackProvider(): (AIProvider | TeachingProvider) | null {
    return this.fallback;
  }

  async generateTeachingLesson(
    request: TeachingRequest,
  ): Promise<TeachingResponse> {
    return this.executeRouting(request);
  }

  async generateTeachingResponse(
    request: TeachingRequest,
  ): Promise<TeachingResponse> {
    return this.executeRouting(request);
  }

  private async executeRouting(
    request: TeachingRequest,
  ): Promise<TeachingResponse> {
    const requestId = request.requestId || `COGNORA-${Date.now()}`;
    const primaryId = this.primary.id;
    const primaryModel =
      "getModel" in this.primary &&
      typeof (this.primary as { getModel?: () => string }).getModel === "function"
        ? (this.primary as { getModel: () => string }).getModel()
        : "default";

    // 1. Log Primary Dispatch
    // eslint-disable-next-line no-console
    console.log(
      `[COGNORA][AI][REQUEST] requestId=${requestId} provider=${primaryId} model=${primaryModel}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[COGNORA][AI][START] requestId=${requestId} provider=${primaryId} model=${primaryModel}`,
    );

    // 2. Execute Primary Request
    try {
      const response =
        "generateTeachingLesson" in this.primary &&
        typeof this.primary.generateTeachingLesson === "function"
          ? await this.primary.generateTeachingLesson(request)
          : await (
              this.primary as {
                generateTeachingResponse: (
                  r: TeachingRequest,
                ) => Promise<TeachingResponse>;
              }
            ).generateTeachingResponse(request);

      // eslint-disable-next-line no-console
      console.log(
        `[COGNORA][AI][SUCCESS] requestId=${requestId} provider=${primaryId}`,
      );
      return response;
    } catch (primaryErr: unknown) {
      const primaryErrMsg =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

      // 3. Evaluate Failover Eligibility
      const canFallback =
        this.fallback &&
        this.fallback.id !== this.primary.id &&
        isRecoverableProviderError(primaryErr);

      if (!canFallback) {
        // eslint-disable-next-line no-console
        console.error(
          `[COGNORA][AI][ERROR] requestId=${requestId} provider=${primaryId} error="${primaryErrMsg}" (non-recoverable, no fallback)`,
        );
        throw primaryErr;
      }

      // 4. Execute Fallback
      const fallbackId = this.fallback!.id;
      // eslint-disable-next-line no-console
      console.warn(
        `[COGNORA][AI][FALLBACK] requestId=${requestId} from=${primaryId} to=${fallbackId} reason="${primaryErrMsg}"`,
      );

      try {
        const fallbackResponse =
          "generateTeachingLesson" in this.fallback! &&
          typeof this.fallback!.generateTeachingLesson === "function"
            ? await this.fallback!.generateTeachingLesson(request)
            : await (
                this.fallback! as {
                  generateTeachingResponse: (
                    r: TeachingRequest,
                  ) => Promise<TeachingResponse>;
                }
              ).generateTeachingResponse(request);

        // eslint-disable-next-line no-console
        console.log(
          `[COGNORA][AI][SUCCESS] requestId=${requestId} provider=${fallbackId}`,
        );
        return fallbackResponse;
      } catch (fallbackErr: unknown) {
        const fallbackErrMsg =
          fallbackErr instanceof Error
            ? fallbackErr.message
            : String(fallbackErr);
        // eslint-disable-next-line no-console
        console.error(
          `[COGNORA][AI][ERROR] requestId=${requestId} provider=${fallbackId} error="${fallbackErrMsg}"`,
        );

        // Fail-safe resilience: If both cloud providers fail with recoverable operational errors
        // (e.g. NVIDIA 503 overloaded AND OpenRouter 402 credit exhausted),
        // gracefully fall back to local deterministic provider so user is never blocked.
        if (isRecoverableProviderError(fallbackErr)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[COGNORA][AI][FALLBACK] requestId=${requestId} from=${fallbackId} to=mock reason="All cloud providers unavailable: ${fallbackErrMsg}"`,
          );
          const mockProvider = new MockTeachingProvider();
          const mockResponse = await mockProvider.generateTeachingResponse(request);
          // eslint-disable-next-line no-console
          console.log(
            `[COGNORA][AI][SUCCESS] requestId=${requestId} provider=mock (resilient failover)`,
          );
          return mockResponse;
        }

        throw fallbackErr;
      }
    }
  }
}

function resolvePrimaryProvider(): AIProvider | TeachingProvider {
  const choice =
    typeof process !== "undefined"
      ? process.env?.COGNORA_PRIMARY_PROVIDER?.toLowerCase().trim()
      : undefined;

  if (choice === "openrouter") {
    return new OpenRouterTeachingProvider();
  }
  if (choice === "mock") {
    return new MockTeachingProvider();
  }

  // Default primary: NVIDIA Nemotron
  return new NvidiaNemotronProvider();
}

function resolveFallbackProvider(): (AIProvider | TeachingProvider) | null {
  const choice =
    typeof process !== "undefined"
      ? process.env?.COGNORA_FALLBACK_PROVIDER?.toLowerCase().trim()
      : undefined;

  if (choice === "none" || choice === "false") {
    return null;
  }
  if (choice === "mock") {
    return new MockTeachingProvider();
  }

  // Default fallback: OpenRouter
  return new OpenRouterTeachingProvider();
}
