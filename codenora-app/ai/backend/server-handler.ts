/**
 * AI Teaching HTTP Request Handler
 *
 * Dispatches and validates incoming POST /api/ai/teach requests.
 * Compatible with standard Node http.Server, Connect middlewares, and Vite dev server.
 */

import fs from "fs";

import path from "path";

import { MockTeachingProvider } from "./mock-provider";

import {
  validateTeachingRequest,
  validateTeachingResponse,
} from "./dsl-validator";

import { FeatherlessTeachingProvider } from "./featherless-provider";
import { OllamaTeachingProvider } from "./ollama-provider";
import { NvidiaNemotronProvider } from "./nvidia-provider";
import { ProviderRouter } from "./provider-router";
import { ProviderError, ProviderSchemaError } from "./provider-errors";

import type { IncomingMessage, ServerResponse } from "http";
import type { TeachingProvider } from "./teaching-provider";
import type { AIProvider } from "./ai-provider";
import type {
  TeachingProviderInfo,
  TeachingResponse,
} from "../teaching-contract";

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
          if (!trimmed || trimmed.startsWith("#")) {
            continue;
          }
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
  if (
    !process.env.NVIDIA_MODEL ||
    process.env.NVIDIA_MODEL.includes("super-120b")
  ) {
    process.env.NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
  }
}

/**
 * Logs the server-side Cognora AI configuration safely without disclosing sensitive keys.
 */
export function logStartupConfiguration(): void {
  ensureServerEnvLoaded();
  const primaryProvider =
    process.env.COGNORA_PRIMARY_PROVIDER || process.env.AI_PROVIDER || "nvidia";
  const primaryModel =
    process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const maxTokens =
    process.env.NVIDIA_MAX_TOKENS || process.env.COGNORA_MAX_TOKENS || "32768";
  const nvidiaKeyStatus =
    process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim().length > 0
      ? "Present (configured)"
      : "Missing";

  const hasNvidiaKey = Boolean(
    process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim().length > 0,
  );

  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] primaryProvider=${primaryProvider}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] nvidiaKeyConfigured=${hasNvidiaKey}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] model=${primaryModel}`);
  // eslint-disable-next-line no-console
  console.info(`[COGNORA][CONFIG] maxTokens=${maxTokens}`);
}

/**
 * Resolves the active teaching provider:
 * 1. Honors AI_PROVIDER env var.
 * 2. If OLLAMA_BASE_URL or OLLAMA_MODEL is configured, uses OllamaTeachingProvider.
 * 3. Otherwise defaults to MockTeachingProvider or NvidiaNemotronProvider.
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

  // Default provider: ProviderRouter (NVIDIA Nemotron Primary)
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
      name: primary.name,
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

// Track in-flight generation promises to guarantee duplicate submissions do not trigger parallel AI requests
const inFlightGenerations = new Map<string, Promise<TeachingResponse>>();

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

  // Ensure the request and socket timeout is extended to 5 minutes so dev server / proxy doesn't abort early
  if (req.socket && typeof req.socket.setTimeout === "function") {
    req.socket.setTimeout(300000);
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
  const generationId =
    (typeof rawReq?.generationId === "string"
      ? rawReq.generationId
      : undefined) ||
    (typeof req.headers?.["x-generation-id"] === "string"
      ? (req.headers["x-generation-id"] as string)
      : undefined) ||
    (typeof rawReq?.requestId === "string" ? rawReq.requestId : undefined) ||
    `GEN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const requestId =
    (typeof rawReq?.requestId === "string" ? rawReq.requestId : undefined) ||
    generationId;

  if (typeof res.setHeader === "function") {
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Generation-Id", generationId);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[COGNORA][TEACH][BACKEND][START] generationId=${generationId} requestId=${requestId} prompt="${requestValidation.data.prompt.slice(
      0,
      60,
    )}"`,
  );

  const provider = options?.provider ?? getDefaultTeachingProvider();
  const dedupKey = `${generationId}:${requestValidation.data.prompt
    .trim()
    .toLowerCase()}`;

  try {
    // 2. Coalesce duplicate in-flight generations
    let generationPromise = inFlightGenerations.get(dedupKey);
    if (!generationPromise) {
      generationPromise = provider.generateTeachingResponse({
        ...requestValidation.data,
        requestId,
        generationId,
      });
      inFlightGenerations.set(dedupKey, generationPromise);
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[COGNORA][TEACH][BACKEND][DEDUP] Reusing in-flight generation for generationId=${generationId}`,
      );
    }

    let teachingResponse: TeachingResponse;
    try {
      teachingResponse = await generationPromise;
    } finally {
      inFlightGenerations.delete(dedupKey);
    }

    // Attach canonical generationId
    teachingResponse.generationId = generationId;

    // 3. Validate generated response against Visual DSL schema
    const responseValidation = validateTeachingResponse(teachingResponse);
    if (!responseValidation.valid || !responseValidation.data) {
      console.error(
        `[COGNORA][TEACH][BACKEND][ERROR] generationId=${generationId} requestId=${requestId} schema validation failed: ${responseValidation.errors.join(
          "; ",
        )}`,
      );
      sendJson(res, 502, {
        error:
          "AI Provider returned response that does not conform to Visual DSL schema.",
        code: "SCHEMA_ERROR",
        details: responseValidation.errors,
        generationId,
      });
      return;
    }

    // Ensure generationId is preserved on validated data
    responseValidation.data.generationId = generationId;

    // 4. Return successful response (only genuine validated lessons from provider)
    console.log(
      `[COGNORA][TEACH][BACKEND][SUCCESS] generationId=${generationId} requestId=${requestId} topic="${
        responseValidation.data.topic || ""
      }"`,
    );
    sendJson(res, 200, responseValidation.data);
  } catch (err: unknown) {
    inFlightGenerations.delete(dedupKey);

    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate teaching response.";
    const statusCode = err instanceof ProviderError ? err.statusCode : 500;
    const code = err instanceof ProviderError ? err.code : "INTERNAL_ERROR";
    const details = err instanceof ProviderError ? err.details : undefined;

    console.error(
      `[COGNORA][TEACH][BACKEND][ERROR] generationId=${generationId} requestId=${requestId} code=${code} error="${message}"`,
    );
    sendJson(res, statusCode, {
      error: message,
      code,
      details,
      generationId,
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

const PYTHON_VOICE_SERVICE_URL =
  (typeof process !== "undefined" && process.env?.COGNORA_VOICE_SERVICE_URL) ||
  "http://127.0.0.1:5005";

/** Voice error taxonomy codes — surfaced to the browser for structured error handling. */
export type VoiceErrorCode =
  | "CHATTERBOX_SERVICE_UNAVAILABLE"
  | "CHATTERBOX_MODEL_LOADING"
  | "CHATTERBOX_MODEL_ERROR"
  | "CHATTERBOX_HTTP_ERROR"
  | "CHATTERBOX_EMPTY_AUDIO"
  | "CHATTERBOX_TIMEOUT"
  | "VOICE_BAD_REQUEST"
  | "VOICE_INTERNAL_ERROR";

/** Classifies a caught fetch error into the voice error taxonomy. */
function classifyVoiceFetchError(err: unknown): {
  code: VoiceErrorCode;
  message: string;
} {
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message;
    if (name === "AbortError" || msg.includes("timed out")) {
      return {
        code: "CHATTERBOX_TIMEOUT",
        message: "Voice service request timed out.",
      };
    }
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("Failed to fetch") ||
      msg.includes("network") ||
      msg.includes("ENOTFOUND")
    ) {
      return {
        code: "CHATTERBOX_SERVICE_UNAVAILABLE",
        message: `Chatterbox service is not reachable at ${PYTHON_VOICE_SERVICE_URL}. Start it with: .\\cognora-voice\\start_voice_service.ps1`,
      };
    }
  }
  return {
    code: "VOICE_INTERNAL_ERROR",
    message:
      err instanceof Error ? err.message : "Unknown voice service error.",
  };
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

let _voiceReqCounter = 0;

export async function handleVoiceSynthesisRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed. Use POST." });
    return;
  }

  const voiceRequestId = `VR-${Date.now()}-${(++_voiceReqCounter).toString(
    36,
  )}`;
  const targetUrl = `${PYTHON_VOICE_SERVICE_URL}/synthesize`;
  const t0 = Date.now();

  try {
    const rawBody = await readRequestBody(req);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      sendJson(res, 400, {
        error: "Malformed JSON in request body.",
        code: "VOICE_BAD_REQUEST",
      });
      return;
    }

    if (!payload.text || typeof payload.text !== "string") {
      sendJson(res, 400, {
        error: "Missing or invalid 'text' in request body.",
        code: "VOICE_BAD_REQUEST",
      });
      return;
    }

    const textLength = (payload.text as string).length;

    // --- FETCH_START ---
    console.info(
      `[COGNORA][VOICE][BACKEND][FETCH_START] voiceRequestId=${voiceRequestId} url=${targetUrl} method=POST textLength=${textLength}`,
    );

    // 60-second timeout — allows full GPU/CPU neural TTS generation without premature abortion
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 60_000);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: timeoutController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const durationMs = Date.now() - t0;
      let errMsg = `Chatterbox service returned HTTP ${response.status}`;
      let errCode: VoiceErrorCode = "CHATTERBOX_HTTP_ERROR";

      try {
        const errData = (await response.json()) as {
          detail?: string;
          error?: string;
        };
        const detail = errData?.detail || errData?.error;
        if (detail) {
          errMsg = detail;
        }
        if (response.status === 503 && detail?.includes("loading")) {
          errCode = "CHATTERBOX_MODEL_LOADING";
        } else if (response.status === 503) {
          errCode = "CHATTERBOX_SERVICE_UNAVAILABLE";
        }
      } catch {
        // Fallback to HTTP status description
      }

      console.warn(
        `[COGNORA][VOICE][BACKEND][FETCH_ERROR] voiceRequestId=${voiceRequestId} url=${targetUrl} httpStatus=${response.status} code=${errCode} message="${errMsg}" durationMs=${durationMs}`,
      );

      sendJson(res, response.status >= 500 ? 503 : response.status, {
        error: errMsg,
        code: errCode,
        voiceRequestId,
      });
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    const durationMs = Date.now() - t0;
    const contentType = response.headers.get("content-type") || "audio/wav";

    // Guard: reject empty audio payloads
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.warn(
        `[COGNORA][VOICE][BACKEND][FETCH_ERROR] voiceRequestId=${voiceRequestId} url=${targetUrl} code=CHATTERBOX_EMPTY_AUDIO durationMs=${durationMs}`,
      );
      sendJson(res, 502, {
        error: "Chatterbox returned an empty audio payload.",
        code: "CHATTERBOX_EMPTY_AUDIO" as VoiceErrorCode,
        voiceRequestId,
      });
      return;
    }

    console.info(
      `[COGNORA][VOICE][BACKEND][FETCH_SUCCESS] voiceRequestId=${voiceRequestId} durationMs=${durationMs} contentType=${contentType} audioBytes=${audioBuffer.byteLength}`,
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", audioBuffer.byteLength);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Voice-Request-Id", voiceRequestId);
    res.end(Buffer.from(audioBuffer));
  } catch (err: unknown) {
    const durationMs = Date.now() - t0;
    const classified = classifyVoiceFetchError(err);
    const errorName = err instanceof Error ? err.name : "UnknownError";
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.warn(
      `[COGNORA][VOICE][BACKEND][FETCH_ERROR] voiceRequestId=${voiceRequestId} url=${targetUrl} errorName=${errorName} errorMessage="${errorMessage}" code=${classified.code} durationMs=${durationMs}`,
    );

    sendJson(res, 503, {
      error: classified.message,
      code: classified.code,
      voiceRequestId,
    });
  }
}

export async function handleVoiceHealthRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const targetUrl = `${PYTHON_VOICE_SERVICE_URL}/health`;
  try {
    console.info(`[COGNORA][VOICE][BACKEND][HEALTH_CHECK] url=${targetUrl}`);
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 5_000);
    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: "GET",
        signal: timeoutController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      console.warn(
        `[COGNORA][VOICE][BACKEND][HEALTH_CHECK] url=${targetUrl} httpStatus=${response.status} → unavailable`,
      );
      sendJson(res, 503, {
        status: "unavailable",
        modelReady: false,
        modelState: "ERROR",
        code: "CHATTERBOX_SERVICE_UNAVAILABLE" as VoiceErrorCode,
      });
      return;
    }
    const data = (await response.json()) as Record<string, unknown>;
    console.info(
      `[COGNORA][VOICE][BACKEND][HEALTH_CHECK] modelState=${
        data.modelState ?? "unknown"
      } modelReady=${data.modelReady ?? false}`,
    );
    sendJson(res, 200, data);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(
      `[COGNORA][VOICE][BACKEND][HEALTH_CHECK] url=${targetUrl} error="${errorMessage}" → service unreachable`,
    );
    sendJson(res, 200, {
      status: "unavailable",
      modelReady: false,
      modelState: "ERROR",
      code: "CHATTERBOX_SERVICE_UNAVAILABLE" as VoiceErrorCode,
    });
  }
}

export interface CodeGenerationPayload {
  lessonId?: string;
  generationId?: string;
  conceptId?: string;
  title?: string;
  language?: string;
  stepNumber?: number;
  transformationType?: string;
  explanation?: string;
  userPrompt?: string;
  input?: any;
}

/**
 * Handles POST /api/ai/code requests for dynamic, step-specific code generation using NVIDIA Nemotron.
 * Independent output channel: failure never interrupts lesson playback.
 */
export async function handleCodeGenerationRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  ensureServerEnvLoaded();
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed. Use POST." });
    return;
  }

  let body: unknown;
  try {
    body = await parseJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body." });
    return;
  }

  const payload = (body || {}) as CodeGenerationPayload;
  const language = (payload.language || "python").toLowerCase();
  const concept = payload.conceptId || payload.title || "algorithm";
  const stepNum = payload.stepNumber || 1;
  const transType = payload.transformationType || "TRANSFORMATION";

  console.info(
    `[COGNORA][CODE][START] concept=${concept} step=${stepNum} trans=${transType} lang=${language}`,
  );

  const apiKey =
    process.env.NVIDIA_API_KEY ||
    process.env.NIM_API_KEY ||
    process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    sendJson(res, 200, {
      success: true,
      fromCatalog: true,
      message: "No NVIDIA API key configured, using catalog code.",
    });
    return;
  }

  const model =
    process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const baseUrl =
    process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

  const systemPrompt = `You are the Cognora Code Intelligence Engine.
Generate production-quality, syntactically valid, executable ${language} code that implements this algorithm and demonstrates this specific teaching transformation.

RULES:
1. Return ONLY the code inside a single \`\`\`${language} code block.
2. Incorporate the user's input directly into the demonstration/driver code.
3. No placeholder comments (no "TODO", no "implement here").
4. No explanatory prose outside the code block.
5. The code must be correct and complete.`;

  const userPrompt = `Algorithm: ${concept} (${payload.title || ""})
Teaching Step ${stepNum}: ${payload.explanation || transType}
Active Transformation: ${transType}
User Input: ${payload.input ? JSON.stringify(payload.input) : "default dataset"}
Original Question: ${payload.userPrompt || concept}

Generate the complete, working ${language} implementation focusing on step ${stepNum} (${transType}).`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const apiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!apiRes.ok) {
      console.warn(
        `[COGNORA][CODE][API_ERROR] status=${apiRes.status} statusText=${apiRes.statusText}`,
      );
      sendJson(res, 200, {
        success: false,
        error: `NVIDIA API returned ${apiRes.status}`,
      });
      return;
    }

    const data = (await apiRes.json()) as any;
    let rawContent: string = data.choices?.[0]?.message?.content || "";

    // Strip reasoning tags if present
    rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Extract code block
    const codeBlockMatch = rawContent.match(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
    const code = codeBlockMatch ? codeBlockMatch[1].trim() : rawContent.trim();

    if (!code || code.length < 20) {
      sendJson(res, 200, {
        success: false,
        error: "Extracted code was empty or too short.",
      });
      return;
    }

    console.info(
      `[COGNORA][CODE][SUCCESS] concept=${concept} step=${stepNum} lang=${language} bytes=${code.length}`,
    );

    sendJson(res, 200, {
      success: true,
      code,
      language,
      conceptId: concept,
      stepNumber: stepNum,
      transformationType: transType,
      highlightLines: [1, 2, 3],
    });
  } catch (err: any) {
    console.warn(
      `[COGNORA][CODE][FETCH_ERROR] error="${err.message || String(err)}"`,
    );
    sendJson(res, 200, {
      success: false,
      error: err.message || "Failed to fetch code from NVIDIA provider.",
    });
  }
}
