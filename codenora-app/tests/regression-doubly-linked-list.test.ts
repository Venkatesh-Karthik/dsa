// @vitest-environment jsdom
import "vitest-canvas-mock";
import { describe, it, expect } from "vitest";

import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { ConceptualJourneyOptimizer } from "../ai/conceptual-journey-optimizer";
import { validateTeachingResponse } from "../ai/backend/dsl-validator";
import { DsaDomainModule } from "../ai/domain-knowledge/dsa";
import {
  createSemanticEntity,
  createSemanticRelationship,
} from "../ai/semantic-world";

describe("Regression: Doubly Linked List & Container Operations", () => {
  describe("1. Domain Knowledge Invariants (DSA)", () => {
    it("allows doubly linked list nodes to have both 'next' and 'previous' relations without failing out-degree check", () => {
      const invariants = DsaDomainModule.getInvariants("doubly linked list");
      const invariant = invariants.find((inv) => inv.id === "inv-ll-integrity");
      expect(invariant).toBeDefined();

      const n0 = createSemanticEntity("dll-head", "node", "0");
      const n1 = createSemanticEntity("dll-0", "node", "10");
      const n2 = createSemanticEntity("dll-1", "node", "20");

      const relNext = createSemanticRelationship(
        "rel-next",
        "dll-1",
        "dll-0",
        "next",
      );
      const relPrev = createSemanticRelationship(
        "rel-prev",
        "dll-1",
        "dll-head",
        "previous",
      );

      const mockModel: any = {
        entities: [n0, n1, n2],
        relationships: [relNext, relPrev],
      };
      const mockState: any = {
        activeEntityIds: ["dll-head", "dll-0", "dll-1"],
        activeRelationshipIds: ["rel-next", "rel-prev"],
      };

      // Total out-degree of dll-1 is 2 (one next, one prev), which is valid for doubly linked lists!
      const valid = invariant!.check!(mockState, mockModel);
      expect(valid).toBe(true);

      // But if dll-1 has TWO 'next' relations, it should fail
      const badRelNext2 = createSemanticRelationship(
        "rel-next-2",
        "dll-1",
        "dll-head",
        "next",
      );
      const badModel: any = {
        entities: [n0, n1, n2],
        relationships: [relNext, badRelNext2],
      };
      const badState: any = {
        activeEntityIds: ["dll-head", "dll-0", "dll-1"],
        activeRelationshipIds: ["rel-next", "rel-next-2"],
      };
      const invalid = invariant!.check!(badState, badModel);
      expect(invalid).toBe(false);
    });
  });

  describe("2. DSL Validator Alias Support", () => {
    it("validates actions targeting composite element aliases (containerId-elementId)", () => {
      const responsePayload = {
        topic: "Double Linked List",
        message: "A doubly linked list allows forward and backward traversal.",
        visualLesson: {
          id: "dll-lesson",
          title: "Double Linked List",
          initialScene: [
            {
              type: "create_linked_list",
              id: "dll",
              variant: "doubly",
              elements: [
                { id: "e1", value: 10 },
                { id: "e2", value: 20 },
                { id: "e3", value: 30 },
              ],
            },
          ],
          transformations: [
            {
              id: "t1",
              title: "Identify Head and Tail",
              explanation: "Highlight head and tail",
              operations: [
                {
                  type: "highlight",
                  target: "dll-e1",
                  color: "success",
                  id: "t0-op0",
                },
                {
                  type: "highlight",
                  target: "dll-e3",
                  color: "warning",
                  id: "t0-op1",
                },
              ],
            },
          ],
        },
      };

      const validation = validateTeachingResponse(responsePayload);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("3. ConceptualJourneyOptimizer with Composite Container Operations", () => {
    it("recognizes create_linked_list as composite action and preserves structural updates", () => {
      const rawSteps = [
        {
          title: "Identify Head and Tail",
          explanation: "Head points to 10, tail points to 30",
          operations: [
            { type: "highlight", target: "dll-e1", color: "success" },
            { type: "highlight", target: "dll-e3", color: "warning" },
          ],
        },
        {
          title: "Insert Node 25 after 20",
          explanation: "Create node 25 and rewire pointers",
          operations: [
            { type: "delete", target: "dll" },
            {
              type: "create_linked_list",
              id: "dll",
              variant: "doubly",
              elements: [
                { id: "e1", value: 10 },
                { id: "e2", value: 20 },
                { id: "e4", value: 25 },
                { id: "e3", value: 30 },
              ],
            },
          ],
        },
        {
          title: "Delete Node 20",
          explanation: "Remove node 20 and reconnect",
          operations: [
            { type: "delete", target: "dll" },
            {
              type: "create_linked_list",
              id: "dll",
              variant: "doubly",
              elements: [
                { id: "e1", value: 10 },
                { id: "e4", value: 25 },
                { id: "e3", value: 30 },
              ],
            },
          ],
        },
      ];

      const milestones = ConceptualJourneyOptimizer.optimize({
        concept: "Double Linked List",
        intent: "explain",
        targetGoal: "Demonstrate insertion and deletion in DLL",
        rawSteps: rawSteps as any,
      });

      expect(milestones.length).toBeGreaterThanOrEqual(1);
      // Ensure the delete and create_linked_list operations are preserved
      const allOps = milestones.flatMap((m) => m.operations);
      const hasCreateList = allOps.some(
        (op: any) => op.type === "create_linked_list",
      );
      expect(hasCreateList).toBe(true);
    });

    it("falls back gracefully when given empty raw steps without crashing", () => {
      const emptyResult = ConceptualJourneyOptimizer.optimize({
        concept: "Empty test",
        intent: "explain",
        targetGoal: "Empty goal",
        rawSteps: [],
      });
      expect(emptyResult).toHaveLength(0);
    });
  });

  describe("4. Universal Intelligence Engine End-to-End Lesson Compilation", () => {
    it("successfully compiles captured Double Linked List payload without error or repair degradation", () => {
      const capturedPayload = {
        topic: "Double Linked List",
        message:
          "A doubly linked list allows traversal both forward and backward via next and prev pointers.",
        visualLesson: {
          id: "dll-lesson",
          title: "Double Linked List",
          initialScene: [
            {
              type: "create_linked_list",
              id: "dll",
              variant: "doubly",
              elements: [
                { id: "e1", value: 10 },
                { id: "e2", value: 20 },
                { id: "e3", value: 30 },
              ],
            },
          ],
          transformations: [
            {
              id: "t1",
              title: "Identify Head and Tail",
              explanation:
                "Head points to first node (10), tail points to last node (30). Each node has next and prev links.",
              operations: [
                {
                  type: "highlight",
                  target: "dll-e1",
                  color: "success",
                  id: "t0-op0",
                },
                {
                  type: "highlight",
                  target: "dll-e3",
                  color: "warning",
                  id: "t0-op1",
                },
              ],
            },
            {
              id: "t2",
              title: "Insert Node 25 after 20",
              explanation:
                "Create new node with value 25, adjust pointers: 20's next becomes 25, 25's prev is 20, next is 30, and 30's prev becomes 25.",
              operations: [
                {
                  type: "delete",
                  target: "dll",
                  id: "t1-op0",
                },
                {
                  type: "create_linked_list",
                  id: "dll",
                  variant: "doubly",
                  elements: [
                    { id: "e1", value: 10 },
                    { id: "e2", value: 20 },
                    { id: "e4", value: 25 },
                    { id: "e3", value: 30 },
                  ],
                },
              ],
            },
            {
              id: "t3",
              title: "Delete Node 20",
              explanation:
                "Remove node 20: link 10's next to 25, and 25's prev to 10. List now reads 10 \u2194 25 \u2194 30.",
              operations: [
                {
                  type: "delete",
                  target: "dll",
                  id: "t2-op0",
                },
                {
                  type: "create_linked_list",
                  id: "dll",
                  variant: "doubly",
                  elements: [
                    { id: "e1", value: 10 },
                    { id: "e4", value: 25 },
                    { id: "e3", value: 30 },
                  ],
                },
              ],
            },
          ],
        },
      };

      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Double Linked List",
        capturedPayload as any,
      );

      // Verify authoritative model and visual lesson
      expect(result.authoritativeModel).toBeDefined();
      expect(result.visualLesson).toBeDefined();
      expect(result.visualLesson.transformations.length).toBeGreaterThanOrEqual(
        1,
      );

      // Verify that entities were extracted and preserved
      const entities = result.authoritativeModel.world.entities;
      expect(entities.length).toBeGreaterThan(0);

      // Verify goal satisfaction was successful
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);

      // Verify timeline states exist
      expect(result.timeline.states.length).toBeGreaterThan(0);
    });
  });
});
