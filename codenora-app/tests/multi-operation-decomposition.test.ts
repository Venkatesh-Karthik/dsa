import { describe, it, expect } from "vitest";

import { understandQuestion } from "../ai/question-understanding";
import { OrderedOperationEngine } from "../ai/ordered-operation-engine";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";

describe("Cognora Multi-Operation Teaching Granularity & Decomposition", () => {
  const linkedListPrompt =
    "Explain how elimination works in a linked list. Eliminate nodes 20 and 30 from the linked list 10 → 20 → 30 → 40 → 50.";

  it("extracts distinct ordered operations and container baseline from user prompt", () => {
    const understanding = understandQuestion(linkedListPrompt);

    expect(understanding.parsedOperations).toBeDefined();
    expect(understanding.parsedOperations.length).toBe(2);

    const op1 = understanding.parsedOperations[0];
    const op2 = understanding.parsedOperations[1];

    expect(op1.op).toBe("delete");
    expect(op1.value).toBe(20);
    expect(op1.order).toBe(1);

    expect(op2.op).toBe("delete");
    expect(op2.value).toBe(30);
    expect(op2.order).toBe(2);

    // Container inputs should contain the baseline chain [10, 20, 30, 40, 50]
    expect(understanding.inputs.length).toBeGreaterThan(0);
    expect(understanding.inputs[0]).toEqual([10, 20, 30, 40, 50]);
  });

  it("shouldSynthesize triggers when 2 operations are collapsed or requested", () => {
    const understanding = understandQuestion(linkedListPrompt);

    // If an external LLM returned only 1 collapsed step for 2 deletions
    const collapsedMockSteps = [
      {
        title: "Eliminate nodes 20 and 30",
        explanation: "Nodes 20 and 30 are removed simultaneously from the linked list.",
        operations: [],
      },
    ];

    const needsSynthesis = OrderedOperationEngine.shouldSynthesize(
      understanding.parsedOperations,
      collapsedMockSteps,
      understanding.concept,
      linkedListPrompt,
    );

    expect(needsSynthesis).toBe(true);
  });

  it("synthesizes distinct atomic transformations preserving real pointer semantics", () => {
    const understanding = understandQuestion(linkedListPrompt);

    const steps = OrderedOperationEngine.synthesizeOrderedSteps(
      understanding.concept,
      understanding.parsedOperations,
      understanding.inputs,
      linkedListPrompt,
    );

    // Must have at least 4 pedagogical steps: Focus 20, Delete 20, Focus 30, Delete 30
    expect(steps.length).toBeGreaterThanOrEqual(4);

    // Step 1: Focus node 20
    const step1 = steps[0];
    expect(step1.title).toMatch(/20/);
    expect(step1.operations![0].elements.map((e: any) => e.value)).toEqual([
      10, 20, 30, 40, 50,
    ]);
    const node20Focus = step1.operations![0].elements.find(
      (e: any) => e.value === 20,
    );
    expect(node20Focus.highlight).toBe("warning");

    // Step 2: Delete 20 and redirect pointer 10 -> 30
    const step2 = steps[1];
    expect(step2.title).toMatch(/Remove.*20|Pointer.*10.*30/i);
    expect(step2.operations![0].elements.map((e: any) => e.value)).toEqual([
      10, 30, 40, 50,
    ]);
    expect(step2.explanation).toMatch(/30/);
    expect(step2.explanation).not.toMatch(/eventually.*40/i); // No premature future leakage

    // Step 3: Focus node 30
    const step3 = steps[2];
    expect(step3.title).toMatch(/30/);
    expect(step3.operations![0].elements.map((e: any) => e.value)).toEqual([
      10, 30, 40, 50,
    ]);
    const node30Focus = step3.operations![0].elements.find(
      (e: any) => e.value === 30,
    );
    expect(node30Focus.highlight).toBe("warning");

    // Step 4: Delete 30 and redirect pointer 10 -> 40
    const step4 = steps[3];
    expect(step4.title).toMatch(/Remove.*30|Pointer.*10.*40/i);
    expect(step4.operations![0].elements.map((e: any) => e.value)).toEqual([
      10, 40, 50,
    ]);
  });

  it("enforces Entity Conservation and Relationship Conservation through Universal Engine", async () => {
    const result = await UniversalConceptIntelligenceEngine.teach(linkedListPrompt);

    expect(result).toBeDefined();
    expect(result.timeline).toBeDefined();

    // Timeline must have distinct states for each operation
    const states = result.timeline.states;
    expect(states.length).toBeGreaterThanOrEqual(4);

    // Initial state: all 5 entities exist
    const state0Entities = Array.from(states[0].graph.entities.values()).map(
      (e) => e.value ?? e.label,
    );
    expect(state0Entities).toContain(10);
    expect(state0Entities).toContain(20);
    expect(state0Entities).toContain(30);
    expect(state0Entities).toContain(40);
    expect(state0Entities).toContain(50);

    // Final state: exactly {10, 40, 50} survive, 20 and 30 are eliminated
    const finalState = states[states.length - 1];
    const finalEntities = Array.from(finalState.graph.entities.values()).map(
      (e) => e.value ?? e.label,
    );
    expect(finalEntities).toContain(10);
    expect(finalEntities).toContain(40);
    expect(finalEntities).toContain(50);
    expect(finalEntities).not.toContain(20);
    expect(finalEntities).not.toContain(30);

    // Relationship Conservation: verify relationships in final state
    const finalRels = Array.from(finalState.graph.relationships.values());
    const hasStale20 = finalRels.some(
      (r) =>
        r.sourceEntityId.includes("20") || r.targetEntityId.includes("20"),
    );
    const hasStale30 = finalRels.some(
      (r) =>
        r.sourceEntityId.includes("30") || r.targetEntityId.includes("30"),
    );
    expect(hasStale20).toBe(false);
    expect(hasStale30).toBe(false);
  });

  it("decomposes array operations (swap and reverse) without collapsing", () => {
    const prompt = "Swap 2 and 5, then reverse the array [1, 2, 3, 4, 5].";
    const understanding = understandQuestion(prompt);

    expect(understanding.parsedOperations.length).toBeGreaterThanOrEqual(2);
    expect(understanding.parsedOperations[0].op).toBe("swap");
    expect(understanding.parsedOperations[1].op).toBe("reverse");

    const steps = OrderedOperationEngine.synthesizeOrderedSteps(
      understanding.concept,
      understanding.parsedOperations,
      understanding.inputs,
      prompt,
    );

    expect(steps.length).toBe(2);
    expect(steps[0].title).toMatch(/Swap/i);
    expect(steps[1].title).toMatch(/Reverse/i);
  });

  it("correctly handles backend visualLesson with multi-deletions without collapsing", () => {
    const backendProposal = {
      id: "linked-list-elimination",
      title: "Linked List Node Elimination",
      initialScene: [
        {
          type: "create_linked_list",
          id: "llist",
          variant: "singly",
          elements: [
            { value: 10 },
            { value: 20 },
            { value: 30 },
            { value: 40 },
            { value: 50 },
          ],
        },
      ],
      transformations: [
        {
          id: "t1",
          title: "Eliminate Node 20",
          explanation: "To remove node 20, we update node 10's next pointer to point to node 30.",
          operations: [
            {
              type: "create_linked_list",
              id: "llist",
              variant: "singly",
              elements: [
                { value: 10 },
                { value: 30 },
                { value: 40 },
                { value: 50 },
              ],
            },
          ],
        },
        {
          id: "t2",
          title: "Eliminate Node 30",
          explanation: "Now we eliminate node 30 by updating node 10's next pointer to point to node 40.",
          operations: [
            {
              type: "create_linked_list",
              id: "llist",
              variant: "singly",
              elements: [
                { value: 10 },
                { value: 40 },
                { value: 50 },
              ],
            },
          ],
        },
        {
          id: "t3",
          title: "Final List After Eliminations",
          explanation: "Both nodes 20 and 30 have been removed.",
          operations: [
            {
              type: "create_linked_list",
              id: "llist",
              variant: "singly",
              elements: [
                { value: 10 },
                { value: 40 },
                { value: 50 },
              ],
            },
          ],
        },
      ],
    };

    const result = UniversalConceptIntelligenceEngine.processQuestion(
      linkedListPrompt,
      backendProposal as any,
    );

    console.log("TEST PROCESSED STATES COUNT:", result.timeline.states.length);
    for (let i = 0; i < result.timeline.states.length; i++) {
      const st = result.timeline.states[i];
      const ents = Array.from(st.graph.entities.values()).map((e) => e.value ?? e.label);
      console.log(`TEST State ${i}: ${result.timeline.meta[i]?.title} -> entities:`, ents);
    }

    // Must have at least 3 transformations: State 0 (10..50), State 1 (remove 20 -> 10,30,40,50), State 2 (remove 30 -> 10,40,50)
    expect(result.timeline.states.length).toBeGreaterThanOrEqual(3);

    // Initial state: 10, 20, 30, 40, 50
    const state0Ents = Array.from(result.timeline.states[0].graph.entities.values()).map((e) => e.value ?? e.label);
    expect(state0Ents).toContain(20);
    expect(state0Ents).toContain(30);

    // State 1: 20 is eliminated, 30 is still present!
    const state1Ents = Array.from(result.timeline.states[1].graph.entities.values()).map((e) => e.value ?? e.label);
    expect(state1Ents).not.toContain(20);
    expect(state1Ents).toContain(30);

    // State 2: 30 is also eliminated!
    const state2Ents = Array.from(result.timeline.states[2].graph.entities.values()).map((e) => e.value ?? e.label);
    expect(state2Ents).not.toContain(20);
    expect(state2Ents).not.toContain(30);
  });
});

