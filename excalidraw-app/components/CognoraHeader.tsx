import { CognoraLogo } from "./CognoraLogo";

export interface CognoraHeaderProps {
  lessonTitle?: string;
  activeMode?: "visualize" | "explore" | "practice" | "understand";
  onModeSelect?: (
    mode: "visualize" | "explore" | "practice" | "understand",
  ) => void;
  onAutoAlign?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSave?: () => void;
  onShare?: () => void;
  onToggleMore?: () => void;
  isMoreOpen?: boolean;
  onLessonTitleClick?: () => void;
  userInitial?: string;
  onToggleContextualPanel?: () => void;
  isContextualPanelOpen?: boolean;
  hasActiveLesson?: boolean;
}

export const CognoraHeader: React.FC<CognoraHeaderProps> = ({
  lessonTitle,
  activeMode = "visualize",
  onModeSelect,
  onAutoAlign,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = true,
  onSave,
  onShare,
  onToggleMore,
  isMoreOpen,
  onLessonTitleClick,
  userInitial = "A",
  onToggleContextualPanel,
  isContextualPanelOpen = false,
  hasActiveLesson = false,
}) => {
  return (
    <header className="cognora-header" data-purpose="top-navigation-bar">
      {/* Left: Cognora Logo */}
      <div className="cognora-header__left">
        <CognoraLogo size={32} showTagline={true} />
      </div>

      {/* Center: Mathematically Centered Dynamic Lesson Title */}
      <div className="cognora-header__center" data-purpose="centered-lesson-title">
        <span
          className="cognora-header__title"
          title={lessonTitle || "Cognora Workspace"}
        >
          {lessonTitle || "Cognora Workspace"}
        </span>
      </div>

      {/* Right: Workspace Actions & Profile */}
      <div className="cognora-header__right">
        {/* Auto-Layout Rebalance Action */}
        <button
          type="button"
          className="cognora-header__auto-align-btn"
          onClick={onAutoAlign}
          title="Balance Spacing & Eliminate Overlaps"
        >
          <svg
            style={{ width: "14px", height: "14px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
          <span>Auto Align</span>
        </button>

        {/* Undo / Redo */}
        <button
          type="button"
          className="cognora-header__icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M3 10h10a5 5 0 015 5v2m0 0l-3-3m3 3l3-3M3 10l3 3m-3-3l3-3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
        <button
          type="button"
          className="cognora-header__icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M21 10H11a5 5 0 00-5 5v2m0 0l3-3m-3 3L6 14m15-4l-3 3m3-3l-3-3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>

        <div className="cognora-header__divider" />

        {/* Save */}
        <button
          type="button"
          className="cognora-header__action-btn"
          onClick={onSave}
          title="Save or Export Workspace"
        >
          <svg
            style={{ width: "14px", height: "14px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Save</span>
        </button>

        {/* Share */}
        <button
          type="button"
          className="cognora-header__action-btn"
          onClick={onShare}
          title="Share or Collaborate"
        >
          <svg
            style={{ width: "14px", height: "14px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Share</span>
        </button>

        {/* Contextual Inspector Toggle */}
        {onToggleContextualPanel && (
          <button
            type="button"
            className={`cognora-header__action-btn ${isContextualPanelOpen ? "cognora-header__action-btn--active" : ""}`}
            onClick={onToggleContextualPanel}
            title={isContextualPanelOpen ? "Close Inspector Panel" : "Open Inspector Panel (Analyze, Explain, Code, Practice)"}
            style={{
              background: isContextualPanelOpen ? "#2563eb" : undefined,
              color: isContextualPanelOpen ? "#ffffff" : undefined,
            }}
          >
            <svg
              style={{ width: "14px", height: "14px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Inspector</span>
          </button>
        )}

        {/* User Profile Avatar */}
        <div className="cognora-header__avatar" title="Cognora User">
          {userInitial}
        </div>
      </div>
    </header>
  );
};
