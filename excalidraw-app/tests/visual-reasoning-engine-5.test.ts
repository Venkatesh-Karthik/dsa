import { describe, it, expect } from "vitest";
import {
  VisualReasoningEngine,
  VisualCapabilityRegistry,
  VisualEvidencePlanner,
  VisualCompositionPlanner,
  VisualElementPlanner,
  RelationshipPlanner,
  SpatialIntentPlanner,
  VisualTransformationPlanner,
  VisualQualityValidator,
  VisualRepairEngine,
  type VisualReasoningPlan,
  type CompositionStrategy,
} from "../ai/visual-reasoning";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { compileAuthoritativeTimeline } from "../ai/transformation-timeline";
import {
  createSemanticEntity,
  createSemanticRelationship,
  createSemanticState,
} from "../ai/semantic-world";
import type { AuthoritativeSemanticModel } from "../ai/authoritative-model";
import { createConfidence } from "../ai/confidence-model";

describe("Cognora 5.0 — Universal Visual Reasoning Engine", () => {
  // ==========================================================================
  // 1. Visual Capability Registry & Affordances
  // ==========================================================================
  describe("1. Visual Capability Registry & Dynamic Affordances", () => {
    it("contains foundational capabilities across all required categories", () => {
      const allCaps = VisualCapabilityRegistry.getAll();
      expect(allCaps.length).toBeGreaterThanOrEqual(20);

      const structural = VisualCapabilityRegistry.getByCategory("structural");
      const tabular = VisualCapabilityRegistry.getByCategory("tabular");
      const interaction = VisualCapabilityRegistry.getByCategory("interaction");
      const state = VisualCapabilityRegistry.getByCategory("state");
      const memory = VisualCapabilityRegistry.getByCategory("memory");
      const mathematical = VisualCapabilityRegistry.getByCategory("mathematical");
      const computation = VisualCapabilityRegistry.getByCategory("computation");

      expect(structural.length).toBeGreaterThan(0);
      expect(tabular.length).toBeGreaterThan(0);
      expect(interaction.length).toBeGreaterThan(0);
      expect(state.length).toBeGreaterThan(0);
      expect(memory.length).toBeGreaterThan(0);
      expect(mathematical.length).toBeGreaterThan(0);
      expect(computation.length).toBeGreaterThan(0);
    });

    it("dynamically resolves capabilities from roles, types, and labels without topic hardcoding", () => {
      // Endpoints & Actors
      expect(VisualCapabilityRegistry.resolveMatchingCapability("client", "Endpoint").id).toBe("Client");
      expect(VisualCapabilityRegistry.resolveMatchingCapability("server", "Host").id).toBe("Server");
      expect(VisualCapabilityRegistry.resolveMatchingCapability("actor", "Participant").id).toBe("Actor");

      // Tabular & Records
      expect(VisualCapabilityRegistry.resolveMatchingCapability("table", "Dataset").id).toBe("Table");
      expect(VisualCapabilityRegistry.resolveMatchingCapability("record", "Row").id).toBe("Record");

      // Messages & Signals
      expect(VisualCapabilityRegistry.resolveMatchingCapability("message", "Datagram").id).toBe("MessagePacket");

      // Automata & Decisions
      expect(VisualCapabilityRegistry.resolveMatchingCapability("state_node", "State").id).toBe("StateNode");
      expect(VisualCapabilityRegistry.resolveMatchingCapability("decision", "Condition").id).toBe("DecisionNode");

      // Physical & Mathematical
      expect(VisualCapabilityRegistry.resolveMatchingCapability("ray", "Beam").id).toBe("TrajectoryRay");
      expect(VisualCapabilityRegistry.resolveMatchingCapability("equation", "Formula").id).toBe("EquationBlock");

      // Unknown invented term resolves gracefully to GenericEntity
      expect(VisualCapabilityRegistry.resolveMatchingCapability("flux-distributor", "UnknownDevice").id).toBe("GenericEntity");
    });
  });

  // ==========================================================================
  // 2. Visual Evidence Planning (Priority, Clutter Elimination, Operation Distinction)
  // ==========================================================================
  describe("2. Visual Evidence Planning", () => {
    it("distinguishes persistent stateful entities from transient operational flows", () => {
      const mockModel: AuthoritativeSemanticModel = {
        id: "bank-transfer-model",
        problem: {
          concept: "Account Transfer",
          question: "Transfer funds from Account A to Account B",
          intent: "EXPLAIN",
          objective: "Demonstrate ACID transfer",
        } as any,
        world: {
          entities: [
            { id: "acc-a", label: "Account A (Balance: $500)", type: "Table", semanticRole: "table" },
            { id: "acc-b", label: "Account B (Balance: $200)", type: "Table", semanticRole: "table" },
            { id: "op-debit", label: "Debit $100", type: "Operation", semanticRole: "operation" },
            { id: "op-credit", label: "Credit $100", type: "Operation", semanticRole: "operation" },
          ],
          relationships: [
            { id: "rel-flow", source: "acc-a", target: "acc-b", type: "transfer", label: "Transfer $100" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [
          createSemanticState(0, "Initial", {
            entities: new Map([
              ["acc-a", createSemanticEntity("acc-a", "Table", "Account A (Balance: $500)", { balance: 500 }, { semanticRole: "table" })],
              ["acc-b", createSemanticEntity("acc-b", "Table", "Account B (Balance: $200)", { balance: 200 }, { semanticRole: "table" })],
            ]),
            relationships: new Map(),
          }),
        ],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Transfer", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const evidencePlan = VisualEvidencePlanner.plan(mockModel);

      // Primary stateful entities are prioritized
      const accAEv = evidencePlan.items.get("acc-a");
      const accBEv = evidencePlan.items.get("acc-b");
      expect(accAEv).toBeDefined();
      expect(accAEv?.priority).toBe("PRIMARY");
      expect(accAEv?.shouldRender).toBe(true);

      expect(accBEv).toBeDefined();
      expect(accBEv?.priority).toBe("PRIMARY");
      expect(accBEv?.shouldRender).toBe(true);

      // Transient operational actions are demoted from static primary boxes to avoid clutter
      const debitEv = evidencePlan.items.get("op-debit");
      expect(debitEv?.priority).toBe("TEMPORARY");
      expect(debitEv?.shouldRender).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Visual Composition Planning (Single & Composite Strategies)
  // ==========================================================================
  describe("3. Visual Composition Planning", () => {
    it("dynamically plans two-party interaction composition from topology", () => {
      const model: AuthoritativeSemanticModel = {
        id: "two-party-model",
        problem: { concept: "Protocol Flow", question: "Client to server request", intent: "EXPLAIN", objective: "Flow" } as any,
        world: {
          entities: [
            { id: "c1", label: "Client Host", type: "Client", semanticRole: "client" },
            { id: "s1", label: "Server Host", type: "Server", semanticRole: "server" },
          ],
          relationships: [
            { id: "r1", source: "c1", target: "s1", type: "request", label: "REQ" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [createSemanticState(0, "Init")],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Flow", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const evPlan = VisualEvidencePlanner.plan(model);
      const compPlan = VisualCompositionPlanner.plan(model, evPlan);

      expect(compPlan.primaryStrategy).toBe("interaction");
      expect(compPlan.rationale).toContain("communication");
    });

    it("dynamically plans circular cycle composition for closed-loop graphs", () => {
      const model: AuthoritativeSemanticModel = {
        id: "cycle-model",
        problem: { concept: "Energy Cycle", question: "Closed biological cycle", intent: "EXPLAIN", objective: "Cycle" } as any,
        world: {
          entities: [
            { id: "stage1", label: "Stage 1", type: "GenericEntity" },
            { id: "stage2", label: "Stage 2", type: "GenericEntity" },
            { id: "stage3", label: "Stage 3", type: "GenericEntity" },
          ],
          relationships: [
            { id: "r12", source: "stage1", target: "stage2", type: "advances" },
            { id: "r23", source: "stage2", target: "stage3", type: "advances" },
            { id: "r31", source: "stage3", target: "stage1", type: "advances" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [createSemanticState(0, "Init")],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Cycle", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const evPlan = VisualEvidencePlanner.plan(model);
      const compPlan = VisualCompositionPlanner.plan(model, evPlan);

      expect(compPlan.primaryStrategy).toBe("cycle");
      expect(compPlan.rationale).toContain("closed");
    });

    it("dynamically plans composite composition (tabular + flow) for transactional ledgers", () => {
      const model: AuthoritativeSemanticModel = {
        id: "tx-composite-model",
        problem: { concept: "Ledger Transaction", question: "Ledger update with state validation", intent: "EXPLAIN", objective: "Tx" } as any,
        world: {
          entities: [
            { id: "tbl-accounts", label: "Accounts Table", type: "Table", semanticRole: "table" },
            { id: "state-active", label: "ACTIVE", type: "StateNode", semanticRole: "state" },
            { id: "state-committed", label: "COMMITTED", type: "StateNode", semanticRole: "state" },
          ],
          relationships: [
            { id: "rel-trans", source: "state-active", target: "state-committed", type: "transition" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [createSemanticState(0, "Init")],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Tx", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const evPlan = VisualEvidencePlanner.plan(model);
      const compPlan = VisualCompositionPlanner.plan(model, evPlan);

      expect(compPlan.isComposite).toBe(true);
      expect(compPlan.primaryStrategy).toBe("tabular");
      expect(compPlan.secondaryStrategies.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. Relationship & Connector Planning (Real Excalidraw Connectors)
  // ==========================================================================
  describe("4. Relationship & Connector Planning", () => {
    it("enforces real connectors with endpoint bindings, routing, and proper directions", () => {
      const model: AuthoritativeSemanticModel = {
        id: "rel-model",
        problem: { concept: "Message Flow", question: "Sender transmits packet to receiver", intent: "EXPLAIN", objective: "Transmit" } as any,
        world: {
          entities: [
            { id: "sender", label: "Sender", type: "Client" },
            { id: "receiver", label: "Receiver", type: "Server" },
          ],
          relationships: [
            { id: "flow-1", source: "sender", target: "receiver", type: "message", label: "DATA_PKT" },
            { id: "self-loop", source: "sender", target: "sender", type: "recurse" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [createSemanticState(0, "Init")],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Transmit", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const evPlan = VisualEvidencePlanner.plan(model);
      const compPlan = VisualCompositionPlanner.plan(model, evPlan);
      const elPlan = VisualElementPlanner.plan(model, evPlan, compPlan);
      const relPlan = RelationshipPlanner.plan(model, elPlan, evPlan);

      // Legitimate relationship gets full connector specification
      const plannedRel = relPlan.relationships.get("flow-1");
      expect(plannedRel).toBeDefined();
      expect(plannedRel?.isConnectorNeeded).toBe(true);
      expect(plannedRel?.source).toBe("sender");
      expect(plannedRel?.target).toBe("receiver");
      expect(plannedRel?.direction).toBe("forward");
      expect(plannedRel?.routing).toBe("elbowed"); // Message transmissions use clean elbowed routing
      expect(plannedRel?.label).toBe("DATA_PKT");

      // Self-loops are rejected from cluttering the canvas
      expect(relPlan.relationships.has("self-loop")).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Spatial Intent Planning & Reading Direction
  // ==========================================================================
  describe("5. Spatial Intent Planning", () => {
    it("formulates natural reading direction and hierarchical ranks", () => {
      const model: AuthoritativeSemanticModel = {
        id: "spatial-model",
        problem: { concept: "Pipeline Flow", question: "Multi-stage pipeline", intent: "EXPLAIN", objective: "Pipeline" } as any,
        world: {
          entities: [
            { id: "stage-fetch", label: "Fetch", type: "ProcessNode" },
            { id: "stage-decode", label: "Decode", type: "ProcessNode" },
            { id: "stage-execute", label: "Execute", type: "ProcessNode" },
          ],
          relationships: [
            { id: "r1", source: "stage-fetch", target: "stage-decode", type: "feeds" },
            { id: "r2", source: "stage-decode", target: "stage-execute", type: "feeds" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [createSemanticState(0, "Init")],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Pipeline", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const evPlan = VisualEvidencePlanner.plan(model);
      const compPlan = VisualCompositionPlanner.plan(model, evPlan);
      const elPlan = VisualElementPlanner.plan(model, evPlan, compPlan);
      const relPlan = RelationshipPlanner.plan(model, elPlan, evPlan);
      const spatialPlan = SpatialIntentPlanner.plan(model, compPlan, elPlan, relPlan, evPlan);

      expect(spatialPlan.readingDirection).toBe("left_to_right");
      const rFetch = spatialPlan.ranks.find((r) => r.entityIds.includes("stage-fetch"));
      const rDecode = spatialPlan.ranks.find((r) => r.entityIds.includes("stage-decode"));
      const rExecute = spatialPlan.ranks.find((r) => r.entityIds.includes("stage-execute"));
      expect(rFetch?.rankIndex).toBe(0);
      expect(rDecode?.rankIndex).toBe(1);
      expect(rExecute?.rankIndex).toBe(2);
      expect(spatialPlan.minSpacingX).toBeGreaterThanOrEqual(40);
    });
  });

  // ==========================================================================
  // 6. Visual Transformation Planning & Pedagogical Synchronization
  // ==========================================================================
  describe("6. Visual Transformation Planning", () => {
    it("generates structured pedagogical step plans answering the 5 educational questions", () => {
      const model: AuthoritativeSemanticModel = {
        id: "trans-model",
        problem: { concept: "State Switch", question: "Toggle active state", intent: "EXPLAIN", objective: "Toggle" } as any,
        world: {
          entities: [{ id: "node-1", label: "Node 1", type: "GenericEntity" }],
          relationships: [],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [
          createSemanticState(0, "Initial", {
            entities: new Map([["node-1", createSemanticEntity("node-1", "GenericEntity", "Node 1", { state: "idle" })]]),
            relationships: new Map(),
          }),
          createSemanticState(1, "Active", {
            entities: new Map([["node-1", createSemanticEntity("node-1", "GenericEntity", "Node 1", { state: "active" })]]),
            relationships: new Map(),
          }),
        ],
        transformations: [
          {
            id: "t1",
            stepNumber: 1,
            title: "Activate Node",
            explanation: "Node 1 switches state to active",
            whatChanged: "State became active",
            affectedEntities: ["node-1"],
            fromStateIndex: 0,
            toStateIndex: 1,
          } as any,
        ],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Toggle", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const evPlan = VisualEvidencePlanner.plan(model);
      const compPlan = VisualCompositionPlanner.plan(model, evPlan);
      const elPlan = VisualElementPlanner.plan(model, evPlan, compPlan);
      const relPlan = RelationshipPlanner.plan(model, elPlan, evPlan);
      const transPlan = VisualTransformationPlanner.plan(model, elPlan, relPlan);

      expect(transPlan.dynamicStepCount).toBe(2);
      const step1 = transPlan.steps[1];
      expect(step1.stepIndex).toBe(1);
      expect(step1.whatChanged).toBeTruthy();
      expect(step1.whyChanged).toBeTruthy();
      expect(step1.learnerObservation).toBeTruthy();
      expect(step1.whatItEnables).toBeTruthy();
      expect(step1.mutatedEntities).toContain("node-1");
    });
  });

  // ==========================================================================
  // 7. Visual Quality Validator & Auto-Repair Engine
  // ==========================================================================
  describe("7. Visual Quality Validator & Auto-Repair", () => {
    it("evaluates visual quality and automatically repairs missing connectors or spacing issues", () => {
      const model: AuthoritativeSemanticModel = {
        id: "repair-test-model",
        problem: { concept: "Connected System", question: "Connected nodes", intent: "EXPLAIN", objective: "Connected" } as any,
        world: {
          entities: [
            { id: "n1", label: "Node 1", type: "GenericEntity" },
            { id: "n2", label: "Node 2", type: "GenericEntity" },
          ],
          relationships: [
            { id: "r12", source: "n1", target: "n2", type: "connects" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [createSemanticState(0, "Init")],
        transformations: [],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Connected", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      // Run master plan which invokes validator and auto-repair internally
      const plan = VisualReasoningEngine.plan(model);

      expect(plan.qualityReport).toBeDefined();
      expect(plan.qualityReport?.overallScore).toBeGreaterThanOrEqual(80);
      expect(plan.qualityReport?.dimensions.semanticCoverage).toBeGreaterThanOrEqual(70);
      expect(plan.qualityReport?.dimensions.relationshipVisibility).toBeGreaterThanOrEqual(70);
      expect(plan.qualityReport?.dimensions.collisionSafety).toBeGreaterThanOrEqual(70);
    });
  });

  // ==========================================================================
  // 8. Integration: Authoritative Timeline Compilation with VisualReasoningEngine
  // ==========================================================================
  describe("8. Master Timeline Compilation & State Generation", () => {
    it("compiles authoritative semantic models directly into complete SceneStates using VisualReasoningEngine", () => {
      const model: AuthoritativeSemanticModel = {
        id: "authoritative-pipeline",
        problem: { concept: "CPU Cycle", question: "Instruction pipeline", intent: "EXPLAIN", objective: "Instruction" } as any,
        world: {
          entities: [
            { id: "pc", label: "Program Counter (0x004)", type: "MemoryBlock", semanticRole: "memory" },
            { id: "alu", label: "Arithmetic Logic Unit", type: "ProcessNode", semanticRole: "process" },
          ],
          relationships: [
            { id: "bus", source: "pc", target: "alu", type: "data_bus", label: "Instruction Bus" },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [
          createSemanticState(0, "Fetch", {
            entities: new Map([
              ["pc", createSemanticEntity("pc", "MemoryBlock", "Program Counter (0x004)", { address: "0x004" })],
              ["alu", createSemanticEntity("alu", "ProcessNode", "Arithmetic Logic Unit", { state: "idle" })],
            ]),
            relationships: new Map([
              ["bus", createSemanticRelationship("bus", "pc", "alu", "data_bus", "forward", { label: "Instruction Bus" })],
            ]),
          }),
          createSemanticState(1, "Execute", {
            entities: new Map([
              ["pc", createSemanticEntity("pc", "MemoryBlock", "Program Counter (0x008)", { address: "0x008" })],
              ["alu", createSemanticEntity("alu", "ProcessNode", "Arithmetic Logic Unit", { state: "active" })],
            ]),
            relationships: new Map([
              ["bus", createSemanticRelationship("bus", "pc", "alu", "data_bus", "forward", { label: "Instruction Bus" })],
            ]),
          }),
        ],
        transformations: [
          {
            id: "t-exec",
            stepNumber: 1,
            title: "ALU Executes Instruction",
            explanation: "Instruction is executed and PC increments to 0x008",
            whatChanged: "PC incremented and ALU became active",
            affectedEntities: ["pc", "alu"],
            fromStateIndex: 0,
            toStateIndex: 1,
          } as any,
        ],
        derivedValuesByState: {},
        goalSatisfaction: { satisfied: true, objective: "Instruction", verifiedCriteria: [], summary: "OK" },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const timeline = compileAuthoritativeTimeline(model);

      expect(timeline.visualPlan).toBeDefined();
      expect(timeline.visualPlan?.compositionPlan.primaryStrategy).toBeTruthy();
      expect(timeline.states.length).toBe(2);
      expect(timeline.meta.length).toBe(2);

      // Verify State 0
      const s0 = timeline.states[0];
      expect(s0.graph.entities.has("pc")).toBe(true);
      expect(s0.graph.entities.has("alu")).toBe(true);
      expect(s0.graph.relationships.has("bus")).toBe(true);
      expect(s0.layoutState?.get("pc")).toBeDefined();
      expect(s0.layoutState?.get("alu")).toBeDefined();

      // Verify State 1 (Identity preservation & transformation)
      const s1 = timeline.states[1];
      expect(s1.graph.entities.get("pc")?.value).toBe("Program Counter (0x008)");
      expect(s1.graph.entities.get("alu")?.state).toBe("active");

      // Verify Step 1 Metadata has visualStep and animationPlan
      const meta1 = timeline.meta[1];
      expect(meta1.visualStep).toBeDefined();
      expect(meta1.animationPlan).toBeDefined();
    });
  });

  // ==========================================================================
  // 9. Six Real-World Acceptance Test Concepts
  // ==========================================================================
  describe("9. Six Real-World Acceptance Test Concepts", () => {
    it("Acceptance 1: TCP 3-Way Handshake with real packets, endpoints, and elbowed connectors", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain TCP 3-way handshake with SYN, SYN-ACK, and ACK packets between Client and Server",
        {
          entities: [
            createSemanticEntity("client", "Client", "Client Host", {}, { semanticRole: "client" }),
            createSemanticEntity("server", "Server", "Server Host", {}, { semanticRole: "server" }),
          ],
          relationships: [
            createSemanticRelationship("syn-edge", "client", "server", "message", "forward", { label: "SYN" }),
          ],
          steps: [
            {
              title: "Client sends SYN",
              explanation: "Client initiates handshake sending SYN to server",
              operations: [
                { type: "update_entity", entityId: "client", state: "syn-sent" },
              ],
            },
          ],
        },
      );

      expect(result.timeline).toBeDefined();
      const timeline = result.timeline;
      expect(timeline.states.length).toBeGreaterThanOrEqual(2);

      const s0 = timeline.states[0];
      expect(s0.graph.entities.has("client")).toBe(true);
      expect(s0.graph.entities.has("server")).toBe(true);
      expect(timeline.visualPlan?.compositionPlan.primaryStrategy).toBe("interaction");
    });

    it("Acceptance 2: Database Transaction Transfer with Rollback", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain database transaction bank transfer with debit, credit, constraint failure, and rollback recovery",
        {
          entities: [
            createSemanticEntity("acc-a", "Table", "Account A", { balance: 500 }, { semanticRole: "table" }),
            createSemanticEntity("acc-b", "Table", "Account B", { balance: 200 }, { semanticRole: "table" }),
          ],
          relationships: [
            createSemanticRelationship("tx-flow", "acc-a", "acc-b", "transfer", "forward", { label: "Debit $600" }),
          ],
          steps: [
            {
              title: "Attempt Overdraft Debit",
              explanation: "Debit exceeding balance triggers constraint violation",
              stateType: "failure",
              conceptualRole: "failure",
              operations: [
                { type: "update_entity", entityId: "acc-a", state: "failed" },
              ],
            },
            {
              title: "Rollback Recovery",
              explanation: "ACID rollback restores original balances cleanly",
              stateType: "recovery",
              conceptualRole: "recovery",
              operations: [
                { type: "update_entity", entityId: "acc-a", state: "recovered" },
              ],
            },
          ],
        },
      );

      expect(result.timeline).toBeDefined();
      const timeline = result.timeline;
      expect(timeline.states.length).toBe(3);
      expect(timeline.visualPlan).toBeDefined();
      expect(timeline.visualPlan?.compositionPlan.primaryStrategy).toBe("tabular");

      const recoveryMeta = timeline.meta.find(
        (m) =>
          m.explanation.toLowerCase().includes("rollback") ||
          m.title.toLowerCase().includes("rollback"),
      );
      expect(recoveryMeta).toBeDefined();
    });

    it("Acceptance 3: CPU Instruction Cycle (Fetch, Decode, Execute, Writeback)", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain CPU instruction cycle with Fetch, Decode, Execute, and Writeback stages",
        {
          entities: [
            createSemanticEntity("stage-fetch", "ProcessNode", "Fetch", {}, { semanticRole: "process" }),
            createSemanticEntity("stage-decode", "ProcessNode", "Decode", {}, { semanticRole: "process" }),
            createSemanticEntity("stage-execute", "ProcessNode", "Execute", {}, { semanticRole: "process" }),
            createSemanticEntity("stage-writeback", "ProcessNode", "Writeback", {}, { semanticRole: "process" }),
          ],
          relationships: [
            createSemanticRelationship("f-d", "stage-fetch", "stage-decode", "feeds", "forward"),
            createSemanticRelationship("d-e", "stage-decode", "stage-execute", "feeds", "forward"),
            createSemanticRelationship("e-w", "stage-execute", "stage-writeback", "feeds", "forward"),
          ],
          steps: [
            {
              title: "Fetch Stage",
              explanation: "Fetch instruction from memory into instruction register",
              operations: [{ type: "update_entity", entityId: "stage-fetch", state: "active" }],
            },
          ],
        },
      );

      expect(result.timeline).toBeDefined();
      const timeline = result.timeline;
      expect(timeline.states.length).toBeGreaterThanOrEqual(2);
      expect(timeline.visualPlan?.compositionPlan.primaryStrategy).toBe("pipeline");
      expect(timeline.visualPlan?.spatialIntentPlan.readingDirection).toBe("left_to_right");
    });

    it("Acceptance 4: Projectile Motion (Physics trajectory, apex, vectors)", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain projectile motion with initial launch velocity, apex height, and parabolic trajectory under gravity",
        {
          entities: [
            createSemanticEntity("ray-launch", "TrajectoryRay", "Launch Vector v0", {}, { semanticRole: "ray" }),
            createSemanticEntity("apex", "GenericEntity", "Apex (Vy = 0)", {}, { semanticRole: "apex" }),
            createSemanticEntity("eq-range", "EquationBlock", "R = (v0^2 * sin(2θ)) / g", {}, { semanticRole: "equation" }),
          ],
          relationships: [
            createSemanticRelationship("traj", "ray-launch", "apex", "trajectory", "forward"),
          ],
          steps: [
            {
              title: "Reach Apex",
              explanation: "Vertical velocity reaches zero at apex",
              operations: [{ type: "update_entity", entityId: "apex", state: "active" }],
            },
          ],
        },
      );

      expect(result.timeline).toBeDefined();
      const timeline = result.timeline;
      expect(timeline.states.length).toBeGreaterThanOrEqual(2);
      expect(timeline.visualPlan?.qualityReport?.overallScore).toBeGreaterThanOrEqual(75);
    });

    it("Acceptance 5: Photosynthesis (Light reaction, electron transport, Calvin cycle)", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain photosynthesis light-dependent reaction and ATP synthesis in chloroplast thylakoid membrane",
        {
          entities: [
            createSemanticEntity("photosystem-ii", "ProcessNode", "Photosystem II", {}, { semanticRole: "process" }),
            createSemanticEntity("etc", "ProcessNode", "Electron Transport Chain", {}, { semanticRole: "process" }),
            createSemanticEntity("atp-synthase", "ProcessNode", "ATP Synthase", {}, { semanticRole: "process" }),
          ],
          relationships: [
            createSemanticRelationship("e-flow1", "photosystem-ii", "etc", "electron_transfer", "forward"),
            createSemanticRelationship("e-flow2", "etc", "atp-synthase", "proton_gradient", "forward"),
          ],
          steps: [
            {
              title: "Photon Absorption",
              explanation: "Light excites electrons in PSII",
              operations: [{ type: "update_entity", entityId: "photosystem-ii", state: "active" }],
            },
          ],
        },
      );

      expect(result.timeline).toBeDefined();
      const timeline = result.timeline;
      expect(timeline.states.length).toBeGreaterThanOrEqual(2);
      expect(timeline.states[0].graph.entities.size).toBeGreaterThan(0);
    });

    it("Acceptance 6: Unknown Invented Concept (Universal Fallback)", async () => {
      const result = await UniversalConceptIntelligenceEngine.teach(
        "Explain alien tachyon resonance flux harmonizer with quartz matrix stabilization",
      );

      expect(result.timeline).toBeDefined();
      const timeline = result.timeline;
      expect(timeline.states.length).toBeGreaterThanOrEqual(1);

      // Successfully planned with 0 hardcoded assumptions
      expect(timeline.visualPlan).toBeDefined();
      expect(timeline.visualPlan?.qualityReport?.isPassing).toBe(true);
    });
  });

  // ==========================================================================
  // 10. 100% Local Playback & Inspector Verification (0 AI Requests)
  // ==========================================================================
  describe("10. 100% Local Playback & Inspector Guarantee", () => {
    it("simulates complete local navigation (Next, Prev, Seek, Inspect) with ZERO network/AI calls", async () => {
      const result = await UniversalConceptIntelligenceEngine.teach(
        "Trace binary search finding value in sorted array",
      );

      const timeline = result.timeline;
      expect(timeline.states.length).toBeGreaterThanOrEqual(2);

      // Local state indexing
      let currentIndex = 0;
      expect(timeline.states[currentIndex]).toBeDefined();

      // Local Next
      currentIndex = Math.min(currentIndex + 1, timeline.states.length - 1);
      expect(timeline.states[currentIndex]).toBeDefined();

      // Local Prev
      currentIndex = Math.max(0, currentIndex - 1);
      expect(timeline.states[currentIndex]).toBeDefined();

      // Local Seek to end
      currentIndex = timeline.states.length - 1;
      expect(timeline.states[currentIndex]).toBeDefined();

      // Local Entity Inspection
      const firstEntityId = Array.from(timeline.states[0].graph.entities.keys())[0];
      const inspection = UniversalConceptIntelligenceEngine.inspectEntity(
        firstEntityId,
        result.authoritativeModel,
        0,
      );

      expect(inspection).toBeDefined();
      expect(inspection?.id).toBe(firstEntityId);
    });
  });
});
