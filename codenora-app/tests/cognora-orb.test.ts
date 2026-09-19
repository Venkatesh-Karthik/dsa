// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

import { OrbPositionManager } from "../components/CognoraOrb/CognoraOrbPosition";
import { OrbPhysics } from "../components/CognoraOrb/CognoraOrbPhysics";
import { OrbAudioProcessor } from "../components/CognoraOrb/CognoraOrbAudio";
import { OrbAccessibilityManager } from "../components/CognoraOrb/CognoraOrbAccessibility";
import { CognoraOrbController } from "../components/CognoraOrb/CognoraOrbController";

import type { ViewportObstacle } from "../components/CognoraOrb/CognoraOrbState";

describe("Cognora 3D Liquid Glass Voice ORB System", () => {
  describe("OrbPositionManager", () => {
    let manager: OrbPositionManager;

    beforeEach(() => {
      // Clear mock localStorage
      if (typeof window !== "undefined") {
        window.localStorage.clear();
      }
      manager = new OrbPositionManager();
    });

    it("calculates initial safe position avoiding obstacles", () => {
      const obstacles: ViewportObstacle[] = [
        {
          id: "navbar",
          name: "Navbar",
          bounds: { left: 0, top: 0, right: 1200, bottom: 60 },
          priority: "critical",
        },
      ];

      const pos = manager.calculateAutoPosition(obstacles);
      expect(pos.x).toBeGreaterThanOrEqual(28);
      expect(pos.y).toBeGreaterThan(60); // Must be below navbar
    });

    it("persists manual position and restores it", () => {
      manager.saveManualPosition(0.4, 0.5);
      expect(manager.isManual()).toBe(true);

      // Create new instance to test persistence
      const restored = new OrbPositionManager();
      expect(restored.isManual()).toBe(true);
      const pixelPos = restored.getPixelPosition();
      expect(pixelPos.x).toBeCloseTo(window.innerWidth * 0.4, -1);
      expect(pixelPos.y).toBeCloseTo(window.innerHeight * 0.5, -1);
    });

    it("resets to auto mode when requested", () => {
      manager.saveManualPosition(0.7, 0.3);
      expect(manager.isManual()).toBe(true);

      const autoPos = manager.resetToAuto();
      expect(manager.isManual()).toBe(false);
      expect(autoPos.x).toBeDefined();
      expect(autoPos.y).toBeDefined();
    });

    it("applies soft magnetic avoidance near protected obstacles", () => {
      const obstacles: ViewportObstacle[] = [
        {
          id: "bottom-controls",
          name: "Bottom Controls",
          bounds: { left: 400, top: 600, right: 800, bottom: 720 },
          priority: "critical",
        },
      ];

      // Drag target right on the obstacle border
      const unsafeX = 405;
      const unsafeY = 605;
      const deflected = manager.applySoftMagneticAvoidance(
        unsafeX,
        unsafeY,
        obstacles,
      );

      // The deflected position should be pushed away from the obstacle
      expect(deflected.x).not.toBe(unsafeX);
    });
  });

  describe("OrbPhysics", () => {
    let physics: OrbPhysics;

    beforeEach(() => {
      physics = new OrbPhysics();
    });

    it("updates spring simulation smoothly without NaN values", () => {
      physics.setScaleTarget(1.25);
      const state = physics.update(0.016);

      expect(isNaN(state.scale)).toBe(false);
      expect(state.scale).toBeGreaterThan(0.9);
      expect(isNaN(state.squishX)).toBe(false);
      expect(isNaN(state.squishY)).toBe(false);
    });

    it("calculates directional stretch and squish during drag", () => {
      physics.updateDrag(true, 100, 100);
      physics.updateDrag(true, 160, 100); // Moving horizontally to the right

      const state = physics.update(0.016);
      expect(state.squishX).toBeGreaterThanOrEqual(1.0);
      expect(state.coreOffset[0]).toBeLessThan(0); // Internal light lags behind motion
    });

    it("returns to resting state when drag ends", () => {
      physics.updateDrag(false, 100, 100);
      for (let i = 0; i < 30; i++) {
        physics.update(0.016);
      }
      const state = physics.update(0.016);
      expect(state.squishX).toBeCloseTo(1.0, 1);
      expect(state.squishY).toBeCloseTo(1.0, 1);
    });

    it("responds to pointer parallax", () => {
      physics.setPointerTarget(0.8, -0.6);
      for (let i = 0; i < 10; i++) {
        physics.update(0.016);
      }
      const state = physics.update(0.016);
      expect(state.parallax[0]).toBeGreaterThan(0);
      expect(state.parallax[1]).toBeLessThan(0);
    });
  });

  describe("OrbAudioProcessor", () => {
    let processor: OrbAudioProcessor;

    beforeEach(() => {
      processor = new OrbAudioProcessor();
    });

    it("returns zero or decaying bands when paused or inactive", () => {
      const bands = processor.process(null, null, false);
      expect(bands.energy).toBe(0);
      expect(bands.low).toBe(0);
      expect(bands.mid).toBe(0);
      expect(bands.high).toBe(0);
    });

    it("smooths mock frequency analysis without abrupt jumps", () => {
      const mockAnalyzer: any = {
        getEnergy: () => 0.65,
      };
      const mockAudio = {
        paused: false,
        ended: false,
      } as HTMLAudioElement;

      const bands = processor.process(mockAnalyzer, mockAudio, true);
      expect(bands.energy).toBe(0.65);
      expect(bands.low).toBeGreaterThan(0);
      expect(bands.mid).toBeGreaterThan(0);
    });
  });

  describe("OrbAccessibilityManager", () => {
    let a11y: OrbAccessibilityManager;

    beforeEach(() => {
      a11y = new OrbAccessibilityManager();
    });

    it("generates correct ARIA labels across teaching states", () => {
      expect(a11y.getAriaLabel("SPEAKING", "Insert 30 into tree")).toContain(
        "Insert 30 into tree",
      );
      expect(a11y.getAriaLabel("PAUSED")).toContain("Paused");
      expect(a11y.getAriaLabel("COMPLETED")).toContain("completed");
      expect(a11y.getAriaLabel("ERROR")).toContain("unavailable");
      expect(a11y.getAriaLabel("VOICE_OFF")).toContain("disabled");
    });
  });

  describe("CognoraOrbController", () => {
    it("handles state and teaching intensity updates without errors", () => {
      const controller = new CognoraOrbController();
      controller.setState("SPEAKING");
      controller.setTeachingIntensity(0.85);

      const pos = controller.getPixelPosition();
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.y).toBeGreaterThan(0);

      controller.destroy();
    });
  });
});
