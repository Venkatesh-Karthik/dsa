import { describe, it, expect } from "vitest";

import {
  measureTextBounds,
  wrapText,
  computeAdaptiveAnnotationBounds,
  checkAABBCollision,
  resolveLayoutCollisions,
  type CollisionBox,
} from "../ai/layout-engine";

describe("Layout Engine - Text Measurement & Word Wrapping", () => {
  it("wraps long text across multiple lines without splitting words", () => {
    const text =
      "The subtree is left-heavy because the new node was inserted into the left subtree.";
    const lines = wrapText(text, 30);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(35);
    }
  });

  it("leaves short text on a single line", () => {
    const text = "Right rotation";
    const lines = wrapText(text, 36);
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("Right rotation");
  });

  it("measures bounds adaptively based on content", () => {
    const shortBounds = computeAdaptiveAnnotationBounds("Short");
    const longBounds = computeAdaptiveAnnotationBounds(
      "The subtree is left-heavy because the new node was inserted into the left subtree.",
      "LL Imbalance",
    );

    expect(longBounds.height).toBeGreaterThan(shortBounds.height);
    expect(longBounds.width).toBeGreaterThanOrEqual(shortBounds.width);
    // Guarantee generous padding so text never escapes
    expect(longBounds.width).toBeGreaterThanOrEqual(120);
    expect(longBounds.height).toBeGreaterThanOrEqual(48);
  });
});

describe("Layout Engine - Collision Detection & Resolution", () => {
  it("detects collisions between overlapping AABB bounding boxes", () => {
    const boxA = { x: 100, y: 100, width: 70, height: 70 };
    const boxB = { x: 120, y: 120, width: 70, height: 70 };
    const boxC = { x: 300, y: 300, width: 70, height: 70 };

    expect(checkAABBCollision(boxA, boxB, 10)).toBe(true);
    expect(checkAABBCollision(boxA, boxC, 10)).toBe(false);
  });

  it("resolves collisions by shifting lower-priority items with clearance", () => {
    const boxes: CollisionBox[] = [
      {
        id: "node-1",
        x: 100,
        y: 100,
        width: 70,
        height: 70,
        fixed: true,
        priority: 10,
      },
      {
        id: "callout-1",
        x: 110,
        y: 110,
        width: 140,
        height: 50,
        fixed: false,
        priority: 1,
      },
    ];

    const resolved = resolveLayoutCollisions(boxes, 20);
    const nodePos = resolved.get("node-1")!;
    const calloutPos = resolved.get("callout-1")!;

    expect(nodePos.x).toBe(100);
    expect(nodePos.y).toBe(100);

    // Callout must have been displaced away from node-1
    const finalBoxA = { x: nodePos.x, y: nodePos.y, width: 70, height: 70 };
    const finalBoxB = {
      x: calloutPos.x,
      y: calloutPos.y,
      width: 140,
      height: 50,
    };

    expect(checkAABBCollision(finalBoxA, finalBoxB, 10)).toBe(false);
  });
});
