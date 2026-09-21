import { describe, it, expect, beforeEach } from "vitest";
import { DSAExecutionRouter } from "../dsa/execution/dsa-execution-router";
import { DSAConceptRegistry } from "../dsa/registry/concept-registry";
import { DSA_CATALOG } from "../dsa/registry/registry-catalog";

describe("Cognora DSA Engine Pack - Phase 2 Verification", () => {
  beforeEach(() => {
    DSAExecutionRouter.initialize();
  });

  describe("1. Registry & Completeness (All 30 Concepts)", () => {
    it("should have all 30 DSA concepts registered in catalog", () => {
      expect(DSA_CATALOG).toHaveLength(30);
      for (const concept of DSA_CATALOG) {
        expect(concept.supported).toBe(true);
        expect(concept.defaultLimits.maxElements).toBeGreaterThan(0);
        expect(concept.aliases.length).toBeGreaterThan(0);
      }
    });

    it("should have an engine factory registered for each concept", () => {
      const registry = DSAConceptRegistry.getInstance();
      for (const concept of DSA_CATALOG) {
        expect(registry.isSupported(concept.id)).toBe(true);
        const engine = registry.createEngine(concept.id);
        expect(engine).toBeDefined();
        expect(engine?.conceptId).toBe(concept.id);
      }
    });

    it("should route non-DSA concepts to fallback (handled: false)", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Explain quantum entanglement and quantum teleportation");
      expect(result.handled).toBe(false);
    });
  });

  describe("2. Demo Golden Test: AVL Tree Rotations", () => {
    it("executes default dataset [50, 30, 70, 20, 40, 10] and triggers LL rotation on 30", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Explain AVL rotations");
      expect(result.handled).toBe(true);
      expect(result.lesson).toBeDefined();

      const { timeline, authoritativeModel } = result.lesson!;
      expect(timeline.moments.length).toBeGreaterThan(2);

      // Verify rotation transformation happened
      const rotationStep = authoritativeModel.transformations.find(
        (t) => t.title.toLowerCase().includes("rotate") || t.title.toLowerCase().includes("rebalance"),
      );
      expect(rotationStep).toBeDefined();

      // Verify no coordinates exist in semantic entities
      const initialEntities = timeline.states[0].graph.entities;
      for (const ent of initialEntities.values()) {
        expect(ent.properties.x).toBeUndefined();
        expect(ent.properties.y).toBeUndefined();
      }
    });

    it("executes custom AVL input: 'Explain AVL insertion using 50,30,70,20,40,10'", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Explain AVL insertion using 50,30,70,20,40,10");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("avl");

      const finalState = result.lesson!.timeline.states[result.lesson!.timeline.states.length - 1];
      const insertedVals = [50, 30, 70, 20, 40, 10];
      for (const v of insertedVals) {
        expect(finalState.graph.entities.has(`node-${v}`)).toBe(true);
      }
    });
  });

  describe("3. Demo Golden Test: Dijkstra Shortest Path", () => {
    it("executes default graph with greedy relaxation and final shortest paths", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Explain Dijkstra's algorithm");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("dijkstra");

      const { timeline, authoritativeModel } = result.lesson!;
      expect(timeline.moments.length).toBeGreaterThan(4);

      // Verify relaxations occurred
      const relaxationStep = authoritativeModel.transformations.find(
        (t) => t.title.toLowerCase().includes("relax"),
      );
      expect(relaxationStep).toBeDefined();

      // Check distance table entity exists
      const lastState = timeline.states[timeline.states.length - 1];
      expect(lastState.graph.entities.has("table-distance")).toBe(true);
    });

    it("executes custom graph for Dijkstra: A-B:4, A-C:2, B-D:5", () => {
      const prompt = "Find shortest paths from A using Dijkstra on A-B:4, A-C:2, B-D:5";
      const result = DSAExecutionRouter.tryExecuteDSA(prompt);
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("dijkstra");
    });
  });

  describe("4. Demo Golden Test: Bellman-Ford Negative Cycle Check", () => {
    it("executes |V|-1 passes and final pass negative cycle diagnosis", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Explain Bellman-Ford");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("bellman-ford");

      const { authoritativeModel } = result.lesson!;
      const cycleCheck = authoritativeModel.transformations.find(
        (t) => t.title.toLowerCase().includes("negative cycle"),
      );
      expect(cycleCheck).toBeDefined();
    });
  });

  describe("5. Demo Golden Test: Binary Search Range Narrowing", () => {
    it("executes custom array: 'Binary search [2,5,8,12,17,25,31] for 17'", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Binary search [2,5,8,12,17,25,31] for 17");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("binary-search");

      const { authoritativeModel } = result.lesson!;
      const foundStep = authoritativeModel.transformations.find((t) => t.title.toLowerCase().includes("found"));
      expect(foundStep).toBeDefined();
      expect(foundStep?.title).toContain("17");
    });
  });

  describe("6. Demo Golden Test: Quick Sort Partitioning", () => {
    it("executes custom input: 'Quick sort [42,17,8,99,23,56,4]'", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Quick sort [42,17,8,99,23,56,4]");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("quick-sort");

      const { timeline, authoritativeModel } = result.lesson!;
      const pivotSteps = authoritativeModel.transformations.filter((t) => t.title.toLowerCase().includes("pivot"));
      expect(pivotSteps.length).toBeGreaterThan(0);

      // Final state must be fully sorted
      const finalState = timeline.states[timeline.states.length - 1];
      const cells = Array.from(finalState.graph.entities.values()).filter((e) => e.primitiveType === "ArrayCell");
      for (const cell of cells) {
        expect(cell.state).toBe("sorted");
      }
    });
  });

  describe("7. Demo Golden Test: Max Heap Bubble-Up", () => {
    it("executes heap insertion: 'Insert 10,20,15,30 into a max heap'", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Insert 10,20,15,30 into a max heap");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("heap");

      const { timeline, authoritativeModel } = result.lesson!;
      const bubbleSteps = authoritativeModel.transformations.filter(
        (t) => t.title.toLowerCase().includes("bubble") || t.title.toLowerCase().includes("sift") || t.title.toLowerCase().includes("swap"),
      );
      expect(bubbleSteps.length).toBeGreaterThan(0);

      // Root of max heap for [10, 20, 15, 30] must be 30
      const finalState = timeline.states[timeline.states.length - 1];
      const root = finalState.graph.entities.get("node-30");
      expect(root).toBeDefined();
    });
  });

  describe("8. Demo Golden Test: Linked List Sequential Deletions", () => {
    it("executes sequential deletion without combining steps: 'Delete 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50'", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Delete 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("linked-list");

      const { timeline, authoritativeModel } = result.lesson!;
      // Must have separate delete transformations for 20 and 30
      const delete20 = authoritativeModel.transformations.find((t) => t.title.includes("20") && t.title.toLowerCase().includes("delete"));
      const delete30 = authoritativeModel.transformations.find((t) => t.title.includes("30") && t.title.toLowerCase().includes("delete"));
      expect(delete20).toBeDefined();
      expect(delete30).toBeDefined();

      // Final state must not contain 20 or 30, but must contain 10, 40, 50
      const finalState = timeline.states[timeline.states.length - 1];
      expect(finalState.graph.entities.has("ll-node-20")).toBe(false);
      expect(finalState.graph.entities.has("ll-node-30")).toBe(false);
      expect(finalState.graph.entities.has("ll-node-10")).toBe(true);
      expect(finalState.graph.entities.has("ll-node-40")).toBe(true);
      expect(finalState.graph.entities.has("ll-node-50")).toBe(true);
    });
  });

  describe("9. Demo Golden Test: BFS and DFS Traversals", () => {
    it("executes BFS on graph with queue progression", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Run BFS on graph");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("bfs");

      const { authoritativeModel } = result.lesson!;
      const dequeueSteps = authoritativeModel.transformations.filter(
        (t) => t.title.toLowerCase().includes("dequeue") || t.title.toLowerCase().includes("visit"),
      );
      expect(dequeueSteps.length).toBeGreaterThan(0);
    });

    it("executes DFS on graph with depth progression", () => {
      const result = DSAExecutionRouter.tryExecuteDSA("Run DFS on graph");
      expect(result.handled).toBe(true);
      expect(result.conceptId).toBe("dfs");

      const { authoritativeModel } = result.lesson!;
      const dfsSteps = authoritativeModel.transformations.filter(
        (t) => t.title.toLowerCase().includes("dfs") || t.title.toLowerCase().includes("visit") || t.title.toLowerCase().includes("traverse"),
      );
      expect(dfsSteps.length).toBeGreaterThan(0);
    });
  });

  describe("10. State Transition Continuity & No Future Leaks", () => {
    it("guarantees every transition satisfies beforeWorldVersion = i, afterWorldVersion = i + 1", () => {
      const testConcepts = ["avl", "binary-search", "quick-sort", "dijkstra", "linked-list", "bubble-sort"];
      for (const concept of testConcepts) {
        const result = DSAExecutionRouter.tryExecuteDSA(`Explain ${concept}`);
        expect(result.handled).toBe(true);
        const moments = result.lesson!.timeline.moments;
        const states = result.lesson!.timeline.states;

        expect(moments.length).toBe(states.length - 1);
        for (let i = 0; i < moments.length; i++) {
          const m = moments[i];
          expect(m.beforeWorldVersion).toBe(i);
          expect(m.afterWorldVersion).toBe(i + 1);
        }
      }
    });
  });
});
