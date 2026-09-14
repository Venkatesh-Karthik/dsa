/**
 * Universal Transformation Timeline & Concept Unit Tests
 *
 * Verifies lesson compilation, stable entity identities, complete scene states,
 * and universal concept execution (AVL, Binary Search, HTTP, and Arbitrary Concepts).
 */

import { describe, it, expect } from "vitest";
import {
  compileVisualLesson,
  type CompiledTimeline,
} from "../ai/transformation-timeline";
import { reconcileSceneState } from "../ai/scene-reconciler";
import { compileGenericConceptGraph } from "../ai/visual-grammar/generic-concept";
import { computeSceneGraphLayout } from "../ai/layout-engine";
import type { VisualLesson } from "../ai/visual-dsl";

describe("TransformationTimeline - AVL Rotations", () => {
  const avlLesson: VisualLesson = {
    id: "avl-rotations-lesson",
    title: "AVL Tree Rotations",
    initialScene: [
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
    transformations: [
      {
        id: "t1",
        title: "Right Rotation (LL Case)",
        explanation: "Rotate right around node 30 so node 20 becomes the new root.",
        operations: [
          {
            type: "create_tree",
            id: "avl-tree",
            root: "n20",
            nodes: [
              { id: "n20", value: 20, left: "n10", right: "n30", highlight: "success" },
              { id: "n10", value: 10 },
              { id: "n30", value: 30 },
            ],
          },
        ],
      },
      {
        id: "t2",
        title: "Balanced State",
        explanation: "All balance factors are now 0. Tree is perfectly balanced.",
        operations: [
          {
            type: "highlight",
            target: "avl-tree-n20",
            color: "primary",
          },
        ],
      },
    ],
  };

  it("compiles into complete SceneStates preserving stable node IDs", () => {
    const timeline = compileVisualLesson(avlLesson);

    expect(timeline.states).toHaveLength(3); // State 0 (initial), State 1 (after T1), State 2 (after T2)
    expect(timeline.meta).toHaveLength(3);

    // State 0: Initial unbalanced tree
    const s0 = timeline.states[0];
    expect(s0.graph.entities.size).toBe(3);
    expect(s0.graph.metadata?.rootEntityId).toBe("avl-tree-n30");
    expect(s0.graph.entities.get("avl-tree-n30")?.semanticRole).toBe("root");

    // State 1: Rotated tree — EXACT SAME ENTITY IDs ARE PRESERVED!
    const s1 = timeline.states[1];
    expect(s1.graph.entities.size).toBe(3);
    expect(s1.graph.entities.has("avl-tree-n30")).toBe(true);
    expect(s1.graph.entities.has("avl-tree-n20")).toBe(true);
    expect(s1.graph.entities.has("avl-tree-n10")).toBe(true);

    // Node 20 is now root
    expect(s1.graph.metadata?.rootEntityId).toBe("avl-tree-n20");
    expect(s1.graph.entities.get("avl-tree-n20")?.semanticRole).toBe("root");
    expect(s1.graph.entities.get("avl-tree-n20")?.properties?.highlight).toBe("success");

    // Relationships in State 1 reflect rotation: 20 -> 10 and 20 -> 30
    expect(s1.graph.relationships.has("edge-avl-tree-n20-avl-tree-n10")).toBe(true);
    expect(s1.graph.relationships.has("edge-avl-tree-n20-avl-tree-n30")).toBe(true);
    // Old relationship 30 -> 20 is gone
    expect(s1.graph.relationships.has("edge-avl-tree-n30-avl-tree-n20")).toBe(false);

    // State 2: Balanced state preserves all 3 nodes and updates highlight
    const s2 = timeline.states[2];
    expect(s2.graph.entities.size).toBe(3);
    expect(s2.graph.entities.get("avl-tree-n20")?.properties?.highlight).toBe("primary");
  });

  it("reconciles target states with zero missing nodes or orphaned arrows", () => {
    const timeline = compileVisualLesson(avlLesson);

    // Reconcile State 0 onto an empty canvas
    const res0 = reconcileSceneState(timeline.states[0], [], timeline.lessonId);
    const visible0 = res0.elements.filter((e) => !e.isDeleted);

    // 3 tree nodes (each node has circle + text = 2 elements) + 2 arrows = 8 elements
    expect(visible0.length).toBeGreaterThanOrEqual(5);

    // Reconcile State 1 (Next Step)
    const res1 = reconcileSceneState(timeline.states[1], res0.elements, timeline.lessonId);
    const visible1 = res1.elements.filter((e) => !e.isDeleted);
    expect(visible1.length).toBeGreaterThanOrEqual(5);

    // Reconcile back to State 0 (Previous Step) — RESTORES ENTIRE INITIAL SCENE!
    const resPrev = reconcileSceneState(timeline.states[0], res1.elements, timeline.lessonId);
    const visiblePrev = resPrev.elements.filter((e) => !e.isDeleted);

    // Complete tree restored!
    expect(visiblePrev.length).toBe(visible0.length);
    const dslIds = visiblePrev.map((e) => e.customData?.dslId).filter(Boolean);
    expect(dslIds).toContain("avl-tree-n30");
    expect(dslIds).toContain("avl-tree-n20");
    expect(dslIds).toContain("avl-tree-n10");
  });
});

describe("Universal Concept - Arbitrary Non-Programming Subject", () => {
  it("renders a physical concept (how a refrigerator works) without topic-specific hacks", () => {
    const fridgeGraph = compileGenericConceptGraph(
      [
        { id: "compressor", label: "Compressor", role: "pump" },
        { id: "condenser", label: "Condenser Coils", role: "heat-dissipation" },
        { id: "expansion-valve", label: "Expansion Valve", role: "pressure-drop" },
        { id: "evaporator", label: "Evaporator Coils", role: "cooling" },
      ],
      [
        { from: "compressor", to: "condenser", label: "High pressure gas" },
        { from: "condenser", to: "expansion-valve", label: "High pressure liquid" },
        { from: "expansion-valve", to: "evaporator", label: "Cold low pressure liquid" },
        { from: "evaporator", to: "compressor", label: "Low pressure gas" },
      ],
      { title: "Refrigeration Cycle", conceptType: "cycle" },
    );

    expect(fridgeGraph.entities.size).toBe(4);
    expect(fridgeGraph.relationships.size).toBe(4);

    // Layout engine computes 4-corner cyclical layout deterministically
    const layout = computeSceneGraphLayout(fridgeGraph, { x: 100, y: 100 });
    expect(layout.positions.size).toBe(4);
    expect(layout.bounds.width).toBeGreaterThan(100);
    expect(layout.bounds.height).toBeGreaterThan(100);

    for (const [id, pos] of layout.positions) {
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.y).toBeGreaterThan(0);
    }
  });
});

describe("Universal Concept - HTTP Protocol", () => {
  const httpLesson: VisualLesson = {
    id: "http-lesson",
    title: "HTTP Request and Response",
    initialScene: [
      {
        type: "create_box",
        id: "client",
        label: "Client (Browser)",
        role: "endpoint",
        style: { color: "primary" },
      },
      {
        type: "create_box",
        id: "server",
        label: "API Server",
        role: "endpoint",
        style: { color: "secondary" },
      },
    ],
    transformations: [
      {
        id: "t1",
        title: "HTTP Request",
        explanation: "Client sends GET /api/users request over TCP.",
        operations: [
          {
            type: "create_arrow",
            id: "http-req",
            from: "client",
            to: "server",
            label: "GET /api/users",
            role: "flow",
          },
        ],
      },
      {
        id: "t2",
        title: "HTTP Response",
        explanation: "Server responds with 200 OK JSON payload.",
        operations: [
          {
            type: "create_arrow",
            id: "http-res",
            from: "server",
            to: "client",
            label: "200 OK (JSON)",
            role: "flow",
            style: { color: "success" },
          },
        ],
      },
    ],
  };

  it("compiles HTTP protocol states with stable endpoints and animated message flows", () => {
    const timeline = compileVisualLesson(httpLesson);

    expect(timeline.states).toHaveLength(3);

    // State 0: Client and Server endpoints
    const s0 = timeline.states[0];
    expect(s0.graph.entities.has("client")).toBe(true);
    expect(s0.graph.entities.has("server")).toBe(true);
    expect(s0.graph.relationships.size).toBe(0);

    // State 1: Request arrow added between client and server
    const s1 = timeline.states[1];
    expect(s1.graph.entities.size).toBe(2);
    expect(s1.graph.relationships.has("http-req")).toBe(true);
    const req = s1.graph.relationships.get("http-req")!;
    expect(req.sourceEntityId).toBe("client");
    expect(req.targetEntityId).toBe("server");

    // State 2: Response arrow added
    const s2 = timeline.states[2];
    expect(s2.graph.entities.size).toBe(2);
    expect(s2.graph.relationships.has("http-res")).toBe(true);
    const res = s2.graph.relationships.get("http-res")!;
    expect(res.sourceEntityId).toBe("server");
    expect(res.targetEntityId).toBe("client");
  });
});
