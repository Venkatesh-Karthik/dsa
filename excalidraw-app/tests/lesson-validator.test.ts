import { describe, it, expect } from "vitest";
import {
  estimatePromptComplexity,
  validateLessonQuality,
} from "../ai/backend/lesson-validator";
import type { TeachingResponse } from "../ai/teaching-contract";

describe("estimatePromptComplexity", () => {
  it("detects conceptual queries without hardcoding specific topics", () => {
    const r1 = estimatePromptComplexity("Explain binary trees");
    expect(r1.isConceptual).toBe(true);
    expect(r1.complexity).toBeGreaterThanOrEqual(3);
    expect(r1.targetStepRange.target).toBeGreaterThanOrEqual(6);

    const r2 = estimatePromptComplexity("Explain what a floating window is");
    expect(r2.isConceptual).toBe(true);
    expect(r2.complexity).toBeGreaterThanOrEqual(3);

    const r3 = estimatePromptComplexity("Teach me how LRU cache works");
    expect(r3.isConceptual).toBe(true);
    expect(r3.complexity).toBeGreaterThanOrEqual(3);
  });

  it("detects explicit step-by-step requests", () => {
    const res = estimatePromptComplexity("Explain binary search visually step by step");
    expect(res.isStepByStepRequested).toBe(true);
    expect(res.complexity).toBeGreaterThanOrEqual(4);
    expect(res.targetStepRange.min).toBeGreaterThanOrEqual(5);
  });

  it("handles trivial property lookups as low complexity", () => {
    const res = estimatePromptComplexity("what is the time complexity of binary search?");
    expect(res.complexity).toBe(1);
    expect(res.minExpectedSteps).toBe(1);
  });
});

describe("validateLessonQuality", () => {
  it("flags needsExpansion when only 1 step is returned for conceptual request", () => {
    const mockResponse: TeachingResponse = {
      message: "Here is a binary tree",
      visual_actions: [
        {
          type: "create_tree",
          id: "tree-1",
          root: "10",
          nodes: [{ id: "10", value: 10 }],
        },
      ],
      steps: [
        {
          id: "step-1",
          title: "Introduction",
          explanation: "This is a binary tree with a single node.",
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

    const quality = validateLessonQuality(mockResponse, "Explain binary trees step by step");
    expect(quality.needsExpansion).toBe(true);
    expect(quality.valid).toBe(false);
    expect(quality.issues.some((i) => i.includes("Target is 6-8 steps"))).toBe(true);
  });

  it("passes when multi-step progressive lesson is provided", () => {
    const mockResponse: TeachingResponse = {
      message: "Here is binary search explained progressively",
      visual_actions: [],
      steps: [
        {
          id: "step-1",
          step_number: 1,
          title: "Initial Array",
          explanation: "Sorted array with bounds.",
          visual_actions: [
            {
              type: "create_array",
              id: "arr",
              elements: [{ value: 1 }, { value: 3 }, { value: 5 }],
            },
          ],
        },
        {
          id: "step-2",
          step_number: 2,
          title: "Calculate Midpoint",
          explanation: "Mid is computed.",
          visual_actions: [
            {
              type: "annotate_pointer",
              id: "ptr-mid",
              label: "MID",
              target: "arr-1",
              placement: "above",
            },
          ],
        },
        {
          id: "step-3",
          step_number: 3,
          title: "Compare Target",
          explanation: "Compare target with mid.",
          visual_actions: [
            {
              type: "highlight",
              target: "arr-1",
              color: "accent",
            },
          ],
        },
      ],
    };

    const quality = validateLessonQuality(mockResponse, "What is binary search?");
    expect(quality.needsExpansion).toBe(false);
    expect(quality.valid).toBe(true);
    expect(quality.hasVisualDelta).toBe(true);
  });

  it("detects lack of visual delta if all steps have identical action sets", () => {
    const identicalActions = [
      {
        type: "create_box" as const,
        id: "box-1",
        label: "Same Box",
      },
    ];

    const mockResponse: TeachingResponse = {
      message: "Same diagram repeated",
      visual_actions: identicalActions,
      steps: [
        { id: "s1", title: "Step 1", explanation: "Expl 1", visual_actions: identicalActions },
        { id: "s2", title: "Step 2", explanation: "Expl 2", visual_actions: identicalActions },
        { id: "s3", title: "Step 3", explanation: "Expl 3", visual_actions: identicalActions },
      ],
    };

    const quality = validateLessonQuality(mockResponse, "Explain something");
    expect(quality.hasVisualDelta).toBe(false);
    expect(quality.issues.some((i) => i.includes("identical visual diagrams"))).toBe(true);
  });
});
