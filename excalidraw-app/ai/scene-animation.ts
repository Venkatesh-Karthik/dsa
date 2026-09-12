/**
 * Smooth Scene Animation Controller
 *
 * Provides fluid 350-450ms transitions between visual teaching states.
 * Interpolates element positions, bounding sizes, connector points, and opacities
 * using requestAnimationFrame with easeInOutCubic easing.
 *
 * Guarantees:
 * 1. Zero undo stack pollution: intermediate frames use CaptureUpdateAction.NEVER;
 *    only the final settled state is committed with CaptureUpdateAction.IMMEDIATELY.
 * 2. Strict compliance with RULE[AGENTS.md]: uses app.ownerWindow / mounted node defaultView.
 * 3. Stable identity matching: matches elements by customData.dslId across transformations.
 * 4. Interruptible: clean cancellation and seamless retargeting if user clicks Next/Prev rapidly.
 */

import {
  CaptureUpdateAction,
  newElementWith,
  syncInvalidIndices,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawArrowElement,
} from "@excalidraw/element/types";

// ============================================================================
// Easing Helpers
// ============================================================================

/**
 * Standard cubic ease-in-out easing for natural physical motion.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Linear interpolation between a and b by factor t.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================================
// Types
// ============================================================================

export interface SceneAnimationOptions {
  /** Duration in milliseconds (default: 400ms) */
  duration?: number;
  /** Custom easing function (default: easeInOutCubic) */
  easing?: (t: number) => number;
  /** Monotonic transition identifier */
  transitionId?: number;
  /** Active check predicate: if returns false, this animation must immediately drop frames */
  isTransitionActive?: (transitionId: number) => boolean;
  /** Callback invoked when the animation settles completely */
  onComplete?: () => void;
  /** Callback invoked if the animation is cancelled midway */
  onCancel?: () => void;
}

interface AnimatedItem {
  targetElement: ExcalidrawElement;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startWidth: number;
  startHeight: number;
  targetWidth: number;
  targetHeight: number;
  startOpacity: number;
  targetOpacity: number;
  isNew: boolean;
  isExiting: boolean;
  startPoints?: readonly LocalPoint[];
  targetPoints?: readonly LocalPoint[];
}

// ============================================================================
// Active Animation State Tracking
// ============================================================================

let activeAnimationId: number | null = null;
let activeOwnerWindow: Window | null = null;
let activeOnComplete: (() => void) | null = null;
let activeOnCancel: (() => void) | null = null;

/**
 * Cancels any currently running scene animation immediately.
 */
export function cancelActiveSceneAnimation(): void {
  if (activeAnimationId !== null && activeOwnerWindow) {
    try {
      activeOwnerWindow.cancelAnimationFrame(activeAnimationId);
    } catch {
      // window may have unmounted
    }
    activeAnimationId = null;
    activeOwnerWindow = null;
    activeOnComplete = null;
    if (activeOnCancel) {
      const cb = activeOnCancel;
      activeOnCancel = null;
      cb();
    }
  }
}

/**
 * Returns whether a scene animation is currently in progress.
 */
export function isSceneAnimationRunning(): boolean {
  return activeAnimationId !== null;
}

// ============================================================================
// Core Animation Dispatcher
// ============================================================================

/**
 * Safely resolves ownerWindow from ExcalidrawImperativeAPI per RULE[AGENTS.md].
 */
function resolveOwnerWindow(excalidrawAPI: ExcalidrawImperativeAPI): Window {
  try {
    const canvas = (excalidrawAPI as any).getCanvas?.();
    if (canvas?.ownerDocument?.defaultView) {
      return canvas.ownerDocument.defaultView;
    }
  } catch {
    // Fallback if getCanvas is unavailable
  }
  return typeof window !== "undefined" ? window : ({} as Window);
}

/**
 * Smoothly animates the canvas scene from its current element state to targetElements.
 */
export function animateSceneTransition(
  excalidrawAPI: ExcalidrawImperativeAPI,
  targetElements: readonly ExcalidrawElement[],
  options?: SceneAnimationOptions,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (excalidrawAPI.isDestroyed) {
      resolve();
      return;
    }

    // Cancel any ongoing animation before starting a new one
    cancelActiveSceneAnimation();

    const duration = Math.max(options?.duration ?? 400, 50);
    const easing = options?.easing ?? easeInOutCubic;
    const ownerWindow = resolveOwnerWindow(excalidrawAPI);

    if (!ownerWindow.requestAnimationFrame) {
      // Fallback: immediate update if rAF unavailable
      excalidrawAPI.updateScene({
        elements: syncInvalidIndices(targetElements as ExcalidrawElement[]),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      options?.onComplete?.();
      resolve();
      return;
    }

    const currentScene = excalidrawAPI.getSceneElementsIncludingDeleted();

    // Map existing elements by dslId, fallback to internal id
    const currentByDslId = new Map<string, ExcalidrawElement>();
    const currentById = new Map<string, ExcalidrawElement>();

    for (const el of currentScene) {
      currentById.set(el.id, el);
      const dslId = el.customData?.dslId as string | undefined;
      if (dslId) {
        currentByDslId.set(dslId, el);
      }
    }

    const animatedItems: AnimatedItem[] = [];
    const matchedTargetIds = new Set<string>();
    const matchedCurrentIds = new Set<string>();

    for (const targetEl of targetElements) {
      matchedTargetIds.add(targetEl.id);
      const dslId = targetEl.customData?.dslId as string | undefined;
      const matchedCurrent =
        (dslId ? currentByDslId.get(dslId) : null) ??
        currentById.get(targetEl.id);

      if (matchedCurrent && !matchedCurrent.isDeleted) {
        matchedCurrentIds.add(matchedCurrent.id);
        const item: AnimatedItem = {
          targetElement: targetEl,
          startX: matchedCurrent.x,
          startY: matchedCurrent.y,
          targetX: targetEl.x,
          targetY: targetEl.y,
          startWidth: matchedCurrent.width,
          startHeight: matchedCurrent.height,
          targetWidth: targetEl.width,
          targetHeight: targetEl.height,
          startOpacity: matchedCurrent.opacity ?? 100,
          targetOpacity: targetEl.opacity ?? 100,
          isNew: false,
          isExiting: false,
        };

        if (
          targetEl.type === "arrow" &&
          matchedCurrent.type === "arrow" &&
          (targetEl as ExcalidrawArrowElement).points &&
          (matchedCurrent as ExcalidrawArrowElement).points
        ) {
          item.startPoints = (matchedCurrent as ExcalidrawArrowElement).points;
          item.targetPoints = (targetEl as ExcalidrawArrowElement).points;
        }

        animatedItems.push(item);
      } else {
        // Newly created element: fade in
        animatedItems.push({
          targetElement: targetEl,
          startX: targetEl.x,
          startY: targetEl.y,
          targetX: targetEl.x,
          targetY: targetEl.y,
          startWidth: targetEl.width,
          startHeight: targetEl.height,
          targetWidth: targetEl.width,
          targetHeight: targetEl.height,
          startOpacity: 0,
          targetOpacity: targetEl.opacity ?? 100,
          isNew: true,
          isExiting: false,
        });
      }
    }

    // Identify exiting AI elements (existed in current scene, but absent in target)
    for (const cur of currentScene) {
      if (
        !cur.isDeleted &&
        cur.customData?.isAiTeaching &&
        !matchedCurrentIds.has(cur.id)
      ) {
        animatedItems.push({
          targetElement: newElementWith(cur, { isDeleted: true }),
          startX: cur.x,
          startY: cur.y,
          targetX: cur.x,
          targetY: cur.y,
          startWidth: cur.width,
          startHeight: cur.height,
          targetWidth: cur.width,
          targetHeight: cur.height,
          startOpacity: cur.opacity ?? 100,
          targetOpacity: 0,
          isNew: false,
          isExiting: true,
        });
      }
    }

    // Preserve non-AI elements untouched
    const staticElements = currentScene.filter(
      (el) => !el.customData?.isAiTeaching && !matchedTargetIds.has(el.id),
    );

    const startTime = ownerWindow.performance
      ? ownerWindow.performance.now()
      : Date.now();
    activeOwnerWindow = ownerWindow;

    const transitionId = options?.transitionId;
    const isTransitionActive = options?.isTransitionActive;

    const cleanup = () => {
      activeAnimationId = null;
      activeOwnerWindow = null;
      activeOnComplete = null;
      activeOnCancel = null;
    };

    activeOnComplete = () => {
      options?.onComplete?.();
      resolve();
    };

    activeOnCancel = () => {
      options?.onCancel?.();
      resolve();
    };

    const step = (now: number) => {
      if (excalidrawAPI.isDestroyed) {
        cleanup();
        resolve();
        return;
      }

      // Drop frame immediately if transition was cancelled or superseded by a newer transition!
      if (
        isTransitionActive &&
        transitionId !== undefined &&
        !isTransitionActive(transitionId)
      ) {
        cleanup();
        resolve();
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedT = easing(progress);

      if (progress < 1) {
        // Compute interpolated frame elements
        const frameElements: ExcalidrawElement[] = [];

        for (const item of animatedItems) {
          const currentX = lerp(item.startX, item.targetX, easedT);
          const currentY = lerp(item.startY, item.targetY, easedT);
          const currentW = Math.max(
            1,
            lerp(item.startWidth, item.targetWidth, easedT),
          );
          const currentH = Math.max(
            1,
            lerp(item.startHeight, item.targetHeight, easedT),
          );
          const currentOpacity = Math.round(
            lerp(item.startOpacity, item.targetOpacity, easedT),
          );

          let interpolated = newElementWith(item.targetElement, {
            x: Math.round(currentX),
            y: Math.round(currentY),
            width: Math.round(currentW),
            height: Math.round(currentH),
            opacity: currentOpacity,
            isDeleted: false,
          });

          // Interpolate arrow points if available
          if (
            item.startPoints &&
            item.targetPoints &&
            item.startPoints.length === item.targetPoints.length
          ) {
            const interpolatedPoints: LocalPoint[] = [];
            for (let i = 0; i < item.targetPoints.length; i++) {
              const sp = item.startPoints[i];
              const tp = item.targetPoints[i];
              interpolatedPoints.push(
                pointFrom<LocalPoint>(
                  lerp(sp[0], tp[0], easedT),
                  lerp(sp[1], tp[1], easedT),
                ),
              );
            }
            interpolated = newElementWith(interpolated, {
              points: interpolatedPoints,
            } as any);
          }

          frameElements.push(interpolated);
        }

        // Commit intermediate frame without touching undo history
        excalidrawAPI.updateScene({
          elements: [...staticElements, ...frameElements],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        activeAnimationId = ownerWindow.requestAnimationFrame(step);
      } else {
        // Final Settled Frame: Verify transition is still active before final commit!
        if (
          isTransitionActive &&
          transitionId !== undefined &&
          !isTransitionActive(transitionId)
        ) {
          cleanup();
          resolve();
          return;
        }

        cleanup();

        excalidrawAPI.updateScene({
          elements: syncInvalidIndices([
            ...staticElements,
            ...(targetElements as ExcalidrawElement[]),
          ]),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        options?.onComplete?.();
        resolve();
      }
    };

    activeAnimationId = ownerWindow.requestAnimationFrame(step);
  });
}
