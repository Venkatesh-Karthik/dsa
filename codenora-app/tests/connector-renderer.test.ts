import { describe, it, expect } from "vitest";

import {
  computePerimeterPoint,
  computeConnectionPoints,
  computeBindingFixedPoints,
  layerElementsWithConnectors,
  lineIntersectsBox,
  detectObstaclesBetween,
  renderSemanticConnector,
} from "../ai/connector-renderer";

describe("Connector Geometry - Perimeter Ray Intersection", () => {
  const rectBounds = { x: 100, y: 100, width: 80, height: 60 };

  it("intersects rectangular boundary accurately horizontally", () => {
    // Ray pointing right (angle 0)
    const ptRight = computePerimeterPoint(rectBounds, "rectangle", 0);
    expect(ptRight.x).toBeCloseTo(180, 1);
    expect(ptRight.y).toBeCloseTo(130, 1);

    // Ray pointing left (angle Math.PI)
    const ptLeft = computePerimeterPoint(rectBounds, "rectangle", Math.PI);
    expect(ptLeft.x).toBeCloseTo(100, 1);
    expect(ptLeft.y).toBeCloseTo(130, 1);
  });

  it("intersects rectangular boundary accurately vertically", () => {
    // Ray pointing down (angle Math.PI / 2)
    const ptDown = computePerimeterPoint(rectBounds, "rectangle", Math.PI / 2);
    expect(ptDown.x).toBeCloseTo(140, 1);
    expect(ptDown.y).toBeCloseTo(160, 1);

    // Ray pointing up (angle -Math.PI / 2)
    const ptUp = computePerimeterPoint(rectBounds, "rectangle", -Math.PI / 2);
    expect(ptUp.x).toBeCloseTo(140, 1);
    expect(ptUp.y).toBeCloseTo(100, 1);
  });

  it("intersects ellipse boundary accurately", () => {
    const circleBounds = { x: 200, y: 200, width: 60, height: 60 };
    // Center at (230, 230), radius = 30
    const ptRight = computePerimeterPoint(circleBounds, "ellipse", 0);
    expect(ptRight.x).toBeCloseTo(260, 1);
    expect(ptRight.y).toBeCloseTo(230, 1);

    const ptDown = computePerimeterPoint(circleBounds, "ellipse", Math.PI / 2);
    expect(ptDown.x).toBeCloseTo(230, 1);
    expect(ptDown.y).toBeCloseTo(260, 1);
  });

  it("computes connection points between adjacent shapes cleanly", () => {
    const fromRect = { x: 100, y: 100, width: 80, height: 60 };
    const toRect = { x: 300, y: 100, width: 80, height: 60 };

    const pts = computeConnectionPoints(fromRect, toRect, {
      fromShape: "rectangle",
      toShape: "rectangle",
    });

    // Start should be at right edge of fromRect: x = 180, y = 130
    expect(pts.startX).toBeCloseTo(180, 1);
    expect(pts.startY).toBeCloseTo(130, 1);

    // End should be at left edge of toRect: x = 300, y = 130
    expect(pts.endX).toBeCloseTo(300, 1);
    expect(pts.endY).toBeCloseTo(130, 1);
  });

  it("computes normalized fixed-point bindings clamped to [0, 1]", () => {
    const b1 = { x: 100, y: 100, width: 80, height: 60 };
    const b2 = { x: 300, y: 100, width: 80, height: 60 };

    const pts = computeConnectionPoints(b1, b2);
    const { startFixedPoint, endFixedPoint } = computeBindingFixedPoints(
      b1,
      b2,
      pts,
    );

    expect(startFixedPoint[0]).toBeGreaterThanOrEqual(0);
    expect(startFixedPoint[0]).toBeLessThanOrEqual(1);
    expect(startFixedPoint[1]).toBeGreaterThanOrEqual(0);
    expect(startFixedPoint[1]).toBeLessThanOrEqual(1);

    expect(endFixedPoint[0]).toBeGreaterThanOrEqual(0);
    expect(endFixedPoint[0]).toBeLessThanOrEqual(1);
    expect(endFixedPoint[1]).toBeGreaterThanOrEqual(0);
    expect(endFixedPoint[1]).toBeLessThanOrEqual(1);
  });
});

describe("Connector Layering", () => {
  it("sorts containers to bottom, connectors below nodes, labels on top", () => {
    const elements: any[] = [
      { id: "node1", type: "rectangle", customData: { role: "array-element" } },
      { id: "arrow1", type: "arrow", customData: { role: "relationship" } },
      {
        id: "container1",
        type: "rectangle",
        customData: { role: "container" },
      },
      { id: "label1", type: "text", customData: { role: "label" } },
    ];

    const layered = layerElementsWithConnectors(elements);
    expect(layered.map((el) => el.id)).toEqual([
      "container1", // index 0 (bottom)
      "arrow1", // index 1
      "node1", // index 2
      "label1", // index 3 (top)
    ]);
  });
});

describe("Obstacle Avoidance & Flank Routing", () => {
  it("detects when a connector ray cuts through an intermediate obstacle", () => {
    const p1 = { x: 140, y: 100 };
    const p2 = { x: 140, y: 350 };
    const obstacle = { x: 100, y: 180, width: 80, height: 60 };
    const safeObstacle = { x: 300, y: 180, width: 80, height: 60 };

    expect(lineIntersectsBox(p1, p2, obstacle)).toBe(true);
    expect(lineIntersectsBox(p1, p2, safeObstacle)).toBe(false);
  });

  it("finds intermediate obstacles between source and target", () => {
    const fromBounds = { x: 100, y: 100, width: 80, height: 60 };
    const toBounds = { x: 100, y: 360, width: 80, height: 60 };
    const intermediate = {
      primaryElement: { id: "call2", type: "rectangle" } as any,
      bounds: { x: 100, y: 220, width: 80, height: 60 },
    };
    const outside = {
      primaryElement: { id: "aside", type: "rectangle" } as any,
      bounds: { x: 350, y: 220, width: 80, height: 60 },
    };

    const hits = detectObstaclesBetween(fromBounds, toBounds, [
      intermediate,
      outside,
    ]);
    expect(hits.length).toBe(1);
    expect(hits[0].primaryElement.id).toBe("call2");
  });

  it("routes around intermediate obstacle via outer flank with elbowed path", () => {
    const fromRecord = {
      primaryElement: {
        id: "call3",
        type: "rectangle",
        x: 100,
        y: 340,
        width: 80,
        height: 60,
      } as any,
      bounds: { x: 100, y: 340, width: 80, height: 60 },
    };
    const toRecord = {
      primaryElement: {
        id: "call1",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 80,
        height: 60,
      } as any,
      bounds: { x: 100, y: 100, width: 80, height: 60 },
    };
    const intermediate = {
      primaryElement: {
        id: "call2",
        type: "rectangle",
        x: 100,
        y: 220,
        width: 80,
        height: 60,
      } as any,
      bounds: { x: 100, y: 220, width: 80, height: 60 },
    };

    const result = renderSemanticConnector(
      {
        id: "return-arrow",
        from: "call3",
        to: "call1",
        direction: "forward",
      },
      fromRecord,
      toRecord,
      [intermediate],
    );

    const arrow = result.primary as any;
    expect(arrow.type).toBe("arrow");
    expect(arrow.elbowed).toBe(true);
    expect(arrow.points.length).toBe(4); // [start, flank1, flank2, end]
  });
});
