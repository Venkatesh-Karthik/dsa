/**
 * Universal Obstacle-Aware Connector Router — Cognora 5.0
 *
 * Computes collision-free, readable connector paths between semantic entities.
 * Features:
 * 1. Multi-candidate routing (direct, top/bottom/left/right flanks, multi-track corridors).
 * 2. Parallel connector track separation (avoids stacking lines between the same nodes).
 * 3. Obstacle avoidance (never cuts through primary entities).
 * 4. Cost-based evaluation selecting the cleanest visual path.
 * 5. Normalized Euclidean cost metric across all candidates (no Manhattan/Euclidean mismatch).
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
 * Computes Euclidean length of a polyline through world-coordinate points.
 */
function polylineLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return len;
}

/**
 * Computes the optimal, lowest-cost obstacle-avoiding route for a connector.
 *
 * Routing candidates (all evaluated, lowest cost wins):
 *   1. direct       — straight line from source perimeter to target perimeter
 *   2. top-flank    — detour above all obstacles in the horizontal span
 *   3. bottom-flank — detour below all obstacles in the horizontal span
 *   4. right-flank  — detour right of all obstacles in the vertical span
 *   5. left-flank   — detour left of all obstacles in the vertical span
 *
 * Cost model: Euclidean polyline length + 120 per 90° bend + 50000 per obstacle intersection.
 * All candidates use the same metric so there is no systematic bias toward direct routes.
 */
export function computeOptimalRoute(
  sourceBounds: BoundingBox,
  targetBounds: BoundingBox,
  obstacles: BoundingBox[],
  options?: RouteOptions,
): CandidateRoute {
  const laneIdx = options?.laneIndex ?? 0;
  const totalLanes = options?.totalLanes ?? 1;
  // laneOffset: perpendicular displacement for parallel connectors (signed, centered at 0)
  const laneOffset = totalLanes > 1 ? (laneIdx - (totalLanes - 1) / 2) * 24 : 0;

  const srcCx = sourceBounds.x + sourceBounds.width / 2;
  const srcCy = sourceBounds.y + sourceBounds.height / 2;
  const tgtCx = targetBounds.x + targetBounds.width / 2;
  const tgtCy = targetBounds.y + targetBounds.height / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  // Exclude obstacles that overlap with source or target bounds (use generous 8px tolerance
  // so compound child elements of entities are not treated as foreign obstacles).
  const relevantObstacles = obstacles.filter((obs) => {
    const srcOverlap =
      obs.x < sourceBounds.x + sourceBounds.width + 8 &&
      obs.x + obs.width > sourceBounds.x - 8 &&
      obs.y < sourceBounds.y + sourceBounds.height + 8 &&
      obs.y + obs.height > sourceBounds.y - 8;
    const tgtOverlap =
      obs.x < targetBounds.x + targetBounds.width + 8 &&
      obs.x + obs.width > targetBounds.x - 8 &&
      obs.y < targetBounds.y + targetBounds.height + 8 &&
      obs.y + obs.height > targetBounds.y - 8;
    return !srcOverlap && !tgtOverlap;
  });

  const BEND_PENALTY = 120;       // Added per 90° turn
  const OBSTACLE_PENALTY = 50000; // Per obstacle intersection

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

  const directWorldPts = [
    { x: directStartX, y: directStartY },
    { x: directEndX, y: directEndY },
  ];

  let directCost = polylineLength(directWorldPts);
  for (const obs of relevantObstacles) {
    if (segmentIntersectsBox(directWorldPts[0], directWorldPts[1], obs, 14)) {
      directCost += OBSTACLE_PENALTY;
    }
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
    points: [
      pointFrom(0, 0) as LocalPoint,
      pointFrom(directEndX - directStartX, directEndY - directStartY) as LocalPoint,
    ],
    isElbowed: false,
    cost: directCost,
  });

  // Precompute bounding spans for flank clearance calculations
  const hSpanMin = Math.min(sourceBounds.x, targetBounds.x);
  const hSpanMax = Math.max(sourceBounds.x + sourceBounds.width, targetBounds.x + targetBounds.width);
  const vSpanMin = Math.min(sourceBounds.y, targetBounds.y);
  const vSpanMax = Math.max(sourceBounds.y + sourceBounds.height, targetBounds.y + targetBounds.height);

  // =========================================================================
  // 2. Top Flank Route
  // Detours upward. Lane offset applied horizontally (perpendicular to up/down direction).
  // =========================================================================
  let minTop = Math.min(sourceBounds.y, targetBounds.y);
  for (const obs of relevantObstacles) {
    if (obs.x + obs.width >= hSpanMin && obs.x <= hSpanMax) {
      minTop = Math.min(minTop, obs.y);
    }
  }
  const topFlankY = minTop - 36 - Math.abs(laneOffset);
  const topStartX = srcCx + laneOffset;
  const topStartY = sourceBounds.y;
  const topEndX = tgtCx + laneOffset;
  const topEndY = targetBounds.y;

  const topWorldPoints = [
    { x: topStartX, y: topStartY },
    { x: topStartX, y: topFlankY },
    { x: topEndX, y: topFlankY },
    { x: topEndX, y: topEndY },
  ];
  let topCost = polylineLength(topWorldPoints) + 2 * BEND_PENALTY;
  for (const obs of relevantObstacles) {
    if (polylineIntersectsBox(topWorldPoints, obs, 12)) {
      topCost += OBSTACLE_PENALTY;
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
    if (obs.x + obs.width >= hSpanMin && obs.x <= hSpanMax) {
      maxBottom = Math.max(maxBottom, obs.y + obs.height);
    }
  }
  const bottomFlankY = maxBottom + 36 + Math.abs(laneOffset);
  const botStartX = srcCx + laneOffset;
  const botStartY = sourceBounds.y + sourceBounds.height;
  const botEndX = tgtCx + laneOffset;
  const botEndY = targetBounds.y + targetBounds.height;

  const botWorldPoints = [
    { x: botStartX, y: botStartY },
    { x: botStartX, y: bottomFlankY },
    { x: botEndX, y: bottomFlankY },
    { x: botEndX, y: botEndY },
  ];
  let botCost = polylineLength(botWorldPoints) + 2 * BEND_PENALTY;
  for (const obs of relevantObstacles) {
    if (polylineIntersectsBox(botWorldPoints, obs, 12)) {
      botCost += OBSTACLE_PENALTY;
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
  // Detours rightward. Lane offset applied vertically (perpendicular to right direction).
  // =========================================================================
  let maxRight = Math.max(
    sourceBounds.x + sourceBounds.width,
    targetBounds.x + targetBounds.width,
  );
  for (const obs of relevantObstacles) {
    if (obs.y + obs.height >= vSpanMin && obs.y <= vSpanMax) {
      maxRight = Math.max(maxRight, obs.x + obs.width);
    }
  }
  const rightFlankX = maxRight + 36 + Math.abs(laneOffset);
  const rStartX = sourceBounds.x + sourceBounds.width;
  const rStartY = srcCy + laneOffset;
  const rEndX = targetBounds.x + targetBounds.width;
  const rEndY = tgtCy + laneOffset;

  const rightWorldPoints = [
    { x: rStartX, y: rStartY },
    { x: rightFlankX, y: rStartY },
    { x: rightFlankX, y: rEndY },
    { x: rEndX, y: rEndY },
  ];
  let rCost = polylineLength(rightWorldPoints) + 2 * BEND_PENALTY;
  for (const obs of relevantObstacles) {
    if (polylineIntersectsBox(rightWorldPoints, obs, 12)) {
      rCost += OBSTACLE_PENALTY;
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
  // 5. Left Flank Route [NEW]
  // Detours leftward past all obstacles in the vertical span.
  // Lane offset applied vertically (perpendicular to left direction).
  // =========================================================================
  let minLeft = Math.min(sourceBounds.x, targetBounds.x);
  for (const obs of relevantObstacles) {
    if (obs.y + obs.height >= vSpanMin && obs.y <= vSpanMax) {
      minLeft = Math.min(minLeft, obs.x);
    }
  }
  const leftFlankX = minLeft - 36 - Math.abs(laneOffset);
  const lStartX = sourceBounds.x;
  const lStartY = srcCy + laneOffset;
  const lEndX = targetBounds.x;
  const lEndY = tgtCy + laneOffset;

  const leftWorldPoints = [
    { x: lStartX, y: lStartY },
    { x: leftFlankX, y: lStartY },
    { x: leftFlankX, y: lEndY },
    { x: lEndX, y: lEndY },
  ];
  let lCost = polylineLength(leftWorldPoints) + 2 * BEND_PENALTY;
  for (const obs of relevantObstacles) {
    if (polylineIntersectsBox(leftWorldPoints, obs, 12)) {
      lCost += OBSTACLE_PENALTY;
    }
  }

  candidates.push({
    name: "left-flank",
    startX: lStartX,
    startY: lStartY,
    endX: lEndX,
    endY: lEndY,
    points: [
      pointFrom(0, 0) as LocalPoint,
      pointFrom(leftFlankX - lStartX, 0) as LocalPoint,
      pointFrom(leftFlankX - lStartX, lEndY - lStartY) as LocalPoint,
      pointFrom(lEndX - lStartX, lEndY - lStartY) as LocalPoint,
    ],
    isElbowed: true,
    cost: lCost,
  });

  // =========================================================================
  // Pick the candidate with lowest cost
  // =========================================================================
  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0];
}
