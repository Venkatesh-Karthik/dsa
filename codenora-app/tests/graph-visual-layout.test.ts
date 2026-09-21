import { describe, it, expect } from "vitest";

import {
  createEmptySceneGraph,
  addEntity,
  addRelationship,
} from "../ai/scene-graph";
import { computeSceneGraphLayout } from "../ai/layout-engine";
import { VisualCompositionPlanner } from "../ai/visual-reasoning/visual-composition-planner";
import { planRelationshipLabel } from "../ai/visual-reasoning/relationship-label-planner";
import { computeOptimalRoute } from "../ai/visual-reasoning/connector-router";
import type { AuthoritativeSemanticModel } from "../ai/authoritative-model";
import type { VisualEvidencePlan } from "../ai/visual-reasoning/visual-reasoning-model";

describe("COGNORA VISUAL LAYOUT — GRAPH COMPOSITION ARCHITECTURE", () => {
  // =========================================================================
  // 1. DIJKSTRA WEIGHTED GRAPH
  // =========================================================================
  describe("1. Dijkstra Weighted Graph Layout", () => {
    const createDijkstraModel = (): AuthoritativeSemanticModel => ({
      id: "dijkstra-model-1",
      domain: "algorithms",
      problem: {
        id: "dijkstra-prob",
        question: "Find the shortest path from A using Dijkstra's algorithm",
        objective: "Dijkstra Shortest Path",
        intent: "EXPLAIN",
      },
      world: {
        entities: [
          { id: "node-A", label: "A", type: "Vertex", semanticRole: "source" },
          { id: "node-B", label: "B", type: "Vertex", semanticRole: "vertex" },
          { id: "node-C", label: "C", type: "Vertex", semanticRole: "vertex" },
          { id: "node-D", label: "D", type: "Vertex", semanticRole: "vertex" },
          { id: "node-E", label: "E", type: "Vertex", semanticRole: "destination" },
        ],
        relationships: [
          { id: "e-A-B", source: "node-A", target: "node-B", type: "connects", label: "4", properties: { weight: 4 } },
          { id: "e-A-C", source: "node-A", target: "node-C", type: "connects", label: "2", properties: { weight: 2 } },
          { id: "e-B-C", source: "node-B", target: "node-C", type: "connects", label: "1", properties: { weight: 1 } },
          { id: "e-B-D", source: "node-B", target: "node-D", type: "connects", label: "5", properties: { weight: 5 } },
          { id: "e-C-D", source: "node-C", target: "node-D", type: "connects", label: "8", properties: { weight: 8 } },
          { id: "e-C-E", source: "node-C", target: "node-E", type: "connects", label: "10", properties: { weight: 10 } },
          { id: "e-D-E", source: "node-D", target: "node-E", type: "connects", label: "2", properties: { weight: 2 } },
        ],
      },
      states: [],
      transformations: [],
    } as unknown as AuthoritativeSemanticModel);

    it("selects 'network' primaryStrategy purely from semantic relationships (no topic hardcoding)", () => {
      const model = createDijkstraModel();
      const evidencePlan: VisualEvidencePlan = {
        primaryEntityIds: ["node-A"],
        supportingEntityIds: ["node-B", "node-C", "node-D", "node-E"],
        contextEntityIds: [],
        temporaryEntityIds: [],
        redundantEntityIds: [],
        items: new Map(),
      };

      const plan = VisualCompositionPlanner.plan(model, evidencePlan);
      expect(plan.primaryStrategy).toBe("network");
      expect(plan.readingDirection).toBe("left_to_right");
    });

    it("arranges the Dijkstra graph in clean topological levels: A (top), B & C (mid), D & E (bottom)", () => {
      const graph = createEmptySceneGraph({
        conceptType: "network",
        layoutStrategy: "graph",
      });

      const nodeIds = ["A", "B", "C", "D", "E"];
      for (const id of nodeIds) {
        addEntity(graph, {
          id: `node-${id}`,
          primitiveType: "GraphNode",
          label: id,
          value: id,
        });
      }

      const edges = [
        { from: "A", to: "B", w: 4 },
        { from: "A", to: "C", w: 2 },
        { from: "B", to: "C", w: 1 },
        { from: "B", to: "D", w: 5 },
        { from: "C", to: "D", w: 8 },
        { from: "C", to: "E", w: 10 },
        { from: "D", to: "E", w: 2 },
      ];

      for (const e of edges) {
        addRelationship(graph, {
          id: `e-${e.from}-${e.to}`,
          type: "connects",
          sourceEntityId: `node-${e.from}`,
          targetEntityId: `node-${e.to}`,
          label: String(e.w),
          properties: { weight: e.w },
        });
      }

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      const posA = layout.positions.get("node-A")!;
      const posB = layout.positions.get("node-B")!;
      const posC = layout.positions.get("node-C")!;
      const posD = layout.positions.get("node-D")!;
      const posE = layout.positions.get("node-E")!;

      expect(posA).toBeDefined();
      expect(posB).toBeDefined();
      expect(posC).toBeDefined();
      expect(posD).toBeDefined();
      expect(posE).toBeDefined();

      // 1. Root / source A is at the top level
      expect(posB.y).toBeGreaterThan(posA.y);
      expect(posC.y).toBeGreaterThan(posA.y);

      // 2. B and C are at level 1 (same vertical tier)
      expect(posB.y).toBe(posC.y);

      // 3. B is to the left of C with substantial horizontal corridor (>= 180px for weight "1")
      expect(posB.x).toBeLessThan(posC.x);
      expect(posC.x - posB.x).toBeGreaterThanOrEqual(180);

      // 4. D and E are at level 2 below level 1
      expect(posD.y).toBeGreaterThan(posB.y);
      expect(posE.y).toBeGreaterThan(posC.y);
      expect(posD.y).toBe(posE.y);

      // 5. D is to the left of E with substantial horizontal corridor (>= 180px for weight "2")
      expect(posD.x).toBeLessThan(posE.x);
      expect(posE.x - posD.x).toBeGreaterThanOrEqual(180);

      // 6. Substantial 2D spread across the entire canvas (NOT a 1D column)
      const allX = [posA.x, posB.x, posC.x, posD.x, posE.x];
      const allY = [posA.y, posB.y, posC.y, posD.y, posE.y];
      const xSpan = Math.max(...allX) - Math.min(...allX);
      const ySpan = Math.max(...allY) - Math.min(...allY);
      expect(xSpan).toBeGreaterThanOrEqual(200);
      expect(ySpan).toBeGreaterThanOrEqual(250);

      // 7. No node overlap: all pairwise center distances >= 100px
      const allPos = [posA, posB, posC, posD, posE];
      for (let i = 0; i < allPos.length; i++) {
        for (let j = i + 1; j < allPos.length; j++) {
          const dist = Math.hypot(allPos[i].x - allPos[j].x, allPos[i].y - allPos[j].y);
          expect(dist).toBeGreaterThanOrEqual(100);
        }
      }
    });

    it("positions edge weight labels along corridors without overlapping nodes", () => {
      const posB = { x: 130, y: 260 };
      const posC = { x: 330, y: 260 };

      const routeBC = computeOptimalRoute(
        { x: posB.x, y: posB.y, width: 60, height: 60 },
        { x: posC.x, y: posC.y, width: 60, height: 60 },
        [],
        { sourceShape: "ellipse", targetShape: "ellipse" },
      );

      const labelBC = planRelationshipLabel({
        id: "lbl-BC",
        rawLabel: "1",
        route: routeBC,
        sourceBounds: { x: posB.x, y: posB.y, width: 60, height: 60 },
        targetBounds: { x: posC.x, y: posC.y, width: 60, height: 60 },
        obstacles: [],
      });

      expect(labelBC).not.toBeNull();
      expect(labelBC!.displayText).toBe("1");
      // Label must be placed between B and C horizontally
      expect(labelBC!.x).toBeGreaterThan(posB.x + 30);
      expect(labelBC!.x + labelBC!.width).toBeLessThan(posC.x + 30);
    });
  });

  // =========================================================================
  // 2. GRAPH WITH 6–10 NODES
  // =========================================================================
  describe("2. Graph with 6–10 Nodes", () => {
    it("distributes an 8-node multi-level graph without vertical column collapse or overlaps", () => {
      const graph = createEmptySceneGraph({
        conceptType: "network",
      });

      for (let i = 1; i <= 8; i++) {
        addEntity(graph, {
          id: `node-${i}`,
          primitiveType: "GraphNode",
          label: `N${i}`,
        });
      }

      // Multi-tier DAG: N1 -> N2, N3 -> N4, N5, N6 -> N7, N8
      const edges = [
        [1, 2], [1, 3],
        [2, 4], [2, 5],
        [3, 5], [3, 6],
        [4, 7], [5, 7], [5, 8], [6, 8],
      ];

      for (const [u, v] of edges) {
        addRelationship(graph, {
          id: `e-${u}-${v}`,
          type: "connects",
          sourceEntityId: `node-${u}`,
          targetEntityId: `node-${v}`,
          label: `${u * 2}`,
        });
      }

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });
      expect(layout.positions.size).toBe(8);

      const positions = Array.from(layout.positions.values());

      // Verify pairwise distance between every node is at least 90px (no overlap)
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dist = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
          expect(dist).toBeGreaterThanOrEqual(90);
        }
      }

      // Verify generous 2D spread
      expect(layout.bounds.width).toBeGreaterThanOrEqual(300);
      expect(layout.bounds.height).toBeGreaterThanOrEqual(300);
    });
  });

  // =========================================================================
  // 3. BIDIRECTIONAL EDGES
  // =========================================================================
  describe("3. Bidirectional Edges", () => {
    it("routes bidirectional edges cleanly with perpendicular normal offsets", () => {
      const sourceBounds = { x: 100, y: 100, width: 60, height: 60 };
      const targetBounds = { x: 350, y: 100, width: 60, height: 60 };

      // Forward route (lane 0 of 2)
      const routeFwd = computeOptimalRoute(sourceBounds, targetBounds, [], {
        sourceShape: "ellipse",
        targetShape: "ellipse",
        laneIndex: 0,
        totalLanes: 2,
      });

      // Backward route (lane 1 of 2)
      const routeRev = computeOptimalRoute(targetBounds, sourceBounds, [], {
        sourceShape: "ellipse",
        targetShape: "ellipse",
        laneIndex: 1,
        totalLanes: 2,
      });

      expect(routeFwd.startX).toBeDefined();
      expect(routeRev.startX).toBeDefined();

      // The two routes must have distinct Y coordinates (parallel offset)
      expect(routeFwd.startY).not.toBe(routeRev.startY);
      const verticalDistance = Math.abs(routeFwd.startY - routeRev.startY);
      expect(verticalDistance).toBeGreaterThanOrEqual(16);

      // Labels planned for both directions must not overlap
      const labelFwd = planRelationshipLabel({
        id: "lbl-fwd",
        rawLabel: "forward (3)",
        route: routeFwd,
        sourceBounds,
        targetBounds,
        obstacles: [],
      });

      const labelRev = planRelationshipLabel({
        id: "lbl-rev",
        rawLabel: "backward (4)",
        route: routeRev,
        sourceBounds: targetBounds,
        targetBounds: sourceBounds,
        obstacles: [],
        existingLabels: labelFwd ? [labelFwd] : [],
      });

      expect(labelFwd).not.toBeNull();
      expect(labelRev).not.toBeNull();

      // Labels must be separated and not overlap
      const overlap =
        labelFwd!.x < labelRev!.x + labelRev!.width &&
        labelFwd!.x + labelFwd!.width > labelRev!.x &&
        labelFwd!.y < labelRev!.y + labelRev!.height &&
        labelFwd!.y + labelFwd!.height > labelRev!.y;
      expect(overlap).toBe(false);
    });
  });

  // =========================================================================
  // 4. DENSE GRAPH
  // =========================================================================
  describe("4. Dense Graph Layout", () => {
    it("maintains collision-free separation in a dense 5-node complete graph (K5)", () => {
      const graph = createEmptySceneGraph({
        conceptType: "network",
      });

      const nodes = ["A", "B", "C", "D", "E"];
      for (const id of nodes) {
        addEntity(graph, {
          id: `k5-${id}`,
          primitiveType: "GraphNode",
          label: id,
        });
      }

      // Complete connectivity (all pairs connected)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          addRelationship(graph, {
            id: `e-${nodes[i]}-${nodes[j]}`,
            type: "connects",
            sourceEntityId: `k5-${nodes[i]}`,
            targetEntityId: `k5-${nodes[j]}`,
            label: `${i + j}`,
          });
        }
      }

      const layout = computeSceneGraphLayout(graph, { x: 150, y: 150 });
      const positions = Array.from(layout.positions.values());

      // Every node must have non-overlapping space (>= 90px)
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dist = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
          expect(dist).toBeGreaterThanOrEqual(90);
        }
      }

      expect(layout.bounds.width).toBeGreaterThanOrEqual(200);
      expect(layout.bounds.height).toBeGreaterThanOrEqual(200);
    });
  });

  // =========================================================================
  // 5. TREE REGRESSION VERIFICATION
  // =========================================================================
  describe("5. Tree Non-Regression", () => {
    it("preserves strict hierarchical tree layout for binary / AVL trees", () => {
      const graph = createEmptySceneGraph({
        conceptType: "tree",
        layoutStrategy: "tree",
        rootEntityId: "node-root",
      });

      // 3-level complete binary tree
      addEntity(graph, { id: "node-root", primitiveType: "TreeNode", value: "50", label: "50" });
      addEntity(graph, { id: "node-L", primitiveType: "TreeNode", value: "30", label: "30" });
      addEntity(graph, { id: "node-R", primitiveType: "TreeNode", value: "70", label: "70" });
      addEntity(graph, { id: "node-LL", primitiveType: "TreeNode", value: "20", label: "20" });
      addEntity(graph, { id: "node-LR", primitiveType: "TreeNode", value: "40", label: "40" });

      addRelationship(graph, { id: "r-root-L", sourceEntityId: "node-root", targetEntityId: "node-L", type: "leftOf" });
      addRelationship(graph, { id: "r-root-R", sourceEntityId: "node-root", targetEntityId: "node-R", type: "rightOf" });
      addRelationship(graph, { id: "r-L-LL", sourceEntityId: "node-L", targetEntityId: "node-LL", type: "leftOf" });
      addRelationship(graph, { id: "r-L-LR", sourceEntityId: "node-L", targetEntityId: "node-LR", type: "rightOf" });

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      const posRoot = layout.positions.get("node-root")!;
      const posL = layout.positions.get("node-L")!;
      const posR = layout.positions.get("node-R")!;
      const posLL = layout.positions.get("node-LL")!;
      const posLR = layout.positions.get("node-LR")!;

      // Root is at top
      expect(posL.y).toBeGreaterThan(posRoot.y);
      expect(posR.y).toBeGreaterThan(posRoot.y);
      expect(posL.y).toBe(posR.y);

      // Left child is strictly to the left of Right child
      expect(posL.x).toBeLessThan(posR.x);

      // Level 2
      expect(posLL.y).toBeGreaterThan(posL.y);
      expect(posLR.y).toBeGreaterThan(posL.y);
      expect(posLL.x).toBeLessThan(posLR.x);
    });
  });

  // =========================================================================
  // 6. LINKED LIST REGRESSION VERIFICATION
  // =========================================================================
  describe("6. Linked List / Sequence Non-Regression", () => {
    it("preserves strict linear horizontal layout for linked lists", () => {
      const graph = createEmptySceneGraph({
        conceptType: "linked_list",
        layoutStrategy: "linear",
      });

      const nodes = ["head", "node-1", "node-2", "node-3", "tail"];
      for (const id of nodes) {
        addEntity(graph, {
          id,
          primitiveType: "LinkedListNode",
          label: id,
        });
      }

      for (let i = 0; i < nodes.length - 1; i++) {
        addRelationship(graph, {
          id: `r-next-${i}`,
          sourceEntityId: nodes[i],
          targetEntityId: nodes[i + 1],
          type: "next",
        });
      }

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      // In a horizontal linked list: all Y coordinates are identical, X strictly increases
      for (let i = 0; i < nodes.length - 1; i++) {
        const currPos = layout.positions.get(nodes[i])!;
        const nextPos = layout.positions.get(nodes[i + 1])!;
        expect(currPos.y).toBe(nextPos.y);
        expect(nextPos.x).toBeGreaterThan(currPos.x);
      }
    });
  });
});
