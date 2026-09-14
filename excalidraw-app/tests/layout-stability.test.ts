import { describe, it, expect, vi } from "vitest";
import { computeSceneGraphLayout } from "../ai/layout-engine";
import {
  createEmptySceneGraph,
  addEntity,
  addRelationship,
} from "../ai/scene-graph";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { LessonPlaybackController } from "../ai/lesson-playback-controller";
import type { CreateTreeAction } from "../ai/visual-dsl";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

describe("Cognora Visual Intelligence & Layout Stability", () => {
  describe("1. Tree Layout Anti-Drift Invariant", () => {
    it("anchors tree root firmly and prevents downward or upward drift during insertion and AVL rotation", () => {
      // State 0: Root 30, left child 20
      const graph0 = createEmptySceneGraph({
        conceptType: "tree",
        rootEntityId: "n30",
      });
      addEntity(graph0, {
        id: "n30",
        primitiveType: "TreeNode",
        value: 30,
        semanticRole: "root",
      });
      addEntity(graph0, {
        id: "n20",
        primitiveType: "TreeNode",
        value: 20,
        semanticRole: "tree-node",
      });
      addRelationship(graph0, {
        id: "edge-30-20",
        type: "leftOf",
        sourceEntityId: "n30",
        targetEntityId: "n20",
      });

      const layout0 = computeSceneGraphLayout(graph0, { x: 420, y: 120 });
      const pos0_30 = layout0.positions.get("n30")!;
      const pos0_20 = layout0.positions.get("n20")!;

      expect(pos0_30).toBeDefined();
      expect(pos0_20).toBeDefined();
      // Root level 0 should be at anchor Y (120)
      expect(pos0_30.y).toBe(120);
      expect(pos0_20.y).toBe(220); // 120 + 100 LEVEL_GAP

      // State 1: Node 10 inserted as left child of 20
      const graph1 = createEmptySceneGraph({
        conceptType: "tree",
        rootEntityId: "n30",
      });
      addEntity(graph1, {
        id: "n30",
        primitiveType: "TreeNode",
        value: 30,
        semanticRole: "root",
      });
      addEntity(graph1, {
        id: "n20",
        primitiveType: "TreeNode",
        value: 20,
        semanticRole: "tree-node",
      });
      addEntity(graph1, {
        id: "n10",
        primitiveType: "TreeNode",
        value: 10,
        semanticRole: "tree-node",
      });
      addRelationship(graph1, {
        id: "edge-30-20",
        type: "leftOf",
        sourceEntityId: "n30",
        targetEntityId: "n20",
      });
      addRelationship(graph1, {
        id: "edge-20-10",
        type: "leftOf",
        sourceEntityId: "n20",
        targetEntityId: "n10",
      });

      const layout1 = computeSceneGraphLayout(
        graph1,
        { x: 420, y: 120 },
        layout0.positions,
      );
      const pos1_30 = layout1.positions.get("n30")!;
      const pos1_20 = layout1.positions.get("n20")!;
      const pos1_10 = layout1.positions.get("n10")!;

      // Invariant: Root node 30 and existing child 20 MUST NOT drift vertically
      expect(pos1_30.y).toBe(pos0_30.y);
      expect(pos1_20.y).toBe(pos0_20.y);
      expect(pos1_10.y).toBe(320); // 120 + 2 * 100

      // State 2: Right rotation (20 becomes new root, 10 is left child, 30 is right child)
      const graph2 = createEmptySceneGraph({
        conceptType: "tree",
        rootEntityId: "n20",
      });
      addEntity(graph2, {
        id: "n20",
        primitiveType: "TreeNode",
        value: 20,
        semanticRole: "root",
      });
      addEntity(graph2, {
        id: "n10",
        primitiveType: "TreeNode",
        value: 10,
        semanticRole: "tree-node",
      });
      addEntity(graph2, {
        id: "n30",
        primitiveType: "TreeNode",
        value: 30,
        semanticRole: "tree-node",
      });
      addRelationship(graph2, {
        id: "edge-20-10",
        type: "leftOf",
        sourceEntityId: "n20",
        targetEntityId: "n10",
      });
      addRelationship(graph2, {
        id: "edge-20-30",
        type: "rightOf",
        sourceEntityId: "n20",
        targetEntityId: "n30",
      });

      const layout2 = computeSceneGraphLayout(
        graph2,
        { x: 420, y: 120 },
        layout1.positions,
      );
      const pos2_20 = layout2.positions.get("n20")!;
      const pos2_10 = layout2.positions.get("n10")!;
      const pos2_30 = layout2.positions.get("n30")!;

      // Invariant: In-place rotation - new root 20 occupies root level (120)
      expect(pos2_20.y).toBe(120);
      expect(pos2_10.y).toBe(220);
      expect(pos2_30.y).toBe(220);
      // The scene transformed completely in place within the same vertical band [120, 320]
    });
  });

  describe("2. Graph Layout Persistence", () => {
    it("preserves exact node coordinates across multi-step graph traversal", () => {
      const graph0 = createEmptySceneGraph({ conceptType: "graph" });
      addEntity(graph0, { id: "A", primitiveType: "GraphNode", label: "A" });
      addEntity(graph0, { id: "B", primitiveType: "GraphNode", label: "B" });
      addEntity(graph0, { id: "C", primitiveType: "GraphNode", label: "C" });
      addRelationship(graph0, {
        id: "e-AB",
        type: "connects",
        sourceEntityId: "A",
        targetEntityId: "B",
      });

      const layout0 = computeSceneGraphLayout(graph0, { x: 300, y: 120 });
      const pos0_A = layout0.positions.get("A")!;
      const pos0_B = layout0.positions.get("B")!;
      const pos0_C = layout0.positions.get("C")!;

      // State 1: Visit node B, add edge BC
      const graph1 = createEmptySceneGraph({ conceptType: "graph" });
      addEntity(graph1, { id: "A", primitiveType: "GraphNode", label: "A" });
      addEntity(graph1, {
        id: "B",
        primitiveType: "GraphNode",
        label: "B",
        properties: { highlight: "active" },
      });
      addEntity(graph1, { id: "C", primitiveType: "GraphNode", label: "C" });
      addRelationship(graph1, {
        id: "e-AB",
        type: "connects",
        sourceEntityId: "A",
        targetEntityId: "B",
      });
      addRelationship(graph1, {
        id: "e-BC",
        type: "connects",
        sourceEntityId: "B",
        targetEntityId: "C",
      });

      const layout1 = computeSceneGraphLayout(
        graph1,
        { x: 300, y: 120 },
        layout0.positions,
      );
      expect(layout1.positions.get("A")).toEqual(pos0_A);
      expect(layout1.positions.get("B")).toEqual(pos0_B);
      expect(layout1.positions.get("C")).toEqual(pos0_C);
    });
  });

  describe("3. Container Entity Filtering", () => {
    it("never produces visual shape entities for container actions (e.g. avl-tree)", () => {
      const initialActions: [CreateTreeAction] = [
        {
          type: "create_tree",
          id: "avl-tree",
          root: "n30",
          nodes: [
            { id: "n30", value: 30, left: "n20" },
            { id: "n20", value: 20 },
          ],
        },
      ];

      const res = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain AVL Tree Right Rotation",
        {
          visual_actions: initialActions,
          steps: [
            {
              title: "Insert 10",
              explanation: "Node 10 inserted",
              visual_actions: [
                {
                  type: "create_tree",
                  id: "avl-tree",
                  root: "n30",
                  nodes: [
                    { id: "n30", value: 30, left: "n20" },
                    { id: "n20", value: 20, left: "n10" },
                    { id: "n10", value: 10 },
                  ],
                },
              ],
            },
          ],
        },
      );

      // Invariant: The entities in state 0 must only contain tree nodes, NEVER 'avl-tree'
      const state0Entities = Array.from(
        res.timeline.states[0].graph.entities.keys(),
      );
      expect(state0Entities).not.toContain("avl-tree");
      expect(state0Entities).toContain("avl-tree-n30");
      expect(state0Entities).toContain("avl-tree-n20");
    });
  });

  describe("4. Playback Controller Camera Behavior", () => {
    it("calls focusActiveElements ONLY on initial render and never on next/prev transitions", () => {
      const mockSetViewport = vi.fn();
      const mockAPI = {
        isDestroyed: false,
        setViewport: mockSetViewport,
        getSceneElementsIncludingDeleted: () => [
          {
            id: "el-1",
            isDeleted: false,
            customData: { isAiTeaching: true, lessonId: "test-lesson" },
          },
        ],
        updateScene: vi.fn(),
      } as unknown as ExcalidrawImperativeAPI;

      const timeline = {
        lessonId: "test-lesson",
        topic: "AVL Tree",
        currentIndex: 0,
        meta: [
          { id: "initial", title: "Step 0", explanation: "Initial" },
          { id: "step-1", title: "Step 1", explanation: "Step 1" },
        ],
        states: [
          {
            graph: createEmptySceneGraph(),
            layoutState: new Map(),
            layoutBounds: { x: 0, y: 0, width: 100, height: 100 },
          },
          {
            graph: createEmptySceneGraph(),
            layoutState: new Map(),
            layoutBounds: { x: 0, y: 0, width: 100, height: 100 },
          },
        ],
      };

      const controller = new LessonPlaybackController(mockAPI, timeline as any);

      // Initial render: should focus once
      controller.renderInitial(true);
      expect(mockSetViewport).toHaveBeenCalledTimes(1);

      // Advance to Next: should NOT call setViewport
      controller.next(false);
      expect(mockSetViewport).toHaveBeenCalledTimes(1);

      // Previous: should NOT call setViewport
      controller.prev(false);
      expect(mockSetViewport).toHaveBeenCalledTimes(1);
    });
  });
});
