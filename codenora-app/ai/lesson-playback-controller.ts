/**
 * Authoritative Lesson Playback Controller
 *
 * Owns the complete state machine and lifecycle for visual lesson playback:
 * - Guarantees strict serialization: only ONE transition can mutate the canvas at a time.
 * - Monotonic transition IDs: completely eliminates canvas deformation from rapid Next/Prev clicks.
 * - Authoritative semantic state: Excalidraw is NEVER treated as the source of truth.
 * - Atomic scene commits: currentIndex and state only advance after transitions settle.
 * - Instant canvas corruption recovery via reconcileSceneToState().
 * - 100% local execution: zero network requests during playback.
 */

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { reconcileSceneState } from "./scene-reconciler";
import {
  animateSceneTransition,
  cancelActiveSceneAnimation,
} from "./scene-animation";
import { focusOnElements } from "./ai-canvas";

import type {
  CompiledTimeline,
  TransformationMeta,
} from "./transformation-timeline";
import type { SceneState } from "./scene-state";
import type { TeachingMoment } from "./teaching-moment";
import type { VoiceExplanationEngine } from "./voice/voice-explanation-engine";
import type { VoiceExplanationContext } from "./voice/voice-contract";

export type PlaybackStatus = "IDLE" | "TRANSITIONING" | "PLAYING" | "PAUSED";

export interface LessonPlaybackState {
  currentIndex: number;
  pendingIndex: number;
  totalSteps: number;
  canPrev: boolean;
  canNext: boolean;
  status: PlaybackStatus;
  speed: number;
  currentMeta?: TransformationMeta;
  currentMoment?: TeachingMoment;
  voiceEnabled?: boolean;
}

export type PlaybackStateListener = (state: LessonPlaybackState) => void;

export class LessonPlaybackController {
  public timeline: CompiledTimeline;
  private excalidrawAPI: ExcalidrawImperativeAPI;
  private currentIndex: number;
  private pendingTargetIndex: number;
  private authoritativeState: SceneState;
  private transitionId: number = 0;
  private status: PlaybackStatus = "IDLE";
  private speed: number = 1;
  private playbackTimer: ReturnType<typeof setInterval> | null = null;
  private stepAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private visualTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private voiceEndedUnsubscribe: (() => void) | null = null;
  private playbackSessionId: number = 0;
  private voiceEngine: VoiceExplanationEngine | null = null;
  private voiceEnabled: boolean = true;
  private listeners = new Set<PlaybackStateListener>();

  constructor(
    excalidrawAPI: ExcalidrawImperativeAPI,
    timeline: CompiledTimeline,
    initialIndex: number = 0,
    voiceEngine?: VoiceExplanationEngine | null,
  ) {
    this.excalidrawAPI = excalidrawAPI;
    this.timeline = timeline;
    this.currentIndex = Math.max(
      0,
      Math.min(initialIndex, timeline.states.length - 1),
    );
    this.pendingTargetIndex = this.currentIndex;
    this.authoritativeState = this.timeline.states[this.currentIndex];
    this.timeline.currentIndex = this.currentIndex;
    this.voiceEngine = voiceEngine ?? null;
  }

  // ============================================================================
  // Subscription & State Inspection
  // ============================================================================

  public subscribe(listener: PlaybackStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): LessonPlaybackState {
    const total = this.timeline.states.length;
    const effectiveIdx =
      this.status === "TRANSITIONING"
        ? this.pendingTargetIndex
        : this.currentIndex;
    return {
      currentIndex: effectiveIdx,
      pendingIndex: this.pendingTargetIndex,
      totalSteps: total,
      canPrev: effectiveIdx > 0,
      canNext: effectiveIdx < total - 1,
      status: this.status,
      speed: this.speed,
      currentMeta: this.timeline.meta[effectiveIdx],
      currentMoment: this.timeline.moments?.[effectiveIdx],
      voiceEnabled: this.voiceEnabled,
    };
  }

  public getCurrentMoment(): TeachingMoment | undefined {
    const effectiveIdx =
      this.status === "TRANSITIONING"
        ? this.pendingTargetIndex
        : this.currentIndex;
    return this.timeline.moments?.[effectiveIdx];
  }

  public setVoiceEngine(voiceEngine: VoiceExplanationEngine | null): void {
    this.voiceEngine = voiceEngine;
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public setVoiceEnabled(enabled: boolean): void {
    if (this.voiceEnabled === enabled) {
      return;
    }
    this.voiceEnabled = enabled;
    if (!enabled && this.voiceEngine) {
      this.voiceEngine.stop();
    }
    if (this.status === "PLAYING") {
      this.clearPlaybackTimers();
      this.coordinateCurrentPlaybackStep();
    }
    this.emitStateChange();
  }

  public getCurrentSceneState(): SceneState {
    return this.authoritativeState;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getPendingIndex(): number {
    return this.pendingTargetIndex;
  }

  public getTransitionId(): number {
    return this.transitionId;
  }

  public getStatus(): PlaybackStatus {
    return this.status;
  }

  private emitStateChange(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  // ============================================================================
  // Initialization & Rendering
  // ============================================================================

  /**
   * Renders the initial state of the lesson onto the canvas immediately.
   */
  public renderInitial(focusViewport: boolean = true): void {
    if (this.excalidrawAPI.isDestroyed) {
      return;
    }

    cancelActiveSceneAnimation();
    const targetMoment = this.timeline.moments?.[this.currentIndex];
    const targetState =
      targetMoment?.visualState ?? this.timeline.states[this.currentIndex];
    const currentElements =
      this.excalidrawAPI.getSceneElementsIncludingDeleted();

    const reconcileRes = reconcileSceneState(
      targetState,
      currentElements,
      this.timeline.lessonId,
    );

    this.excalidrawAPI.updateScene({
      elements: reconcileRes.elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    this.authoritativeState = targetState;
    this.pendingTargetIndex = this.currentIndex;
    if (focusViewport) {
      this.focusActiveElements();
    }
    this.emitStateChange();
  }

  // ============================================================================
  // Navigation: Next, Previous, Seek
  // ============================================================================

  /**
   * Advances to the next transformation in the timeline.
   * Serializes transitions and safely cancels any in-flight animations.
   */
  public next(animate: boolean = true): boolean {
    const baseIdx =
      this.status === "TRANSITIONING"
        ? this.pendingTargetIndex
        : this.currentIndex;
    if (baseIdx >= this.timeline.states.length - 1) {
      if (this.playbackTimer) {
        this.pause();
      }
      return false;
    }

    const targetIdx = baseIdx + 1;
    this.pendingTargetIndex = targetIdx;
    this.executeTransition(targetIdx, animate);
    return true;
  }

  /**
   * Reverses to the previous transformation in the timeline.
   * Restores the complete authoritative SceneState without data loss.
   */
  public prev(animate: boolean = true): boolean {
    const baseIdx =
      this.status === "TRANSITIONING"
        ? this.pendingTargetIndex
        : this.currentIndex;
    if (baseIdx <= 0) {
      return false;
    }

    const targetIdx = baseIdx - 1;
    this.pendingTargetIndex = targetIdx;
    this.executeTransition(targetIdx, animate);
    return true;
  }

  /**
   * Jumps directly to a target transformation index.
   */
  public seek(targetIndex: number, animate: boolean = true): boolean {
    const clamped = Math.max(
      0,
      Math.min(targetIndex, this.timeline.states.length - 1),
    );
    if (clamped === this.currentIndex && this.status !== "TRANSITIONING") {
      return false;
    }

    this.pendingTargetIndex = clamped;
    this.executeTransition(clamped, animate);
    return true;
  }

  /**
   * Core transition executor.
   * Implements monotonic transition IDs, stale frame drops, and atomic state commits.
   */
  private executeTransition(targetIndex: number, animate: boolean): void {
    if (this.excalidrawAPI.isDestroyed) {
      return;
    }

    // 1. Increment monotonic transition counter to invalidate any pending animation frames
    const currentTxId = ++this.transitionId;
    console.log(
      `[COGNORA][NAVIGATION] action=transition currentIndex=${this.currentIndex} targetIndex=${targetIndex} transitionId=${currentTxId}`,
    );

    // 2. Safely cancel active animation without triggering false completion callbacks
    cancelActiveSceneAnimation();

    // Invalidate/stop active voice playback when manually navigating or starting transition
    if (this.voiceEngine) {
      this.voiceEngine.stop();
    }

    // 3. Fetch authoritative target SceneState (NEVER inferred from canvas coordinates)
    const targetState = this.timeline.states[targetIndex];
    if (!targetState) {
      console.warn(
        `[COGNORA][TRANSITION] Target state at index ${targetIndex} not found; dropping transition.`,
      );
      this.status = this.isPlaybackActive() ? "PLAYING" : "IDLE";
      this.emitStateChange();
      return;
    }

    this.status = "TRANSITIONING";
    this.emitStateChange();

    try {
      const currentElements =
        this.excalidrawAPI.getSceneElementsIncludingDeleted();

      // 4. Reconcile complete target SceneState against current elements
      const reconcileRes = reconcileSceneState(
        targetState,
        currentElements,
        this.timeline.lessonId,
      );

      if (animate) {
        const baseDuration = 380;
        const duration = Math.max(120, Math.round(baseDuration / this.speed));

        animateSceneTransition(this.excalidrawAPI, reconcileRes.elements, {
          duration,
          transitionId: currentTxId,
          isTransitionActive: (id) => id === this.transitionId,
          onComplete: () => {
            if (this.transitionId === currentTxId) {
              this.commitTransition(targetIndex, targetState);
            } else {
              console.log(
                `[COGNORA][ANIMATION] superseded transitionId=${currentTxId} (active=${this.transitionId}) discarded cleanly.`,
              );
            }
          },
          onCancel: () => {
            console.log(
              `[COGNORA][ANIMATION] cancelled transitionId=${currentTxId}`,
            );
          },
        });
      } else {
        this.excalidrawAPI.updateScene({
          elements: reconcileRes.elements,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        this.commitTransition(targetIndex, targetState);
      }
    } catch (err) {
      console.error(
        `[COGNORA][TRANSITION] Exception during transition to index ${targetIndex}:`,
        err,
      );
      // Fallback: atomically commit target state without throwing unhandled exceptions
      this.commitTransition(targetIndex, targetState);
    }
  }

  /**
   * Commits the settled target state atomically.
   */
  private commitTransition(targetIndex: number, targetState: SceneState): void {
    const isPlaying = this.status === "PLAYING" || Boolean(this.playbackTimer);
    const nextStatus = isPlaying ? "PLAYING" : "IDLE";

    this.currentIndex = targetIndex;
    this.pendingTargetIndex = targetIndex;
    this.authoritativeState = targetState;
    this.timeline.currentIndex = targetIndex;
    this.status = nextStatus;

    // Viewport camera is NEVER moved on transitions; scenes transform strictly in place
    this.emitStateChange();

    console.log(
      `[COGNORA][STATE] committed index=${targetIndex} total=${this.timeline.states.length}`,
    );

    // If lesson playback is active and voice is enabled, coordinate voice + visual for the newly committed step
    if (nextStatus === "PLAYING" && this.voiceEngine && this.voiceEnabled) {
      this.clearPlaybackTimers();
      this.coordinateCurrentPlaybackStep();
    }
  }

  private isPlaybackActive(): boolean {
    return this.status === "PLAYING" || Boolean(this.playbackTimer);
  }

  // ============================================================================
  // Playback Control: Play, Pause, Replay, Speed
  // ============================================================================

  public play(): void {
    if (this.status === "PLAYING") {
      return;
    }

    if (this.currentIndex >= this.timeline.states.length - 1) {
      // If at end, loop back to start first
      this.seek(0, false);
    }

    this.status = "PLAYING";
    this.emitStateChange();

    this.clearPlaybackTimers();
    this.coordinateCurrentPlaybackStep();
  }

  private coordinateCurrentPlaybackStep(): void {
    if (this.status !== "PLAYING") {
      return;
    }

    const currentSession = ++this.playbackSessionId;
    const currentStep = this.currentIndex;

    // Fallback: If voiceEngine is absent or voice is muted, run with comfortable interval timer
    if (!this.voiceEngine || !this.voiceEnabled) {
      const baseInterval = 2400;
      const interval = Math.max(600, Math.round(baseInterval / this.speed));

      this.playbackTimer = setInterval(() => {
        try {
          const hasNext = this.next(true);
          if (!hasNext) {
            this.pause();
          }
        } catch (err) {
          console.error("[COGNORA][PLAYBACK] Play loop caught error:", err);
          this.pause();
        }
      }, interval);
      return;
    }

    // Coordinated Visual + Voice playback
    let visualReady = false;
    let voiceReady = false;
    let stepAdvanceScheduled = false;

    const attemptAdvance = () => {
      if (
        this.status !== "PLAYING" ||
        this.playbackSessionId !== currentSession ||
        this.currentIndex !== currentStep
      ) {
        return;
      }

      if (visualReady && voiceReady && !stepAdvanceScheduled) {
        stepAdvanceScheduled = true;
        const pauseDuration = Math.max(150, Math.round(400 / this.speed));
        this.stepAdvanceTimer = setTimeout(() => {
          if (
            this.status !== "PLAYING" ||
            this.playbackSessionId !== currentSession ||
            this.currentIndex !== currentStep
          ) {
            return;
          }

          if (this.currentIndex >= this.timeline.states.length - 1) {
            this.pause();
            return;
          }

          const hasNext = this.next(true);
          if (!hasNext) {
            this.pause();
          }
        }, pauseDuration);
      }
    };

    // Minimum visual duration before advancing (~1200ms)
    const minVisualDuration = Math.max(600, Math.round(1200 / this.speed));
    this.visualTimer = setTimeout(() => {
      visualReady = true;
      attemptAdvance();
    }, minVisualDuration);

    const meta = this.timeline.meta[currentStep];
    const moment = this.timeline.moments?.[currentStep];
    const voiceContext: VoiceExplanationContext = {
      lessonId: this.timeline.lessonId,
      transformationId:
        moment?.transformationId || meta?.id || `t-${currentStep}`,
      stepIndex: currentStep,
      totalSteps: this.timeline.meta.length,
      title: moment?.title || meta?.title || `Step ${currentStep + 1}`,
      explanation: moment?.explanation || meta?.explanation || "",
      calculations: meta?.calculations,
      insight: meta?.insight,
      topic: this.timeline.topic,
      concept: this.timeline.topic,
      semanticFocus: moment?.semanticFocus?.entityIds?.[0] || meta?.title,
    };

    // Listen for voice audio completion
    this.voiceEndedUnsubscribe = this.voiceEngine.addOnAudioEndedListener(
      () => {
        if (
          this.status === "PLAYING" &&
          this.playbackSessionId === currentSession
        ) {
          voiceReady = true;
          attemptAdvance();
        }
      },
    );

    // Safety timeout in case speech hangs or TTS fails
    this.safetyTimer = setTimeout(() => {
      if (
        this.status === "PLAYING" &&
        this.playbackSessionId === currentSession
      ) {
        voiceReady = true;
        attemptAdvance();
      }
    }, 15000);

    // Speak (plays from cache immediately if prepared)
    this.voiceEngine.play(voiceContext).catch((err) => {
      console.warn(
        "[COGNORA][PLAYBACK] Voice play encountered error, continuing visually:",
        err,
      );
      voiceReady = true;
      attemptAdvance();
    });
  }

  private clearPlaybackTimers(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.stepAdvanceTimer) {
      clearTimeout(this.stepAdvanceTimer);
      this.stepAdvanceTimer = null;
    }
    if (this.visualTimer) {
      clearTimeout(this.visualTimer);
      this.visualTimer = null;
    }
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    if (this.voiceEndedUnsubscribe) {
      this.voiceEndedUnsubscribe();
      this.voiceEndedUnsubscribe = null;
    }
  }

  public pause(): void {
    this.playbackSessionId++;
    this.clearPlaybackTimers();
    if (this.voiceEngine) {
      this.voiceEngine.pause();
    }
    this.status = "PAUSED";
    this.emitStateChange();
  }

  public resume(): void {
    if (this.status !== "PAUSED") {
      return;
    }
    this.status = "PLAYING";
    this.emitStateChange();
    if (this.voiceEngine && this.voiceEnabled) {
      this.voiceEngine.resume();
    }
    this.clearPlaybackTimers();
    this.coordinateCurrentPlaybackStep();
  }

  public stop(): void {
    this.playbackSessionId++;
    this.clearPlaybackTimers();
    if (this.voiceEngine) {
      this.voiceEngine.stop();
    }
    this.status = "IDLE";
    this.emitStateChange();
  }

  public replay(): void {
    this.stop();
    this.seek(0, false);
    this.play();
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(3, speed));
    if (this.status === "PLAYING") {
      this.pause();
      this.play();
    } else {
      this.emitStateChange();
    }
  }

  public cycleSpeed(): number {
    const speeds = [1, 1.5, 2, 0.5];
    const nextIdx = (speeds.indexOf(this.speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx >= 0 ? nextIdx : 0];
    this.setSpeed(nextSpeed);
    return nextSpeed;
  }

  // ============================================================================
  // Self-Healing & Canvas Recovery
  // ============================================================================

  /**
   * Forces the canvas to match the authoritative SceneState immediately.
   * Repairs any unexpected visual deformation or orphan elements.
   */
  public reconcileSceneToState(state?: SceneState): void {
    if (this.excalidrawAPI.isDestroyed) {
      return;
    }

    cancelActiveSceneAnimation();
    const effectiveState =
      state ??
      this.timeline.states[this.pendingTargetIndex] ??
      this.authoritativeState;
    const currentElements =
      this.excalidrawAPI.getSceneElementsIncludingDeleted();
    const reconcileRes = reconcileSceneState(
      effectiveState,
      currentElements,
      this.timeline.lessonId,
    );

    this.excalidrawAPI.updateScene({
      elements: reconcileRes.elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    this.authoritativeState = effectiveState;
    this.currentIndex = this.pendingTargetIndex;
    this.timeline.currentIndex = this.currentIndex;
    this.status = this.playbackTimer ? "PLAYING" : "IDLE";

    // Camera is not moved during self-healing reconciliation
    this.emitStateChange();
    console.log(`[COGNORA][RECONCILE] canvas repaired to authoritative state`);
  }

  private focusActiveElements(): void {
    const visible = this.excalidrawAPI
      .getSceneElementsIncludingDeleted()
      .filter(
        (el) =>
          !el.isDeleted &&
          el.customData?.isAiTeaching &&
          el.customData?.lessonId === this.timeline.lessonId,
      );

    if (visible.length > 0) {
      focusOnElements(this.excalidrawAPI, visible);
    }
  }

  /**
   * Cleans up timers and active listeners on unmount.
   */
  public destroy(): void {
    this.stop();
    cancelActiveSceneAnimation();
    this.listeners.clear();
  }
}
