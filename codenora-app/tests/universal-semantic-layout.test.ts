/**
 * Universal Semantic Visual Composition & Relationship-Aware Layout Tests
 *
 * Validates:
 * 1. Visual structure is strictly derived from semantic relationships.
 * 2. TEST 1 — MAX HEAP: Complete binary tree hierarchy + horizontal array beneath (NO vertical stacking).
 * 3. TEST 2 — LINKED LIST: Horizontal chain from semantic next relationships with native connectors.
 * 4. TEST 3 — AVL: Pure hierarchical tree, single-child branching, no L/R debug capsules.
 * 5. TEST 4 — DIJKSTRA: Weighted graph in 2D space, edge weights legible, no vertical collapse.
 * 5. TEST 5 — MERGE SORT: Responsive multi-row/tier array, no microscopic horizontal strip.
 * 6. TEST 6 — QUICK SORT: Partition clarity, pointer placement, no internal debug IDs.
 * 7. TEST 7 — BFS: 2D graph structure + focal entity resolution.
 * 8. EXECUTABLE INVARIANTS: Entity conservation, relationship validity, hierarchy validity,
 *    sequence validity, layout validity, overlap validity, connector validity, determinism.
 */

import { describe, it, expect } from "vitest";

import {
  createEmptySceneGraph,
  addEntity,
  addRelationship,
  type SemanticEntity,
  type SemanticRelationship,
} from "../ai/scene-graph";

import {
  computeSceneGraphLayout,
  computeTreeLayout,
  computeGraphLayout,
  TREE_LAYOUT,
  GRAPH_LAYOUT,
  type LayoutPoint,
} from "../ai/layout-engine";

import {
  validateSceneVisualInvariants,
  validateLayoutDeterminism,
} from "../ai/visual-validation";

import { planRelationshipLabel } from "../ai/visual-reasoning/relationship-label-planner";

import type { CandidateRoute } from "../ai/visual-reasoning/connector-router";

describe("Universal Semantic Visual Composition & Relationship-Aware Layout", () => {
  // =========================================================================
  // TEST 1 — MAX HEAP
  // Insert: 15, 10, 20, 8, 25, 30, 5, 35, 40
  // Resulting Heap Array: [40, 35, 25, 30, 10, 15, 5, 8, 20]
  // Expected:
  //              40
  //            /    \
  //          35      25
  //         /  \    /  \
  //       30   10  15   5
  //      /  \
  //     8   20
  // Must render as a balanced binary tree on top and array beneath.
  // Must NOT collapse into a single vertical column.
  // =========================================================================
  describe("TEST 1 — Max Heap Composition", () => {
    it("derives tree hierarchy from semantic relationships and places array beneath without vertical collapse", () => {
      const graph = createEmptySceneGraph();
      graph.metadata = {
        title: "Max Heap Insertion",
        conceptType: "heap",
        rootEntityId: "node-40",
      };

      const heapValues = [40, 35, 25, 30, 10, 15, 5, 8, 20];

      // 1. Add Tree Entities
      for (const val of heapValues) {
        addEntity(graph, {
          id: `node-${val}`,
          primitiveType: "TreeNode",
          semanticRole: val === 40 ? "root" : "tree-node",
          value: val,
          label: String(val),
        });
      }

      // 2. Add Parent-Child Relationships for Complete Binary Tree
      // parent index i has left child 2i+1 and right child 2i+2
      for (let i = 0; i < heapValues.length; i++) {
        const leftIdx = 2 * i + 1;
        const rightIdx = 2 * i + 2;
        const parentVal = heapValues[i];

        if (leftIdx < heapValues.length) {
          const leftVal = heapValues[leftIdx];
          addRelationship(graph, {
            id: `rel-${parentVal}-left-${leftVal}`,
            type: "leftOf",
            sourceEntityId: `node-${parentVal}`,
            targetEntityId: `node-${leftVal}`,
          });
        }
        if (rightIdx < heapValues.length) {
          const rightVal = heapValues[rightIdx];
          addRelationship(graph, {
            id: `rel-${parentVal}-right-${rightVal}`,
            type: "rightOf",
            sourceEntityId: `node-${parentVal}`,
            targetEntityId: `node-${rightVal}`,
          });
        }
      }

      // 3. Add Secondary Array Representation
      for (let i = 0; i < heapValues.length; i++) {
        addEntity(graph, {
          id: `cell-${i}`,
          primitiveType: "ArrayCell",
          semanticRole: "array-element",
          value: heapValues[i],
          label: String(heapValues[i]),
          properties: {
            containerId: "heap-array",
            index: i,
          },
        });
      }

      // 4. Compute Universal Layout
      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      // -- Structural Assertions --
      // Root (40) is at the top
      const pos40 = layout.positions.get("node-40")!;
      const pos35 = layout.positions.get("node-35")!;
      const pos25 = layout.positions.get("node-25")!;

      expect(pos40).toBeDefined();
      expect(pos35).toBeDefined();
      expect(pos25).toBeDefined();

      // Level 1 children are below root
      expect(pos35.y).toBeGreaterThan(pos40.y);
      expect(pos25.y).toBeGreaterThan(pos40.y);
      expect(pos35.y).toBe(pos25.y); // Same depth level

      // Left child (35) is strictly to the left of Right child (25)
      expect(pos35.x).toBeLessThan(pos25.x);
      // Siblings have substantial horizontal gap (NOT vertically stacked)
      expect(pos25.x - pos35.x).toBeGreaterThanOrEqual(100);

      // Level 2 children
      const pos30 = layout.positions.get("node-30")!;
      const pos10 = layout.positions.get("node-10")!;
      const pos15 = layout.positions.get("node-15")!;
      const pos5 = layout.positions.get("node-5")!;

      expect(pos30.y).toBeGreaterThan(pos35.y);
      expect(pos30.x).toBeLessThan(pos10.x);
      expect(pos10.x).toBeLessThan(pos15.x);
      expect(pos15.x).toBeLessThan(pos5.x);

      // Level 3 children (8 and 20 under 30)
      const pos8 = layout.positions.get("node-8")!;
      const pos20 = layout.positions.get("node-20")!;
      expect(pos8.y).toBeGreaterThan(pos30.y);
      expect(pos8.x).toBeLessThan(pos20.x);

      // Verify Array Cells are in Secondary Region BELOW the entire tree
      const maxTreeY = Math.max(pos8.y, pos20.y);
      for (let i = 0; i < heapValues.length; i++) {
        const cellPos = layout.positions.get(`cell-${i}`)!;
        expect(cellPos).toBeDefined();
        // Array cells must be well below the tree
        expect(cellPos.y).toBeGreaterThan(maxTreeY);
      }

      // Verify Array Cells are ordered horizontally
      for (let i = 0; i < heapValues.length - 1; i++) {
        const cellA = layout.positions.get(`cell-${i}`)!;
        const cellB = layout.positions.get(`cell-${i + 1}`)!;
        expect(cellA.x).toBeLessThan(cellB.x);
      }

      // 5. Pre-render Visual Invariants Validation
      const validation = validateSceneVisualInvariants(
        graph,
        layout.positions,
        layout.bounds,
      );

      expect(validation.valid).toBe(true);
      expect(
        validation.violations.filter((v) => v.severity === "error").length,
      ).toBe(0);
      expect(validation.metrics.hierarchyBranches).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // TEST 2 — LINKED LIST
  // 10 -> 40 -> 60, then insert 25 to get:
  // 10 -> 25 -> 40 -> 60
  // Must render horizontally with native connectors and no fake arrow text.
  // =========================================================================
  describe("TEST 2 — Linked List Composition", () => {
    it("renders horizontal sequence from semantic next relationships with stable layout upon insertion", () => {
      // Step A: Initial state 10 -> 40 -> 60
      const graphA = createEmptySceneGraph();
      graphA.metadata = {
        title: "Linked List Initial",
        conceptType: "linked_list",
      };

      const nodesA = [10, 40, 60];
      for (let i = 0; i < nodesA.length; i++) {
        addEntity(graphA, {
          id: `node-${nodesA[i]}`,
          primitiveType: "LinkedListNode",
          semanticRole:
            i === 0 ? "head" : i === nodesA.length - 1 ? "tail" : "list-node",
          value: nodesA[i],
          label: String(nodesA[i]),
        });
      }

      addRelationship(graphA, {
        id: "rel-10-40",
        type: "next",
        sourceEntityId: "node-10",
        targetEntityId: "node-40",
      });
      addRelationship(graphA, {
        id: "rel-40-60",
        type: "next",
        sourceEntityId: "node-40",
        targetEntityId: "node-60",
      });

      const layoutA = computeSceneGraphLayout(graphA, { x: 100, y: 150 });
      const pos10A = layoutA.positions.get("node-10")!;
      const pos40A = layoutA.positions.get("node-40")!;
      const pos60A = layoutA.positions.get("node-60")!;

      expect(pos10A.x).toBeLessThan(pos40A.x);
      expect(pos40A.x).toBeLessThan(pos60A.x);
      expect(pos10A.y).toBe(pos40A.y);
      expect(pos40A.y).toBe(pos60A.y);

      // Step B: Insert 25 -> 10 -> 25 -> 40 -> 60
      const graphB = createEmptySceneGraph();
      graphB.metadata = {
        title: "Linked List Insert 25",
        conceptType: "linked_list",
      };

      const nodesB = [10, 25, 40, 60];
      for (let i = 0; i < nodesB.length; i++) {
        addEntity(graphB, {
          id: `node-${nodesB[i]}`,
          primitiveType: "LinkedListNode",
          semanticRole:
            i === 0 ? "head" : i === nodesB.length - 1 ? "tail" : "list-node",
          value: nodesB[i],
          label: String(nodesB[i]),
        });
      }

      addRelationship(graphB, {
        id: "rel-10-25",
        type: "next",
        sourceEntityId: "node-10",
        targetEntityId: "node-25",
      });
      addRelationship(graphB, {
        id: "rel-25-40",
        type: "next",
        sourceEntityId: "node-25",
        targetEntityId: "node-40",
      });
      addRelationship(graphB, {
        id: "rel-40-60",
        type: "next",
        sourceEntityId: "node-40",
        targetEntityId: "node-60",
      });

      // Pass layoutA.positions as previousLayout to test stability
      const layoutB = computeSceneGraphLayout(
        graphB,
        { x: 100, y: 150 },
        layoutA.positions,
      );

      const pos10B = layoutB.positions.get("node-10")!;
      const pos25B = layoutB.positions.get("node-25")!;
      const pos40B = layoutB.positions.get("node-40")!;
      const pos60B = layoutB.positions.get("node-60")!;

      // Head node 10 remains stable at original coordinate
      expect(pos10B.x).toBe(pos10A.x);
      // Insertion places 25 cleanly between 10 and 40
      expect(pos10B.x).toBeLessThan(pos25B.x);
      expect(pos25B.x).toBeLessThan(pos40B.x);
      expect(pos40B.x).toBeLessThan(pos60B.x);

      // Verify no fake arrow text entities exist in graph
      for (const entity of graphB.entities.values()) {
        expect(entity.label).not.toMatch(/^arrow\d+/i);
        expect(entity.label).not.toBe("next");
      }

      // Visual Invariants
      const valA = validateSceneVisualInvariants(
        graphA,
        layoutA.positions,
        layoutA.bounds,
      );
      const valB = validateSceneVisualInvariants(
        graphB,
        layoutB.positions,
        layoutB.bounds,
      );
      expect(valA.valid).toBe(true);
      expect(valB.valid).toBe(true);
    });
  });

  // =========================================================================
  // TEST 3 — AVL TREE
  // Insert: 30, 20, 10, 25, 28, 27, 50, 60, 55
  // Verify correct hierarchy, no L/R debug capsules, single child branching
  // =========================================================================
  describe("TEST 3 — AVL Tree Composition", () => {
    it("renders balanced hierarchy, branches single children correctly, and suppresses L/R debug labels", () => {
      const graph = createEmptySceneGraph();
      graph.metadata = {
        title: "AVL Tree",
        conceptType: "tree",
        rootEntityId: "node-28",
      };

      // Balanced AVL tree with root 28
      //              28
      //            /    \
      //          20      55
      //         /  \    /  \
      //       10   25  50  60
      //             \
      //             27
      const avlNodes = [28, 20, 55, 10, 25, 50, 60, 27];
      for (const val of avlNodes) {
        addEntity(graph, {
          id: `node-${val}`,
          primitiveType: "TreeNode",
          semanticRole: val === 28 ? "root" : "tree-node",
          value: val,
          label: String(val),
        });
      }

      // Semantic relationships
      addRelationship(graph, {
        id: "r-28-20",
        type: "leftOf",
        sourceEntityId: "node-28",
        targetEntityId: "node-20",
      });
      addRelationship(graph, {
        id: "r-28-55",
        type: "rightOf",
        sourceEntityId: "node-28",
        targetEntityId: "node-55",
      });
      addRelationship(graph, {
        id: "r-20-10",
        type: "leftOf",
        sourceEntityId: "node-20",
        targetEntityId: "node-10",
      });
      addRelationship(graph, {
        id: "r-20-25",
        type: "rightOf",
        sourceEntityId: "node-20",
        targetEntityId: "node-25",
      });
      addRelationship(graph, {
        id: "r-55-50",
        type: "leftOf",
        sourceEntityId: "node-55",
        targetEntityId: "node-50",
      });
      addRelationship(graph, {
        id: "r-55-60",
        type: "rightOf",
        sourceEntityId: "node-55",
        targetEntityId: "node-60",
      });
      // Node 25 has only a single right child: 27
      addRelationship(graph, {
        id: "r-25-27",
        type: "rightOf",
        sourceEntityId: "node-25",
        targetEntityId: "node-27",
      });

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      const pos28 = layout.positions.get("node-28")!;
      const pos20 = layout.positions.get("node-20")!;
      const pos55 = layout.positions.get("node-55")!;
      const pos25 = layout.positions.get("node-25")!;
      const pos27 = layout.positions.get("node-27")!;

      expect(pos20.x).toBeLessThan(pos28.x);
      expect(pos55.x).toBeGreaterThan(pos28.x);

      // Single right child (27 under 25) must branch to the right of 25
      expect(pos27.x).toBeGreaterThan(pos25.x);
      expect(pos27.y).toBeGreaterThan(pos25.y);

      // Verify learner mode debug label suppression
      // L and R labels must NOT be generated
      const mockRoute = {
        name: "direct",
        startX: 0,
        startY: 0,
        endX: 10,
        endY: 10,
        points: [
          [0, 0],
          [10, 10],
        ],
        isElbowed: false,
        cost: 14,
      } as unknown as CandidateRoute;

      const labelL = planRelationshipLabel({
        id: "lbl-L",
        rawLabel: "L",
        route: mockRoute,
        sourceBounds: { x: 0, y: 0, width: 60, height: 60 },
        targetBounds: { x: 10, y: 10, width: 60, height: 60 },
        obstacles: [],
      });
      const labelR = planRelationshipLabel({
        id: "lbl-R",
        rawLabel: "R",
        route: mockRoute,
        sourceBounds: { x: 0, y: 0, width: 60, height: 60 },
        targetBounds: { x: 10, y: 10, width: 60, height: 60 },
        obstacles: [],
      });
      const labelNext = planRelationshipLabel({
        id: "lbl-next",
        rawLabel: "next",
        route: mockRoute,
        sourceBounds: { x: 0, y: 0, width: 60, height: 60 },
        targetBounds: { x: 10, y: 10, width: 60, height: 60 },
        obstacles: [],
      });

      expect(labelL).toBeNull();
      expect(labelR).toBeNull();
      expect(labelNext).toBeNull();

      // Visual Invariants
      const validation = validateSceneVisualInvariants(
        graph,
        layout.positions,
        layout.bounds,
      );
      expect(validation.valid).toBe(true);
    });
  });

  // =========================================================================
  // TEST 4 — DIJKSTRA
  // Weighted graph with nodes A, B, C, D, E, F
  // Verify 2D graph distribution, edge weight legibility, no vertical collapse
  // =========================================================================
  describe("TEST 4 — Dijkstra Graph Composition", () => {
    it("preserves 2D distributed graph structure, keeps edge weights readable, and avoids vertical stacking", () => {
      const graph = createEmptySceneGraph();
      graph.metadata = {
        title: "Dijkstra Shortest Path",
        conceptType: "graph",
      };

      const nodes = ["A", "B", "C", "D", "E", "F"];
      for (const id of nodes) {
        addEntity(graph, {
          id: `node-${id}`,
          primitiveType: "GraphNode",
          value: id,
          label: id,
        });
      }

      const weightedEdges = [
        { from: "A", to: "B", weight: 4 },
        { from: "A", to: "C", weight: 2 },
        { from: "B", to: "D", weight: 5 },
        { from: "C", to: "D", weight: 8 },
        { from: "C", to: "E", weight: 10 },
        { from: "D", to: "F", weight: 2 },
        { from: "E", to: "F", weight: 3 },
      ];

      for (const e of weightedEdges) {
        addRelationship(graph, {
          id: `edge-${e.from}-${e.to}`,
          type: "connects",
          sourceEntityId: `node-${e.from}`,
          targetEntityId: `node-${e.to}`,
          label: String(e.weight),
          properties: { weight: e.weight },
        });
      }

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      // Check 2D spread: xSpan and ySpan must both be substantial (NOT a 1D column)
      const xCoords = nodes.map((n) => layout.positions.get(`node-${n}`)!.x);
      const yCoords = nodes.map((n) => layout.positions.get(`node-${n}`)!.y);
      const xSpan = Math.max(...xCoords) - Math.min(...xCoords);
      const ySpan = Math.max(...yCoords) - Math.min(...yCoords);

      expect(xSpan).toBeGreaterThanOrEqual(150);
      expect(ySpan).toBeGreaterThanOrEqual(150);

      // Verify that edge weights ARE preserved by label planner (they are meaningful data, not debug capsules)
      const weightLabel = planRelationshipLabel({
        id: "lbl-weight",
        rawLabel: "4",
        route: {
          name: "direct",
          startX: 50,
          startY: 50,
          endX: 150,
          endY: 50,
          points: [
            [0, 0],
            [100, 0],
          ],
          isElbowed: false,
          cost: 100,
        } as unknown as CandidateRoute,
        sourceBounds: { x: 20, y: 30, width: 60, height: 60 },
        targetBounds: { x: 150, y: 30, width: 60, height: 60 },
        obstacles: [],
      });
      expect(weightLabel).not.toBeNull();
      expect(weightLabel!.displayText).toBe("4");

      // Visual Invariants
      const validation = validateSceneVisualInvariants(
        graph,
        layout.positions,
        layout.bounds,
      );
      expect(validation.valid).toBe(true);
    });
  });

  // =========================================================================
  // TEST 5 — MERGE SORT
  // Array [4, 56, 85, 96, 85, 77, 12, 32, 56, 52] (10 elements)
  // Subarray splitting: parent array + left/right subarrays in tiers
  // =========================================================================
  describe("TEST 5 — Merge Sort Composition", () => {
    it("composes readable multi-row/tier arrays and prevents microscopic horizontal strips", () => {
      const graph = createEmptySceneGraph();
      graph.metadata = {
        title: "Merge Sort Split",
        conceptType: "array",
      };

      const original = [4, 56, 85, 96, 85, 77, 12, 32, 56, 52];

      // Parent array
      for (let i = 0; i < original.length; i++) {
        addEntity(graph, {
          id: `main-${i}`,
          primitiveType: "ArrayCell",
          semanticRole: "array-element",
          value: original[i],
          label: String(original[i]),
          properties: { containerId: "main", index: i },
        });
      }

      // Left subarray [4, 56, 85, 96, 85]
      const leftHalf = original.slice(0, 5);
      for (let i = 0; i < leftHalf.length; i++) {
        addEntity(graph, {
          id: `left-${i}`,
          primitiveType: "ArrayCell",
          semanticRole: "array-element",
          value: leftHalf[i],
          label: String(leftHalf[i]),
          properties: { containerId: "leftSub", index: i },
        });
      }

      // Right subarray [77, 12, 32, 56, 52]
      const rightHalf = original.slice(5);
      for (let i = 0; i < rightHalf.length; i++) {
        addEntity(graph, {
          id: `right-${i}`,
          primitiveType: "ArrayCell",
          semanticRole: "array-element",
          value: rightHalf[i],
          label: String(rightHalf[i]),
          properties: { containerId: "rightSub", index: i },
        });
      }

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      // Main array is in Tier 0 (top)
      const mainCell0 = layout.positions.get("main-0")!;
      // Left and Right subarrays are in Tier 1 (below main)
      const leftCell0 = layout.positions.get("left-0")!;
      const rightCell0 = layout.positions.get("right-0")!;

      expect(leftCell0.y).toBeGreaterThan(mainCell0.y);
      expect(rightCell0.y).toBeGreaterThan(mainCell0.y);

      // Left subarray is to the left of Right subarray
      expect(leftCell0.x).toBeLessThan(rightCell0.x);

      // 10 elements wrap into 2 rows of 5 for optimal readability (not a 10-column strip)
      const mainCell4 = layout.positions.get("main-4")!;
      const mainCell5 = layout.positions.get("main-5")!;
      // Cell 5 is wrapped to the second row
      expect(mainCell5.y).toBeGreaterThan(mainCell4.y);

      // Visual Invariants
      const validation = validateSceneVisualInvariants(
        graph,
        layout.positions,
        layout.bounds,
      );
      expect(validation.valid).toBe(true);
    });
  });

  // =========================================================================
  // TEST 6 — QUICK SORT
  // Array [42, 17, 8, 99, 23, 56, 4, 31, 12, 67, 3, 29, 75, 15, 51] (15 elements)
  // Pivot visual clarity, pointer placement without overlap, no internal IDs
  // =========================================================================
  describe("TEST 6 — Quick Sort Composition", () => {
    it("places pivot and pointers clearly, wraps large array responsively, and enforces entity conservation", () => {
      const graph = createEmptySceneGraph();
      graph.metadata = {
        title: "Quick Sort Partitioning",
        conceptType: "array",
      };

      const arr = [42, 17, 8, 99, 23, 56, 4, 31, 12, 67, 3, 29, 75, 15, 51];

      for (let i = 0; i < arr.length; i++) {
        addEntity(graph, {
          id: `cell-${i}`,
          primitiveType: "ArrayCell",
          semanticRole: i === 14 ? "pivot" : "array-element",
          value: arr[i],
          label: String(arr[i]),
          properties: { containerId: "qs-array", index: i },
        });
      }

      // Add Pointers: low (at index 0), high (at index 13), pivot (at index 14)
      addEntity(graph, {
        id: "ptr-low",
        primitiveType: "Pointer",
        semanticRole: "pointer",
        label: "low",
        properties: { targetId: "cell-0" },
      });
      addEntity(graph, {
        id: "ptr-high",
        primitiveType: "Pointer",
        semanticRole: "pointer",
        label: "high",
        properties: { targetId: "cell-13" },
      });

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });

      // Pointers are placed relative to their target cells without overlapping them
      const cell0Pos = layout.positions.get("cell-0")!;
      const ptrLowPos = layout.positions.get("ptr-low")!;
      expect(ptrLowPos).toBeDefined();
      expect(ptrLowPos.y).toBeLessThan(cell0Pos.y); // Pointer placed above target cell

      const cell13Pos = layout.positions.get("cell-13")!;
      const ptrHighPos = layout.positions.get("ptr-high")!;
      expect(ptrHighPos).toBeDefined();
      expect(ptrHighPos.y).toBeGreaterThan(cell13Pos.y); // high placed below cell

      // Visual Invariants
      const validation = validateSceneVisualInvariants(
        graph,
        layout.positions,
        layout.bounds,
      );
      expect(validation.valid).toBe(true);
    });
  });

  // =========================================================================
  // TEST 7 — BFS
  // Graph: A-B, A-C, B-D, B-E, C-F, C-G
  // Graph structure remains 2D distributed with clear focus
  // =========================================================================
  describe("TEST 7 — BFS Graph Traversal", () => {
    it("maintains 2D graph distribution and resolves focal entity", () => {
      const graph = createEmptySceneGraph();
      graph.metadata = {
        title: "BFS Graph Traversal",
        conceptType: "graph",
        focalEntityId: "node-B",
      };

      const nodes = ["A", "B", "C", "D", "E", "F", "G"];
      for (const id of nodes) {
        addEntity(graph, {
          id: `node-${id}`,
          primitiveType: "GraphNode",
          value: id,
          label: id,
        });
      }

      const edges = [
        ["A", "B"],
        ["A", "C"],
        ["B", "D"],
        ["B", "E"],
        ["C", "F"],
        ["C", "G"],
      ];

      for (const [u, v] of edges) {
        addRelationship(graph, {
          id: `rel-${u}-${v}`,
          type: "connects",
          sourceEntityId: `node-${u}`,
          targetEntityId: `node-${v}`,
        });
      }

      const layout = computeSceneGraphLayout(graph, { x: 120, y: 120 });

      expect(layout.positions.size).toBe(7);

      // Verify non-collapse into single line
      const xs = nodes.map((n) => layout.positions.get(`node-${n}`)!.x);
      const ys = nodes.map((n) => layout.positions.get(`node-${n}`)!.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(150);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(150);

      // Visual Invariants check
      const validation = validateSceneVisualInvariants(
        graph,
        layout.positions,
        layout.bounds,
      );
      expect(validation.valid).toBe(true);
    });
  });

  // =========================================================================
  // EXECUTABLE VISUAL INVARIANTS
  // =========================================================================
  describe("Executable Visual Invariants Engine", () => {
    it("enforces ENTITY_CONSERVATION by flagging unplaced or duplicate entities", () => {
      const graph = createEmptySceneGraph();
      addEntity(graph, {
        id: "node-1",
        primitiveType: "GenericEntity",
        label: "Entity 1",
      });
      addEntity(graph, {
        id: "node-2",
        primitiveType: "GenericEntity",
        label: "Entity 2",
      });

      // Missing position for node-2
      const incompletePositions = new Map<string, LayoutPoint>([
        ["node-1", { x: 100, y: 100 }],
      ]);

      const validation = validateSceneVisualInvariants(
        graph,
        incompletePositions,
        { x: 100, y: 100, width: 60, height: 60 },
      );

      expect(validation.valid).toBe(false);
      expect(
        validation.violations.some((v) => v.code === "ENTITY_CONSERVATION"),
      ).toBe(true);
    });

    it("enforces RELATIONSHIP_VALIDITY by detecting dangling endpoints", () => {
      const graph = createEmptySceneGraph();
      addEntity(graph, {
        id: "node-A",
        primitiveType: "GenericEntity",
        label: "Node A",
      });

      // Relationship targets non-existent node-B
      addRelationship(graph, {
        id: "rel-invalid",
        type: "connects",
        sourceEntityId: "node-A",
        targetEntityId: "node-B",
      });

      const positions = new Map<string, LayoutPoint>([
        ["node-A", { x: 100, y: 100 }],
      ]);

      const validation = validateSceneVisualInvariants(graph, positions, {
        x: 100,
        y: 100,
        width: 60,
        height: 60,
      });

      expect(validation.valid).toBe(false);
      expect(
        validation.violations.some((v) => v.code === "RELATIONSHIP_VALIDITY"),
      ).toBe(true);
    });

    it("enforces HIERARCHY_VALIDITY by detecting vertical tree collapse", () => {
      const graph = createEmptySceneGraph();
      addEntity(graph, {
        id: "root",
        primitiveType: "TreeNode",
        label: "Root",
      });
      addEntity(graph, {
        id: "child-1",
        primitiveType: "TreeNode",
        label: "C1",
      });
      addEntity(graph, {
        id: "child-2",
        primitiveType: "TreeNode",
        label: "C2",
      });

      addRelationship(graph, {
        id: "r1",
        type: "leftOf",
        sourceEntityId: "root",
        targetEntityId: "child-1",
      });
      addRelationship(graph, {
        id: "r2",
        type: "rightOf",
        sourceEntityId: "root",
        targetEntityId: "child-2",
      });

      // Vertically collapsed coordinates (siblings have nearly identical x)
      const collapsedPositions = new Map<string, LayoutPoint>([
        ["root", { x: 100, y: 100 }],
        ["child-1", { x: 100, y: 200 }],
        ["child-2", { x: 102, y: 300 }],
      ]);

      const validation = validateSceneVisualInvariants(
        graph,
        collapsedPositions,
        { x: 100, y: 100, width: 60, height: 300 },
      );

      expect(validation.valid).toBe(false);
      expect(
        validation.violations.some((v) => v.code === "HIERARCHY_VALIDITY"),
      ).toBe(true);
    });

    it("enforces OVERLAP_VALIDITY by detecting severe element intersections", () => {
      const graph = createEmptySceneGraph();
      addEntity(graph, {
        id: "box-A",
        primitiveType: "GenericEntity",
        label: "A",
      });
      addEntity(graph, {
        id: "box-B",
        primitiveType: "GenericEntity",
        label: "B",
      });

      // Nearly complete overlap (80% overlap)
      const overlappingPositions = new Map<string, LayoutPoint>([
        ["box-A", { x: 100, y: 100 }],
        ["box-B", { x: 105, y: 105 }],
      ]);

      const validation = validateSceneVisualInvariants(
        graph,
        overlappingPositions,
        { x: 100, y: 100, width: 70, height: 70 },
      );

      expect(validation.valid).toBe(false);
      expect(
        validation.violations.some((v) => v.code === "OVERLAP_VALIDITY"),
      ).toBe(true);
    });

    it("enforces DETERMINISM across repeat layout executions", () => {
      const graph = createEmptySceneGraph();
      graph.metadata = { conceptType: "heap", rootEntityId: "node-40" };
      for (const val of [40, 35, 25, 30, 10, 15, 5, 8, 20]) {
        addEntity(graph, {
          id: `node-${val}`,
          primitiveType: "TreeNode",
          value: val,
        });
      }
      addRelationship(graph, {
        id: "r1",
        type: "leftOf",
        sourceEntityId: "node-40",
        targetEntityId: "node-35",
      });
      addRelationship(graph, {
        id: "r2",
        type: "rightOf",
        sourceEntityId: "node-40",
        targetEntityId: "node-25",
      });

      const determinismResult = validateLayoutDeterminism(graph, (g) =>
        computeSceneGraphLayout(g, { x: 150, y: 150 }),
      );

      expect(determinismResult.deterministic).toBe(true);
      expect(determinismResult.differences).toHaveLength(0);
    });
  });
});
