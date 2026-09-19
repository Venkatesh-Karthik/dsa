/**
 * Cognora Universal Command System - Authoritative Registry
 *
 * Single source of truth for all Cognora commands, syntax, metadata,
 * execution classes, categories, autocomplete, and contextual suggestions.
 */

import { SemanticCommandRunner } from "./semantic-command-runner";
import {
  generateArray,
  generateLinkedList,
  generateStack,
  generateQueue,
  generateBinaryTree,
  generateHeap,
  generateGraph,
  generateMatrix,
} from "./command-generators";

import type {
  CommandDefinition,
  AutocompleteSuggestion,
  CommandContext,
  CommandResult,
  ParsedCommand,
  CommandCategory,
  CommandRiskLevel,
  CommandConfirmationPolicy,
} from "./command-types";

// ============================================================================
// BUILT-IN COMMAND DEFINITIONS (Universal across all DSA & System concepts)
// ============================================================================

export const BUILTIN_COMMANDS: CommandDefinition[] = [
  // --------------------------------------------------------------------------
  // 1. CREATE COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "array",
    aliases: ["arr"],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates an indexed array with values or a specified size",
    syntax: "/array <count> or /array [val1, val2, ...]",
    examples: ["/array 10", "/array [4, 8, 15, 16, 23, 42]"],
    example: "/array [4, 8, 15, 16, 23, 42]",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateArray,
    formatSuccessMessage: (args) =>
      args.isSizeOnly
        ? `Created array with ${args.numericArgs[0]} elements.`
        : `Created array with ${
            args.numericArgs.length || args.stringArgs.length
          } elements.`,
  },
  {
    name: "linked-list",
    aliases: ["ll", "linkedlist"],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a linked list structure with directional pointers",
    syntax: "/linked-list [val1, val2, ...] or /ll(10, 20, 30)",
    examples: ["/linked-list [10, 40, 60]", "/ll(1, 2, 3)"],
    example: "/linked-list [10, 40, 60]",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateLinkedList,
    formatSuccessMessage: (args) =>
      `Created linked list with ${
        args.numericArgs.length || args.stringArgs.length
      } nodes terminating at NULL.`,
  },
  {
    name: "stack",
    aliases: [],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a LIFO stack container with initial elements",
    syntax: "/stack [val1, val2, ...] or /stack 10, 20, 30",
    examples: ["/stack [10, 20, 30]", "/stack(1, 2, 3)"],
    example: "/stack [10, 20, 30]",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateStack,
    formatSuccessMessage: (args) =>
      `Created a stack with ${
        args.numericArgs.length || args.stringArgs.length
      } elements.`,
  },
  {
    name: "queue",
    aliases: [],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a FIFO queue with Front and Rear indicators",
    syntax: "/queue [val1, val2, ...] or /queue 10, 20, 30",
    examples: ["/queue [10, 20, 30]", "/queue(10, 20, 30)"],
    example: "/queue [10, 20, 30]",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateQueue,
    formatSuccessMessage: (args) =>
      `Created a queue with ${
        args.numericArgs.length || args.stringArgs.length
      } elements.`,
  },
  {
    name: "binary-tree",
    aliases: ["tree", "bst"],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a binary tree hierarchy from node keys",
    syntax:
      "/binary-tree [val1, val2, ...] or /tree [val1, val2, ...] or /bst [val1, val2, ...]",
    examples: [
      "/binary-tree [50, 30, 70, 20, 40, 60, 80]",
      "/tree [50, 30, 70]",
      "/bst [10, 5, 15]",
    ],
    example: "/binary-tree [50, 30, 70, 20, 40, 60, 80]",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateBinaryTree,
    formatSuccessMessage: (args) =>
      `Created a binary tree with ${args.numericArgs.length} nodes.`,
  },
  {
    name: "avl",
    aliases: [],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a self-balancing AVL Tree through rotations",
    syntax: "/avl [val1, val2, ...]",
    examples: ["/avl [30, 20, 10, 25, 28, 27]"],
    example: "/avl [30, 20, 10, 25, 28, 27]",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateBinaryTree,
    formatSuccessMessage: (args) =>
      `Created AVL tree with ${args.numericArgs.length} nodes.`,
  },
  {
    name: "heap",
    aliases: ["minheap", "maxheap"],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a binary Min or Max Heap through sift operations",
    syntax: "/heap [max|min] [val1, val2, ...]",
    examples: [
      "/heap max [15, 10, 20, 8, 25]",
      "/heap min [15, 10, 20, 8, 25]",
    ],
    example: "/heap max [15, 10, 20, 8, 25]",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateHeap,
    formatSuccessMessage: (args) =>
      `Created a binary heap with ${args.numericArgs.length} elements.`,
  },
  {
    name: "graph",
    aliases: ["dag"],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a graph with weighted/unweighted edges",
    syntax: "/graph A-B A-C B-D or /graph A-B:4 A-C:2 B-D:5",
    examples: ["/graph A-B A-C B-D C-D", "/graph A-B:4 A-C:2 B-D:5 C-D:8"],
    example: "/graph A-B:4 A-C:2 B-D:5",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateGraph,
    formatSuccessMessage: (args) =>
      `Created a graph with ${args.graphEdges?.length || 5} edges.`,
  },
  {
    name: "matrix",
    aliases: ["table", "grid"],
    category: "CREATE",
    executionClass: "SEMANTIC",
    description: "Creates a 2D matrix or tabular state grid",
    syntax: "/matrix 3 3 or /matrix(1,2,3;4,5,6) or /table 3 3",
    examples: ["/matrix 3 3", "/matrix(1,2,3;4,5,6)", "/table 3 3"],
    example: "/matrix 3 3",
    execute: (args, ctx) => SemanticCommandRunner.executeCreate(args, ctx),
    generateActions: generateMatrix,
    formatSuccessMessage: (args) =>
      args.matrixRows
        ? `Created a ${args.matrixRows.length}×${
            args.matrixRows[0]?.length || 0
          } matrix.`
        : `Created a matrix grid.`,
  },

  // --------------------------------------------------------------------------
  // 2. TRANSFORM COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "insert",
    aliases: ["add", "append"],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description:
      "Inserts a value into the active structure (heap, tree, array, list)",
    syntax: "/insert [target] <value>",
    examples: ["/insert 25", "/insert heap 25", "/insert avl 40"],
    example: "/insert 25",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "delete",
    aliases: ["remove"],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Deletes a value from the active structure",
    syntax: "/delete [target] <value>",
    examples: ["/delete 40", "/delete bst 30"],
    example: "/delete 40",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "push",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Pushes a new value onto the active stack",
    syntax: "/push <value>",
    examples: ["/push 40", "/push 100"],
    example: "/push 40",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "pop",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Pops the top element from the stack or root from heap",
    syntax: "/pop",
    examples: ["/pop"],
    example: "/pop",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "peek",
    aliases: ["front", "top"],
    category: "TRANSFORM",
    executionClass: "LOCAL",
    description:
      "Inspects and highlights the front or root element without removal",
    syntax: "/peek",
    examples: ["/peek"],
    example: "/peek",
    execute: (_args, ctx) => {
      const target = SemanticCommandRunner.resolveTargetStructure(_args, ctx);
      const topVal =
        target?.elements[target.elements.length - 1] ?? target?.elements[0];
      return {
        status: "success",
        success: true,
        message:
          topVal !== undefined
            ? `Top element: ${topVal}`
            : "Structure is empty.",
        executionClass: "LOCAL",
        commandName: "peek",
        focus: topVal !== undefined ? { entityId: String(topVal) } : undefined,
        actions: [],
      };
    },
  },
  {
    name: "enqueue",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Enqueues a value into the active queue",
    syntax: "/enqueue <value>",
    examples: ["/enqueue 40"],
    example: "/enqueue 40",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "dequeue",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Dequeues the front element from the queue",
    syntax: "/dequeue",
    examples: ["/dequeue"],
    example: "/dequeue",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "connect",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Creates an edge between two graph or tree nodes",
    syntax: "/connect <source> <target> [label]",
    examples: ["/connect A B", "/connect A B 'weight: 5'"],
    example: "/connect A B",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "disconnect",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Removes an edge between two graph or tree nodes",
    syntax: "/disconnect <source> <target>",
    examples: ["/disconnect A B"],
    example: "/disconnect A B",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "edge",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Creates or updates a weighted graph edge",
    syntax: "/edge <source> <target> [weight]",
    examples: ["/edge A B 5"],
    example: "/edge A B 5",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "rotate",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Performs tree rotation around targeted node",
    syntax: "/rotate [left|right] [target]",
    examples: ["/rotate left", "/rotate right node-30"],
    example: "/rotate left",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },
  {
    name: "reverse",
    aliases: [],
    category: "TRANSFORM",
    executionClass: "SEMANTIC",
    description: "Reverses elements in current array or linked list",
    syntax: "/reverse [target]",
    examples: ["/reverse"],
    example: "/reverse",
    execute: (args, ctx) => SemanticCommandRunner.executeTransform(args, ctx),
  },

  // --------------------------------------------------------------------------
  // 3. RUN ALGORITHM COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "run",
    aliases: [],
    category: "RUN",
    executionClass: "SEMANTIC",
    description: "Executes an algorithm over the active structure",
    syntax: "/run <algorithm> [args]",
    examples: ["/run quick-sort", "/run merge-sort", "/run dijkstra A"],
    example: "/run quick-sort",
    execute: (args, ctx) => SemanticCommandRunner.executeAlgorithm(args, ctx),
  },
  {
    name: "sort",
    aliases: [],
    category: "RUN",
    executionClass: "SEMANTIC",
    description: "Executes sorting algorithm on the active array",
    syntax: "/sort [quick|merge|insertion]",
    examples: ["/sort quick", "/sort merge", "/sort insertion"],
    example: "/sort quick",
    execute: (args, ctx) => SemanticCommandRunner.executeAlgorithm(args, ctx),
  },
  {
    name: "search",
    aliases: [],
    category: "RUN",
    executionClass: "SEMANTIC",
    description: "Searches for a value using binary or linear search",
    syntax: "/search [binary|linear] <value>",
    examples: ["/search binary 23", "/search linear 42"],
    example: "/search binary 23",
    execute: (args, ctx) => SemanticCommandRunner.executeAlgorithm(args, ctx),
  },
  {
    name: "traverse",
    aliases: [],
    category: "RUN",
    executionClass: "SEMANTIC",
    description: "Executes graph or tree traversal (BFS, DFS, Inorder)",
    syntax: "/traverse [bfs|dfs|inorder] [startNode]",
    examples: ["/traverse bfs A", "/traverse dfs root"],
    example: "/traverse bfs A",
    execute: (args, ctx) => SemanticCommandRunner.executeAlgorithm(args, ctx),
  },

  // --------------------------------------------------------------------------
  // 4. LEARN & TEACHING COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "teach",
    aliases: [],
    category: "LEARN",
    executionClass: "TEACHING",
    description:
      "Invokes NVIDIA teaching intelligence to explain current state",
    syntax: "/teach or /teach /<command>",
    examples: ["/teach", "/teach /heap [10, 20, 30]", "/teach /insert 40"],
    example: "/teach",
    execute: async (args, ctx) => {
      // If combined with subcommand e.g. /teach /insert 40, execute command first
      if (args.subcommand && args.subcommand !== "teach") {
        const subParsed = findCommand(args.subcommand.replace(/^\//, ""));
        if (subParsed) {
          await subParsed.execute(args, ctx);
        }
      }

      if (ctx.invokeTeaching) {
        const currentConcept =
          ctx.timeline?.topic ||
          ctx.activeModel?.problem.objective ||
          "current concept";
        await ctx.invokeTeaching(
          `Explain the ${currentConcept} state in detail.`,
        );
      }

      return {
        status: "success",
        success: true,
        message: "Teaching request dispatched to NVIDIA Nemotron Ultra.",
        executionClass: "TEACHING",
        commandName: "teach",
        actions: [],
      };
    },
  },
  {
    name: "explain",
    aliases: ["why"],
    category: "LEARN",
    executionClass: "TEACHING",
    description: "Opens detailed explanation of current step in Inspector",
    syntax: "/explain or /why",
    examples: ["/explain", "/why"],
    example: "/why",
    execute: (_args, ctx) => {
      if (ctx.openInspectorTab) {
        ctx.openInspectorTab("explain");
      }
      return {
        status: "success",
        success: true,
        message: "Focused Inspector on causal step explanation.",
        executionClass: "LOCAL",
        commandName: "explain",
        uiAction: { type: "OPEN_INSPECTOR", payload: "explain" },
        actions: [],
      };
    },
  },
  {
    name: "trace",
    aliases: [],
    category: "LEARN",
    executionClass: "LOCAL",
    description: "Shows step-by-step transformation trace in Inspector",
    syntax: "/trace",
    examples: ["/trace"],
    example: "/trace",
    execute: (_args, ctx) => {
      if (ctx.openInspectorTab) {
        ctx.openInspectorTab("analyze");
      }
      return {
        status: "success",
        success: true,
        message: "Opened transformation reasoning trace.",
        executionClass: "LOCAL",
        commandName: "trace",
        uiAction: { type: "OPEN_INSPECTOR", payload: "analyze" },
        actions: [],
      };
    },
  },
  {
    name: "see",
    aliases: [],
    category: "LEARN",
    executionClass: "LOCAL",
    description:
      "Highlights what matters visually right now with a compact glimpse",
    syntax: "/see",
    examples: ["/see"],
    example: "/see",
    execute: (_args, ctx) => {
      const curMeta = ctx.timeline?.meta[ctx.currentTransformationIndex];
      const focalId =
        ctx.focusedEntityId ||
        (ctx.timeline?.states[ctx.currentTransformationIndex]?.graph.metadata
          ?.focalEntityId as string | undefined);
      return {
        status: "success",
        success: true,
        message:
          curMeta?.explanation || "Focus placed on active transition entity.",
        executionClass: "LOCAL",
        commandName: "see",
        focus: focalId ? { entityId: String(focalId) } : undefined,
        actions: [],
      };
    },
  },
  {
    name: "diff",
    aliases: ["compare"],
    category: "LEARN",
    executionClass: "LOCAL",
    description:
      "Displays semantic differences between previous and current state",
    syntax: "/diff or /compare",
    examples: ["/diff", "/compare"],
    example: "/diff",
    execute: (_args, ctx) => SemanticCommandRunner.executeDiff(ctx),
  },
  {
    name: "inspect",
    aliases: [],
    category: "LEARN",
    executionClass: "LOCAL",
    description: "Inspects semantic properties of an entity or active state",
    syntax: "/inspect [entityId]",
    examples: ["/inspect", "/inspect node-25"],
    example: "/inspect",
    execute: (args, ctx) => {
      if (ctx.openInspectorTab) {
        ctx.openInspectorTab("analyze");
      }
      return {
        status: "success",
        success: true,
        message: `Inspecting ${args.args[0] || "active concept state"}.`,
        executionClass: "LOCAL",
        commandName: "inspect",
        uiAction: { type: "OPEN_INSPECTOR", payload: "analyze" },
        actions: [],
      };
    },
  },

  // --------------------------------------------------------------------------
  // 5. VIEW COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "focus",
    aliases: ["follow", "watch", "spotlight"],
    category: "VIEW",
    executionClass: "LOCAL",
    description: "Focuses the visual callout or camera on an entity or role",
    syntax: "/focus <entity|root|pivot|current>",
    examples: ["/focus 25", "/focus root", "/focus pivot"],
    example: "/focus 25",
    execute: (args, ctx) => {
      const target = args.args[0] || "current";
      if (ctx.setFocus) {
        ctx.setFocus(target);
      }
      return {
        status: "success",
        success: true,
        message: `Focused view on ${target}.`,
        executionClass: "LOCAL",
        commandName: "focus",
        focus: { entityId: String(target) },
        actions: [],
      };
    },
  },
  {
    name: "fit",
    aliases: ["center"],
    category: "VIEW",
    executionClass: "LOCAL",
    description: "Fits and centers the entire visual scene into the viewport",
    syntax: "/fit or /center",
    examples: ["/fit", "/center"],
    example: "/fit",
    execute: (_args, ctx) => {
      if (ctx.excalidrawAPI) {
        ctx.excalidrawAPI.scrollToContent(
          ctx.excalidrawAPI.getSceneElements(),
          {
            fitToViewport: true,
            animate: true,
          },
        );
      }
      return {
        status: "success",
        success: true,
        message: "Viewport centered to scene bounds.",
        executionClass: "LOCAL",
        commandName: "fit",
        uiAction: { type: "FIT_VIEWPORT" },
        actions: [],
      };
    },
  },
  {
    name: "align",
    aliases: ["arrange"],
    category: "VIEW",
    executionClass: "LOCAL",
    description:
      "Automatically re-computes optimal visual layout and alignments",
    syntax: "/align or /arrange [auto|horizontal|vertical|compact]",
    examples: ["/align", "/arrange compact"],
    example: "/align",
    execute: (_args, ctx) => {
      if (ctx.playbackController) {
        ctx.playbackController.reconcileSceneToState();
      }
      return {
        status: "success",
        success: true,
        message: "Re-aligned visual scene layout deterministically.",
        executionClass: "LOCAL",
        commandName: "align",
        actions: [],
      };
    },
  },
  {
    name: "clean",
    aliases: [],
    category: "VIEW",
    executionClass: "LOCAL",
    description:
      "Cleans secondary visual annotations while preserving manual sketches",
    syntax: "/clean",
    examples: ["/clean"],
    example: "/clean",
    execute: (_args, ctx) => {
      if (ctx.playbackController) {
        ctx.playbackController.reconcileSceneToState();
      }
      return {
        status: "success",
        success: true,
        message: "Cleaned secondary visual clutter.",
        executionClass: "LOCAL",
        commandName: "clean",
        actions: [],
      };
    },
  },

  // --------------------------------------------------------------------------
  // 6. PLAYBACK COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "next",
    aliases: ["step"],
    category: "PLAYBACK",
    executionClass: "LOCAL",
    description: "Advances playback to the next step or specified index",
    syntax: "/next or /step [index]",
    examples: ["/next", "/step 5"],
    example: "/next",
    execute: (args, ctx) => {
      const stepIdx = args.numericArgs[0];
      if (ctx.navigatePlayback) {
        if (stepIdx !== undefined) {
          ctx.navigatePlayback("step", stepIdx - 1);
        } else {
          ctx.navigatePlayback("next");
        }
      }
      return {
        status: "success",
        success: true,
        message:
          stepIdx !== undefined
            ? `Stepped to transition ${stepIdx}.`
            : "Advanced to next step.",
        executionClass: "LOCAL",
        commandName: "next",
        uiAction: { type: "PLAYBACK_CONTROL", payload: "next" },
        actions: [],
      };
    },
  },
  {
    name: "previous",
    aliases: ["back", "prev"],
    category: "PLAYBACK",
    executionClass: "LOCAL",
    description: "Steps back to the previous transformation state",
    syntax: "/previous or /back",
    examples: ["/previous", "/back"],
    example: "/previous",
    execute: (_args, ctx) => {
      if (ctx.navigatePlayback) {
        ctx.navigatePlayback("previous");
      }
      return {
        status: "success",
        success: true,
        message: "Stepped back to previous state.",
        executionClass: "LOCAL",
        commandName: "previous",
        uiAction: { type: "PLAYBACK_CONTROL", payload: "previous" },
        actions: [],
      };
    },
  },
  {
    name: "play",
    aliases: [],
    category: "PLAYBACK",
    executionClass: "LOCAL",
    description: "Plays the lesson animation sequence automatically",
    syntax: "/play",
    examples: ["/play"],
    example: "/play",
    execute: (_args, ctx) => {
      if (ctx.navigatePlayback) {
        ctx.navigatePlayback("play");
      }
      return {
        status: "success",
        success: true,
        message: "Playback started.",
        executionClass: "LOCAL",
        commandName: "play",
        uiAction: { type: "PLAYBACK_CONTROL", payload: "play" },
        actions: [],
      };
    },
  },
  {
    name: "pause",
    aliases: [],
    category: "PLAYBACK",
    executionClass: "LOCAL",
    description: "Pauses active lesson playback animation",
    syntax: "/pause",
    examples: ["/pause"],
    example: "/pause",
    execute: (_args, ctx) => {
      if (ctx.navigatePlayback) {
        ctx.navigatePlayback("pause");
      }
      return {
        status: "success",
        success: true,
        message: "Playback paused.",
        executionClass: "LOCAL",
        commandName: "pause",
        uiAction: { type: "PLAYBACK_CONTROL", payload: "pause" },
        actions: [],
      };
    },
  },
  {
    name: "replay",
    aliases: [],
    category: "PLAYBACK",
    executionClass: "LOCAL",
    description: "Replays lesson animation from State 0",
    syntax: "/replay",
    examples: ["/replay"],
    example: "/replay",
    execute: (_args, ctx) => {
      if (ctx.navigatePlayback) {
        ctx.navigatePlayback("replay");
      }
      return {
        status: "success",
        success: true,
        message: "Replaying lesson from beginning.",
        executionClass: "LOCAL",
        commandName: "replay",
        uiAction: { type: "PLAYBACK_CONTROL", payload: "replay" },
        actions: [],
      };
    },
  },

  // --------------------------------------------------------------------------
  // 7. SESSION COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "undo",
    aliases: [],
    category: "SESSION",
    executionClass: "LOCAL",
    description: "Undoes the last semantic operation or canvas stroke",
    syntax: "/undo",
    examples: ["/undo"],
    example: "/undo",
    execute: (_args, ctx) => {
      if (ctx.undo) {
        ctx.undo();
      }
      return {
        status: "success",
        success: true,
        message: "Undid previous operation.",
        executionClass: "LOCAL",
        commandName: "undo",
        actions: [],
      };
    },
  },
  {
    name: "redo",
    aliases: [],
    category: "SESSION",
    executionClass: "LOCAL",
    description: "Redoes the previously undone operation",
    syntax: "/redo",
    examples: ["/redo"],
    example: "/redo",
    execute: (_args, ctx) => {
      if (ctx.redo) {
        ctx.redo();
      }
      return {
        status: "success",
        success: true,
        message: "Redid operation.",
        executionClass: "LOCAL",
        commandName: "redo",
        actions: [],
      };
    },
  },
  {
    name: "reset",
    aliases: ["clear"],
    category: "SESSION",
    executionClass: "LOCAL",
    riskLevel: "DESTRUCTIVE",
    confirmationPolicy: "ALWAYS",
    semanticEffect:
      "Clears all canvas elements and resets active lesson session",
    description: "Resets the canvas and teaching workspace",
    syntax: "/reset or /clear",
    examples: ["/reset", "/clear"],
    example: "/reset",
    execute: (_args, ctx) => {
      if (ctx.clear) {
        ctx.clear();
      }
      return {
        status: "success",
        success: true,
        riskLevel: "DESTRUCTIVE",
        message: "Workspace cleared.",
        executionClass: "LOCAL",
        commandName: "clear",
        actions: [],
      };
    },
  },
  {
    name: "code",
    aliases: [],
    category: "OUTPUT",
    executionClass: "LOCAL",
    description: "Opens code implementation view in the Inspector",
    syntax: "/code [show|hide|java|python|typescript]",
    examples: ["/code", "/code python", "/code java"],
    example: "/code",
    execute: (args, ctx) => {
      if (ctx.openInspectorTab) {
        ctx.openInspectorTab("code");
      }
      const lang = args.stringArgs[0] || "typescript";
      return {
        status: "success",
        success: true,
        message: `Opened code context in Inspector (${lang}).`,
        executionClass: "LOCAL",
        commandName: "code",
        uiAction: { type: "SHOW_CODE", payload: lang },
        actions: [],
      };
    },
  },

  // --------------------------------------------------------------------------
  // 8. POWER & DEVELOPER COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "make",
    aliases: [],
    category: "POWER",
    executionClass: "SEMANTIC",
    description: "Generic friendly creation routing alias",
    syntax: "/make <structure> <args>",
    examples: ["/make array 10", "/make heap max [10, 20, 30]"],
    example: "/make array 10",
    execute: (args, ctx) => {
      const sub = args.subcommand || "array";
      const targetCmd = findCommand(sub);
      if (targetCmd) {
        return targetCmd.execute(args, ctx);
      }
      throw new Error(`Unknown structure to make: '${sub}'.`);
    },
  },
  {
    name: "seed",
    aliases: [],
    category: "POWER",
    executionClass: "SEMANTIC",
    description:
      "Generates deterministic pseudo-random initial structure for testing",
    syntax: "/seed <structure> <count>",
    examples: ["/seed array 20", "/seed heap 15"],
    example: "/seed array 20",
    execute: (args, ctx) => {
      const struct = args.stringArgs[0] || "array";
      const count = args.numericArgs[0] || 10;
      // Generate reproducible pseudo-random values
      const vals = Array.from(
        { length: count },
        (_, i) => ((i * 37 + 13) % 97) + 1,
      );
      const targetCmd = findCommand(struct);
      if (targetCmd) {
        return targetCmd.execute(
          {
            ...args,
            numericArgs: vals,
            arrayValues: vals,
            isSizeOnly: false,
          },
          ctx,
        );
      }
      throw new Error(`Unknown structure to seed: '${struct}'.`);
    },
  },
  {
    name: "verify",
    aliases: ["audit"],
    category: "POWER",
    executionClass: "DEVELOPER",
    description:
      "Audits semantic invariants, entity conservation, and scene health",
    syntax: "/verify",
    examples: ["/verify"],
    example: "/verify",
    isDeveloperOnly: true,
    execute: (_args, ctx) => SemanticCommandRunner.executeVerify(ctx),
  },
  {
    name: "stress",
    aliases: [],
    category: "POWER",
    executionClass: "DEVELOPER",
    description:
      "Generates large deterministic benchmark structures for stress-testing",
    syntax: "/stress <structure> <count>",
    examples: ["/stress array 100", "/stress heap 50"],
    example: "/stress array 100",
    isDeveloperOnly: true,
    execute: (args, ctx) => {
      const struct = args.stringArgs[0] || "array";
      const count = Math.min(Math.max(args.numericArgs[0] || 50, 10), 100);
      const vals = Array.from({ length: count }, (_, i) => i + 1);
      const targetCmd = findCommand(struct);
      if (targetCmd) {
        return targetCmd.execute(
          {
            ...args,
            numericArgs: vals,
            arrayValues: vals,
            isSizeOnly: false,
          },
          ctx,
        );
      }
      throw new Error(`Cannot stress test unknown structure: '${struct}'.`);
    },
  },

  // --------------------------------------------------------------------------
  // 9. SYSTEM COMMANDS
  // --------------------------------------------------------------------------
  {
    name: "help",
    aliases: ["?"],
    category: "SYSTEM",
    executionClass: "LOCAL",
    description: "Shows documentation and syntax for commands",
    syntax: "/help [commandName]",
    examples: ["/help", "/help heap", "/help teach", "/help focus"],
    example: "/help",
    execute: (args) => {
      const targetName = args.stringArgs[0];
      const text = getHelpText(targetName);
      return {
        status: "info",
        success: true,
        message: text,
        executionClass: "LOCAL",
        commandName: "help",
        uiAction: { type: "SHOW_HELP", payload: text },
        actions: [],
      };
    },
  },
  {
    name: "commands",
    aliases: ["palette"],
    category: "SYSTEM",
    executionClass: "LOCAL",
    description: "Opens the Cognora Liquid Glass command palette",
    syntax: "/commands",
    examples: ["/commands"],
    example: "/commands",
    execute: (_args, ctx) => {
      if (ctx.togglePalette) {
        ctx.togglePalette(true);
      }
      return {
        status: "success",
        success: true,
        message: "Opened command palette.",
        executionClass: "LOCAL",
        commandName: "commands",
        uiAction: { type: "OPEN_PALETTE" },
        actions: [],
      };
    },
  },
];

// ============================================================================
// REGISTRY ACCESSORS & DISCOVERY
// ============================================================================

/**
 * Finds a command definition matching name or alias.
 */
export function findCommand(
  nameOrAlias: string,
): CommandDefinition | undefined {
  if (!nameOrAlias) {
    return undefined;
  }
  const norm = nameOrAlias
    .toLowerCase()
    .replace(/^\//, "")
    .trim()
    .split(/\s+/)[0];
  return BUILTIN_COMMANDS.find(
    (cmd) => cmd.name === norm || cmd.aliases.includes(norm),
  );
}

/**
 * Returns all registered command definitions.
 */
export function getAllCommands(): readonly CommandDefinition[] {
  return BUILTIN_COMMANDS;
}

/**
 * Returns commands belonging to a specific category.
 */
export function getCommandsByCategory(
  category: CommandCategory,
): CommandDefinition[] {
  return BUILTIN_COMMANDS.filter((cmd) => cmd.category === category);
}

/**
 * Derives context-aware command recommendations based on active canvas structure.
 */
export function getContextualSuggestions(
  context: CommandContext,
): AutocompleteSuggestion[] {
  const structure = SemanticCommandRunner.resolveTargetStructure(
    {
      rawInput: "",
      commandName: "",
      args: [],
      numericArgs: [],
      stringArgs: [],
      flags: new Set(),
      options: {},
    },
    context,
  );

  const suggestions: AutocompleteSuggestion[] = [];

  if (!structure) {
    // Empty canvas: suggest core structure creation
    const emptyDefaults = ["array", "linked-list", "heap", "tree", "graph"];
    for (const name of emptyDefaults) {
      const def = findCommand(name);
      if (def) {
        suggestions.push({
          name: def.name,
          aliases: def.aliases,
          syntax: def.syntax,
          description: def.description,
          example: def.example || def.examples[0],
          category: def.category,
          executionClass: def.executionClass,
          isContextual: true,
        });
      }
    }
    return suggestions;
  }

  const type = structure.type.toLowerCase();

  let contextNames: string[] = [];
  if (type.includes("heap")) {
    contextNames = [
      "insert",
      "delete",
      "peek",
      "pop",
      "teach",
      "why",
      "focus",
      "inspect",
    ];
  } else if (type.includes("list")) {
    contextNames = [
      "insert",
      "delete",
      "reverse",
      "connect",
      "disconnect",
      "teach",
      "trace",
    ];
  } else if (
    type.includes("tree") ||
    type.includes("bst") ||
    type.includes("avl")
  ) {
    contextNames = [
      "insert",
      "delete",
      "rotate",
      "balance",
      "teach",
      "why",
      "focus",
    ];
  } else if (type.includes("graph")) {
    contextNames = [
      "connect",
      "disconnect",
      "edge",
      "traverse",
      "run",
      "teach",
    ];
  } else if (type.includes("stack")) {
    contextNames = ["push", "pop", "peek", "teach", "why"];
  } else if (type.includes("queue")) {
    contextNames = ["enqueue", "dequeue", "peek", "teach", "why"];
  } else {
    contextNames = [
      "sort",
      "search",
      "insert",
      "delete",
      "reverse",
      "teach",
      "why",
    ];
  }

  for (const name of contextNames) {
    const def = findCommand(name);
    if (def) {
      suggestions.push({
        name: def.name,
        aliases: def.aliases,
        syntax: def.syntax,
        description: def.description,
        example: def.example || def.examples[0],
        category: def.category,
        executionClass: def.executionClass,
        isContextual: true,
      });
    }
  }

  return suggestions;
}

/**
 * Returns autocomplete suggestions matching a partial slash input.
 */
export function getAutocompleteSuggestions(
  partial: string,
  context?: CommandContext,
): AutocompleteSuggestion[] {
  const clean = partial.startsWith("/")
    ? partial.slice(1).toLowerCase().trim()
    : partial.toLowerCase().trim();

  // If user just typed "/", prioritize contextual recommendations
  if (!clean && context) {
    const contextual = getContextualSuggestions(context);
    if (contextual.length > 0) {
      return contextual;
    }
  }

  const matches = BUILTIN_COMMANDS.filter((cmd) => {
    // Hide developer commands unless developer mode is explicitly enabled
    if (cmd.isDeveloperOnly && !context?.isDeveloperMode) {
      return false;
    }
    if (!clean) {
      return true;
    }
    if (cmd.name.startsWith(clean)) {
      return true;
    }
    if (cmd.aliases.some((a) => a.startsWith(clean))) {
      return true;
    }
    // Fuzzy matching for 3+ letters
    if (clean.length >= 3 && cmd.name.includes(clean)) {
      return true;
    }
    return false;
  });

  return matches.map((cmd) => ({
    name: cmd.name,
    aliases: cmd.aliases,
    syntax: cmd.syntax,
    description: cmd.description,
    example: cmd.example || cmd.examples[0],
    category: cmd.category,
    executionClass: cmd.executionClass,
  }));
}

/**
 * Dynamically formats documentation and syntax help directly from the registry.
 */
export function getHelpText(cmdName?: string): string {
  if (cmdName) {
    const def = findCommand(cmdName);
    if (!def) {
      return `Unknown command '/${cmdName}'. Type /commands to explore all available commands.`;
    }
    return `${
      `/${def.name} — ${def.description}\n` +
      `Category: ${def.category} (${def.executionClass})\n` +
      `Syntax: ${def.syntax}\n`
    }${
      def.aliases.length > 0
        ? `Aliases: ${def.aliases.map((a) => `/${a}`).join(", ")}\n`
        : ""
    }Examples:\n${def.examples.map((ex) => `  ${ex}`).join("\n")}`;
  }

  const lines: string[] = [
    "Cognora Universal Command System",
    "Type '/' to open the command palette or run any command directly.",
    "",
    "Primary Categories:",
    "  CREATE:    /array, /linked-list, /stack, /queue, /tree, /bst, /avl, /heap, /graph, /table",
    "  TRANSFORM: /insert, /delete, /push, /pop, /enqueue, /dequeue, /connect, /disconnect, /edge, /rotate",
    "  RUN:       /sort [quick|merge], /search [binary|linear], /traverse [bfs|dfs], /run",
    "  LEARN:     /teach, /why, /trace, /explain, /see, /diff",
    "  VIEW:      /focus, /follow, /fit, /align, /clean",
    "  PLAYBACK:  /next, /previous, /step, /play, /pause, /replay",
    "  SESSION:   /undo, /redo, /reset, /clear, /code",
    "",
    "Type '/help <command>' for specific syntax and examples.",
  ];

  return lines.join("\n");
}

/**
 * Resolves the risk level for a command name or alias.
 */
export function getCommandRiskLevel(commandName: string): CommandRiskLevel {
  const name = commandName
    .toLowerCase()
    .replace(/^\//, "")
    .trim()
    .split(/\s+/)[0];
  const def = findCommand(name);
  if (def?.riskLevel) {
    return def.riskLevel;
  }
  if (name === "clear" || name === "reset") {
    return "DESTRUCTIVE";
  }
  if (
    [
      "insert",
      "add",
      "delete",
      "remove",
      "swap",
      "connect",
      "disconnect",
      "update",
      "reverse",
      "rotate",
      "push",
      "pop",
      "enqueue",
      "dequeue",
      "array",
      "linked-list",
      "stack",
      "queue",
      "tree",
      "heap",
      "graph",
      "matrix",
    ].includes(name)
  ) {
    return "MODIFY";
  }
  return "SAFE";
}

/**
 * Resolves the confirmation policy for a command name or alias.
 */
export function getCommandConfirmationPolicy(
  commandName: string,
): CommandConfirmationPolicy {
  const name = commandName
    .toLowerCase()
    .replace(/^\//, "")
    .trim()
    .split(/\s+/)[0];
  const def = findCommand(name);
  if (def?.confirmationPolicy) {
    return def.confirmationPolicy;
  }
  const risk = getCommandRiskLevel(name);
  if (risk === "DESTRUCTIVE") {
    return "ALWAYS";
  }
  if (risk === "MODIFY") {
    return "IF_AMBIGUOUS";
  }
  return "NEVER";
}
