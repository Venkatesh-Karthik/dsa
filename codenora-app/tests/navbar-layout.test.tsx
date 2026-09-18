import { describe, it, expect, vi } from "vitest";
import React from "react";
import { screen, render, fireEvent } from "@testing-library/react";

import { CognoraHeader } from "../components/CognoraHeader";

describe("CognoraHeader Navbar Layout & Controls", () => {
  it("renders 3 distinct groups: left branding & auto-align, center title, right controls", () => {
    const onAutoAlign = vi.fn();
    const onToggleContextualPanel = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onSave = vi.fn();
    const onShare = vi.fn();

    const { container } = render(
      <CognoraHeader
        lessonTitle="Binary Search Tree Insertion"
        isContextualPanelOpen={false}
        onToggleContextualPanel={onToggleContextualPanel}
        onAutoAlign={onAutoAlign}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={true}
        canRedo={false}
        onSave={onSave}
        onShare={onShare}
      />,
    );

    // Left group: Logo, Cognora, Subtitle, Auto Align
    const leftGroup = container.querySelector(".cognora-header__left");
    expect(leftGroup).toBeTruthy();
    expect(leftGroup?.textContent).toContain("Cognora");
    expect(leftGroup?.textContent).toContain("Auto Align");

    // Center group: Mathematically centered lesson title
    const centerGroup = container.querySelector(".cognora-header__center");
    expect(centerGroup).toBeTruthy();
    expect(centerGroup?.textContent).toContain("Binary Search Tree Insertion");

    // Right group: Action buttons (Undo, Redo, Save, Share, Inspector, Avatar)
    const rightGroup = container.querySelector(".cognora-header__right");
    expect(rightGroup).toBeTruthy();
    expect(rightGroup?.textContent).toContain("Save");
    expect(rightGroup?.textContent).toContain("Share");
    expect(rightGroup?.textContent).toContain("Inspector");
  });

  it("triggers onAutoAlign callback when Auto Align button in left group is clicked", () => {
    const onAutoAlign = vi.fn();
    render(
      <CognoraHeader
        lessonTitle="Linked List Traversal"
        isContextualPanelOpen={false}
        onToggleContextualPanel={() => {}}
        onAutoAlign={onAutoAlign}
      />,
    );

    const autoAlignBtn = screen.getByRole("button", { name: /auto align/i });
    fireEvent.click(autoAlignBtn);
    expect(onAutoAlign).toHaveBeenCalledTimes(1);
  });

  it("handles undo and redo states properly", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <CognoraHeader
        lessonTitle="Array Sorting"
        isContextualPanelOpen={false}
        onToggleContextualPanel={() => {}}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={true}
        canRedo={false}
      />,
    );

    const undoBtn = screen.getByTitle(/undo/i);
    const redoBtn = screen.getByTitle(/redo/i);

    expect(undoBtn).not.toBeDisabled();
    expect(redoBtn).toBeDisabled();

    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(redoBtn);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("toggles inspector when Inspector button is clicked", () => {
    const onToggleContextualPanel = vi.fn();
    render(
      <CognoraHeader
        lessonTitle="Graph Algorithms"
        isContextualPanelOpen={false}
        onToggleContextualPanel={onToggleContextualPanel}
      />,
    );

    const inspectorBtn = screen.getByRole("button", { name: /inspector/i });
    fireEvent.click(inspectorBtn);
    expect(onToggleContextualPanel).toHaveBeenCalledTimes(1);
  });
});
