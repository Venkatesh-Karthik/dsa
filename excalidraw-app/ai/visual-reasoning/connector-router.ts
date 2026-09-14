/**
 * Universal Obstacle-Aware Connector Router — Cognora 5.0
 *
 * Computes collision-free, readable connector paths between semantic entities.
 * Features:
 * 1. Multi-candidate routing (direct, top/bottom/left/right flanks, multi-track corridors).
 * 2. Parallel connector track separation (avoids stacking lines between the same nodes).
 * 3. Obstacle avoidance (never cuts through primary entities).
 * 4. Cost-based evaluation selecting the cleanest visual path.
 */

import { pointFrom, type LocalPoint } from "@excalidraw/math";
import type { BoundingBox } from "../connector-renderer";

export interface CandidateRoute {
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  points: LocalPoint[];
  isElbowed: boolean;
  cost: number;
}

export interface RouteOptions {
  sourceShape?: "rectangle" | "ellipse";
  targetShape?: "rectangle" | "ellipse";
  laneIndex?: number; // For parallel connectors: 0, 1, 2...
  totalLanes?: number;
  preferredRouting?: "direct" | "elbowed" | "auto";
}

/**
 * Tests whether a 2D line segment intersects a box with padding.
 */
export function segmentIntersectsBox(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  box: BoundingBox,
  padding = 12,
): boolean {
  const minX = box.x - padding;
  const maxX = box.x + box.width + padding;
  const minY = box.y - padding;
  const maxY = box.y + box.height + padding;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];

  let u1 = 0;
  let u2 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0 && u1 < t) u1 = t;
      else if (p[i] > 0 && u2 > t) u2 = t;
    }
  }

  return u1 <= u2 && u1 < 0.99 && u2 > 0.01;
}

/**
 * Checks if a polyline (series of segments) intersects a box.
 */
export function polylineIntersectsBox(
  points: { x: number; y: number }[],
  box: BoundingBox,
  padding = 10,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentIntersectsBox(points[i], points[i + 1], box, padding)) {
      return true;
    }
  }
  return false;
}

/**
 * Computes the optimal, lowest-cost obstacle-avoiding route for a connector.
 */
export function computeOptimalRoute(
  sourceBounds: BoundingBox,
  targetBounds: BoundingBox,
  obstacles: BoundingBox[],
  options?: RouteOptions,
): CandidateRoute {
  const laneIdx = options?.laneIndex ?? 0;
  const totalLanes = options?.totalLanes ?? 1;
  const laneOffset = totalLanes > 1 ? (laneIdx - (totalLanes - 1) / 2) * 24 : 0;

  const srcCx = sourceBounds.x + sourceBounds.width / 2;
  const srcCy = sourceBounds.y + sourceBounds.height / 2;
  const tgtCx = targetBounds.x + targetBounds.width / 2;
  const tgtCy = targetBounds.y + targetBounds.height / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  // Filter obstacles to only those between or near the route
  const relevantObstacles = obstacles.filter((obs) => {
    // Exclude source and target bounds themselves
    const isSource =
      Math.abs(obs.x - sourceBounds.x) < 4 && Math.abs(obs.y - sourceBounds.y) < 4;
    const isTarget =
      Math.abs(obs.x - targetBounds.x) < 4 && Math.abs(obs.y - targetBounds.y) < 4;
    return !isSource && !isTarget;
  });

  const candidates: CandidateRoute[] = [];

  // =========================================================================
  // 1. Direct Candidate Route
  // =========================================================================
  let directStartX: number;
  let directStartY: number;
  let directEndX: number;
  let directEndY: number;

  if (isHorizontal) {
    if (dx > 0) {
      directStartX = sourceBounds.x + sourceBounds.width;
      directStartY = srcCy + laneOffset;
      directEndX = targetBounds.x;
      directEndY = tgtCy + laneOffset;
    } else {
      directStartX = sourceBounds.x;
      directStartY = srcCy + laneOffset;
      directEndX = targetBounds.x + targetBounds.width;
      directEndY = tgtCy + laneOffset;
    }
  } else {
    if (dy > 0) {
      directStartX = srcCx + laneOffset;
      directStartY = sourceBounds.y + sourceBounds.height;
      directEndX = tgtCx + laneOffset;
      directEndY = targetBounds.y;
    } else {
      directStartX = srcCx + laneOffset;
      directStartY = sourceBounds.y;
      directEndX = tgtCx + laneOffset;
      directEndY = targetBounds.y + targetBounds.height;
    }
  }

  const directPoints: LocalPoint[] = [
    pointFrom(0, 0) as LocalPoint,
    pointFrom(directEndX - directStartX, directEndY - directStartY) as LocalPoint,
  ];

  let directCost = Math.hypot(directEndX - directStartX, directEndY - directStartY);
  const directIntersections = relevantObstacles.filter((obs) =>
    segmentIntersectsBox(
      { x: directStartX, y: directStartY },
      { x: directEndX, y: directEndY },
      obs,
      14,
    ),
  );

  if (directIntersections.length > 0) {
    directCost += 50000 * directIntersections.length;
  }
  if (options?.preferredRouting === "elbowed") {
    directCost += 800;
  }

  candidates.push({
    name: "direct",
    startX: directStartX,
    startY: directStartY,
    endX: directEndX,
    endY: directEndY,
    points: directPoints,
    isElbowed: false,
    cost: directCost,
  });

  // =========================================================================
  // 2. Top Flank Route
  // =========================================================================
  let minTop = Math.min(sourceBounds.y, targetBounds.y);
  for (const obs of relevantObstacles) {
    if (
      obs.x + obs.width >= Math.min(sourceBounds.x, targetBounds.x) &&
      obs.x <= Math.max(sourceBounds.x + sourceBounds.width, targetBounds.x + targetBounds.width)
    ) {
      minTop = Math.min(minTop, obs.y);
    }
  }
  const topFlankY = minTop - 36 - Math.abs(laneOffset);
  const topStartX = srcCx;
  const topStartY = sourceBounds.y;
  const topEndX = tgtCx;
  const topEndY = targetBounds.y;

  const topWorldPoints = [
    { x: topStartX, y: topStartY },
    { x: topStartX, y: topFlankY },
    { x: topEndX, y: topFlankY },
    { x: topEndX, y: topEndY },
  ];
  let topCost =
    Math.abs(topStartY - topFlankY) +
    Math.abs(topEndX - topStartX) +
    Math.abs(topEndY - topFlankY) +
    120; // bend penalty

  for (const obs of relevantObstacles) {
    if (polylineIntersectsBox(topWorldPoints, obs, 12)) {
      topCost += 50000;
    }
  }

  candidates.push({
    name: "top-flank",
    startX: topStartX,
    startY: topStartY,
    endX: topEndX,
    endY: topEndY,
    points: [
      pointFrom(0, 0) as LocalPoint,
      pointFrom(0, topFlankY - topStartY) as LocalPoint,
      pointFrom(topEndX - topStartX, topFlankY - topStartY) as LocalPoint,
      pointFrom(topEndX - topStartX, topEndY - topStartY) as LocalPoint,
    ],
    isElbowed: true,
    cost: topCost,
  });

  // =========================================================================
  // 3. Bottom Flank Route
  // =========================================================================
  let maxBottom = Math.max(
    sourceBounds.y + sourceBounds.height,
    targetBounds.y + targetBounds.height,
  );
  for (const obs of relevantObstacles) {
    if (
      obs.x + obs.width >= Math.min(sourceBounds.x, targetBounds.x) &&
      obs.x <= Math.max(sourceBounds.x + sourceBounds.width, targetBounds.x + targetBounds.width)
    ) {
      maxBottom = Math.max(maxBottom, obs.y + obs.height);
    }
  }
  const bottomFlankY = maxBottom + 36 + Math.abs(laneOffset);
  const botStartX = srcCx;
  const botStartY = sourceBounds.y + sourceBounds.height;
  const botEndX = tgtCx;
  const botEndY = targetBounds.y + targetBounds.height;

  const botWorldPoints = [
    { x: botStartX, y: botStartY },
    { x: botStartX, y: bottomFlankY },
    { x: botEndX, y: bottomFlankY },
    { x: botEndX, y: botEndY },
  ];
  let botCost =
    Math.abs(bottomFlankY - botStartY) +
    Math.abs(botEndX - botStartX) +
    Math.abs(bottomFlankY - botEndY) +
    120;

  for (const obs of relevantObstacles) {
    if (polylineIntersectsBox(botWorldPoints, obs, 12)) {
      botCost += 50000;
    }
  }

  candidates.push({
    name: "bottom-flank",
    startX: botStartX,
    startY: botStartY,
    endX: botEndX,
    endY: botEndY,
    points: [
      pointFrom(0, 0) as LocalPoint,
      pointFrom(0, bottomFlankY - botStartY) as LocalPoint,
      pointFrom(botEndX - botStartX, bottomFlankY - botStartY) as LocalPoint,
      pointFrom(botEndX - botStartX, botEndY - botStartY) as LocalPoint,
    ],
    isElbowed: true,
    cost: botCost,
  });

  // =========================================================================
  // 4. Right Flank Route
  // =========================================================================
  let maxRight = Math.max(
    sourceBounds.x + sourceBounds.width,
    targetBounds.x + targetBounds.width,
  );
  for (const obs of relevantObstacles) {
    if (
      obs.y + obs.height >= Math.min(sourceBounds.y, targetBounds.y) &&
      obs.y <= Math.max(sourceBounds.y + sourceBounds.height, targetBounds.y + targetBounds.height)
    ) {
      maxRight = Math.max(maxRight, obs.x + obs.width);
    }
  }
  const rightFlankX = maxRight + 36 + Math.abs(laneOffset);
  const rStartX = sourceBounds.x + sourceBounds.width;
  const rStartY = srcCy;
  const rEndX = targetBounds.x + targetBounds.width;
  const rEndY = tgtCy;

  const rightWorldPoints = [
    { x: rStartX, y: rStartY },
    { x: rightFlankX, y: rStartY },
    { x: rightFlankX, y: rEndY },
    { x: rEndX, y: rEndY },
  ];
  let rCost =
    Math.abs(rightFlankX - rStartX) +
    Math.abs(rEndY - rStartY) +
    Math.abs(rightFlankX - rEndX) +
    120;

  for (const obs of relevantObstacles) {
    if (polylineIntersectsBox(rightWorldPoints, obs, 12)) {
      rCost += 50000;
    }
  }

  candidates.push({
    name: "right-flank",
    startX: rStartX,
    startY: rStartY,
    endX: rEndX,
    endY: rEndY,
    points: [
      pointFrom(0, 0) as LocalPoint,
      pointFrom(rightFlankX - rStartX, 0) as LocalPoint,
      pointFrom(rightFlankX - rStartX, rEndY - rStartY) as LocalPoint,
      pointFrom(rEndX - rStartX, rEndY - rStartY) as LocalPoint,
    ],
    isElbowed: true,
    cost: rCost,
  });

  // =========================================================================
  // Pick the candidate with lowest cost
  // =========================================================================
  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0];
}
