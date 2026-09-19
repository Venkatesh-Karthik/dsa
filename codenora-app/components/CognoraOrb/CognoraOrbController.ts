/**
 * Cognora Voice ORB Central Controller
 *
 * Orchestrates:
 * - State machine (Base state + Modifiers)
 * - Real-time physics simulation loop
 * - Audio band processor integration
 * - Viewport obstacle avoidance & dragging
 * - Tap vs. drag discrimination
 * - Procedural shader uniform synthesis
 */

import { OrbAccessibilityManager } from "./CognoraOrbAccessibility";
import { OrbAudioProcessor } from "./CognoraOrbAudio";
import { OrbPhysics } from "./CognoraOrbPhysics";
import { OrbPositionManager } from "./CognoraOrbPosition";
import { OrbRenderer } from "./CognoraOrbRenderer";
import {
  ORB_CONSTANTS,
  type AudioBands,
  type OrbBaseState,
  type OrbPixelPosition,
  type OrbShaderUniforms,
  type ViewportObstacle,
} from "./CognoraOrbState";

import type { AudioAnalyzer } from "../../ai/voice/audio-analyzer";

export class CognoraOrbController {
  public positionManager = new OrbPositionManager();
  public physics = new OrbPhysics();
  public audioProcessor = new OrbAudioProcessor();
  public accessibility = new OrbAccessibilityManager();

  private renderer: OrbRenderer | null = null;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  // Interaction state
  private isDragging: boolean = false;
  private isHovered: boolean = false;
  private dragStartPointer: { x: number; y: number } = { x: 0, y: 0 };
  private dragStartOrb: OrbPixelPosition = { x: 0, y: 0 };
  private currentPixelPos: OrbPixelPosition = { x: 32, y: 600 };
  private currentSize: number = ORB_CONSTANTS.DEFAULT_SIZE;
  private lastTapTimestamp: number = -99999;

  // State
  private baseState: OrbBaseState = "IDLE";
  private teachingIntensity: number = 0;
  private obstacles: ViewportObstacle[] = [];
  private onPositionUpdate?: (pos: OrbPixelPosition) => void;

  public init(
    canvas: HTMLCanvasElement,
    onPositionUpdate?: (pos: OrbPixelPosition) => void,
  ): void {
    this.renderer = new OrbRenderer(canvas);
    this.onPositionUpdate = onPositionUpdate;
    this.currentPixelPos = this.positionManager.getPixelPosition(
      this.obstacles,
    );
    this.onPositionUpdate?.(this.currentPixelPos);
    this.startLoop();
  }

  public setObstacles(obstacles: ViewportObstacle[]): void {
    this.obstacles = obstacles;
    if (!this.positionManager.isManual()) {
      this.currentPixelPos =
        this.positionManager.calculateAutoPosition(obstacles);
      this.onPositionUpdate?.(this.currentPixelPos);
    }
  }

  public setState(state: OrbBaseState): void {
    this.baseState = state;
  }

  public setTeachingIntensity(intensity: number): void {
    this.teachingIntensity = Math.max(0, Math.min(1, intensity));
  }

  public handlePointerDown(e: React.PointerEvent): void {
    if (e.button !== 0) {
      return;
    } // Left-click only for drag
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    this.dragStartPointer = { x: e.clientX, y: e.clientY };
    this.dragStartOrb = { ...this.currentPixelPos };
    this.isDragging = false;
  }

  public handlePointerMove(
    e: React.PointerEvent,
    rect: DOMRect,
  ): { isDrag: boolean } {
    const dx = e.clientX - this.dragStartPointer.x;
    const dy = e.clientY - this.dragStartPointer.y;
    const dist = Math.hypot(dx, dy);

    // Track parallax when hovering
    const relX =
      (e.clientX - (rect.left + rect.width * 0.5)) / (rect.width * 0.5);
    const relY =
      (e.clientY - (rect.top + rect.height * 0.5)) / (rect.height * 0.5);
    this.physics.setPointerTarget(relX, -relY);

    if (e.buttons === 1 && dist > ORB_CONSTANTS.DRAG_THRESHOLD_PX) {
      this.isDragging = true;
      const targetX = this.dragStartOrb.x + dx;
      const targetY = this.dragStartOrb.y + dy;

      // Soft magnetic avoidance against protected UI obstacles
      const safePos = this.positionManager.applySoftMagneticAvoidance(
        targetX,
        targetY,
        this.obstacles,
      );

      this.currentPixelPos = safePos;
      this.physics.updateDrag(true, safePos.x, safePos.y);
      this.onPositionUpdate?.(this.currentPixelPos);
      return { isDrag: true };
    }

    return { isDrag: this.isDragging };
  }

  public handlePointerUp(e: React.PointerEvent, onTap: () => void): void {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.physics.updateDrag(
        false,
        this.currentPixelPos.x,
        this.currentPixelPos.y,
      );

      // Persist manual viewport ratio
      if (typeof window !== "undefined") {
        const xRatio = this.currentPixelPos.x / window.innerWidth;
        const yRatio = this.currentPixelPos.y / window.innerHeight;
        this.positionManager.saveManualPosition(xRatio, yRatio);
      }
    } else {
      // Tap interaction
      this.lastTapTimestamp = performance.now();
      this.physics.triggerTapPulse();
      onTap();
    }
  }

  public setHovered(hovered: boolean): void {
    this.isHovered = hovered;
    if (!hovered) {
      this.physics.setPointerTarget(0, 0);
    }
  }

  public resetPosition(): void {
    this.currentPixelPos = this.positionManager.resetToAuto(this.obstacles);
    this.onPositionUpdate?.(this.currentPixelPos);
    this.lastTapTimestamp = performance.now();
    this.physics.triggerTapPulse();
  }

  public resize(pixelSize: number): void {
    this.currentSize = pixelSize;
    this.renderer?.resize(pixelSize);
  }

  /**
   * Main 60fps RequestAnimationFrame Loop
   */
  private startLoop(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!this.isRunning) {
        return;
      }

      const dt = Math.min(0.05, (now - lastTime) * 0.001);
      lastTime = now;

      // Update physical simulation
      const physState = this.physics.update(dt);

      // Determine size baseline based on state
      let targetScale = 1.0;
      switch (this.baseState) {
        case "THINKING":
          targetScale = 1.04;
          break;
        case "SPEAKING":
          targetScale = 1.08;
          break;
        case "PAUSED":
          targetScale = 0.98;
          break;
        case "ERROR":
          targetScale = 0.96;
          break;
        default:
          targetScale = 1.0;
      }
      if (this.isHovered) {
        targetScale *= 1.05;
      }
      this.physics.setScaleTarget(targetScale);

      // If renderer ready, render current frame
      if (this.renderer) {
        // Sample audio
        const bands = this.currentAudioBands;
        const reducedMotion = this.accessibility.isReducedMotion() ? 1.0 : 0.0;
        const tapElapsed = (now - this.lastTapTimestamp) * 0.001;
        const uTapTime = tapElapsed < 2.5 ? tapElapsed : 999.0;
        const canvasLeft = this.currentPixelPos.x - this.currentSize * 0.5;
        const canvasTop = this.currentPixelPos.y - this.currentSize * 0.5;

        const uniforms: OrbShaderUniforms = {
          u_time: now * 0.001,
          u_resolution: [this.currentSize, this.currentSize],
          u_pointer: physState.parallax,
          u_state: 0, // Mapped by renderer
          u_audio_energy: bands.energy,
          u_audio_low: bands.low,
          u_audio_mid: bands.mid,
          u_audio_high: bands.high,
          u_teaching_intensity: this.teachingIntensity,
          u_squish: [physState.squishX, physState.squishY],
          u_drag_velocity: physState.velocity,
          u_reduced_motion: reducedMotion,
          u_accent_color: [0, 0, 0],
          u_core_color: [0, 0, 0],
          u_aura_color: [0, 0, 0],
          u_tap_time: uTapTime,
          u_screen_pos: [canvasLeft, canvasTop],
          u_camera_parallax: physState.cameraParallax,
        };

        this.renderer.render(uniforms, this.baseState);
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  // Audio bands cache
  private currentAudioBands: AudioBands = {
    low: 0,
    mid: 0,
    high: 0,
    energy: 0,
  };

  public updateAudio(
    analyzer: AudioAnalyzer | null | undefined,
    audioElement: HTMLAudioElement | null | undefined,
    isPlaying: boolean,
  ): void {
    this.currentAudioBands = this.audioProcessor.process(
      analyzer,
      audioElement,
      isPlaying,
    );
  }

  public getPixelPosition(): OrbPixelPosition {
    return this.currentPixelPos;
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.renderer?.destroy();
    this.accessibility.destroy();
  }
}
