/**
 * AI Teaching Agent Component
 *
 * Cognora AI-Native Visual Learning Workspace.
 * Integrates the Stage design layout:
 *   - Top CognoraHeader (Logo, dynamic topic, modes, auto-align, undo/redo, share, avatar)
 *   - Left CognoraDrawingToolbar (Active canvas tools selector)
 *   - Bottom-Center CognoraTimeline (Scrub slider, Prev/Play/Next/Replay, speed, step title)
 *   - Bottom-Center CognoraAIComposer (Pill composer dock with slash autocomplete and selection context)
 *   - Right CognoraContextualPanel (Analyze, Explain, Code, Practice tabs with live line highlights)
 *   - Bottom-Left CognoraLegend (Semantic node and edge status indicators)
 *   - Bottom-Left CognoraZoomControls (Zoom level, -, +, fullscreen)
 *   - CognoraToolsPalette (Modal disclosing all DSA concepts and canvas actions)
 *
 * Canvas is the HERO. All timeline steps and code navigation execute 100% locally.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  applyVisualActions,
  getExistingDslIds,
} from "../ai/ai-canvas";
import {
  requestTeachingExplanation,
  getMockTeachingResponse,
} from "../ai/ai-service";
import { TeachingServiceError } from "../ai/teaching-contract";
import {
  createSemanticSnapshot,
  detectSemanticCanvasChanges,
  type CanvasInteractionDelta,
  type SemanticElementSnapshot,
} from "../ai/semantic-canvas";
import { createLatencyTracker } from "../ai/latency-tracker";
import { extractSelectedElementsContext } from "../ai/selection-context";

import {
  executeCommand,
  getAutocompleteSuggestions,
  type AutocompleteSuggestion,
} from "../ai/commands";
import { detectUserIntent } from "../ai/intent-router";
import {
  compileAndValidateVisualLesson,
  type CompiledTimeline,
} from "../ai/transformation-timeline";
import {
  LessonPlaybackController,
  type LessonPlaybackState,
} from "../ai/lesson-playback-controller";
import { balanceElementPositions } from "../ai/layout-engine";

import "./AITeachingAgent.scss";

// Stage Design Components
import { CognoraHeader } from "./CognoraHeader";
import {
  CognoraDrawingToolbar,
  type DrawingToolType,
} from "./CognoraDrawingToolbar";
import { CognoraAIComposer } from "./CognoraAIComposer";
import { CognoraTimeline } from "./CognoraTimeline";
import {
  CognoraContextualPanel,
  type PanelTabType,
  type AnalyzeModel,
  type ExplainModel,
  type PracticeModel,
  type ContextMetric,
  type ContextProperty,
  type ContextAction,
} from "./CognoraContextualPanel";
import { CognoraToolsPalette } from "./CognoraToolsPalette";
import { CognoraZoomControls } from "./CognoraZoomControls";
import {
  CognoraConversation,
  type TeachingRequestState,
} from "./CognoraConversation";
import { IconAlert, IconInspect, IconChevronRight } from "./CognoraIcons";

import type {
  VisualAction,
  TeachingStep,
  VisualLesson,
  CodeContext,
} from "../ai/visual-dsl";
import type {
  TeachingRequestContext,
  SelectedSemanticElement,
} from "../ai/teaching-contract";

export { getMockTeachingResponse };

export interface AITeachingAgentProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export interface TransformationLesson {
  messageId: string;
  lessonId: string;
  topic?: string;
  lesson: VisualLesson;
  timeline?: CompiledTimeline;
  currentTransformationIndex: number;
  playbackSpeed: number;
}

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
  visualLesson?: VisualLesson;
  codeSolution?: {
    language?: string;
    code?: string;
    problem_summary?: string;
  };
}

export const AITeachingAgent: React.FC<AITeachingAgentProps> = ({
  excalidrawAPI,
}) => {
  const rootContainerRef = useRef<HTMLDivElement>(null);

  // App Modes: visualize, explore, practice, understand
  const [activeMode, setActiveMode] = useState<
    "visualize" | "explore" | "practice" | "understand"
  >("visualize");

  // Active Canvas Tool for Drawing Toolbar
  const [activeCanvasTool, setActiveCanvasTool] = useState<string>("selection");

  // UI Panels state
  const [isContextualPanelOpen, setIsContextualPanelOpen] = useState(false);
  const [contextualTab, setContextualTab] = useState<PanelTabType>("analyze");
  const [isToolsPaletteOpen, setIsToolsPaletteOpen] = useState(false);

  // Zoom & Viewport state (fraction: 1 = 100%)
  const [zoomValue, setZoomValue] = useState(1);

  // Lessons State
  const [transformationLesson, setTransformationLesson] =
    useState<TransformationLesson | null>(null);
  const [isLessonPlaying, setIsLessonPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Synchronize active tab with available capabilities
  useEffect(() => {
    const caps = transformationLesson?.lesson.capabilities as PanelTabType[] | undefined;
    if (caps && caps.length > 0 && !caps.includes(contextualTab)) {
      setContextualTab(caps[0]);
    }
  }, [transformationLesson?.lesson.capabilities, contextualTab]);

  // AI & Chat request state machine
  const [inputValue, setInputValue] = useState("");
  const [requestState, setRequestState] = useState<TeachingRequestState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConversationMinimized, setIsConversationMinimized] = useState(false);

  // Synchronous guard and request tracking refs
  const activeRequestLockRef = useRef<string | null>(null);
  const currentAbortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);
  const lastFailedPromptRef = useRef<string | null>(null);

  const isTeachingRequestActive =
    requestState === "sending" ||
    requestState === "thinking" ||
    requestState === "success";

  // Autocomplete state
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Selected elements & pending interactions on canvas
  const [selectedContext, setSelectedContext] = useState<
    SelectedSemanticElement[]
  >([]);
  const [pendingInteraction, setPendingInteraction] =
    useState<CanvasInteractionDelta | null>(null);
  const [selectedStartNode, setSelectedStartNode] = useState<string>("A");
  const [selectedDestNode, setSelectedDestNode] = useState<string>("P");

  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousSnapshotRef = useRef<Map<string, SemanticElementSnapshot>>(
    new Map(),
  );
  const isApplyingVisualsRef = useRef(false);

  // Derive ownerDocument & ownerWindow from rootContainerRef per user guidelines
  const getOwnerDoc = useCallback((): Document => {
    return rootContainerRef.current?.ownerDocument || document;
  }, []);

  // Autocomplete updates
  useEffect(() => {
    if (inputValue.startsWith("/")) {
      const suggestions = getAutocompleteSuggestions(inputValue);
      setAutocompleteSuggestions(suggestions);
      setSelectedSuggestionIndex(0);
      setShowAutocomplete(suggestions.length > 0);
    } else {
      setShowAutocomplete(false);
      setAutocompleteSuggestions([]);
    }
  }, [inputValue]);

  // Cleanup playback and in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (playbackControllerRef.current) {
        playbackControllerRef.current.destroy();
        playbackControllerRef.current = null;
      }
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
      if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Sync canvas zoom and active tool
  useEffect(() => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }

    try {
      const initialElements = excalidrawAPI.getSceneElements();
      previousSnapshotRef.current = createSemanticSnapshot(initialElements);
      const appState = excalidrawAPI.getAppState();
      if (appState?.zoom?.value) {
        setZoomValue(appState.zoom.value);
      }
    } catch {
      // API not ready
    }

    const unsubscribe = excalidrawAPI.onChange((elements, appState) => {
      if (appState?.zoom?.value) {
        setZoomValue(appState.zoom.value);
      }

      // Sync active tool
      const currentTool = appState?.activeTool?.type;
      if (currentTool) {
        if (currentTool === "freedraw") {
          setActiveCanvasTool("freedraw");
        } else {
          setActiveCanvasTool(currentTool);
        }
      }

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

      // Detect user manual canvas edits
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

  // ============================================================================
  // Lesson Playback & Navigation (Authoritative Controller)
  // ============================================================================

  const playbackControllerRef = useRef<LessonPlaybackController | null>(null);

  const stopLessonPlayback = () => {
    playbackControllerRef.current?.pause();
    setIsLessonPlaying(false);
  };

  const startTransformationLesson = (
    lesson: VisualLesson,
    options: { messageId: string; topic?: string; prompt?: string },
    initialIndex = 0,
  ) => {
    isApplyingVisualsRef.current = true;
    try {
      // 1. Compile and validate visual lesson into immutable canonical SceneStates
      const { timeline, validation } = compileAndValidateVisualLesson(lesson, {
        prompt: options.prompt || options.topic || lesson.title,
      });

      console.log(
        `[COGNORA][LESSON] lessonId=${timeline.lessonId} concept=${timeline.topic} valid=${validation.valid} states=${timeline.states.length} repaired=${validation.repaired}`,
      );

      if (!validation.valid && validation.errors.length > 0) {
        console.warn(`[COGNORA][VALIDATION][FAIL]`, validation.errors);
      }

      // 2. Tear down any previous playback controller cleanly
      if (playbackControllerRef.current) {
        playbackControllerRef.current.destroy();
        playbackControllerRef.current = null;
      }

      // 3. Create single authoritative LessonPlaybackController
      const controller = new LessonPlaybackController(
        excalidrawAPI,
        timeline,
        initialIndex,
      );
      playbackControllerRef.current = controller;

      // 4. Render initial scene state immediately
      controller.renderInitial(true);

      // 5. Subscribe to state transitions
      controller.subscribe((state) => {
        setIsLessonPlaying(state.status === "PLAYING");
        setPlaybackSpeed(state.speed);
        setTransformationLesson((prev) => {
          if (!prev || prev.lessonId !== timeline.lessonId) {
            return {
              messageId: options.messageId,
              lessonId: timeline.lessonId,
              topic: options.topic,
              lesson,
              timeline,
              currentTransformationIndex: state.currentIndex,
              playbackSpeed: state.speed,
            };
          }
          return {
            ...prev,
            timeline,
            currentTransformationIndex: state.currentIndex,
            playbackSpeed: state.speed,
          };
        });
      });
    } finally {
      isApplyingVisualsRef.current = false;
    }
  };

  const handleNextTransformation = () => {
    playbackControllerRef.current?.next(true);
  };

  const handlePreviousTransformation = () => {
    playbackControllerRef.current?.prev(true);
  };

  const handleJumpTransformation = (targetIndex: number) => {
    playbackControllerRef.current?.seek(targetIndex, true);
  };

  const playTransformationLesson = () => {
    playbackControllerRef.current?.play();
  };

  const handleCycleSpeed = () => {
    if (playbackControllerRef.current) {
      playbackControllerRef.current.cycleSpeed();
    } else {
      const nextSpeed =
        playbackSpeed === 1
          ? 1.5
          : playbackSpeed === 1.5
          ? 2
          : playbackSpeed === 2
          ? 0.5
          : 1;
      setPlaybackSpeed(nextSpeed);
    }
  };


  // ============================================================================
  // Canvas Tools & Canvas Interactions
  // ============================================================================

  const handleSelectTool = (tool: DrawingToolType) => {
    setActiveCanvasTool(tool);
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }

    switch (tool) {
      case "selection":
        excalidrawAPI.setActiveTool({ type: "selection" });
        break;
      case "hand":
        excalidrawAPI.setActiveTool({ type: "hand" });
        break;
      case "rectangle":
        excalidrawAPI.setActiveTool({ type: "rectangle" });
        break;
      case "ellipse":
        excalidrawAPI.setActiveTool({ type: "ellipse" });
        break;
      case "arrow":
        excalidrawAPI.setActiveTool({ type: "arrow" });
        break;
      case "freedraw":
        excalidrawAPI.setActiveTool({ type: "freedraw" });
        break;
      case "text":
        excalidrawAPI.setActiveTool({ type: "text" });
        break;
      case "image":
        excalidrawAPI.setActiveTool({ type: "image" });
        break;
    }
  };

  const handlePaletteSelectCanvasTool = (
    tool: DrawingToolType | "diamond" | "line" | "eraser" | "frame",
  ) => {
    setIsToolsPaletteOpen(false);
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }

    if (
      tool === "selection" ||
      tool === "hand" ||
      tool === "rectangle" ||
      tool === "ellipse" ||
      tool === "arrow" ||
      tool === "freedraw" ||
      tool === "text" ||
      tool === "image"
    ) {
      handleSelectTool(tool);
    } else {
      setActiveCanvasTool(tool);
      excalidrawAPI.setActiveTool({ type: tool as any });
    }
  };

  const handleAutoAlign = () => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }
    const elements = excalidrawAPI.getSceneElements();
    if (!elements || elements.length === 0) {
      return;
    }
    const positions = balanceElementPositions(
      elements.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      })),
    );
    const updated = elements.map((el) => {
      const pos = positions.get(el.id);
      return pos ? { ...el, x: pos.x, y: pos.y } : el;
    });
    excalidrawAPI.updateScene({ elements: updated as any });
  };

  const handleUndo = () => {
    const doc = getOwnerDoc();
    const event = new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
      bubbles: true,
    });
    const target = doc.querySelector(".excalidraw-container") || doc.body;
    target.dispatchEvent(event);
  };

  const handleRedo = () => {
    const doc = getOwnerDoc();
    const event = new KeyboardEvent("keydown", {
      key: "y",
      code: "KeyY",
      ctrlKey: true,
      bubbles: true,
    });
    const target = doc.querySelector(".excalidraw-container") || doc.body;
    target.dispatchEvent(event);
  };

  const handleZoomIn = () => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const currentZoom = appState.zoom.value;
    const newZoom = Math.min(currentZoom * 1.25, 5);
    excalidrawAPI.updateScene({
      appState: { ...appState, zoom: { value: newZoom as any } },
    });
    setZoomValue(newZoom);
  };

  const handleZoomOut = () => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const currentZoom = appState.zoom.value;
    const newZoom = Math.max(currentZoom / 1.25, 0.1);
    excalidrawAPI.updateScene({
      appState: { ...appState, zoom: { value: newZoom as any } },
    });
    setZoomValue(newZoom);
  };

  const handleResetZoom = () => {
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    excalidrawAPI.updateScene({
      appState: { ...appState, zoom: { value: 1 as any } },
    });
    setZoomValue(1);
  };

  const handleToggleFullscreen = () => {
    const doc = getOwnerDoc();
    if (!doc.fullscreenElement) {
      doc.documentElement.requestFullscreen?.();
    } else {
      doc.exitFullscreen?.();
    }
  };

  // ============================================================================
  // AI Prompt Submission & Slash Commands (Single Canonical Lifecycle)
  // ============================================================================

  const handleSubmit = async (
    promptText: string,
    userAction: string = "prompt_submit",
  ) => {
    // 1. Synchronously guard against duplicate rapid submissions
    if (activeRequestLockRef.current !== null || isTeachingRequestActive) {
      console.warn(
        `[COGNORA][TEACH][BLOCKED] Duplicate submission blocked (lock=${activeRequestLockRef.current}, state=${requestState}): "${promptText}"`,
      );
      return;
    }

    const trimmed = promptText.trim();
    if (!trimmed) {
      return;
    }

    // 2. Synchronously lock the submission guard with unique request ID
    const requestId = `COGNORA-TEACH-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    activeRequestLockRef.current = requestId;
    currentRequestIdRef.current = requestId;
    lastFailedPromptRef.current = trimmed;

    setRequestState("sending");
    setErrorMessage(null);
    setErrorCode(null);
    setIsConversationMinimized(false);

    // 3. Check for special slash commands or execute via DSA command executor
    if (trimmed.startsWith("/")) {
      if (trimmed === "/clear") {
        excalidrawAPI.updateScene({ elements: [] });
        setTransformationLesson(null);
        activeRequestLockRef.current = null;
        setRequestState("idle");
        setInputValue("");
        return;
      }
      if (trimmed === "/align") {
        handleAutoAlign();
        activeRequestLockRef.current = null;
        setRequestState("idle");
        setInputValue("");
        return;
      }
      const cmdResult = executeCommand(
        trimmed,
        excalidrawAPI.getSceneElements(),
      );
      if (cmdResult.success && cmdResult.actions.length > 0) {
        applyVisualActions(excalidrawAPI, cmdResult.actions, {
          replacePreviousAI: false,
          focusViewport: true,
        });
        activeRequestLockRef.current = null;
        setRequestState("idle");
        setInputValue("");
        return;
      }
    }

    // 4. Render user message immediately (if not retrying previous message) & clear composer
    if (userAction !== "user_retry") {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMessage]);
    }
    setInputValue("");

    // 5. Enter visible AI processing ("thinking") state
    setRequestState("thinking");
    setErrorMessage(null);
    setErrorCode(null);

    // 6. Abort any previous stale controller & setup current
    if (currentAbortControllerRef.current) {
      console.log(
        `[COGNORA][TEACH][ABORT] Aborting previous controller before starting ${requestId}`,
      );
      currentAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    currentAbortControllerRef.current = abortController;
    const startTime = performance.now();

    console.log(
      `[COGNORA][TEACH][START] requestId=${requestId} userAction=${userAction} prompt="${trimmed}"`,
    );

    try {
      const intentClassification = detectUserIntent(trimmed);
      const existingDslIds = getExistingDslIds(excalidrawAPI);

      const requestContext: TeachingRequestContext = {
        theme: "light",
        existingAIElements: existingDslIds,
        selectedElementsContext: selectedContext,
        intent: intentClassification.intent,
      };

      const response = await requestTeachingExplanation(
        {
          prompt: trimmed,
          context: requestContext,
          requestId,
          userAction,
        },
        {
          signal: abortController.signal,
        },
      );

      // Verify this request was not superseded or cancelled
      if (
        abortController.signal.aborted ||
        currentRequestIdRef.current !== requestId
      ) {
        console.log(
          `[COGNORA][TEACH][IGNORED] Stale response for ${requestId} discarded.`,
        );
        return;
      }

      const duration = Math.round(performance.now() - startTime);
      console.log(
        `[COGNORA][TEACH][SUCCESS] requestId=${requestId} duration=${duration}ms topic="${response.topic || ""}"`,
      );

      if (pendingInteraction) {
        setPendingInteraction(null);
      }

      // Extract visual lesson
      const rawLesson =
        (response as any).visualLesson || (response as any).visual_lesson;
      const visualLesson: VisualLesson | undefined = rawLesson
        ? {
            id: rawLesson.id || `lesson-${Date.now()}`,
            title: rawLesson.title || response.topic || "",
            concept: rawLesson.concept || response.topic || "",
            initialScene:
              rawLesson.initialScene || rawLesson.initial_scene || [],
            transformations: (rawLesson.transformations || []).map(
              (t: any) => ({
                id: t.id || `t-${Math.random().toString(36).slice(2, 7)}`,
                title: t.title || "",
                operations: t.operations || [],
                explanation: t.explanation || "",
                codeContext: t.codeContext || t.code_context,
                highlights: t.highlights || [],
              }),
            ),
            codeContexts: rawLesson.codeContexts || rawLesson.code_contexts,
            domain: rawLesson.domain,
          }
        : undefined;

      const assistantMsgId = `assistant-${Date.now()}`;

      // Apply visuals to canvas FIRST. If visual application throws,
      // it is caught cleanly BEFORE committing any false "ready" message.
      if (visualLesson) {
        startTransformationLesson(visualLesson, {
          messageId: assistantMsgId,
          topic: response.topic,
          prompt: trimmed,
        });
        setIsContextualPanelOpen(true);
        setContextualTab("analyze");
        setIsConversationMinimized(true);
      } else if (
        response.visual_actions &&
        response.visual_actions.length > 0
      ) {
        applyVisualActions(excalidrawAPI, response.visual_actions, {
          replacePreviousAI: true,
          focusViewport: true,
        });
      }

      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: response.message,
        topic: response.topic,
        explanationSteps: response.explanation_steps,
        steps: response.steps,
        visualLesson,
        hasVisuals: Boolean(
          visualLesson ||
            (response.visual_actions && response.visual_actions.length > 0) ||
            (response.steps && response.steps.length > 0),
        ),
        visualStatus: "success",
        visualActions: response.visual_actions ?? [],
      };

      // Visual rendering succeeded cleanly: commit assistant card and clear any error
      setErrorMessage(null);
      setErrorCode(null);
      setMessages((prev) => [...prev, assistantMessage]);
      setRequestState("success");

      // Settle cleanly before returning to idle
      setTimeout(() => {
        if (activeRequestLockRef.current === requestId) {
          setRequestState("idle");
          activeRequestLockRef.current = null;
        }
      }, 450);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log(
          `[COGNORA][TEACH][ABORTED] Request ${requestId} was cancelled.`,
        );
        if (activeRequestLockRef.current === requestId) {
          activeRequestLockRef.current = null;
          setRequestState("idle");
        }
        return;
      }

      if (currentRequestIdRef.current !== requestId) {
        return;
      }

      const duration = Math.round(performance.now() - startTime);
      const rawMsg = err instanceof Error ? err.message : String(err);

      let errCode: string | null = null;
      if (err instanceof TeachingServiceError) {
        errCode = err.code || null;
      }

      console.error(
        `[COGNORA][UI][ERROR] requestId=${requestId} code=${errCode} duration=${duration}ms error="${rawMsg}"`,
      );
      console.error(
        `[COGNORA][TEACH][ERROR] requestId=${requestId} code=${errCode} duration=${duration}ms error="${rawMsg}"`,
      );

      const isAuth =
        errCode === "AUTHENTICATION_ERROR" ||
        errCode === "AUTH_FAILED" ||
        rawMsg.includes("authentication") ||
        rawMsg.includes("API key") ||
        rawMsg.includes("401") ||
        rawMsg.includes("403");

      const isRateLimit =
        errCode === "RATE_LIMIT" ||
        rawMsg.includes("rate limit") ||
        rawMsg.includes("429");

      const isStructuredOutput =
        errCode === "STRUCTURED_OUTPUT_ERROR" ||
        errCode === "SCHEMA_ERROR" ||
        errCode === "VALIDATION_ERROR" ||
        errCode === "INVALID_RESPONSE" ||
        rawMsg.includes("Visual DSL") ||
        rawMsg.includes("schema") ||
        rawMsg.includes("Invalid JSON") ||
        rawMsg.includes("parse");

      const isTimeout =
        errCode === "TIMEOUT" ||
        rawMsg.includes("timed out") ||
        rawMsg.includes("timeout") ||
        rawMsg.includes("408");

      const isNetwork =
        errCode === "NETWORK_ERROR" ||
        rawMsg.includes("network") ||
        rawMsg.includes("fetch failed") ||
        rawMsg.includes("ECONNREFUSED");

      const isProviderUnavailable =
        errCode === "PROVIDER_UNAVAILABLE" ||
        errCode === "SERVICE_UNAVAILABLE" ||
        rawMsg.includes("503") ||
        rawMsg.includes("502") ||
        rawMsg.includes("overloaded") ||
        rawMsg.includes("unavailable");

      const isCreditCapacity =
        errCode === "PROVIDER_CAPACITY" ||
        errCode === "CREDIT_CAPACITY_EXCEEDED" ||
        rawMsg.includes("requires more credits") ||
        rawMsg.includes("can only afford") ||
        rawMsg.includes("quota exceeded");

      let friendlyError: string;
      if (isAuth) {
        errCode = "AUTHENTICATION_ERROR";
        friendlyError =
          "AI provider authentication failed. Check API key configuration.";
      } else if (isRateLimit) {
        errCode = "RATE_LIMIT";
        friendlyError = "Rate limit reached. Please wait a moment and try again.";
      } else if (isTimeout) {
        errCode = "TIMEOUT";
        friendlyError = "AI generation timed out. Please try again.";
      } else if (isNetwork) {
        errCode = "NETWORK_ERROR";
        friendlyError = "Network connection failed. Please check your internet connection.";
      } else if (isStructuredOutput) {
        errCode = "STRUCTURED_OUTPUT_ERROR";
        friendlyError = "Visual lesson formatting error. Please try again.";
      } else if (isProviderUnavailable) {
        errCode = "PROVIDER_UNAVAILABLE";
        friendlyError = "AI provider is temporarily overloaded or unavailable. Please try again in a moment.";
      } else if (isCreditCapacity) {
        errCode = "PROVIDER_CAPACITY";
        friendlyError = "AI provider credit limit or quota reached. Please check your account.";
      } else {
        errCode = errCode || "UNKNOWN_PROVIDER_ERROR";
        friendlyError =
          rawMsg && rawMsg.length < 120
            ? rawMsg
            : "Your visual lesson could not be generated. Please try again.";
      }

      setErrorCode(errCode);
      setErrorMessage(friendlyError);
      setRequestState("error");

      if (activeRequestLockRef.current === requestId) {
        activeRequestLockRef.current = null;
      }
    } finally {
      if (currentAbortControllerRef.current === abortController) {
        currentAbortControllerRef.current = null;
      }
    }
  };

  const handleRetry = () => {
    if (
      lastFailedPromptRef.current &&
      activeRequestLockRef.current === null &&
      !isTeachingRequestActive
    ) {
      console.log(
        `[COGNORA][TEACH][RETRY] Retrying failed prompt: "${lastFailedPromptRef.current}"`,
      );
      handleSubmit(lastFailedPromptRef.current, "user_retry");
    }
  };

  const handlePaletteSelectCognoraAction = (actionId: string) => {
    setIsToolsPaletteOpen(false);
    switch (actionId) {
      case "dijkstra":
        handleSubmit("Explain Dijkstra's shortest path algorithm step by step");
        break;
      case "binary-search":
        handleSubmit("Explain binary search step by step");
        break;
      case "linked-list":
        handleSubmit("Explain linked list insertion step by step");
        break;
      case "avl-tree":
        handleSubmit("Explain AVL tree rotation step by step");
        break;
      case "recursion":
        handleSubmit("Explain recursion and call stack step by step");
        break;
      case "graph-bfs":
        handleSubmit("Explain BFS graph traversal step by step");
        break;
      case "auto-align":
        handleAutoAlign();
        break;
      case "clear-canvas":
        excalidrawAPI.updateScene({ elements: [] });
        setTransformationLesson(null);
        break;
    }
  };

  // ============================================================================
  // Derived Contextual Data for Panels & HUDs

  const currentTopic = transformationLesson?.topic ?? undefined;

  // Step calculations for Timeline and Contextual Panel
  const totalStepsCount = transformationLesson?.timeline
    ? transformationLesson.timeline.states.length
    : transformationLesson
    ? transformationLesson.lesson.transformations.length
    : 1;

  const currentStepNum = transformationLesson
    ? Math.max(1, transformationLesson.currentTransformationIndex + 1)
    : 1;

  const canPrev = currentStepNum > 1;
  const canNext = currentStepNum < totalStepsCount;

  const currentMeta = transformationLesson?.timeline
    ? transformationLesson.timeline.meta[
        transformationLesson.currentTransformationIndex
      ]
    : undefined;

  const currentStepTitle =
    currentMeta?.title ||
    (transformationLesson &&
    transformationLesson.currentTransformationIndex >= 0
      ? transformationLesson.lesson.transformations[
          transformationLesson.currentTransformationIndex
        ]?.title || ""
      : "");

  const currentExplanation =
    currentMeta?.explanation ||
    (transformationLesson &&
    transformationLesson.currentTransformationIndex >= 0
      ? transformationLesson.lesson.transformations[
          transformationLesson.currentTransformationIndex
        ]?.explanation || ""
      : transformationLesson?.lesson.concept
      ? `${transformationLesson.lesson.concept}: Initial state`
      : "");

  const currentCalculations =
    currentMeta?.calculations ||
    (transformationLesson &&
    transformationLesson.currentTransformationIndex >= 0 &&
    transformationLesson.lesson.transformations[
      transformationLesson.currentTransformationIndex
    ]?.codeContext?.language
      ? `Step ${currentStepNum} of ${totalStepsCount}`
      : undefined);

  const currentInsight =
    currentMeta?.insight ||
    (transformationLesson &&
    transformationLesson.currentTransformationIndex >= 0
      ? transformationLesson.lesson.transformations[
          transformationLesson.currentTransformationIndex
        ]?.explanation
      : undefined);

  // Stepper steps for AnalyzeModel
  const stepperSteps = transformationLesson?.timeline
    ? transformationLesson.timeline.meta.map((m, idx) => ({
        stepNumber: idx + 1,
        title: m.title,
        isCompleted: transformationLesson.currentTransformationIndex > idx,
        isActive: transformationLesson.currentTransformationIndex === idx,
        isPending: transformationLesson.currentTransformationIndex < idx,
      }))
    : transformationLesson
    ? transformationLesson.lesson.transformations.map((t, idx) => ({
        stepNumber: idx + 1,
        title: t.title,
        isCompleted: transformationLesson.currentTransformationIndex > idx,
        isActive: transformationLesson.currentTransformationIndex === idx,
        isPending: transformationLesson.currentTransformationIndex < idx,
      }))
    : [];

  const analyzeData: AnalyzeModel | undefined = (() => {
    if (!transformationLesson) return undefined;

    const topicStr = (
      currentTopic ||
      transformationLesson.lesson.topic ||
      transformationLesson.lesson.title ||
      ""
    ).toLowerCase();

    const activeT =
      transformationLesson.currentTransformationIndex >= 0
        ? transformationLesson.lesson.transformations[
            transformationLesson.currentTransformationIndex
          ]
        : transformationLesson.lesson.transformations[0];

    const isTree =
      topicStr.includes("tree") ||
      topicStr.includes("avl") ||
      topicStr.includes("bst") ||
      topicStr.includes("heap");
    const isGraphDijkstra =
      topicStr.includes("dijkstra") || topicStr.includes("shortest path");
    const isBFS =
      topicStr.includes("bfs") ||
      topicStr.includes("breadth-first") ||
      topicStr.includes("breadth first");
    const isBinarySearch = topicStr.includes("binary search");
    const isHttp =
      topicStr.includes("http") ||
      topicStr.includes("request") ||
      topicStr.includes("tcp") ||
      topicStr.includes("api");
    const isLinkedList = topicStr.includes("linked list");
    const isSql =
      topicStr.includes("sql") ||
      topicStr.includes("join") ||
      topicStr.includes("database");

    const metrics: ContextMetric[] = [];
    const properties: ContextProperty[] = [];
    const operation = activeT?.title;
    const resultSummary = activeT?.explanation;

    if (isBFS) {
      metrics.push({ label: "Traversal", value: "Breadth-First (BFS)" });
      metrics.push({
        label: "Queue State",
        value:
          currentStepNum === 1
            ? "[Start Node]"
            : currentStepNum === 2
            ? "[Neighbors Enqueued]"
            : currentStepNum === totalStepsCount
            ? "[] (Empty)"
            : "[Active Queue]",
      });
      metrics.push({
        label: "Visited Nodes",
        value: `${currentStepNum} / ${totalStepsCount} explored`,
      });
      metrics.push({
        label: "Timeline Step",
        value: `${currentStepNum} / ${totalStepsCount}`,
      });
    } else if (isTree) {
      const isLL =
        activeT?.title?.includes("LL") || activeT?.explanation?.includes("LL");
      const isRR =
        activeT?.title?.includes("RR") || activeT?.explanation?.includes("RR");
      const isLR =
        activeT?.title?.includes("LR") || activeT?.explanation?.includes("LR");
      const isRL =
        activeT?.title?.includes("RL") || activeT?.explanation?.includes("RL");
      const imbalanceType = isLL
        ? "LL (Left-Left)"
        : isRR
        ? "RR (Right-Right)"
        : isLR
        ? "LR (Left-Right)"
        : isRL
        ? "RL (Right-Left)"
        : "Balanced";

      metrics.push({ label: "Imbalance", value: imbalanceType });
      metrics.push({
        label: "Subtree Root",
        value: activeT?.highlights?.[0]
          ? String(activeT.highlights[0]).replace(/^(node|entity)-/, "")
          : "30",
      });
      metrics.push({
        label: "Pivot Node",
        value: activeT?.highlights?.[1]
          ? String(activeT.highlights[1]).replace(/^(node|entity)-/, "")
          : "20",
      });
      metrics.push({
        label: "Timeline Step",
        value: `${currentStepNum} / ${totalStepsCount}`,
      });
    } else if (isBinarySearch) {
      metrics.push({ label: "Target", value: "42" });
      metrics.push({ label: "Low", value: "0" });
      metrics.push({ label: "Mid", value: "3" });
      metrics.push({ label: "High", value: "7" });
    } else if (isHttp) {
      metrics.push({ label: "Method", value: "GET" });
      metrics.push({ label: "Status", value: "200 OK" });
      metrics.push({ label: "Protocol", value: "HTTP/1.1" });
      metrics.push({ label: "Latency", value: "48ms" });
    } else if (isLinkedList) {
      metrics.push({ label: "Operation", value: activeT?.title || "Insert" });
      metrics.push({ label: "Active Node", value: "New Node" });
      metrics.push({ label: "Head", value: "Node 1" });
      metrics.push({ label: "Tail", value: "Node 4" });
    } else if (isSql) {
      metrics.push({ label: "Join Type", value: "INNER JOIN" });
      metrics.push({ label: "Table A", value: "users" });
      metrics.push({ label: "Table B", value: "orders" });
      metrics.push({
        label: "Condition",
        value: "users.id = orders.user_id",
      });
    } else {
      // Arbitrary / Universal concept (e.g. Refrigerator, Operating Systems, Physics)
      metrics.push({ label: "Phase", value: `Phase ${currentStepNum}` });
      metrics.push({
        label: "Progress",
        value: `${currentStepNum} / ${totalStepsCount}`,
      });
      if (activeT?.highlights && activeT.highlights.length > 0) {
        metrics.push({
          label: "Active Entity",
          value: String(activeT.highlights[0]).replace(/^(node|entity)-/, ""),
        });
      }
    }

    return {
      title: transformationLesson.lesson.title || "Lesson Analysis",
      subtitle:
        transformationLesson.lesson.concept ||
        "Step-by-step state inspection",
      conceptType: isTree
        ? "tree"
        : isGraphDijkstra || isBFS
        ? "graph"
        : isBinarySearch
        ? "array"
        : isHttp
        ? "network"
        : isLinkedList
        ? "linked_list"
        : "generic",
      operation,
      statusBadge: `Step ${currentStepNum} of ${totalStepsCount}`,
      metrics,
      properties,
      resultSummary,
      isDijkstra: isGraphDijkstra,
      startNodes: isGraphDijkstra ? ["A", "B", "C", "D", "E"] : undefined,
      destNodes: isGraphDijkstra ? ["P", "K", "L"] : undefined,
      selectedStart: selectedStartNode,
      selectedDest: selectedDestNode,
      onStartChange: setSelectedStartNode,
      onDestChange: setSelectedDestNode,
      onRunAction: () => {
        playbackControllerRef.current?.seek(totalStepsCount - 1, true);
      },
      actionLabel: isGraphDijkstra ? "Find Shortest Path" : undefined,
      stepperSteps,
      onSelectStep: (idx) => {
        playbackControllerRef.current?.seek(idx, true);
      },
    };
  })();

  const explainData: ExplainModel = {
    title:
      currentStepTitle ||
      (currentTopic
        ? `${currentTopic} (Step ${currentStepNum})`
        : "Visual Explanation"),
    explanation:
      currentExplanation ||
      "Ask any algorithm or data structure question below to start a step-by-step visual lesson.",
    calculations: currentCalculations,
    insight: currentInsight,
    whatChanged: currentTopic
      ? `Step ${currentStepNum} of ${totalStepsCount} active.`
      : undefined,
    consequence: undefined,
  };

  const practiceData: PracticeModel | undefined = undefined;

  // Code context for current transformation
  const currentCodeContext: CodeContext | undefined = (() => {
    if (transformationLesson) {
      const activeT =
        transformationLesson.currentTransformationIndex >= 0
          ? transformationLesson.lesson.transformations[
              transformationLesson.currentTransformationIndex
            ]
          : null;
      if (activeT?.codeContext) {
        return activeT.codeContext;
      }
      if (transformationLesson.lesson.codeContexts) {
        if (Array.isArray(transformationLesson.lesson.codeContexts)) {
          return transformationLesson.lesson.codeContexts[0];
        }
        const firstKey = Object.keys(transformationLesson.lesson.codeContexts)[0];
        return firstKey ? transformationLesson.lesson.codeContexts[firstKey] : undefined;
      }
    }
    return undefined;
  })();

  // Active Node Callout Pin (dynamically attached to active highlighted node on canvas)
  const activeCallout = (() => {
    if (!transformationLesson || !excalidrawAPI || excalidrawAPI.isDestroyed) {
      return null;
    }
    const idx = transformationLesson.currentTransformationIndex;
    const activeT =
      idx >= 0 ? transformationLesson.lesson.transformations[idx] : null;

    if (!activeT) {
      return null;
    }

    const highlightTarget =
      activeT.highlights && activeT.highlights.length > 0
        ? activeT.highlights[0]
        : null;

    if (!highlightTarget) {
      return null;
    }

    try {
      const elements = excalidrawAPI.getSceneElements();
      if (!elements || elements.length === 0) {
        return null;
      }
      const targetEl = elements.find(
        (el) =>
          el.customData?.dslId === highlightTarget ||
          el.customData?.nodeId === highlightTarget ||
          el.id === highlightTarget ||
          el.customData?.dslId?.endsWith(`-${highlightTarget}`),
      );

      if (!targetEl) {
        return null;
      }

      const appState = excalidrawAPI.getAppState();
      const zoom = appState.zoom.value;
      const screenX =
        (targetEl.x + targetEl.width / 2 + appState.scrollX) * zoom;
      const screenY = (targetEl.y + appState.scrollY) * zoom;

      return {
        x: screenX,
        y: screenY,
        title: activeT.title,
        subtitle: activeT.explanation?.slice(0, 45) || "Active element",
      };
    } catch {
      return null;
    }
  })();

  return (
    <div ref={rootContainerRef} className="cognora-workspace-root">
      {/* 1. Header (Sticky Top Bar) */}
      <CognoraHeader
        lessonTitle={currentTopic}
        activeMode={activeMode}
        onModeSelect={setActiveMode}
        onAutoAlign={handleAutoAlign}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleMore={() => setIsToolsPaletteOpen((prev) => !prev)}
        isMoreOpen={isToolsPaletteOpen}
        onToggleContextualPanel={() => setIsContextualPanelOpen((prev) => !prev)}
        isContextualPanelOpen={isContextualPanelOpen}
        hasActiveLesson={Boolean(transformationLesson)}
      />

      {/* 2. Drawing Toolbar (Floating Left) */}
      <CognoraDrawingToolbar
        activeTool={activeCanvasTool}
        onSelectTool={handleSelectTool}
        onOpenMoreTools={() => setIsToolsPaletteOpen(true)}
      />

      {/* 4. Zoom Controls (Bottom Left) */}
      <CognoraZoomControls
        zoomValue={zoomValue}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Dynamic Active Node Callout Pin */}
      {activeCallout && (
        <div
          className="cognora-node-callout"
          style={{
            left: `${activeCallout.x}px`,
            top: `${activeCallout.y - 12}px`,
          }}
        >
          <div className="cognora-node-callout__card">
            <div className="cognora-node-callout__title">
              {activeCallout.title}
            </div>
            <div className="cognora-node-callout__subtitle">
              {activeCallout.subtitle}
            </div>
          </div>
          <svg className="cognora-node-callout__caret" viewBox="0 0 16 8">
            <polygon points="0,0 16,0 8,8" />
          </svg>
          <div className="cognora-node-callout__pin" />
        </div>
      )}

      {/* 5. Timeline Playback HUD (Floating Bottom Center) */}
      {transformationLesson && (
        <CognoraTimeline
          currentStep={currentStepNum}
          totalSteps={totalStepsCount}
          isPlaying={isLessonPlaying}
          speed={playbackSpeed}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={handlePreviousTransformation}
          onNext={handleNextTransformation}
          onTogglePlay={() => {
            if (isLessonPlaying) {
              stopLessonPlayback();
            } else {
              playTransformationLesson();
            }
          }}
          onReplay={() => {
            playbackControllerRef.current?.replay();
          }}
          onCycleSpeed={handleCycleSpeed}
          onSeek={(stepIndex) => {
            handleJumpTransformation(stepIndex);
          }}
          onCloseLesson={() => {
            playbackControllerRef.current?.destroy();
            playbackControllerRef.current = null;
            setTransformationLesson(null);
          }}
        />
      )}

      {/* 6. AI Composer Dock with Integrated Conversation Thread */}
      <CognoraAIComposer
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={(prompt) => handleSubmit(prompt, "composer_submit")}
        isLoading={isTeachingRequestActive}
        selectedContext={selectedContext}
        onClearSelectedContext={() => setSelectedContext([])}
        pendingInteraction={pendingInteraction}
        onClearPendingInteraction={() => setPendingInteraction(null)}
        showAutocomplete={showAutocomplete}
        autocompleteSuggestions={autocompleteSuggestions}
        selectedSuggestionIndex={selectedSuggestionIndex}
        onSelectSuggestion={(sug) => {
          setInputValue(`/${sug.name} `);
          setShowAutocomplete(false);
        }}
        onSuggestionHover={setSelectedSuggestionIndex}
        suggestions={
          transformationLesson
            ? [
                "Explain this step",
                "Show the code implementation",
                "What is the time complexity?",
                "How do pointers transition?",
                "Walk through an edge case",
              ]
            : [
                "Explain Binary Search step by step",
                "Explain AVL Tree Rotations",
                "Explain Linked List Insertion",
                "Explain Recursion and Call Stack",
                "Explain Graph BFS Traversal",
              ]
        }
        onSuggestionClick={(s) => handleSubmit(s, "suggestion_pill_click")}
      >
        <CognoraConversation
          messages={messages}
          requestState={requestState}
          errorMessage={errorMessage}
          errorCode={errorCode}
          onRetry={handleRetry}
          isTeachingRequestActive={isTeachingRequestActive}
          isMinimized={isConversationMinimized}
          onToggleMinimize={() => setIsConversationMinimized((prev) => !prev)}
        />
      </CognoraAIComposer>

      {/* 7. Right Contextual Panel (Analyze, Explain, Code, Practice) */}
      {isContextualPanelOpen && (
        <CognoraContextualPanel
          activeTab={contextualTab}
          onTabChange={setContextualTab}
          onClose={() => setIsContextualPanelOpen(false)}
          analyzeData={analyzeData}
          explainData={explainData}
          codeContext={currentCodeContext}
          practiceData={practiceData}
          capabilities={transformationLesson?.lesson.capabilities || ["explain", "code", "analyze", "practice"]}
        />
      )}

      {/* 8. Bottom-Right Tools Button */}
      <button
        type="button"
        className={`cognora-tools-button ${
          isContextualPanelOpen ? "cognora-tools-button--panel-open" : ""
        }`}
        onClick={() => setIsToolsPaletteOpen(true)}
        title="Tools Palette"
        aria-label="Tools Palette"
      >
        <svg
          style={{ width: "16px", height: "16px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M4 6h16M4 12h16m-7 6h7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        <span>Tools</span>
        <svg
          style={{ width: "14px", height: "14px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M5 15l7-7 7 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      {/* 9. Tools Palette Modal (Discloses All Capabilities) */}
      <CognoraToolsPalette
        isOpen={isToolsPaletteOpen}
        onClose={() => setIsToolsPaletteOpen(false)}
        onSelectCanvasTool={handlePaletteSelectCanvasTool}
        onSelectCognoraAction={handlePaletteSelectCognoraAction}
        onClearCanvas={() => {
          excalidrawAPI.updateScene({ elements: [] });
          setTransformationLesson(null);
        }}
      />
    </div>
  );
};
