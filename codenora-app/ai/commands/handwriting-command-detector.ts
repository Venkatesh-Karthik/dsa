/**
 * Cognora Handwriting Command Detector
 *
 * Analyzes freehand strokes and handwritten canvas elements to detect command candidates:
 * - Spatial clustering of freehand strokes and text
 * - High / Medium / Low confidence scoring
 * - Context isolation: ignores notes, code blocks, and visual explanations
 * - Triggers compact Liquid Glass Command Preview before execution
 */

import { parseNaturalLanguageToCommand } from "../intent-router";

import { findCommand, getAllCommands } from "./command-registry";

export interface HandwritingCommandCandidate {
  rawText: string;
  commandName: string;
  normalizedCommand: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  didYouMean?: string;
  elementIds: string[];
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Levenshtein distance for fuzzy matching typos like /arry(10) -> /array(10)
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Checks whether an element is an isolated note, code snippet, or UI artifact
 * that must never be interpreted as a command.
 */
function isIgnoredContextElement(el: any): boolean {
  if (!el || el.isDeleted) {
    return true;
  }
  if (el.customData?.isAiTeaching) {
    return true;
  }
  if (el.customData?.role === "explanation" || el.customData?.role === "code") {
    return true;
  }
  if (el.type === "embeddable") {
    return true;
  }

  // Text inside code blocks or explicit sticky notes
  const text = (el.text || "").trim();
  if (
    text.startsWith("```") ||
    text.startsWith("//") ||
    text.startsWith("/*")
  ) {
    return true;
  }
  return false;
}

/**
 * Scans active canvas elements to detect handwritten or drawn commands.
 */
export function detectHandwritingCommand(
  elements: readonly any[],
): HandwritingCommandCandidate | null {
  const candidates: HandwritingCommandCandidate[] = [];

  // 1. Scan text elements created by user handwriting or typing on canvas
  const activeElements = elements.filter((el) => !isIgnoredContextElement(el));
  const textElements = activeElements.filter(
    (el) => el.type === "text" && el.text,
  );

  for (const textEl of textElements) {
    const raw = (textEl.text || "").trim();
    if (!raw) {
      continue;
    }

    // Check if it's a direct slash candidate or natural language command
    if (raw.startsWith("/")) {
      const match = raw.match(/^\/([a-zA-Z0-9_-]+)(.*)$/);
      if (match) {
        const cmdName = match[1].toLowerCase();
        const def = findCommand(cmdName);

        if (def) {
          // Exact valid command candidate
          candidates.push({
            rawText: raw,
            commandName: def.name,
            normalizedCommand: `/${def.name}${match[2] || ""}`.trim(),
            confidence: "HIGH",
            score: 1.0,
            elementIds: [textEl.id],
            bounds: {
              x: textEl.x,
              y: textEl.y,
              width: textEl.width,
              height: textEl.height,
            },
          });
        } else {
          // Fuzzy match against known commands
          const allDefs = getAllCommands();
          let bestDist = Infinity;
          let bestMatch = "";

          for (const d of allDefs) {
            const dist = levenshteinDistance(cmdName, d.name.toLowerCase());
            if (dist < bestDist) {
              bestDist = dist;
              bestMatch = d.name;
            }
          }

          if (bestDist <= 2 && bestMatch) {
            candidates.push({
              rawText: raw,
              commandName: bestMatch,
              normalizedCommand: `/${bestMatch}${match[2] || ""}`.trim(),
              confidence: "MEDIUM",
              score: 0.75,
              didYouMean: `/${bestMatch}${match[2] || ""}`.trim(),
              elementIds: [textEl.id],
              bounds: {
                x: textEl.x,
                y: textEl.y,
                width: textEl.width,
                height: textEl.height,
              },
            });
          }
        }
      }
    } else {
      // Natural language candidate: e.g. "Create an array of 10" written on canvas
      const nlCmd = parseNaturalLanguageToCommand(raw);
      if (nlCmd) {
        const match = nlCmd.match(/^\/([a-zA-Z0-9_-]+)/);
        const name = match ? match[1] : "command";
        candidates.push({
          rawText: raw,
          commandName: name,
          normalizedCommand: nlCmd,
          confidence: "HIGH",
          score: 0.9,
          elementIds: [textEl.id],
          bounds: {
            x: textEl.x,
            y: textEl.y,
            width: textEl.width,
            height: textEl.height,
          },
        });
      }
    }
  }

  // Return highest confidence candidate
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}
