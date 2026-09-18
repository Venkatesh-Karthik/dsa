/**
 * Cognora Visual Lessons Repository for Mock Teaching Provider
 *
 * Provides rich, deterministic VisualLessons featuring persistent evolving
 * scenes, atomic transformations, and multi-language code contexts.
 *
 * Flagship showcase: Dijkstra's Algorithm (16 nodes A-P, 7-step progression,
 * shortest path A -> B -> D -> K -> P with distance 28).
 */

import type {
  VisualLesson,
  TeachingStep,
  VisualAction,
  GraphNodeDef,
  GraphEdgeDef,
  CodeContext,
} from "../visual-dsl";

// ============================================================================
// Dijkstra Flagship Lesson (16 nodes, 7 transformations)
// ============================================================================

export const DIJKSTRA_PYTHON_CODE = `import heapq

def dijkstra(graph, start, target):
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    pq = [(0, start)]
    predecessors = {start: None}

    while pq:
        curr_dist, curr = heapq.heappop(pq)
        if curr == target:
            break
        if curr_dist > distances[curr]:
            continue

        for neighbor, weight in graph[curr].items():
            dist = curr_dist + weight
            if dist < distances[neighbor]:
                distances[neighbor] = dist
                predecessors[neighbor] = curr
                heapq.heappush(pq, (dist, neighbor))

    return distances, predecessors`;

export const DIJKSTRA_TS_CODE = `interface Graph {
  [node: string]: { [neighbor: string]: number };
}

function dijkstra(graph: Graph, start: string, target: string) {
  const distances: Record<string, number> = {};
  const predecessors: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
    predecessors[node] = null;
  }
  distances[start] = 0;

  while (true) {
    let closestNode: string | null = null;
    let shortestDist = Infinity;

    for (const [node, dist] of Object.entries(distances)) {
      if (!visited.has(node) && dist < shortestDist) {
        shortestDist = dist;
        closestNode = node;
      }
    }

    if (!closestNode || closestNode === target) break;
    visited.add(closestNode);

    for (const [neighbor, weight] of Object.entries(graph[closestNode])) {
      const dist = shortestDist + weight;
      if (dist < distances[neighbor]) {
        distances[neighbor] = dist;
        predecessors[neighbor] = closestNode;
      }
    }
  }

  return { distances, predecessors };
}`;

const DIJKSTRA_NODES: GraphNodeDef[] = [
  { id: "A", label: "A (0)", x: 135, y: 430, highlight: "low" },
  { id: "B", label: "B (∞)", x: 265, y: 310 },
  { id: "C", label: "C (∞)", x: 255, y: 510 },
  { id: "D", label: "D (∞)", x: 430, y: 275 },
  { id: "E", label: "E (∞)", x: 385, y: 410 },
  { id: "F", label: "F (∞)", x: 255, y: 615 },
  { id: "G", label: "G (∞)", x: 490, y: 615 },
  { id: "H", label: "H (∞)", x: 380, y: 510 },
  { id: "I", label: "I (∞)", x: 500, y: 510 },
  { id: "J", label: "J (∞)", x: 615, y: 510 },
  { id: "K", label: "K (∞)", x: 525, y: 440 },
  { id: "L", label: "L (∞)", x: 630, y: 350 },
  { id: "M", label: "M (∞)", x: 565, y: 195 },
  { id: "N", label: "N (∞)", x: 625, y: 615 },
  { id: "O", label: "O (∞)", x: 745, y: 330 },
  { id: "P", label: "P (∞)", x: 730, y: 460, highlight: "target" },
];

const DIJKSTRA_EDGES: GraphEdgeDef[] = [
  { from: "A", to: "B", weight: 5 },
  { from: "A", to: "C", weight: 5 },
  { from: "B", to: "D", weight: 3 },
  { from: "B", to: "C", weight: 4 },
  { from: "C", to: "E", weight: 7 },
  { from: "C", to: "H", weight: 4 },
  { from: "C", to: "F", weight: 4 },
  { from: "F", to: "G", weight: 9 },
  { from: "G", to: "N", weight: 2 },
  { from: "H", to: "I", weight: 3 },
  { from: "I", to: "J", weight: 4 },
  { from: "J", to: "N", weight: 3 },
  { from: "D", to: "M", weight: 14 },
  { from: "D", to: "K", weight: 16 },
  { from: "D", to: "L", weight: 13 },
  { from: "M", to: "O", weight: 5 },
  { from: "L", to: "O", weight: 4 },
  { from: "O", to: "P", weight: 8 },
  { from: "K", to: "P", weight: 4 },
  { from: "N", to: "P", weight: 7 },
];

export function getDijkstraVisualLesson(): VisualLesson {
  const codeContextPython: CodeContext = {
    language: "python",
    code: DIJKSTRA_PYTHON_CODE,
    functionName: "dijkstra",
  };

  return {
    id: "lesson-dijkstra-16",
    title: "Dijkstra's Shortest Path Algorithm (16 Nodes)",
    concept: "Dijkstra's Algorithm",
    domain: {
      id: "graph-domain",
      type: "graph",
      label: "Weighted Directed Graph (16 Vertices)",
    },
    initialScene: [
      {
        type: "create_graph",
        id: "dijkstra-graph",
        label: "Dijkstra: Single-Source Shortest Path (A → P)",
        nodes: DIJKSTRA_NODES,
        edges: DIJKSTRA_EDGES,
        directed: true,
      },
      {
        type: "create_explanation_block",
        id: "dijkstra-card",
        title: "Dijkstra's Shortest Path Algorithm",
        explanation:
          "Finding single-source shortest paths in a weighted graph with 16 nodes (A through P). Target node is P. Min-priority queue maintains frontier nodes by tentative distance.",
        calculations:
          "Start: Node A (dist 0)\nTarget: Node P (dist ∞)\nTotal Nodes: 16 | Total Edges: 20",
        insight:
          "Greedy choice property: When a node is popped from the min-heap, its shortest path distance is finalized and guaranteed optimal.",
      },
    ],
    transformations: [
      {
        id: "transform-1",
        title: "Initialize distances",
        explanation:
          "Set start node A distance to 0, all other nodes infinity. Insert (0, 'A') into min-priority queue.",
        codeContext: {
          ...codeContextPython,
          highlightLines: [4, 5, 6, 7],
          explanation:
            "Set start distance to 0, all others to infinity. Push start to PQ.",
        },
        highlights: ["dijkstra-graph-A"],
        operations: [
          {
            type: "highlight",
            target: "dijkstra-graph-A",
            emphasis: "pulse",
            color: "accent",
            message: "Start node A initialized (dist: 0)",
          },
        ],
      },
      {
        id: "transform-2",
        title: "Visit node A",
        explanation:
          "Pop node A from priority queue. Check adjacent neighbors B and C.",
        codeContext: {
          ...codeContextPython,
          highlightLines: [9, 10, 14],
          explanation: "Pop minimum distance vertex from priority queue.",
        },
        highlights: [
          "dijkstra-graph-A",
          "dijkstra-graph-edge-A-B",
          "dijkstra-graph-edge-A-C",
        ],
        operations: [
          {
            type: "highlight",
            target: "dijkstra-graph-A",
            color: "success",
            emphasis: "glow",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-A-B",
            color: "warning",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-A-C",
            color: "warning",
          },
        ],
      },
      {
        id: "transform-3",
        title: "Explore neighbors of B",
        explanation:
          "Node B has minimal tentative distance (5). Relaxing adjacent edges.",
        codeContext: {
          ...codeContextPython,
          highlightLines: [15, 16, 17, 18, 19],
          explanation: "Relax adjacent edges and update priority queue.",
        },
        highlights: ["dijkstra-graph-B", "dijkstra-graph-C"],
        operations: [
          {
            type: "update",
            target: "dijkstra-graph-B",
            label: "B (5)",
          },
          {
            type: "update",
            target: "dijkstra-graph-C",
            label: "C (5)",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-B",
            color: "primary",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-C",
            color: "accent",
          },
        ],
      },
      {
        id: "transform-4",
        title: "Relax edge B → D",
        explanation:
          "Tentative distance to D becomes 5 + 3 = 8. Lower than previous infinity.",
        codeContext: {
          ...codeContextPython,
          highlightLines: [10, 15, 16, 17, 18],
          explanation: "Next smallest tentative distance is node D.",
        },
        highlights: ["dijkstra-graph-B", "dijkstra-graph-D"],
        operations: [
          {
            type: "highlight",
            target: "dijkstra-graph-B",
            color: "success",
          },
          {
            type: "update",
            target: "dijkstra-graph-D",
            label: "D (8)",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-B-D",
            color: "accent",
          },
        ],
      },
      {
        id: "transform-5",
        title: "Visit node D",
        explanation: "Exploring reachable neighbors from node D (M, K, L).",
        codeContext: {
          ...codeContextPython,
          highlightLines: [10, 16, 17, 18, 19],
          explanation: "Exploring outgoing edges from settled node D.",
        },
        highlights: ["dijkstra-graph-D", "dijkstra-graph-K"],
        operations: [
          {
            type: "highlight",
            target: "dijkstra-graph-D",
            color: "success",
          },
          {
            type: "update",
            target: "dijkstra-graph-K",
            label: "K (24)",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-D-K",
            color: "warning",
          },
        ],
      },
      {
        id: "transform-6",
        title: "Explore node K",
        explanation:
          "Relaxing edge K → P with weight 4. New shortest distance to P is 28.",
        codeContext: {
          ...codeContextPython,
          highlightLines: [15, 16, 17, 18, 19],
          explanation: "Frontier advances across node K towards destination P.",
        },
        highlights: [
          "dijkstra-graph-K",
          "dijkstra-graph-P",
          "dijkstra-graph-edge-K-P",
        ],
        operations: [
          {
            type: "highlight",
            target: "dijkstra-graph-K",
            color: "success",
          },
          {
            type: "update",
            target: "dijkstra-graph-P",
            label: "P (28)",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-K-P",
            color: "accent",
          },
        ],
      },
      {
        id: "transform-7",
        title: "Reached destination P",
        explanation:
          "Destination node P reached! Shortest path verified: A → B → D → K → P (distance 28).",
        codeContext: {
          ...codeContextPython,
          highlightLines: [11, 12, 22],
          explanation:
            "Target reached; terminate search and return shortest path.",
        },
        highlights: [
          "dijkstra-graph-P",
          "dijkstra-graph-edge-A-B",
          "dijkstra-graph-edge-B-D",
          "dijkstra-graph-edge-D-K",
          "dijkstra-graph-edge-K-P",
        ],
        operations: [
          {
            type: "update",
            target: "dijkstra-graph-P",
            label: "P (28)",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-P",
            color: "accent",
            emphasis: "glow",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-A-B",
            color: "accent",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-B-D",
            color: "accent",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-D-K",
            color: "accent",
          },
          {
            type: "highlight",
            target: "dijkstra-graph-edge-K-P",
            color: "accent",
          },
        ],
      },
    ],
    codeContexts: [
      codeContextPython,
      {
        language: "typescript",
        code: DIJKSTRA_TS_CODE,
        functionName: "dijkstra",
      },
    ],
  };
}

export function getDijkstraSteps(): TeachingStep[] {
  const lesson = getDijkstraVisualLesson();
  return lesson.transformations.map((t, idx) => ({
    id: `dijkstra-step-${idx + 1}`,
    step_number: idx + 1,
    title: t.title,
    explanation: t.explanation,
    calculations: `Transformation ${idx + 1} of ${
      lesson.transformations.length
    }`,
    insight: t.explanation,
    visual_actions: (idx === 0
      ? lesson.initialScene
      : t.operations.filter((op) => "type" in op)) as VisualAction[],
  }));
}

// ============================================================================
// Binary Search Visual Lesson
// ============================================================================

export const BINARY_SEARCH_PYTHON_CODE = `def binary_search(arr, target):
    low = 0
    high = len(arr) - 1

    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1

    return -1`;

export function getBinarySearchVisualLesson(): VisualLesson {
  const codeContext: CodeContext = {
    language: "python",
    code: BINARY_SEARCH_PYTHON_CODE,
    functionName: "binary_search",
  };

  return {
    id: "lesson-binary-search-7",
    title: "Binary Search: Target = 60",
    concept: "Binary Search",
    domain: {
      id: "array-domain",
      type: "array",
      label: "Sorted Array [7 Elements]",
    },
    initialScene: [
      {
        type: "create_array",
        id: "bs-arr",
        label: "Sorted Array (N = 7, Target = 60)",
        elements: [
          { value: 10, highlight: "low" },
          { value: 20 },
          { value: 30 },
          { value: 40 },
          { value: 50 },
          { value: 60 },
          { value: 70, highlight: "high" },
        ],
      },
      {
        type: "annotate_pointer",
        id: "ptr-low",
        label: "LOW (0)",
        target: "bs-arr-0",
        placement: "above",
        color: "accent",
      },
      {
        type: "annotate_pointer",
        id: "ptr-high",
        label: "HIGH (6)",
        target: "bs-arr-6",
        placement: "above",
        color: "accent",
      },
    ],
    transformations: [
      {
        id: "bs-t1",
        title: "Compute First Midpoint (mid = 3)",
        explanation:
          "Calculate midpoint: mid = floor((0 + 6) / 2) = 3 (value 40). Inspect middle element.",
        codeContext: {
          ...codeContext,
          highlightLines: [5, 6, 7],
        },
        highlights: ["bs-arr-3"],
        operations: [
          {
            type: "annotate_pointer",
            id: "ptr-mid",
            label: "MID (3)",
            target: "bs-arr-3",
            placement: "above",
            color: "warning",
          },
          {
            type: "highlight",
            target: "bs-arr-3",
            color: "warning",
          },
        ],
      },
      {
        id: "bs-t2",
        title: "Compare Target & Eliminate Left Partition",
        explanation:
          "Target 60 > array[mid] 40. Since array is sorted, 60 cannot be in left half. Eliminate indices 0..3.",
        codeContext: {
          ...codeContext,
          highlightLines: [8, 9, 10],
        },
        highlights: ["bs-arr-4"],
        operations: [
          {
            type: "highlight",
            target: "bs-arr-0",
            color: "neutral",
          },
          {
            type: "highlight",
            target: "bs-arr-1",
            color: "neutral",
          },
          {
            type: "highlight",
            target: "bs-arr-2",
            color: "neutral",
          },
          {
            type: "highlight",
            target: "bs-arr-3",
            color: "neutral",
          },
        ],
      },
      {
        id: "bs-t3",
        title: "Advance LOW to 4 & Compute Second Midpoint (mid = 5)",
        explanation:
          "low = mid + 1 = 4. Active search window is [50, 60, 70]. mid = floor((4 + 6) / 2) = 5 (value 60).",
        codeContext: {
          ...codeContext,
          highlightLines: [9, 10, 5, 6],
        },
        highlights: ["bs-arr-5"],
        operations: [
          {
            type: "annotate_pointer",
            id: "ptr-low",
            label: "LOW (4)",
            target: "bs-arr-4",
            placement: "above",
            color: "accent",
          },
          {
            type: "annotate_pointer",
            id: "ptr-mid",
            label: "MID (5)",
            target: "bs-arr-5",
            placement: "above",
            color: "warning",
          },
          {
            type: "highlight",
            target: "bs-arr-5",
            color: "warning",
          },
        ],
      },
      {
        id: "bs-t4",
        title: "Target Match Found at Index 5!",
        explanation:
          "array[mid] (60) === target (60). Target located in only 2 comparisons! O(log N) efficiency confirmed.",
        codeContext: {
          ...codeContext,
          highlightLines: [7, 8],
        },
        highlights: ["bs-arr-5"],
        operations: [
          {
            type: "highlight",
            target: "bs-arr-5",
            color: "success",
            emphasis: "glow",
          },
        ],
      },
    ],
    codeContexts: [codeContext],
  };
}

// ============================================================================
// Linked List Insertion Visual Lesson
// ============================================================================

export function getLinkedListVisualLesson(): VisualLesson {
  return {
    id: "lesson-linked-list-insert",
    title: "Linked List: Insertion Operations",
    concept: "Linked List",
    domain: {
      id: "ll-domain",
      type: "linked_list",
      label: "Singly Linked List",
    },
    initialScene: [
      {
        type: "create_linked_list",
        id: "ll-main",
        label: "Singly Linked List: [10] -> [20] -> [30]",
        elements: [{ value: 10 }, { value: 20 }, { value: 30 }],
      },
    ],
    transformations: [
      {
        id: "ll-t1",
        title: "Allocate New Node [15]",
        explanation:
          "Allocate memory for new node with data 15. Pointer next initially points to null.",
        codeContext: {
          language: "python",
          code: `new_node = Node(15)\nnew_node.next = curr.next\ncurr.next = new_node`,
          highlightLines: [1],
        },
        highlights: ["ll-main-1"],
        operations: [
          {
            type: "create_box",
            id: "new-node",
            label: "Node (15)",
            style: { color: "accent" },
          },
        ],
      },
      {
        id: "ll-t2",
        title: "Link New Node to [20] (new_node.next = curr.next)",
        explanation:
          "Point new_node.next to node 20 to preserve the rest of the list before severing predecessor.",
        codeContext: {
          language: "python",
          code: `new_node = Node(15)\nnew_node.next = curr.next\ncurr.next = new_node`,
          highlightLines: [2],
        },
        highlights: ["new-node"],
        operations: [
          {
            type: "create_arrow",
            id: "edge-new-to-20",
            from: "new-node",
            to: "ll-main-1",
            style: { color: "accent" },
          },
        ],
      },
      {
        id: "ll-t3",
        title: "Splice Into List (curr.next = new_node)",
        explanation:
          "Update predecessor pointer: node 10 now points to node 15. Insertion completes in O(1) time!",
        codeContext: {
          language: "python",
          code: `new_node = Node(15)\nnew_node.next = curr.next\ncurr.next = new_node`,
          highlightLines: [3],
        },
        highlights: ["new-node", "ll-main-0"],
        operations: [
          {
            type: "create_arrow",
            id: "edge-10-to-new",
            from: "ll-main-0",
            to: "new-node",
            style: { color: "primary" },
          },
        ],
      },
    ],
  };
}

// ============================================================================
// AVL Tree Rotation Visual Lesson
// ============================================================================

export function getAVLVisualLesson(): VisualLesson {
  return {
    id: "lesson-avl-rotation",
    title: "AVL Tree: Left-Left Imbalance & Right Rotation",
    concept: "AVL Tree Rotations",
    domain: {
      id: "avl-domain",
      type: "tree",
      label: "AVL Tree (Self-Balancing BST)",
    },
    initialScene: [
      {
        type: "create_tree",
        id: "avl-tree",
        label: "AVL Tree: Insertion of 30, 20, 10 Causes Imbalance",
        root: "n30",
        nodes: [
          { id: "n30", value: 30, left: "n20", highlight: "low" },
          { id: "n20", value: 20, left: "n10", highlight: "mid" },
          { id: "n10", value: 10, highlight: "high" },
        ],
      },
    ],
    transformations: [
      {
        id: "avl-t1",
        title: "Detect Imbalance: Balance Factor at Root = +2",
        explanation:
          "Height of left subtree = 2, height of right subtree = 0. Balance Factor = 2 - 0 = +2 (Left-Heavy). Left child has BF +1 (LL case).",
        codeContext: {
          language: "python",
          code: `def right_rotate(y):\n    x = y.left\n    T2 = x.right\n    x.right = y\n    y.left = T2\n    return x`,
          highlightLines: [1, 2],
        },
        highlights: ["avl-tree-n30"],
        operations: [
          {
            type: "highlight",
            target: "avl-tree-n30",
            color: "warning",
            emphasis: "pulse",
            message: "Imbalance detected (BF = +2)",
          },
        ],
      },
      {
        id: "avl-t2",
        title: "Perform Right Rotation at Node 30",
        explanation:
          "Node 20 becomes the new root. Node 30 becomes right child of node 20. Tree is now balanced with height 2!",
        codeContext: {
          language: "python",
          code: `def right_rotate(y):\n    x = y.left\n    T2 = x.right\n    x.right = y\n    y.left = T2\n    return x`,
          highlightLines: [3, 4, 5, 6],
        },
        highlights: ["avl-tree-n20"],
        operations: [
          {
            type: "highlight",
            target: "avl-tree-n20",
            color: "success",
            emphasis: "glow",
          },
        ],
      },
    ],
  };
}

// ============================================================================
// Recursion & Call Stack Visual Lesson
// ============================================================================

export function getRecursionVisualLesson(): VisualLesson {
  return {
    id: "lesson-recursion-factorial",
    title: "Recursion: Factorial Call Stack Execution",
    concept: "Recursion & Call Stack",
    domain: {
      id: "recursion-domain",
      type: "stack",
      label: "Call Stack Execution Frame",
    },
    initialScene: [
      {
        type: "create_stack",
        id: "call-stack",
        label: "Runtime Call Stack: factorial(4)",
        elements: [{ value: "factorial(4): waiting on factorial(3)" }],
      },
    ],
    transformations: [
      {
        id: "rec-t1",
        title: "Push factorial(3) onto Call Stack",
        explanation:
          "factorial(4) evaluates 4 * factorial(3). It suspends execution and pushes a new frame for factorial(3).",
        codeContext: {
          language: "python",
          code: `def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)`,
          highlightLines: [4],
        },
        highlights: ["call-stack"],
        operations: [
          {
            type: "create_stack",
            id: "call-stack",
            label: "Runtime Call Stack: factorial(4)",
            elements: [
              { value: "factorial(4): waiting" },
              { value: "factorial(3): waiting on factorial(2)" },
            ],
          },
        ],
      },
      {
        id: "rec-t2",
        title: "Push factorial(2) and factorial(1) (Base Case)",
        explanation:
          "Frames pushed until n = 1. Base case n <= 1 reached! Returns 1 without further recursion.",
        codeContext: {
          language: "python",
          code: `def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)`,
          highlightLines: [2, 3],
        },
        highlights: ["call-stack"],
        operations: [
          {
            type: "create_stack",
            id: "call-stack",
            label: "Runtime Call Stack: Base Case Reached",
            elements: [
              { value: "factorial(4)" },
              { value: "factorial(3)" },
              { value: "factorial(2)" },
              { value: "factorial(1) -> returns 1" },
            ],
          },
        ],
      },
      {
        id: "rec-t3",
        title: "Unwinding Call Stack: Computing Final Value 24",
        explanation:
          "Stack unwinds: factorial(2) returns 2*1=2. factorial(3) returns 3*2=6. factorial(4) returns 4*6=24. Result = 24.",
        codeContext: {
          language: "python",
          code: `def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)`,
          highlightLines: [4],
        },
        highlights: ["call-stack"],
        operations: [
          {
            type: "create_stack",
            id: "call-stack",
            label: "Runtime Call Stack: Returned 24",
            elements: [{ value: "Result: factorial(4) = 24" }],
          },
        ],
      },
    ],
  };
}
