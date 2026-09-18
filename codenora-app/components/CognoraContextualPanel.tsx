import React, { useState, useEffect } from "react";

import { IconSparkles } from "./CognoraIcons";

import type { CodeContext } from "../ai/visual-dsl";

export type PanelTabType = "analyze" | "explain" | "code" | "practice";

export interface StepperStep {
  stepNumber: number;
  title: string;
  isCompleted: boolean;
  isActive: boolean;
  isPending: boolean;
}

export interface ContextMetric {
  label: string;
  value: string | number;
  badgeColor?: string;
}

export interface ContextProperty {
  label: string;
  value: string | number;
}

export interface ContextAction {
  id: string;
  label: string;
  description?: string;
  enabled?: boolean;
  onExecute: () => void;
}

export interface SelectedEntityQuickAction {
  id: string;
  label: string;
  description?: string;
  onClick: () => void;
}

export interface SelectedEntityIntelligence {
  id: string;
  label: string;
  type?: string;
  role?: string;
  quickActions?: SelectedEntityQuickAction[];
}

export interface AnalyzeModel {
  title?: string;
  subtitle?: string;
  conceptType?: string;
  operation?: string;
  statusBadge?: string;
  metrics?: ContextMetric[];
  properties?: ContextProperty[];
  resultSummary?: string;
  contextAction?: ContextAction;
  selectedEntity?: SelectedEntityIntelligence;

  // Generic Interactive Parameter Controls
  hasInteractiveControls?: boolean;
  startParamLabel?: string;
  destParamLabel?: string;
  resultCardTitle?: string;
  // Backward compatibility
  isDijkstra?: boolean;
  startNodes?: string[];
  destNodes?: string[];
  selectedStart?: string;
  selectedDest?: string;
  onStartChange?: (val: string) => void;
  onDestChange?: (val: string) => void;
  onRunAction?: () => void;
  actionLabel?: string;
  resultPath?: string;
  resultDistance?: string | number;
  resultEdges?: number;

  stepperSteps?: StepperStep[];
  onSelectStep?: (idx: number) => void;
}

export interface ExplainModel {
  title?: string;
  explanation?: string;
  calculations?: string;
  insight?: string;
  whatChanged?: string;
  consequence?: string;
  onExplainDifferently?: (style: string) => void;
}

export interface PracticeModel {
  question?: string;
  options?: string[];
  selectedOption?: number | null;
  onSelectOption?: (idx: number) => void;
  onCheckAnswer?: () => void;
  feedback?: {
    isCorrect?: boolean;
    message?: string;
  } | null;
  onGenerateNewPractice?: () => void;
}

export interface OverlayDirectionalControls {
  canMove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onResetAuto?: () => void;
  isOverridden?: boolean;
}

export interface CognoraContextualPanelProps {
  activeTab: PanelTabType;
  onTabChange: (tab: PanelTabType) => void;
  onClose: () => void;
  analyzeData?: AnalyzeModel;
  explainData?: ExplainModel;
  codeContext?: CodeContext;
  codeSolution?: {
    language?: string;
    code?: string;
    problem_summary?: string;
  };
  practiceData?: PracticeModel;
  capabilities?: string[];
  overlayControls?: OverlayDirectionalControls;
}

export const CognoraContextualPanel: React.FC<CognoraContextualPanelProps> = ({
  activeTab,
  onTabChange,
  onClose,
  analyzeData,
  explainData,
  codeContext,
  codeSolution,
  practiceData,
  capabilities = ["explain", "code", "analyze", "practice"],
  overlayControls,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("python");
  const [copied, setCopied] = useState<boolean>(false);

  // Auto-fallback if activeTab is not permitted in capabilities
  useEffect(() => {
    if (capabilities.length > 0 && !capabilities.includes(activeTab)) {
      onTabChange?.(capabilities[0] as PanelTabType);
    }
  }, [capabilities, activeTab, onTabChange]);

  const steps = analyzeData?.stepperSteps ?? [];
  const hasActiveLesson = steps.length > 0;
  const currentStepNum = steps.findIndex((s) => s.isActive) + 1 || 1;

  const activeCode =
    codeContext?.code ||
    codeSolution?.code ||
    (hasActiveLesson
      ? "# Code implementation for active lesson step"
      : "# Cognora Code Inspector\n# Ask a DSA question below to view algorithm implementations and live highlights.");

  const highlightLines = codeContext?.highlightLines || [8, 9, 10];

  const handleCopyCode = (e: React.MouseEvent) => {
    const win = e.currentTarget?.ownerDocument?.defaultView;
    if (win?.navigator?.clipboard) {
      win.navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside
      className="cognora-contextual-panel"
      data-purpose="right-control-panel"
      role="region"
      aria-label="Cognora context inspector"
    >
      {/* Tabs Header */}
      <div className="cognora-contextual-panel__header">
        <div className="cognora-contextual-panel__tabs" id="tab-headers">
          {capabilities.includes("analyze") && (
            <button
              type="button"
              data-tab="analyze"
              className={`cognora-contextual-panel__tab-btn ${
                activeTab === "analyze" ? "active" : ""
              }`}
              onClick={() => onTabChange("analyze")}
            >
              Analyze
            </button>
          )}
          {capabilities.includes("explain") && (
            <button
              type="button"
              data-tab="explain"
              className={`cognora-contextual-panel__tab-btn ${
                activeTab === "explain" ? "active" : ""
              }`}
              onClick={() => onTabChange("explain")}
            >
              Explain
            </button>
          )}
          {capabilities.includes("code") && (
            <button
              type="button"
              data-tab="code"
              className={`cognora-contextual-panel__tab-btn ${
                activeTab === "code" ? "active" : ""
              }`}
              onClick={() => onTabChange("code")}
            >
              Code
            </button>
          )}
          {capabilities.includes("practice") && (
            <button
              type="button"
              data-tab="practice"
              className={`cognora-contextual-panel__tab-btn ${
                activeTab === "practice" ? "active" : ""
              }`}
              onClick={() => onTabChange("practice")}
            >
              Practice
            </button>
          )}
        </div>
        <button
          type="button"
          className="cognora-contextual-panel__close-btn"
          onClick={onClose}
          title="Close Panel"
          aria-label="Close Panel"
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
      </div>

      {/* Panel Body */}
      <div className="cognora-contextual-panel__body">
        {!hasActiveLesson ? (
          <div className="cognora-contextual-panel__empty-state">
            <div className="icon-wrap">
              <IconSparkles size={24} color="#2563eb" />
            </div>
            <h4>No Active Lesson</h4>
            <p>
              Ask Cognora to visualize any algorithm, data structure, or concept
              to explore interactive controls, step-by-step logic, code, and
              practice problems.
            </p>
          </div>
        ) : (
          <>
            {/* TAB 1: ANALYZE */}
            {activeTab === "analyze" && (
              <>
                <div>
                  <h3 className="cognora-contextual-panel__section-title">
                    {analyzeData?.title || "Visual Analysis"}
                  </h3>
                  <p className="cognora-contextual-panel__section-desc">
                    {analyzeData?.subtitle ||
                      "Interactive step-by-step state inspection"}
                  </p>
                </div>

                {/* Operation Banner */}
                {analyzeData?.operation && (
                  <div className="cognora-contextual-panel__operation-banner">
                    <div className="operation-tag">
                      {analyzeData.statusBadge || "Active Operation"}
                    </div>
                    <div className="operation-name">
                      {analyzeData.operation}
                    </div>
                  </div>
                )}

                {/* Selected Object Intelligence Quick Actions */}
                {analyzeData?.selectedEntity?.quickActions &&
                  analyzeData.selectedEntity.quickActions.length > 0 && (
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "#64748b",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Focus: {analyzeData.selectedEntity.label}</span>
                        {analyzeData.selectedEntity.role && (
                          <span
                            style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              textTransform: "none",
                            }}
                          >
                            {analyzeData.selectedEntity.role}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                        }}
                      >
                        {analyzeData.selectedEntity.quickActions.map((qa) => (
                          <button
                            key={qa.id}
                            type="button"
                            style={{
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              fontWeight: 500,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#3b82f6";
                              e.currentTarget.style.color = "#1d4ed8";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#cbd5e1";
                              e.currentTarget.style.color = "#1e293b";
                            }}
                            onClick={qa.onClick}
                            title={qa.description}
                          >
                            {qa.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Dynamic Contextual Metrics Grid */}
                {analyzeData?.metrics && analyzeData.metrics.length > 0 && (
                  <div className="cognora-contextual-panel__metrics-grid">
                    {analyzeData.metrics.map((m, idx) => (
                      <div
                        key={idx}
                        className="cognora-contextual-panel__metric-card"
                      >
                        <span className="metric-label">{m.label}</span>
                        <span className="metric-value">{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key Properties Card */}
                {analyzeData?.properties && analyzeData.properties.length > 0 && (
                  <div className="cognora-contextual-panel__props-card">
                    {analyzeData.properties.map((p, idx) => (
                      <div
                        key={idx}
                        className="cognora-contextual-panel__props-row"
                      >
                        <span className="label">{p.label}:</span>
                        <span className="val">{p.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Contextual Result / Outcome Card */}
                {analyzeData?.resultSummary && (
                  <div className="cognora-contextual-panel__result-card">
                    <div className="cognora-contextual-panel__result-card-title">
                      State & Outcome
                    </div>
                    <div className="cognora-contextual-panel__result-summary">
                      {analyzeData.resultSummary}
                    </div>
                  </div>
                )}

                {/* Context Action Button (if provided) */}
                {analyzeData?.contextAction && (
                  <button
                    type="button"
                    className="cognora-contextual-panel__run-btn"
                    onClick={analyzeData.contextAction.onExecute}
                    disabled={analyzeData.contextAction.enabled === false}
                  >
                    <svg
                      style={{ width: "14px", height: "14px" }}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>{analyzeData.contextAction.label}</span>
                  </button>
                )}

                {/* Generic Interactive Parameter Controls */}
                {(analyzeData?.hasInteractiveControls ||
                  analyzeData?.isDijkstra) && (
                  <>
                    <div className="cognora-contextual-panel__inputs-row">
                      <div>
                        <label className="cognora-contextual-panel__field-label">
                          {analyzeData?.startParamLabel || "Source Parameter"}
                        </label>
                        <div className="cognora-contextual-panel__select-wrapper">
                          <select
                            value={analyzeData?.selectedStart || "A"}
                            onChange={(e) =>
                              analyzeData?.onStartChange?.(e.target.value)
                            }
                          >
                            {(
                              analyzeData?.startNodes || [
                                "A",
                                "B",
                                "C",
                                "D",
                                "E",
                                "F",
                              ]
                            ).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="cognora-contextual-panel__field-label">
                          {analyzeData?.destParamLabel || "Target Parameter"}
                        </label>
                        <div className="cognora-contextual-panel__select-wrapper">
                          <select
                            value={analyzeData?.selectedDest || "P"}
                            onChange={(e) =>
                              analyzeData?.onDestChange?.(e.target.value)
                            }
                          >
                            {(
                              analyzeData?.destNodes || ["P", "K", "L", "M"]
                            ).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cognora-contextual-panel__run-btn"
                      onClick={analyzeData?.onRunAction}
                    >
                      <svg
                        style={{ width: "14px", height: "14px" }}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>
                        {analyzeData?.actionLabel ||
                          "Execute State Transformation"}
                      </span>
                    </button>

                    <div
                      className="cognora-contextual-panel__result-card"
                      data-purpose="algorithm-result-card"
                    >
                      <div className="cognora-contextual-panel__result-card-title">
                        {analyzeData?.resultCardTitle || "Execution Result"}
                      </div>
                      {analyzeData?.resultPath && (
                        <div className="cognora-contextual-panel__result-card-row">
                          <span className="label">Shortest path:</span>
                          <span className="val" style={{ color: "#166534" }}>
                            {analyzeData.resultPath}
                          </span>
                        </div>
                      )}
                      {analyzeData?.resultDistance !== undefined && (
                        <div className="cognora-contextual-panel__result-card-row">
                          <span className="label">Total distance:</span>
                          <span className="val">
                            {analyzeData.resultDistance}
                          </span>
                        </div>
                      )}
                      {analyzeData?.resultEdges !== undefined && (
                        <div className="cognora-contextual-panel__result-card-row">
                          <span className="label">Edges:</span>
                          <span className="val">{analyzeData.resultEdges}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Stepper Progression List */}
                <div style={{ paddingTop: "4px" }}>
                  <div className="cognora-contextual-panel__stepper-header">
                    <span className="title">Steps</span>
                    <span className="count">
                      {currentStepNum} / {steps.length}
                    </span>
                  </div>
                  <div
                    className="cognora-contextual-panel__stepper-list"
                    style={{ marginTop: "10px" }}
                  >
                    {steps.map((step, idx) => {
                      const stateClass = step.isActive
                        ? "active"
                        : step.isCompleted
                        ? "completed"
                        : "pending";
                      return (
                        <div
                          key={step.stepNumber}
                          className={`cognora-contextual-panel__step-item ${stateClass}`}
                          onClick={() => analyzeData?.onSelectStep?.(idx)}
                        >
                          <div className="badge">
                            {step.isCompleted ? (
                              <svg
                                style={{ width: "12px", height: "12px" }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="M5 13l4 4L19 7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="3"
                                />
                              </svg>
                            ) : step.isActive ? (
                              step.stepNumber
                            ) : null}
                          </div>
                          <span
                            style={{
                              fontWeight: 600,
                              color: step.isActive ? "#1d4ed8" : "#94a3b8",
                              width: "14px",
                            }}
                          >
                            {step.stepNumber}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              fontWeight: step.isActive ? 600 : 500,
                            }}
                          >
                            {step.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: EXPLAIN */}
            {activeTab === "explain" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <h3 className="cognora-contextual-panel__section-title">
                  {explainData?.title || "Step Insight"}
                </h3>
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#475569",
                    lineHeight: 1.6,
                  }}
                >
                  {explainData?.explanation ||
                    "Examine the semantic transition and causal mechanisms driving this state change."}
                </p>

                {explainData?.whatChanged && (
                  <div
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "12px",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: "4px",
                      }}
                    >
                      What Changed
                    </div>
                    <div style={{ color: "#334155", lineHeight: 1.5 }}>
                      {explainData.whatChanged}
                    </div>
                  </div>
                )}

                {explainData?.consequence && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "12px",
                      padding: "12px",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#166534",
                        marginBottom: "4px",
                      }}
                    >
                      Consequence & Invariants
                    </div>
                    <div style={{ color: "#15803d", lineHeight: 1.5 }}>
                      {explainData.consequence}
                    </div>
                  </div>
                )}

                {explainData?.calculations && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "12px",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: "4px",
                      }}
                    >
                      Calculations
                    </div>
                    <div style={{ color: "#334155", fontFamily: "monospace" }}>
                      {explainData.calculations}
                    </div>
                  </div>
                )}

                {explainData?.insight && (
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #dbeafe",
                      borderRadius: "12px",
                      padding: "12px",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#1d4ed8",
                        marginBottom: "4px",
                      }}
                    >
                      Key Invariant & Rule
                    </div>
                    <div style={{ color: "#1e3a8a", lineHeight: 1.5 }}>
                      {explainData.insight}
                    </div>
                  </div>
                )}

                {/* Contextual Overlay Position Controls (progressive disclosure) */}
                {overlayControls?.canMove && (
                  <div
                    className="cognora-contextual-panel__overlay-section"
                    data-purpose="overlay-position-controls"
                  >
                    <div className="cognora-contextual-panel__overlay-header">
                      <span className="title">Explanation Card Position</span>
                      {overlayControls.isOverridden &&
                        overlayControls.onResetAuto && (
                          <button
                            type="button"
                            className="reset-btn"
                            onClick={overlayControls.onResetAuto}
                            title="Reset to automatic placement"
                            aria-label="Reset explanation position"
                          >
                            Auto Align
                          </button>
                        )}
                    </div>
                    <div
                      className="cognora-overlay-dpad"
                      role="group"
                      aria-label="Explanation overlay position controls"
                    >
                      <div className="cognora-overlay-dpad__row">
                        <button
                          type="button"
                          className="cognora-overlay-dpad__btn"
                          onClick={overlayControls.onMoveUp}
                          title="Move explanation up"
                          aria-label="Move explanation up"
                        >
                          <svg
                            style={{ width: "14px", height: "14px" }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M5 15l7-7 7 7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.4"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="cognora-overlay-dpad__row">
                        <button
                          type="button"
                          className="cognora-overlay-dpad__btn"
                          onClick={overlayControls.onMoveLeft}
                          title="Move explanation left"
                          aria-label="Move explanation left"
                        >
                          <svg
                            style={{ width: "14px", height: "14px" }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M15 19l-7-7 7-7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.4"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="cognora-overlay-dpad__btn cognora-overlay-dpad__btn--center"
                          onClick={overlayControls.onResetAuto}
                          title={
                            overlayControls.isOverridden
                              ? "Reset to automatic placement"
                              : "Overlay is automatically positioned"
                          }
                          aria-label="Reset to automatic placement"
                        >
                          <span className="cognora-overlay-dpad__center-dot" />
                        </button>
                        <button
                          type="button"
                          className="cognora-overlay-dpad__btn"
                          onClick={overlayControls.onMoveRight}
                          title="Move explanation right"
                          aria-label="Move explanation right"
                        >
                          <svg
                            style={{ width: "14px", height: "14px" }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M9 5l7 7-7 7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.4"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="cognora-overlay-dpad__row">
                        <button
                          type="button"
                          className="cognora-overlay-dpad__btn"
                          onClick={overlayControls.onMoveDown}
                          title="Move explanation down"
                          aria-label="Move explanation down"
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
                              strokeWidth="2.4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CODE */}
            {activeTab === "code" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["python", "javascript", "java", "cpp"].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        style={{
                          background:
                            selectedLanguage === lang ? "#0f172a" : "#f1f5f9",
                          color:
                            selectedLanguage === lang ? "#ffffff" : "#475569",
                          border: "none",
                          borderRadius: "9999px",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                        onClick={() => setSelectedLanguage(lang)}
                      >
                        {lang === "cpp" ? "C++" : lang}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#2563eb",
                      cursor: "pointer",
                    }}
                    onClick={handleCopyCode}
                  >
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>

                <pre
                  style={{
                    background: "#0f172a",
                    color: "#f8fafc",
                    padding: "14px",
                    borderRadius: "18px",
                    fontSize: "11px",
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                    lineHeight: 1.6,
                    overflowX: "auto",
                    margin: 0,
                  }}
                >
                  <code>
                    {activeCode.split("\n").map((line: string, idx: number) => {
                      const lineNum = idx + 1;
                      const isHighlighted = highlightLines.includes(lineNum);
                      return (
                        <div
                          key={idx}
                          style={{
                            background: isHighlighted
                              ? "rgba(59, 130, 246, 0.25)"
                              : "transparent",
                            padding: "0 6px",
                            borderRadius: "4px",
                            display: "flex",
                            gap: "10px",
                          }}
                        >
                          <span
                            style={{
                              color: isHighlighted ? "#60a5fa" : "#475569",
                              userSelect: "none",
                              width: "20px",
                              textAlign: "right",
                            }}
                          >
                            {lineNum}
                          </span>
                          <span
                            style={{
                              color: isHighlighted ? "#93c5fd" : "#e2e8f0",
                              fontWeight: isHighlighted ? 600 : 400,
                            }}
                          >
                            {line}
                          </span>
                        </div>
                      );
                    })}
                  </code>
                </pre>
              </div>
            )}

            {/* TAB 4: PRACTICE */}
            {activeTab === "practice" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <h3 className="cognora-contextual-panel__section-title">
                  Interactive Quiz
                </h3>
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#475569",
                    lineHeight: 1.5,
                  }}
                >
                  {practiceData?.question ||
                    "What would be the updated tentative distance to node D if edge (B, D) had weight 10 instead of 3?"}
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {(
                    practiceData?.options || [
                      "15 (5 + 10)",
                      "12 (kept previous path)",
                      "Infinity",
                      "8 (no change)",
                    ]
                  ).map((opt, idx) => {
                    const isSelected = practiceData?.selectedOption === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          background: isSelected ? "#eff6ff" : "#ffffff",
                          border: isSelected
                            ? "1px solid #3b82f6"
                            : "1px solid #e2e8f0",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? "#1d4ed8" : "#334155",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onClick={() => practiceData?.onSelectOption?.(idx)}
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "9999px",
                            border: isSelected
                              ? "5px solid #2563eb"
                              : "2px solid #cbd5e1",
                            background: "#ffffff",
                          }}
                        />
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {practiceData?.onCheckAnswer && (
                  <button
                    type="button"
                    className="cognora-contextual-panel__run-btn"
                    onClick={practiceData.onCheckAnswer}
                  >
                    Check Answer
                  </button>
                )}

                {practiceData?.feedback && (
                  <div
                    style={{
                      background: practiceData.feedback.isCorrect
                        ? "#f0fdf4"
                        : "#fef2f2",
                      border: practiceData.feedback.isCorrect
                        ? "1px solid #bbf7d0"
                        : "1px solid #fecaca",
                      color: practiceData.feedback.isCorrect
                        ? "#166534"
                        : "#991b1b",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    {practiceData.feedback.message}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
