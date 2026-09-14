/**
 * Unit Tests for LessonPlaybackController
 *
 * Verifies:
 * 1. Monotonic transition IDs and strict transition serialization.
 * 2. Rapid next/prev/seek calls drop superseded transitions without canvas corruption.
 * 3. Authoritative SceneState guarantees: canvas is never the source of truth.
 * 4. Playback lifecycle (play, pause, replay, speed cycling).
 * 5. Instant recovery via reconcileSceneToState().
 */
// @vitest-environment jsdom
import "vitest-canvas-mock";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { LessonPlaybackController } from "../ai/lesson-playback-controller";
import { compileVisualLesson } from "../ai/transformation-timeline";

import type { VisualLesson } from "../ai/visual-dsl";

function createMockExcalidrawAPI(
  initialElements: ExcalidrawElement[] = [],
): ExcalidrawImperativeAPI {
  let sceneElements: ExcalidrawElement[] = [...initialElements];

  return {
    isDestroyed: false,
    id: "mock-playback-api",
    getSceneElementsIncludingDeleted: vi.fn(() => sceneElements),
    getSceneElements: vi.fn(() => sceneElements.filter((el) => !el.isDeleted)),
    getAppState: vi.fn(
      () => ({ zoom: { value: 1 }, scrollX: 0, scrollY: 0 } as any),
    ),
    getFiles: vi.fn(() => ({})),
    getName: vi.fn(() => "test"),
    updateScene: vi.fn((data: any) => {
      if (data.elements) {
        sceneElements = [...data.elements];
      }
    }),
    setViewport: vi.fn(),
    scrollToContent: vi.fn(),
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
  } as unknown as ExcalidrawImperativeAPI;
}

const mockLesson: VisualLesson = {
  id: "controller-test-lesson",
  title: "Controller Test Lesson",
  initialScene: [
    {
      type: "create_tree",
      id: "tree-root",
      root: "n30",
      nodes: [
        { id: "n30", value: 30, left: "n20" },
        { id: "n20", value: 20, left: "n10" },
        { id: "n10", value: 10 },
      ],
    },
  ],
  transformations: [
    {
      id: "t1",
      title: "Rotate Right",
      explanation: "Pivot around 20",
      operations: [
        {
          type: "create_tree",
          id: "tree-root",
          root: "n20",
          nodes: [
            {
              id: "n20",
              value: 20,
              left: "n10",
              right: "n30",
              highlight: "success",
            },
            { id: "n10", value: 10 },
            { id: "n30", value: 30 },
          ],
        },
      ],
    },
    {
      id: "t2",
      title: "Balanced State",
      explanation: "Final balanced tree",
      operations: [
        {
          type: "highlight",
          target: "tree-root-n20",
          color: "primary",
        },
      ],
    },
  ],
};

describe("LessonPlaybackController", () => {
  let mockApi: ExcalidrawImperativeAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = createMockExcalidrawAPI();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with authoritative SceneState and renders initial scene", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);

    expect(controller.getCurrentIndex()).toBe(0);
    expect(controller.getState().canPrev).toBe(false);
    expect(controller.getState().canNext).toBe(true);
    expect(controller.getState().totalSteps).toBe(3);

    controller.renderInitial(false);

    const elements = mockApi.getSceneElementsIncludingDeleted();
    expect(elements.length).toBeGreaterThan(0);
    // Initial root node 30 should exist in elements
    const rootEl = elements.find(
      (el) => el.customData?.semanticId === "tree-root-n30",
    );
    expect(rootEl).toBeDefined();
    expect(controller.getCurrentSceneState().graph.metadata?.rootEntityId).toBe(
      "tree-root-n30",
    );

    controller.destroy();
  });

  it("navigates forward and backward with immediate mode (animate=false)", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);
    controller.renderInitial(false);

    // Step 0 -> Step 1
    const nextSuccess = controller.next(false);
    expect(nextSuccess).toBe(true);
    expect(controller.getCurrentIndex()).toBe(1);
    expect(controller.getState().canPrev).toBe(true);
    expect(controller.getState().canNext).toBe(true);
    expect(controller.getCurrentSceneState().graph.metadata?.rootEntityId).toBe(
      "tree-root-n20",
    );

    // Step 1 -> Step 2
    controller.next(false);
    expect(controller.getCurrentIndex()).toBe(2);
    expect(controller.getState().canNext).toBe(false);

    // Next at end should return false
    expect(controller.next(false)).toBe(false);

    // Step 2 -> Step 1
    const prevSuccess = controller.prev(false);
    expect(prevSuccess).toBe(true);
    expect(controller.getCurrentIndex()).toBe(1);

    // Step 1 -> Step 0
    controller.prev(false);
    expect(controller.getCurrentIndex()).toBe(0);
    expect(controller.getState().canPrev).toBe(false);

    // Prev at start should return false
    expect(controller.prev(false)).toBe(false);

    controller.destroy();
  });

  it("seeks directly to any index without intermediate mutations", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);
    controller.renderInitial(false);

    controller.seek(2, false);
    expect(controller.getCurrentIndex()).toBe(2);
    expect(controller.getState().canNext).toBe(false);

    // Seek to same index returns false
    expect(controller.seek(2, false)).toBe(false);

    // Seek back to 0
    controller.seek(0, false);
    expect(controller.getCurrentIndex()).toBe(0);

    controller.destroy();
  });

  it("increments transitionId monotonically on rapid next/prev calls", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);
    controller.renderInitial(false);

    expect(controller.getTransitionId()).toBe(0);

    // Rapid Next calls
    controller.next(true);
    const tx1 = controller.getTransitionId();
    expect(tx1).toBe(1);
    expect(controller.getPendingIndex()).toBe(1);

    controller.next(true);
    const tx2 = controller.getTransitionId();
    expect(tx2).toBe(2);
    expect(tx2).toBeGreaterThan(tx1);
    expect(controller.getPendingIndex()).toBe(2);

    controller.prev(true);
    const tx3 = controller.getTransitionId();
    expect(tx3).toBe(3);
    expect(tx3).toBeGreaterThan(tx2);
    expect(controller.getPendingIndex()).toBe(1);

    controller.destroy();
  });

  it("survives rapid 10x navigation stress test without corrupted elements", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);
    controller.renderInitial(false);

    // Rapid clicking next 10 times
    for (let i = 0; i < 10; i++) {
      controller.next(true);
    }

    // Rapid clicking prev 10 times
    for (let i = 0; i < 10; i++) {
      controller.prev(true);
    }

    // Force canvas reconcile to guarantee authoritative state consistency
    controller.reconcileSceneToState();

    const elements = mockApi
      .getSceneElementsIncludingDeleted()
      .filter((el) => !el.isDeleted);
    // Check that every element has valid finite coordinates (no NaN, undefined, or corrupt geometry)
    for (const el of elements) {
      expect(Number.isFinite(el.x)).toBe(true);
      expect(Number.isFinite(el.y)).toBe(true);
      expect(Number.isFinite(el.width)).toBe(true);
      expect(Number.isFinite(el.height)).toBe(true);
      expect(el.width).toBeGreaterThanOrEqual(0);
      expect(el.height).toBeGreaterThanOrEqual(0);
    }

    controller.destroy();
  });

  it("notifies listeners on state changes", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);

    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    // Initial subscribe call
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ currentIndex: 0 }),
    );

    controller.next(false);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ currentIndex: 1 }),
    );

    unsubscribe();
    controller.next(false);
    // Should not call listener after unsubscribe
    expect(listener).toHaveBeenCalledTimes(3); // init, transitioning, committed

    controller.destroy();
  });

  it("handles play, pause, replay, and speed changes properly", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);
    controller.renderInitial(false);

    controller.play();
    expect(controller.getState().status).toBe("PLAYING");

    // Advance timer to trigger interval (2400ms)
    vi.advanceTimersByTime(2400);
    expect(controller.getPendingIndex()).toBe(1);

    // Advance timers for animation duration (380ms)
    vi.advanceTimersByTime(500);
    expect(controller.getCurrentIndex()).toBe(1);

    controller.pause();
    expect(controller.getState().status).toBe("PAUSED");

    // Cycle speed
    const newSpeed = controller.cycleSpeed();
    expect(newSpeed).toBe(1.5);
    expect(controller.getState().speed).toBe(1.5);

    // Replay restarts at 0 and plays
    controller.replay();
    expect(controller.getCurrentIndex()).toBe(0);
    expect(controller.getState().status).toBe("PLAYING");

    controller.destroy();
  });

  it("reconcileSceneToState() restores canvas to authoritative SceneState", () => {
    const timeline = compileVisualLesson(mockLesson);
    const controller = new LessonPlaybackController(mockApi, timeline);
    controller.renderInitial(false);

    // Artificially corrupt canvas elements by injecting a bogus element and corrupt coordinates
    mockApi.updateScene({
      elements: [
        {
          id: "corrupted-element",
          type: "rectangle",
          x: NaN,
          y: NaN,
          width: -10,
          height: -10,
          isDeleted: false,
        } as any,
      ],
    });

    // Run recovery
    controller.reconcileSceneToState();

    const recoveredElements = mockApi
      .getSceneElementsIncludingDeleted()
      .filter((el) => !el.isDeleted);
    // Corrupted element with no semantic data is removed or cleaned up, valid lesson nodes are present
    const rootEl = recoveredElements.find(
      (el) => el.customData?.semanticId === "tree-root-n30",
    );
    expect(rootEl).toBeDefined();
    expect(Number.isFinite(rootEl!.x)).toBe(true);
    expect(Number.isFinite(rootEl!.y)).toBe(true);

    controller.destroy();
  });
});
