/**
 * Ollama AI Teaching Provider
 *
 * Implements TeachingProvider for local offline inference using Ollama
 * (e.g. Qwen 3.5:4b / Qwen 3.5:9b).
 *
 * All requests remain strictly on the backend / localhost; zero API keys required.
 */

import {
  validateTeachingResponse,
  repairOrReorderActions,
} from "./dsl-validator";
import {
  SYSTEM_PROMPT,
  formatTeachingUserPrompt,
  formatCorrectionPrompt,
  formatExpansionPrompt,
} from "./prompts";
import { validateLessonQuality } from "./lesson-validator";

import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen3.5:4b";
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Strips markdown code fences or conversational padding to extract pure JSON
 */
export function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();

  // Strip ```json ... ``` or ``` ... ```
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
    cleaned = cleaned.trim();
  }

  // If there is still conversational text before the first { and after the last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

export class OllamaTeachingProvider implements TeachingProvider {
  readonly id = "ollama";
  readonly name = "Ollama (Local)";

  private baseUrl: string;
  private model: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options?: OllamaProviderOptions) {
    this.baseUrl =
      options?.baseUrl ??
      (typeof process !== "undefined" && process.env?.OLLAMA_BASE_URL
        ? process.env.OLLAMA_BASE_URL
        : DEFAULT_BASE_URL);

    this.model =
      options?.model ??
      (typeof process !== "undefined" && process.env?.OLLAMA_MODEL
        ? process.env.OLLAMA_MODEL
        : DEFAULT_MODEL);

    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.baseUrl.trim().length > 0);
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
    const formattedUserPrompt = formatTeachingUserPrompt(request);

    // Initial attempt
    const initialResult = await this.callOllamaChat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formattedUserPrompt },
    ]);

    const validatedResponse = this.parseAndValidate(initialResult);
    if (validatedResponse.success && validatedResponse.data) {
      const quality = validateLessonQuality(
        validatedResponse.data,
        request.prompt,
      );
      if (quality.needsExpansion) {
        // eslint-disable-next-line no-console
        console.warn(
          `[OllamaProvider] Lesson is under-expanded (${quality.stepCount} steps). Triggering generic expansion retry...`,
        );
        try {
          const expansionPrompt = formatExpansionPrompt(
            request.prompt,
            initialResult,
            quality.stepCount,
            quality.targetMinSteps,
          );
          const expandedResult = await this.callOllamaChat([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: formattedUserPrompt },
            { role: "assistant", content: initialResult },
            { role: "user", content: expansionPrompt },
          ]);
          const expandedValidated = this.parseAndValidate(expandedResult);
          if (expandedValidated.success && expandedValidated.data) {
            return this.finalizeResponse(expandedValidated.data);
          }
        } catch {
          // Graceful fallback to initial validated response if expansion call errors
        }
      }
      return this.finalizeResponse(validatedResponse.data);
    }

    // eslint-disable-next-line no-console
    console.warn(
      "[OllamaProvider] Initial response failed Visual DSL validation. Attempting correction retry...",
      validatedResponse.errors,
    );

    // Automatic 1-turn correction retry
    const correctionPrompt = formatCorrectionPrompt(
      initialResult,
      validatedResponse.errors,
    );

    const retryResult = await this.callOllamaChat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formattedUserPrompt },
      { role: "assistant", content: initialResult },
      { role: "user", content: correctionPrompt },
    ]);

    const retryValidated = this.parseAndValidate(retryResult);
    if (retryValidated.success && retryValidated.data) {
      const retryQuality = validateLessonQuality(
        retryValidated.data,
        request.prompt,
      );
      if (retryQuality.needsExpansion) {
        try {
          const expansionPrompt = formatExpansionPrompt(
            request.prompt,
            retryResult,
            retryQuality.stepCount,
            retryQuality.targetMinSteps,
          );
          const expandedResult = await this.callOllamaChat([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: formattedUserPrompt },
            { role: "assistant", content: retryResult },
            { role: "user", content: expansionPrompt },
          ]);
          const expandedValidated = this.parseAndValidate(expandedResult);
          if (expandedValidated.success && expandedValidated.data) {
            return this.finalizeResponse(expandedValidated.data);
          }
        } catch {
          // Graceful fallback
        }
      }
      return this.finalizeResponse(retryValidated.data);
    }

    throw new Error(
      `Ollama (${this.model}) generated invalid Visual DSL: ${retryValidated.errors.join(
        "; ",
      )}`,
    );
  }

  /**
   * Calls Ollama /api/chat with format: "json"
   */
  private async callOllamaChat(
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/api/chat`;

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          format: "json",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // If /api/chat is not found (older Ollama), try fallback to /api/generate
        if (response.status === 404) {
          return await this.callOllamaGenerateFallback(messages);
        }
        const errorText = await response.text();
        throw new Error(
          `Ollama API error (${response.status}): ${errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        message?: { content?: string };
        response?: string;
      };

      const rawContent = data.message?.content ?? data.response ?? "";
      if (!rawContent.trim()) {
        throw new Error("Ollama returned an empty response.");
      }

      return rawContent;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `Ollama request timed out after ${this.timeoutMs / 1000}s. Check if Ollama is running and model '${this.model}' is loaded.`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  /**
   * Fallback for older Ollama versions that only support /api/generate
   */
  private async callOllamaGenerateFallback(
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/api/generate`;
    const combinedPrompt = messages
      .map((m) => `### ${m.role.toUpperCase()}:\n${m.content}`)
      .join("\n\n");

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: combinedPrompt,
          stream: false,
          format: "json",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ollama generate error (${response.status}): ${errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as { response?: string };
      return data.response ?? "";
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  private parseAndValidate(raw: string): {
    success: boolean;
    data?: TeachingResponse;
    errors: string[];
  } {
    const cleaned = cleanJsonOutput(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr: unknown) {
      const errMsg =
        parseErr instanceof Error ? parseErr.message : "JSON parse error";
      return {
        success: false,
        errors: [`Failed to parse JSON: ${errMsg}`, `Raw output: ${raw.slice(0, 300)}`],
      };
    }

    const validation = validateTeachingResponse(parsed);
    if (!validation.valid || !validation.data) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    return {
      success: true,
      data: validation.data,
      errors: [],
    };
  }

  private finalizeResponse(response: TeachingResponse): TeachingResponse {
    // Repair/reorder initial visual actions
    const repairedInitial = repairOrReorderActions(
      response.visual_actions || [],
    );

    // Repair/reorder each step's actions
    const repairedSteps = response.steps?.map((step) => ({
      ...step,
      visual_actions: repairOrReorderActions(step.visual_actions || []),
    }));

    return {
      ...response,
      visual_actions: repairedInitial,
      steps: repairedSteps,
    };
  }
}
