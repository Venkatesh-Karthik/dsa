/**
 * Cognora Semantic Teaching Callout, Leader Line & Focus Anchor Test Suite
 *
 * Validates:
 * 1. Dynamic semantic focus resolution across operations, highlights, and scene elements
 * 2. Multi-target handling (primary focus + secondary focus)
 * 3. Leader line geometry (perimeter connection points, angles, SVG bezier paths)
 * 4. Suppression of L/R debug label boxes in learner mode
 * 5. Metadata scrubbing (avl-25, node-27, array-item-0, etc.)
 * 6. Universal multi-concept testing (Linked List, AVL, Dijkstra, Merge Sort, Quick Sort, BFS, Binary Search, Heap)
 */

import { describe, it, expect } from "vitest";

import {
  computeLeaderLineGeometry,
  type ScreenRect,
} from "../components/leader-line-geometry";
import {
  resolveSemanticFocus,
  resolveElementInScene,
} from "../components/semantic-focus-resolver";
import { planRelationshipLabel } from "../ai/visual-reasoning/relationship-label-planner";
import { ExplanationEngine } from "../ai/explanation-engine";
import { deriveCompactGlimpse } from "../components/glimpse-extractor";

import type { Transformation } from "../ai/visual-dsl";

describe("Cognora Dynamic Semantic Callout & Focus System", () => {
  // --------------------------------------------------------------------------
  // 1. Leader Line Geometry Calculations
  // --------------------------------------------------------------------------
  describe("Leader Line Geometry", () => {
    const targetRect: ScreenRect = {
      left: 300,
      top: 300,
      right: 380,
      bottom: 380,
      width: 80,
      height: 80,
    };

    it("calculates correct geometry when callout is placed above target", () => {
      const calloutRect: ScreenRect = {
        left: 210,
        top: 180,
        right: 470,
        bottom: 250,
        width: 260,
        height: 70,
      };

      const line = computeLeaderLineGeometry(calloutRect, targetRect, "above");
      expect(line).not.toBeNull();
      expect(line!.side).toBe("bottom");
      expect(line!.startY).toBe(calloutRect.bottom);
      expect(line!.endY).toBe(targetRect.top - 5);
      expect(line!.path).toContain(
        `M ${Math.round(line!.startX)} ${Math.round(line!.startY)} C`,
      );
      expect(line!.arrowAngle).toBeGreaterThan(0); // pointing downwards
    });

    it("calculates correct geometry when callout is placed below target", () => {
      const calloutRect: ScreenRect = {
        left: 210,
        top: 420,
        right: 470,
        bottom: 490,
        width: 260,
        height: 70,
      };

      const line = computeLeaderLineGeometry(calloutRect, targetRect, "below");
      expect(line).not.toBeNull();
      expect(line!.side).toBe("top");
      expect(line!.startY).toBe(calloutRect.top);
      expect(line!.endY).toBe(targetRect.bottom + 5);
      expect(line!.path).toContain(
        `M ${Math.round(line!.startX)} ${Math.round(line!.startY)} C`,
      );
    });

    it("calculates correct geometry when callout is placed to the left of target", () => {
      const calloutRect: ScreenRect = {
        left: 20,
        top: 305,
        right: 260,
        bottom: 375,
        width: 240,
        height: 70,
      };

      const line = computeLeaderLineGeometry(calloutRect, targetRect, "left");
      expect(line).not.toBeNull();
      expect(line!.side).toBe("right");
      expect(line!.startX).toBe(calloutRect.right);
      expect(line!.endX).toBe(targetRect.left - 5);
      expect(line!.path).toContain(
        `M ${Math.round(line!.startX)} ${Math.round(line!.startY)} C`,
      );
    });

    it("calculates correct geometry when callout is placed to the right of target", () => {
      const calloutRect: ScreenRect = {
        left: 420,
        top: 305,
        right: 680,
        bottom: 375,
        width: 260,
        height: 70,
      };

      const line = computeLeaderLineGeometry(calloutRect, targetRect, "right");
      expect(line).not.toBeNull();
      expect(line!.side).toBe("left");
      expect(line!.startX).toBe(calloutRect.left);
      expect(line!.endX).toBe(targetRect.right + 5);
      expect(line!.path).toContain(
        `M ${Math.round(line!.startX)} ${Math.round(line!.startY)} C`,
      );
    });

    it("suppresses leader line if callout and target are overlapping or too tight", () => {
      const overlappingCallout: ScreenRect = {
        left: 310,
        top: 310,
        right: 370,
        bottom: 370,
        width: 60,
        height: 60,
      };

      const line = computeLeaderLineGeometry(overlappingCallout, targetRect);
      expect(line).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Dynamic Semantic Focus Resolution
  // --------------------------------------------------------------------------
  describe("Semantic Focus Resolution", () => {
    const mockSceneElements = [
      {
        id: "node-root",
        type: "rectangle",
        customData: { dslId: "avl-20", nodeId: "20", label: "20" },
        x: 200,
        y: 100,
        width: 60,
        height: 60,
      },
      {
        id: "node-25",
        type: "rectangle",
        customData: { dslId: "avl-25", nodeId: "25", label: "25" },
        x: 300,
        y: 200,
        width: 60,
        height: 60,
      },
      {
        id: "node-27",
        type: "rectangle",
        customData: { dslId: "tree-node-27", nodeId: "27", label: "27" },
        x: 360,
        y: 280,
        width: 60,
        height: 60,
      },
      {
        id: "arr-item-3",
        type: "rectangle",
        customData: { dslId: "arr-3", label: "42" },
        x: 400,
        y: 100,
        width: 50,
        height: 50,
      },
      {
        id: "node-c",
        type: "ellipse",
        customData: { dslId: "graph-node-c", label: "C" },
        x: 150,
        y: 350,
        width: 50,
        height: 50,
      },
      {
        id: "node-d",
        type: "ellipse",
        customData: { dslId: "graph-node-d", label: "D" },
        x: 280,
        y: 350,
        width: 50,
        height: 50,
      },
    ];

    it("resolves focus from explicit transformation highlights", () => {
      const transformation: Transformation = {
        id: "t1",
        title: "Balance Tree",
        explanation: "Rotating around node 25",
        highlights: ["avl-25", "avl-20"],
        operations: [],
      };

      const focus = resolveSemanticFocus(transformation, mockSceneElements);
      expect(focus.primaryTargetId).toBe("avl-25");
      expect(focus.secondaryTargetIds).toContain("avl-20");
      expect(focus.primaryElement).toBeDefined();
      expect(focus.primaryElement.id).toBe("node-25");
    });

    it("resolves primary and secondary focus from swap/reorder operations", () => {
      const transformation: Transformation = {
        id: "t2",
        title: "Swap Elements",
        explanation: "Swap element A with element B to partition",
        operations: [
          {
            type: "reorder",
            target: "graph-node-c",
            swapWith: "graph-node-d",
          },
        ],
      };

      const focus = resolveSemanticFocus(transformation, mockSceneElements);
      expect(focus.primaryTargetId).toBe("graph-node-c");
      expect(focus.secondaryTargetIds).toContain("graph-node-d");
      expect(focus.primaryElement.id).toBe("node-c");
      expect(focus.secondaryElements[0].id).toBe("node-d");
    });

    it("dynamically resolves focus from title/explanation tokens matching scene elements", () => {
      const transformation: Transformation = {
        id: "t3",
        title: "Insert 27",
        explanation: "27 becomes the right child of 25 in the AVL tree.",
        operations: [],
      };

      const focus = resolveSemanticFocus(transformation, mockSceneElements);
      expect(focus.primaryTargetId).toBe("tree-node-27");
      expect(focus.secondaryTargetIds).toContain("avl-25");
      expect(focus.primaryElement.id).toBe("node-27");
      expect(focus.secondaryElements[0].id).toBe("node-25");
    });

    it("resolves scene elements by label, suffix, or customData", () => {
      const el27 = resolveElementInScene("27", mockSceneElements);
      expect(el27).not.toBeNull();
      expect(el27.id).toBe("node-27");

      const elD = resolveElementInScene("D", mockSceneElements);
      expect(elD).not.toBeNull();
      expect(elD.id).toBe("node-d");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Metadata Scrubbing & Natural Language
  // --------------------------------------------------------------------------
  describe("Metadata Scrubbing in Learner Mode", () => {
    it("cleans internal AVL identifiers avl-25, avl-50, avl-60 into natural labels", () => {
      const raw =
        "Introducing avl-25, avl-50, avl-60. Final tree after all 9 insertions.";
      const scrubbed = ExplanationEngine.scrubMetadata(raw);
      expect(scrubbed).not.toContain("avl-25");
      expect(scrubbed).not.toContain("avl-50");
      expect(scrubbed).not.toContain("avl-60");
      expect(scrubbed).toContain("25");
      expect(scrubbed).toContain("50");
      expect(scrubbed).toContain("60");
    });

    it("cleans node-27, array-item-0, main-array, and ptr-left", () => {
      const raw = "Move ptr-left on main-array past node-27 to array-item-0.";
      const scrubbed = ExplanationEngine.scrubMetadata(raw);
      expect(scrubbed).not.toContain("ptr-left");
      expect(scrubbed).not.toContain("main-array");
      expect(scrubbed).not.toContain("node-27");
      expect(scrubbed).not.toContain("array-item-0");
      expect(scrubbed).toContain("left pointer");
      expect(scrubbed).toContain("original array");
      expect(scrubbed).toContain("27");
      expect(scrubbed).toContain("element 0");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Suppression of L/R Floating Debug Boxes
  // --------------------------------------------------------------------------
  describe("L/R Floating Debug Box Suppression", () => {
    it("suppresses single-character 'L' and 'R' label capsules from rendering", () => {
      const candidateRoute = {
        points: [
          { x: 100, y: 100 },
          { x: 150, y: 200 },
        ],
        length: 120,
        bends: 0,
        hasOrthogonalAngles: false,
        crossesObstacle: false,
        crossesOtherConnectors: false,
        exitsSourcePerpendicularly: true,
        entersTargetPerpendicularly: true,
        totalScore: 100,
      };
      const bounds = { x: 100, y: 100, width: 50, height: 50 };

      const labelL = planRelationshipLabel({
        id: "rel-left",
        rawLabel: "L",
        route: candidateRoute as any,
        sourceBounds: bounds,
        targetBounds: bounds,
        obstacles: [],
      });
      expect(labelL).toBeNull();

      const labelR = planRelationshipLabel({
        id: "rel-right",
        rawLabel: "R",
        route: candidateRoute as any,
        sourceBounds: bounds,
        targetBounds: bounds,
        obstacles: [],
      });
      expect(labelR).toBeNull();

      // Meaningful semantic labels must NOT be suppressed
      const labelWeight = planRelationshipLabel({
        id: "rel-weight",
        rawLabel: "weight: 5",
        route: candidateRoute as any,
        sourceBounds: bounds,
        targetBounds: bounds,
        obstacles: [],
      });
      expect(labelWeight).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Universal Multi-Concept Verification
  // --------------------------------------------------------------------------
  describe("Universal Concept Focus & Callout Verification", () => {
    const concepts: {
      name: string;
      transformation: Transformation;
      expectedPrimary: string;
    }[] = [
      {
        name: "Linked List (Insert 25)",
        transformation: {
          id: "ll-1",
          title: "Insert 25",
          explanation: "25 is inserted after 10. 10 points to 25.",
          highlights: ["ll-node-25"],
          operations: [],
        },
        expectedPrimary: "ll-node-25",
      },
      {
        name: "Merge Sort (Split Half)",
        transformation: {
          id: "ms-1",
          title: "Split Array",
          explanation: "Array is split into left half and right half.",
          highlights: ["left-half"],
          operations: [],
        },
        expectedPrimary: "left-half",
      },
      {
        name: "Quick Sort (Choose Pivot)",
        transformation: {
          id: "qs-1",
          title: "Choose Pivot",
          explanation: "42 is selected as pivot element.",
          operations: [
            { type: "highlight", target: "arr-3", highlight: "pivot" } as any,
          ],
        },
        expectedPrimary: "arr-3",
      },
      {
        name: "AVL Tree (Rotate Right)",
        transformation: {
          id: "avl-1",
          title: "Rotate Right",
          explanation:
            "Tree at 30 becomes unbalanced after inserting 10. Rotate right at 30.",
          highlights: ["tree-node-30"],
          operations: [],
        },
        expectedPrimary: "tree-node-30",
      },
      {
        name: "Dijkstra (Relax Node D)",
        transformation: {
          id: "dijkstra-1",
          title: "Relax Edge C -> D",
          explanation: "Edge from C to D offers shorter path with distance 7.",
          operations: [
            { type: "connect", from: "node-c", to: "node-d" } as any,
          ],
        },
        expectedPrimary: "node-d",
      },
      {
        name: "BFS (Explore Node B)",
        transformation: {
          id: "bfs-1",
          title: "Explore Node B",
          explanation: "Node B is dequeued and its neighbors are visited.",
          highlights: ["node-b"],
          operations: [],
        },
        expectedPrimary: "node-b",
      },
      {
        name: "Binary Search (Compare Mid)",
        transformation: {
          id: "bs-1",
          title: "Compare Midpoint",
          explanation:
            "Middle value 17 is smaller than target 23, so search moves right.",
          operations: [
            {
              type: "annotate_pointer",
              id: "p1",
              target: "arr-2",
              label: "MID",
              placement: "above",
            },
          ],
        },
        expectedPrimary: "arr-2",
      },
      {
        name: "Heap (Restore Invariant)",
        transformation: {
          id: "heap-1",
          title: "Bubble Up 40",
          explanation:
            "40 violates max-heap property with parent 30. Swap 40 and 30.",
          operations: [
            {
              type: "reorder",
              target: "heap-node-40",
              swapWith: "heap-node-30",
            },
          ],
        },
        expectedPrimary: "heap-node-40",
      },
    ];

    for (const c of concepts) {
      it(`correctly derives semantic focus and compact glimpse for ${c.name}`, () => {
        const focus = resolveSemanticFocus(c.transformation);
        expect(focus.primaryTargetId).toBe(c.expectedPrimary);

        const glimpse = deriveCompactGlimpse({
          title: c.transformation.title,
          explanation: c.transformation.explanation,
        });

        expect(glimpse.title.length).toBeGreaterThan(0);
        expect(glimpse.glimpse.length).toBeGreaterThan(0);
        expect(glimpse.glimpse.length).toBeLessThanOrEqual(120);
      });
    }
  });
});
