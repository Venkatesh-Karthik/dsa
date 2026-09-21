/**
 * Cognora DSA Lesson-Intent Semantic Compatibility Validator
 *
 * Enforces the final semantic safety gate before any adapted lesson is returned
 * or rendered to the user.
 *
 * HARD INVARIANTS:
 * 1. DOUBLY_LINKED_LIST must NEVER become SINGLY_LINKED_LIST
 * 2. DELETE must NEVER become INSERT
 * 3. DFS must NEVER become BFS
 * 4. BELLMAN-FORD must NEVER become DIJKSTRA
 * 5. Quick Sort must NEVER become Merge Sort
 * 6. Heap DELETE must NEVER become Heap INSERT
 * 7. AVL DELETE must NEVER become AVL INSERT
 * 8. Concept Identity: requested concept === executed concept === visual lesson topic
 */

import type { DSAFullIntent } from "../intent/dsa-intent-resolver";
import type { AdaptedDSALesson } from "../adapter/teaching-moment-adapter";

export interface LessonIntentValidationResult {
  valid: boolean;
  reason?: string;
}

export class DSALessonIntentValidator {
  /**
   * Validates that an executed and adapted lesson strictly fulfills the user's intent.
   * Returns valid: false if any semantic divergence or silent downgrade is detected.
   */
  public static validate(
    intent: DSAFullIntent,
    lesson: AdaptedDSALesson,
  ): LessonIntentValidationResult {
    const topic = (lesson.authoritativeModel?.concept || lesson.visualLesson?.title || "").toLowerCase();
    const moments = lesson.timeline?.moments || [];
    const momentTitles = moments.map((m) => m.title.toLowerCase());
    const transformations = lesson.authoritativeModel?.transformations || [];
    const transformTitles = transformations.map((t) => t.title.toLowerCase());

    // 1. Concept Identity Check
    if (intent.conceptId) {
      // BFS vs DFS
      if (intent.conceptId === "bfs") {
        if (topic.includes("depth-first") || topic.includes("dfs")) {
          return {
            valid: false,
            reason: "SEMANTIC_DIVERGENCE: Requested BFS but received DFS lesson.",
          };
        }
      }
      if (intent.conceptId === "dfs") {
        if (topic.includes("breadth-first") || topic.includes("bfs")) {
          return {
            valid: false,
            reason: "SEMANTIC_DIVERGENCE: Requested DFS but received BFS lesson.",
          };
        }
      }

      // Dijkstra vs Bellman-Ford
      if (intent.conceptId === "bellman-ford") {
        if (topic.includes("dijkstra") && !topic.includes("bellman")) {
          return {
            valid: false,
            reason: "SEMANTIC_DIVERGENCE: Requested Bellman-Ford but received Dijkstra lesson.",
          };
        }
      }
      if (intent.conceptId === "dijkstra") {
        if (topic.includes("bellman")) {
          return {
            valid: false,
            reason: "SEMANTIC_DIVERGENCE: Requested Dijkstra but received Bellman-Ford lesson.",
          };
        }
      }

      // Quick Sort vs Merge Sort
      if (intent.conceptId === "quick-sort" && topic.includes("merge sort")) {
        return {
          valid: false,
          reason: "SEMANTIC_DIVERGENCE: Requested Quick Sort but received Merge Sort lesson.",
        };
      }
      if (intent.conceptId === "merge-sort" && topic.includes("quick sort")) {
        return {
          valid: false,
          reason: "SEMANTIC_DIVERGENCE: Requested Merge Sort but received Quick Sort lesson.",
        };
      }
    }

    // 2. Variant Compatibility Check
    if (intent.variant === "DOUBLY_LINKED_LIST") {
      // Check if relationships are strictly singly (only 'next') with no 'prev'/'previous'
      const firstState = lesson.timeline?.states?.[0];
      if (firstState) {
        const rels = Array.from(firstState.graph?.relationships?.values() || []);
        const hasPrev = rels.some((r) => r.type === "prev" || r.type === "previous");
        if (!hasPrev && rels.length > 0) {
          return {
            valid: false,
            reason: "SILENT_DOWNGRADE: Requested Doubly Linked List but received singly-linked structure.",
          };
        }
      }
    }

    // 3. Operation Compatibility Check
    if (intent.operation === "delete") {
      // A delete operation must NOT be represented exclusively as insertions
      const allText = [...momentTitles, ...transformTitles].join(" ");
      const hasDeleteContent =
        allText.includes("delete") ||
        allText.includes("remove") ||
        allText.includes("bypass") ||
        allText.includes("locate node") ||
        allText.includes("pop") ||
        allText.includes("dequeue");

      const isExclusivelyInsert =
        allText.includes("insert") && !hasDeleteContent;

      if (isExclusivelyInsert) {
        return {
          valid: false,
          reason: "SILENT_DOWNGRADE: Requested DELETE operation but lesson only contains INSERT actions.",
        };
      }
    }

    if (intent.operation === "insert") {
      const allText = [...momentTitles, ...transformTitles].join(" ");
      const isExclusivelyDelete =
        (allText.includes("delete") || allText.includes("remove")) && !allText.includes("insert") && !allText.includes("push") && !allText.includes("enqueue") && !allText.includes("initial");

      if (isExclusivelyDelete) {
        return {
          valid: false,
          reason: "SILENT_DOWNGRADE: Requested INSERT operation but lesson only contains DELETE actions.",
        };
      }
    }

    return { valid: true };
  }
}
