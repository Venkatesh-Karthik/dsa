/**
 * Cognora Multimodal Intent Engine
 *
 * Unifies all user input channels (Voice transcripts, Keyboard, Pen, Slash Commands, UI actions)
 * into a single deterministic classification engine.
 *
 * Priority:
 * 1. Immediate Interruption ("Wait", "Stop", "Hold on")
 * 2. Playback / View navigation ("Next", "Back", "Slower", "Replay")
 * 3. What-If Branching ("What if target is 70?", "Try 40 instead")
 * 4. Pedagogical Strategy Inquiries ("Why did it rotate?", "I don't understand", "Simplify")
 * 5. Direct Commands & Semantic Actions
 * 6. Conceptual Teaching / Nemotron 3 Ultra Requests
 */

import {
  type InputIntent,
  type InputSource,
  createInputIntent,
} from "./input-intent";
import { parseNaturalLanguageToCommand } from "../intent-router";
import { getCommandRiskLevel } from "../commands/command-registry";
import type { CognoraWorldState } from "./cognora-world-model";

export class IntentEngine {
  /**
   * Resolves raw user input from any source into a unified InputIntent
   */
  public static resolveIntent(
    rawInput: string,
    source: InputSource = "keyboard",
    worldState?: Readonly<CognoraWorldState>,
  ): InputIntent {
    const trimmed = rawInput.trim();
    const lower = trimmed.toLowerCase();

    // 1. Interruption triggers (Highest Priority)
    if (
      /^(?:wait|hold\s+on|stop|pause|freeze|give\s+me\s+a\s+sec(?:ond)?)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "INTERRUPT",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { action: "pause_and_listen" },
      });
    }

    // 2. What-If Branch Exit triggers
    if (
      worldState?.activeBranch &&
      /^(?:go\s+back|back|return|return\s+to\s+lesson|exit\s+branch|back\s+to\s+main|cancel\s+what\s*if)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "BRANCH_EXIT",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { branchId: worldState.activeBranch.branchId },
      });
    }

    // 3. Pacing Controls
    if (
      /^(?:slow\s+down|go\s+slower|slower|too\s+fast|reduce\s+speed)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "PACE_CONTROL",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { pace: "slower" },
      });
    }
    if (
      /^(?:speed\s+up|go\s+faster|faster|too\s+slow|increase\s+speed)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "PACE_CONTROL",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { pace: "faster" },
      });
    }

    // 4. Playback Navigation Controls
    if (
      /^(?:next|next\s+step|go\s+to\s+next\s+step|forward|advance|continue|resume|play)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "PLAYBACK_CONTROL",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { action: "next" },
      });
    }

    if (
      /^(?:previous|previous\s+step|go\s+back|step\s+back|back|actually\s+go\s+back)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "PLAYBACK_CONTROL",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { action: "previous" },
      });
    }

    if (
      /^(?:replay|replay\s+lesson|show\s+again|show\s+me\s+again|repeat\s+that|restart|start\s+over)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "PLAYBACK_CONTROL",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { action: "replay" },
      });
    }

    // 5. Adaptive Strategy Requests ("I don't understand", "Simplify")
    if (
      /^(?:i\s+don'?t\s+understand|i'?m\s+confused|explain\s+simpler|simplify|make\s+it\s+simpler|explain\s+like\s+i'?m\s+(?:5|new|a\s+beginner)|too\s+complicated|too\s+complex)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "QUESTION_SIMPLIFY",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { strategy: "SIMPLIFY" },
      });
    }

    if (
      /^(?:go\s+deeper|explain\s+in\s+detail|elaborate|technical\s+reason|give\s+me\s+the\s+proof|tell\s+me\s+more)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "QUESTION_ELABORATE",
        confidence: 1.0,
        riskLevel: "SAFE",
        parameters: { strategy: "ELABORATE" },
      });
    }

    // 6. Focus & Inspection Inquiries ("Show me the node", "Look at B")
    const focusMatch = lower.match(
      /^(?:focus(?:\s+on)?|look\s+at|show\s+me|inspect)\s+(?:the\s+)?(?:node\s+)?([a-zA-Z0-9_-]+)$/i,
    );
    if (focusMatch) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "QUESTION_FOCUS",
        target: focusMatch[1],
        confidence: 0.95,
        riskLevel: "SAFE",
        parameters: { target: focusMatch[1] },
      });
    }

    if (
      /^(?:show\s+me\s+the\s+node|which\s+node|where\s+is\s+it|show\s+me\s+what\s+you'?re\s+talking\s+about)$/i.test(
        lower,
      )
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "QUESTION_FOCUS",
        confidence: 0.9,
        riskLevel: "SAFE",
        parameters: { useCurrentFocus: true },
      });
    }

    // 7. Counterfactual "What If" Branching Questions
    if (
      /^(?:what\s+if|suppose|try\s+with|what\s+happens\s+if)\s+/i.test(lower) ||
      /^try\s+(\d+|[a-zA-Z0-9_-]+)\s+instead/i.test(lower)
    ) {
      // Extract candidate number or entity from the query
      const numMatch = lower.match(/(\d+)/);
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "QUESTION_WHAT_IF",
        confidence: 0.95,
        riskLevel: "SAFE",
        parameters: {
          hypotheticalValue: numMatch ? parseInt(numMatch[1], 10) : undefined,
          fullHypothesis: trimmed,
        },
      });
    }

    // 8. "Why" Causal Questions
    if (
      /^why(?:\s+did|\s+is|\s+are|\s+does|\s+do)?\b/i.test(lower) ||
      lower === "why?"
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "QUESTION_WHY",
        confidence: 0.95,
        riskLevel: "SAFE",
        parameters: { strategy: "WHY" },
      });
    }

    // 9. "How" Procedural Questions
    if (/^how(?:\s+did|\s+is|\s+are|\s+does|\s+do)?\b/i.test(lower)) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "QUESTION_HOW",
        confidence: 0.9,
        riskLevel: "SAFE",
        parameters: { strategy: "TRACE" },
      });
    }

    // 10. Direct Slash Commands
    if (trimmed.startsWith("/")) {
      const riskLevel = getCommandRiskLevel(trimmed);
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "COMMAND",
        resolvedCommand: trimmed,
        confidence: 1.0,
        riskLevel,
      });
    }

    // 11. Deterministic Natural Language Commands (/insert, /delete, /zoom, /fit)
    const naturalCmd = parseNaturalLanguageToCommand(trimmed);
    if (naturalCmd) {
      const riskLevel = getCommandRiskLevel(naturalCmd);
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "COMMAND",
        resolvedCommand: naturalCmd,
        confidence: 1.0,
        riskLevel,
      });
    }

    // 12. Check for New Lesson / Educational Request
    if (
      /^(?:explain|teach|visualize|demonstrate|show|simulate|derive|solve)\b/i.test(
        lower,
      ) &&
      !worldState?.lesson // If no lesson is currently active
    ) {
      return createInputIntent({
        source,
        rawInput: trimmed,
        intentType: "NEW_LESSON_REQUEST",
        confidence: 0.9,
        riskLevel: "SAFE",
      });
    }

    // Default to General Pedagogical Inquiry within the current lesson context
    return createInputIntent({
      source,
      rawInput: trimmed,
      intentType: "GENERAL_EXPLANATION",
      confidence: 0.85,
      riskLevel: "SAFE",
    });
  }
}
