/**
 * Cognora Voice ORB Component
 *
 * Tier 1 + Tier 2 + Tier 3 Procedural 3D Liquid Glass Voice Presence.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

import { CognoraOrbController } from "./CognoraOrbController";
import {
  ORB_CONSTANTS,
  type CognoraOrbProps,
  type OrbPixelPosition,
} from "./CognoraOrbState";

import "./CognoraOrb.scss";

export const CognoraOrb: React.FC<CognoraOrbProps> = ({
  state,
  caption,
  showCaption = true,
  analyzer,
  audioElement,
  teachingIntensity = 0,
  obstacles = [],
  isVoiceEnabled = true,
  onVoiceToggle,
  onClick,
  onPause,
  onResume,
  onReplay,
  onResetPosition,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<CognoraOrbController | null>(null);

  const [pixelPos, setPixelPos] = useState<OrbPixelPosition>({ x: 32, y: 600 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Initialize Controller
  useEffect(() => {
    const controller = new CognoraOrbController();
    controllerRef.current = controller;

    if (canvasRef.current) {
      controller.init(canvasRef.current, (pos) => {
        setPixelPos(pos);
      });
      controller.resize(ORB_CONSTANTS.DEFAULT_SIZE);
      if (typeof window !== "undefined") {
        (window as any).__COGNORA_ORB_CONTROLLER__ = controller;
      }
    }

    const handleResize = () => {
      if (controllerRef.current) {
        controllerRef.current.resize(ORB_CONSTANTS.DEFAULT_SIZE);
        const pos = controllerRef.current.getPixelPosition();
        setPixelPos(pos);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (typeof window !== "undefined") {
        delete (window as any).__COGNORA_ORB_CONTROLLER__;
      }
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  // Update obstacles when they change
  useEffect(() => {
    controllerRef.current?.setObstacles(obstacles);
  }, [obstacles]);

  // Update State & Teaching Intensity
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setState(state);
      controllerRef.current.setTeachingIntensity(teachingIntensity);
    }
  }, [state, teachingIntensity]);

  // Audio stream feed
  useEffect(() => {
    let active = true;

    const syncAudio = () => {
      if (!active) {
        return;
      }
      if (controllerRef.current) {
        controllerRef.current.updateAudio(
          analyzer,
          audioElement,
          state === "SPEAKING",
        );
      }
      requestAnimationFrame(syncAudio);
    };

    const animId = requestAnimationFrame(syncAudio);
    return () => {
      active = false;
      cancelAnimationFrame(animId);
    };
  }, [analyzer, audioElement, state]);

  // Close context menu on external click
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const closeMenu = () => setIsMenuOpen(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [isMenuOpen]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMenuOpen(false);
    controllerRef.current?.handlePointerDown(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (containerRef.current && controllerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      controllerRef.current.handlePointerMove(e, rect);
    }
  };

  const triggerTap = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }

    if (state === "SPEAKING") {
      onPause?.();
    } else if (state === "PAUSED") {
      onResume?.();
    } else if (state === "COMPLETED") {
      onReplay?.();
    } else if (!isVoiceEnabled) {
      onVoiceToggle?.();
    }
  }, [
    onClick,
    state,
    onPause,
    onResume,
    onReplay,
    isVoiceEnabled,
    onVoiceToggle,
  ]);

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    controllerRef.current?.handlePointerUp(e, triggerTap);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerTap();
    } else if (e.key === "Escape") {
      setIsMenuOpen(false);
    }
  };

  const handleResetPosition = () => {
    controllerRef.current?.resetPosition();
    setIsMenuOpen(false);
    onResetPosition?.();
  };

  const ariaLabel =
    controllerRef.current?.accessibility.getAriaLabel(state, caption) ||
    "Cognora Voice Presence";

  return (
    <div
      className="cognora-orb-presence-root"
      style={{
        transform: `translate3d(${pixelPos.x}px, ${pixelPos.y}px, 0)`,
      }}
      data-purpose="voice-orb-presence"
    >
      <div
        ref={containerRef}
        className="cognora-orb-canvas-container"
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => {
          setIsHovered(true);
          controllerRef.current?.setHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          controllerRef.current?.setHovered(false);
        }}
        title={
          state === "SPEAKING"
            ? "Click to pause voice lesson • Drag to move"
            : state === "PAUSED"
            ? "Click to resume voice lesson • Drag to move"
            : state === "COMPLETED"
            ? "Click to replay lesson • Drag to move"
            : "Cognora Voice Presence • Drag to move"
        }
      >
        {/* Procedural WebGL 3D Canvas */}
        <canvas ref={canvasRef} className="cognora-orb-gl-canvas" />
      </div>

      {/* Liquid Glass Micro-Context Menu */}
      {isMenuOpen && (
        <div
          className="cognora-orb-micro-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {state === "SPEAKING" && (
            <button
              type="button"
              className="micro-menu-item"
              onClick={() => {
                onPause?.();
                setIsMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              <span>Pause Teaching</span>
            </button>
          )}

          {state === "PAUSED" && (
            <button
              type="button"
              className="micro-menu-item"
              onClick={() => {
                onResume?.();
                setIsMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Resume Teaching</span>
            </button>
          )}

          <button
            type="button"
            className="micro-menu-item"
            onClick={() => {
              onReplay?.();
              setIsMenuOpen(false);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Replay Lesson</span>
          </button>

          {onVoiceToggle && (
            <button
              type="button"
              className="micro-menu-item"
              onClick={() => {
                onVoiceToggle();
                setIsMenuOpen(false);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>{isVoiceEnabled ? "Mute Voice" : "Enable Voice"}</span>
            </button>
          )}

          <div className="micro-menu-divider" />

          <button
            type="button"
            className="micro-menu-item"
            onClick={handleResetPosition}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Reset Position</span>
          </button>
        </div>
      )}

      {/* Floating Liquid Glass Speech Caption Pill */}
      {showCaption && caption && (
        <div className="cognora-orb-caption-pill" data-purpose="orb-caption">
          <span
            className={`caption-pulse-dot ${
              state === "SPEAKING" ? "speaking" : ""
            }`}
          />
          <span className="caption-text-content">{caption}</span>
        </div>
      )}
    </div>
  );
};
