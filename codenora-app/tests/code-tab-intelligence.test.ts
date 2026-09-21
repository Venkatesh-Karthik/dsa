/**
 * Code Tab Intelligence Layer — Regression & Verification Tests
 */

import { describe, it, expect } from "vitest";
import { resolveCodeArtifact, normalizeConceptId } from "../dsa/code/code-provider";
import { DSA_CODE_CATALOG } from "../dsa/code/code-catalog";
import type { SupportedLanguage } from "../dsa/code/code-types";

describe("Code Tab Intelligence Layer", () => {
  const primaryAlgorithms = [
    {
      conceptId: "avl-tree",
      identifiers: {
        python: ["class AVLNode", "def right_rotate", "def left_rotate", "def insert", "get_balance"],
        javascript: ["class AVLNode", "function rightRotate", "function leftRotate", "function insert"],
        java: ["public class AVLTree", "Node rightRotate", "Node leftRotate", "Node insert"],
        cpp: ["struct Node", "Node *rightRotate", "Node *leftRotate", "Node *insert"],
      },
      testTransformation: "ROTATE_RIGHT",
    },
    {
      conceptId: "dijkstra",
      identifiers: {
        python: ["def dijkstra", "heapq", "distances", "predecessors"],
        javascript: ["function dijkstra", "distances", "predecessors"],
        java: ["public class Dijkstra", "PriorityQueue", "dijkstra"],
        cpp: ["priority_queue", "dijkstra", "unordered_map"],
      },
      testTransformation: "RELAX_EDGE",
    },
    {
      conceptId: "bellman-ford",
      identifiers: {
        python: ["def bellman_ford", "range(V - 1)", "negative-weight cycle"],
        javascript: ["function bellmanFord", "for (let i = 0; i < V - 1", "negative-weight cycle"],
        java: ["public class BellmanFord", "Negative cycle detected"],
        cpp: ["bellmanFord", "negative-weight cycle"],
      },
      testTransformation: "RELAX_EDGE",
    },
    {
      conceptId: "binary-search",
      identifiers: {
        python: ["def binary_search", "low = 0", "mid = (low + high) // 2"],
        javascript: ["function binarySearch", "Math.floor((low + high) / 2)"],
        java: ["public class BinarySearch", "mid = low + (high - low) / 2"],
        cpp: ["int binarySearch", "mid = low + (high - low) / 2"],
      },
      testTransformation: "SELECT_MID",
    },
    {
      conceptId: "quick-sort",
      identifiers: {
        python: ["def partition", "def quick_sort", "pivot = arr[high]"],
        javascript: ["function partition", "function quickSort"],
        java: ["public class QuickSort", "static int partition", "quickSort"],
        cpp: ["int partition", "void quickSort"],
      },
      testTransformation: "PARTITION",
    },
    {
      conceptId: "merge-sort",
      identifiers: {
        python: ["def merge", "def merge_sort"],
        javascript: ["function merge", "function mergeSort"],
        java: ["public class MergeSort", "static void merge"],
        cpp: ["void merge", "void mergeSort"],
      },
      testTransformation: "MERGE",
    },
    {
      conceptId: "binary-heap",
      identifiers: {
        python: ["class MaxHeap", "def insert", "def _sift_up"],
        javascript: ["class MaxHeap", "insert", "siftUp"],
        java: ["public class MaxHeap", "public void insert", "siftUp"],
        cpp: ["class MaxHeap", "void insert", "siftUp"],
      },
      testTransformation: "SIFT_UP",
    },
    {
      conceptId: "singly-linked-list",
      identifiers: {
        python: ["class ListNode", "class LinkedList", "def delete_value"],
        javascript: ["class ListNode", "class LinkedList", "deleteValue"],
        java: ["public class LinkedList", "deleteValue"],
        cpp: ["struct Node", "class LinkedList", "deleteValue"],
      },
      testTransformation: "DELETE_NODE",
    },
    {
      conceptId: "bfs",
      identifiers: {
        python: ["def bfs", "queue = deque", "visited"],
        javascript: ["function bfs", "queue.shift()", "visited"],
        java: ["public class BFS", "Queue<String>", "poll()"],
        cpp: ["vector<string> bfs", "queue<string>", "pop()"],
      },
      testTransformation: "DEQUEUE",
    },
    {
      conceptId: "dfs",
      identifiers: {
        python: ["def dfs", "visited.add"],
        javascript: ["function dfs", "visited.add"],
        java: ["public class DFS", "dfs("],
        cpp: ["void dfs", "visited.insert"],
      },
      testTransformation: "VISIT",
    },
    {
      conceptId: "stack",
      identifiers: {
        python: ["class Stack", "def push", "def pop", "def peek"],
        javascript: ["class Stack", "push", "pop", "peek"],
        java: ["public class Stack", "push", "pop", "peek"],
        cpp: ["class Stack", "push", "pop", "peek"],
      },
      testTransformation: "PUSH",
    },
    {
      conceptId: "queue",
      identifiers: {
        python: ["class Queue", "def enqueue", "def dequeue", "def peek"],
        javascript: ["class Queue", "enqueue", "dequeue", "peek"],
        java: ["public class Queue", "enqueue", "dequeue", "peek"],
        cpp: ["class Queue", "enqueue", "dequeue", "peek"],
      },
      testTransformation: "ENQUEUE",
    },
  ];

  const languages: SupportedLanguage[] = ["python", "javascript", "java", "cpp"];

  for (const algo of primaryAlgorithms) {
    describe(`Algorithm: ${algo.conceptId}`, () => {
      for (const lang of languages) {
        it(`generates non-empty, valid ${lang} implementation without placeholder strings`, () => {
          const artifact = resolveCodeArtifact({
            conceptId: algo.conceptId,
            language: lang,
            transformationType: algo.testTransformation,
          });

          expect(artifact).toBeDefined();
          expect(artifact.conceptId).toBe(algo.conceptId);
          expect(artifact.language).toBe(lang);
          expect(artifact.source.length).toBeGreaterThan(50);

          // Must never contain placeholder text
          expect(artifact.source).not.toContain("# Code implementation for active lesson step");
          expect(artifact.source).not.toContain("TODO: implement");

          // Must contain expected algorithm-specific identifiers
          const expectedIdentifiers = algo.identifiers[lang];
          for (const ident of expectedIdentifiers) {
            expect(artifact.source).toContain(ident);
          }

          // Must provide highlight lines
          expect(artifact.highlightLines).toBeDefined();
          expect(Array.isArray(artifact.highlightLines)).toBe(true);
          expect(artifact.highlightLines!.length).toBeGreaterThan(0);
        });
      }
    });
  }

  describe("Custom User Input Representation", () => {
    it("injects custom array and target into Binary Search code", () => {
      const customArray = [3, 7, 11, 19, 29, 43, 61];
      const customTarget = 29;

      const artifact = resolveCodeArtifact({
        conceptId: "binary-search",
        language: "python",
        input: { array: customArray, target: customTarget },
      });

      expect(artifact.source).toContain("3, 7, 11, 19, 29, 43, 61");
      expect(artifact.source).toContain("target = 29");
    });

    it("injects custom insertion keys into AVL Tree code", () => {
      const customKeys = [50, 30, 70, 20, 40, 10];

      const artifact = resolveCodeArtifact({
        conceptId: "avl-tree",
        language: "python",
        input: { values: customKeys },
      });

      expect(artifact.source).toContain("50, 30, 70, 20, 40, 10");
    });

    it("injects custom array into Quick Sort code", () => {
      const customArray = [88, 12, 45, 67, 3, 91];

      const artifact = resolveCodeArtifact({
        conceptId: "quick-sort",
        language: "javascript",
        input: { array: customArray },
      });

      expect(artifact.source).toContain("88, 12, 45, 67, 3, 91");
    });
  });

  describe("Transformation Highlighting Mapping", () => {
    it("maps ROTATE_RIGHT to right_rotate function lines in AVL Python", () => {
      const artifact = resolveCodeArtifact({
        conceptId: "avl-tree",
        language: "python",
        transformationType: "ROTATE_RIGHT",
      });

      expect(artifact.highlightLines).toBeDefined();
      expect(artifact.highlightLines).toContain(14);
    });

    it("maps RELAX_EDGE to edge relaxation lines in Dijkstra", () => {
      const artifact = resolveCodeArtifact({
        conceptId: "dijkstra",
        language: "python",
        transformationType: "RELAX_EDGE",
      });

      expect(artifact.highlightLines).toBeDefined();
      expect(artifact.highlightLines).toContain(21);
    });

    it("maps PARTITION to partition loop lines in Quick Sort", () => {
      const artifact = resolveCodeArtifact({
        conceptId: "quick-sort",
        language: "python",
        transformationType: "PARTITION",
      });

      expect(artifact.highlightLines).toBeDefined();
      expect(artifact.highlightLines).toContain(2);
    });
  });

  describe("Natural Language Intent Normalization", () => {
    it("resolves 'Explain AVL rotations' to avl-tree", () => {
      expect(normalizeConceptId("Explain AVL rotations")).toBe("avl-tree");
    });

    it("resolves 'Explain Dijkstra\\'s shortest path algorithm' to dijkstra", () => {
      expect(normalizeConceptId("Explain Dijkstra's shortest path algorithm")).toBe("dijkstra");
    });

    it("resolves 'Explain Bellman-Ford' to bellman-ford", () => {
      expect(normalizeConceptId("Explain Bellman-Ford")).toBe("bellman-ford");
    });

    it("resolves 'Binary search [2,5,8,12,17] for 17' to binary-search", () => {
      expect(normalizeConceptId("Binary search [2,5,8,12,17] for 17")).toBe("binary-search");
    });
  });

  describe("Conceptual / Non-Code Fallback Safety", () => {
    it("returns clean educational message for general theoretical lessons", () => {
      const artifact = resolveCodeArtifact({
        conceptId: "conceptual",
        title: "Software Engineering Principles",
        language: "python",
      });

      expect(artifact.source).not.toContain("# Code implementation for active lesson step");
      expect(artifact.source).toContain("Cognora Code Inspector");
      expect(artifact.source).toContain("conceptual");
    });
  });
});
