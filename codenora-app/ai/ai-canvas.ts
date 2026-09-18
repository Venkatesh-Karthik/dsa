/**
 * AI Canvas Integration Layer
 *
 * Bridge between the Visual Teaching Renderer and the Excalidraw Canvas.
 *
 * Pipeline:
 *   Visual DSL -> visual-renderer.ts -> ai-canvas.ts -> ExcalidrawImperativeAPI -> Canvas
 *
 * Key guarantees:
 * 1. Non-destructive: Always preserves user drawings; only manages AI-generated elements.
 * 2. Undo/Redo: Uses CaptureUpdateAction.IMMEDIATELY so operations participate in history.
 * 3. Camera Director: Smoothly animates viewport to focus on the newly drawn elements.
 * 4. Duplicate Guard: Prevents redundant element insertions and supports clean in-place replacement.
 * 5. State Preservation: Seeds existing canvas elements into RenderContext for follow-ups (highlights, arrows).
 * 6. Fault-tolerant: Gracefully handles errors without crashing Excalidraw.
 */

import { CaptureUpdateAction, syncInvalidIndices } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  renderActions,
  RenderContext,
  EXAMPLE_BINARY_SEARCH_ACTIONS,
  type RenderOptions,
} from "./visual-renderer";

import { repairOrReorderActions } from "./backend/dsl-validator";
import { verifyAndEnrichStepCalculations } from "./calculations";
import { STEP_LAYOUT } from "./layout-engine";
import { SemanticStateManager } from "./semantic-state";

import type { VisualAction, TeachingStep } from "./visual-dsl";

export interface ApplyVisualActionsOptions {
  /** Optional layout options for the renderer */
  layoutOptions?: Partial<RenderOptions>;
  /** Whether to animate the viewport to focus on the newly added elements (default: true) */
  focusViewport?: boolean;
  /** Whether to prevent inserting if elements with the same DSL IDs already exist (default: false in teaching mode) */
  preventDuplicates?: boolean;
  /** Whether to replace existing AI elements with matching DSL IDs instead of duplicating (default: true) */
  replaceMatchingAI?: boolean;
  /** Whether to remove all prior AI elements before inserting new teaching visuals (default: false) */
  replacePreviousAI?: boolean;
  /** Whether to display user-facing toasts on success/error (default: true) */
  showToast?: boolean;
}

export interface ApplyVisualActionsResult {
  success: boolean;
  insertedElements: ExcalidrawElement[];
  errors: readonly string[];
  skippedDueToDuplicates?: boolean;
}

/**
 * Focuses the Excalidraw viewport on the specified elements.
 */
export function focusOnElements(
  excalidrawAPI: ExcalidrawImperativeAPI,
  elements: readonly ExcalidrawElement[],
  fit: "contain" | "scale-down" = "scale-down",
) {
  if (!elements.length || excalidrawAPI.isDestroyed) {
    return;
  }

  try {
    excalidrawAPI.setViewport({
      target: elements,
      fit,
      animation: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[AI-Canvas] Failed to animate viewport:", err);
  }
}

/**
 * Returns all semantic DSL IDs currently present on the active canvas.
 */
export function getExistingDslIds(
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
): string[] {
  if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
    return [];
  }
  const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
  const ids = new Set<string>();
  for (const el of elements) {
    if (!el.isDeleted && el.customData?.dslId) {
      ids.add(el.customData.dslId as string);
    }
  }
  return Array.from(ids);
}

/**
 * Renders Visual DSL actions and safely updates the Excalidraw scene.
 * Preserves all existing user elements and captures the action in undo/redo history.
 */
export function applyVisualActions(
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
  actions: VisualAction[],
  options: ApplyVisualActionsOptions = {},
): ApplyVisualActionsResult {
  const {
    focusViewport = true,
    preventDuplicates = false,
    replaceMatchingAI = true,
    replacePreviousAI = false,
    showToast = true,
    layoutOptions,
  } = options;

  if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
    // eslint-disable-next-line no-console
    console.warn(
      "[AI-Canvas] ExcalidrawImperativeAPI is not available or destroyed.",
    );
    return {
      success: false,
      insertedElements: [],
      errors: ["Excalidraw API is not ready or has been destroyed."],
    };
  }

  if (!actions.length) {
    return {
      success: true,
      insertedElements: [],
      errors: [],
    };
  }

  const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();

  const existingDslIds: string[] = [];
  for (const el of currentElements) {
    if (!el.isDeleted && el.customData?.dslId) {
      existingDslIds.push(el.customData.dslId as string);
    }
  }

  // 1. Check for duplicates if preventDuplicates is strictly enabled and replaceMatchingAI is false
  if (preventDuplicates && !replaceMatchingAI) {
    const existingSet = new Set(existingDslIds);
    const newActionIds = actions
      .filter((a): a is Extract<VisualAction, { id: string }> => "id" in a)
      .map((a) => a.id);
    const hasExisting = newActionIds.some((id) => existingSet.has(id));

    if (hasExisting) {
      const msg =
        "AI elements with these IDs already exist on the canvas. Undo (Ctrl+Z) or clear first.";
      // eslint-disable-next-line no-console
      console.info(`[AI-Canvas] ${msg}`);
      if (showToast) {
        excalidrawAPI.setToast({
          message: msg,
          closable: true,
          duration: 3000,
        });
      }
      return {
        success: false,
        insertedElements: [],
        errors: [msg],
        skippedDueToDuplicates: true,
      };
    }
  }

  // 2. Render the actions into native Excalidraw elements
  try {
    const context = new RenderContext(layoutOptions);

    // Seed context with active AI elements from canvas so follow-up actions (highlights, arrows) can anchor to them
    for (const el of currentElements) {
      if (!el.isDeleted && el.customData?.dslId) {
        context.seedRecord(el.customData.dslId as string, el);
      }
    }

    // Repair aliases and sort actions by dependency before rendering
    const orderedActions = repairOrReorderActions(actions, existingDslIds);
    const renderResult = renderActions(orderedActions, context);

    if (renderResult.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[AI-Canvas] Renderer reported errors:",
        renderResult.errors,
      );
    }

    const hasDeleteActions = actions.some((a) => a.type === "delete");
    if (!renderResult.elements.length && !hasDeleteActions) {
      const errorMsg =
        renderResult.errors.length > 0
          ? renderResult.errors[0]
          : "No Excalidraw elements were produced by the renderer.";
      if (showToast) {
        excalidrawAPI.setToast({
          message: errorMsg,
          closable: true,
          duration: 3000,
        });
      }
      return {
        success: false,
        insertedElements: [],
        errors: [...renderResult.errors, errorMsg],
      };
    }

    // 3. Build updated elements:
    // - User drawings (no dslId) are ALWAYS preserved untouched.
    // - Deleted AI elements are marked isDeleted: true.
    // - Matching AI elements (if replaceMatchingAI or replacePreviousAI) are marked isDeleted: true to avoid duplicates.
    const deleteTargets = new Set(
      actions
        .filter(
          (a): a is Extract<VisualAction, { type: "delete" }> =>
            a.type === "delete",
        )
        .map((a) => a.target),
    );

    const incomingDslIds = new Set(
      renderResult.elements
        .filter((el) => el.customData?.dslId)
        .map((el) => el.customData!.dslId as string),
    );

    const updatedElements: ExcalidrawElement[] = [];

    for (const el of currentElements) {
      const dslId = el.customData?.dslId as string | undefined;
      const targetId = el.customData?.targetId as string | undefined;

      // Handle AI element deletion
      if (
        dslId &&
        (deleteTargets.has(dslId) || (targetId && deleteTargets.has(targetId)))
      ) {
        updatedElements.push({ ...el, isDeleted: true });
        continue;
      }

      // Handle full replacement of previous AI elements
      if (replacePreviousAI && dslId) {
        updatedElements.push({ ...el, isDeleted: true });
        continue;
      }

      // Handle in-place replacement of matching AI elements
      if (replaceMatchingAI && dslId && incomingDslIds.has(dslId)) {
        updatedElements.push({ ...el, isDeleted: true });
        continue;
      }

      // Keep user drawing or non-conflicting element
      updatedElements.push(el);
    }

    // Append newly rendered elements
    updatedElements.push(...renderResult.elements);

    // 4. Update the scene with IMMEDIATE undo/redo capture and synchronized indices
    const syncedElements = syncInvalidIndices(updatedElements);
    excalidrawAPI.updateScene({
      elements: syncedElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    // 5. Optionally focus camera on newly added elements
    if (focusViewport && renderResult.elements.length > 0) {
      focusOnElements(excalidrawAPI, renderResult.elements);
    }

    if (showToast) {
      if (renderResult.elements.length > 0) {
        excalidrawAPI.setToast({
          message: `Added ${renderResult.elements.length} AI teaching elements to canvas!`,
          closable: true,
          duration: 2500,
        });
      } else if (hasDeleteActions) {
        excalidrawAPI.setToast({
          message: "Removed AI teaching elements from canvas.",
          closable: true,
          duration: 2500,
        });
      }
    }

    return {
      success: true,
      insertedElements: renderResult.elements,
      errors: renderResult.errors,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : "Failed to render visual actions to canvas.";
    // eslint-disable-next-line no-console
    console.error("[AI-Canvas] Error applying visual actions:", err);
    if (showToast) {
      excalidrawAPI.setToast({
        message: errorMsg,
        closable: true,
        duration: 4000,
      });
    }
    return {
      success: false,
      insertedElements: [],
      errors: [errorMsg],
    };
  }
}

/**
 * Convenience test function that renders the canonical Binary Search example diagram.
 */
export function renderTestBinarySearchDiagram(
  excalidrawAPI: ExcalidrawImperativeAPI,
): ApplyVisualActionsResult {
  return applyVisualActions(excalidrawAPI, EXAMPLE_BINARY_SEARCH_ACTIONS, {
    focusViewport: true,
    preventDuplicates: true,
    replaceMatchingAI: false,
  });
}

// ============================================================================
// Vertical Multi-Step Whiteboard Lesson Architecture
// ============================================================================

export interface RenderedStepRegion {
  stepId: string;
  stepIndex: number;
  bounds: { x: number; y: number; width: number; height: number };
  elements: ExcalidrawElement[];
}

export interface RenderVerticalLessonOptions {
  /** Whether to replace previous AI lesson elements (default: true) */
  replacePreviousAI?: boolean;
  /** Which step index to focus the camera on initially (default: 0) */
  focusStepIndex?: number;
  /** Whether to animate viewport on initial focus (default: true) */
  animateViewport?: boolean;
  /** Only render up to this step index (inclusive). If omitted, renders all steps */
  renderUpToStepIndex?: number;
}

export interface RenderVerticalLessonResult {
  success: boolean;
  stepRegions: RenderedStepRegion[];
  allElements: ExcalidrawElement[];
  errors: readonly string[];
}

export interface AppendLessonStepResult {
  success: boolean;
  stepRegion: RenderedStepRegion | null;
  newElements: ExcalidrawElement[];
  errors: readonly string[];
}

/**
 * Smoothly moves the Excalidraw camera viewport to the target step's vertical region.
 * Non-destructive: does NOT modify or delete any elements on the canvas.
 */
export function navigateToLessonStep(
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
  stepRegion: RenderedStepRegion,
  options: { animation?: boolean } = {},
): boolean {
  if (!excalidrawAPI || excalidrawAPI.isDestroyed || !stepRegion) {
    return false;
  }

  const activeElements = stepRegion.elements.filter((el) => !el.isDeleted);
  try {
    if (activeElements.length > 0) {
      excalidrawAPI.setViewport({
        target: activeElements,
        fit: "contain",
        animation: options.animation ?? true,
      });
    } else {
      excalidrawAPI.setViewport({
        target: {
          x: stepRegion.bounds.x,
          y: stepRegion.bounds.y,
          width: stepRegion.bounds.width,
          height: stepRegion.bounds.height,
        },
        fit: "contain",
        animation: options.animation ?? true,
      });
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[AI-Canvas] Failed to navigate to lesson step:", err);
    return false;
  }
}

/**
 * Renders all steps of a multi-step lesson vertically on the whiteboard canvas.
 *
 * Guarantees:
 * 1. Vertical page layout: Step 1 at top, Step 2 below it, Step 3 below that.
 * 2. Visual history: Previous steps remain visible on the whiteboard when zooming out.
 * 3. Complete states: Every step receives a complete visual diagram and readable explanation card.
 * 4. Deterministic verification: Calculates exact tree heights, balance factors, array midpoints.
 * 5. Non-destructive: User-drawn elements are 100% preserved.
 */
export function renderVerticalLesson(
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
  steps: TeachingStep[],
  options: RenderVerticalLessonOptions = {},
): RenderVerticalLessonResult {
  const {
    replacePreviousAI = true,
    focusStepIndex = 0,
    animateViewport = true,
  } = options;

  if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
    return {
      success: false,
      stepRegions: [],
      allElements: [],
      errors: ["Excalidraw API is not ready or has been destroyed."],
    };
  }

  if (!steps.length) {
    return {
      success: true,
      stepRegions: [],
      allElements: [],
      errors: [],
    };
  }

  const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();

  // Accumulate full semantic state across steps
  const stateManager = new SemanticStateManager();
  const cumulativeSteps = stateManager.processSteps(steps);

  const stepRegions: RenderedStepRegion[] = [];
  const allRenderedElements: ExcalidrawElement[] = [];
  const allErrors: string[] = [];

  let currentY = STEP_LAYOUT.START_Y;

  const maxStepIdx =
    options.renderUpToStepIndex !== undefined
      ? Math.min(cumulativeSteps.length - 1, options.renderUpToStepIndex)
      : cumulativeSteps.length - 1;

  for (let stepIdx = 0; stepIdx <= maxStepIdx; stepIdx++) {
    const rawStep = steps[stepIdx];
    const stepCumulativeState = cumulativeSteps[stepIdx];

    // Enrich with deterministic calculations (tree heights, balance factors, array midpoints)
    const step = verifyAndEnrichStepCalculations({
      ...rawStep,
      visual_actions: stepCumulativeState.cumulativeActions,
    });

    const actionsToRender: VisualAction[] = [];

    // Step Header Title
    actionsToRender.push({
      type: "create_text",
      id: `step-${stepIdx}-header`,
      text: `STEP ${stepIdx + 1} OF ${
        steps.length
      }: ${step.title.toUpperCase()}`,
      style: { color: "primary", size: "md" },
    });

    actionsToRender.push(...step.visual_actions);

    // Explanation card directly below the diagram
    const hasExplanationBlock = actionsToRender.some(
      (a) => a.type === "create_explanation_block",
    );
    if (!hasExplanationBlock && (step.title || step.explanation)) {
      actionsToRender.push({
        type: "create_explanation_block",
        id: `step-${stepIdx}-card`,
        title: step.title,
        stepNumber: step.step_number ?? stepIdx + 1,
        totalSteps: steps.length,
        explanation: step.explanation,
        calculations: step.calculations,
        insight: step.insight,
      });
    }

    // Step context starting at currentY + header spacing
    const stepContext = new RenderContext({
      startX: STEP_LAYOUT.START_X,
      startY: currentY + 45,
      horizontalGap: 50,
      verticalGap: 50,
    });

    const orderedActions = repairOrReorderActions(actionsToRender);
    const renderResult = renderActions(orderedActions, stepContext);

    if (renderResult.errors.length > 0) {
      allErrors.push(...renderResult.errors);
    }

    // Tag all elements with step metadata and AI ownership
    const stepElements: ExcalidrawElement[] = renderResult.elements.map(
      (el) => ({
        ...el,
        customData: {
          ...el.customData,
          stepId: step.id,
          stepIndex: stepIdx,
          isAiTeaching: true,
        },
      }),
    );

    // Measure step bounding box
    let minX: number = STEP_LAYOUT.START_X;
    let minY: number = currentY;
    let maxX: number = STEP_LAYOUT.START_X + STEP_LAYOUT.MIN_STEP_WIDTH;
    let maxY: number = currentY + 100;

    for (const el of stepElements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    // Add divider line between steps
    if (stepIdx < maxStepIdx) {
      const dividerContext = new RenderContext();
      const dividerElements = renderActions(
        [
          {
            type: "create_divider",
            id: `step-${stepIdx}-divider`,
            x: STEP_LAYOUT.START_X,
            y: maxY + 40,
            width: Math.max(maxX - minX, STEP_LAYOUT.MIN_STEP_WIDTH),
          },
        ],
        dividerContext,
      ).elements.map((el) => ({
        ...el,
        customData: {
          ...el.customData,
          stepId: step.id,
          stepIndex: stepIdx,
          isAiTeaching: true,
        },
      }));

      stepElements.push(...dividerElements);
      maxY += 50;
    }

    const stepRegion: RenderedStepRegion = {
      stepId: step.id,
      stepIndex: stepIdx,
      bounds: {
        x: minX,
        y: minY,
        width: Math.max(maxX - minX, STEP_LAYOUT.MIN_STEP_WIDTH),
        height: Math.max(maxY - minY, 120),
      },
      elements: stepElements,
    };

    stepRegions.push(stepRegion);
    allRenderedElements.push(...stepElements);

    currentY = maxY + STEP_LAYOUT.STEP_GAP;
  }

  // Build complete updated elements list
  const updatedElements: ExcalidrawElement[] = [];

  for (const el of currentElements) {
    const isAi =
      Boolean(el.customData?.dslId) || Boolean(el.customData?.isAiTeaching);

    if (replacePreviousAI && isAi) {
      updatedElements.push({ ...el, isDeleted: true });
    } else {
      updatedElements.push(el);
    }
  }

  updatedElements.push(...allRenderedElements);

  // Single atomic update to Excalidraw scene participated in history with synchronized indices
  const syncedElements = syncInvalidIndices(updatedElements);
  excalidrawAPI.updateScene({
    elements: syncedElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  // Automatically focus camera viewport on the requested step (default: Step 0)
  const targetStep = stepRegions[focusStepIndex] ?? stepRegions[0];
  if (targetStep) {
    navigateToLessonStep(excalidrawAPI, targetStep, {
      animation: animateViewport,
    });
  }

  return {
    success: true,
    stepRegions,
    allElements: allRenderedElements,
    errors: allErrors,
  };
}

/**
 * Progressively appends a single lesson step below existing step regions on the whiteboard.
 * Non-destructive: keeps all previously revealed steps intact.
 */
export function appendLessonStep(
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
  steps: TeachingStep[],
  stepIndexToAppend: number,
  existingStepRegions: RenderedStepRegion[],
  options: { animateViewport?: boolean } = {},
): AppendLessonStepResult {
  if (!excalidrawAPI || excalidrawAPI.isDestroyed || !steps.length) {
    return {
      success: false,
      stepRegion: null,
      newElements: [],
      errors: ["Excalidraw API is not ready or has been destroyed."],
    };
  }

  if (stepIndexToAppend < 0 || stepIndexToAppend >= steps.length) {
    return {
      success: false,
      stepRegion: null,
      newElements: [],
      errors: [
        `Invalid step index ${stepIndexToAppend} for lesson with ${steps.length} steps.`,
      ],
    };
  }

  const lastRegion =
    existingStepRegions.length > 0
      ? existingStepRegions[existingStepRegions.length - 1]
      : null;

  const startY = lastRegion
    ? lastRegion.bounds.y + lastRegion.bounds.height + STEP_LAYOUT.STEP_GAP
    : STEP_LAYOUT.START_Y;

  const stateManager = new SemanticStateManager();
  const cumulativeSteps = stateManager.processSteps(steps);

  const rawStep = steps[stepIndexToAppend];
  const stepCumulativeState = cumulativeSteps[stepIndexToAppend];

  const step = verifyAndEnrichStepCalculations({
    ...rawStep,
    visual_actions: stepCumulativeState.cumulativeActions,
  });

  const actionsToRender: VisualAction[] = [];

  // Step Header Title
  actionsToRender.push({
    type: "create_text",
    id: `step-${stepIndexToAppend}-header`,
    text: `STEP ${stepIndexToAppend + 1} OF ${
      steps.length
    }: ${step.title.toUpperCase()}`,
    style: { color: "primary", size: "md" },
  });

  actionsToRender.push(...step.visual_actions);

  // Explanation card directly below the diagram
  const hasExplanationBlock = actionsToRender.some(
    (a) => a.type === "create_explanation_block",
  );
  if (!hasExplanationBlock && (step.title || step.explanation)) {
    actionsToRender.push({
      type: "create_explanation_block",
      id: `step-${stepIndexToAppend}-card`,
      title: step.title,
      stepNumber: step.step_number ?? stepIndexToAppend + 1,
      totalSteps: steps.length,
      explanation: step.explanation,
      calculations: step.calculations,
      insight: step.insight,
    });
  }

  const stepContext = new RenderContext({
    startX: STEP_LAYOUT.START_X,
    startY: startY + 45,
    horizontalGap: 50,
    verticalGap: 50,
  });

  const orderedActions = repairOrReorderActions(actionsToRender);
  const renderResult = renderActions(orderedActions, stepContext);

  const stepElements: ExcalidrawElement[] = renderResult.elements.map((el) => ({
    ...el,
    customData: {
      ...el.customData,
      stepId: step.id,
      stepIndex: stepIndexToAppend,
      isAiTeaching: true,
    },
  }));

  let minX: number = STEP_LAYOUT.START_X;
  let minY: number = startY;
  let maxX: number = STEP_LAYOUT.START_X + STEP_LAYOUT.MIN_STEP_WIDTH;
  let maxY: number = startY + 100;

  for (const el of stepElements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  const newElementsToAdd: ExcalidrawElement[] = [];

  // Add divider line above this step if there was a preceding step
  if (lastRegion) {
    const dividerContext = new RenderContext();
    const dividerY =
      lastRegion.bounds.y + lastRegion.bounds.height + STEP_LAYOUT.STEP_GAP / 2;
    const dividerElements = renderActions(
      [
        {
          type: "create_divider",
          id: `step-${stepIndexToAppend - 1}-divider`,
          x: STEP_LAYOUT.START_X,
          y: dividerY,
          width: Math.max(maxX - minX, STEP_LAYOUT.MIN_STEP_WIDTH),
        },
      ],
      dividerContext,
    ).elements.map((el) => ({
      ...el,
      customData: {
        ...el.customData,
        stepId: step.id,
        stepIndex: stepIndexToAppend,
        isAiTeaching: true,
      },
    }));

    newElementsToAdd.push(...dividerElements);
  }

  newElementsToAdd.push(...stepElements);

  const stepRegion: RenderedStepRegion = {
    stepId: step.id,
    stepIndex: stepIndexToAppend,
    bounds: {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, STEP_LAYOUT.MIN_STEP_WIDTH),
      height: Math.max(maxY - minY, 120),
    },
    elements: stepElements,
  };

  const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
  excalidrawAPI.updateScene({
    elements: syncInvalidIndices([...currentElements, ...newElementsToAdd]),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  if (options.animateViewport ?? true) {
    navigateToLessonStep(excalidrawAPI, stepRegion, { animation: true });
  }

  return {
    success: true,
    stepRegion,
    newElements: newElementsToAdd,
    errors: renderResult.errors,
  };
}
