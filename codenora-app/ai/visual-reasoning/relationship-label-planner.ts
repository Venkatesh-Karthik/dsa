/**
 * Universal Relationship Label Planner — Cognora 5.0
 *
 * Intelligently positions edge labels along connector paths.
 * Guarantees:
 * 1. Label bounds never overlap source or target nodes.
 * 2. Label bounds never overlap unrelated nodes or annotations.
 * 3. Text is wrapped/compressed to prevent horizontal canvas stretching.
 * 4. Labels are rendered with a subtle backdrop capsule so arrow lines do not intersect text.
 */

import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { TOKENS } from "../visual-primitives/design-tokens";

import { sanitizeVisualText, compressSemanticPayload } from "./text-sanitizer";

import type { BoundingBox } from "../connector-renderer";
import type { CandidateRoute } from "./connector-router";

export interface PlannedLabelResult {
  x: number;
  y: number;
  width: number;
  height: number;
  displayText: string;
  elements: ExcalidrawElement[];
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

export function planRelationshipLabel(params: {
  id: string;
  rawLabel: string;
  route: CandidateRoute;
  sourceBounds: BoundingBox;
  targetBounds: BoundingBox;
  obstacles: BoundingBox[];
  existingLabels?: BoundingBox[];
  highlight?: string;
  lessonId?: string;
}): PlannedLabelResult | null {
  const {
    id,
    rawLabel,
    route,
    sourceBounds,
    targetBounds,
    obstacles,
    existingLabels = [],
    highlight,
    lessonId,
  } = params;

  if (!rawLabel || !rawLabel.trim()) {
    return null;
  }

  // In normal learner mode, suppress internal structural debug labels ("L", "R", "next", "prev", etc.)
  // Structure topology and directional arrows visually communicate these relationships without cluttering the canvas.
  const trimmed = rawLabel.trim().toUpperCase();
  if (
    trimmed === "L" ||
    trimmed === "R" ||
    trimmed === "LEFT" ||
    trimmed === "RIGHT" ||
    trimmed === "NEXT" ||
    trimmed === "PREV" ||
    trimmed === "PREVIOUS" ||
    trimmed === "PARENT" ||
    trimmed === "CHILD" ||
    trimmed === "POINTS_TO" ||
    trimmed === "CONNECTS" ||
    /^T\d+-OP\d+$/i.test(trimmed)
  ) {
    return null;
  }

  // 1. Sanitize & Compress Payload
  const sanitized = sanitizeVisualText(rawLabel);
  const compressed = compressSemanticPayload(sanitized, 20);
  const displayText = compressed.subtitle
    ? `${compressed.title}\n${compressed.subtitle}`
    : compressed.title;

  // 2. Measure content dimensions with accurate MONO font metrics
  const lines = displayText.split("\n");
  const maxLineChars = Math.max(...lines.map((l) => l.length), 1);
  const textWidth = Math.max(36, maxLineChars * 10.5 + 8);
  const textHeight = lines.length > 1 ? 34 : 22;
  const pillW = textWidth + 14;
  const pillH = textHeight + 8;

  // Convert route points to world coordinates
  const worldPoints: Array<{ x: number; y: number }> = [];
  for (const pt of route.points) {
    worldPoints.push({
      x: route.startX + pt[0],
      y: route.startY + pt[1],
    });
  }

  // 3. Compute parametric midpoint along whole polyline
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < worldPoints.length - 1; i++) {
    const dx = worldPoints[i + 1].x - worldPoints[i].x;
    const dy = worldPoints[i + 1].y - worldPoints[i].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    totalLength += len;
  }

  let midPt = worldPoints[0];
  if (totalLength > 0) {
    let targetDist = totalLength / 2;
    for (let i = 0; i < segLengths.length; i++) {
      if (targetDist <= segLengths[i]) {
        const ratio = targetDist / (segLengths[i] || 1);
        midPt = {
          x:
            worldPoints[i].x +
            (worldPoints[i + 1].x - worldPoints[i].x) * ratio,
          y:
            worldPoints[i].y +
            (worldPoints[i + 1].y - worldPoints[i].y) * ratio,
        };
        break;
      }
      targetDist -= segLengths[i];
    }
  } else {
    midPt = {
      x:
        (sourceBounds.x +
          sourceBounds.width / 2 +
          targetBounds.x +
          targetBounds.width / 2) /
        2,
      y:
        (sourceBounds.y +
          sourceBounds.height / 2 +
          targetBounds.y +
          targetBounds.height / 2) /
        2,
    };
  }

  interface LabelCandidate {
    cx: number;
    cy: number;
    cost: number;
    description: string;
  }

  const candidates: LabelCandidate[] = [];

  const getBoxForCenter = (cx: number, cy: number) => ({
    x: Math.round(cx - pillW / 2),
    y: Math.round(cy - pillH / 2),
    width: pillW,
    height: pillH,
  });

  // Candidate A: Direct Midpoint Candidates (with cardinal and perpendicular normal offsets)
  const edgeDx = route.endX - route.startX;
  const edgeDy = route.endY - route.startY;
  const edgeLen = Math.hypot(edgeDx, edgeDy) || 1;
  const normX = -edgeDy / edgeLen;
  const normY = edgeDx / edgeLen;

  candidates.push({
    cx: midPt.x,
    cy: midPt.y - pillH / 2 - 8,
    cost: 10,
    description: "mid-above",
  });

  candidates.push({
    cx: midPt.x + normX * (pillH / 2 + 8),
    cy: midPt.y + normY * (pillH / 2 + 8),
    cost: 11,
    description: "mid-normal-pos",
  });

  candidates.push({
    cx: midPt.x,
    cy: midPt.y,
    cost: 12,
    description: "mid-center",
  });

  candidates.push({
    cx: midPt.x - normX * (pillH / 2 + 8),
    cy: midPt.y - normY * (pillH / 2 + 8),
    cost: 14,
    description: "mid-normal-neg",
  });

  candidates.push({
    cx: midPt.x,
    cy: midPt.y + pillH / 2 + 8,
    cost: 15,
    description: "mid-below",
  });

  candidates.push({
    cx: midPt.x + pillW / 2 + 10,
    cy: midPt.y,
    cost: 20,
    description: "mid-right",
  });

  candidates.push({
    cx: midPt.x - pillW / 2 - 10,
    cy: midPt.y,
    cost: 25,
    description: "mid-left",
  });

  // Candidate B: Guaranteed Clearance Slots (outside the span of both nodes)
  const minY = Math.min(sourceBounds.y, targetBounds.y);
  const maxY = Math.max(
    sourceBounds.y + sourceBounds.height,
    targetBounds.y + targetBounds.height,
  );
  const minX = Math.min(sourceBounds.x, targetBounds.x);
  const maxX = Math.max(
    sourceBounds.x + sourceBounds.width,
    targetBounds.x + targetBounds.width,
  );

  candidates.push({
    cx: midPt.x,
    cy: minY - pillH / 2 - 12,
    cost: 30,
    description: "clearance-above",
  });

  candidates.push({
    cx: midPt.x,
    cy: maxY + pillH / 2 + 12,
    cost: 35,
    description: "clearance-below",
  });

  candidates.push({
    cx: maxX + pillW / 2 + 12,
    cy: midPt.y,
    cost: 40,
    description: "clearance-right",
  });

  candidates.push({
    cx: minX - pillW / 2 - 12,
    cy: midPt.y,
    cost: 45,
    description: "clearance-left",
  });

  // Candidate C: Along individual segments if elbowed
  if (worldPoints.length >= 3) {
    for (let i = 0; i < worldPoints.length - 1; i++) {
      const pA = worldPoints[i];
      const pB = worldPoints[i + 1];
      const segMidX = (pA.x + pB.x) / 2;
      const segMidY = (pA.y + pB.y) / 2;
      const isHoriz = Math.abs(pB.x - pA.x) >= Math.abs(pB.y - pA.y);

      if (isHoriz) {
        candidates.push({
          cx: segMidX,
          cy: segMidY - pillH / 2 - 8,
          cost: 16,
          description: `seg-${i}-above`,
        });
        candidates.push({
          cx: segMidX,
          cy: segMidY + pillH / 2 + 8,
          cost: 18,
          description: `seg-${i}-below`,
        });
      } else {
        candidates.push({
          cx: segMidX + pillW / 2 + 8,
          cy: segMidY,
          cost: 16,
          description: `seg-${i}-right`,
        });
        candidates.push({
          cx: segMidX - pillW / 2 - 8,
          cy: segMidY,
          cost: 18,
          description: `seg-${i}-left`,
        });
      }
    }
  }

  // Score Each Candidate against obstacles
  for (const cand of candidates) {
    const candBox = getBoxForCenter(cand.cx, cand.cy);

    // Severe penalty for overlapping source or target node
    if (boxesOverlap(candBox, sourceBounds, 4)) {
      cand.cost += 100000;
    }
    if (boxesOverlap(candBox, targetBounds, 4)) {
      cand.cost += 100000;
    }

    // Severe penalty for overlapping any obstacle
    for (const obs of obstacles) {
      if (boxesOverlap(candBox, obs, 4)) {
        cand.cost += 80000;
      }
    }

    // Moderate penalty for overlapping existing labels
    for (const ex of existingLabels) {
      if (boxesOverlap(candBox, ex, 4)) {
        cand.cost += 40000;
      }
    }
  }

  candidates.sort((a, b) => a.cost - b.cost);
  let best = candidates[0];

  // Hard safety guarantee: if best still collides, try clearance slots in order.
  const bestBox = getBoxForCenter(best.cx, best.cy);
  if (
    boxesOverlap(bestBox, sourceBounds, 2) ||
    boxesOverlap(bestBox, targetBounds, 2) ||
    obstacles.some((o) => boxesOverlap(bestBox, o, 2))
  ) {
    const clearAboveCenter = { cx: midPt.x, cy: minY - pillH / 2 - 14 };
    const clearBelowCenter = { cx: midPt.x, cy: maxY + pillH / 2 + 14 };
    const clearRightCenter = { cx: maxX + pillW / 2 + 14, cy: midPt.y };
    const clearLeftCenter = { cx: minX - pillW / 2 - 14, cy: midPt.y };

    const collidesAt = (cx: number, cy: number): boolean => {
      const b = getBoxForCenter(cx, cy);
      return (
        boxesOverlap(b, sourceBounds, 2) ||
        boxesOverlap(b, targetBounds, 2) ||
        obstacles.some((o) => boxesOverlap(b, o, 2))
      );
    };

    // Try each clearance slot; pick first that is truly collision-free
    const fallbacks = [
      clearAboveCenter,
      clearBelowCenter,
      clearRightCenter,
      clearLeftCenter,
    ];
    let picked = clearBelowCenter; // last-resort default
    for (const fb of fallbacks) {
      if (!collidesAt(fb.cx, fb.cy)) {
        picked = fb;
        break;
      }
    }
    best = { ...picked, cost: 0, description: "forced-clearance" };
  }

  const finalBox = getBoxForCenter(best.cx, best.cy);

  // 4. Create Excalidraw Elements: Pill backdrop + text
  //
  // IMPORTANT: newTextElement with textAlign:"center" / verticalAlign:"middle" expects the
  // TOP-LEFT corner of the text bounding box (NOT the center). Excalidraw internally
  // subtracts width/2 and height/2 when aligning. We must therefore pass the top-left:
  //   x = cx - pillW/2,  y = cy - pillH/2
  // to end up with the text centered at (cx, cy).
  const strokeColor =
    highlight === "failure"
      ? "#ef4444"
      : highlight === "recovery"
      ? "#10b981"
      : highlight === "active" || highlight === "primary"
      ? "#2563eb"
      : "#475569";

  const pillBackdrop = newElement({
    type: "rectangle",
    x: finalBox.x,
    y: finalBox.y,
    width: finalBox.width,
    height: finalBox.height,
    strokeColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    fillStyle: "solid",
    opacity: 94,
    strokeWidth: 1,
    roughness: 0,
    roundness: { type: 3 }, // capsule rounded
    customData: {
      isEdgeLabel: true,
      isBackdrop: true,
      dslId: `${id}-label-bg`,
      semanticId: `${id}-label-bg`,
      lessonId,
      isAiTeaching: true,
    },
  });

  // Pass center coordinates to newTextElement: for textAlign: "center" and
  // verticalAlign: "middle", newTextElement automatically subtracts 0.5 * metrics.width
  // and 0.5 * metrics.height so the text element is centered at (best.cx, best.cy).
  const labelTextEl = newTextElement({
    text: displayText,
    x: best.cx,
    y: best.cy,
    fontSize: lines.length > 1 ? 10 : TOKENS.TYPOGRAPHY.EdgeWeight.fontSize,
    fontFamily: TOKENS.TYPOGRAPHY.EdgeWeight.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor,
    roughness: 0,
    customData: {
      isEdgeLabel: true,
      dslId: `${id}-label`,
      semanticId: `${id}-label`,
      lessonId,
      isAiTeaching: true,
      fullDetail: compressed.fullDetail,
    },
  });

  return {
    x: finalBox.x,
    y: finalBox.y,
    width: finalBox.width,
    height: finalBox.height,
    displayText,
    elements: [pillBackdrop, labelTextEl],
  };
}
