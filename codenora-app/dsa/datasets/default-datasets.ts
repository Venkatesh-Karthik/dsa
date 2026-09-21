/**
 * Cognora DSA Acceleration Layer - Deterministic Default Teaching Datasets
 *
 * Provides curated, pedagogical golden datasets designed to demonstrate
 * all 30 concepts with maximum clarity (e.g. triggering rotations in AVL,
 * highlighting pivots in Quicksort, showing edge relaxations in Dijkstra).
 *
 * GUARANTEE: 100% deterministic. Never uses Math.random().
 */

import { type DSAConceptId } from "../types/dsa-concept";

export interface DefaultTeachingDataset {
  conceptId: DSAConceptId;
  name: string;
  description: string;
  values: number[];
  target?: number;
  demonstratesOperations?: string[];
  demonstratesVariants?: string[];
  graph?: {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string; weight?: number }>;
    source?: string;
    destination?: string;
  };
}

export const DEFAULT_TEACHING_DATASETS: Record<DSAConceptId, DefaultTeachingDataset> = {
  // 1. Array Operations
  array: {
    conceptId: "array",
    name: "Linear Array Traversal & Manipulation",
    description: "Allocated contiguous elements with index access and insertion.",
    values: [14, 28, 42, 57, 83],
    target: 42,
  },

  // 2. Linked List
  "linked-list": {
    conceptId: "linked-list",
    name: "Singly Linked List Manipulation",
    description: "Chain of pointer-linked nodes demonstrating traversal and excision.",
    values: [10, 20, 30, 40, 50],
  },

  // 3. Stack
  stack: {
    conceptId: "stack",
    name: "LIFO Stack Operations",
    description: "Push, peek, and pop operations illustrating top pointer behavior.",
    values: [10, 20, 30],
  },

  // 4. Queue
  queue: {
    conceptId: "queue",
    name: "FIFO Queue Operations",
    description: "Enqueue at rear and dequeue from front.",
    values: [5, 15, 25],
  },

  // 5. Hash Table
  "hash-table": {
    conceptId: "hash-table",
    name: "Hash Table Separate Chaining",
    description: "Key hashing into buckets with collision chaining.",
    values: [12, 22, 32, 15, 25],
  },

  // 6. Linear Search
  "linear-search": {
    conceptId: "linear-search",
    name: "Linear Search Sequential Inspection",
    description: "Contiguous inspection comparing each element until target is found.",
    values: [10, 25, 30, 45, 60],
    target: 45,
  },

  // 7. Binary Search
  "binary-search": {
    conceptId: "binary-search",
    name: "Binary Search Interval Halving",
    description: "Sorted array searching for target 17 through low/mid/high range narrowing.",
    values: [2, 5, 8, 12, 17, 25, 31],
    target: 17,
  },

  // 8. Two Pointer
  "two-pointer": {
    conceptId: "two-pointer",
    name: "Two-Pointer Target Sum",
    description: "Sorted array converging inward from both boundaries to match target sum 15.",
    values: [2, 4, 7, 11, 15],
    target: 15,
  },

  // 9. Sliding Window
  "sliding-window": {
    conceptId: "sliding-window",
    name: "Fixed-Size Sliding Window",
    description: "Window of size k=3 calculating continuous subarray maximum sum.",
    values: [2, 1, 5, 1, 3, 2],
    target: 3,
  },

  // 10. Bubble Sort
  "bubble-sort": {
    conceptId: "bubble-sort",
    name: "Bubble Sort Adjacent Swaps",
    description: "Adjacent comparison passes bubbling max element to the right.",
    values: [5, 1, 4, 2, 8],
  },

  // 11. Selection Sort
  "selection-sort": {
    conceptId: "selection-sort",
    name: "Selection Sort Minimum Placement",
    description: "Global minimum scans placing smallest unsorted element into sorted prefix.",
    values: [29, 10, 14, 37, 13],
  },

  // 12. Insertion Sort
  "insertion-sort": {
    conceptId: "insertion-sort",
    name: "Insertion Sort Card Sifting",
    description: "Sifting incoming keys backward through sorted prefix.",
    values: [12, 11, 13, 5, 6],
  },

  // 13. Merge Sort
  "merge-sort": {
    conceptId: "merge-sort",
    name: "Merge Sort Divide & Conquer",
    description: "Recursive splitting followed by two-finger merge passes.",
    values: [38, 27, 43, 3, 9, 82, 10],
  },

  // 14. Quick Sort
  "quick-sort": {
    conceptId: "quick-sort",
    name: "Lomuto Quicksort Partitioning",
    description: "Pivot selection, range partitioning, and recursive subproblem resolution.",
    values: [42, 17, 8, 99, 23, 56, 4],
  },

  // 15. Heap Sort
  "heap-sort": {
    conceptId: "heap-sort",
    name: "Heap Sort In-Place Construction & Extraction",
    description: "Max-heap build followed by sequential root extraction to sorted suffix.",
    values: [12, 11, 13, 5, 6, 7],
  },

  // 16. BST
  bst: {
    conceptId: "bst",
    name: "Binary Search Tree Construction",
    description: "Left/right branching based on key comparison.",
    values: [50, 30, 70, 20, 40, 60, 80],
  },

  // 17. AVL Tree
  avl: {
    conceptId: "avl",
    name: "AVL Self-Balancing Insertion & Rotations",
    description: "Sequential insertion [50, 30, 70, 20, 40, 10] triggering LL rotation on 30.",
    values: [50, 30, 70, 20, 40, 10],
  },

  // 18. Heap / Priority Queue
  heap: {
    conceptId: "heap",
    name: "Binary Max-Heap Sift-Up",
    description: "Sequential insertion [10, 20, 15, 30] demonstrating parent-child bubble-up.",
    values: [10, 20, 15, 30],
  },

  // 19. Tree Traversals
  "tree-traversals": {
    conceptId: "tree-traversals",
    name: "Binary Tree Traversals (Inorder / Preorder / Postorder)",
    description: "Comprehensive node visit sequences across a structured binary tree.",
    values: [50, 30, 70, 20, 40, 60, 80],
  },

  // 20. BFS
  bfs: {
    conceptId: "bfs",
    name: "Breadth-First Search (Queue)",
    description: "Layer-by-layer exploration using FIFO queue from source vertex A.",
    values: [],
    graph: {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
        { id: "E", label: "E" },
      ],
      edges: [
        { from: "A", to: "B" },
        { from: "A", to: "C" },
        { from: "B", to: "D" },
        { from: "C", to: "E" },
        { from: "D", to: "E" },
      ],
      source: "A",
    },
  },

  // 21. DFS
  dfs: {
    conceptId: "dfs",
    name: "Depth-First Search (Recursion/Stack)",
    description: "Deep branch descent and backtrack from source vertex A.",
    values: [],
    graph: {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
        { from: "A", to: "D" },
      ],
      source: "A",
    },
  },

  // 22. Dijkstra
  dijkstra: {
    conceptId: "dijkstra",
    name: "Dijkstra Shortest Path Relaxation",
    description: "Weighted graph shortest-path tree with greedy distance updates.",
    values: [],
    graph: {
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
        { from: "B", to: "C", weight: 1 },
        { from: "B", to: "D", weight: 5 },
        { from: "C", to: "D", weight: 8 },
        { from: "C", to: "E", weight: 10 },
        { from: "D", to: "E", weight: 2 },
      ],
      source: "A",
      destination: "E",
    },
  },

  // 23. Bellman-Ford
  "bellman-ford": {
    conceptId: "bellman-ford",
    name: "Bellman-Ford Passes & Negative Cycle Check",
    description: "|V|-1 edge relaxation passes plus V-th pass negative-cycle diagnosis.",
    values: [],
    graph: {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { from: "A", to: "B", weight: 4 },
        { from: "A", to: "C", weight: 5 },
        { from: "B", to: "C", weight: -3 },
        { from: "C", to: "D", weight: 2 },
      ],
      source: "A",
    },
  },

  // 24. Floyd-Warshall
  "floyd-warshall": {
    conceptId: "floyd-warshall",
    name: "Floyd-Warshall All-Pairs Distance Matrix",
    description: "Iterative relaxation considering each vertex k as an allowed intermediate.",
    values: [],
    graph: {
      nodes: [
        { id: "1", label: "1" },
        { id: "2", label: "2" },
        { id: "3", label: "3" },
        { id: "4", label: "4" },
      ],
      edges: [
        { from: "1", to: "3", weight: -2 },
        { from: "2", to: "1", weight: 4 },
        { from: "2", to: "3", weight: 3 },
        { from: "3", to: "4", weight: 2 },
        { from: "4", to: "2", weight: -1 },
      ],
    },
  },

  // 25. Topological Sort
  "topological-sort": {
    conceptId: "topological-sort",
    name: "Kahn Algorithm In-Degree Zero DAG Sort",
    description: "Queueing in-degree zero vertices and removing incident edges.",
    values: [],
    graph: {
      nodes: [
        { id: "5", label: "5" },
        { id: "0", label: "0" },
        { id: "4", label: "4" },
        { id: "1", label: "1" },
        { id: "2", label: "2" },
        { id: "3", label: "3" },
      ],
      edges: [
        { from: "5", to: "2" },
        { from: "5", to: "0" },
        { from: "4", to: "0" },
        { from: "4", to: "1" },
        { from: "2", to: "3" },
        { from: "3", to: "1" },
      ],
    },
  },

  // 26. Kruskal MST
  kruskal: {
    conceptId: "kruskal",
    name: "Kruskal Minimum Spanning Tree (Greedy + DSU)",
    description: "Sort edges by weight and greedily accept non-cycle edges.",
    values: [],
    graph: {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { from: "A", to: "B", weight: 1 },
        { from: "B", to: "C", weight: 2 },
        { from: "A", to: "C", weight: 3 },
        { from: "C", to: "D", weight: 4 },
        { from: "B", to: "D", weight: 5 },
      ],
    },
  },

  // 27. Prim MST
  prim: {
    conceptId: "prim",
    name: "Prim Minimum Spanning Tree (Growing Tree)",
    description: "Grow tree from seed vertex by picking minimum crossing cut edge.",
    values: [],
    graph: {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { from: "A", to: "B", weight: 2 },
        { from: "A", to: "C", weight: 3 },
        { from: "B", to: "C", weight: 1 },
        { from: "B", to: "D", weight: 4 },
        { from: "C", to: "D", weight: 5 },
      ],
      source: "A",
    },
  },

  // 28. Recursion / Backtracking
  "recursion-backtracking": {
    conceptId: "recursion-backtracking",
    name: "N-Queens Decision Tree & Backtracking",
    description: "Placing queens column by column with conflict detection and state rollback.",
    values: [4],
  },

  // 29. Greedy Algorithms
  greedy: {
    conceptId: "greedy",
    name: "Greedy Activity Selection",
    description: "Sorting tasks by finish time and greedily picking compatible slots.",
    values: [],
  },

  // 30. Dynamic Programming
  "dynamic-programming": {
    conceptId: "dynamic-programming",
    name: "Fibonacci Memoization & Tabulation",
    description: "State table recurrence dp[i] = dp[i-1] + dp[i-2] with dependency arrows.",
    values: [6],
  },
};

export function getDefaultDataset(conceptId: DSAConceptId): DefaultTeachingDataset {
  const dataset = DEFAULT_TEACHING_DATASETS[conceptId];
  if (!dataset) {
    return {
      conceptId,
      name: `Default ${conceptId}`,
      description: "Default educational demonstration values.",
      values: [10, 20, 30, 40, 50],
    };
  }
  return dataset;
}
