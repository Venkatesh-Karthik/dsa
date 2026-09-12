/**
 * Cognora DSA Command System - Executor
 *
 * Deterministically parses, positions, and generates Visual DSL actions.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { parseCommand } from "./command-parser";
import { findCommand } from "./command-registry";

import type {
  CommandExecutionResult,
  CommandExecutionContext,
} from "./command-types";

let globalCommandCounter = 0;

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
 * Executes a deterministic slash command against the canvas.
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
        success: false,
        actions: [],
        message: "",
        error: `Unknown command '/${args.commandName}'. Try /array, /linked-list, /stack, /queue, /binary-tree, /heap, /graph, or /matrix.`,
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

    const actions = def.generateActions(args, context);
    const message = def.formatSuccessMessage(args, actions.length);

    return {
      success: true,
      actions,
      message,
      commandName: def.name,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      actions: [],
      message: "",
      error: errorMessage,
    };
  }
}
