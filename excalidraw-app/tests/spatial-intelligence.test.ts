// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import {
  deriveEntityBounds,
  findBestAnnotationPosition,
  computeSceneGraphLayout,
  checkAABBCollision,
  resolveLayoutCollisions,
  type LayoutBounds,
  type CollisionBox,
} from "../ai/layout-engine";
import {
  createEmptySceneGraph,
  addEntity,
  addRelationship,
  type SemanticEntity,
} from "../ai/scene-graph";
import { reconcileSceneState } from "../ai/scene-reconciler";
import { createSceneState } from "../ai/scene-state";
import { detectObstaclesBetween } from "../ai/connector-renderer";

beforeAll(() => {
  (global as any).HTMLCanvasElement.prototype.getContext = () => ({
    measureText: (text: string) => ({ width: text.length * 8 } as any),
    font: "",
  });
});

describe("Universal Visual Spatial Intelligence - Bounding Box Derivation", () => {
  it("derives content-aware bounds based on primitive type and text length", () => {
    const nodeEntity: SemanticEntity = {
      id: "node-1",
      primitiveType: "TreeNode",
      label: "42",
      properties: {},
    };

    const containerEntity: SemanticEntity = {
      id: "box-1",
      primitiveType: "Container",
      label: "Atmospheric Water Droplet Internal Boundary",
      properties: { width: 220, height: 160 },
    };

    const nodeBounds = deriveEntityBounds(nodeEntity, { x: 100, y: 100 });
    const containerBounds = deriveEntityBounds(containerEntity, { x: 300, y: 300 });

    expect(nodeBounds.width).toBeGreaterThanOrEqual(56);
    expect(nodeBounds.height).toBeGreaterThanOrEqual(56);
    expect(containerBounds.width).toBe(220);
    expect(containerBounds.height).toBe(160);
  });

  it("dynamically expands node width when label is lengthy", () => {
    const shortEntity: SemanticEntity = {
      id: "short",
      primitiveType: "GraphNode",
      label: "A",
      properties: {},
    };

    const longEntity: SemanticEntity = {
      id: "long",
      primitiveType: "GraphNode",
      label: "Dispersed Rainbow Spectrum",
      properties: {},
    };

    const shortBounds = deriveEntityBounds(shortEntity, { x: 0, y: 0 });
    const longBounds = deriveEntityBounds(longEntity, { x: 0, y: 0 });

    expect(longBounds.width).toBeGreaterThan(shortBounds.width);
  });
});

describe("Universal Visual Spatial Intelligence - Multi-Rank DAG Layout (e.g. Rainbow / Complex Concept)", () => {
  it("computes non-overlapping multi-rank DAG layout with non-zero horizontal span", () => {
    const graph = createEmptySceneGraph({ conceptType: "ProcessPipeline" });

    // Multi-rank DAG:
    // Rank 0: Sun
    // Rank 1: Droplet
    // Rank 2: Refraction, Reflection, Dispersion
    // Rank 3: Spectrum
    // Rank 4: Observer
    addEntity(graph, { id: "sun", primitiveType: "GenericEntity", label: "Sunlight Source" });
    addEntity(graph, { id: "droplet", primitiveType: "Container", label: "Water Droplet" });
    addEntity(graph, { id: "refraction", primitiveType: "GenericEntity", label: "Refraction (Entry)" });
    addEntity(graph, { id: "reflection", primitiveType: "GenericEntity", label: "Internal Reflection" });
    addEntity(graph, { id: "dispersion", primitiveType: "GenericEntity", label: "Dispersion" });
    addEntity(graph, { id: "spectrum", primitiveType: "GenericEntity", label: "Color Spectrum" });
    addEntity(graph, { id: "observer", primitiveType: "GenericEntity", label: "Human Observer" });

    addRelationship(graph, { id: "r1", type: "connects", sourceEntityId: "sun", targetEntityId: "droplet" });
    addRelationship(graph, { id: "r2", type: "connects", sourceEntityId: "droplet", targetEntityId: "refraction" });
    addRelationship(graph, { id: "r3", type: "connects", sourceEntityId: "droplet", targetEntityId: "reflection" });
    addRelationship(graph, { id: "r4", type: "connects", sourceEntityId: "droplet", targetEntityId: "dispersion" });
    addRelationship(graph, { id: "r5", type: "connects", sourceEntityId: "refraction", targetEntityId: "spectrum" });
    addRelationship(graph, { id: "r6", type: "connects", sourceEntityId: "reflection", targetEntityId: "spectrum" });
    addRelationship(graph, { id: "r7", type: "connects", sourceEntityId: "dispersion", targetEntityId: "spectrum" });
    addRelationship(graph, { id: "r8", type: "connects", sourceEntityId: "spectrum", targetEntityId: "observer" });

    const layout = computeSceneGraphLayout(graph);
    expect(layout.positions.size).toBe(7);

    // Verify horizontal span (ranks are spread out horizontally)
    const sunPos = layout.positions.get("sun")!;
    const dropletPos = layout.positions.get("droplet")!;
    const spectrumPos = layout.positions.get("spectrum")!;
    const observerPos = layout.positions.get("observer")!;

    expect(dropletPos.x).toBeGreaterThan(sunPos.x);
    expect(spectrumPos.x).toBeGreaterThan(dropletPos.x);
    expect(observerPos.x).toBeGreaterThan(spectrumPos.x);

    // Verify parallel siblings (refraction, reflection, dispersion) are vertically separated
    const refrPos = layout.positions.get("refraction")!;
    const reflPos = layout.positions.get("reflection")!;
    const dispPos = layout.positions.get("dispersion")!;

    const yCoords = [refrPos.y, reflPos.y, dispPos.y].sort((a, b) => a - b);
    expect(yCoords[1] - yCoords[0]).toBeGreaterThanOrEqual(80);
    expect(yCoords[2] - yCoords[1]).toBeGreaterThanOrEqual(80);

    // Verify zero AABB collisions between all entities
    const entityBoundsList: { id: string; bounds: LayoutBounds }[] = [];
    for (const [id, entity] of graph.entities.entries()) {
      const pos = layout.positions.get(id)!;
      entityBoundsList.push({ id, bounds: deriveEntityBounds(entity, pos) });
    }

    for (let i = 0; i < entityBoundsList.length; i++) {
      for (let j = i + 1; j < entityBoundsList.length; j++) {
        const a = entityBoundsList[i];
        const b = entityBoundsList[j];
        const collides = checkAABBCollision(a.bounds, b.bounds, 12);
        expect(
          collides,
          `Entities "${a.id}" and "${b.id}" collide unexpectedly: ${JSON.stringify(a.bounds)} vs ${JSON.stringify(b.bounds)}`,
        ).toBe(false);
      }
    }
  });
});

describe("Universal Visual Spatial Intelligence - 2D Grid for Disconnected/Parallel Entities", () => {
  it("lays out multiple disconnected entities in a balanced 2D grid instead of a 1D column", () => {
    const graph = createEmptySceneGraph();
    for (let i = 1; i <= 8; i++) {
      addEntity(graph, {
        id: `card-${i}`,
        primitiveType: "GenericEntity",
        label: `Item #${i}`,
      });
    }

    const layout = computeSceneGraphLayout(graph);
    expect(layout.positions.size).toBe(8);

    // Check unique X coordinates (must be > 1 column)
    const uniqueXs = new Set<number>();
    for (const pos of layout.positions.values()) {
      uniqueXs.add(pos.x);
    }
    expect(uniqueXs.size).toBeGreaterThan(1);
  });
});

describe("Universal Visual Spatial Intelligence - Cycle Layout Separation", () => {
  it("expands radius for cyclic relationships so nodes do not overlap", () => {
    const graph = createEmptySceneGraph({ conceptType: "Cycle" });
    const ids = ["stateA", "stateB", "stateC", "stateD", "stateE"];
    for (const id of ids) {
      addEntity(graph, { id, primitiveType: "GraphNode", label: id });
    }
    // Form closed ring
    addRelationship(graph, { id: "c1", type: "connects", sourceEntityId: "stateA", targetEntityId: "stateB" });
    addRelationship(graph, { id: "c2", type: "connects", sourceEntityId: "stateB", targetEntityId: "stateC" });
    addRelationship(graph, { id: "c3", type: "connects", sourceEntityId: "stateC", targetEntityId: "stateD" });
    addRelationship(graph, { id: "c4", type: "connects", sourceEntityId: "stateD", targetEntityId: "stateE" });
    addRelationship(graph, { id: "c5", type: "connects", sourceEntityId: "stateE", targetEntityId: "stateA" });

    const layout = computeSceneGraphLayout(graph);

    // Verify distance between any pair is at least 90px
    const points = ids.map((id) => layout.positions.get(id)!);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        expect(dist).toBeGreaterThanOrEqual(90);
      }
    }
  });
});

describe("Universal Visual Spatial Intelligence - Non-Occluding Annotation Placement", () => {
  it("places annotations into a collision-free candidate slot when obstacles exist", () => {
    const anchorBounds: LayoutBounds = { x: 200, y: 200, width: 80, height: 60 };
    const annotationBounds: LayoutBounds = { x: 0, y: 0, width: 140, height: 50 };

    // Obstacle directly above anchor
    const obstacleAbove: LayoutBounds = { x: 190, y: 100, width: 100, height: 60 };

    const bestPos = findBestAnnotationPosition(
      anchorBounds,
      annotationBounds,
      [obstacleAbove],
      "above",
    );

    const placedBounds: LayoutBounds = {
      x: bestPos.x,
      y: bestPos.y,
      width: annotationBounds.width,
      height: annotationBounds.height,
    };

    // Placed annotation must NOT collide with anchor or obstacle
    expect(checkAABBCollision(placedBounds, anchorBounds, 0)).toBe(false);
    expect(checkAABBCollision(placedBounds, obstacleAbove, 0)).toBe(false);
  });
});

describe("Universal Visual Spatial Intelligence - Connector Robustness & Obstacle Avoidance", () => {
  it("resolves connectors using fuzzy label/alias lookup in Scene Reconciler", () => {
    const graph = createEmptySceneGraph();
    addEntity(graph, { id: "node-left", primitiveType: "GenericEntity", label: "Source A" });
    addEntity(graph, { id: "node-right", primitiveType: "GenericEntity", label: "Target B" });
    // AI references by lowercase or label:
    addRelationship(graph, {
      id: "rel-1",
      type: "connects",
      sourceEntityId: "source a",
      targetEntityId: "node-right",
      label: "flows to",
    });

    const state = createSceneState(graph);
    const result = reconcileSceneState(state, []);

    // Verify arrow element exists
    const arrows = result.elements.filter((el) => el.type === "arrow");
    expect(arrows.length).toBe(1);
    expect(arrows[0].customData?.dslId).toBe("rel-1");

    // Verify edge label element is created
    const labels = result.elements.filter(
      (el) => el.type === "text" && el.customData?.dslId === "rel-1-label",
    );
    expect(labels.length).toBe(1);
    expect((labels[0] as any).text).toBe("flows to");
  });

  it("detects intermediate obstacles along the direct path between source and target", () => {
    const fromBounds = { x: 50, y: 170, width: 80, height: 60 };
    const toBounds = { x: 450, y: 170, width: 80, height: 60 };

    // Intermediate obstacle node in the direct line
    const obstacleRecord = {
      primaryElement: {
        id: "obstacle-1",
        type: "rectangle",
        x: 200,
        y: 170,
        width: 100,
        height: 60,
      } as any,
      bounds: { x: 200, y: 170, width: 100, height: 60 },
    };

    const detected = detectObstaclesBetween(fromBounds, toBounds, [obstacleRecord]);
    expect(detected.length).toBe(1);
    expect(detected[0].primaryElement.id).toBe("obstacle-1");
  });
});
