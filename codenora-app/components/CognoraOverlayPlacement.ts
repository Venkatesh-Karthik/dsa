/**
 * Cognora Contextual Overlay Placement Engine
 *
 * Mathematically determines the optimal screen position for teaching/explanation cards
 * so they NEVER obscure primary visual content (nodes, connectors, labels, pointers,
 * highlighted items) or application UI controls (Navbar, Inspector, Composer, Toolbar).
 *
 * Strict Architecture:
 * - Operates purely in Application UI / Screen coordinate space.
 * - Does NOT mutate canvas elements or semantic scene state.
 * - Deterministic, pure, and testable.
 */

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ProtectedSceneElement {
  id: string;
  rect: ScreenRect;
  type: "target" | "node" | "connector" | "label" | "other";
  isHighlighted?: boolean;
}

export interface UIObstacles {
  navbar: ScreenRect;
  inspector?: ScreenRect | null;
  composer?: ScreenRect | null;
  toolbar?: ScreenRect | null;
  zoomControls?: ScreenRect | null;
}

export interface OverlayPlacementInput {
  containerRect: { width: number; height: number };
  cardDimensions: { width: number; height: number };
  targetElementId?: string | null;
  sceneElements?: readonly {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    isDeleted?: boolean;
    customData?: Record<string, any>;
  }[];
  appState: {
    scrollX: number;
    scrollY: number;
    zoom: { value: number };
    offsetLeft?: number;
    offsetTop?: number;
  };
  isInspectorOpen?: boolean;
  manualOffset?: { x: number; y: number } | null;
  previousPosition?: { x: number; y: number } | null;
}

export interface OverlayPlacementResult {
  x: number;
  y: number;
  placement: "above" | "below" | "left" | "right" | "floating";
  score: number;
  targetRect?: ScreenRect | null;
}

/**
 * Calculates overlap area between two screen rectangles.
 */
export function getRectOverlapArea(a: ScreenRect, b: ScreenRect): number {
  const xOverlap = Math.max(
    0,
    Math.min(a.right, b.right) - Math.max(a.left, b.left),
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  );
  return xOverlap * yOverlap;
}

/**
 * Creates a ScreenRect from x, y, width, height.
 */
export function makeScreenRect(
  x: number,
  y: number,
  width: number,
  height: number,
): ScreenRect {
  return {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
  };
}

/**
 * Computes default UI obstacles based on viewport dimensions.
 */
export function getUIObstacles(
  containerWidth: number,
  containerHeight: number,
  isInspectorOpen: boolean,
): UIObstacles {
  return {
    // Top Navbar
    navbar: makeScreenRect(0, 0, containerWidth, 84),
    // Right Inspector Panel (384px + margins)
    inspector: isInspectorOpen
      ? makeScreenRect(containerWidth - 410, 76, 410, containerHeight - 90)
      : null,
    // Bottom Composer & Playback Region
    composer: makeScreenRect(
      isInspectorOpen
        ? Math.max(80, (containerWidth - 410) / 2 - 340)
        : Math.max(80, containerWidth / 2 - 340),
      containerHeight - 160,
      680,
      160,
    ),
    // Floating Left Toolbar
    toolbar: makeScreenRect(16, 90, 68, 380),
    // Bottom-left Zoom Controls
    zoomControls: makeScreenRect(16, containerHeight - 80, 180, 70),
  };
}

/**
 * Extracts and maps protected scene elements from Excalidraw scene into screen coordinates.
 */
export function extractProtectedSceneElements(
  sceneElements: OverlayPlacementInput["sceneElements"],
  appState: OverlayPlacementInput["appState"],
  targetElementId?: string | null,
): ProtectedSceneElement[] {
  if (!sceneElements || sceneElements.length === 0) {
    return [];
  }

  const zoom = appState.zoom.value;
  const scrollX = appState.scrollX;
  const scrollY = appState.scrollY;
  const offsetLeft = appState.offsetLeft ?? 0;
  const offsetTop = appState.offsetTop ?? 0;

  const protectedElements: ProtectedSceneElement[] = [];

  for (const el of sceneElements) {
    if (el.isDeleted) {
      continue;
    }

    // Skip existing explanation cards or background dividers so they don't block repositioning
    const role = el.customData?.role;
    if (role === "explanation-card" || role === "step-divider") {
      continue;
    }

    const screenX = (el.x + scrollX) * zoom + offsetLeft;
    const screenY = (el.y + scrollY) * zoom + offsetTop;
    const screenW = el.width * zoom;
    const screenH = el.height * zoom;

    const isTarget = Boolean(
      targetElementId &&
        (el.id === targetElementId ||
          el.customData?.dslId === targetElementId ||
          el.customData?.nodeId === targetElementId ||
          el.customData?.dslId?.endsWith(`-${targetElementId}`)),
    );

    let type: ProtectedSceneElement["type"] = "other";
    if (isTarget) {
      type = "target";
    } else if (
      el.type === "rectangle" ||
      el.type === "ellipse" ||
      el.type === "diamond"
    ) {
      type = "node";
    } else if (el.type === "arrow" || el.type === "line") {
      type = "connector";
    } else if (el.type === "text") {
      type = "label";
    }

    protectedElements.push({
      id: el.id,
      rect: makeScreenRect(screenX, screenY, screenW, screenH),
      type,
      isHighlighted: isTarget,
    });
  }

  return protectedElements;
}

/**
 * Computes an intelligent, collision-free position for the contextual overlay.
 */
export function computeIntelligentOverlayPosition(
  input: OverlayPlacementInput,
): OverlayPlacementResult {
  const {
    containerRect,
    cardDimensions,
    targetElementId,
    sceneElements,
    appState,
    isInspectorOpen = false,
    manualOffset,
  } = input;

  const containerW = containerRect.width;
  const containerH = containerRect.height;
  const cardW = Math.min(cardDimensions.width, containerW - 48);
  const cardH = cardDimensions.height;

  // 1. Determine usable screen margins
  const minSafeX = 24;
  const maxSafeX = isInspectorOpen ? containerW - 420 : containerW - 24;
  const minSafeY = 88; // Below navbar
  const maxSafeY = containerH - 24;

  // 2. Identify UI obstacles
  const uiObstacles = getUIObstacles(containerW, containerH, isInspectorOpen);

  // 3. Extract and map primary visual elements
  const protectedElements = extractProtectedSceneElements(
    sceneElements,
    appState,
    targetElementId,
  );

  // Find target element rect if available
  const targetElement = protectedElements.find((e) => e.type === "target");
  const targetRect = targetElement ? targetElement.rect : null;

  // 4. Generate candidate placement positions
  interface Candidate {
    x: number;
    y: number;
    placement: OverlayPlacementResult["placement"];
    preferenceBonus: number;
  }

  const candidates: Candidate[] = [];

  if (targetRect) {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const gaps = [18, 36, 64, 100];

    // Above candidates
    for (const gap of gaps) {
      candidates.push({
        x: targetCenterX - cardW / 2,
        y: targetRect.top - cardH - gap,
        placement: "above",
        preferenceBonus: gap === 18 ? -100 : -60,
      });
    }

    // Below candidates
    for (const gap of gaps) {
      candidates.push({
        x: targetCenterX - cardW / 2,
        y: targetRect.bottom + gap,
        placement: "below",
        preferenceBonus: gap === 18 ? -90 : -50,
      });
    }

    // Right candidates
    for (const gap of [24, 48, 80]) {
      candidates.push({
        x: targetRect.right + gap,
        y: targetCenterY - cardH / 2,
        placement: "right",
        preferenceBonus: -70,
      });
    }

    // Left candidates
    for (const gap of [24, 48, 80]) {
      candidates.push({
        x: targetRect.left - cardW - gap,
        y: targetCenterY - cardH / 2,
        placement: "left",
        preferenceBonus: -70,
      });
    }

    // Corner / diagonal candidates
    candidates.push(
      {
        x: targetRect.right + 24,
        y: targetRect.top - cardH - 16,
        placement: "above",
        preferenceBonus: -40,
      },
      {
        x: targetRect.left - cardW - 24,
        y: targetRect.top - cardH - 16,
        placement: "above",
        preferenceBonus: -40,
      },
      {
        x: targetRect.right + 24,
        y: targetRect.bottom + 16,
        placement: "below",
        preferenceBonus: -40,
      },
      {
        x: targetRect.left - cardW - 24,
        y: targetRect.bottom + 16,
        placement: "below",
        preferenceBonus: -40,
      },
    );
  }

  // Free space canvas quadrant candidates
  const availableCanvasW = maxSafeX - minSafeX;
  candidates.push(
    // Top-Right Free Space (left of inspector)
    {
      x: maxSafeX - cardW - 24,
      y: minSafeY + 16,
      placement: "floating",
      preferenceBonus: 0,
    },
    // Top-Left Free Space (right of toolbar)
    {
      x: minSafeX + 80,
      y: minSafeY + 16,
      placement: "floating",
      preferenceBonus: 0,
    },
    // Middle-Right Free Space
    {
      x: maxSafeX - cardW - 24,
      y: Math.max(minSafeY + 20, containerH / 2 - cardH / 2),
      placement: "floating",
      preferenceBonus: 0,
    },
    // Middle-Left Free Space
    {
      x: minSafeX + 80,
      y: Math.max(minSafeY + 20, containerH / 2 - cardH / 2),
      placement: "floating",
      preferenceBonus: 0,
    },
    // Top-Center Safe Free Space
    {
      x: minSafeX + (availableCanvasW - cardW) / 2,
      y: minSafeY + 14,
      placement: "floating",
      preferenceBonus: -20,
    },
    // Bottom-Left (above zoom controls)
    {
      x: minSafeX + 80,
      y: containerH - cardH - 180,
      placement: "floating",
      preferenceBonus: 0,
    },
  );

  // Previous position candidate (favors stability across transitions if collision-free)
  if (input.previousPosition) {
    candidates.push({
      x: input.previousPosition.x,
      y: input.previousPosition.y,
      placement: "floating",
      preferenceBonus: -60,
    });
  }

  // 5. Score candidates
  let bestCandidate: Candidate = candidates[0] || {
    x: minSafeX + 80,
    y: minSafeY + 20,
    placement: "floating",
    preferenceBonus: 0,
  };
  let lowestScore = Infinity;

  const targetCenterX = targetRect
    ? targetRect.left + targetRect.width / 2
    : minSafeX + availableCanvasW / 2;
  const targetCenterY = targetRect
    ? targetRect.top + targetRect.height / 2
    : minSafeY + (maxSafeY - minSafeY) / 2;

  for (const cand of candidates) {
    let score = cand.preferenceBonus;

    // A. Boundary constraints
    const candLeft = cand.x;
    const candTop = cand.y;

    // Penalize out of usable bounds
    if (candLeft < minSafeX) {
      score += (minSafeX - candLeft) * 1000 + 50000;
    }
    if (candLeft + cardW > maxSafeX) {
      score += (candLeft + cardW - maxSafeX) * 1000 + 50000;
    }
    if (candTop < minSafeY) {
      score += (minSafeY - candTop) * 1000 + 50000;
    }
    if (candTop + cardH > maxSafeY) {
      score += (candTop + cardH - maxSafeY) * 1000 + 50000;
    }

    // Clamp candidate rect for obstacle collision check
    const clampedCandRect = makeScreenRect(
      Math.max(minSafeX, Math.min(candLeft, maxSafeX - cardW)),
      Math.max(minSafeY, Math.min(candTop, maxSafeY - cardH)),
      cardW,
      cardH,
    );

    // B. Check collision with UI Obstacles
    // Navbar
    const navOverlap = getRectOverlapArea(clampedCandRect, uiObstacles.navbar);
    if (navOverlap > 0) {
      score += navOverlap * 500 + 100000;
    }

    // Inspector
    if (uiObstacles.inspector) {
      const inspOverlap = getRectOverlapArea(
        clampedCandRect,
        uiObstacles.inspector,
      );
      if (inspOverlap > 0) {
        score += inspOverlap * 500 + 100000;
      }
    }

    // Composer
    if (uiObstacles.composer) {
      const compOverlap = getRectOverlapArea(
        clampedCandRect,
        uiObstacles.composer,
      );
      if (compOverlap > 0) {
        score += compOverlap * 500 + 100000;
      }
    }

    // Toolbar
    if (uiObstacles.toolbar) {
      const toolOverlap = getRectOverlapArea(
        clampedCandRect,
        uiObstacles.toolbar,
      );
      if (toolOverlap > 0) {
        score += toolOverlap * 200 + 40000;
      }
    }

    // Zoom Controls
    if (uiObstacles.zoomControls) {
      const zoomOverlap = getRectOverlapArea(
        clampedCandRect,
        uiObstacles.zoomControls,
      );
      if (zoomOverlap > 0) {
        score += zoomOverlap * 200 + 40000;
      }
    }

    // C. Check collision with Protected Primary Visual Elements
    for (const prot of protectedElements) {
      // Add a generous safety buffer around nodes and connectors
      const buffer = prot.type === "node" || prot.type === "target" ? 24 : 12;
      const bufferedRect: ScreenRect = {
        left: prot.rect.left - buffer,
        top: prot.rect.top - buffer,
        right: prot.rect.right + buffer,
        bottom: prot.rect.bottom + buffer,
        width: prot.rect.width + buffer * 2,
        height: prot.rect.height + buffer * 2,
      };

      const overlap = getRectOverlapArea(clampedCandRect, bufferedRect);
      if (overlap > 0) {
        if (prot.type === "target") {
          // Zero tolerance: NEVER obscure the target element!
          score += overlap * 1000 + 500000;
        } else if (prot.type === "node") {
          // Do not obscure nodes / tree nodes / array cells
          score += overlap * 800 + 300000;
        } else if (prot.type === "connector") {
          // Do not obscure connectors / arrows
          score += overlap * 400 + 100000;
        } else if (prot.type === "label") {
          // Do not obscure labels
          score += overlap * 300 + 80000;
        } else {
          score += overlap * 100 + 20000;
        }
      }
    }

    // D. Distance reward (if no critical overlap)
    // Small distance penalty so closest collision-free position wins
    const candCenterX = clampedCandRect.left + clampedCandRect.width / 2;
    const candCenterY = clampedCandRect.top + clampedCandRect.height / 2;
    const distToTarget = Math.hypot(
      candCenterX - targetCenterX,
      candCenterY - targetCenterY,
    );
    score += distToTarget * 0.15;

    // E. Temporal continuity: give subtle bonus if close to previous position to avoid unnecessary jumping
    if (input.previousPosition) {
      const distToPrev = Math.hypot(
        clampedCandRect.left - input.previousPosition.x,
        clampedCandRect.top - input.previousPosition.y,
      );
      if (distToPrev < 90) {
        score -= 35; // reward stable placement
      }
    }

    if (score < lowestScore) {
      lowestScore = score;
      bestCandidate = {
        x: clampedCandRect.left,
        y: clampedCandRect.top,
        placement: cand.placement,
        preferenceBonus: cand.preferenceBonus,
      };
    }
  }

  // 6. Apply manual directional offset if user overrode position
  let finalX = bestCandidate.x;
  let finalY = bestCandidate.y;

  if (manualOffset) {
    finalX += manualOffset.x;
    finalY += manualOffset.y;
  }

  // Final clamp to keep within screen viewport
  finalX = Math.max(minSafeX, Math.min(finalX, maxSafeX - cardW));
  finalY = Math.max(minSafeY, Math.min(finalY, maxSafeY - cardH));

  return {
    x: Math.round(finalX),
    y: Math.round(finalY),
    placement: bestCandidate.placement,
    score: lowestScore,
    targetRect,
  };
}
