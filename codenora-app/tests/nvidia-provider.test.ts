import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  NvidiaNemotronProvider,
  stripReasoningTags,
  extractJsonFromText,
  extractBalancedJson,
  resolveNvidiaMaxTokens,
  NVIDIA_DEFAULT_MODEL,
  NVIDIA_DEFAULT_BASE_URL,
  NVIDIA_DEFAULT_MAX_TOKENS,
} from "../ai/backend/nvidia-provider";
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderCreditCapacityError,
  ProviderSchemaError,
  NvidiaEmptyCompletionError,
  NvidiaInvalidCompletionError,
  NvidiaIncompleteStreamError,
  NvidiaOutputTruncatedError,
  NvidiaStreamError,
} from "../ai/backend/provider-errors";

import type {
  TeachingRequest,
  TeachingResponse,
} from "../ai/teaching-contract";

const VALID_TEACHING_JSON: TeachingResponse = {
  topic: "Binary Search",
  message:
    "Binary Search efficiently locates a target element in a sorted collection.",
  explanation_steps: [
    "Requires sorted data",
    "Divides search interval in half each step",
    "O(log n) time complexity",
  ],
  visual_actions: [
    {
      type: "create_array",
      id: "arr1",
      label: "Sorted Array",
      elements: [{ value: 10 }, { value: 20 }, { value: 30 }],
    },
    {
      type: "create_box",
      id: "step-box",
      label: "Compare middle element with target",
    },
  ],
  steps: [
    {
      id: "step-1",
      step_number: 1,
      title: "Initialize Bounds",
      explanation: "Set low and high pointers to the ends of the array.",
      visual_actions: [
        {
          type: "create_array",
          id: "arr1",
          label: "Sorted Array",
          elements: [{ value: 10 }, { value: 20 }, { value: 30 }],
        },
      ],
    },
    {
      id: "step-2",
      step_number: 2,
      title: "Find Midpoint",
      explanation: "Calculate mid index and compare value with target.",
      visual_actions: [
        {
          type: "create_box",
          id: "step-box",
          label: "Compare middle element with target",
        },
      ],
    },
  ],
};

describe("NvidiaNemotronProvider", () => {
  const originalKey = process.env.NVIDIA_API_KEY;
  const originalModel = process.env.NVIDIA_MODEL;
  const originalTokens = process.env.COGNORA_MAX_TOKENS;

  beforeEach(() => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_MODEL;
    delete process.env.COGNORA_MAX_TOKENS;
  });

  afterEach(() => {
    if (originalKey) {
      process.env.NVIDIA_API_KEY = originalKey;
    } else {
      delete process.env.NVIDIA_API_KEY;
    }
    if (originalModel) {
      process.env.NVIDIA_MODEL = originalModel;
    } else {
      delete process.env.NVIDIA_MODEL;
    }
    if (originalTokens) {
      process.env.COGNORA_MAX_TOKENS = originalTokens;
    } else {
      delete process.env.COGNORA_MAX_TOKENS;
    }
    vi.restoreAllMocks();
  });

  describe("Configuration & Defaults", () => {
    it("reports id and name correctly", () => {
      const provider = new NvidiaNemotronProvider();
      expect(provider.id).toBe("nvidia");
      expect(provider.name).toBe("NVIDIA Nemotron");
    });

    it("defaults to Nemotron 3 Ultra model and base URL", () => {
      const provider = new NvidiaNemotronProvider();
      expect(provider.getModel()).toBe(NVIDIA_DEFAULT_MODEL);
      expect(provider.getBaseUrl()).toBe(NVIDIA_DEFAULT_BASE_URL);
      expect(NVIDIA_DEFAULT_MODEL).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    });

    it("defaults to NVIDIA_DEFAULT_MAX_TOKENS max tokens", () => {
      expect(resolveNvidiaMaxTokens()).toBe(NVIDIA_DEFAULT_MAX_TOKENS);
      const provider = new NvidiaNemotronProvider();
      expect(provider.getMaxTokens()).toBe(NVIDIA_DEFAULT_MAX_TOKENS);
    });

    it("honors COGNORA_MAX_TOKENS environment variable", () => {
      process.env.COGNORA_MAX_TOKENS = "4000";
      expect(resolveNvidiaMaxTokens()).toBe(4000);
    });

    it("honors COGNORA_MAX_OUTPUT_TOKENS environment variable with priority", () => {
      process.env.COGNORA_MAX_TOKENS = "3000";
      process.env.COGNORA_MAX_OUTPUT_TOKENS = "4500";
      expect(resolveNvidiaMaxTokens()).toBe(4500);
      delete process.env.COGNORA_MAX_OUTPUT_TOKENS;
    });

    it("uses compact system prompt by default and supports custom system prompt", () => {
      const provider = new NvidiaNemotronProvider();
      expect(provider.getSystemPrompt()).toContain("visualLesson");

      const customProvider = new NvidiaNemotronProvider({
        systemPrompt: "Custom Nemotron Prompt",
      });
      expect(customProvider.getSystemPrompt()).toBe("Custom Nemotron Prompt");
    });

    it("reports isConfigured() based on apiKey presence", () => {
      const unconfigured = new NvidiaNemotronProvider();
      expect(unconfigured.isConfigured()).toBe(false);

      const configured = new NvidiaNemotronProvider({
        apiKey: "nvapi-test-key",
      });
      expect(configured.isConfigured()).toBe(true);
    });
  });

  describe("stripReasoningTags (CoT Protection)", () => {
    it("strips <think> tags completely", () => {
      const input =
        '<think>\nLet\'s plan the lesson on Binary Search...\nStep 1: create container\n</think>{"topic": "Binary Search"}';
      expect(stripReasoningTags(input)).toBe('{"topic": "Binary Search"}');
    });

    it("strips <thought> tags completely", () => {
      const input =
        "<thought>Thinking through edge cases...</thought>Hello World";
      expect(stripReasoningTags(input)).toBe("Hello World");
    });

    it("handles case-insensitive reasoning tags", () => {
      const input = "<THINK>Thinking...</THINK>Clean Output";
      expect(stripReasoningTags(input)).toBe("Clean Output");
    });

    it("returns plain text unchanged when no tags are present", () => {
      const input = '{"test": true}';
      expect(stripReasoningTags(input)).toBe('{"test": true}');
    });
  });

  describe("extractJsonFromText", () => {
    it("extracts direct JSON string", () => {
      const parsed = extractJsonFromText('{"key": "value"}');
      expect(parsed).toEqual({ key: "value" });
    });

    it("extracts JSON embedded in markdown code blocks", () => {
      const input =
        'Here is the result:\n```json\n{"foo": 42}\n```\nHope that helps!';
      const parsed = extractJsonFromText(input);
      expect(parsed).toEqual({ foo: 42 });
    });

    it("extracts JSON with preceding <think> tags and code fences", () => {
      const input =
        '<think>Analyzing graph algorithms...</think>\n```json\n{"nodes": [1, 2]}\n```';
      const parsed = extractJsonFromText(input);
      expect(parsed).toEqual({ nodes: [1, 2] });
    });

    it("extracts first balanced brace object from unstructured text", () => {
      const input = 'Here is your plan: {"status": "ready"} Thank you.';
      const parsed = extractJsonFromText(input);
      expect(parsed).toEqual({ status: "ready" });
    });

    it("returns null on completely invalid text", () => {
      expect(extractJsonFromText("Not JSON at all")).toBeNull();
    });
  });

  describe("API Generation & Execution", () => {
    it("dispatches request with correct headers, 3500 tokens, and payload", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: `<think>Planning steps...</think>\n${JSON.stringify(
                  VALID_TEACHING_JSON,
                )}`,
              },
            },
          ],
        }),
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "nvapi-test-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const request: TeachingRequest = {
        prompt: "Teach Binary Search",
        requestId: "test-req-1",
      };

      const response = await provider.generateTeachingLesson(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
      expect(init.headers.Authorization).toBe("Bearer nvapi-test-key");
      expect(init.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init.body);
      expect(body.model).toBe(NVIDIA_DEFAULT_MODEL);
      expect(body.max_tokens).toBe(NVIDIA_DEFAULT_MAX_TOKENS);
      expect(NVIDIA_DEFAULT_MAX_TOKENS).toBe(32768);
      expect(body.temperature).toBe(0);
      expect(body.stream).toBe(true);
      expect(body.reasoning_effort).toBe("high");
      expect(provider.getReasoningEffort()).toBe("high");
      expect(provider.getReasoningBudget()).toBe(32768);

      expect(response.topic).toBe("Binary Search");
      expect(response.visual_actions.length).toBe(2);
    });

    it("throws ProviderAuthenticationError on 401 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({ error: { message: "Invalid API Key" } }),
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "bad-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test",
          requestId: "req-401",
        }),
      ).rejects.toThrow(ProviderAuthenticationError);
    });

    it("throws ProviderRateLimitError on 429 and makes exactly 1 request without retry loop", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded. Please wait.",
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test",
          requestId: "req-429",
        }),
      ).rejects.toThrow(ProviderRateLimitError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws ProviderCreditCapacityError on 402 payment required", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => "Insufficient credits",
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test",
          requestId: "req-402",
        }),
      ).rejects.toThrow(ProviderCreditCapacityError);
    });

    it("throws ProviderSchemaError immediately on malformed DSL and makes exactly 1 request (no hidden repair turn)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  topic: "",
                  message: "Invalid",
                  visual_actions: "not-an-array",
                }),
              },
            },
          ],
        }),
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test",
          requestId: "req-schema",
        }),
      ).rejects.toThrow(ProviderSchemaError);

      // Exactly 1 request: NO 2nd repair turn dispatched behind the scenes
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("extractBalancedJson ignores raw leaf node objects and requires visual lesson candidates", () => {
      const leafNodeText =
        'Some reasoning text { "id": "n30", "value": 30 } more reasoning';
      const extracted = extractBalancedJson(leafNodeText);
      expect(extracted).toBeNull();

      const validCandidate =
        'Explanation { "topic": "AVL", "message": "AVL rotation", "visual_actions": [] } done.';
      const extractedValid = extractBalancedJson(validCandidate);
      expect(extractedValid).toEqual({
        topic: "AVL",
        message: "AVL rotation",
        visual_actions: [],
      });
    });

    it("preserves dynamic explanation_steps without arbitrary 10-step clamping", async () => {
      const excessSteps = Array.from({ length: 15 }, (_, i) => `Step ${i + 1}`);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ...VALID_TEACHING_JSON,
                  explanation_steps: excessSteps,
                }),
              },
            },
          ],
        }),
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const response = await provider.generateTeachingLesson({
        prompt: "AVL Steps",
        requestId: "req-steps-clamp",
      });

      expect(response.explanation_steps?.length).toBe(15);
    });

    it("strictly guards against super-120b and ensures payload model is Ultra 550B", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(VALID_TEACHING_JSON),
              },
            },
          ],
        }),
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-secret",
        model: "nvidia/nemotron-3-super-120b-a12b", // Attempted legacy super model
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(provider.getModel()).toBe("nvidia/nemotron-3-ultra-550b-a55b");

      await provider.generateTeachingLesson({
        prompt: "AVL Insert 30",
        requestId: "req-ultra-verify",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    });

    // Test A: NVIDIA valid non-streaming response
    it("Test A: handles NVIDIA valid non-streaming response correctly", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "chatcmpl-test-a",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify(VALID_TEACHING_JSON),
              },
              finish_reason: "stop",
            },
          ],
        }),
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-a",
        stream: false,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const response = await provider.generateTeachingLesson({
        prompt: "Test A non-streaming",
        requestId: "req-test-a",
      });

      expect(response.topic).toBe("Binary Search");
      expect(response.visual_actions.length).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Test B: NVIDIA valid streaming response
    it("Test B: handles NVIDIA valid streaming response correctly", async () => {
      const jsonStr = JSON.stringify(VALID_TEACHING_JSON);
      const sseChunks = [
        `data: ${JSON.stringify({
          choices: [{ delta: { content: jsonStr } }],
        })}\n\n`,
        "data: [DONE]\n\n",
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-b",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const response = await provider.generateTeachingLesson({
        prompt: "Test B streaming",
        requestId: "req-test-b",
      });

      expect(response.topic).toBe("Binary Search");
      expect(response.visual_actions.length).toBe(2);
    });

    // Test C: reasoning_content + content
    it("Test C: correctly isolates reasoning_content and parses content without corruption", async () => {
      const jsonStr = JSON.stringify(VALID_TEACHING_JSON);
      const sseChunks = [
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                role: "assistant",
                reasoning_content:
                  "Internal step-by-step reasoning about Binary Search algorithm...",
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [{ delta: { content: jsonStr } }],
        })}\n\n`,
        "data: [DONE]\n\n",
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-c",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const response = await provider.generateTeachingLesson({
        prompt: "Test C reasoning",
        requestId: "req-test-c",
      });

      // Valid Visual DSL returned; reasoning_content was NOT prepended or parsed as DSL
      expect(response.topic).toBe("Binary Search");
      expect(response.message).not.toContain("Internal step-by-step reasoning");
    });

    // Test D: content split across multiple SSE chunks
    it("Test D: correctly reassembles content split across multiple SSE chunks", async () => {
      const jsonStr = JSON.stringify(VALID_TEACHING_JSON);
      const p1 = jsonStr.slice(0, 50);
      const p2 = jsonStr.slice(50, 150);
      const p3 = jsonStr.slice(150);

      const sseChunks = [
        `data: ${JSON.stringify({
          choices: [{ delta: { content: p1 } }],
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [{ delta: { content: p2 } }],
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [{ delta: { content: p3 } }],
        })}\n\n`,
        "data: [DONE]\n\n",
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-d",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const response = await provider.generateTeachingLesson({
        prompt: "Test D split chunks",
        requestId: "req-test-d",
      });

      expect(response.topic).toBe("Binary Search");
      expect(response.visual_actions.length).toBe(2);
    });

    // Test E: final [DONE]
    it("Test E: terminates stream cleanly on final [DONE]", async () => {
      const jsonStr = JSON.stringify(VALID_TEACHING_JSON);
      const sseChunks = [
        `data: ${JSON.stringify({
          choices: [{ delta: { content: jsonStr } }],
        })}\n\n`,
        "data: [DONE]\n\n",
        // Subsequent chunk should not be read after [DONE]
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "extra trailing data" } }],
        })}\n\n`,
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-e",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const response = await provider.generateTeachingLesson({
        prompt: "Test E done",
        requestId: "req-test-e",
      });

      expect(response.topic).toBe("Binary Search");
      // Loop stopped upon [DONE]
      expect(chunkIdx).toBe(2);
    });

    // Test F: empty content
    it("Test F: throws NvidiaEmptyCompletionError when content is empty despite HTTP 200", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({
          choices: [{ delta: { role: "assistant" } }],
        })}\n\n`,
        "data: [DONE]\n\n",
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-f",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test F empty content",
          requestId: "req-test-f",
        }),
      ).rejects.toThrow(NvidiaEmptyCompletionError);
    });

    // Test G: incomplete stream
    it("Test G: throws NvidiaIncompleteStreamError when stream ends abruptly without [DONE] and without content", async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-g",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test G incomplete stream",
          requestId: "req-test-g",
        }),
      ).rejects.toThrow(NvidiaIncompleteStreamError);
    });

    // Test H: malformed response
    it("Test H: throws NvidiaInvalidCompletionError when content cannot be parsed as JSON", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "This is not JSON at all." } }],
        })}\n\n`,
        "data: [DONE]\n\n",
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-h",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test H malformed JSON",
          requestId: "req-test-h",
        }),
      ).rejects.toThrow(NvidiaInvalidCompletionError);
    });

    // Test I: finish_reason length throws NvidiaOutputTruncatedError
    it("Test I: throws NvidiaOutputTruncatedError when finish_reason is length", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({
          choices: [
            {
              delta: { content: '{"topic": "Truncated"' },
              finish_reason: "length",
            },
          ],
        })}\n\n`,
        "data: [DONE]\n\n",
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-i",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test I truncated",
          requestId: "req-test-i",
        }),
      ).rejects.toThrow(NvidiaOutputTruncatedError);
    });

    // Test J: stream error event
    it("Test J: throws NvidiaStreamError when stream emits an error event chunk", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({
          error: {
            message: "Internal server error",
            type: "internal_server_error",
            code: 500,
          },
        })}\n\n`,
        "data: [DONE]\n\n",
      ];
      let chunkIdx = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIdx < sseChunks.length) {
            return {
              done: false,
              value: new TextEncoder().encode(sseChunks[chunkIdx++]),
            };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "text/event-stream" : null,
        },
        body: { getReader: () => mockReader, read: mockReader.read },
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key-j",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({
          prompt: "Test J stream error",
          requestId: "req-test-j",
        }),
      ).rejects.toThrow(NvidiaStreamError);
    });
  });
});
