import React, { useState, useRef, useEffect } from "react";

import { formatSelectedElementChip } from "../ai/selection-context";

import { CognoraCommandPalette } from "./CognoraCommandPalette";

import type { SelectedSemanticElement } from "../ai/teaching-contract";
import type { CanvasInteractionDelta } from "../ai/semantic-canvas";
import type { AutocompleteSuggestion, CommandContext } from "../ai/commands";

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
  commandContext?: CommandContext;
  isListening?: boolean;
  onToggleVoiceListening?: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export const CognoraAIComposer: React.FC<CognoraAIComposerProps> = ({
  inputValue = "",
  onInputChange,
  onSubmit,
  isLoading,
  onCancel,
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
  commandContext,
  isListening: isListeningProp,
  onToggleVoiceListening,
  children,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);
  const isComposingRef = useRef(false);
  const [internalIsListening, setInternalIsListening] = useState(false);
  const isListening = isListeningProp !== undefined ? isListeningProp : internalIsListening;

  // Release the synchronous submitting lock when loading settles
  useEffect(() => {
    if (!isLoading) {
      isSubmittingRef.current = false;
    }
  }, [isLoading]);

  // Dynamic auto-resize for multiline textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    const minHeight = 26;
    const maxHeight = 160;
    const currentScroll = textarea.scrollHeight;

    if (currentScroll > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = `${Math.max(minHeight, currentScroll)}px`;
      textarea.style.overflowY = "hidden";
    }
  }, [inputValue]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current || e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift + Enter: native newline insertion without submission
        return;
      }
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
    if (onToggleVoiceListening) {
      onToggleVoiceListening();
      return;
    }

    const win = textareaRef.current?.ownerDocument?.defaultView as any;
    const SpeechRecognition =
      win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    if (internalIsListening) {
      setInternalIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setInternalIsListening(true);
      recognition.onend = () => setInternalIsListening(false);
      recognition.onerror = () => setInternalIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          onInputChange(
            inputValue ? `${inputValue} ${transcript}` : transcript,
          );
        }
        setInternalIsListening(false);
      };

      recognition.start();
    } catch {
      setInternalIsListening(false);
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

      {/* Universal Liquid Glass Command Palette */}
      {showAutocomplete && (
        <CognoraCommandPalette
          isOpen={showAutocomplete}
          onClose={() => {}}
          inputValue={inputValue}
          context={commandContext}
          selectedIndex={selectedSuggestionIndex}
          onSelectedIndexChange={onSuggestionHover}
          onSelectCommand={(cmdName, syntaxOrExample, executeImmediately) => {
            if (executeImmediately && syntaxOrExample) {
              onInputChange("");
              onSubmit(syntaxOrExample);
            } else if (onSelectSuggestion) {
              const matched = autocompleteSuggestions.find(
                (s) => s.name === cmdName,
              ) || {
                name: cmdName,
                syntax: syntaxOrExample || `/${cmdName}`,
                description: "",
                example: syntaxOrExample || `/${cmdName}`,
                category: "CREATE" as const,
              };
              onSelectSuggestion(matched);
            } else {
              onInputChange(`/${cmdName} `);
            }
          }}
        />
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

          {/* Multiline Textarea Input */}
          <textarea
            ref={textareaRef}
            rows={1}
            className="cognora-ai-composer__input"
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
            }}
            placeholder={
              selectedContext.length > 0
                ? `Ask about selected ${formatSelectedElementChip(
                    selectedContext,
                  )}...`
                : "Ask Cognora anything..."
            }
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            disabled={isLoading}
            aria-label="AI Prompt"
          />

          {/* Voice Input Button */}
          <button
            type="button"
            className={`cognora-ai-composer__voice-btn ${
              isListening ? "is-listening" : ""
            }`}
            onClick={toggleVoice}
            title={isListening ? "Listening (Speak to interrupt)..." : "Voice input"}
            aria-label={isListening ? "Listening (Speak to interrupt)..." : "Voice input"}
            disabled={isLoading}
            style={{
              background: isListening ? "#fee2e2" : "transparent",
              color: isListening ? "#dc2626" : "#64748b",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
            }}
          >
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
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>

          {/* Canonical Send / Cancel Button */}
          <button
            type={isLoading ? "button" : "submit"}
            className={`cognora-ai-composer__send-btn ${isLoading ? "is-loading" : ""}`}
            onClick={isLoading ? onCancel : undefined}
            disabled={!isLoading && (isSubmittingRef.current || !inputValue?.trim())}
            title={isLoading ? "Cancel generation" : "Send prompt"}
            aria-label={isLoading ? "Cancel generation" : "Send prompt"}
          >
            {isLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "14px",
                  height: "14px",
                }}
                title="Cancel generation"
              >
                <div
                  style={{
                    width: "9px",
                    height: "9px",
                    background: "currentColor",
                    borderRadius: "2px",
                  }}
                />
              </div>
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
              disabled={isLoading || isSubmittingRef.current}
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
