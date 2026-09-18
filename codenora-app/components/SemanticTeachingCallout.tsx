/**
 * Cognora Semantic Teaching Callout
 *
 * Pedagogical Responsibility:
 * CANVAS   -> Minimal visual glimpse & dynamic semantic focus anchor ("What is happening right now?")
 * INSPECTOR -> Complete educational lesson, reasoning, invariants & deep causal explanations
 *
 * Architecture:
 * - Dynamically anchors to primary & secondary visual entities without concept-specific hardcoding.
 * - Renders a sleek SVG leader line connecting the callout edge to the target element.
 * - Subtly highlights the target object (stronger emphasis on primary, lighter on secondary).
 * - Implements Cognora Liquid Glass aesthetics with responsive content-aware dimensions.
 */

import React from "react";

import type { ScreenRect, LeaderLineGeometry } from "./leader-line-geometry";

export interface SemanticTeachingCalloutProps {
  title?: string;
  glimpse: string;
  placement: "above" | "below" | "left" | "right" | "floating";
  x: number;
  y: number;
  cardWidth?: number;
  cardHeight?: number;
  targetRect?: ScreenRect | null;
  secondaryTargetRects?: ScreenRect[];
  leaderLine?: LeaderLineGeometry | null;
  onOpenInspector: () => void;
  isInspectorOpen?: boolean;
}

export const SemanticTeachingCallout: React.FC<
  SemanticTeachingCalloutProps
> = ({
  title,
  glimpse,
  placement,
  x,
  y,
  targetRect,
  secondaryTargetRects = [],
  leaderLine,
  onOpenInspector,
  isInspectorOpen = false,
}) => {
  if (!glimpse && !title) {
    return null;
  }

  return (
    <>
      {/* 1. Target Focus Anchors (Subtle Visual Emphasis in Screen Space) */}
      {targetRect && (
        <div
          className="cognora-focus-anchor cognora-focus-anchor--primary"
          style={{
            position: "absolute",
            left: `${targetRect.left - 4}px`,
            top: `${targetRect.top - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            pointerEvents: "none",
            borderRadius: "10px",
            zIndex: 22,
          }}
          aria-hidden="true"
        />
      )}

      {secondaryTargetRects.map((sRect, idx) => (
        <div
          key={`secondary-anchor-${idx}`}
          className="cognora-focus-anchor cognora-focus-anchor--secondary"
          style={{
            position: "absolute",
            left: `${sRect.left - 3}px`,
            top: `${sRect.top - 3}px`,
            width: `${sRect.width + 6}px`,
            height: `${sRect.height + 6}px`,
            pointerEvents: "none",
            borderRadius: "8px",
            zIndex: 21,
          }}
          aria-hidden="true"
        />
      ))}

      {/* 2. Dynamic SVG Leader Line / Stem connecting Callout to Target */}
      {leaderLine && (
        <svg
          className="cognora-callout-stem-layer"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 23,
            overflow: "visible",
          }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="cognora-stem-grad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.95" />
            </linearGradient>
            <marker
              id="cognora-stem-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#4f46e5" />
            </marker>
          </defs>
          <path
            d={leaderLine.path}
            fill="none"
            stroke="url(#cognora-stem-grad)"
            strokeWidth="2"
            strokeLinecap="round"
            markerEnd="url(#cognora-stem-arrow)"
            className="cognora-callout-stem-path"
          />
          <circle
            cx={leaderLine.startX}
            cy={leaderLine.startY}
            r="3"
            fill="#818cf8"
            className="cognora-callout-stem-origin"
          />
        </svg>
      )}

      {/* 3. Compact Contextual Callout Card */}
      <div
        className={`cognora-teaching-glimpse cognora-teaching-callout cognora-teaching-glimpse--${placement} ${
          isInspectorOpen ? "cognora-teaching-glimpse--inspector-active" : ""
        }`}
        style={{
          transform: `translate3d(${x}px, ${y}px, 0)`,
          zIndex: 25,
        }}
        data-purpose="compact-teaching-callout"
        role="region"
        aria-label="Contextual teaching callout"
      >
        <div
          className="cognora-teaching-glimpse__card"
          onClick={onOpenInspector}
          title="Click to open full explanation in Inspector"
        >
          {/* Subtle status indicator */}
          <span className="cognora-teaching-glimpse__indicator" />

          {/* Step Title */}
          {title && (
            <div className="cognora-teaching-glimpse__header">
              <span className="cognora-teaching-glimpse__title" title={title}>
                {title}
              </span>
            </div>
          )}

          {/* Compact Contextual Sentence (1-2 sentences max) */}
          <p className="cognora-teaching-glimpse__text">{glimpse}</p>

          {/* Subtle Inspector Affordance */}
          <div className="cognora-teaching-glimpse__footer">
            <button
              type="button"
              className="cognora-teaching-glimpse__affordance"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInspector();
              }}
              title="Open Inspector for complete step explanation"
            >
              <span className="cognora-teaching-glimpse__affordance-label">
                View details
              </span>
              <span className="cognora-teaching-glimpse__affordance-arrow">
                &rarr;
              </span>
              <span className="cognora-teaching-glimpse__affordance-target">
                Inspector
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Aliases for unified backwards compatibility
export const CompactTeachingCallout = SemanticTeachingCallout;
export const CompactTeachingGlimpse = SemanticTeachingCallout;
