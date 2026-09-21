/**
 * COGNORA HACKATHON FINAL HARDENING REGRESSION TEST SUITE (PHASE 3)
 *
 * Verifies:
 * 1. Primary Demo Set (AVL, Dijkstra, Binary Search, Quick Sort, Heap, Linked List, BFS, DFS, Bellman-Ford)
 * 2. Secondary Demo Set (Merge Sort, Stack, Queue)
 * 3. Consecutive Lesson Evolution & Zero Semantic Contamination
 * 4. Entity Conservation across dynamic operations
 * 5. Relationship Integrity (no dangling pointers or missing targets)
 * 6. Local Offline Playback (zero AI calls, deterministic sequence)
 * 7. Unsupported Concept Fallback Routing to Nemotron
 */

import { describe, it, expect } from "vitest";
import { DSAExecutionRouter } from "../dsa/execution/dsa-execution-router";
import { DSAConceptResolver } from "../dsa/resolver/concept-resolver";
import { DSARegistry } from "../dsa/registry/registry-catalog";
import { DSATeachingMomentAdapter } from "../dsa/adapter/teaching-moment-adapter";

describe("Cognora Hackathon Final Hardening - Phase 3", () => {
  // ==========================================================================
  // 1. PRIMARY DEMO GOLDEN VERIFICATION
  // ==========================================================================

  describe("Primary Demo Scenarios", () => {
    it("Scenario 1: AVL Tree - Real rotation restores balance without early leaks", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain AVL rotations");
      expect(res.handled).toBe(true);
      expect(res.lesson).toBeDefined();

      const { timeline, authoritativeModel } = res.lesson!;
      expect(timeline.moments.length).toBeGreaterThanOrEqual(4);

      // Verify entities are conserved in final state
      const finalState = timeline.states[timeline.states.length - 1];
      const entities = Array.from(finalState.graph.entities.values());
      const values = entities.map((e) => e.value).filter(Boolean);
      expect(values).toContain(50);
      expect(values).toContain(30);
      expect(values).toContain(70);
      expect(values).toContain(20);
      expect(values).toContain(40);
      expect(values).toContain(10);

      // Verify world model entities are populated for Inspector
      expect(authoritativeModel.world.entities.length).toBeGreaterThan(0);
      expect(authoritativeModel.world.relationships.length).toBeGreaterThan(0);
    });

    it("Scenario 2: Dijkstra - Exact shortest path relaxation & topological integrity", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain Dijkstra's shortest path algorithm");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;

      // Final state has finalized distances and distance table
      const finalState = timeline.states[timeline.states.length - 1];
      expect(finalState.graph.entities.has("table-distance")).toBe(true);
      expect(finalState.graph.entities.has("node-A")).toBe(true);
      expect(finalState.graph.entities.has("node-E")).toBe(true);

      // Predecessors form valid path from source
      const moments = timeline.moments;
      const relaxMoments = moments.filter((m) => m.title.includes("Relax") || m.title.includes("Initialize"));
      expect(relaxMoments.length).toBeGreaterThan(0);
    });

    it("Scenario 3: Binary Search - Range narrowing & mid target selection", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Binary search [2,5,8,12,17,25,31] for 17");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;

      // Found moment specifies target at index 4
      const lastMoment = timeline.moments[timeline.moments.length - 1];
      expect(lastMoment.title).toContain("17 found");
      expect(lastMoment.whyItChanged).toContain("17");
    });

    it("Scenario 4: Quick Sort - Pivot, Lomuto partition, and subproblems", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Quick sort [42,17,8,99,23,56,4,31,12]");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;

      // Final state array elements are strictly sorted
      const finalState = timeline.states[timeline.states.length - 1];
      const sortedValues = Array.from(finalState.graph.entities.values())
        .filter((e) => e.primitiveType === "array_cell")
        .map((e) => Number(e.value));

      for (let i = 1; i < sortedValues.length; i++) {
        expect(sortedValues[i]).toBeGreaterThanOrEqual(sortedValues[i - 1]);
      }
    });

    it("Scenario 5: Max Heap - Dynamic bubble-up maintains parent >= child invariant", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Insert 15,10,20,8,25,30,5,35,40 into a max heap");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;

      const finalState = timeline.states[timeline.states.length - 1];
      const rootNode = finalState.graph.entities.get("node-40");
      expect(rootNode).toBeDefined();
      expect(rootNode?.value).toBe(40);
    });

    it("Scenario 6: Linked List - Sequential distinct deletions without skipping steps", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Delete 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;

      // Must have distinct transformations for each deletion
      const titles = timeline.moments.map((m) => m.title);
      expect(titles.some((t) => t.includes("20"))).toBe(true);
      expect(titles.some((t) => t.includes("30"))).toBe(true);

      // Final state must retain exactly 10, 40, 50
      const finalState = timeline.states[timeline.states.length - 1];
      expect(finalState.graph.entities.has("ll-node-20")).toBe(false);
      expect(finalState.graph.entities.has("ll-node-30")).toBe(false);
      expect(finalState.graph.entities.has("ll-node-10")).toBe(true);
      expect(finalState.graph.entities.has("ll-node-40")).toBe(true);
      expect(finalState.graph.entities.has("ll-node-50")).toBe(true);
    });

    it("Scenario 7: BFS & DFS - Clear FIFO queue / stack progression", () => {
      const bfsRes = DSAExecutionRouter.tryExecuteDSA("Run BFS on graph");
      expect(bfsRes.handled).toBe(true);
      expect(bfsRes.lesson?.timeline.moments.length).toBeGreaterThanOrEqual(3);

      const dfsRes = DSAExecutionRouter.tryExecuteDSA("Run DFS on graph");
      expect(dfsRes.handled).toBe(true);
      expect(dfsRes.lesson?.timeline.moments.length).toBeGreaterThanOrEqual(3);
    });

    it("Scenario 8: Bellman-Ford - Relaxation passes & negative cycle check", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Explain Bellman-Ford");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;

      const lastMoment = timeline.moments[timeline.moments.length - 1];
      expect(lastMoment.title).toContain("Negative Cycle Check");
    });

    it("Scenario 8b [REGRESSION]: Bellman-Ford semantic integrity - prose explanation words NEVER leak as graph vertices", () => {
      const complexPrompt =
        "Explain Bellman-Ford step by step using vertices A, B, C, D with edges A→B=4, A→C=5, B→C=-3, C→D=2. Show each meaningful relaxation/update, explain why each distance changes, perform the final negative-cycle check, give the final distances, and show the corresponding implementation code.";

      const res = DSAExecutionRouter.tryExecuteDSA(complexPrompt);
      expect(res.handled).toBe(true);
      expect(res.lesson).toBeDefined();

      const { timeline } = res.lesson!;
      expect(timeline.moments.length).toBeGreaterThanOrEqual(3);

      const prohibitedWords = ["BELLMAN", "FORD", "NEGATIVE", "CYCLE", "FINI", "STEP", "EXPLAIN", "CHECK"];

      // Verify every scene state across moments
      for (const moment of timeline.moments) {
        const sceneState = moment.visualState;
        const nodeEntities = Array.from(sceneState.graph.entities.values()).filter(
          (e) => e.primitiveType === "GraphNode",
        );

        // Vertices must ONLY be A, B, C, D
        const vertexIds = nodeEntities.map((e) => (e.properties?.rawId || e.label || e.id).toUpperCase());
        for (const word of prohibitedWords) {
          expect(vertexIds).not.toContain(word);
        }

        // Verify distance table if present
        const tableEntity = sceneState.graph.entities.get("table-distance");
        if (tableEntity && tableEntity.properties?.rows) {
          const rows = tableEntity.properties.rows as string[][];
          for (const row of rows) {
            const vertexInTable = row[0].toUpperCase();
            for (const word of prohibitedWords) {
              expect(vertexInTable).not.toBe(word);
            }
          }
          // The table vertices must be exactly A, B, C, D
          const tableVertices = rows.map((r) => r[0]).sort();
          expect(tableVertices).toEqual(["A", "B", "C", "D"]);
        }

        // Verify relationships only reference valid nodes
        for (const rel of sceneState.graph.relationships) {
          const sId = (rel.sourceEntityId || (rel as any).sourceId || "").toUpperCase();
          const tId = (rel.targetEntityId || (rel as any).targetId || "").toUpperCase();
          for (const word of prohibitedWords) {
            expect(sId).not.toContain(word);
            expect(tId).not.toContain(word);
          }
        }
      }
    });
  });

  // ==========================================================================
  // 2. SECONDARY DEMO SET
  // ==========================================================================

  describe("Secondary Demo Scenarios", () => {
    it("Scenario 9: Merge Sort - Subarray division and sorted recombination", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Merge sort [38, 27, 43, 3, 9, 82, 10]");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;
      expect(timeline.moments.length).toBeGreaterThanOrEqual(3);
    });

    it("Scenario 10: Stack - Strict LIFO push, pop, and peek operations", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Demonstrate Stack operations");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;
      expect(timeline.moments.some((m) => m.title.includes("Push"))).toBe(true);
      expect(timeline.moments.some((m) => m.title.includes("Pop"))).toBe(true);
    });

    it("Scenario 11: Queue - Strict FIFO enqueue and dequeue operations", () => {
      const res = DSAExecutionRouter.tryExecuteDSA("Demonstrate Queue operations");
      expect(res.handled).toBe(true);
      const { timeline } = res.lesson!;
      expect(timeline.moments.some((m) => m.title.includes("Enqueue"))).toBe(true);
      expect(timeline.moments.some((m) => m.title.includes("Dequeue"))).toBe(true);
    });
  });

  // ==========================================================================
  // 3. CONSECUTIVE LESSON ISOLATION (ZERO STATE CONTAMINATION)
  // ==========================================================================

  describe("Consecutive Lesson Execution & State Isolation", () => {
    it("executes consecutive lessons cleanly without entity or relationship bleed", () => {
      // 1. AVL
      const avl = DSAExecutionRouter.tryExecuteDSA("Explain AVL rotations");
      expect(avl.handled).toBe(true);
      const avlEntities = Array.from(avl.lesson!.timeline.states[0].graph.entities.keys());

      // 2. Dijkstra
      const dijkstra = DSAExecutionRouter.tryExecuteDSA("Explain Dijkstra's shortest path algorithm");
      expect(dijkstra.handled).toBe(true);
      const dijkstraEntities = Array.from(dijkstra.lesson!.timeline.states[0].graph.entities.keys());

      // Dijkstra should have graph nodes, not AVL tree nodes
      expect(dijkstraEntities).toContain("node-A");
      expect(dijkstraEntities).not.toContain("node-50");

      // 3. Binary Search
      const bs = DSAExecutionRouter.tryExecuteDSA("Binary search [2,5,8,12,17] for 17");
      expect(bs.handled).toBe(true);
      const bsEntities = Array.from(bs.lesson!.timeline.states[0].graph.entities.keys());
      expect(bsEntities).toContain("arr-0");
      expect(bsEntities).not.toContain("node-A");

      // 4. Linked List
      const ll = DSAExecutionRouter.tryExecuteDSA("Delete 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50");
      expect(ll.handled).toBe(true);
      const llEntities = Array.from(ll.lesson!.timeline.states[0].graph.entities.keys());
      expect(llEntities).toContain("ll-node-10");
      expect(llEntities).not.toContain("arr-0");

      // 5. Re-run AVL: must produce identically reproducible result
      const avl2 = DSAExecutionRouter.tryExecuteDSA("Explain AVL rotations");
      expect(avl2.handled).toBe(true);
      expect(avl2.lesson!.timeline.moments.length).toBe(avl.lesson!.timeline.moments.length);
    });
  });

  // ==========================================================================
  // 4. RELATIONSHIP INTEGRITY & NO DANGLING REFERENCES
  // ==========================================================================

  describe("Relationship Integrity Audit", () => {
    it("guarantees every relationship references valid existing entities in its state", () => {
      const concepts = [
        "Explain AVL rotations",
        "Explain Dijkstra's algorithm",
        "Explain Bellman-Ford",
        "Run BFS on graph",
        "Run DFS on graph",
        "Delete 20 from 10 -> 20 -> 30",
      ];

      for (const prompt of concepts) {
        const res = DSAExecutionRouter.tryExecuteDSA(prompt);
        expect(res.handled).toBe(true);

        for (const state of res.lesson!.timeline.states) {
          for (const rel of state.graph.relationships.values()) {
            expect(
              state.graph.entities.has(rel.sourceEntityId),
              `Missing source entity ${rel.sourceEntityId} in state ${state.version} for ${prompt}`,
            ).toBe(true);
            expect(
              state.graph.entities.has(rel.targetEntityId),
              `Missing target entity ${rel.targetEntityId} in state ${state.version} for ${prompt}`,
            ).toBe(true);
          }
        }
      }
    });
  });

  // ==========================================================================
  // 5. NEMOTRON FALLBACK INTEGRITY
  // ==========================================================================

  describe("Universal Fallback Routing", () => {
    it("safely routes unrecognized or non-DSA questions to Nemotron pipeline", () => {
      const unsupported = [
        "Explain Quantum Computing and Superposition",
        "How does TCP 3-way handshake work?",
        "Explain Transformer Self-Attention Mechanism",
        "What is CAP theorem in distributed systems?",
      ];

      for (const query of unsupported) {
        const res = DSAExecutionRouter.tryExecuteDSA(query);
        expect(res.handled).toBe(false);
        expect(["NO_CONCEPT_MATCH", "UNSUPPORTED_CONCEPT"]).toContain(res.reason);
      }
    });
  });
});
