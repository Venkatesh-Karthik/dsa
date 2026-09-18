import { describe, it, expect, vi } from "vitest";
import React from "react";
import { screen, render, fireEvent } from "@testing-library/react";

import {
  CognoraContextualPanel,
  type OverlayDirectionalControls,
  type AnalyzeModel,
} from "../components/CognoraContextualPanel";

describe("CognoraContextualPanel Inspector Overlay Controls", () => {
  const mockOverlayControls: OverlayDirectionalControls = {
    canMove: true,
    isOverridden: true,
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onMoveLeft: vi.fn(),
    onMoveRight: vi.fn(),
    onResetAuto: vi.fn(),
  };

  const mockAnalyzeData: AnalyzeModel = {
    stepperSteps: [
      {
        stepNumber: 1,
        title: "Initial Node",
        isCompleted: false,
        isActive: true,
        isPending: false,
      },
    ],
  };

  it("renders D-pad directional controls when Explain tab is active and overlayControls are provided", () => {
    render(
      <CognoraContextualPanel
        activeTab="explain"
        onTabChange={() => {}}
        onClose={() => {}}
        analyzeData={mockAnalyzeData}
        overlayControls={mockOverlayControls}
      />,
    );

    expect(screen.getByText("Explanation Card Position")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Move explanation up" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Move explanation down" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Move explanation left" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Move explanation right" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Reset explanation position" }),
    ).toBeTruthy();
  });

  it("invokes directional callbacks on D-pad button clicks", () => {
    const controls: OverlayDirectionalControls = {
      canMove: true,
      isOverridden: true,
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onMoveLeft: vi.fn(),
      onMoveRight: vi.fn(),
      onResetAuto: vi.fn(),
    };

    render(
      <CognoraContextualPanel
        activeTab="explain"
        onTabChange={() => {}}
        onClose={() => {}}
        analyzeData={mockAnalyzeData}
        overlayControls={controls}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Move explanation up" }),
    );
    expect(controls.onMoveUp).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Move explanation down" }),
    );
    expect(controls.onMoveDown).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Move explanation left" }),
    );
    expect(controls.onMoveLeft).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Move explanation right" }),
    );
    expect(controls.onMoveRight).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Reset explanation position" }),
    );
    expect(controls.onResetAuto).toHaveBeenCalledTimes(1);
  });

  it("does not render D-pad when active tab is Analyze", () => {
    render(
      <CognoraContextualPanel
        activeTab="analyze"
        onTabChange={() => {}}
        onClose={() => {}}
        analyzeData={mockAnalyzeData}
        overlayControls={mockOverlayControls}
      />,
    );

    expect(screen.queryByText("Explanation Card Position")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Move explanation up" }),
    ).toBeNull();
  });
});
