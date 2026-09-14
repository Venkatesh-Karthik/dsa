/**
 * Cognora DSA Command System - Registry
 *
 * Central registry mapping commands, aliases, and autocomplete suggestions.
 */

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
} from "./command-types";

export const BUILTIN_COMMANDS: CommandDefinition[] = [
  {
    name: "array",
    aliases: ["arr"],
    category: "linear",
    description: "Generates an indexed array with values or size",
    syntax: "/array(10) or /array(1,2,3,4,5)",
    example: "/array(10,20,30,40,50)",
    generateActions: generateArray,
    formatSuccessMessage: (args) =>
      args.isSizeOnly
        ? `Created an array with ${args.numericArgs[0]} elements.`
        : `Created array with ${
            args.numericArgs.length || args.stringArgs.length
          } elements.`,
  },
  {
    name: "linked-list",
    aliases: ["linkedlist", "ll"],
    category: "linear",
    description:
      "Generates a singly-linked list with arrows terminating at NULL",
    syntax: "/linked-list(10,20,30) or /ll(1,2,3)",
    example: "/linked-list(10,20,30,40)",
    generateActions: generateLinkedList,
    formatSuccessMessage: (args) =>
      `Created a linked list with ${
        args.numericArgs.length || args.stringArgs.length
      } nodes terminating at NULL.`,
  },
  {
    name: "stack",
    aliases: [],
    category: "linear",
    description: "Generates a LIFO stack container with elements",
    syntax: "/stack(1,2,3) or /stack(4)",
    example: "/stack(1,2,3,4)",
    generateActions: generateStack,
    formatSuccessMessage: (args) =>
      `Created a stack with ${
        args.numericArgs.length || args.stringArgs.length
      } elements.`,
  },
  {
    name: "queue",
    aliases: [],
    category: "linear",
    description: "Generates a FIFO queue with Front and Back indicators",
    syntax: "/queue(10,20,30)",
    example: "/queue(10,20,30,40)",
    generateActions: generateQueue,
    formatSuccessMessage: (args) =>
      `Created a queue with ${
        args.numericArgs.length || args.stringArgs.length
      } elements.`,
  },
  {
    name: "binary-tree",
    aliases: ["tree", "bst"],
    category: "tree",
    description: "Generates a balanced Binary Search Tree from numeric keys",
    syntax: "/binary-tree(10,5,15) or /bst(10,5,15,3,7)",
    example: "/binary-tree(10,5,15,3,7,12,18)",
    generateActions: generateBinaryTree,
    formatSuccessMessage: (args) =>
      `Created a binary search tree with ${args.numericArgs.length} nodes.`,
  },
  {
    name: "heap",
    aliases: ["minheap", "maxheap"],
    category: "tree",
    description: "Generates a binary heap tree structure from an array",
    syntax: "/heap(10,5,20,3,8,12)",
    example: "/heap(20,15,18,10,12,14,16)",
    generateActions: generateHeap,
    formatSuccessMessage: (args) =>
      `Created a binary heap with ${args.numericArgs.length} elements.`,
  },
  {
    name: "graph",
    aliases: ["dag"],
    category: "graph",
    description: "Generates a graph with directed or undirected weighted edges",
    syntax: "/graph(A-B, B-C, C-A) or /graph(A->B, B->C)",
    example: "/graph(A-B:5, B-C:3, C-D:2, D-A:4)",
    generateActions: generateGraph,
    formatSuccessMessage: (args) =>
      `Created a graph with ${args.graphEdges?.length || 5} edges.`,
  },
  {
    name: "matrix",
    aliases: ["grid"],
    category: "matrix",
    description:
      "Generates a 2D matrix/grid by dimensions or semicolon-separated rows",
    syntax: "/matrix(3,4) or /matrix(1,2,3;4,5,6)",
    example: "/matrix(1,2,3;4,5,6;7,8,9)",
    generateActions: generateMatrix,
    formatSuccessMessage: (args) =>
      args.matrixRows
        ? `Created a ${args.matrixRows.length}×${
            args.matrixRows[0]?.length || 0
          } matrix.`
        : `Created a matrix grid.`,
  },
];

/**
 * Finds a command definition matching name or alias.
 */
export function findCommand(
  nameOrAlias: string,
): CommandDefinition | undefined {
  const norm = nameOrAlias.toLowerCase().trim();
  return BUILTIN_COMMANDS.find(
    (cmd) => cmd.name === norm || cmd.aliases.includes(norm),
  );
}

/**
 * Returns all autocomplete suggestions matching a partial slash input.
 */
export function getAutocompleteSuggestions(
  partial: string,
): AutocompleteSuggestion[] {
  const clean = partial.startsWith("/")
    ? partial.slice(1).toLowerCase()
    : partial.toLowerCase();

  return BUILTIN_COMMANDS.filter((cmd) => {
    if (!clean) {
      return true;
    }
    if (cmd.name.startsWith(clean)) {
      return true;
    }
    if (cmd.aliases.some((a) => a.startsWith(clean))) {
      return true;
    }
    return false;
  }).map((cmd) => ({
    name: cmd.name,
    syntax: cmd.syntax,
    description: cmd.description,
    example: cmd.example,
    category: cmd.category,
  }));
}
