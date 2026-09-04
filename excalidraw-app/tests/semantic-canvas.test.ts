import { describe, it, expect } from "vitest";
import {
  extractSemanticCanvasState,
  createSemanticSnapshot,
  detectSemanticCanvasChanges,
} from "../ai/semantic-canvas";
import type { ExcalidrawElement } from "@excalidraw/element/types";

function createMockElement(
  id: string,
  dslId?: string,
  text?: string,
  customData?: Record<string, any>,
): ExcalidrawElement {
  return {
    id,
    type: text !== undefined ? "text" : "rectangle",
    x: 100,
    y: 100,
    width: 60,
    height: 40,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: "a0",
    roundness: null,
    seed: 12345,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    text: text ?? "",
    originalText: text ?? "",
    customData: {
      dslId,
      ...customData,
    },
  } as unknown as ExcalidrawElement;
}

describe("Semantic Canvas Engine", () => {
  describe("createSemanticSnapshot and detectSemanticCanvasChanges", () => {
    it("should capture element snapshot and detect no changes when scene is unchanged", () => {
      const el1 = createMockElement("el-1", "arr-0-val", "20", {
        role: "array-element",
        arrayId: "arr",
        index: 0,
        value: 20,
      });

      const snapshot = createSemanticSnapshot([el1]);
      expect(snapshot.size).toBe(1);
      expect(snapshot.get("arr-0-val")?.value).toBe(20);

      const deltas = detectSemanticCanvasChanges([el1], snapshot);
      expect(deltas.length).toBe(0);
    });

    it("should detect when user modifies element text value (e.g. 20 -> 9)", () => {
      const elBefore = createMockElement("el-1", "arr-1-val", "20", {
        role: "array-element",
        arrayId: "arr",
        index: 1,
        value: 20,
      });

      const snapshot = createSemanticSnapshot([elBefore]);

      const elAfter = createMockElement("el-1", "arr-1-val", "9", {
        role: "array-element",
        arrayId: "arr",
        index: 1,
        value: 9,
      });

      const deltas = detectSemanticCanvasChanges([elAfter], snapshot);
      expect(deltas.length).toBeGreaterThan(0);
      const delta = deltas[0];
      expect(delta.type).toBe("value_change");
      expect(delta.targetDslId).toBe("arr-1-val");
      expect(delta.oldValue).toBe(20);
      expect(delta.newValue).toBe(9);
      expect(delta.description).toContain("edited from '20' to '9'");
    });

    it("should detect when user deletes an AI canvas element", () => {
      const el1 = createMockElement("el-1", "node-30", "30", {
        role: "tree-node",
        treeId: "tree",
        value: 30,
      });

      const snapshot = createSemanticSnapshot([el1]);

      const deltas = detectSemanticCanvasChanges([], snapshot);
      expect(deltas.length).toBeGreaterThan(0);
      const delta = deltas[0];
      expect(delta.type).toBe("element_deleted");
      expect(delta.targetDslId).toBe("node-30");
      expect(delta.description).toContain("removed");
    });
  });

  describe("extractSemanticCanvasState", () => {
    it("should extract structured array with elements and pointers", () => {
      const elements: ExcalidrawElement[] = [
        createMockElement("box-0", "arr-0", undefined, {
          role: "array-element",
          arrayId: "arr",
          index: 0,
          value: 10,
        }),
        createMockElement("val-0", "arr-0-val", "10", {
          role: "array-element",
          arrayId: "arr",
          index: 0,
          value: 10,
        }),
        createMockElement("box-1", "arr-1", undefined, {
          role: "array-element",
          arrayId: "arr",
          index: 1,
          value: 25,
        }),
        createMockElement("val-1", "arr-1-val", "25", {
          role: "array-element",
          arrayId: "arr",
          index: 1,
          value: 25,
        }),
        createMockElement("ptr-low", "arr-ptr-LOW", "LOW", {
          role: "pointer",
          label: "LOW",
          targetId: "arr-0",
        }),
      ];

      const state = extractSemanticCanvasState(elements);
      expect(state.arrays.length).toBe(1);
      expect(state.arrays[0].id).toBe("arr");
      expect(state.arrays[0].elements.map((e) => e.value)).toEqual([10, "10", 25, "25"]);
      expect(state.pointers.length).toBe(1);
      expect(state.pointers[0].label).toBe("LOW");
      expect(state.summaryText).toContain("Array 'arr'");
    });

    it("should extract structured tree with parent-child relationships", () => {
      const elements: ExcalidrawElement[] = [
        createMockElement("node-root", "tree-root", "50", {
          role: "tree-node",
          treeId: "tree",
          nodeId: "root",
          value: 50,
          left: "left-child",
          right: "right-child",
        }),
        createMockElement("node-left", "tree-left-child", "30", {
          role: "tree-node",
          treeId: "tree",
          nodeId: "left-child",
          value: 30,
        }),
        createMockElement("node-right", "tree-right-child", "70", {
          role: "tree-node",
          treeId: "tree",
          nodeId: "right-child",
          value: 70,
        }),
      ];

      const state = extractSemanticCanvasState(elements);
      expect(state.trees.length).toBe(1);
      expect(state.trees[0].id).toBe("tree");
      expect(state.trees[0].nodes.length).toBe(3);
      expect(state.summaryText).toContain("Tree 'tree'");
    });
  });
});
