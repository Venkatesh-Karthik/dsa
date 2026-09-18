/**
 * Cognora Leader Line Geometry Engine
 *
 * Mathematically calculates the dynamic stem / leader line connecting a floating
 * teaching callout card to its target visual entity on the canvas.
 *
 * Invariants:
 * - Operates purely in Screen Coordinate Space (pixels).
 * - Connects the nearest appropriate edge of the callout to the target.
 * - Produces smooth SVG cubic Bezier paths.
 * - Avoids drawing through the callout or obscuring the target.
 * - Suppresses lines when callout and target are overlapping or overly tight.
 */

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface LeaderLineGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
  side: "top" | "bottom" | "left" | "right";
  length: number;
  arrowAngle: number;
}

function clamp(val: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes dynamic leader line geometry between callout bounds and target visual bounds.
 */
export function computeLeaderLineGeometry(
  calloutRect: ScreenRect,
  targetRect: ScreenRect,
  placement?: "above" | "below" | "left" | "right" | "floating",
): LeaderLineGeometry | null {
  // Suppress leader line if callout and target are overlapping
  const isOverlapping = !(
    calloutRect.right <= targetRect.left ||
    calloutRect.left >= targetRect.right ||
    calloutRect.bottom <= targetRect.top ||
    calloutRect.top >= targetRect.bottom
  );
  if (isOverlapping) {
    return null;
  }

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const calloutCenterX = calloutRect.left + calloutRect.width / 2;
  const calloutCenterY = calloutRect.top + calloutRect.height / 2;

  // Determine effective side if placement is "floating" or ambiguous
  let effectivePlacement: "above" | "below" | "left" | "right" = "above";

  if (placement && placement !== "floating") {
    effectivePlacement = placement;
  } else {
    const dx = calloutCenterX - targetCenterX;
    const dy = calloutCenterY - targetCenterY;

    if (Math.abs(dy) >= Math.abs(dx)) {
      effectivePlacement = dy < 0 ? "above" : "below";
    } else {
      effectivePlacement = dx < 0 ? "left" : "right";
    }
  }

  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  let side: LeaderLineGeometry["side"] = "bottom";

  const CALLOUT_MARGIN = 14;
  const TARGET_GAP = 5; // distance from target boundary so arrow tip is clearly visible

  switch (effectivePlacement) {
    case "above": {
      // Callout is above target -> stem exits bottom of callout
      side = "bottom";
      startY = calloutRect.bottom;
      startX = clamp(
        targetCenterX,
        calloutRect.left + CALLOUT_MARGIN,
        calloutRect.right - CALLOUT_MARGIN,
      );

      endX = clamp(targetCenterX, targetRect.left + 6, targetRect.right - 6);
      endY = targetRect.top - TARGET_GAP;
      break;
    }
    case "below": {
      // Callout is below target -> stem exits top of callout
      side = "top";
      startY = calloutRect.top;
      startX = clamp(
        targetCenterX,
        calloutRect.left + CALLOUT_MARGIN,
        calloutRect.right - CALLOUT_MARGIN,
      );

      endX = clamp(targetCenterX, targetRect.left + 6, targetRect.right - 6);
      endY = targetRect.bottom + TARGET_GAP;
      break;
    }
    case "left": {
      // Callout is to left of target -> stem exits right of callout
      side = "right";
      startX = calloutRect.right;
      startY = clamp(
        targetCenterY,
        calloutRect.top + CALLOUT_MARGIN,
        calloutRect.bottom - CALLOUT_MARGIN,
      );

      endX = targetRect.left - TARGET_GAP;
      endY = clamp(targetCenterY, targetRect.top + 6, targetRect.bottom - 6);
      break;
    }
    case "right": {
      // Callout is to right of target -> stem exits left of callout
      side = "left";
      startX = calloutRect.left;
      startY = clamp(
        targetCenterY,
        calloutRect.top + CALLOUT_MARGIN,
        calloutRect.bottom - CALLOUT_MARGIN,
      );

      endX = targetRect.right + TARGET_GAP;
      endY = clamp(targetCenterY, targetRect.top + 6, targetRect.bottom - 6);
      break;
    }
  }

  // Calculate Euclidean length
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Suppress if too close or overlapping
  if (length < 8) {
    return null;
  }

  // Angle in degrees towards target
  const arrowAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Generate smooth cubic Bezier path
  let path = "";
  if (effectivePlacement === "above" || effectivePlacement === "below") {
    const deltaY = endY - startY;
    const cp1X = startX;
    const cp1Y = startY + deltaY * 0.55;
    const cp2X = endX;
    const cp2Y = startY + deltaY * 0.45;
    path = `M ${Math.round(startX)} ${Math.round(startY)} C ${Math.round(
      cp1X,
    )} ${Math.round(cp1Y)}, ${Math.round(cp2X)} ${Math.round(
      cp2Y,
    )}, ${Math.round(endX)} ${Math.round(endY)}`;
  } else {
    const deltaX = endX - startX;
    const cp1X = startX + deltaX * 0.55;
    const cp1Y = startY;
    const cp2X = startX + deltaX * 0.45;
    const cp2Y = endY;
    path = `M ${Math.round(startX)} ${Math.round(startY)} C ${Math.round(
      cp1X,
    )} ${Math.round(cp1Y)}, ${Math.round(cp2X)} ${Math.round(
      cp2Y,
    )}, ${Math.round(endX)} ${Math.round(endY)}`;
  }

  return {
    startX,
    startY,
    endX,
    endY,
    path,
    side,
    length,
    arrowAngle,
  };
}
