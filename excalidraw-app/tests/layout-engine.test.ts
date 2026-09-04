import { describe, it, expect } from "vitest";
import {
  computeTreeLayout,
  computeGraphLayout,
  computeGridLayout,
  doRectsOverlap,
  computeSceneBounds,
  TREE_LAYOUT,
  GRAPH_LAYOUT,
  GRID_LAYOUT
} from "../ai/layout-engine";

describe("Layout Engine", () => {
  describe("computeTreeLayout", () => {
    it("computes layout for a binary tree", () => {
      const nodes = [
        { id: "root", value: 1, left: "left", right: "right" },
        { id: "left", value: 2 },
        { id: "right", value: 3 },
      ];
      const origin = { x: 100, y: 100 };
      const layout = computeTreeLayout(nodes, "root", origin);

      expect(layout.positions.size).toBe(3);
      expect(layout.levels.get("root")).toBe(0);
      expect(layout.levels.get("left")).toBe(1);
      expect(layout.levels.get("right")).toBe(1);

      const rootPos = layout.positions.get("root");
      const leftPos = layout.positions.get("left");
      const rightPos = layout.positions.get("right");

      expect(rootPos).toBeDefined();
      expect(leftPos).toBeDefined();
      expect(rightPos).toBeDefined();

      // y coordinates should increase by LEVEL_GAP
      expect(leftPos!.y).toBe(rootPos!.y + TREE_LAYOUT.LEVEL_GAP);
      expect(rightPos!.y).toBe(rootPos!.y + TREE_LAYOUT.LEVEL_GAP);

      // left should be to the left of right
      expect(leftPos!.x).toBeLessThan(rightPos!.x);
    });

    it("computes layout for a general tree", () => {
      const nodes = [
        { id: "root", value: 1, children: ["c1", "c2", "c3"] },
        { id: "c1", value: 2 },
        { id: "c2", value: 3 },
        { id: "c3", value: 4 },
      ];
      const origin = { x: 0, y: 0 };
      const layout = computeTreeLayout(nodes, "root", origin);

      expect(layout.positions.size).toBe(4);
      const c1 = layout.positions.get("c1")!;
      const c2 = layout.positions.get("c2")!;
      const c3 = layout.positions.get("c3")!;

      expect(c1.x).toBeLessThan(c2.x);
      expect(c2.x).toBeLessThan(c3.x);
    });
  });

  describe("computeGraphLayout", () => {
    it("computes circle layout for small graphs", () => {
      const nodes = [
        { id: "n1", label: "1" },
        { id: "n2", label: "2" },
        { id: "n3", label: "3" },
      ];
      const edges = [{ from: "n1", to: "n2" }];
      const origin = { x: 0, y: 0 };
      
      const layout = computeGraphLayout(nodes, edges, origin);
      expect(layout.positions.size).toBe(3);
      
      const p1 = layout.positions.get("n1")!;
      const p2 = layout.positions.get("n2")!;
      
      expect(p1.x).toBeDefined();
      expect(p1.y).toBeDefined();
      expect(p2.x).toBeDefined();
      expect(p2.y).toBeDefined();
    });

    it("computes grid layout for large graphs", () => {
      const nodes = Array.from({ length: 15 }, (_, i) => ({ id: `n${i}`, label: `${i}` }));
      const origin = { x: 0, y: 0 };
      
      const layout = computeGraphLayout(nodes, [], origin);
      expect(layout.positions.size).toBe(15);
      
      // Since max circle is 12, this should be grid
      const p0 = layout.positions.get("n0")!;
      const p1 = layout.positions.get("n1")!;
      
      // Should be horizontally adjacent
      expect(p1.x).toBe(p0.x + GRAPH_LAYOUT.GRID_GAP);
      expect(p1.y).toBe(p0.y);
    });
  });

  describe("computeGridLayout", () => {
    it("computes grid coordinates correctly", () => {
      const origin = { x: 10, y: 20 };
      const layout = computeGridLayout(2, 3, origin);
      
      expect(layout.cellPositions.size).toBe(6); // 2x3
      
      const cell00 = layout.cellPositions.get("0-0")!;
      expect(cell00.x).toBe(origin.x + GRID_LAYOUT.HEADER_OFFSET);
      expect(cell00.y).toBe(origin.y + GRID_LAYOUT.HEADER_OFFSET);
      
      const cell01 = layout.cellPositions.get("0-1")!;
      expect(cell01.x).toBe(cell00.x + GRID_LAYOUT.CELL_WIDTH + GRID_LAYOUT.CELL_GAP);
      expect(cell01.y).toBe(cell00.y);
      
      const cell10 = layout.cellPositions.get("1-0")!;
      expect(cell10.x).toBe(cell00.x);
      expect(cell10.y).toBe(cell00.y + GRID_LAYOUT.CELL_HEIGHT + GRID_LAYOUT.CELL_GAP);
    });
  });

  describe("Collision and Bounds Helpers", () => {
    it("doRectsOverlap returns true for overlapping rects", () => {
      const r1 = { x: 0, y: 0, width: 100, height: 100 };
      const r2 = { x: 50, y: 50, width: 100, height: 100 };
      expect(doRectsOverlap(r1, r2)).toBe(true);
    });

    it("doRectsOverlap returns false for non-overlapping rects", () => {
      const r1 = { x: 0, y: 0, width: 100, height: 100 };
      const r2 = { x: 150, y: 150, width: 100, height: 100 };
      expect(doRectsOverlap(r1, r2)).toBe(false);
    });

    it("doRectsOverlap returns false for touching edges", () => {
      const r1 = { x: 0, y: 0, width: 100, height: 100 };
      const r2 = { x: 100, y: 0, width: 100, height: 100 };
      expect(doRectsOverlap(r1, r2)).toBe(false);
    });

    it("computeSceneBounds returns bounding box for multiple rects", () => {
      const r1 = { x: 10, y: 10, width: 50, height: 50 };
      const r2 = { x: 100, y: 100, width: 20, height: 20 };
      const bounds = computeSceneBounds([r1, r2]);
      
      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(10);
      expect(bounds.width).toBe(110); // 120 - 10
      expect(bounds.height).toBe(110); // 120 - 10
    });
    
    it("computeSceneBounds handles empty array", () => {
      const bounds = computeSceneBounds([]);
      expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });
});
