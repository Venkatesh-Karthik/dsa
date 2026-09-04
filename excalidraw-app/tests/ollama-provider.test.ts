/**
 * Ollama AI Teaching Provider Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import {
  OllamaTeachingProvider,
  cleanJsonOutput,
} from "../ai/backend/ollama-provider";
import type { CreateBoxAction } from "../ai/visual-dsl";

describe("cleanJsonOutput", () => {
  it("removes markdown code fences", () => {
    const input = "```json\n{\n  \"topic\": \"Binary Search\"\n}\n```";
    expect(cleanJsonOutput(input)).toBe("{\n  \"topic\": \"Binary Search\"\n}");
  });

  it("removes generic markdown code fences without language tag", () => {
    const input = "```\n{\n  \"topic\": \"Array\"\n}\n```";
    expect(cleanJsonOutput(input)).toBe("{\n  \"topic\": \"Array\"\n}");
  });

  it("extracts json from conversational text", () => {
    const input = "Here is the explanation you requested:\n{\"topic\": \"Tree\"}\nI hope this helps!";
    expect(cleanJsonOutput(input)).toBe("{\"topic\": \"Tree\"}");
  });

  it("leaves clean JSON intact", () => {
    const input = '{"topic": "Graph", "message": "Graph traversal"}';
    expect(cleanJsonOutput(input)).toBe(input);
  });
});

describe("OllamaTeachingProvider", () => {
  it("initializes with default options", () => {
    const provider = new OllamaTeachingProvider();
    expect(provider.id).toBe("ollama");
    expect(provider.name).toBe("Ollama (Local)");
    expect(provider.getModel()).toBe("qwen3.5:4b");
    expect(provider.getBaseUrl()).toBe("http://localhost:11434");
    expect(provider.isConfigured()).toBe(true);
  });

  it("accepts custom options", () => {
    const provider = new OllamaTeachingProvider({
      baseUrl: "http://192.168.1.100:11434",
      model: "qwen3.5:9b",
      timeoutMs: 45000,
    });
    expect(provider.getModel()).toBe("qwen3.5:9b");
    expect(provider.getBaseUrl()).toBe("http://192.168.1.100:11434");
  });

  it("calls Ollama chat completions endpoint with format json", async () => {
    const mockTeachingResponse = {
      topic: "Binary Search",
      message: "Binary search algorithm walkthrough",
      explanation_steps: ["Initialize low and high", "Check midpoint"],
      visual_actions: [
        {
          type: "create_array",
          id: "arr-1",
          elements: [
            { value: 1 },
            { value: 3 },
            { value: 5 },
            { value: 7 },
            { value: 9 },
          ],
        },
      ],
      steps: [
        {
          id: "step-1",
          step_number: 1,
          title: "Initial State",
          explanation: "Set low to 0 and high to 4.",
          calculations: "low = 0, high = 4, mid = 2",
          visual_actions: [
            {
              type: "create_array",
              id: "arr-1",
              elements: [{ value: 1 }, { value: 3 }, { value: 5 }],
            },
            {
              type: "annotate_pointer",
              id: "ptr-mid",
              label: "MID",
              target: "arr-1-1",
              placement: "above",
            },
          ],
        },
        {
          id: "step-2",
          step_number: 2,
          title: "Inspect Midpoint",
          explanation: "Compare target with mid element.",
          visual_actions: [
            {
              type: "highlight",
              target: "arr-1-1",
              color: "accent",
            },
          ],
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: {
          role: "assistant",
          content: JSON.stringify(mockTeachingResponse),
        },
      }),
    });

    const provider = new OllamaTeachingProvider({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.generateTeachingResponse({
      prompt: "Explain binary search on [1, 3, 5, 7, 9]",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/chat");
    expect(init.method).toBe("POST");

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.model).toBe("qwen3.5:4b");
    expect(sentBody.format).toBe("json");
    expect(sentBody.stream).toBe(false);
    expect(sentBody.messages).toHaveLength(2);
    expect(sentBody.messages[0].role).toBe("system");
    expect(sentBody.messages[1].role).toBe("user");

    expect(result.topic).toBe("Binary Search");
    expect(result.visual_actions).toHaveLength(1);
    expect(result.steps).toHaveLength(2);
  });

  it("handles retry correction if initial response is invalid DSL", async () => {
    const invalidInitial = {
      topic: "Broken",
      message: "Here is an invalid action",
      visual_actions: [
        {
          type: "unsupported_action_type",
          data: "foo",
        },
      ],
    };

    const validCorrection = {
      topic: "Fixed",
      message: "Here is the fixed action",
      visual_actions: [
        {
          type: "create_box",
          id: "box-1",
          label: "Test",
          style: { color: "primary" }, // Fixed valid color
        },
      ],
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: JSON.stringify(invalidInitial) },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: JSON.stringify(validCorrection) },
        }),
      });

    const provider = new OllamaTeachingProvider({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.generateTeachingResponse({
      prompt: "Show a box",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.topic).toBe("Fixed");
    expect(
      (result.visual_actions[0] as CreateBoxAction).style?.color,
    ).toBe("primary");
  });

  it("triggers generic expansion retry when initial response has only 1 step for conceptual request", async () => {
    const compressedInitial = {
      topic: "Binary Search",
      message: "Here is binary search",
      visual_actions: [],
      steps: [
        {
          id: "step-1",
          step_number: 1,
          title: "Setup",
          explanation: "Initial array.",
          visual_actions: [
            {
              type: "create_array",
              id: "arr-1",
              elements: [{ value: 10 }, { value: 20 }, { value: 30 }],
            },
          ],
        },
      ],
    };

    const expandedResponse = {
      topic: "Binary Search",
      message: "Here is binary search step by step",
      visual_actions: [],
      steps: [
        {
          id: "step-1",
          step_number: 1,
          title: "Setup",
          explanation: "Initial array.",
          visual_actions: [
            {
              type: "create_array",
              id: "arr-1",
              elements: [{ value: 10 }, { value: 20 }, { value: 30 }],
            },
          ],
        },
        {
          id: "step-2",
          step_number: 2,
          title: "Pointer Initialization",
          explanation: "Set LOW and HIGH.",
          visual_actions: [
            {
              type: "annotate_pointer",
              id: "ptr-low",
              label: "LOW",
              target: "arr-1-0",
              placement: "above",
            },
          ],
        },
        {
          id: "step-3",
          step_number: 3,
          title: "Midpoint",
          explanation: "Calculate MID.",
          visual_actions: [
            {
              type: "annotate_pointer",
              id: "ptr-mid",
              label: "MID",
              target: "arr-1-1",
              placement: "above",
            },
          ],
        },
      ],
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: JSON.stringify(compressedInitial) },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: JSON.stringify(expandedResponse) },
        }),
      });

    const provider = new OllamaTeachingProvider({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.generateTeachingResponse({
      prompt: "Explain binary search step by step",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.steps).toHaveLength(3);
    expect(result.steps?.[1].title).toBe("Pointer Initialization");
  });
});
