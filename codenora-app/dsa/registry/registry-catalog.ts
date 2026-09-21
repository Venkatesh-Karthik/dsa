/**
 * Cognora DSA Acceleration Layer - Concept Catalog
 *
 * Central definition of all 30 recognized DSA concepts, aliases, default limits,
 * and deterministic engine support.
 */

import type { DSAConceptRegistration } from "../types/dsa-concept";

export const DSA_CATALOG: DSAConceptRegistration[] = [
  // 1. Array Operations (Tier 2)
  {
    id: "array",
    displayName: "Array Operations",
    category: "linear",
    aliases: ["array", "arrays", "static array", "array operations", "array insert", "array delete"],
    supported: true,
    description: "Contiguous linear collection with indexed access, bounds, and element manipulation.",
    defaultLimits: { maxElements: 20, maxNodes: 20, maxEdges: 0, maxOperations: 100 },
    teachingGoal: "Demonstrate indexed array storage, bounds, shifts on insertion, and element access.",
  },

  // 2. Linked List (Tier 1 Demo-Critical)
  {
    id: "linked-list",
    displayName: "Linked List",
    category: "linear",
    aliases: ["linked list", "singly linked list", "linkedlist", "list insertion", "list deletion", "pointer rewiring"],
    supported: true,
    description: "Linear nodes chained by next pointers with O(1) splicing after reaching target.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 12, maxOperations: 50 },
    teachingGoal: "Demonstrate node allocation, pointer chasing, and sequential pointer rewiring during deletion and insertion.",
  },

  // 3. Stack (Tier 1 Demo-Critical)
  {
    id: "stack",
    displayName: "Stack",
    category: "linear",
    aliases: ["stack", "lifo", "push", "pop", "call stack", "stack frame"],
    supported: true,
    description: "Last-In, First-Out sequential container.",
    defaultLimits: { maxElements: 15, maxNodes: 15, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate push to top, pop from top, and stack pointer movement.",
  },

  // 4. Queue (Tier 1 Demo-Critical)
  {
    id: "queue",
    displayName: "Queue",
    category: "linear",
    aliases: ["queue", "fifo", "enqueue", "dequeue", "circular queue"],
    supported: true,
    description: "First-In, First-Out linear container.",
    defaultLimits: { maxElements: 15, maxNodes: 15, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate enqueue at rear, dequeue from front, and head/tail pointer progression.",
  },

  // 5. Hash Table (Tier 3)
  {
    id: "hash-table",
    displayName: "Hash Table / Hashing",
    category: "container",
    aliases: ["hash table", "hash map", "hashmap", "hashing", "hash", "separate chaining", "hash buckets"],
    supported: true,
    description: "Key-value mapping using hash function into bucket arrays with separate chaining.",
    defaultLimits: { maxElements: 15, maxNodes: 15, maxEdges: 15, maxOperations: 50 },
    teachingGoal: "Demonstrate key hashing, bucket indexing, and collision resolution via chaining.",
  },

  // 6. Linear Search (Tier 2)
  {
    id: "linear-search",
    displayName: "Linear Search",
    category: "searching",
    aliases: ["linear search", "sequential search", "array scan"],
    supported: true,
    description: "Sequential element scan comparing each cell with search target.",
    defaultLimits: { maxElements: 16, maxNodes: 16, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate sequential inspection, target comparison, and termination conditions.",
  },

  // 7. Binary Search (Tier 1 Demo-Critical)
  {
    id: "binary-search",
    displayName: "Binary Search",
    category: "searching",
    aliases: ["binary search", "binarysearch", "bsearch", "bisect", "half interval search"],
    supported: true,
    description: "Logarithmic search on a sorted array using low, mid, and high pointers.",
    defaultLimits: { maxElements: 16, maxNodes: 16, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate interval halving, midpoint calculation, target comparison, and eliminated search space.",
  },

  // 8. Two-Pointer Technique (Tier 3)
  {
    id: "two-pointer",
    displayName: "Two-Pointer Technique",
    category: "technique",
    aliases: ["two pointer", "two-pointer", "two pointers", "opposite direction pointers"],
    supported: true,
    description: "Pairwise pointer traversal from boundaries toward each other on sorted arrays.",
    defaultLimits: { maxElements: 16, maxNodes: 16, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate inward pointer movement based on comparison with target sum.",
  },

  // 9. Sliding Window (Tier 3)
  {
    id: "sliding-window",
    displayName: "Sliding Window",
    category: "technique",
    aliases: ["sliding window", "window algorithm", "subarray window", "sliding window sum"],
    supported: true,
    description: "Continuous window tracking subarray metric in O(1) updates per slide.",
    defaultLimits: { maxElements: 16, maxNodes: 16, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate window start/end boundaries, element entry/exit, and running metric maintenance.",
  },

  // 10. Bubble Sort (Tier 2)
  {
    id: "bubble-sort",
    displayName: "Bubble Sort",
    category: "sorting",
    aliases: ["bubble sort", "bubblesort", "sinking sort"],
    supported: true,
    description: "Repeatedly steps through array, swapping adjacent inverted elements.",
    defaultLimits: { maxElements: 10, maxNodes: 10, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate adjacent element comparisons, inversion swaps, and largest element bubbling.",
  },

  // 11. Selection Sort (Tier 2)
  {
    id: "selection-sort",
    displayName: "Selection Sort",
    category: "sorting",
    aliases: ["selection sort", "selectionsort"],
    supported: true,
    description: "Finds minimum element in unsorted region and places it into sorted prefix.",
    defaultLimits: { maxElements: 10, maxNodes: 10, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate scanning unsorted suffix, identifying minimum, and swapping into sorted prefix.",
  },

  // 12. Insertion Sort (Tier 2)
  {
    id: "insertion-sort",
    displayName: "Insertion Sort",
    category: "sorting",
    aliases: ["insertion sort", "insertionsort"],
    supported: true,
    description: "Builds sorted array one element at a time by sliding keys backward into position.",
    defaultLimits: { maxElements: 10, maxNodes: 10, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate shifting greater elements rightward and inserting key into its sorted slot.",
  },

  // 13. Merge Sort (Tier 1 Demo-Critical)
  {
    id: "merge-sort",
    displayName: "Merge Sort",
    category: "sorting",
    aliases: ["merge sort", "mergesort"],
    supported: true,
    description: "Divide-and-conquer sorting by splitting into halves and merging sorted sublists.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate recursive divide, two-finger merge comparisons, and auxiliary array writes.",
  },

  // 14. Quick Sort (Tier 1 Demo-Critical)
  {
    id: "quick-sort",
    displayName: "Quick Sort",
    category: "sorting",
    aliases: ["quick sort", "quicksort", "qsort"],
    supported: true,
    description: "Divide-and-conquer partition sort placing pivot into its final sorted position.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate pivot selection, two-pointer partitioning, partition completion, and recursive subproblems.",
  },

  // 15. Heap Sort (Tier 2)
  {
    id: "heap-sort",
    displayName: "Heap Sort",
    category: "sorting",
    aliases: ["heap sort", "heapsort"],
    supported: true,
    description: "Comparison-based sort using a binary heap data structure.",
    defaultLimits: { maxElements: 10, maxNodes: 10, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate max-heap construction and sequential root extraction to sorted suffix.",
  },

  // 16. Binary Search Tree (Tier 2)
  {
    id: "bst",
    displayName: "Binary Search Tree",
    category: "tree",
    aliases: ["bst", "binary search tree", "binary tree insertion"],
    supported: true,
    description: "Binary tree maintaining left < parent < right invariant.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 12, maxOperations: 50 },
    teachingGoal: "Demonstrate left and right branching based on key comparison during insertion.",
  },

  // 17. AVL Tree (Tier 1 Demo-Critical)
  {
    id: "avl",
    displayName: "AVL Tree",
    category: "tree",
    aliases: ["avl", "avl tree", "avl rotation", "self balancing tree", "balanced bst", "avl insertion", "rotations"],
    supported: true,
    description: "Strictly height-balanced binary search tree with balance factor maintenance and rotations.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 12, maxOperations: 50 },
    teachingGoal: "Demonstrate BST insertion, height & balance factor updates, imbalance diagnosis, and LL/RR/LR/RL tree rotations.",
  },

  // 18. Heap / Priority Queue (Tier 1 Demo-Critical)
  {
    id: "heap",
    displayName: "Heap / Priority Queue",
    category: "tree",
    aliases: ["heap", "binary heap", "min heap", "max heap", "priority queue", "heapify", "sift up", "bubble up"],
    supported: true,
    description: "Complete binary tree satisfying heap property (parent >= child for max heap).",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 12, maxOperations: 50 },
    teachingGoal: "Demonstrate leaf append and bubble-up (sift-up) parent-child swaps to restore heap invariant.",
  },

  // 19. Tree Traversals (Tier 2)
  {
    id: "tree-traversals",
    displayName: "Tree Traversals",
    category: "tree",
    aliases: ["tree traversals", "tree traversal", "inorder", "preorder", "postorder", "level order"],
    supported: true,
    description: "Systematic visit of every node in a binary tree in defined algorithmic order.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 12, maxOperations: 50 },
    teachingGoal: "Demonstrate node visit sequences across Inorder, Preorder, Postorder, and Level-Order.",
  },

  // 20. BFS (Tier 1 Demo-Critical)
  {
    id: "bfs",
    displayName: "Breadth-First Search",
    category: "graph",
    aliases: ["bfs", "breadth first search", "breadth-first search", "level order graph"],
    supported: true,
    description: "Graph traversal exploring neighbor vertices layer by layer using a FIFO queue.",
    defaultLimits: { maxElements: 12, maxNodes: 10, maxEdges: 20, maxOperations: 50 },
    teachingGoal: "Demonstrate queue-based vertex traversal, discovery of neighbors, and shortest-path layers.",
  },

  // 21. DFS (Tier 1 Demo-Critical)
  {
    id: "dfs",
    displayName: "Depth-First Search",
    category: "graph",
    aliases: ["dfs", "depth first search", "depth-first search", "graph backtracking"],
    supported: true,
    description: "Graph traversal exploring deep down paths before backtracking via recursion/stack.",
    defaultLimits: { maxElements: 12, maxNodes: 10, maxEdges: 20, maxOperations: 50 },
    teachingGoal: "Demonstrate branch descent, recursion stack frames, and backtracking upon dead ends.",
  },

  // 22. Dijkstra's Shortest Path (Tier 1 Demo-Critical)
  {
    id: "dijkstra",
    displayName: "Dijkstra's Algorithm",
    category: "graph",
    aliases: [
      "dijkstra",
      "dijkstra's",
      "dijkstras algorithm",
      "shortest path",
      "single source shortest path",
      "shortest path dijkstra",
    ],
    supported: true,
    description: "Greedy single-source shortest path on non-negative weighted graphs.",
    defaultLimits: { maxElements: 12, maxNodes: 10, maxEdges: 20, maxOperations: 50 },
    teachingGoal: "Demonstrate tentative distance table, min-vertex greedy selection, edge relaxation, and predecessor tree.",
  },

  // 23. Bellman-Ford (Tier 1 Demo-Critical)
  {
    id: "bellman-ford",
    displayName: "Bellman-Ford Algorithm",
    category: "graph",
    aliases: ["bellman ford", "bellman-ford", "negative weight cycles", "negative edges shortest path"],
    supported: true,
    description: "Single-source shortest path algorithm capable of handling negative weights and detecting negative cycles.",
    defaultLimits: { maxElements: 12, maxNodes: 8, maxEdges: 16, maxOperations: 50 },
    teachingGoal: "Demonstrate |V|-1 edge relaxation passes, convergence, and V-th pass negative-cycle detection.",
  },

  // 24. Floyd-Warshall (Tier 2)
  {
    id: "floyd-warshall",
    displayName: "Floyd-Warshall Algorithm",
    category: "graph",
    aliases: ["floyd warshall", "floyd-warshall", "all pairs shortest path", "apsp"],
    supported: true,
    description: "Dynamic programming all-pairs shortest paths using intermediate vertex k.",
    defaultLimits: { maxElements: 16, maxNodes: 6, maxEdges: 15, maxOperations: 50 },
    teachingGoal: "Demonstrate distance matrix updates considering each vertex k as an allowed intermediate waypoint.",
  },

  // 25. Topological Sort (Tier 2)
  {
    id: "topological-sort",
    displayName: "Topological Sort",
    category: "graph",
    aliases: ["topological sort", "toposort", "kahn's algorithm", "kahns algorithm", "dag ordering"],
    supported: true,
    description: "Linear ordering of vertices in a directed acyclic graph such that for every directed edge u -> v, u comes before v.",
    defaultLimits: { maxElements: 10, maxNodes: 8, maxEdges: 16, maxOperations: 50 },
    teachingGoal: "Demonstrate in-degree calculation, queueing 0-in-degree nodes, edge removal, and cycle detection.",
  },

  // 26. Kruskal's MST (Tier 2)
  {
    id: "kruskal",
    displayName: "Kruskal's MST Algorithm",
    category: "graph",
    aliases: ["kruskal", "kruskal's", "kruskals", "minimum spanning tree kruskal", "mst kruskal"],
    supported: true,
    description: "Greedy algorithm that finds a minimum spanning tree by sorting edges and using Disjoint Set Union.",
    defaultLimits: { maxElements: 12, maxNodes: 8, maxEdges: 16, maxOperations: 50 },
    teachingGoal: "Demonstrate sorting edges by weight, Disjoint Set Union (find/union), and cycle rejection.",
  },

  // 27. Prim's MST (Tier 2)
  {
    id: "prim",
    displayName: "Prim's MST Algorithm",
    category: "graph",
    aliases: ["prim", "prim's", "prims", "minimum spanning tree prim", "mst prim"],
    supported: true,
    description: "Greedy algorithm that grows a minimum spanning tree from a seed vertex.",
    defaultLimits: { maxElements: 12, maxNodes: 8, maxEdges: 16, maxOperations: 50 },
    teachingGoal: "Demonstrate growing cut, candidate crossing edges, and greedy minimum-weight edge addition.",
  },

  // 28. Recursion / Backtracking (Tier 3)
  {
    id: "recursion-backtracking",
    displayName: "Recursion & Backtracking",
    category: "technique",
    aliases: ["recursion", "backtracking", "n-queens", "n queens", "recursive backtracking"],
    supported: true,
    description: "Algorithmic technique that considers searching every possibility until the solution is found, rolling back on failure.",
    defaultLimits: { maxElements: 16, maxNodes: 16, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate decision tree exploration, constraint checks, choice placement, and backtracking upon dead ends.",
  },

  // 29. Greedy Algorithms (Tier 3)
  {
    id: "greedy",
    displayName: "Greedy Algorithms",
    category: "technique",
    aliases: ["greedy", "greedy algorithm", "activity selection", "interval scheduling", "greedy choice"],
    supported: true,
    description: "Problem-solving heuristic making locally optimal choices at each stage with the hope of finding global optimum.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 0, maxOperations: 50 },
    teachingGoal: "Demonstrate candidate sorting, locally optimal choice selection, and compatibility invariants.",
  },

  // 30. Dynamic Programming (Tier 3)
  {
    id: "dynamic-programming",
    displayName: "Dynamic Programming",
    category: "technique",
    aliases: ["dynamic programming", "dp", "memoization", "tabulation", "fibonacci dp", "overlapping subproblems"],
    supported: true,
    description: "Method for solving complex problems by breaking them down into simpler subproblems and storing results.",
    defaultLimits: { maxElements: 12, maxNodes: 12, maxEdges: 12, maxOperations: 50 },
    teachingGoal: "Demonstrate table allocation, base conditions, recurrence state transitions, and dependency reuse.",
  },
];
