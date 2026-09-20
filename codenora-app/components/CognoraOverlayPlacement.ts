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
  playbackBar?: ScreenRect | null;
  toolbar?: ScreenRect | null;
  zoomControls?: ScreenRect | null;
  tutor?: ScreenRect | null;
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
  const activeAreaW = isInspectorOpen ? containerWidth - 410 : containerWidth;
  const centerX = activeAreaW / 2;

  return {
    // Top Navbar
    navbar: makeScreenRect(0, 0, containerWidth, 84),
    // Right Inspector Panel (384px + margins)
    inspector: isInspectorOpen
      ? makeScreenRect(containerWidth - 410, 76, 410, containerHeight - 90)
      : null,
    // Bottom Composer & Playback Region
    composer: makeScreenRect(
      Math.max(80, centerX - 340),
      containerHeight - 150,
      680,
      150,
    ),
    playbackBar: makeScreenRect(
      Math.max(80, centerX - 260),
      containerHeight - 110,
      520,
      75,
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
 * Enforces a strict Hard Collision Gate: callouts NEVER overlap target nodes,
 * adjacent nodes, connectors/arrows, labels, or UI obstacles.
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
  const cardW = Math.min(
    Math.max(cardDimensions.width || 280, 280),
    containerW - 48,
  );
  const cardH = Math.max(cardDimensions.height || 96, 96);

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

  // Compute scene bounding box across all protected elements
  let sceneMinX = Infinity;
  let sceneMinY = Infinity;
  let sceneMaxX = -Infinity;
  let sceneMaxY = -Infinity;

  for (const p of protectedElements) {
    if (p.rect.left < sceneMinX) {
      sceneMinX = p.rect.left;
    }
    if (p.rect.top < sceneMinY) {
      sceneMinY = p.rect.top;
    }
    if (p.rect.right > sceneMaxX) {
      sceneMaxX = p.rect.right;
    }
    if (p.rect.bottom > sceneMaxY) {
      sceneMaxY = p.rect.bottom;
    }
  }
  const hasSceneElements = protectedElements.length > 0 && isFinite(sceneMinX);

  const availableCanvasW = maxSafeX - minSafeX;
  const targetCenterX = targetRect
    ? targetRect.left + targetRect.width / 2
    : minSafeX + availableCanvasW / 2;
  const targetCenterY = targetRect
    ? targetRect.top + targetRect.height / 2
    : minSafeY + (maxSafeY - minSafeY) / 2;

  // 4. Generate candidate placement positions
  interface Candidate {
    x: number;
    y: number;
    placement: OverlayPlacementResult["placement"];
    preferenceBonus: number;
  }

  const candidates: Candidate[] = [];

  if (targetRect) {
    // Gap distances must strictly exceed the 24px target buffer
    const gaps = [28, 48, 72, 108];

    // Above candidates (pedagogically preferred for horizontally-aligned structures)
    for (const gap of gaps) {
      const candY = targetRect.top - cardH - gap;
      if (candY >= minSafeY) {
        candidates.push({
          x: Math.max(
            minSafeX,
            Math.min(targetCenterX - cardW / 2, maxSafeX - cardW),
          ),
          y: candY,
          placement: "above",
          preferenceBonus: gap === 28 ? -120 : -80,
        });
      }
    }

    // Below candidates (only if candidate fits above bottom composer/playback)
    const composerTop = uiObstacles.composer?.top ?? containerH - 160;
    for (const gap of gaps) {
      const candY = targetRect.bottom + gap;
      if (candY + cardH <= composerTop) {
        candidates.push({
          x: Math.max(
            minSafeX,
            Math.min(targetCenterX - cardW / 2, maxSafeX - cardW),
          ),
          y: candY,
          placement: "below",
          preferenceBonus: gap === 28 ? -100 : -70,
        });
      }
    }

    // Right candidates
    for (const gap of [32, 56, 88]) {
      const candX = targetRect.right + gap;
      if (candX + cardW <= maxSafeX) {
        candidates.push({
          x: candX,
          y: Math.max(
            minSafeY,
            Math.min(targetCenterY - cardH / 2, maxSafeY - cardH),
          ),
          placement: "right",
          preferenceBonus: -60,
        });
      }
    }

    // Left candidates
    for (const gap of [32, 56, 88]) {
      const candX = targetRect.left - cardW - gap;
      if (candX >= minSafeX) {
        candidates.push({
          x: candX,
          y: Math.max(
            minSafeY,
            Math.min(targetCenterY - cardH / 2, maxSafeY - cardH),
          ),
          placement: "left",
          preferenceBonus: -60,
        });
      }
    }

    // Corner / diagonal candidates (safe buffers >= 28)
    if (targetRect.top - cardH - 28 >= minSafeY) {
      if (targetRect.right + 28 + cardW <= maxSafeX) {
        candidates.push({
          x: targetRect.right + 28,
          y: targetRect.top - cardH - 28,
          placement: "above",
          preferenceBonus: -40,
        });
      }
      if (targetRect.left - cardW - 28 >= minSafeX) {
        candidates.push({
          x: targetRect.left - cardW - 28,
          y: targetRect.top - cardH - 28,
          placement: "above",
          preferenceBonus: -40,
        });
      }
    }

    if (targetRect.bottom + 28 + cardH <= composerTop) {
      if (targetRect.right + 28 + cardW <= maxSafeX) {
        candidates.push({
          x: targetRect.right + 28,
          y: targetRect.bottom + 28,
          placement: "below",
          preferenceBonus: -40,
        });
      }
      if (targetRect.left - cardW - 28 >= minSafeX) {
        candidates.push({
          x: targetRect.left - cardW - 28,
          y: targetRect.bottom + 28,
          placement: "below",
          preferenceBonus: -40,
        });
      }
    }
  }

  // Scene-Adaptive Free Space candidates
  const composerTop = uiObstacles.composer?.top ?? containerH - 160;
  if (hasSceneElements) {
    // Dynamic Above Scene
    if (sceneMinY - minSafeY >= cardH + 28) {
      candidates.push({
        x: Math.max(
          minSafeX + 16,
          Math.min(targetCenterX - cardW / 2, maxSafeX - cardW - 16),
        ),
        y: Math.max(minSafeY + 12, sceneMinY - cardH - 28),
        placement: "above",
        preferenceBonus: -50,
      });
    }

    // Dynamic Below Scene
    if (composerTop - sceneMaxY >= cardH + 28) {
      candidates.push({
        x: Math.max(
          minSafeX + 16,
          Math.min(targetCenterX - cardW / 2, maxSafeX - cardW - 16),
        ),
        y: sceneMaxY + 28,
        placement: "below",
        preferenceBonus: -40,
      });
    }

    // Dynamic Right of Scene
    if (maxSafeX - sceneMaxX >= cardW + 32) {
      candidates.push({
        x: sceneMaxX + 32,
        y: Math.max(
          minSafeY + 16,
          Math.min(targetCenterY - cardH / 2, composerTop - cardH),
        ),
        placement: "right",
        preferenceBonus: -30,
      });
    }

    // Dynamic Left of Scene
    if (sceneMinX - minSafeX >= cardW + 32) {
      candidates.push({
        x: minSafeX + 32,
        y: Math.max(
          minSafeY + 16,
          Math.min(targetCenterY - cardH / 2, composerTop - cardH),
        ),
        placement: "left",
        preferenceBonus: -30,
      });
    }
  }

  // Stable Peripheral Quadrants (always available safe havens)
  candidates.push(
    // Top-Right Free Space (left of inspector)
    {
      x: maxSafeX - cardW - 20,
      y: minSafeY + 16,
      placement: "floating",
      preferenceBonus: 0,
    },
    // Middle-Left Free Space (right of toolbar)
    {
      x: minSafeX + 84,
      y: Math.max(minSafeY + 20, containerH / 2 - cardH / 2),
      placement: "floating",
      preferenceBonus: 0,
    },
    // Middle-Right Free Space
    {
      x: maxSafeX - cardW - 20,
      y: Math.max(minSafeY + 20, containerH / 2 - cardH / 2),
      placement: "floating",
      preferenceBonus: 0,
    },
    // Top-Left Free Space
    {
      x: minSafeX + 84,
      y: minSafeY + 16,
      placement: "floating",
      preferenceBonus: 0,
    },
    // Bottom-Left (above zoom controls)
    {
      x: minSafeX + 84,
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

  // 5. Score candidates with HARD COLLISION GATE
  interface ScoredCandidate {
    x: number;
    y: number;
    placement: OverlayPlacementResult["placement"];
    score: number;
    isColliding: boolean;
  }

  const scoredCandidates: ScoredCandidate[] = [];

  for (const cand of candidates) {
    let score = cand.preferenceBonus;

    // Clamp candidate rect to screen boundaries
    const candLeft = Math.max(minSafeX, Math.min(cand.x, maxSafeX - cardW));
    const candTop = Math.max(minSafeY, Math.min(cand.y, maxSafeY - cardH));

    const candRect = makeScreenRect(candLeft, candTop, cardW, cardH);

    // Check UI Obstacles Overlap
    const navOverlap = getRectOverlapArea(candRect, uiObstacles.navbar);
    const inspOverlap = uiObstacles.inspector
      ? getRectOverlapArea(candRect, uiObstacles.inspector)
      : 0;
    const compOverlap = uiObstacles.composer
      ? getRectOverlapArea(candRect, uiObstacles.composer)
      : 0;
    const playbackOverlap = uiObstacles.playbackBar
      ? getRectOverlapArea(candRect, uiObstacles.playbackBar)
      : 0;
    const toolOverlap = uiObstacles.toolbar
      ? getRectOverlapArea(candRect, uiObstacles.toolbar)
      : 0;
    const zoomOverlap = uiObstacles.zoomControls
      ? getRectOverlapArea(candRect, uiObstacles.zoomControls)
      : 0;

    const totalUIOverlap =
      navOverlap +
      inspOverlap +
      compOverlap +
      playbackOverlap +
      toolOverlap +
      zoomOverlap;

    // Check Protected Scene Elements Overlap
    let totalElementOverlap = 0;
    let hasTargetCollision = false;
    let hasNodeCollision = false;
    let hasConnectorCollision = false;
    let hasLabelCollision = false;

    for (const prot of protectedElements) {
      const buffer =
        prot.type === "target"
          ? 24
          : prot.type === "node"
          ? 20
          : prot.type === "connector"
          ? 12
          : 8;

      const bufferedRect: ScreenRect = {
        left: prot.rect.left - buffer,
        top: prot.rect.top - buffer,
        right: prot.rect.right + buffer,
        bottom: prot.rect.bottom + buffer,
        width: prot.rect.width + buffer * 2,
        height: prot.rect.height + buffer * 2,
      };

      const overlap = getRectOverlapArea(candRect, bufferedRect);
      if (overlap > 0) {
        totalElementOverlap += overlap;
        if (prot.type === "target") {
          hasTargetCollision = true;
        } else if (prot.type === "node") {
          hasNodeCollision = true;
        } else if (prot.type === "connector") {
          hasConnectorCollision = true;
        } else if (prot.type === "label") {
          hasLabelCollision = true;
        }
      }
    }

    const isColliding = totalUIOverlap > 0 || totalElementOverlap > 0;

    // Hard Collision Gate: insurmountable penalty for any collision
    if (isColliding) {
      score +=
        100_000_000 +
        (hasTargetCollision ? 50_000_000 : 0) +
        (hasNodeCollision ? 20_000_000 : 0) +
        (hasConnectorCollision ? 10_000_000 : 0) +
        (hasLabelCollision ? 5_000_000 : 0) +
        (totalUIOverlap + totalElementOverlap) * 10_000;
    } else {
      // Distance reward: closest collision-free candidate wins
      const candCenterX = candRect.left + candRect.width / 2;
      const candCenterY = candRect.top + candRect.height / 2;
      const distToTarget = Math.hypot(
        candCenterX - targetCenterX,
        candCenterY - targetCenterY,
      );
      score += distToTarget * 0.15;

      // Temporal continuity bonus (subtle anchor, never overrides primary spatial safety)
      if (input.previousPosition) {
        const distToPrev = Math.hypot(
          candRect.left - input.previousPosition.x,
          candRect.top - input.previousPosition.y,
        );
        if (distToPrev < 90) {
          score -= 15;
        }
      }
    }

    scoredCandidates.push({
      x: candRect.left,
      y: candRect.top,
      placement: cand.placement,
      score,
      isColliding,
    });
  }

  // Prefer collision-free candidates first
  const collisionFreeCandidates = scoredCandidates.filter(
    (c) => !c.isColliding,
  );

  let bestCandidate: ScoredCandidate;
  if (collisionFreeCandidates.length > 0) {
    collisionFreeCandidates.sort((a, b) => a.score - b.score);
    bestCandidate = collisionFreeCandidates[0];
  } else {
    // If no candidate is completely collision-free, pick candidate with lowest penalty
    scoredCandidates.sort((a, b) => a.score - b.score);
    bestCandidate = scoredCandidates[0] || {
      x: minSafeX + 80,
      y: minSafeY + 20,
      placement: "floating",
      score: 0,
      isColliding: false,
    };
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
    score: bestCandidate.score,
    targetRect,
  };
}
