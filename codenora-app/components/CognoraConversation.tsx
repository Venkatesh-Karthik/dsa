import React, { useEffect, useRef } from "react";

import { IconAlert, IconReplay, IconSparkles } from "./CognoraIcons";

import type { ChatMessage } from "./AITeachingAgent";

export type TeachingRequestState =
  | "idle"
  | "sending"
  | "thinking"
  | "success"
  | "error";

export interface CognoraConversationProps {
  messages: ChatMessage[];
  requestState: TeachingRequestState;
  errorMessage?: string | null;
  errorCode?: string | null;
  onRetry?: () => void;
  isTeachingRequestActive: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export const CognoraConversation: React.FC<CognoraConversationProps> = ({
  messages,
  requestState,
  errorMessage,
  errorCode,
  onRetry,
  isTeachingRequestActive,
  isMinimized = false,
  onToggleMinimize,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change or thinking state appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, requestState]);

  const hasContent =
    messages.length > 0 || isTeachingRequestActive || requestState === "error";

  if (!hasContent) {
    return null;
  }

  if (isMinimized) {
    const lastMsg = messages[messages.length - 1];
    return (
      <div className="cognora-conversation-minimized">
        <button
          type="button"
          className="cognora-conversation-minimized__btn"
          onClick={onToggleMinimize}
          title="Expand conversation"
          aria-label="Expand conversation"
        >
          <span className="cognora-conversation-minimized__dot" />
          <span className="cognora-conversation-minimized__title">
            {isTeachingRequestActive
              ? "Building visual explanation..."
              : lastMsg?.topic || "Lesson Conversation"}
          </span>
          <svg
            style={{ width: "14px", height: "14px", marginLeft: "4px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 15l7-7 7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="cognora-conversation"
      role="log"
      aria-label="Teaching Conversation"
      data-purpose="conversation-thread"
    >
      <div className="cognora-conversation__header">
        <div className="cognora-conversation__header-title">
          <IconSparkles size={14} />
          <span>Cognora Tutor</span>
          {isTeachingRequestActive && (
            <span className="cognora-conversation__status-badge">
              Processing
            </span>
          )}
        </div>
        {onToggleMinimize && (
          <button
            type="button"
            className="cognora-conversation__minimize-btn"
            onClick={onToggleMinimize}
            title="Minimize conversation"
            aria-label="Minimize conversation"
          >
            <svg
              style={{ width: "14px", height: "14px" }}
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
        )}
      </div>

      <div ref={scrollRef} className="cognora-conversation__scroll-area">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`cognora-conversation__message cognora-conversation__message--${msg.role}`}
          >
            {msg.role === "user" ? (
              <div className="cognora-conversation__user-bubble">
                {msg.content}
              </div>
            ) : (
              <div className="cognora-conversation__assistant-card">
                {msg.topic && (
                  <div className="cognora-conversation__topic-tag">
                    {msg.topic}
                  </div>
                )}
                <div className="cognora-conversation__text">{msg.content}</div>
                {msg.hasVisuals && (
                  <div className="cognora-conversation__canvas-ready">
                    <span className="cognora-conversation__canvas-ready-dot" />
                    <span>Visual lesson ready on canvas</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Premium Animated Thinking State */}
        {isTeachingRequestActive && (
          <div className="cognora-conversation__thinking">
            <div className="cognora-thinking-state">
              <div className="cognora-thinking-state__orb-wrapper">
                <div className="cognora-thinking-state__orb-pulse" />
                <div className="cognora-thinking-state__orb-core" />
              </div>
              <div className="cognora-thinking-state__copy">
                <div className="cognora-thinking-state__heading">
                  <span>Thinking</span>
                  <span className="cognora-thinking-state__dots">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
                <div className="cognora-thinking-state__subheading">
                  Building your visual explanation
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Polished Error State - Only appears for a failed user prompt, never below a successful assistant response */}
        {requestState === "error" &&
          !isTeachingRequestActive &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === "user" && (
            <div className="cognora-conversation__error">
              <div className="cognora-error-state">
                <div className="cognora-error-state__header">
                  <div className="cognora-error-state__icon">
                    <IconAlert size={15} />
                  </div>
                  <span className="cognora-error-state__title">
                    {errorCode === "AUTHENTICATION_ERROR" ||
                    errorCode === "AUTH_FAILED"
                      ? "Authentication failed"
                      : errorCode === "RATE_LIMIT"
                      ? "Rate limit reached"
                      : errorCode === "STRUCTURED_OUTPUT_ERROR" ||
                        errorCode === "SCHEMA_ERROR" ||
                        errorCode === "VALIDATION_ERROR"
                      ? "Lesson format error"
                      : errorCode === "SEMANTIC_VALIDATION_ERROR"
                      ? "Visual validation error"
                      : errorCode === "LAYOUT_ERROR" ||
                        errorCode === "RENDER_ERROR" ||
                        errorCode === "VISUAL_PROJECTION_ERROR"
                      ? "Canvas layout error"
                      : errorCode === "PROVIDER_CAPACITY" ||
                        errorCode === "CREDIT_CAPACITY_EXCEEDED"
                      ? "Capacity limit reached"
                      : errorCode === "TIMEOUT"
                      ? "Generation timed out"
                      : errorCode === "NETWORK_ERROR"
                      ? "Network connection error"
                      : errorCode === "PROVIDER_UNAVAILABLE" ||
                        errorCode === "SERVICE_UNAVAILABLE"
                      ? "AI service unavailable"
                      : "Something went wrong"}
                  </span>
                </div>
                <p className="cognora-error-state__message">
                  {errorMessage || "Your visual lesson could not be generated."}
                </p>
                {onRetry && (
                  <button
                    type="button"
                    className="cognora-error-state__retry-btn"
                    onClick={onRetry}
                    disabled={isTeachingRequestActive}
                  >
                    <IconReplay size={13} />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
