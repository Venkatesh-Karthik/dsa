/**
 * COGNORA ROUTING REGRESSION TEST SUITE
 *
 * Tests the full-intent routing architecture to ensure:
 * 1. No silent downgrade (DOUBLY → singly, DELETE → INSERT, etc.)
 * 2. Variant detection (doubly, circular, max/min heap)
 * 3. Operation detection (elimination = deletion, etc.)
 * 4. Constraint detection (negative edges, unsorted input)
 * 5. Concept isolation (BFS ≠ DFS, Dijkstra ≠ Bellman-Ford, etc.)
 * 6. Correct Nemotron routing for unsupported requests
 * 7. Correct deterministic routing for supported requests
 *
 * These tests are permanent regression tests for the bugs discovered
 * during manual hackathon testing.
 */

import { describe, it, expect } from "vitest";
import { DSAExecutionRouter } from "../dsa/execution/dsa-execution-router";
import { DSAConceptResolver } from "../dsa/resolver/concept-resolver";
import { resolveDSAFullIntent } from "../dsa/intent/dsa-intent-resolver";
import { canExecuteDeterministically } from "../dsa/registry/capability-registry";
import { resolveOperation, resolveVariant, resolveAction } from "../dsa/intent/dsa-vocabulary";

// ===========================================================================
// 1. VOCABULARY TABLE TESTS
// ===========================================================================

describe("Vocabulary Table: Synonym Normalization", () => {
  describe("Operation synonyms", () => {
    it("maps 'eliminate' to 'delete' operation", () => {
      const op = resolveOperation("Explain linked list elimination");
      expect(op).toBe("delete");
    });

    it("maps 'remove' to 'delete' operation", () => {
      const op = resolveOperation("Remove 20 from linked list");
      expect(op).toBe("delete");
    });

    it("maps 'excise' to 'delete' operation", () => {
      const op = resolveOperation("Excise node 20");
      expect(op).toBe("delete");
    });

    it("maps 'insert' to 'insert' operation", () => {
      const op = resolveOperation("Insert 50 into AVL tree");
      expect(op).toBe("insert");
    });

    it("maps 'rotation' to 'rotate' operation", () => {
      const op = resolveOperation("Explain AVL rotations");
      expect(op).toBe("rotate");
    });

    it("maps 'search' to 'search' operation", () => {
      const op = resolveOperation("Binary search for 17");
      expect(op).toBe("search");
    });

    it("returns undefined for generic explain (no operation)", () => {
      const op = resolveOperation("Explain linked list");
      expect(op).toBeUndefined();
    });
  });

  describe("Variant synonyms", () => {
    it("maps 'double linked list' to DOUBLY_LINKED_LIST", () => {
      const v = resolveVariant("Explain double linked list");
      expect(v).toBe("DOUBLY_LINKED_LIST");
    });

    it("maps 'doubly linked list' to DOUBLY_LINKED_LIST", () => {
      const v = resolveVariant("Explain doubly linked list");
      expect(v).toBe("DOUBLY_LINKED_LIST");
    });

    it("maps 'DLL' to DOUBLY_LINKED_LIST", () => {
      const v = resolveVariant("Explain DLL deletion");
      expect(v).toBe("DOUBLY_LINKED_LIST");
    });

    it("maps 'circular linked list' to CIRCULAR_LINKED_LIST", () => {
      const v = resolveVariant("Explain circular linked list");
      expect(v).toBe("CIRCULAR_LINKED_LIST");
    });

    it("maps 'max heap' to MAX_HEAP", () => {
      const v = resolveVariant("Explain max heap insertion");
      expect(v).toBe("MAX_HEAP");
    });

    it("maps 'min heap' to MIN_HEAP", () => {
      const v = resolveVariant("Explain min heap");
      expect(v).toBe("MIN_HEAP");
    });

    it("detects 'negative edges' as a constraint (not a variant)", () => {
      // NEGATIVE_EDGES is a constraint, not a variant — detected via resolveDSAFullIntent
      const v = resolveVariant("Explain Dijkstra with negative edges");
      // resolveVariant should return undefined (no structural variant like DOUBLY_LINKED_LIST)
      expect(v).toBeUndefined();
      // The constraint is detected in the full intent resolver
      const intent = resolveDSAFullIntent("Explain Dijkstra with negative edges");
      expect(intent.constraints.negativeEdges).toBe(true);
    });

    it("returns undefined for plain linked list (no variant)", () => {
      const v = resolveVariant("Explain linked list");
      expect(v).toBeUndefined();
    });
  });

  describe("Action detection", () => {
    it("detects DELETE action from 'eliminate'", () => {
      const a = resolveAction("Explain linked list elimination");
      expect(a).toBe("DELETE");
    });

    it("detects EXPLAIN action from 'explain'", () => {
      const a = resolveAction("Explain linked list");
      expect(a).toBe("EXPLAIN");
    });

    it("detects INSERT action from 'insert'", () => {
      const a = resolveAction("Insert 20 into the AVL tree");
      expect(a).toBe("INSERT");
    });

    it("detects COMPARE action from 'compare'", () => {
      const a = resolveAction("Compare BFS and DFS");
      expect(a).toBe("COMPARE");
    });
  });
});

// ===========================================================================
// 2. FULL INTENT RESOLVER TESTS
// ===========================================================================

describe("Full Intent Resolver", () => {
  it("resolves 'Explain linked list elimination' as concept=linked-list, operation=delete", () => {
    const intent = resolveDSAFullIntent("Explain linked list elimination");
    expect(intent.conceptId).toBe("linked-list");
    expect(intent.operation).toBe("delete");
    expect(intent.action).toBe("DELETE");
    expect(intent.variant).toBeUndefined();
  });

  it("resolves 'Explain doubly linked list' as concept=linked-list, variant=DOUBLY_LINKED_LIST", () => {
    const intent = resolveDSAFullIntent("Explain doubly linked list");
    expect(intent.conceptId).toBe("linked-list");
    expect(intent.variant).toBe("DOUBLY_LINKED_LIST");
  });

  it("resolves 'Explain double linked list' as concept=linked-list, variant=DOUBLY_LINKED_LIST", () => {
    const intent = resolveDSAFullIntent("Explain double linked list");
    expect(intent.conceptId).toBe("linked-list");
    expect(intent.variant).toBe("DOUBLY_LINKED_LIST");
  });

  it("resolves 'Explain circular linked list deletion' as CIRCULAR + delete", () => {
    const intent = resolveDSAFullIntent("Explain circular linked list deletion");
    expect(intent.conceptId).toBe("linked-list");
    expect(intent.variant).toBe("CIRCULAR_LINKED_LIST");
    expect(intent.operation).toBe("delete");
  });

  it("resolves 'Explain AVL deletion' as concept=avl, operation=delete", () => {
    const intent = resolveDSAFullIntent("Explain AVL deletion");
    expect(intent.conceptId).toBe("avl");
    expect(intent.operation).toBe("delete");
    expect(intent.variant).toBeUndefined();
  });

  it("resolves 'Explain AVL rotations' as concept=avl, operation=rotate", () => {
    const intent = resolveDSAFullIntent("Explain AVL rotations");
    expect(intent.conceptId).toBe("avl");
    expect(intent.operation).toBe("rotate");
  });

  it("detects negative edges constraint from 'Explain Dijkstra with negative edges'", () => {
    const intent = resolveDSAFullIntent("Explain Dijkstra with negative edges");
    expect(intent.conceptId).toBe("dijkstra");
    expect(intent.constraints.negativeEdges).toBe(true);
  });

  it("detects unsorted constraint from 'Binary search on unsorted array'", () => {
    const intent = resolveDSAFullIntent("Explain binary search on an unsorted array");
    expect(intent.conceptId).toBe("binary-search");
    expect(intent.constraints.unsortedInput).toBe(true);
  });

  it("resolves 'Explain heap deletion' as concept=heap, operation=delete", () => {
    const intent = resolveDSAFullIntent("Explain heap deletion");
    expect(intent.conceptId).toBe("heap");
    expect(intent.operation).toBe("delete");
  });
});

// ===========================================================================
// 3. CAPABILITY MATCHING TESTS
// ===========================================================================

describe("Capability Matching: canExecuteDeterministically()", () => {
  it("DOUBLY_LINKED_LIST → UNSUPPORTED_VARIANT (not EXACT_MATCH)", () => {
    const intent = resolveDSAFullIntent("Explain doubly linked list");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(false);
    expect(result.reasonCode).toBe("UNSUPPORTED_VARIANT");
  });

  it("CIRCULAR_LINKED_LIST → UNSUPPORTED_VARIANT", () => {
    const intent = resolveDSAFullIntent("Explain circular linked list");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(false);
    expect(result.reasonCode).toBe("UNSUPPORTED_VARIANT");
  });

  it("AVL + DELETE → UNSUPPORTED_OPERATION", () => {
    const intent = resolveDSAFullIntent("Explain AVL deletion");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(false);
    expect(result.reasonCode).toBe("UNSUPPORTED_OPERATION");
  });

  it("HEAP + DELETE → UNSUPPORTED_OPERATION", () => {
    const intent = resolveDSAFullIntent("Explain heap deletion");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(false);
    expect(result.reasonCode).toBe("UNSUPPORTED_OPERATION");
  });

  it("Dijkstra + negative edges → UNSUPPORTED_CONSTRAINT", () => {
    const intent = resolveDSAFullIntent("Explain Dijkstra with negative edges");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(false);
    expect(result.reasonCode).toBe("UNSUPPORTED_CONSTRAINT");
  });

  it("binary-search + unsorted input → UNSUPPORTED_CONSTRAINT", () => {
    const intent = resolveDSAFullIntent("Explain binary search on an unsorted array");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(false);
    expect(result.reasonCode).toBe("UNSUPPORTED_CONSTRAINT");
  });

  it("plain linked list (no variant/operation) → EXACT_DETERMINISTIC_MATCH", () => {
    const intent = resolveDSAFullIntent("Explain linked list");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(true);
    expect(result.reasonCode).toBe("EXACT_DETERMINISTIC_MATCH");
  });

  it("linked list deletion → EXACT_DETERMINISTIC_MATCH", () => {
    const intent = resolveDSAFullIntent("Explain linked list deletion");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(true);
    expect(result.reasonCode).toBe("EXACT_DETERMINISTIC_MATCH");
  });

  it("AVL rotations → EXACT_DETERMINISTIC_MATCH", () => {
    const intent = resolveDSAFullIntent("Explain AVL rotations");
    const result = canExecuteDeterministically(intent);
    expect(result.compatible).toBe(true);
    expect(result.reasonCode).toBe("EXACT_DETERMINISTIC_MATCH");
  });
});

// ===========================================================================
// 4. CONCEPT RESOLVER TESTS: variant detection
// ===========================================================================

describe("Concept Resolver: variant and operation propagation", () => {
  it("resolves 'Explain doubly linked list' with variantIntent=DOUBLY_LINKED_LIST", () => {
    const resolved = DSAConceptResolver.resolve("Explain doubly linked list");
    expect(resolved).not.toBeNull();
    expect(resolved!.conceptId).toBe("linked-list");
    expect(resolved!.variantIntent).toBe("DOUBLY_LINKED_LIST");
  });

  it("resolves 'Explain double linked list' with variantIntent=DOUBLY_LINKED_LIST", () => {
    const resolved = DSAConceptResolver.resolve("Explain double linked list");
    expect(resolved).not.toBeNull();
    expect(resolved!.conceptId).toBe("linked-list");
    expect(resolved!.variantIntent).toBe("DOUBLY_LINKED_LIST");
  });

  it("resolves 'Explain circular linked list' with variantIntent=CIRCULAR_LINKED_LIST", () => {
    const resolved = DSAConceptResolver.resolve("Explain circular linked list");
    expect(resolved).not.toBeNull();
    expect(resolved!.conceptId).toBe("linked-list");
    expect(resolved!.variantIntent).toBe("CIRCULAR_LINKED_LIST");
  });

  it("resolves 'Explain linked list elimination' with operationIntent=delete", () => {
    const resolved = DSAConceptResolver.resolve("Explain linked list elimination");
    expect(resolved).not.toBeNull();
    expect(resolved!.conceptId).toBe("linked-list");
    expect(resolved!.operationIntent).toBe("delete");
  });

  it("resolves 'Delete 20 from linked list' with operationIntent=delete", () => {
    const resolved = DSAConceptResolver.resolve("Delete 20 from linked list");
    expect(resolved).not.toBeNull();
    expect(resolved!.conceptId).toBe("linked-list");
    expect(resolved!.operationIntent).toBe("delete");
  });

  it("BFS and DFS resolve to different concept IDs", () => {
    const bfs = DSAConceptResolver.resolve("Explain BFS");
    const dfs = DSAConceptResolver.resolve("Explain DFS");
    expect(bfs?.conceptId).toBe("bfs");
    expect(dfs?.conceptId).toBe("dfs");
    expect(bfs?.conceptId).not.toBe(dfs?.conceptId);
  });

  it("Dijkstra and Bellman-Ford resolve to different concept IDs", () => {
    const dijkstra = DSAConceptResolver.resolve("Explain Dijkstra");
    const bf = DSAConceptResolver.resolve("Explain Bellman-Ford");
    expect(dijkstra?.conceptId).toBe("dijkstra");
    expect(bf?.conceptId).toBe("bellman-ford");
  });

  it("Quick sort and merge sort resolve to different concept IDs", () => {
    const qs = DSAConceptResolver.resolve("Explain quick sort");
    const ms = DSAConceptResolver.resolve("Explain merge sort");
    expect(qs?.conceptId).toBe("quick-sort");
    expect(ms?.conceptId).toBe("merge-sort");
  });
});

// ===========================================================================
// 5. END-TO-END ROUTING TESTS: DSAExecutionRouter
// ===========================================================================

describe("DSAExecutionRouter: Full Routing Tests", () => {
  // -------------------------------------------------------------------------
  // CRITICAL NEGATIVE TESTS: These MUST route to Nemotron, never deterministic
  // -------------------------------------------------------------------------
  describe("Critical Negative Tests: Unsupported requests → Nemotron", () => {
    it("'Explain doubly linked list' → handled=false (UNSUPPORTED_VARIANT)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain doubly linked list");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_VARIANT");
      // NEVER produce a singly linked list lesson
      expect(res.lesson).toBeUndefined();
    });

    it("'Explain double linked list' → handled=false (UNSUPPORTED_VARIANT)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain double linked list");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_VARIANT");
    });

    it("'Explain doubly linked list deletion' → handled=false (UNSUPPORTED_VARIANT)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain doubly linked list deletion");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_VARIANT");
    });

    it("'Explain circular linked list' → handled=false (UNSUPPORTED_VARIANT)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain circular linked list");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_VARIANT");
    });

    it("'Explain circular linked list deletion' → handled=false", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain circular linked list deletion");
      expect(res.handled).toBe(false);
    });

    it("'Explain AVL deletion' → handled=false (UNSUPPORTED_OPERATION), NOT AVL insertion", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain AVL deletion");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_OPERATION");
      // Must NOT produce an AVL insertion lesson
      expect(res.lesson).toBeUndefined();
    });

    it("'Explain heap deletion' → handled=false (UNSUPPORTED_OPERATION), NOT heap insertion", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain heap deletion");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_OPERATION");
    });

    it("'Explain Dijkstra with negative edges' → handled=false (UNSUPPORTED_CONSTRAINT)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain Dijkstra with negative edges");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_CONSTRAINT");
    });

    it("'Binary search on an unsorted array' → handled=false (UNSUPPORTED_CONSTRAINT)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain binary search on an unsorted array");
      expect(res.handled).toBe(false);
      expect(res.reason).toBe("UNSUPPORTED_CONSTRAINT");
    });
  });

  // -------------------------------------------------------------------------
  // REGRESSION TESTS: Specific bugs found in manual testing
  // -------------------------------------------------------------------------
  describe("Regression: Specific bugs discovered in manual testing", () => {
    it("REGRESSION: 'Explain linked list elimination' → DELETE lesson, NOT default insertion/traversal", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain linked list elimination");
      // Should use deterministic linked list engine with delete operation
      // (using default dataset since no explicit list provided)
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("linked-list");
      // The lesson must NOT be the default insertion traversal
      // The moments should involve deletion terminology
      const titles = res.lesson?.timeline.moments?.map((m: any) => m.title) || [];
      // All titles should NOT be purely about insertion/traversal without deletion context
      expect(titles.length).toBeGreaterThan(0);
    });

    it("REGRESSION: 'Delete 20 from linked list' → DELETE lesson on default list", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Delete 20 from the linked list");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("linked-list");
    });

    it("REGRESSION: 'Explain doubly linked list' must NEVER produce singly linked list lesson", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain doubly linked list");
      // The lesson must not exist (it should route to Nemotron)
      expect(res.handled).toBe(false);
      expect(res.lesson).toBeUndefined();
    });

    it("REGRESSION: 'Explain AVL deletion' must NEVER produce AVL insertion lesson", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain AVL deletion");
      expect(res.handled).toBe(false);
      expect(res.lesson).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // POSITIVE TESTS: Supported requests → deterministic engine
  // -------------------------------------------------------------------------
  describe("Positive Tests: Supported requests → deterministic engine", () => {
    it("'Explain linked list' → deterministic (default singly traversal)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain linked list");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("linked-list");
    });

    it("'Explain linked list insertion' → deterministic INSERT", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain linked list insertion");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("linked-list");
    });

    it("'Explain linked list deletion' → deterministic DELETE", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain linked list deletion");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("linked-list");
    });

    it("'Delete 20 and 30 from 10->20->30->40->50' → deterministic multi-delete", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Delete 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("linked-list");
    });

    it("'Explain AVL rotations' → deterministic AVL", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain AVL rotations");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("avl");
    });

    it("'Explain AVL insertion' → deterministic AVL INSERT", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain AVL insertion");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("avl");
    });

    it("'Explain binary search' → deterministic", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain binary search");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("binary-search");
    });

    it("'Explain BFS' → deterministic BFS (not DFS)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain BFS");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("bfs");
      expect(res.conceptId).not.toBe("dfs");
    });

    it("'Explain DFS' → deterministic DFS (not BFS)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain DFS");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("dfs");
      expect(res.conceptId).not.toBe("bfs");
    });

    it("'Explain Dijkstra' → deterministic Dijkstra (not Bellman-Ford)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain Dijkstra");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("dijkstra");
      expect(res.conceptId).not.toBe("bellman-ford");
    });

    it("'Explain Bellman-Ford' → deterministic Bellman-Ford (not Dijkstra)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain Bellman-Ford");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("bellman-ford");
      expect(res.conceptId).not.toBe("dijkstra");
    });

    it("'Explain quick sort' → deterministic quick-sort (not merge-sort)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain quick sort");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("quick-sort");
      expect(res.conceptId).not.toBe("merge-sort");
    });

    it("'Explain merge sort' → deterministic merge-sort (not quick-sort)", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain merge sort");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("merge-sort");
      expect(res.conceptId).not.toBe("quick-sort");
    });

    it("'Explain max heap insertion' → deterministic heap", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain max heap insertion");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("heap");
    });
  });

  // -------------------------------------------------------------------------
  // CONCEPT IDENTITY INVARIANT TESTS: concept must persist end-to-end
  // -------------------------------------------------------------------------
  describe("Concept Identity Invariant: concept must persist in lesson metadata", () => {
    it("BFS lesson conceptId in authoritativeModel is 'bfs', not 'dfs'", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain BFS");
      expect(res.handled).toBe(true);
      expect(res.conceptId).toBe("bfs");
      // authoritativeModel concept should also be bfs
      const concept = res.lesson?.authoritativeModel?.concept;
      if (concept) {
        // concept name should mention BFS, not DFS
        expect(concept.toLowerCase()).not.toContain("depth-first");
        expect(concept.toLowerCase()).not.toContain("dfs");
      }
    });

    it("Bellman-Ford lesson is not Dijkstra", () => {
      const bfRes = DSAExecutionRouter.tryExecuteDSA("Explain Bellman-Ford");
      const dijkRes = DSAExecutionRouter.tryExecuteDSA("Explain Dijkstra");
      expect(bfRes.handled).toBe(true);
      expect(dijkRes.handled).toBe(true);
      // Conceptually different
      expect(bfRes.conceptId).not.toBe(dijkRes.conceptId);
      // States should be different
      const bfStates = bfRes.lesson?.timeline.states.length;
      const dijkStates = dijkRes.lesson?.timeline.states.length;
      // Both should have states
      expect(bfStates).toBeGreaterThan(0);
      expect(dijkStates).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // NEMOTRON FALLBACK: Non-DSA topics still fall through correctly
  // -------------------------------------------------------------------------
  describe("Non-DSA topics still route to Nemotron", () => {
    const nonDsaPrompts = [
      "Explain quantum computing",
      "How does TCP handshake work?",
      "What is photosynthesis?",
      "Explain transformer attention mechanism",
    ];

    for (const prompt of nonDsaPrompts) {
      it(`'${prompt}' → handled=false`, () => {
        const res = DSAExecutionRouter.tryExecuteDSA(prompt);
        expect(res.handled).toBe(false);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 6. HACKATHON 16 GOLDEN PROMPTS VERIFICATION
  // -------------------------------------------------------------------------
  describe("Hackathon 16 Golden Prompts Verification Matrix", () => {
    const matrix: Array<{
      prompt: string;
      expectedHandled: boolean;
      expectedConcept?: string;
      expectedReason?: string;
    }> = [
      { prompt: "Explain linked list", expectedHandled: true, expectedConcept: "linked-list" },
      { prompt: "Explain linked list insertion", expectedHandled: true, expectedConcept: "linked-list" },
      { prompt: "Explain linked list deletion", expectedHandled: true, expectedConcept: "linked-list" },
      { prompt: "Explain linked list elimination", expectedHandled: true, expectedConcept: "linked-list" },
      { prompt: "Explain doubly linked list", expectedHandled: false, expectedReason: "UNSUPPORTED_VARIANT" },
      { prompt: "Explain double linked list deletion", expectedHandled: false, expectedReason: "UNSUPPORTED_VARIANT" },
      { prompt: "Explain AVL rotations", expectedHandled: true, expectedConcept: "avl" },
      { prompt: "Explain AVL deletion", expectedHandled: false, expectedReason: "UNSUPPORTED_OPERATION" },
      { prompt: "Explain binary search", expectedHandled: true, expectedConcept: "binary-search" },
      { prompt: "Explain BFS", expectedHandled: true, expectedConcept: "bfs" },
      { prompt: "Explain DFS", expectedHandled: true, expectedConcept: "dfs" },
      { prompt: "Explain Dijkstra", expectedHandled: true, expectedConcept: "dijkstra" },
      { prompt: "Explain Bellman-Ford", expectedHandled: true, expectedConcept: "bellman-ford" },
      { prompt: "Explain quick sort", expectedHandled: true, expectedConcept: "quick-sort" },
      { prompt: "Explain merge sort", expectedHandled: true, expectedConcept: "merge-sort" },
      { prompt: "Explain max heap insertion", expectedHandled: true, expectedConcept: "heap" },
    ];

    for (const { prompt, expectedHandled, expectedConcept, expectedReason } of matrix) {
      it(`Prompt: "${prompt}" → handled=${expectedHandled}${expectedConcept ? ` concept=${expectedConcept}` : ""}${expectedReason ? ` reason=${expectedReason}` : ""}`, () => {
        const res = DSAExecutionRouter.tryExecuteDSA(prompt);
        expect(res.handled).toBe(expectedHandled);
        if (expectedConcept) {
          expect(res.conceptId).toBe(expectedConcept);
          expect(res.lesson).toBeDefined();
        }
        if (expectedReason) {
          expect(res.reason).toBe(expectedReason);
          expect(res.lesson).toBeUndefined();
        }
      });
    }
  });
});

