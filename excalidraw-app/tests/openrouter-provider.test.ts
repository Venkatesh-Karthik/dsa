import { EventEmitter } from "events";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { OpenRouterTeachingProvider } from "../ai/backend/openrouter-provider";
import { ProviderCreditCapacityError } from "../ai/backend/provider-errors";
import {
  handleTeachingRequest,
  setDefaultTeachingProvider,
  resolveDefaultProvider,
} from "../ai/backend/server-handler";

import type { TeachingRequest } from "../ai/teaching-contract";
import type { IncomingMessage, ServerResponse } from "http";

function createMockReqRes(options: { method: string; body?: unknown }) {
  const req = new EventEmitter() as unknown as IncomingMessage & {
    method: string;
    destroy: () => void;
  };
  req.method = options.method;
  req.destroy = vi.fn();

  let responseBody = "";
  const headers: Record<string, string> = {};

  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader: vi.fn((key: string, val: string) => {
      headers[key.toLowerCase()] = val;
    }),
    end: vi.fn((chunk?: string | Buffer) => {
      if (chunk) {
        responseBody += chunk.toString();
      }
      res.headersSent = true;
    }),
  } as unknown as ServerResponse & {
    statusCode: number;
    headersSent: boolean;
    getResponseBody: () => string;
    getResponseJson: () => Record<string, unknown>;
    headers: Record<string, string>;
  };

  res.getResponseBody = () => responseBody;
  res.getResponseJson = () => JSON.parse(responseBody);
  res.headers = headers;

  setTimeout(() => {
    if (options.body !== undefined) {
      const payload =
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body);
      req.emit("data", Buffer.from(payload));
    }
    req.emit("end");
  }, 5);

  return { req, res };
}

describe("OpenRouterTeachingProvider", () => {
  const originalEnvKey = process.env.OPENROUTER_API_KEY;
  const originalProvider = process.env.AI_PROVIDER;

  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  afterEach(() => {
    if (originalEnvKey) {
      process.env.OPENROUTER_API_KEY = originalEnvKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
    if (originalProvider) {
      process.env.AI_PROVIDER = originalProvider;
    } else {
      delete process.env.AI_PROVIDER;
    }
    setDefaultTeachingProvider(null);
    vi.restoreAllMocks();
  });

  describe("Configuration & Metadata", () => {
    it("reports id and name correctly", () => {
      const provider = new OpenRouterTeachingProvider();
      expect(provider.id).toBe("openrouter");
      expect(provider.name).toBe("OpenRouter");
    });

    it("reports isConfigured() false when no key is provided", () => {
      const provider = new OpenRouterTeachingProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it("reports isConfigured() true when API key is provided via options", () => {
      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-test-key",
      });
      expect(provider.isConfigured()).toBe(true);
    });

    it("reports isConfigured() true when API key is set in environment", () => {
      process.env.OPENROUTER_API_KEY = "sk-or-env-key";
      const provider = new OpenRouterTeachingProvider();
      expect(provider.isConfigured()).toBe(true);
    });

    it("defaults to z-ai/glm-5.3-flash model", () => {
      const provider = new OpenRouterTeachingProvider();
      expect(provider.getModel()).toBe("z-ai/glm-5.3-flash");
    });

    it("defaults to OpenRouter base URL", () => {
      const provider = new OpenRouterTeachingProvider();
      expect(provider.getBaseUrl()).toBe("https://openrouter.ai/api/v1");
    });
  });

  describe("Server Handler Provider Resolution", () => {
    it("prioritizes OpenRouter when AI_PROVIDER=openrouter", () => {
      process.env.AI_PROVIDER = "openrouter";
      const resolved = resolveDefaultProvider();
      expect(resolved.id).toBe("openrouter");
    });

    it("defaults to ProviderRouter when OPENROUTER_API_KEY is configured", () => {
      process.env.OPENROUTER_API_KEY = "sk-or-configured";
      const resolved = resolveDefaultProvider();
      expect(resolved.id).toBe("provider-router");
    });
  });

  describe("Operation ID Normalization & Timing Logs", () => {
    it("auto-assigns missing operation IDs in transformations without triggering repair calls", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Payload missing operations[1].id in transformation 4
      const mockAiPayload = {
        topic: "Recursion",
        message: "Visual explanation of recursion with base cases",
        visualLesson: {
          id: "recursion-lesson",
          title: "Recursion Stack",
          concept: "Call Stack",
          initialScene: [
            { type: "create_box", id: "frame-1", label: "main()" },
          ],
          transformations: [
            {
              id: "t1",
              title: "Call fact(3)",
              explanation: "First recursive call is placed on the stack.",
              operations: [
                { type: "create_box", id: "frame-2", label: "fact(3)" },
              ],
            },
            {
              id: "t2",
              title: "Call fact(2)",
              explanation: "Second recursive call added to call stack.",
              operations: [
                { type: "create_box", id: "frame-3", label: "fact(2)" },
              ],
            },
            {
              id: "t3",
              title: "Call fact(1)",
              explanation: "Base case reached in recursive call stack.",
              operations: [
                { type: "create_box", id: "frame-4", label: "fact(1)" },
              ],
            },
            {
              id: "t4",
              title: "Return 1",
              explanation: "Returning from fact(1) up the call stack.",
              operations: [
                { type: "highlight", target: "frame-4", color: "green" },
                // Missing id on creation/annotation operation!
                {
                  type: "annotate_pointer",
                  target: "frame-4",
                  label: "Return 1",
                },
              ],
            },
          ],
        },
      };

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockAiPayload),
                },
              },
            ],
          }),
        };
      });

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-test-key",
        fetchFn: mockFetch,
      });

      const request: TeachingRequest = {
        prompt: "Explain recursion",
        context: { intent: "visual_teaching" },
      };

      const response = await provider.generateTeachingResponse(request);

      // Verify only 1 initial call was made (0 repair calls!)
      expect(callCount).toBe(1);
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Initial response failed validation"),
      );

      // Verify the missing operation ID was deterministically populated
      const opWithMissingId = response.visualLesson?.transformations[3]
        .operations[1] as unknown as Record<string, unknown>;
      expect(opWithMissingId).toBeDefined();
      expect(typeof opWithMissingId?.id).toBe("string");
      expect(opWithMissingId?.id).toBe("t3-op1");

      // Verify required [COGNORA AI] timing logs were emitted
      const loggedMessages = infoSpy.mock.calls.map((c) => c[0]);
      expect(loggedMessages).toContain("[COGNORA AI] request started");
      expect(
        loggedMessages.some(
          (msg) =>
            typeof msg === "string" &&
            msg.startsWith("[COGNORA AI] provider response:"),
        ),
      ).toBe(true);
      expect(
        loggedMessages.some(
          (msg) =>
            typeof msg === "string" && msg.startsWith("[COGNORA AI] parsing:"),
        ),
      ).toBe(true);
      expect(
        loggedMessages.some(
          (msg) =>
            typeof msg === "string" &&
            msg.startsWith("[COGNORA AI] normalization:"),
        ),
      ).toBe(true);
      expect(
        loggedMessages.some(
          (msg) =>
            typeof msg === "string" &&
            msg.startsWith("[COGNORA AI] validation:"),
        ),
      ).toBe(true);
      expect(
        loggedMessages.some(
          (msg) =>
            typeof msg === "string" && msg.startsWith("[COGNORA AI] total:"),
        ),
      ).toBe(true);
    });

    it("extracts JSON content from reasoning when message.content is null or empty", async () => {
      const mockAiPayload = {
        topic: "Arrays",
        message: "Visual explanation of contiguous array memory layout",
        visualLesson: {
          id: "array-lesson",
          title: "Array Layout",
          concept: "Contiguous Memory",
          initialScene: [
            { type: "create_array", id: "arr1", elements: [10, 20, 30] },
          ],
          transformations: [
            {
              id: "t1",
              title: "Highlight Index 0",
              explanation: "Accessing the first element in O(1) time.",
              operations: [
                { type: "highlight", target: "arr1-0", color: "blue" },
              ],
            },
            {
              id: "t2",
              title: "Highlight Index 1",
              explanation: "Accessing the second element in O(1) time.",
              operations: [
                { type: "highlight", target: "arr1-1", color: "green" },
              ],
            },
            {
              id: "t3",
              title: "Highlight Index 2",
              explanation: "Accessing the third element in O(1) time.",
              operations: [
                { type: "highlight", target: "arr1-2", color: "yellow" },
              ],
            },
          ],
        },
      };

      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: null,
                  reasoning: `Thinking about arrays...\n\`\`\`json\n${JSON.stringify(
                    mockAiPayload,
                  )}\n\`\`\``,
                },
              },
            ],
          }),
        };
      });

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-test-key",
        fetchFn: mockFetch,
      });

      const response = await provider.generateTeachingResponse({
        prompt: "Explain arrays",
      });

      expect(response.topic).toBe("Arrays");
      expect(response.visualLesson?.transformations.length).toBe(3);
    });
  });

  describe("Fail-fast Error Classification", () => {
    it("throws ProviderAuthenticationError on 401 with redacted token", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: { message: "Invalid API key Bearer sk-or-secret-token" },
          }),
        };
      });

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-invalid",
        fetchFn: mockFetch,
      });

      await expect(
        provider.generateTeachingResponse({ prompt: "Test prompt" }),
      ).rejects.toThrowError(/Invalid API key Bearer \[REDACTED\]/);
    });

    it("throws ProviderRateLimitError on 429", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 429,
          json: async () => ({
            error: { message: "Rate limit exceeded" },
          }),
        };
      });

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-key",
        fetchFn: mockFetch,
      });

      await expect(
        provider.generateTeachingResponse({ prompt: "Test prompt" }),
      ).rejects.toThrowError(/Rate limit exceeded/);
    });

    it("throws ProviderTimeoutError when request times out", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      });

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-key",
        fetchFn: mockFetch,
        timeoutMs: 50,
      });

      await expect(
        provider.generateTeachingResponse({ prompt: "Test prompt" }),
      ).rejects.toThrowError(/timed out after/);
    });

    it("throws ProviderCreditCapacityError on 402 with parsed requestedTokens and availableTokens", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 402,
          json: async () => ({
            error: {
              message:
                "This request requires more credits, or fewer max_tokens. You requested up to 3500 tokens, but can only afford 650.",
              code: 402,
            },
          }),
        };
      });

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-key",
        fetchFn: mockFetch,
      });

      try {
        await provider.generateTeachingResponse({ prompt: "Test prompt" });
        expect.unreachable("Should have thrown ProviderCreditCapacityError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ProviderCreditCapacityError);
        const creditErr = err as ProviderCreditCapacityError;
        expect(creditErr.code).toBe("CREDIT_CAPACITY_EXCEEDED");
        expect(creditErr.statusCode).toBe(402);
        expect(creditErr.requestedTokens).toBe(3500);
        expect(creditErr.availableTokens).toBe(650);
      }
    });

    it("supports configurable max_tokens via COGNORA_TEACH_MAX_TOKENS or constructor option", () => {
      const defaultProvider = new OpenRouterTeachingProvider();
      expect(defaultProvider.getMaxTokens()).toBe(3500);

      const customProvider = new OpenRouterTeachingProvider({
        maxTokens: 2000,
      });
      expect(customProvider.getMaxTokens()).toBe(2000);

      const oldEnv = process.env.COGNORA_TEACH_MAX_TOKENS;
      try {
        process.env.COGNORA_TEACH_MAX_TOKENS = "2500";
        const envProvider = new OpenRouterTeachingProvider();
        expect(envProvider.getMaxTokens()).toBe(2500);
      } finally {
        if (oldEnv) {
          process.env.COGNORA_TEACH_MAX_TOKENS = oldEnv;
        } else {
          delete process.env.COGNORA_TEACH_MAX_TOKENS;
        }
      }
    });
  });

  describe("HTTP Endpoint Integration via Server Handler", () => {
    it("serves POST /api/ai/teach using OpenRouter provider", async () => {
      const mockPayload = {
        topic: "Binary Search",
        message: "Binary search cuts search space in half",
        visualLesson: {
          id: "bs-lesson",
          title: "Binary Search",
          concept: "Divide and Conquer",
          initialScene: [
            { type: "create_array", id: "arr", elements: [1, 3, 5, 7, 9] },
          ],
          transformations: [
            {
              id: "t1",
              title: "Mid element",
              explanation: "Checking the middle element at index 2.",
              operations: [
                { type: "highlight", target: "arr-2", color: "blue" },
              ],
            },
            {
              id: "t2",
              title: "Right half",
              explanation: "Target is greater, search in right half.",
              operations: [
                { type: "highlight", target: "arr-3", color: "green" },
              ],
            },
            {
              id: "t3",
              title: "Found target",
              explanation: "Found target 7 at index 3.",
              operations: [
                { type: "highlight", target: "arr-3", color: "yellow" },
              ],
            },
          ],
        },
      };

      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockPayload),
              },
            },
          ],
        }),
      }));

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-valid-key",
        fetchFn: mockFetch,
      });
      setDefaultTeachingProvider(provider);

      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "Explain binary search" },
      });

      await handleTeachingRequest(req, res);
      expect(res.statusCode).toBe(200);

      const json = res.getResponseJson();
      expect(json.topic).toBe("Binary Search");
      expect(json.visualLesson).toBeDefined();
    });

    it("serves POST /api/ai/teach with 402 and CREDIT_CAPACITY_EXCEEDED when credit capacity is exceeded", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 402,
        json: async () => ({
          error: {
            message:
              "This request requires more credits, or fewer max_tokens. You requested up to 3500 tokens, but can only afford 650.",
            code: 402,
          },
        }),
      }));

      const provider = new OpenRouterTeachingProvider({
        apiKey: "sk-or-key",
        fetchFn: mockFetch,
      });
      setDefaultTeachingProvider(provider);

      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "Explain binary search" },
      });

      await handleTeachingRequest(req, res);
      expect(res.statusCode).toBe(402);

      const json = res.getResponseJson();
      expect(json.code).toBe("CREDIT_CAPACITY_EXCEEDED");
      const details = json.details as { requestedTokens?: number; availableTokens?: number };
      expect(details?.requestedTokens).toBe(3500);
      expect(details?.availableTokens).toBe(650);
    });
  });
});
