import { describe, it, expect } from "vitest";

import { SpeechPreprocessor } from "../ai/voice/speech-preprocessor";

import type { VoiceExplanationContext } from "../ai/voice/voice-contract";

describe("SpeechPreprocessor", () => {
  const baseContext: VoiceExplanationContext = {
    lessonId: "test-lesson-1",
    transformationId: "t-1",
    stepIndex: 1,
    totalSteps: 5,
    title: "Insert 25 into Linked List",
    explanation: "Insert node 25 between node 20 and 30.",
  };

  it("scrubs internal DSL IDs and container identifiers", () => {
    const context: VoiceExplanationContext = {
      ...baseContext,
      explanation:
        "In container sll_main, ptr-left moves to arr1-2 and node-25 is linked to rel-head.",
    };
    const result = SpeechPreprocessor.prepare(context);
    expect(result.spokenText).not.toContain("sll_main");
    expect(result.spokenText).not.toContain("ptr-left");
    expect(result.spokenText).not.toContain("arr1-2");
    expect(result.spokenText).not.toContain("node-25");
    expect(result.spokenText).not.toContain("rel-head");
    expect(result.scrubbedTokens.length).toBeGreaterThan(0);
  });

  it("removes raw JSON objects and arrays", () => {
    const context: VoiceExplanationContext = {
      ...baseContext,
      explanation:
        'Applying transformation {"type": "insert_node", "id": "n25"}. Node 25 is inserted.',
    };
    const result = SpeechPreprocessor.prepare(context);
    expect(result.spokenText).not.toContain('{"type"');
    expect(result.spokenText).not.toContain("insert_node");
    expect(result.spokenText).toContain("Node 25 is inserted");
  });

  it("cleans markdown fences, bold, and backticks", () => {
    const context: VoiceExplanationContext = {
      ...baseContext,
      explanation:
        "We inspect the `mid` element. **Notice** that `arr[mid] === 23`. Therefore we recurse on the right.",
    };
    const result = SpeechPreprocessor.prepare(context);
    expect(result.spokenText).not.toContain("`");
    expect(result.spokenText).not.toContain("**");
    expect(result.spokenText).toContain("equals 23");
    expect(result.spokenText).toContain("recurse on the right");
  });

  it("translates pointer arrows into natural spoken language", () => {
    const context: VoiceExplanationContext = {
      ...baseContext,
      explanation:
        "The pointers update so that 20 -> 25 -> 30 forms the new chain.",
    };
    const result = SpeechPreprocessor.prepare(context);
    expect(result.spokenText).toContain(
      "node 20 points to 25, which connects to 30",
    );
  });

  it("translates Big-O complexity terms into spoken English", () => {
    const context: VoiceExplanationContext = {
      ...baseContext,
      explanation:
        "Binary search reduces search space by half each iteration, achieving O(log n) efficiency.",
    };
    const result = SpeechPreprocessor.prepare(context);
    expect(result.spokenText).toContain("order of log n time");
    expect(result.spokenText).not.toContain("O(log n)");
  });

  it("provides a sensible spoken fallback for empty or baseline states", () => {
    const context: VoiceExplanationContext = {
      lessonId: "test-lesson-1",
      transformationId: "t-0",
      stepIndex: 0,
      totalSteps: 5,
      title: "Initial State",
      explanation: "",
      concept: "Singly Linked List",
    };
    const result = SpeechPreprocessor.prepare(context);
    expect(result.spokenText).toContain(
      "Here is the initial empty state for Singly Linked List.",
    );
  });
});
