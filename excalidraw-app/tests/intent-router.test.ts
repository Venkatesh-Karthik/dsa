import { describe, it, expect } from "vitest";

import {
  detectUserIntent,
  detectProgrammingLanguage,
} from "../ai/intent-router";

describe("Cognora Intent Router", () => {
  describe("Slash commands", () => {
    it("routes commands starting with / to 'command' intent", () => {
      expect(detectUserIntent("/array 1,2,3").intent).toBe("command");
      expect(detectUserIntent("/bst 10,5,15").intent).toBe("command");
      expect(detectUserIntent("/clear").intent).toBe("command");
      expect(detectUserIntent("/help").intent).toBe("command");
    });
  });

  describe("Competitive Programming / Coding Problems", () => {
    it("identifies platform mentions like CodeChef, LeetCode, Codeforces", () => {
      const res1 = detectUserIntent(
        "Solve this CodeChef problem: Chef and String with constraints 1 <= N <= 10^5",
      );
      expect(res1.intent).toBe("coding_problem");
      expect(res1.recommendedReasoningEffort).toBe("high");
      expect(res1.detectedLanguage).toBe("cpp");

      const res2 = detectUserIntent(
        "LeetCode Two Sum optimal solution in Python",
      );
      expect(res2.intent).toBe("coding_problem");
      expect(res2.detectedLanguage).toBe("python");

      const res3 = detectUserIntent(
        "Codeforces 1500 rated problem solution in Java",
      );
      expect(res3.intent).toBe("coding_problem");
      expect(res3.detectedLanguage).toBe("java");
    });

    it("identifies problem descriptions with constraints and arrays", () => {
      const res = detectUserIntent(
        "Given an array of integers nums, find the maximum subarray sum. Constraints: 1 <= n <= 10^5. Write C++ code.",
      );
      expect(res.intent).toBe("coding_problem");
      expect(res.recommendedReasoningEffort).toBe("high");
      expect(res.detectedLanguage).toBe("cpp");
    });

    it("detects requested languages accurately", () => {
      expect(detectProgrammingLanguage("write in C++")).toBe("cpp");
      expect(detectProgrammingLanguage("solve in Python 3")).toBe("python");
      expect(detectProgrammingLanguage("give Java code")).toBe("java");
      expect(detectProgrammingLanguage("in JavaScript")).toBe("javascript");
      expect(detectProgrammingLanguage("in C language")).toBe("c");
    });
  });

  describe("Follow-up questions", () => {
    it("detects follow-up when canvas selection or active lesson exists", () => {
      const resWithSelection = detectUserIntent("Why did this node change?", {
        selectedElementsContext: [
          { dslId: "node-10", type: "circle", label: "10" },
        ],
      });
      expect(resWithSelection.intent).toBe("follow_up");

      const resWithLesson = detectUserIntent("What happens in the next step?", {
        activeLessonState: {
          topic: "Binary Search",
          currentStepIndex: 2,
          totalSteps: 6,
        },
      });
      expect(resWithLesson.intent).toBe("follow_up");
    });

    it("does not classify as follow-up if there is no context", () => {
      const resNoContext = detectUserIntent("Explain binary search");
      expect(resNoContext.intent).toBe("visual_teaching");
    });
  });

  describe("General questions", () => {
    it("classifies pure complexity or definition questions without visual request", () => {
      const res1 = detectUserIntent(
        "What is the time complexity of quicksort?",
      );
      expect(res1.intent).toBe("general_question");

      const res2 = detectUserIntent("What does O(n log n) mean?");
      expect(res2.intent).toBe("general_question");
    });

    it("keeps visual_teaching if user asks to draw or show step by step", () => {
      const res = detectUserIntent(
        "What is the time complexity of quicksort? Show me step by step with diagrams",
      );
      expect(res.intent).toBe("visual_teaching");
    });
  });

  describe("Visual Teaching (Default)", () => {
    it("defaults to visual_teaching for concepts and algorithms", () => {
      expect(detectUserIntent("Explain binary search").intent).toBe(
        "visual_teaching",
      );
      expect(detectUserIntent("Teach me linked lists").intent).toBe(
        "visual_teaching",
      );
      expect(detectUserIntent("How does BFS work").intent).toBe(
        "visual_teaching",
      );
      expect(detectUserIntent("Draw an AVL tree rotation").intent).toBe(
        "visual_teaching",
      );
    });
  });
});
