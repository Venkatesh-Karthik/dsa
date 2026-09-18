import { describe, it, expect, vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  applyVisualActions,
  renderTestBinarySearchDiagram,
  getExistingDslIds,
  renderVerticalLesson,
  appendLessonStep,
  navigateToLessonStep,
} from "../ai/ai-canvas";

import type { VisualAction, TeachingStep } from "../ai/visual-dsl";

// Mock helper to create minimal mock ExcalidrawImperativeAPI
function createMockExcalidrawAPI(
  initialElements: ExcalidrawElement[] = [],
): ExcalidrawImperativeAPI {
  let sceneElements: ExcalidrawElement[] = [...initialElements];

  return {
    isDestroyed: false,
    id: "test-api",
    getSceneElementsIncludingDeleted: vi.fn(() => sceneElements),
    getSceneElements: vi.fn(() => sceneElements.filter((el) => !el.isDeleted)),
    getAppState: vi.fn(() => ({} as any)),
    getFiles: vi.fn(() => ({})),
    getName: vi.fn(() => "test"),
    updateScene: vi.fn((data: any) => {
      if (data.elements) {
        sceneElements = [...data.elements];
      }
    }),
    setViewport: vi.fn(),
    setToast: vi.fn(),
    resetScene: vi.fn(),
    applyDeltas: vi.fn(),
    mutateElement: vi.fn(),
    updateLibrary: vi.fn(),
    getSceneElementsMapIncludingDeleted: vi.fn(),
    history: { clear: vi.fn() },
    getViewportOffsets: vi.fn(),
    registerAction: vi.fn(),
    refresh: vi.fn(),
    addFiles: vi.fn(),
    setActiveTool: vi.fn(),
    setCursor: vi.fn(),
    resetCursor: vi.fn(),
    toggleSidebar: vi.fn(),
    getEditorInterface: vi.fn(),
    updateFrameRendering: vi.fn(),
    onChange: vi.fn(),
    onIncrement: vi.fn(),
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onScrollChange: vi.fn(),
    onUserFollow: vi.fn(),
    onStateChange: vi.fn(),
    onEvent: vi.fn(),
  } as unknown as ExcalidrawImperativeAPI;
}

describe("AI Canvas Integration Layer", () => {
  it("preserves user content and appends newly generated elements", () => {
    // Existing user drawing
    const existingUserBox = {
      id: "user-rect-1",
      type: "rectangle",
      x: 500,
      y: 500,
      width: 100,
      height: 100,
      isDeleted: false,
    } as ExcalidrawElement;

    const mockAPI = createMockExcalidrawAPI([existingUserBox]);

    const result = renderTestBinarySearchDiagram(mockAPI);

    expect(result.success).toBe(true);
    expect(result.insertedElements.length).toBe(5); // 2 boxes (2 box + 2 text) + 1 arrow

    // Verify updateScene was called
    expect(mockAPI.updateScene).toHaveBeenCalledTimes(1);
    const updateCallArg = (mockAPI.updateScene as any).mock.calls[0][0];

    // Total elements must include user box + new elements
    expect(updateCallArg.elements.length).toBe(6);
    expect(updateCallArg.elements[0].id).toBe("user-rect-1"); // User drawing preserved!

    // Verify CaptureUpdateAction.IMMEDIATELY was used for undo/redo
    expect(updateCallArg.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
  });

  it("prevents inserting duplicate elements when clicked twice with preventDuplicates: true", () => {
    const mockAPI = createMockExcalidrawAPI();

    // First run
    const result1 = renderTestBinarySearchDiagram(mockAPI);
    expect(result1.success).toBe(true);
    expect(mockAPI.updateScene).toHaveBeenCalledTimes(1);

    // Second run without clearing
    const result2 = renderTestBinarySearchDiagram(mockAPI);
    expect(result2.success).toBe(false);
    expect(result2.skippedDueToDuplicates).toBe(true);

    // updateScene should not have been called a second time
    expect(mockAPI.updateScene).toHaveBeenCalledTimes(1);

    // Warning toast shown
    expect(mockAPI.setToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("already exist"),
      }),
    );
  });

  it("replaces matching AI elements in place when replaceMatchingAI is true", () => {
    const userElement = {
      id: "user-note",
      type: "text",
      text: "User note",
      isDeleted: false,
    } as unknown as ExcalidrawElement;

    const mockAPI = createMockExcalidrawAPI([userElement]);

    const initialActions: VisualAction[] = [
      {
        type: "create_box",
        id: "target-box",
        label: "Initial Version",
      },
    ];

    applyVisualActions(mockAPI, initialActions, { replaceMatchingAI: true });
    expect(getExistingDslIds(mockAPI)).toContain("target-box");

    // Second run with modified label on same semantic ID
    const updateActions: VisualAction[] = [
      {
        type: "create_box",
        id: "target-box",
        label: "Updated Version",
      },
    ];

    const updateResult = applyVisualActions(mockAPI, updateActions, {
      replaceMatchingAI: true,
    });
    expect(updateResult.success).toBe(true);

    // The user's element is intact and not marked deleted
    const activeElements = mockAPI.getSceneElements();
    expect(activeElements.some((e) => e.id === "user-note")).toBe(true);

    // Only one active target-box exists
    const activeAiBoxes = activeElements.filter(
      (e) => e.customData?.dslId === "target-box",
    );
    expect(activeAiBoxes.length).toBe(1);
  });

  it("executes delete action on targeted AI elements while preserving user elements", () => {
    const userElement = {
      id: "user-drawing-1",
      type: "rectangle",
      isDeleted: false,
    } as unknown as ExcalidrawElement;

    const mockAPI = createMockExcalidrawAPI([userElement]);

    // Create an AI box
    applyVisualActions(
      mockAPI,
      [{ type: "create_box", id: "ai-box-to-delete", label: "Delete Me" }],
      { replaceMatchingAI: true },
    );

    expect(getExistingDslIds(mockAPI)).toContain("ai-box-to-delete");

    // Send delete action for the AI box
    const deleteResult = applyVisualActions(mockAPI, [
      { type: "delete", target: "ai-box-to-delete" },
    ]);
    expect(deleteResult.success).toBe(true);

    // Verify AI box is now deleted from active scene, while user drawing remains active
    const activeElements = mockAPI.getSceneElements();
    expect(activeElements.some((e) => e.id === "user-drawing-1")).toBe(true);
    expect(
      activeElements.some((e) => e.customData?.dslId === "ai-box-to-delete"),
    ).toBe(false);
  });

  it("anchors follow-up highlight action to elements already present on the canvas", () => {
    const mockAPI = createMockExcalidrawAPI();

    // Turn 1: create array elements
    applyVisualActions(mockAPI, [
      { type: "create_box", id: "arr-mid", label: "30" },
    ]);

    // Turn 2: highlight the existing element
    const highlightResult = applyVisualActions(mockAPI, [
      {
        type: "highlight",
        target: "arr-mid",
        color: "warning",
        message: "Midpoint Checked",
      },
    ]);

    expect(highlightResult.success).toBe(true);
    expect(highlightResult.insertedElements.length).toBeGreaterThan(0);
    expect(
      highlightResult.insertedElements.some(
        (e) => e.customData?.dslId === "highlight-arr-mid",
      ),
    ).toBe(true);
  });

  it("animates the viewport to focus on the newly generated elements", () => {
    const mockAPI = createMockExcalidrawAPI();

    const result = renderTestBinarySearchDiagram(mockAPI);
    expect(result.success).toBe(true);

    expect(mockAPI.setViewport).toHaveBeenCalledTimes(1);
    expect(mockAPI.setViewport).toHaveBeenCalledWith({
      target: result.insertedElements,
      fit: "scale-down",
      animation: true,
    });
  });

  it("handles destroyed or unavailable Excalidraw API gracefully", () => {
    const result = applyVisualActions(null, []);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("not ready or has been destroyed");
  });

  describe("renderVerticalLesson", () => {
    it("renders multiple lesson steps vertically with dividers and non-destructive preservation", () => {
      const userBox = {
        id: "user-sketch",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        isDeleted: false,
      } as ExcalidrawElement;

      const mockAPI = createMockExcalidrawAPI([userBox]);

      const steps: TeachingStep[] = [
        {
          id: "step-1",
          title: "Initial Array",
          explanation: "Search starts with boundaries 0 and 6.",
          visual_actions: [
            {
              type: "create_array",
              id: "arr-1",
              elements: [{ value: 10 }, { value: 20 }, { value: 30 }],
            },
          ],
        },
        {
          id: "step-2",
          title: "Narrow Window",
          explanation: "Target is larger than mid; eliminate left.",
          visual_actions: [
            {
              type: "highlight",
              target: "arr-1-0",
              color: "neutral",
            },
          ],
        },
      ];

      const result = renderVerticalLesson(mockAPI, steps, {
        focusStepIndex: 0,
        replacePreviousAI: false,
      });

      expect(result.success).toBe(true);
      expect(result.stepRegions).toHaveLength(2);

      // Step 2 must be positioned vertically below Step 1
      const region1 = result.stepRegions[0];
      const region2 = result.stepRegions[1];
      expect(region2.bounds.y).toBeGreaterThan(
        region1.bounds.y + region1.bounds.height,
      );

      // Verify divider was generated between step 1 and step 2
      const sceneElements = mockAPI.getSceneElements();
      const hasDivider = sceneElements.some(
        (el) => el.customData?.semanticType === "divider",
      );
      expect(hasDivider).toBe(true);

      // Verify user sketch is preserved and active
      expect(sceneElements.some((el) => el.id === "user-sketch")).toBe(true);

      // Verify step continuity: Step 2 carried forward the array structure
      const step2Elements = sceneElements.filter(
        (el) => el.customData?.stepIndex === 1,
      );
      expect(
        step2Elements.some(
          (el) => el.customData?.semanticType === "array_element",
        ),
      ).toBe(true);

      // Viewport should have navigated to Step 0
      expect(mockAPI.setViewport).toHaveBeenCalled();
    });
  });

  describe("navigateToLessonStep", () => {
    it("moves camera viewport to step elements without deleting canvas elements", () => {
      const mockAPI = createMockExcalidrawAPI();

      const steps: TeachingStep[] = [
        {
          id: "step-1",
          title: "Step 1",
          explanation: "First step",
          visual_actions: [
            {
              type: "create_box",
              id: "box-1",
              label: "Box 1",
            },
          ],
        },
        {
          id: "step-2",
          title: "Step 2",
          explanation: "Second step",
          visual_actions: [
            {
              type: "create_box",
              id: "box-2",
              label: "Box 2",
            },
          ],
        },
      ];

      const renderResult = renderVerticalLesson(mockAPI, steps);
      const totalElementsBeforeNav = mockAPI.getSceneElements().length;

      // Navigate to Step 2
      const navSuccess = navigateToLessonStep(
        mockAPI,
        renderResult.stepRegions[1],
        { animation: true },
      );

      expect(navSuccess).toBe(true);
      expect(mockAPI.setViewport).toHaveBeenCalled();

      // Zero elements should have been deleted! Visual history is 100% preserved
      const totalElementsAfterNav = mockAPI.getSceneElements().length;
      expect(totalElementsAfterNav).toBe(totalElementsBeforeNav);
    });
  });

  describe("Progressive Step Reveal (appendLessonStep)", () => {
    it("renders only Step 0 initially with renderUpToStepIndex: 0 and appends Step 1 below it", () => {
      const mockAPI = createMockExcalidrawAPI();

      const steps: TeachingStep[] = [
        {
          id: "step-1",
          title: "Initial State",
          explanation: "Step 1 initial state only.",
          visual_actions: [
            {
              type: "create_tree",
              id: "tree-1",
              root: "10",
              nodes: [{ id: "10", value: 10 }],
            },
          ],
        },
        {
          id: "step-2",
          title: "Add Left Child",
          explanation: "Step 2 adds left node.",
          visual_actions: [
            {
              type: "create_tree",
              id: "tree-1",
              root: "10",
              nodes: [
                { id: "10", value: 10, left: "5" },
                { id: "5", value: 5 },
              ],
            },
          ],
        },
      ];

      // Initially render Step 0 only
      const initialResult = renderVerticalLesson(mockAPI, steps, {
        renderUpToStepIndex: 0,
        focusStepIndex: 0,
      });

      expect(initialResult.success).toBe(true);
      expect(initialResult.stepRegions).toHaveLength(1);
      expect(initialResult.stepRegions[0].stepIndex).toBe(0);

      const step0ElementsCount = mockAPI.getSceneElements().length;
      expect(step0ElementsCount).toBeGreaterThan(0);

      // Now progressively append Step 1
      const appendResult = appendLessonStep(
        mockAPI,
        steps,
        1,
        initialResult.stepRegions,
      );

      expect(appendResult.success).toBe(true);
      expect(appendResult.stepRegion).not.toBeNull();
      expect(appendResult.stepRegion?.stepIndex).toBe(1);

      // Step 1 bounds must be below Step 0 bounds
      const step0Region = initialResult.stepRegions[0];
      const step1Region = appendResult.stepRegion!;
      expect(step1Region.bounds.y).toBeGreaterThan(
        step0Region.bounds.y + step0Region.bounds.height,
      );

      // Total elements should include Step 0 AND Step 1 elements plus divider
      const totalElementsAfterAppend = mockAPI.getSceneElements().length;
      expect(totalElementsAfterAppend).toBeGreaterThan(step0ElementsCount);

      // Ensure Step 0 elements are still active and untouched
      const activeElements = mockAPI.getSceneElements();
      const hasStep0 = activeElements.some(
        (el) => el.customData?.stepIndex === 0,
      );
      const hasStep1 = activeElements.some(
        (el) => el.customData?.stepIndex === 1,
      );
      expect(hasStep0).toBe(true);
      expect(hasStep1).toBe(true);
    });
  });
});
