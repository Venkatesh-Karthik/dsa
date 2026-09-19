/**
 * Cognora Universal Command System - Type Definitions
 *
 * Deterministic command system operating directly on the authoritative semantic world,
 * visual reasoning, layout, and playback systems without invoking LLMs for deterministic tasks.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { VisualAction, VisualLesson } from "../visual-dsl";
import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type { CompiledTimeline } from "../transformation-timeline";
import type { LessonPlaybackController } from "../lesson-playback-controller";

export type CommandExecutionClass =
  | "LOCAL"
  | "SEMANTIC"
  | "TEACHING"
  | "DEVELOPER";

export type CommandCategory =
  | "CREATE"
  | "TRANSFORM"
  | "RUN"
  | "LEARN"
  | "VIEW"
  | "PLAYBACK"
  | "SESSION"
  | "OUTPUT"
  | "POWER"
  | "SYSTEM";

export interface ParsedGraphEdge {
  from: string;
  to: string;
  weight?: number | string;
  directed: boolean;
}

export interface ParsedCommand {
  rawInput: string;
  commandName: string;
  args: (string | number)[];
  numericArgs: number[];
  stringArgs: string[];
  flags: Set<string>;
  options: Record<string, string | number | boolean>;
  isSizeOnly?: boolean;
  matrixRows?: (number | string)[][];
  graphEdges?: ParsedGraphEdge[];
  subcommand?: string;
  target?: string;
  arrayValues?: (number | string)[];
}

// Backward compatibility alias
export type CommandArgs = ParsedCommand;

export interface CommandExecutionContext {
  origin: { x: number; y: number };
  nextId: (prefix: string) => string;
  existingElements: readonly ExcalidrawElement[];
}

export interface ActiveSemanticStructureInfo {
  type: string;
  id: string;
  elements: (number | string)[];
  metadata?: Record<string, unknown>;
}

export interface CommandContext {
  excalidrawAPI?: any;
  sceneElements: readonly ExcalidrawElement[];
  activeModel: AuthoritativeSemanticModel | null;
  timeline: CompiledTimeline | null;
  playbackController: LessonPlaybackController | null;
  currentTransformationIndex: number;
  activeStructure?: ActiveSemanticStructureInfo | null;
  selectedEntities: string[];
  focusedEntityId: string | null;
  history: string[];
  isDeveloperMode: boolean;
  // Execution hooks
  applySemanticLesson?: (
    lesson: VisualLesson,
    topic?: string,
  ) => Promise<void> | void;
  invokeTeaching?: (prompt: string, initialSceneOrOps?: any) => Promise<void>;
  navigatePlayback?: (
    action: "next" | "previous" | "play" | "pause" | "replay" | "step",
    step?: number,
  ) => void;
  setFocus?: (target: string | number) => void;
  undo?: () => void;
  redo?: () => void;
  reset?: () => void;
  clear?: () => void;
  openInspectorTab?: (tab: string) => void;
  togglePalette?: (open?: boolean) => void;
  origin?: { x: number; y: number };
}

export interface CommandUIAction {
  type:
    | "OPEN_PALETTE"
    | "CLOSE_PALETTE"
    | "OPEN_INSPECTOR"
    | "SET_TAB"
    | "FIT_VIEWPORT"
    | "PLAYBACK_CONTROL"
    | "SHOW_HELP"
    | "EXPORT"
    | "DIFF"
    | "DIAGNOSTICS"
    | "SHOW_CODE"
    | "FOCUS_ENTITY"
    | "CLEAR"
    | "RESET";
  payload?: any;
}

export type CommandRiskLevel = "SAFE" | "MODIFY" | "DESTRUCTIVE";
export type CommandConfirmationPolicy =
  | "NEVER"
  | "IF_AMBIGUOUS"
  | "ALWAYS"
  | "HANDWRITTEN_ALWAYS";

export interface CommandResult {
  status: "success" | "error" | "info" | "requires_confirmation";
  message: string;
  executionClass: CommandExecutionClass;
  commandName: string;
  riskLevel?: CommandRiskLevel;
  confirmationRequired?: boolean;
  confirmationPrompt?: string;
  candidateTargets?: Array<{ id: string; label: string; type: string }>;
  semanticChanges?: boolean;
  historyEntry?: string;
  affectedEntities?: string[];
  focus?: { entityId?: string; zoom?: number };
  uiAction?: CommandUIAction;
  error?: string;
  diagnostics?: Record<string, unknown>;
  lesson?: VisualLesson;
  timeline?: CompiledTimeline;
  model?: AuthoritativeSemanticModel;
  // Backward compatibility with legacy CommandExecutionResult
  success: boolean;
  actions: VisualAction[];
}

// Backward compatibility alias
export type CommandExecutionResult = CommandResult;

export interface CommandDefinition {
  name: string;
  aliases: string[];
  category: CommandCategory;
  executionClass: CommandExecutionClass;
  description: string;
  syntax: string;
  examples: string[];
  riskLevel?: CommandRiskLevel;
  confirmationPolicy?: CommandConfirmationPolicy;
  argumentSchema?: Record<string, unknown>;
  targetPolicy?: "SELECTED_OR_ACTIVE" | "EXPLICIT_ONLY" | "NONE";
  semanticEffect?: string;
  isDeveloperOnly?: boolean;
  availability?: (context: CommandContext) => boolean;
  validate?: (args: ParsedCommand) => { valid: boolean; error?: string };
  execute: (
    args: ParsedCommand,
    context: CommandContext,
  ) => Promise<CommandResult> | CommandResult;
  autocomplete?: (partial: string, context: CommandContext) => string[];
  // Backward compatibility methods
  generateActions?: (
    args: CommandArgs,
    context: CommandExecutionContext,
  ) => VisualAction[];
  formatSuccessMessage?: (args: CommandArgs, actionCount: number) => string;
  example?: string;
}

export interface AutocompleteSuggestion {
  name: string;
  aliases?: string[];
  syntax: string;
  description: string;
  example: string;
  category: CommandCategory;
  executionClass?: CommandExecutionClass;
  isContextual?: boolean;
}
