/**
 * Unified Multimodal Input Intent
 *
 * All inputs (Keyboard, Voice, Pen, Commands, UI interactions)
 * converge into this standardized representation before hitting the Intent Engine.
 */

export type InputSource = "keyboard" | "voice" | "pen" | "command" | "ui";

export type InputIntentType =
  | "COMMAND"
  | "INTERRUPT"
  | "PLAYBACK_CONTROL"
  | "PACE_CONTROL"
  | "VIEW_CONTROL"
  | "QUESTION_WHY"
  | "QUESTION_HOW"
  | "QUESTION_WHAT"
  | "QUESTION_WHAT_IF"
  | "QUESTION_SIMPLIFY"
  | "QUESTION_ELABORATE"
  | "QUESTION_REPEAT"
  | "QUESTION_PREDICT"
  | "QUESTION_FOCUS"
  | "BRANCH_EXIT"
  | "MISCONCEPTION_STATEMENT"
  | "NEW_LESSON_REQUEST"
  | "GENERAL_EXPLANATION";

export type InputRiskLevel = "SAFE" | "MODIFY" | "DESTRUCTIVE";

export interface InputIntent {
  id: string;
  source: InputSource;
  rawInput: string;
  intentType: InputIntentType;
  resolvedCommand?: string;
  target?: string;
  entities: string[];
  parameters: Record<string, any>;
  confidence: number;
  riskLevel: InputRiskLevel;
  timestamp: number;
}

export function createInputIntent(
  partial: Partial<InputIntent> & {
    source: InputSource;
    rawInput: string;
    intentType: InputIntentType;
  },
): InputIntent {
  return {
    id: `intent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    entities: [],
    parameters: {},
    confidence: 1.0,
    riskLevel: "SAFE",
    timestamp: Date.now(),
    ...partial,
  };
}
