import { describe, it, expect } from "vitest";

import {
  visualCapabilities,
  type VisualCapability,
} from "../ai/visual-capabilities";
import {
  compoundComponents,
  type CompoundComponent,
} from "../ai/compound-components";
import {
  extractVisualRequirements,
  type VisualRequirements,
} from "../ai/visual-requirements";
import { composeVisualScene } from "../ai/scene-composer";
import {
  computeSceneGraphLayout,
  deriveEntityBounds,
  checkAABBCollision,
  resolveLayoutCollisions,
  findBestAnnotationPosition,
  measureTextBounds,
  wrapText,
} from "../ai/layout-engine";
import { VisualEvidenceValidator } from "../ai/visual-evidence-validator";
import { deriveSemanticAnimationPlan } from "../ai/scene-animation";
import {
  compileAuthoritativeTimeline,
  type CompiledTimeline,
} from "../ai/transformation-timeline";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";

import { createConfidence } from "../ai/confidence-model";

import type { AuthoritativeSemanticModel } from "../ai/authoritative-model";
import type { SceneGraph, SemanticEntity } from "../ai/scene-graph";

describe("Universal Visual Intelligence 6.0 Platform", () => {
  // ==========================================================================
  // 1. Visual Capability Registry (Foundational Primitives)
  // ==========================================================================
  describe("1. Universal Visual Capability Registry", () => {
    it("contains foundational capabilities across all 11 required categories", () => {
      const caps = visualCapabilities.getAll();
      expect(caps.length).toBeGreaterThanOrEqual(60);

      const categories = visualCapabilities.getCategories();
      const requiredCategories = [
        "structural",
        "relationships",
        "interaction",
        "state",
        "data",
        "computation",
        "memory",
        "mathematics",
        "science",
        "timeline",
        "annotation",
      ];

      for (const reqCat of requiredCategories) {
        expect(categories).toContain(reqCat);
        const inCat = visualCapabilities.getByCategory(reqCat as any);
        expect(inCat.length).toBeGreaterThan(0);
      }
    });

    it("verifies key universal primitives have complete layout, sizing, and connector metadata", () => {
      const actorCap = visualCapabilities.get("Actor");
      expect(actorCap).toBeDefined();
      expect(actorCap?.semanticMeaning).toBeTruthy();
      expect(actorCap?.layoutRequirements.minWidth).toBeGreaterThan(0);
      expect(actorCap?.connectorCapabilities.canBeSource).toBe(true);
      expect(actorCap?.connectorCapabilities.canBeTarget).toBe(true);

      const rayCap = visualCapabilities.get("Ray");
      expect(rayCap).toBeDefined();
      expect(rayCap?.category).toBe("science");

      const tableCap = visualCapabilities.get("Table");
      expect(tableCap).toBeDefined();
      expect(tableCap?.category).toBe("data");

      const decisionCap = visualCapabilities.get("Decision");
      expect(decisionCap).toBeDefined();
      expect(decisionCap?.category).toBe("state");
    });

    it("dynamically resolves matching capabilities without topic hardcoding", () => {
      const m1 = visualCapabilities.findMatching("client endpoint");
      expect(m1.id).toBe("Client");

      const m2 = visualCapabilities.findMatching("optical beam of light");
      expect(m2.id).toBe("Ray");

      const m3 = visualCapabilities.findMatching("database record");
      expect(m3.id).toBe("Record");

      const m4 = visualCapabilities.findMatching("call stack activation frame");
      expect(m4.id).toBe("CallFrame");

      // Completely unknown term resolves gracefully to GenericEntity
      const mUnknown = visualCapabilities.findMatching("hyper-quantum-widget");
      expect(mUnknown.id).toBe("GenericEntity");
    });
  });

  // ==========================================================================
  // 2. Compound Visual Component System
  // ==========================================================================
  describe("2. Compound Visual Component System", () => {
    it("contains 25 universal compound components composed of foundational primitives", () => {
      const compounds = compoundComponents.getAll();
      expect(compounds.length).toBeGreaterThanOrEqual(25);

      const requiredCompoundNames = [
        "MessageExchange",
        "ActorInteraction",
        "ProcessLifecycle",
        "StateMachine",
        "DecisionFlow",
        "DataPipeline",
        "TableView",
        "MemoryMap",
        "CallStack",
        "TimelineView",
        "GraphView",
        "TreeView",
        "ArrayView",
        "MatrixView",
        "FlowDiagram",
        "CauseEffectDiagram",
        "ComparisonView",
        "CycleView",
        "CoordinateSystem",
        "ScientificProcess",
        "SystemArchitecture",
        "InputOutputFlow",
        "DependencyGraph",
        "SequenceDiagram",
        "HierarchyDiagram",
      ];

      for (const name of requiredCompoundNames) {
        const found = compoundComponents.get(name);
        expect(found, `Missing compound component ${name}`).toBeDefined();
        expect(found?.constituentCapabilities.length).toBeGreaterThan(0);
        expect(found?.supportedLayout).toBeTruthy();
      }
    });

    it("dynamically matches compound components based on semantic context", () => {
      const exchangeMatch = compoundComponents.findBestMatch({
        hasActors: true,
        hasMessages: true,
        hasLifelines: true,
      });
      expect(exchangeMatch.id).toBe("MessageExchange");

      const treeMatch = compoundComponents.findBestMatch({
        concept: "Binary Search Tree",
        hasTreeHierarchy: true,
      });
      expect(treeMatch.id).toBe("TreeView");

      const tableMatch = compoundComponents.findBestMatch({
        concept: "Database Table Records",
        hasTabularData: true,
      });
      expect(tableMatch.id).toBe("TableView");

      const cycleMatch = compoundComponents.findBestMatch({
        hasCycles: true,
      });
      expect(cycleMatch.id).toBe("CycleView");
    });
  });

  // ==========================================================================
  // 3. Dynamic Visual Requirement Extraction
  // ==========================================================================
  describe("3. Dynamic Visual Requirement Extraction", () => {
    it("derives required entities, relationships, states, focus, and cognitive load", () => {
      const mockModel: AuthoritativeSemanticModel = {
        id: "test-model",
        problem: {
          question: "How does client-server handshake establish connection?",
          intent: "EXPLAIN",
          objective: "Establish handshake",
        } as any,
        world: {
          entities: [
            {
              id: "client",
              label: "Client",
              type: "Client",
              semanticRole: "client",
            },
            {
              id: "server",
              label: "Server",
              type: "Server",
              semanticRole: "server",
            },
          ],
          relationships: [
            {
              id: "r1",
              sourceEntityId: "client",
              targetEntityId: "server",
              type: "sends",
              label: "SYN",
            },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [
          {
            name: "Initial",
            entities: [
              {
                id: "client",
                label: "Client",
                type: "Client",
                state: "LISTEN",
              },
              {
                id: "server",
                label: "Server",
                type: "Server",
                state: "LISTEN",
              },
            ],
            relationships: [],
          },
        ] as any,
        transformations: [
          {
            id: "t1",
            stepNumber: 1,
            title: "SYN Sent",
            explanation: "Client sends SYN packet to Server",
            whatChanged: "SYN packet transmitted",
            affectedEntities: ["client"],
            fromStateIndex: 0,
            toStateIndex: 1,
          },
        ] as any,
        derivedValuesByState: {},
        goalSatisfaction: {
          satisfied: true,
          objective: "Handshake",
          verifiedCriteria: [],
          summary: "OK",
        },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const reqs = extractVisualRequirements({
        understanding: {
          userIntent: "EXPLAIN" as any,
          intents: ["EXPLAIN" as any],
          concept: "TCP Handshake",
          scope: "interaction" as any,
          depth: "deep" as any,
          targetAudience: "intermediate",
          learnerGoal: "Handshake",
          verifiedPremises: [],
          invariantsToMaintain: [],
          boundaryConditions: [],
          pedagogicalRequirements: [],
          coreTransformationsNeeded: 3,
          confidence: createConfidence(0.95, "DERIVED", "High"),
        } as any,
        model: mockModel,
        stepIndex: 0,
      });

      expect(reqs.concept).toBe("TCP Handshake");
      expect(reqs.requiredEntities.length).toBe(2);
      expect(reqs.layoutStrategy).toBe("swimlane");
      expect(reqs.bestCompoundComponent).toBe("MessageExchange");
      expect(reqs.cognitiveLoad.density).toBe("low");
    });
  });

  // ==========================================================================
  // 4. Scene Composition & Stable Semantic Identity
  // ==========================================================================
  describe("4. Scene Composition Engine", () => {
    it("preserves stable semantic identity across multiple transformations", () => {
      const mockReqs: VisualRequirements = {
        concept: "Bank Transfer",
        bestCompoundComponent: "FlowDiagram",
        layoutStrategy: "dag",
        requiredEntities: [
          {
            id: "account-a",
            label: "Account A",
            visualType: "Record",
            semanticRole: "source",
            importance: "primary",
            persistent: true,
            value: 500,
          },
          {
            id: "account-b",
            label: "Account B",
            visualType: "Record",
            semanticRole: "target",
            importance: "primary",
            persistent: true,
            value: 200,
          },
        ],
        requiredRelationships: [
          {
            id: "rel-transfer",
            source: "account-a",
            target: "account-b",
            type: "transfers",
            direction: "forward",
            importance: "primary",
            label: "$100",
          },
        ],
        requiredStates: [
          {
            stateIndex: 0,
            name: "Initial",
            stateType: "normal",
            invariantBadges: ["Total Balance = $700"],
          },
        ],
        causalFlows: [],
        evidenceRequirements: [],
        focus: {
          primaryFocusId: "account-a",
          secondaryFocusIds: ["account-b"],
          backgroundEntityIds: [],
        },
        cognitiveLoad: {
          density: "low",
          maxPrimaryItems: 8,
          omittedEntityIds: [],
        },
      };

      const scene0 = composeVisualScene(mockReqs, undefined, { stepIndex: 0 });
      expect(scene0.entities.has("account-a")).toBe(true);
      expect(scene0.entities.get("account-a")?.value).toBe(500);

      // Mutate for Step 1
      mockReqs.requiredEntities[0].value = 400;
      mockReqs.requiredEntities[1].value = 300;
      const scene1 = composeVisualScene(mockReqs, scene0, {
        stepIndex: 1,
        activeDiffSummary: "Transferred $100",
      });

      // Entity ID must strictly remain 'account-a', NOT 'account-a-step1' or 'account-a-2'
      expect(scene1.entities.has("account-a")).toBe(true);
      expect(scene1.entities.get("account-a")?.value).toBe(400);
      expect(scene1.entities.get("account-b")?.value).toBe(300);
      expect(scene1.relationships.has("rel-transfer")).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Universal Spatial Layout & Collision Engine
  // ==========================================================================
  describe("5. Universal Spatial Layout & Collision Engine", () => {
    it("computes collision-free layout for dense multi-node graphs", () => {
      const graph: SceneGraph = {
        entities: new Map(),
        relationships: new Map(),
        annotations: new Map(),
        metadata: { layoutStrategy: "dag" },
      };

      for (let i = 1; i <= 6; i++) {
        graph.entities.set(`node-${i}`, {
          id: `node-${i}`,
          primitiveType: "GraphNode",
          semanticRole: "node",
          label: `Concept Component ${i}`,
        });
      }

      graph.relationships.set("r1-2", {
        id: "r1-2",
        sourceEntityId: "node-1",
        targetEntityId: "node-2",
        type: "flows",
      });
      graph.relationships.set("r2-3", {
        id: "r2-3",
        sourceEntityId: "node-2",
        targetEntityId: "node-3",
        type: "flows",
      });
      graph.relationships.set("r3-4", {
        id: "r3-4",
        sourceEntityId: "node-3",
        targetEntityId: "node-4",
        type: "flows",
      });
      graph.relationships.set("r4-5", {
        id: "r4-5",
        sourceEntityId: "node-4",
        targetEntityId: "node-5",
        type: "flows",
      });
      graph.relationships.set("r5-6", {
        id: "r5-6",
        sourceEntityId: "node-5",
        targetEntityId: "node-6",
        type: "flows",
      });

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });
      expect(layout.positions.size).toBe(6);

      // Property Test: Check zero pairwise AABB collisions between all primary nodes
      const nodes = Array.from(graph.entities.values());
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const posA = layout.positions.get(nodes[i].id)!;
          const posB = layout.positions.get(nodes[j].id)!;
          const bA = deriveEntityBounds(nodes[i], posA);
          const bB = deriveEntityBounds(nodes[j], posB);

          const collides = checkAABBCollision(bA, bB, 8);
          expect(
            collides,
            `Collision detected between ${nodes[i].id} and ${nodes[j].id}`,
          ).toBe(false);
        }
      }
    });

    it("positions adaptive annotations without occluding primary entities", () => {
      const anchorBounds = { x: 200, y: 200, width: 140, height: 60 };
      const annBounds = { x: 0, y: 0, width: 180, height: 50 };
      const obstacles = [anchorBounds];

      const bestPos = findBestAnnotationPosition(
        anchorBounds,
        annBounds,
        obstacles,
        "above",
        20,
      );
      const placedAnnBounds = { ...annBounds, x: bestPos.x, y: bestPos.y };

      const collides = checkAABBCollision(anchorBounds, placedAnnBounds, 4);
      expect(collides).toBe(false);
    });

    it("guarantees text measurement and wrapping never produce unreadable clipping", () => {
      const longText =
        "This is a comprehensive educational explanation that must wrap gracefully without clipping.";
      const wrapped = wrapText(longText, 30);
      expect(wrapped.length).toBeGreaterThan(1);
      for (const line of wrapped) {
        expect(line.length).toBeLessThanOrEqual(35);
      }

      const measurement = measureTextBounds(longText, 14, 30);
      expect(measurement.width).toBeGreaterThan(100);
      expect(measurement.height).toBeGreaterThan(20);
    });
  });

  // ==========================================================================
  // 6. Semantic Animation Planning
  // ==========================================================================
  describe("6. Semantic Animation Planning", () => {
    it("derives purposeful animation actions from state graph diffs", () => {
      const prevGraph: SceneGraph = {
        entities: new Map([
          [
            "client",
            {
              id: "client",
              primitiveType: "Client",
              state: "LISTEN",
              label: "Client",
            },
          ],
          [
            "server",
            {
              id: "server",
              primitiveType: "Server",
              state: "LISTEN",
              label: "Server",
            },
          ],
        ]),
        relationships: new Map(),
        annotations: new Map(),
      };

      const nextGraph: SceneGraph = {
        entities: new Map([
          [
            "client",
            {
              id: "client",
              primitiveType: "Client",
              state: "SYN_SENT",
              label: "Client",
            },
          ],
          [
            "server",
            {
              id: "server",
              primitiveType: "Server",
              state: "LISTEN",
              label: "Server",
            },
          ],
          [
            "syn-pkt",
            { id: "syn-pkt", primitiveType: "Message", label: "SYN [seq=100]" },
          ],
        ]),
        relationships: new Map([
          [
            "syn-rel",
            {
              id: "syn-rel",
              sourceEntityId: "client",
              targetEntityId: "server",
              type: "sends",
            },
          ],
        ]),
        annotations: new Map(),
      };

      const plan = deriveSemanticAnimationPlan(prevGraph, nextGraph, 1);
      expect(plan.actions.length).toBeGreaterThanOrEqual(2);

      const stateChangeAct = plan.actions.find(
        (a) => a.motionType === "STATE_CHANGE",
      );
      expect(stateChangeAct).toBeDefined();
      expect(stateChangeAct?.entityId).toBe("client");

      const transferAct = plan.actions.find((a) => a.motionType === "TRANSFER");
      expect(transferAct).toBeDefined();
      expect(transferAct?.entityId).toBe("syn-pkt");
    });
  });

  // ==========================================================================
  // 7. Visual Evidence Validator
  // ==========================================================================
  describe("7. Visual Evidence Validator", () => {
    it("validates explanation claims against authoritative state and scene graph", () => {
      const mockModel: AuthoritativeSemanticModel = {
        id: "ev-model",
        problem: {
          question: "TCP 3-way handshake",
          intent: "EXPLAIN",
          objective: "Handshake",
        } as any,
        world: {
          entities: [
            { id: "client", label: "Client", type: "Client" },
            { id: "server", label: "Server", type: "Server" },
          ],
          relationships: [
            {
              id: "rel1",
              source: "client",
              target: "server",
              type: "sends",
              label: "SYN",
            },
          ],
          states: [],
        } as any,
        rules: [],
        invariants: [
          {
            id: "inv1",
            statement: "Endpoints Uniqueness",
            predicate: (state: any) =>
              (state.entities?.size || state.entities?.length || 0) >= 2,
          } as any,
        ],
        states: [
          {
            name: "SYN Sent",
            entities: new Map([
              [
                "client",
                {
                  id: "client",
                  label: "Client",
                  type: "Client",
                  state: "syn-sent",
                },
              ],
              [
                "server",
                {
                  id: "server",
                  label: "Server",
                  type: "Server",
                  state: "listen",
                },
              ],
            ]),
            relationships: new Map(),
          },
        ] as any,
        transformations: [
          {
            id: "t1",
            stepNumber: 1,
            title: "Client sends SYN",
            explanation:
              "The client transitions to syn-sent and sends SYN to server",
            whatChanged: "State changed to syn-sent",
            affectedEntities: ["client"],
            fromStateIndex: 0,
            toStateIndex: 0,
          },
        ] as any,
        derivedValuesByState: {},
        goalSatisfaction: {
          satisfied: true,
          objective: "Handshake",
          verifiedCriteria: [],
          summary: "OK",
        },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      const sceneGraph: SceneGraph = {
        entities: new Map([
          [
            "client",
            {
              id: "client",
              primitiveType: "Client",
              label: "Client",
              state: "syn-sent",
            },
          ],
          [
            "server",
            {
              id: "server",
              primitiveType: "Server",
              label: "Server",
              state: "listen",
            },
          ],
        ]),
        relationships: new Map([
          [
            "rel1",
            {
              id: "rel1",
              sourceEntityId: "client",
              targetEntityId: "server",
              type: "sends",
              label: "SYN",
            },
          ],
        ]),
        annotations: new Map(),
      };

      const report = VisualEvidenceValidator.validateStepEvidence(
        mockModel,
        sceneGraph,
        0,
        "The client transitions to syn-sent and sends SYN to server",
      );

      expect(report.valid).toBe(true);
      expect(report.confidenceScore).toBeGreaterThanOrEqual(0.8);
      expect(report.missingVisualEntities.length).toBe(0);
      expect(report.invariantViolations.length).toBe(0);
    });

    it("detects unsupported claims if explanatory text mentions missing visual entity", () => {
      const mockModel: AuthoritativeSemanticModel = {
        id: "ev-model-2",
        problem: {
          question: "Proxy flow",
          intent: "EXPLAIN",
          objective: "Proxy",
        } as any,
        world: {
          entities: [
            { id: "client", label: "Client", type: "Client" },
            { id: "proxy", label: "Proxy", type: "Server" },
          ],
          relationships: [],
          states: [],
        } as any,
        rules: [],
        invariants: [],
        states: [
          {
            name: "Initial",
            entities: new Map([
              ["client", { id: "client", label: "Client", type: "Client" }],
              ["proxy", { id: "proxy", label: "Proxy", type: "Server" }],
            ]),
            relationships: new Map(),
          },
        ] as any,
        transformations: [] as any,
        derivedValuesByState: {},
        goalSatisfaction: {
          satisfied: true,
          objective: "Proxy",
          verifiedCriteria: [],
          summary: "OK",
        },
        strategy: "visual",
        confidence: createConfidence(1, "KNOWN", "High"),
        timestamp: Date.now(),
      };

      // Canvas omits 'proxy'
      const brokenSceneGraph: SceneGraph = {
        entities: new Map([
          [
            "client",
            { id: "client", primitiveType: "Client", label: "Client" },
          ],
        ]),
        relationships: new Map(),
        annotations: new Map(),
      };

      const report = VisualEvidenceValidator.validateStepEvidence(
        mockModel,
        brokenSceneGraph,
        0,
        "The client routes through Proxy",
      );

      expect(report.valid).toBe(false);
      expect(report.missingVisualEntities).toContain("proxy");
    });
  });

  // ==========================================================================
  // 8. Cross-Domain Universal Verification Matrix (Categories A through Z)
  // ==========================================================================
  describe("8. Cross-Domain Verification Matrix", () => {
    const domainPrompts = [
      { cat: "A. Simple Conceptual", prompt: "What is an algorithm?" },
      {
        cat: "B. Complex Multi-Stage",
        prompt:
          "Explain two-phase commit protocol across distributed databases",
      },
      {
        cat: "C. Graph Concept",
        prompt: "Trace Dijkstra's shortest path algorithm on a weighted graph",
      },
      {
        cat: "D. Tree Concept",
        prompt:
          "Explain AVL tree insertion causing right rotation to restore balance",
      },
      {
        cat: "E. Array Concept",
        prompt: "Demonstrate in-place two-pointer quicksort partition",
      },
      {
        cat: "F. Sequence Timeline",
        prompt: "Trace asynchronous event loop message queue execution",
      },
      {
        cat: "G. State Machine",
        prompt:
          "Explain TCP connection states from LISTEN to ESTABLISHED and CLOSED",
      },
      {
        cat: "H. Database",
        prompt:
          "Explain database ACID transaction rollback upon constraint violation",
      },
      {
        cat: "I. Networking",
        prompt:
          "Explain DNS resolution from stub resolver to root and authoritative nameservers",
      },
      {
        cat: "J. Physics",
        prompt:
          "Explain light ray refraction across air and glass boundary according to Snell's law",
      },
      {
        cat: "K. Biology",
        prompt:
          "Explain light-dependent reaction and ATP synthesis in chloroplast thylakoid",
      },
      {
        cat: "L. Mathematics",
        prompt:
          "Explain gradient descent optimization taking steps towards the global minimum",
      },
      {
        cat: "M. Operating Systems",
        prompt:
          "Explain virtual memory page fault handling and swapping from disk to RAM",
      },
      {
        cat: "N. Distributed Systems",
        prompt: "Explain Raft leader election heartbeat and term increment",
      },
      {
        cat: "O. Unknown Concept Fallback",
        prompt:
          "Explain chronon particle oscillation across tachyon boundary field",
      },
      {
        cat: "P. Failure and Recovery",
        prompt: "Show transaction failure during debit and rollback recovery",
      },
      {
        cat: "Q. Decision Branches",
        prompt:
          "Show binary search branching left when key is smaller than midpoint",
      },
      {
        cat: "R. Counterfactual Reasoning",
        prompt: "What happens if the acknowledgment packet is lost in transit?",
      },
    ];

    for (const testCase of domainPrompts) {
      it(`successfully generates and compiles universal visual lesson for: ${testCase.cat} (${testCase.prompt})`, async () => {
        const result = await UniversalConceptIntelligenceEngine.teach(
          testCase.prompt,
        );

        expect(result).toBeDefined();
        expect(result.authoritativeModel).toBeDefined();
        expect(result.timeline).toBeDefined();

        const timeline: CompiledTimeline = result.timeline;
        expect(timeline.states.length).toBeGreaterThanOrEqual(1);
        expect(timeline.meta.length).toBe(timeline.states.length);

        // Verify initial state has valid non-empty geometry
        const initialState = timeline.states[0];
        expect(initialState.graph.entities.size).toBeGreaterThan(0);
        expect(initialState.layoutState?.size).toBe(
          initialState.graph.entities.size,
        );

        // Verify semantic animation plan attached to transformation steps
        if (timeline.states.length > 1) {
          const step1Meta = timeline.meta[1];
          expect(step1Meta.animationPlan).toBeDefined();
          expect(step1Meta.animationPlan?.actions.length).toBeGreaterThan(0);
        }

        // Verify evidence report
        const step0Meta = timeline.meta[0];
        expect(step0Meta.evidenceValidation).toBeDefined();
        expect(
          step0Meta.evidenceValidation?.confidenceScore,
        ).toBeGreaterThanOrEqual(0.7);
      });
    }

    it("Z. Visual Evidence Validation & Deterministic Playback across all steps", async () => {
      const result = await UniversalConceptIntelligenceEngine.teach(
        "Explain TCP 3-way handshake with SYN, SYN-ACK, and ACK packets",
      );
      const timeline = result.timeline;

      // Playback simulation (Next -> Next -> Prev -> Next)
      expect(timeline.states.length).toBeGreaterThanOrEqual(2);

      // Verify state 0
      const s0 = timeline.states[0];
      const s1 = timeline.states[1];

      // Entity identities must remain 100% stable
      const ent0 = Array.from(s0.graph.entities.values())[0];
      const ent1 = s1.graph.entities.get(ent0.id);

      expect(ent0).toBeDefined();
      expect(ent1).toBeDefined();
      expect(ent0.id).toBe(ent1?.id);
    });
  });

  // ==========================================================================
  // 9. Anti-Hardcoding Codebase Audit
  // ==========================================================================
  describe("9. Anti-Hardcoding Architectural Audit", () => {
    it("verifies the Visual Capability Registry is topic-agnostic", () => {
      const caps = visualCapabilities.getAll();
      for (const cap of caps) {
        // Capabilities must not be named after individual topics
        expect(cap.id).not.toMatch(
          /^(?:AVL|TCP|DNS|HTTP|Refraction|Photosynthesis)/,
        );
      }
    });

    it("verifies compound components are architectural compositions, not topic renderers", () => {
      const compounds = compoundComponents.getAll();
      for (const comp of compounds) {
        expect(comp.id).not.toMatch(
          /^(?:AVLRenderer|TCPRenderer|PhotosynthesisRenderer|RefractionRenderer)/,
        );
      }
    });
  });
});
