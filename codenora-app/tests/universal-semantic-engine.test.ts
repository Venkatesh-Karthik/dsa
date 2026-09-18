// @vitest-environment jsdom
import "vitest-canvas-mock";
import { describe, it, expect } from "vitest";

import {
  createSemanticEntity,
  createSemanticRelationship,
  createSemanticState,
  applySemanticOperation,
  applySemanticOperations,
  type SemanticOperation,
  type SemanticState,
} from "../ai/semantic-world";
import {
  InvariantEngine,
  evaluateBST,
  evaluateAVL,
  evaluateAcyclic,
} from "../ai/rules-invariants";
import {
  CorrectnessEngine,
  SemanticRepairEngine,
} from "../ai/correctness-engine";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { compileAuthoritativeTimeline } from "../ai/transformation-timeline";
import { reconcileSceneState } from "../ai/scene-reconciler";

describe("Cognora Intelligence 3.0: Universal Semantic Teaching Engine", () => {
  describe("Property 1: State transitions are deterministic", () => {
    it("produces identical successor states given the same operations", () => {
      const s0 = createSemanticState(0, "s0", {
        entities: new Map([
          [
            "node-10",
            createSemanticEntity(
              "node-10",
              "TreeNode",
              "10",
              {},
              { value: 10 },
            ),
          ],
          [
            "node-20",
            createSemanticEntity(
              "node-20",
              "TreeNode",
              "20",
              {},
              { value: 20 },
            ),
          ],
        ]),
      });

      const op: SemanticOperation = {
        type: "connect_relation",
        id: "rel-10-20",
        source: "node-10",
        target: "node-20",
        relationType: "right",
      };

      const s1a = applySemanticOperation(s0, op);
      const s1b = applySemanticOperation(s0, op);

      expect(s1a.relationships.size).toBe(1);
      expect(s1b.relationships.size).toBe(1);
      expect(s1a.relationships.get("rel-10-20")?.target).toBe("node-20");
      expect(s1b.relationships.get("rel-10-20")?.target).toBe("node-20");
      expect(s0.relationships.size).toBe(0);
    });
  });

  describe("Property 2: Invariants are actually executed and never silently skipped", () => {
    it("actively detects and fails an invalid BST state", () => {
      const invalidBST = createSemanticState(0, "invalid-bst", {
        entities: new Map([
          [
            "root",
            createSemanticEntity("root", "TreeNode", "20", {}, { value: 20 }),
          ],
          [
            "left",
            createSemanticEntity("left", "TreeNode", "30", {}, { value: 30 }),
          ],
        ]),
        relationships: new Map([
          [
            "rel-1",
            createSemanticRelationship("rel-1", "root", "left", "left"),
          ],
        ]),
      });

      const bstResult = evaluateBST(invalidBST);
      expect(bstResult.holds).toBe(false);
      expect(bstResult.details).toContain("BST ordering violated");
    });

    it("actively detects and fails an unbalanced AVL state", () => {
      const unbalancedTree = createSemanticState(0, "unbalanced", {
        entities: new Map([
          [
            "n30",
            createSemanticEntity("n30", "TreeNode", "30", {}, { value: 30 }),
          ],
          [
            "n20",
            createSemanticEntity("n20", "TreeNode", "20", {}, { value: 20 }),
          ],
          [
            "n10",
            createSemanticEntity("n10", "TreeNode", "10", {}, { value: 10 }),
          ],
        ]),
        relationships: new Map([
          ["r1", createSemanticRelationship("r1", "n30", "n20", "left")],
          ["r2", createSemanticRelationship("r2", "n20", "n10", "left")],
        ]),
      });

      const avlResult = evaluateAVL(unbalancedTree);
      expect(avlResult.holds).toBe(false);
      expect(avlResult.details).toContain("AVL balance violated");
    });

    it("evaluates balanced AVL tree as valid", () => {
      const balancedTree = createSemanticState(0, "balanced", {
        entities: new Map([
          [
            "n20",
            createSemanticEntity("n20", "TreeNode", "20", {}, { value: 20 }),
          ],
          [
            "n10",
            createSemanticEntity("n10", "TreeNode", "10", {}, { value: 10 }),
          ],
          [
            "n30",
            createSemanticEntity("n30", "TreeNode", "30", {}, { value: 30 }),
          ],
        ]),
        relationships: new Map([
          ["r1", createSemanticRelationship("r1", "n20", "n10", "left")],
          ["r2", createSemanticRelationship("r2", "n20", "n30", "right")],
        ]),
      });

      const avlResult = evaluateAVL(balancedTree);
      const bstResult = evaluateBST(balancedTree);
      expect(avlResult.holds).toBe(true);
      expect(bstResult.holds).toBe(true);
    });
  });

  describe("Property 3: False steps are rejected by the semantic engine", () => {
    it("rejects duplicate identical states having zero diff", () => {
      const ent = createSemanticEntity("node-1", "Node", "A");
      const s0 = createSemanticState(0, "s0", {
        entities: new Map([["node-1", { ...ent }]]),
      });
      const s1 = createSemanticState(1, "s1", {
        entities: new Map([["node-1", { ...ent }]]),
      });

      expect(SemanticRepairEngine.hasMeaningfulDifference(s0, s1)).toBe(false);
    });
  });

  describe("Property 4: True Goal Verification (Not a Tautology)", () => {
    it("rejects an unfinished or failed lesson even if syntax is valid", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Demonstrate AVL rotation to rebalance tree [30, 20, 10]",
        {
          entities: [
            createSemanticEntity("n30", "TreeNode", "30", {}, { value: 30 }),
            createSemanticEntity("n20", "TreeNode", "20", {}, { value: 20 }),
            createSemanticEntity("n10", "TreeNode", "10", {}, { value: 10 }),
          ],
          relationships: [
            createSemanticRelationship("r1", "n30", "n20", "left"),
            createSemanticRelationship("r2", "n20", "n10", "left"),
          ],
          steps: [
            {
              title: "Observe unbalanced tree",
              explanation: "Tree is left-heavy",
              visual_actions: [{ type: "highlight", target: "n30" } as any],
            },
          ],
        },
      );

      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(false);
    });
  });

  describe("Property 5: Single Entity Identity across layers", () => {
    it("preserves stable IDs from SemanticEntity to SceneGraph and CompiledTimeline", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain TCP Connection",
        {
          entities: [
            createSemanticEntity("client-host", "Client", "Client"),
            createSemanticEntity("server-host", "Server", "Server"),
          ],
          relationships: [
            createSemanticRelationship(
              "syn-edge",
              "client-host",
              "server-host",
              "connects",
            ),
          ],
          steps: [
            {
              title: "Send SYN",
              explanation: "Client initiates handshake",
              visual_actions: [
                { type: "highlight", target: "client-host" } as any,
              ],
            },
          ],
        },
      );

      const timeline = result.timeline;
      expect(timeline.states[0].graph.entities.has("client-host")).toBe(true);
      expect(timeline.states[0].graph.entities.has("server-host")).toBe(true);
      expect(timeline.states[0].graph.relationships.has("syn-edge")).toBe(true);
    });
  });

  describe("Property 6: Native Excalidraw Arrow Bindings", () => {
    it("attaches startBinding and endBinding when reconciling connectors", () => {
      const graph = {
        entities: new Map([
          [
            "node-a",
            { id: "node-a", primitiveType: "GenericEntity", label: "A" },
          ],
          [
            "node-b",
            { id: "node-b", primitiveType: "GenericEntity", label: "B" },
          ],
        ]),
        relationships: new Map([
          [
            "edge-ab",
            {
              id: "edge-ab",
              sourceEntityId: "node-a",
              targetEntityId: "node-b",
              type: "connects",
            },
          ],
        ]),
      };

      const sceneState = {
        graph,
        layoutState: new Map([
          ["node-a", { x: 100, y: 100, width: 80, height: 60 }],
          ["node-b", { x: 300, y: 100, width: 80, height: 60 }],
        ]),
      };

      const reconciled = reconcileSceneState(
        sceneState as any,
        [],
        "test-lesson",
      );

      const arrow = reconciled.elements.find(
        (el) => el.type === "arrow",
      ) as any;
      expect(arrow).toBeDefined();
      expect(arrow.startBinding).toBeDefined();
      expect(arrow.endBinding).toBeDefined();
      expect(arrow.startBinding.elementId).toBe(
        reconciled.primaryElementMap.get("node-a")?.id,
      );
      expect(arrow.endBinding.elementId).toBe(
        reconciled.primaryElementMap.get("node-b")?.id,
      );
    });
  });

  describe("Domain Correctness Battery", () => {
    it("1. DSA: Validates complete AVL Left Rotation on [10, 20, 30]", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Show inserting 30 into AVL tree [10, 20] triggering a Left-Left rotation",
        {
          entities: [
            createSemanticEntity("n10", "TreeNode", "10", {}, { value: 10 }),
            createSemanticEntity("n20", "TreeNode", "20", {}, { value: 20 }),
            createSemanticEntity("n30", "TreeNode", "30", {}, { value: 30 }),
          ],
          relationships: [
            createSemanticRelationship("r1", "n10", "n20", "right"),
            createSemanticRelationship("r2", "n20", "n30", "right"),
          ],
          steps: [
            {
              title: "Left Rotation Pivot",
              explanation:
                "Node 20 rotates up to become root; 10 becomes its left child, 30 remains right child",
              operations: [
                { type: "disconnect_relation", id: "r1" },
                {
                  type: "connect_relation",
                  id: "r-new-left",
                  source: "n20",
                  target: "n10",
                  relationType: "left",
                },
              ],
            },
          ],
        },
      );

      const finalState = result.authoritativeModel.states[1];
      const avlCheck = evaluateAVL(finalState);
      const bstCheck = evaluateBST(finalState);

      expect(avlCheck.holds).toBe(true);
      expect(bstCheck.holds).toBe(true);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("2. Networking: HTTP GET Lifecycle", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain HTTP GET request lifecycle",
        {
          entities: [
            createSemanticEntity("browser", "Client", "Web Browser"),
            createSemanticEntity("api-server", "Server", "API Server"),
            createSemanticEntity("db", "Database", "Database"),
          ],
          relationships: [
            createSemanticRelationship(
              "http-req",
              "browser",
              "api-server",
              "http_get",
              "forward",
              { label: "GET /users" },
            ),
            createSemanticRelationship(
              "db-query",
              "api-server",
              "db",
              "sql_query",
              "forward",
              { label: "SELECT *" },
            ),
          ],
          steps: [
            {
              title: "Request Dispatch",
              explanation: "Browser sends HTTP request to API server",
              visual_actions: [{ type: "highlight", target: "browser" } as any],
            },
            {
              title: "Response Return",
              explanation: "Server returns 200 OK with payload",
              operations: [
                {
                  type: "connect_relation",
                  id: "resp",
                  source: "api-server",
                  target: "browser",
                  relationType: "http_200",
                  label: "200 OK",
                },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel.states.length).toBe(3);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("3. Operating Systems: Process Scheduling", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Simulate Round Robin CPU scheduling",
        {
          entities: [
            createSemanticEntity("p1", "Process", "P1 (Burst 4)"),
            createSemanticEntity("p2", "Process", "P2 (Burst 2)"),
            createSemanticEntity("cpu", "CPU", "CPU Core"),
          ],
          relationships: [
            createSemanticRelationship("exec", "p1", "cpu", "running"),
          ],
          steps: [
            {
              title: "Quantum Expiry",
              explanation: "P1 quantum expires; context switched to P2",
              operations: [
                { type: "disconnect_relation", id: "exec" },
                {
                  type: "connect_relation",
                  id: "exec2",
                  source: "p2",
                  target: "cpu",
                  relationType: "running",
                },
              ],
            },
          ],
        },
      );

      expect(
        result.authoritativeModel.states[1].relationships.has("exec2"),
      ).toBe(true);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("4. Machine Learning: Gradient Descent Parameter Update", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Gradient Descent parameter update",
        {
          entities: [
            createSemanticEntity("weight", "Parameter", "Weight W", {
              value: 2.5,
            }),
            createSemanticEntity("loss", "Metric", "MSE Loss", { value: 1.8 }),
            createSemanticEntity("grad", "Derivative", "dLoss/dW", {
              value: 0.4,
            }),
          ],
          relationships: [
            createSemanticRelationship(
              "updates",
              "grad",
              "weight",
              "updates_with_lr",
            ),
          ],
          steps: [
            {
              title: "Gradient Step",
              explanation: "W_new = W - lr * grad = 2.5 - 0.1 * 0.4 = 2.46",
              operations: [
                { type: "update_entity", entityId: "weight", value: 2.46 },
              ],
            },
          ],
        },
      );

      expect(
        result.authoritativeModel.states[1].entities.get("weight")?.value,
      ).toBe(2.46);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("5. Completely Unseen Concept: Raft Leader Election", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Raft consensus leader election quorum with 3 nodes",
        {
          entities: [
            createSemanticEntity("node1", "ServerNode", "Node 1 (Candidate)", {
              state: "candidate",
            }),
            createSemanticEntity("node2", "ServerNode", "Node 2 (Follower)", {
              state: "follower",
            }),
            createSemanticEntity("node3", "ServerNode", "Node 3 (Follower)", {
              state: "follower",
            }),
          ],
          relationships: [
            createSemanticRelationship(
              "vote1",
              "node2",
              "node1",
              "vote_granted",
            ),
          ],
          steps: [
            {
              title: "Quorum Achieved",
              explanation:
                "Node 1 receives vote from Node 2; 2 of 3 votes achieves majority quorum. Node 1 becomes Leader.",
              operations: [
                {
                  type: "update_entity",
                  entityId: "node1",
                  state: "leader",
                  label: "Node 1 (Leader)",
                },
                {
                  type: "connect_relation",
                  id: "heartbeat",
                  source: "node1",
                  target: "node3",
                  relationType: "heartbeat",
                },
              ],
            },
          ],
        },
      );

      const finalLeader =
        result.authoritativeModel.states[1].entities.get("node1");
      expect(finalLeader?.state).toBe("leader");
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("6. Completely Unseen Concept: Lac Operon Gene Regulation", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Explain Lac Operon gene regulation switch in presence of lactose",
        {
          entities: [
            createSemanticEntity("repressor", "Protein", "Lac Repressor"),
            createSemanticEntity("operator", "DNA_Locus", "Operator DNA"),
            createSemanticEntity("allolactose", "Inducer", "Allolactose"),
            createSemanticEntity("rna_poly", "Enzyme", "RNA Polymerase"),
          ],
          relationships: [
            createSemanticRelationship(
              "blocks",
              "repressor",
              "operator",
              "binds_and_represses",
            ),
          ],
          steps: [
            {
              title: "Inducer Binding",
              explanation:
                "Allolactose binds to repressor causing conformational change and detachment from operator",
              operations: [
                { type: "disconnect_relation", id: "blocks" },
                {
                  type: "connect_relation",
                  id: "allosteric",
                  source: "allolactose",
                  target: "repressor",
                  relationType: "binds",
                },
                {
                  type: "connect_relation",
                  id: "transcribe",
                  source: "rna_poly",
                  target: "operator",
                  relationType: "transcribes",
                },
              ],
            },
          ],
        },
      );

      expect(
        result.authoritativeModel.states[1].relationships.has("blocks"),
      ).toBe(false);
      expect(
        result.authoritativeModel.states[1].relationships.has("transcribe"),
      ).toBe(true);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });

    it("7. Completely Unseen Concept: Schnorr Zero-Knowledge Proof Protocol", () => {
      const result = UniversalConceptIntelligenceEngine.processQuestion(
        "Demonstrate Schnorr 3-pass identification protocol: Commitment, Challenge, Response",
        {
          entities: [
            createSemanticEntity("prover", "Party", "Prover (Alice)"),
            createSemanticEntity("verifier", "Party", "Verifier (Bob)"),
            createSemanticEntity("commit", "Message", "Commitment r*G"),
            createSemanticEntity("challenge", "Message", "Challenge e"),
            createSemanticEntity("response", "Message", "Response s = r + e*x"),
          ],
          relationships: [],
          steps: [
            {
              title: "Pass 1: Commitment",
              explanation: "Prover sends commitment scalar to verifier",
              operations: [
                {
                  type: "connect_relation",
                  id: "p1",
                  source: "prover",
                  target: "verifier",
                  relationType: "sends_commit",
                },
              ],
            },
            {
              title: "Pass 2: Challenge",
              explanation: "Verifier sends random challenge e to prover",
              operations: [
                {
                  type: "connect_relation",
                  id: "p2",
                  source: "verifier",
                  target: "prover",
                  relationType: "sends_challenge",
                },
              ],
            },
            {
              title: "Pass 3: Response & Verification",
              explanation:
                "Prover computes s = r + e*x; Verifier verifies s*G == Commitment + e*PublicKey",
              operations: [
                {
                  type: "connect_relation",
                  id: "p3",
                  source: "prover",
                  target: "verifier",
                  relationType: "sends_response",
                },
              ],
            },
          ],
        },
      );

      expect(result.authoritativeModel.transformations.length).toBe(3);
      expect(result.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
    });
  });
});
