/**
 * TEMPORARY TEST TRIGGER (STEP 4)
 *
 * This component provides a temporary button to verify that the
 * Visual Teaching Renderer correctly controls the live Excalidraw canvas.
 *
 * This will be superseded by the interactive Teaching Agent UI in STEP 5.
 */

import React, { useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { renderTestBinarySearchDiagram } from "../ai/ai-canvas";

export interface AITestTriggerProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const AITestTrigger: React.FC<AITestTriggerProps> = ({ excalidrawAPI }) => {
  useEffect(() => {
    // Expose programmatic trigger for automated/console testing
    const win = window as any;
    win.__renderAIBinarySearch = () => {
      return renderTestBinarySearchDiagram(excalidrawAPI);
    };

    return () => {
      delete win.__renderAIBinarySearch;
    };
  }, [excalidrawAPI]);

  const handleTrigger = () => {
    renderTestBinarySearchDiagram(excalidrawAPI);
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        pointerEvents: "auto",
      }}
      className="ai-test-trigger-container"
    >
      <button
        type="button"
        onClick={handleTrigger}
        title="Trigger AI Visual Renderer (Binary Search Test Diagram)"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "#1971c2",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "8px",
          padding: "8px 16px",
          fontSize: "13px",
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          transition: "background-color 0.15s ease, transform 0.1s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#1864ab";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#1971c2";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <span style={{ fontSize: "15px" }}>✨</span>
        <span>AI Test: Render Binary Search</span>
      </button>
    </div>
  );
};
