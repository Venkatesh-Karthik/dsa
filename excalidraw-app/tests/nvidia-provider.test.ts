import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  NvidiaNemotronProvider,
  stripReasoningTags,
  extractJsonFromText,
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
} from "../ai/backend/provider-errors";

import type { TeachingRequest, TeachingResponse } from "../ai/teaching-contract";

const VALID_TEACHING_JSON: TeachingResponse = {
  topic: "Binary Search",
  message: "Binary Search efficiently locates a target element in a sorted collection.",
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
      expect(provider.getSystemPrompt()).toContain("OUTPUT JSON CONTRACT");

      const customProvider = new NvidiaNemotronProvider({
        systemPrompt: "Custom Nemotron Prompt",
      });
      expect(customProvider.getSystemPrompt()).toBe("Custom Nemotron Prompt");
    });

    it("reports isConfigured() based on apiKey presence", () => {
      const unconfigured = new NvidiaNemotronProvider();
      expect(unconfigured.isConfigured()).toBe(false);

      const configured = new NvidiaNemotronProvider({ apiKey: "nvapi-test-key" });
      expect(configured.isConfigured()).toBe(true);
    });
  });

  describe("stripReasoningTags (CoT Protection)", () => {
    it("strips <think> tags completely", () => {
      const input = "<think>\nLet's plan the lesson on Binary Search...\nStep 1: create container\n</think>{\"topic\": \"Binary Search\"}";
      expect(stripReasoningTags(input)).toBe("{\"topic\": \"Binary Search\"}");
    });

    it("strips <thought> tags completely", () => {
      const input = "<thought>Thinking through edge cases...</thought>Hello World";
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
      const input = "Here is the result:\n```json\n{\"foo\": 42}\n```\nHope that helps!";
      const parsed = extractJsonFromText(input);
      expect(parsed).toEqual({ foo: 42 });
    });

    it("extracts JSON with preceding <think> tags and code fences", () => {
      const input = "<think>Analyzing graph algorithms...</think>\n```json\n{\"nodes\": [1, 2]}\n```";
      const parsed = extractJsonFromText(input);
      expect(parsed).toEqual({ nodes: [1, 2] });
    });

    it("extracts first balanced brace object from unstructured text", () => {
      const input = "Here is your plan: {\"status\": \"ready\"} Thank you.";
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
                content: `<think>Planning steps...</think>\n${JSON.stringify(VALID_TEACHING_JSON)}`,
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
      expect(init.headers["Authorization"]).toBe("Bearer nvapi-test-key");
      expect(init.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init.body);
      expect(body.model).toBe("nvidia/nemotron-3-ultra-550b-a55b");
      expect(body.max_tokens).toBe(NVIDIA_DEFAULT_MAX_TOKENS);
      expect(body.temperature).toBe(0.1);

      expect(response.topic).toBe("Binary Search");
      expect(response.visual_actions.length).toBe(2);
    });

    it("throws ProviderAuthenticationError on 401 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: "Invalid API Key" } }),
      });

      const provider = new NvidiaNemotronProvider({
        apiKey: "bad-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.generateTeachingLesson({ prompt: "Test", requestId: "req-401" }),
      ).rejects.toThrow(ProviderAuthenticationError);
    });

    it("throws ProviderRateLimitError on 429 response", async () => {
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
        provider.generateTeachingLesson({ prompt: "Test", requestId: "req-429" }),
      ).rejects.toThrow(ProviderRateLimitError);
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
        provider.generateTeachingLesson({ prompt: "Test", requestId: "req-402" }),
      ).rejects.toThrow(ProviderCreditCapacityError);
    });

    it("throws ProviderSchemaError when model generates malformed DSL that fails validation", async () => {
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
        provider.generateTeachingLesson({ prompt: "Test", requestId: "req-schema" }),
      ).rejects.toThrow(ProviderSchemaError);
    });
  });
});
