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

  it("guarantees zero collision with a horizontal linked list chain (10 -> 20 -> 30 -> 40 -> 50)", () => {
    // A realistic linked list centered horizontally around y=240
    const node10 = createMockElement("n-10", "rectangle", 300, 240, 80, 50);
    const arrow1 = createMockElement("arr-1", "arrow", 380, 265, 40, 1);
    const node20 = createMockElement("n-20", "rectangle", 420, 240, 80, 50);
    const arrow2 = createMockElement("arr-2", "arrow", 500, 265, 40, 1);
    const node30 = createMockElement("n-30", "rectangle", 540, 240, 80, 50);
    const arrow3 = createMockElement("arr-3", "arrow", 620, 265, 40, 1);
    const node40 = createMockElement("n-40", "rectangle", 660, 240, 80, 50);
    const arrow4 = createMockElement("arr-4", "arrow", 740, 265, 40, 1);
    const node50 = createMockElement("n-50", "rectangle", 780, 240, 80, 50);

    const sceneElements = [
      node10,
      arrow1,
      node20,
      arrow2,
      node30,
      arrow3,
      node40,
      arrow4,
      node50,
    ];

    const placement = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions: { width: 260, height: 95 },
      targetElementId: "n-20",
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    expect(placement).not.toBeNull();

    const overlayRect = {
      left: placement.x,
      top: placement.y,
      right: placement.x + 260,
      bottom: placement.y + 95,
    };

    // Check collision against EVERY node in the list
    for (const el of [node10, node20, node30, node40, node50]) {
      const elRight = el.x + el.width;
      const elBottom = el.y + el.height;
      const overlaps =
        overlayRect.left < elRight &&
        overlayRect.right > el.x &&
        overlayRect.top < elBottom &&
        overlayRect.bottom > el.y;

      expect(overlaps).toBe(false);
    }
  });

  it("avoids bottom floating playback controller bar", () => {
    // Target element situated near the bottom center (600, 680)
    const targetNode = createMockElement("n-bottom", "rectangle", 600, 680, 80, 50);
    const sceneElements = [targetNode];

    const placement = computeIntelligentOverlayPosition({
      containerRect,
      cardDimensions: { width: 260, height: 95 },
      targetElementId: "n-bottom",
      sceneElements,
      appState: mockAppState,
      isInspectorOpen: false,
    });

    expect(placement).not.toBeNull();

    // Bottom playback bar is located at containerHeight - 110 (900 - 110 = 790) to 865
    // The overlay should be placed safely above the target or to the side, not over the playback bar
    const overlayBottom = placement.y + 95;
    const playbackBarTop = 900 - 110;
    const playbackBarLeft = 1400 / 2 - 260;
    const playbackBarRight = 1400 / 2 + 260;

    const overlapsPlaybackBar =
      placement.x < playbackBarRight &&
      placement.x + 260 > playbackBarLeft &&
      placement.y < 900 - 35 &&
      overlayBottom > playbackBarTop;

    expect(overlapsPlaybackBar).toBe(false);
  });
});
