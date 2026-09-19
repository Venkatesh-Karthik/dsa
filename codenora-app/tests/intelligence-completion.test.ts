import { describe, it, expect, beforeEach } from "vitest";

import { computeTreeLayout, TREE_LAYOUT } from "../ai/layout-engine";
import {
  executeUniversalCommand,
  clearCommandHistory,
  type CommandContext,
} from "../ai/commands";
import {
  parseNaturalLanguageToCommand,
  detectUserIntent,
} from "../ai/intent-router";
import { detectHandwritingCommand } from "../ai/commands/handwriting-command-detector";
import { validatePreRenderElements } from "../ai/visual-validation";
import {
  getCommandRiskLevel,
  getCommandConfirmationPolicy,
} from "../ai/commands/command-registry";

describe("Cognora Intelligence Completion Test Suite (Yellow -> Green)", () => {
  beforeEach(() => {
    clearCommandHistory();
  });

  describe("1. Heap & Tree Single-Child Layout Topology", () => {
    it("guarantees a single left-child does not vertically collapse to parent X coordinate", () => {
      // 9-element heap or tree where node at index 3 (parent) has a single child (left child)
      const nodes = [
        { id: "root", value: 100, children: ["node-50", "node-70"] },
        { id: "node-50", value: 50, children: ["node-30", "node-40"] },
        { id: "node-70", value: 70, children: ["node-60", "node-65"] },
        { id: "node-30", value: 30, children: ["node-8"] }, // Single left child
        { id: "node-40", value: 40, children: [] },
        { id: "node-60", value: 60, children: [] },
        { id: "node-65", value: 65, children: [] },
        { id: "node-8", value: 8, children: [] },
      ];

      const origin = { x: 400, y: 100 };
      const layout = computeTreeLayout(nodes, "root", origin);

      const parentPos = layout.positions.get("node-30");
      const childPos = layout.positions.get("node-8");

      expect(parentPos).toBeDefined();
      expect(childPos).toBeDefined();

      // Node 8 must NOT share the same X coordinate as parent Node 30
      expect(childPos!.x).not.toBe(parentPos!.x);
      // Because it is a single left child in binary tree/heap, childX must branch to the left
      expect(childPos!.x).toBeLessThan(parentPos!.x);
      // And child Y coordinate must be lower (greater Y) by LEVEL_GAP
      expect(childPos!.y).toBe(parentPos!.y + TREE_LAYOUT.LEVEL_GAP);
    });
  });

  describe("2. Contextual Target Resolution & /delete", () => {
    it("deletes selected entity when /delete is invoked without explicit value", async () => {
      const mockElements = [
        { id: "el-1", customData: { dslId: "cell-10", value: 10 } },
        { id: "el-2", customData: { dslId: "cell-20", value: 20 } },
        { id: "el-3", customData: { dslId: "cell-30", value: 30 } },
      ] as any[];

      const context: CommandContext = {
        sceneElements: mockElements,
        activeStructure: {
          id: "arr-1",
          type: "array",
          elements: [10, 20, 30],
        },
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        selectedEntities: ["cell-20"],
        focusedEntityId: "cell-20",
        history: [],
        isDeveloperMode: false,
      };

      const result = await executeUniversalCommand("/delete", context);

      expect(result.success).toBe(true);
      expect(result.riskLevel).toBe("MODIFY");
      expect(result.historyEntry).toContain("Delete");
      expect(result.message).toContain("Successfully removed 20");
    });
  });

  describe("3. Natural Language Command Translation vs Question Preservation", () => {
    it("translates unambiguous instructions to deterministic commands", () => {
      expect(
        parseNaturalLanguageToCommand("create an array with 10 elements"),
      ).toBe("/array 10");
      expect(parseNaturalLanguageToCommand("insert 40 into the heap")).toBe(
        "/insert 40",
      );
      expect(parseNaturalLanguageToCommand("push 99 onto the stack")).toBe(
        "/push 99",
      );
      expect(parseNaturalLanguageToCommand("clear canvas")).toBe("/clear");
      expect(parseNaturalLanguageToCommand("fit to screen")).toBe("/fit");
      expect(parseNaturalLanguageToCommand("next step")).toBe("/next");
    });

    it("strictly preserves questions without translating to canvas mutations", () => {
      expect(
        parseNaturalLanguageToCommand("How do I create an array?"),
      ).toBeNull();
      expect(
        parseNaturalLanguageToCommand("What happens if I insert 40?"),
      ).toBeNull();
      expect(
        parseNaturalLanguageToCommand("Why is the canvas cleared?"),
      ).toBeNull();
      expect(
        parseNaturalLanguageToCommand("Can you explain Binary Search?"),
      ).toBeNull();

      const questionIntent = detectUserIntent(
        "How do I insert 40 into the heap?",
      );
      expect(questionIntent.intent).not.toBe("command");
    });
  });

  describe("4. Handwriting Command Detection & Fuzzy Matching", () => {
    it("detects typed slash commands on canvas with HIGH confidence", () => {
      const elements = [
        {
          id: "txt-1",
          type: "text",
          text: "/heap 10",
          x: 200,
          y: 300,
          width: 80,
          height: 30,
        },
      ];

      const detected = detectHandwritingCommand(elements);
      expect(detected).not.toBeNull();
      expect(detected!.commandName).toBe("heap");
      expect(detected!.confidence).toBe("HIGH");
      expect(detected!.normalizedCommand).toBe("/heap 10");
    });

    it("performs fuzzy matching on handwritten typos like /arry(10)", () => {
      const elements = [
        {
          id: "txt-2",
          type: "text",
          text: "/arry 10",
          x: 100,
          y: 150,
          width: 90,
          height: 30,
        },
      ];

      const detected = detectHandwritingCommand(elements);
      expect(detected).not.toBeNull();
      expect(detected!.commandName).toBe("array");
      expect(detected!.didYouMean).toBe("/array 10");
      expect(detected!.confidence).toBe("MEDIUM");
      expect(detected!.normalizedCommand).toBe("/array 10");
    });

    it("strictly ignores code blocks and AI teaching explanations", () => {
      const elements = [
        {
          id: "txt-code",
          type: "text",
          text: "// /clear",
          x: 50,
          y: 50,
          width: 60,
          height: 20,
        },
        {
          id: "txt-teaching",
          type: "text",
          text: "/insert 40",
          x: 100,
          y: 100,
          width: 80,
          height: 20,
          customData: { isAiTeaching: true },
        },
      ];

      const detected = detectHandwritingCommand(elements);
      expect(detected).toBeNull();
    });
  });

  describe("5. Command Risk Levels & Confirmation Policies", () => {
    it("marks /clear and /reset as DESTRUCTIVE with ALWAYS confirmation", () => {
      expect(getCommandRiskLevel("/clear")).toBe("DESTRUCTIVE");
      expect(getCommandConfirmationPolicy("/clear")).toBe("ALWAYS");

      expect(getCommandRiskLevel("/reset")).toBe("DESTRUCTIVE");
      expect(getCommandConfirmationPolicy("/reset")).toBe("ALWAYS");
    });

    it("marks /insert and /delete as MODIFY", () => {
      expect(getCommandRiskLevel("/insert 20")).toBe("MODIFY");
      expect(getCommandRiskLevel("/delete 20")).toBe("MODIFY");
    });

    it("marks /see and /fit as SAFE with NEVER confirmation", () => {
      expect(getCommandRiskLevel("/see tree")).toBe("SAFE");
      expect(getCommandConfirmationPolicy("/see tree")).toBe("NEVER");

      expect(getCommandRiskLevel("/fit")).toBe("SAFE");
      expect(getCommandConfirmationPolicy("/fit")).toBe("NEVER");
    });
  });

  describe("6. 13-Rule Pre-Render Visual Validation", () => {
    it("passes valid well-formed scene elements", () => {
      const elements = [
        {
          id: "node-1",
          type: "rectangle",
          x: 100,
          y: 100,
          width: 60,
          height: 60,
          customData: { dslId: "node-1" },
        },
        {
          id: "node-2",
          type: "rectangle",
          x: 220,
          y: 100,
          width: 60,
          height: 60,
          customData: { dslId: "node-2" },
        },
      ];

      const result = validatePreRenderElements(elements);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedElements).toHaveLength(2);
    });

    it("detects and rejects NaN or Infinite coordinates", () => {
      const elements = [
        {
          id: "broken-node",
          type: "rectangle",
          x: NaN,
          y: Infinity,
          width: 60,
          height: 60,
        },
      ];

      const result = validatePreRenderElements(elements);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Non-Finite Coordinates")),
      ).toBe(true);
    });

    it("detects and flags unbounded element growth (Rule 13)", () => {
      const elements = Array.from({ length: 550 }, (_, i) => ({
        id: `el-${i}`,
        type: "rectangle",
        x: i * 10,
        y: 100,
        width: 10,
        height: 10,
      }));

      const result = validatePreRenderElements(elements, undefined, {
        maxElements: 500,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Rule 13"))).toBe(true);
    });
  });
});
