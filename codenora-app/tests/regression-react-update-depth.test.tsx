import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AITeachingAgent } from "../components/AITeachingAgent";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { getDijkstraVisualLesson } from "../ai/backend/mock-lessons";

describe("Regression: React Maximum Update Depth Exceeded", () => {
  it("mounts AITeachingAgent and runs Dijkstra lesson without infinite re-render loops", async () => {
    let sceneElements: any[] = [];
    const changeListeners: Array<
      (elements: readonly any[], appState: any) => void
    > = [];

    const mockApi: any = {
      isDestroyed: false,
      getSceneElements: () => sceneElements,
      getSceneElementsIncludingDeleted: () => sceneElements,
      getAppState: () => ({
        zoom: { value: 1 },
        scrollX: 0,
        scrollY: 0,
        selectedElementIds: {},
        activeTool: { type: "selection" },
      }),
      updateScene: (opts: any) => {
        if (opts.elements) {
          sceneElements = opts.elements;
        }
        for (const cb of changeListeners) {
          cb(sceneElements, {
            zoom: { value: 1 },
            scrollX: 0,
            scrollY: 0,
            selectedElementIds: {},
            activeTool: { type: "selection" },
          });
        }
      },
      scrollToContent: vi.fn(),
      setViewport: vi.fn(),
      setActiveTool: vi.fn(),
      onChange: (cb: any) => {
        changeListeners.push(cb);
        return () => {
          const idx = changeListeners.indexOf(cb);
          if (idx >= 0) {
            changeListeners.splice(idx, 1);
          }
        };
      },
    };

    // 1. Mount AITeachingAgent
    const { container } = render(
      React.createElement(AITeachingAgent, { excalidrawAPI: mockApi }),
    );
    expect(container).toBeDefined();

    // Verify error boundary did NOT catch an unhandled loop
    expect(screen.queryByText(/CognoraAITeachingAgent Recovered/i)).toBeNull();

    // 2. Start Dijkstra lesson via sample lesson trigger
    act(() => {
      if ((window as any).__cognoraStartSampleLesson) {
        (window as any).__cognoraStartSampleLesson("dijkstra");
      }
    });

    // Verify lesson timeline loaded without crashing
    expect(screen.queryByText(/CognoraAITeachingAgent Recovered/i)).toBeNull();

    // 3. Simulate high-frequency canvas onChange events (e.g. user cursor moving or canvas idle pulses)
    act(() => {
      for (let i = 0; i < 20; i++) {
        for (const cb of changeListeners) {
          cb(sceneElements, {
            zoom: { value: 1 },
            scrollX: 0,
            scrollY: 0,
            selectedElementIds: {},
            activeTool: { type: "selection" },
          });
        }
      }
    });

    expect(screen.queryByText(/CognoraAITeachingAgent Recovered/i)).toBeNull();

    // 4. Simulate node selection and deselection cycles
    act(() => {
      for (const cb of changeListeners) {
        cb(sceneElements, {
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
          selectedElementIds: { "dijkstra-graph-A": true },
          activeTool: { type: "selection" },
        });
      }
    });

    act(() => {
      for (const cb of changeListeners) {
        cb(sceneElements, {
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
          selectedElementIds: { "dijkstra-graph-B": true },
          activeTool: { type: "selection" },
        });
      }
    });

    act(() => {
      for (const cb of changeListeners) {
        cb(sceneElements, {
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
          selectedElementIds: {},
          activeTool: { type: "selection" },
        });
      }
    });

    expect(screen.queryByText(/CognoraAITeachingAgent Recovered/i)).toBeNull();

    // 5. Process real Dijkstra question with 6 nodes and weighted edges
    const dijkstraPrompt =
      "Explain how Dijkstra's shortest-path algorithm works. Use the graph with nodes A, B, C, D, E, and F and weighted edges: A-B=4, A-C=2, B-C=1, B-D=5, C-D=8, C-E=10, D-E=2, D-F=6, and E-F=3";
    const processed =
      UniversalConceptIntelligenceEngine.processQuestion(dijkstraPrompt);

    expect(processed.timeline.states.length).toBeGreaterThanOrEqual(2);

    act(() => {
      if ((window as any).__cognoraStartLessonDirectly) {
        (window as any).__cognoraStartLessonDirectly(processed.visualLesson);
      }
    });

    // Verify processed lesson runs without update depth errors
    expect(screen.queryByText(/CognoraAITeachingAgent Recovered/i)).toBeNull();

    // 6. Step forward through the transformations (Next step button)
    const nextBtn = container.querySelector(
      'button[aria-label="Next step"], .cognora-timeline-btn--next',
    );
    if (nextBtn) {
      for (let s = 0; s < 4; s++) {
        act(() => {
          (nextBtn as HTMLButtonElement).click();
        });
        expect(
          screen.queryByText(/CognoraAITeachingAgent Recovered/i),
        ).toBeNull();
      }
    }
  });
});
