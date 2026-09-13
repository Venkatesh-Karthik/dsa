/**
 * OpenRouter Teaching Provider
 *
 * Implements the TeachingProvider interface using OpenRouter's
 * OpenAI-compatible chat completions API (https://openrouter.ai/api/v1).
 *
 * Primary Model: z-ai/glm-5.3-flash
 *
 * All API keys and secrets remain strictly server-side.
 *
 * Performance Architecture:
 * - Hard timeout: 35s for initial attempt, 20s for repair attempt.
 * - Hard retry limit: At most 1 initial + at most 1 repair = maximum 2 provider calls total.
 * - Fail-fast on non-recoverable errors (timeout, 401 auth, 429 rate limit, network).
 * - Deterministic normalization before validation (infrastructure IDs are never repaired by AI).
 * - Multi-field candidate extraction (content, reasoning, reasoning_content).
 * - Precision timing logs matching the Cognora AI specification.
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
  SYSTEM_PROMPT,
  formatTeachingUserPrompt,
  formatCorrectionPrompt,
  formatExpansionPrompt,
} from "./prompts";
import { validateLessonQuality } from "./lesson-validator";
import { enrichCodingResponse } from "./coding-solver";

import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export { SYSTEM_PROMPT };

export const AI_REQUEST_TIMEOUT_MS = 35000;
export const AI_REPAIR_TIMEOUT_MS = 20000;
export const DEFAULT_MAX_TOKENS = 3500;

export function resolveMaxTokens(): number {
  if (typeof process !== "undefined") {
    const raw =
      process.env?.COGNORA_TEACH_MAX_TOKENS ||
      process.env?.COGNORA_MAX_TOKENS ||
      process.env?.OPENROUTER_MAX_TOKENS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return DEFAULT_MAX_TOKENS;
}

export interface OpenRouterProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  timeoutMs?: number;
  repairTimeoutMs?: number;
  fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "z-ai/glm-5.3-flash";

/**
 * Sanitizes unescaped control characters (newlines, carriage returns, tabs)
 * that LLMs sometimes emit directly inside JSON string literals.
 */
export function sanitizeJsonString(str: string): string {
  return str.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    return match
      .replace(/\r\n/g, "\\n")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/\t/g, "\\t");
  });
}

export function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(sanitizeJsonString(raw));
  }
}

export class OpenRouterTeachingProvider implements TeachingProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";

  private apiKey: string | null;
  private model: string;
  private baseUrl: string;
  private maxTokens: number;
  private initialTimeoutMs: number;
  private repairTimeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options?: OpenRouterProviderOptions) {
    this.apiKey =
      options?.apiKey ??
      (typeof process !== "undefined"
        ? process.env?.OPENROUTER_API_KEY ?? null
        : null);
    this.model =
      options?.model ??
      (typeof process !== "undefined" && process.env?.OPENROUTER_MODEL
        ? process.env.OPENROUTER_MODEL
        : DEFAULT_MODEL);
    this.baseUrl =
      options?.baseUrl ??
      (typeof process !== "undefined" && process.env?.OPENROUTER_BASE_URL
        ? process.env.OPENROUTER_BASE_URL
        : DEFAULT_BASE_URL);
    this.maxTokens = options?.maxTokens ?? resolveMaxTokens();
    this.initialTimeoutMs = options?.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;
    this.repairTimeoutMs = options?.repairTimeoutMs ?? AI_REPAIR_TIMEOUT_MS;
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
        "OpenRouter API key is not configured. Set OPENROUTER_API_KEY in the server environment.",
        this.name,
      );
    }

    const formattedPrompt = formatTeachingUserPrompt(request);

    // Build bounded conversation messages
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: SYSTEM_PROMPT }];

    if (
      request.context?.conversationHistory &&
      Array.isArray(request.context.conversationHistory)
    ) {
      // Keep recent bounded history (max 6 messages)
      const recent = request.context.conversationHistory.slice(-6);
      for (const msg of recent) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    // Append current user prompt
    messages.push({ role: "user", content: formattedPrompt });

    const existingIds = request.context?.existingAIElements ?? [];
    const reasoningEffort: "low" | "medium" | "high" =
      (request.context?.reasoning_effort as "low" | "medium" | "high") ??
      (request.context?.intent === "coding_problem" ? "high" : "low");

    // ==========================================
    // ATTEMPT 1: Initial AI Generation
    // ==========================================
    const T_call_start = Date.now();
    const initialRawContent = await this.executeCompletionCall(
      messages,
      this.initialTimeoutMs,
      reasoningEffort,
    );
    const T_provider_done = Date.now();
    console.info(
      `[COGNORA AI] provider response: ${T_provider_done - T_call_start}ms`,
    );

    let initialParsed: unknown;
    let initialParseFailed = false;
    let parseErrorMessage = "";

    try {
      initialParsed = safeParseJson(initialRawContent);
    } catch (parseErr: unknown) {
      initialParseFailed = true;
      parseErrorMessage =
        parseErr instanceof Error ? parseErr.message : "JSON parse error";
    }
    const T_parse_done = Date.now();
    console.info(`[COGNORA AI] parsing: ${T_parse_done - T_provider_done}ms`);

    // Deterministic Normalization Layer BEFORE validation
    let initialNormalized = initialParsed;
    if (
      !initialParseFailed &&
      initialParsed &&
      typeof initialParsed === "object"
    ) {
      initialNormalized = normalizeTeachingResponse(initialParsed);
    }
    const T_norm_done = Date.now();
    console.info(`[COGNORA AI] normalization: ${T_norm_done - T_parse_done}ms`);

    const initialValidation = !initialParseFailed
      ? validateTeachingResponse(initialNormalized, {
          existingIds,
          validateReferences: false,
        })
      : {
          valid: false,
          errors: [
            `OpenRouter AI output could not be parsed as JSON: ${parseErrorMessage}`,
            initialRawContent.slice(0, 100),
          ],
          data: undefined,
        };

    const T_val_done = Date.now();
    console.info(`[COGNORA AI] validation: ${T_val_done - T_norm_done}ms`);

    // Case 1A: Initial response is valid DSL
    if (initialValidation.valid && initialValidation.data) {
      console.info(`[COGNORA AI] total: ${Date.now() - T0}ms`);
      return this.finalizeResponse(
        initialValidation.data,
        existingIds,
        request.context?.intent as string | undefined,
      );
    }

    // Case 1B: Initial response failed DSL schema validation or JSON parsing
    // Trigger at most ONE correction repair call
    // eslint-disable-next-line no-console
    console.warn(
      "[OpenRouterTeachingProvider] Initial response failed validation. Attempting single repair call...",
      initialValidation.errors,
    );

    // ==========================================
    // ATTEMPT 2 (MAX 2): Single Schema Correction
    // ==========================================
    const correctionPrompt = formatCorrectionPrompt(
      initialRawContent,
      initialValidation.errors,
    );

    const correctionMessages = [
      ...messages,
      { role: "assistant" as const, content: initialRawContent },
      { role: "user" as const, content: correctionPrompt },
    ];

    let repairRawContent: string;
    try {
      repairRawContent = await this.executeCompletionCall(
        correctionMessages,
        this.repairTimeoutMs,
        reasoningEffort,
      );
    } catch (repairErr: unknown) {
      if (repairErr instanceof ProviderError) {
        throw repairErr;
      }
      throw new ProviderSchemaError(
        `OpenRouter AI generated invalid Visual DSL: ${initialValidation.errors.join(
          "; ",
        )}`,
        initialValidation.errors,
        this.name,
      );
    }

    let repairParsed: unknown;
    try {
      repairParsed = safeParseJson(repairRawContent);
    } catch {
      throw new ProviderSchemaError(
        `OpenRouter AI generated invalid Visual DSL: ${initialValidation.errors.join(
          "; ",
        )}`,
        initialValidation.errors,
        this.name,
      );
    }

    const repairNormalized = normalizeTeachingResponse(repairParsed);
    const repairValidation = validateTeachingResponse(repairNormalized, {
      existingIds,
      validateReferences: false,
    });

    if (repairValidation.valid && repairValidation.data) {
      console.info(`[COGNORA AI] total: ${Date.now() - T0}ms`);
      return this.finalizeResponse(
        repairValidation.data,
        existingIds,
        request.context?.intent as string | undefined,
      );
    }

    // STRICT: No 3rd attempt. Fail fast with classified ProviderSchemaError.
    throw new ProviderSchemaError(
      `OpenRouter AI generated invalid Visual DSL: ${repairValidation.errors.join(
        "; ",
      )}`,
      repairValidation.errors,
      this.name,
    );
  }

  /**
   * Executes a single chat completion HTTP call with strict timeout
   * and immediate error classification (no loops or retries).
   */
  private async executeCompletionCall(
    messages: Array<{ role: string; content: string }>,
    timeoutMs: number,
    reasoningEffort?: "low" | "medium" | "high",
  ): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const makeBody = (includeReasoning: boolean) => {
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        temperature: 0.1, // Low temperature for high speed & deterministic schema compliance
        max_tokens: this.maxTokens, // Configurable token budget
      };
      if (includeReasoning && reasoningEffort) {
        body.reasoning = { effort: reasoningEffort };
      }
      return body;
    };

    const sendRequest = async (bodyObj: Record<string, unknown>) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await this.fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": "https://cognora.app",
            "X-Title": "Cognora",
          },
          body: JSON.stringify(bodyObj),
          signal: controller.signal,
        });
        return res;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new ProviderTimeoutError(timeoutMs, this.name);
        }
        const errMessage = err instanceof Error ? err.message : "Network error";
        throw new ProviderNetworkError(
          `Failed to connect to OpenRouter: ${errMessage}`,
          this.name,
        );
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let rawResponse = await sendRequest(makeBody(Boolean(reasoningEffort)));

    // Fallback: If 400 bad request and reasoning was passed, retry once without reasoning parameter
    if (rawResponse.status === 400 && reasoningEffort) {
      try {
        const cloned = rawResponse.clone();
        const errJson = (await cloned.json()) as {
          error?: { message?: string };
        };
        const errMsg = errJson?.error?.message || "";
        if (
          errMsg.toLowerCase().includes("reasoning") ||
          errMsg.toLowerCase().includes("extra fields")
        ) {
          rawResponse = await sendRequest(makeBody(false));
        }
      } catch {
        // Continue with original response parsing
      }
    }

    if (!rawResponse.ok) {
      let errorMessage = `OpenRouter returned HTTP ${rawResponse.status}`;
      try {
        const errorJson = (await rawResponse.json()) as {
          error?: { message?: string };
        };
        if (errorJson?.error?.message) {
          errorMessage = `OpenRouter error: ${errorJson.error.message}`;
        }
      } catch {
        // Fallback to HTTP status
      }

      // Sanitize: ensure no accidental bearer tokens are in the message
      const sanitized = errorMessage.replace(
        /Bearer\s+[A-Za-z0-9._-]+/gi,
        "Bearer [REDACTED]",
      );

      if (rawResponse.status === 401 || rawResponse.status === 403) {
        throw new ProviderAuthenticationError(sanitized, this.name);
      }

      // Credit capacity check: HTTP 402 or message indicating insufficient credits / max_tokens
      const lowerMsg = sanitized.toLowerCase();
      const isCreditCapacity =
        rawResponse.status === 402 ||
        lowerMsg.includes("requires more credits") ||
        lowerMsg.includes("fewer max_tokens") ||
        lowerMsg.includes("can only afford");

      if (isCreditCapacity) {
        const requestedMatch = sanitized.match(/requested up to (\d+) tokens/i);
        const availableMatch = sanitized.match(/can only afford (\d+)/i);
        const requestedTokens = requestedMatch
          ? parseInt(requestedMatch[1], 10)
          : this.maxTokens;
        const availableTokens = availableMatch
          ? parseInt(availableMatch[1], 10)
          : undefined;

        // Auto-recovery: If OpenRouter told us how many tokens we can afford, retry immediately with that limit!
        if (
          availableTokens &&
          availableTokens >= 400 &&
          this.maxTokens > availableTokens
        ) {
          const affordableTokens = Math.max(400, availableTokens - 20);
          console.warn(
            `[COGNORA][OPENROUTER] Credit capacity exceeded (${requestedTokens} requested, can afford ${availableTokens}). Auto-clamping max_tokens to ${affordableTokens} and retrying immediately...`,
          );
          this.maxTokens = affordableTokens;
          const retryBody = makeBody(false);
          retryBody.max_tokens = affordableTokens;
          const retryRes = await sendRequest(retryBody);
          if (retryRes.ok) {
            rawResponse = retryRes;
          } else {
            throw new ProviderCreditCapacityError(
              sanitized,
              {
                requestedTokens,
                availableTokens,
                limitSource: "openrouter_credits",
              },
              this.name,
            );
          }
        }

        throw new ProviderCreditCapacityError(
          sanitized,
          {
            requestedTokens,
            availableTokens,
            limitSource: "openrouter_credits",
          },
          this.name,
        );
      }

      if (rawResponse.status === 429) {
        throw new ProviderRateLimitError(sanitized, this.name);
      }

      throw new ProviderError(sanitized, {
        code: "UNKNOWN_ERROR",
        statusCode: rawResponse.status,
        retryable: false,
        providerId: this.name,
      });
    }

    let completionData: unknown;
    try {
      completionData = await rawResponse.json();
    } catch {
      throw new ProviderSchemaError(
        "OpenRouter returned invalid JSON payload.",
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
    const candidates = [
      msg?.content,
      msg?.reasoning,
      msg?.reasoning_content,
    ].filter((c): c is string => typeof c === "string" && c.trim().length > 0);

    if (candidates.length === 0) {
      throw new ProviderSchemaError(
        "OpenRouter returned empty completion content.",
        ["Empty completion content across message fields"],
        this.name,
      );
    }

    // Try extracting JSON from candidates (prefer content, fallback to reasoning)
    let extractedContent: string | null = null;
    for (const raw of candidates) {
      const trimmed = raw.trim();
      // 1. Direct JSON check
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          safeParseJson(trimmed);
          extractedContent = trimmed;
          break;
        } catch {
          // Continue to pattern extraction
        }
      }

      // 2. Markdown code block extraction
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const blockContent = jsonMatch[1].trim();
          safeParseJson(blockContent);
          extractedContent = blockContent;
          break;
        } catch {
          // Continue
        }
      }

      // 3. Substring between outermost braces
      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const sliced = trimmed.slice(firstBrace, lastBrace + 1);
        try {
          safeParseJson(sliced);
          extractedContent = sliced;
          break;
        } catch {
          // Continue
        }
      }
    }

    // Fallback if structured extraction didn't produce valid JSON
    const cleanContent = extractedContent ?? candidates[0];

    return cleanContent;
  }

  /**
   * Finalizes validated TeachingResponse by ordering actions and enriching coding solutions.
   */
  private finalizeResponse(
    response: TeachingResponse,
    existingIds: string[],
    intent?: string,
  ): TeachingResponse {
    let finalized = response;

    // Enrich with deterministic coding solver if intent is coding_problem
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

export const OpenRouterProvider = OpenRouterTeachingProvider;
export type OpenRouterProvider = OpenRouterTeachingProvider;

