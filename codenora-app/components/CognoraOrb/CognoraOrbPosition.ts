/**
 * Cognora Voice ORB Viewport Positioning & Obstacle Model
 *
 * Implements:
 * - Viewport-relative coordinates (xRatio, yRatio)
 * - Safe margin clamping
 * - 3 Modes: AUTO, MANUAL, RESET
 * - Viewport Obstacle Model (Navbar, Tutor, Inspector, Playback, Composer, Callout)
 * - Soft Magnetic Avoidance
 * - Persistence in localStorage
 */

import {
  ORB_CONSTANTS,
  type OrbPixelPosition,
  type OrbPositionRatio,
  type ViewportObstacle,
} from "./CognoraOrbState";

export class OrbPositionManager {
  private currentRatio: OrbPositionRatio = { xRatio: 0.08, yRatio: 0.74 };
  private isManualPosition: boolean = false;
  private safeMarginPx: number = 24;
  private orbDiameter: number = ORB_CONSTANTS.DEFAULT_SIZE;

  constructor() {
    this.loadPersistedPosition();
  }

  /**
   * Loads saved position from localStorage if available.
   */
  private loadPersistedPosition(): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      const isManual = window.localStorage.getItem(
        ORB_CONSTANTS.STORAGE_KEY_MANUAL_FLAG,
      );
      if (isManual === "true") {
        const rawPos = window.localStorage.getItem(ORB_CONSTANTS.STORAGE_KEY_POSITION);
        if (rawPos) {
          const parsed = JSON.parse(rawPos);
          if (
            typeof parsed.xRatio === "number" &&
            typeof parsed.yRatio === "number" &&
            !isNaN(parsed.xRatio) &&
            !isNaN(parsed.yRatio)
          ) {
            this.currentRatio = {
              xRatio: Math.max(0.02, Math.min(0.95, parsed.xRatio)),
              yRatio: Math.max(0.05, Math.min(0.95, parsed.yRatio)),
            };
            this.isManualPosition = true;
          }
        }
      }
    } catch {
      // Fall back to auto calculation
    }
  }

  /**
   * Persists manual position to localStorage.
   */
  public saveManualPosition(xRatio: number, yRatio: number): void {
    this.currentRatio = {
      xRatio: Math.max(0.02, Math.min(0.95, xRatio)),
      yRatio: Math.max(0.05, Math.min(0.95, yRatio)),
    };
    this.isManualPosition = true;

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(
          ORB_CONSTANTS.STORAGE_KEY_POSITION,
          JSON.stringify(this.currentRatio),
        );
        window.localStorage.setItem(ORB_CONSTANTS.STORAGE_KEY_MANUAL_FLAG, "true");
      } catch {
        // Silently ignore storage quota or private browsing errors
      }
    }
  }

  /**
   * Resets position back to Mode 1 (AUTO safe placement).
   */
  public resetToAuto(obstacles: ViewportObstacle[] = []): OrbPixelPosition {
    this.isManualPosition = false;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(ORB_CONSTANTS.STORAGE_KEY_POSITION);
        window.localStorage.removeItem(ORB_CONSTANTS.STORAGE_KEY_MANUAL_FLAG);
      } catch {
        // Ignore
      }
    }
    return this.calculateAutoPosition(obstacles);
  }

  /**
   * Computes the initial/auto safe position avoiding known UI obstacles.
   */
  public calculateAutoPosition(
    obstacles: ViewportObstacle[] = [],
  ): OrbPixelPosition {
    if (typeof window === "undefined") {
      return { x: 32, y: 600 };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Check 4 candidate positions: Lower-Left, Top-Left, Bottom-Right, Top-Right
    const candidates: OrbPixelPosition[] = [
      { x: Math.max(96, vw * 0.08), y: Math.min(vh - 160, vh * 0.74) }, // Lower-Left (clean default)
      { x: Math.max(96, vw * 0.08), y: Math.max(140, vh * 0.18) }, // Top-Left
      { x: Math.min(vw - 96, vw * 0.9), y: Math.min(vh - 160, vh * 0.74) }, // Bottom-Right
      { x: Math.min(vw - 96, vw * 0.9), y: Math.max(140, vh * 0.18) }, // Top-Right
    ];

    let bestPos = candidates[0];

    for (const candidatePos of candidates) {
      // Check if candidate collides with any registered obstacle
      const hasCollision = obstacles.some((obs) => {
        const halfSize = this.orbDiameter * 0.5;
        const orbLeft = candidatePos.x - halfSize;
        const orbTop = candidatePos.y - halfSize;
        const orbRight = candidatePos.x + halfSize;
        const orbBottom = candidatePos.y + halfSize;

        return !(
          orbRight < obs.bounds.left ||
          orbLeft > obs.bounds.right ||
          orbBottom < obs.bounds.top ||
          orbTop > obs.bounds.bottom
        );
      });

      if (!hasCollision) {
        bestPos = candidatePos;
        break;
      }
    }

    this.currentRatio = {
      xRatio: bestPos.x / vw,
      yRatio: bestPos.y / vh,
    };
    return bestPos;
  }

  /**
   * Converts current normalized ratio to absolute pixel coordinates.
   */
  public getPixelPosition(
    obstacles: ViewportObstacle[] = [],
  ): OrbPixelPosition {
    if (typeof window === "undefined") {
      return { x: 32, y: 600 };
    }

    if (!this.isManualPosition) {
      return this.calculateAutoPosition(obstacles);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const rawX = this.currentRatio.xRatio * vw;
    const rawY = this.currentRatio.yRatio * vh;

    // Clamp inside viewport margins
    const half = this.orbDiameter * 0.5;
    const minX = half + this.safeMarginPx;
    const maxX = vw - half - this.safeMarginPx;
    const minY = half + this.safeMarginPx + 40; // Avoid navbar
    const maxY = vh - half - this.safeMarginPx;

    return {
      x: Math.max(minX, Math.min(maxX, rawX)),
      y: Math.max(minY, Math.min(maxY, rawY)),
    };
  }

  /**
   * Applies Soft Magnetic Avoidance during user drag:
   * If the dragged center gets close to a protected zone (e.g. Playback Scrubber or Tutor panel),
   * a soft repulsive vector gently deflects it toward open space.
   */
  public applySoftMagneticAvoidance(
    x: number,
    y: number,
    obstacles: ViewportObstacle[] = [],
  ): OrbPixelPosition {
    let adjustedX = x;
    let adjustedY = y;
    const repulsionDistance = 35; // Proximity field

    for (const obs of obstacles) {
      const b = obs.bounds;
      // Expand obstacle bounds by half diameter + buffer
      const expLeft = b.left - this.orbDiameter * 0.5;
      const expRight = b.right + this.orbDiameter * 0.5;
      const expTop = b.top - this.orbDiameter * 0.5;
      const expBottom = b.bottom + this.orbDiameter * 0.5;

      if (
        adjustedX > expLeft - repulsionDistance &&
        adjustedX < expRight + repulsionDistance &&
        adjustedY > expTop - repulsionDistance &&
        adjustedY < expBottom + repulsionDistance
      ) {
        // Calculate nearest exit direction
        const distLeft = Math.abs(adjustedX - expLeft);
        const distRight = Math.abs(adjustedX - expRight);
        const distTop = Math.abs(adjustedY - expTop);
        const distBottom = Math.abs(adjustedY - expBottom);

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        const pushFactor = 0.25;

        if (minDist === distLeft) {
          adjustedX -= (repulsionDistance - distLeft) * pushFactor;
        } else if (minDist === distRight) {
          adjustedX += (repulsionDistance - distRight) * pushFactor;
        } else if (minDist === distTop) {
          adjustedY -= (repulsionDistance - distTop) * pushFactor;
        } else {
          adjustedY += (repulsionDistance - distBottom) * pushFactor;
        }
      }
    }

    // Viewport bounds clamping
    if (typeof window !== "undefined") {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const half = this.orbDiameter * 0.5;
      adjustedX = Math.max(half + 12, Math.min(vw - half - 12, adjustedX));
      adjustedY = Math.max(half + 50, Math.min(vh - half - 12, adjustedY));
    }

    return { x: adjustedX, y: adjustedY };
  }

  public isManual(): boolean {
    return this.isManualPosition;
  }
}
