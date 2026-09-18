import { EventEmitter } from "events";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { FeatherlessTeachingProvider } from "../ai/backend/featherless-provider";
import {
  handleTeachingRequest,
  setDefaultTeachingProvider,
  getDefaultTeachingProvider,
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

describe("FeatherlessTeachingProvider", () => {
  const originalEnvKey = process.env.FEATHERLESS_API_KEY;
  const originalAiProvider = process.env.AI_PROVIDER;

  beforeEach(() => {
    delete process.env.FEATHERLESS_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  afterEach(() => {
    if (originalEnvKey) {
      process.env.FEATHERLESS_API_KEY = originalEnvKey;
    } else {
      delete process.env.FEATHERLESS_API_KEY;
    }
    if (originalAiProvider) {
      process.env.AI_PROVIDER = originalAiProvider;
    } else {
      delete process.env.AI_PROVIDER;
    }
    setDefaultTeachingProvider(null);
  });

  describe("Configuration & Metadata", () => {
    it("reports id and name correctly", () => {
      const provider = new FeatherlessTeachingProvider();
      expect(provider.id).toBe("featherless");
      expect(provider.name).toBe("Featherless AI");
    });

    it("reports isConfigured() false when no key is provided", () => {
      const provider = new FeatherlessTeachingProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it("reports isConfigured() true when API key is provided via options", () => {
      const provider = new FeatherlessTeachingProvider({
        apiKey: "test-featherless-key",
      });
      expect(provider.isConfigured()).toBe(true);
    });

    it("reports isConfigured() true when API key is set in environment", () => {
      process.env.FEATHERLESS_API_KEY = "env-featherless-key";
      const provider = new FeatherlessTeachingProvider();
      expect(provider.isConfigured()).toBe(true);
    });

    it("uses default recommended model if unspecified", () => {
      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
      });
      expect(provider.getModel()).toBe("meta-llama/Meta-Llama-3.1-8B-Instruct");
    });

    it("allows overriding model via options", () => {
      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
        model: "Qwen/Qwen2.5-7B-Instruct",
      });
      expect(provider.getModel()).toBe("Qwen/Qwen2.5-7B-Instruct");
    });
  });

  describe("Request Construction & Authentication", () => {
    it("throws clear error when generating response without API key", async () => {
      const provider = new FeatherlessTeachingProvider();
      const request: TeachingRequest = { prompt: "Explain binary search" };

      await expect(provider.generateTeachingResponse(request)).rejects.toThrow(
        "Featherless AI API key is not configured",
      );
    });

    it("sends correct headers and JSON payload to /chat/completions", async () => {
      let capturedUrl = "";
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: Record<string, unknown> = {};

      const mockFetch = vi.fn(
        async (url: string | URL | Request, init?: RequestInit) => {
          capturedUrl = url.toString();
          capturedHeaders = (init?.headers as Record<string, string>) || {};
          capturedBody = JSON.parse(init?.body as string);

          const mockApiResponse = {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    topic: "Binary Search",
                    message: "Binary search divides the search space in half.",
                    visual_actions: [
                      {
                        type: "create_box",
                        id: "box-root",
                        label: "Array",
                        role: "container",
                      },
                    ],
                  }),
                },
              },
            ],
          };

          return {
            ok: true,
            status: 200,
            json: async () => mockApiResponse,
          } as unknown as Response;
        },
      );

      const provider = new FeatherlessTeachingProvider({
        apiKey: "sk-secret-featherless-12345",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const request: TeachingRequest = {
        prompt: "Explain binary search",
        context: { theme: "dark", currentElementsCount: 3 },
      };

      const result = await provider.generateTeachingResponse(request);

      expect(capturedUrl).toBe(
        "https://api.featherless.ai/v1/chat/completions",
      );
      expect(capturedHeaders.Authorization).toBe(
        "Bearer sk-secret-featherless-12345",
      );
      expect(capturedHeaders["Content-Type"]).toBe("application/json");

      expect(capturedBody.model).toBe("meta-llama/Meta-Llama-3.1-8B-Instruct");
      expect(capturedBody.response_format).toEqual({ type: "json_object" });

      const messages = capturedBody.messages as Array<{
        role: string;
        content: string;
      }>;
      expect(messages[0].role).toBe("system");
      expect(messages[0].content.toLowerCase()).toContain(
        "visual learning tutor",
      );
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toContain(
        "Topic / Question: Explain binary search",
      );
      expect(messages[1].content).toContain("Canvas Theme: dark");
      expect(messages[1].content).toContain(
        "Existing canvas elements count: 3",
      );

      expect(result.topic).toBe("Binary Search");
      expect(result.visual_actions).toHaveLength(1);
    });

    it("includes bounded conversation history and existing AI element IDs in payload", async () => {
      let capturedBody: Record<string, unknown> = {};

      const mockFetch = vi.fn(
        async (_url: string | URL | Request, init?: RequestInit) => {
          capturedBody = JSON.parse(init?.body as string);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      topic: "Binary Search Follow-up",
                      message: "Highlighting the middle element at index 2.",
                      explanation_steps: [
                        "Examine midpoint",
                        "Target is larger, discard left half",
                      ],
                      visual_actions: [
                        {
                          type: "highlight",
                          target: "arr-2",
                          color: "warning",
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
          } as unknown as Response;
        },
      );

      const provider = new FeatherlessTeachingProvider({
        apiKey: "sk-test",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.generateTeachingResponse({
        prompt: "Highlight the midpoint",
        context: {
          conversationHistory: [
            { role: "user", content: "Show me an array" },
            { role: "assistant", content: "Here is a sorted array." },
          ],
          existingAIElements: ["arr-0", "arr-1", "arr-2", "arr-3"],
        },
      });

      const messages = capturedBody.messages as Array<{
        role: string;
        content: string;
      }>;

      // Expect: system (0), user history (1), assistant history (2), current user (3)
      expect(messages).toHaveLength(4);
      expect(messages[0].role).toBe("system");
      expect(messages[1]).toEqual({
        role: "user",
        content: "Show me an array",
      });
      expect(messages[2]).toEqual({
        role: "assistant",
        content: "Here is a sorted array.",
      });
      expect(messages[3].role).toBe("user");
      expect(messages[3].content).toContain(
        "Topic / Question: Highlight the midpoint",
      );
      expect(messages[3].content).toContain(
        "Existing AI diagram IDs on canvas: [arr-0, arr-1, arr-2, arr-3]",
      );

      expect(result.topic).toBe("Binary Search Follow-up");
      expect(result.explanation_steps).toEqual([
        "Examine midpoint",
        "Target is larger, discard left half",
      ]);
      expect(result.visual_actions[0].type).toBe("highlight");
    });
  });

  describe("Response Parsing & DSL Validation", () => {
    it("handles model responses wrapped in markdown code blocks", async () => {
      const fencedPayload = `\`\`\`json\n${JSON.stringify({
        topic: "Stack",
        message: "A stack is LIFO.",
        visual_actions: [
          {
            type: "create_box",
            id: "stack-frame-1",
            label: "Frame A",
            role: "stack-frame",
          },
        ],
      })}\n\`\`\``;

      const mockFetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: fencedPayload } }],
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.generateTeachingResponse({
        prompt: "Explain stack",
      });
      expect(result.topic).toBe("Stack");
      const firstAction = result.visual_actions[0];
      expect(firstAction.type).toBe("create_box");
      if ("id" in firstAction) {
        expect(firstAction.id).toBe("stack-frame-1");
      }
    });

    it("rejects malformed non-JSON completion content", async () => {
      const mockFetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              { message: { content: "Sorry, I cannot answer in JSON." } },
            ],
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingResponse({ prompt: "bad response" }),
      ).rejects.toThrow("could not be parsed as JSON");
    });

    it("rejects completion output that violates the Visual DSL schema after exhausting retries", async () => {
      const invalidDslPayload = {
        topic: "Broken DSL",
        message: "Invalid action types",
        visual_actions: [
          {
            type: "unsupported_action_type",
            data: "something",
          },
        ],
      };

      const mockFetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              { message: { content: JSON.stringify(invalidDslPayload) } },
            ],
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingResponse({ prompt: "test invalid dsl" }),
      ).rejects.toThrow("invalid Visual DSL");
      // 1 initial attempt + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("automatically normalizes raw colors from Featherless completions", async () => {
      const completionWithRawColors = {
        topic: "Floating Window",
        message: "A floating window moves independently above content.",
        visual_actions: [
          {
            type: "create_box",
            id: "win-main",
            label: "Floating Window",
            style: {
              color: "blue", // Raw color name from LLM
            },
          },
          {
            type: "create_box",
            id: "win-bg",
            label: "Background",
            style: {
              color: "gray", // Raw color name from LLM
            },
          },
        ],
      };

      const mockFetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              { message: { content: JSON.stringify(completionWithRawColors) } },
            ],
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.generateTeachingResponse({
        prompt: "Explain floating window",
      });

      expect(res.visual_actions).toHaveLength(2);
      expect((res.visual_actions[0] as any).style?.color).toBe("primary"); // "blue" normalized to "primary"
      expect((res.visual_actions[1] as any).style?.color).toBe("neutral"); // "gray" normalized to "neutral"
      expect(mockFetch).toHaveBeenCalledTimes(1); // Normalized without needing retry!
    });

    it("retries with error feedback when completion is invalid on first attempt and succeeds on retry", async () => {
      const invalidFirstAttempt = {
        topic: "Trees",
        message: "A tree explanation",
        visual_actions: [
          {
            type: "create_box",
            // missing required id
            label: "Node",
          },
        ],
      };

      const validSecondAttempt = {
        topic: "Trees",
        message: "A tree explanation",
        visual_actions: [
          {
            type: "create_box",
            id: "node-1",
            label: "Node 1",
            style: { color: "primary" },
          },
        ],
      };

      let callCount = 0;
      const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
        callCount++;
        const bodyStr = init?.body ? JSON.parse(init.body.toString()) : null;

        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                { message: { content: JSON.stringify(invalidFirstAttempt) } },
              ],
            }),
          } as unknown as Response;
        }

        // Verify the second request includes the correction feedback in the messages
        const messages = bodyStr.messages;
        expect(
          messages.some((m: any) => m.content.includes("invalid Visual DSL")),
        ).toBe(true);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              { message: { content: JSON.stringify(validSecondAttempt) } },
            ],
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.generateTeachingResponse({
        prompt: "Explain trees",
      });

      expect(callCount).toBe(2);
      expect(result.visual_actions).toHaveLength(1);
      expect((result.visual_actions[0] as any).id).toBe("node-1");
    });
  });

  describe("Error & Timeout Handling", () => {
    it("handles HTTP error status codes without exposing secrets", async () => {
      const mockFetch = vi.fn(async () => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: { message: "Invalid authorization token Bearer sk-secret" },
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "sk-secret",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      try {
        await provider.generateTeachingResponse({ prompt: "test" });
        expect.unreachable("Should have thrown");
      } catch (err: unknown) {
        const msg = (err as Error).message;
        expect(msg).toContain("Featherless AI error");
        expect(msg).not.toContain("sk-secret");
        expect(msg).toContain("[REDACTED]");
      }
    });

    it("handles network failure cleanly", async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error("ENOTFOUND api.featherless.ai");
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingResponse({ prompt: "test" }),
      ).rejects.toThrow("Failed to connect to Featherless AI");
    });
  });

  describe("Provider Auto-Selection in Server Handler", () => {
    it("selects MockTeachingProvider when AI_PROVIDER=mock", () => {
      process.env.AI_PROVIDER = "mock";
      setDefaultTeachingProvider(null);

      const resolved = getDefaultTeachingProvider();
      expect(resolved.id).toBe("mock");
    });

    it("selects FeatherlessTeachingProvider when AI_PROVIDER=featherless", () => {
      process.env.AI_PROVIDER = "featherless";
      setDefaultTeachingProvider(null);

      const resolved = getDefaultTeachingProvider();
      expect(resolved.id).toBe("featherless");
    });

    it("dispatches requests through FeatherlessTeachingProvider in handleTeachingRequest", async () => {
      const mockFeatherlessResponse = {
        topic: "Recursion",
        message: "Recursion is a function calling itself.",
        visual_actions: [
          {
            type: "create_box",
            id: "call-1",
            label: "Base Case",
          },
        ],
      };

      const mockFetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              { message: { content: JSON.stringify(mockFeatherlessResponse) } },
            ],
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "live-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "Explain recursion" },
      });

      await handleTeachingRequest(req, res, { provider });

      expect(res.statusCode).toBe(200);
      const json = res.getResponseJson();
      expect(json.topic).toBe("Recursion");
      expect(json.message).toBe("Recursion is a function calling itself.");
    });

    it("triggers generic expansion retry when Featherless emits only 1 step for conceptual request", async () => {
      const compressedInitial = {
        topic: "Binary Trees",
        message: "A binary tree is a hierarchical data structure.",
        visual_actions: [],
        steps: [
          {
            id: "step-1",
            step_number: 1,
            title: "Single Root",
            explanation: "Root node with value 10.",
            visual_actions: [
              {
                type: "create_tree",
                id: "tree-1",
                root: "10",
                nodes: [{ id: "10", value: 10 }],
              },
            ],
          },
        ],
      };

      const expandedLesson = {
        topic: "Binary Trees",
        message: "A binary tree explained progressively.",
        visual_actions: [],
        steps: [
          {
            id: "step-1",
            step_number: 1,
            title: "Single Root",
            explanation: "Root node with value 10.",
            visual_actions: [
              {
                type: "create_tree",
                id: "tree-1",
                root: "10",
                nodes: [{ id: "10", value: 10 }],
              },
            ],
          },
          {
            id: "step-2",
            step_number: 2,
            title: "Add Left Child",
            explanation: "Insert left child 5.",
            visual_actions: [
              {
                type: "create_tree",
                id: "tree-1",
                root: "10",
                nodes: [
                  { id: "10", value: 10, left: "5" },
                  { id: "5", value: 5 },
                ],
              },
            ],
          },
          {
            id: "step-3",
            step_number: 3,
            title: "Add Right Child",
            explanation: "Insert right child 15.",
            visual_actions: [
              {
                type: "create_tree",
                id: "tree-1",
                root: "10",
                nodes: [
                  { id: "10", value: 10, left: "5", right: "15" },
                  { id: "5", value: 5 },
                  { id: "15", value: 15 },
                ],
              },
            ],
          },
        ],
      };

      let callIndex = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callIndex++;
        const content =
          callIndex === 1
            ? JSON.stringify(compressedInitial)
            : JSON.stringify(expandedLesson);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content } }],
          }),
        } as unknown as Response;
      });

      const provider = new FeatherlessTeachingProvider({
        apiKey: "test-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.generateTeachingResponse({
        prompt: "Explain binary trees step by step",
      });

      expect(callIndex).toBe(2);
      expect(result.steps).toHaveLength(3);
      expect(result.steps?.[1].title).toBe("Add Left Child");
    });
  });
});
