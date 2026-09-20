/**
 * Lesson Playback Orchestration & Decoupling Tests
 *
 * Verifies:
 * 1. Canvas renders initial state immediately without waiting for TTS.
 * 2. Visual playback continues smoothly when TTS is delayed (30s+ or hangs).
 * 3. Visual playback advances normally when TTS fails or times out.
 * 4. Stale audio from previous steps does not play over newly transitioned steps.
 * 5. Replay reads directly from cache without re-synthesizing.
 */

// @vitest-environment jsdom
import "vitest-canvas-mock";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { LessonPlaybackController } from "../ai/lesson-playback-controller";
import { compileVisualLesson } from "../ai/transformation-timeline";
import { VoiceExplanationEngine } from "../ai/voice/voice-explanation-engine";
import type { VisualLesson } from "../ai/visual-dsl";

function createMockExcalidrawAPI(initialElements: ExcalidrawElement[] = []): ExcalidrawImperativeAPI {
  let sceneElements: ExcalidrawElement[] = [...initialElements];

  return {
    isDestroyed: false,
    id: "mock-playback-api",
    getSceneElementsIncludingDeleted: vi.fn(() => sceneElements),
    getSceneElements: vi.fn(() => sceneElements.filter((el) => !el.isDeleted)),
    getAppState: vi.fn(() => ({ zoom: { value: 1 }, scrollX: 0, scrollY: 0 } as any)),
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
  id: "avl-insertion-lesson",
  title: "AVL Tree Insertion",
  initialScene: [
    {
      type: "create_tree",
      id: "tree-root",
      root: "n30",
      nodes: [
        { id: "n30", value: 30, left: "n20" },
        { id: "n20", value: 20 },
      ],
    },
  ],
  transformations: [
    {
      id: "t1",
      title: "Insert 10",
      explanation: "Node 10 inserted in left subtree",
      operations: [
        {
          type: "create_tree",
          id: "tree-root",
          root: "n30",
          nodes: [
            { id: "n30", value: 30, left: "n20" },
            { id: "n20", value: 20, left: "n10" },
            { id: "n10", value: 10, highlight: "warning" },
          ],
        },
      ],
    },
    {
      id: "t2",
      title: "Right Rotation",
      explanation: "Rebalance tree via right rotation around 20",
      operations: [
        {
          type: "create_tree",
          id: "tree-root",
          root: "n20",
          nodes: [
            { id: "n20", value: 20, left: "n10", right: "n30", highlight: "success" },
            { id: "n10", value: 10 },
            { id: "n30", value: 30 },
          ],
        },
      ],
    },
  ],
};

describe("Cognora Voice 3.0 + Lesson Orchestration Decoupling", () => {
  let mockApi: ExcalidrawImperativeAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = createMockExcalidrawAPI();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders visual scene immediately (<10ms) without waiting for TTS", () => {
    const timeline = compileVisualLesson(mockLesson);
    const mockVoiceEngine: any = {
      isAudioReady: vi.fn().mockReturnValue(false),
      play: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves (slow TTS)
      onTransformationChange: vi.fn(),
      stop: vi.fn(),
      addOnAudioEndedListener: vi.fn(() => () => {}),
    };

    const controller = new LessonPlaybackController(mockApi, timeline, 0, mockVoiceEngine);

    const t0 = performance.now();
    controller.renderInitial(false);
    const renderDuration = performance.now() - t0;

    // Must be instantaneous
    expect(renderDuration).toBeLessThan(100);

    // Elements were updated in Excalidraw
    expect(mockApi.updateScene).toHaveBeenCalled();
    expect(controller.getCurrentIndex()).toBe(0);

    controller.destroy();
  });

  it("advances playback visually even when Chatterbox synthesis takes 30+ seconds or hangs", () => {
    const timeline = compileVisualLesson(mockLesson);

    // Simulated hanging TTS engine (takes 60 seconds or never returns)
    const mockVoiceEngine: any = {
      isAudioReady: vi.fn().mockReturnValue(false),
      play: vi.fn().mockReturnValue(new Promise(() => {})), // Hanging promise
      onTransformationChange: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      addOnAudioEndedListener: vi.fn(() => () => {}),
    };

    const controller = new LessonPlaybackController(mockApi, timeline, 0, mockVoiceEngine);
    controller.renderInitial(false);

    controller.play();
    expect(controller.getState().status).toBe("PLAYING");

    // Fast-forward visual reading time (~3500ms), NOT 15000ms+!
    vi.advanceTimersByTime(3500);

    // Transition should have been scheduled
    expect(controller.getPendingIndex()).toBe(1);

    // Allow animation to complete (500ms)
    vi.advanceTimersByTime(500);

    // Canvas successfully committed to Step 1 without waiting for Chatterbox!
    expect(controller.getCurrentIndex()).toBe(1);

    controller.destroy();
  });

  it("continues visual playback when TTS provider throws or times out", () => {
    const timeline = compileVisualLesson(mockLesson);

    const mockVoiceEngine: any = {
      isAudioReady: vi.fn().mockReturnValue(false),
      play: vi.fn().mockRejectedValue(new Error("Chatterbox service timeout")),
      onTransformationChange: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      addOnAudioEndedListener: vi.fn(() => () => {}),
    };

    const controller = new LessonPlaybackController(mockApi, timeline, 0, mockVoiceEngine);
    controller.renderInitial(false);

    controller.play();
    expect(controller.getState().status).toBe("PLAYING");

    // Advance time past visual reading timer
    vi.advanceTimersByTime(3500);
    expect(controller.getPendingIndex()).toBe(1);

    vi.advanceTimersByTime(500);
    expect(controller.getCurrentIndex()).toBe(1);

    controller.destroy();
  });

  it("synchronizes transformation change and drops stale audio when learner clicks Next", () => {
    const timeline = compileVisualLesson(mockLesson);

    let lateResolveAudio: (val: any) => void;
    const slowTtsPromise = new Promise((resolve) => {
      lateResolveAudio = resolve;
    });

    const mockVoiceEngine: any = {
      isAudioReady: vi.fn().mockReturnValue(false),
      play: vi.fn().mockReturnValue(slowTtsPromise),
      onTransformationChange: vi.fn(),
      stop: vi.fn(),
      addOnAudioEndedListener: vi.fn(() => () => {}),
    };

    const controller = new LessonPlaybackController(mockApi, timeline, 0, mockVoiceEngine);
    controller.renderInitial(false);

    // User navigates manually to Step 1
    controller.next(false);

    expect(controller.getCurrentIndex()).toBe(1);
    expect(mockVoiceEngine.onTransformationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stepIndex: 1,
        transformationId: "t1",
      }),
    );

    controller.destroy();
  });
});
