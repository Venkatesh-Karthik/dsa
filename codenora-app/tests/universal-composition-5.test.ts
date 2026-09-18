import { describe, it, expect } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  inferEntityHierarchy,
  inferRelationshipHierarchy,
  hasHigherPriority,
} from "../ai/visual-reasoning/visual-hierarchy";
import {
  sanitizeVisualText,
  compressSemanticPayload,
} from "../ai/visual-reasoning/text-sanitizer";
import { VisualInformationSelector } from "../ai/visual-reasoning/visual-information-selector";
import {
  computeOptimalRoute,
  segmentIntersectsBox,
  polylineIntersectsBox,
} from "../ai/visual-reasoning/connector-router";
import { planRelationshipLabel } from "../ai/visual-reasoning/relationship-label-planner";
import { computeOptimalCalloutPosition } from "../ai/visual-reasoning/callout-planner";
import { reconcileSceneState } from "../ai/scene-reconciler";
import {
  compileAuthoritativeTimeline,
  renderTimelineStep,
} from "../ai/transformation-timeline";

import type { AuthoritativeSemanticModel } from "../ai/authoritative-model";
import type { BoundingBox } from "../ai/connector-renderer";
function createSemanticEntity(opts: {
  id: string;
  primitiveType?: string;
  label?: string;
  [key: string]: any;
}) {
  return {
    ...opts,
    id: opts.id,
    type: opts.primitiveType || "GenericEntity",
    label: opts.label || opts.id,
    semanticRole: opts.primitiveType?.toLowerCase() || "entity",
    properties: { ...opts },
  } as any;
}

function createSemanticRelationship(opts: {
  id: string;
  source: string;
  target: string;
  label?: string;
  [key: string]: any;
}) {
  return {
    ...opts,
    id: opts.id,
    source: opts.source,
    target: opts.target,
    type: "relationship",
    label: opts.label || opts.id,
    properties: { ...opts },
  } as any;
}

function createSemanticState(opts: {
  id: string;
  name?: string;
  entities?: any;
  relationships?: any;
}) {
  const entityMap = new Map<string, any>();
  if (Array.isArray(opts.entities)) {
    for (const e of opts.entities) {
      entityMap.set(e.id, e);
    }
  } else if (opts.entities && typeof opts.entities.entries === "function") {
    for (const [k, v] of opts.entities.entries()) {
      entityMap.set(k, v);
    }
  }
  const relMap = new Map<string, any>();
  if (Array.isArray(opts.relationships)) {
    for (const r of opts.relationships) {
      relMap.set(r.id, r);
    }
  } else if (
    opts.relationships &&
    typeof opts.relationships.entries === "function"
  ) {
    for (const [k, v] of opts.relationships.entries()) {
      relMap.set(k, v);
    }
  }
  return {
    id: opts.id,
    name: opts.name || opts.id,
    entities: entityMap,
    relationships: relMap,
    timestamp: Date.now(),
  } as any;
}

function createConfidence(
  value: number,
  level: any = "KNOWN",
  reason = "Verified",
) {
  return {
    value,
    level,
    reason,
    source: "computation",
  };
}

// ============================================================================
// Geometry Helpers for Spatial Property Testing
// ============================================================================
function doBoxesOverlap(a: BoundingBox, b: BoundingBox, margin = 2): boolean {
  return !(
    a.x + a.width + margin <= b.x ||
    b.x + b.width + margin <= a.x ||
    a.y + a.height + margin <= b.y ||
    b.y + b.height + margin <= a.y
  );
}

function getElementBounds(el: ExcalidrawElement): BoundingBox {
  return {
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
  };
}

describe("Cognora Universal Visual Rendering Intelligence 5.0", () => {
  // ==========================================================================
  // 1. Universal Visual Hierarchy
  // ==========================================================================
  describe("1. Universal Visual Hierarchy", () => {
    it("correctly infers PRIMARY hierarchy for structural and focal primitives", () => {
      expect(inferEntityHierarchy({ primitiveType: "Table" })).toBe("PRIMARY");
      expect(inferEntityHierarchy({ primitiveType: "ClientEndpoint" })).toBe(
        "PRIMARY",
      );
      expect(inferEntityHierarchy({ primitiveType: "ServerEndpoint" })).toBe(
        "PRIMARY",
      );
      expect(inferEntityHierarchy({ primitiveType: "TreeNode" })).toBe(
        "PRIMARY",
      );
      expect(inferEntityHierarchy({ primitiveType: "ArrayCell" })).toBe(
        "PRIMARY",
      );
      expect(inferEntityHierarchy({ semanticRole: "focal" })).toBe("PRIMARY");
    });

    it("correctly infers SECONDARY hierarchy for payload and transition primitives", () => {
      expect(inferEntityHierarchy({ primitiveType: "MessagePacket" })).toBe(
        "SECONDARY",
      );
      expect(inferEntityHierarchy({ primitiveType: "TrajectoryRay" })).toBe(
        "SECONDARY",
      );
      expect(inferEntityHierarchy({ primitiveType: "EquationBlock" })).toBe(
        "SECONDARY",
      );
      expect(inferEntityHierarchy({ semanticRole: "message" })).toBe(
        "SECONDARY",
      );
    });

    it("correctly infers EXPLANATORY hierarchy for annotations and callouts", () => {
      expect(inferEntityHierarchy({ primitiveType: "Annotation" })).toBe(
        "EXPLANATORY",
      );
      expect(inferEntityHierarchy({ primitiveType: "Callout" })).toBe(
        "EXPLANATORY",
      );
      expect(inferEntityHierarchy({ semanticRole: "callout" })).toBe(
        "EXPLANATORY",
      );
    });

    it("enforces strict priority ordering: PRIMARY > SECONDARY > TERTIARY", () => {
      expect(hasHigherPriority("PRIMARY", "SECONDARY")).toBe(true);
      expect(hasHigherPriority("SECONDARY", "TERTIARY")).toBe(true);
      expect(hasHigherPriority("TERTIARY", "PRIMARY")).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Text Sanitization & Semantic Payload Compression
  // ==========================================================================
  describe("2. Text Sanitization & Semantic Compression", () => {
    it("sanitizes escaped HTML, control characters, and internal IDs", () => {
      const dirty =
        "&lt;div class=&quot;header&quot;&gt;Hello &amp; Welcome&lt;/div&gt;";
      const clean = sanitizeVisualText(dirty);
      expect(clean).toBe('<div class="header">Hello & Welcome</div>');

      const uuidPrefix = "entity_1928471209384: Database Row 42";
      expect(sanitizeVisualText(uuidPrefix)).toBe("Database Row 42");

      const objArtifact = "[object Object] Memory Location 0x7FFF";
      expect(sanitizeVisualText(objArtifact)).toBe("Memory Location 0x7FFF");
    });

    it("preserves legitimate mathematical notation, code, and SQL", () => {
      const math = "\\sum_{i=1}^n x_i = O(n \\log n)";
      expect(sanitizeVisualText(math)).toBe(math);

      const sql = "SELECT id, balance FROM accounts WHERE user_id = 42";
      expect(sanitizeVisualText(sql)).toBe(sql);

      const protocol = "SYN-ACK seq=300 ack=101";
      expect(sanitizeVisualText(protocol)).toBe(protocol);
    });

    it("compresses HTTP protocol response into clean title and subtitle", () => {
      const rawHttp =
        "HTTP/1.1 200 OK\nContent-Type: text/html\n<html><body>Content</body></html>";
      const compressed = compressSemanticPayload(rawHttp, 24);
      expect(compressed.title).toBe("HTTP 200 OK");
      expect(compressed.subtitle).toBe("HTML document");
      expect(compressed.fullDetail).toContain("Content-Type: text/html");
    });

    it("compresses TCP control frames into readable title", () => {
      const rawTcp = "SYN, seq=100, ack=0, win=65535";
      const compressed = compressSemanticPayload(rawTcp, 20);
      expect(compressed.title).toBe("SYN seq=100");
    });

    it("intelligently truncates long general text with ellipsis", () => {
      const longText =
        "This is an extremely long relationship description that should never stretch across canvas";
      const compressed = compressSemanticPayload(longText, 25);
      expect(compressed.title.length).toBeLessThanOrEqual(25);
      expect(compressed.title.endsWith("...")).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Visual Information Selector
  // ==========================================================================
  describe("3. Visual Information Selector", () => {
    it("selects primary entities for canvas and suppresses transient operations", () => {
      const plan = VisualInformationSelector.select({
        entities: [
          {
            id: "acc-a",
            label: "Account A ($500)",
            primitiveType: "TableRecord",
            semanticRole: "source_account",
          },
          {
            id: "acc-b",
            label: "Account B ($200)",
            primitiveType: "TableRecord",
            semanticRole: "dest_account",
          },
          {
            id: "op-debit",
            label: "Debit $100",
            semanticRole: "transient_action",
            properties: { isOperation: true },
          },
        ],
        relationships: [
          {
            id: "rel-transfer",
            source: "acc-a",
            target: "acc-b",
            label: "Transfer $100",
          },
        ],
      });

      expect(plan.entities.get("acc-a")?.shouldRenderOnCanvas).toBe(true);
      expect(plan.entities.get("acc-b")?.shouldRenderOnCanvas).toBe(true);
      expect(plan.entities.get("op-debit")?.shouldRenderOnCanvas).toBe(false);
      expect(plan.entities.get("op-debit")?.destination).toBe("suppressed");
      expect(plan.relationships.get("rel-transfer")?.shouldRenderOnCanvas).toBe(
        true,
      );
    });

    it("compresses tertiary labels when scene density is high", () => {
      const plan = VisualInformationSelector.select({
        entities: [
          { id: "n1", label: "Node 1", primitiveType: "GraphNode" },
          { id: "n2", label: "Node 2", primitiveType: "GraphNode" },
        ],
        relationships: [
          {
            id: "r1",
            source: "n1",
            target: "n2",
            label:
              "Extremely verbose relationship information that should compress",
          },
        ],
        sceneDensity: 0.8,
      });

      const relPlan = plan.relationships.get("r1");
      expect(relPlan?.renderedLabel).toBeDefined();
      expect(relPlan!.renderedLabel!.length).toBeLessThanOrEqual(24);
    });
  });

  // ==========================================================================
  // 4. Obstacle-Aware Connector Router
  // ==========================================================================
  describe("4. Obstacle-Aware Connector Router", () => {
    it("chooses direct route when no obstacles lie in between", () => {
      const src: BoundingBox = { x: 100, y: 100, width: 100, height: 60 };
      const tgt: BoundingBox = { x: 400, y: 100, width: 100, height: 60 };
      const obstacles: BoundingBox[] = [];

      const route = computeOptimalRoute(src, tgt, obstacles);
      expect(route.name).toBe("direct");
      expect(route.isElbowed).toBe(false);
      expect(route.points.length).toBe(2);
    });

    it("routes around intermediate obstacle box via flank path", () => {
      const src: BoundingBox = { x: 100, y: 100, width: 100, height: 60 };
      const tgt: BoundingBox = { x: 500, y: 100, width: 100, height: 60 };
      // Intermediate blocking obstacle
      const obstacle: BoundingBox = { x: 280, y: 80, width: 100, height: 100 };

      const route = computeOptimalRoute(src, tgt, [obstacle]);
      expect(route.name).not.toBe("direct");
      expect(route.isElbowed).toBe(true);
      expect(route.points.length).toBeGreaterThan(2);

      // Verify that polyline does not intersect the obstacle
      const worldPoints = route.points.map((p) => ({
        x: route.startX + p[0],
        y: route.startY + p[1],
      }));
      const intersects = polylineIntersectsBox(worldPoints, obstacle, 8);
      expect(intersects).toBe(false);
    });

    it("assigns distinct parallel track lanes when multiple connectors share endpoints", () => {
      const src: BoundingBox = { x: 100, y: 100, width: 120, height: 60 };
      const tgt: BoundingBox = { x: 400, y: 100, width: 120, height: 60 };

      const routeLane0 = computeOptimalRoute(src, tgt, [], {
        laneIndex: 0,
        totalLanes: 2,
      });
      const routeLane1 = computeOptimalRoute(src, tgt, [], {
        laneIndex: 1,
        totalLanes: 2,
      });

      // Start Y positions should be separated by at least 20px
      expect(
        Math.abs(routeLane0.startY - routeLane1.startY),
      ).toBeGreaterThanOrEqual(20);
    });
  });

  // ==========================================================================
  // 5. Relationship Label Planner
  // ==========================================================================
  describe("5. Relationship Label Planner", () => {
    it("places label strictly outside source and target node bounding boxes", () => {
      const src: BoundingBox = { x: 100, y: 100, width: 120, height: 60 };
      const tgt: BoundingBox = { x: 400, y: 100, width: 120, height: 60 };
      const route = computeOptimalRoute(src, tgt, []);

      const labelResult = planRelationshipLabel({
        id: "rel-1",
        rawLabel: "SYN (seq=100)",
        route,
        sourceBounds: src,
        targetBounds: tgt,
        obstacles: [],
      });

      expect(labelResult).not.toBeNull();
      const labelBox: BoundingBox = {
        x: labelResult!.x,
        y: labelResult!.y,
        width: labelResult!.width,
        height: labelResult!.height,
      };

      // Must not overlap source or target
      expect(doBoxesOverlap(labelBox, src, 4)).toBe(false);
      expect(doBoxesOverlap(labelBox, tgt, 4)).toBe(false);

      // Must produce pill backdrop and text elements
      expect(labelResult!.elements.length).toBe(2);
      expect(labelResult!.elements[0].type).toBe("rectangle"); // backdrop
      expect(labelResult!.elements[1].type).toBe("text"); // text
    });
  });

  // ==========================================================================
  // 6. Adaptive Callout Placement
  // ==========================================================================
  describe("6. Adaptive Callout Placement", () => {
    it("positions annotation around anchor without occluding anchor or obstacles", () => {
      const anchor: BoundingBox = { x: 200, y: 200, width: 120, height: 60 };
      const obstacles: BoundingBox[] = [
        { x: 200, y: 140, width: 120, height: 50 }, // obstacle directly above anchor
      ];

      const pos = computeOptimalCalloutPosition({
        anchorBounds: anchor,
        calloutWidth: 140,
        calloutHeight: 36,
        obstacles,
        preferredPlacement: "above",
      });

      const calloutBox: BoundingBox = {
        x: pos.x,
        y: pos.y,
        width: 140,
        height: 36,
      };

      // Since obstacle is above, it should adaptively pick another slot (e.g. right or below)
      expect(doBoxesOverlap(calloutBox, anchor, 4)).toBe(false);
      expect(doBoxesOverlap(calloutBox, obstacles[0], 4)).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Property-Based Spatial Verification across 14 Educational Domains
  // ==========================================================================
  describe("7. Universal Spatial Property Testing across 14 Real-World Domains", () => {
    // Helper to run universal verification on any AuthoritativeSemanticModel
    function verifySceneProperties(
      model: AuthoritativeSemanticModel,
      domainName: string,
    ) {
      if (!model.world && model.states?.[0]) {
        model.world = {
          entities: Array.from(model.states[0].entities.values()),
          relationships: Array.from(model.states[0].relationships.values()),
          states: [],
        } as any;
      }
      const timeline = compileAuthoritativeTimeline(model);
      expect(timeline.states.length).toBeGreaterThanOrEqual(1);

      for (let sIdx = 0; sIdx < timeline.states.length; sIdx++) {
        const state = timeline.states[sIdx];
        const reconcileRes = reconcileSceneState(state, [], timeline.lessonId);
        const elements = reconcileRes.elements.filter((e) => !e.isDeleted);

        // Separate elements by category
        const primaryEls: ExcalidrawElement[] = [];
        const labelEls: ExcalidrawElement[] = [];
        const arrowEls: ExcalidrawElement[] = [];
        const textStrings: string[] = [];

        for (const el of elements) {
          if (el.customData?.isEdgeLabel && el.type === "text") {
            labelEls.push(el);
          } else if ((el.type as string) === "arrow") {
            arrowEls.push(el);
          } else if (
            (el.type as string) !== "arrow" &&
            !el.customData?.isEdgeLabel &&
            !el.customData?.isDiagnostic
          ) {
            primaryEls.push(el);
          }
          if (el.type === "text" && "text" in el) {
            textStrings.push((el as any).text);
          }
        }

        // PROPERTY 1: Zero Primary-Primary Overlaps between distinct entities
        for (let i = 0; i < primaryEls.length; i++) {
          for (let j = i + 1; j < primaryEls.length; j++) {
            const elA = primaryEls[i];
            const elB = primaryEls[j];

            // Sub-elements belonging to the same entity (e.g. bound text, header, or same group)
            if (
              (elA as any).containerId === elB.id ||
              (elB as any).containerId === elA.id
            ) {
              continue;
            }
            if (elA.id.startsWith(elB.id) || elB.id.startsWith(elA.id)) {
              continue;
            }
            if (
              elA.groupIds?.length &&
              elB.groupIds?.length &&
              elA.groupIds.some((g) => elB.groupIds.includes(g))
            ) {
              continue;
            }

            const bA = getElementBounds(elA);
            const bB = getElementBounds(elB);
            const overlap = doBoxesOverlap(bA, bB, 2);
            expect(
              overlap,
              `[${domainName} State ${sIdx}] Primary entities overlap: ${elA.id} and ${elB.id}`,
            ).toBe(false);
          }
        }

        // PROPERTY 2: Zero Primary-EdgeLabel Overlaps
        for (const label of labelEls) {
          const lBox = getElementBounds(label);
          for (const prim of primaryEls) {
            const pBox = getElementBounds(prim);
            const overlap = doBoxesOverlap(lBox, pBox, 2);
            expect(
              overlap,
              `[${domainName} State ${sIdx}] Edge label '${
                (label as any).text
              }' overlaps node '${prim.id}'`,
            ).toBe(false);
          }
        }

        // PROPERTY 3: Zero Raw Serialization or Unescaped HTML in Canvas Text
        for (const str of textStrings) {
          expect(str).not.toContain("[object Object]");
          expect(str).not.toMatch(/^entity_[0-9a-f]{8,}:/);
        }

        // PROPERTY 4: Zero Duplicate Element IDs
        const ids = new Set<string>();
        for (const el of elements) {
          expect(
            ids.has(el.id),
            `[${domainName}] Duplicate element ID: ${el.id}`,
          ).toBe(false);
          ids.add(el.id);
        }
      }
    }

    // --- Domain 1: TCP 3-Way Handshake ---
    it("passes spatial properties for TCP 3-Way Handshake", () => {
      const s0 = createSemanticState({
        id: "s0",
        name: "Initial Standby",
        entities: [
          createSemanticEntity({
            id: "client",
            primitiveType: "Client",
            label: "Client",
          }),
          createSemanticEntity({
            id: "server",
            primitiveType: "Server",
            label: "Server",
          }),
        ],
      });
      const s1 = createSemanticState({
        id: "s1",
        name: "SYN Sent",
        entities: s0.entities,
        relationships: [
          createSemanticRelationship({
            id: "msg-syn",
            source: "client",
            target: "server",
            label: "SYN (seq=100)",
          }),
        ],
      });
      const s2 = createSemanticState({
        id: "s2",
        name: "SYN-ACK Replied",
        entities: s0.entities,
        relationships: [
          createSemanticRelationship({
            id: "msg-syn-ack",
            source: "server",
            target: "client",
            label: "SYN-ACK (seq=300, ack=101)",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "tcp-handshake",
        problem: {
          id: "p1",
          question: "TCP 3-Way Handshake",
          objective: "Establish TCP Connection",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0, s1, s2],
        transformations: [
          {
            id: "t1",
            title: "Client sends SYN",
            fromStateIndex: 0,
            toStateIndex: 1,
            explanation: "Client initiates handshake.",
          },
          {
            id: "t2",
            title: "Server replies SYN-ACK",
            fromStateIndex: 1,
            toStateIndex: 2,
            explanation: "Server acknowledges SYN.",
          },
        ],
        invariants: [],
        confidence: createConfidence(0.98),
      } as any;

      verifySceneProperties(model, "TCP Handshake");
    });

    // --- Domain 2: DNS Resolution ---
    it("passes spatial properties for DNS Resolution", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "browser",
            primitiveType: "Client",
            label: "Browser",
          }),
          createSemanticEntity({
            id: "resolver",
            primitiveType: "Server",
            label: "DNS Resolver",
          }),
          createSemanticEntity({
            id: "root",
            primitiveType: "Server",
            label: "Root DNS",
          }),
          createSemanticEntity({
            id: "tld",
            primitiveType: "Server",
            label: "TLD DNS (.com)",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "r1",
            source: "browser",
            target: "resolver",
            label: "Query example.com",
          }),
          createSemanticRelationship({
            id: "r2",
            source: "resolver",
            target: "root",
            label: "Referral to .com",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "dns-resolution",
        problem: {
          id: "p2",
          question: "DNS Resolution Flow",
          objective: "Resolve IP address",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.95),
      } as any;

      verifySceneProperties(model, "DNS Resolution");
    });

    // --- Domain 3: Database Transaction (ACID) with Rollback ---
    it("passes spatial properties for Database Transaction with Rollback", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "acc-1",
            primitiveType: "Record",
            label: "Alice: $500",
            value: 500,
          }),
          createSemanticEntity({
            id: "acc-2",
            primitiveType: "Record",
            label: "Bob: $200",
            value: 200,
          }),
        ],
      });
      const s1 = createSemanticState({
        id: "s1",
        entities: [
          createSemanticEntity({
            id: "acc-1",
            primitiveType: "Record",
            label: "Alice: $500",
            value: 500,
            state: "rolled_back",
          }),
          createSemanticEntity({
            id: "acc-2",
            primitiveType: "Record",
            label: "Bob: $200",
            value: 200,
            state: "rolled_back",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "rb-flow",
            source: "acc-1",
            target: "acc-2",
            label: "Aborted Rollback",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "db-tx",
        problem: {
          id: "p3",
          question: "Database Balance Transfer",
          objective: "ACID consistency",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0, s1],
        transformations: [
          {
            id: "t1",
            title: "Rollback on Error",
            fromStateIndex: 0,
            toStateIndex: 1,
            explanation: "Revert changes.",
          },
        ],
        invariants: [],
        confidence: createConfidence(0.96),
      } as any;

      verifySceneProperties(model, "Database Transaction");
    });

    // --- Domain 4: AVL Tree Rotation ---
    it("passes spatial properties for AVL Tree Rotation", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "node-30",
            primitiveType: "TreeNode",
            label: "30",
            value: 30,
          }),
          createSemanticEntity({
            id: "node-20",
            primitiveType: "TreeNode",
            label: "20",
            value: 20,
          }),
          createSemanticEntity({
            id: "node-10",
            primitiveType: "TreeNode",
            label: "10",
            value: 10,
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "e1",
            source: "node-30",
            target: "node-20",
            type: "leftOf",
          }),
          createSemanticRelationship({
            id: "e2",
            source: "node-20",
            target: "node-10",
            type: "leftOf",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "avl-rotation",
        problem: {
          id: "p4",
          question: "AVL Tree Right Rotation",
          objective: "Balance BST",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.97),
      } as any;

      verifySceneProperties(model, "AVL Rotation");
    });

    // --- Domain 5: Binary Search ---
    it("passes spatial properties for Binary Search", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "c0",
            primitiveType: "ArrayCell",
            label: "[0]=2",
            value: 2,
          }),
          createSemanticEntity({
            id: "c1",
            primitiveType: "ArrayCell",
            label: "[1]=5",
            value: 5,
          }),
          createSemanticEntity({
            id: "c2",
            primitiveType: "ArrayCell",
            label: "[2]=8",
            value: 8,
          }),
          createSemanticEntity({
            id: "c3",
            primitiveType: "ArrayCell",
            label: "[3]=12",
            value: 12,
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "mid-pointer",
            source: "c0",
            target: "c2",
            label: "mid = 2",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "binary-search",
        problem: {
          id: "p5",
          question: "Binary Search",
          objective: "Find element in array",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.99),
      } as any;

      verifySceneProperties(model, "Binary Search");
    });

    // --- Domain 6: Recursion / Call Stack ---
    it("passes spatial properties for Recursion Stack Frames", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "frame-3",
            primitiveType: "StackFrame",
            label: "factorial(3)",
          }),
          createSemanticEntity({
            id: "frame-2",
            primitiveType: "StackFrame",
            label: "factorial(2)",
          }),
          createSemanticEntity({
            id: "frame-1",
            primitiveType: "StackFrame",
            label: "factorial(1)",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "call-1",
            source: "frame-3",
            target: "frame-2",
            label: "calls",
          }),
          createSemanticRelationship({
            id: "call-2",
            source: "frame-2",
            target: "frame-1",
            label: "calls",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "recursion-stack",
        problem: {
          id: "p6",
          question: "Factorial Call Stack",
          objective: "Demonstrate recursion",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.98),
      } as any;

      verifySceneProperties(model, "Recursion Call Stack");
    });

    // --- Domain 7: HTTP Lifecycle with Payload Compression ---
    it("passes spatial properties for HTTP Lifecycle with large headers", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "client-app",
            primitiveType: "Client",
            label: "Web Client",
          }),
          createSemanticEntity({
            id: "web-server",
            primitiveType: "Server",
            label: "API Gateway",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "http-res",
            source: "web-server",
            target: "client-app",
            label:
              "HTTP/1.1 200 OK Content-Type: application/json Cache-Control: max-age=3600",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "http-lifecycle",
        problem: {
          id: "p7",
          question: "HTTP Request Response",
          objective: "Explain HTTP protocol",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.97),
      } as any;

      verifySceneProperties(model, "HTTP Lifecycle");
    });

    // --- Domain 8: CPU Instruction Cycle ---
    it("passes spatial properties for CPU Instruction Cycle", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "pc-reg",
            primitiveType: "MemoryBlock",
            label: "PC: 0x0040",
          }),
          createSemanticEntity({
            id: "ir-reg",
            primitiveType: "MemoryBlock",
            label: "IR: ADD R1, R2",
          }),
          createSemanticEntity({
            id: "alu-unit",
            primitiveType: "ProcessNode",
            label: "ALU Unit",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "fetch",
            source: "pc-reg",
            target: "ir-reg",
            label: "Fetch",
          }),
          createSemanticRelationship({
            id: "exec",
            source: "ir-reg",
            target: "alu-unit",
            label: "Decode & Exec",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "cpu-cycle",
        problem: {
          id: "p8",
          question: "CPU Instruction Cycle",
          objective: "Explain fetch decode execute",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.96),
      } as any;

      verifySceneProperties(model, "CPU Cycle");
    });

    // --- Domain 9: Photosynthesis ---
    it("passes spatial properties for Photosynthesis biochemical flow", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "light-rxn",
            primitiveType: "ProcessNode",
            label: "Thylakoid Light Rxn",
          }),
          createSemanticEntity({
            id: "calvin-cycle",
            primitiveType: "ProcessNode",
            label: "Calvin Cycle (Stroma)",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "atp-flow",
            source: "light-rxn",
            target: "calvin-cycle",
            label: "ATP & NADPH",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "photosynthesis",
        problem: {
          id: "p9",
          question: "Photosynthesis",
          objective: "Energy conversion",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.95),
      } as any;

      verifySceneProperties(model, "Photosynthesis");
    });

    // --- Domain 10: Projectile Motion ---
    it("passes spatial properties for Projectile Motion physics", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "launcher",
            primitiveType: "StateNode",
            label: "Launch Point (x0, y0)",
          }),
          createSemanticEntity({
            id: "apex",
            primitiveType: "StateNode",
            label: "Apex (vy=0)",
          }),
          createSemanticEntity({
            id: "formula",
            primitiveType: "EquationBlock",
            label: "y = v0*t - 0.5*g*t^2",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "trajectory",
            source: "launcher",
            target: "apex",
            label: "Ascent",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "projectile-motion",
        problem: {
          id: "p10",
          question: "Projectile Motion",
          objective: "Kinematics",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.96),
      } as any;

      verifySceneProperties(model, "Projectile Motion");
    });

    // --- Domain 11: SQL JOIN ---
    it("passes spatial properties for SQL JOIN relational schema", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "table-users",
            primitiveType: "Table",
            label: "Users Table",
          }),
          createSemanticEntity({
            id: "table-orders",
            primitiveType: "Table",
            label: "Orders Table",
          }),
          createSemanticEntity({
            id: "table-joined",
            primitiveType: "Table",
            label: "Joined Results",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "fk-join",
            source: "table-users",
            target: "table-orders",
            label: "users.id = orders.user_id",
          }),
          createSemanticRelationship({
            id: "emit-res",
            source: "table-orders",
            target: "table-joined",
            label: "Emit Row",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "sql-join",
        problem: {
          id: "p11",
          question: "SQL INNER JOIN",
          objective: "Relational algebra",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.96),
      } as any;

      verifySceneProperties(model, "SQL JOIN");
    });

    // --- Domain 12: Novel Unseen Invented Concept ---
    it("passes spatial properties for completely unknown invented concept", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "qubit-flock-alpha",
            primitiveType: "CircleNode",
            label: "QuFlock Alpha",
          }),
          createSemanticEntity({
            id: "resonance-chamber",
            primitiveType: "Container",
            label: "Resonance Chamber",
          }),
          createSemanticEntity({
            id: "flux-lattice",
            primitiveType: "StateNode",
            label: "Lattice 7B",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "entangle",
            source: "qubit-flock-alpha",
            target: "flux-lattice",
            label: "Phase Shift 0.3 rad",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "novel-concept",
        problem: {
          id: "p12",
          question: "QuFlock Resonance",
          objective: "Invented concept",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.95),
      } as any;

      verifySceneProperties(model, "Novel Concept");
    });

    // --- Domain 13: Multi-Actor Communication (4 actors) ---
    it("passes spatial properties for Multi-Actor Distributed Consensus", () => {
      const s0 = createSemanticState({
        id: "s0",
        entities: [
          createSemanticEntity({
            id: "node-leader",
            primitiveType: "Server",
            label: "Leader Node",
          }),
          createSemanticEntity({
            id: "node-f1",
            primitiveType: "Server",
            label: "Follower 1",
          }),
          createSemanticEntity({
            id: "node-f2",
            primitiveType: "Server",
            label: "Follower 2",
          }),
          createSemanticEntity({
            id: "node-f3",
            primitiveType: "Server",
            label: "Follower 3",
          }),
        ],
        relationships: [
          createSemanticRelationship({
            id: "append-1",
            source: "node-leader",
            target: "node-f1",
            label: "AppendEntries",
          }),
          createSemanticRelationship({
            id: "append-2",
            source: "node-leader",
            target: "node-f2",
            label: "AppendEntries",
          }),
        ],
      });

      const model: AuthoritativeSemanticModel = {
        id: "raft-consensus",
        problem: {
          id: "p13",
          question: "Raft AppendEntries",
          objective: "Distributed consensus",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.97),
      } as any;

      verifySceneProperties(model, "Multi-Actor Communication");
    });

    // --- Domain 14: Dense High-Cognitive-Load Scene ---
    it("passes spatial properties for High-Density Scene with many elements and edges", () => {
      const entities = [];
      for (let i = 1; i <= 6; i++) {
        entities.push(
          createSemanticEntity({
            id: `item-${i}`,
            primitiveType: "GraphNode",
            label: `Node ${i}`,
          }),
        );
      }
      const relationships = [
        createSemanticRelationship({
          id: "e12",
          source: "item-1",
          target: "item-2",
          label: "e12",
        }),
        createSemanticRelationship({
          id: "e23",
          source: "item-2",
          target: "item-3",
          label: "e23",
        }),
        createSemanticRelationship({
          id: "e34",
          source: "item-3",
          target: "item-4",
          label: "e34",
        }),
        createSemanticRelationship({
          id: "e45",
          source: "item-4",
          target: "item-5",
          label: "e45",
        }),
        createSemanticRelationship({
          id: "e56",
          source: "item-5",
          target: "item-6",
          label: "e56",
        }),
      ];

      const s0 = createSemanticState({ id: "s0", entities, relationships });
      const model: AuthoritativeSemanticModel = {
        id: "dense-graph",
        problem: {
          id: "p14",
          question: "Dense Graph Topology",
          objective: "Graph layout",
          intent: "concept_explainer",
          inputs: [],
          outputs: [],
          entities: [],
          relationships: [],
          constraints: [],
          assumptions: [],
          ambiguity: [],
          conventions: [],
        },
        states: [s0],
        transformations: [],
        invariants: [],
        confidence: createConfidence(0.95),
      } as any;

      verifySceneProperties(model, "Dense Scene");
    });
  });
});
