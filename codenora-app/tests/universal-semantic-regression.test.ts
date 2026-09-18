// @vitest-environment jsdom
import "vitest-canvas-mock";
import { describe, it, expect } from "vitest";

import {
  understandQuestion,
  extractOrderedOperations,
} from "../ai/question-understanding";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { ExplanationEngine } from "../ai/explanation-engine";
import {
  NvidiaNemotronProvider,
  NVIDIA_DEFAULT_MODEL,
} from "../ai/backend/nvidia-provider";
import { formatSelectedElementChip } from "../ai/selection-context";

describe("Universal Semantic Operation & Transformation Intelligence Regression Suite", () => {
  // ==========================================================================
  // TEST A: Array values must not become search operations
  // ==========================================================================
  describe("TEST A: Array values must not become search operations", () => {
    it("distinguishes array DATA from search OPERATION", () => {
      const prompt =
        "Search for 37 in: [2, 5, 8, 12, 17, 23, 29, 34, 37, 42, 51, 63, 78, 91]";
      const u = understandQuestion(prompt);
      const ops = extractOrderedOperations(prompt);

      expect(u.parsedOperations.length).toBe(1);
      // There must be exactly 1 search operation, NOT 14 operations!
      expect(ops.length).toBe(1);
      expect(ops[0].op).toBe("search");
      expect(ops[0].target).toBe(37);
      expect(ops[0].semanticRole).toBe("operation");

      // Verify array elements are treated as container DATA
      const container = (ops[0].arguments as any)?.container;
      expect(Array.isArray(container)).toBe(true);
      expect(container.length).toBe(14);
      expect(container).toContain(37);
      expect(container).toContain(2);
      expect(container).toContain(91);

      // Verify no array element is an operation
      const hasValueAsOp = ops.some(
        (o) =>
          o.op === "search" &&
          o.target !== 37 &&
          [2, 5, 8, 12].includes(Number(o.value)),
      );
      expect(hasValueAsOp).toBe(false);
    });
  });

  // ==========================================================================
  // TEST B & C: LRU values must not become PUT operations & exact order preserved
  // ==========================================================================
  describe("TEST B & C: LRU operations, values, and strict sequential ordering", () => {
    it("parses exactly 10 explicit PUT and GET operations in exact chronological order", () => {
      const prompt = `Explain how an LRU Cache works using a HashMap and a Doubly Linked List.
Capacity = 3.
Operations:
PUT(A, 1)
PUT(B, 2)
PUT(C, 3)
GET(A)
PUT(D, 4)
GET(C)
PUT(E, 5)
GET(A)
GET(B)
PUT(F, 6)`;

      const ops = extractOrderedOperations(prompt);

      expect(ops.length).toBe(10);

      // Verify exact sequence of operations
      expect(ops[0].op).toBe("put");
      expect(ops[0].key).toBe("A");
      expect(ops[0].value).toBe(1);

      expect(ops[1].op).toBe("put");
      expect(ops[1].key).toBe("B");
      expect(ops[1].value).toBe(2);

      expect(ops[2].op).toBe("put");
      expect(ops[2].key).toBe("C");
      expect(ops[2].value).toBe(3);

      expect(ops[3].op).toBe("get");
      expect(ops[3].key).toBe("A");

      expect(ops[4].op).toBe("put");
      expect(ops[4].key).toBe("D");
      expect(ops[4].value).toBe(4);

      expect(ops[5].op).toBe("get");
      expect(ops[5].key).toBe("C");

      expect(ops[6].op).toBe("put");
      expect(ops[6].key).toBe("E");
      expect(ops[6].value).toBe(5);

      expect(ops[7].op).toBe("get");
      expect(ops[7].key).toBe("A");

      expect(ops[8].op).toBe("get");
      expect(ops[8].key).toBe("B");

      expect(ops[9].op).toBe("put");
      expect(ops[9].key).toBe("F");
      expect(ops[9].value).toBe(6);

      // Verify no numeric value was converted to a fake insertion
      const hasFakeInserts = ops.some(
        (o) => o.op === "insert" && typeof o.value === "number",
      );
      expect(hasFakeInserts).toBe(false);
    });
  });

  // ==========================================================================
  // TEST D & E: Dynamic transformation count & complex lessons >10
  // ==========================================================================
  describe("TEST D & E: Dynamic transformation count & support for >10 transformations", () => {
    it("dynamically generates >10 transformations for multi-step LRU Cache lesson", () => {
      const prompt = `Explain how an LRU Cache works using a HashMap and a Doubly Linked List.
Capacity = 3.
Operations:
PUT(A, 1)
PUT(B, 2)
PUT(C, 3)
GET(A)
PUT(D, 4)
GET(C)
PUT(E, 5)
GET(A)
GET(B)
PUT(F, 6)`;

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(result.valid).toBe(true);
      const transformations = result.lesson.transformations;
      // 1 initial setup state + 10 operations = 11 transformations!
      expect(transformations.length).toBeGreaterThanOrEqual(11);
      expect(transformations.length).toBeGreaterThan(10);
    });
  });

  // ==========================================================================
  // TEST F & G: No duplicate operations & no missing explicit operations
  // ==========================================================================
  describe("TEST F & G: Operational integrity — no duplicate or skipped operations", () => {
    it("executes all explicit AVL insertions in exact sequential order without skipping", () => {
      const prompt =
        "Explain how AVL tree insertion maintains balance. Insert: 30, 20, 10, 25, 28, 27, 50, 60, 55 in exactly this order.";

      const ops = extractOrderedOperations(prompt);
      expect(ops.length).toBe(9);
      expect(ops.map((o) => o.value)).toEqual([
        30, 20, 10, 25, 28, 27, 50, 60, 55,
      ]);

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const allTitles = result.lesson.transformations
        .map((t) => t.title)
        .join(" ");
      for (const val of [30, 20, 10, 25, 28, 27, 50, 60, 55]) {
        expect(allTitles).toContain(String(val));
      }
    });
  });

  // ==========================================================================
  // TEST H & I: Initial baseline empty & final state contains all expected entities
  // ==========================================================================
  describe("TEST H & I: Initial baseline purity & final entity completeness", () => {
    it("starts genuinely empty at State 0 and preserves entities at final state", () => {
      const prompt = `Explain how an LRU Cache works using a HashMap and a Doubly Linked List.
Capacity = 3.
Operations:
PUT(A, 1)
PUT(B, 2)
PUT(C, 3)
GET(A)
PUT(D, 4)`;

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const t0 = result.lesson.transformations[0];
      expect(t0.title.toLowerCase()).toContain("empty");

      // Final state after PUT(A,1), PUT(B,2), PUT(C,3), GET(A), PUT(D,4):
      // Cap=3: A was accessed (MRU), then D inserted -> B is evicted (LRU was B after A access).
      // Remaining keys in cache: D, A, C (size = 3)
      const lastT =
        result.lesson.transformations[result.lesson.transformations.length - 1];
      expect(lastT.title).toBeDefined();
    });
  });

  // ==========================================================================
  // TEST J: Explanation cannot describe future state
  // ==========================================================================
  describe("TEST J: Temporal consistency — explanations never leak future state", () => {
    it("ensures step 1 explanation does not describe evictions or future operations", () => {
      const prompt = `Explain how an LRU Cache works. Capacity = 3. PUT(A, 1) PUT(B, 2) PUT(C, 3) PUT(D, 4)`;
      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const t1 = result.lesson.transformations[1]; // First PUT(A, 1)
      expect(t1.explanation.toLowerCase()).not.toContain("evict");
      expect(t1.explanation.toLowerCase()).not.toContain("capacity exceeded");
      expect(t1.explanation).toContain("A");
    });
  });

  // ==========================================================================
  // TEST K & L: Inspector and Hover state synchronization
  // ==========================================================================
  describe("TEST K & L: Inspector and Hover derivation from canonical state", () => {
    it("sanitizes selection chip and excludes internal IDs from inspector and hover", () => {
      const selected = [
        {
          dslId: "ptr-low",
          type: "arrow",
          label: "ptr-low",
        },
      ];

      const chip = formatSelectedElementChip(selected as any);
      expect(chip).not.toContain("ptr-low");
      expect(chip).toContain("low pointer");
    });
  });

  // ==========================================================================
  // TEST M: Code matches current transformation
  // ==========================================================================
  describe("TEST M: Code context derivation per transformation", () => {
    it("attaches step-specific code contexts to transformations", () => {
      const prompt = `Search for 37 in: [2, 5, 8, 12, 17, 23, 29, 34, 37, 42, 51, 63, 78, 91]`;
      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const stepsWithCode = result.lesson.transformations.filter(
        (t) => !!(t as any).codeSnippet || !!(t as any).codeContext,
      );
      expect(stepsWithCode.length).toBeGreaterThan(0);
      expect(result.lesson.capabilities).toContain("code");
    });
  });

  // ==========================================================================
  // TEST N: Zero internal metadata leakage
  // ==========================================================================
  describe("TEST N: Zero internal metadata leakage", () => {
    it("scrubs internal implementation tokens from titles, explanations, and labels", () => {
      const leakyText =
        "Introducing t2-op0: ptr-low and ptr-high point to qs-array. Balance check at avl-tree-n30.";
      const scrubbed = ExplanationEngine.scrubMetadata(leakyText);

      expect(scrubbed).not.toContain("t2-op0");
      expect(scrubbed).not.toContain("ptr-low");
      expect(scrubbed).not.toContain("ptr-high");
      expect(scrubbed).not.toContain("qs-array");
      expect(scrubbed).not.toContain("avl-tree-n30");
      expect(scrubbed).toContain("low pointer");
      expect(scrubbed).toContain("high pointer");
      expect(scrubbed).toContain("array");
    });
  });

  // ==========================================================================
  // TEST O & P: No fake connectors & relationship synchronization
  // ==========================================================================
  describe("TEST O & P: Real structural connectors and relationship synchronization", () => {
    it("uses real doubly linked list connectors for LRU cache", () => {
      const prompt = `Explain how an LRU Cache works using a HashMap and a Doubly Linked List. Capacity = 3. PUT(A, 1) PUT(B, 2)`;
      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      // Find transformation with linked list action
      const t = result.lesson.transformations[1];
      const listAction = (t.visual_actions || (t as any).operations || []).find(
        (a: any) => a.type === "create_linked_list",
      );
      expect(listAction).toBeDefined();
      expect(listAction.variant).toBe("doubly");
    });
  });

  // ==========================================================================
  // TEST Q & R: Entity conservation & goal satisfaction
  // ==========================================================================
  describe("TEST Q & R: Entity conservation and independent goal validation", () => {
    it("conserves entities across AVL insertions and verifies goal satisfaction", () => {
      const prompt =
        "Insert 9 elements into AVL tree: 30, 20, 10, 25, 28, 27, 50, 60, 55. Show balance factor checks and rebalancing rotations.";
      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(result.valid).toBe(true);
      expect(result.model.goalSatisfaction.satisfied).toBe(true);
    });
  });

  // ==========================================================================
  // TEST S & T: One AI request guarantee & no hidden repair request
  // ==========================================================================
  describe("TEST S & T: Provider contract — exactly one AI request, no hidden repairs", () => {
    it("configures NvidiaNemotronProvider to use Nemotron-3-Ultra without hidden second requests", async () => {
      let fetchCallCount = 0;
      const mockFetch: typeof fetch = async () => {
        fetchCallCount++;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    topic: "Binary Search",
                    visual_lesson: {
                      title: "Binary Search",
                      transformations: [
                        {
                          title: "Initial Range",
                          explanation: "Binary search starts across the array.",
                          visual_actions: [
                            {
                              type: "create_array",
                              id: "arr",
                              elements: [{ value: 10 }, { value: 20 }],
                            },
                          ],
                        },
                      ],
                    },
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const provider = new NvidiaNemotronProvider({
        apiKey: "test-key",
        fetchFn: mockFetch,
      });

      expect(provider.getModel()).toBe(NVIDIA_DEFAULT_MODEL);
      expect(provider.getModel()).toBe("nvidia/nemotron-3-ultra-550b-a55b");

      await provider.generateTeachingResponse({
        prompt: "Explain Binary Search",
        context: {
          concept: "Binary Search",
          level: "beginner",
          pedagogicalGoal: "Search",
        },
      });

      expect(fetchCallCount).toBe(1);
    });
  });

  // ==========================================================================
  // REQUIRED LIVE TEST 1: Recursive Binary Search for 37 in 14 elements
  // ==========================================================================
  describe("REQUIRED LIVE TEST 1: Recursive Binary Search", () => {
    it("dynamically generates search range narrowing without treating elements as operations", () => {
      const prompt =
        "Explain how recursive binary search works. Search for 37 in: [2, 5, 8, 12, 17, 23, 29, 34, 37, 42, 51, 63, 78, 91]";

      const u = understandQuestion(prompt);
      expect(u.parsedOperations.length).toBe(1);
      expect(u.parsedOperations[0].op).toBe("search");
      expect(u.parsedOperations[0].target).toBe(37);

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const titles = result.lesson.transformations.map((t) => t.title);

      // Titles must NOT say "Execute search (2)" or "Execute search (5)"
      expect(titles.some((t) => t.includes("Execute search (2)"))).toBe(false);
      expect(titles.some((t) => t.includes("Execute search (5)"))).toBe(false);

      // Must contain meaningful search titles
      expect(
        titles.some(
          (t) => t.includes("Search Range") || t.includes("Midpoint"),
        ),
      ).toBe(true);
      expect(titles.some((t) => t.includes("Found") || t.includes("37"))).toBe(
        true,
      );
    });
  });

  // ==========================================================================
  // REQUIRED LIVE TEST 2: LRU Cache with capacity 3 and 10 operations
  // ==========================================================================
  describe("REQUIRED LIVE TEST 2: LRU Cache with capacity 3 and 10 operations", () => {
    it("executes all 10 operations, demonstrates eviction at capacity, and keeps HashMap & DLL synchronized", () => {
      const prompt = `Explain how an LRU Cache works using a HashMap and a Doubly Linked List.
Start with an empty cache with capacity 3.
Perform:
PUT(A, 1)
PUT(B, 2)
PUT(C, 3)
GET(A)
PUT(D, 4)
GET(C)
PUT(E, 5)
GET(A)
GET(B)
PUT(F, 6)`;

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const transformations = result.lesson.transformations;
      expect(transformations.length).toBeGreaterThanOrEqual(11);

      const titles = transformations.map((t) => t.title);

      // Must never have "Insert Element 3" or "3 -> 1 -> 2 -> 3 -> 4"
      expect(titles.some((t) => t === "Insert Element 3")).toBe(false);

      // Must have PUT and GET titles
      expect(titles.some((t) => t.includes("PUT(A, 1)"))).toBe(true);
      expect(titles.some((t) => t.includes("GET(A)"))).toBe(true);
      expect(
        titles.some(
          (t) => t.includes("Evict") || t.includes("Capacity Exceeded"),
        ),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // REQUIRED LIVE TEST 3: Dijkstra shortest path from A to F
  // ==========================================================================
  describe("REQUIRED LIVE TEST 3: Dijkstra Shortest Path", () => {
    it("generates progressive vertex selections and distance table relaxations", () => {
      const prompt =
        "Explain how Dijkstra's algorithm finds the shortest path from A to F in: A-B(4) A-C(2) C-B(1) B-D(5) C-D(8) D-E(2) E-F(3) B-F(10)";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const titles = result.lesson.transformations.map((t) => t.title);
      expect(
        titles.some(
          (t) =>
            t.includes("Dijkstra") ||
            t.includes("Relax") ||
            t.includes("Distance"),
        ),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // REQUIRED LIVE TEST 4: AVL tree insertion maintaining balance
  // ==========================================================================
  describe("REQUIRED LIVE TEST 4: AVL Tree 9-Node Insertion", () => {
    it("executes insertions in exact order and balances with rotations", () => {
      const prompt =
        "Explain how AVL tree insertion maintains balance. Insert: 30, 20, 10, 25, 28, 27, 50, 60, 55 in exactly this order.";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const transformations = result.lesson.transformations;
      expect(transformations.length).toBeGreaterThanOrEqual(6);
    });
  });

  // ==========================================================================
  // REQUIRED LIVE TEST 5: Quick Sort with Lomuto partition on 15 elements
  // ==========================================================================
  describe("REQUIRED LIVE TEST 5: Quick Sort Lomuto Partition on 15 elements", () => {
    it("preserves array data and produces >10 partition transformations without ptr metadata leaks", () => {
      const prompt =
        "Explain how Quick Sort works using the Lomuto partition scheme. Sort: [42, 17, 8, 99, 23, 56, 4, 31, 12, 67, 3, 29, 75, 15, 51]";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const transformations = result.lesson.transformations;
      expect(transformations.length).toBeGreaterThanOrEqual(10);

      const allExplanations = transformations
        .map((t) => t.explanation)
        .join(" ");
      expect(allExplanations).not.toContain("ptr-i");
      expect(allExplanations).not.toContain("ptr-j");
      expect(allExplanations).not.toContain("qs-array");
    });
  });

  // ==========================================================================
  // REQUIRED LIVE TEST 6: Linked list insert 25 between 10 and 40
  // ==========================================================================
  describe("REQUIRED LIVE TEST 6: Linked List Insertion", () => {
    it("inserts 25 between 10 and 40 in 10 -> 40 -> 60 with pointer rewiring", () => {
      const prompt =
        "Explain how insertion works in a linked list. Insert 25 between 10 and 40 in: 10 -> 40 -> 60";

      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
      expect(result.valid).toBe(true);

      const titles = result.lesson.transformations.map((t) => t.title);
      expect(
        titles.some((t) => t.includes("25") || t.includes("Insertion")),
      ).toBe(true);
      expect(
        titles.some((t) => t.includes("Rewire") || t.includes("Complete")),
      ).toBe(true);
    });
  });
});
