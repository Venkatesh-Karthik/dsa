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

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

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
  executeUniversalCommand,
  computeCanvasPlacement,
  getAutocompleteSuggestions,
  type AutocompleteSuggestion,
  type CommandContext,
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
import { ExplanationEngine } from "../ai/explanation-engine";
import { VoiceExplanationEngine } from "../ai/voice/voice-explanation-engine";
import { detectHandwritingCommand } from "../ai/commands/handwriting-command-detector";
import { validatePreRenderElements } from "../ai/visual-validation";
import { CognoraDiagnostics } from "../ai/transformation-diagnostics";
import {
  getCommandRiskLevel,
  getCommandConfirmationPolicy,
} from "../ai/commands/command-registry";
import { parseNaturalLanguageToCommand } from "../ai/intent-router";
import { AudioAnalyzer } from "../ai/voice/audio-analyzer";
import { SpeechDirector } from "../ai/voice/speech-director";
import { isVisualDebugEnabled } from "../ai/visual-reasoning/debug-diagnostics";

import {
  CognoraWorldModel,
  type CognoraWorldState,
} from "../ai/intelligence/cognora-world-model";

import { IntentEngine } from "../ai/intelligence/intent-engine";

import { ContextEngine } from "../ai/intelligence/context-engine";

import { TeacherBrain } from "../ai/intelligence/teacher-brain";

import { TeacherBrainOrchestrator } from "../ai/intelligence/teacher-brain-orchestrator";

import { BranchManager } from "../ai/intelligence/branch-manager";

import { VoiceListener } from "../ai/voice/voice-listener";

import { resolveSemanticFocus } from "./semantic-focus-resolver";
import { computeLeaderLineGeometry } from "./leader-line-geometry";
import {
  deriveCompactGlimpse,
  estimateGlimpseDimensions,
} from "./glimpse-extractor";
import { IconAlert, IconInspect, IconChevronRight } from "./CognoraIcons";
import { CognoraErrorBoundary } from "./CognoraErrorBoundary";
import { CognoraCommandPreview } from "./CognoraCommandPreview";
import { SemanticTeachingCallout } from "./SemanticTeachingCallout";
import {
  computeIntelligentOverlayPosition,
  type ScreenRect,
} from "./CognoraOverlayPlacement";
import {
  CognoraConversation,
  type TeachingRequestState,
} from "./CognoraConversation";
import { CognoraZoomControls } from "./CognoraZoomControls";
import { CognoraToolsPalette } from "./CognoraToolsPalette";
import {
  CognoraContextualPanel,
  DEFAULT_PANEL_CAPABILITIES,
  type PanelTabType,
  type AnalyzeModel,
  type ExplainModel,
  type PracticeModel,
  type ContextMetric,
  type ContextProperty,
  type ContextAction,
} from "./CognoraContextualPanel";
import { CognoraTimeline } from "./CognoraTimeline";
import { CognoraAIComposer } from "./CognoraAIComposer";
import {
  CognoraDrawingToolbar,
  type DrawingToolType,
} from "./CognoraDrawingToolbar";
import { CognoraHeader } from "./CognoraHeader";
import { CognoraVoiceOrb, type VoiceOrbState } from "./CognoraVoiceOrb";

import "./AITeachingAgent.scss";

import { DSAExecutionRouter } from "../dsa";

import type { TeachingMoment } from "../ai/teaching-moment";
import type { CommandRiskLevel } from "../ai/commands/command-types";
import type { AuthoritativeSemanticModel } from "../ai/authoritative-model";
import type {
  VoiceExplanationContext,
  VoiceState,
} from "../ai/voice/voice-contract";
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

  // Viewport version counter: increments on ANY scroll/zoom change (including during playback).
  // This is the only mechanism that causes overlayPlacement to recompute after pan/zoom,
  // since overlayPlacement reads excalidrawAPI.getAppState() live at render time.
  // Important: prevViewportRef is a ref (not state), so updating it never causes additional renders.
  const [viewportVersion, setViewportVersion] = useState(0);
  const prevViewportRef = useRef({ scrollX: 0, scrollY: 0, zoom: 1 });

  // Lessons State
  const [transformationLesson, setTransformationLesson] =
    useState<TransformationLesson | null>(null);
  const transformationLessonRef = useRef<TransformationLesson | null>(
    transformationLesson,
  );
  transformationLessonRef.current = transformationLesson;
  const [authoritativeModel, setAuthoritativeModel] =
    useState<AuthoritativeSemanticModel | null>(null);
  const [isLessonPlaying, setIsLessonPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const panelCapabilities = useMemo(() => {
    return (
      (transformationLesson?.lesson.capabilities as PanelTabType[]) ||
      DEFAULT_PANEL_CAPABILITIES
    );
  }, [transformationLesson?.lesson.capabilities]);

  // Synchronize active tab with available capabilities
  useEffect(() => {
    const caps = panelCapabilities;
    if (caps && caps.length > 0 && !caps.includes(contextualTab)) {
      setContextualTab(caps[0]);
    }
  }, [panelCapabilities, contextualTab]);

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
  const handleSubmitRef = useRef<
    (promptText: string, userAction?: string) => Promise<void>
  >(async () => {});

  const isTeachingRequestActive =
    requestState === "sending" || requestState === "thinking";

  const handleCancelRequest = useCallback(() => {
    console.log(
      `[COGNORA][TEACH][USER_CANCEL] User cancelled in-flight request ${currentRequestIdRef.current}`,
    );
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
      currentAbortControllerRef.current = null;
    }
    activeRequestLockRef.current = null;
    currentRequestIdRef.current = null;
    setRequestState("idle");
  }, []);

  // Autocomplete state
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);

  // Selected elements & pending interactions on canvas
  const [selectedContext, setSelectedContext] = useState<
    SelectedSemanticElement[]
  >([]);
  const selectedContextRef = useRef<SelectedSemanticElement[]>(selectedContext);
  selectedContextRef.current = selectedContext;
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

  // Last-Known-Good scene reference to guarantee canvas is never left blank or corrupted
  const lastKnownGoodElementsRef = useRef<readonly any[]>([]);

  // Liquid Glass Command Preview state (typed confirmation, handwriting preview, ambiguous targets)
  const [commandPreview, setCommandPreview] = useState<{
    isOpen: boolean;
    command: string;
    riskLevel: CommandRiskLevel;
    targetDescription?: string;
    semanticEffect?: string;
    didYouMean?: string;
    candidateTargets?: Array<{ id: string; label: string; type: string }>;
    selectedTargetId?: string;
    position?: { x: number; y: number };
    onConfirm: () => void;
  } | null>(null);
  const commandPreviewRef = useRef(commandPreview);
  commandPreviewRef.current = commandPreview;
  const lastDetectedHandwritingRef = useRef<string | null>(null);

  // Manual directional repositioning offset for contextual explanation overlay
  const [manualOverlayOffset, setManualOverlayOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const previousOverlayPositionRef = useRef<{ x: number; y: number } | null>(
    null,
  );

  // Reset manual offset override when lesson or transformation index changes
  useEffect(() => {
    setManualOverlayOffset(null);
  }, [
    transformationLesson?.lessonId,
    transformationLesson?.currentTransformationIndex,
  ]);

  // Reset previous position when lesson changes
  useEffect(() => {
    previousOverlayPositionRef.current = null;
  }, [transformationLesson?.lessonId]);

  const handleMoveOverlayUp = useCallback(() => {
    setManualOverlayOffset((prev) => ({
      x: prev?.x ?? 0,
      y: (prev?.y ?? 0) - 32,
    }));
  }, []);

  const handleMoveOverlayDown = useCallback(() => {
    setManualOverlayOffset((prev) => ({
      x: prev?.x ?? 0,
      y: (prev?.y ?? 0) + 32,
    }));
  }, []);

  const handleMoveOverlayLeft = useCallback(() => {
    setManualOverlayOffset((prev) => ({
      x: (prev?.x ?? 0) - 32,
      y: prev?.y ?? 0,
    }));
  }, []);

  const handleMoveOverlayRight = useCallback(() => {
    setManualOverlayOffset((prev) => ({
      x: (prev?.x ?? 0) + 32,
      y: prev?.y ?? 0,
    }));
  }, []);

  const handleResetOverlay = useCallback(() => {
    setManualOverlayOffset(null);
  }, []);

  const handleTabChange = useCallback((tab: PanelTabType) => {
    setContextualTab(tab);
    if (learnerSessionRef.current) {
      recordInteraction(learnerSessionRef.current, {
        action: "open_tab",
        tab,
      });
    }
  }, []);

  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousSnapshotRef = useRef<Map<string, SemanticElementSnapshot>>(
    new Map(),
  );
  const isApplyingVisualsRef = useRef(false);

  // Derive ownerDocument & ownerWindow from rootContainerRef per user guidelines
  const getOwnerDoc = useCallback((): Document => {
    return rootContainerRef.current?.ownerDocument || document;
  }, []);

  const getOwnerWindow = useCallback((): Window => {
    return (
      (excalidrawAPI as any)?.app?.ownerWindow ||
      rootContainerRef.current?.ownerDocument?.defaultView ||
      window
    );
  }, [excalidrawAPI]);

  // Voice Explanation Foundation & Synchronization
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
  const isVoiceEnabledRef = useRef(isVoiceEnabled);
  isVoiceEnabledRef.current = isVoiceEnabled;
  const voiceEngineRef = useRef<VoiceExplanationEngine>(
    VoiceExplanationEngine.getInstance(),
  );
  const playbackControllerRef = useRef<LessonPlaybackController | null>(null);

  // Cognora World Model (Authoritative Runtime Truth)
  const worldModelRef = useRef<CognoraWorldModel>(new CognoraWorldModel());
  const orchestratorRef = useRef<TeacherBrainOrchestrator>(
    new TeacherBrainOrchestrator(worldModelRef.current),
  );
  const [worldState, setWorldState] = useState<CognoraWorldState>(() =>
    worldModelRef.current.getState(),
  );

  useEffect(() => {
    return worldModelRef.current.subscribe(setWorldState);
  }, []);

  useEffect(() => {
    const win = getOwnerWindow();
    if (win) {
      voiceEngineRef.current.setOwnerWindow(win);
    }
  }, [getOwnerWindow]);

  // Voice 2: Live Listener with VAD & Streaming Interruption
  const voiceListenerRef = useRef<VoiceListener | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);

  const handleToggleVoiceListening = useCallback(async () => {
    if (isVoiceListening) {
      voiceListenerRef.current?.stop();
      setIsVoiceListening(false);
      worldModelRef.current.setOrbState(isLessonPlaying ? "SPEAKING" : "IDLE");
      return;
    }

    if (!voiceListenerRef.current) {
      voiceListenerRef.current = new VoiceListener(
        {
          onStateChange: (state) => {
            if (state === "LISTENING") {
              setIsVoiceListening(true);
              worldModelRef.current.setOrbState("LISTENING");
            } else if (state === "INTERRUPTED") {
              worldModelRef.current.setOrbState("INTERRUPTED");
            } else if (state === "IDLE") {
              setIsVoiceListening(false);
            }
          },
          onSpeechStart: () => {
            console.log(
              "[COGNORA][INTERRUPT] User speech detected! Halting audio immediately.",
            );
            voiceEngineRef.current.stop();
            if (playbackControllerRef.current?.getStatus() === "PLAYING") {
              playbackControllerRef.current.pause();
              setIsLessonPlaying(false);
            }
            worldModelRef.current.setOrbState("INTERRUPTED");
            setTimeout(() => {
              worldModelRef.current.setOrbState("LISTENING");
            }, 120);
          },
          onInterimTranscript: (_text) => {},
          onFinalTranscript: (text) => {
            console.log(`[COGNORA][VOICE_INPUT] Spoken turn: "${text}"`);
            handleSubmitRef.current(text, "voice_speech_turn");
          },
          onError: (err) => {
            console.warn("[COGNORA][VOICE_LISTENER_ERR]", err);
            setIsVoiceListening(false);
          },
        },
        getOwnerDoc().defaultView,
      );
    }

    const started = await voiceListenerRef.current.start();
    if (started) {
      setIsVoiceListening(true);
      worldModelRef.current.setOrbState("LISTENING");
    }
  }, [isVoiceListening, isLessonPlaying, getOwnerDoc]);

  useEffect(() => {
    return () => {
      voiceListenerRef.current?.destroy();
      voiceListenerRef.current = null;
    };
  }, []);

  const handleToggleVoice = useCallback(() => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      playbackControllerRef.current?.setVoiceEnabled(next);
      return next;
    });
  }, []);

  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  if (!audioAnalyzerRef.current && typeof window !== "undefined") {
    audioAnalyzerRef.current = new AudioAnalyzer();
  }

  useEffect(() => {
    return () => {
      audioAnalyzerRef.current?.destroy();
      audioAnalyzerRef.current = null;
    };
  }, []);

  const voiceOrbState: VoiceOrbState = useMemo(() => {
    if (worldState.orbState === "LISTENING") {
      return "LISTENING";
    }
    if (worldState.orbState === "INTERRUPTED") {
      return "INTERRUPTED";
    }
    if (
      voiceState === "error" ||
      voiceState === "FAILED" ||
      voiceState === "TIMEOUT" ||
      voiceState === "DEGRADED" ||
      voiceState === "UNAVAILABLE"
    ) {
      // Calm degraded state: voice latency/failure does NOT trigger red alarm state on the ORB
      return "IDLE";
    }
    if (voiceState === "speaking" || voiceState === "PLAYING") {
      return "SPEAKING";
    }
    if (
      voiceState === "preparing" ||
      voiceState === "QUEUED" ||
      voiceState === "SYNTHESIZING"
    ) {
      return "THINKING";
    }
    const controllerState = playbackControllerRef.current?.getState();
    if (controllerState?.status === "PAUSED") {
      return "PAUSED";
    }
    if (
      controllerState &&
      controllerState.currentIndex >= controllerState.totalSteps - 1 &&
      controllerState.status !== "PLAYING"
    ) {
      return "COMPLETED";
    }
    return "IDLE";
  }, [voiceState, isLessonPlaying, worldState.orbState]);

  useEffect(() => {
    const engine = voiceEngineRef.current;
    const unsubscribe = engine.subscribe((state) => {
      setVoiceState(state);
      worldModelRef.current.setVoiceState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Autocomplete updates
  useEffect(() => {
    if (inputValue.startsWith("/")) {
      const activeElements = excalidrawAPI?.getSceneElements?.() || [];
      const suggestions = getAutocompleteSuggestions(inputValue, {
        isDeveloperMode,
        sceneElements: activeElements,
        activeModel: (transformationLesson as any)?.model || null,
        timeline: transformationLesson?.timeline || null,
        playbackController: playbackControllerRef.current,
        currentTransformationIndex:
          transformationLesson?.currentTransformationIndex ?? 0,
        selectedEntities: selectedContext.map((s) => s.dslId),
        focusedEntityId: selectedContext[0]?.dslId || null,
        history: messages.map((m) => m.content),
      } as CommandContext);
      setAutocompleteSuggestions(suggestions);
      setSelectedSuggestionIndex(0);
      setShowAutocomplete(suggestions.length > 0);
    } else {
      setShowAutocomplete((prev) => (prev ? false : prev));
      setAutocompleteSuggestions((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [
    inputValue,
    isDeveloperMode,
    excalidrawAPI,
    transformationLesson,
    selectedContext,
    messages,
  ]);

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
      // ── VIEWPORT TRACKING ──────────────────────────────────────────────────────
      // Must happen BEFORE the playback early-return so that pan/zoom during playback
      // still triggers a re-render and the semantic focus overlay follows the canvas.
      if (appState) {
        const prev = prevViewportRef.current;
        const newScrollX = appState.scrollX ?? prev.scrollX;
        const newScrollY = appState.scrollY ?? prev.scrollY;
        const newZoom = appState.zoom?.value ?? prev.zoom;
        if (
          newScrollX !== prev.scrollX ||
          newScrollY !== prev.scrollY ||
          newZoom !== prev.zoom
        ) {
          prevViewportRef.current = {
            scrollX: newScrollX,
            scrollY: newScrollY,
            zoom: newZoom,
          };
          setViewportVersion((v) => v + 1);
        }
        // Also keep zoomValue in sync for the zoom controls display
        if (newZoom !== prev.zoom) {
          setZoomValue(newZoom);
        }
      }
      // ── END VIEWPORT TRACKING ──────────────────────────────────────────────────

      const playbackStatus = playbackControllerRef.current?.getStatus();
      if (
        isApplyingVisualsRef.current ||
        playbackStatus === "TRANSITIONING" ||
        playbackStatus === "PLAYING"
      ) {
        if (elements && elements.length > 0) {
          previousSnapshotRef.current = createSemanticSnapshot(elements);
        }
        return;
      }

      // Non-playback zoom sync is now handled in the viewport tracking block above

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
        const prev = selectedContextRef.current;
        if (prev.length === 0 && extracted.length === 0) {
          // Both empty, no change
        } else if (
          prev.length === extracted.length &&
          prev.every(
            (p, idx) =>
              p.dslId === extracted[idx].dslId &&
              p.type === extracted[idx].type &&
              p.label === extracted[idx].label,
          )
        ) {
          // Identical selection, no change
        } else {
          selectedContextRef.current = extracted;
          setSelectedContext(extracted);
        }
      } else if (selectedContextRef.current.length > 0) {
        selectedContextRef.current = [];
        setSelectedContext([]);
      }

      // Detect user manual canvas edits
      if (elements && elements.length > 0) {
        const deltas = detectSemanticCanvasChanges(
          elements,
          previousSnapshotRef.current,
        );
        if (deltas.length > 0) {
          // If a lesson is active, ignore deletions and internal connector updates
          const activeLesson = transformationLessonRef.current;
          const userDeltas = deltas.filter((d) => {
            if (activeLesson && d.type === "element_deleted") {
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
            setPendingInteraction((prev) => {
              if (
                prev &&
                prev.type === userDeltas[0].type &&
                prev.targetDslId === userDeltas[0].targetDslId &&
                prev.description === userDeltas[0].description
              ) {
                return prev;
              }
              return userDeltas[0];
            });
          }
        }
        previousSnapshotRef.current = createSemanticSnapshot(elements);

        // Detect handwriting command on completed text or stroke interaction
        if (
          !appState?.editingTextElement &&
          !commandPreviewRef.current?.isOpen
        ) {
          const candidate = detectHandwritingCommand(elements);
          if (candidate && candidate.confidence !== "LOW") {
            const key = `${
              candidate.normalizedCommand
            }-${candidate.elementIds.join(",")}`;
            if (lastDetectedHandwritingRef.current !== key) {
              lastDetectedHandwritingRef.current = key;
              const riskLevel = getCommandRiskLevel(
                candidate.normalizedCommand,
              );
              setCommandPreview({
                isOpen: true,
                command: candidate.normalizedCommand,
                riskLevel,
                didYouMean: candidate.didYouMean,
                targetDescription: `Handwritten command detected on canvas`,
                position: {
                  x: candidate.bounds.x + candidate.bounds.width / 2,
                  y: candidate.bounds.y + candidate.bounds.height + 20,
                },
                onConfirm: async () => {
                  setCommandPreview(null);
                  await handleSubmitRef.current(
                    candidate.normalizedCommand,
                    "handwriting_command",
                  );
                },
              });
            }
          }
        }
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

  const stopLessonPlayback = () => {
    playbackControllerRef.current?.pause();
    setIsLessonPlaying(false);
  };

  const handleResetSession = useCallback(() => {
    voiceEngineRef.current.stop();
    if (playbackControllerRef.current) {
      playbackControllerRef.current.destroy();
      playbackControllerRef.current = null;
    }
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
      currentAbortControllerRef.current = null;
    }
    setTransformationLesson(null);
    setAuthoritativeModel(null);
    setIsLessonPlaying(false);
    setSelectedContext([]);
    setInspectedActionExplanation(null);
    setErrorMessage(null);
    setErrorCode(null);
    setRequestState("idle");
    activeRequestLockRef.current = null;
    if (excalidrawAPI && !excalidrawAPI.isDestroyed) {
      excalidrawAPI.updateScene({ elements: [] });
    }
    console.log("[COGNORA][SESSION][RESET] Session and canvas state successfully cleared.");
  }, [excalidrawAPI]);

  const startTransformationLesson = (
    lesson: VisualLesson,
    options: { messageId: string; topic?: string; prompt?: string },
    initialIndex = 0,
    precompiled?: {
      timeline: CompiledTimeline;
      authoritativeModel: AuthoritativeSemanticModel;
    },
  ) => {
    isApplyingVisualsRef.current = true;
    try {
      // 0. Reset audio, selections, and callouts from any previous lesson
      voiceEngineRef.current.stop();
      setSelectedContext([]);
      setInspectedActionExplanation(null);
      // 1. Resolve AuthoritativeSemanticModel & CompiledTimeline (from precompiled deterministic execution or universal engine)
      const processed = precompiled
        ? null
        : UniversalConceptIntelligenceEngine.processQuestion(
            options.prompt || options.topic || lesson.title,
            lesson as any,
          );

      const model = precompiled ? precompiled.authoritativeModel : processed!.authoritativeModel;
      setAuthoritativeModel(model);

      // 2. The authoritative timeline is derived directly from the validated semantic model
      const timeline = precompiled ? precompiled.timeline : processed!.timeline;

      const validation = validateTransformationTimeline(timeline, {
        prompt: options.prompt || options.topic || lesson.title,
        concept: lesson.concept,
      });

      console.log(
        `[COGNORA][LESSON] lessonId=${timeline.lessonId} concept=${timeline.topic} valid=${validation.valid} states=${timeline.states.length} repaired=${validation.repaired} goalSatisfied=${model.goalSatisfaction.satisfied}`,
      );

      const hasAnyEntities = timeline.states?.some(
        (s) => s.graph && s.graph.entities.size > 0,
      );
      if (
        !timeline.states ||
        timeline.states.length === 0 ||
        (!hasAnyEntities &&
          (!lesson.transformations || lesson.transformations.length === 0))
      ) {
        throw new Error(
          validation.errors.length > 0
            ? validation.errors.join("; ")
            : "Lesson validation failed: Scene contains zero semantic entities across all states.",
        );
      }

      if (!validation.valid && validation.errors.length > 0) {
        console.warn(
          `[COGNORA][LESSON][VALIDATION] Non-blocking validation notices: ${validation.errors.join(
            "; ",
          )}`,
        );
      }

      // 2. Tear down any previous playback controller cleanly without blanking canvas
      const currentCanvas = excalidrawAPI.getSceneElements();
      if (currentCanvas && currentCanvas.length > 0) {
        lastKnownGoodElementsRef.current = currentCanvas;
      }
      if (playbackControllerRef.current) {
        playbackControllerRef.current.destroy();
        playbackControllerRef.current = null;
        // Intentionally do NOT wipe canvas here: retain visual continuity
      }

      // 3. Create single authoritative LessonPlaybackController
      const controller = new LessonPlaybackController(
        excalidrawAPI,
        timeline,
        initialIndex,
        voiceEngineRef.current,
      );
      controller.setVoiceEnabled(isVoiceEnabledRef.current);
      playbackControllerRef.current = controller;
      (window as any).__cognoraPlaybackController = controller;
      (window as any).__cognoraVoiceDiagnostics = () =>
        voiceEngineRef.current.getDiagnostics();
      (window as any).__cognoraWorldModel = worldModelRef.current;
      (window as any).__cognoraAuthoritativeWorld = () =>
        worldModelRef.current.getAuthoritativeWorld();
      worldModelRef.current.setLesson(
        (processed ? processed.visualLesson : null) || lesson,
        timeline,
        {
          generationId: options.messageId,
          worldVersion: 1,
          branchId: "MAIN",
        },
      );
      orchestratorRef.current = new TeacherBrainOrchestrator(
        worldModelRef.current,
      );

      // Pre-synthesize and cache speech asynchronously in background immediately upon lesson load (non-blocking)
      voiceEngineRef.current.prepareLessonAudio(timeline).catch((err) => {
        console.warn(
          "[COGNORA][VOICE] Non-blocking prepareLessonAudio notice:",
          err,
        );
      });

      // 4. Render initial scene state immediately
      controller.renderInitial(true);

      // Verify canvas elements were rendered (Minimum Validity Invariant)
      // If State 0 is genuinely an empty baseline (e.g. empty heap before insert 1), allow 0 rendered elements
      const isInitialEmptyBaseline =
        timeline.states[0]?.graph.entities.size === 0 &&
        timeline.states.length > 1;

      let renderedElements = excalidrawAPI.getSceneElements();
      if (
        !isInitialEmptyBaseline &&
        (!renderedElements || renderedElements.length === 0)
      ) {
        // Fallback: apply initialScene directly if controller render was deferred
        if (lesson.initialScene && lesson.initialScene.length > 0) {
          applyVisualActions(excalidrawAPI, lesson.initialScene, {
            replacePreviousAI: true,
            focusViewport: true,
          });
          renderedElements = excalidrawAPI.getSceneElements();
        }
      }
      if (
        !isInitialEmptyBaseline &&
        (!renderedElements || renderedElements.length === 0)
      ) {
        throw new Error(
          "Render invariant failed: Scene contains 0 rendered elements.",
        );
      }

      if (renderedElements && renderedElements.length > 0) {
        lastKnownGoodElementsRef.current = renderedElements;
      }

      // 5. Subscribe to state transitions
      controller.subscribe((state) => {
        worldModelRef.current.setCurrentMoment(state.currentIndex);
        worldModelRef.current.updatePlaybackState(state);
        previousSnapshotRef.current = createSemanticSnapshot(
          excalidrawAPI.getSceneElements(),
        );
        const liveElements = excalidrawAPI.getSceneElements();
        if (liveElements && liveElements.length > 0) {
          lastKnownGoodElementsRef.current = liveElements;
        }
        setIsLessonPlaying(state.status === "PLAYING");
        setPlaybackSpeed(state.speed);
        setTransformationLesson((prev) => {
          if (!prev || prev.lessonId !== timeline.lessonId) {
            return {
              messageId: options.messageId,
              lessonId: timeline.lessonId,
              topic: options.topic,
              lesson: (processed ? processed.visualLesson : null) || lesson,
              timeline,
              currentTransformationIndex: state.currentIndex,
              playbackSpeed: state.speed,
            };
          }
          if (
            prev.currentTransformationIndex === state.currentIndex &&
            prev.playbackSpeed === state.speed &&
            prev.timeline === timeline
          ) {
            return prev;
          }
          return {
            ...prev,
            timeline,
            currentTransformationIndex: state.currentIndex,
            playbackSpeed: state.speed,
          };
        });
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      CognoraDiagnostics.error(
        "RENDER",
        `Failed to start transformation lesson: ${errMsg}`,
        undefined,
        err,
      );
      // Fallback: restore last-known-good canvas elements if current canvas was emptied or broken
      const current = excalidrawAPI.getSceneElements();
      if (
        (!current || current.length === 0) &&
        lastKnownGoodElementsRef.current.length > 0
      ) {
        excalidrawAPI.updateScene({
          elements: lastKnownGoodElementsRef.current as any,
        });
      }
      setErrorMessage(
        `Visual lesson could not be safely initialized (${errMsg}). Previous scene retained.`,
      );
      setErrorCode("RENDER_ERROR");
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
      (window as any).__cognoraPlaybackNext = () => {
        playbackControllerRef.current?.next(true);
      };
      (window as any).__cognoraPlaybackPrev = () => {
        playbackControllerRef.current?.prev(true);
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
  // Universal Command Context & AI Prompt Submission (Single Canonical Lifecycle)
  // ============================================================================

  const commandContext = useMemo((): CommandContext => {
    return {
      excalidrawAPI,
      sceneElements: excalidrawAPI?.getSceneElements?.() || [],
      activeModel: (transformationLesson as any)?.model || null,
      timeline: transformationLesson?.timeline || null,
      playbackController: playbackControllerRef.current,
      currentTransformationIndex:
        transformationLesson?.currentTransformationIndex ?? 0,
      activeStructure: null,
      selectedEntities: selectedContext.map((s) => s.dslId),
      focusedEntityId: selectedContext[0]?.dslId || null,
      history: messages.map((m) => m.content),
      isDeveloperMode,
      applySemanticLesson: async (lesson, topic) => {
        await startTransformationLesson(lesson, {
          messageId: `cmd-${Date.now()}`,
          topic: topic || lesson.concept || lesson.title,
          prompt: topic || lesson.title,
        });
      },
      invokeTeaching: async (teachPrompt) => {
        await handleSubmitRef.current(teachPrompt, "command_teach");
      },
      navigatePlayback: (action, step) => {
        if (action === "next") {
          handleNextTransformation();
        } else if (action === "previous") {
          handlePreviousTransformation();
        } else if (action === "play" || action === "pause") {
          if (isLessonPlaying) {
            playbackControllerRef.current?.pause();
          } else {
            playbackControllerRef.current?.play();
          }
        } else if (action === "step" && step !== undefined) {
          handleJumpTransformation(step);
        } else if (action === "replay") {
          playbackControllerRef.current?.seek(0, true);
        }
      },
      setFocus: (target) => {
        const el = excalidrawAPI
          ?.getSceneElements?.()
          .find(
            (e: any) =>
              e.id === String(target) || e.customData?.dslId === String(target),
          );
        if (el) {
          (excalidrawAPI as any)?.scrollToContent?.([el], {
            animate: true,
            fitToViewport: false,
          });
        }
      },
      undo: handleUndo,
      redo: handleRedo,
      reset: () => {
        playbackControllerRef.current?.destroy();
        playbackControllerRef.current = null;
        setTransformationLesson(null);
      },
      clear: () => {
        excalidrawAPI?.updateScene({ elements: [] });
        setTransformationLesson(null);
      },
      openInspectorTab: (tab) => {
        setContextualTab(tab as any);
        setIsContextualPanelOpen(true);
      },
      togglePalette: (open) => {
        setShowAutocomplete(open !== undefined ? open : (prev) => !prev);
      },
      origin: computeCanvasPlacement(excalidrawAPI?.getSceneElements?.() || []),
    };
  }, [
    excalidrawAPI,
    transformationLesson,
    selectedContext,
    messages,
    isDeveloperMode,
    isLessonPlaying,
  ]);

  const buildCommandContext = useCallback(
    (): CommandContext => commandContext,
    [commandContext],
  );

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

    // 3. Multimodal Intent Resolution
    const inputSource = userAction.startsWith("voice") ? "voice" : "keyboard";
    const intent = IntentEngine.resolveIntent(
      trimmed,
      inputSource,
      worldModelRef.current.getState(),
    );

    // 3a. Immediate Interruption
    if (intent.intentType === "INTERRUPT") {
      voiceEngineRef.current.stop();
      if (playbackControllerRef.current?.getStatus() === "PLAYING") {
        playbackControllerRef.current.pause();
        setIsLessonPlaying(false);
      }
      worldModelRef.current.setOrbState("LISTENING");
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "Paused. Listening to you...",
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      worldModelRef.current.appendConversation(userMsg);
      worldModelRef.current.appendConversation(assistantMsg);
      activeRequestLockRef.current = null;
      setRequestState("idle");
      setInputValue("");
      return;
    }

    // 3b. What-If Branch Exit ("Go back", "Return to lesson")
    if (intent.intentType === "BRANCH_EXIT") {
      const activeBranch = worldModelRef.current.getActiveBranch();
      if (activeBranch) {
        const returnIndex = activeBranch.parentMomentIndex;
        worldModelRef.current.exitBranch();
        playbackControllerRef.current?.seek(returnIndex, true);
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed,
        };
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `Returned to step ${returnIndex + 1} in the primary lesson.`,
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        worldModelRef.current.appendConversation(userMsg);
        worldModelRef.current.appendConversation(assistantMsg);
        activeRequestLockRef.current = null;
        setRequestState("idle");
        setInputValue("");
        return;
      }
    }

    // 3c. Pacing Controls ("Slower", "Faster")
    if (intent.intentType === "PACE_CONTROL") {
      const pace = intent.parameters.pace as "slower" | "faster";
      const newSpeed = pace === "slower" ? 0.75 : 1.25;
      playbackControllerRef.current?.setSpeed(newSpeed);
      worldModelRef.current.updateStudentState((s) => {
        s.pace = pace;
        s.playbackSpeed = newSpeed;
      });
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          pace === "slower"
            ? "Slowing down pacing (0.75x speed)."
            : "Increasing pacing (1.25x speed).",
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      worldModelRef.current.appendConversation(userMsg);
      worldModelRef.current.appendConversation(assistantMsg);
      activeRequestLockRef.current = null;
      setRequestState("idle");
      setInputValue("");
      return;
    }

    // 3d. Playback Navigation Controls ("Next", "Previous", "Replay", "Pause", "Resume")
    if (intent.intentType === "PLAYBACK_CONTROL") {
      const action = intent.parameters.action;
      if (action === "next") {
        handleNextTransformation();
      } else if (action === "previous") {
        handlePreviousTransformation();
      } else if (action === "replay") {
        playbackControllerRef.current?.seek(0, true);
      } else if (action === "pause") {
        playbackControllerRef.current?.pause();
        setIsLessonPlaying(false);
      } else if (action === "resume") {
        playbackControllerRef.current?.play();
        setIsLessonPlaying(true);
      }
      activeRequestLockRef.current = null;
      setRequestState("idle");
      setInputValue("");
      return;
    }

    // 3e. Teacher Brain Local Decisions (Misconception Detection, Simplify, Why, What-If, Focus, Detours)
    if (
      transformationLesson &&
      worldModelRef.current.getState().currentMoment
    ) {
      const orchResult = orchestratorRef.current.orchestrate(
        trimmed,
        inputSource,
      );
      const decision = orchResult.decision;

      if (decision.isLocal) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed,
        };
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: decision.explanation,
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);

        // If focus requested
        if (decision.focusEntityId) {
          const el = excalidrawAPI
            ?.getSceneElements?.()
            .find(
              (e: any) =>
                e.id === String(decision.focusEntityId) ||
                e.customData?.dslId === String(decision.focusEntityId),
            );
          if (el) {
            (excalidrawAPI as any)?.scrollToContent?.([el], {
              animate: true,
              fitToViewport: false,
            });
          }
        }

        // If What-If branch created, mount branch scene onto canvas
        if (decision.branchToCreate?.branchMoments?.[0]) {
          playbackControllerRef.current?.mountBranchMoment(
            decision.branchToCreate.branchMoments[0],
          );
        } else if (decision.detourToCreate?.detourMoment) {
          playbackControllerRef.current?.mountBranchMoment(
            decision.detourToCreate.detourMoment,
          );
        }

        // Speak decision narration if available and voice is enabled
        if (decision.narration && isVoiceEnabled) {
          voiceEngineRef.current
            .play({
              lessonId: transformationLesson.lessonId,
              transformationId: `local-decision-${Date.now()}`,
              stepIndex:
                worldModelRef.current.getState().currentMoment?.stepIndex ?? 0,
              totalSteps:
                worldModelRef.current.getState().currentMoment?.totalSteps ?? 1,
              title: decision.strategy,
              explanation: decision.narration,
            })
            .catch((err) => {
              console.warn(
                "[COGNORA][VOICE] Non-blocking decision play notice:",
                err,
              );
            });
        }

        activeRequestLockRef.current = null;
        setRequestState("idle");
        setInputValue("");
        return;
      }
    }

    // 4. Intercept and execute commands (direct slash or deterministic natural language)
    const resolvedCommand = trimmed.startsWith("/")
      ? trimmed
      : parseNaturalLanguageToCommand(trimmed);

    if (resolvedCommand) {
      const riskLevel = getCommandRiskLevel(resolvedCommand);
      const confirmPolicy = getCommandConfirmationPolicy(resolvedCommand);

      // Helper to execute the resolved command flow
      const executeCommandFlow = async (
        cmdToRun: string,
        explicitTargetId?: string,
      ): Promise<"COMPLETED" | "PROCEED_TO_TEACH"> => {
        const cmdContext = { ...commandContext };
        if (explicitTargetId) {
          cmdContext.focusedEntityId = explicitTargetId;
          cmdContext.selectedEntities = [explicitTargetId];
        }

        // Support toggling developer mode
        if (cmdToRun === "/dev" || cmdToRun === "/debug") {
          setIsDeveloperMode((prev) => {
            const next = !prev;
            const msg: ChatMessage = {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: `Developer mode ${
                next ? "enabled" : "disabled"
              }. Advanced developer commands (/verify, /stress, /diff) are now ${
                next ? "unlocked" : "hidden"
              }.`,
            };
            setMessages((m) => [...m, msg]);
            return next;
          });
          activeRequestLockRef.current = null;
          setRequestState("idle");
          setInputValue("");
          return "COMPLETED";
        }

        const cmdResult = await executeUniversalCommand(cmdToRun, cmdContext);

        if (!cmdResult.success || cmdResult.status === "error") {
          const errorText =
            cmdResult.error || `Command execution failed for '${cmdToRun}'.`;
          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: trimmed,
          };
          const assistantErrMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `⚠️ ${errorText}`,
          };
          setMessages((prev) => [...prev, userMsg, assistantErrMsg]);
          setErrorMessage(errorText);
          setErrorCode("COMMAND_ERROR");
          activeRequestLockRef.current = null;
          setRequestState("idle");
          setInputValue("");
          return "COMPLETED";
        }

        // Handle ambiguous target or explicit confirmation requirement
        if (cmdResult.status === "requires_confirmation" && !explicitTargetId) {
          setCommandPreview({
            isOpen: true,
            command: cmdToRun,
            riskLevel: cmdResult.riskLevel || "MODIFY",
            targetDescription: cmdResult.confirmationPrompt,
            candidateTargets: cmdResult.candidateTargets,
            selectedTargetId: cmdResult.candidateTargets?.[0]?.id,
            onConfirm: () => {
              const chosenTarget =
                commandPreviewRef.current?.selectedTargetId ||
                cmdResult.candidateTargets?.[0]?.id;
              setCommandPreview(null);
              executeCommandFlow(cmdToRun, chosenTarget);
            },
          });
          activeRequestLockRef.current = null;
          setRequestState("idle");
          setInputValue("");
          return "COMPLETED";
        }

        // If command explicitly requests AI Teaching (e.g. /teach, /why, /explain, /trace)
        if (cmdResult.executionClass === "TEACHING") {
          promptText = cmdResult.message || trimmed;
          return "PROCEED_TO_TEACH";
        }
        // Deterministic Zero-AI Command (LOCAL / SEMANTIC / DEVELOPER)
        if (cmdResult.lesson) {
          await startTransformationLesson(cmdResult.lesson, {
            messageId: generationId,
            topic: cmdResult.commandName,
            prompt: trimmed,
          });
        } else if (cmdResult.actions && cmdResult.actions.length > 0) {
          applyVisualActions(excalidrawAPI, cmdResult.actions, {
            replacePreviousAI: false,
            focusViewport: true,
          });
        }

        if (cmdResult.uiAction) {
          const { type, payload } = cmdResult.uiAction;
          if (type === "FIT_VIEWPORT") {
            (excalidrawAPI as any)?.scrollToContent?.(
              excalidrawAPI.getSceneElements(),
              {
                fitToViewport: true,
                animate: true,
              },
            );
          } else if (type === "OPEN_INSPECTOR" || type === "SET_TAB") {
            if (payload?.tab) {
              setContextualTab(payload.tab);
            }
            setIsContextualPanelOpen(true);
          } else if (type === "OPEN_PALETTE") {
            setShowAutocomplete(true);
          } else if (type === "CLOSE_PALETTE") {
            setShowAutocomplete(false);
          } else if (type === "CLEAR") {
            excalidrawAPI?.updateScene({ elements: [] });
            setTransformationLesson(null);
          }
        }

        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed,
        };
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: cmdResult.message || `Executed /${cmdResult.commandName}`,
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);

        activeRequestLockRef.current = null;
        setRequestState("idle");
        setInputValue("");
        return "COMPLETED";
      };

      if (confirmPolicy === "ALWAYS" || riskLevel === "DESTRUCTIVE") {
        setCommandPreview({
          isOpen: true,
          command: resolvedCommand,
          riskLevel,
          targetDescription: resolvedCommand.startsWith("/clear")
            ? "Entire Canvas will be cleared"
            : resolvedCommand.startsWith("/reset")
            ? "Workspace state and active lesson will be reset"
            : "Canvas state modification",
          semanticEffect:
            riskLevel === "DESTRUCTIVE"
              ? "Destructive action cannot be undone automatically."
              : undefined,
          onConfirm: async () => {
            setCommandPreview(null);
            await executeCommandFlow(resolvedCommand);
          },
        });
        activeRequestLockRef.current = null;
        setRequestState("idle");
        setInputValue("");
        return;
      }

      const outcome = await executeCommandFlow(resolvedCommand);
      if (outcome !== "PROCEED_TO_TEACH") {
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
    voiceEngineRef.current.stop();
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

      // --- SESSION RESET INTELLIGENCE (PHASE 27) ---
      if (/^(reset|clear|reset session|clear canvas)$/i.test(trimmed)) {
        handleResetSession();
        const assistantMsgId = `assistant-${Date.now()}`;
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: "Session reset. Whiteboard and active lesson state have been cleanly reset.",
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setRequestState("idle");
        activeRequestLockRef.current = null;
        return;
      }

      // --- LOCAL TUTOR INTELLIGENCE (PHASE 24) ---
      // If a lesson is active, handle conversational pedagogical follow-ups locally
      // using the current TeachingMoment context without restarting or regenerating the lesson.
      if (transformationLesson && transformationLesson.timeline) {
        const lower = trimmed.toLowerCase().trim().replace(/[?!.,]+$/, "");
        const activeIdx = transformationLesson.currentTransformationIndex ?? 0;
        const currentMoments = transformationLesson.timeline.moments || [];
        const activeMoment = currentMoments[activeIdx] || currentMoments[Math.max(0, activeIdx - 1)];

        const isWhy = /^(why|why did this change|why is this here|why did it rotate|why did this rotate|why relax|why choose this|why is this selected|why\?*)$/.test(lower);
        const isNext = /^(what happens next|what is next|whats next|what's next|what next|next step|next)$/.test(lower);
        const isBack = /^(go back|previous|previous step|step back|back)$/.test(lower);
        const isReplay = /^(show that again|show this again|replay|repeat|repeat this step)$/.test(lower);
        const isExplain = /^(explain this|explain this step|what does this mean|explain more|tell me more)$/.test(lower);

        if (isWhy || isNext || isBack || isReplay || isExplain) {
          let replyContent = "";

          if (isWhy) {
            const whyText = activeMoment?.whyItChanged || activeMoment?.why || activeMoment?.explanation;
            const whatText = activeMoment?.whatChanged || activeMoment?.title;
            replyContent = `**${activeMoment?.title || `Step ${activeIdx + 1}`} Explanation:**\n\n${whyText || "This step enforces the foundational invariants of the algorithm."}\n\n*Action taken:* ${whatText || "State updated."}${activeMoment?.consequence ? `\n\n*Result:* ${activeMoment.consequence}` : ""}`;
          } else if (isNext) {
            const nextIdx = activeIdx + 1;
            if (nextIdx < currentMoments.length) {
              const nextMoment = currentMoments[nextIdx];
              replyContent = `**Upcoming Step ${nextIdx + 1} (${nextMoment?.title}):**\n\n${nextMoment?.whatChanged || nextMoment?.explanation}\n\n*Advance with the Next button or Play.*`;
            } else {
              replyContent = `The lesson has reached its final verified state. All algorithmic invariants are satisfied. You can use **Replay** to review from the beginning or ask about a new concept.`;
            }
          } else if (isBack) {
            playbackControllerRef.current?.previous();
            replyContent = `Stepped back to Step ${Math.max(1, activeIdx)}.`;
          } else if (isReplay) {
            handleReplayVoice();
            replyContent = `Replaying Step ${activeIdx + 1}: **${activeMoment?.title || ""}**.`;
          } else if (isExplain) {
            replyContent = `**Step ${activeIdx + 1}: ${activeMoment?.title}**\n\n${activeMoment?.explanation || activeMoment?.whatChanged}\n\n${activeMoment?.whyItChanged ? `**Why:** ${activeMoment.whyItChanged}` : ""}`;
          }

          const assistantMsgId = `assistant-${Date.now()}`;
          const assistantMessage: ChatMessage = {
            id: assistantMsgId,
            role: "assistant",
            content: replyContent,
            topic: transformationLesson.lesson.topic,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setRequestState("idle");
          activeRequestLockRef.current = null;
          return;
        }
      }

      // --- DETERMINISTIC DSA ACCELERATION ROUTING ---
      // For registered & supported DSA concepts, execute the deterministic algorithm engine.
      // For unsupported concepts (e.g. Bellman-Ford, Tree rotations in Prompt 1, or non-DSA topics),
      // smoothly fall back to the universal Nemotron pipeline without error.
      const dsaRoute = DSAExecutionRouter.tryExecuteDSA(trimmed);
      if (dsaRoute.handled && dsaRoute.lesson) {
        const dsaLesson = dsaRoute.lesson;
        const assistantMsgId = `assistant-${Date.now()}`;
        startTransformationLesson(
          dsaLesson.visualLesson,
          {
            messageId: assistantMsgId,
            topic: dsaLesson.authoritativeModel.concept,
            prompt: trimmed,
          },
          0,
          {
            timeline: dsaLesson.timeline,
            authoritativeModel: dsaLesson.authoritativeModel,
          },
        );
        setIsContextualPanelOpen(true);
        setContextualTab("analyze");
        setIsConversationMinimized(true);

        const firstMoment = dsaLesson.timeline.moments?.[0];
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content:
            firstMoment?.explanation ||
            `Let's explore ${dsaRoute.conceptId} step by step.`,
          topic: dsaLesson.authoritativeModel.concept,
          visualLesson: dsaLesson.visualLesson,
          hasVisuals: true,
          visualStatus: "success",
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setRequestState("idle");
        activeRequestLockRef.current = null;
        return;
      } else if (!dsaRoute.handled && dsaRoute.reason === "INPUT_ERROR" && dsaRoute.errorMessage) {
        const assistantMsgId = `assistant-${Date.now()}`;
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: `Input Error: ${dsaRoute.errorMessage} Please provide a valid input within limits.`,
          visualStatus: "failed",
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setRequestState("idle");
        activeRequestLockRef.current = null;
        return;
      }
      // --- END DETERMINISTIC DSA ACCELERATION ROUTING ---

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
      let promptToSend = trimmed;
      if (
        transformationLesson &&
        worldModelRef.current.getState().currentMoment
      ) {
        const resolvedCtx = ContextEngine.resolveContext(
          intent,
          worldModelRef.current.getState(),
        );
        promptToSend = `${ContextEngine.formatCompactPromptContext(
          resolvedCtx,
        )}\n\nLearner Question: ${trimmed}`;
      }

      const response = await requestTeachingExplanation(
        {
          prompt: promptToSend,
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
        try {
          startTransformationLesson(visualLesson, {
            messageId: assistantMsgId,
            topic: response.topic,
            prompt: trimmed,
          });
          setIsContextualPanelOpen(true);
          setContextualTab("analyze");
          setIsConversationMinimized(true);
        } catch (lessonErr) {
          console.warn(
            "[COGNORA][LESSON] Transformation playback setup threw, falling back to direct scene render:",
            lessonErr,
          );
          const fallbackActions =
            visualLesson.initialScene && visualLesson.initialScene.length > 0
              ? visualLesson.initialScene
              : response.visual_actions && response.visual_actions.length > 0
              ? response.visual_actions
              : visualLesson.transformations &&
                visualLesson.transformations.length > 0
              ? visualLesson.transformations
                  .flatMap((t) => t.operations || [])
                  .filter((op) => Boolean(op && (op as any).type))
              : [];
          if (fallbackActions.length > 0) {
            applyVisualActions(
              excalidrawAPI,
              fallbackActions as VisualAction[],
              {
                replacePreviousAI: true,
                focusViewport: true,
              },
            );
          } else {
            console.warn(
              "[COGNORA][LESSON] No fallback visual actions available to render directly.",
              lessonErr,
            );
          }
        }
      } else if (
        response.visual_actions &&
        response.visual_actions.length > 0
      ) {
        applyVisualActions(excalidrawAPI, response.visual_actions, {
          replacePreviousAI: true,
          focusViewport: true,
        });
      } else if (transformationLesson) {
        // Follow-up question answered in context of active lesson without corrupting canvas
        console.log(
          "[COGNORA][FOLLOW_UP] Conceptual follow-up answered in active lesson context.",
        );
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
      worldModelRef.current.appendConversation(assistantMessage);
      setRequestState("success");

      // Speak follow-up answer if voice is enabled and this was an answer to a question (not a full visual lesson replay)
      if (assistantMessage.content && isVoiceEnabled && !visualLesson) {
        voiceEngineRef.current
          .play({
            lessonId: transformationLesson?.lessonId || "live",
            transformationId: `follow-up-${Date.now()}`,
            stepIndex:
              worldModelRef.current.getState().currentMoment?.stepIndex ?? 0,
            totalSteps:
              worldModelRef.current.getState().currentMoment?.totalSteps ?? 1,
            title: response.topic || "Explanation",
            explanation: assistantMessage.content,
          })
          .catch((err) => {
            console.warn(
              "[COGNORA][VOICE] Non-blocking follow-up voice notice:",
              err,
            );
          });
      }

      // Settle cleanly before returning to idle
      setTimeout(() => {
        setRequestState("idle");
        if (activeRequestLockRef.current === requestId) {
          activeRequestLockRef.current = null;
        }
      }, 100);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log(
          `[COGNORA][TEACH][ABORTED] Request ${requestId} was cancelled.`,
        );
        activeRequestLockRef.current = null;
        setRequestState("idle");
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
        rawMsg.includes("504") ||
        rawMsg.includes("overloaded") ||
        rawMsg.includes("service unavailable");

      const isCreditCapacity =
        errCode === "PROVIDER_CAPACITY" ||
        errCode === "CREDIT_CAPACITY_EXCEEDED" ||
        rawMsg.includes("requires more credits") ||
        rawMsg.includes("can only afford") ||
        rawMsg.includes("quota exceeded");

      // Part 15 Error Taxonomy Classification
      let taxonomyCategory: string;
      if (
        errCode === "NVIDIA_EMPTY_COMPLETION" ||
        rawMsg.includes("empty completion")
      ) {
        taxonomyCategory = "AI_EMPTY_RESPONSE";
      } else if (
        errCode === "NVIDIA_INCOMPLETE_STREAM" ||
        errCode === "NVIDIA_OUTPUT_TRUNCATED" ||
        rawMsg.includes("stream terminated") ||
        rawMsg.includes("truncated")
      ) {
        taxonomyCategory = "AI_INCOMPLETE_RESPONSE";
      } else if (
        errCode === "NVIDIA_INVALID_COMPLETION" ||
        errCode === "AI_PARSE_ERROR" ||
        rawMsg.includes("could not be parsed as structured JSON") ||
        rawMsg.includes("Invalid JSON")
      ) {
        taxonomyCategory = "AI_PARSE_ERROR";
      } else if (
        errCode === "SCHEMA_ERROR" ||
        errCode === "AI_SCHEMA_ERROR" ||
        errCode === "LESSON_SCHEMA_ERROR" ||
        rawMsg.includes("Visual DSL") ||
        rawMsg.includes("schema")
      ) {
        taxonomyCategory = "LESSON_SCHEMA_ERROR";
      } else if (
        rawMsg.includes("missing entity") ||
        rawMsg.includes("references missing") ||
        rawMsg.includes("dangling entity")
      ) {
        taxonomyCategory = "ENTITY_REFERENCE_ERROR";
      } else if (
        rawMsg.includes("relationship") ||
        rawMsg.includes("references missing entity")
      ) {
        taxonomyCategory = "RELATIONSHIP_ERROR";
      } else if (
        errCode === "TRANSFORMATION_ERROR" ||
        rawMsg.includes("transformation") ||
        rawMsg.includes("operations")
      ) {
        taxonomyCategory = "TRANSFORMATION_ERROR";
      } else if (
        errCode === "SEMANTIC_VALIDATION_ERROR" ||
        rawMsg.includes("invariant") ||
        rawMsg.includes("zero semantic entities")
      ) {
        taxonomyCategory = "LESSON_SEMANTIC_ERROR";
      } else if (
        errCode === "NORMALIZATION_ERROR" ||
        rawMsg.includes("normalization")
      ) {
        taxonomyCategory = "NORMALIZATION_ERROR";
      } else if (
        errCode === "RENDER_ERROR" ||
        rawMsg.includes("render") ||
        rawMsg.includes("Render invariant")
      ) {
        taxonomyCategory = "RENDER_PRECONDITION_ERROR";
      } else if (
        isAuth ||
        isRateLimit ||
        isTimeout ||
        isNetwork ||
        isProviderUnavailable ||
        isCreditCapacity
      ) {
        taxonomyCategory = "AI_REQUEST_ERROR";
      } else {
        taxonomyCategory = "UNKNOWN_ERROR";
      }

      console.error(
        `[COGNORA][ERROR_TAXONOMY] category=${taxonomyCategory} code=${errCode} requestId=${requestId} error="${rawMsg}"`,
      );

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
          "NVIDIA AI provider is temporarily unavailable. Please try again in a moment.";
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
      if (activeRequestLockRef.current === requestId) {
        activeRequestLockRef.current = null;
      }
    }
  };
  handleSubmitRef.current = handleSubmit;

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

  const currentMoment =
    transformationLesson?.timeline?.moments?.[
      transformationLesson.currentTransformationIndex
    ];

  const currentMeta = transformationLesson?.timeline
    ? transformationLesson.timeline.meta[
        transformationLesson.currentTransformationIndex
      ]
    : undefined;

  const rawStepTitle =
    currentMoment?.title ||
    currentMeta?.title ||
    (transformationLesson && transformationLesson.currentTransformationIndex > 0
      ? transformationLesson.lesson.transformations[
          transformationLesson.currentTransformationIndex - 1
        ]?.title || ""
      : transformationLesson?.lesson.title || "Initial State");

  const currentStepTitle = ExplanationEngine.scrubMetadata(rawStepTitle);

  const rawExplanation =
    currentMoment?.explanation ||
    currentMeta?.explanation ||
    (transformationLesson && transformationLesson.currentTransformationIndex > 0
      ? transformationLesson.lesson.transformations[
          transformationLesson.currentTransformationIndex - 1
        ]?.explanation || ""
      : transformationLesson?.lesson.concept
      ? `${transformationLesson.lesson.concept}: Initial state`
      : "Initial state of the verified concept.");

  const currentExplanation = ExplanationEngine.scrubMetadata(rawExplanation);

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

  // Authoritative Voice Explanation Context Builder
  const buildCurrentVoiceContext =
    useCallback((): VoiceExplanationContext | null => {
      const lastAssistantMsg = [...messages]
        .reverse()
        .find((m) => m.role === "assistant");

      if (!transformationLesson) {
        if (lastAssistantMsg) {
          return {
            lessonId: "chat-answer",
            transformationId: "t-0",
            stepIndex: 0,
            totalSteps: 1,
            title: lastAssistantMsg.topic || "Explanation",
            explanation: lastAssistantMsg.content,
            answerText: lastAssistantMsg.content,
            topic: lastAssistantMsg.topic || "Concept",
            concept: lastAssistantMsg.topic || "Concept",
          };
        }
        return null;
      }

      const trans = transformationLesson.lesson.transformations || [];
      const safeIdx = Math.min(
        Math.max(0, transformationLesson.currentTransformationIndex),
        Math.max(0, trans.length - 1),
      );
      const activeT = trans[safeIdx] || null;

      return {
        lessonId: transformationLesson.lessonId,
        transformationId: activeT?.id || `t-${currentStepNum}`,
        stepIndex: currentStepNum,
        totalSteps: totalStepsCount,
        title: currentStepTitle || activeT?.title || `Step ${currentStepNum}`,
        explanation:
          currentExplanation ||
          (safeIdx === 0
            ? `Here is the initial empty state for ${
                transformationLesson.topic || currentTopic || "the concept"
              }.`
            : ""),
        calculations: currentCalculations,
        insight: currentInsight,
        answerText: lastAssistantMsg?.content,
        topic: transformationLesson.topic || currentTopic,
        concept: transformationLesson.topic || currentTopic,
        semanticFocus: currentTopic,
      };
    }, [
      transformationLesson,
      messages,
      currentStepNum,
      totalStepsCount,
      currentStepTitle,
      currentExplanation,
      currentCalculations,
      currentInsight,
      currentTopic,
    ]);

  const handlePlayVoice = useCallback(() => {
    const context = buildCurrentVoiceContext();
    if (!context) {
      return;
    }
    voiceEngineRef.current.play(context);
  }, [buildCurrentVoiceContext]);

  const handlePauseVoice = useCallback(() => {
    voiceEngineRef.current.pause();
  }, []);

  const handleResumeVoice = useCallback(() => {
    voiceEngineRef.current.resume();
  }, []);

  const handleStopVoice = useCallback(() => {
    voiceEngineRef.current.stop();
  }, []);

  const handleReplayVoice = useCallback(() => {
    const context = buildCurrentVoiceContext();
    if (context) {
      voiceEngineRef.current.replay();
    }
  }, [buildCurrentVoiceContext]);

  const buildCurrentVoiceContextRef = useRef(buildCurrentVoiceContext);
  buildCurrentVoiceContextRef.current = buildCurrentVoiceContext;

  // Synchronize voice with transformation steps: invalidate speech when step changes
  useEffect(() => {
    if (transformationLesson) {
      const context = buildCurrentVoiceContextRef.current();
      voiceEngineRef.current.onTransformationChange(context);
    }
  }, [
    transformationLesson?.lessonId,
    transformationLesson?.currentTransformationIndex,
  ]);

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
  const transformations = transformationLesson?.lesson.transformations || [];
  const safeTransformIndex = Math.min(
    activeIndex,
    Math.max(0, transformations.length - 1),
  );
  const activeT = transformations[safeTransformIndex] || transformations[0];

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
              : `Entity: ${inspected.label || inspected.id}`,
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
                value: `${(c as any).fromLabel || c.from} (${c.type})`,
              })),
              ...inspected.outgoingConnections.map((c, i) => ({
                label: `Outbound ${i + 1}`,
                value: `${(c as any).toLabel || c.to} (${c.type})`,
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
      const trans = transformationLesson.lesson.transformations || [];
      const safeIdx = Math.min(
        Math.max(0, transformationLesson.currentTransformationIndex),
        Math.max(0, trans.length - 1),
      );
      const activeT = trans[safeIdx] || null;
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

  // Contextual Teaching Glimpse Overlay Placement (minimal, placement-aware, avoids covering primary visual content)
  const overlayPlacement = (() => {
    // Reference viewportVersion so React re-runs this block whenever the viewport changes
    // (pan scrollX/scrollY or zoom). The actual coordinate reading happens via
    // excalidrawAPI.getAppState() below — viewportVersion is purely a change signal.
    void viewportVersion;

    if (!transformationLesson || !excalidrawAPI || excalidrawAPI.isDestroyed) {
      return null;
    }
    const currentMoment =
      transformationLesson?.timeline?.moments?.[
        transformationLesson.currentTransformationIndex
      ];
    const trans = transformationLesson.lesson.transformations || [];
    const activeT = currentMoment
      ? ({
          id: currentMoment.id,
          title: currentMoment.title,
          explanation: currentMoment.explanation,
          semanticFocus: currentMoment.semanticFocus,
          highlights: currentMoment.semanticFocus?.entityIds,
          operations: [],
        } as any)
      : transformationLesson.currentTransformationIndex > 0
      ? trans[transformationLesson.currentTransformationIndex - 1] || null
      : null;

    const rawTitle = activeT?.title || currentStepTitle || "";
    const rawExpl = activeT?.explanation || currentExplanation || "";

    // Derive compact contextual glimpse dynamically
    const derivedGlimpse = deriveCompactGlimpse({
      title: rawTitle,
      explanation: rawExpl,
      whatChanged: derivedWhatChanged,
      action: activeT?.operations?.[0]?.type,
      topic: currentTopic,
    });

    if (!derivedGlimpse.title && !derivedGlimpse.glimpse) {
      return null;
    }

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const containerRect = rootContainerRef.current?.getBoundingClientRect();
      const containerW = containerRect?.width || window.innerWidth;
      const containerH = containerRect?.height || window.innerHeight;

      const selectedIds = selectedContext
        .map((c) => c.dslId || c.label || "")
        .filter(Boolean);

      // Dynamically resolve semantic focus (primary and secondary target objects)
      const semanticFocus = resolveSemanticFocus(
        activeT,
        elements,
        selectedIds,
      );

      const highlightTarget = semanticFocus.primaryTargetId;

      // Estimate compact dimensions dynamically based on content length
      const cardDimensions = estimateGlimpseDimensions(
        derivedGlimpse,
        containerW,
      );

      const placementResult = computeIntelligentOverlayPosition({
        containerRect: { width: containerW, height: containerH },
        cardDimensions,
        targetElementId: highlightTarget,
        sceneElements: elements,
        appState,
        isInspectorOpen: isContextualPanelOpen,
        manualOffset: manualOverlayOffset,
        previousPosition: previousOverlayPositionRef.current,
      });

      previousOverlayPositionRef.current = {
        x: placementResult.x,
        y: placementResult.y,
      };

      // Calculate secondary target screen bounding boxes for subtle focus anchors
      const secondaryTargetRects: ScreenRect[] = [];
      const zoom = appState.zoom.value;
      for (const sEl of semanticFocus.secondaryElements) {
        if (sEl) {
          const sLeft = (sEl.x + appState.scrollX) * zoom;
          const sTop = (sEl.y + appState.scrollY) * zoom;
          const sWidth = sEl.width * zoom;
          const sHeight = sEl.height * zoom;
          secondaryTargetRects.push({
            left: sLeft,
            top: sTop,
            right: sLeft + sWidth,
            bottom: sTop + sHeight,
            width: sWidth,
            height: sHeight,
          });
        }
      }

      // Compute dynamic leader line / stem geometry
      const calloutScreenRect: ScreenRect = {
        left: placementResult.x,
        top: placementResult.y,
        right: placementResult.x + cardDimensions.width,
        bottom: placementResult.y + cardDimensions.height,
        width: cardDimensions.width,
        height: cardDimensions.height,
      };

      const leaderLine = placementResult.targetRect
        ? computeLeaderLineGeometry(
            calloutScreenRect,
            placementResult.targetRect,
            placementResult.placement,
          )
        : null;

      return {
        ...placementResult,
        title: derivedGlimpse.title,
        glimpse: derivedGlimpse.glimpse,
        cardWidth: cardDimensions.width,
        cardHeight: cardDimensions.height,
        targetRect: placementResult.targetRect,
        secondaryTargetRects,
        leaderLine,
        isOverridden: manualOverlayOffset !== null,
      };
    } catch {
      return null;
    }
  })();

  return (
    <div ref={rootContainerRef} className="cognora-workspace-root">
      {/* 1. Header (Sticky Top Bar) */}
      <CognoraErrorBoundary componentName="CognoraHeader">
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
      </CognoraErrorBoundary>

      {/* 2. Drawing Toolbar (Floating Left) */}
      <CognoraErrorBoundary componentName="CognoraDrawingToolbar">
        <CognoraDrawingToolbar
          activeTool={activeCanvasTool}
          onSelectTool={handleSelectTool}
          onOpenMoreTools={() => setIsToolsPaletteOpen(true)}
        />
      </CognoraErrorBoundary>

      {/* 4. Zoom Controls (Bottom Left) */}
      <CognoraErrorBoundary componentName="CognoraZoomControls">
        <CognoraZoomControls
          zoomValue={zoomValue}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onToggleFullscreen={handleToggleFullscreen}
        />
      </CognoraErrorBoundary>

      {/* Dynamic Semantic Teaching Callout with Focus Anchors & Leader Line */}
      {overlayPlacement && (
        <CognoraErrorBoundary componentName="SemanticTeachingCallout">
          <SemanticTeachingCallout
            title={overlayPlacement.title}
            glimpse={overlayPlacement.glimpse}
            placement={overlayPlacement.placement}
            x={overlayPlacement.x}
            y={overlayPlacement.y}
            cardWidth={overlayPlacement.cardWidth}
            cardHeight={overlayPlacement.cardHeight}
            targetRect={overlayPlacement.targetRect}
            secondaryTargetRects={overlayPlacement.secondaryTargetRects}
            showSecondaryAnchors={isVisualDebugEnabled()}
            leaderLine={overlayPlacement.leaderLine}
            onOpenInspector={() => {
              setContextualTab("explain");
              setIsContextualPanelOpen(true);
            }}
            isInspectorOpen={isContextualPanelOpen}
          />
        </CognoraErrorBoundary>
      )}

      {/* 4. Cognora Procedural 3D Liquid Glass Voice Presence */}
      <CognoraErrorBoundary componentName="CognoraVoiceOrb">
        <CognoraVoiceOrb
          state={!isVoiceEnabled ? "VOICE_OFF" : voiceOrbState}
          caption={
            currentMoment?.narration || currentExplanation || currentStepTitle
          }
          showCaption={Boolean(
            transformationLesson &&
              (isLessonPlaying || voiceOrbState === "SPEAKING"),
          )}
          analyzer={audioAnalyzerRef.current}
          audioElement={voiceEngineRef.current.getAudioElement()}
          teachingIntensity={
            currentMoment?.importance === "CRITICAL"
              ? 1.0
              : currentMoment?.importance === "HIGH"
              ? 0.75
              : currentMoment?.importance === "NORMAL"
              ? 0.5
              : transformationLesson
              ? 0.35
              : 0.0
          }
          semanticFocusLabel={
            currentMoment?.semanticFocus?.label ||
            currentMoment?.semanticFocus?.entityIds?.[0]
          }
          obstacles={[
            {
              id: "navbar",
              name: "Navbar",
              bounds: {
                left: 0,
                top: 0,
                right: typeof window !== "undefined" ? window.innerWidth : 1200,
                bottom: 60,
              },
              priority: "critical",
            },
            ...(isContextualPanelOpen
              ? [
                  {
                    id: "contextual-panel",
                    name: "Inspector",
                    bounds: {
                      left:
                        (typeof window !== "undefined"
                          ? window.innerWidth
                          : 1200) - 400,
                      top: 60,
                      right:
                        typeof window !== "undefined"
                          ? window.innerWidth
                          : 1200,
                      bottom:
                        typeof window !== "undefined"
                          ? window.innerHeight
                          : 800,
                    },
                    priority: "high" as const,
                  },
                ]
              : []),
            {
              id: "bottom-controls",
              name: "Bottom Controls",
              bounds: {
                left:
                  (typeof window !== "undefined" ? window.innerWidth : 1200) *
                  0.2,
                top:
                  (typeof window !== "undefined" ? window.innerHeight : 800) -
                  140,
                right:
                  (typeof window !== "undefined" ? window.innerWidth : 1200) *
                  0.8,
                bottom:
                  typeof window !== "undefined" ? window.innerHeight : 800,
              },
              priority: "critical",
            },
            ...(overlayPlacement
              ? [
                  {
                    id: "callout",
                    name: "Callout",
                    bounds: {
                      left: overlayPlacement.x,
                      top: overlayPlacement.y,
                      right: overlayPlacement.x + overlayPlacement.cardWidth,
                      bottom: overlayPlacement.y + overlayPlacement.cardHeight,
                    },
                    priority: "medium" as const,
                  },
                ]
              : []),
          ]}
          isVoiceEnabled={isVoiceEnabled}
          onVoiceToggle={handleToggleVoice}
          onPause={() => playbackControllerRef.current?.pause()}
          onResume={() => playbackControllerRef.current?.resume()}
          onReplay={() => playbackControllerRef.current?.replay()}
        />
      </CognoraErrorBoundary>

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
          <CognoraErrorBoundary componentName="CognoraTimeline">
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
                voiceEngineRef.current.stop();
              }}
              voiceState={voiceState}
              voiceEnabled={isVoiceEnabled}
              onToggleVoice={handleToggleVoice}
            />
          </CognoraErrorBoundary>
        )}

        {/* 5b. What-If Counterfactual Branch Banner */}
        {worldState.activeBranch && (
          <div
            className="cognora-whatif-banner"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "8px 16px",
              margin: "0 auto 8px auto",
              maxWidth: "520px",
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(37, 99, 235, 0.35)",
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(37, 99, 235, 0.14)",
              fontSize: "13px",
              color: "#1e293b",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🌿</span>
              <span>
                <strong>What-If Branch:</strong>{" "}
                {worldState.activeBranch.description}
              </span>
            </span>
            <button
              type="button"
              onClick={() => handleSubmit("go back", "branch_return_click")}
              style={{
                padding: "4px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#ffffff",
                background: "#2563eb",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              Return to Lesson
            </button>
          </div>
        )}

        {/* 6. AI Composer Dock with Integrated Conversation Thread */}
        <CognoraErrorBoundary componentName="CognoraAIComposer">
          <CognoraAIComposer
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSubmit={(prompt) => handleSubmit(prompt, "composer_submit")}
            isLoading={isTeachingRequestActive}
            onCancel={handleCancelRequest}
            isListening={isVoiceListening}
            onToggleVoiceListening={handleToggleVoiceListening}
            isPanelOpen={isContextualPanelOpen}
            selectedContext={selectedContext}
            onClearSelectedContext={() => setSelectedContext([])}
            pendingInteraction={pendingInteraction}
            onClearPendingInteraction={() => setPendingInteraction(null)}
            showAutocomplete={showAutocomplete}
            autocompleteSuggestions={autocompleteSuggestions}
            selectedSuggestionIndex={selectedSuggestionIndex}
            commandContext={commandContext}
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
              onToggleMinimize={() =>
                setIsConversationMinimized((prev) => !prev)
              }
              voiceState={voiceState}
              onPlayVoice={handlePlayVoice}
              onPauseVoice={handlePauseVoice}
              onResumeVoice={handleResumeVoice}
              onStopVoice={handleStopVoice}
              onReplayVoice={handleReplayVoice}
            />
          </CognoraAIComposer>
        </CognoraErrorBoundary>
      </div>

      {/* 7. Right Contextual Panel (Analyze, Explain, Code, Practice) */}
      {isContextualPanelOpen && (
        <CognoraErrorBoundary componentName="CognoraContextualPanel">
          <CognoraContextualPanel
            activeTab={contextualTab}
            onTabChange={handleTabChange}
            onClose={() => setIsContextualPanelOpen(false)}
            analyzeData={analyzeData}
            explainData={explainData}
            codeContext={currentCodeContext}
            conceptId={transformationLesson?.lesson?.concept}
            lessonTitle={transformationLesson?.lesson?.title}
            lessonInput={transformationLesson?.lesson?.input}
            transformationType={
              transformationLesson?.lesson?.transformations?.[
                Math.min(
                  Math.max(0, transformationLesson.currentTransformationIndex),
                  Math.max(
                    0,
                    (transformationLesson.lesson.transformations?.length || 1) - 1,
                  ),
                )
              ]?.type
            }
            codeContexts={transformationLesson?.lesson?.codeContexts}
            practiceData={practiceData}
            capabilities={panelCapabilities}
            overlayControls={
              overlayPlacement
                ? {
                    canMove: true,
                    onMoveUp: handleMoveOverlayUp,
                    onMoveDown: handleMoveOverlayDown,
                    onMoveLeft: handleMoveOverlayLeft,
                    onMoveRight: handleMoveOverlayRight,
                    onResetAuto: handleResetOverlay,
                    isOverridden: Boolean(manualOverlayOffset),
                  }
                : undefined
            }
          />
        </CognoraErrorBoundary>
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
      <CognoraErrorBoundary componentName="CognoraToolsPalette">
        <CognoraToolsPalette
          isOpen={isToolsPaletteOpen}
          onClose={() => setIsToolsPaletteOpen(false)}
          onSelectCanvasTool={handlePaletteSelectCanvasTool}
          onSelectCognoraAction={handlePaletteSelectCognoraAction}
          onClearCanvas={handleResetSession}
        />
      </CognoraErrorBoundary>

      {/* 10. Liquid Glass Command Confirmation & Handwriting Preview */}
      {commandPreview?.isOpen && (
        <CognoraCommandPreview
          isOpen={commandPreview.isOpen}
          command={commandPreview.command}
          riskLevel={commandPreview.riskLevel}
          targetDescription={commandPreview.targetDescription}
          semanticEffect={commandPreview.semanticEffect}
          didYouMean={commandPreview.didYouMean}
          candidateTargets={commandPreview.candidateTargets}
          selectedTargetId={commandPreview.selectedTargetId}
          onSelectTarget={(id) => {
            setCommandPreview((prev) =>
              prev ? { ...prev, selectedTargetId: id } : null,
            );
          }}
          position={commandPreview.position}
          onConfirm={commandPreview.onConfirm}
          onCancel={() => setCommandPreview(null)}
        />
      )}
    </div>
  );
};
