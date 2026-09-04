/**
 * Selection-Aware Semantic Context Unit Tests
 */

import { describe, it, expect } from "vitest";
import {
  extractSelectedElementsContext,
  formatSelectedElementChip,
} from "../ai/selection-context";
import type { ExcalidrawElement } from "@excalidraw/element/types";

describe("extractSelectedElementsContext", () => {
  it("returns empty array when selection is empty or null", () => {
    const elements: ExcalidrawElement[] = [];
    expect(extractSelectedElementsContext(elements, null)).toEqual([]);
    expect(extractSelectedElementsContext(elements, {})).toEqual([]);
    expect(extractSelectedElementsContext(elements, [])).toEqual([]);
  });

  it("extracts semantic context for selected node with arrows", () => {
    const sceneElements = [
      {
        id: "el-node-30",
        type: "rectangle",
        isDeleted: false,
        customData: {
          dslId: "tree-node-30",
          role: "tree-node",
          value: 30,
          structureId: "tree-1",
        },
      } as unknown as ExcalidrawElement,
      {
        id: "el-node-20",
        type: "rectangle",
        isDeleted: false,
        customData: {
          dslId: "tree-node-20",
          role: "tree-node",
          value: 20,
          structureId: "tree-1",
        },
      } as unknown as ExcalidrawElement,
      {
        id: "arrow-1",
        type: "arrow",
        isDeleted: false,
        startBinding: { elementId: "el-node-20" },
        endBinding: { elementId: "el-node-30" },
        customData: { label: "right child" },
      } as unknown as ExcalidrawElement,
    ];

    const selectedIds = { "el-node-30": true };

    const result = extractSelectedElementsContext(sceneElements, selectedIds);

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.dslId).toBe("tree-node-30");
    expect(item.role).toBe("tree-node");
    expect(item.label).toBe("30");
    expect(item.parentStructureId).toBe("tree-1");
    expect(item.incomingArrows).toHaveLength(1);
    expect(item.incomingArrows![0].fromId).toBe("tree-node-20");
    expect(item.incomingArrows![0].label).toBe("right child");
  });
});

describe("formatSelectedElementChip", () => {
  it("returns null when no elements are selected", () => {
    expect(formatSelectedElementChip([])).toBeNull();
  });

  it("formats single element badge with label and role", () => {
    const selected = [
      {
        dslId: "tree-node-30",
        role: "tree-node",
        type: "rectangle",
        label: "30",
      },
    ];
    expect(formatSelectedElementChip(selected)).toBe(
      'Selected: "30" (tree-node)',
    );
  });

  it("formats multi-element badge with count", () => {
    const selected = [
      {
        dslId: "arr-0",
        role: "array-element",
        type: "rectangle",
        label: "5",
      },
      {
        dslId: "arr-1",
        role: "array-element",
        type: "rectangle",
        label: "10",
      },
    ];
    expect(formatSelectedElementChip(selected)).toBe('Selected: "5" +1 more');
  });
});
