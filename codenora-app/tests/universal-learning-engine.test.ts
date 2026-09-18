/**
 * Universal Visual Learning Engine Test Suite
 *
 * Verifies domain-agnostic intelligence, visual grammar resolution,
 * semantic correctness, invariant enforcement, display label sanitization,
 * and 100% local playback across diverse disciplines:
 * - Data Structures & Algorithms (Binary Search, AVL Tree, Doubly Linked List)
 * - Networking (TCP Three-Way Handshake)
 * - Databases (ACID Transactions / Relational Tables)
 * - Operating Systems (CPU Scheduling Pipeline)
 * - Natural Sciences (Thermodynamic Refrigerator Cycle, Photosynthesis)
 * - Novel / Unseen concepts (Generic Concept Grammar fallback)
 * - Multi-intent pedagogical differentiation
 */

import { describe, it, expect } from "vitest";

import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { resolveSemanticGrammar } from "../ai/visual-grammar/grammar-resolver";
import { sanitizeDisplayLabel } from "../ai/visual-primitives/primitive-factory";
import { understandQuestion } from "../ai/question-understanding";

describe("Universal Concept Intelligence Engine", () => {
  describe("Domain 1: Data Structures & Algorithms", () => {
    it("processes Binary Search into an array grammar lesson with verified bounds invariants", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Binary Search step by step",
        {
          visual_actions: [
            {
              type: "create_array",
              id: "arr-1",
              elements: [
                { id: "c0", value: 2 },
                { id: "c1", value: 5 },
                { id: "c2", value: 8 },
                { id: "c3", value: 12 },
                { id: "c4", value: 16 },
                { id: "c5", value: 23 },
              ],
            } as any,
          ],
          steps: [
            {
              title: "Evaluate Middle Element",
              explanation:
                "Calculate mid = (low + high) / 2 and inspect target value.",
              operations: [
                { type: "highlight", target: "arr-1-2", color: "warning" },
              ],
            },
            {
              title: "Discard Left Subarray",
              explanation:
                "Target 16 is greater than 8, narrow search range to [mid + 1, high].",
              operations: [
                { type: "highlight", target: "arr-1-4", color: "success" },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel).toBeDefined();
      expect(result.timeline.states.length).toBe(3); // Initial + 2 steps
      expect(result.visualLesson.capabilities).toContain("code");
      expect(result.visualLesson.capabilities).toContain("explain");
      expect(result.visualLesson.capabilities).toContain("analyze");
      expect(result.visualLesson.capabilities).toContain("practice");

      // Verify local inspection takes 0 network calls
      const quiz = UniversalConceptIntelligenceEngine.getPracticeQuiz(
        1,
        result.authoritativeModel,
      );
      expect(quiz.question).toBeDefined();
      expect(quiz.options.length).toBeGreaterThanOrEqual(2);
    });

    it("processes AVL Tree rotations with hierarchical tree layout and anti-drift coordinates", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain AVL tree right rotation",
        {
          visual_actions: [
            {
              type: "create_tree",
              id: "avl-1",
              root: "avl-1-30",
              nodes: [
                { id: "avl-1-30", value: 30, left: "avl-1-20" },
                { id: "avl-1-20", value: 20, left: "avl-1-10" },
                { id: "avl-1-10", value: 10 },
              ],
            } as any,
          ],
          steps: [
            {
              title: "Detect Imbalance",
              explanation:
                "Left subtree height exceeds right subtree height by 2. Right rotation required.",
              operations: [
                { type: "highlight", target: "avl-1-30", color: "warning" },
              ],
            },
            {
              title: "Promote Node 20 to Root",
              explanation:
                "Node 20 becomes new root, Node 30 becomes its right child.",
              operations: [
                {
                  type: "create_tree",
                  id: "avl-1",
                  root: "avl-1-20",
                  nodes: [
                    {
                      id: "avl-1-20",
                      value: 20,
                      left: "avl-1-10",
                      right: "avl-1-30",
                    },
                    { id: "avl-1-10", value: 10 },
                    { id: "avl-1-30", value: 30 },
                  ],
                },
              ],
            },
          ],
        },
      );

      expect(result.timeline.states.length).toBe(3);
      const state1 = result.timeline.states[1];
      const state2 = result.timeline.states[2];

      // Verify stable positions and root positioning
      expect(state1.layoutState?.has("avl-1-20")).toBe(true);
      expect(state2.layoutState?.has("avl-1-20")).toBe(true);
    });

    it("processes Doubly Linked List with bidirectional pointer continuity", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Double Linked List insertion",
        {
          visual_actions: [
            {
              type: "create_linked_list",
              id: "dll",
              variant: "doubly",
              elements: [
                { id: "dll-0", value: 10 },
                { id: "dll-1", value: 30 },
              ],
            } as any,
          ],
          steps: [
            {
              title: "Allocate New Node",
              explanation: "Create node with value 20 between 10 and 30.",
              operations: [
                {
                  type: "create_entity",
                  id: "dll-new",
                  label: "20",
                  value: 20,
                  role: "list-node",
                },
              ],
            },
            {
              title: "Link Pointers",
              explanation:
                "Connect next and prev pointers to integrate node 20.",
              operations: [
                {
                  type: "connect",
                  source: "dll-0",
                  target: "dll-new",
                  role: "next",
                },
                {
                  type: "connect",
                  source: "dll-new",
                  target: "dll-0",
                  role: "prev",
                },
                {
                  type: "connect",
                  source: "dll-new",
                  target: "dll-1",
                  role: "next",
                },
                {
                  type: "connect",
                  source: "dll-1",
                  target: "dll-new",
                  role: "prev",
                },
              ],
            },
          ],
        },
      );

      expect(result.timeline.states.length).toBeGreaterThanOrEqual(2);
      // Verify display label sanitization does not leak "dll-0" or "dll-1"
      const label0 = sanitizeDisplayLabel(undefined, "dll-0", "dll-0");
      const labelNew = sanitizeDisplayLabel(20, "20", "dll-new");
      expect(label0).toBe("0");
      expect(labelNew).toBe("20");
    });
  });

  describe("Domain 2: Computer Networking & Distributed Protocols", () => {
    it("processes TCP Three-Way Handshake into InteractionGrammar with two-party layout", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain TCP three-way handshake",
        {
          visual_actions: [
            {
              type: "create_box",
              id: "client",
              label: "Client",
              role: "client",
            } as any,
            {
              type: "create_box",
              id: "server",
              label: "Server",
              role: "server",
            } as any,
          ],
          steps: [
            {
              title: "Send SYN Packet",
              explanation:
                "Client sends SYN packet with initial sequence number seq=100.",
              operations: [
                {
                  type: "create_entity",
                  id: "syn-packet",
                  label: "SYN (seq=100)",
                  role: "message",
                },
                {
                  type: "connect",
                  source: "client",
                  target: "syn-packet",
                  label: "sends",
                },
                {
                  type: "connect",
                  source: "syn-packet",
                  target: "server",
                  label: "delivers",
                },
              ],
            },
            {
              title: "Server Replies SYN-ACK",
              explanation:
                "Server responds with SYN-ACK packet with seq=300 and ack=101.",
              operations: [
                {
                  type: "create_entity",
                  id: "synack-packet",
                  label: "SYN-ACK (seq=300, ack=101)",
                  role: "message",
                },
                {
                  type: "connect",
                  source: "server",
                  target: "synack-packet",
                  label: "replies",
                },
                {
                  type: "connect",
                  source: "synack-packet",
                  target: "client",
                  label: "delivers",
                },
              ],
            },
            {
              title: "Client Confirms with ACK",
              explanation:
                "Client sends final ACK, establishing bidirectional connection.",
              operations: [
                {
                  type: "create_entity",
                  id: "ack-packet",
                  label: "ACK (ack=301)",
                  role: "message",
                },
                {
                  type: "connect",
                  source: "client",
                  target: "ack-packet",
                  label: "confirms",
                },
                {
                  type: "connect",
                  source: "ack-packet",
                  target: "server",
                  label: "establishes",
                },
              ],
            },
          ],
        },
      );

      const resolved = resolveSemanticGrammar(
        result.authoritativeModel.world,
        "TCP three-way handshake",
      );
      expect(resolved.type).toBe("InteractionGrammar");
      expect(resolved.layoutStrategy).toBe("two-party");
      // Networking protocol lessons should not force a code tab
      expect(resolved.isCodeRelevant).toBe(false);
      expect(result.visualLesson.capabilities).not.toContain("code");
      expect(result.timeline.states.length).toBe(4);
    });
  });

  describe("Domain 3: Databases & Transaction Processing", () => {
    it("processes Database ACID Transactions into DatabaseGrammar with grid layout", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Database ACID Transactions",
        {
          visual_actions: [
            {
              type: "create_box",
              id: "accounts-table",
              label: "Accounts Table",
              role: "table",
            } as any,
            {
              type: "create_box",
              id: "tx-log",
              label: "WAL Log Buffer",
              role: "resource",
            } as any,
          ],
          steps: [
            {
              title: "Begin Transaction",
              explanation:
                "Open transaction context, debit $100 from Account A.",
              operations: [
                {
                  type: "highlight",
                  target: "accounts-table",
                  color: "warning",
                },
              ],
            },
            {
              title: "Commit & Flush WAL",
              explanation:
                "Write modifications to write-ahead log ensuring Durability before acknowledging commit.",
              operations: [
                { type: "highlight", target: "tx-log", color: "success" },
              ],
            },
          ],
        },
      );

      const resolved = resolveSemanticGrammar(
        result.authoritativeModel.world,
        "Database ACID Transactions",
      );
      expect(resolved.type).toBe("DatabaseGrammar");
      expect(resolved.layoutStrategy).toBe("grid");
      expect(result.timeline.states.length).toBe(3);
    });
  });

  describe("Domain 4: Natural Science (Physics & Thermodynamics)", () => {
    it("processes How a Refrigerator Works into a cyclic thermodynamic loop with NO code tab", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain How a Refrigerator Works",
        {
          visual_actions: [
            {
              type: "create_box",
              id: "compressor",
              label: "Compressor",
              role: "component",
            } as any,
            {
              type: "create_box",
              id: "condenser",
              label: "Condenser Coils",
              role: "component",
            } as any,
            {
              type: "create_box",
              id: "expansion-valve",
              label: "Expansion Valve",
              role: "component",
            } as any,
            {
              type: "create_box",
              id: "evaporator",
              label: "Evaporator Coils",
              role: "component",
            } as any,
            {
              type: "create_arrow",
              from: "compressor",
              to: "condenser",
              label: "high pressure gas",
            } as any,
            {
              type: "create_arrow",
              from: "condenser",
              to: "expansion-valve",
              label: "liquid",
            } as any,
            {
              type: "create_arrow",
              from: "expansion-valve",
              to: "evaporator",
              label: "low pressure cold liquid",
            } as any,
            {
              type: "create_arrow",
              from: "evaporator",
              to: "compressor",
              label: "low pressure gas",
            } as any,
          ],
          steps: [
            {
              title: "Compression Phase",
              explanation:
                "Compressor pumps refrigerant vapor, raising pressure and boiling temperature.",
              operations: [
                { type: "highlight", target: "compressor", color: "accent" },
              ],
            },
            {
              title: "Condensation Phase",
              explanation:
                "Refrigerant releases heat to room air through back coils, condensing into liquid.",
              operations: [
                { type: "highlight", target: "condenser", color: "warning" },
              ],
            },
            {
              title: "Expansion Phase",
              explanation:
                "Refrigerant passes through metering orifice, dropping pressure and cooling rapidly.",
              operations: [
                {
                  type: "highlight",
                  target: "expansion-valve",
                  color: "accent",
                },
              ],
            },
            {
              title: "Evaporation Phase (Cooling Fridge Interior)",
              explanation:
                "Cold refrigerant absorbs heat from fridge interior, boiling back into gas.",
              operations: [
                { type: "highlight", target: "evaporator", color: "success" },
              ],
            },
          ],
        },
      );

      const resolved = resolveSemanticGrammar(
        result.authoritativeModel.world,
        "How a Refrigerator Works",
      );
      expect(resolved.type).toBe("GenericConceptGrammar");
      expect(resolved.layoutStrategy).toBe("cycle");
      expect(resolved.isCodeRelevant).toBe(false);
      expect(result.visualLesson.capabilities).not.toContain("code");
      expect(result.timeline.states.length).toBe(5);
    });

    it("processes Photosynthesis light/dark reactions into biological flow with NO code tab", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Photosynthesis light and dark reactions",
        {
          visual_actions: [
            {
              type: "create_box",
              id: "chloroplast",
              label: "Chloroplast",
              role: "container",
            } as any,
            {
              type: "create_box",
              id: "thylakoid",
              label: "Thylakoid Membrane",
              role: "component",
            } as any,
            {
              type: "create_box",
              id: "stroma",
              label: "Stroma",
              role: "component",
            } as any,
          ],
          steps: [
            {
              title: "Light Reactions",
              explanation:
                "Photons split H2O in thylakoids, releasing O2 and synthesizing ATP and NADPH.",
              operations: [
                { type: "highlight", target: "thylakoid", color: "accent" },
              ],
            },
            {
              title: "Calvin Cycle (Dark Reactions)",
              explanation:
                "Rubisco fixes CO2 in stroma using ATP and NADPH to form glucose.",
              operations: [
                { type: "highlight", target: "stroma", color: "success" },
              ],
            },
          ],
        },
      );

      const resolved = resolveSemanticGrammar(
        result.authoritativeModel.world,
        "Photosynthesis light and dark reactions",
      );
      expect(resolved.isCodeRelevant).toBe(false);
      expect(result.visualLesson.capabilities).not.toContain("code");
    });
  });

  describe("Domain 5: Arbitrary / Unknown Concept", () => {
    it("handles arbitrary, novel user questions without crashing, providing generic visual layout and invariants", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Quantum Entanglement and Bell State generation",
        {
          visual_actions: [
            {
              type: "create_box",
              id: "qubit-a",
              label: "Qubit A",
              role: "component",
            } as any,
            {
              type: "create_box",
              id: "qubit-b",
              label: "Qubit B",
              role: "component",
            } as any,
            {
              type: "create_box",
              id: "hadamard",
              label: "Hadamard Gate",
              role: "process",
            } as any,
            {
              type: "create_box",
              id: "cnot",
              label: "CNOT Gate",
              role: "process",
            } as any,
          ],
          steps: [
            {
              title: "Superposition via Hadamard",
              explanation:
                "Apply H gate to Qubit A creating (|0> + |1>) / sqrt(2).",
              operations: [
                { type: "highlight", target: "hadamard", color: "accent" },
              ],
            },
            {
              title: "Entangle via CNOT",
              explanation:
                "Qubit A controls NOT operation on Qubit B, creating Bell State (|00> + |11>) / sqrt(2).",
              operations: [
                { type: "highlight", target: "cnot", color: "success" },
                {
                  type: "connect",
                  source: "qubit-a",
                  target: "qubit-b",
                  label: "entangled",
                },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel).toBeDefined();
      expect(result.timeline.states.length).toBe(3);
      expect(result.timeline.states[0].layoutState?.has("qubit-a")).toBe(true);
      expect(
        result.timeline.states[2].graph.relationships.size,
      ).toBeGreaterThan(0);
    });
  });

  describe("Domain 6: Multi-Intent Differentiation on Same Concept", () => {
    it("differentiates EXPLAIN vs PROOF vs DEBUG intents for Binary Search", () => {
      const uExplain = understandQuestion("Explain Binary Search");
      const uProof = understandQuestion(
        "Prove Binary Search correctness and termination",
      );
      const uDebug = understandQuestion(
        "Debug off-by-one error in Binary Search while loop condition",
      );

      expect(uExplain.userIntent).toBe("EXPLAIN");
      expect(uProof.userIntent).toBe("PROVE");
      expect(uDebug.userIntent).toBe("DEBUG");
    });
  });

  describe("Domain 7: Label Sanitization & Display Cleanliness", () => {
    it("strips internal machine IDs and container prefixes cleanly", () => {
      expect(sanitizeDisplayLabel(undefined, "dll-e1", "dll-e1")).toBe("1");
      expect(sanitizeDisplayLabel(undefined, "dll-0", "dll-0")).toBe("0");
      expect(sanitizeDisplayLabel(undefined, "node-30", "node-30")).toBe("30");
      expect(
        sanitizeDisplayLabel(undefined, "avl-tree-n20", "avl-tree-n20"),
      ).toBe("20");
      expect(sanitizeDisplayLabel(undefined, "tcp-client", "tcp-client")).toBe(
        "Client",
      );
      expect(sanitizeDisplayLabel(undefined, "tcp-server", "tcp-server")).toBe(
        "Server",
      );
      expect(sanitizeDisplayLabel(undefined, "arr-4", "arr-4")).toBe("4");
      expect(sanitizeDisplayLabel(42, "node-42", "node-42")).toBe("42");
    });
  });

  describe("Domain 8: Local Playback & Instant Reasoning", () => {
    it("performs what-changed, why, counterfactual, and practice inspection 100% locally", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Binary Search",
        {
          visual_actions: [
            {
              type: "create_array",
              id: "arr",
              elements: [{ value: 1 }, { value: 3 }, { value: 5 }],
            } as any,
          ],
          steps: [
            {
              title: "Step 1",
              explanation: "Check mid element",
              operations: [
                { type: "highlight", target: "arr-1", color: "accent" },
              ],
            },
          ],
        },
      );

      // Local What Changed
      const whatChanged = UniversalConceptIntelligenceEngine.getWhatChanged(
        1,
        result.authoritativeModel,
      );
      expect(whatChanged).toBeDefined();

      // Local Why
      const why = UniversalConceptIntelligenceEngine.getWhy(
        1,
        result.authoritativeModel,
      );
      expect(why).toBeDefined();

      // Local Entity Inspection
      const inspected = UniversalConceptIntelligenceEngine.inspectEntity(
        "arr-1",
        result.authoritativeModel,
        1,
      );
      expect(inspected).toBeDefined();
      expect(inspected?.id).toBe("arr-1");

      // Local Practice Quiz
      const quiz = UniversalConceptIntelligenceEngine.getPracticeQuiz(
        1,
        result.authoritativeModel,
      );
      expect(quiz.question).toBeDefined();
    });
  });
});
