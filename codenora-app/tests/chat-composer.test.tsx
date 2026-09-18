import { describe, it, expect, vi } from "vitest";
import React from "react";
import { screen, render, fireEvent } from "@testing-library/react";

import { CognoraAIComposer } from "../components/CognoraAIComposer";

describe("CognoraAIComposer Multiline Composer", () => {
  it("renders textarea with correct placeholder and action buttons", () => {
    const onSubmit = vi.fn();
    const onInputChange = vi.fn();

    render(
      <CognoraAIComposer
        inputValue=""
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("Ask Cognora anything...");
    expect(textarea).toBeTruthy();
    expect(textarea.tagName).toBe("TEXTAREA");

    const plusBtn = screen.getByTitle("Attach file or import");
    expect(plusBtn).toBeTruthy();

    const sendBtn = screen.getByTitle("Send prompt");
    expect(sendBtn).toBeTruthy();
  });

  it("submits prompt on Enter when not composing", () => {
    const onSubmit = vi.fn();
    const onInputChange = vi.fn();

    render(
      <CognoraAIComposer
        inputValue="Explain AVL trees"
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("Ask Cognora anything...");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith("Explain AVL trees");
  });

  it("allows multiline input with Shift+Enter without submitting", () => {
    const onSubmit = vi.fn();
    const onInputChange = vi.fn();

    render(
      <CognoraAIComposer
        inputValue="Line 1"
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("Ask Cognora anything...");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit empty or whitespace-only messages", () => {
    const onSubmit = vi.fn();
    const onInputChange = vi.fn();

    render(
      <CognoraAIComposer
        inputValue={"   \n  \t  "}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("Ask Cognora anything...");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit on Enter during IME composition", () => {
    const onSubmit = vi.fn();
    const onInputChange = vi.fn();

    render(
      <CognoraAIComposer
        inputValue="nihao"
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("Ask Cognora anything...");

    // Simulate IME composition start
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).not.toHaveBeenCalled();

    // End IME composition
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith("nihao");
  });

  it("sends suggestion pill text when clicked", () => {
    const onSuggestionClick = vi.fn();

    render(
      <CognoraAIComposer
        inputValue=""
        onInputChange={() => {}}
        onSubmit={() => {}}
        isLoading={false}
        suggestions={["Insert 42", "Reverse List"]}
        onSuggestionClick={onSuggestionClick}
      />,
    );

    const pill = screen.getByRole("button", { name: "Insert 42" });
    fireEvent.click(pill);
    expect(onSuggestionClick).toHaveBeenCalledWith("Insert 42");
  });
});
