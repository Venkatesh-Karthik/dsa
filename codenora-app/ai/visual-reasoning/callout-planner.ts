/**
 * Universal Callout & Annotation Placement — Cognora 5.0
 *
 * Positions explanatory annotations, decision callouts, and constraint badges
 * relative to anchor elements without occluding primary or secondary content.
 */

import type { BoundingBox } from "../connector-renderer";

export interface CalloutCandidate {
  placement:
    | "above"
    | "below"
    | "left"
    | "right"
    | "top-right"
    | "bottom-right";
  x: number;
  y: number;
  cost: number;
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  margin = 4,
): boolean {
  return !(
    a.x + a.width + margin <= b.x ||
    b.x + b.width + margin <= a.x ||
    a.y + a.height + margin <= b.y ||
    b.y + b.height + margin <= a.y
  );
}

export function computeOptimalCalloutPosition(params: {
  anchorBounds: BoundingBox;
  calloutWidth: number;
  calloutHeight: number;
  obstacles: BoundingBox[];
  preferredPlacement?: "above" | "below" | "left" | "right" | "auto";
  clearance?: number;
}): { x: number; y: number; placement: string } {
  const {
    anchorBounds,
    calloutWidth,
    calloutHeight,
    obstacles,
    preferredPlacement = "above",
    clearance = 16,
  } = params;

  const candidates: CalloutCandidate[] = [
    // 1. Above
    {
      placement: "above",
      x: anchorBounds.x + (anchorBounds.width - calloutWidth) / 2,
      y: anchorBounds.y - calloutHeight - clearance,
      cost: preferredPlacement === "above" ? 0 : 20,
    },
    // 2. Right
    {
      placement: "right",
      x: anchorBounds.x + anchorBounds.width + clearance,
      y: anchorBounds.y + (anchorBounds.height - calloutHeight) / 2,
      cost: preferredPlacement === "right" ? 0 : 30,
    },
    // 3. Below
    {
      placement: "below",
      x: anchorBounds.x + (anchorBounds.width - calloutWidth) / 2,
      y: anchorBounds.y + anchorBounds.height + clearance,
      cost: preferredPlacement === "below" ? 0 : 40,
    },
    // 4. Left
    {
      placement: "left",
      x: anchorBounds.x - calloutWidth - clearance,
      y: anchorBounds.y + (anchorBounds.height - calloutHeight) / 2,
      cost: preferredPlacement === "left" ? 0 : 50,
    },
    // 5. Top-Right Diagonal
    {
      placement: "top-right",
      x: anchorBounds.x + anchorBounds.width + clearance,
      y: anchorBounds.y - calloutHeight,
      cost: 60,
    },
    // 6. Bottom-Right Diagonal
    {
      placement: "bottom-right",
      x: anchorBounds.x + anchorBounds.width + clearance,
      y: anchorBounds.y + anchorBounds.height,
      cost: 70,
    },
  ];

  for (const cand of candidates) {
    const candBox = {
      x: cand.x,
      y: cand.y,
      width: calloutWidth,
      height: calloutHeight,
    };

    // Candidate must not go into negative coordinates
    if (cand.x < 20 || cand.y < 20) {
      cand.cost += 50000;
    }

    // Candidate must never occlude anchor element
    if (boxesOverlap(candBox, anchorBounds, 4)) {
      cand.cost += 100000;
    }

    // Candidate must never occlude obstacles
    for (const obs of obstacles) {
      if (boxesOverlap(candBox, obs, 4)) {
        cand.cost += 80000;
      }
    }
  }

  candidates.sort((a, b) => a.cost - b.cost);
  const best = candidates[0];

  return {
    x: Math.round(Math.max(20, best.x)),
    y: Math.round(Math.max(20, best.y)),
    placement: best.placement,
  };
}
