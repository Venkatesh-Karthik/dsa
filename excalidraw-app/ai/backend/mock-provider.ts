/**
 * Mock Teaching Provider
 *
 * Deterministic, offline-capable teaching provider that fulfills the
 * TeachingProvider contract with pedagogical demonstrations for core CS topics
 * and follow-up requests.
 */

import type { TeachingProvider } from "./teaching-provider";
import type { TeachingRequest, TeachingResponse } from "../teaching-contract";
import type { VisualAction, TeachingStep } from "../visual-dsl";

export interface MockTeachingProviderOptions {
  simulateDelayMs?: number;
}

export class MockTeachingProvider implements TeachingProvider {
  readonly id = "mock";
  readonly name = "Local Mock Provider";

  private delayMs: number;

  constructor(options?: MockTeachingProviderOptions) {
    this.delayMs = options?.simulateDelayMs ?? 150;
  }

  isConfigured(): boolean {
    return true;
  }

  private getBinarySearchSteps(): TeachingStep[] {
    return [
      {
        id: "bs-step-1",
        step_number: 1,
        title: "Initialize Boundaries & Check Midpoint",
        explanation:
          "We begin with the full sorted array of 7 elements. The search window spans from index 0 to 6. We compute the midpoint: mid = floor((0 + 6) / 2) = index 3 (value 40). We compare 40 against our target value 60.",
        calculations:
          "low = 0, high = 6\nmid = floor((0 + 6) / 2) = 3\narray[mid] = array[3] = 40\nTarget = 60\nComparison: 60 > 40 -> Target must be in the right half",
        insight:
          "Because the array is sorted, any element at or to the left of index 3 is <= 40, so 60 cannot exist in [10, 20, 30, 40]. We eliminate 4 elements instantly!",
        visual_actions: [
          {
            type: "create_text",
            id: "bsa-title-1",
            text: "Binary Search: [10, 20, 30, 40, 50, 60, 70]  |  Target = 60",
            role: "label",
            style: { color: "primary", size: "sm" },
          },
          {
            type: "create_array",
            id: "bsa-step1",
            elements: [
              { value: 10, highlight: "low" },
              { value: 20 },
              { value: 30 },
              { value: 40, highlight: "mid" },
              { value: 50 },
              { value: 60 },
              { value: 70, highlight: "high" },
            ],
          },
          {
            type: "annotate_pointer",
            id: "ptr-low-1",
            label: "LOW (0)",
            target: "bsa-step1-0",
            placement: "above",
            color: "accent",
          },
          {
            type: "annotate_pointer",
            id: "ptr-mid-1",
            label: "MID (3)",
            target: "bsa-step1-3",
            placement: "above",
            color: "warning",
          },
          {
            type: "annotate_pointer",
            id: "ptr-high-1",
            label: "HIGH (6)",
            target: "bsa-step1-6",
            placement: "above",
            color: "accent",
          },
        ],
      },
      {
        id: "bs-step-2",
        step_number: 2,
        title: "Narrow Window & Find Target",
        explanation:
          "Since 60 > 40, we update low to mid + 1 = 4. The search window is now [50, 60, 70] (indices 4..6). We compute the new midpoint: mid = floor((4 + 6) / 2) = index 5 (value 60). Comparing array[5] with 60 gives an exact match!",
        calculations:
          "low = mid + 1 = 3 + 1 = 4, high = 6\nmid = floor((4 + 6) / 2) = 5\narray[mid] = array[5] = 60\nTarget = 60\nComparison: 60 === 60 -> MATCH FOUND at index 5!",
        insight:
          "In just 2 iterations, the search space was reduced from 7 to 3 to 1. The target was found in O(log N) steps instead of scanning every item.",
        visual_actions: [
          {
            type: "create_text",
            id: "bsa-title-2",
            text: "Binary Search: Window [50, 60, 70]  |  Target Found!",
            role: "label",
            style: { color: "success", size: "sm" },
          },
          {
            type: "create_array",
            id: "bsa-step2",
            elements: [
              { value: 10, highlight: "eliminated" },
              { value: 20, highlight: "eliminated" },
              { value: 30, highlight: "eliminated" },
              { value: 40, highlight: "eliminated" },
              { value: 50, highlight: "low" },
              { value: 60, highlight: "found" },
              { value: 70, highlight: "high" },
            ],
          },
          {
            type: "annotate_pointer",
            id: "ptr-low-2",
            label: "LOW (4)",
            target: "bsa-step2-4",
            placement: "above",
            color: "accent",
          },
          {
            type: "annotate_pointer",
            id: "ptr-mid-2",
            label: "MATCH (5)",
            target: "bsa-step2-5",
            placement: "above",
            color: "success",
          },
          {
            type: "annotate_pointer",
            id: "ptr-high-2",
            label: "HIGH (6)",
            target: "bsa-step2-6",
            placement: "above",
            color: "accent",
          },
        ],
      },
      {
        id: "bs-step-3",
        step_number: 3,
        title: "Search Completed & Complexity Analysis",
        explanation:
          "The algorithm terminates successfully and returns index 5. At each iteration, the search interval is halved: N -> N/2 -> N/4 -> ... -> 1. Hence, the maximum number of comparisons for an array of size N is floor(log2(N)) + 1.",
        calculations:
          "Input Size N = 7\nMax Comparisons = floor(log2(7)) + 1 = 3\nActual Comparisons Used = 2\nTime Complexity = O(log N)\nSpace Complexity = O(1) iterative",
        insight:
          "For 1,000,000 items, linear search requires up to 1,000,000 comparisons, whereas binary search requires at most 20 comparisons.",
        visual_actions: [
          {
            type: "create_text",
            id: "bsa-title-3",
            text: "Binary Search Complete — Summary & Complexity",
            role: "label",
            style: { color: "primary", size: "sm" },
          },
          {
            type: "create_array",
            id: "bsa-step3",
            elements: [
              { value: 10, highlight: "eliminated" },
              { value: 20, highlight: "eliminated" },
              { value: 30, highlight: "eliminated" },
              { value: 40, highlight: "eliminated" },
              { value: 50, highlight: "eliminated" },
              { value: 60, highlight: "found" },
              { value: 70, highlight: "eliminated" },
            ],
          },
          {
            type: "annotate_pointer",
            id: "ptr-found-3",
            label: "RETURN 5",
            target: "bsa-step3-5",
            placement: "above",
            color: "success",
          },
        ],
      },
    ];
  }

  private getAVLSteps(): TeachingStep[] {
    return [
      {
        id: "avl-step-1",
        step_number: 1,
        title: "Case 1: Left-Left (LL) Heavy — Single Right Rotation",
        explanation:
          "When a new node (10) is inserted into the left subtree of the left child (20), node 30 becomes unbalanced with a balance factor of +2. A single clockwise Right Rotation about node 30 elevates node 20 to the root, moving node 30 to its right child and restoring perfect balance.",
        calculations:
          "BF(node) = height(left) - height(right)\nBF(10) = 0 - 0 = 0\nBF(20) = 1 - 0 = +1\nBF(30) = height(20) - height(null) = 2 - 0 = +2 (UNBALANCED)\nAction: Rotate Right about 30 -> 20 becomes root, 10 left, 30 right",
        insight:
          "Rule (LL Case): When Balance Factor > +1 and Left Child Balance Factor >= 0, perform a single Right Rotation around the unbalanced ancestor.",
        visual_actions: [
          {
            type: "create_tree",
            id: "avl-tree-ll",
            root: "n30",
            nodes: [
              { id: "n30", value: 30, left: "n20", highlight: "mid" },
              { id: "n20", value: 20, left: "n10", highlight: "low" },
              { id: "n10", value: 10, highlight: "low" },
            ],
          },
        ],
      },
      {
        id: "avl-step-2",
        step_number: 2,
        title: "Case 2: Right-Right (RR) Heavy — Single Left Rotation",
        explanation:
          "When a new node (30) is inserted into the right subtree of the right child (20), node 10 becomes unbalanced with a balance factor of -2. A single counter-clockwise Left Rotation about node 10 elevates node 20 to the root, placing 10 as its left child and 30 as its right child.",
        calculations:
          "BF(node) = height(left) - height(right)\nBF(30) = 0 - 0 = 0\nBF(20) = 0 - 1 = -1\nBF(10) = height(null) - height(20) = 0 - 2 = -2 (UNBALANCED)\nAction: Rotate Left about 10 -> 20 becomes root, 10 left, 30 right",
        insight:
          "Rule (RR Case): When Balance Factor < -1 and Right Child Balance Factor <= 0, perform a single Left Rotation around the unbalanced ancestor.",
        visual_actions: [
          {
            type: "create_tree",
            id: "avl-tree-rr",
            root: "n10",
            nodes: [
              { id: "n10", value: 10, right: "n20", highlight: "mid" },
              { id: "n20", value: 20, right: "n30", highlight: "low" },
              { id: "n30", value: 30, highlight: "high" },
            ],
          },
        ],
      },
      {
        id: "avl-step-3",
        step_number: 3,
        title: "Case 3: Left-Right (LR) Heavy — Double Rotation (Left then Right)",
        explanation:
          "A zig-zag imbalance occurs when node 20 is inserted into the right subtree of left child 10. Node 30 has balance factor +2 while child 10 has -1. A single rotation cannot fix a zig-zag. We first rotate left child 10 Left to transform into a straight LL chain [30 -> 20 -> 10], then rotate root 30 Right.",
        calculations:
          "BF(10) = 0 - 1 = -1 (right-heavy child)\nBF(30) = 2 - 0 = +2 (left-heavy root -> LR Zig-Zag!)\nPhase 1: Rotate Left(10) -> child becomes 20 with left: 10\nPhase 2: Rotate Right(30) -> 20 becomes root, left: 10, right: 30 (all BF = 0)",
        insight:
          "Rule (LR Case): When Balance Factor > +1 and Left Child Balance Factor < 0, perform a Left Rotation on the left child, followed by a Right Rotation on the root.",
        visual_actions: [
          {
            type: "create_tree",
            id: "avl-tree-lr",
            root: "n30",
            nodes: [
              { id: "n30", value: 30, left: "n10", highlight: "mid" },
              { id: "n10", value: 10, right: "n20", highlight: "low" },
              { id: "n20", value: 20, highlight: "mid" },
            ],
          },
        ],
      },
      {
        id: "avl-step-4",
        step_number: 4,
        title: "Case 4: Right-Left (RL) Heavy — Double Rotation (Right then Left)",
        explanation:
          "A zag-zig imbalance occurs when node 20 is inserted into the left subtree of right child 30. Node 10 has balance factor -2 while child 30 has +1. We first rotate right child 30 Right to convert into a straight RR chain [10 -> 20 -> 30], then rotate root 10 Left to achieve balance.",
        calculations:
          "BF(30) = 1 - 0 = +1 (left-heavy child)\nBF(10) = 0 - 2 = -2 (right-heavy root -> RL Zag-Zig!)\nPhase 1: Rotate Right(30) -> right child becomes 20 with right: 30\nPhase 2: Rotate Left(10) -> 20 becomes root, left: 10, right: 30 (all BF = 0)",
        insight:
          "Rule (RL Case): When Balance Factor < -1 and Right Child Balance Factor > 0, perform a Right Rotation on the right child, followed by a Left Rotation on the root.",
        visual_actions: [
          {
            type: "create_tree",
            id: "avl-tree-rl",
            root: "n10",
            nodes: [
              { id: "n10", value: 10, right: "n30", highlight: "mid" },
              { id: "n30", value: 30, left: "n20", highlight: "low" },
              { id: "n20", value: 20, highlight: "mid" },
            ],
          },
        ],
      },
    ];
  }

  private getBinarySearchActions(): VisualAction[] {
    return [
      // Title text above the array
      {
        type: "create_text",
        id: "bsa-title",
        text: "Binary Search — [10, 20, 30, 40, 50, 60, 70]  |  Target = 60",
        role: "label",
        style: { color: "primary", size: "sm" },
      },
      // Semantic array — renderer owns ALL layout
      {
        type: "create_array",
        id: "bsa",
        elements: [
          { value: 10, highlight: "low" },
          { value: 20 },
          { value: 30 },
          { value: 40, highlight: "mid" },
          { value: 50 },
          { value: 60 },
          { value: 70, highlight: "high" },
        ],
      },
      // Pointer annotations above their respective elements
      {
        type: "annotate_pointer",
        id: "ptr-low",
        label: "LOW",
        target: "bsa-0",
        placement: "above",
        color: "accent",
      },
      {
        type: "annotate_pointer",
        id: "ptr-mid",
        label: "MID",
        target: "bsa-3",
        placement: "above",
        color: "warning",
      },
      {
        type: "annotate_pointer",
        id: "ptr-high",
        label: "HIGH",
        target: "bsa-6",
        placement: "above",
        color: "accent",
      },
    ];
  }

  async generateTeachingLesson(
    request: TeachingRequest,
  ): Promise<TeachingResponse> {
    return this.generateTeachingResponse(request);
  }

  async generateTeachingResponse(
    request: TeachingRequest,
  ): Promise<TeachingResponse> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    const lower = request.prompt.toLowerCase();

    // 0. Follow-up: Target 60 in binary search
    if (lower.includes("60")) {
      const visual_actions: VisualAction[] = [
        // Highlight eliminated left half
        { type: "highlight", target: "bsa-0", color: "neutral", message: "Eliminated" },
        { type: "highlight", target: "bsa-1", color: "neutral", message: "Eliminated" },
        { type: "highlight", target: "bsa-2", color: "neutral", message: "Eliminated" },
        { type: "highlight", target: "bsa-3", color: "neutral", message: "40 < 60: Left half eliminated" },
        // Highlight the found target
        { type: "highlight", target: "bsa-5", color: "success", message: "Found! 60 matches target" },
        // Move pointers to second iteration
        {
          type: "annotate_pointer",
          id: "ptr-low-2",
          label: "LOW",
          target: "bsa-4",
          placement: "above",
          color: "accent",
        },
        {
          type: "annotate_pointer",
          id: "ptr-mid-2",
          label: "MID",
          target: "bsa-5",
          placement: "above",
          color: "success",
        },
      ];

      return {
        topic: "Binary Search — Target 60",
        message:
          "When searching for 60, we compare it against the current midpoint (40). Since 60 > 40, the entire left half [10, 20, 30, 40] is eliminated. The search window shrinks to [50, 60, 70], LOW advances to index 4 (50), and 60 becomes the new midpoint — target found in just 2 steps!",
        explanation_steps: [
          "Compare target (60) with midpoint at index 3 (value 40).",
          "60 is greater than 40, so eliminate indices 0 through 3.",
          "Shift LOW to index 4 (element 50); HIGH remains at index 6 (70).",
          "Calculate new midpoint: (4 + 6) / 2 = index 5 (element 60). Target found!",
        ],
        visual_actions,
      };
    }

    // 0b. Follow-up: Highlight middle element
    if (lower.includes("highlight")) {
      const visual_actions: VisualAction[] = [
        {
          type: "highlight",
          target: "bsa-3",
          color: "warning",
          message: "Midpoint: index 3, value 40",
        },
      ];

      return {
        topic: "Highlighting Midpoint",
        message:
          "The middle element at index 3 (value 40) is highlighted. This is the pivotal element tested during this iteration.",
        explanation_steps: [
          "Locate midpoint index: (low + high) / 2 = (0 + 6) / 2 = 3.",
          "Inspect element value (40).",
        ],
        visual_actions,
      };
    }

    // 0c. Follow-up: Remove diagram
    if (
      lower.includes("remove") ||
      lower.includes("clear") ||
      lower.includes("delete")
    ) {
      const existing = request.context?.existingAIElements ?? [];
      const visual_actions: VisualAction[] =
        existing.length > 0
          ? existing.map((id) => ({ type: "delete" as const, target: id }))
          : [{ type: "delete", target: "bsa-title" }];

      return {
        topic: "Remove Diagram",
        message: "Removed the targeted visual element from the canvas.",
        explanation_steps: [
          "Identify AI-owned elements.",
          "Delete targeted element.",
        ],
        visual_actions,
      };
    }

    // 1. AVL Tree Rotations (all 4 cases)
    if (
      lower.includes("avl") ||
      (lower.includes("rotation") && lower.includes("tree"))
    ) {
      const steps = this.getAVLSteps();
      return {
        topic: "AVL Tree Rotations (All 4 Cases)",
        message:
          "An AVL tree is a self-balancing binary search tree where the heights of the two child subtrees of any node differ by at most one. When an insertion causes an imbalance (balance factor > 1 or < -1), one of four rotation cases is applied: Left-Left (LL), Right-Right (RR), Left-Right (LR), or Right-Left (RL). Here is the complete multi-step lesson covering all 4 rotation cases on the whiteboard.",
        visual_actions: steps[0].visual_actions,
        steps,
        explanation_steps: [
          "Case 1 (LL): Single Right Rotation about unbalanced node.",
          "Case 2 (RR): Single Left Rotation about unbalanced node.",
          "Case 3 (LR): Double Rotation — Left rotate child, then Right rotate root.",
          "Case 4 (RL): Double Rotation — Right rotate child, then Left rotate root.",
        ],
      };
    }

    // 2. Binary Search
    if (
      lower.includes("binary search") ||
      (lower.includes("search") && !lower.includes("tree")) ||
      (lower.includes("binary") && !lower.includes("tree"))
    ) {
      const steps = this.getBinarySearchSteps();
      const visual_actions = this.getBinarySearchActions();

      return {
        message:
          "Binary search finds a target item in a sorted array by repeatedly checking the middle element. If the target is smaller than the middle element, it eliminates the right half; otherwise, it eliminates the left half, achieving O(log N) efficiency.",
        visual_actions,
        steps,
        topic: "Binary Search",
        explanation_steps: [
          "Start with a sorted array of 7 elements [10, 20, 30, 40, 50, 60, 70] and identify search boundaries LOW=0, HIGH=6.",
          "Calculate middle index: mid = Math.floor((0 + 6) / 2) = 3 (value 40).",
          "Compare the target value with the midpoint value (40).",
          "If target < mid, discard the right half; if target > mid, discard the left half.",
          "Repeat on the remaining sub-array until found or boundaries cross.",
        ],
      };
    }

    // 2. Arrays
    if (lower.includes("array")) {
      return {
        message: "An array is a linear data structure...",
        topic: "Array Data Structure",
        visual_actions: [
          {
            type: "create_array",
            id: "arr",
            elements: [{ value: 42 }, { value: 87 }, { value: 15 }, { value: 99 }],
          },
        ],
      };
    }

    // 3. Linked List
    if (lower.includes("linked list")) {
      return {
        message: "A Linked List is a linear data structure...",
        topic: "Linked List",
        visual_actions: [
          {
            type: "create_linked_list",
            id: "ll",
            elements: [{ value: 10 }, { value: 20 }, { value: 30 }, { value: 40 }],
          },
        ],
      };
    }

    // 4. Stack
    if (lower.includes("stack") && !lower.includes("recursion") && !lower.includes("factorial")) {
      return {
        message: "A Stack is a LIFO data structure...",
        topic: "Stack",
        visual_actions: [
          {
            type: "create_stack",
            id: "stack",
            elements: [{ value: "Item D" }, { value: "Item C" }, { value: "Item B" }, { value: "Item A" }],
          },
        ],
      };
    }

    // 5. Queue
    if (lower.includes("queue")) {
      return {
        message: "A Queue is a FIFO data structure...",
        topic: "Queue",
        visual_actions: [
          {
            type: "create_array",
            id: "queue-arr",
            elements: [{ value: "A" }, { value: "B" }, { value: "C" }, { value: "D" }],
          },
          {
            type: "annotate_pointer",
            id: "ptr-head",
            label: "HEAD",
            target: "queue-arr-0",
            placement: "above",
          },
          {
            type: "annotate_pointer",
            id: "ptr-tail",
            label: "TAIL",
            target: "queue-arr-3",
            placement: "above",
          },
        ],
      };
    }

    // 6. Tree / BST
    if (lower.includes("tree") || lower.includes("bst")) {
      return {
        message: "A Binary Search Tree...",
        topic: "Binary Search Tree",
        visual_actions: [
          {
            type: "create_tree",
            id: "bst",
            root: "root",
            nodes: [
              { id: "root", value: 50, left: "left", right: "right" },
              { id: "left", value: 25, left: "ll", right: "lr" },
              { id: "right", value: 75, left: "rl", right: "rr" },
              { id: "ll", value: 10 },
              { id: "lr", value: 30 },
              { id: "rl", value: 60 },
              { id: "rr", value: 80 },
            ],
          },
        ],
      };
    }

    // 7. Heap
    if (lower.includes("heap")) {
      return {
        message: "A Max Heap...",
        topic: "Max Heap",
        visual_actions: [
          {
            type: "create_tree",
            id: "heap",
            root: "root",
            nodes: [
              { id: "root", value: 100, left: "left", right: "right" },
              { id: "left", value: 80, left: "ll", right: "lr" },
              { id: "right", value: 90 },
              { id: "ll", value: 50 },
              { id: "lr", value: 60 },
            ],
          },
        ],
      };
    }

    // 8. Graph / BFS / DFS / Dijkstra
    if (lower.includes("graph") || lower.includes("bfs") || lower.includes("dfs") || lower.includes("dijkstra")) {
      return {
        message: "A Graph...",
        topic: "Graph",
        visual_actions: [
          {
            type: "create_graph",
            id: "graph",
            nodes: [
              { id: "A", label: "A" },
              { id: "B", label: "B" },
              { id: "C", label: "C" },
              { id: "D", label: "D" },
              { id: "E", label: "E" },
            ],
            edges: [
              { from: "A", to: "B", weight: 4 },
              { from: "A", to: "C", weight: 2 },
              { from: "B", to: "D", weight: 5 },
              { from: "C", to: "D", weight: 1 },
              { from: "D", to: "E", weight: 3 },
              { from: "C", to: "E", weight: 6 },
            ],
          },
        ],
      };
    }

    // 9. Matrix / DP
    if (lower.includes("matrix") || lower.includes("dp") || lower.includes("dynamic programming")) {
      return {
        message: "Dynamic Programming Table...",
        topic: "DP Matrix",
        visual_actions: [
          {
            type: "create_matrix",
            id: "dp-matrix",
            rows: [
              [0, 0, 0, 0],
              [0, 1, 1, 1],
              [0, 1, 2, 3],
              [0, 1, 3, 6],
            ],
            rowHeaders: ["0", "1", "2", "3"],
            colHeaders: ["0", "1", "2", "3"],
          },
        ],
      };
    }

    // 10. Hash Table
    if (lower.includes("hash")) {
      return {
        message: "A Hash Table...",
        topic: "Hash Table",
        visual_actions: [
          {
            type: "create_array",
            id: "hash-buckets",
            elements: [{ value: "0" }, { value: "1" }, { value: "2" }, { value: "3" }],
          },
          {
            type: "create_linked_list",
            id: "hash-chain-1",
            elements: [{ value: "apple" }, { value: "banana" }],
          },
          {
            type: "move",
            target: "hash-chain-1",
            destination: { relativeTo: "hash-buckets-1", placement: "right_of" },
          },
        ],
      };
    }

    // 11. Recursion
    if (lower.includes("recursion") || lower.includes("factorial")) {
      return {
        message: "Recursion Call Stack...",
        topic: "Recursion",
        visual_actions: [
          {
            type: "create_stack",
            id: "call-stack",
            elements: [{ value: "fact(1)" }, { value: "fact(2)" }, { value: "fact(3)" }, { value: "fact(4)" }],
          },
        ],
      };
    }

    // 5. Generic Fallback
    const visual_actions: VisualAction[] = [
      {
        type: "create_box",
        id: "concept-root",
        label: request.prompt.slice(0, 30),
        role: "generic",
        style: { color: "accent", size: "md" },
      },
      {
        type: "create_box",
        id: "concept-detail-a",
        label: "Component 1",
        role: "generic",
        position: {
          relativeTo: "concept-root",
          placement: "below",
          align: "start",
        },
        style: { color: "primary", size: "sm" },
      },
      {
        type: "create_box",
        id: "concept-detail-b",
        label: "Component 2",
        role: "generic",
        position: { relativeTo: "concept-detail-a", placement: "right_of" },
        style: { color: "success", size: "sm" },
      },
      {
        type: "create_arrow",
        id: "concept-arrow-a",
        from: "concept-root",
        to: "concept-detail-a",
        direction: "forward",
      },
      {
        type: "create_arrow",
        id: "concept-arrow-b",
        from: "concept-root",
        to: "concept-detail-b",
        direction: "forward",
      },
    ];

    return {
      message: `Here is a visual conceptual breakdown for "${request.prompt}". The visual diagram shows the core components and relational linkages.`,
      visual_actions,
      topic: request.prompt,
      explanation_steps: [
        `Understand the central concept: ${request.prompt}`,
        "Break down the topic into core sub-components.",
        "Trace the relationships and interactions between each component.",
      ],
    };
  }
}
