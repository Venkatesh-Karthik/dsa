/**
 * Featherless AI Teaching Provider
 *
 * Implements the TeachingProvider interface using Featherless.ai's
 * OpenAI-compatible chat completions API (https://api.featherless.ai/v1).
 *
 * All API keys and secrets remain strictly server-side.
 */

import {
  validateTeachingResponse,
  repairOrReorderActions,
} from "./dsl-validator";

import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export interface FeatherlessProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.featherless.ai/v1";
const DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";
const DEFAULT_TIMEOUT_MS = 30000;

import {
  SYSTEM_PROMPT,
  formatTeachingUserPrompt,
  formatExpansionPrompt,
} from "./prompts";
import { validateLessonQuality } from "./lesson-validator";

export { SYSTEM_PROMPT };

export class FeatherlessTeachingProvider implements TeachingProvider {
  readonly id = "featherless";
  readonly name = "Featherless AI";

  private apiKey: string | null;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options?: FeatherlessProviderOptions) {
    this.apiKey =
      options?.apiKey ??
      (typeof process !== "undefined"
        ? process.env?.FEATHERLESS_API_KEY ?? null
        : null);
    this.model =
      options?.model ??
      (typeof process !== "undefined" && process.env?.FEATHERLESS_MODEL
        ? process.env.FEATHERLESS_MODEL
        : DEFAULT_MODEL);
    this.baseUrl =
      options?.baseUrl ??
      (typeof process !== "undefined" && process.env?.FEATHERLESS_BASE_URL
        ? process.env.FEATHERLESS_BASE_URL
        : DEFAULT_BASE_URL);
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModel(): string {
    return this.model;
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
    if (!this.isConfigured()) {
      throw new Error(
        "Featherless AI API key is not configured. Set FEATHERLESS_API_KEY in the server environment.",
      );
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

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

    const MAX_CORRECTION_RETRIES = 2;
    const existingIds = request.context?.existingAIElements ?? [];
    let lastValidationErrors: string[] = [];

    for (let attempt = 0; attempt <= MAX_CORRECTION_RETRIES; attempt++) {
      const requestBody = {
        model: this.model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 3500,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      let rawResponse: Response;
      try {
        rawResponse = await this.fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            `Featherless AI request timed out after ${this.timeoutMs / 1000}s.`,
          );
        }
        const errMessage = err instanceof Error ? err.message : "Network error";
        throw new Error(`Failed to connect to Featherless AI: ${errMessage}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!rawResponse.ok) {
        let errorMessage = `Featherless AI returned HTTP ${rawResponse.status}`;
        try {
          const errorJson = (await rawResponse.json()) as {
            error?: { message?: string };
          };
          if (errorJson?.error?.message) {
            errorMessage = `Featherless AI error: ${errorJson.error.message}`;
          }
        } catch {
          // Fallback to HTTP status
        }
        // Sanitize: ensure no accidental bearer tokens are in the message
        const sanitized = errorMessage.replace(
          /Bearer\s+[A-Za-z0-9._-]+/gi,
          "Bearer [REDACTED]",
        );
        throw new Error(sanitized);
      }

      let completionData: unknown;
      try {
        completionData = await rawResponse.json();
      } catch {
        throw new Error("Featherless AI returned invalid JSON payload.");
      }

      const typedCompletion = completionData as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const rawContent = typedCompletion?.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== "string") {
        throw new Error("Featherless AI returned empty completion content.");
      }

      // Strip markdown code fences if model returned ```json ... ```
      const cleanContent = rawContent
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(cleanContent);
      } catch {
        throw new Error(
          `Featherless AI output could not be parsed as JSON: ${cleanContent.slice(
            0,
            100,
          )}`,
        );
      }

      // Validate payload against Visual DSL contract (automatically normalizes enums & repairs)
      const validation = validateTeachingResponse(parsedPayload, {
        existingIds,
        validateReferences: false,
      });

      if (validation.valid && validation.data) {
        // Check lesson quality (generic multi-step progression)
        const quality = validateLessonQuality(validation.data, request.prompt);
        if (quality.needsExpansion && attempt < MAX_CORRECTION_RETRIES) {
          // eslint-disable-next-line no-console
          console.warn(
            `[FeatherlessProvider] Lesson is under-expanded (${quality.stepCount} steps). Triggering generic expansion retry...`,
          );
          messages.push({
            role: "assistant",
            content: cleanContent,
          });
          messages.push({
            role: "user",
            content: formatExpansionPrompt(
              request.prompt,
              cleanContent,
              quality.stepCount,
              quality.targetMinSteps,
            ),
          });
          continue;
        }

        // Repair aliases and sort actions deterministically by dependency
        const repairedActions = repairOrReorderActions(
          validation.data.visual_actions,
          existingIds,
        );
        validation.data.visual_actions = repairedActions;

        if (Array.isArray(validation.data.steps)) {
          validation.data.steps.forEach((step) => {
            if (Array.isArray(step.visual_actions)) {
              step.visual_actions = repairOrReorderActions(
                step.visual_actions,
                existingIds,
              );
            }
          });
        }

        return validation.data;
      }

      // If validation failed, record errors
      lastValidationErrors = validation.errors;

      // If attempts remain, feed correction back to Featherless AI
      if (attempt < MAX_CORRECTION_RETRIES) {
        messages.push({
          role: "assistant",
          content: cleanContent,
        });
        messages.push({
          role: "user",
          content: `Your previous response generated invalid Visual DSL with the following errors:\n${validation.errors
            .map((e) => `- ${e}`)
            .join(
              "\n",
            )}\n\nPlease fix these errors and return a corrected JSON object conforming strictly to the Visual DSL schema. Ensure style.color uses only allowed SemanticColors ('primary', 'neutral', 'accent', 'danger', 'success', 'warning', 'info', 'secondary', 'default') and NOT raw color strings like 'blue' or 'gray'. Return ONLY the valid JSON object.`,
        });
      }
    }

    throw new Error(
      `Featherless AI generated invalid Visual DSL: ${lastValidationErrors.join(
        "; ",
      )}`,
    );
  }
}
