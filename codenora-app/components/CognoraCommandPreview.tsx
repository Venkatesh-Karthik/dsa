import React, { useEffect } from "react";

import type { CommandRiskLevel } from "../ai/commands/command-types";

export interface CognoraCommandPreviewProps {
  isOpen: boolean;
  command: string;
  riskLevel?: CommandRiskLevel;
  semanticEffect?: string;
  targetDescription?: string;
  didYouMean?: string;
  candidateTargets?: Array<{ id: string; label: string; type: string }>;
  selectedTargetId?: string;
  onSelectTarget?: (id: string) => void;
  position?: { x: number; y: number };
  onConfirm: () => void;
  onCancel: () => void;
}

export const CognoraCommandPreview: React.FC<CognoraCommandPreviewProps> = ({
  isOpen,
  command,
  riskLevel = "SAFE",
  semanticEffect,
  targetDescription,
  didYouMean,
  candidateTargets,
  selectedTargetId,
  onSelectTarget,
  position,
  onConfirm,
  onCancel,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const win =
      containerRef.current?.ownerDocument?.defaultView ||
      (typeof window !== "undefined" ? window : null);
    if (!win) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onConfirm();
      }
    };
    win.addEventListener("keydown", handleKeyDown);
    return () => win.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) {
    return null;
  }

  const ownerWin =
    containerRef.current?.ownerDocument?.defaultView ||
    (typeof window !== "undefined" ? window : null);
  const winWidth = ownerWin?.innerWidth || 1280;
  const winHeight = ownerWin?.innerHeight || 800;

  const riskBadgeStyle =
    riskLevel === "DESTRUCTIVE"
      ? {
          background: "rgba(239, 68, 68, 0.12)",
          color: "#dc2626",
          border: "1px solid rgba(239, 68, 68, 0.3)",
        }
      : riskLevel === "MODIFY"
      ? {
          background: "rgba(99, 102, 241, 0.12)",
          color: "#4f46e5",
          border: "1px solid rgba(99, 102, 241, 0.3)",
        }
      : {
          background: "rgba(16, 185, 129, 0.12)",
          color: "#059669",
          border: "1px solid rgba(16, 185, 129, 0.3)",
        };

  return (
    <div
      ref={containerRef}
      className="cognora-command-preview-overlay"
      style={{
        position: "fixed",
        zIndex: 1000,
        left: position?.x
          ? `${Math.min(winWidth - 360, Math.max(20, position.x))}px`
          : "50%",
        top: position?.y
          ? `${Math.min(winHeight - 200, Math.max(20, position.y))}px`
          : "75%",
        transform: position ? "none" : "translate(-50%, -50%)",
        minWidth: "320px",
        maxWidth: "420px",
        background: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        borderRadius: "16px",
        boxShadow:
          "0 20px 40px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.06)",
        padding: "16px",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        color: "#0f172a",
        pointerEvents: "auto",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Header with Risk Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>⚡</span>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>
            Command Preview
          </span>
        </div>
        <span
          style={{
            ...riskBadgeStyle,
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {riskLevel}
        </span>
      </div>

      {/* Command Syntax */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.05)",
          padding: "8px 12px",
          borderRadius: "8px",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: "13px",
          fontWeight: 600,
          color: "#0f172a",
          marginBottom: "8px",
        }}
      >
        {command}
      </div>

      {/* Did you mean suggestion */}
      {didYouMean && (
        <div
          style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}
        >
          Did you mean:{" "}
          <strong style={{ color: "#4f46e5" }}>{didYouMean}</strong>?
        </div>
      )}

      {/* Target & Semantic Effect */}
      <div
        style={{
          fontSize: "12px",
          color: "#475569",
          lineHeight: "1.4",
          marginBottom: "12px",
        }}
      >
        {targetDescription && (
          <div>
            <strong>Target:</strong> {targetDescription}
          </div>
        )}
        {semanticEffect && (
          <div>
            <strong>Effect:</strong> {semanticEffect}
          </div>
        )}
      </div>

      {/* Candidate Targets Disambiguation Picker */}
      {candidateTargets && candidateTargets.length > 1 && (
        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#64748b",
              marginBottom: "6px",
            }}
          >
            SELECT TARGET STRUCTURE:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {candidateTargets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTarget?.(t.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 500,
                  border:
                    selectedTargetId === t.id
                      ? "1px solid #4f46e5"
                      : "1px solid rgba(15, 23, 42, 0.15)",
                  background:
                    selectedTargetId === t.id
                      ? "rgba(99, 102, 241, 0.12)"
                      : "rgba(255, 255, 255, 0.6)",
                  color: selectedTargetId === t.id ? "#4f46e5" : "#334155",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: "4px",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(15, 23, 42, 0.15)",
            background: "transparent",
            color: "#475569",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Cancel (Esc)
        </button>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            padding: "6px 14px",
            borderRadius: "8px",
            border: "none",
            background: riskLevel === "DESTRUCTIVE" ? "#dc2626" : "#0f172a",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            transition: "all 0.15s ease",
          }}
        >
          Execute (Enter)
        </button>
      </div>
    </div>
  );
};
