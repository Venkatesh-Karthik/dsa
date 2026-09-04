/**
 * AI Teaching HTTP Request Handler
 *
 * Dispatches and validates incoming POST /api/ai/teach requests.
 * Compatible with standard Node http.Server, Connect middlewares, and Vite dev server.
 */

import { MockTeachingProvider } from "./mock-provider";

import {
  validateTeachingRequest,
  validateTeachingResponse,
} from "./dsl-validator";

import { FeatherlessTeachingProvider } from "./featherless-provider";
import { OllamaTeachingProvider } from "./ollama-provider";

import type { IncomingMessage, ServerResponse } from "http";
import type { TeachingProvider } from "./teaching-provider";
import type { TeachingProviderInfo } from "../teaching-contract";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB limit

export interface ServerHandlerOptions {
  provider?: TeachingProvider;
}

/**
 * Resolves the active teaching provider:
 * 1. Honors AI_PROVIDER env var ("ollama" | "featherless" | "mock").
 * 2. If unset, uses FeatherlessTeachingProvider if FEATHERLESS_API_KEY is configured.
 * 3. Else if OLLAMA_BASE_URL or OLLAMA_MODEL is configured, uses OllamaTeachingProvider.
 * 4. Otherwise defaults to MockTeachingProvider.
 */
export function resolveDefaultProvider(): TeachingProvider {
  const providerEnv =
    typeof process !== "undefined"
      ? process.env?.AI_PROVIDER?.toLowerCase().trim()
      : undefined;

  if (providerEnv === "ollama") {
    return new OllamaTeachingProvider();
  }
  if (providerEnv === "featherless") {
    return new FeatherlessTeachingProvider();
  }
  if (providerEnv === "mock") {
    return new MockTeachingProvider();
  }

  const featherless = new FeatherlessTeachingProvider();
  if (featherless.isConfigured()) {
    return featherless;
  }

  const hasOllamaConfig =
    typeof process !== "undefined" &&
    Boolean(process.env?.OLLAMA_BASE_URL || process.env?.OLLAMA_MODEL);

  if (hasOllamaConfig) {
    return new OllamaTeachingProvider();
  }

  return new MockTeachingProvider();
}

let configuredDefaultProvider: TeachingProvider | null = null;

export function setDefaultTeachingProvider(
  provider: TeachingProvider | null,
): void {
  configuredDefaultProvider = provider;
}

export function getDefaultTeachingProvider(): TeachingProvider {
  if (configuredDefaultProvider) {
    return configuredDefaultProvider;
  }
  return resolveDefaultProvider();
}

export function getTeachingProviderInfo(
  activeProvider?: TeachingProvider,
): TeachingProviderInfo {
  const provider = activeProvider ?? getDefaultTeachingProvider();
  const model =
    "getModel" in provider &&
    typeof (provider as { getModel?: () => string }).getModel === "function"
      ? (provider as { getModel: () => string }).getModel()
      : undefined;

  return {
    id: provider.id,
    name: provider.name,
    model,
    isConfigured: provider.isConfigured(),
  };
}

/**
 * Reads and parses JSON body from an IncomingMessage stream
 */
function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    let byteCount = 0;

    req.on("data", (chunk: Buffer | string) => {
      byteCount += Buffer.byteLength(chunk);
      if (byteCount > MAX_BODY_BYTES) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw || raw.trim().length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  const json = JSON.stringify(data);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(json);
}

/**
 * Main HTTP request handler for /api/ai/teach
 */
export async function handleTeachingRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options?: ServerHandlerOptions,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, {
      error: "Method Not Allowed. Only POST is supported.",
    });
    return;
  }

  let body: unknown;
  try {
    body = await parseJsonBody(req);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "PAYLOAD_TOO_LARGE") {
      sendJson(res, 413, { error: "Payload Too Large (max 1 MB allowed)." });
      return;
    }
    if (err instanceof Error && err.message === "INVALID_JSON") {
      sendJson(res, 400, { error: "Malformed JSON in request body." });
      return;
    }
    sendJson(res, 400, { error: "Failed to read request body." });
    return;
  }

  // 1. Validate incoming request
  const requestValidation = validateTeachingRequest(body);
  if (!requestValidation.valid || !requestValidation.data) {
    sendJson(res, 400, {
      error: "Invalid teaching request.",
      details: requestValidation.errors,
    });
    return;
  }

  const provider = options?.provider ?? getDefaultTeachingProvider();

  // 2. Generate response via configured provider
  try {
    const teachingResponse = await provider.generateTeachingResponse(
      requestValidation.data,
    );

    // 3. Validate generated response against Visual DSL schema
    const responseValidation = validateTeachingResponse(teachingResponse);
    if (!responseValidation.valid || !responseValidation.data) {
      sendJson(res, 502, {
        error:
          "AI Provider returned response that does not conform to Visual DSL schema.",
        details: responseValidation.errors,
      });
      return;
    }

    // 4. Return successful response
    sendJson(res, 200, responseValidation.data);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate teaching response.";
    sendJson(res, 500, {
      error: message,
    });
  }
}

export function handleProviderInfoRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options?: ServerHandlerOptions,
): void {
  const info = getTeachingProviderInfo(options?.provider);
  sendJson(res, 200, info);
}

