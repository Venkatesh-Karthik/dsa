import { describe, it, expect } from "vitest";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";

describe("Debug Elimination Flow", () => {
  it("traces states and layout in elimination lesson", () => {
    const prompt_text =
      "Explain how elimination works in a linked list. Eliminate nodes 20 and 30 from the linked list 10 → 20 → 30 → 40 → 50 step by step.";

    const lesson_payload = {
      id: "linked-list-elimination",
      title: prompt_text,
      concept: "Linked List Elimination",
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
          explanation:
            "To remove node 20, we update node 10 next pointer to point to node 30 instead of node 20.",
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
          explanation:
            "Now we eliminate node 30 by updating node 10 next pointer to point to node 40.",
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
          explanation:
            "Both nodes 20 and 30 have been removed. The remaining list is 10 → 40 → 50.",
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
      prompt_text,
      lesson_payload as any,
    );

    console.log("=== MODEL STATES ===");
    result.authoritativeModel.states.forEach((s, idx) => {
      console.log(
        `Model State ${idx} (${s.name}):`,
        Array.from(s.entities.entries()).map(([id, e]) => `${id}:${e.value}`),
      );
    });

    console.log("=== TIMELINE STATES ===");
    result.timeline.states.forEach((s, idx) => {
      console.log(
        `Timeline State ${idx} (${result.timeline.meta[idx]?.title}):`,
        Array.from(s.graph.entities.entries()).map(
          ([id, e]) => `${id}:${e.value}`,
        ),
      );
      console.log(
        `Timeline State ${idx} layout keys:`,
        Array.from(s.layoutState?.keys() ?? []),
      );
    });

    expect(result.timeline.states.length).toBe(4);
  });

  it("traces states when prompt is Test Elimination", () => {
    const lesson_payload = {
      id: "llist-test",
      title: "Test Elimination",
      concept: "Linked List",
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
          title: "Eliminate 20",
          explanation: "Eliminate 20",
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
      ],
    };

    const result = UniversalConceptIntelligenceEngine.processQuestion(
      "Test Elimination",
      lesson_payload as any,
    );

    console.log("=== TEST ELIMINATION TIMELINE STATES ===");
    result.timeline.states.forEach((s, idx) => {
      console.log(
        `State ${idx} (${result.timeline.meta[idx]?.title}):`,
        Array.from(s.graph.entities.entries()).map(
          ([id, e]) => `${id}:${e.value}`,
        ),
      );
    });
  });
});
