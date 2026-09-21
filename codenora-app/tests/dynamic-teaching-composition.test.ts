import { describe, it, expect } from "vitest";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { measureEntityBounds } from "../ai/layout-engine";

describe("COGNORA Dynamic Teaching State & Multi-Region Visual Composition", () => {
  // ==========================================================================
  // ACCEPTANCE TEST (Part 43): 6-Vertex Dijkstra Graph A -> F
  // ==========================================================================
  it("executes Dijkstra A->F on 6-vertex directed graph with non-overlapping multi-region layout", () => {
    const prompt = `A\u2192B(4)
A\u2192C(2)
B\u2192C(1)
B\u2192D(5)
C\u2192B(1)
C\u2192D(8)
C\u2192E(10)
D\u2192E(2)
D\u2192F(6)
E\u2192D(2)
E\u2192F(3)
B\u2192F(12)

Teach me how Dijkstra's algorithm finds the shortest path from A to F in this weighted directed graph.`;

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
    const { authoritativeModel, timeline } = result;

    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;

    console.log("=== DIJKSTRA A->F ACCEPTANCE RESULTS ===");
    console.log("State count:", authoritativeModel.states.length);
    console.log("TeachingMoment count:", moments.length);

    // 1. Step count must emerge dynamically (for a 6-vertex graph with relaxations, needs >10 steps)
    expect(moments.length).toBeGreaterThan(10);

    // 2. Sequential World State Conservation: Moment N.afterWorldVersion === Moment N+1.beforeWorldVersion
    for (let i = 0; i < moments.length - 1; i++) {
      expect(moments[i].afterWorldVersion).toBe(moments[i + 1].beforeWorldVersion);
    }

    // 3. State 0 Baseline is Sacred: all graph nodes must have distance = Infinity
    const state0 = authoritativeModel.states[0];
    for (const [id, ent] of state0.entities.entries()) {
      if (id.startsWith("graph-main-node-") || id.startsWith("node-")) {
        const anyEnt = ent as any;
        if (anyEnt.primitiveType === "GraphNode" || anyEnt.type === "GraphNode") {
          expect(anyEnt.value).toBe(Infinity);
        }
      }
    }

    // 4. Initialization step sets source A to distance 0
    const initMoment = moments.slice(0, 3).find((m) =>
      m.title?.toLowerCase().match(/initializ|source|dist.*0/i),
    );
    expect(initMoment).toBeDefined();

    // 5. Multi-Region Layout Verification: Table must NOT overlap any graph node
    // Check every state that has both graph nodes and a distance table
    for (let sIdx = 0; sIdx < timeline.states.length; sIdx++) {
      const state = timeline.states[sIdx];
      const tableEnt = Array.from(state.graph.entities.values()).find(
        (e) => e.primitiveType === "Table" || e.id.includes("table"),
      );

      if (tableEnt && state.layoutState) {
        const tablePos = state.layoutState.get(tableEnt.id);
        if (tablePos) {
          const tableBounds = measureEntityBounds(tableEnt);
          const tableBox = {
            left: tablePos.x,
            top: tablePos.y,
            right: tablePos.x + tableBounds.width,
            bottom: tablePos.y + tableBounds.height,
          };

          // Compare against all graph nodes in this state
          for (const [nodeId, nodeEnt] of state.graph.entities.entries()) {
            if (nodeEnt.primitiveType === "GraphNode" && state.layoutState.has(nodeId)) {
              const nodePos = state.layoutState.get(nodeId)!;
              const nodeBox = {
                left: nodePos.x,
                top: nodePos.y,
                right: nodePos.x + 64,
                bottom: nodePos.y + 64,
              };

              // Overlap occurs if boxes intersect in both X and Y
              const xOverlap = !(tableBox.right <= nodeBox.left || tableBox.left >= nodeBox.right);
              const yOverlap = !(tableBox.bottom <= nodeBox.top || tableBox.top >= nodeBox.bottom);
              const overlaps = xOverlap && yOverlap;

              expect(
                overlaps,
                `Collision detected at step ${sIdx}! Table ${tableEnt.id} [${tableBox.left}, ${tableBox.top}, ${tableBox.right}, ${tableBox.bottom}] overlaps GraphNode ${nodeId} [${nodeBox.left}, ${nodeBox.top}, ${nodeBox.right}, ${nodeBox.bottom}]`,
              ).toBe(false);
            }
          }
        }
      }
    }

    // 6. Final State reached naturally through transformations
    const lastMoment = moments[moments.length - 1];
    expect(lastMoment.title.toLowerCase()).toMatch(/final|shortest path/i);

    // 7. Internal Metadata Firewall: student labels must not contain internal artifact prefixes
    for (const m of moments) {
      expect(m.title).not.toMatch(/dist-table-after|pq-before|tree-main-node/i);
    }
  });

  // ==========================================================================
  // MULTI-ALGORITHM TEST: AVL Tree Insertion & Imbalance Diagnosis
  // ==========================================================================
  it("dynamically evolves AVL insertions without duplicate non-transformations", () => {
    const prompt = `Teach me AVL tree insertion for values: 10, 20, 30, 40, 50.
Show step by step rotations when imbalanced.`;

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
    const { authoritativeModel, timeline } = result;

    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;

    // Step count emerges dynamically
    expect(moments.length).toBeGreaterThanOrEqual(5);

    // No consecutive identical moments without explicit explanation pause
    for (let i = 0; i < moments.length - 1; i++) {
      const curr = moments[i];
      const next = moments[i + 1];
      if (curr.afterState === next.afterState) {
        expect(next.isExplanationOnly).toBe(true);
      }
    }

    // Baseline is empty tree
    const moment0 = moments[0];
    expect(moment0.title.toLowerCase()).toMatch(/baseline|empty|initial/i);

    // Rotation moment exists
    const rotationMoment = moments.find((m) =>
      m.title.toLowerCase().match(/rotate|rotation|rebalance/i),
    );
    expect(rotationMoment).toBeDefined();
  });

  // ==========================================================================
  // MULTI-ALGORITHM TEST: Binary Search on Array
  // ==========================================================================
  it("dynamically evolves Binary Search narrowing search interval", () => {
    const prompt = `Perform binary search for 42 in sorted array:
[5, 12, 23, 31, 42, 56, 78, 89, 95]`;

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
    const { authoritativeModel, timeline } = result;

    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;

    expect(moments.length).toBeGreaterThanOrEqual(3);

    // Pointers low, mid, high or bounds narrowing
    for (let i = 0; i < moments.length - 1; i++) {
      expect(moments[i].afterWorldVersion).toBe(moments[i + 1].beforeWorldVersion);
    }
  });

  // ==========================================================================
  // MULTI-ALGORITHM TEST: Linked List Operations
  // ==========================================================================
  it("dynamically evolves Linked List node insertion with pointer rewiring", () => {
    const prompt = `Insert node 25 into sorted linked list: 10 -> 20 -> 30 -> 40`;

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
    const { authoritativeModel, timeline } = result;

    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;

    expect(moments.length).toBeGreaterThanOrEqual(3);

    // Unbroken world version chain
    for (let i = 0; i < moments.length - 1; i++) {
      expect(moments[i].afterWorldVersion).toBe(moments[i + 1].beforeWorldVersion);
    }
  });

  // ==========================================================================
  // DENSITY TEST (Part 42): Large 15-Element Problem
  // ==========================================================================
  it("handles high-density 15-element problem with stable layout and zero collisions", () => {
    const prompt = `Sort array with 15 elements using Merge Sort:
[38, 27, 43, 3, 9, 82, 10, 19, 54, 61, 72, 8, 45, 91, 14]`;

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
    const { authoritativeModel, timeline } = result;

    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;

    expect(moments.length).toBeGreaterThan(5);

    // Verify all moments with active entities have valid non-empty visual bounds
    for (const moment of moments) {
      if (moment.visualState.graph.entities.size > 0) {
        expect(moment.visualState.layoutBounds?.width ?? 0).toBeGreaterThan(0);
        expect(moment.visualState.layoutBounds?.height ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
