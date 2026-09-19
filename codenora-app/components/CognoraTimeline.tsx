import React from "react";

import { CognoraVoiceButton } from "./CognoraVoiceButton";

import type { VoiceState } from "../ai/voice/voice-contract";

export interface CognoraTimelineProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onReplay?: () => void;
  onCycleSpeed: () => void;
  onSeek: (stepIndex: number) => void;
  onTogglePresentation?: () => void;
  isPresentationMode?: boolean;
  onCloseLesson?: () => void;
  voiceState?: VoiceState;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  onPlayVoice?: () => void;
  onPauseVoice?: () => void;
  onResumeVoice?: () => void;
  onStopVoice?: () => void;
  onReplayVoice?: () => void;
}

export const CognoraTimeline: React.FC<CognoraTimelineProps> = ({
  currentStep,
  totalSteps,
  isPlaying,
  speed,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onTogglePlay,
  onReplay,
  onCycleSpeed,
  onSeek,
  onTogglePresentation,
  isPresentationMode = false,
  onCloseLesson,
  voiceState = "idle",
  voiceEnabled = true,
  onToggleVoice,
  onPlayVoice,
  onPauseVoice,
  onResumeVoice,
  onStopVoice,
  onReplayVoice,
}) => {
  const progressPercent =
    totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetStep = Math.min(
      totalSteps,
      Math.max(1, Math.round(ratio * totalSteps)),
    );
    onSeek(targetStep - 1);
  };

  return (
    <div
      className="cognora-timeline-bar"
      data-purpose="playback-controls"
      role="region"
      aria-label="Lesson playback controls"
    >
      {/* Step Back */}
      <button
        type="button"
        className="cognora-timeline-bar__icon-btn"
        onClick={onPrev}
        disabled={!canPrev}
        title="Previous Step"
        aria-label="Previous Step"
      >
        <svg
          style={{ width: "16px", height: "16px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M15 19l-7-7 7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        className="cognora-timeline-bar__play-btn"
        onClick={onTogglePlay}
        title={isPlaying ? "Pause Playback" : "Play Lesson"}
        aria-label={isPlaying ? "Pause Playback" : "Play Lesson"}
      >
        {isPlaying ? (
          <svg
            style={{ width: "14px", height: "14px" }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg
            style={{ width: "14px", height: "14px", marginLeft: "2px" }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Step Forward */}
      <button
        type="button"
        className="cognora-timeline-bar__icon-btn"
        onClick={onNext}
        disabled={!canNext}
        title="Next Step"
        aria-label="Next Step"
      >
        <svg
          style={{ width: "16px", height: "16px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M9 5l7 7-7 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      {/* Replay */}
      {onReplay && (
        <button
          type="button"
          className="cognora-timeline-bar__icon-btn"
          onClick={onReplay}
          title="Replay Lesson"
          aria-label="Replay Lesson"
        >
          <svg
            style={{ width: "15px", height: "15px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      )}

      {/* Voice Mute / Unmute Toggle Button */}
      {onToggleVoice ? (
        <button
          type="button"
          className={`cognora-timeline-bar__icon-btn ${
            voiceEnabled
              ? "cognora-timeline-bar__icon-btn--voice-on"
              : "cognora-timeline-bar__icon-btn--voice-off"
          }`}
          onClick={onToggleVoice}
          title={
            voiceEnabled
              ? "Mute Voice Explanation (Voice On)"
              : "Unmute Voice Explanation (Voice Off)"
          }
          aria-label={
            voiceEnabled ? "Mute Voice Explanation" : "Unmute Voice Explanation"
          }
          style={{
            color: voiceEnabled
              ? "var(--color-primary, #3b82f6)"
              : "var(--color-text-secondary, #94a3b8)",
            transition: "all 0.2s ease",
          }}
        >
          {voiceEnabled ? (
            <svg
              style={{ width: "16px", height: "16px" }}
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
          ) : (
            <svg
              style={{ width: "16px", height: "16px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 14l4-4m0 0l-4-4m4 4H17"
              />
            </svg>
          )}
        </button>
      ) : onPlayVoice ? (
        <div
          style={{
            marginLeft: "4px",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <CognoraVoiceButton
            state={voiceState}
            onPlay={onPlayVoice}
            onPause={onPauseVoice || (() => {})}
            onResume={onResumeVoice || (() => {})}
            onStop={onStopVoice || (() => {})}
            onReplay={onReplayVoice || (() => {})}
            compact
          />
        </div>
      ) : null}

      <div className="cognora-timeline-bar__divider" />

      {/* Step Counter & Progress Bar */}
      <div className="cognora-timeline-bar__progress-group">
        <span className="cognora-timeline-bar__step-label">
          Step {currentStep} / {totalSteps}
        </span>
        <div
          className="cognora-timeline-bar__progress-track"
          onClick={handleTrackClick}
          title="Click to seek"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        >
          <div
            className="cognora-timeline-bar__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="cognora-timeline-bar__divider" />

      {/* Speed Selector */}
      <button
        type="button"
        className="cognora-timeline-bar__speed-btn"
        onClick={onCycleSpeed}
        title="Playback Speed"
        aria-label={`Playback speed ${speed}x`}
      >
        <span>{speed}x</span>
        <svg
          style={{ width: "12px", height: "12px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M19 9l-7 7-7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      {/* Presentation Fullscreen Expand */}
      {onTogglePresentation && (
        <button
          type="button"
          className="cognora-timeline-bar__icon-btn"
          onClick={onTogglePresentation}
          title={
            isPresentationMode ? "Exit Presentation Mode" : "Presentation Mode"
          }
          aria-label="Presentation Mode"
        >
          <svg
            style={{ width: "14px", height: "14px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      )}

      {/* Close Lesson */}
      {onCloseLesson && (
        <button
          type="button"
          className="cognora-timeline-bar__icon-btn"
          onClick={onCloseLesson}
          title="Exit Lesson"
          aria-label="Exit Lesson"
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M6 18L18 6M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      )}
    </div>
  );
};
