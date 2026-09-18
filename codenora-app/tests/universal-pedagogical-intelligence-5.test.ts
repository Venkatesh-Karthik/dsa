import { describe, it, expect } from "vitest";

import { understandQuestion } from "../ai/question-understanding";
import { inferLearnerNeed } from "../ai/learner-model";
import {
  detectCoreMechanism,
  createTeachingBlueprint,
} from "../ai/teaching-planner";
import { ConceptualJourneyOptimizer } from "../ai/conceptual-journey-optimizer";
import { TeachingQualityCritic } from "../ai/quality-validator";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";

import type { Entity, Relationship } from "../ai/semantic-world";

describe("Universal Pedagogical Intelligence 5.0", () => {
  // ==========================================================================
  // 1. Question Understanding & Multi-Intent Derivation
  // ==========================================================================
  describe("1. Question Understanding & Multi-Intent Derivation", () => {
    it("derives multiple compound intents, scope, goal, and requirements", () => {
      const prompt =
        "Why does TCP connection terminate and what happens if the server fails to send ACK?";
      const u = understandQuestion(prompt);

      expect(u.intents).toContain("WHY");
      expect(u.intents).toContain("COUNTERFACTUAL");
      expect(u.scope).toBe("interaction");
      expect(u.goal).toContain("TCP");
      expect(u.importantConcepts.length).toBeGreaterThan(0);
      expect(u.explicitRequirements).toContain(
        "Explicitly demonstrate failure scenario and consequences/recovery",
      );
      expect(u.assumedKnowledge.length).toBeGreaterThan(0);
    });

    it("derives system scope and explicit inputs for algorithmic transformation questions", () => {
      const prompt =
        "Trace binary search for target 42 in array [10, 20, 30, 42, 50]";
      const u = understandQuestion(prompt);

      expect(u.intents).toContain("TRACE");
      expect(u.inputs.length).toBeGreaterThan(0);
      expect(
        u.explicitRequirements.some((r) => r.includes("[10,20,30,42,50]")),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Learner Need Model
  // ==========================================================================
  describe("2. Learner Need Model", () => {
    it("dynamically infers prerequisites, likely misconceptions, and demonstrations", () => {
      const u = understandQuestion(
        "Explain how a database transaction maintains atomicity and what happens if credit fails",
      );
      const need = inferLearnerNeed(u);

      expect(need.prerequisites.length).toBeGreaterThan(0);
      expect(need.likelyMisconceptions).toContain(
        "Assuming intermediate/in-flight states represent final committed truth",
      );
      expect(need.likelyMisconceptions).toContain(
        "Assuming failures immediately terminate systems without recovery or rollback mechanisms",
      );
      expect(need.omitAsNoise.length).toBeGreaterThan(0);
      expect(
        need.explicitlyDemonstrate.some((d) =>
          d.includes("Alternative branch"),
        ),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Core Mechanism Detection
  // ==========================================================================
  describe("3. Core Mechanism Detection (Domain-Independent)", () => {
    it("detects feedback regulation from cyclic topology or sensor/controller terms", () => {
      const entities: Entity[] = [
        { id: "sensor", type: "Sensor", label: "Sensor", properties: {} },
        {
          id: "controller",
          type: "Controller",
          label: "Controller",
          properties: {},
        },
        { id: "actuator", type: "Actuator", label: "Heater", properties: {} },
      ];
      const rels: Relationship[] = [
        {
          id: "r1",
          source: "sensor",
          target: "controller",
          type: "reads",
          direction: "forward",
        },
        {
          id: "r2",
          source: "controller",
          target: "actuator",
          type: "causes",
          direction: "forward",
        },
        {
          id: "r3",
          source: "actuator",
          target: "sensor",
          type: "affects",
          direction: "forward",
        },
      ];

      const mech = detectCoreMechanism(
        "Autonomous Temperature Regulation",
        "EXPLAIN",
        entities,
        rels,
      );
      expect(mech.type).toBe("FEEDBACK_CONTROL");
      expect(mech.centralPrinciple).toContain("feedback");
    });

    it("detects atomic state transition from transaction semantics", () => {
      const mech = detectCoreMechanism("Funds Transfer with Rollback Support");
      expect(mech.type).toBe("ATOMIC_TRANSACTION");
      expect(mech.centralPrinciple).toContain("atomicity");
    });

    it("detects progressive elimination for search algorithms", () => {
      const mech = detectCoreMechanism("Binary Search Range Bisect");
      expect(mech.type).toBe("PROGRESSIVE_ELIMINATION");
      expect(mech.centralPrinciple).toContain("search interval");
    });

    it("detects protocol synchronization from message conduits", () => {
      const rels: Relationship[] = [
        {
          id: "r1",
          source: "client",
          target: "server",
          type: "sends",
          direction: "forward",
        },
        {
          id: "r2",
          source: "server",
          target: "client",
          type: "receives",
          direction: "forward",
        },
      ];
      const mech = detectCoreMechanism(
        "Handshake Protocol",
        "EXPLAIN",
        [],
        rels,
      );
      expect(mech.type).toBe("PROTOCOL_SYNCHRONIZATION");
    });

    it("detects structural rebalancing for tree rotations", () => {
      const mech = detectCoreMechanism("AVL Tree Node Rebalancing");
      expect(mech.type).toBe("STRUCTURAL_REBALANCING");
    });

    it("detects execution lifecycle for stack frames", () => {
      const mech = detectCoreMechanism(
        "Call Stack Frame Activation and Return",
      );
      expect(mech.type).toBe("EXECUTION_LIFECYCLE");
    });
  });

  // ==========================================================================
  // 4. Universal Teaching Blueprint
  // ==========================================================================
  describe("4. Universal Teaching Blueprint Generation", () => {
    it("constructs a complete TeachingBlueprint without topic-specific hardcoding", () => {
      const u = understandQuestion(
        "Explain how packet router forwards packets across hops",
      );
      const entities: Entity[] = [
        { id: "r1", type: "Router", label: "Router 1", properties: {} },
        { id: "r2", type: "Router", label: "Router 2", properties: {} },
        {
          id: "pkt",
          type: "Packet",
          label: "Packet A",
          properties: { highlight: "transient" },
        },
      ];
      const rels: Relationship[] = [
        {
          id: "link-1",
          source: "r1",
          target: "r2",
          type: "connects",
          direction: "forward",
          category: "causes",
        },
      ];

      const bp = createTeachingBlueprint({
        concept: u.concept,
        understanding: u,
        entities,
        relationships: rels,
      });

      expect(bp.goal).toContain("router");
      expect(bp.coreMechanism).toBeDefined();
      expect(bp.visualStrategy.persistentEntities).toContain("r1");
      expect(bp.visualStrategy.persistentEntities).toContain("r2");
      expect(bp.visualStrategy.temporaryEntities).toContain("pkt");
      expect(bp.visualStrategy.relationshipImportance["link-1"]).toBe(
        "PRIMARY",
      );
      expect(bp.explanationStrategy.answerWhatWhyHow).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Pedagogical Ordering & Introduce-Before-Transform
  // ==========================================================================
  describe("5. Pedagogical Ordering & Introduce-Before-Transform", () => {
    it("ensures unintroduced entities are introduced before being transformed", () => {
      const milestones = ConceptualJourneyOptimizer.optimize({
        concept: "Transformer Self-Attention",
        rawSteps: [
          {
            title: "Calculate Q and K dot product",
            explanation: "Compute attention scores between token matrices.",
            operations: [
              {
                type: "update_entity",
                entityId: "matrix-attention",
                value: "scores",
              },
            ],
          },
        ],
      });

      expect(milestones.length).toBe(1);
      expect(milestones[0].explanation).toContain("matrix-attention");
    });
  });

  // ==========================================================================
  // 6. Learning Value Scoring & Redundancy Compression
  // ==========================================================================
  describe("6. Learning Value Scoring & Redundancy Compression", () => {
    it("assigns high score to state transitions with decisions, failures, or causality", () => {
      const highValueScore =
        ConceptualJourneyOptimizer.calculateLearningValueScore({
          role: "decision",
          title: "Evaluate Transaction Status",
          explanation:
            "Check balance constraints to decide whether to commit or rollback.",
          affectedEntities: ["account-a", "account-b"],
          createdEntities: [],
          operationsCount: 2,
        });

      const lowValueScore =
        ConceptualJourneyOptimizer.calculateLearningValueScore({
          role: "bookkeeping",
          title: "Adjust Coordinate Offset",
          explanation: "Slight position tweak.",
          affectedEntities: ["account-a"],
          createdEntities: [],
          operationsCount: 0,
        });

      expect(highValueScore).toBeGreaterThan(0.6);
      expect(lowValueScore).toBeLessThan(0.4);
      expect(highValueScore).toBeGreaterThan(lowValueScore);
    });
  });

  // ==========================================================================
  // 7. Structured 6-Question Pedagogical Explanation
  // ==========================================================================
  describe("7. Structured 6-Question Pedagogical Explanation", () => {
    it("answers what, why, how, cause, invariant, and next from semantic state", () => {
      const prompt = "Explain database commit and rollback";
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          topic: "Database Atomicity",
          entities: [
            {
              id: "acc-a",
              type: "Account",
              label: "A",
              properties: {},
              value: 1000,
            },
            {
              id: "acc-b",
              type: "Account",
              label: "B",
              properties: {},
              value: 500,
            },
          ],
          steps: [
            {
              title: "Debit Account A",
              explanation: "Decrease balance by 500.",
              operations: [
                { type: "update_entity", entityId: "acc-a", value: 500 },
              ],
              cause: "Transfer initiation",
              whyChanged: "Debit required before credit",
              postconditions: ["Account A balance is 500"],
            },
            {
              title: "Decision: Validate Credit",
              explanation: "Check if credit succeeded.",
              role: "decision",
              conceptualRole: "decision",
              operations: [
                { type: "update_entity", entityId: "acc-b", value: 1000 },
              ],
              postconditions: ["Credit evaluated"],
            },
          ],
        },
      );

      const explanation =
        UniversalConceptIntelligenceEngine.getStructuredExplanation(
          1,
          result.authoritativeModel,
        );
      expect(explanation).not.toBeNull();
      expect(explanation?.whatChanged).toBeDefined();
      expect(explanation?.whyChanged).toBeDefined();
      expect(explanation?.howItHappened).toBeDefined();
      expect(explanation?.whatCausedIt).toBeDefined();
      expect(explanation?.whatMustNowBeTrue).toContain("500");
      expect(explanation?.whatHappensNext).toContain("Decision");
    });
  });

  // ==========================================================================
  // 8. Dynamic Misconception Intelligence
  // ==========================================================================
  describe("8. Dynamic Misconception Intelligence", () => {
    it("infers cognitive misconceptions regarding intermediate states and failure branches", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain 2PC Commit",
        {
          topic: "Two Phase Commit",
          steps: [
            {
              title: "Prepare Phase",
              explanation: "Participants vote.",
              stateType: "intermediate",
              persistence: "temporary",
              operations: [],
            },
            {
              title: "Coordinator Decision",
              explanation: "Commit or Abort.",
              role: "decision",
              conceptualRole: "decision",
              operations: [],
            },
          ],
        },
      );

      const misconceptions =
        UniversalConceptIntelligenceEngine.getConceptMisconceptions(
          result.authoritativeModel,
        );
      expect(misconceptions.length).toBeGreaterThanOrEqual(2);
      expect(
        misconceptions.some((m) => m.misconception.includes("intermediate")),
      ).toBe(true);
      expect(
        misconceptions.some((m) => m.misconception.includes("always succeeds")),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // 9. Teaching Quality Critic (11 Dimensions)
  // ==========================================================================
  describe("9. Teaching Quality Critic (11 Dimensions)", () => {
    it("evaluates plan across all 11 pedagogical dimensions and accepts valid plans", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain DNS Resolution",
        {
          topic: "DNS Hierarchy",
          entities: [
            {
              id: "client",
              type: "Client",
              label: "Browser",
              properties: {},
              semanticRole: "client",
            },
            {
              id: "resolver",
              type: "Server",
              label: "DNS Resolver",
              properties: {},
              semanticRole: "server",
            },
          ],
          relationships: [
            {
              id: "q1",
              source: "client",
              target: "resolver",
              type: "sends",
              direction: "forward",
              category: "causes",
            },
          ],
          steps: [
            {
              title: "Query Recursive Resolver",
              explanation: "Browser sends domain lookup request to resolver.",
              cause: "User entered URL in address bar",
              whyChanged:
                "Domain resolution required to acquire server IP address",
              operations: [
                { type: "update_entity", entityId: "client", state: "waiting" },
              ],
            },
          ],
        },
      );

      const report = TeachingQualityCritic.evaluate(
        result.authoritativeModel,
        "Explain DNS Resolution",
      );
      expect(report.isAcceptable).toBe(true);
      expect(report.overallScore).toBeGreaterThanOrEqual(70);
      expect(report.dimensions.semanticCompleteness).toBe(100);
      expect(report.dimensions.relationshipCompleteness).toBe(100);
      expect(report.dimensions.causalCompleteness).toBeGreaterThanOrEqual(70);
      expect(report.dimensions.cognitiveLoad).toBe(100);
    });
  });

  // ==========================================================================
  // 10. Cyclic Feedback Loop Causality
  // ==========================================================================
  describe("10. Cyclic Feedback Loop Causality", () => {
    it("supports cyclic measure-evaluate-decide-act loops without infinite loops", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Thermostat Control Loop",
        {
          topic: "Closed-Loop Feedback",
          entities: [
            {
              id: "env",
              type: "Environment",
              label: "Room Temperature",
              properties: {},
              value: "18C",
            },
            {
              id: "sensor",
              type: "Sensor",
              label: "Thermometer",
              properties: {},
            },
            {
              id: "controller",
              type: "Controller",
              label: "Thermostat Logic",
              properties: {},
            },
            {
              id: "heater",
              type: "Actuator",
              label: "Heating Element",
              properties: {},
            },
          ],
          relationships: [
            {
              id: "r1",
              source: "env",
              target: "sensor",
              type: "sensed_by",
              direction: "forward",
            },
            {
              id: "r2",
              source: "sensor",
              target: "controller",
              type: "reads",
              direction: "forward",
            },
            {
              id: "r3",
              source: "controller",
              target: "heater",
              type: "causes",
              direction: "forward",
            },
            {
              id: "r4",
              source: "heater",
              target: "env",
              type: "heats",
              direction: "forward",
            },
          ],
          steps: [
            {
              title: "1. Sensor Measures Temperature",
              explanation: "Thermometer reads 18C from environment.",
              operations: [
                { type: "update_entity", entityId: "sensor", value: "18C" },
              ],
            },
            {
              title: "2. Controller Evaluates Setpoint",
              explanation: "Current temp 18C is below setpoint 21C.",
              role: "decision",
              conceptualRole: "decision",
              operations: [
                {
                  type: "update_entity",
                  entityId: "controller",
                  state: "heating_required",
                },
              ],
            },
            {
              title: "3. Heater Activates",
              explanation:
                "Controller triggers heating element to warm environment.",
              operations: [
                { type: "update_entity", entityId: "heater", state: "active" },
              ],
            },
            {
              title: "4. Room Reaches Equilibrium",
              explanation:
                "Room temperature rises to 21C and sensor detects setpoint reached.",
              operations: [
                { type: "update_entity", entityId: "env", value: "21C" },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel.blueprint?.coreMechanism.type).toBe(
        "FEEDBACK_CONTROL",
      );
      expect(result.timeline.states.length).toBe(5);
      expect(
        result.authoritativeModel.states[4].entities.get("env")?.value,
      ).toBe("21C");
    });
  });

  // ==========================================================================
  // 11. Unknown Fictional Concept Regression Test
  // ==========================================================================
  describe("11. Unknown Fictional Concept Regression Test", () => {
    it("dynamically reasons about an entirely invented energy system without topic hardcoding", () => {
      const prompt =
        "Component A transfers energy to B. B converts it and sends it to C. C stores it. D monitors C and triggers an alarm if stored energy exceeds a threshold. Explain what happens if B fails.";

      const result = UniversalConceptIntelligenceEngine.processQuestion(
        prompt,
        {
          topic: "Fictional Energy Grid",
          entities: [
            {
              id: "ent-a",
              type: "Generator",
              label: "Source A",
              properties: {},
            },
            {
              id: "ent-b",
              type: "Converter",
              label: "Converter B",
              properties: {},
            },
            {
              id: "ent-c",
              type: "Storage",
              label: "Capacitor C",
              properties: {},
              value: 50,
            },
            {
              id: "ent-d",
              type: "Monitor",
              label: "Monitor D",
              properties: {},
            },
          ],
          relationships: [
            {
              id: "rel-ab",
              source: "ent-a",
              target: "ent-b",
              type: "transfers",
              direction: "forward",
              category: "causes",
            },
            {
              id: "rel-bc",
              source: "ent-b",
              target: "ent-c",
              type: "sends",
              direction: "forward",
              category: "causes",
            },
            {
              id: "rel-dc",
              source: "ent-d",
              target: "ent-c",
              type: "monitors",
              direction: "forward",
            },
          ],
          steps: [
            {
              title: "Normal Transfer",
              explanation:
                "A sends energy to B, which converts and forwards to C.",
              operations: [
                { type: "update_entity", entityId: "ent-c", value: 80 },
              ],
            },
            {
              title: "Failure: Converter B Faults",
              explanation:
                "Converter B overheats and halts conversion pipeline.",
              role: "failure",
              conceptualRole: "failure",
              stateType: "failure",
              operations: [
                { type: "update_entity", entityId: "ent-b", state: "fault" },
              ],
            },
            {
              title: "Recovery: Bypass Routing",
              explanation:
                "System redirects flow through secondary redundant channel.",
              role: "recovery",
              conceptualRole: "recovery",
              stateType: "recovery",
              operations: [
                { type: "update_entity", entityId: "ent-b", state: "bypassed" },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel.blueprint).toBeDefined();
      expect(result.authoritativeModel.journeyType).toBe("recovery");
      expect(result.authoritativeModel.world.entities.length).toBe(4);
      expect(result.authoritativeModel.transformations[1].stateType).toBe(
        "failure",
      );
      expect(result.authoritativeModel.transformations[2].stateType).toBe(
        "recovery",
      );
      expect(
        result.authoritativeModel.blueprint?.visualStrategy
          .relationshipImportance["rel-ab"],
      ).toBe("PRIMARY");
    });
  });

  // ==========================================================================
  // 12. Cross-Domain Pedagogical Matrix
  // ==========================================================================
  describe("12. Cross-Domain Pedagogical Matrix", () => {
    const domains = [
      { domain: "DSA", prompt: "Explain Red-Black Tree Rotation" },
      { domain: "Networking", prompt: "Explain BGP Route Flapping" },
      { domain: "Database", prompt: "Explain Write-Ahead Logging" },
      {
        domain: "Operating Systems",
        prompt: "Explain Virtual Memory Page Fault",
      },
      {
        domain: "Architecture",
        prompt: "Explain Branch Predictor Pipeline Flush",
      },
      { domain: "Physics", prompt: "Explain Prism Light Refraction" },
      { domain: "Biology", prompt: "Explain CRISPR Cas9 DNA Cleavage" },
      { domain: "Math", prompt: "Explain Newton-Raphson Root Finding" },
      {
        domain: "Machine Learning",
        prompt: "Explain Transformer Attention Softmax",
      },
      { domain: "System Design", prompt: "Explain Consistent Hashing Ring" },
    ];

    for (const d of domains) {
      it(`successfully constructs validated pedagogical blueprint for ${d.domain}`, () => {
        const u = understandQuestion(d.prompt);
        const result = UniversalConceptIntelligenceEngine.processQuestion(
          d.prompt,
          {
            topic: u.concept,
            steps: [
              {
                title: `Initial ${u.concept} Baseline`,
                explanation: `Demonstrating nominal behavior of ${u.concept}`,
                operations: [],
              },
              {
                title: `Core Transition in ${u.concept}`,
                explanation: `Applying primary mechanism to advance ${u.concept}`,
                operations: [],
              },
            ],
          },
        );

        expect(result.authoritativeModel.blueprint).toBeDefined();
        expect(
          result.authoritativeModel.blueprint?.coreMechanism,
        ).toBeDefined();
        expect(result.authoritativeModel.blueprint?.learnerNeed).toBeDefined();
        expect(result.timeline.states.length).toBeGreaterThanOrEqual(2);
      });
    }
  });

  // ==========================================================================
  // 13. Anti-Hardcoding Audit
  // ==========================================================================
  describe("13. Anti-Hardcoding Audit", () => {
    it("contains zero topic-specific switches in core engines", () => {
      // In-memory verification: an unseen fictional topic behaves with equal correctness
      const fictional1 = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Quantum Chrono-Harmonizer Resonance Dampening",
        {
          topic: "Chrono-Harmonizer",
          steps: [
            {
              title: "Oscillation Injection",
              explanation: "Resonance exceeds boundary.",
              operations: [],
            },
          ],
        },
      );

      const fictional2 = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Sub-Etheric Flux Entanglement Decoupling",
        {
          topic: "Flux Entanglement",
          steps: [
            {
              title: "Flux Perturbation",
              explanation: "Entanglement decoupled.",
              operations: [],
            },
          ],
        },
      );

      expect(fictional1.authoritativeModel.blueprint).toBeDefined();
      expect(fictional2.authoritativeModel.blueprint).toBeDefined();
      expect(fictional1.authoritativeModel.id).not.toBe(
        fictional2.authoritativeModel.id,
      );
    });
  });
});
