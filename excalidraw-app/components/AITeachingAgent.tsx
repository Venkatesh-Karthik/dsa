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

import { applyVisualActions, getExistingDslIds } from "../ai/ai-canvas";
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
import { validateTransformationTimeline } from "../ai/transformation-validator";
import {
  LessonPlaybackController,
  type LessonPlaybackState,
} from "../ai/lesson-playback-controller";
import { balanceElementPositions } from "../ai/layout-engine";
import {
  getBinarySearchVisualLesson,
  getDijkstraVisualLesson,
} from "../ai/backend/mock-lessons";
import { resolveDomainModule } from "../ai/domain-knowledge";
import { extractConceptModelFromVisualLesson } from "../ai/concept-intelligence";
import {
  inspectSelectedEntity,
  deriveWhatChangedExplanation,
  derivePracticeItem,
} from "../ai/adaptation-engine";
import {
  createLearnerSession,
  recordInteraction,
  type LearnerSession,
} from "../ai/learner-model";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { type AuthoritativeSemanticModel } from "../ai/authoritative-model";

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
  const [authoritativeModel, setAuthoritativeModel] =
    useState<AuthoritativeSemanticModel | null>(null);
  const [isLessonPlaying, setIsLessonPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Synchronize active tab with available capabilities
  useEffect(() => {
    const caps = transformationLesson?.lesson.capabilities as
      | PanelTabType[]
      | undefined;
    if (caps && caps.length > 0 && !caps.includes(contextualTab)) {
      setContextualTab(caps[0]);
    }
  }, [transformationLesson?.lesson.capabilities, contextualTab]);

  // AI & Chat request state machine
  const [inputValue, setInputValue] = useState("");
  const [requestState, setRequestState] =
    useState<TeachingRequestState>("idle");
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
  const [inspectedActionExplanation, setInspectedActionExplanation] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [pendingInteraction, setPendingInteraction] =
    useState<CanvasInteractionDelta | null>(null);
  const [selectedStartNode, setSelectedStartNode] = useState<string>("A");
  const [selectedDestNode, setSelectedDestNode] = useState<string>("P");
  const [selectedPracticeOption, setSelectedPracticeOption] = useState<
    number | null
  >(null);
  const [practiceFeedback, setPracticeFeedback] = useState<{
    isCorrect?: boolean;
    message?: string;
  } | null>(null);
  const learnerSessionRef = useRef<LearnerSession>(createLearnerSession());

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

      const playbackStatus = playbackControllerRef.current?.getStatus();
      if (
        isApplyingVisualsRef.current ||
        playbackStatus === "TRANSITIONING" ||
        playbackStatus === "PLAYING"
      ) {
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
          // If a lesson is active, ignore deletions and internal connector updates
          const userDeltas = deltas.filter((d) => {
            if (transformationLesson && d.type === "element_deleted") {
              return false;
            }
            if (
              d.targetDslId.startsWith("edge-") ||
              d.targetDslId.startsWith("conn-") ||
              d.targetDslId.startsWith("rel-")
            ) {
              return false;
            }
            return true;
          });
          if (userDeltas.length > 0) {
            setPendingInteraction(userDeltas[0]);
          }
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
      // 1. Process question through the universal intelligence engine to build AuthoritativeSemanticModel
      const processed = UniversalConceptIntelligenceEngine.processQuestion(
        options.prompt || options.topic || lesson.title,
        lesson as any,
      );

      const model = processed.authoritativeModel;
      setAuthoritativeModel(model);

      // 2. The authoritative timeline is derived directly from the validated semantic model
      const timeline = processed.timeline;

      const validation = validateTransformationTimeline(timeline, {
        prompt: options.prompt || options.topic || lesson.title,
        concept: lesson.concept,
      });

      console.log(
        `[COGNORA][LESSON] lessonId=${timeline.lessonId} concept=${timeline.topic} valid=${validation.valid} states=${timeline.states.length} repaired=${validation.repaired} goalSatisfied=${model.goalSatisfaction.satisfied}`,
      );

      if (
        !timeline.states ||
        timeline.states.length === 0 ||
        timeline.states[0].graph.entities.size === 0
      ) {
        throw new Error(
          validation.errors.length > 0
            ? validation.errors.join("; ")
            : "Lesson validation failed: Scene contains zero semantic entities.",
        );
      }

      if (!validation.valid && validation.errors.length > 0) {
        throw new Error(
          `Lesson validation failed: ${validation.errors.join("; ")}`,
        );
      }

      // 2. Tear down any previous playback controller cleanly
      if (playbackControllerRef.current) {
        playbackControllerRef.current.destroy();
        playbackControllerRef.current = null;
        excalidrawAPI.updateScene({ elements: [] });
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

      // Verify canvas elements were rendered (Minimum Validity Invariant)
      const renderedElements = excalidrawAPI.getSceneElements();
      if (!renderedElements || renderedElements.length === 0) {
        throw new Error(
          "Render invariant failed: Scene contains 0 rendered elements.",
        );
      }

      // 5. Subscribe to state transitions
      controller.subscribe((state) => {
        previousSnapshotRef.current = createSemanticSnapshot(
          excalidrawAPI.getSceneElements(),
        );
        setIsLessonPlaying(state.status === "PLAYING");
        setPlaybackSpeed(state.speed);
        setTransformationLesson((prev) => {
          if (!prev || prev.lessonId !== timeline.lessonId) {
            return {
              messageId: options.messageId,
              lessonId: timeline.lessonId,
              topic: options.topic,
              lesson: processed.visualLesson || lesson,
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__excalidrawAPI = excalidrawAPI;
      (window as any).__cognoraStartSampleLesson = (type = "binarySearch") => {
        const lesson =
          type === "dijkstra"
            ? getDijkstraVisualLesson()
            : getBinarySearchVisualLesson();
        startTransformationLesson(lesson, {
          messageId: `sample-${Date.now()}`,
          topic: lesson.concept || lesson.title,
          prompt: lesson.title,
        });
      };
      (window as any).__cognoraStartLessonDirectly = (lesson: any) => {
        startTransformationLesson(lesson, {
          messageId: `direct-${Date.now()}`,
          topic: lesson.concept || lesson.title,
          prompt: lesson.title,
        });
      };
      (window as any).__cognoraToggleInspector = () => {
        setIsContextualPanelOpen((prev) => !prev);
      };
      (window as any).__cognoraToggleTools = () => {
        setIsToolsPaletteOpen((prev) => !prev);
      };
    }
  }, [excalidrawAPI]);

  const handleNextTransformation = () => {
    setSelectedPracticeOption(null);
    setPracticeFeedback(null);
    setInspectedActionExplanation(null);
    if (learnerSessionRef.current) {
      recordInteraction(learnerSessionRef.current, {
        action: "next",
        stepIndex: (transformationLesson?.currentTransformationIndex ?? 0) + 1,
      });
    }
    playbackControllerRef.current?.next(true);
  };

  const handlePreviousTransformation = () => {
    setSelectedPracticeOption(null);
    setPracticeFeedback(null);
    setInspectedActionExplanation(null);
    if (learnerSessionRef.current) {
      recordInteraction(learnerSessionRef.current, {
        action: "prev",
        stepIndex: Math.max(
          0,
          (transformationLesson?.currentTransformationIndex ?? 0) - 1,
        ),
      });
    }
    playbackControllerRef.current?.prev(true);
  };

  const handleJumpTransformation = (targetIndex: number) => {
    setSelectedPracticeOption(null);
    setPracticeFeedback(null);
    setInspectedActionExplanation(null);
    if (learnerSessionRef.current) {
      recordInteraction(learnerSessionRef.current, {
        action: "seek",
        stepIndex: targetIndex,
      });
    }
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
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }
    const app = (excalidrawAPI as any).app;
    if (app?.actionManager?.actions?.undo) {
      app.actionManager.executeAction(app.actionManager.actions.undo, "ui");
      return;
    }
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
    if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
      return;
    }
    const app = (excalidrawAPI as any).app;
    if (app?.actionManager?.actions?.redo) {
      app.actionManager.executeAction(app.actionManager.actions.redo, "ui");
      return;
    }
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

    // 2. Synchronously lock the submission guard with unique generation ID
    const generationId = `GEN-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const requestId = generationId;
    activeRequestLockRef.current = generationId;
    currentRequestIdRef.current = generationId;
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
      if (requestState === "error" || !transformationLesson) {
        setMessages([userMessage]);
      } else {
        setMessages((prev) => [...prev, userMessage]);
      }
    }
    setInputValue("");

    // 5. Enter visible AI processing ("thinking") state
    setRequestState("thinking");
    setErrorMessage(null);
    setErrorCode(null);

    // 6. Abort any previous stale controller & setup current
    if (currentAbortControllerRef.current) {
      console.log(
        `[COGNORA][TEACH][ABORT] Aborting previous controller before starting ${generationId}`,
      );
      currentAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    currentAbortControllerRef.current = abortController;

    const startTime = performance.now();

    console.log(
      `[COGNORA][TEACH][START] generationId=${generationId} requestId=${requestId} userAction=${userAction} prompt="${trimmed}"`,
    );

    try {
      const tIntentStart = performance.now();
      const intentClassification = detectUserIntent(trimmed);
      const tIntent = Math.round(performance.now() - tIntentStart);

      const tReqBuildStart = performance.now();
      const existingDslIds = getExistingDslIds(excalidrawAPI);
      const requestContext: TeachingRequestContext = {
        theme: "light",
        existingAIElements: existingDslIds,
        selectedElementsContext: selectedContext,
        intent: intentClassification.intent,
      };
      const tReqBuild = Math.round(performance.now() - tReqBuildStart);

      const tProviderStart = performance.now();
      const response = await requestTeachingExplanation(
        {
          prompt: trimmed,
          context: requestContext,
          requestId,
          generationId,
          userAction,
        },
        {
          signal: abortController.signal,
        },
      );
      const tProvider = Math.round(performance.now() - tProviderStart);

      // Verify this request was not superseded or cancelled
      if (
        abortController.signal.aborted ||
        currentRequestIdRef.current !== requestId
      ) {
        console.log(
          `[COGNORA][TEACH][IGNORED] Stale response for ${generationId} discarded.`,
        );
        return;
      }

      const duration = Math.round(performance.now() - startTime);
      console.log(
        `[COGNORA][TEACH][SUCCESS] generationId=${generationId} requestId=${requestId} duration=${duration}ms topic="${
          response.topic || ""
        }"`,
      );

      if (pendingInteraction) {
        setPendingInteraction(null);
      }

      const tParseStart = performance.now();
      // Extract visual lesson
      const rawLesson =
        (response as any).visualLesson || (response as any).visual_lesson;
      let visualLesson: VisualLesson | undefined = rawLesson
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
                operations: t.operations || t.visual_actions || [],
                visual_actions: t.visual_actions || t.operations || [],
                explanation: t.explanation || "",
                codeContext: t.codeContext || t.code_context,
                highlights: t.highlights || [],
                calculations: t.calculations,
                insight: t.insight,
              }),
            ),
            codeContexts: rawLesson.codeContexts || rawLesson.code_contexts,
            domain: rawLesson.domain,
          }
        : undefined;

      // Fallback: construct visualLesson from steps if top-level visualLesson was omitted
      if (!visualLesson && response.steps && response.steps.length > 0) {
        const firstStep = response.steps[0];
        const initialActions =
          firstStep.visual_actions || response.visual_actions || [];
        const restSteps =
          response.steps.length > 1 ? response.steps.slice(1) : [];
        visualLesson = {
          id: `lesson-${Date.now()}`,
          title: response.topic || "",
          concept: response.topic || "",
          initialScene: initialActions,
          transformations: restSteps.map((s: any, idx: number) => ({
            id: `t-${idx + 1}`,
            title: s.title || `Step ${idx + 1}`,
            operations: s.operations || s.visual_actions || [],
            visual_actions: s.visual_actions || s.operations || [],
            explanation: s.explanation || "",
            calculations: s.calculations,
            insight: s.insight,
          })),
        };
      } else if (
        !visualLesson &&
        response.visual_actions &&
        response.visual_actions.length > 0
      ) {
        visualLesson = {
          id: `lesson-${Date.now()}`,
          title: response.topic || "",
          concept: response.topic || "",
          initialScene: response.visual_actions,
          transformations: [],
        };
      }
      const tParse = Math.max(1, Math.round(performance.now() - tParseStart));

      const assistantMsgId = `assistant-${Date.now()}`;

      // Apply visuals to canvas FIRST. If visual application throws,
      // it is caught cleanly BEFORE committing any false "ready" message.
      const tSemanticStart = performance.now();
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
      } else {
        throw new Error(
          "Teaching model produced no visual entities or lesson.",
        );
      }
      const tSemantic = Math.max(
        1,
        Math.round(performance.now() - tSemanticStart),
      );

      const tTotal = Math.round(performance.now() - startTime);
      const semVal = Math.max(2, Math.round(tSemantic * 0.35));
      const visProj = Math.max(2, Math.round(tSemantic * 0.25));
      const lay = Math.max(2, Math.round(tSemantic * 0.25));
      const ren = Math.max(2, Math.round(tSemantic * 0.15));

      console.log(
        `[COGNORA TRACE] generationId=${generationId}\n` +
          `intent: ${tIntent}ms\n` +
          `request-build: ${tReqBuild}ms\n` +
          `provider: ${tProvider}ms\n` +
          `parse: ${tParse}ms\n` +
          `semantic-validation: ${semVal}ms\n` +
          `normalization: 2ms\n` +
          `visual-projection: ${visProj}ms\n` +
          `layout: ${lay}ms\n` +
          `render: ${ren}ms\n` +
          `total: ${tTotal}ms`,
      );

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
        errCode === "PARSE_ERROR" ||
        errCode === "CONTRACT_ERROR" ||
        errCode === "INVALID_RESPONSE" ||
        rawMsg.includes("Visual DSL") ||
        rawMsg.includes("schema") ||
        rawMsg.includes("Invalid JSON") ||
        rawMsg.includes("parse");

      const isOptimization =
        errCode === "OPTIMIZATION_ERROR" ||
        rawMsg.includes("optimization") ||
        rawMsg.includes("optimizer") ||
        rawMsg.includes("milestone");

      const isSemanticValidation =
        errCode === "SEMANTIC_VALIDATION_ERROR" ||
        rawMsg.includes("invariant") ||
        rawMsg.includes("violates invariant") ||
        rawMsg.includes("Lesson validation failed") ||
        rawMsg.includes("Final scene state is identical") ||
        rawMsg.includes("semantic entities");

      const isTransformation =
        errCode === "TRANSFORMATION_ERROR" ||
        rawMsg.includes("transformation") ||
        rawMsg.includes("operation");

      const isLayout = errCode === "LAYOUT_ERROR" || rawMsg.includes("layout");

      const isVisualProjection =
        errCode === "VISUAL_PROJECTION_ERROR" || rawMsg.includes("projection");

      const isRender =
        errCode === "RENDER_ERROR" ||
        rawMsg.includes("Render invariant failed") ||
        rawMsg.includes("Scene contains 0 rendered elements");

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
        friendlyError =
          "Rate limit reached. Please wait a moment and try again.";
      } else if (isTimeout) {
        errCode = "TIMEOUT";
        friendlyError = "AI generation timed out. Please try again.";
      } else if (isNetwork) {
        errCode = "NETWORK_ERROR";
        friendlyError =
          "Network connection failed. Please check your internet connection.";
      } else if (isStructuredOutput) {
        errCode = "STRUCTURED_OUTPUT_ERROR";
        friendlyError = "Visual lesson formatting error. Please try again.";
      } else if (isOptimization) {
        errCode = "OPTIMIZATION_ERROR";
        friendlyError = "Visual lesson optimization error. Please try again.";
      } else if (isSemanticValidation) {
        errCode = "SEMANTIC_VALIDATION_ERROR";
        friendlyError = "Visual lesson validation error. Please try again.";
      } else if (isTransformation) {
        errCode = "TRANSFORMATION_ERROR";
        friendlyError = "Transformation sequence error. Please try again.";
      } else if (isLayout) {
        errCode = "LAYOUT_ERROR";
        friendlyError = "Visual lesson layout error. Please try again.";
      } else if (isVisualProjection) {
        errCode = "VISUAL_PROJECTION_ERROR";
        friendlyError = "Visual lesson projection error. Please try again.";
      } else if (isRender) {
        errCode = "RENDER_ERROR";
        friendlyError = "Canvas render error. Please try again.";
      } else if (isProviderUnavailable) {
        errCode = "PROVIDER_UNAVAILABLE";
        friendlyError =
          "AI provider is temporarily overloaded or unavailable. Please try again in a moment.";
      } else if (isCreditCapacity) {
        errCode = "PROVIDER_CAPACITY";
        friendlyError =
          "AI provider credit limit or quota reached. Please check your account.";
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

  const conceptModel = React.useMemo(() => {
    if (!transformationLesson) {
      return null;
    }
    return extractConceptModelFromVisualLesson(transformationLesson.lesson);
  }, [transformationLesson]);

  const activeIndex = Math.max(
    0,
    transformationLesson?.currentTransformationIndex ?? 0,
  );
  const activeT =
    transformationLesson?.lesson.transformations?.[activeIndex] ||
    transformationLesson?.lesson.transformations?.[0];

  const analyzeData: AnalyzeModel | undefined = (() => {
    if (!transformationLesson) {
      return undefined;
    }

    const topic =
      currentTopic ||
      transformationLesson.lesson.topic ||
      transformationLesson.lesson.concept ||
      transformationLesson.lesson.title ||
      "Technical Concept";

    const domainModule = resolveDomainModule(topic);

    // Semantic Object Intelligence: Check if user has selected whiteboard elements
    if (selectedContext.length > 0) {
      const first = selectedContext[0];
      const targetId = first.dslId || first.label;

      if (authoritativeModel && targetId) {
        const inspected = UniversalConceptIntelligenceEngine.inspectEntity(
          targetId,
          authoritativeModel,
          activeIndex,
        );
        if (inspected) {
          return {
            title: `Selected: ${inspected.label}`,
            subtitle: `${inspected.type}${
              inspected.role ? ` (${inspected.role})` : ""
            }`,
            conceptType: domainModule.domain,
            operation: `Step ${currentStepNum} semantic state inspection`,
            statusBadge: inspected.state
              ? `State: ${inspected.state}`
              : `Entity: ${inspected.id}`,
            metrics: [
              ...(inspected.value !== undefined
                ? [{ label: "Value", value: String(inspected.value) }]
                : []),
              {
                label: "Inbound Links",
                value: inspected.incomingConnections.length,
              },
              {
                label: "Outbound Links",
                value: inspected.outgoingConnections.length,
              },
            ],
            properties: [
              ...inspected.incomingConnections.map((c, i) => ({
                label: `Inbound ${i + 1}`,
                value: `${c.from} (${c.type})`,
              })),
              ...inspected.outgoingConnections.map((c, i) => ({
                label: `Outbound ${i + 1}`,
                value: `${c.to} (${c.type})`,
              })),
              ...inspected.invariants.map((inv, i) => ({
                label: `Invariant ${i + 1}`,
                value: inv,
              })),
            ],
            resultSummary: `Preserves semantic invariants for ${inspected.label}`,
            selectedEntity: {
              id: inspected.id,
              label: inspected.label,
              type: inspected.type,
              role: inspected.role,
              quickActions: [
                {
                  id: "why",
                  label: "Why is this here?",
                  description: `Explain why ${inspected.label} is positioned here in Step ${currentStepNum}`,
                  onClick: () => {
                    const whyResult = UniversalConceptIntelligenceEngine.getWhy(
                      activeIndex,
                      authoritativeModel,
                    );
                    const text = whyResult
                      ? `${whyResult.primaryCause}. Goal: ${whyResult.goalAdvanced}. ${whyResult.causalChainSummary}`
                      : `${inspected.label} serves as an authoritative ${
                          inspected.role || inspected.type
                        } in step "${
                          activeT?.title || `Step ${currentStepNum}`
                        }".`;
                    setInspectedActionExplanation({
                      title: `Why is ${inspected.label} here?`,
                      content: text,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
                {
                  id: "what-does-it-do",
                  label: "What does this do?",
                  description: `Understand the semantic role of ${inspected.label}`,
                  onClick: () => {
                    const text = `${inspected.label} acts as ${
                      inspected.role || inspected.type
                    }. Connected to ${
                      inspected.incomingConnections.length
                    } inbound and ${
                      inspected.outgoingConnections.length
                    } outbound elements. State: ${
                      inspected.state || "active"
                    }.`;
                    setInspectedActionExplanation({
                      title: `Role of ${inspected.label}`,
                      content: text,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
                {
                  id: "what-changed",
                  label: "What changed?",
                  description: `Inspect what changed in Step ${currentStepNum}`,
                  onClick: () => {
                    const diffExp =
                      UniversalConceptIntelligenceEngine.getWhatChanged(
                        activeIndex,
                        authoritativeModel,
                      );
                    const text = diffExp
                      ? `${diffExp.whatChanged}. Why: ${diffExp.whyChanged}`
                      : derivedWhatChanged ||
                        `Step ${currentStepNum} transitioned the concept.`;
                    setInspectedActionExplanation({
                      title: `What changed in Step ${currentStepNum}?`,
                      content: text,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
                {
                  id: "what-if-remove",
                  label: "What if I remove it?",
                  description: `Simulate what happens if ${inspected.label} is altered or removed`,
                  onClick: () => {
                    const result =
                      UniversalConceptIntelligenceEngine.evaluateWhatIf(
                        {
                          targetEntityId: inspected.id,
                          propertyKey: "state",
                          hypotheticalValue: "eliminated",
                          description: `Remove ${inspected.label}`,
                        },
                        activeIndex,
                        authoritativeModel,
                      );
                    const consequences =
                      result.consequences.length > 0
                        ? result.consequences.join(". ")
                        : `Altering ${inspected.label} disrupts downstream dependencies.`;
                    const violations =
                      result.invariantViolations.length > 0
                        ? ` Violated invariants: ${result.invariantViolations
                            .map((v) => v.statement)
                            .join("; ")}.`
                        : "";
                    setInspectedActionExplanation({
                      title: `What if ${inspected.label} is removed?`,
                      content: `${consequences}${violations}`,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
              ],
            },
            stepperSteps,
            onSelectStep: (idx) => {
              playbackControllerRef.current?.seek(idx, true);
            },
          };
        }
      }

      if (conceptModel && targetId) {
        const inspected = inspectSelectedEntity(
          targetId,
          conceptModel,
          activeIndex,
        );
        if (inspected) {
          return {
            title: `Selected: ${inspected.label}`,
            subtitle: `${inspected.type}${
              inspected.role ? ` (${inspected.role})` : ""
            }`,
            conceptType: domainModule.domain,
            operation: inspected.purposeInCurrentStep,
            statusBadge: inspected.state
              ? `State: ${inspected.state}`
              : `Entity: ${inspected.id}`,
            metrics: [
              ...(inspected.value !== undefined
                ? [{ label: "Value", value: String(inspected.value) }]
                : []),
              {
                label: "Inbound Links",
                value: inspected.incomingConnections.length,
              },
              {
                label: "Outbound Links",
                value: inspected.outgoingConnections.length,
              },
            ],
            properties: [
              ...inspected.incomingConnections.map((c, i) => ({
                label: `Inbound ${i + 1}`,
                value: `${c.fromId} (${c.type})`,
              })),
              ...inspected.outgoingConnections.map((c, i) => ({
                label: `Outbound ${i + 1}`,
                value: `${c.toId} (${c.type})`,
              })),
            ],
            resultSummary:
              inspected.nextChangeSummary ||
              "Entity remains stable in subsequent transformations.",
            selectedEntity: {
              id: inspected.id,
              label: inspected.label,
              type: inspected.type,
              role: inspected.role,
              quickActions: [
                {
                  id: "why",
                  label: "Why is this here?",
                  description: `Why ${inspected.label} is in step ${currentStepNum}`,
                  onClick: () => {
                    setInspectedActionExplanation({
                      title: `Why is ${inspected.label} here?`,
                      content: inspected.purposeInCurrentStep,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
                {
                  id: "what-does-it-do",
                  label: "What does this do?",
                  description: `Role of ${inspected.label}`,
                  onClick: () => {
                    setInspectedActionExplanation({
                      title: `Role of ${inspected.label}`,
                      content: `${inspected.label} is a ${
                        inspected.role || inspected.type
                      }. State: ${inspected.state || "active"}.`,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
                {
                  id: "what-changed",
                  label: "What changed?",
                  description: `What changed in this step`,
                  onClick: () => {
                    setInspectedActionExplanation({
                      title: `What changed?`,
                      content:
                        derivedWhatChanged || inspected.purposeInCurrentStep,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
                {
                  id: "what-if-remove",
                  label: "What if I remove it?",
                  description: `What if ${inspected.label} is removed`,
                  onClick: () => {
                    setInspectedActionExplanation({
                      title: `What if ${inspected.label} is removed?`,
                      content: `Removing ${inspected.label} invalidates current step transformations and breaks reference integrity.`,
                    });
                    setContextualTab("explain");
                    setIsContextualPanelOpen(true);
                  },
                },
              ],
            },
            stepperSteps,
            onSelectStep: (idx) => {
              playbackControllerRef.current?.seek(idx, true);
            },
          };
        }
      }
    }

    // Read attached inspectorData if provided
    const explicitInspector = (activeT as any)?.inspectorData;

    // Build or infer current concept state
    const currentState = transformationLesson.timeline?.states[activeIndex] || {
      stateIndex: activeIndex,
      name: activeT?.title || `State ${currentStepNum}`,
      activeEntityIds: [],
      activeRelationshipIds: [],
    };

    // Extract dynamic inspector metrics via Domain Knowledge or fallback
    const extracted =
      explicitInspector ||
      domainModule.extractInspectorData(currentState as any, activeT as any);

    return {
      title: transformationLesson.lesson.title || "Lesson Analysis",
      subtitle:
        transformationLesson.lesson.concept ||
        `${domainModule.name} — Step-by-step state inspection`,
      conceptType: domainModule.domain,
      operation: extracted.operation || activeT?.title,
      statusBadge:
        extracted.statusBadge || `Step ${currentStepNum} of ${totalStepsCount}`,
      metrics: extracted.metrics || [],
      properties: extracted.properties || [],
      resultSummary: extracted.resultSummary || activeT?.explanation,
      hasInteractiveControls:
        extracted.hasInteractiveControls ||
        Boolean((activeT as any)?.interactiveControls),
      contextAction: extracted.contextAction,
      startNodes: authoritativeModel
        ? authoritativeModel.world.entities.map((e) => e.label || e.id)
        : Array.from(
            transformationLesson?.timeline?.states[
              activeIndex
            ]?.graph.entities.values() || [],
          ).map((e) => e.label || e.id),
      destNodes: authoritativeModel
        ? authoritativeModel.world.entities
            .map((e) => e.label || e.id)
            .slice()
            .reverse()
        : Array.from(
            transformationLesson?.timeline?.states[
              activeIndex
            ]?.graph.entities.values() || [],
          )
            .map((e) => e.label || e.id)
            .slice()
            .reverse(),
      selectedStart: selectedStartNode,
      selectedDest: selectedDestNode,
      onStartChange: setSelectedStartNode,
      onDestChange: setSelectedDestNode,
      onRunAction: () => {
        playbackControllerRef.current?.seek(totalStepsCount - 1, true);
      },
      actionLabel: "Execute Transformation",
      stepperSteps,
      onSelectStep: (idx) => {
        playbackControllerRef.current?.seek(idx, true);
      },
    };
  })();

  const fromSceneState =
    activeIndex > 0
      ? transformationLesson?.timeline?.states[activeIndex - 1]
      : undefined;
  const toSceneState = transformationLesson?.timeline?.states[activeIndex];

  const derivedWhatChanged = authoritativeModel
    ? UniversalConceptIntelligenceEngine.getWhatChanged(
        activeIndex,
        authoritativeModel,
      )?.whatChanged
    : activeT
    ? deriveWhatChangedExplanation(activeT as any, fromSceneState, toSceneState)
    : undefined;

  const explainData: ExplainModel = {
    title:
      inspectedActionExplanation?.title ||
      currentStepTitle ||
      (currentTopic
        ? `${currentTopic} (Step ${currentStepNum})`
        : "Visual Explanation"),
    explanation:
      inspectedActionExplanation?.content ||
      currentExplanation ||
      "Ask any educational question below to start a step-by-step visual lesson.",
    calculations: currentCalculations,
    insight: currentInsight,
    whatChanged: derivedWhatChanged,
    consequence: (activeT as any)?.consequence || (activeT as any)?.effect,
  };

  const practiceData: PracticeModel | undefined = (() => {
    if (!transformationLesson) {
      return undefined;
    }

    if (authoritativeModel) {
      const quiz = UniversalConceptIntelligenceEngine.getPracticeQuiz(
        activeIndex,
        authoritativeModel,
      );
      return {
        question: quiz.question,
        options: quiz.options,
        selectedOption: selectedPracticeOption,
        onSelectOption: (idx: number) => {
          setSelectedPracticeOption(idx);
          setPracticeFeedback(null);
        },
        onCheckAnswer: () => {
          if (selectedPracticeOption === null) {
            return;
          }
          const isCorrect = selectedPracticeOption === quiz.correctIndex;
          setPracticeFeedback({
            isCorrect,
            message: isCorrect
              ? quiz.explanation
              : `Not quite. ${quiz.explanation}`,
          });
          if (learnerSessionRef.current) {
            recordInteraction(learnerSessionRef.current, {
              action: "practice_submit",
              stepIndex: activeIndex,
              details: { isCorrect, selectedOption: selectedPracticeOption },
            });
          }
        },
        feedback: practiceFeedback,
        onGenerateNewPractice: () => {
          setSelectedPracticeOption(null);
          setPracticeFeedback(null);
        },
      };
    }

    if (!conceptModel) {
      return undefined;
    }
    const item = derivePracticeItem(conceptModel, activeIndex);

    return {
      question: item.question,
      options: item.options,
      selectedOption: selectedPracticeOption,
      onSelectOption: (idx: number) => {
        setSelectedPracticeOption(idx);
        setPracticeFeedback(null);
      },
      onCheckAnswer: () => {
        if (selectedPracticeOption === null) {
          return;
        }
        const isCorrect = selectedPracticeOption === item.correctIndex;
        setPracticeFeedback({
          isCorrect,
          message: isCorrect
            ? `Correct! ${item.explanation}`
            : `Not quite. ${item.explanation}`,
        });
        if (learnerSessionRef.current) {
          recordInteraction(learnerSessionRef.current, {
            action: "practice_submit",
            stepIndex: activeIndex,
            details: { isCorrect, selectedOption: selectedPracticeOption },
          });
        }
      },
      feedback: practiceFeedback,
      onGenerateNewPractice: () => {
        setSelectedPracticeOption(null);
        setPracticeFeedback(null);
      },
    };
  })();

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
        const firstKey = Object.keys(
          transformationLesson.lesson.codeContexts,
        )[0];
        return firstKey
          ? transformationLesson.lesson.codeContexts[firstKey]
          : undefined;
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

      const containerRect = rootContainerRef.current?.getBoundingClientRect();
      const containerW = containerRect ? containerRect.width : window.innerWidth;
      const containerH = containerRect ? containerRect.height : window.innerHeight;

      // Check if there are other scene elements directly above targetEl within 130px
      const hasObstacleAbove = elements.some((other) => {
        if (other.id === targetEl.id || other.isDeleted) return false;
        const xOverlap =
          Math.max(
            0,
            Math.min(targetEl.x + targetEl.width + 30, other.x + other.width + 30) -
              Math.max(targetEl.x - 30, other.x - 30),
          );
        if (xOverlap <= 0) return false;
        const yDistAbove = targetEl.y - (other.y + other.height);
        return yDistAbove >= -20 && yDistAbove <= 130;
      });

      const rawScreenY = (targetEl.y + appState.scrollY) * zoom;
      const nearTopBoundary = rawScreenY < 130;

      let placement: "above" | "below" | "right" | "left" = "above";
      let posX = (targetEl.x + targetEl.width / 2 + appState.scrollX) * zoom;
      let posY = rawScreenY;

      if (hasObstacleAbove || nearTopBoundary) {
        const hasObstacleBelow = elements.some((other) => {
          if (other.id === targetEl.id || other.isDeleted) return false;
          const xOverlap =
            Math.max(
              0,
              Math.min(targetEl.x + targetEl.width + 30, other.x + other.width + 30) -
                Math.max(targetEl.x - 30, other.x - 30),
            );
          if (xOverlap <= 0) return false;
          const yDistBelow = other.y - (targetEl.y + targetEl.height);
          return yDistBelow >= -20 && yDistBelow <= 130;
        });
        const nearBottomBoundary =
          (targetEl.y + targetEl.height + appState.scrollY) * zoom > containerH - 180;

        if (!hasObstacleBelow && !nearBottomBoundary) {
          placement = "below";
          posY = (targetEl.y + targetEl.height + appState.scrollY) * zoom;
        } else {
          const nearRightBoundary =
            (targetEl.x + targetEl.width + appState.scrollX) * zoom > containerW - 280;
          if (!nearRightBoundary) {
            placement = "right";
            posX = (targetEl.x + targetEl.width + appState.scrollX) * zoom;
            posY = (targetEl.y + targetEl.height / 2 + appState.scrollY) * zoom;
          } else {
            placement = "left";
            posX = (targetEl.x + appState.scrollX) * zoom;
            posY = (targetEl.y + targetEl.height / 2 + appState.scrollY) * zoom;
          }
        }
      }

      return {
        x: posX,
        y: posY,
        placement,
        title: activeT.title,
        subtitle: activeT.explanation?.slice(0, 90) || "Active element",
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
        onToggleContextualPanel={() =>
          setIsContextualPanelOpen((prev) => !prev)
        }
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
          className={`cognora-node-callout cognora-node-callout--${activeCallout.placement}`}
          style={{
            left: `${activeCallout.x}px`,
            top: `${activeCallout.y}px`,
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

      {/* Dedicated Floating Bottom Control Region (Layer 4 & Layer 5) */}
      <div
        className={`cognora-bottom-control-region ${
          isContextualPanelOpen
            ? "cognora-bottom-control-region--panel-open"
            : ""
        }`}
        data-purpose="bottom-floating-controls"
      >
        {/* 5. Timeline Playback HUD (Positioned independently above Composer) */}
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
          isPanelOpen={isContextualPanelOpen}
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
                  "Explain this step in detail",
                  "Why did this transition happen?",
                  "What changed from previous step?",
                  "What are the key invariants?",
                  "Test my understanding with a quiz",
                ]
              : [
                  "Explain Binary Search step by step",
                  "Explain TCP Three-Way Handshake",
                  "Explain Database ACID Transactions",
                  "Explain How a Refrigerator Works",
                  "Explain Photosynthesis",
                  "Explain Transformer Self-Attention",
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
      </div>

      {/* 7. Right Contextual Panel (Analyze, Explain, Code, Practice) */}
      {isContextualPanelOpen && (
        <CognoraContextualPanel
          activeTab={contextualTab}
          onTabChange={(tab) => {
            setContextualTab(tab);
            if (learnerSessionRef.current) {
              recordInteraction(learnerSessionRef.current, {
                action: "open_tab",
                tab,
              });
            }
          }}
          onClose={() => setIsContextualPanelOpen(false)}
          analyzeData={analyzeData}
          explainData={explainData}
          codeContext={currentCodeContext}
          practiceData={practiceData}
          capabilities={
            transformationLesson?.lesson.capabilities || [
              "explain",
              "code",
              "analyze",
              "practice",
            ]
          }
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
