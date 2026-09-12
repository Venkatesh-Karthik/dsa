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
import { OpenRouterTeachingProvider } from "./openrouter-provider";
import { NvidiaNemotronProvider } from "./nvidia-provider";
import { ProviderRouter } from "./provider-router";
import { ProviderError } from "./provider-errors";

import fs from "fs";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";
import type { TeachingProvider } from "./teaching-provider";
import type { AIProvider } from "./ai-provider";
import type { TeachingProviderInfo } from "../teaching-contract";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB limit

export interface ServerHandlerOptions {
  provider?: TeachingProvider;
}

export function ensureServerEnvLoaded(): void {
  const candidateFiles = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "../.env.local"),
    path.resolve(__dirname, "../../../.env.local"),
    path.resolve(__dirname, "../../.env.local"),
    path.resolve(__dirname, "../.env.local"),
  ];
  for (const filePath of candidateFiles) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            if (val) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Logs the server-side Cognora AI configuration safely without disclosing sensitive keys.
 */
export function logStartupConfiguration(): void {
  ensureServerEnvLoaded();
  const primaryProvider =
    process.env.COGNORA_PRIMARY_PROVIDER ||
    process.env.AI_PROVIDER ||
    "nvidia";
  const primaryModel =
    process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const fallbackProvider =
    process.env.COGNORA_FALLBACK_PROVIDER || "openrouter";
  const maxTokens =
    process.env.NVIDIA_MAX_TOKENS ||
    process.env.COGNORA_MAX_TOKENS ||
    "1800";
  const nvidiaKeyStatus =
    process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim().length > 0
      ? "Present (configured)"
      : "Missing";
  const openrouterKeyStatus =
    process.env.OPENROUTER_API_KEY &&
    process.env.OPENROUTER_API_KEY.trim().length > 0
      ? "Present (configured)"
      : "Missing";

  const hasNvidiaKey = Boolean(
    process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim().length > 0,
  );
  const hasOpenRouterKey = Boolean(
    process.env.OPENROUTER_API_KEY &&
      process.env.OPENROUTER_API_KEY.trim().length > 0,
  );

  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] primaryProvider=${primaryProvider}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] nvidiaKeyConfigured=${hasNvidiaKey}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] model=${primaryModel}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] fallbackProvider=${fallbackProvider}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] openrouterKeyConfigured=${hasOpenRouterKey}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] maxTokens=${maxTokens}`);
}

/**
 * Resolves the active teaching provider:
 * 1. Honors AI_PROVIDER env var ("openrouter" | "ollama" | "featherless" | "mock").
 * 2. If unset, uses OpenRouter or Featherless if configured.
 * 3. Else if OLLAMA_BASE_URL or OLLAMA_MODEL is configured, uses OllamaTeachingProvider.
 * 4. Otherwise defaults to MockTeachingProvider.
 */
export function resolveDefaultProvider(): TeachingProvider {
  ensureServerEnvLoaded();
  const providerEnv =
    typeof process !== "undefined"
      ? process.env?.AI_PROVIDER?.toLowerCase().trim()
      : undefined;

  if (providerEnv === "nvidia") {
    return new NvidiaNemotronProvider();
  }
  if (providerEnv === "openrouter") {
    return new OpenRouterTeachingProvider();
  }
  if (providerEnv === "ollama") {
    return new OllamaTeachingProvider();
  }
  if (providerEnv === "featherless") {
    return new FeatherlessTeachingProvider();
  }
  if (providerEnv === "mock") {
    return new MockTeachingProvider();
  }
  if (providerEnv === "router") {
    return new ProviderRouter();
  }

  // Default provider: ProviderRouter (NVIDIA Nemotron Primary -> OpenRouter Fallback)
  return new ProviderRouter();
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

  if (provider instanceof ProviderRouter) {
    const primary = provider.getPrimaryProvider();
    const model =
      "getModel" in primary &&
      typeof (primary as { getModel?: () => string }).getModel === "function"
        ? (primary as { getModel: () => string }).getModel()
        : undefined;

    return {
      id: primary.id,
      name: `${primary.name} (with fallback)`,
      model,
      isConfigured: provider.isConfigured(),
    };
  }

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

  const rawReq = body as Record<string, unknown> | undefined;
  const requestId =
    (typeof rawReq?.requestId === "string" ? rawReq.requestId : undefined) ||
    (typeof req.headers?.["x-request-id"] === "string"
      ? (req.headers["x-request-id"] as string)
      : undefined) ||
    `COGNORA-TEACH-${Date.now()}`;

  if (typeof res.setHeader === "function") {
    res.setHeader("X-Request-Id", requestId);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[COGNORA][TEACH][BACKEND][START] requestId=${requestId} prompt="${requestValidation.data.prompt.slice(0, 60)}"`,
  );

  const provider = options?.provider ?? getDefaultTeachingProvider();

  // 2. Generate response via configured provider
  try {
    const teachingResponse = await provider.generateTeachingResponse({
      ...requestValidation.data,
      requestId,
    });

    // 3. Validate generated response against Visual DSL schema
    const responseValidation = validateTeachingResponse(teachingResponse);
    if (!responseValidation.valid || !responseValidation.data) {
      // eslint-disable-next-line no-console
      console.error(
        `[COGNORA][TEACH][BACKEND][ERROR] requestId=${requestId} schema validation failed`,
      );
      sendJson(res, 502, {
        error:
          "AI Provider returned response that does not conform to Visual DSL schema.",
        details: responseValidation.errors,
      });
      return;
    }

    // 4. Return successful response
    // eslint-disable-next-line no-console
    console.log(
      `[COGNORA][TEACH][BACKEND][SUCCESS] requestId=${requestId} topic="${responseValidation.data.topic || ""}"`,
    );
    sendJson(res, 200, responseValidation.data);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate teaching response.";
    const statusCode = err instanceof ProviderError ? err.statusCode : 500;
    const code = err instanceof ProviderError ? err.code : "INTERNAL_ERROR";
    const details = err instanceof ProviderError ? err.details : undefined;

    // eslint-disable-next-line no-console
    console.error(
      `[COGNORA][TEACH][BACKEND][ERROR] requestId=${requestId} code=${code} error="${message}"`,
    );
    sendJson(res, statusCode, {
      error: message,
      code,
      details,
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

