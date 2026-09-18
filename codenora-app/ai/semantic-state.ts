/**
 * Semantic State Engine
 *
 * Tracks, accumulates, and reconstructs cumulative visual whiteboard state
 * across multi-step teaching lessons.
 *
 * Key Guarantees:
 * 1. Cumulative Consistency: Steps build upon the visual state of previous steps
 *    without requiring the LLM to re-emit identical boilerplate.
 * 2. Idempotency & Deduplication: Prevents duplicate elements, duplicate arrows,
 *    and duplicate pointers with identical IDs or connection endpoints.
 * 3. Non-destructive Mutations: Handles create, move, resize, highlight, delete,
 *    and connect operations cleanly.
 * 4. Dependency Ordering: Always emits actions in valid dependency order
 *    (created objects before pointers, arrows, or highlights referencing them).
 */

import { repairOrReorderActions } from "./backend/dsl-validator";
import {
  computeSemanticDiff,
  type SemanticTransitionDiff,
} from "./diff-engine";

import type {
  VisualAction,
  TeachingStep,
  CreateArrayAction,
  CreateTreeAction,
  CreateGraphAction,
  CreateLinkedListAction,
  CreateStackAction,
  CreateMatrixAction,
  CreateArrowAction,
  AnnotatePointerAction,
  HighlightAction,
} from "./visual-dsl";

export interface StepCumulativeState {
  stepIndex: number;
  stepId: string;
  title: string;
  explanation: string;
  calculations?: string;
  insight?: string;
  cumulativeActions: VisualAction[];
  diffFromPrevious?: SemanticTransitionDiff;
}

export class SemanticStateManager {
  private activeObjects: Map<string, VisualAction> = new Map();

  /**
   * Resets internal object registry
   */
  clear(): void {
    this.activeObjects.clear();
  }

  /**
   * Clones current active object map
   */
  private cloneObjects(): Map<string, VisualAction> {
    const cloned = new Map<string, VisualAction>();
    for (const [id, action] of this.activeObjects.entries()) {
      cloned.set(id, JSON.parse(JSON.stringify(action)) as VisualAction);
    }
    return cloned;
  }

  /**
   * Processes all teaching steps in sequence and returns the cumulative state for each step.
   */
  processSteps(steps: TeachingStep[]): StepCumulativeState[] {
    this.clear();
    const result: StepCumulativeState[] = [];
    let previousActions: VisualAction[] = [];

    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];
      const stepHighlights: HighlightAction[] = [];

      // Process actions in this step
      for (const action of step.visual_actions) {
        this.applyAction(action, stepHighlights);
      }

      // Collect all active objects + this step's highlights
      const rawCumulative: VisualAction[] = [
        ...Array.from(this.activeObjects.values()),
        ...stepHighlights,
      ];

      // Ensure valid topological dependency order
      const orderedCumulative = repairOrReorderActions(rawCumulative);

      const diff =
        stepIdx > 0
          ? computeSemanticDiff(
              previousActions,
              orderedCumulative,
              stepIdx - 1,
              stepIdx,
            )
          : undefined;

      result.push({
        stepIndex: stepIdx,
        stepId: step.id || `step-${stepIdx}`,
        title: step.title,
        explanation: step.explanation,
        calculations: step.calculations,
        insight: step.insight,
        cumulativeActions: orderedCumulative,
        diffFromPrevious: diff,
      });

      previousActions = orderedCumulative;
    }

    return result;
  }

  /**
   * Applies a single visual action to the active state registry.
   */
  applyAction(action: VisualAction, stepHighlights: HighlightAction[]): void {
    switch (action.type) {
      case "create_array":
      case "create_tree":
      case "create_graph":
      case "create_linked_list":
      case "create_stack":
      case "create_matrix":
      case "create_box":
      case "create_circle":
      case "create_text": {
        // Register or replace object by ID
        this.activeObjects.set(action.id, JSON.parse(JSON.stringify(action)));
        break;
      }

      case "create_divider":
      case "create_explanation_block": {
        // Section-specific elements are handled per step, not carried across steps
        break;
      }

      case "create_arrow": {
        const arrow = action as CreateArrowAction;
        // Check if an arrow with same from/to already exists; if so, replace it
        let existingKey: string | null = null;
        for (const [id, existing] of this.activeObjects.entries()) {
          if (
            existing.type === "create_arrow" &&
            existing.from === arrow.from &&
            existing.to === arrow.to
          ) {
            existingKey = id;
            break;
          }
        }
        if (existingKey) {
          this.activeObjects.delete(existingKey);
        }
        this.activeObjects.set(arrow.id, JSON.parse(JSON.stringify(arrow)));
        break;
      }

      case "annotate_pointer": {
        const ptr = action as AnnotatePointerAction;
        // Deduplicate pointers with same ID or same label+target
        let existingKey: string | null = null;
        for (const [id, existing] of this.activeObjects.entries()) {
          if (
            existing.type === "annotate_pointer" &&
            (existing.id === ptr.id ||
              (existing.label === ptr.label && existing.target === ptr.target))
          ) {
            existingKey = id;
            break;
          }
        }
        if (existingKey) {
          this.activeObjects.delete(existingKey);
        }
        this.activeObjects.set(ptr.id, JSON.parse(JSON.stringify(ptr)));
        break;
      }

      case "delete": {
        const targetId = action.target;
        this.activeObjects.delete(targetId);

        // Also remove any arrows pointing to or from deleted target
        for (const [id, obj] of this.activeObjects.entries()) {
          if (
            obj.type === "create_arrow" &&
            (obj.from === targetId || obj.to === targetId)
          ) {
            this.activeObjects.delete(id);
          } else if (
            obj.type === "annotate_pointer" &&
            obj.target === targetId
          ) {
            this.activeObjects.delete(id);
          }
        }
        break;
      }

      case "move": {
        const targetId = action.target;
        const obj = this.activeObjects.get(targetId);
        if (obj && "position" in obj) {
          (obj as { position?: unknown }).position = action.destination;
        }
        break;
      }

      case "resize": {
        const targetId = action.target;
        const obj = this.activeObjects.get(targetId);
        if (obj && "style" in obj && obj.style) {
          (obj.style as { size?: string }).size = action.size;
        }
        break;
      }

      case "highlight": {
        stepHighlights.push(JSON.parse(JSON.stringify(action)));
        break;
      }
    }
  }

  /**
   * Retrieves the current snapshot of active visual actions.
   */
  getCurrentVisualActions(): VisualAction[] {
    return repairOrReorderActions(Array.from(this.activeObjects.values()));
  }
}
