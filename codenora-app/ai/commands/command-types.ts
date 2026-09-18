/**
 * Cognora DSA Command System - Type Definitions
 *
 * Deterministic slash-commands that generate Visual DSL actions without LLM calls.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { VisualAction } from "../visual-dsl";

export interface ParsedGraphEdge {
  from: string;
  to: string;
  weight?: number | string;
  directed: boolean;
}

export interface CommandArgs {
  rawInput: string;
  commandName: string;
  numericArgs: number[];
  stringArgs: string[];
  matrixRows?: (number | string)[][];
  graphEdges?: ParsedGraphEdge[];
  isSizeOnly?: boolean;
}

export interface CommandExecutionContext {
  origin: { x: number; y: number };
  nextId: (prefix: string) => string;
  existingElements: readonly ExcalidrawElement[];
}

export interface CommandDefinition {
  name: string;
  aliases: string[];
  category: "linear" | "tree" | "graph" | "matrix";
  description: string;
  syntax: string;
  example: string;
  generateActions: (
    args: CommandArgs,
    context: CommandExecutionContext,
  ) => VisualAction[];
  formatSuccessMessage: (args: CommandArgs, actionCount: number) => string;
}

export interface CommandExecutionResult {
  success: boolean;
  actions: VisualAction[];
  message: string;
  error?: string;
  commandName?: string;
}

export interface AutocompleteSuggestion {
  name: string;
  syntax: string;
  description: string;
  example: string;
  category: "linear" | "tree" | "graph" | "matrix";
}
