import { describe, it, expect } from "vitest";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import {
  evaluateAcyclic,
  evaluateBST,
  evaluateAVL,
  evaluateOrdering,
  evaluateRangeValidity,
  evaluateReferenceValidity,
  evaluateMathematicalConstraints,
  InvariantEngine,
} from "../ai/rules-invariants";
import {
  CorrectnessEngine,
  SemanticRepairEngine,
} from "../ai/correctness-engine";
import { ExplanationEngine } from "../ai/explanation-engine";
import {
  createSemanticState,
  type SemanticWorld,
  type Entity,
  type Relationship,
} from "../ai/semantic-world";
import { reconcileSceneState } from "../ai/scene-reconciler";
import {
  createVisualPrimitive,
  updateVisualPrimitive,
  sanitizeDisplayLabel,
} from "../ai/visual-primitives/primitive-factory";
import { validateTransformationTimeline } from "../ai/transformation-validator";
import { createSceneState } from "../ai/scene-state";
import { createEmptySceneGraph, addEntity } from "../ai/scene-graph";

describe("Universal Visual Reasoning and Teaching System", () => {
  describe("1. Universal Knowledge Representation across Diverse Domains", () => {
    it("teaches DSA: Binary Search Tree insertion with invariant preservation", () => {
      const prompt =
        "Explain Binary Search Tree Insertion of key 25 into [20, 10, 30]";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "root",
              type: "TreeNode",
              label: "20",
              value: 20,
              semanticRole: "root",
              properties: {},
            },
            {
              id: "left",
              type: "TreeNode",
              label: "10",
              value: 10,
              semanticRole: "tree-node",
              properties: {},
            },
            {
              id: "right",
              type: "TreeNode",
              label: "30",
              value: 30,
              semanticRole: "tree-node",
              properties: {},
            },
          ],
          relationships: [
            {
              id: "rel-root-left",
              source: "root",
              target: "left",
              type: "leftOf",
              direction: "forward",
              label: "L",
            },
            {
              id: "rel-root-right",
              source: "root",
              target: "right",
              type: "rightOf",
              direction: "forward",
              label: "R",
            },
          ],
          steps: [
            {
              title: "Compare 25 with Root (20)",
              explanation: "25 > 20, so branch right into right subtree.",
              operations: [
                {
                  type: "compare",
                  source: "root",
                  target: "node-25",
                  result: "25 > 20 -> Go Right",
                },
                { type: "highlight", target: "root", highlight: "warning" },
              ],
            },
            {
              title: "Compare 25 with Right Child (30)",
              explanation:
                "25 < 30 and left child is empty, so insert 25 as left child of 30.",
              operations: [
                {
                  type: "compare",
                  source: "right",
                  target: "node-25",
                  result: "25 < 30 -> Insert Left",
                },
                { type: "highlight", target: "right", highlight: "warning" },
              ],
            },
            {
              title: "Insert Node 25",
              explanation:
                "Node 25 is attached as left child of 30, maintaining BST order.",
              operations: [
                {
                  type: "create_entity",
                  id: "node-25",
                  label: "25",
                  value: 25,
                  entityType: "TreeNode",
                  role: "tree-node",
                },
                {
                  type: "connect",
                  source: "right",
                  target: "node-25",
                  relationType: "leftOf",
                  label: "L",
                },
                { type: "highlight", target: "node-25", highlight: "success" },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel).toBeDefined();
      expect(result.authoritativeModel.states.length).toBe(
        result.authoritativeModel.transformations.length + 1,
      );
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);

      const finalState =
        result.authoritativeModel.states[
          result.authoritativeModel.states.length - 1
        ];
      const bstCheck = evaluateBST(finalState);
      expect(bstCheck.holds).toBe(true);
    });

    it("teaches Non-DSA: Computer Networking - TCP 3-Way Handshake", () => {
      const prompt = "Explain TCP 3-Way Handshake Connection Establishment";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "client",
              type: "Host",
              label: "Client",
              semanticRole: "initiator",
              properties: { status: "CLOSED" },
            },
            {
              id: "server",
              type: "Host",
              label: "Server",
              semanticRole: "listener",
              properties: { status: "LISTEN" },
            },
          ],
          relationships: [
            {
              id: "rel-channel",
              source: "client",
              target: "server",
              type: "channel",
              direction: "none",
              label: "Network",
            },
          ],
          steps: [
            {
              title: "Step 1: SYN Sent",
              explanation:
                "Client sends SYN packet with sequence number J to Server and enters SYN_SENT state.",
              operations: [
                {
                  type: "update",
                  target: "client",
                  state: "SYN_SENT",
                  properties: { seq: 100 },
                },
                {
                  type: "flow",
                  from: "client",
                  to: "server",
                  packet: "SYN (seq=100)",
                },
              ],
            },
            {
              title: "Step 2: SYN-ACK Received",
              explanation:
                "Server receives SYN, replies with SYN-ACK (seq=300, ack=101), enters SYN_RCVD.",
              operations: [
                {
                  type: "update",
                  target: "server",
                  state: "SYN_RCVD",
                  properties: { seq: 300, ack: 101 },
                },
                {
                  type: "flow",
                  from: "server",
                  to: "client",
                  packet: "SYN-ACK (seq=300, ack=101)",
                },
              ],
            },
            {
              title: "Step 3: ACK and Established",
              explanation:
                "Client sends final ACK (ack=301), both endpoints transition to ESTABLISHED.",
              operations: [
                {
                  type: "update",
                  target: "client",
                  state: "ESTABLISHED",
                  properties: { ack: 301 },
                },
                { type: "update", target: "server", state: "ESTABLISHED" },
                {
                  type: "flow",
                  from: "client",
                  to: "server",
                  packet: "ACK (ack=301)",
                },
                {
                  type: "connect",
                  source: "client",
                  target: "server",
                  relationType: "session",
                  label: "TCP Established",
                },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel).toBeDefined();
      expect(result.authoritativeModel.states.length).toBe(4);
      const finalState = result.authoritativeModel.states[3];
      expect(finalState.entities.get("client")?.state).toBe("ESTABLISHED");
      expect(finalState.entities.get("server")?.state).toBe("ESTABLISHED");
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("teaches Non-DSA: Database Systems - SQL INNER JOIN", () => {
      const prompt =
        "Explain SQL Inner Join between Customers and Orders on customer_id";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "cust-1",
              type: "TableRow",
              label: "Alice (ID: 1)",
              value: 1,
              properties: { table: "Customers" },
            },
            {
              id: "cust-2",
              type: "TableRow",
              label: "Bob (ID: 2)",
              value: 2,
              properties: { table: "Customers" },
            },
            {
              id: "ord-101",
              type: "TableRow",
              label: "Order 101 (Cust: 1, $50)",
              value: 1,
              properties: { table: "Orders" },
            },
            {
              id: "ord-102",
              type: "TableRow",
              label: "Order 102 (Cust: 3, $90)",
              value: 3,
              properties: { table: "Orders" },
            },
          ],
          steps: [
            {
              title: "Evaluate Row 1 Condition",
              explanation:
                "Order 101 customer_id (1) matches Alice (1). Rows qualify for join.",
              operations: [
                {
                  type: "compare",
                  entities: ["cust-1", "ord-101"],
                  highlight: "accent",
                  result: "1 == 1 (Match)",
                },
                {
                  type: "connect",
                  source: "cust-1",
                  target: "ord-101",
                  relationType: "matches",
                  label: "cust_id=1",
                },
              ],
            },
            {
              title: "Evaluate Non-Matching Row",
              explanation:
                "Order 102 customer_id (3) has no matching record in Customers table. It is filtered out.",
              operations: [
                {
                  type: "filter",
                  entities: ["ord-102"],
                  predicate: () => false,
                },
                { type: "highlight", target: "ord-102", highlight: "dimmed" },
              ],
            },
            {
              title: "Synthesize Joined Output Relation",
              explanation:
                "The matched customer and order rows are merged into the final result table record.",
              operations: [
                {
                  type: "create_entity",
                  id: "joined-1",
                  label: "Result: Alice - Order 101 ($50)",
                  entityType: "ResultRow",
                  properties: { customer: "Alice", orderId: 101, amount: 50 },
                },
                { type: "highlight", target: "joined-1", highlight: "success" },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel).toBeDefined();
      expect(result.authoritativeModel.states.length).toBe(4);
      const finalState = result.authoritativeModel.states[3];
      expect(finalState.entities.has("joined-1")).toBe(true);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("teaches Non-DSA: Machine Learning - Gradient Descent Step", () => {
      const prompt =
        "Explain Gradient Descent optimization step with learning rate 0.1";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "w",
              type: "Parameter",
              label: "Weight (w)",
              value: 5.0,
              properties: { learningRate: 0.1 },
            },
            {
              id: "grad",
              type: "Gradient",
              label: "Gradient (dL/dw)",
              value: 4.0,
              properties: {},
            },
            {
              id: "loss",
              type: "Loss",
              label: "Loss (L)",
              value: 16.0,
              properties: { nonNegative: true },
            },
          ],
          steps: [
            {
              title: "Compute Gradient at Current Weight",
              explanation:
                "Gradient dL/dw = 2*(w - 3) = 4.0 indicates loss increases in positive direction.",
              operations: [
                {
                  type: "compare",
                  entities: ["w", "grad"],
                  result: "dL/dw = +4.0",
                },
                { type: "highlight", target: "grad", highlight: "warning" },
              ],
            },
            {
              title: "Apply Gradient Descent Weight Update",
              explanation:
                "Update weight: w_new = w - eta * grad = 5.0 - 0.1 * 4.0 = 4.6. Loss decreases from 16 to 12.96.",
              operations: [
                {
                  type: "apply_equation",
                  target: "w",
                  formula: "w - eta * grad",
                  value: 4.6,
                },
                { type: "update", target: "loss", value: 12.96 },
                { type: "highlight", target: "w", highlight: "success" },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel).toBeDefined();
      expect(result.authoritativeModel.states.length).toBe(3);
      const finalState = result.authoritativeModel.states[2];
      expect(finalState.entities.get("w")?.value).toBe(4.6);
      expect(finalState.entities.get("loss")?.value).toBe(12.96);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });
  });

  describe("2. General Transition Model & Semantic Change Operations", () => {
    it("executes swap, move, transform, and group without container branching", () => {
      const prompt = "Demonstrate general state transitions";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "a",
              type: "Item",
              label: "Item A",
              value: 10,
              properties: { x: 100, y: 100 },
            },
            {
              id: "b",
              type: "Item",
              label: "Item B",
              value: 20,
              properties: { x: 200, y: 100 },
            },
          ],
          steps: [
            {
              title: "Swap values of A and B",
              explanation: "Swap Item A and Item B values.",
              operations: [{ type: "swap", source: "a", target: "b" }],
            },
            {
              title: "Move Item A to new coordinates",
              explanation: "Translate Item A to (150, 250).",
              operations: [
                { type: "move", target: "a", position: { x: 150, y: 250 } },
              ],
            },
            {
              title: "Group Items A and B into a Container",
              explanation: "Group both items into a single container entity.",
              operations: [
                {
                  type: "group",
                  groupId: "grp-1",
                  label: "Item Pair",
                  entities: ["a", "b"],
                },
              ],
            },
            {
              title: "Transform Item A into ProcessedItem",
              explanation: "Transform Item A type and status.",
              operations: [
                {
                  type: "transform",
                  target: "a",
                  toType: "ProcessedItem",
                  state: "completed",
                },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel.states.length).toBe(
        result.authoritativeModel.transformations.length + 1,
      );
      expect(result.authoritativeModel.states.length).toBeGreaterThanOrEqual(2);

      const finalState =
        result.authoritativeModel.states[
          result.authoritativeModel.states.length - 1
        ];
      expect(finalState.entities.has("grp-1")).toBe(true);
      expect(finalState.entities.get("a")?.type).toBe("ProcessedItem");
      expect(finalState.entities.get("a")?.state).toBe("completed");
    });
  });

  describe("3. Executable Semantic Invariants and Correctness", () => {
    it("evaluates ordering invariants correctly", () => {
      const sortedEntities = new Map<string, Entity>([
        [
          "e1",
          {
            id: "e1",
            type: "Cell",
            label: "5",
            value: 5,
            properties: { index: 0 },
            semanticRole: "element",
          },
        ],
        [
          "e2",
          {
            id: "e2",
            type: "Cell",
            label: "10",
            value: 10,
            properties: { index: 1 },
            semanticRole: "element",
          },
        ],
        [
          "e3",
          {
            id: "e3",
            type: "Cell",
            label: "15",
            value: 15,
            properties: { index: 2 },
            semanticRole: "element",
          },
        ],
      ]);
      const sortedState = createSemanticState(0, "s-sorted", {
        entities: sortedEntities,
      });
      expect(evaluateOrdering(sortedState).holds).toBe(true);

      const unsortedEntities = new Map<string, Entity>([
        [
          "e1",
          {
            id: "e1",
            type: "Cell",
            label: "15",
            value: 15,
            properties: { index: 0 },
            semanticRole: "element",
          },
        ],
        [
          "e2",
          {
            id: "e2",
            type: "Cell",
            label: "10",
            value: 10,
            properties: { index: 1 },
            semanticRole: "element",
          },
        ],
      ]);
      const unsortedState = createSemanticState(0, "s-unsorted", {
        entities: unsortedEntities,
      });
      const unsortedRes = evaluateOrdering(unsortedState);
      expect(unsortedRes.holds).toBe(false);
      expect(unsortedRes.details).toContain("Ordering invariant violated");
    });

    it("evaluates reference validity and catches dangling relationships", () => {
      const validEntities = new Map<string, Entity>([
        [
          "n1",
          {
            id: "n1",
            type: "Node",
            label: "Node 1",
            properties: {},
            semanticRole: "node",
          },
        ],
        [
          "n2",
          {
            id: "n2",
            type: "Node",
            label: "Node 2",
            properties: {},
            semanticRole: "node",
          },
        ],
      ]);
      const validRels = new Map<string, Relationship>([
        [
          "r1",
          {
            id: "r1",
            source: "n1",
            target: "n2",
            type: "connects",
            direction: "forward",
          },
        ],
      ]);
      const validState = createSemanticState(0, "s-valid", {
        entities: validEntities,
        relationships: validRels,
      });
      expect(evaluateReferenceValidity(validState).holds).toBe(true);

      const danglingRels = new Map<string, Relationship>([
        [
          "r2",
          {
            id: "r2",
            source: "n1",
            target: "missing-node",
            type: "connects",
            direction: "forward",
          },
        ],
      ]);
      const danglingState = createSemanticState(0, "s-dangling", {
        entities: validEntities,
        relationships: danglingRels,
      });
      const dangRes = evaluateReferenceValidity(danglingState);
      expect(dangRes.holds).toBe(false);
      expect(dangRes.details).toContain("does not exist");
    });

    it("evaluates range validity for pointer indices and bounds", () => {
      const entities = new Map<string, Entity>([
        [
          "arr-0",
          {
            id: "arr-0",
            type: "ArrayCell",
            label: "10",
            value: 10,
            properties: { index: 0 },
            semanticRole: "cell",
          },
        ],
        [
          "arr-1",
          {
            id: "arr-1",
            type: "ArrayCell",
            label: "20",
            value: 20,
            properties: { index: 1 },
            semanticRole: "cell",
          },
        ],
        [
          "ptr",
          {
            id: "ptr",
            type: "Pointer",
            label: "P",
            value: 1,
            properties: { index: 1 },
            semanticRole: "pointer",
          },
        ],
      ]);
      const state = createSemanticState(0, "s-range", { entities });
      expect(evaluateRangeValidity(state).holds).toBe(true);

      // Out of bounds pointer index (index 5 in length 2 array)
      const badEntities = new Map<string, Entity>([
        ...entities,
        [
          "ptr",
          {
            id: "ptr",
            type: "Pointer",
            label: "P",
            value: 5,
            properties: { index: 5 },
            semanticRole: "pointer",
          },
        ],
      ]);
      const badState = createSemanticState(0, "s-bad-range", {
        entities: badEntities,
      });
      const badRes = evaluateRangeValidity(badState);
      expect(badRes.holds).toBe(false);
      expect(badRes.details).toContain("Pointer index out of range");
    });

    it("evaluates mathematical constraints including non-negativity and probability normalization", () => {
      const validProbEntities = new Map<string, Entity>([
        [
          "p1",
          {
            id: "p1",
            type: "Probability",
            label: "P(A)",
            value: 0.4,
            properties: { isProbability: true },
            semanticRole: "metric",
          },
        ],
        [
          "p2",
          {
            id: "p2",
            type: "Probability",
            label: "P(B)",
            value: 0.6,
            properties: { isProbability: true },
            semanticRole: "metric",
          },
        ],
      ]);
      const validProbState = createSemanticState(0, "s-prob", {
        entities: validProbEntities,
      });
      expect(evaluateMathematicalConstraints(validProbState).holds).toBe(true);

      const invalidProbEntities = new Map<string, Entity>([
        [
          "p1",
          {
            id: "p1",
            type: "Probability",
            label: "P(A)",
            value: 0.8,
            properties: { isProbability: true },
            semanticRole: "metric",
          },
        ],
        [
          "p2",
          {
            id: "p2",
            type: "Probability",
            label: "P(B)",
            value: 0.5,
            properties: { isProbability: true },
            semanticRole: "metric",
          },
        ],
      ]);
      const invalidProbState = createSemanticState(0, "s-bad-prob", {
        entities: invalidProbEntities,
      });
      const probRes = evaluateMathematicalConstraints(invalidProbState);
      expect(probRes.holds).toBe(false);
      expect(probRes.details).toContain("Probability constraint violated");
    });

    it("SemanticRepairEngine repairs safe anomalies and eliminates dangling links", () => {
      const world: SemanticWorld = {
        entities: [
          {
            id: "ent-1",
            type: "Node",
            label: "Node 1",
            semanticRole: "component",
            properties: {},
          },
          {
            id: "",
            type: "Node",
            label: "",
            semanticRole: "component",
            properties: {},
          }, // Unnamed entity
        ],
        relationships: [
          {
            id: "rel-1",
            source: "ent-1",
            target: "ghost-entity",
            type: "connects",
            direction: "forward",
          }, // Dangling
        ],
        properties: {},
        states: [],
        rules: [],
        constraints: [],
        goals: [],
        observations: [],
        derivedValues: [],
        dependencies: [],
        transformations: [],
        confidence: {
          value: 1,
          level: "KNOWN",
          reason: "test",
          source: "axiom",
        },
      };

      const { world: repairedWorld, repairedCount } =
        SemanticRepairEngine.repairSemanticWorld(world);
      expect(repairedCount).toBeGreaterThan(0);
      expect(repairedWorld.relationships.length).toBe(0); // Dangling link eliminated
      expect(
        repairedWorld.entities.every(
          (e) => e.id.length > 0 && e.label.length > 0,
        ),
      ).toBe(true);
    });
  });

  describe("4. Zero Metadata Leakage & Human-Facing Explanations", () => {
    it("scrubs internal IDs from whatChanged and connection explanations", () => {
      const s0Entities = new Map<string, Entity>([
        [
          "node-0",
          {
            id: "node-0",
            type: "Host",
            label: "Client Alpha",
            properties: {},
            semanticRole: "node",
          },
        ],
        [
          "node-1",
          {
            id: "node-1",
            type: "Host",
            label: "Server Beta",
            properties: {},
            semanticRole: "node",
          },
        ],
      ]);
      const s1Entities = new Map<string, Entity>([...s0Entities]);
      const s0Rels = new Map<string, Relationship>();
      const s1Rels = new Map<string, Relationship>([
        [
          "rel-node-0-node-1",
          {
            id: "rel-node-0-node-1",
            source: "node-0",
            target: "node-1",
            type: "connects",
            direction: "forward",
          },
        ],
      ]);

      const state0 = createSemanticState(0, "state-0", {
        entities: s0Entities,
        relationships: s0Rels,
      });
      const state1 = createSemanticState(1, "state-1", {
        entities: s1Entities,
        relationships: s1Rels,
      });

      const explanation = ExplanationEngine.deriveExplanation(
        {
          id: "t-1",
          stepNumber: 1,
          title: "Connect Client Alpha to Server Beta",
          action: "Connect endpoints",
          fromStateIndex: 0,
          toStateIndex: 1,
          affectedEntities: ["node-0", "node-1"],
        } as any,
        state0,
        state1,
      );

      // Verify that explanation uses entity labels, not raw IDs
      expect(explanation.whatChanged).toContain("Client Alpha");
      expect(explanation.whatChanged).toContain("Server Beta");
      expect(explanation.whatChanged).not.toContain("node-0");
      expect(explanation.whatChanged).not.toContain("node-1");

      // Verify all 7 pedagogical questions are addressed
      expect(explanation.whatChanged).toBeDefined();
      expect(explanation.whyChanged).toBeDefined();
      expect(explanation.cause).toBeDefined();
      expect(explanation.learnerObservation).toBeDefined();
      expect(explanation.whatMustNowBeTrue).toBeDefined();
      expect(explanation.consequence).toBeDefined();
      expect(explanation.whatHappensNext).toBeDefined();
    });

    it("inspectEntity resolves endpoint labels without leaking raw IDs", () => {
      const prompt = "Explain Network Packet Routing";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "rt-alpha",
              type: "Router",
              label: "Router Alpha",
              semanticRole: "gateway",
              properties: {},
            },
            {
              id: "rt-beta",
              type: "Router",
              label: "Router Beta",
              semanticRole: "gateway",
              properties: {},
            },
          ],
          relationships: [
            {
              id: "edge-1",
              source: "rt-alpha",
              target: "rt-beta",
              type: "routes_to",
              direction: "forward",
            },
          ],
          steps: [
            {
              title: "Forward Packet from Alpha to Beta",
              explanation: "Forward packet across link.",
              operations: [
                {
                  type: "flow",
                  from: "rt-alpha",
                  to: "rt-beta",
                  packet: "Data Packet #42",
                },
              ],
            },
          ],
        },
      );

      const inspection = UniversalConceptIntelligenceEngine.inspectEntity(
        "rt-alpha",
        result.authoritativeModel,
        1,
      );
      expect(inspection).not.toBeNull();
      expect(inspection?.label).toBe("Router Alpha");

      // Check outgoing connection human label
      expect(inspection?.outgoingConnections.length).toBe(1);
      expect(inspection?.outgoingConnections[0].toLabel).toBe("Router Beta");
      expect(inspection?.causes[0]).toContain("Router Beta");
    });
  });

  describe("5. 100% Local Whiteboard Playback Guarantee (Zero AI Requests)", () => {
    it("executes all inspection, causal tracing, counterfactuals, and quizzes locally", () => {
      const prompt =
        "Explain Binary Search on [2, 4, 6, 8, 10] searching for 8";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "c-0",
              type: "ArrayCell",
              label: "2",
              value: 2,
              properties: { index: 0 },
              semanticRole: "element",
            },
            {
              id: "c-1",
              type: "ArrayCell",
              label: "4",
              value: 4,
              properties: { index: 1 },
              semanticRole: "element",
            },
            {
              id: "c-2",
              type: "ArrayCell",
              label: "6",
              value: 6,
              properties: { index: 2 },
              semanticRole: "element",
            },
            {
              id: "c-3",
              type: "ArrayCell",
              label: "8",
              value: 8,
              properties: { index: 3 },
              semanticRole: "element",
            },
            {
              id: "c-4",
              type: "ArrayCell",
              label: "10",
              value: 10,
              properties: { index: 4 },
              semanticRole: "element",
            },
          ],
          steps: [
            {
              title: "Check Middle Element (6)",
              explanation:
                "Middle is at index 2 (value 6). 8 > 6, so search right half [8, 10].",
              operations: [
                {
                  type: "compare",
                  entities: ["c-2"],
                  result: "8 > 6 -> Search Right",
                },
                { type: "highlight", target: "c-2", highlight: "warning" },
              ],
            },
            {
              title: "Check New Middle Element (8)",
              explanation:
                "New middle is at index 3 (value 8). 8 == 8, target found!",
              operations: [
                {
                  type: "compare",
                  entities: ["c-3"],
                  result: "8 == 8 -> Match!",
                },
                { type: "highlight", target: "c-3", highlight: "success" },
                { type: "resolve", target: "c-3" },
              ],
            },
          ],
        },
      );

      const model = result.authoritativeModel;

      // 1. Local timeline index lookup
      for (let i = 0; i < model.states.length; i++) {
        const state = model.states[i];
        expect(state.index).toBe(i);
      }

      // 2. Local getWhatChanged (0 AI requests)
      const whatChanged = UniversalConceptIntelligenceEngine.getWhatChanged(
        1,
        model,
      );
      expect(whatChanged).not.toBeNull();
      expect(whatChanged?.title).toContain("Middle Element");

      // 3. Local getWhy (0 AI requests)
      const why = UniversalConceptIntelligenceEngine.getWhy(1, model);
      expect(why).not.toBeNull();
      expect(why?.causalChainSummary).toBeDefined();

      // 4. Local inspectEntity (0 AI requests)
      const inspected = UniversalConceptIntelligenceEngine.inspectEntity(
        "c-3",
        model,
        2,
      );
      expect(inspected).not.toBeNull();
      expect(inspected?.value).toBe(8);
      expect(inspected?.state).toBe("completed");

      // 5. Local evaluateWhatIf (0 AI requests)
      const whatIf = UniversalConceptIntelligenceEngine.evaluateWhatIf(
        {
          targetEntityId: "c-3",
          propertyKey: "value",
          hypotheticalValue: 99,
          description: "Change matched element from 8 to 99",
        },
        2,
        model,
      );
      expect(whatIf).toBeDefined();
      expect(whatIf.simulatedState.entities.get("c-3")?.value).toBe(99);

      // 6. Local interactive practice quiz (0 AI requests)
      const quiz = UniversalConceptIntelligenceEngine.getPracticeQuiz(1, model);
      expect(quiz.question).toBeDefined();
      expect(quiz.options.length).toBeGreaterThanOrEqual(2);
      expect(quiz.correctIndex).toBe(0);
    });
  });

  describe("6. Root Cause Verifications: Metadata Leakage, Granularity, Value Accuracy & Reconciler", () => {
    it("preserves multi-step mechanism granularity without collapsing into coarse macro steps", () => {
      const prompt = "Explain Merge Sort on [38, 27, 43, 3]";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          entities: [
            {
              id: "e-0",
              type: "ArrayCell",
              label: "38",
              value: 38,
              semanticRole: "element",
              properties: { index: 0 },
            },
            {
              id: "e-1",
              type: "ArrayCell",
              label: "27",
              value: 27,
              semanticRole: "element",
              properties: { index: 1 },
            },
            {
              id: "e-2",
              type: "ArrayCell",
              label: "43",
              value: 43,
              semanticRole: "element",
              properties: { index: 2 },
            },
            {
              id: "e-3",
              type: "ArrayCell",
              label: "3",
              value: 3,
              semanticRole: "element",
              properties: { index: 3 },
            },
          ],
          steps: [
            {
              title: "Split into Left [38, 27] and Right [43, 3]",
              explanation:
                "Divide the 4-element array into two distinct sub-problems at the midpoint.",
              operations: [
                {
                  type: "split",
                  target: "e-0",
                  properties: { left: ["e-0", "e-1"], right: ["e-2", "e-3"] },
                },
                { type: "highlight", target: "e-0", highlight: "focus" },
                { type: "highlight", target: "e-1", highlight: "focus" },
              ],
            },
            {
              title: "Sort Left Sub-array to [27, 38]",
              explanation:
                "Recursively sort the left pair by comparing 38 and 27 and placing 27 first.",
              operations: [
                { type: "swap", first: "e-0", second: "e-1" },
                { type: "highlight", target: "e-0", highlight: "success" },
                { type: "highlight", target: "e-1", highlight: "success" },
              ],
            },
            {
              title: "Sort Right Sub-array to [3, 43]",
              explanation:
                "Recursively sort the right pair by comparing 43 and 3 and placing 3 first.",
              operations: [
                { type: "swap", first: "e-2", second: "e-3" },
                { type: "highlight", target: "e-2", highlight: "success" },
                { type: "highlight", target: "e-3", highlight: "success" },
              ],
            },
            {
              title: "Merge Sorted Halves into [3, 27, 38, 43]",
              explanation:
                "Compare leading elements of both sorted sub-arrays and merge in ascending order.",
              operations: [
                {
                  type: "merge",
                  entities: ["e-0", "e-1", "e-2", "e-3"],
                  result: [3, 27, 38, 43],
                },
                { type: "highlight", target: "e-0", highlight: "verified" },
              ],
            },
          ],
        },
      );

      const model = result.authoritativeModel;
      expect(model).toBeDefined();
      // Crucial: left sub-array sort, right sub-array sort, and merge must NOT be squashed into a single step!
      expect(model.transformations.length).toBeGreaterThanOrEqual(3);

      // Verify zero operation IDs (e.g. t3-op0) in any transformation title or explanation
      for (const t of model.transformations) {
        expect(t.title).not.toMatch(/\bt\d+[-_]op\d+\b/i);
        expect(t.title).not.toMatch(/Introducing\s+t/i);
        expect(t.explanation).not.toMatch(/\bt\d+[-_]op\d+\b/i);
        expect(t.explanation).not.toMatch(/Introducing\s+t/i);
      }
    });

    it("guarantees value 10 strictly renders as '10' and never '0' across TreeNode, ArrayCell, and GraphNode", () => {
      // 1. TreeNode with value 10 and ID node-0
      const treeEntity = {
        id: "node-0",
        primitiveType: "TreeNode" as const,
        semanticRole: "tree-node" as const,
        value: 10,
        label: "10",
        properties: {},
      };
      const treePrim = createVisualPrimitive(treeEntity, { x: 100, y: 100 });
      const treeTextEl = treePrim.allElements.find(
        (e) => e.type === "text",
      ) as ExcalidrawTextElement;
      expect(treeTextEl).toBeDefined();
      expect(treeTextEl.text).toBe("10");

      // Update TreeNode position: value must remain 10
      const updatedTreeEls = updateVisualPrimitive(
        treePrim.allElements,
        treeEntity,
        { x: 200, y: 200 },
      );
      const updatedTreeTextEl = updatedTreeEls.find(
        (e) => e.type === "text",
      ) as ExcalidrawTextElement;
      expect(updatedTreeTextEl.text).toBe("10");

      // 2. ArrayCell with value 10, index 0, and ID arr-0
      const arrayEntity = {
        id: "arr-0",
        primitiveType: "ArrayCell" as const,
        semanticRole: "array-element" as const,
        value: 10,
        label: "10",
        properties: { index: 0 },
      };
      const arrayPrim = createVisualPrimitive(arrayEntity, { x: 50, y: 50 });
      const textEls = arrayPrim.allElements.filter(
        (e) => e.type === "text",
      ) as ExcalidrawTextElement[];
      expect(textEls.length).toBe(2);
      const valEl = textEls.find(
        (t) => (t.customData as any)?.subRole === "value",
      );
      const idxEl = textEls.find(
        (t) => (t.customData as any)?.subRole === "index",
      );
      expect(valEl?.text).toBe("10");
      expect(idxEl?.text).toBe("0");

      // Update ArrayCell: value must remain 10, index must remain 0
      const updatedArrayEls = updateVisualPrimitive(
        arrayPrim.allElements,
        arrayEntity,
        { x: 150, y: 50 },
      );
      const updatedTextEls = updatedArrayEls.filter(
        (e) => e.type === "text",
      ) as ExcalidrawTextElement[];
      const updatedValEl = updatedTextEls.find(
        (t) => (t.customData as any)?.subRole === "value",
      );
      const updatedIdxEl = updatedTextEls.find(
        (t) => (t.customData as any)?.subRole === "index",
      );
      expect(updatedValEl?.text).toBe("10");
      expect(updatedIdxEl?.text).toBe("0");

      // 3. sanitizeDisplayLabel directly preserves 10, 0, and clean numeric strings
      expect(sanitizeDisplayLabel(10, undefined, "node-0")).toBe("10");
      expect(sanitizeDisplayLabel(0, undefined, "node-0")).toBe("0");
      expect(sanitizeDisplayLabel("10", undefined, "arr-0")).toBe("10");
      expect(sanitizeDisplayLabel("0", undefined, "arr-0")).toBe("0");
    });

    it("pre-render consistency assertion in scene-reconciler guarantees canvas text matches semantic value", () => {
      const graph = createEmptySceneGraph();
      addEntity(graph, {
        id: "cell-10",
        primitiveType: "ArrayCell",
        semanticRole: "element",
        value: 10,
        label: "10",
        properties: { index: 0 },
      });
      const targetState = createSceneState(
        graph,
        new Map([["cell-10", { x: 100, y: 100 }]]),
      );

      // Reconcile initial state
      const initialResult = reconcileSceneState(targetState, []);
      expect(initialResult.elements.length).toBeGreaterThan(0);
      const valText = initialResult.elements.find(
        (e) => e.type === "text" && (e.customData as any)?.subRole === "value",
      ) as ExcalidrawTextElement;
      expect(valText).toBeDefined();
      expect(valText.text).toBe("10");

      // Deliberately simulate corrupted existing canvas text (e.g. text set to "0")
      (valText as any).text = "0";
      // Reconcile again: reconciler must detect and synchronize text back to "10"
      const repairedResult = reconcileSceneState(
        targetState,
        initialResult.elements,
      );
      const repairedValText = repairedResult.elements.find(
        (e) => e.type === "text" && (e.customData as any)?.subRole === "value",
      ) as ExcalidrawTextElement;
      expect(repairedValText).toBeDefined();
      expect(repairedValText.text).toBe("10");
    });

    it("handles non-destructive exploratory lessons without throwing validation error", () => {
      const initialGraph = createEmptySceneGraph();
      addEntity(initialGraph, {
        id: "n-1",
        primitiveType: "TreeNode",
        semanticRole: "root",
        value: 50,
        label: "50",
        properties: { highlight: "none" },
      });

      const exploredGraph = createEmptySceneGraph();
      addEntity(exploredGraph, {
        id: "n-1",
        primitiveType: "TreeNode",
        semanticRole: "root",
        value: 50,
        label: "50",
        properties: { highlight: "warning" },
      });

      const finalGraph = createEmptySceneGraph();
      addEntity(finalGraph, {
        id: "n-1",
        primitiveType: "TreeNode",
        semanticRole: "root",
        value: 50,
        label: "50",
        properties: { highlight: "none" }, // Returned to unhighlighted resting state
      });

      const timeline: any = {
        topic: "Search 50 in Single Node BST",
        states: [
          createSceneState(initialGraph),
          createSceneState(exploredGraph),
          createSceneState(finalGraph),
        ],
        meta: [
          { title: "Initial Tree", explanation: "BST containing root 50" },
          {
            title: "Probe Root",
            explanation: "Inspect root key 50, match found!",
          },
          {
            title: "Search Complete",
            explanation: "Verified key exists in BST.",
          },
        ],
      };

      const val = validateTransformationTimeline(timeline);
      expect(val.valid).toBe(true);
      expect(val.errors.length).toBe(0);
    });
  });
});
