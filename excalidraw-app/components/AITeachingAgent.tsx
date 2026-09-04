/**
 * AI Teaching Agent Component
 *
 * Interactive teaching assistant panel inside Excalidraw that explains
 * computer science concepts and illustrates them directly on the canvas.
 *
 * Architecture:
 *   User Prompt -> Frontend AI Service -> Backend (/api/ai/teach) -> Visual DSL -> ai-canvas.ts -> Canvas
 */

import React, { useState, useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  applyVisualActions,
  getExistingDslIds,
  focusOnElements,
  renderVerticalLesson,
  appendLessonStep,
  navigateToLessonStep,
  type RenderedStepRegion,
} from "../ai/ai-canvas";
import {
  requestTeachingExplanation,
  getMockTeachingResponse,
} from "../ai/ai-service";
import {
  extractSemanticCanvasState,
  createSemanticSnapshot,
  detectSemanticCanvasChanges,
  type CanvasInteractionDelta,
  type SemanticElementSnapshot,
} from "../ai/semantic-canvas";
import { createLatencyTracker } from "../ai/latency-tracker";
import {
  extractSelectedElementsContext,
  formatSelectedElementChip,
} from "../ai/selection-context";

import "./AITeachingAgent.scss";

import type { VisualAction, TeachingStep } from "../ai/visual-dsl";
import type {
  TeachingRequestContext,
  SelectedSemanticElement,
} from "../ai/teaching-contract";

export { getMockTeachingResponse };

export interface AITeachingAgentProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export interface ActiveLesson {
  messageId: string;
  topic?: string;
  steps: TeachingStep[];
  currentStepIndex: number;
  revealedStepIndex?: number;
  stepRegions?: RenderedStepRegion[];
}

const LESSON_PLAYBACK_INTERVAL_MS = 2200;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hasVisuals?: boolean;
  visualStatus?: "idle" | "drawing" | "success" | "failed";
  visualActions?: VisualAction[];
  visualError?: string;
  topic?: string;
  explanationSteps?: string[];
  steps?: TeachingStep[];
}

// ============================================================================
// UI Component
// ============================================================================

export const AITeachingAgent: React.FC<AITeachingAgentProps> = ({
  excalidrawAPI,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content:
        "Hello! I am your Cognora visual learning tutor. Ask me about any concept or idea (e.g. binary search, arrays, stack, trees, AVL rotations, system design), and I will explain it step-by-step with visual diagrams drawn directly on the canvas.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active multi-step lesson state
  const [activeLesson, setActiveLesson] = useState<ActiveLesson | null>(null);
  const [isLessonPlaying, setIsLessonPlaying] = useState(false);

  // Detected user canvas interactions (e.g., node value changed from 20 to 9)
  const [pendingInteraction, setPendingInteraction] =
    useState<CanvasInteractionDelta | null>(null);

  // Active user selection context on canvas
  const [selectedContext, setSelectedContext] = useState<
    SelectedSemanticElement[]
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousSnapshotRef = useRef<Map<string, SemanticElementSnapshot>>(
    new Map(),
  );
  const isApplyingVisualsRef = useRef<boolean>(false);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll message list
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, []);

  // Snapshot initialization, selection tracking, and canvas change tracking
  useEffect(() => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }

    try {
      const initialElements = excalidrawAPI.getSceneElements();
      previousSnapshotRef.current = createSemanticSnapshot(initialElements);
    } catch {
      // Ignored if API not ready yet
    }

    const unsubscribe = excalidrawAPI.onChange((elements, appState) => {
      // Track selected elements context
      if (elements && elements.length > 0 && appState?.selectedElementIds) {
        const extracted = extractSelectedElementsContext(
          elements,
          appState.selectedElementIds,
        );
        setSelectedContext(extracted);
      } else {
        setSelectedContext([]);
      }

      if (isApplyingVisualsRef.current) {
        previousSnapshotRef.current = createSemanticSnapshot(elements);
        return;
      }

      if (elements && elements.length > 0) {
        const deltas = detectSemanticCanvasChanges(
          elements,
          previousSnapshotRef.current,
        );
        if (deltas.length > 0) {
          setPendingInteraction(deltas[0]);
        }
        previousSnapshotRef.current = createSemanticSnapshot(elements);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [excalidrawAPI]);

  /**
   * Starts a vertical multi-step whiteboard lesson.
   * Progressively reveals Step 0 on the whiteboard and positions the camera at Step 0.
   */
  const startVerticalLesson = (
    steps: TeachingStep[],
    options: {
      messageId: string;
      topic?: string;
      initialStepIndex?: number;
    },
  ) => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed || !steps.length) {
      return;
    }

    isApplyingVisualsRef.current = true;
    try {
      const targetStepIndex = options.initialStepIndex ?? 0;
      // Progressive reveal: initially render Step 0 on the whiteboard
      const result = renderVerticalLesson(excalidrawAPI, steps, {
        renderUpToStepIndex: targetStepIndex,
        focusStepIndex: targetStepIndex,
        replacePreviousAI: true,
        animateViewport: true,
      });

      const lesson: ActiveLesson = {
        messageId: options.messageId,
        topic: options.topic,
        steps,
        currentStepIndex: targetStepIndex,
        revealedStepIndex: targetStepIndex,
        stepRegions: result.stepRegions,
      };

      setActiveLesson(lesson);
      setIsLessonPlaying(false);

      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0]);
      } else {
        setError(null);
      }
    } catch (err: unknown) {
      const errText =
        err instanceof Error ? err.message : "Failed to render vertical lesson";
      setError(errText);
    } finally {
      if (excalidrawAPI && !excalidrawAPI.isDestroyed) {
        previousSnapshotRef.current = createSemanticSnapshot(
          excalidrawAPI.getSceneElements(),
        );
      }
      setTimeout(() => {
        isApplyingVisualsRef.current = false;
      }, 100);
    }
  };

  /**
   * Helper that navigates to a step and progressively appends any unrevealed steps
   */
  const performStepNavigation = (
    lesson: ActiveLesson,
    stepIdx: number,
  ): ActiveLesson => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return lesson;
    }
    if (stepIdx < 0 || stepIdx >= lesson.steps.length) {
      return lesson;
    }

    const revealedIndex =
      lesson.revealedStepIndex ??
      (lesson.stepRegions?.length ? lesson.stepRegions.length - 1 : 0);

    // If target step is beyond what is currently revealed, progressively append all steps up to stepIdx
    if (stepIdx > revealedIndex) {
      const currentRegions = [...(lesson.stepRegions || [])];
      for (let i = revealedIndex + 1; i <= stepIdx; i++) {
        const appendResult = appendLessonStep(
          excalidrawAPI,
          lesson.steps,
          i,
          currentRegions,
          { animateViewport: i === stepIdx },
        );
        if (appendResult.success && appendResult.stepRegion) {
          currentRegions.push(appendResult.stepRegion);
        }
      }

      return {
        ...lesson,
        currentStepIndex: stepIdx,
        revealedStepIndex: stepIdx,
        stepRegions: currentRegions,
      };
    }

    // Otherwise, target step is already revealed on the canvas: smoothly pan camera
    const targetRegion = lesson.stepRegions?.[stepIdx];
    if (targetRegion) {
      navigateToLessonStep(excalidrawAPI, targetRegion, {
        animation: true,
      });
    } else {
      const sceneElements = excalidrawAPI.getSceneElements();
      const stepElements = sceneElements.filter(
        (el) => !el.isDeleted && el.customData?.stepIndex === stepIdx,
      );
      if (stepElements.length > 0) {
        focusOnElements(excalidrawAPI, stepElements);
      }
    }

    return {
      ...lesson,
      currentStepIndex: stepIdx,
    };
  };

  /**
   * Navigates smoothly to a step in the active vertical whiteboard lesson.
   * Preserves all visual history on the canvas: does NOT erase or overwrite elements.
   */
  const goToLessonStep = (lesson: ActiveLesson, stepIdx: number) => {
    const updated = performStepNavigation(lesson, stepIdx);
    setActiveLesson(updated);
  };

  const stopLessonPlayback = () => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsLessonPlaying(false);
  };

  const playLesson = (lesson: ActiveLesson) => {
    if (!lesson.steps.length) {
      return;
    }

    if (lesson.currentStepIndex >= lesson.steps.length - 1) {
      goToLessonStep(lesson, 0);
    }

    stopLessonPlayback();
    setIsLessonPlaying(true);

    playbackTimerRef.current = setInterval(() => {
      setActiveLesson((currentLesson) => {
        if (!currentLesson) {
          stopLessonPlayback();
          return currentLesson;
        }

        const nextStepIndex = currentLesson.currentStepIndex + 1;
        if (nextStepIndex >= currentLesson.steps.length) {
          stopLessonPlayback();
          return currentLesson;
        }

        const updated = performStepNavigation(currentLesson, nextStepIndex);

        if (nextStepIndex >= currentLesson.steps.length - 1) {
          stopLessonPlayback();
        }

        return updated;
      });
    }, LESSON_PLAYBACK_INTERVAL_MS);
  };

  const replayLesson = (lesson: ActiveLesson) => {
    stopLessonPlayback();
    goToLessonStep(lesson, 0);
  };

  const handlePreviousStep = (lesson: ActiveLesson) => {
    stopLessonPlayback();
    goToLessonStep(lesson, lesson.currentStepIndex - 1);
  };

  const handleNextStep = (lesson: ActiveLesson) => {
    stopLessonPlayback();
    goToLessonStep(lesson, lesson.currentStepIndex + 1);
  };

  const handleJumpToStep = (lesson: ActiveLesson, stepIdx: number) => {
    stopLessonPlayback();
    goToLessonStep(lesson, stepIdx);
  };

  const handleFocusVisuals = (msg: ChatMessage) => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }
    const sceneElements = excalidrawAPI.getSceneElementsIncludingDeleted();
    const actions =
      msg.steps && msg.steps.length > 0
        ? msg.steps.flatMap((s) => s.visual_actions)
        : msg.visualActions ?? [];

    const actionTargets = new Set(
      actions
        .map((a) => ("id" in a ? a.id : "target" in a ? a.target : null))
        .filter(Boolean),
    );

    let targetElements = sceneElements.filter(
      (el) =>
        !el.isDeleted &&
        el.customData?.dslId &&
        actionTargets.has(el.customData.dslId as string),
    );

    if (!targetElements.length) {
      targetElements = sceneElements.filter(
        (el) => !el.isDeleted && el.customData?.dslId,
      );
    }

    if (targetElements.length > 0) {
      focusOnElements(excalidrawAPI, targetElements);
    }
  };

  const handleRetryVisuals = (msg: ChatMessage) => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }

    if (msg.steps && msg.steps.length > 0) {
      startVerticalLesson(msg.steps, {
        messageId: msg.id,
        topic: msg.topic,
        initialStepIndex: 0,
      });
      return;
    }

    if (!msg.visualActions?.length) {
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, visualStatus: "drawing" } : m,
      ),
    );

    try {
      isApplyingVisualsRef.current = true;
      const applyResult = applyVisualActions(excalidrawAPI, msg.visualActions, {
        focusViewport: true,
        replaceMatchingAI: true,
        preventDuplicates: false,
        showToast: true,
      });

      previousSnapshotRef.current = createSemanticSnapshot(
        excalidrawAPI.getSceneElements(),
      );
      setTimeout(() => {
        isApplyingVisualsRef.current = false;
      }, 100);

      if (applyResult.success) {
        setError(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, visualStatus: "success", visualError: undefined }
              : m,
          ),
        );
      } else {
        const errText =
          applyResult.errors[0] || "Failed to render visual actions";
        setError(errText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, visualStatus: "failed", visualError: errText }
              : m,
          ),
        );
      }
    } catch (err: unknown) {
      const errText =
        err instanceof Error ? err.message : "Failed to illustrate diagram";
      setError(errText);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, visualStatus: "failed", visualError: errText }
            : m,
        ),
      );
    }
  };

  const handleSubmit = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const latency = createLatencyTracker().mark("t0_prompt_submit");

    setError(null);
    setInputValue("");

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const existingIds = getExistingDslIds(excalidrawAPI);
      const appState = excalidrawAPI.getAppState();
      const theme = appState?.theme === "dark" ? "dark" : "light";
      const sceneElements = excalidrawAPI.getSceneElements();

      // Extract high-level semantic representation of current canvas
      const semanticState = extractSemanticCanvasState(sceneElements);

      // Extract active canvas element selection
      const activeSelection = extractSelectedElementsContext(
        sceneElements,
        appState?.selectedElementIds,
      );
      const finalSelectionContext =
        activeSelection.length > 0
          ? activeSelection
          : selectedContext.length > 0
          ? selectedContext
          : undefined;

      const conversationHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // In-lesson context: if user asks clarifying question while stepping through a lesson
      const activeLessonState = activeLesson
        ? {
            topic: activeLesson.topic,
            currentStepIndex: activeLesson.currentStepIndex,
            totalSteps: activeLesson.steps.length,
            stepTitle: activeLesson.steps[activeLesson.currentStepIndex]?.title,
          }
        : undefined;

      const teachingContext: TeachingRequestContext = {
        theme,
        currentElementsCount: sceneElements.length,
        existingAIElements: existingIds,
        selectedElementsContext: finalSelectionContext,
        conversationHistory,
        semanticSummary: semanticState.summaryText,
        activeLessonState,
        userInteractionDelta: pendingInteraction
          ? pendingInteraction.description
          : undefined,
      };

      latency.mark("t1_request_sent");
      const response = await requestTeachingExplanation(
        {
          prompt: trimmed,
          context: teachingContext,
        },
        { fallbackToLocalMock: false },
      );
      latency.mark("t2_model_received");

      // If user addressed the pending canvas interaction, clear it
      if (pendingInteraction) {
        setPendingInteraction(null);
      }

      const hasSteps = Boolean(response.steps && response.steps.length > 0);
      const hasVisualActions = Boolean(
        (response.visual_actions && response.visual_actions.length > 0) ||
          (hasSteps && response.steps![0].visual_actions.length > 0),
      );

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: response.message,
        topic: response.topic,
        explanationSteps: response.explanation_steps,
        steps: response.steps,
        hasVisuals: hasVisualActions,
        visualStatus: hasVisualActions ? "drawing" : "idle",
        visualActions: response.visual_actions ?? [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (hasSteps && response.steps && response.steps.length > 0) {
        startVerticalLesson(response.steps, {
          messageId: assistantMessageId,
          topic: response.topic,
          initialStepIndex: 0,
        });

        latency.mark("t7_render_complete");
        latency.logSummary(response.topic);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, visualStatus: "success" } : m,
          ),
        );
      } else if (hasVisualActions && response.visual_actions) {
        // Single visual action execution
        isApplyingVisualsRef.current = true;
        const applyResult = applyVisualActions(
          excalidrawAPI,
          response.visual_actions,
          {
            focusViewport: true,
            replaceMatchingAI: true,
            preventDuplicates: false,
            showToast: true,
          },
        );

        latency.mark("t7_render_complete");
        latency.logSummary(response.topic);

        previousSnapshotRef.current = createSemanticSnapshot(
          excalidrawAPI.getSceneElements(),
        );
        setTimeout(() => {
          isApplyingVisualsRef.current = false;
        }, 100);

        if (applyResult.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, visualStatus: "success" }
                : m,
            ),
          );
        } else {
          const errText =
            applyResult.errors[0] || "Failed to render visual actions";
          setError(errText);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, visualStatus: "failed", visualError: errText }
                : m,
            ),
          );
        }
      }
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error("[AITeachingAgent] Teaching generation failed:", err);
      let userFriendlyError =
        "I couldn't generate a valid visual explanation for this request. Please try again.";

      if (err instanceof Error) {
        const raw = err.message;
        if (raw.includes("API key is not configured")) {
          userFriendlyError = raw;
        } else if (raw.includes("timed out")) {
          userFriendlyError =
            "AI tutor request timed out. Please check your AI provider or connection and try again.";
        } else if (
          raw.includes("Failed to connect") ||
          raw.includes("Network error") ||
          raw.includes("connection refused")
        ) {
          userFriendlyError =
            "Failed to connect to AI teaching service. Please check your connection and try again.";
        }
      }

      setError(userFriendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(inputValue);
    }
  };

  const renderCanvasLessonHud = () => {
    if (!activeLesson) {
      return null;
    }
    const currentStep = activeLesson.steps[activeLesson.currentStepIndex];
    const totalSteps = activeLesson.steps.length;
    const isFirst = activeLesson.currentStepIndex === 0;
    const isLast = activeLesson.currentStepIndex === totalSteps - 1;

    return (
      <div
        className="ai-canvas-lesson-hud"
        role="region"
        aria-label="Interactive Lesson HUD"
      >
        <div className="ai-canvas-lesson-hud__header">
          <button
            type="button"
            className="hud-btn hud-btn--prev"
            onClick={() => handlePreviousStep(activeLesson)}
            disabled={isFirst}
            title="Previous step"
          >
            ◀ Prev
          </button>

          <div className="ai-canvas-lesson-hud__step-info">
            <span className="ai-canvas-lesson-hud__badge">
              Step {activeLesson.currentStepIndex + 1} / {totalSteps}
            </span>
            <span
              className="ai-canvas-lesson-hud__title"
              title={currentStep?.title}
            >
              {currentStep?.title || "Lesson Step"}
            </span>
          </div>

          <button
            type="button"
            className="hud-btn hud-btn--next"
            onClick={() => handleNextStep(activeLesson)}
            disabled={isLast}
            title="Next step"
          >
            Next ▶
          </button>

          <button
            type="button"
            className="hud-btn"
            onClick={() =>
              isLessonPlaying ? stopLessonPlayback() : playLesson(activeLesson)
            }
            title={isLessonPlaying ? "Pause lesson playback" : "Play lesson"}
          >
            {isLessonPlaying ? "Pause" : "Play"}
          </button>

          <button
            type="button"
            className="hud-btn"
            onClick={() => replayLesson(activeLesson)}
            title="Replay lesson from the first step"
          >
            Replay
          </button>

          <div className="ai-canvas-lesson-hud__dots">
            {activeLesson.steps.map((s, idx) => (
              <button
                key={idx}
                type="button"
                className={`hud-dot ${
                  idx === activeLesson.currentStepIndex ? "hud-dot--active" : ""
                }`}
                onClick={() => handleJumpToStep(activeLesson, idx)}
                title={`Jump to Step ${idx + 1}: ${s.title}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="ai-canvas-lesson-hud__toggle-chat-btn"
            onClick={() => setIsOpen((prev) => !prev)}
            title={isOpen ? "Minimize chat panel" : "Open chat panel"}
          >
            {isOpen ? "🗕 Hide Chat" : "💬 Chat"}
          </button>

          <button
            type="button"
            className="ai-canvas-lesson-hud__close-btn"
            onClick={() => {
              stopLessonPlayback();
              setActiveLesson(null);
            }}
            title="Exit lesson mode"
            aria-label="Exit lesson mode"
          >
            ✕
          </button>
        </div>

        {currentStep?.calculations && (
          <div
            className="ai-canvas-lesson-hud__calc"
            title={currentStep.calculations}
          >
            📐 <span>{currentStep.calculations.split("\n")[0]}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Closed Launcher */}
      {!isOpen ? (
        <div className="ai-teaching-agent-trigger">
          <button
            type="button"
            className="ai-teaching-agent-trigger__btn"
            onClick={() => setIsOpen(true)}
            title="Open Cognora AI Tutor"
            aria-label="Open Cognora AI Tutor"
          >
            <span className="sparkle-icon">✨</span>
            <span>Cognora Tutor</span>
          </button>
        </div>
      ) : (
        <aside
          className="ai-teaching-agent-panel"
          aria-label="Cognora AI Teaching Assistant"
        >
          {/* Header */}
          <div className="ai-teaching-agent-panel__header">
            <div className="ai-teaching-agent-panel__header-info">
              <div className="ai-teaching-agent-panel__header-title">
                <span>✨</span>
                <span>Cognora AI Tutor</span>
              </div>
              <div className="ai-teaching-agent-panel__header-subtitle">
                Learn by seeing • Visual Explanations
              </div>
            </div>
            <button
              type="button"
              className="ai-teaching-agent-panel__header-close"
              onClick={() => setIsOpen(false)}
              title="Close panel"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="ai-teaching-agent-panel__quick-prompts">
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain binary search")}
              disabled={isLoading}
            >
              🔍 Binary Search
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain arrays")}
              disabled={isLoading}
            >
              📦 Arrays
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain linked lists")}
              disabled={isLoading}
            >
              🔗 Linked List
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain stack")}
              disabled={isLoading}
            >
              🥞 Stack
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain binary trees")}
              disabled={isLoading}
            >
              🌳 Binary Tree
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain BFS algorithm")}
              disabled={isLoading}
            >
              🕸️ Graph
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain dynamic programming")}
              disabled={isLoading}
            >
              📊 Matrix
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => handleSubmit("Explain recursion")}
              disabled={isLoading}
            >
              🔄 Recursion
            </button>
          </div>

          {/* Messages list */}
          <div className="ai-teaching-agent-panel__messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message message--${msg.role}`}>
                {msg.topic && (
                  <div className="message__topic">
                    <span className="topic-tag">📌 {msg.topic}</span>
                  </div>
                )}
                <div className="message__text">{msg.content}</div>

                {/* Step-by-Step Interactive Lesson Controller */}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="ai-lesson-controller">
                    <div className="ai-lesson-controller__header">
                      <span className="ai-lesson-controller__badge">
                        Interactive Lesson
                      </span>
                      <span className="ai-lesson-controller__count">
                        {msg.steps.length} Steps
                      </span>
                    </div>

                    {activeLesson?.messageId === msg.id ? (
                      <div className="ai-lesson-controller__active">
                        <div className="ai-lesson-controller__current">
                          <span className="step-num">
                            Step {activeLesson.currentStepIndex + 1}:
                          </span>{" "}
                          <span className="step-title">
                            {msg.steps[activeLesson.currentStepIndex]?.title}
                          </span>
                        </div>
                        {msg.steps[activeLesson.currentStepIndex]
                          ?.calculations && (
                          <div className="step-calc">
                            📐 <strong>Calculations:</strong>{" "}
                            {
                              msg.steps[activeLesson.currentStepIndex]
                                ?.calculations
                            }
                          </div>
                        )}
                        {msg.steps[activeLesson.currentStepIndex]?.insight && (
                          <div className="step-insight">
                            💡 <strong>Key Insight:</strong>{" "}
                            {msg.steps[activeLesson.currentStepIndex]?.insight}
                          </div>
                        )}
                        <div className="ai-lesson-controller__nav">
                          <button
                            type="button"
                            className="lesson-nav-btn"
                            onClick={() => handlePreviousStep(activeLesson)}
                            disabled={activeLesson.currentStepIndex === 0}
                          >
                            ◀ Prev
                          </button>
                          <div className="lesson-nav-dots">
                            {msg.steps.map((s, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className={`step-dot ${
                                  idx === activeLesson.currentStepIndex
                                    ? "step-dot--active"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleJumpToStep(activeLesson, idx)
                                }
                                title={`Step ${idx + 1}: ${s.title}`}
                              >
                                {idx + 1}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="lesson-nav-btn lesson-nav-btn--primary"
                            onClick={() => handleNextStep(activeLesson)}
                            disabled={
                              activeLesson.currentStepIndex ===
                              msg.steps.length - 1
                            }
                          >
                            Next ▶
                          </button>
                        </div>
                        <div className="ai-lesson-controller__playback">
                          <button
                            type="button"
                            className="lesson-nav-btn"
                            onClick={() =>
                              isLessonPlaying
                                ? stopLessonPlayback()
                                : playLesson(activeLesson)
                            }
                          >
                            {isLessonPlaying ? "Pause" : "Play"}
                          </button>
                          <button
                            type="button"
                            className="lesson-nav-btn"
                            onClick={() => replayLesson(activeLesson)}
                          >
                            Replay
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ai-lesson-controller__launch-btn"
                        onClick={() => {
                          startVerticalLesson(msg.steps!, {
                            messageId: msg.id,
                            topic: msg.topic,
                            initialStepIndex: 0,
                          });
                        }}
                      >
                        ▶ View Step-by-Step Walkthrough
                      </button>
                    )}
                  </div>
                )}

                {msg.explanationSteps && msg.explanationSteps.length > 0 && (
                  <div className="explanation-steps">
                    <div className="explanation-steps__title">
                      Key Learning Steps:
                    </div>
                    <ol className="explanation-steps__list">
                      {msg.explanationSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {msg.hasVisuals && (
                  <div className="message__visual-status">
                    {msg.visualStatus === "drawing" && (
                      <div className="canvas-badge canvas-badge--drawing">
                        <span className="spinner">⏳</span> Drawing on Canvas...
                      </div>
                    )}
                    {msg.visualStatus === "success" && (
                      <button
                        type="button"
                        className="canvas-badge canvas-badge--success"
                        onClick={() => handleFocusVisuals(msg)}
                        title="Click to focus camera on illustrated diagram"
                      >
                        <span>🎨</span> Illustrated on Canvas
                        <span className="canvas-badge__action">🔍 View</span>
                      </button>
                    )}
                    {msg.visualStatus === "failed" && (
                      <button
                        type="button"
                        className="canvas-badge canvas-badge--failed"
                        onClick={() => handleRetryVisuals(msg)}
                        title={msg.visualError || "Click to retry drawing"}
                      >
                        <span>⚠️</span> Failed to Illustrate
                        <span className="canvas-badge__action">🔄 Retry</span>
                      </button>
                    )}
                    {(!msg.visualStatus || msg.visualStatus === "idle") && (
                      <div className="canvas-badge">
                        <span>🎨</span> Illustrated on Canvas
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="loading-indicator">
                <span className="dot-flashing">Thinking & illustrating...</span>
              </div>
            )}

            {error && <div className="error-banner">{error}</div>}

            <div ref={messagesEndRef} />
          </div>

          {/* User Canvas Interaction Banner */}
          {pendingInteraction && (
            <div className="canvas-interaction-banner">
              <div className="canvas-interaction-banner__content">
                <span className="icon">✏️</span>
                <span className="text">
                  Canvas edit: {pendingInteraction.description}
                </span>
              </div>
              <div className="canvas-interaction-banner__actions">
                <button
                  type="button"
                  className="ask-change-btn"
                  onClick={() =>
                    handleSubmit(
                      `I modified the canvas: ${pendingInteraction.description}. What happens now?`,
                    )
                  }
                  disabled={isLoading}
                >
                  Ask AI About Change
                </button>
                <button
                  type="button"
                  className="dismiss-btn"
                  onClick={() => setPendingInteraction(null)}
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Active Canvas Selection Focus Chip */}
          {selectedContext.length > 0 && (
            <div className="canvas-selection-chip">
              <span className="selection-badge">
                🎯 {formatSelectedElementChip(selectedContext)}
              </span>
              <button
                type="button"
                className="clear-selection-btn"
                onClick={() => setSelectedContext([])}
                title="Clear selection focus"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="ai-teaching-agent-panel__input-area">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question to see it explained visually (e.g. 'Explain binary search step by step')..."
              disabled={isLoading}
              aria-label="Teaching prompt input"
            />
            <button
              type="button"
              className="send-btn"
              onClick={() => handleSubmit(inputValue)}
              disabled={isLoading || !inputValue.trim()}
              title="Send prompt"
              aria-label="Send prompt"
            >
              Send
            </button>
          </div>
        </aside>
      )}

      {/* Floating Canvas Lesson HUD docked directly on whiteboard */}
      {renderCanvasLessonHud()}
    </>
  );
};
