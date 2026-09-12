/**
 * Transformation Engine
 *
 * Core module for applying, reversing, and navigating between visual lesson
 * transformations on the Excalidraw canvas.
 *
 * Architecture:
 *   VisualLesson → TransformationEngine → Excalidraw updateScene()
 *
 * Key Design Principles:
 * 1. Snapshot-based reversal: Before each transformation, a snapshot of affected
 *    elements is captured. Reversal restores from snapshot — O(1), no inverse computation.
 * 2. Stable element IDs: Elements are identified by dslId in customData across
 *    all transformations. Internal Excalidraw IDs are preserved when possible.
 * 3. In-place mutations: Uses newElementWith() to update element properties without
 *    recreating elements from scratch.
 * 4. Sequential execution: Transformation operations execute in array order (not
 *    topologically sorted), preserving temporal semantics.
 */

import {
  CaptureUpdateAction,
  newElementWith,
  syncInvalidIndices,
} from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  renderActions,
  renderAction,
  RenderContext,
  mapStrokeColor,
  mapBackgroundColor,
} from "./visual-renderer";

import { repairOrReorderActions } from "./backend/dsl-validator";
import { focusOnElements } from "./ai-canvas";
import { animateSceneTransition } from "./scene-animation";
import { resolveSceneCollisions, type SceneLayoutNode } from "./layout-engine";

import type {
  VisualAction,
  VisualLesson,
  Transformation,
  TransformationOperation,
  UpdateOperation,
  ConnectOperation,
  DisconnectOperation,
  UnhighlightOperation,
  ReorderOperation,
  GroupOperation,
} from "./visual-dsl";

import {
  compileVisualLesson,
  type CompiledTimeline,
} from "./transformation-timeline";
import { reconcileSceneState } from "./scene-reconciler";

// ============================================================================
// Types
// ============================================================================

/** Snapshot of a single element before a transformation */
interface ElementSnapshot {
  dslId: string;
  elements: ExcalidrawElement[];
  /** Whether the element existed before this transformation */
  existed: boolean;
}

/** Complete snapshot of state before a transformation */
interface TransformationSnapshot {
  transformationId: string;
  /** Element states captured before the transformation was applied */
  affectedElements: ElementSnapshot[];
  /** Elements that were created by this transformation (for removal on reversal) */
  createdDslIds: string[];
  /** Elements that were deleted by this transformation (for restoration on reversal) */
  deletedElements: ElementSnapshot[];
}

/** State tracker for the transformation engine */
export interface TransformationState {
  /** Current transformation index (-1 = initial scene only) */
  currentIndex: number;
  /** Pre-transformation snapshots for each applied transformation */
  snapshots: TransformationSnapshot[];
  /** Map of dslId → current Excalidraw elements */
  elementRegistry: Map<string, ExcalidrawElement[]>;
  /** The lesson ID associated with this state */
  lessonId: string;
  /** Canonical compiled timeline of complete SceneStates */
  timeline?: CompiledTimeline;
}

/** Result of rendering the initial scene */
export interface InitialSceneResult {
  success: boolean;
  state: TransformationState;
  elements: ExcalidrawElement[];
  errors: readonly string[];
}

/** Result of applying or reversing a transformation */
export interface TransformationResult {
  success: boolean;
  state: TransformationState;
  errors: string[];
}

/** Options for transformation execution and transitions */
export interface ApplyTransformationOptions {
  /** Whether to smoothly animate the transition (default: false in unit tests, true in UI) */
  animate?: boolean;
  /** Duration of animation in milliseconds (default: 380ms) */
  duration?: number;
  /** Callback invoked when the animation completes */
  onComplete?: () => void;
}

// ============================================================================
// Initial Scene Rendering
// ============================================================================

/**
 * Renders the initial scene of a VisualLesson onto the canvas.
 * This creates the starting diagram that will be transformed in place.
 */
export function renderInitialScene(
  excalidrawAPI: ExcalidrawImperativeAPI,
  lesson: VisualLesson,
  options?: {
    /** Whether to clear existing AI elements before rendering (default: true) */
    clearExisting?: boolean;
    /** Whether to focus viewport on the rendered scene (default: true) */
    focusViewport?: boolean;
  },
): InitialSceneResult {
  const { clearExisting = true, focusViewport = true } = options ?? {};

  if (excalidrawAPI.isDestroyed) {
    return {
      success: false,
      state: createEmptyState(lesson.id),
      elements: [],
      errors: ["Excalidraw API is destroyed"],
    };
  }

  try {
    const timeline = compileVisualLesson(lesson);
    const initialTarget = timeline.states[0];
    const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();

    // Reconcile initial state
    const reconcileRes = reconcileSceneState(
      initialTarget,
      clearExisting
        ? currentElements.map((el) =>
            el.customData?.isAiTeaching ? newElementWith(el, { isDeleted: true }) : el,
          )
        : currentElements,
      lesson.id,
    );

    excalidrawAPI.updateScene({
      elements: syncInvalidIndices(reconcileRes.elements),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    if (focusViewport) {
      const visibleElements = reconcileRes.elements.filter(
        (el) => !el.isDeleted && el.customData?.isAiTeaching,
      );
      if (visibleElements.length > 0) {
        focusOnElements(excalidrawAPI, visibleElements);
      }
    }

    const state: TransformationState = {
      currentIndex: -1,
      snapshots: [],
      elementRegistry: reconcileRes.entityElementMap,
      lessonId: lesson.id,
      timeline,
    };

    return {
      success: true,
      state,
      elements: reconcileRes.elements.filter((el) => !el.isDeleted),
      errors: [],
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[TransformationEngine] Failed to render initial scene:",
      err,
    );
    return {
      success: false,
      state: createEmptyState(lesson.id),
      elements: [],
      errors: [
        `Failed to render initial scene: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }
}

// ============================================================================
// Forward Transformation Application
// ============================================================================

/**
 * Applies the next transformation to the current scene in place.
 * Captures a snapshot for reversal before applying.
 */
export function applyTransformation(
  excalidrawAPI: ExcalidrawImperativeAPI,
  transformation: Transformation,
  state: TransformationState,
  options?: ApplyTransformationOptions,
): TransformationResult {
  if (excalidrawAPI.isDestroyed) {
    return {
      success: false,
      state,
      errors: ["Excalidraw API is destroyed"],
    };
  }

  const errors: string[] = [];

  try {
    if (state.timeline) {
      const nextIndex = state.currentIndex + 2; // -1 -> state 1 (after T1), 0 -> state 2 (after T2)
      const clamped = Math.min(nextIndex, state.timeline.states.length - 1);
      const targetState = state.timeline.states[clamped];

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const reconcileRes = reconcileSceneState(
        targetState,
        currentElements,
        state.lessonId,
      );

      state.currentIndex++;

      if (options?.animate) {
        animateSceneTransition(excalidrawAPI, reconcileRes.elements, {
          duration: options.duration ?? 380,
          onComplete: () => {
            const visible = reconcileRes.elements.filter(
              (el) => !el.isDeleted && el.customData?.isAiTeaching,
            );
            if (visible.length > 0) {
              focusOnElements(excalidrawAPI, visible);
            }
            options.onComplete?.();
          },
        });
      } else {
        excalidrawAPI.updateScene({
          elements: syncInvalidIndices(reconcileRes.elements),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        const visible = reconcileRes.elements.filter(
          (el) => !el.isDeleted && el.customData?.isAiTeaching,
        );
        if (visible.length > 0) {
          focusOnElements(excalidrawAPI, visible);
        }
        options?.onComplete?.();
      }

      state.elementRegistry = reconcileRes.entityElementMap;
      return { success: true, state, errors: [] };
    }

    const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();

    // Capture snapshot of elements that will be affected
    const snapshot = captureSnapshot(transformation, state.elementRegistry);

    // Apply each operation in sequential order
    const elementUpdates = new Map<string, ExcalidrawElement>();
    const newElements: ExcalidrawElement[] = [];
    const deletedIds = new Set<string>();

    for (const operation of transformation.operations) {
      const opResult = applyOperation(
        operation,
        state.elementRegistry,
        currentElements,
      );

      if (opResult.error) {
        errors.push(opResult.error);
      }

      for (const el of opResult.newElements) {
        newElements.push(el);
        const dslId = el.customData?.dslId as string | undefined;
        if (dslId) {
          const existing = state.elementRegistry.get(dslId) ?? [];
          existing.push(el);
          state.elementRegistry.set(dslId, existing);
          snapshot.createdDslIds.push(dslId);
        }
      }

      for (const [id, el] of opResult.updates) {
        elementUpdates.set(id, el);
      }

      for (const dslId of opResult.deletedDslIds) {
        deletedIds.add(dslId);
        // Capture deleted elements for restoration
        const deletedEls = state.elementRegistry.get(dslId);
        if (deletedEls) {
          snapshot.deletedElements.push({
            dslId,
            elements: [...deletedEls],
            existed: true,
          });
        }
        state.elementRegistry.delete(dslId);
      }
    }

    // Build the updated scene
    const updatedScene = currentElements.map((el) => {
      // Check if this element was updated
      if (elementUpdates.has(el.id)) {
        return elementUpdates.get(el.id)!;
      }
      // Check if this element should be deleted
      const dslId = el.customData?.dslId as string | undefined;
      if (dslId && deletedIds.has(dslId)) {
        return newElementWith(el, { isDeleted: true });
      }
      return el;
    });

    // Tag and add new elements
    const taggedNew = newElements.map((el) =>
      newElementWith(el, {
        customData: {
          ...(el.customData ?? {}),
          isAiTeaching: true,
          lessonId: state.lessonId,
        },
      }),
    );

    // Run collision resolution across active AI elements to prevent overlap
    const activeElements = [...updatedScene, ...taggedNew].filter(
      (el) => !el.isDeleted && el.customData?.isAiTeaching,
    );

    const layoutNodes: SceneLayoutNode[] = activeElements
      .filter(
        (el) =>
          el.type !== "arrow" &&
          el.type !== "line" &&
          el.customData?.role !== "container",
      )
      .map((el) => ({
        id: (el.customData?.dslId as string) ?? el.id,
        bounds: { x: el.x, y: el.y, width: el.width, height: el.height },
        role: el.customData?.role as string | undefined,
      }));

    const collisionRes = resolveSceneCollisions(layoutNodes);
    let finalTaggedNew = taggedNew;
    let finalUpdatedScene = updatedScene;

    if (collisionRes.totalShifts > 0) {
      finalTaggedNew = taggedNew.map((el) => {
        const dslId = (el.customData?.dslId as string) ?? el.id;
        const shift = collisionRes.shifts.get(dslId);
        if (shift && (shift.dx !== 0 || shift.dy !== 0)) {
          return newElementWith(el, {
            x: el.x + shift.dx,
            y: el.y + shift.dy,
          });
        }
        return el;
      });

      finalUpdatedScene = updatedScene.map((el) => {
        const dslId = (el.customData?.dslId as string) ?? el.id;
        const shift = collisionRes.shifts.get(dslId);
        if (shift && (shift.dx !== 0 || shift.dy !== 0)) {
          return newElementWith(el, {
            x: el.x + shift.dx,
            y: el.y + shift.dy,
          });
        }
        return el;
      });
    }

    const targetElements = syncInvalidIndices([
      ...finalUpdatedScene,
      ...finalTaggedNew,
    ]);

    // Commit or animate to canvas
    if (options?.animate) {
      animateSceneTransition(excalidrawAPI, targetElements, {
        duration: options.duration ?? 380,
        onComplete: options.onComplete,
      });
    } else {
      excalidrawAPI.updateScene({
        elements: targetElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }

    // Focus viewport on affected/created elements so the transformation is visible
    {
      const affectedDslIds = new Set<string>([
        ...snapshot.createdDslIds,
        ...(Array.from(elementUpdates.values())
          .map((el) => el.customData?.dslId as string | undefined)
          .filter(Boolean) as string[]),
      ]);
      // If we have specific affected elements, focus on them; otherwise focus on all AI elements
      const allCurrentElements =
        excalidrawAPI.getSceneElementsIncludingDeleted();
      let focusTargets = allCurrentElements.filter(
        (el) =>
          !el.isDeleted &&
          el.customData?.dslId &&
          (affectedDslIds.has(el.customData.dslId as string) ||
            el.customData?.lessonId === state.lessonId),
      );
      if (focusTargets.length === 0) {
        focusTargets = allCurrentElements.filter(
          (el) => !el.isDeleted && el.customData?.isAiTeaching,
        );
      }
      if (focusTargets.length > 0) {
        focusOnElements(excalidrawAPI, focusTargets);
      }
    }

    // Update registry with patched elements
    for (const [excalidrawId, patchedEl] of elementUpdates) {
      const dslId = patchedEl.customData?.dslId as string | undefined;
      if (dslId) {
        const registryEls = state.elementRegistry.get(dslId) ?? [];
        const idx = registryEls.findIndex((e) => e.id === excalidrawId);
        if (idx >= 0) {
          registryEls[idx] = patchedEl;
        } else {
          registryEls.push(patchedEl);
        }
        state.elementRegistry.set(dslId, registryEls);
      }
    }

    // Store snapshot and advance index
    state.snapshots.push(snapshot);
    state.currentIndex++;

    return { success: true, state, errors };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[TransformationEngine] Failed to apply transformation:",
      err,
    );
    return {
      success: false,
      state,
      errors: [
        `Failed to apply transformation: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }
}

// ============================================================================
// Reverse Transformation (PREVIOUS)
// ============================================================================

/**
 * Reverses the most recently applied transformation by restoring from snapshot.
 */
export function reverseTransformation(
  excalidrawAPI: ExcalidrawImperativeAPI,
  state: TransformationState,
  options?: ApplyTransformationOptions,
): TransformationResult {
  if (excalidrawAPI.isDestroyed) {
    return {
      success: false,
      state,
      errors: ["Excalidraw API is destroyed"],
    };
  }

  if (state.currentIndex < 0) {
    return {
      success: false,
      state,
      errors: ["No transformation to reverse — already at initial scene"],
    };
  }

  if (!state.timeline && state.snapshots.length === 0) {
    return {
      success: false,
      state,
      errors: ["No transformation to reverse — already at initial scene"],
    };
  }

  const errors: string[] = [];

  try {
    if (state.timeline) {
      const prevIndex = state.currentIndex; // When currentIndex is 0, prevIndex is 0 (initialScene)!
      const clamped = Math.max(0, Math.min(prevIndex, state.timeline.states.length - 1));
      const targetState = state.timeline.states[clamped];

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const reconcileRes = reconcileSceneState(
        targetState,
        currentElements,
        state.lessonId,
      );

      state.currentIndex--;

      if (options?.animate) {
        animateSceneTransition(excalidrawAPI, reconcileRes.elements, {
          duration: options.duration ?? 380,
          onComplete: () => {
            const visible = reconcileRes.elements.filter(
              (el) => !el.isDeleted && el.customData?.isAiTeaching,
            );
            if (visible.length > 0) {
              focusOnElements(excalidrawAPI, visible);
            }
            options.onComplete?.();
          },
        });
      } else {
        excalidrawAPI.updateScene({
          elements: syncInvalidIndices(reconcileRes.elements),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        const visible = reconcileRes.elements.filter(
          (el) => !el.isDeleted && el.customData?.isAiTeaching,
        );
        if (visible.length > 0) {
          focusOnElements(excalidrawAPI, visible);
        }
        options?.onComplete?.();
      }

      state.elementRegistry = reconcileRes.entityElementMap;
      return { success: true, state, errors: [] };
    }

    const snapshot = state.snapshots[state.currentIndex];
    const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();

    // Build element update map
    const elementUpdates = new Map<string, ExcalidrawElement>();
    const elementsToRestore: ExcalidrawElement[] = [];

    // 1. Remove elements that were created by this transformation
    for (const dslId of snapshot.createdDslIds) {
      const els = findElementsByDslId(currentElements, dslId);
      for (const el of els) {
        elementUpdates.set(el.id, newElementWith(el, { isDeleted: true }));
      }
      state.elementRegistry.delete(dslId);
    }

    // 2. Restore elements that were deleted by this transformation
    for (const deletedSnapshot of snapshot.deletedElements) {
      const restoredEls = deletedSnapshot.elements.map((el) =>
        newElementWith(el, { isDeleted: false }),
      );
      elementsToRestore.push(...restoredEls);
      state.elementRegistry.set(deletedSnapshot.dslId, restoredEls);
    }

    // 3. Restore modified elements to their pre-transformation state
    for (const affected of snapshot.affectedElements) {
      if (!affected.existed) {
        continue;
      }
      for (const originalEl of affected.elements) {
        elementUpdates.set(originalEl.id, originalEl);
      }
      state.elementRegistry.set(affected.dslId, [...affected.elements]);
    }

    // Build the updated scene
    const updatedScene = currentElements.map((el) => {
      if (elementUpdates.has(el.id)) {
        return elementUpdates.get(el.id)!;
      }
      return el;
    });

    // Add restored elements that might have been removed from the scene
    const sceneIds = new Set(updatedScene.map((el) => el.id));
    const restoreAppend = elementsToRestore.filter(
      (el) => !sceneIds.has(el.id),
    );

    const targetScene = syncInvalidIndices([...updatedScene, ...restoreAppend]);

    // Commit or animate to canvas
    if (options?.animate) {
      animateSceneTransition(excalidrawAPI, targetScene, {
        duration: options.duration ?? 380,
        onComplete: options.onComplete,
      });
    } else {
      excalidrawAPI.updateScene({
        elements: targetScene,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }

    // Focus viewport on remaining lesson elements after reversal
    {
      const allVisible = excalidrawAPI
        .getSceneElementsIncludingDeleted()
        .filter(
          (el) =>
            !el.isDeleted &&
            el.customData?.isAiTeaching &&
            el.customData?.lessonId === state.lessonId,
        );
      if (allVisible.length > 0) {
        focusOnElements(excalidrawAPI, allVisible);
      }
    }

    // Pop snapshot and decrement index
    state.snapshots.pop();
    state.currentIndex--;

    return { success: true, state, errors };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[TransformationEngine] Failed to reverse transformation:",
      err,
    );
    return {
      success: false,
      state,
      errors: [
        `Failed to reverse transformation: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }
}

// ============================================================================
// Jump Navigation
// ============================================================================

/**
 * Jumps to a specific transformation index by applying/reversing
 * the minimal set of transformations.
 */
export function jumpToTransformation(
  excalidrawAPI: ExcalidrawImperativeAPI,
  lesson: VisualLesson,
  state: TransformationState,
  targetIndex: number,
  options?: ApplyTransformationOptions,
): TransformationResult {
  // Clamp target to valid range
  const clampedTarget = Math.max(
    -1,
    Math.min(targetIndex, lesson.transformations.length - 1),
  );

  const errors: string[] = [];

  if (clampedTarget === state.currentIndex) {
    return { success: true, state, errors };
  }

  if (state.timeline) {
    const targetStep = clampedTarget + 1; // -1 -> state 0 (initialScene), 0 -> state 1 (after T1), etc.
    const clampedStateIndex = Math.max(
      0,
      Math.min(targetStep, state.timeline.states.length - 1),
    );
    const targetState = state.timeline.states[clampedStateIndex];

    const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
    const reconcileRes = reconcileSceneState(
      targetState,
      currentElements,
      state.lessonId,
    );

    state.currentIndex = clampedTarget;

    if (options?.animate) {
      animateSceneTransition(excalidrawAPI, reconcileRes.elements, {
        duration: options.duration ?? 380,
        onComplete: () => {
          const visible = reconcileRes.elements.filter(
            (el) => !el.isDeleted && el.customData?.isAiTeaching,
          );
          if (visible.length > 0) {
            focusOnElements(excalidrawAPI, visible);
          }
          options.onComplete?.();
        },
      });
    } else {
      excalidrawAPI.updateScene({
        elements: syncInvalidIndices(reconcileRes.elements),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      const visible = reconcileRes.elements.filter(
        (el) => !el.isDeleted && el.customData?.isAiTeaching,
      );
      if (visible.length > 0) {
        focusOnElements(excalidrawAPI, visible);
      }
      options?.onComplete?.();
    }

    state.elementRegistry = reconcileRes.entityElementMap;
    return { success: true, state, errors: [] };
  }

  if (clampedTarget > state.currentIndex) {
    // Forward: apply transformations sequentially
    for (let i = state.currentIndex + 1; i <= clampedTarget; i++) {
      const isFinalStep = i === clampedTarget;
      const stepOptions = isFinalStep ? options : { animate: false };
      const result = applyTransformation(
        excalidrawAPI,
        lesson.transformations[i],
        state,
        stepOptions,
      );
      errors.push(...result.errors);
      if (!result.success) {
        return { success: false, state: result.state, errors };
      }
      state = result.state;
    }
  } else {
    // Backward: reverse transformations sequentially
    for (let i = state.currentIndex; i > clampedTarget; i--) {
      const isFinalStep = i === clampedTarget + 1;
      const stepOptions = isFinalStep ? options : { animate: false };
      const result = reverseTransformation(excalidrawAPI, state, stepOptions);
      errors.push(...result.errors);
      if (!result.success) {
        return { success: false, state: result.state, errors };
      }
      state = result.state;
    }
  }

  return { success: true, state, errors };
}

// ============================================================================
// Internal Helpers
// ============================================================================

function createEmptyState(lessonId: string): TransformationState {
  return {
    currentIndex: -1,
    snapshots: [],
    elementRegistry: new Map(),
    lessonId,
  };
}

/**
 * Captures a pre-transformation snapshot of all elements that will be
 * affected by the given transformation's operations.
 */
function captureSnapshot(
  transformation: Transformation,
  registry: Map<string, ExcalidrawElement[]>,
): TransformationSnapshot {
  const affectedElements: ElementSnapshot[] = [];
  const affectedDslIds = new Set<string>();

  for (const op of transformation.operations) {
    // Collect target IDs from the operation
    const targetIds = getOperationTargetIds(op);
    for (const targetId of targetIds) {
      if (affectedDslIds.has(targetId)) {
        continue;
      }
      affectedDslIds.add(targetId);

      const els = registry.get(targetId);
      if (els) {
        affectedElements.push({
          dslId: targetId,
          elements: els.map((el) => ({ ...el })),
          existed: true,
        });
      }
    }
  }

  return {
    transformationId: transformation.id,
    affectedElements,
    createdDslIds: [],
    deletedElements: [],
  };
}

/**
 * Extracts all target dslIds referenced by an operation.
 */
function getOperationTargetIds(op: TransformationOperation): string[] {
  const ids: string[] = [];
  if ("target" in op && typeof op.target === "string") {
    ids.push(op.target);
  }
  if ("from" in op && typeof op.from === "string") {
    ids.push(op.from);
  }
  if ("to" in op && typeof op.to === "string") {
    ids.push(op.to);
  }
  if (
    "swapWith" in op &&
    typeof (op as ReorderOperation).swapWith === "string"
  ) {
    ids.push((op as ReorderOperation).swapWith!);
  }
  if ("targets" in op && Array.isArray((op as GroupOperation).targets)) {
    ids.push(...(op as GroupOperation).targets);
  }
  return ids;
}

/** Result of applying a single operation */
interface OperationResult {
  newElements: ExcalidrawElement[];
  updates: Map<string, ExcalidrawElement>;
  deletedDslIds: string[];
  error?: string;
}

/**
 * Applies a single transformation operation.
 */
function applyOperation(
  operation: TransformationOperation,
  registry: Map<string, ExcalidrawElement[]>,
  currentElements: readonly ExcalidrawElement[],
): OperationResult {
  const result: OperationResult = {
    newElements: [],
    updates: new Map(),
    deletedDslIds: [],
  };

  switch (operation.type) {
    // --- Mutation operations ---
    case "update":
      applyUpdate(operation, registry, result);
      break;

    case "connect":
      applyConnect(operation, registry, result);
      break;

    case "disconnect":
      applyDisconnect(operation, currentElements, result);
      break;

    case "unhighlight":
      applyUnhighlight(operation, currentElements, result);
      break;

    case "reorder":
      applyReorder(operation, registry, result);
      break;

    case "group":
      applyGroup(operation, registry, result);
      break;

    case "ungroup":
      result.deletedDslIds.push(operation.target);
      break;

    // --- Delete operation ---
    case "delete":
      result.deletedDslIds.push(operation.target);
      break;

    // --- Highlight (reuse existing renderer) ---
    case "highlight": {
      const targetEls = registry.get(operation.target);
      if (!targetEls || targetEls.length === 0) {
        result.error = `Highlight target '${operation.target}' not found`;
        break;
      }
      const ctx = new RenderContext();
      for (const el of targetEls) {
        ctx.seedRecord(
          (el.customData?.dslId as string) ?? operation.target,
          el,
        );
      }
      const highlightElements = renderAction(operation as VisualAction, ctx);
      result.newElements.push(...highlightElements);
      break;
    }

    // --- Move operation ---
    case "move": {
      const moveTarget = registry.get(operation.target);
      if (!moveTarget || moveTarget.length === 0) {
        result.error = `Move target '${operation.target}' not found`;
        break;
      }
      const ctx = new RenderContext();
      for (const [dslId, els] of registry) {
        for (const el of els) {
          ctx.seedRecord(dslId, el);
        }
      }
      renderAction(operation as VisualAction, ctx);
      for (const el of ctx.getAllElements()) {
        const dslId = el.customData?.dslId as string | undefined;
        if (dslId === operation.target) {
          result.updates.set(el.id, el);
        }
      }
      break;
    }

    // --- Resize operation ---
    case "resize": {
      const resizeTarget = registry.get(operation.target);
      if (!resizeTarget || resizeTarget.length === 0) {
        result.error = `Resize target '${operation.target}' not found`;
        break;
      }
      const ctx = new RenderContext();
      for (const [dslId, els] of registry) {
        for (const el of els) {
          ctx.seedRecord(dslId, el);
        }
      }
      renderAction(operation as VisualAction, ctx);
      for (const el of ctx.getAllElements()) {
        const dslId = el.customData?.dslId as string | undefined;
        if (dslId === operation.target) {
          result.updates.set(el.id, el);
        }
      }
      break;
    }

    // --- Creation operations — delegate to visual renderer ---
    default: {
      if (
        "id" in operation &&
        typeof (operation as { id?: string }).id === "string"
      ) {
        const ctx = new RenderContext();
        // Seed existing elements for relative positioning
        for (const [dslId, els] of registry) {
          for (const el of els) {
            ctx.seedRecord(dslId, el);
          }
        }
        const elements = renderAction(operation as VisualAction, ctx);
        result.newElements.push(...elements);
      } else {
        result.error = `Unhandled operation type: ${
          (operation as { type: string }).type
        }`;
      }
      break;
    }
  }

  return result;
}

// ============================================================================
// Operation Implementations
// ============================================================================

function applyUpdate(
  op: UpdateOperation,
  registry: Map<string, ExcalidrawElement[]>,
  result: OperationResult,
): void {
  const targetEls = registry.get(op.target);
  if (!targetEls || targetEls.length === 0) {
    result.error = `Update target '${op.target}' not found`;
    return;
  }

  for (const el of targetEls) {
    const updates: Record<string, unknown> = {};

    // Update text content (label or value)
    if (el.type === "text" && (op.label != null || op.value != null)) {
      const newText = op.label ?? String(op.value);
      (updates as { text: string }).text = newText;
    }

    // Update style properties
    if (op.style?.color) {
      updates.strokeColor = mapStrokeColor(op.style.color);
      updates.backgroundColor = mapBackgroundColor(op.style.color);
    }

    if (Object.keys(updates).length > 0) {
      const updated = newElementWith(el, updates);
      result.updates.set(el.id, updated);
    }
  }
}

function applyConnect(
  op: ConnectOperation,
  registry: Map<string, ExcalidrawElement[]>,
  result: OperationResult,
): void {
  const ctx = new RenderContext();
  // Seed all existing elements for arrow endpoint resolution
  for (const [dslId, els] of registry) {
    for (const el of els) {
      ctx.seedRecord(dslId, el);
    }
  }

  // Create an arrow action and render it
  const arrowAction: VisualAction = {
    type: "create_arrow",
    id: op.id ?? `conn-${op.from}-${op.to}`,
    from: op.from,
    to: op.to,
    label: op.label,
    direction: op.direction ?? "forward",
    role: op.role ?? "relationship",
    style: op.style,
  };

  const elements = renderAction(arrowAction, ctx);
  result.newElements.push(...elements);
}

function applyDisconnect(
  op: DisconnectOperation,
  currentElements: readonly ExcalidrawElement[],
  result: OperationResult,
): void {
  if (op.target) {
    result.deletedDslIds.push(op.target);
    return;
  }

  if (op.from && op.to) {
    for (const el of currentElements) {
      if (el.isDeleted) {
        continue;
      }
      const cd = el.customData;
      if (
        cd?.semanticType === "connector" &&
        cd.from === op.from &&
        cd.to === op.to &&
        cd.dslId
      ) {
        result.deletedDslIds.push(cd.dslId as string);
        return;
      }
    }
    result.error = `Disconnect: no arrow found from '${op.from}' to '${op.to}'`;
  }
}

function applyUnhighlight(
  op: UnhighlightOperation,
  currentElements: readonly ExcalidrawElement[],
  result: OperationResult,
): void {
  const highlightDslId = `highlight-${op.target}`;
  const highlightMsgDslId = `highlight-msg-${op.target}`;

  for (const el of currentElements) {
    if (el.isDeleted) {
      continue;
    }
    const dslId = el.customData?.dslId as string | undefined;
    if (dslId === highlightDslId || dslId === highlightMsgDslId) {
      result.deletedDslIds.push(dslId);
    }
  }
}

function applyReorder(
  op: ReorderOperation,
  registry: Map<string, ExcalidrawElement[]>,
  result: OperationResult,
): void {
  if (!op.swapWith) {
    result.error =
      "Reorder requires 'swapWith' target (slot-based reorder not yet supported)";
    return;
  }

  const targetEls = registry.get(op.target);
  const swapEls = registry.get(op.swapWith);

  if (!targetEls || targetEls.length === 0) {
    result.error = `Reorder target '${op.target}' not found`;
    return;
  }
  if (!swapEls || swapEls.length === 0) {
    result.error = `Reorder swapWith '${op.swapWith}' not found`;
    return;
  }

  const targetPrimary = targetEls[0];
  const swapPrimary = swapEls[0];
  const dx = swapPrimary.x - targetPrimary.x;
  const dy = swapPrimary.y - targetPrimary.y;

  for (const el of targetEls) {
    result.updates.set(
      el.id,
      newElementWith(el, { x: el.x + dx, y: el.y + dy }),
    );
  }
  for (const el of swapEls) {
    result.updates.set(
      el.id,
      newElementWith(el, { x: el.x - dx, y: el.y - dy }),
    );
  }
}

function applyGroup(
  op: GroupOperation,
  registry: Map<string, ExcalidrawElement[]>,
  result: OperationResult,
): void {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const targetId of op.targets) {
    const els = registry.get(targetId);
    if (!els) {
      continue;
    }
    for (const el of els) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
  }

  if (minX === Infinity) {
    result.error = "Group: no valid targets found";
    return;
  }

  const ctx = new RenderContext();
  const groupAction: VisualAction = {
    type: "create_box",
    id: op.id,
    label: op.label ?? "",
    role: "container",
    style: op.style ?? {
      color: "neutral",
      fill: "transparent",
      strokeStyle: "dashed",
    },
  };

  const elements = renderAction(groupAction, ctx);
  if (elements.length > 0) {
    const pad = 12;
    const positioned = elements.map((el) =>
      newElementWith(el, {
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      }),
    );
    result.newElements.push(...positioned);
  }
}

// ============================================================================
// Element Lookup Helpers
// ============================================================================

function findElementsByDslId(
  elements: readonly ExcalidrawElement[],
  dslId: string,
): ExcalidrawElement[] {
  return elements.filter(
    (el) => !el.isDeleted && el.customData?.dslId === dslId,
  );
}
