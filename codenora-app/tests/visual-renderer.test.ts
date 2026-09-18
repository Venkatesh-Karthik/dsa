import { describe, it, expect } from "vitest";

import {
  renderActions,
  runExampleBinarySearchTest,
  mapStrokeColor,
  mapBackgroundColor,
  RenderContext,
  LAYOUT,
  getElementBounds,
  getCenter,
  getTop,
  getBottom,
} from "../ai/visual-renderer";

import type { VisualAction } from "../ai/visual-dsl";

describe("Visual Teaching Renderer", () => {
  it("renders the hardcoded Binary Search -> Sorted Array example deterministically", () => {
    const result = runExampleBinarySearchTest();

    expect(result.errors).toEqual([]);
    // node-1 (box + text), node-2 (box + text), arrow-1 (arrow) -> 5 elements
    expect(result.elements.length).toBe(5);

    const node1Record = result.registry.get("node-1");
    const node2Record = result.registry.get("node-2");
    const arrowRecord = result.registry.get("arrow-1");

    expect(node1Record).toBeDefined();
    expect(node2Record).toBeDefined();
    expect(arrowRecord).toBeDefined();

    // Verify node-1 (Binary Search)
    expect(node1Record!.primaryElement.type).toBe("rectangle");
    expect(node1Record!.textElement?.text).toBe("Binary Search");
    expect(node1Record!.bounds.x).toBe(100);
    expect(node1Record!.bounds.y).toBe(100);

    // Verify node-2 (Sorted Array) placed below node-1
    expect(node2Record!.primaryElement.type).toBe("rectangle");
    expect(node2Record!.textElement?.text).toBe("Sorted Array");
    expect(node2Record!.bounds.x).toBe(100); // Centered under node-1
    expect(node2Record!.bounds.y).toBe(240); // 100 + 80 + 60 = 240

    // Verify arrow connecting bottom of node-1 to top of node-2
    expect(arrowRecord!.primaryElement.type).toBe("arrow");
    const arrow = arrowRecord!.primaryElement as any;
    expect(arrow.x).toBe(190); // Center X of node-1 (100 + 90)
    expect(arrow.y).toBe(180); // Bottom Y of node-1 (100 + 80)
    expect(arrow.endArrowhead).toBe("arrow");
    expect(arrow.points[1]).toEqual([0, 60]); // Vector pointing down 60px to node-2 top (240)
  });

  it("renders create_box with custom semantic styles and labels", () => {
    const actions: VisualAction[] = [
      {
        type: "create_box",
        id: "box-success",
        label: "Accepted",
        role: "callout",
        style: {
          color: "success",
          size: "lg",
        },
      },
    ];

    const result = renderActions(actions);
    expect(result.elements.length).toBe(2);

    const box = result.elements[0];
    const text = result.elements[1];

    expect(box.type).toBe("rectangle");
    expect(box.width).toBe(230); // 'lg' width
    expect(box.height).toBe(100); // 'lg' height
    expect(box.strokeColor).toBe(mapStrokeColor("success"));
    expect(box.backgroundColor).toBe(mapBackgroundColor("success"));

    expect(text.type).toBe("text");
    expect((text as any).text).toBe("Accepted");
  });

  it("renders create_circle with centered text", () => {
    const actions: VisualAction[] = [
      {
        type: "create_circle",
        id: "circle-1",
        label: "Root",
        role: "tree-node",
        style: {
          color: "primary",
          size: "md",
        },
      },
    ];

    const result = renderActions(actions);
    expect(result.elements.length).toBe(2);

    const circle = result.elements[0];
    const text = result.elements[1];

    expect(circle.type).toBe("ellipse");
    expect(circle.width).toBe(85);
    expect(circle.height).toBe(85);
    expect((text as any).text).toBe("Root");
  });

  it("renders create_text as standalone annotation", () => {
    const actions: VisualAction[] = [
      {
        type: "create_text",
        id: "note-1",
        text: "Time Complexity: O(log N)",
        role: "annotation",
        style: {
          color: "warning",
          size: "sm",
        },
      },
    ];

    const result = renderActions(actions);
    expect(result.elements.length).toBe(1);
    expect(result.elements[0].type).toBe("text");
    expect((result.elements[0] as any).text).toBe("Time Complexity: O(log N)");
  });

  it("handles arrows with labels and bidirectional direction", () => {
    const actions: VisualAction[] = [
      { type: "create_box", id: "left", label: "A" },
      {
        type: "create_box",
        id: "right",
        label: "B",
        position: { relativeTo: "left", placement: "right_of" },
      },
      {
        type: "create_arrow",
        id: "bidir-arrow",
        from: "left",
        to: "right",
        label: "sync",
        direction: "bidirectional",
      },
    ];

    const result = renderActions(actions);
    const arrowRecord = result.registry.get("bidir-arrow");
    expect(arrowRecord).toBeDefined();

    const arrow = arrowRecord!.primaryElement as any;
    expect(arrow.startArrowhead).toBe("arrow");
    expect(arrow.endArrowhead).toBe("arrow");

    // Label element exists
    expect(arrowRecord!.textElement?.text).toBe("sync");
  });

  it("fails gracefully with error when arrow target is missing", () => {
    const actions: VisualAction[] = [
      { type: "create_box", id: "node-a", label: "A" },
      {
        type: "create_arrow",
        id: "broken-arrow",
        from: "node-a",
        to: "non-existent-node",
      },
    ];

    const result = renderActions(actions);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("non-existent-node");
    expect(result.elements.length).toBe(2); // Only node-a (box + text) rendered
  });

  it("renders highlight overlay on target element with exact bounds", () => {
    const actions: VisualAction[] = [
      { type: "create_box", id: "target-box", label: "Target" },
      {
        type: "highlight",
        target: "target-box",
        color: "danger",
        message: "Active Item",
      },
    ];

    const result = renderActions(actions);
    // box + text + highlight-rect + highlight-message = 4
    expect(result.elements.length).toBe(4);

    const highlightRect = result.elements.find(
      (e) => (e.customData as any)?.dslId === "highlight-target-box",
    );
    expect(highlightRect).toBeDefined();
    expect(highlightRect?.type).toBe("rectangle");
    expect(highlightRect?.strokeColor).toBe(mapStrokeColor("danger"));

    // Verify highlight uses EXACT target bounds (4px pad, not 8px+)
    const targetRecord = result.registry.get("target-box");
    expect(targetRecord).toBeDefined();
    const pad = 4;
    expect(highlightRect!.x).toBe(targetRecord!.bounds.x - pad);
    expect(highlightRect!.y).toBe(targetRecord!.bounds.y - pad);
    expect(highlightRect!.width).toBe(targetRecord!.bounds.width + pad * 2);
    expect(highlightRect!.height).toBe(targetRecord!.bounds.height + pad * 2);
  });

  it("emits error (NOT a phantom box) when highlight target is missing", () => {
    const actions: VisualAction[] = [
      {
        type: "highlight",
        target: "nonexistent-element",
        color: "warning",
        message: "Should fail cleanly",
      },
    ];

    const result = renderActions(actions);
    // No elements should be created — no fallback synthesis
    expect(result.elements.length).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("nonexistent-element");
    expect(result.registry.has("nonexistent-element")).toBe(false);
  });

  it("handles delete, move, and resize actions", () => {
    const actions: VisualAction[] = [
      { type: "create_box", id: "item-1", label: "Item 1" },
      { type: "create_box", id: "item-2", label: "Item 2" },
      { type: "resize", target: "item-1", size: "lg" },
      {
        type: "move",
        target: "item-1",
        destination: { placement: "below", relativeTo: "item-2" },
      },
      { type: "delete", target: "item-2" },
    ];

    const result = renderActions(actions);
    expect(result.registry.has("item-2")).toBe(false);
    expect(result.registry.has("item-1")).toBe(true);

    const item1 = result.registry.get("item-1")!;
    expect(item1.primaryElement.width).toBe(230); // Resized to 'lg'
  });

  it("resolves semantic aliases (arr-30 -> arr-2, label, lowercase) in RenderContext", () => {
    const actions: VisualAction[] = [
      {
        type: "create_box",
        id: "arr-2",
        label: "30 [MID]",
        role: "array-element",
      },
    ];

    const context = new RenderContext();
    renderActions(actions, context);

    // Exact match
    expect(context.getRecord("arr-2")).toBeDefined();
    // Normalized case
    expect(context.getRecord("ARR-2")).toBeDefined();
    // Number alias
    expect(context.getRecord("30")).toBeDefined();
    // Synthetic arr-30 alias mapped to arr-2
    expect(context.getRecord("arr-30")).toBeDefined();
  });

  it("reorders creations before arrows even if given out of order in renderActions", () => {
    const actions: VisualAction[] = [
      {
        type: "create_arrow",
        id: "step-arrow",
        from: "start-node",
        to: "end-node",
      },
      { type: "create_box", id: "start-node", label: "Start" },
      { type: "create_box", id: "end-node", label: "End" },
    ];

    const result = renderActions(actions);
    expect(result.errors).toEqual([]);
    expect(result.registry.has("start-node")).toBe(true);
    expect(result.registry.has("end-node")).toBe(true);
    expect(result.registry.has("step-arrow")).toBe(true);
  });

  // ============================================================================
  // NEW: Semantic Array Renderer Tests
  // ============================================================================

  describe("create_array renderer", () => {
    const SEVEN_ELEM_ACTIONS: VisualAction[] = [
      {
        type: "create_array",
        id: "bsa",
        elements: [
          { value: 10, highlight: "low" },
          { value: 20 },
          { value: 30 },
          { value: 40, highlight: "mid" },
          { value: 50 },
          { value: 60 },
          { value: 70, highlight: "high" },
        ],
      },
    ];

    it("registers the full array and all element IDs in the registry", () => {
      const result = renderActions(SEVEN_ELEM_ACTIONS);
      expect(result.errors).toEqual([]);

      // Full array registered
      expect(result.registry.has("bsa")).toBe(true);

      // All 7 element IDs registered
      for (let i = 0; i < 7; i++) {
        expect(result.registry.has(`bsa-${i}`)).toBe(true);
      }
    });

    it("renders elements horizontally (same Y, increasing X)", () => {
      const result = renderActions(SEVEN_ELEM_ACTIONS);
      const { ARRAY_ELEMENT_WIDTH: W, ARRAY_ELEMENT_GAP: G } = LAYOUT;

      const elem0 = result.registry.get("bsa-0")!;
      expect(elem0).toBeDefined();
      const baseX = elem0.bounds.x;
      const baseY = elem0.bounds.y;

      for (let i = 0; i < 7; i++) {
        const elem = result.registry.get(`bsa-${i}`)!;
        expect(elem.bounds.x).toBe(baseX + i * (W + G));
        expect(elem.bounds.y).toBe(baseY); // Same Y for all
      }
    });

    it("has correct element dimensions matching LAYOUT constants", () => {
      const result = renderActions(SEVEN_ELEM_ACTIONS);
      const { ARRAY_ELEMENT_WIDTH: W, ARRAY_ELEMENT_HEIGHT: H } = LAYOUT;

      for (let i = 0; i < 7; i++) {
        const elem = result.registry.get(`bsa-${i}`)!;
        expect(elem.bounds.width).toBe(W);
        expect(elem.bounds.height).toBe(H);
      }
    });

    it("elements do not overlap (spacing = WIDTH + GAP)", () => {
      const result = renderActions(SEVEN_ELEM_ACTIONS);
      const { ARRAY_ELEMENT_WIDTH: W, ARRAY_ELEMENT_GAP: G } = LAYOUT;

      for (let i = 0; i < 6; i++) {
        const curr = result.registry.get(`bsa-${i}`)!;
        const next = result.registry.get(`bsa-${i + 1}`)!;
        // Right edge of curr + gap = left edge of next
        expect(curr.bounds.x + W + G).toBe(next.bounds.x);
      }
    });

    it("applies semantic highlight colors to elements", () => {
      const result = renderActions(SEVEN_ELEM_ACTIONS);

      const elem0 = result.registry.get("bsa-0")!;
      const elem3 = result.registry.get("bsa-3")!;
      const elem6 = result.registry.get("bsa-6")!;
      const elem1 = result.registry.get("bsa-1")!;

      // low -> accent color
      expect(elem0.primaryElement.strokeColor).toBe(mapStrokeColor("accent"));
      // mid -> warning color
      expect(elem3.primaryElement.strokeColor).toBe(mapStrokeColor("warning"));
      // high -> accent color
      expect(elem6.primaryElement.strokeColor).toBe(mapStrokeColor("accent"));
      // no highlight -> default stroke
      expect(elem1.primaryElement.strokeColor).toBe(mapStrokeColor(undefined));
    });

    it("value text is centered inside each cell (not embedded with index)", () => {
      const result = renderActions(SEVEN_ELEM_ACTIONS);

      for (let i = 0; i < 7; i++) {
        const elem = result.registry.get(`bsa-${i}`)!;
        // textElement should only contain the value (no index suffix)
        const text = elem.textElement?.text ?? "";
        expect(text).not.toMatch(/\[/); // No "[LOW: 0]" style labels
        expect(text).not.toMatch(/idx/i);
        expect(text).not.toMatch(/\n/);
      }
    });

    it("renders index labels below each cell as separate text elements", () => {
      const result = renderActions(SEVEN_ELEM_ACTIONS);

      for (let i = 0; i < 7; i++) {
        // Index label has dslId `bsa-${i}-idx`
        const indexEl = result.elements.find(
          (e) => (e.customData as any)?.dslId === `bsa-${i}-idx`,
        );
        expect(indexEl).toBeDefined();
        expect(indexEl?.type).toBe("text");
        expect((indexEl as any).text).toBe(String(i));

        // Index label should be BELOW the cell
        const cell = result.registry.get(`bsa-${i}`)!;
        expect(indexEl!.y).toBeGreaterThan(cell.bounds.y + cell.bounds.height);
      }
    });

    it("renders optional array title above the cells", () => {
      const actions: VisualAction[] = [
        {
          type: "create_array",
          id: "arr",
          label: "My Array",
          elements: [{ value: 1 }, { value: 2 }, { value: 3 }],
        },
      ];
      const result = renderActions(actions);
      const titleEl = result.elements.find(
        (e) => (e.customData as any)?.dslId === "arr-title",
      );
      expect(titleEl).toBeDefined();
      expect((titleEl as any).text).toBe("My Array");

      // Title should be ABOVE the first cell
      const cell0 = result.registry.get("arr-0")!;
      expect(titleEl!.y).toBeLessThan(cell0.bounds.y);
    });

    it("emits error for empty elements array", () => {
      const actions: VisualAction[] = [
        { type: "create_array", id: "empty", elements: [] },
      ];
      const result = renderActions(actions);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0]).toContain("empty");
    });
  });

  // ============================================================================
  // NEW: Annotate Pointer Renderer Tests
  // ============================================================================

  describe("annotate_pointer renderer", () => {
    const BASE_ACTIONS: VisualAction[] = [
      {
        type: "create_array",
        id: "bsa",
        elements: [
          { value: 10 },
          { value: 20 },
          { value: 30 },
          { value: 40 },
          { value: 50 },
          { value: 60 },
          { value: 70 },
        ],
      },
    ];

    it("places pointer above target: label Y is above target top edge", () => {
      const actions: VisualAction[] = [
        ...BASE_ACTIONS,
        {
          type: "annotate_pointer",
          id: "ptr-mid",
          label: "MID",
          target: "bsa-3",
          placement: "above",
        },
      ];
      const result = renderActions(actions);
      expect(result.errors).toEqual([]);

      const targetBounds = result.registry.get("bsa-3")!.bounds;
      const labelEl = result.elements.find(
        (e) => (e.customData as any)?.dslId === "ptr-mid-label",
      );
      expect(labelEl).toBeDefined();
      // Label must be above the target top
      expect(labelEl!.y).toBeLessThan(targetBounds.y);
    });

    it("places pointer below target: label Y is below target bottom edge", () => {
      const actions: VisualAction[] = [
        ...BASE_ACTIONS,
        {
          type: "annotate_pointer",
          id: "ptr-low",
          label: "LOW",
          target: "bsa-0",
          placement: "below",
        },
      ];
      const result = renderActions(actions);
      expect(result.errors).toEqual([]);

      const targetBounds = result.registry.get("bsa-0")!.bounds;
      const labelEl = result.elements.find(
        (e) => (e.customData as any)?.dslId === "ptr-low-label",
      );
      expect(labelEl).toBeDefined();
      // Label must be below the target bottom
      expect(labelEl!.y).toBeGreaterThan(targetBounds.y + targetBounds.height);
    });

    it("arrow tip aligns to target center X", () => {
      const actions: VisualAction[] = [
        ...BASE_ACTIONS,
        {
          type: "annotate_pointer",
          id: "ptr-high",
          label: "HIGH",
          target: "bsa-6",
          placement: "above",
        },
      ];
      const result = renderActions(actions);

      const targetBounds = result.registry.get("bsa-6")!.bounds;
      const arrowEl = result.elements.find(
        (e) => (e.customData as any)?.dslId === "ptr-high-arrow",
      );
      expect(arrowEl).toBeDefined();

      const targetCenterX = Math.round(targetBounds.x + targetBounds.width / 2);
      expect(arrowEl!.x).toBe(targetCenterX);
    });

    it("emits error and no elements when pointer target is missing", () => {
      const actions: VisualAction[] = [
        {
          type: "annotate_pointer",
          id: "ptr-broken",
          label: "BROKEN",
          target: "nonexistent",
          placement: "above",
        },
      ];
      const result = renderActions(actions);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain("nonexistent");
      expect(result.elements.length).toBe(0);
    });

    it("sorts create_array before annotate_pointer even when given out of order", () => {
      const actions: VisualAction[] = [
        // Pointer comes before array creation
        {
          type: "annotate_pointer",
          id: "ptr",
          label: "LOW",
          target: "arr-0",
          placement: "above",
        },
        {
          type: "create_array",
          id: "arr",
          elements: [{ value: 1 }, { value: 2 }, { value: 3 }],
        },
      ];
      const result = renderActions(actions);
      // Should render without errors because sorter places create_array first
      expect(result.errors).toEqual([]);
      expect(result.registry.has("arr-0")).toBe(true);
      expect(result.registry.has("ptr")).toBe(true);
    });
  });

  // ============================================================================
  // NEW: Compound Renderers Tests
  // ============================================================================

  describe("Compound Renderers (New)", () => {
    it("renders create_linked_list correctly", () => {
      const actions: VisualAction[] = [
        {
          type: "create_linked_list",
          id: "ll",
          elements: [{ value: 1 }, { value: 2 }, { value: 3 }],
        },
      ];
      const result = renderActions(actions);
      expect(result.errors).toEqual([]);
      expect(result.registry.has("ll")).toBe(true);
      expect(result.registry.has("ll-0")).toBe(true);
      expect(result.registry.has("ll-2")).toBe(true);
      expect(result.elements.length).toBeGreaterThan(3);
    });

    it("renders create_stack correctly", () => {
      const actions: VisualAction[] = [
        {
          type: "create_stack",
          id: "stk",
          elements: [{ value: 10 }, { value: 20 }],
        },
      ];
      const result = renderActions(actions);
      expect(result.errors).toEqual([]);
      expect(result.registry.has("stk")).toBe(true);
      expect(result.registry.has("stk-0")).toBe(true); // top element
      expect(result.registry.has("stk-1")).toBe(true); // bottom element
      expect(result.elements.length).toBeGreaterThan(2);
    });

    it("renders create_tree correctly", () => {
      const actions: VisualAction[] = [
        {
          type: "create_tree",
          id: "tr",
          root: "root",
          nodes: [
            { id: "root", value: "A", left: "left", right: "right" },
            { id: "left", value: "B" },
            { id: "right", value: "C" },
          ],
        },
      ];
      const result = renderActions(actions);
      expect(result.errors).toEqual([]);
      expect(result.registry.has("tr")).toBe(true);
      expect(result.registry.has("tr-root")).toBe(true);
      expect(result.registry.has("tr-left")).toBe(true);
      expect(result.registry.has("tr-right")).toBe(true);
      expect(result.elements.length).toBeGreaterThan(3);
    });

    it("renders create_graph correctly", () => {
      const actions: VisualAction[] = [
        {
          type: "create_graph",
          id: "gr",
          nodes: [
            { id: "n1", label: "Node 1" },
            { id: "n2", label: "Node 2" },
          ],
          edges: [{ from: "n1", to: "n2" }],
        },
      ];
      const result = renderActions(actions);
      expect(result.errors).toEqual([]);
      expect(result.registry.has("gr")).toBe(true);
      expect(result.registry.has("gr-n1")).toBe(true);
      expect(result.registry.has("gr-n2")).toBe(true);
      expect(result.elements.length).toBeGreaterThan(2);
    });

    it("renders create_matrix correctly", () => {
      const actions: VisualAction[] = [
        {
          type: "create_matrix",
          id: "mat",
          rows: [
            [1, 2],
            [3, 4],
          ],
        },
      ];
      const result = renderActions(actions);
      expect(result.errors).toEqual([]);
      expect(result.registry.has("mat")).toBe(true);
      expect(result.registry.has("mat-0-0")).toBe(true);
      expect(result.registry.has("mat-1-1")).toBe(true);
    });
  });

  // ============================================================================
  // NEW: Bounding-Box Helper Tests
  // ============================================================================

  describe("bounding-box helpers", () => {
    it("getElementBounds returns correct bounds for registered element", () => {
      const result = renderActions([
        { type: "create_box", id: "b1", label: "Box" },
      ]);
      const bounds = getElementBounds("b1", result.registry);
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThan(0);
      expect(bounds!.height).toBeGreaterThan(0);
    });

    it("getElementBounds returns null for unknown ID", () => {
      const result = renderActions([]);
      expect(getElementBounds("missing", result.registry)).toBeNull();
    });

    it("getCenter returns midpoint of bounds", () => {
      const bounds = { x: 10, y: 20, width: 60, height: 40 };
      const center = getCenter(bounds);
      expect(center.x).toBe(40);
      expect(center.y).toBe(40);
    });

    it("getTop returns top-center of bounds", () => {
      const bounds = { x: 10, y: 20, width: 60, height: 40 };
      const top = getTop(bounds);
      expect(top.x).toBe(40);
      expect(top.y).toBe(20);
    });

    it("getBottom returns bottom-center of bounds", () => {
      const bounds = { x: 10, y: 20, width: 60, height: 40 };
      const bottom = getBottom(bounds);
      expect(bottom.x).toBe(40);
      expect(bottom.y).toBe(60);
    });
  });

  // ============================================================================
  // NEW: LAYOUT Constants
  // ============================================================================

  describe("create_explanation_block", () => {
    it("renders on-canvas explanation card with badge, title, text, calculation, and insight", () => {
      const actions: VisualAction[] = [
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
          type: "create_explanation_block",
          id: "lesson-card",
          title: "Check Midpoint",
          stepNumber: 1,
          totalSteps: 4,
          explanation:
            "We compute mid = (low + high) / 2 = 2. Value at mid is 30.",
          calculations: "mid = floor((0 + 4) / 2) = 2",
          insight: "Search interval cut in half in O(1) comparison.",
        },
      ];

      const result = renderActions(actions);
      expect(result.errors).toEqual([]);

      const cardRecord = result.registry.get("lesson-card");
      expect(cardRecord).toBeDefined();
      expect(cardRecord!.primaryElement.type).toBe("rectangle");

      // Verify the card is positioned below the array
      const arrRecord = result.registry.get("arr");
      expect(arrRecord).toBeDefined();
      expect(cardRecord!.bounds.y).toBeGreaterThanOrEqual(
        arrRecord!.bounds.y + arrRecord!.bounds.height,
      );

      // Verify texts are rendered
      const texts = result.elements
        .filter((el) => el.type === "text")
        .map((el) => (el as any).text);

      expect(texts.some((t) => t.includes("Step 1 of 4: Check Midpoint"))).toBe(
        true,
      );
      expect(texts.some((t) => t.includes("mid = (low + high) / 2"))).toBe(
        true,
      );
      expect(texts.some((t) => t.includes("mid = floor((0 + 4) / 2)"))).toBe(
        true,
      );
      expect(texts.some((t) => t.includes("Search interval cut in half"))).toBe(
        true,
      );
    });
  });
});
