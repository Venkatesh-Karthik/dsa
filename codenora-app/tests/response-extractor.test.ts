import { describe, it, expect } from "vitest";

import {
  isolateMessageContent,
  stripReasoningTags,
  deterministicJsonRepair,
  safeParseJson,
  closeTruncatedJson,
  extractBalancedJson,
  extractJsonFromText,
} from "../ai/backend/response-extractor";

describe("AI Response Extractor", () => {
  describe("isolateMessageContent", () => {
    it("returns string input unchanged when no reasoning tags are present", () => {
      const input = '{"topic": "Heap", "visual_actions": []}';
      expect(isolateMessageContent(input)).toBe(input);
    });

    it("extracts content from message object and discards reasoning_content", () => {
      const msg = {
        role: "assistant",
        reasoning_content: "Let us think deeply about heaps and insertions...",
        content:
          '{"topic": "Min Heap", "message": "Here is a heap", "visual_actions": []}',
      };
      const result = isolateMessageContent(msg);
      expect(result).not.toContain("Let us think deeply");
      expect(result).toContain('"topic": "Min Heap"');
    });

    it("handles content array with text blocks", () => {
      const msg = {
        role: "assistant",
        content: [
          { type: "text", text: '{"topic": "BST"' },
          { type: "text", text: ', "visual_actions": []}' },
        ],
      };
      const result = isolateMessageContent(msg);
      expect(result).toBe('{"topic": "BST", "visual_actions": []}');
    });

    it("strips embedded <think> blocks from content string", () => {
      const text =
        '<think>I should use a binary tree layout.</think>{"topic": "Tree", "visual_actions": []}';
      const result = isolateMessageContent(text);
      expect(result).not.toContain("binary tree layout");
      expect(result.trim()).toBe('{"topic": "Tree", "visual_actions": []}');
    });
  });

  describe("stripReasoningTags", () => {
    it("strips balanced <think> tags", () => {
      const input = "Before <think>secret thought</think> After";
      expect(stripReasoningTags(input)).toBe("Before  After");
    });

    it("strips balanced <thought> and <reflection> tags", () => {
      const input =
        "<thought>deep thoughts</thought>Hello<reflection>reflect</reflection>";
      expect(stripReasoningTags(input)).toBe("Hello");
    });

    it("handles unclosed leading <think> tag", () => {
      const input = "<think>unclosed thought without end tag";
      expect(stripReasoningTags(input)).toBe("");
    });
  });

  describe("closeTruncatedJson", () => {
    it("closes unclosed double quote and objects/arrays", () => {
      const truncated =
        '{"topic": "Heap", "visual_actions": [{"type": "create_box", "label": "Node 1';
      const closed = closeTruncatedJson(truncated);
      const parsed = JSON.parse(closed);
      expect(parsed.topic).toBe("Heap");
      expect(parsed.visual_actions[0].type).toBe("create_box");
      expect(parsed.visual_actions[0].label).toBe("Node 1");
    });

    it("removes trailing comma before closing brackets", () => {
      const truncated = '{"items": [1, 2, 3,';
      const closed = closeTruncatedJson(truncated);
      const parsed = JSON.parse(closed);
      expect(parsed.items).toEqual([1, 2, 3]);
    });

    it("removes trailing unquoted colon", () => {
      const truncated = '{"topic": "Queue", "count":';
      const closed = closeTruncatedJson(truncated);
      const parsed = JSON.parse(closed);
      expect(parsed.topic).toBe("Queue");
    });
  });

  describe("extractJsonFromText", () => {
    it("extracts pure JSON string", () => {
      const json = JSON.stringify({
        topic: "Array",
        message: "Array explanation",
        visual_actions: [],
      });
      const parsed = extractJsonFromText(json);
      expect(parsed).toBeDefined();
      expect((parsed as any).topic).toBe("Array");
    });

    it("extracts JSON wrapped in markdown code fence", () => {
      const text = `Here is the visual teaching lesson:
\`\`\`json
{
  "topic": "Stack",
  "message": "Stack explanation",
  "visual_actions": []
}
\`\`\`
Hope this helps!`;
      const parsed = extractJsonFromText(text);
      expect(parsed).toBeDefined();
      expect((parsed as any).topic).toBe("Stack");
    });

    it("extracts JSON with surrounding conversational prose without fences", () => {
      const text = `Certainly! I will teach you about Min Heaps.
{"topic": "Min Heap", "message": "Min Heap operations", "visual_actions": [{"type": "create_box", "id": "b1", "label": "10", "x": 100, "y": 100}]}
Each element satisfies the heap invariant.`;
      const parsed = extractJsonFromText(text);
      expect(parsed).toBeDefined();
      expect((parsed as any).topic).toBe("Min Heap");
      expect((parsed as any).visual_actions).toHaveLength(1);
    });

    it("repairs and extracts truncated JSON at token limit", () => {
      const truncated = `{"topic": "Graph", "message": "BFS traversal", "visual_actions": [{"type": "create_node", "id": "n1", "label": "Start`;
      const parsed = extractJsonFromText(truncated);
      expect(parsed).toBeDefined();
      expect((parsed as any).topic).toBe("Graph");
      expect((parsed as any).message).toBe("BFS traversal");
      expect((parsed as any).visual_actions[0].id).toBe("n1");
    });

    it("prioritizes teaching response over internal nested objects", () => {
      const text = `Explanation snippet: {"helper": true}
And the full lesson is:
{
  "topic": "Binary Search",
  "message": "Divide and conquer search",
  "visual_actions": [
    {"type": "create_array", "id": "arr1", "elements": [1, 3, 5, 7, 9], "x": 100, "y": 100}
  ]
}`;
      const parsed = extractJsonFromText(text);
      expect(parsed).toBeDefined();
      expect((parsed as any).topic).toBe("Binary Search");
    });
  });
});
