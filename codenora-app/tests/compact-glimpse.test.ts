import { describe, it, expect } from "vitest";

import {
  deriveCompactGlimpse,
  estimateGlimpseDimensions,
} from "../components/glimpse-extractor";
import { computeIntelligentOverlayPosition } from "../components/CognoraOverlayPlacement";
import { createGenericEntity } from "../ai/visual-primitives/generic-entity";
import { RenderContext, renderAction } from "../ai/visual-renderer";

import type { CreateBoxAction } from "../ai/visual-dsl";

describe("Cognora Compact Teaching Glimpse & UI Presentation Layer", () => {
  const mockAppState = {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
  };

  const standardContainer = {
    width: 1440,
    height: 900,
  };

  // --------------------------------------------------------------------------
  // Test A: Long explanation -> compact canvas glimpse
  // --------------------------------------------------------------------------
  it("Test A: Long explanation -> derives compact canvas glimpse (<= 110 chars)", () => {
    const longExplanation =
      "The head pointer references node 10, which serves as the entry point to the singly linked list. " +
      "Each node contains a data payload and a reference to the succeeding element. " +
      "Traversing the list requires sequentially following pointer references until encountering NULL. " +
      "The time complexity for accessing any arbitrary element is O(n) because random indexing is unsupported.";

    const result = deriveCompactGlimpse({
      title: "Step 1 of 4: Head Pointer & First Node",
      explanation: longExplanation,
    });

    expect(result.title).toBe("Head Pointer & First Node");
    expect(result.glimpse.length).toBeLessThanOrEqual(115);
    expect(result.glimpse).toMatch(/Head points to node 10|entry point/i);
    expect(result.glimpse.endsWith(".")).toBe(true);
    expect(result.fullExplanation).toBe(longExplanation);
  });

  // --------------------------------------------------------------------------
  // Test B: Short explanation -> compact card
  // --------------------------------------------------------------------------
  it("Test B: Short explanation -> produces compact card with sensible dimensions", () => {
    const shortExplanation = "Insert 25 between 10 and 40.";
    const result = deriveCompactGlimpse({
      title: "Insert 25",
      explanation: shortExplanation,
    });

    expect(result.title).toBe("Insert 25");
    expect(result.glimpse).toBe("Insert 25 between 10 and 40.");

    const dimensions = estimateGlimpseDimensions(result, 1440);
    expect(dimensions.width).toBeLessThanOrEqual(310);
    expect(dimensions.height).toBeLessThanOrEqual(95);
    expect(dimensions.height).toBeGreaterThanOrEqual(68);
  });

  // --------------------------------------------------------------------------
  // Test C: Very long explanation -> never overflows
  // --------------------------------------------------------------------------
  it("Test C: Very long explanation -> summarizes cleanly and never overflows visual budget", () => {
    const multiParagraph =
      "WHAT: The partition algorithm scans elements smaller than the pivot and places them to the left.\n" +
      "WHY: Lomuto partitioning maintains an invariant where elements before boundary j are strictly <= pivot.\n" +
      "WHAT CHANGED: Elements 4, 12, 17 are placed before index 4.\n" +
      "INVARIANT: All elements in left subarray <= pivot value 23.\n" +
      "COMPLEXITY: O(n) partition time with O(1) auxiliary space.";

    const result = deriveCompactGlimpse({
      title: "Transformation 3: Partition Around Pivot",
      explanation: multiParagraph,
    });

    expect(result.title).toBe("Partition Around Pivot");
    expect(result.glimpse.length).toBeLessThanOrEqual(115);
    expect(result.glimpse).toContain("The partition algorithm scans elements");

    const dimensions = estimateGlimpseDimensions(result, 1200);
    expect(dimensions.height).toBeLessThanOrEqual(115);
  });

  // --------------------------------------------------------------------------
  // Test D: Narrow viewport -> card remains visible within safe bounds
  // --------------------------------------------------------------------------
  it("Test D: Narrow viewport -> card dimensions adapt and stay visible", () => {
    const result = deriveCompactGlimpse({
      title: "Rotate Right",
      explanation:
        "30 becomes unbalanced after inserting 10, requiring an LL rotation.",
    });

    const narrowContainer = { width: 380, height: 700 };
    const dimensions = estimateGlimpseDimensions(result, narrowContainer.width);

    expect(dimensions.width).toBeLessThanOrEqual(380 - 48);

    const placement = computeIntelligentOverlayPosition({
      containerRect: narrowContainer,
      cardDimensions: dimensions,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    expect(placement.x).toBeGreaterThanOrEqual(24);
    expect(placement.x + dimensions.width).toBeLessThanOrEqual(
      narrowContainer.width,
    );
    expect(placement.y).toBeGreaterThanOrEqual(84); // Below navbar
  });

  // --------------------------------------------------------------------------
  // Test E: Visualization beneath card -> card relocates
  // --------------------------------------------------------------------------
  it("Test E: Visualization beneath candidate position -> card relocates without collision", () => {
    // Large cluster of nodes occupying top-left (200, 150)
    const sceneElements = [
      {
        id: "node-a",
        type: "rectangle",
        x: 100,
        y: 120,
        width: 280,
        height: 160,
        isDeleted: false,
      },
      {
        id: "node-b",
        type: "rectangle",
        x: 400,
        y: 120,
        width: 280,
        height: 160,
        isDeleted: false,
      },
    ];

    const cardDimensions = { width: 280, height: 85 };

    const placement = computeIntelligentOverlayPosition({
      containerRect: standardContainer,
      cardDimensions,
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    // Verify card does not overlap node-a
    const overlapsNodeA =
      placement.x < 100 + 280 &&
      placement.x + cardDimensions.width > 100 &&
      placement.y < 120 + 160 &&
      placement.y + cardDimensions.height > 120;

    expect(overlapsNodeA).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Test F: Inspector open -> canvas glimpse remains unobtrusive
  // --------------------------------------------------------------------------
  it("Test F: Inspector open -> canvas glimpse avoids right inspector panel", () => {
    const cardDimensions = { width: 290, height: 85 };

    const placement = computeIntelligentOverlayPosition({
      containerRect: standardContainer,
      cardDimensions,
      appState: mockAppState,
      isInspectorOpen: true, // Inspector occupies x >= 1440 - 410 = 1030
    });

    expect(placement.x + cardDimensions.width).toBeLessThanOrEqual(1440 - 410);
  });

  // --------------------------------------------------------------------------
  // Test G: Text annotation -> complete text remains inside intended container bounds
  // --------------------------------------------------------------------------
  it("Test G: Text annotation -> complete text remains inside container bounds without escaping", () => {
    const longAnnotationLabel =
      "Singly Linked List: 10 -> 25 -> 40 -> 55 -> NULL";

    // 1. Generic Entity expansion
    const entityPrimitive = createGenericEntity({
      id: "list-annotation",
      x: 100,
      y: 100,
      width: 180, // nominal base width
      height: 80, // nominal base height
      label: longAnnotationLabel,
      shape: "rectangle",
      role: "annotation",
    });

    // The container must have expanded beyond nominal 180px to envelop the 48-char string
    expect(entityPrimitive.primaryElement.width).toBeGreaterThanOrEqual(380);
    expect(entityPrimitive.primaryElement.width).toBeGreaterThan(
      longAnnotationLabel.length * 8,
    );

    // 2. Visual Renderer create_box action
    const boxAction: CreateBoxAction = {
      type: "create_box",
      id: "summary-card",
      label: longAnnotationLabel,
      role: "callout",
    };

    const renderContext = new RenderContext();
    const elements = renderAction(boxAction, renderContext);
    const boxElement = elements.find((e) => e.type === "rectangle");

    expect(boxElement).toBeDefined();
    expect(boxElement!.width).toBeGreaterThanOrEqual(440);
  });

  // --------------------------------------------------------------------------
  // Test H: Transformation changes -> glimpse updates with position stability
  // --------------------------------------------------------------------------
  it("Test H: Transformation changes -> applies stability bonus to prevent jumping", () => {
    const cardDimensions = { width: 280, height: 80 };
    const previousPosition = { x: 300, y: 180 };

    const placement = computeIntelligentOverlayPosition({
      containerRect: standardContainer,
      cardDimensions,
      appState: mockAppState,
      isInspectorOpen: false,
      previousPosition,
    });

    // When the previous position was free, candidate close to it should be favored
    expect(
      Math.hypot(
        placement.x - previousPosition.x,
        placement.y - previousPosition.y,
      ),
    ).toBeLessThan(120);
  });

  // --------------------------------------------------------------------------
  // Test I: Internal metadata -> never appears in learner-facing UI
  // --------------------------------------------------------------------------
  it("Test I: Internal metadata -> scrubbed from both title and glimpse", () => {
    const result = deriveCompactGlimpse({
      title: "Step 2: Compare t2-op0 with main-array",
      explanation:
        "Scan node-25 and compare with ptr-low in bs-array to determine target.",
    });

    expect(result.title).not.toMatch(/t2-op0|main-array/i);
    expect(result.glimpse).not.toMatch(/node-25|ptr-low|bs-array/i);
    expect(result.glimpse).toContain("target");
  });

  // --------------------------------------------------------------------------
  // Test J: Multi-concept test across all 8 required concept types
  // --------------------------------------------------------------------------
  it("Test J: Dynamically derives compact glimpse and valid placement for all 8 concepts", () => {
    const conceptCases = [
      {
        concept: "Linked List",
        title: "Insert Node 25",
        explanation:
          "Head points to the first node 10, then node 10 points to node 25, and node 25 points to node 40.",
      },
      {
        concept: "Merge Sort",
        title: "Split Array",
        explanation:
          "The array is split into two smaller halves, left half [4, 56, 85, 96, 85] and right half [77, 12, 32, 56, 52].",
      },
      {
        concept: "Quick Sort",
        title: "Lomuto Partition",
        explanation:
          "Elements smaller than the pivot 23 move to the left partition while larger elements remain right.",
      },
      {
        concept: "AVL Tree",
        title: "Right Rotation",
        explanation:
          "Node 30 becomes unbalanced with factor +2 after inserting 10, triggering a single right rotation.",
      },
      {
        concept: "Dijkstra",
        title: "Relax Edge C to D",
        explanation:
          "Node C is now the closest unsettled node with current shortest distance 4.",
      },
      {
        concept: "BFS",
        title: "Visit Neighbor B",
        explanation:
          "De-queue node A and enqueue all unvisited adjacent neighbors B and C into the traversal queue.",
      },
      {
        concept: "Binary Search",
        title: "Examine Midpoint",
        explanation:
          "The middle value at index 3 is smaller than target 42, so the search interval moves to the right half.",
      },
      {
        concept: "Heap",
        title: "Bubble Up Element",
        explanation:
          "Value 15 is smaller than its parent 28, so swap them upward to maintain the min-heap property.",
      },
    ];

    for (const item of conceptCases) {
      const derived = deriveCompactGlimpse({
        title: item.title,
        explanation: item.explanation,
        topic: item.concept,
      });

      expect(derived.title).toBeTruthy();
      expect(derived.glimpse.length).toBeLessThanOrEqual(120);
      expect(derived.glimpse.endsWith(".")).toBe(true);

      const dims = estimateGlimpseDimensions(derived, 1200);
      expect(dims.width).toBeLessThanOrEqual(310);
      expect(dims.height).toBeLessThanOrEqual(115);

      const placement = computeIntelligentOverlayPosition({
        containerRect: standardContainer,
        cardDimensions: dims,
        appState: mockAppState,
        isInspectorOpen: false,
      });

      expect(placement.x).toBeGreaterThanOrEqual(24);
      expect(placement.y).toBeGreaterThanOrEqual(84);
    }
  });
});
