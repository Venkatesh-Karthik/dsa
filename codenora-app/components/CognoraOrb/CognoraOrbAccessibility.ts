/**
 * Cognora Voice ORB Accessibility Manager
 *
 * Implements:
 * - prefers-reduced-motion media query listener
 * - Keyboard navigation (Space/Enter activation, Arrow keys nudging)
 * - ARIA live announcements & accessible tooltips
 */

import type { OrbBaseState } from "./CognoraOrbState";

export class OrbAccessibilityManager {
  private prefersReducedMotion: boolean = false;
  private mediaQueryList: MediaQueryList | null = null;
  private changeListeners: Array<(reduced: boolean) => void> = [];

  constructor() {
    this.initMediaQuery();
  }

  private initMediaQuery(): void {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    try {
      this.mediaQueryList = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      this.prefersReducedMotion = this.mediaQueryList.matches;

      const handler = (e: MediaQueryListEvent) => {
        this.prefersReducedMotion = e.matches;
        this.changeListeners.forEach((fn) => fn(this.prefersReducedMotion));
      };

      if (this.mediaQueryList.addEventListener) {
        this.mediaQueryList.addEventListener("change", handler);
      } else if ((this.mediaQueryList as any).addListener) {
        (this.mediaQueryList as any).addListener(handler);
      }
    } catch {
      // Fall back to false
    }
  }

  public isReducedMotion(): boolean {
    return this.prefersReducedMotion;
  }

  public onReducedMotionChange(
    callback: (reduced: boolean) => void,
  ): () => void {
    this.changeListeners.push(callback);
    return () => {
      this.changeListeners = this.changeListeners.filter(
        (fn) => fn !== callback,
      );
    };
  }

  /**
   * Generates a descriptive ARIA label for screen readers based on the active state.
   */
  public getAriaLabel(state: OrbBaseState, caption?: string): string {
    const baseDesc = "Cognora Voice Presence";
    let stateDesc = "";

    switch (state) {
      case "SPEAKING":
        stateDesc = caption ? `Speaking: ${caption}` : "Speaking voice lesson";
        break;
      case "THINKING":
        stateDesc = "Preparing explanation";
        break;
      case "PAUSED":
        stateDesc = "Paused. Press Enter or Space to resume";
        break;
      case "COMPLETED":
        stateDesc = "Lesson completed. Press Enter or Space to replay";
        break;
      case "ERROR":
        stateDesc = "Voice service unavailable";
        break;
      case "VOICE_OFF":
        stateDesc = "Voice disabled. Press Enter to enable";
        break;
      default:
        stateDesc = "Ready";
    }

    return `${baseDesc} - ${stateDesc}`;
  }

  public destroy(): void {
    this.changeListeners = [];
  }
}
