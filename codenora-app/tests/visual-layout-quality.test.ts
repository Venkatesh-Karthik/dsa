/**
 * Visual Layout Quality & Composition Invariants — Regression Tests
 *
 * Verifies:
 * 1. AVL Tree centering (entire composed tree, not just root)
 * 2. Tree bounding box strictly within canvas boundaries (no negative X, no overflow)
 * 3. AVL rotation layout recomputation stability
 * 4. Badge rectangle suppression on balanced nodes (eliminates [30] 30 duplicate)
 * 5. Graph node label de-duplication
 * 6. Multi-region separation between primary graph and supporting distance table
 */

import { describe, it, expect } from "vitest";
import {
  computeTreeLayout,
  computeSceneGraphLayout,
  TREE_LAYOUT,
} from "../ai/layout-engine";
import { createTreeNode } from "../ai/visual-primitives/tree-node";
import { createGraphNode } from "../ai/visual-primitives/graph-node";
import {
  createEmptySceneGraph,
  addEntity,
  addRelationship,
} from "../ai/scene-graph";

describe("Visual Layout Quality & Composition Invariants", () => {
  describe("AVL Tree Composed Layout & Centering", () => {
    it("centers the entire composed tree [30, 20, 50, 10, 40, 70] within usable canvas region", () => {
      // Tree structure:
      //         30
      //        /  \
      //      20    50
      //     /     /  \
      //   10     40   70
      const nodes = [
        { id: "30", value: 30, left: "20", right: "50" },
        { id: "20", value: 20, left: "10" },
        { id: "10", value: 10 },
        { id: "50", value: 50, left: "40", right: "70" },
        { id: "40", value: 40 },
        { id: "70", value: 70 },
      ];

      const origin = { x: 100, y: 100 };
      const layout = computeTreeLayout(nodes, "30", origin);

      expect(layout.positions.size).toBe(6);

      const p30 = layout.positions.get("30")!;
      const p20 = layout.positions.get("20")!;
      const p10 = layout.positions.get("10")!;
      const p50 = layout.positions.get("50")!;
      const p40 = layout.positions.get("40")!;
      const p70 = layout.positions.get("70")!;

      // 1. All nodes must be within usable horizontal region (strictly >= origin.x)
      for (const [id, pos] of layout.positions.entries()) {
        expect(pos.x, `Node ${id} X position must be >= 80`).toBeGreaterThanOrEqual(80);
        expect(pos.x, `Node ${id} X position must fit within standard canvas 1200px`).toBeLessThanOrEqual(1150);
      }

      // 2. Node 10 must NOT be pushed off-screen or negative
      expect(p10.x).toBeGreaterThanOrEqual(80);

      // 3. Parent-child horizontal ordering
      expect(p20.x).toBeLessThan(p30.x);
      expect(p10.x).toBeLessThan(p20.x);
      expect(p50.x).toBeGreaterThan(p30.x);
      expect(p40.x).toBeLessThan(p50.x);
      expect(p70.x).toBeGreaterThan(p50.x);

      // 4. Entire composed tree must be centered (midpoint around 500-600px)
      const treeCenterX = layout.bounds.x + layout.bounds.width / 2;
      expect(treeCenterX).toBeGreaterThanOrEqual(480);
      expect(treeCenterX).toBeLessThanOrEqual(650);

      // 5. Level heights must be strictly increasing
      expect(p20.y).toBe(p30.y + TREE_LAYOUT.LEVEL_GAP);
      expect(p50.y).toBe(p30.y + TREE_LAYOUT.LEVEL_GAP);
      expect(p10.y).toBe(p20.y + TREE_LAYOUT.LEVEL_GAP);
      expect(p40.y).toBe(p50.y + TREE_LAYOUT.LEVEL_GAP);
      expect(p70.y).toBe(p50.y + TREE_LAYOUT.LEVEL_GAP);
    });

    it("maintains bounded, centered layout across AVL rotation (before and after)", () => {
      // BEFORE ROTATION: Unbalanced Right-heavy chain (10 -> 20 -> 30)
      const beforeNodes = [
        { id: "10", value: 10, right: "20" },
        { id: "20", value: 20, right: "30" },
        { id: "30", value: 30 },
      ];

      const beforeLayout = computeTreeLayout(beforeNodes, "10", { x: 100, y: 100 });
      expect(beforeLayout.bounds.x).toBeGreaterThanOrEqual(80);
      expect(beforeLayout.bounds.x + beforeLayout.bounds.width).toBeLessThanOrEqual(1100);

      // AFTER LEFT ROTATION: Balanced binary tree (20 with left 10 and right 30)
      const afterNodes = [
        { id: "20", value: 20, left: "10", right: "30" },
        { id: "10", value: 10 },
        { id: "30", value: 30 },
      ];

      const afterLayout = computeTreeLayout(afterNodes, "20", { x: 100, y: 100 });
      expect(afterLayout.bounds.x).toBeGreaterThanOrEqual(80);
      expect(afterLayout.bounds.x + afterLayout.bounds.width).toBeLessThanOrEqual(1100);

      const afterP20 = afterLayout.positions.get("20")!;
      const afterP10 = afterLayout.positions.get("10")!;
      const afterP30 = afterLayout.positions.get("30")!;

      expect(afterP10.x).toBeLessThan(afterP20.x);
      expect(afterP30.x).toBeGreaterThan(afterP20.x);
      expect(afterP10.y).toBe(afterP20.y + TREE_LAYOUT.LEVEL_GAP);
      expect(afterP30.y).toBe(afterP20.y + TREE_LAYOUT.LEVEL_GAP);
    });
  });

  describe("Label De-Duplication and Badge Control", () => {
    it("does NOT render a balance factor badge on balanced nodes (|BF| <= 1)", () => {
      const balancedNode = createTreeNode({
        id: "node-30",
        value: 30,
        x: 200,
        y: 200,
        balanceFactor: 0,
      });

      // Should have circle and value label only (length === 2)
      expect(balancedNode.allElements.length).toBe(2);
      const textElements = balancedNode.allElements.filter((el) => el.type === "text");
      expect(textElements.length).toBe(1);
      expect((textElements[0] as any).text).toBe("30");
    });

    it("renders balance factor badge only when node is imbalanced (|BF| > 1)", () => {
      const imbalancedNode = createTreeNode({
        id: "node-30",
        value: 30,
        x: 200,
        y: 200,
        balanceFactor: 2,
      });

      // Should have circle, value label, badge rectangle, and badge text (length === 4)
      expect(imbalancedNode.allElements.length).toBe(4);
      const textElements = imbalancedNode.allElements.filter((el) => el.type === "text");
      expect(textElements.length).toBe(2);

      const valueText = textElements.find((el: any) => el.customData?.subRole === "value");
      const badgeText = textElements.find((el: any) => el.customData?.subRole === "badge-text");

      expect((valueText as any)?.text).toBe("30");
      expect((badgeText as any)?.text).toBe("BF: +2");
    });

    it("does NOT duplicate value in graph node when label matches value", () => {
      const graphNode = createGraphNode({
        id: "node-A",
        label: "A",
        value: "A", // label === value
        x: 150,
        y: 150,
      });

      const textElements = graphNode.allElements.filter((el) => el.type === "text");
      // Must only render primary label "A", NOT duplicate valueText "A"
      expect(textElements.length).toBe(1);
      expect((textElements[0] as any).text).toBe("A");
    });

    it("renders distinct secondary value when different from label in graph node", () => {
      const graphNode = createGraphNode({
        id: "node-A",
        label: "A",
        value: 0, // distance 0 in Dijkstra
        x: 150,
        y: 150,
      });

      const textElements = graphNode.allElements.filter((el) => el.type === "text");
      expect(textElements.length).toBe(2);
      expect((textElements[0] as any).text).toBe("A");
      expect((textElements[1] as any).text).toBe("0");
    });
  });

  describe("Multi-Region Dijkstra / Bellman-Ford Composition", () => {
    it("places supporting distance table in reserved region without colliding with primary graph", () => {
      const graph = createEmptySceneGraph({ topic: "dijkstra" });

      // Primary graph entities
      addEntity(graph, {
        id: "A",
        primitiveType: "GraphNode",
        semanticRole: "vertex",
        label: "A",
        value: 0,
      });
      addEntity(graph, {
        id: "B",
        primitiveType: "GraphNode",
        semanticRole: "vertex",
        label: "B",
        value: 4,
      });
      addEntity(graph, {
        id: "C",
        primitiveType: "GraphNode",
        semanticRole: "vertex",
        label: "C",
        value: 2,
      });

      addRelationship(graph, {
        id: "rel-A-B",
        type: "connectedTo",
        sourceEntityId: "A",
        targetEntityId: "B",
        label: "4",
      });
      addRelationship(graph, {
        id: "rel-A-C",
        type: "connectedTo",
        sourceEntityId: "A",
        targetEntityId: "C",
        label: "2",
      });

      // Supporting distance table
      addEntity(graph, {
        id: "dist-table",
        primitiveType: "Table",
        semanticRole: "table",
        label: "Distance Table",
        properties: {
          isSupporting: true,
          columns: ["Vertex", "Distance", "Predecessor"],
          rows: [
            ["A", "0", "-"],
            ["B", "4", "A"],
            ["C", "2", "A"],
          ],
        },
      });

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      const posA = layout.positions.get("A")!;
      const posB = layout.positions.get("B")!;
      const posC = layout.positions.get("C")!;
      const posTable = layout.positions.get("dist-table")!;

      expect(posA).toBeDefined();
      expect(posB).toBeDefined();
      expect(posC).toBeDefined();
      expect(posTable).toBeDefined();

      // Graph node bounds
      const graphMaxX = Math.max(posA.x, posB.x, posC.x) + 60;

      // Table must be offset and not overlapping any graph node
      const tableOverlapsNode = [posA, posB, posC].some((p) => {
        return (
          posTable.x < p.x + 60 &&
          posTable.x + 200 > p.x &&
          posTable.y < p.y + 60 &&
          posTable.y + 100 > p.y
        );
      });

      expect(tableOverlapsNode).toBe(false);
    });
  });
});
