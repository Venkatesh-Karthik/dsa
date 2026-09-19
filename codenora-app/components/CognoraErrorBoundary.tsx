import React from "react";

interface CognoraErrorBoundaryProps {
  children: React.ReactNode;
  componentName?: string;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface CognoraErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class CognoraErrorBoundary extends React.Component<
  CognoraErrorBoundaryProps,
  CognoraErrorBoundaryState
> {
  state: CognoraErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): CognoraErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[COGNORA][ERROR] Subsystem crash caught in <${
        this.props.componentName || "CognoraSubsystem"
      }>:`,
      error,
      errorInfo,
    );
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="cognora-error-boundary"
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(248, 113, 113, 0.12)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            color: "#f87171",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            fontSize: "13px",
            lineHeight: "1.4",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            margin: "8px",
            maxWidth: "360px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: "14px" }}>⚠️</span>
            <span>
              {this.props.componentName || "Cognora Component"} Recovered
            </span>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "rgba(255, 255, 255, 0.7)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={this.state.error?.message}
          >
            {this.state.error?.message ||
              "An unexpected error occurred in this panel."}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              cursor: "pointer",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
          >
            Retry Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
