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
  formatCorrectionPrompt,
  formatExpansionPrompt,
} from "./prompts";
import { validateLessonQuality } from "./lesson-validator";
import { enrichCodingResponse } from "./coding-solver";
import type { AIProvider } from "./ai-provider";
import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        throw new Error("Failed to parse JSON even after markdown extraction");
      }
    }
    const matchFallback = text.match(/```\s*([\s\S]*?)\s*```/);
    if (matchFallback) {
      try {
        return JSON.parse(matchFallback[1]);
      } catch (e) {
        throw new Error("Failed to parse JSON from generic markdown block");
      }
    }
    throw new Error("No JSON found in response");
  }
}

export const NVIDIA_DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
export const NVIDIA_DEFAULT_MAX_TOKENS = 1800;
export const NVIDIA_REQUEST_TIMEOUT_MS = 180000;
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

/**
 * Strips private model reasoning tags like <think>...</think> or <thought>...</thought>
 * from LLM completions so internal reasoning tokens are not exposed to the user
 * or confused with JSON payloads.
 */
export function stripReasoningTags(text: string): string {
  if (!text) {
    return "";
  }
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .trim();
}

/**
 * Deterministically repairs common minor JSON malformations from LLMs:
 * 1. Strips accidental markdown fences
 * 2. Removes trailing commas before closing braces/brackets
 * 3. Trims surrounding whitespace
 */
export function deterministicJsonRepair(raw: string): string {
  let cleaned = raw.trim();
  // Strip code fences if wrapping
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  return cleaned;
}

/**
 * Extracts a complete, balanced JSON object ({ ... }) from text.
 * Safely handles string escapes, quotes containing braces, and nested structures.
 */
export function extractBalancedJson(text: string): unknown | null {
  let firstValidFallback: unknown | null = null;

  for (let start = 0; start < text.length; start++) {
    if (text[start] !== "{") {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          depth++;
        } else if (char === "}") {
          depth--;
          if (depth === 0) {
            const candidate = text.slice(start, i + 1).trim();
            const tryParse = (raw: string): unknown | null => {
              try {
                return safeParseJson(raw);
              } catch {
                try {
                  return safeParseJson(deterministicJsonRepair(raw));
                } catch {
                  return null;
                }
              }
            };

            const parsed = tryParse(candidate);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const p = parsed as Record<string, unknown>;
              if (
                p.visualLesson ||
                p.visual_lesson ||
                p.steps ||
                p.visual_actions ||
                p.topic
              ) {
                return parsed;
              }

              const isInnerVisualAction =
                typeof p.type === "string" &&
                (p.type.startsWith("create_") ||
                  p.type === "highlight" ||
                  p.type === "delete" ||
                  p.type === "move" ||
                  p.type === "resize") &&
                p.id;

              if (!isInnerVisualAction && !firstValidFallback) {
                firstValidFallback = parsed;
              }
            }
          }
        }
      }
    }
  }

  return firstValidFallback;
}

/**
 * Recovers valid JSON from model responses that were truncated by token limits.
 * Closes unescaped quotes, arrays, and objects in reverse order.
 */
export function closeTruncatedJson(raw: string): string {
  let str = raw.trim();
  if (!str.startsWith("{")) {
    const firstBrace = str.indexOf("{");
    if (firstBrace === -1) return str;
    str = str.slice(firstBrace);
  }

  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
  }

  if (inString) {
    str += '"';
  }

  str = str.replace(/,\s*$/, "");
  str = str.replace(/:\s*$/, ': ""');
  str = str.replace(/"[^"]*"\s*:\s*$/, "");
  str = str.replace(/,\s*$/, "");

  const finalStack: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{" || char === "[") {
        finalStack.push(char === "{" ? "}" : "]");
      } else if (char === "}" || char === "]") {
        if (finalStack.length > 0 && finalStack[finalStack.length - 1] === char) {
          finalStack.pop();
        }
      }
    }
  }

  while (finalStack.length > 0) {
    str += finalStack.pop();
  }

  return str;
}

/**
 * Robustly extracts valid JSON from model completion text.
 * Handles:
 * 1. Pure JSON
 * 2. Markdown code fences (```json ... ```)
 * 3. Truncated JSON closing repair
 * 4. Balanced-brace JSON embedded in text or surrounded by commentary
 * 5. Minor local repairs (trailing commas, whitespace)
 */
export function extractJsonFromText(rawText: string): unknown | null {
  const cleaned = stripReasoningTags(rawText).trim();
  if (!cleaned) {
    return null;
  }

  // 1. Direct JSON check
  try {
    const parsed = safeParseJson(cleaned);
    if (parsed) return parsed;
  } catch {
    // Continue
  }

  // 2. Direct parse after deterministic repair
  try {
    const repaired = deterministicJsonRepair(cleaned);
    const parsed = safeParseJson(repaired);
    if (parsed) return parsed;
  } catch {
    // Continue
  }

  // 3. Markdown code block extraction
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    const fenceContent = jsonMatch[1].trim();
    try {
      return safeParseJson(fenceContent);
    } catch {
      try {
        return safeParseJson(deterministicJsonRepair(fenceContent));
      } catch {
        // Continue to balanced extraction
      }
    }
  }

  // 4. Attempt truncated JSON closing repair for outer lesson object
  if (
    cleaned.includes("visualLesson") ||
    cleaned.includes("topic") ||
    cleaned.includes("initialScene")
  ) {
    try {
      const closed = closeTruncatedJson(cleaned);
      const parsed = safeParseJson(deterministicJsonRepair(closed));
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  // 5. Robust balanced brace extraction
  const balancedResult = extractBalancedJson(cleaned);
  if (balancedResult !== null) {
    return balancedResult;
  }

  return null;
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
    this.model =
      options?.model ??
      (typeof process !== "undefined" && process.env?.NVIDIA_MODEL
        ? process.env.NVIDIA_MODEL
        : NVIDIA_DEFAULT_MODEL);
    this.baseUrl =
      options?.baseUrl ??
      (typeof process !== "undefined" && process.env?.NVIDIA_BASE_URL
        ? process.env.NVIDIA_BASE_URL
        : NVIDIA_DEFAULT_BASE_URL);
    this.maxTokens = options?.maxTokens ?? resolveNvidiaMaxTokens();
    this.initialTimeoutMs = options?.timeoutMs ?? NVIDIA_REQUEST_TIMEOUT_MS;
    this.repairTimeoutMs = options?.repairTimeoutMs ?? NVIDIA_REPAIR_TIMEOUT_MS;
    this.systemPrompt =
      options?.systemPrompt ?? NEMOTRON_COMPACT_SYSTEM_PROMPT;
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
      console.warn(
        `[${this.name}] Raw completion could not be parsed as JSON. Attempting repair turn...`,
      );
      return this.attemptRepairTurn(
        messages,
        rawContent,
        ["Invalid JSON format: model output could not be parsed as structured JSON"],
        request,
      );
    }

    console.info(
      `[COGNORA][AI][NVIDIA][EXTRACTED] requestId=${reqId} isObject=${Boolean(parsedData && typeof parsedData === "object")} keys=${Object.keys((parsedData as object) || {}).join(",")}`,
    );

    // 3. Deterministic Normalization
    const tBeforeNorm = Date.now();
    const normalizedData = normalizeTeachingResponse(parsedData);
    const normalizationMs = Date.now() - tBeforeNorm;

    // 4. Schema Validation
    const tBeforeVal = Date.now();
    const validation = validateTeachingResponse(normalizedData);
    const validationMs = Date.now() - tBeforeVal;

    // 5. If valid DSL - return immediately (guarantees exactly 1 request on success)
    if (validation.valid && validation.data) {
      const totalMs = Date.now() - T0;
      const vData = validation.data as unknown as Record<string, unknown>;
      const vLesson = vData.visualLesson as Record<string, unknown> | undefined;
      const transformationCount = Array.isArray(vLesson?.transformations)
        ? (vLesson.transformations as unknown[]).length
        : (validation.data.steps?.length ?? 0);
      console.info(
        `[COGNORA][AI][NVIDIA][SUCCESS] requestId=${reqId} transformations=${transformationCount} durationMs=${totalMs}`,
      );
      console.info(
        `[COGNORA][PERF] requestId=${reqId} provider=nvidia providerMs=${providerResponseMs}ms parseMs=${parsingMs}ms normMs=${normalizationMs}ms valMs=${validationMs}ms totalMs=${totalMs}ms`,
      );

      return this.finalizeResponse(validation.data, request);
    }

    // 6. Schema Correction Attempt (Max 1 Turn)
    console.warn(
      `[${this.name}] Initial response failed validation (${validation.errors.join("; ")}). Attempting repair turn...`,
    );

    return this.attemptRepairTurn(
      messages,
      rawContent,
      validation.errors,
      request,
    );
  }

  /**
   * Attempts exactly one repair turn if the initial response was invalid.
   */
  private async attemptRepairTurn(
    baseMessages: Array<{ role: string; content: string }>,
    failedRawContent: string,
    errors: readonly string[],
    originalRequest: TeachingRequest,
  ): Promise<TeachingResponse> {
    const repairReqId = `${originalRequest.requestId || "req"}-repair`;
    const repairMessages = [
      ...baseMessages,
      { role: "assistant", content: failedRawContent },
      {
        role: "user",
        content: formatCorrectionPrompt(failedRawContent, errors),
      },
    ];

    const repairRaw = await this.executeCompletionCall(
      repairMessages,
      this.repairTimeoutMs,
      repairReqId,
    );

    const repairParsed = extractJsonFromText(repairRaw);
    if (!repairParsed) {
      console.error(
        `[COGNORA][AI][NVIDIA][ERROR] requestId=${repairReqId} error="Repair output could not be parsed as JSON"`,
      );
      throw new ProviderSchemaError(
        `${this.name} repair output could not be parsed as JSON.`,
        ["Invalid JSON payload on repair attempt"],
        this.name,
      );
    }

    const repairNormalized = normalizeTeachingResponse(repairParsed);
    const repairValidation = validateTeachingResponse(repairNormalized);

    if (repairValidation.valid && repairValidation.data) {
      console.info(`[${this.name}] Repair turn succeeded cleanly.`);
      const totalSteps = repairValidation.data.steps?.length ?? 0;
      console.info(
        `[COGNORA][AI][NVIDIA][SUCCESS] requestId=${originalRequest.requestId || "unknown"} steps=${totalSteps} durationMs=${Date.now()}`,
      );
      return this.finalizeResponse(repairValidation.data, originalRequest);
    }

    console.error(
      `[COGNORA][AI][NVIDIA][ERROR] requestId=${repairReqId} error="Repair generated invalid Visual DSL: ${repairValidation.errors.join("; ")}"`,
    );
    // STRICT: No 3rd attempt. Fail fast with classified ProviderSchemaError.
    throw new ProviderSchemaError(
      `${this.name} generated invalid Visual DSL: ${repairValidation.errors.join("; ")}`,
      repairValidation.errors,
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

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const bodyObj: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: this.maxTokens,
    };

    let rawResponse: Response | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

      if (rawResponse.status === 503 || rawResponse.status === 429) {
        if (attempt < maxRetries) {
          console.warn(
            `[COGNORA][AI][NVIDIA] Transient HTTP ${rawResponse.status} on requestId=${requestId} (attempt ${attempt}/${maxRetries}). Retrying in ${attempt * 2000}ms...`,
          );
          const delayMs = process.env.NODE_ENV === "test" ? 10 : attempt * 2000;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
      }

      break;
    }

    if (!rawResponse) {
      throw new ProviderNetworkError("No response received from NVIDIA", this.name);
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
        code: rawResponse.status >= 500 ? "SERVICE_UNAVAILABLE" : "UNKNOWN_ERROR",
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
    const candidates = [
      msg?.content,
      msg?.reasoning_content,
      msg?.reasoning,
    ].filter((c): c is string => typeof c === "string" && c.trim().length > 0);

    if (candidates.length === 0) {
      throw new ProviderSchemaError(
        "NVIDIA NIM returned empty completion content.",
        ["Empty completion content across message fields"],
        this.name,
      );
    }

    // Return the primary content string
    return candidates[0];
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
