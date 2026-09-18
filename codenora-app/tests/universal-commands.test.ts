import { describe, it, expect, beforeEach } from "vitest";

import {
  parseUniversalCommand,
  findCommand,
  getAllCommands,
  getCommandsByCategory,
  getContextualSuggestions,
  getAutocompleteSuggestions,
  getHelpText,
  executeUniversalCommand,
  getCommandHistory,
  clearCommandHistory,
  type CommandContext,
} from "../ai/commands";

describe("Cognora Universal Command System", () => {
  beforeEach(() => {
    clearCommandHistory();
  });

  describe("1. Universal Command Tokenizer & Parser", () => {
    it("parses space-separated array values and count", () => {
      const p1 = parseUniversalCommand("/array 10");
      expect(p1.commandName).toBe("array");
      expect(p1.isSizeOnly).toBe(true);
      expect(p1.numericArgs).toEqual([10]);

      const p2 = parseUniversalCommand("/array [4, 8, 15, 16, 23, 42]");
      expect(p2.commandName).toBe("array");
      expect(p2.isSizeOnly).toBe(false);
      expect(p2.arrayValues).toEqual([4, 8, 15, 16, 23, 42]);
    });

    it("parses parenthesized syntax for backward compatibility", () => {
      const p = parseUniversalCommand("/linked-list(10, 20, 30)");
      expect(p.commandName).toBe("linked-list");
      expect(p.numericArgs).toEqual([10, 20, 30]);
    });

    it("parses heap with max/min mode and array literal", () => {
      const p = parseUniversalCommand("/heap max [15, 10, 20, 8, 25]");
      expect(p.commandName).toBe("heap");
      expect(p.stringArgs[0]).toBe("max");
      expect(p.arrayValues).toEqual([15, 10, 20, 8, 25]);
    });

    it("parses target structure prefix and value", () => {
      const p1 = parseUniversalCommand("/insert 25");
      expect(p1.commandName).toBe("insert");
      expect(p1.target).toBeUndefined();
      expect(p1.numericArgs).toEqual([25]);

      const p2 = parseUniversalCommand("/insert heap 25");
      expect(p2.commandName).toBe("insert");
      expect(p2.target).toBe("heap");
      expect(p2.numericArgs).toEqual([25]);
    });

    it("parses weighted graph edges with colon notation", () => {
      const p = parseUniversalCommand("/graph A-B:4 A-C:2 B-D:5");
      expect(p.commandName).toBe("graph");
      expect(p.graphEdges).toHaveLength(3);
      expect(p.graphEdges?.[0]).toEqual({
        from: "A",
        to: "B",
        weight: 4,
        directed: false,
      });
      expect(p.graphEdges?.[1]).toEqual({
        from: "A",
        to: "C",
        weight: 2,
        directed: false,
      });
    });

    it("throws informative error on malformed array or structure input", () => {
      expect(() => parseUniversalCommand("/array banana")).toThrow(
        "Invalid /array command",
      );
      expect(() => parseUniversalCommand("/connect A")).toThrow(
        "Invalid /connect command",
      );
      expect(() => parseUniversalCommand("/heap invalid")).toThrow(
        "Invalid /heap command",
      );
    });
  });

  describe("2. Authoritative Registry & Context Recommendations", () => {
    it("registers all 10 universal command categories", () => {
      const all = getAllCommands();
      const categories = new Set(all.map((c) => c.category));

      expect(categories.has("CREATE")).toBe(true);
      expect(categories.has("TRANSFORM")).toBe(true);
      expect(categories.has("RUN")).toBe(true);
      expect(categories.has("LEARN")).toBe(true);
      expect(categories.has("VIEW")).toBe(true);
      expect(categories.has("PLAYBACK")).toBe(true);
      expect(categories.has("SESSION")).toBe(true);
      expect(categories.has("OUTPUT")).toBe(true);
      expect(categories.has("POWER")).toBe(true);
      expect(categories.has("SYSTEM")).toBe(true);
    });

    it("filters commands by category", () => {
      const creates = getCommandsByCategory("CREATE");
      expect(creates.some((c) => c.name === "array")).toBe(true);
      expect(creates.some((c) => c.name === "heap")).toBe(true);
      expect(creates.some((c) => c.name === "binary-tree")).toBe(true);

      const transforms = getCommandsByCategory("TRANSFORM");
      expect(transforms.some((c) => c.name === "insert")).toBe(true);
      expect(transforms.some((c) => c.name === "delete")).toBe(true);
      expect(transforms.some((c) => c.name === "push")).toBe(true);
    });

    it("derives contextual suggestions based on active canvas structure", () => {
      const heapContext: CommandContext = {
        sceneElements: [],
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        activeStructure: { id: "heap-1", type: "heap", elements: [15, 10, 20] },
        selectedEntities: [],
        focusedEntityId: null,
        history: [],
        isDeveloperMode: false,
      };

      const heapSuggestions = getContextualSuggestions(heapContext);
      const heapNames = heapSuggestions.map((s) => s.name);
      expect(heapNames).toContain("insert");
      expect(heapNames).toContain("delete");
      expect(heapNames).toContain("peek");
      expect(heapNames).toContain("pop");

      const treeContext: CommandContext = {
        ...heapContext,
        activeStructure: { id: "bst-1", type: "tree", elements: [50, 30, 70] },
      };
      const treeSuggestions = getContextualSuggestions(treeContext);
      const treeNames = treeSuggestions.map((s) => s.name);
      expect(treeNames).toContain("insert");
      expect(treeNames).toContain("delete");
      expect(treeNames).toContain("rotate");
    });

    it("provides dynamic help text directly from registry", () => {
      const generalHelp = getHelpText();
      expect(generalHelp).toContain("Cognora Universal Command System");
      expect(generalHelp).toContain("CREATE:");
      expect(generalHelp).toContain("TRANSFORM:");

      const arrayHelp = getHelpText("array");
      expect(arrayHelp).toContain("/array — Creates an indexed array");
      expect(arrayHelp).toContain("Syntax:");
    });
  });

  describe("3. Deterministic Semantic Execution (Zero AI Calls)", () => {
    const mockContext: CommandContext = {
      sceneElements: [],
      activeModel: null,
      timeline: null,
      playbackController: null,
      currentTransformationIndex: 0,
      activeStructure: null,
      selectedEntities: [],
      focusedEntityId: null,
      history: [],
      isDeveloperMode: false,
    };

    it("executes /array [10, 20, 30] semantically without calling AI", async () => {
      const res = await executeUniversalCommand(
        "/array [10, 20, 30]",
        mockContext,
      );
      expect(res.success).toBe(true);
      expect(res.executionClass).toBe("SEMANTIC");
      expect(res.commandName).toBe("array");
      expect(res.actions.length).toBeGreaterThan(0);
      expect(res.actions[0].type).toBe("create_array");
      expect(res.lesson).toBeDefined();
    });

    it("executes /heap max [15, 10, 20] semantically without calling AI", async () => {
      const res = await executeUniversalCommand(
        "/heap max [15, 10, 20]",
        mockContext,
      );
      expect(res.success).toBe(true);
      expect(res.executionClass).toBe("SEMANTIC");
      expect(res.commandName).toBe("heap");
      expect(res.actions.length).toBeGreaterThan(0);
      expect(res.lesson).toBeDefined();
    });

    it("executes /sort quick over active structure with zero AI calls", async () => {
      const contextWithArray: CommandContext = {
        ...mockContext,
        activeStructure: {
          id: "arr-1",
          type: "array",
          elements: [38, 27, 43, 3, 9],
        },
      };

      const res = await executeUniversalCommand(
        "/sort quick",
        contextWithArray,
      );
      expect(res.success).toBe(true);
      expect(res.executionClass).toBe("SEMANTIC");
      expect(res.timeline).toBeDefined();
      expect(res.timeline?.states.length).toBeGreaterThan(1);
    });

    it("executes transformation /insert with contextual target resolution", async () => {
      const contextWithHeap: CommandContext = {
        ...mockContext,
        activeStructure: { id: "heap-1", type: "heap", elements: [15, 10, 20] },
      };

      const res = await executeUniversalCommand("/insert 25", contextWithHeap);
      expect(res.success).toBe(true);
      expect(res.executionClass).toBe("SEMANTIC");
      expect(res.commandName).toBe("insert");
      expect(res.message).toContain("inserted 25 into heap");
    });
  });

  describe("4. Local Operations, Playback & UI Actions", () => {
    it("executes /fit and returns FIT_VIEWPORT UI action", async () => {
      const mockContext: CommandContext = {
        sceneElements: [],
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        selectedEntities: [],
        focusedEntityId: null,
        history: [],
        isDeveloperMode: false,
      };

      const res = await executeUniversalCommand("/fit", mockContext);
      expect(res.success).toBe(true);
      expect(res.executionClass).toBe("LOCAL");
      expect(res.uiAction?.type).toBe("FIT_VIEWPORT");
    });

    it("executes /commands and returns OPEN_PALETTE UI action", async () => {
      const mockContext: CommandContext = {
        sceneElements: [],
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        selectedEntities: [],
        focusedEntityId: null,
        history: [],
        isDeveloperMode: false,
      };

      const res = await executeUniversalCommand("/commands", mockContext);
      expect(res.success).toBe(true);
      expect(res.uiAction?.type).toBe("OPEN_PALETTE");
    });
  });

  describe("5. Teaching Command Routing & Developer Mode Protection", () => {
    it("routes /teach to TEACHING execution class with tailored prompt", async () => {
      const mockContext: CommandContext = {
        sceneElements: [],
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        selectedEntities: [],
        focusedEntityId: null,
        history: [],
        isDeveloperMode: false,
      };

      const res = await executeUniversalCommand(
        "/teach binary search",
        mockContext,
      );
      expect(res.success).toBe(true);
      expect(res.executionClass).toBe("TEACHING");
      expect(res.message).toContain("NVIDIA Nemotron Ultra");
    });

    it("blocks developer command /verify when developer mode is disabled", async () => {
      const mockContext: CommandContext = {
        sceneElements: [],
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        selectedEntities: [],
        focusedEntityId: null,
        history: [],
        isDeveloperMode: false,
      };

      const res = await executeUniversalCommand("/verify", mockContext);
      expect(res.success).toBe(false);
      expect(res.executionClass).toBe("DEVELOPER");
      expect(res.error).toContain("only available in developer mode");
    });

    it("allows developer command /verify when developer mode is enabled", async () => {
      const devContext: CommandContext = {
        sceneElements: [],
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        selectedEntities: [],
        focusedEntityId: null,
        history: [],
        isDeveloperMode: true,
      };

      const res = await executeUniversalCommand("/verify", devContext);
      expect(res.success).toBe(true);
      expect(res.executionClass).toBe("DEVELOPER");
      expect(res.diagnostics).toBeDefined();
      expect(res.message).toContain("Cognora Developer Verification");
    });

    it("records command execution history", async () => {
      const mockContext: CommandContext = {
        sceneElements: [],
        activeModel: null,
        timeline: null,
        playbackController: null,
        currentTransformationIndex: 0,
        selectedEntities: [],
        focusedEntityId: null,
        history: [],
        isDeveloperMode: false,
      };

      expect(getCommandHistory()).toHaveLength(0);
      await executeUniversalCommand("/fit", mockContext);
      expect(getCommandHistory()).toHaveLength(1);
      expect(getCommandHistory()[0].rawInput).toBe("/fit");

      clearCommandHistory();
      expect(getCommandHistory()).toHaveLength(0);
    });
  });
});
