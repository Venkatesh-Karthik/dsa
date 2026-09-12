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

import type { SceneState } from "./scene-state";
import type { CompiledTimeline, TransformationMeta } from "./transformation-timeline";
import { reconcileSceneState } from "./scene-reconciler";
import {
  animateSceneTransition,
  cancelActiveSceneAnimation,
} from "./scene-animation";
import { focusOnElements } from "./ai-canvas";

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
  private listeners = new Set<PlaybackStateListener>();

  constructor(
    excalidrawAPI: ExcalidrawImperativeAPI,
    timeline: CompiledTimeline,
    initialIndex: number = 0,
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
      currentIndex: this.currentIndex,
      pendingIndex: this.pendingTargetIndex,
      totalSteps: total,
      canPrev: effectiveIdx > 0,
      canNext: effectiveIdx < total - 1,
      status: this.status,
      speed: this.speed,
      currentMeta: this.timeline.meta[effectiveIdx],
    };
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
    if (this.excalidrawAPI.isDestroyed) return;

    cancelActiveSceneAnimation();
    const targetState = this.timeline.states[this.currentIndex];
    const currentElements = this.excalidrawAPI.getSceneElementsIncludingDeleted();

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
    if (this.excalidrawAPI.isDestroyed) return;

    // 1. Increment monotonic transition counter to invalidate any pending animation frames
    const currentTxId = ++this.transitionId;
    console.log(
      `[COGNORA][NAVIGATION] action=transition currentIndex=${this.currentIndex} targetIndex=${targetIndex} transitionId=${currentTxId}`,
    );

    // 2. Safely cancel active animation without triggering false completion callbacks
    cancelActiveSceneAnimation();

    this.status = "TRANSITIONING";
    this.emitStateChange();

    // 3. Fetch authoritative target SceneState (NEVER inferred from canvas coordinates)
    const targetState = this.timeline.states[targetIndex];
    const currentElements = this.excalidrawAPI.getSceneElementsIncludingDeleted();

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
  }

  /**
   * Commits the settled target state atomically.
   */
  private commitTransition(targetIndex: number, targetState: SceneState): void {
    this.currentIndex = targetIndex;
    this.pendingTargetIndex = targetIndex;
    this.authoritativeState = targetState;
    this.timeline.currentIndex = targetIndex;
    this.status = this.playbackTimer ? "PLAYING" : "IDLE";

    this.focusActiveElements();
    this.emitStateChange();

    console.log(
      `[COGNORA][STATE] committed index=${targetIndex} total=${this.timeline.states.length}`,
    );
  }

  // ============================================================================
  // Playback Control: Play, Pause, Replay, Speed
  // ============================================================================

  public play(): void {
    if (this.status === "PLAYING") return;

    if (this.currentIndex >= this.timeline.states.length - 1) {
      // If at end, loop back to start first
      this.seek(0, false);
    }

    this.status = "PLAYING";
    this.emitStateChange();

    const baseInterval = 2400;
    const interval = Math.max(600, Math.round(baseInterval / this.speed));

    this.playbackTimer = setInterval(() => {
      const hasNext = this.next(true);
      if (!hasNext) {
        this.pause();
      }
    }, interval);
  }

  public pause(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.status = "PAUSED";
    this.emitStateChange();
  }

  public replay(): void {
    this.pause();
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
    if (this.excalidrawAPI.isDestroyed) return;

    cancelActiveSceneAnimation();
    const effectiveState =
      state ??
      this.timeline.states[this.pendingTargetIndex] ??
      this.authoritativeState;
    const currentElements = this.excalidrawAPI.getSceneElementsIncludingDeleted();
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

    this.focusActiveElements();
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
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    cancelActiveSceneAnimation();
    this.listeners.clear();
  }
}
