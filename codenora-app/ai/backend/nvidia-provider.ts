/**
 * NVIDIA Nemotron 3 Ultra AI Teaching Provider
 *
 * Implements the AIProvider & TeachingProvider interfaces using NVIDIA's
 * OpenAI-compatible NIM API (https://integrate.api.nvidia.com/v1).
 *
 * Primary Model: nvidia/nemotron-3-ultra-550b-a55b
 *
 * All API keys and secrets remain strictly server-side.
 *
 * Architecture:
 * - Direct integration with NVIDIA NIM OpenAI-compatible chat completion endpoint.
 * - Private reasoning isolation: strips <think>...</think> and <thought>...</thought> tags
 *   so chain-of-thought is never leaked to the user.
 * - Robust structured JSON candidate extraction (direct JSON, markdown code fence, sanitized).
 * - Full validation, normalization, and quality validation matching Cognora Visual DSL.
 * - Hard timeouts: 35s initial attempt, 20s repair attempt.
 * - Fail-fast operational error classification (401 auth, 429 rate limit, 402 credit, network).
 */

import {
  validateTeachingResponse,
  normalizeTeachingResponse,
  repairOrReorderActions,
} from "./dsl-validator";
import {
  ProviderError,
  ProviderTimeoutError,
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderNetworkError,
  ProviderSchemaError,
  ProviderCreditCapacityError,
} from "./provider-errors";
import {
  NEMOTRON_COMPACT_SYSTEM_PROMPT,
  formatTeachingUserPrompt,
} from "./prompts";
import { enrichCodingResponse } from "./coding-solver";

import {
  safeParseJson,
  stripReasoningTags,
  deterministicJsonRepair,
  extractBalancedJson,
  closeTruncatedJson,
  extractJsonFromText,
  isolateMessageContent,
} from "./response-extractor";

import type { AIProvider } from "./ai-provider";
import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export {
  safeParseJson,
  stripReasoningTags,
  deterministicJsonRepair,
  extractBalancedJson,
  closeTruncatedJson,
  extractJsonFromText,
  isolateMessageContent,
};

export const NVIDIA_DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
export const NVIDIA_DEFAULT_MAX_TOKENS = 4096;
export const NVIDIA_REQUEST_TIMEOUT_MS = 240000;
export const NVIDIA_REPAIR_TIMEOUT_MS = 60000;

export function resolveNvidiaMaxTokens(): number {
  if (typeof process !== "undefined") {
    const raw =
      process.env?.NVIDIA_MAX_TOKENS ||
      process.env?.COGNORA_MAX_OUTPUT_TOKENS ||
      process.env?.COGNORA_MAX_TOKENS ||
      process.env?.COGNORA_TEACH_MAX_TOKENS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return NVIDIA_DEFAULT_MAX_TOKENS;
}

export interface NvidiaProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  timeoutMs?: number;
  repairTimeoutMs?: number;
  systemPrompt?: string;
  fetchFn?: typeof fetch;
}

export class NvidiaNemotronProvider implements AIProvider, TeachingProvider {
  readonly id = "nvidia";
  readonly name = "NVIDIA Nemotron";

  private apiKey: string | null;
  private model: string;
  private baseUrl: string;
  private maxTokens: number;
  private initialTimeoutMs: number;
  private repairTimeoutMs: number;
  private systemPrompt: string;
  private fetchFn: typeof fetch;

  constructor(options?: NvidiaProviderOptions) {
    this.apiKey =
      options?.apiKey ??
      (typeof process !== "undefined"
        ? process.env?.NVIDIA_API_KEY ?? null
        : null);
    const rawModel =
      options?.model ??
      (typeof process !== "undefined" && process.env?.NVIDIA_MODEL
        ? process.env.NVIDIA_MODEL
        : NVIDIA_DEFAULT_MODEL);
    this.model =
      rawModel && !rawModel.includes("super-120b")
        ? rawModel
        : NVIDIA_DEFAULT_MODEL;
    this.baseUrl =
      options?.baseUrl ??
      (typeof process !== "undefined" && process.env?.NVIDIA_BASE_URL
        ? process.env.NVIDIA_BASE_URL
        : NVIDIA_DEFAULT_BASE_URL);
    this.maxTokens = options?.maxTokens ?? resolveNvidiaMaxTokens();
    this.initialTimeoutMs =
      options?.timeoutMs ??
      (typeof process !== "undefined" && process.env?.NVIDIA_REQUEST_TIMEOUT_MS
        ? parseInt(process.env.NVIDIA_REQUEST_TIMEOUT_MS, 10)
        : NVIDIA_REQUEST_TIMEOUT_MS);
    this.repairTimeoutMs = options?.repairTimeoutMs ?? NVIDIA_REPAIR_TIMEOUT_MS;
    this.systemPrompt = options?.systemPrompt ?? NEMOTRON_COMPACT_SYSTEM_PROMPT;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModel(): string {
    return this.model;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  async generateTeachingLesson(
    request: TeachingRequest,
  ): Promise<TeachingResponse> {
    return this.generateTeachingResponse(request);
  }

  async generateTeachingResponse(
    request: TeachingRequest,
  ): Promise<TeachingResponse> {
    const T0 = Date.now();
    console.info(`[COGNORA AI] request started`);

    if (!this.isConfigured()) {
      throw new ProviderAuthenticationError(
        "NVIDIA API key is not configured. Set NVIDIA_API_KEY in the server environment.",
        this.name,
      );
    }

    const formattedPrompt = formatTeachingUserPrompt(request);

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: this.systemPrompt }];

    if (
      request.context?.conversationHistory &&
      Array.isArray(request.context.conversationHistory)
    ) {
      for (const msg of request.context.conversationHistory.slice(-4)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    messages.push({ role: "user", content: formattedPrompt });

    const reqId = request.requestId || "unknown";

    // 1. Initial Attempt
    const tBeforeFetch = Date.now();
    const rawContent = await this.executeCompletionCall(
      messages,
      this.initialTimeoutMs,
      reqId,
    );
    const providerResponseMs = Date.now() - tBeforeFetch;

    // 2. Structured JSON Parsing
    const tBeforeParse = Date.now();
    const parsedData = extractJsonFromText(rawContent);
    const parsingMs = Date.now() - tBeforeParse;

    if (!parsedData) {
      console.error(
        `[${this.name}] Raw completion could not be parsed as structured JSON.`,
      );
      throw new ProviderSchemaError(
        `${this.name} completion could not be parsed as structured JSON.`,
        [
          "Invalid JSON format: model output could not be parsed as structured JSON",
        ],
        this.name,
      );
    }

    console.info(
      `[COGNORA][AI][NVIDIA][EXTRACTED] requestId=${reqId} isObject=${Boolean(
        parsedData && typeof parsedData === "object",
      )} keys=${Object.keys((parsedData as object) || {}).join(",")}`,
    );

    // Clamp explanation_steps to safety limit of 10 if model produced excess
    if (
      parsedData &&
      typeof parsedData === "object" &&
      Array.isArray((parsedData as any).explanation_steps) &&
      (parsedData as any).explanation_steps.length > 10
    ) {
      (parsedData as any).explanation_steps = (
        parsedData as any
      ).explanation_steps.slice(0, 10);
    }

    // 3. Deterministic Normalization
    const tBeforeNorm = Date.now();
    const normalizedData = normalizeTeachingResponse(parsedData) as Record<
      string,
      unknown
    >;
    const normalizationMs = Date.now() - tBeforeNorm;

    // 4. Schema Validation
    const tBeforeVal = Date.now();
    const validation = validateTeachingResponse(normalizedData);
    const validationMs = Date.now() - tBeforeVal;

    // 5. If valid DSL - return immediately (guarantees exactly 1 request)
    if (validation.valid && validation.data) {
      const totalMs = Date.now() - T0;
      const vData = validation.data as unknown as Record<string, unknown>;
      const vLesson = vData.visualLesson as Record<string, unknown> | undefined;
      const transformationCount = Array.isArray(vLesson?.transformations)
        ? (vLesson.transformations as unknown[]).length
        : validation.data.steps?.length ?? 0;
      console.info(
        `[COGNORA][AI][NVIDIA][SUCCESS] requestId=${reqId} transformations=${transformationCount} durationMs=${totalMs}`,
      );
      console.info(
        `[COGNORA][PERF] requestId=${reqId} provider=nvidia providerMs=${providerResponseMs}ms parseMs=${parsingMs}ms normMs=${normalizationMs}ms valMs=${validationMs}ms totalMs=${totalMs}ms`,
      );

      return this.finalizeResponse(validation.data, request);
    }

    // 6. Schema Failure: Fail fast without second request (no hidden retries)
    console.error(
      `[${this.name}] Response failed validation (${validation.errors.join(
        "; ",
      )}). Failing fast without hidden retries.`,
    );
    throw new ProviderSchemaError(
      `${this.name} generated invalid Visual DSL: ${validation.errors.join(
        "; ",
      )}`,
      validation.errors,
      this.name,
    );
  }

  /**
   * Executes a single chat completion HTTP call to NVIDIA NIM with strict timeout.
   */
  private async executeCompletionCall(
    messages: Array<{ role: string; content: string }>,
    timeoutMs: number,
    requestId: string = "unknown",
  ): Promise<string> {
    const tStart = Date.now();
    console.info(
      `[COGNORA][AI][NVIDIA][START] requestId=${requestId} model=${this.model} maxTokens=${this.maxTokens}`,
    );
    console.info(`Provider: NVIDIA`);
    console.info(`Model: ${this.model}`);
    console.info(`Generation ID: ${requestId}`);
    console.info(`Request started`);

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const bodyObj: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: this.maxTokens,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let rawResponse: Response;
    try {
      rawResponse = await this.fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(bodyObj),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.error(
          `[COGNORA][AI][NVIDIA][ERROR] requestId=${requestId} error="Request timed out after ${timeoutMs}ms"`,
        );
        throw new ProviderTimeoutError(timeoutMs, this.name);
      }
      const errMessage = err instanceof Error ? err.message : "Network error";
      console.error(
        `[COGNORA][AI][NVIDIA][ERROR] requestId=${requestId} error="Network error: ${errMessage}"`,
      );
      throw new ProviderNetworkError(
        `Failed to connect to NVIDIA NIM: ${errMessage}`,
        this.name,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Date.now() - tStart;
    console.info(
      `[COGNORA][AI][NVIDIA][RESPONSE] requestId=${requestId} status=${rawResponse.status} durationMs=${durationMs}`,
    );

    if (!rawResponse.ok) {
      let errorMessage = `NVIDIA API returned HTTP ${rawResponse.status}`;
      try {
        const errorJson = (await rawResponse.json()) as {
          error?: { message?: string; code?: unknown };
        };
        if (errorJson?.error?.message) {
          errorMessage = `NVIDIA error: ${errorJson.error.message}`;
        }
      } catch {
        // Fallback to HTTP status
      }

      const sanitized = errorMessage.replace(
        /Bearer\s+[A-Za-z0-9._-]+/gi,
        "Bearer [REDACTED]",
      );

      console.error(
        `[COGNORA][AI][NVIDIA][ERROR] requestId=${requestId} error="${sanitized}"`,
      );

      if (rawResponse.status === 401 || rawResponse.status === 403) {
        throw new ProviderAuthenticationError(sanitized, this.name);
      }

      if (rawResponse.status === 408 || rawResponse.status === 504) {
        throw new ProviderTimeoutError(this.initialTimeoutMs, this.name);
      }

      const lowerMsg = sanitized.toLowerCase();
      const isCreditCapacity =
        rawResponse.status === 402 ||
        lowerMsg.includes("requires more credits") ||
        lowerMsg.includes("fewer max_tokens") ||
        lowerMsg.includes("can only afford") ||
        lowerMsg.includes("quota exceeded");

      if (isCreditCapacity) {
        const requestedMatch = sanitized.match(/requested up to (\d+) tokens/i);
        const availableMatch = sanitized.match(/can only afford (\d+)/i);
        const requestedTokens = requestedMatch
          ? parseInt(requestedMatch[1], 10)
          : this.maxTokens;
        const availableTokens = availableMatch
          ? parseInt(availableMatch[1], 10)
          : undefined;

        throw new ProviderCreditCapacityError(
          sanitized,
          {
            requestedTokens,
            availableTokens,
            limitSource: "nvidia_credits",
          },
          this.name,
        );
      }

      if (rawResponse.status === 429) {
        throw new ProviderRateLimitError(sanitized, this.name);
      }

      throw new ProviderError(sanitized, {
        code:
          rawResponse.status >= 500 ? "SERVICE_UNAVAILABLE" : "UNKNOWN_ERROR",
        statusCode: rawResponse.status,
        retryable: rawResponse.status >= 500,
        providerId: this.name,
      });
    }

    let completionData: unknown;
    try {
      completionData = await rawResponse.json();
    } catch {
      throw new ProviderSchemaError(
        "NVIDIA NIM returned invalid JSON payload.",
        ["Invalid JSON payload from provider"],
        this.name,
      );
    }

    const typedCompletion = completionData as {
      choices?: Array<{
        message?: {
          content?: string | null;
          reasoning?: string | null;
          reasoning_content?: string | null;
        };
      }>;
    };

    const msg = typedCompletion?.choices?.[0]?.message;
    const content = isolateMessageContent(msg);

    if (!content) {
      throw new ProviderSchemaError(
        "NVIDIA NIM returned empty completion content.",
        ["Empty completion content in message.content"],
        this.name,
      );
    }

    return content;
  }

  private finalizeResponse(
    validatedData: TeachingResponse,
    request: TeachingRequest,
  ): TeachingResponse {
    let finalized = { ...validatedData };
    const intent = request.context?.intent as string | undefined;
    const existingIds = (request.context?.existingAIElements as string[]) ?? [];

    if (intent === "coding_problem") {
      finalized = enrichCodingResponse(finalized);
    }

    if (
      finalized.visual_actions &&
      Array.isArray(finalized.visual_actions) &&
      finalized.visual_actions.length > 0
    ) {
      const sorted = repairOrReorderActions(
        finalized.visual_actions,
        existingIds,
      );
      finalized = {
        ...finalized,
        visual_actions: sorted,
      };
    }

    return finalized;
  }
}
