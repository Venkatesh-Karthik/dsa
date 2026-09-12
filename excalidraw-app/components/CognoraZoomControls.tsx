import React from "react";

import { IconMinus, IconPlus } from "./CognoraIcons";

export interface CognoraZoomControlsProps {
  zoomValue: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
  onToggleFullscreen?: () => void;
}

export const CognoraZoomControls: React.FC<CognoraZoomControlsProps> = ({
  zoomValue,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
}) => {
  const displayZoom = Math.round(zoomValue * 100);

  return (
    <div
      className="cognora-zoom-controls"
      data-purpose="canvas-zoom-control"
      role="group"
      aria-label="Zoom controls"
    >
      <button
        type="button"
        className="cognora-zoom-controls__btn"
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <IconMinus size={14} />
      </button>
      <button
        type="button"
        className="cognora-zoom-controls__value"
        onClick={onResetZoom}
        title="Reset Zoom to 100%"
        aria-label="Current zoom"
      >
        {displayZoom}%
      </button>
      <button
        type="button"
        className="cognora-zoom-controls__btn"
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
      >
        <IconPlus size={14} />
      </button>
      {onToggleFullscreen && (
        <>
          <div className="cognora-zoom-controls__divider" />
          <button
            type="button"
            className="cognora-zoom-controls__btn cognora-zoom-controls__btn--fullscreen"
            onClick={onToggleFullscreen}
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
          >
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ width: "13px", height: "13px" }}
            >
              <path
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
};
