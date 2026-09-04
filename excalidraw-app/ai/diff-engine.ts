/**
 * Semantic Transition Diff Engine
 *
 * Computes semantic differences between whiteboard teaching states (Step N-1 -> Step N).
 * Allows the teaching system to determine exactly what changed, what was added,
 * what was removed, and what was highlighted between steps.
 */

import type { VisualAction } from "./visual-dsl";

export interface SemanticTransitionDiff {
  stepFrom: number;
  stepTo: number;
  created: string[];
  updated: string[];
  deleted: string[];
  highlighted: string[];
  summary: string;
}

function getActionKey(action: VisualAction): string {
  if ("id" in action && action.id) {
    return action.id;
  }
  if ("target" in action && action.target) {
    return `action-${action.type}-${action.target}`;
  }
  return `anon-${action.type}-${JSON.stringify(action)}`;
}

/**
 * Computes the semantic diff between two sets of VisualActions representing states.
 */
export function computeSemanticDiff(
  beforeActions: VisualAction[],
  afterActions: VisualAction[],
  stepFrom: number = 0,
  stepTo: number = 1,
): SemanticTransitionDiff {
  const beforeMap = new Map<string, VisualAction>();
  for (const a of beforeActions) {
    beforeMap.set(getActionKey(a), a);
  }

  const afterMap = new Map<string, VisualAction>();
  for (const a of afterActions) {
    afterMap.set(getActionKey(a), a);
  }

  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];
  const highlighted: string[] = [];

  // Check for highlights in after actions
  for (const a of afterActions) {
    if (a.type === "highlight") {
      highlighted.push(a.target);
    }
  }

  // Detect created and updated
  for (const [key, afterAction] of afterMap.entries()) {
    const beforeAction = beforeMap.get(key);
    if (!beforeAction) {
      created.push(key);
    } else {
      // Check if deep serialized content changed
      const beforeStr = JSON.stringify(beforeAction);
      const afterStr = JSON.stringify(afterAction);
      if (beforeStr !== afterStr) {
        updated.push(key);
      }
    }
  }

  // Detect deleted
  for (const key of beforeMap.keys()) {
    if (!afterMap.has(key)) {
      deleted.push(key);
    }
  }

  const summaryParts: string[] = [];
  if (created.length > 0) {
    summaryParts.push(`Created: [${created.join(", ")}]`);
  }
  if (updated.length > 0) {
    summaryParts.push(`Updated: [${updated.join(", ")}]`);
  }
  if (deleted.length > 0) {
    summaryParts.push(`Deleted: [${deleted.join(", ")}]`);
  }
  if (highlighted.length > 0) {
    summaryParts.push(`Highlighted: [${highlighted.join(", ")}]`);
  }

  return {
    stepFrom,
    stepTo,
    created,
    updated,
    deleted,
    highlighted,
    summary:
      summaryParts.length > 0
        ? summaryParts.join(" | ")
        : "No visual state changes.",
  };
}
