import React from "react";

import {
  IconSelect,
  IconHand,
  IconRectangle,
  IconEllipse,
  IconArrow,
  IconDraw,
  IconText,
  IconImage,
} from "./CognoraIcons";

export type DrawingToolType =
  | "selection"
  | "hand"
  | "rectangle"
  | "ellipse"
  | "arrow"
  | "freedraw"
  | "text"
  | "image";

export interface CognoraDrawingToolbarProps {
  activeTool: string;
  onSelectTool: (tool: DrawingToolType) => void;
  onOpenMoreTools?: () => void;
}

export const CognoraDrawingToolbar: React.FC<CognoraDrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  onOpenMoreTools,
}) => {
  return (
    <div
      className="cognora-drawing-toolbar"
      data-purpose="canvas-toolbox"
      role="toolbar"
      aria-label="Drawing tools"
    >
      {/* Select Cursor */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "selection" ? "active" : ""
        }`}
        onClick={() => onSelectTool("selection")}
        title="Select (1 or V)"
        aria-label="Select"
      >
        <IconSelect size={18} />
      </button>

      {/* Pan / Hand */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "hand" ? "active" : ""
        }`}
        onClick={() => onSelectTool("hand")}
        title="Hand Pan (H or Space)"
        aria-label="Hand Pan"
      >
        <IconHand size={18} />
      </button>

      {/* Rectangle */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "rectangle" ? "active" : ""
        }`}
        onClick={() => onSelectTool("rectangle")}
        title="Rectangle (R)"
        aria-label="Rectangle"
      >
        <IconRectangle size={18} />
      </button>

      {/* Ellipse */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "ellipse" ? "active" : ""
        }`}
        onClick={() => onSelectTool("ellipse")}
        title="Ellipse (O)"
        aria-label="Ellipse"
      >
        <IconEllipse size={18} />
      </button>

      {/* Arrow */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "arrow" ? "active" : ""
        }`}
        onClick={() => onSelectTool("arrow")}
        title="Arrow (A)"
        aria-label="Arrow"
      >
        <IconArrow size={18} />
      </button>

      {/* Pen / Pencil / Draw */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "freedraw" ? "active" : ""
        }`}
        onClick={() => onSelectTool("freedraw")}
        title="Draw / Pen (P)"
        aria-label="Draw"
      >
        <IconDraw size={18} />
      </button>

      {/* Text */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "text" ? "active" : ""
        }`}
        onClick={() => onSelectTool("text")}
        title="Text (T)"
        aria-label="Text"
      >
        <IconText size={18} />
      </button>

      {/* Image Upload */}
      <button
        type="button"
        className={`cognora-drawing-toolbar__btn ${
          activeTool === "image" ? "active" : ""
        }`}
        onClick={() => onSelectTool("image")}
        title="Insert Image (9)"
        aria-label="Insert Image"
      >
        <IconImage size={18} />
      </button>

      {/* More Tools */}
      <button
        type="button"
        className="cognora-drawing-toolbar__btn"
        onClick={onOpenMoreTools}
        title="More Canvas Tools"
        aria-label="More Canvas Tools"
      >
        <svg
          fill="currentColor"
          viewBox="0 0 24 24"
          style={{ width: "18px", height: "18px" }}
        >
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
    </div>
  );
};
