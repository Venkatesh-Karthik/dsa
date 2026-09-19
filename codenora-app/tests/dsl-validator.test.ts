import { describe, it, expect } from "vitest";

import {
  validateTeachingRequest,
  validateTeachingResponse,
  validateVisualAction,
  validateActionReferences,
  sortActionsByDependency,
  repairOrReorderActions,
  repairOrReorderActionsDetails,
  normalizeSemanticColor,
  normalizePlacement,
  normalizePointerPlacement,
  normalizeArrowDirection,
  normalizeSemanticSize,
  normalizeSemanticFill,
  normalizeSemanticStrokeStyle,
  normalizeArrayElementHighlight,
  normalizeVisualAction,
  normalizeTeachingResponse,
  MAX_VISUAL_ACTIONS,
  MAX_EXPLANATION_STEPS,
} from "../ai/backend/dsl-validator";

describe("DSL Validator", () => {
  describe("validateTeachingRequest", () => {
    it("accepts valid requests", () => {
      const res = validateTeachingRequest({ prompt: "Explain binary search" });
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
      expect(res.data?.prompt).toBe("Explain binary search");
    });

    it("rejects non-object bodies", () => {
      const res = validateTeachingRequest("invalid string");
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("JSON object");
    });

    it("rejects empty prompt", () => {
      const res = validateTeachingRequest({ prompt: "   " });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("non-empty string");
    });

    it("accepts valid context with conversationHistory and existingAIElements", () => {
      const res = validateTeachingRequest({
        prompt: "Highlight target",
        context: {
          currentElementsCount: 5,
          theme: "dark",
          conversationHistory: [
            { role: "user", content: "Explain binary search" },
            { role: "assistant", content: "Here is an array..." },
          ],
          existingAIElements: ["arr-0", "arr-1", "arr-2"],
        },
      });
      expect(res.valid).toBe(true);
      expect(res.data?.context?.conversationHistory).toHaveLength(2);
      expect(res.data?.context?.existingAIElements).toHaveLength(3);
    });

    it("rejects prompt exceeding maximum length", () => {
      const longPrompt = "a".repeat(4001);
      const res = validateTeachingRequest({ prompt: longPrompt });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("exceeds maximum length");
    });

    it("rejects malformed conversationHistory and existingAIElements", () => {
      const res1 = validateTeachingRequest({
        prompt: "Test",
        context: { conversationHistory: "not-an-array" as unknown as [] },
      });
      expect(res1.valid).toBe(false);
      expect(res1.errors[0]).toContain("conversationHistory");

      const res2 = validateTeachingRequest({
        prompt: "Test",
        context: {
          conversationHistory: [{ invalid: "shape" }] as unknown as [],
        },
      });
      expect(res2.valid).toBe(false);
      expect(res2.errors[0]).toContain("must have role and content");

      const res3 = validateTeachingRequest({
        prompt: "Test",
        context: { existingAIElements: [123] as unknown as string[] },
      });
      expect(res3.valid).toBe(false);
      expect(res3.errors[0]).toContain("existingAIElements");
    });
  });

  describe("validateVisualAction", () => {
    it("validates valid create_box action", () => {
      const seen = new Set<string>();
      const errors = validateVisualAction(
        {
          type: "create_box",
          id: "box-1",
          label: "Item",
          style: { color: "primary", size: "md" },
        },
        0,
        seen,
      );
      expect(errors).toEqual([]);
      expect(seen.has("box-1")).toBe(true);
    });

    it("flags duplicate creation IDs", () => {
      const seen = new Set<string>(["box-1"]);
      const errors = validateVisualAction(
        {
          type: "create_box",
          id: "box-1",
          label: "Duplicate",
        },
        1,
        seen,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("duplicated");
    });

    it("flags missing id on creation actions", () => {
      const seen = new Set<string>();
      const errors = validateVisualAction(
        {
          type: "create_circle",
          label: "No ID",
        },
        0,
        seen,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("non-empty string");
    });

    it("flags missing target on manipulation actions", () => {
      const seen = new Set<string>();
      const errors = validateVisualAction(
        {
          type: "highlight",
          color: "warning",
        },
        0,
        seen,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("target");
    });

    it("flags labels exceeding maximum length limit", () => {
      const seen = new Set<string>();
      const longLabel = "x".repeat(301);
      const errors = validateVisualAction(
        {
          type: "create_box",
          id: "box-long",
          label: longLabel,
        },
        0,
        seen,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("exceeds maximum length");
    });

    it("flags text exceeding maximum length limit", () => {
      const seen = new Set<string>();
      const longText = "y".repeat(301);
      const errors = validateVisualAction(
        {
          type: "create_text",
          id: "txt-long",
          text: longText,
        },
        0,
        seen,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("exceeds maximum length");
    });

    it("flags invalid arrow directions and missing endpoints", () => {
      const seen = new Set<string>();
      const errors = validateVisualAction(
        {
          type: "create_arrow",
          id: "arr-1",
          from: "a",
          to: "b",
          direction: "sideways", // invalid
        },
        0,
        seen,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("direction");
    });

    it("flags invalid placement", () => {
      const seen = new Set<string>();
      const errors = validateVisualAction(
        {
          type: "create_box",
          id: "box-2",
          position: { relativeTo: "box-1", placement: "diagonal_left" },
        },
        0,
        seen,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("placement");
    });
    it("validates compound actions correctly", () => {
      const seen = new Set<string>();

      const actions = [
        {
          type: "create_tree",
          id: "t1",
          root: "r1",
          nodes: [{ id: "r1", value: 1 }],
        },
        {
          type: "create_matrix",
          id: "m1",
          rows: [
            [1, 2],
            [3, 4],
          ],
        },
        {
          type: "create_graph",
          id: "g1",
          nodes: [{ id: "n1", label: "A" }],
          edges: [],
        },
      ];

      for (const act of actions) {
        const errors = validateVisualAction(act, 0, seen);
        expect(errors).toEqual([]);
      }
    });
  });

  describe("validateTeachingResponse", () => {
    it("accepts well-formed response with explanation_steps", () => {
      const res = validateTeachingResponse({
        message: "Binary search explanation.",
        topic: "Binary Search",
        explanation_steps: [
          "Step 1: Check midpoint",
          "Step 2: Discard left half",
        ],
        visual_actions: [
          {
            type: "create_box",
            id: "node-1",
            label: "Midpoint",
          },
        ],
      });
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
      expect(res.data?.topic).toBe("Binary Search");
      expect(res.data?.explanation_steps).toHaveLength(2);
    });

    it("rejects response when visual_actions exceeds safety limit", () => {
      const actions = Array.from(
        { length: MAX_VISUAL_ACTIONS + 1 },
        (_, i) => ({
          type: "create_box",
          id: `box-${i}`,
          label: `Box ${i}`,
        }),
      );
      const res = validateTeachingResponse({
        message: "Too many actions",
        visual_actions: actions,
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain(
        `exceeds safety limit of ${MAX_VISUAL_ACTIONS} actions`,
      );
    });

    it("rejects response when explanation_steps exceeds safety limit", () => {
      const steps = Array.from(
        { length: MAX_EXPLANATION_STEPS + 1 },
        (_, i) => `Step ${i}`,
      );
      const res = validateTeachingResponse({
        message: "Too many steps",
        visual_actions: [],
        explanation_steps: steps,
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain(
        `exceeds safety limit of ${MAX_EXPLANATION_STEPS} steps`,
      );
    });

    it("rejects response without message", () => {
      const res = validateTeachingResponse({
        message: "",
        visual_actions: [],
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("message");
    });

    it("rejects response when visual_actions is not an array", () => {
      const res = validateTeachingResponse({
        message: "A concept.",
        visual_actions: "not an array",
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("visual_actions");
    });
  });

  describe("validateActionReferences", () => {
    it("passes when all references exist within the batch", () => {
      const actions = [
        { type: "create_box", id: "box-1", label: "A" },
        {
          type: "create_box",
          id: "box-2",
          label: "B",
          position: { relativeTo: "box-1", placement: "right_of" },
        },
        { type: "create_arrow", id: "arr-1", from: "box-1", to: "box-2" },
        { type: "highlight", target: "box-2" },
      ];

      const res = validateActionReferences(actions);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it("passes when references exist in pre-existing canvas IDs", () => {
      const actions = [
        { type: "highlight", target: "existing-canvas-box" },
        {
          type: "create_arrow",
          id: "arr-new",
          from: "existing-canvas-box",
          to: "new-box",
        },
        { type: "create_box", id: "new-box", label: "New" },
      ];

      const res = validateActionReferences(actions, ["existing-canvas-box"]);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it("passes when references point to sub-elements of compound actions", () => {
      const actions = [
        {
          type: "create_tree",
          id: "tr",
          root: "root",
          nodes: [
            { id: "root", value: "A" },
            { id: "left", value: "B" },
          ],
        },
        { type: "highlight", target: "tr-root" },
        { type: "create_arrow", id: "arr1", from: "tr-left", to: "tr-root" },
      ];

      const res = validateActionReferences(actions);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it("catches unknown highlight target with informative error", () => {
      const actions = [
        { type: "create_box", id: "arr-10", label: "10" },
        { type: "highlight", target: "arr-30" },
      ];

      const res = validateActionReferences(actions);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain(
        "Highlight target 'arr-30' does not exist in visual actions or canvas",
      );
      expect(res.errors[0]).toContain("arr-10");
    });

    it("catches unknown arrow source and target", () => {
      const actions = [
        { type: "create_arrow", id: "arrow-x", from: "ghost-1", to: "ghost-2" },
      ];

      const res = validateActionReferences(actions);
      expect(res.valid).toBe(false);
      expect(res.errors).toHaveLength(2);
      expect(res.errors[0]).toContain("references unknown source 'ghost-1'");
      expect(res.errors[1]).toContain("references unknown target 'ghost-2'");
    });
  });

  describe("sortActionsByDependency", () => {
    it("topologically sorts creations before arrows and highlights", () => {
      const actions = [
        { type: "highlight", target: "b" },
        { type: "create_arrow", id: "arr", from: "a", to: "b" },
        {
          type: "create_box",
          id: "b",
          label: "B",
          position: { relativeTo: "a", placement: "right_of" },
        },
        { type: "create_box", id: "a", label: "A" },
      ];

      const sorted = sortActionsByDependency(actions);
      const types = sorted.map((a: any) => a.type);
      const ids = sorted.map((a: any) => a.id ?? a.target);

      // Both creations must come before arrow and highlight
      expect(types.slice(0, 2)).toEqual(["create_box", "create_box"]);
      // 'a' must precede 'b' because 'b' is relativeTo 'a'
      expect(ids[0]).toBe("a");
      expect(ids[1]).toBe("b");
      // arrow and highlight come after
      expect(types[2]).toBe("create_arrow");
      expect(types[3]).toBe("highlight");
    });
  });

  describe("repairOrReorderActions", () => {
    it("repairs target referencing value or label to matching DSL ID", () => {
      const actions = [
        { type: "create_box", id: "arr-2", label: "30 [MID]" },
        { type: "highlight", target: "arr-30" }, // Referenced as arr-30 instead of arr-2
      ];

      const details = repairOrReorderActionsDetails(actions);
      expect(details.repaired).toBe(true);
      expect((details.actions[1] as any).target).toBe("arr-2");
      expect(details.warnings[0]).toContain("arr-30");

      const direct = repairOrReorderActions(actions);
      expect((direct[1] as any).target).toBe("arr-2");
    });

    it("repairs arrow targets referencing labels", () => {
      const actions = [
        { type: "create_box", id: "node-root", label: "Root" },
        { type: "create_box", id: "node-left", label: "Left" },
        { type: "create_arrow", id: "a1", from: "root", to: "left" },
      ];

      const repaired = repairOrReorderActions(actions);
      const arrow = repaired.find((a: any) => a.id === "a1") as any;
      expect(arrow.from).toBe("node-root");
      expect(arrow.to).toBe("node-left");
    });
  });

  describe("Dynamic Multi-Step Teaching Validation", () => {
    it("validates TeachingResponse with dynamic steps containing calculations and insights", () => {
      const response = {
        message: "Here is how binary search works step by step.",
        topic: "Binary Search",
        explanation_steps: ["Initialize low and high", "Calculate midpoint"],
        steps: [
          {
            id: "step-1",
            step_number: 1,
            title: "Initialize Pointers",
            explanation: "Set LOW to index 0 and HIGH to index 4.",
            calculations: "low = 0, high = 4",
            insight: "Search space covers the entire array of size 5.",
            visual_actions: [
              {
                type: "create_array",
                id: "arr",
                elements: [
                  { value: 10 },
                  { value: 20 },
                  { value: 30 },
                  { value: 40 },
                  { value: 50 },
                ],
              },
              {
                type: "annotate_pointer",
                id: "ptr-low",
                target: "arr-0",
                label: "LOW",
                placement: "above",
              },
            ],
          },
          {
            id: "step-2",
            step_number: 2,
            title: "Calculate Midpoint",
            explanation:
              "Compute mid = (0 + 4) / 2 = 2. Check value at arr[2].",
            calculations: "mid = (0 + 4) / 2 = 2, arr[2] = 30",
            insight: "One comparison halves the candidate elements.",
            visual_actions: [
              {
                type: "annotate_pointer",
                id: "ptr-mid",
                target: "arr-2",
                label: "MID",
                placement: "above",
              },
            ],
          },
        ],
      };

      const result = validateTeachingResponse(response);
      expect(result.valid).toBe(true);
      expect(result.data?.steps?.length).toBe(2);
      expect(result.data?.steps?.[0].calculations).toBe("low = 0, high = 4");
      expect(result.data?.steps?.[1].insight).toContain("halves the candidate");
    });

    it("validates create_explanation_block action", () => {
      const action = {
        type: "create_explanation_block",
        id: "lesson-card",
        title: "AVL Left-Left Rotation",
        stepNumber: 2,
        totalSteps: 4,
        explanation: "Perform a right rotation around node 50.",
        calculations: "Balance factor = +2",
        insight: "Right rotation restores balance factor to 0 in O(1) time.",
      };

      const errors = validateVisualAction(action as any, 0, new Set());
      expect(errors).toEqual([]);
    });

    it("normalizes and validates responses with arbitrary raw colors and placements", () => {
      // Test payload representative of arbitrary concepts like "floating window"
      const rawResponse = {
        topic: "Floating Window Architecture",
        message:
          "A floating window moves independently and remains above content.",
        steps: [
          {
            id: "step-1",
            step_number: 1,
            title: "Independent Window Layer",
            explanation:
              "The window floats above the desktop and other application windows.",
            calculations: "z-index = 1000, position = relative",
            insight: "Floating windows have independent coordinate systems.",
            visual_actions: [
              {
                type: "create_box",
                id: "desktop-bg",
                label: "Desktop Canvas",
                style: {
                  color: "gray", // raw color
                  fill: "filled", // raw fill
                },
              },
              {
                type: "create_box",
                id: "floating-win",
                label: "Floating Window [Active]",
                position: {
                  relativeTo: "desktop-bg",
                  placement: "inside",
                },
                style: {
                  color: "blue", // raw color
                  size: "large", // raw size
                },
              },
              {
                type: "annotate_pointer",
                id: "ptr-focus",
                label: "FOCUSED",
                target: "floating-win",
                placement: "right", // pointer placement right
                color: "orange", // raw color
              },
            ],
          },
        ],
      };

      const result = validateTeachingResponse(rawResponse);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);

      const actions = result.data?.steps?.[0].visual_actions as any[];
      expect(actions[0].style.color).toBe("neutral"); // "gray" -> "neutral"
      expect(actions[0].style.fill).toBe("solid"); // "filled" -> "solid"
      expect(actions[1].style.color).toBe("primary"); // "blue" -> "primary"
      expect(actions[1].style.size).toBe("lg"); // "large" -> "lg"
      expect(actions[2].placement).toBe("right"); // "right" is valid pointer placement
      expect(actions[2].color).toBe("accent"); // "orange" -> "accent"
    });
  });

  describe("Generic DSL Normalization Functions", () => {
    it("normalizes colors across all semantic families", () => {
      // Exact matches pass through
      expect(normalizeSemanticColor("primary")).toBe("primary");
      expect(normalizeSemanticColor("danger")).toBe("danger");
      expect(normalizeSemanticColor("neutral")).toBe("neutral");

      // Blue family
      expect(normalizeSemanticColor("blue")).toBe("primary");
      expect(normalizeSemanticColor("navy")).toBe("primary");
      expect(normalizeSemanticColor("sky")).toBe("primary");

      // Cyan family
      expect(normalizeSemanticColor("cyan")).toBe("info");
      expect(normalizeSemanticColor("teal")).toBe("info");

      // Red family
      expect(normalizeSemanticColor("red")).toBe("danger");
      expect(normalizeSemanticColor("crimson")).toBe("danger");
      expect(normalizeSemanticColor("pink")).toBe("danger");

      // Green family
      expect(normalizeSemanticColor("green")).toBe("success");
      expect(normalizeSemanticColor("lime")).toBe("success");
      expect(normalizeSemanticColor("emerald")).toBe("success");

      // Yellow family
      expect(normalizeSemanticColor("yellow")).toBe("warning");
      expect(normalizeSemanticColor("amber")).toBe("warning");

      // Orange family
      expect(normalizeSemanticColor("orange")).toBe("accent");

      // Purple family
      expect(normalizeSemanticColor("purple")).toBe("secondary");
      expect(normalizeSemanticColor("violet")).toBe("secondary");

      // Gray family
      expect(normalizeSemanticColor("gray")).toBe("neutral");
      expect(normalizeSemanticColor("grey")).toBe("neutral");
      expect(normalizeSemanticColor("black")).toBe("neutral");

      // White / clear / hex family
      expect(normalizeSemanticColor("white")).toBe("default");
      expect(normalizeSemanticColor("#1971c2")).toBe("default");
      expect(normalizeSemanticColor("rgba(0,0,0,0.5)")).toBe("default");

      // Unknown string fallback to default
      expect(normalizeSemanticColor("mysterious_tone")).toBe("default");

      // Non-strings / empty
      expect(normalizeSemanticColor(undefined)).toBeUndefined();
      expect(normalizeSemanticColor(null)).toBeUndefined();
      expect(normalizeSemanticColor("")).toBeUndefined();
    });

    it("normalizes placement and spatial directions", () => {
      expect(normalizePlacement("right")).toBe("right_of");
      expect(normalizePlacement("left")).toBe("left_of");
      expect(normalizePlacement("top")).toBe("above");
      expect(normalizePlacement("up")).toBe("above");
      expect(normalizePlacement("bottom")).toBe("below");
      expect(normalizePlacement("down")).toBe("below");
      expect(normalizePlacement("center")).toBe("center");
      expect(normalizePlacement("middle")).toBe("center");
      expect(normalizePlacement("inside")).toBe("inside");

      expect(normalizePointerPlacement("left")).toBe("left");
      expect(normalizePointerPlacement("right")).toBe("right");
      expect(normalizePointerPlacement("top")).toBe("above");
      expect(normalizePointerPlacement("bottom")).toBe("below");

      expect(normalizeArrowDirection("to")).toBe("forward");
      expect(normalizeArrowDirection("from")).toBe("backward");
      expect(normalizeArrowDirection("both")).toBe("bidirectional");
      expect(normalizeArrowDirection("none")).toBe("none");
    });

    it("normalizes sizes, fills, strokes, and element highlights", () => {
      expect(normalizeSemanticSize("small")).toBe("sm");
      expect(normalizeSemanticSize("medium")).toBe("md");
      expect(normalizeSemanticSize("large")).toBe("lg");
      expect(normalizeSemanticSize("huge")).toBe("xl");

      expect(normalizeSemanticFill("filled")).toBe("solid");
      expect(normalizeSemanticFill("outline")).toBe("transparent");
      expect(normalizeSemanticFill("half")).toBe("semi");

      expect(normalizeSemanticStrokeStyle("dash")).toBe("dashed");
      expect(normalizeSemanticStrokeStyle("dot")).toBe("dotted");

      expect(normalizeArrayElementHighlight("active")).toBe("target");
      expect(normalizeArrayElementHighlight("yellow")).toBe("mid");
      expect(normalizeArrayElementHighlight("green")).toBe("found");
      expect(normalizeArrayElementHighlight("red")).toBe("eliminated");
    });

    it("normalizes single actions cleanly", () => {
      const rawAction = {
        type: "create_box",
        id: "box-test",
        label: "Window",
        position: { relativeTo: "anchor", placement: "right" },
        style: {
          color: "blue",
          size: "small",
          fill: "outline",
          strokeStyle: "dash",
        },
      };

      const normalized = normalizeVisualAction(rawAction) as any;
      expect(normalized.position.placement).toBe("right_of");
      expect(normalized.style.color).toBe("primary");
      expect(normalized.style.size).toBe("sm");
      expect(normalized.style.fill).toBe("transparent");
      expect(normalized.style.strokeStyle).toBe("dashed");
    });

    it("normalizes an entire TeachingResponse object", () => {
      const unnormalized = {
        message: "Demo",
        visual_actions: [
          {
            type: "create_box",
            id: "b1",
            label: "B1",
            style: { color: "red" },
          },
        ],
        steps: [
          {
            id: "s1",
            title: "S1",
            explanation: "E1",
            visual_actions: [
              {
                type: "create_box",
                id: "b2",
                label: "B2",
                style: { color: "green" },
              },
            ],
          },
        ],
      };

      const normalized = normalizeTeachingResponse(unnormalized) as any;
      expect(normalized.visual_actions[0].style.color).toBe("danger");
      expect(normalized.steps[0].visual_actions[0].style.color).toBe("success");
    });

    it("normalizes shorthand array, tree, text, and mutation actions", () => {
      const shorthandArray = normalizeVisualAction({
        type: "array",
        id: "heapArray",
        values: [10, 20],
      }) as any;
      expect(shorthandArray.type).toBe("create_array");
      expect(shorthandArray.elements).toHaveLength(2);
      expect(shorthandArray.elements[0].value).toBe("10");

      const shorthandTree = normalizeVisualAction({
        type: "tree",
        id: "heapTree",
        nodes: [],
      }) as any;
      expect(shorthandTree.type).toBe("create_tree");
      expect(shorthandTree.root).toBe("root");
      expect(shorthandTree.nodes).toHaveLength(1);

      const shorthandText = normalizeVisualAction({
        type: "text",
        id: "status",
        content: "Hello World",
      }) as any;
      expect(shorthandText.type).toBe("create_text");
      expect(shorthandText.text).toBe("Hello World");

      const addNodeAct = normalizeVisualAction({
        type: "addNode",
        target: "tree",
        nodeId: "n1",
        value: 42,
      }) as any;
      expect(addNodeAct.type).toBe("create_circle");
      expect(addNodeAct.id).toBe("tree-n1");
      expect(addNodeAct.label).toBe("42");

      const addEdgeAct = normalizeVisualAction({
        type: "addEdge",
        target: "tree",
        from: "n1",
        to: "n2",
      }) as any;
      expect(addEdgeAct.type).toBe("create_arrow");
      expect(addEdgeAct.from).toBe("tree-n1");
      expect(addEdgeAct.to).toBe("tree-n2");

      const violationHl = normalizeVisualAction({
        type: "highlight",
        target: "tree",
        nodeIds: ["n1"],
        style: "violation",
      }) as any;
      expect(violationHl.color).toBe("danger");
      expect(violationHl.target).toBe("tree-n1");
    });

    it("normalizes visualLesson transformations with actions and handles truncated trailing steps", () => {
      const lessonWithTransformations = {
        topic: "Heap Demonstration",
        message: "Explaining heap",
        visualLesson: {
          id: "vl-1",
          title: "Heap Lesson",
          initialScene: [
            { type: "array", id: "arr", values: [] },
            { type: "text", id: "txt", content: "Empty" },
          ],
          transformations: [
            {
              step: 1,
              description: "Insert 10: becomes root.",
              actions: [
                { type: "addNode", target: "tree", nodeId: "n0", value: 10 },
                { type: "updateArray", target: "arr", values: [10] },
              ],
            },
            {
              step: 2,
              description: "Truncated step ending prematurely,",
              actions: [],
            },
          ],
        },
      };

      const normalized = normalizeTeachingResponse(
        lessonWithTransformations,
      ) as any;
      expect(normalized.visual_actions).toHaveLength(2);
      expect(normalized.visual_actions[0].type).toBe("create_array");

      // The truncated step 2 should be pruned
      expect(normalized.visualLesson.transformations).toHaveLength(1);
      const t1 = normalized.visualLesson.transformations[0];
      expect(t1.id).toBe("t-1");
      expect(t1.title).toBe("Insert 10");
      expect(t1.explanation).toBe("Insert 10: becomes root.");
      expect(t1.operations).toHaveLength(2);
      expect(t1.operations[0].type).toBe("create_circle");

      // Verify the entire response validates cleanly
      const validation = validateTeachingResponse(normalized);
      expect(validation.valid).toBe(true);
    });
  });
});
