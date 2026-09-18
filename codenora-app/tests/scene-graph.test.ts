/**
 * Scene Graph & Scene State Unit Tests
 *
 * Verifies canonical semantic model, state immutability, stable object identity,
 * and first-class relationship tracking.
 */

import { describe, it, expect } from "vitest";

import {
  createEmptySceneGraph,
  cloneSceneGraph,
  addEntity,
  updateEntity,
  removeEntity,
  addRelationship,
  removeRelationship,
  getRelationshipsForEntity,
  type SemanticEntity,
  type SemanticRelationship,
} from "../ai/scene-graph";
import {
  createSceneState,
  cloneSceneState,
  createSceneGraphFromActions,
} from "../ai/scene-state";
import { computeSceneGraphDiff } from "../ai/diff-engine";

import type { VisualAction } from "../ai/visual-dsl";

describe("SceneGraph & SceneState", () => {
  it("creates and mutates entities with stable IDs", () => {
    const graph = createEmptySceneGraph();

    const entity: SemanticEntity = {
      id: "node-20",
      primitiveType: "TreeNode",
      semanticRole: "tree-node",
      value: 20,
      label: "20",
    };

    addEntity(graph, entity);
    expect(graph.entities.has("node-20")).toBe(true);

    // In-place update preserving ID
    const updated = updateEntity(graph, "node-20", {
      semanticRole: "root",
      properties: { highlight: "success" },
    });

    expect(updated).toBe(true);
    const retrieved = graph.entities.get("node-20")!;
    expect(retrieved.id).toBe("node-20");
    expect(retrieved.semanticRole).toBe("root");
    expect(retrieved.properties?.highlight).toBe("success");
    expect(retrieved.value).toBe(20);
  });

  it("guarantees state immutability through deep cloning", () => {
    const originalGraph = createEmptySceneGraph();
    addEntity(originalGraph, {
      id: "server",
      primitiveType: "GenericEntity",
      label: "API Server",
      properties: { color: "primary" },
    });

    const state0 = createSceneState(originalGraph);
    const state1 = cloneSceneState(state0);

    // Mutate state1 graph
    updateEntity(state1.graph, "server", {
      label: "API Server (Busy)",
      properties: { color: "danger" },
    });

    // Original state0 must remain completely untouched
    expect(state0.graph.entities.get("server")!.label).toBe("API Server");
    expect(state0.graph.entities.get("server")!.properties?.color).toBe(
      "primary",
    );

    // State1 reflects mutation
    expect(state1.graph.entities.get("server")!.label).toBe(
      "API Server (Busy)",
    );
    expect(state1.graph.entities.get("server")!.properties?.color).toBe(
      "danger",
    );
  });

  it("tracks relationships as first-class objects and cascades deletions", () => {
    const graph = createEmptySceneGraph();

    addEntity(graph, {
      id: "client",
      primitiveType: "GenericEntity",
      label: "Client",
    });
    addEntity(graph, {
      id: "server",
      primitiveType: "GenericEntity",
      label: "Server",
    });

    addRelationship(graph, {
      id: "req-1",
      type: "sendsTo",
      sourceEntityId: "client",
      targetEntityId: "server",
      label: "GET /data",
    });

    expect(graph.relationships.size).toBe(1);
    expect(getRelationshipsForEntity(graph, "client")).toHaveLength(1);
    expect(getRelationshipsForEntity(graph, "server")).toHaveLength(1);

    // Removing an entity cascades to its relationships
    removeEntity(graph, "client");
    expect(graph.entities.has("client")).toBe(false);
    expect(graph.relationships.has("req-1")).toBe(false);
    expect(getRelationshipsForEntity(graph, "server")).toHaveLength(0);
  });

  it("compiles legacy visual actions into a canonical SceneGraph with stable relationships", () => {
    const actions: VisualAction[] = [
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
    ];

    const graph = createSceneGraphFromActions(actions);

    expect(graph.entities.size).toBe(3);
    expect(graph.entities.has("avl-tree-n30")).toBe(true);
    expect(graph.entities.has("avl-tree-n20")).toBe(true);
    expect(graph.entities.has("avl-tree-n10")).toBe(true);

    // Relationships: edge-30-20 and edge-20-10
    expect(graph.relationships.size).toBe(2);
    expect(graph.relationships.has("edge-avl-tree-n30-avl-tree-n20")).toBe(
      true,
    );
    expect(graph.relationships.has("edge-avl-tree-n20-avl-tree-n10")).toBe(
      true,
    );
  });
});

describe("SceneDiff", () => {
  it("computes accurate diff between two SceneStates", () => {
    const g0 = createEmptySceneGraph();
    addEntity(g0, { id: "n10", primitiveType: "TreeNode", value: 10 });
    addEntity(g0, { id: "n20", primitiveType: "TreeNode", value: 20 });
    addRelationship(g0, {
      id: "e-1",
      type: "leftOf",
      sourceEntityId: "n20",
      targetEntityId: "n10",
    });

    const state0 = createSceneState(g0);

    const g1 = cloneSceneGraph(g0);
    // Add n30
    addEntity(g1, {
      id: "n30",
      primitiveType: "TreeNode",
      value: 30,
      properties: { highlight: "success" },
    });
    // Connect n20 -> n30
    addRelationship(g1, {
      id: "e-2",
      type: "rightOf",
      sourceEntityId: "n20",
      targetEntityId: "n30",
    });

    const state1 = createSceneState(g1);

    const diff = computeSceneGraphDiff(state0, state1, 0, 1);

    expect(diff.addedEntities).toHaveLength(1);
    expect(diff.addedEntities[0].id).toBe("n30");
    expect(diff.removedEntities).toHaveLength(0);
    expect(diff.addedRelationships).toHaveLength(1);
    expect(diff.addedRelationships[0].id).toBe("e-2");
  });
});
