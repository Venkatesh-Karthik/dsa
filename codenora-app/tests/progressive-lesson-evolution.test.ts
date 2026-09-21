import { describe, it, expect } from "vitest";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";

describe("COGNORA Progressive Teaching State & Lesson Evolution", () => {
  it("diagnoses Dijkstra step-by-step evolution for the canonical graph", () => {
    const prompt = `A\u2192B(4)
A\u2192C(2)
B\u2192C(1)
B\u2192D(5)
C\u2192B(1)
C\u2192D(8)
C\u2192E(10)
D\u2192E(2)
E\u2192D(2)
Ask Cognora to teach Dijkstra step by step.`;

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
    const { authoritativeModel, timeline } = result;

    console.log("=== DIJKSTRA DIAGNOSIS ===");
    console.log("States count:", authoritativeModel.states.length);
    console.log("Transformations count:", authoritativeModel.transformations.length);
    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;
    console.log("Moments count:", moments.length);

    authoritativeModel.states.forEach((s, idx) => {
      console.log(`State ${idx} (${s.name}):`);
      for (const [id, e] of s.entities.entries()) {
        if (e.type === "GraphNode" || id.includes("node")) {
          console.log(`  ${id}: label="${e.label}", value=${e.value}, highlight=${e.properties?.highlight}`);
        }
      }
    });

    moments.forEach((m, idx) => {
      console.log(`Moment ${idx}: title="${m.title}", whatChanged="${m.whatChanged}"`);
    });

    // Must have a meaningful number of states (Dijkstra on 5-vertex graph needs >10 steps)
    expect(authoritativeModel.states.length).toBeGreaterThan(10);

    // World version chain: Moment N.afterWorldVersion === Moment N+1.beforeWorldVersion
    for (let i = 0; i < moments.length - 1; i++) {
      const curr = moments[i];
      const next = moments[i + 1];
      expect(curr.afterWorldVersion).toBe(next.beforeWorldVersion);
    }

    // State 0 (Dijkstra baseline): all graph-main-node-* must have value=Infinity
    const state0 = authoritativeModel.states[0];
    for (const [id, ent] of state0.entities.entries()) {
      if (id.startsWith("graph-main-node-")) {
        expect(ent.value).toBe(Infinity);
      }
    }

    // Moment 0 title must reference "Baseline" (from filteredEntities state-0 name)
    // OR Moment 1 should contain "Baseline" from the synthesized isBaseline step
    const hasBaselineInFirstMoments =
      moments[0].title.toLowerCase().match(/baseline/i) ||
      moments[1]?.title.toLowerCase().match(/baseline/i);
    expect(hasBaselineInFirstMoments).toBeTruthy();

    // One of the early moments must reference initialization (source distance = 0)
    const initMoment = moments.slice(0, 4).find(
      (m) => m.title?.toLowerCase().match(/initializ|source|dist/i),
    );
    console.log("=== INIT MOMENT ===", initMoment?.title);
    expect(initMoment).toBeDefined();

    // Find the moment where C->B relaxation updates B from 4 to 3
    const bRelaxedMoment = moments.find(
      (m) => m.whatChanged?.includes("3 < 4") || m.title?.includes("C -> B"),
    );
    expect(bRelaxedMoment).toBeDefined();
    console.log("=== B-RELAXATION MOMENT ===", bRelaxedMoment?.title);
  });

  it("diagnoses AI response with coarse or final-state proposal -- must override with synthesis", () => {
    const prompt = `A\u2192B(4)
A\u2192C(2)
B\u2192C(1)
B\u2192D(5)
C\u2192B(1)
C\u2192D(8)
C\u2192E(10)
D\u2192E(2)
E\u2192D(2)
Ask Cognora to teach Dijkstra step by step.`;

    const rawAIProposal = {
      topic: "Dijkstra Algorithm",
      visualLesson: {
        id: "lesson-dijkstra",
        title: "Dijkstra Algorithm",
        concept: "Dijkstra",
        initialScene: [
          {
            type: "create_graph",
            id: "graph-main",
            nodes: [
              { id: "A", label: "A (0)" },
              { id: "B", label: "B (3)" },
              { id: "C", label: "C (2)" },
              { id: "D", label: "D (8)" },
              { id: "E", label: "E (10)" },
            ],
            edges: [
              { from: "A", to: "B", weight: 4 },
              { from: "A", to: "C", weight: 2 },
            ],
          },
        ],
        transformations: [
          {
            title: "Process edges",
            explanation: "Relax edges and compute distances",
            operations: [{ type: "highlight", target: "node-B", color: "primary" }],
          },
          {
            title: "Final Shortest Path Tree",
            explanation: "All vertices have their final distances",
            operations: [{ type: "highlight", target: "node-E", color: "success" }],
          },
        ],
      },
    };

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt, rawAIProposal as any);
    const { authoritativeModel, timeline } = result;

    console.log("=== AI PROPOSAL DIJKSTRA DIAGNOSIS ===");
    console.log("States count:", authoritativeModel.states.length);
    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;
    console.log("Moments count:", moments.length);

    // Must have been synthesized (not the 3-step AI proposal)
    expect(authoritativeModel.states.length).toBeGreaterThan(10);

    console.log("=== MOMENT 0 VISUAL STATE ENTITIES ===");
    for (const [id, e] of moments[0].visualState.graph.entities.entries()) {
      console.log(`  ${id}: label="${e.label}", value=${e.value}`);
    }

    console.log("=== MOMENT 1 VISUAL STATE ENTITIES ===");
    for (const [id, e] of moments[1].visualState.graph.entities.entries()) {
      console.log(`  ${id}: label="${e.label}", value=${e.value}`);
    }

    // World version chain
    for (let i = 0; i < moments.length - 1; i++) {
      const curr = moments[i];
      const next = moments[i + 1];
      expect(curr.afterWorldVersion).toBe(next.beforeWorldVersion);
    }
  });

  it("diagnoses AVL insertion evolution -- empty baseline + sequential insertions", () => {
    const prompt = `Teach me AVL insertion for:
50, 30, 70, 20, 40, 10, 25, 35, 45, 5.
Show each meaningful insertion and stop before rotations to explain the imbalance.`;

    const result = UniversalConceptIntelligenceEngine.processQuestion(prompt);
    const { authoritativeModel, timeline } = result;

    console.log("=== AVL DIAGNOSIS ===");
    console.log("States count:", authoritativeModel.states.length);
    expect(timeline.moments).toBeDefined();
    const moments = timeline.moments!;
    console.log("Moments count:", moments.length);
    moments.forEach((m, idx) => {
      console.log(`Moment ${idx}: title="${m.title}", whatChanged="${m.whatChanged}"`);
    });
    console.log("=== AVL MOMENT 0 VISUAL STATE ENTITIES ===");
    for (const [id, e] of moments[0].visualState.graph.entities.entries()) {
      console.log(`  ${id}: label="${e.label}", value=${e.value}`);
    }

    // Must have a meaningful number of moments
    expect(authoritativeModel.states.length).toBeGreaterThan(10);

    // Moment 0 must be the empty tree baseline
    const moment0 = moments[0];
    expect(moment0.title.toLowerCase()).toMatch(/baseline|empty|initial/i);

    // State 0 entities must have NO tree-main-node-* entities
    const state0 = authoritativeModel.states[0];
    for (const [id] of state0.entities.entries()) {
      expect(id).not.toMatch(/^tree-main-node-/);
    }

    // Must have an imbalance diagnosis moment
    const imbalanceMoment = moments.find(
      (m) => m.title?.toLowerCase().includes("imbalance") || m.title?.toLowerCase().includes("diagnos"),
    );
    expect(imbalanceMoment).toBeDefined();
    console.log("=== IMBALANCE MOMENT ===", imbalanceMoment?.title);

    // Must have a rotation moment
    const rotationMoment = moments.find(
      (m) => m.title?.toLowerCase().includes("rotation") || m.title?.toLowerCase().includes("rotate"),
    );
    expect(rotationMoment).toBeDefined();
    console.log("=== ROTATION MOMENT ===", rotationMoment?.title);

    // World version chain
    for (let i = 0; i < moments.length - 1; i++) {
      const curr = moments[i];
      const next = moments[i + 1];
      expect(curr.afterWorldVersion).toBe(next.beforeWorldVersion);
    }
  });
});
