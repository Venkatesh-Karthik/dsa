// @vitest-environment jsdom
import "vitest-canvas-mock";
import { describe, it, expect } from "vitest";

import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { computeSceneGraphLayout } from "../ai/layout-engine";
import { reconcileSceneState } from "../ai/scene-reconciler";
import {
  createSceneState,
  createSceneGraphFromActions,
} from "../ai/scene-state";
import { ExplanationEngine } from "../ai/explanation-engine";

import type { SceneGraph } from "../ai/scene-graph";
import type { RawProposalStep } from "../ai/conceptual-journey-optimizer";

describe("Cognora Master Upgrade: Merge Sort Reconciliation & Visual Architecture", () => {
  // ==========================================================================
  // 1. Responsive Multi-Row Array Layout for Large Arrays (10+ items)
  // ==========================================================================
  describe("1. Responsive Multi-Row Array Layout", () => {
    it("lays out 10 elements in responsive 2 rows of 5 with balanced aspect ratio", () => {
      const input = [4, 56, 85, 96, 85, 77, 12, 32, 56, 52];

      const graph: SceneGraph = {
        entities: new Map(
          input.map((val, idx) => [
            `main-array-${idx}`,
            {
              id: `main-array-${idx}`,
              primitiveType: "ArrayCell",
              semanticRole: "array-element",
              value: val,
              label: String(val),
              properties: {
                index: idx,
                containerId: "main-array",
              },
            },
          ]),
        ),
        relationships: new Map(),
        annotations: new Map(),
      };

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      // Verify all 10 positions are generated
      expect(layout.positions.size).toBe(10);

      // Verify Row 0 (indices 0..4) and Row 1 (indices 5..9)
      const cell0 = layout.positions.get("main-array-0")!;
      const cell4 = layout.positions.get("main-array-4")!;
      const cell5 = layout.positions.get("main-array-5")!;
      const cell9 = layout.positions.get("main-array-9")!;

      // Row 0 cells share the same Y
      expect(cell0.y).toBe(cell4.y);

      // Row 1 cells share the same Y, below Row 0
      expect(cell5.y).toBe(cell9.y);
      expect(cell5.y).toBeGreaterThan(cell0.y);

      // Width of 5 cells (5 * 64 + 4 * 8 = 352px)
      expect(layout.bounds.width).toBeLessThan(450);
      expect(layout.bounds.width).toBeGreaterThan(300);

      // Height spans 2 rows with gap (64 + 32 + 64 = 160px)
      expect(layout.bounds.height).toBeGreaterThanOrEqual(160);

      // Balanced aspect ratio (width / height ~ 2.2:1, NOT 12:1 microscopic strip)
      const aspectRatio = layout.bounds.width / layout.bounds.height;
      expect(aspectRatio).toBeLessThan(3.5);
      expect(aspectRatio).toBeGreaterThan(1.5);
    });

    it("positions pointer entities cleanly above or below targeted cells", () => {
      const graph: SceneGraph = {
        entities: new Map([
          [
            "arr-0",
            {
              id: "arr-0",
              primitiveType: "ArrayCell",
              value: 10,
              properties: { index: 0, containerId: "arr" },
            },
          ],
          [
            "arr-1",
            {
              id: "arr-1",
              primitiveType: "ArrayCell",
              value: 20,
              properties: { index: 1, containerId: "arr" },
            },
          ],
          [
            "ptr-left",
            {
              id: "ptr-left",
              primitiveType: "GenericEntity",
              semanticRole: "pointer",
              label: "low",
              properties: { targetId: "arr-0" },
            },
          ],
          [
            "ptr-right",
            {
              id: "ptr-right",
              primitiveType: "GenericEntity",
              semanticRole: "pointer",
              label: "high",
              properties: { targetId: "arr-1" },
            },
          ],
        ]),
        relationships: new Map(),
        annotations: new Map(),
      };

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 200 });

      const cell0Pos = layout.positions.get("arr-0")!;
      const cell1Pos = layout.positions.get("arr-1")!;
      const lowPos = layout.positions.get("ptr-left")!;
      const highPos = layout.positions.get("ptr-right")!;

      // 'low' pointer placed above cell 0
      expect(lowPos.y).toBeLessThan(cell0Pos.y);

      // 'high' pointer placed below cell 1
      expect(highPos.y).toBeGreaterThan(cell1Pos.y);
    });
  });

  // ==========================================================================
  // 2. Merge Sort Entity Conservation & Subarray Reconciliation
  // ==========================================================================
  describe("2. Merge Sort Entity Conservation & Reconciliation", () => {
    it("conserves elements across divide and merge stages without duplicate ghost cells", () => {
      const prompt =
        "Perform Merge Sort on array: [4, 56, 85, 96, 85, 77, 12, 32, 56, 52]. Show division and merge.";

      const initialElements = [
        { value: 4 },
        { value: 56 },
        { value: 85 },
        { value: 96 },
        { value: 85 },
        { value: 77 },
        { value: 12 },
        { value: 32 },
        { value: 56 },
        { value: 52 },
      ];

      const rawSteps: RawProposalStep[] = [
        {
          title: "Divide into Left and Right Subarrays",
          explanation:
            "Array is split into left half (5 elements) and right half (5 elements).",
          role: "mechanism",
          operations: [
            {
              type: "create_array",
              id: "left-half",
              elements: [
                { value: 4 },
                { value: 56 },
                { value: 85 },
                { value: 85 },
                { value: 96 },
              ],
            },
            {
              type: "create_array",
              id: "right-half",
              elements: [
                { value: 12 },
                { value: 32 },
                { value: 52 },
                { value: 56 },
                { value: 77 },
              ],
            },
            {
              type: "delete_entity",
              id: "main-array",
            },
          ],
        },
        {
          title: "Merge Subarrays into Final Sorted Array",
          explanation:
            "Left and right halves are merged into a single sorted array.",
          role: "proof",
          operations: [
            {
              type: "create_array",
              id: "final-sorted",
              replaces: ["left-half", "right-half"],
              elements: [
                { value: 4 },
                { value: 12 },
                { value: 32 },
                { value: 52 },
                { value: 56 },
                { value: 56 },
                { value: 77 },
                { value: 85 },
                { value: 85 },
                { value: 96 },
              ],
            },
            {
              type: "merge",
              sources: ["left-half", "right-half"],
              into: "final-sorted",
            },
          ],
        },
      ];

      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          topic: "Merge Sort 10-Element",
          initial_scene: [
            {
              type: "create_array",
              id: "main-array",
              elements: initialElements,
            },
          ],
          steps: rawSteps as any,
        },
      );

      expect(result.timeline.states.length).toBeGreaterThanOrEqual(3);

      // Verify State 0: Exactly 10 elements in main-array
      const state0 = result.timeline.states[0];
      const state0Cells = Array.from(state0.graph.entities.values()).filter(
        (e) => e.primitiveType === "ArrayCell",
      );
      expect(state0Cells.length).toBe(10);

      // Verify State 1: main-array is deleted, leaving left-half (5) and right-half (5) = 10 total
      const state1 = result.timeline.states[1];
      const state1Cells = Array.from(state1.graph.entities.values()).filter(
        (e) => e.primitiveType === "ArrayCell",
      );
      expect(state1Cells.length).toBe(10);
      expect(state1.graph.entities.has("main-array-0")).toBe(false);

      // Verify Final State: left-half and right-half are purged, leaving exactly 10 sorted elements!
      const finalState =
        result.timeline.states[result.timeline.states.length - 1];
      const finalCells = Array.from(finalState.graph.entities.values()).filter(
        (e) => e.primitiveType === "ArrayCell",
      );
      expect(finalCells.length).toBe(10);

      // No lingering cells from left-half or right-half
      for (const [id] of finalState.graph.entities.entries()) {
        expect(id.startsWith("left-half-")).toBe(false);
        expect(id.startsWith("right-half-")).toBe(false);
        expect(id.startsWith("main-array-")).toBe(false);
      }

      // Check values match sorted order
      const finalValues = finalCells.map((c) => Number(c.value));
      expect(finalValues).toEqual([4, 12, 32, 52, 56, 56, 77, 85, 85, 96]);

      // Reconcile across canvas elements
      const rec0 = reconcileSceneState(state0, [], "merge-lesson");
      expect(
        rec0.elements.filter((e) => e.type !== "text" && !e.isDeleted).length,
      ).toBe(10);

      const recFinal = reconcileSceneState(
        finalState,
        rec0.elements,
        "merge-lesson",
      );
      const activeElements = recFinal.elements.filter(
        (e) => e.type !== "text" && !e.isDeleted,
      );
      // Exactly 10 active canvas elements in final state!
      expect(activeElements.length).toBe(10);

      // Old state 0 elements are marked isDeleted: true
      const deletedElements = recFinal.elements.filter((e) => e.isDeleted);
      expect(deletedElements.length).toBeGreaterThanOrEqual(10);
    });
  });

  // ==========================================================================
  // 3. Native Excalidraw Connectors (No fake rectangle boxes)
  // ==========================================================================
  describe("3. Native Excalidraw Connectors & No Fake Objects", () => {
    it("routes arrows to native bound connectors and excludes t2-op0 or arrow boxes", () => {
      const actions = [
        { type: "create_box" as const, id: "node-a", label: "A" },
        { type: "create_box" as const, id: "node-b", label: "B" },
        {
          type: "create_arrow" as const,
          id: "arrow-a-b",
          from: "node-a",
          to: "node-b",
          label: "next",
        },
      ];

      const graph = createSceneGraphFromActions(actions);

      // Verify node entities are ONLY node-a and node-b
      expect(Array.from(graph.entities.keys())).toEqual(["node-a", "node-b"]);
      expect(graph.entities.has("arrow-a-b")).toBe(false);

      // Verify arrow-a-b is stored as a relationship
      expect(graph.relationships.has("arrow-a-b")).toBe(true);

      const state = createSceneState(
        graph,
        new Map([
          ["node-a", { x: 100, y: 100 }],
          ["node-b", { x: 300, y: 100 }],
        ]),
      );

      const reconciled = reconcileSceneState(state, [], "arrow-test");
      const arrowEl = reconciled.elements.find((e) => e.type === "arrow");

      expect(arrowEl).toBeDefined();
      expect((arrowEl as any).startBinding).toBeDefined();
      expect((arrowEl as any).endBinding).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. Metadata Scrubbing from Learner-Facing Text
  // ==========================================================================
  describe("4. Metadata Scrubbing from Learner-Facing Text", () => {
    it("removes all internal IDs and container tokens from learner text", () => {
      const dirtyText =
        "At step t2-op0, merge left-half and right-half into final-sorted-0 array. " +
        "Examine ptr-left and ptr-right moving across merge-array-element-4 while focusing focusComponent on main-array.";

      const cleaned = ExplanationEngine.scrubMetadata(dirtyText);

      expect(cleaned).not.toContain("t2-op0");
      expect(cleaned).not.toContain("left-half");
      expect(cleaned).not.toContain("right-half");
      expect(cleaned).not.toContain("final-sorted");
      expect(cleaned).not.toContain("ptr-left");
      expect(cleaned).not.toContain("ptr-right");
      expect(cleaned).not.toContain("merge-array-element-4");
      expect(cleaned).not.toContain("focusComponent");
      expect(cleaned).not.toContain("main-array");

      // Verify readability
      expect(cleaned).toContain("left");
      expect(cleaned).toContain("right");
      expect(cleaned).toContain("sorted");
      expect(cleaned).toContain("array");
    });
  });
});
