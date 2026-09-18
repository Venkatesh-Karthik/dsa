import { describe, it, expect } from "vitest";

import {
  computeIntelligentOverlayPosition,
  type OverlayPlacementResult,
} from "../components/CognoraOverlayPlacement";

describe("Cognora Intelligent Overlay Placement Engine", () => {
  const mockAppState = {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
  };

  const containerRect = {
    width: 1400,
    height: 900,
  };

  const cardDimensions = {
    width: 320,
    height: 120,
  };

  const createMockElement = (
    id: string,
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => ({
    id,
    type,
    x,
    y,
    width,
    height,
    isDeleted: false,
  });

  it("places overlay adjacent to target elements while avoiding occluding them", () => {
    // A target node located at (400, 300)
    const targetNode = createMockElement(
      "node-1",
      "rectangle",
      400,
      300,
      100,
      60,
    );
    const sceneElements = [targetNode];

    const placement = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions,
      targetElementId: "node-1",
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    expect(placement).not.toBeNull();

    // Overlay must not overlap the target node (400, 300, 100, 60)
    const overlayBox = {
      x: placement.x,
      y: placement.y,
      width: cardDimensions.width,
      height: cardDimensions.height,
    };

    const overlapsTarget =
      overlayBox.x < targetNode.x + targetNode.width &&
      overlayBox.x + overlayBox.width > targetNode.x &&
      overlayBox.y < targetNode.y + targetNode.height &&
      overlayBox.y + overlayBox.height > targetNode.y;

    expect(overlapsTarget).toBe(false);
  });

  it("avoids UI obstacles such as the top Navbar and bottom Composer", () => {
    // A target node near the top (500, 90)
    const targetNode = createMockElement(
      "node-top",
      "rectangle",
      500,
      90,
      80,
      50,
    );
    const sceneElements = [targetNode];

    const placement = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions,
      targetElementId: "node-top",
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    expect(placement).not.toBeNull();

    // Navbar is at y <= 84. The overlay should be placed below or beside the target, not into the navbar
    expect(placement.y).toBeGreaterThanOrEqual(84);
  });

  it("avoids right Inspector panel when isInspectorOpen is true", () => {
    // Target element on the right side of the canvas (1100, 400)
    const targetNode = createMockElement(
      "node-right",
      "rectangle",
      1100,
      400,
      80,
      50,
    );
    const sceneElements = [targetNode];

    const placement = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions,
      targetElementId: "node-right",
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: true,
    });

    expect(placement).not.toBeNull();

    // Inspector width is 384px + margin (1400 - 410 = 990px)
    // Overlay should not be placed inside the inspector area
    expect(placement.x + cardDimensions.width).toBeLessThanOrEqual(1400 - 384);
  });

  it("applies manual offset correctly while clamping within container boundaries", () => {
    const targetNode = createMockElement(
      "node-1",
      "rectangle",
      500,
      400,
      80,
      50,
    );
    const sceneElements = [targetNode];

    const baseResult = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions,
      targetElementId: "node-1",
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    const offsetResult = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions,
      targetElementId: "node-1",
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
      manualOffset: { x: 40, y: -30 },
    });

    expect(baseResult).not.toBeNull();
    expect(offsetResult).not.toBeNull();

    expect(offsetResult.x).toBe(baseResult.x + 40);
    expect(offsetResult.y).toBe(baseResult.y - 30);
  });

  it("falls back to free-space quadrant placement when no target elements exist", () => {
    // Elements clustered in top-left quadrant
    const sceneElements = [
      createMockElement("cluster-1", "rectangle", 100, 100, 150, 100),
      createMockElement("cluster-2", "rectangle", 260, 100, 150, 100),
    ];

    const placement = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions,
      targetElementId: null,
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    expect(placement).not.toBeNull();
    // Result should be placed in an uncluttered free-space quadrant
    expect(placement.x).toBeGreaterThan(0);
    expect(placement.y).toBeGreaterThan(84);
  });
});
