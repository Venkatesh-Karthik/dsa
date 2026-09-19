import React from "react";

import type { VoiceState } from "../ai/voice/voice-contract";

export interface CognoraVoiceButtonProps {
  state: VoiceState;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReplay: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export const CognoraVoiceButton: React.FC<CognoraVoiceButtonProps> = ({
  state,
  onPlay,
  onPause,
  onResume,
  onStop,
  onReplay,
  disabled = false,
  compact = false,
}) => {
  if (state === "speaking") {
    return (
      <div
        className="cognora-voice-controls-group"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <button
          type="button"
          className="cognora-voice-btn cognora-voice-btn--speaking"
          onClick={onPause}
          disabled={disabled}
          title="Pause Voice Explanation"
          aria-label="Pause Voice Explanation"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: compact ? "4px 8px" : "6px 12px",
            borderRadius: "18px",
            background: "rgba(59, 130, 246, 0.2)",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            color: "var(--color-primary, #3b82f6)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
        >
          <svg
            style={{ width: "12px", height: "12px" }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          {!compact && <span>Pause</span>}
        </button>

        <button
          type="button"
          className="cognora-voice-btn cognora-voice-btn--stop"
          onClick={onStop}
          disabled={disabled}
          title="Stop Voice Explanation"
          aria-label="Stop Voice Explanation"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: compact ? "4px 8px" : "6px 8px",
            borderRadius: "18px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: "12px",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
        >
          <svg
            style={{ width: "12px", height: "12px" }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="4" y="4" width="16" height="16" />
          </svg>
        </button>
      </div>
    );
  }

  if (state === "paused") {
    return (
      <div
        className="cognora-voice-controls-group"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <button
          type="button"
          className="cognora-voice-btn cognora-voice-btn--resume"
          onClick={onResume}
          disabled={disabled}
          title="Resume Voice Explanation"
          aria-label="Resume Voice Explanation"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: compact ? "4px 8px" : "6px 12px",
            borderRadius: "18px",
            background: "rgba(59, 130, 246, 0.15)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            color: "var(--color-primary, #3b82f6)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
        >
          <svg
            style={{ width: "12px", height: "12px" }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {!compact && <span>Resume</span>}
        </button>

        <button
          type="button"
          className="cognora-voice-btn cognora-voice-btn--stop"
          onClick={onStop}
          disabled={disabled}
          title="Stop Voice Explanation"
          aria-label="Stop Voice Explanation"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: compact ? "4px 8px" : "6px 8px",
            borderRadius: "18px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: "12px",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
        >
          <svg
            style={{ width: "12px", height: "12px" }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="4" y="4" width="16" height="16" />
          </svg>
        </button>
      </div>
    );
  }

  if (state === "preparing") {
    return (
      <button
        type="button"
        className="cognora-voice-btn cognora-voice-btn--preparing"
        disabled
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: compact ? "4px 8px" : "6px 12px",
          borderRadius: "18px",
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          color: "var(--color-text-secondary, #94a3b8)",
          fontSize: "12px",
          cursor: "wait",
          backdropFilter: "blur(12px)",
        }}
      >
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            border: "2px solid #3b82f6",
            borderTopColor: "transparent",
            animation: "spin 1s linear infinite",
          }}
        />
        <span>Preparing Voice...</span>
      </button>
    );
  }

  if (state === "finished") {
    return (
      <button
        type="button"
        className="cognora-voice-btn cognora-voice-btn--replay"
        onClick={onReplay}
        disabled={disabled}
        title="Replay Voice Explanation"
        aria-label="Replay Voice Explanation"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: compact ? "4px 8px" : "6px 12px",
          borderRadius: "18px",
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          color: "var(--color-text, #f1f5f9)",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          transition: "all 0.2s ease",
        }}
      >
        <svg
          style={{ width: "12px", height: "12px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {!compact && <span>Replay Voice</span>}
      </button>
    );
  }

  // Default: idle or error
  return (
    <button
      type="button"
      className="cognora-voice-btn cognora-voice-btn--play"
      onClick={onPlay}
      disabled={disabled}
      title={
        state === "error" ? "Retry Voice Explanation" : "Listen to Explanation"
      }
      aria-label="Listen to Explanation"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: compact ? "4px 8px" : "6px 12px",
        borderRadius: "18px",
        background:
          state === "error"
            ? "rgba(239, 68, 68, 0.12)"
            : "rgba(59, 130, 246, 0.12)",
        border:
          state === "error"
            ? "1px solid rgba(239, 68, 68, 0.3)"
            : "1px solid rgba(59, 130, 246, 0.25)",
        color: state === "error" ? "#ef4444" : "var(--color-primary, #3b82f6)",
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        backdropFilter: "blur(12px)",
        transition: "all 0.2s ease",
      }}
    >
      <svg
        style={{ width: "13px", height: "13px" }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        />
      </svg>
      {!compact && <span>{state === "error" ? "Retry Voice" : "Listen"}</span>}
    </button>
  );
};
