/**
 * Cognora AI Provider Router
 *
 * Implements single-dispatch provider routing.
 * Dispatches teaching requests to the PRIMARY provider (NVIDIA Nemotron).
 * No OpenRouter.
 */

import { isRecoverableProviderError } from "./ai-provider";
import { NvidiaNemotronProvider } from "./nvidia-provider";
import { MockTeachingProvider } from "./mock-provider";

import type { AIProvider } from "./ai-provider";
import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export interface ProviderRouterOptions {
  primaryProvider?: AIProvider | TeachingProvider;
}

export class ProviderRouter implements AIProvider, TeachingProvider {
  readonly id = "provider-router";
  readonly name = "Cognora Provider Router";

  private primary: AIProvider | TeachingProvider;

  constructor(options?: ProviderRouterOptions) {
    this.primary = options?.primaryProvider ?? resolvePrimaryProvider();
  }

  isConfigured(): boolean {
    return this.primary.isConfigured();
  }

  getPrimaryProvider(): AIProvider | TeachingProvider {
    return this.primary;
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
      typeof (this.primary as { getModel?: () => string }).getModel ===
        "function"
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

    // 2. Execute Request
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

      // eslint-disable-next-line no-console
      console.error(
        `[COGNORA][AI][ERROR] requestId=${requestId} provider=${primaryId} error="${primaryErrMsg}"`,
      );
      throw primaryErr;
    }
  }
}

function resolvePrimaryProvider(): AIProvider | TeachingProvider {
  const choice =
    typeof process !== "undefined"
      ? process.env?.COGNORA_PRIMARY_PROVIDER?.toLowerCase().trim()
      : undefined;

  if (choice === "mock") {
    return new MockTeachingProvider();
  }

  // Default primary: NVIDIA Nemotron
  return new NvidiaNemotronProvider();
}
