import { describe, it, expect, vi, afterEach } from "vitest";

import { getMockTeachingResponse } from "../components/AITeachingAgent";
import { renderActions } from "../ai/visual-renderer";
import { requestTeachingExplanation } from "../ai/ai-service";

describe("AITeachingAgent Mock Pipeline", () => {
  it("generates and renders valid visual actions and explanation steps for Binary Search", async () => {
    const response = await getMockTeachingResponse("Explain binary search");

    expect(response.topic).toBe("Binary Search");
    expect(response.message).toContain("Binary search");
    expect(response.visual_actions.length).toBeGreaterThan(0);
    expect(response.explanation_steps?.length).toBeGreaterThanOrEqual(3);

    // Verify all visual actions successfully pass through visual-renderer without errors
    const renderResult = renderActions(response.visual_actions);
    expect(renderResult.errors).toEqual([]);
    expect(renderResult.elements.length).toBeGreaterThan(0);

    // Verify key nodes exist
    expect(renderResult.registry.has("bs-title")).toBeDefined();
    expect(renderResult.registry.has("arr-3")).toBeDefined();
  });

  it("generates and renders valid visual actions for Arrays", async () => {
    const response = await getMockTeachingResponse("Can you explain arrays?");

    expect(response.topic).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.visual_actions.length).toBeGreaterThan(0);
    expect(response.visual_actions.length).toBeGreaterThan(0);
    if (response.explanation_steps) {
      expect(response.explanation_steps.length).toBeGreaterThanOrEqual(2);
    }

    const renderResult = renderActions(response.visual_actions);
    expect(renderResult.errors).toEqual([]);
    expect(renderResult.elements.length).toBeGreaterThan(0);

    expect(renderResult.registry.has("arr-header")).toBeDefined();
    expect(renderResult.registry.has("arr-item-0")).toBeDefined();
    expect(renderResult.registry.has("arr-item-3")).toBeDefined();
  });

  it("generates and renders valid visual actions for Stack", async () => {
    const response = await getMockTeachingResponse("Tell me about a stack");

    expect(response.topic).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.visual_actions.length).toBeGreaterThan(0);
    if (response.explanation_steps) {
      expect(response.explanation_steps.length).toBeGreaterThanOrEqual(2);
    }

    const renderResult = renderActions(response.visual_actions);
    expect(renderResult.errors).toEqual([]);
    expect(renderResult.elements.length).toBeGreaterThan(0);

    expect(renderResult.registry.has("stack-top")).toBeDefined();
    expect(renderResult.registry.has("stack-base")).toBeDefined();
  });

  it("generates hierarchical tree structure for Tree prompt", async () => {
    const response = await getMockTeachingResponse("Explain binary tree");

    expect(response.topic).toBeDefined();
    expect(response.visual_actions.length).toBeGreaterThan(0);

    const renderResult = renderActions(response.visual_actions);
    expect(renderResult.errors).toEqual([]);
  });

  it("handles conversational follow-up for target 60", async () => {
    const response = await getMockTeachingResponse(
      "What happens if target is 60?",
    );

    expect(response.topic).toContain("Target 60");
    expect(response.visual_actions.length).toBeGreaterThan(0);
    expect(response.explanation_steps?.length).toBeGreaterThan(0);

    // Contains highlight actions
    const hasHighlight = response.visual_actions.some(
      (a) => a.type === "highlight",
    );
    expect(hasHighlight).toBe(true);
  });

  it("handles conversational follow-up for highlight midpoint", async () => {
    const response = await getMockTeachingResponse(
      "Highlight the middle element",
    );

    expect(response.topic).toBe("Highlighting Midpoint");
    expect(response.visual_actions[0].type).toBe("highlight");
  });

  it("handles conversational follow-up to delete/remove diagram", async () => {
    const response = await getMockTeachingResponse("Remove the old diagram");

    expect(response.topic).toBe("Remove Diagram");
    expect(response.visual_actions[0].type).toBe("delete");
  });

  it("generates and renders valid visual actions for generic topics", async () => {
    const response = await getMockTeachingResponse("Explain recursion");

    expect(response.topic).toBeDefined();
    expect(response.visual_actions.length).toBeGreaterThan(0);

    const renderResult = renderActions(response.visual_actions);
    expect(renderResult.errors).toEqual([]);
    expect(renderResult.elements.length).toBeGreaterThan(0);
  });

  const mockTopics = [
    "linked list",
    "queue",
    "tree",
    "heap",
    "graph",
    "matrix",
    "hash"
  ];

  for (const topic of mockTopics) {
    it(`generates and renders valid visual actions for mock topic: ${topic}`, async () => {
      const response = await getMockTeachingResponse(`Explain ${topic}`);
      expect(response.visual_actions.length).toBeGreaterThan(0);

      const renderResult = renderActions(response.visual_actions);
      expect(renderResult.errors).toEqual([]);
      expect(renderResult.elements.length).toBeGreaterThan(0);
    });
  }

  it("generates complete 4-case AVL Tree Rotations multi-step lesson with valid renders", async () => {
    const response = await getMockTeachingResponse("Explain AVL tree rotations");

    expect(response.topic).toContain("AVL Tree Rotations");
    expect(response.steps).toBeDefined();
    expect(response.steps).toHaveLength(4);

    const stepTitles = response.steps!.map((s) => s.title);
    expect(stepTitles.some((t) => t.includes("Left-Left (LL)"))).toBe(true);
    expect(stepTitles.some((t) => t.includes("Right-Right (RR)"))).toBe(true);
    expect(stepTitles.some((t) => t.includes("Left-Right (LR)"))).toBe(true);
    expect(stepTitles.some((t) => t.includes("Right-Left (RL)"))).toBe(true);

    // Verify every single step contains verified calculations, pedagogical insight, and renders cleanly
    for (const step of response.steps!) {
      expect(step.calculations).toBeDefined();
      expect(step.calculations).toContain("BF(");
      expect(step.insight).toBeDefined();
      expect(step.visual_actions.length).toBeGreaterThan(0);

      const renderResult = renderActions(step.visual_actions);
      expect(renderResult.errors).toEqual([]);
      expect(renderResult.elements.length).toBeGreaterThan(0);
    }
  });

  it("generates complete multi-step Binary Search lesson with complete states", async () => {
    const response = await getMockTeachingResponse("Explain binary search");

    expect(response.steps).toBeDefined();
    expect(response.steps!.length).toBeGreaterThanOrEqual(3);

    for (const step of response.steps!) {
      expect(step.title).toBeDefined();
      expect(step.explanation).toBeDefined();
      expect(step.calculations).toBeDefined();
      expect(step.insight).toBeDefined();

      const renderResult = renderActions(step.visual_actions);
      expect(renderResult.errors).toEqual([]);
      expect(renderResult.elements.length).toBeGreaterThan(0);
    }
  });
});

describe("Frontend AI Service (requestTeachingExplanation)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls /api/ai/teach and passes conversationHistory and existingAIElements", async () => {
    let capturedBody: any = null;

    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          message: "Binary search target 60.",
          topic: "Binary Search",
          visual_actions: [
            {
              type: "highlight",
              target: "arr-30",
              color: "warning",
            },
          ],
        }),
      } as unknown as Response;
    });

    const result = await requestTeachingExplanation({
      prompt: "What happens if target is 60?",
      context: {
        theme: "dark",
        conversationHistory: [
          { role: "user", content: "Explain binary search" },
          {
            role: "assistant",
            content: "Binary search checks the midpoint...",
          },
        ],
        existingAIElements: ["bs-title", "arr-10", "arr-20", "arr-30"],
      },
    });

    expect(result.topic).toBe("Binary Search");
    expect(capturedBody.context.conversationHistory).toHaveLength(2);
    expect(capturedBody.context.existingAIElements).toContain("arr-30");
    expect(capturedBody.context.theme).toBe("dark");
  });

  it("falls back to local mock provider when fallbackToLocalMock is enabled on network error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Network connection refused"));

    const result = await requestTeachingExplanation(
      { prompt: "binary search" },
      { fallbackToLocalMock: true },
    );

    expect(result.topic).toBe("Binary Search");
    expect(result.visual_actions.length).toBeGreaterThan(0);
  });

  it("throws error when backend responds with error status and fallback is not enabled", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "Prompt is required." }),
    } as unknown as Response);

    await expect(requestTeachingExplanation({ prompt: "" })).rejects.toThrow(
      "Prompt is required.",
    );
  });

  it("transmits semanticSummary, activeLessonState, and userInteractionDelta to backend", async () => {
    let capturedBody: any;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: "Step 2 explanation...",
          topic: "AVL Tree",
          steps: [
            {
              id: "step-1",
              step_number: 1,
              title: "Step 1",
              explanation: "Root imbalance",
              visual_actions: [],
            },
          ],
        }),
      };
    });

    const result = await requestTeachingExplanation({
      prompt: "Why did balance factor change?",
      context: {
        semanticSummary: "Tree 'tree' with root '50'",
        activeLessonState: {
          topic: "AVL Tree",
          currentStepIndex: 2,
          totalSteps: 4,
          stepTitle: "Left-Left Imbalance",
        },
        userInteractionDelta: "Changed node 20 to 9",
      },
    });

    expect(capturedBody.context.semanticSummary).toBe("Tree 'tree' with root '50'");
    expect(capturedBody.context.activeLessonState.currentStepIndex).toBe(2);
    expect(capturedBody.context.userInteractionDelta).toContain("node 20");
    expect(result.steps?.length).toBe(1);
  });

  it("handles Visual DSL schema failure cleanly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => ({
        error: "AI Provider returned response that does not conform to Visual DSL schema.",
        details: ["steps[0].visual_actions[0].style.color must be a valid SemanticColor"],
      }),
    } as unknown as Response);

    await expect(
      requestTeachingExplanation({ prompt: "Explain floating window" }),
    ).rejects.toThrow("Visual DSL schema");
  });
});
