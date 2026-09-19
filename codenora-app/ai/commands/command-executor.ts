/**
 * Cognora DSA Command System - Executor
 *
 * Deterministically parses, positions, validates, and executes
 * universal commands across LOCAL, SEMANTIC, TEACHING, and DEVELOPER classes.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { CognoraDiagnostics } from "../transformation-diagnostics";

import { parseCommand, parseUniversalCommand } from "./command-parser";
import { findCommand, getHelpText } from "./command-registry";

import type {
  CommandExecutionResult,
  CommandExecutionContext,
  CommandContext,
  CommandResult,
} from "./command-types";

let globalCommandCounter = 0;

export interface CommandHistoryEntry {
  rawInput: string;
  timestamp: number;
  result: CommandResult;
}

const commandHistory: CommandHistoryEntry[] = [];

/**
 * Returns recorded history of executed universal commands.
 */
export function getCommandHistory(): readonly CommandHistoryEntry[] {
  return commandHistory;
}

/**
 * Clears recorded command history.
 */
export function clearCommandHistory(): void {
  commandHistory.length = 0;
}

/**
 * Computes non-overlapping canvas placement based on current active elements.
 */
export function computeCanvasPlacement(
  sceneElements: readonly ExcalidrawElement[],
): { x: number; y: number } {
  const activeElements = sceneElements.filter((el) => !el.isDeleted);
  if (activeElements.length === 0) {
    return { x: 100, y: 100 };
  }

  let maxY = -Infinity;
  let minX = Infinity;

  for (const el of activeElements) {
    const bottom = el.y + el.height;
    if (bottom > maxY) {
      maxY = bottom;
    }
    if (el.x < minX) {
      minX = el.x;
    }
  }

  if (maxY === -Infinity || minX === Infinity) {
    return { x: 100, y: 100 };
  }

  return {
    x: Math.max(minX, 100),
    y: Math.round(maxY + 80),
  };
}

/**
 * Executes a universal slash command with full validation, execution class routing,
 * history tracking, and structured result payload.
 */
export async function executeUniversalCommand(
  rawInput: string,
  context: CommandContext,
): Promise<CommandResult> {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) {
    return {
      status: "error",
      success: false,
      executionClass: "LOCAL",
      commandName: "",
      message: "",
      error: "Command must start with '/' (e.g. /array 10, /heap max, /help).",
      actions: [],
    };
  }

  try {
    const parsed = parseUniversalCommand(trimmed);
    const def = findCommand(parsed.commandName);

    if (!def) {
      const errRes: CommandResult = {
        status: "error",
        success: false,
        executionClass: "LOCAL",
        commandName: parsed.commandName,
        message: "",
        error: `Unknown command '/${parsed.commandName}'. Type /help to see all available commands.`,
        actions: [],
      };
      commandHistory.push({
        rawInput: trimmed,
        timestamp: Date.now(),
        result: errRes,
      });
      return errRes;
    }

    // Developer mode isolation
    if (def.isDeveloperOnly && !context.isDeveloperMode) {
      const devRes: CommandResult = {
        status: "error",
        success: false,
        executionClass: "DEVELOPER",
        commandName: def.name,
        message: "",
        error: `Developer command '/${def.name}' is only available in developer mode.`,
        actions: [],
      };
      commandHistory.push({
        rawInput: trimmed,
        timestamp: Date.now(),
        result: devRes,
      });
      return devRes;
    }

    // Context availability check
    if (def.availability && !def.availability(context)) {
      const unavailRes: CommandResult = {
        status: "error",
        success: false,
        executionClass: def.executionClass,
        commandName: def.name,
        message: "",
        error: `Command '/${def.name}' is not currently available for this canvas state.`,
        actions: [],
      };
      commandHistory.push({
        rawInput: trimmed,
        timestamp: Date.now(),
        result: unavailRes,
      });
      return unavailRes;
    }

    // Argument validation
    if (def.validate) {
      const validation = def.validate(parsed);
      if (!validation.valid) {
        const valRes: CommandResult = {
          status: "error",
          success: false,
          executionClass: def.executionClass,
          commandName: def.name,
          message: "",
          error:
            validation.error ||
            `Invalid syntax for '/${def.name}'. Correct: ${def.syntax}`,
          actions: [],
        };
        commandHistory.push({
          rawInput: trimmed,
          timestamp: Date.now(),
          result: valRes,
        });
        return valRes;
      }
    }

    // Direct registry execution
    const execResult = await def.execute(parsed, context);

    // Fallback action generation if needed
    if (
      (!execResult.actions || execResult.actions.length === 0) &&
      def.generateActions &&
      !execResult.lesson
    ) {
      const origin =
        context.origin || computeCanvasPlacement(context.sceneElements);
      const timestamp = Date.now().toString(36).slice(-4);
      const execContext: CommandExecutionContext = {
        origin,
        nextId: (prefix: string) => {
          globalCommandCounter++;
          return `${prefix}_${timestamp}_${globalCommandCounter}`;
        },
        existingElements: context.sceneElements,
      };
      execResult.actions = def.generateActions(parsed, execContext);
    }

    const finalResult: CommandResult = {
      ...execResult,
      commandName: def.name,
      executionClass: def.executionClass,
      success: execResult.success ?? execResult.status !== "error",
      actions: execResult.actions || [],
    };

    commandHistory.push({
      rawInput: trimmed,
      timestamp: Date.now(),
      result: finalResult,
    });
    return finalResult;
  } catch (err: unknown) {
    CognoraDiagnostics.error("COMMAND", "Execution failed", undefined, err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const failRes: CommandResult = {
      status: "error",
      success: false,
      executionClass: "LOCAL",
      commandName: "",
      message: "",
      error: errorMessage,
      actions: [],
    };
    commandHistory.push({
      rawInput: trimmed,
      timestamp: Date.now(),
      result: failRes,
    });
    return failRes;
  }
}

/**
 * Backward-compatible synchronous command execution against Excalidraw scene elements.
 */
export function executeCommand(
  rawInput: string,
  sceneElements: readonly ExcalidrawElement[] = [],
): CommandExecutionResult {
  try {
    const args = parseCommand(rawInput);
    const def = findCommand(args.commandName);

    if (!def) {
      return {
        status: "error",
        success: false,
        executionClass: "LOCAL",
        commandName: args.commandName,
        actions: [],
        message: "",
        error: `Unknown command '/${args.commandName}'. Try /array, /linked-list, /stack, /queue, /tree, /heap, /graph, or /table.`,
      };
    }

    const origin = computeCanvasPlacement(sceneElements);
    const timestamp = Date.now().toString(36).slice(-4);

    const context: CommandExecutionContext = {
      origin,
      nextId: (prefix: string) => {
        globalCommandCounter++;
        return `${prefix}_${timestamp}_${globalCommandCounter}`;
      },
      existingElements: sceneElements,
    };

    let actions: any[] = [];
    if (def.generateActions) {
      actions = def.generateActions(args, context);
    }

    const message = def.formatSuccessMessage
      ? def.formatSuccessMessage(args, actions.length)
      : `Executed /${def.name}`;

    return {
      status: "success",
      success: true,
      executionClass: def.executionClass,
      actions,
      message,
      commandName: def.name,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      success: false,
      executionClass: "LOCAL",
      commandName: "",
      actions: [],
      message: "",
      error: errorMessage,
    };
  }
}
