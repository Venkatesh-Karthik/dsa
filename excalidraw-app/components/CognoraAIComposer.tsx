import React, { useState, useRef, useEffect } from "react";

import { formatSelectedElementChip } from "../ai/selection-context";

import type { SelectedSemanticElement } from "../ai/teaching-contract";
import type { CanvasInteractionDelta } from "../ai/semantic-canvas";
import type { AutocompleteSuggestion } from "../ai/commands";

export interface CognoraAIComposerProps {
  inputValue: string;
  onInputChange: (val: string) => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  isPanelOpen?: boolean;
  selectedContext?: SelectedSemanticElement[];
  onClearSelectedContext?: () => void;
  pendingInteraction?: CanvasInteractionDelta | null;
  onClearPendingInteraction?: () => void;
  showAutocomplete?: boolean;
  autocompleteSuggestions?: AutocompleteSuggestion[];
  selectedSuggestionIndex?: number;
  onSelectSuggestion?: (sug: AutocompleteSuggestion) => void;
  onSuggestionHover?: (idx: number) => void;
  suggestions?: string[];
  onSuggestionClick?: (prompt: string) => void;
  onAttachFile?: (file: File) => void;
  children?: React.ReactNode;
}

export const CognoraAIComposer: React.FC<CognoraAIComposerProps> = ({
  inputValue,
  onInputChange,
  onSubmit,
  isLoading,
  isPanelOpen = false,
  selectedContext = [],
  onClearSelectedContext,
  pendingInteraction,
  onClearPendingInteraction,
  showAutocomplete = false,
  autocompleteSuggestions = [],
  selectedSuggestionIndex = 0,
  onSelectSuggestion,
  onSuggestionHover,
  suggestions = [],
  onSuggestionClick,
  onAttachFile,
  children,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const [isListening, setIsListening] = useState(false);

  // Release the synchronous submitting lock when loading settles
  useEffect(() => {
    if (!isLoading) {
      isSubmittingRef.current = false;
    }
  }, [isLoading]);

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading || isSubmittingRef.current) {
      return;
    }
    const trimmed = inputValue.trim();
    if (trimmed) {
      isSubmittingRef.current = true;
      // Immediately reset input locally so repeat Enter/clicks find an empty string
      onInputChange("");
      onSubmit(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();

      if (showAutocomplete && autocompleteSuggestions.length > 0) {
        const sug = autocompleteSuggestions[selectedSuggestionIndex];
        if (sug) {
          onSelectSuggestion?.(sug);
        }
        return;
      }

      handleFormSubmit();
      return;
    }

    if (showAutocomplete && autocompleteSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          (selectedSuggestionIndex + 1) % autocompleteSuggestions.length;
        onSuggestionHover?.(next);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          (selectedSuggestionIndex - 1 + autocompleteSuggestions.length) %
          autocompleteSuggestions.length;
        onSuggestionHover?.(prev);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const sug = autocompleteSuggestions[selectedSuggestionIndex];
        if (sug) {
          onSelectSuggestion?.(sug);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        return;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttachFile) {
      onAttachFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleVoice = () => {
    const win = inputRef.current?.ownerDocument?.defaultView as any;
    const SpeechRecognition =
      win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          onInputChange(
            inputValue ? `${inputValue} ${transcript}` : transcript,
          );
        }
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div
      className={`cognora-ai-composer ${
        isPanelOpen ? "cognora-ai-composer--panel-open" : ""
      }`}
      data-purpose="ai-composer-dock"
    >
      {/* Mounted Conversation Thread / Thinking State */}
      {children}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept="image/*,.json,.txt"
        onChange={handleFileChange}
      />

      {/* Autocomplete Popup */}
      {showAutocomplete && autocompleteSuggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            marginBottom: "8px",
            width: "100%",
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -3px rgba(0,0,0,0.1)",
            padding: "8px",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 40,
          }}
          role="listbox"
          aria-label="Slash commands"
        >
          <div
            style={{
              padding: "4px 8px 8px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            <span>DSA Commands</span>
            <span>Tab / Enter to select</span>
          </div>
          <div>
            {autocompleteSuggestions.map((sug, idx) => (
              <button
                key={sug.name}
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: "8px",
                  background:
                    idx === selectedSuggestionIndex ? "#eff6ff" : "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => onSelectSuggestion?.(sug)}
                onMouseEnter={() => onSuggestionHover?.(idx)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "#0f172a",
                  }}
                >
                  <span style={{ color: "#2563eb" }}>/{sug.name}</span>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {sug.category}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  {sug.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending User Canvas Interaction Banner */}
      {pendingInteraction && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "12px",
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            fontSize: "12px",
            color: "#166534",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>Canvas edit:</span>
            <span>{pendingInteraction.description}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              style={{
                background: "#16a34a",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() =>
                onSubmit(
                  `I modified the canvas: ${pendingInteraction.description}. What happens now?`,
                )
              }
              disabled={isLoading}
            >
              Ask AI About Change
            </button>
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                color: "#166534",
                cursor: "pointer",
              }}
              onClick={onClearPendingInteraction}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Selection Context Chip */}
      {selectedContext.length > 0 && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "9999px",
            padding: "2px 10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            color: "#1d4ed8",
            fontWeight: 500,
          }}
        >
          <span>Focus: {formatSelectedElementChip(selectedContext)}</span>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "#1d4ed8",
              cursor: "pointer",
              fontWeight: 700,
            }}
            onClick={onClearSelectedContext}
            title="Clear focus"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Form with Pill */}
      <form onSubmit={handleFormSubmit} className="cognora-ai-composer__form">
        <div className="cognora-ai-composer__input-pill">
          {/* Plus Button for Attachments & Files */}
          <button
            type="button"
            className="cognora-ai-composer__plus-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file or import"
            aria-label="Attach file or import"
            disabled={isLoading}
          >
            <svg
              style={{ width: "16px", height: "16px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 5v14M5 12h14"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
            </svg>
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            className="cognora-ai-composer__input"
            placeholder={
              selectedContext.length > 0
                ? `Ask about selected ${formatSelectedElementChip(
                    selectedContext,
                  )}...`
                : "Ask Cognora anything..."
            }
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="AI Prompt"
          />

          {/* Canonical Send Button */}
          <button
            type="submit"
            className="cognora-ai-composer__send-btn"
            disabled={isLoading || isSubmittingRef.current || !inputValue.trim()}
            title={isLoading ? "Generating..." : "Send prompt"}
            aria-label={isLoading ? "Generating..." : "Send prompt"}
          >
            {isLoading ? (
              <div className="cognora-ai-composer__send-spinner" />
            ) : (
              <svg
                style={{ width: "14px", height: "14px", marginLeft: "1px" }}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Quick Suggestion Pills */}
      {suggestions.length > 0 && (
        <div className="cognora-ai-composer__pills-row">
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              className="cognora-ai-composer__suggestion-pill"
              onClick={() => onSuggestionClick?.(sug)}
              disabled={isLoading}
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
