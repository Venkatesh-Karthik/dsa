import { describe, it, expect } from "vitest";
import { understandQuestion } from "../ai/question-understanding";
import { formalizeProblem } from "../ai/problem-model";
import {
  createSemanticEntity,
  createSemanticRelationship,
  createSemanticState,
} from "../ai/semantic-world";
import { InvariantEngine } from "../ai/rules-invariants";
import { SolutionEngine } from "../ai/solution-engine";
import { CorrectnessEngine, SemanticRepairEngine } from "../ai/correctness-engine";
import { ExplanationEngine } from "../ai/explanation-engine";
import { CounterfactualEngine, type CounterfactualMutation } from "../ai/counterfactual-engine";
import { ComparisonEngine } from "../ai/comparison-engine";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";

describe("Cognora Universal Intelligence Root Architecture", () => {
  describe("1. Question Understanding Layer (Domain-Agnostic)", () => {
    it("classifies diverse intent classes across arbitrary fields without topic branching", () => {
      const q1 = understandQuestion("Explain how a compiler parser constructs an abstract syntax tree");
      expect(q1.userIntent).toBe("EXPLAIN");
      expect(q1.requiresStepByStep).toBe(true);

      const q2 = understandQuestion("Compare and contrast TCP vs UDP latency and packet ordering");
      expect(q2.userIntent).toBe("COMPARE");

      const q3 = understandQuestion("Simulate Round Robin CPU scheduling with quantum 2 for processes P1, P2");
      expect(q3.userIntent).toBe("SIMULATE");
      expect(q3.requiresSimulation).toBe(true);

      const q4 = understandQuestion("Derive the time complexity recurrence for Merge Sort");
      expect(q4.userIntent).toBe("DERIVE");

      const q5 = understandQuestion("Debug why this binary search loop hangs on array [2, 4, 6] with target 5");
      expect(q5.userIntent).toBe("DEBUG");

      const q6 = understandQuestion("Optimize this SQL query joining 3 large tables");
      expect(q6.userIntent).toBe("OPTIMIZE");

      const q7 = understandQuestion("Practice quiz on photosynthesis light-dependent electron transport chain");
      expect(q7.userIntent).toBe("PRACTICE");
    });

    it("handles underspecified questions by detecting ambiguity and recording explicit assumptions", () => {
      const result = understandQuestion("Rotate this tree");
      expect(result.ambiguity.length).toBeGreaterThan(0);
      expect(result.assumptions.length).toBeGreaterThan(0);
      expect(result.confidence.level).toBe("ASSUMED");
    });
  });

  describe("2. Problem Formalization", () => {
    it("formalizes an arbitrary problem into a uniform ProblemModel", () => {
      const understanding = understandQuestion("Explain HTTP 3-way TCP Handshake between Client and Server");
      const problem = formalizeProblem(understanding, {
        entities: [
          createSemanticEntity("client", "ClientApp", "Web Client"),
          createSemanticEntity("server", "ServerApp", "Backend Server"),
        ],
        relationships: [
          createSemanticRelationship("rel-conn", "client", "server", "connects"),
        ],
      });

      expect(problem.entities.length).toBe(2);
      expect(problem.relationships.length).toBe(1);
      expect(problem.constraints.length).toBeGreaterThan(0);
      expect(problem.successCriteria.length).toBeGreaterThan(0);
    });
  });

  describe("3. Dynamic Invariant & Derived Value Engine", () => {
    it("discovers universal invariants and validates them against semantic states", () => {
      const entities = [
        createSemanticEntity("n1", "Node", "Node 1"),
        createSemanticEntity("n2", "Node", "Node 2"),
      ];
      const invariants = InvariantEngine.discoverInvariants("Arbitrary Graph", [], entities);
      expect(invariants.length).toBeGreaterThanOrEqual(2);

      const state = createSemanticState(0, "s0", {
        entities: new Map([["n1", entities[0]], ["n2", entities[1]]]),
      });

      const report = InvariantEngine.validateStateInvariants(state, invariants);
      expect(report.valid).toBe(true);
      expect(report.violations.length).toBe(0);
    });

    it("calculates deterministic derived values without AI guessing", () => {
      const state = createSemanticState(0, "s0", {
        entities: new Map([
          ["e1", createSemanticEntity("e1", "Process", "P1")],
          ["e2", createSemanticEntity("e2", "Process", "P2")],
          ["e3", createSemanticEntity("e3", "Process", "P3")],
        ]),
      });

      const derived = InvariantEngine.computeDerivedValues(state, [
        {
          id: "evenEntityCount",
          label: "Is Even",
          dependencies: ["entityCount"],
          calculate: (st) => st.entities.size % 2 === 0,
          source: "deterministic",
        },
      ]);

      expect(derived["entityCount"].value).toBe(3);
      expect(derived["evenEntityCount"].value).toBe(false);
    });
  });

  describe("4. Solution Engine", () => {
    it("selects appropriate strategy and constructs structured milestones", () => {
      const p1 = formalizeProblem(understandQuestion("Compare SQL vs NoSQL document store"));
      expect(SolutionEngine.selectStrategy(p1)).toBe("compare");
      const plan1 = SolutionEngine.createSolutionPlan(p1);
      expect(plan1.strategy).toBe("compare");
      expect(plan1.steps.length).toBe(3);

      const p2 = formalizeProblem(understandQuestion("Derive kinetic energy formula from work-energy theorem"));
      expect(SolutionEngine.selectStrategy(p2)).toBe("derive");
      const plan2 = SolutionEngine.createSolutionPlan(p2);
      expect(plan2.strategy).toBe("derive");
    });
  });

  describe("5. Correctness Engine & Semantic Repair (Anti-Fake-Step)", () => {
    it("detects and rejects fake / duplicate steps having zero semantic difference", () => {
      const ent = createSemanticEntity("node-a", "Node", "A");
      const stateA = createSemanticState(0, "s0", {
        entities: new Map([["node-a", { ...ent }]]),
      });
      // Identical state with only a different name
      const stateB = createSemanticState(1, "s1", {
        name: "Now we observe Node A",
        entities: new Map([["node-a", { ...ent }]]),
      });

      const hasDiff = SemanticRepairEngine.hasMeaningfulDifference(stateA, stateB);
      expect(hasDiff).toBe(false); // FAKE STEP DETECTED!
    });

    it("deterministically repairs dangling relationship references", () => {
      const world = {
        entities: [createSemanticEntity("e1", "Node", "Node 1")],
        relationships: [
          createSemanticRelationship("r1", "e1", "missing-entity", "connects"),
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
        confidence: { value: 1, level: "KNOWN" as const, reason: "test", source: "test" },
      };

      const { world: repaired, repairedCount } = SemanticRepairEngine.repairSemanticWorld(world);
      expect(repaired.relationships.length).toBe(0); // Dangling reference dropped safely
      expect(repairedCount).toBeGreaterThan(0);
    });
  });

  describe("6. Completely Unseen Concept: Thermodynamics Refrigeration Cycle", () => {
    it("processes an unseen domain end-to-end through UniversalConceptIntelligenceEngine", () => {
      const prompt = "Explain the 4 stages of a Refrigerator Vapor-Compression Thermodynamic Cycle";
      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt, {
        entities: [
          createSemanticEntity("comp", "Compressor", "Compressor"),
          createSemanticEntity("cond", "Condenser", "Condenser Coils"),
          createSemanticEntity("valve", "Valve", "Expansion Valve"),
          createSemanticEntity("evap", "Evaporator", "Evaporator Coils"),
        ],
        relationships: [
          createSemanticRelationship("r1", "comp", "cond", "high_pressure_vapor"),
          createSemanticRelationship("r2", "cond", "valve", "high_pressure_liquid"),
          createSemanticRelationship("r3", "valve", "evap", "cold_mixture"),
          createSemanticRelationship("r4", "evap", "comp", "low_pressure_vapor"),
        ],
        steps: [
          {
            title: "Compression",
            explanation: "Compressor elevates vapor pressure and temperature",
            visual_actions: [{ type: "highlight", target: "comp", color: "warning" } as any],
          },
          {
            title: "Condensation",
            explanation: "Heat is exhausted to ambient room air as refrigerant condenses",
            visual_actions: [{ type: "highlight", target: "cond", color: "danger" } as any],
          },
          {
            title: "Expansion",
            explanation: "Fluid constricts through orifice dropping temperature drastically",
            visual_actions: [{ type: "highlight", target: "valve", color: "primary" } as any],
          },
          {
            title: "Evaporation",
            explanation: "Boiling fluid absorbs thermal energy from fridge interior",
            visual_actions: [{ type: "highlight", target: "evap", color: "success" } as any],
          },
        ],
        invariants: [
          { statement: "Conservation of energy: Q_in + W_net = Q_out" },
        ],
      });

      expect(result.authoritativeModel.world.entities.length).toBe(4);
      expect(result.authoritativeModel.states.length).toBe(5); // S0 + 4 steps
      expect(result.authoritativeModel.transformations.length).toBe(4);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);

      // Verify Local Semantic Inspection (0 AI calls)
      const inspected = UniversalConceptIntelligenceEngine.inspectEntity(
        "comp",
        result.authoritativeModel,
        1,
      );
      expect(inspected).not.toBeNull();
      expect(inspected?.label).toBe("Compressor");
      expect(inspected?.outgoingConnections.length).toBe(1);

      // Verify Local "What Changed?" (0 AI calls)
      const whatChanged = UniversalConceptIntelligenceEngine.getWhatChanged(1, result.authoritativeModel);
      expect(whatChanged).not.toBeNull();
      expect(whatChanged?.title).toBe("Compression");

      // Verify Local "Why?" (0 AI calls)
      const why = UniversalConceptIntelligenceEngine.getWhy(1, result.authoritativeModel);
      expect(why).not.toBeNull();
      expect(why?.causalChainSummary).toContain("Compression");

      // Verify Local Practice Quiz (0 AI calls)
      const quiz = UniversalConceptIntelligenceEngine.getPracticeQuiz(1, result.authoritativeModel);
      expect(quiz.options[0]).toContain("Conservation of energy");
    });
  });

  describe("7. Counterfactual & What-If Evaluation", () => {
    it("simulates hypothetical state changes and re-evaluates invariants", () => {
      const prompt = "Explain Binary Search Tree Inorder Traversal";
      const result = UniversalConceptIntelligenceEngine.processQuestion(prompt, {
        entities: [
          createSemanticEntity("root", "TreeNode", "50", { containerId: "bst" }, { value: 50 }),
          createSemanticEntity("left", "TreeNode", "30", { containerId: "bst" }, { value: 30 }),
          createSemanticEntity("right", "TreeNode", "70", { containerId: "bst" }, { value: 70 }),
        ],
        invariants: [
          {
            statement: "Left child value must be strictly less than root value",
            // custom programmatic check
          },
        ],
      });

      // What if root value became 10 instead of 50?
      const mutation: CounterfactualMutation = {
        targetEntityId: "root",
        propertyKey: "value",
        hypotheticalValue: 10,
      };

      const whatIf = CounterfactualEngine.evaluateWhatIf(
        mutation,
        result.authoritativeModel.states[0],
        result.authoritativeModel,
      );

      expect(whatIf.simulatedState.entities.get("root")?.value).toBe(10);
      expect(whatIf.consequences.length).toBeGreaterThan(0);
    });
  });

  describe("8. Semantic Comparison Engine", () => {
    it("compares two semantic states and details added, removed, and modified entities", () => {
      const s0 = createSemanticState(0, "s0", {
        entities: new Map([
          ["e1", createSemanticEntity("e1", "Server", "Server A", {}, { value: "running" })],
        ]),
      });
      const s1 = createSemanticState(1, "s1", {
        entities: new Map([
          ["e1", createSemanticEntity("e1", "Server", "Server A", {}, { value: "stopped" })],
          ["e2", createSemanticEntity("e2", "Server", "Server B (Failover)")],
        ]),
      });

      const report = ComparisonEngine.compareStates(s0, s1);
      expect(report.addedEntities.length).toBe(1);
      expect(report.modifiedEntities.length).toBe(1);
      expect(report.modifiedEntities[0].beforeValue).toBe("running");
      expect(report.modifiedEntities[0].afterValue).toBe("stopped");
    });
  });

  describe("9. Critical Regression Test: Rejection of Malformed Proposal", () => {
    it("detects critical semantic error (zero entities), rejects model generation, and prevents rendering", () => {
      const emptyProblem = formalizeProblem(understandQuestion("Explain void"), {
        entities: [], // Zero entities!
      });

      const emptyWorld = {
        entities: [],
        relationships: [],
        properties: {},
        states: [],
        rules: [],
        constraints: [],
        goals: [],
        observations: [],
        derivedValues: [],
        dependencies: [],
        transformations: [],
        confidence: { value: 0, level: "UNCERTAIN" as const, reason: "empty", source: "test" },
      };

      const result = CorrectnessEngine.validateAndSynthesize(
        emptyProblem,
        emptyWorld,
        [],
      );

      // Must be rejected!
      expect(result.report.valid).toBe(false);
      expect(result.report.issues.some((i) => i.code === "NO_ENTITIES")).toBe(true);
      expect(result.model).toBeUndefined(); // Never reaches renderer!
    });
  });

  describe("10. Property-Based Timeline Replay & Invariant Preservation", () => {
    it("guarantees for all valid transitions that invariants hold and replay is deterministic", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion("Explain Packet Routing across 3 Routers", {
        entities: [
          createSemanticEntity("r1", "Router", "Router 1", {}, { state: "forwarding" }),
          createSemanticEntity("r2", "Router", "Router 2", {}, { state: "idle" }),
          createSemanticEntity("r3", "Router", "Router 3", {}, { state: "idle" }),
        ],
        relationships: [
          createSemanticRelationship("link1", "r1", "r2", "fiber"),
          createSemanticRelationship("link2", "r2", "r3", "fiber"),
        ],
        steps: [
          {
            title: "Hop 1: R1 to R2",
            explanation: "Packet traverses fiber link 1 to Router 2",
            visual_actions: [{ type: "highlight", target: "r2", color: "primary" } as any],
          },
          {
            title: "Hop 2: R2 to R3",
            explanation: "Packet traverses fiber link 2 to Router 3 destination",
            visual_actions: [{ type: "highlight", target: "r3", color: "success" } as any],
          },
        ],
      });

      const model = result.authoritativeModel;

      // Property 1: Anti-Fake-Step invariant holds for every transition
      for (let i = 0; i < model.transformations.length; i++) {
        const t = model.transformations[i];
        const sFrom = model.states[t.fromStateIndex];
        const sTo = model.states[t.toStateIndex];
        expect(SemanticRepairEngine.hasMeaningfulDifference(sFrom, sTo)).toBe(true);
      }

      // Property 2: Invariants hold on every state
      for (const st of model.states) {
        const invReport = InvariantEngine.validateStateInvariants(st, model.invariants);
        expect(invReport.valid).toBe(true);
      }

      // Property 3: Replay integrity: state indices are strictly monotonic 0..N
      for (let i = 0; i < model.states.length; i++) {
        expect(model.states[i].index).toBe(i);
      }
    });
  });

  describe("11. Arbitrary / Completely Unanticipated Domains", () => {
    it("models Economics: Supply and Demand Market Equilibrium shift", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion("Explain Supply and Demand shift when input costs rise", {
        entities: [
          createSemanticEntity("supply", "EconomicCurve", "Supply Curve S1", {}, { value: "S1" }),
          createSemanticEntity("demand", "EconomicCurve", "Demand Curve D1", {}, { value: "D1" }),
          createSemanticEntity("eq", "MarketEquilibrium", "Equilibrium E1 (P1, Q1)", {}, { value: "P1=$10, Q1=100" }),
        ],
        relationships: [
          createSemanticRelationship("intersect", "supply", "demand", "intersects_at"),
        ],
        steps: [
          {
            title: "Supply Shock: Leftward Shift",
            explanation: "Higher raw material costs shift the supply curve upward/leftward to S2",
            visual_actions: [{ type: "highlight", target: "supply", color: "danger" } as any],
          },
          {
            title: "New Market Clearing Equilibrium",
            explanation: "Market clears at higher equilibrium price P2 and lower quantity Q2",
            visual_actions: [{ type: "highlight", target: "eq", color: "primary" } as any],
          },
        ],
        invariants: [
          { statement: "Market clearing price equates quantity supplied to quantity demanded" },
        ],
      });

      expect(result.authoritativeModel.world.entities.length).toBe(3);
      expect(result.authoritativeModel.transformations.length).toBe(2);
      expect(result.visualLesson.transformations.length).toBe(2);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("models Cellular Biology: ATP Synthesis Chemiosmosis", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion("Explain Mitochondrial ATP Synthase Proton Gradient", {
        entities: [
          createSemanticEntity("matrix", "Compartment", "Mitochondrial Matrix", {}, { value: "pH 7.8" }),
          createSemanticEntity("ims", "Compartment", "Intermembrane Space", {}, { value: "pH 7.0 (High H+)" }),
          createSemanticEntity("synthase", "EnzymeComplex", "ATP Synthase Complex V", {}, { state: "spinning" }),
        ],
        relationships: [
          createSemanticRelationship("gradient", "ims", "synthase", "proton_motive_force"),
        ],
        steps: [
          {
            title: "Proton Flow through Fo Rotor",
            explanation: "Electrochemical gradient drives protons through the Fo channel causing rotor rotation",
            visual_actions: [{ type: "highlight", target: "synthase", color: "accent" } as any],
          },
          {
            title: "Catalytic Phosphorylation in F1 Head",
            explanation: "Conformational change in F1 subunit binds ADP + Pi to synthesize ATP",
            visual_actions: [{ type: "highlight", target: "matrix", color: "success" } as any],
          },
        ],
        invariants: [
          { statement: "Conservation of energy: Proton gradient potential converts to ATP phosphoanhydride bond energy" },
        ],
      });

      expect(result.authoritativeModel.world.entities.length).toBe(3);
      expect(result.authoritativeModel.transformations.length).toBe(2);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });
  });
});

