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
 * Universal structural validator for intermediate animation frames.
 * Ensures the canvas scene never renders malformed elements, non-finite coordinates,
 * or corrupted intermediate states.
 */
export function validateIntermediateFrameElements(
  elements: readonly ExcalidrawElement[],
): { valid: boolean; reason?: string } {
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }

    // Check finite coordinates and dimensions
    if (!Number.isFinite(el.x) || !Number.isFinite(el.y)) {
      return {
        valid: false,
        reason: `Element ${el.id} (${el.type}) has non-finite coordinates (${el.x}, ${el.y})`,
      };
    }
    if (!Number.isFinite(el.width) || !Number.isFinite(el.height)) {
      return {
        valid: false,
        reason: `Element ${el.id} (${el.type}) has non-finite dimensions (${el.width}x${el.height})`,
      };
    }
    if (el.width < 0 || el.height < 0) {
      return {
        valid: false,
        reason: `Element ${el.id} (${el.type}) has negative dimensions (${el.width}x${el.height})`,
      };
    }

    // Connector control points check
    if (el.type === "arrow") {
      const arrow = el as ExcalidrawArrowElement;
      if (arrow.points) {
        for (const pt of arrow.points) {
          if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
            return {
              valid: false,
              reason: `Arrow ${el.id} has non-finite control point [${pt[0]}, ${pt[1]}]`,
            };
          }
        }
      }
    }
  }

  return { valid: true };
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

    // Map existing active elements by dslId and id
    const currentByDslId = new Map<string, ExcalidrawElement>();
    const currentById = new Map<string, ExcalidrawElement>();

    for (const el of currentScene) {
      if (el.isDeleted) {
        continue;
      }
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

      // Strict 1-to-1 matching: first by exact ID, then by scoped dslId
      let matchedCurrent: ExcalidrawElement | undefined;
      const byId = currentById.get(targetEl.id);
      if (byId && !matchedCurrentIds.has(byId.id)) {
        matchedCurrent = byId;
      } else if (dslId) {
        const byDsl = currentByDslId.get(dslId);
        if (byDsl && !matchedCurrentIds.has(byDsl.id)) {
          matchedCurrent = byDsl;
        }
      }

      if (targetEl.isDeleted) {
        if (matchedCurrent && !matchedCurrent.isDeleted) {
          matchedCurrentIds.add(matchedCurrent.id);
          animatedItems.push({
            targetElement: targetEl,
            startX: matchedCurrent.x,
            startY: matchedCurrent.y,
            targetX: matchedCurrent.x,
            targetY: matchedCurrent.y,
            startWidth: matchedCurrent.width,
            startHeight: matchedCurrent.height,
            targetWidth: matchedCurrent.width,
            targetHeight: matchedCurrent.height,
            startOpacity: matchedCurrent.opacity ?? 100,
            targetOpacity: 0,
            isNew: false,
            isExiting: true,
          });
        }
        continue;
      }

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
    const exitingElements: ExcalidrawElement[] = [];
    for (const cur of currentScene) {
      if (
        !cur.isDeleted &&
        cur.customData?.isAiTeaching &&
        !matchedCurrentIds.has(cur.id) &&
        !matchedTargetIds.has(cur.id)
      ) {
        const delEl = newElementWith(cur, { isDeleted: true });
        exitingElements.push(delEl);
        animatedItems.push({
          targetElement: delEl,
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
          if (item.targetElement.isDeleted && !item.isExiting) {
            continue;
          }
          const isText = item.targetElement.type === "text";
          const currentX = lerp(item.startX, item.targetX, easedT);
          const currentY = lerp(item.startY, item.targetY, easedT);
          // Never lerp arbitrary dimensions on text elements to prevent word-wrap corruption & clipping
          const currentW = isText
            ? item.targetElement.width
            : Math.max(1, lerp(item.startWidth, item.targetWidth, easedT));
          const currentH = isText
            ? item.targetElement.height
            : Math.max(1, lerp(item.startHeight, item.targetHeight, easedT));
          const currentOpacity = Math.round(
            lerp(item.startOpacity, item.targetOpacity, easedT),
          );

          let interpolated = newElementWith(item.targetElement, {
            x: Math.round(currentX),
            y: Math.round(currentY),
            width: Math.round(currentW),
            height: Math.round(currentH),
            opacity: currentOpacity,
            isDeleted: item.isExiting
              ? false
              : Boolean(item.targetElement.isDeleted),
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

        // Validate intermediate frame elements: never render corrupted or non-finite intermediate state
        const validation = validateIntermediateFrameElements(frameElements);
        if (!validation.valid) {
          console.warn(
            "[Cognora Animation] Invalid intermediate frame rejected:",
            validation.reason,
          );
          cleanup();
          excalidrawAPI.updateScene({
            elements: syncInvalidIndices([
              ...staticElements,
              ...exitingElements,
              ...(targetElements as ExcalidrawElement[]),
            ]),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          options?.onComplete?.();
          resolve();
          return;
        }

        // Commit valid intermediate frame without touching undo history
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
            ...exitingElements,
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

// ============================================================================
// Semantic Animation Planning Engine
// ============================================================================

export type SemanticMotionType =
  | "CREATE"
  | "REMOVE"
  | "MOVE"
  | "TRANSFER"
  | "CONNECT"
  | "DISCONNECT"
  | "MUTATE"
  | "HIGHLIGHT"
  | "STATE_CHANGE"
  | "EXPAND"
  | "COLLAPSE"
  | "BRANCH"
  | "MERGE"
  | "FLOW"
  | "PULSE"
  | "EMPHASIZE";

export interface SemanticAnimationAction {
  motionType: SemanticMotionType;
  entityId: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  description: string;
  durationMs: number;
  easing: "ease-in-out" | "ease-out" | "ease-in" | "linear";
  properties?: Record<string, any>;
}

export interface SemanticAnimationPlan {
  stepIndex: number;
  actions: SemanticAnimationAction[];
  totalDurationMs: number;
}

/**
 * Derives purposeful semantic animation plan from state graph differences.
 * Animations communicate conceptual meaning rather than decorative noise.
 */
export function deriveSemanticAnimationPlan(
  previousGraph: {
    entities: Map<string, any>;
    relationships?: Map<string, any>;
  } | null,
  nextGraph: { entities: Map<string, any>; relationships?: Map<string, any> },
  stepIndex = 0,
  transformation?: any,
): SemanticAnimationPlan {
  const actions: SemanticAnimationAction[] = [];

  if (!previousGraph) {
    // Initial scene creation: fluid stagger-in
    for (const [id, ent] of nextGraph.entities.entries()) {
      actions.push({
        motionType: "CREATE",
        entityId: id,
        description: `Materialize ${ent.label || id}`,
        durationMs: 400,
        easing: "ease-out",
      });
    }
    return {
      stepIndex,
      actions,
      totalDurationMs: 400,
    };
  }

  // 1. Newly created entities
  for (const [id, ent] of nextGraph.entities.entries()) {
    if (!previousGraph.entities.has(id)) {
      const isMessageOrPacket =
        ent.primitiveType === "Message" ||
        ent.primitiveType === "Packet" ||
        ent.primitiveType === "Signal";

      actions.push({
        motionType: isMessageOrPacket ? "TRANSFER" : "CREATE",
        entityId: id,
        description: isMessageOrPacket
          ? `Transfer ${ent.label || id} across endpoints`
          : `Create ${ent.label || id}`,
        durationMs: 380,
        easing: "ease-out",
      });
    }
  }

  // 2. Removed entities
  for (const [id, prevEnt] of previousGraph.entities.entries()) {
    if (!nextGraph.entities.has(id)) {
      actions.push({
        motionType: "REMOVE",
        entityId: id,
        description: `Deallocate ${prevEnt.label || id}`,
        durationMs: 320,
        easing: "ease-in",
      });
    }
  }

  // 3. Persistent entities inspection (state changes, mutations, movements)
  for (const [id, nextEnt] of nextGraph.entities.entries()) {
    const prevEnt = previousGraph.entities.get(id);
    if (!prevEnt) {
      continue;
    }

    // State transition
    if (prevEnt.state !== nextEnt.state) {
      const isFailure =
        String(nextEnt.state).toLowerCase().includes("fail") ||
        String(nextEnt.state).toLowerCase().includes("abort");
      actions.push({
        motionType: isFailure ? "PULSE" : "STATE_CHANGE",
        entityId: id,
        description: `Transition ${nextEnt.label || id} state from '${
          prevEnt.state
        }' to '${nextEnt.state}'`,
        durationMs: 400,
        easing: "ease-in-out",
        properties: { fromState: prevEnt.state, toState: nextEnt.state },
      });
    }

    // Value mutation
    if (prevEnt.value !== nextEnt.value && nextEnt.value !== undefined) {
      actions.push({
        motionType: "MUTATE",
        entityId: id,
        description: `Mutate ${nextEnt.label || id} value from '${
          prevEnt.value
        }' to '${nextEnt.value}'`,
        durationMs: 350,
        easing: "ease-in-out",
      });
    }

    // Focus/Highlight
    if (
      !prevEnt.properties?.isHighlighted &&
      nextEnt.properties?.isHighlighted
    ) {
      actions.push({
        motionType: "HIGHLIGHT",
        entityId: id,
        description: `Emphasize focus on ${nextEnt.label || id}`,
        durationMs: 300,
        easing: "ease-out",
      });
    }

    // Compound Table Inspection
    if (nextEnt.primitiveType === "Table") {
      const prevRows = (prevEnt.properties?.rows as any[]) || [];
      const nextRows = (nextEnt.properties?.rows as any[]) || [];
      if (nextRows.length > prevRows.length) {
        actions.push({
          motionType: "EXPAND",
          entityId: id,
          description: `Insert row into ${nextEnt.label || id}`,
          durationMs: 350,
          easing: "ease-out",
        });
      } else if (nextRows.length < prevRows.length) {
        actions.push({
          motionType: "COLLAPSE",
          entityId: id,
          description: `Remove row from ${nextEnt.label || id}`,
          durationMs: 320,
          easing: "ease-in",
        });
      }

      const prevHighlightRow = prevEnt.properties?.highlightRowIndex;
      const nextHighlightRow = nextEnt.properties?.highlightRowIndex;
      if (
        prevHighlightRow !== nextHighlightRow &&
        nextHighlightRow !== undefined
      ) {
        actions.push({
          motionType: "HIGHLIGHT",
          entityId: id,
          description: `Highlight row ${nextHighlightRow + 1} in ${
            nextEnt.label || id
          }`,
          durationMs: 300,
          easing: "ease-out",
        });
      }
    }
  }

  // 4. Relationship changes (CONNECT, DISCONNECT)
  if (nextGraph.relationships) {
    for (const [relId, rel] of nextGraph.relationships.entries()) {
      if (!previousGraph.relationships?.has(relId)) {
        actions.push({
          motionType: "CONNECT",
          entityId: relId,
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          description: `Connect ${rel.sourceEntityId} -> ${rel.targetEntityId}${
            rel.label ? ` (${rel.label})` : ""
          }`,
          durationMs: 380,
          easing: "ease-out",
        });
      }
    }
  }

  if (previousGraph.relationships) {
    for (const [relId, rel] of previousGraph.relationships.entries()) {
      if (!nextGraph.relationships?.has(relId)) {
        actions.push({
          motionType: "DISCONNECT",
          entityId: relId,
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          description: `Disconnect ${rel.sourceEntityId} -> ${rel.targetEntityId}`,
          durationMs: 300,
          easing: "ease-in",
        });
      }
    }
  }

  // 5. Decision branching
  if (transformation?.decision) {
    actions.push({
      motionType: "BRANCH",
      entityId: transformation.decision.id || "decision_point",
      description: `Evaluate decision '${transformation.decision.question}' -> selected '${transformation.selectedOutcome}'`,
      durationMs: 420,
      easing: "ease-in-out",
    });
  }

  // Calculate total duration
  const maxActionDuration = actions.reduce(
    (m, a) => Math.max(m, a.durationMs),
    350,
  );

  return {
    stepIndex,
    actions,
    totalDurationMs: Math.min(600, maxActionDuration),
  };
}
