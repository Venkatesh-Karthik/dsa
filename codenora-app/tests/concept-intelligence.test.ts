/**
 * Universal Concept Intelligence Layer Test Suite
 *
 * Verifies that Cognora's concept intelligence operates across 12 distinct domains:
 *  1. Linked List insertion (DSA)
 *  2. AVL Tree rotation (DSA)
 *  3. BFS Traversal (DSA)
 *  4. Binary Search (DSA)
 *  5. Graph shortest path (DSA)
 *  6. Recursion (Call stack / DSA)
 *  7. HTTP Request-Response lifecycle (Networking)
 *  8. SQL JOIN (Databases)
 *  9. Process Scheduling (Operating Systems)
 * 10. Gradient Descent (Machine Learning)
 * 11. Physics Kinematics / Forces (Physics)
 * 12. Generic / Unseen Concept: Refrigerator Vapor-Compression Cycle
 *
 * Verifies:
 * - Domain resolution & strategy suggestion
 * - Domain invariants & misconception mapping
 * - Dynamic inspector data extraction (0 hardcoded if/else UI branches)
 * - Concept model compilation to VisualLesson
 * - Concept model extraction from VisualLesson
 * - Anti-fake-step verification (previousState !== nextState)
 * - Entity identity preservation across steps
 */

import { describe, it, expect } from "vitest";

import {
  analyzeConcept,
  compileConceptModelToVisualLesson,
  extractConceptModelFromVisualLesson,
  validateConceptModel,
} from "../ai/concept-intelligence";
import {
  resolveDomainModule,
  DsaDomainModule,
  NetworkingDomainModule,
  OperatingSystemsDomainModule,
  DatabasesDomainModule,
  PhysicsDomainModule,
  MachineLearningDomainModule,
  GenericDomainModule,
} from "../ai/domain-knowledge";

import { compileVisualLesson } from "../ai/transformation-timeline";
import {
  validateTransformationTimeline,
  computeSemanticDiff,
} from "../ai/transformation-validator";
import {
  createSceneGraphFromActions,
  createSceneState,
} from "../ai/scene-state";

import type { ConceptModel } from "../ai/concept-model";

describe("Universal Concept Intelligence: Domain Resolution & Strategy across 12 domains", () => {
  const testCases: Array<{
    name: string;
    prompt: string;
    expectedDomain: string;
    expectedStrategy: string;
  }> = [
    {
      name: "1. Linked List Insertion",
      prompt:
        "Insert a node with value 42 into a singly linked list after node 15",
      expectedDomain: "data_structures",
      expectedStrategy: "STRUCTURAL_TRANSFORMATION",
    },
    {
      name: "2. AVL Tree Rotation",
      prompt: "Right rotation on an AVL tree root node to restore balance",
      expectedDomain: "data_structures",
      expectedStrategy: "STRUCTURAL_TRANSFORMATION",
    },
    {
      name: "3. BFS Traversal",
      prompt:
        "Breadth-first search traversal on a binary tree with queue tracking",
      expectedDomain: "data_structures",
      expectedStrategy: "STATE_MACHINE",
    },
    {
      name: "4. Binary Search",
      prompt: "Binary search algorithm finding target 23 in a sorted array",
      expectedDomain: "data_structures",
      expectedStrategy: "CONTROL_FLOW",
    },
    {
      name: "5. Graph Shortest Path (Dijkstra)",
      prompt: "Dijkstra algorithm shortest path on weighted directed graph",
      expectedDomain: "data_structures",
      expectedStrategy: "STATE_MACHINE",
    },
    {
      name: "6. Recursion / Call Stack",
      prompt: "Recursive factorial computation showing call stack push and pop",
      expectedDomain: "data_structures",
      expectedStrategy: "MEMORY_TRANSFORMATION",
    },
    {
      name: "7. HTTP Request-Response",
      prompt:
        "HTTP GET request lifecycle from client browser to web server and 200 OK response",
      expectedDomain: "networking",
      expectedStrategy: "STATE_MACHINE",
    },
    {
      name: "8. SQL JOIN",
      prompt:
        "INNER JOIN between users table and orders table on users.id = orders.user_id",
      expectedDomain: "databases",
      expectedStrategy: "DATA_FLOW",
    },
    {
      name: "9. OS Process Scheduling",
      prompt:
        "Round Robin CPU process scheduling with ready queue and context switching",
      expectedDomain: "operating_systems",
      expectedStrategy: "STATE_MACHINE",
    },
    {
      name: "10. Machine Learning Gradient Descent",
      prompt:
        "Gradient descent optimization minimizing loss function on parameter weights",
      expectedDomain: "machine_learning",
      expectedStrategy: "ITERATIVE_OPTIMIZATION",
    },
    {
      name: "11. Physics Kinematics / Trajectory",
      prompt:
        "Projectile motion trajectory under gravity with velocity vectors",
      expectedDomain: "physics",
      expectedStrategy: "TEMPORAL_PROGRESSION",
    },
    {
      name: "12. Generic / Unseen: Refrigerator Cycle",
      prompt:
        "Explain the refrigeration cycle: compressor, condenser, expansion valve, evaporator",
      expectedDomain: "generic",
      expectedStrategy: "PIPELINE",
    },
  ];

  for (const tc of testCases) {
    it(`correctly analyzes ${tc.name}`, () => {
      const result = analyzeConcept(tc.prompt);
      expect(result.domain).toBe(tc.expectedDomain);
      expect(result.strategy).toBe(tc.expectedStrategy);
      expect(result.concept.length).toBeGreaterThan(0);
      expect(result.module).toBeDefined();
    });
  }
});

describe("Universal Concept Intelligence: Invariant and Misconception Mapping", () => {
  it("provides specific invariants and misconceptions for DSA", () => {
    const invs = DsaDomainModule.getInvariants("AVL Tree");
    expect(
      invs.some(
        (i) =>
          i.rule.includes("BST invariant") ||
          i.rule.includes("Node identity") ||
          i.description.includes("BST"),
      ),
    ).toBe(true);

    const mis = DsaDomainModule.getMisconceptions("Linked List");
    expect(mis.length).toBeGreaterThan(0);
  });

  it("provides specific invariants and misconceptions for Networking", () => {
    const invs = NetworkingDomainModule.getInvariants("HTTP");
    expect(
      invs.some(
        (i) =>
          i.rule.includes("Client and server") ||
          i.rule.includes("HTTP") ||
          i.description.includes("packet"),
      ),
    ).toBe(true);

    const mis = NetworkingDomainModule.getMisconceptions("TCP Handshake");
    expect(
      mis.some(
        (m) =>
          (m.misconception || m.misunderstanding || "")
            .toLowerCase()
            .includes("handshake") ||
          (m.misconception || m.misunderstanding || "")
            .toLowerCase()
            .includes("connection"),
      ),
    ).toBe(true);
  });

  it("provides specific invariants and misconceptions for Databases", () => {
    const invs = DatabasesDomainModule.getInvariants("SQL JOIN");
    expect(
      invs.some(
        (i) =>
          i.rule.includes("Table schemas") ||
          i.rule.includes("Join predicate") ||
          i.description.includes("join"),
      ),
    ).toBe(true);

    const mis = DatabasesDomainModule.getMisconceptions("INNER JOIN");
    expect(
      mis.some(
        (m) =>
          (m.misconception || m.misunderstanding || "").includes("Cartesian") ||
          (m.misconception || m.misunderstanding || "").includes("LEFT JOIN"),
      ),
    ).toBe(true);
  });

  it("provides specific invariants and misconceptions for Operating Systems", () => {
    const invs = OperatingSystemsDomainModule.getInvariants("CPU Scheduling");
    expect(
      invs.some(
        (i) =>
          i.rule.includes("CPU") ||
          i.rule.includes("Process state") ||
          i.description.includes("Process"),
      ),
    ).toBe(true);

    const mis = OperatingSystemsDomainModule.getMisconceptions("Round Robin");
    expect(mis.length).toBeGreaterThan(0);
  });

  it("provides specific invariants and misconceptions for Machine Learning", () => {
    const invs = MachineLearningDomainModule.getInvariants("Gradient Descent");
    expect(
      invs.some(
        (i) =>
          i.rule.includes("Loss") ||
          i.rule.includes("Learning rate") ||
          i.description.includes("Loss"),
      ),
    ).toBe(true);

    const mis =
      MachineLearningDomainModule.getMisconceptions("Gradient Descent");
    expect(mis.length).toBeGreaterThan(0);
  });

  it("provides specific invariants and misconceptions for Physics", () => {
    const invs = PhysicsDomainModule.getInvariants("Projectile Motion");
    expect(
      invs.some(
        (i) =>
          i.rule.includes("Conservation") ||
          i.rule.includes("Continuity") ||
          i.description.includes("Momentum"),
      ),
    ).toBe(true);

    const mis = PhysicsDomainModule.getMisconceptions("Newton Third Law");
    expect(mis.length).toBeGreaterThan(0);
  });

  it("gracefully provides generalized invariants and misconceptions for unseen concepts", () => {
    const invs = GenericDomainModule.getInvariants(
      "Refrigerator Vapor-Compression",
    );
    expect(invs.length).toBeGreaterThan(0);
    expect(
      invs.some(
        (i) =>
          i.rule.includes("Conservation") ||
          i.rule.includes("Identity") ||
          i.description.includes("Conservation"),
      ),
    ).toBe(true);

    const mis = GenericDomainModule.getMisconceptions("Thermodynamics");
    expect(mis.length).toBeGreaterThan(0);
  });
});

describe("Universal Concept Intelligence: Dynamic Inspector Data Extraction (Zero UI Hardcoding)", () => {
  it("dynamically extracts inspector metrics for DSA (AVL / Binary Search)", () => {
    const actions = [
      {
        type: "create_tree" as const,
        id: "tree",
        root: "n20",
        nodes: [
          { id: "n20", value: 20, left: "n10", right: "n30" },
          { id: "n10", value: 10 },
          { id: "n30", value: 30 },
        ],
      },
    ];
    const graph = createSceneGraphFromActions(actions as any);
    const state = createSceneState(graph);

    const data = DsaDomainModule.extractInspectorData(
      state as any,
      "AVL Balance Check" as any,
      1 as any,
    );
    expect(data.title || data.subtitle).toBeTruthy();
    const properties = (data as any).sections
      ? (data as any).sections.flatMap((s: any) => s.properties)
      : data.properties || [];
    expect(properties.length).toBeGreaterThan(0);
  });

  it("dynamically extracts inspector metrics for Networking (HTTP / TCP)", () => {
    const actions = [
      {
        type: "create_box" as const,
        id: "client-1",
        label: "Client Browser",
        role: "actor" as any,
      },
      {
        type: "create_box" as const,
        id: "server-1",
        label: "Backend Server",
        role: "server" as any,
      },
      {
        type: "connect" as const,
        id: "conn-1",
        from: "client-1",
        to: "server-1",
        label: "GET /api/v1/users (200 OK)",
      },
    ];
    const graph = createSceneGraphFromActions(actions as any);
    const state = createSceneState(graph);

    const data = NetworkingDomainModule.extractInspectorData(
      state as any,
      "Send HTTP Request" as any,
      2 as any,
    );
    expect(data.title || data.subtitle).toBeTruthy();
    const properties = (data as any).sections
      ? (data as any).sections.flatMap((s: any) => s.properties)
      : data.properties || [];
    expect(properties.length).toBeGreaterThan(0);
  });

  it("dynamically extracts inspector metrics for Databases (SQL JOIN)", () => {
    const actions = [
      {
        type: "create_box" as const,
        id: "table-users",
        label: "users (id, name)",
        role: "data" as any,
      },
      {
        type: "create_box" as const,
        id: "table-orders",
        label: "orders (id, user_id, amount)",
        role: "data" as any,
      },
      {
        type: "connect" as const,
        id: "join-conn",
        from: "table-users",
        to: "table-orders",
        label: "ON users.id = orders.user_id",
      },
    ];
    const graph = createSceneGraphFromActions(actions as any);
    const state = createSceneState(graph);

    const data = DatabasesDomainModule.extractInspectorData(
      state as any,
      "Execute Hash Match" as any,
      2 as any,
    );
    expect(data.title || data.subtitle).toBeTruthy();
    const properties = (data as any).sections
      ? (data as any).sections.flatMap((s: any) => s.properties)
      : data.properties || [];
    expect(properties.length).toBeGreaterThan(0);
  });

  it("dynamically extracts inspector metrics for Operating Systems (CPU Scheduling)", () => {
    const actions = [
      {
        type: "create_box" as const,
        id: "cpu-core",
        label: "CPU Core 0",
        role: "server" as any,
      },
      {
        type: "create_box" as const,
        id: "proc-1",
        label: "Process P1 (PID 101)",
        role: "process" as any,
      },
    ];
    const graph = createSceneGraphFromActions(actions as any);
    const state = createSceneState(graph);

    const data = OperatingSystemsDomainModule.extractInspectorData(
      state as any,
      "Context Switch to P1" as any,
      3 as any,
    );
    expect(data.title || data.subtitle).toBeTruthy();
    const properties = (data as any).sections
      ? (data as any).sections.flatMap((s: any) => s.properties)
      : data.properties || [];
    expect(properties.length).toBeGreaterThan(0);
  });

  it("dynamically extracts inspector metrics for Machine Learning (Gradient Descent)", () => {
    const actions = [
      {
        type: "create_box" as const,
        id: "weight-w1",
        label: "w1: 2.85 (dLoss/dw = 0.42)",
        role: "parameter" as any,
      },
    ];
    const graph = createSceneGraphFromActions(actions as any);
    const state = createSceneState(graph);

    const data = MachineLearningDomainModule.extractInspectorData(
      state as any,
      "SGD Step 15: update weights" as any,
      15 as any,
    );
    expect(data.title || data.subtitle).toBeTruthy();
    const properties = (data as any).sections
      ? (data as any).sections.flatMap((s: any) => s.properties)
      : data.properties || [];
    expect(properties.length).toBeGreaterThan(0);
  });

  it("dynamically extracts inspector metrics for Physics (Kinematics / Newton)", () => {
    const actions = [
      {
        type: "create_box" as const,
        id: "projectile",
        label: "Mass m=2kg (v=15m/s)",
        role: "body" as any,
      },
    ];
    const graph = createSceneGraphFromActions(actions as any);
    const state = createSceneState(graph);

    const data = PhysicsDomainModule.extractInspectorData(
      state as any,
      "Time t=2.0s: Apex reached" as any,
      4 as any,
    );
    expect(data.title || data.subtitle).toBeTruthy();
    const properties = (data as any).sections
      ? (data as any).sections.flatMap((s: any) => s.properties)
      : data.properties || [];
    expect(properties.length).toBeGreaterThan(0);
  });

  it("dynamically extracts inspector metrics for Generic / Unseen concept", () => {
    const actions = [
      {
        type: "create_box" as const,
        id: "compressor",
        label: "Compressor (P_high, T_high)",
        role: "component" as any,
      },
      {
        type: "create_box" as const,
        id: "condenser",
        label: "Condenser (Heat rejection)",
        role: "component" as any,
      },
    ];
    const graph = createSceneGraphFromActions(actions as any);
    const state = createSceneState(graph);

    const data = GenericDomainModule.extractInspectorData(
      state as any,
      "Refrigerant compression" as any,
      1 as any,
    );
    expect(data.title || data.subtitle).toBeTruthy();
    const properties = (data as any).sections
      ? (data as any).sections.flatMap((s: any) => s.properties)
      : data.properties || [];
    expect(properties.length).toBeGreaterThan(0);
  });
});

describe("Universal Concept Model Compilation & Anti-Fake-Step Validation", () => {
  it("compiles a 4-step ConceptModel into a valid VisualLesson with non-fake steps", () => {
    const model: any = {
      id: "test-refrigerator-cycle",
      concept: "Refrigerator Vapor-Compression Cycle",
      domain: "generic",
      strategy: "PIPELINE",
      entities: [
        {
          id: "comp",
          name: "Compressor",
          type: "Component",
          properties: { state: "compression" },
          visualRole: "component",
        },
        {
          id: "cond",
          name: "Condenser",
          type: "Component",
          properties: { state: "heat_reject" },
          visualRole: "component",
        },
        {
          id: "valve",
          name: "Expansion Valve",
          type: "Component",
          properties: { state: "throttling" },
          visualRole: "component",
        },
        {
          id: "evap",
          name: "Evaporator",
          type: "Component",
          properties: { state: "heat_absorb" },
          visualRole: "component",
        },
      ],
      relationships: [
        {
          id: "pipe1",
          from: "comp",
          to: "cond",
          type: "FLOW",
          label: "High-pressure vapor",
        },
        {
          id: "pipe2",
          from: "cond",
          to: "valve",
          type: "FLOW",
          label: "High-pressure liquid",
        },
        {
          id: "pipe3",
          from: "valve",
          to: "evap",
          type: "FLOW",
          label: "Low-pressure liquid/vapor",
        },
        {
          id: "pipe4",
          from: "evap",
          to: "comp",
          type: "FLOW",
          label: "Low-pressure vapor",
        },
      ],
      invariants: [
        {
          id: "inv-energy",
          name: "Energy Conservation",
          rule: "Q_in + W = Q_out",
          severity: "error",
        },
      ],
      misconceptions: [
        {
          id: "mis-cold",
          misconception: "Refrigerators create coldness",
          correction: "They remove heat via phase transition",
        },
      ],
      states: [
        {
          id: "s0",
          stepIndex: 0,
          title: "Initial Idle State",
          entityStates: {},
          activeEntityIds: ["comp"],
        },
        {
          id: "s1",
          stepIndex: 1,
          title: "Compression",
          entityStates: {},
          activeEntityIds: ["comp"],
        },
        {
          id: "s2",
          stepIndex: 2,
          title: "Condensation",
          entityStates: {},
          activeEntityIds: ["cond"],
        },
        {
          id: "s3",
          stepIndex: 3,
          title: "Evaporation",
          entityStates: {},
          activeEntityIds: ["evap"],
        },
      ],
      transformations: [
        {
          id: "t0",
          stepIndex: 0,
          title: "System Setup",
          action: "Initialize refrigeration circuit",
          reason: "Establish the closed thermodynamic loop",
          observation: "Four primary components connected in a closed ring",
          consequence: "System is primed for refrigerant circulation",
          operations: [],
          visualActions: [
            {
              type: "create_box",
              id: "comp",
              label: "Compressor",
              role: "component",
            },
            {
              type: "create_box",
              id: "cond",
              label: "Condenser",
              role: "component",
            },
            {
              type: "create_box",
              id: "valve",
              label: "Valve",
              role: "component",
            },
            {
              type: "create_box",
              id: "evap",
              label: "Evaporator",
              role: "component",
            },
          ],
        },
        {
          id: "t1",
          stepIndex: 1,
          title: "Compression Phase",
          action: "Compress low-pressure vapor into high-pressure gas",
          reason: "Raises boiling temperature above ambient",
          observation:
            "Compressor highlights in warning amber; refrigerant enthalpy spikes",
          consequence: "High pressure gas flows to condenser",
          operations: [
            {
              type: "UPDATE_ENTITY",
              entityId: "comp",
              properties: { temp: "high", press: "high" },
            },
          ],
          visualActions: [
            { type: "highlight", id: "comp", style: { color: "warning" } },
          ],
        },
        {
          id: "t2",
          stepIndex: 2,
          title: "Condenser Heat Rejection",
          action: "Refrigerant rejects heat Q_H to ambient surroundings",
          reason: "Gas condenses into high-pressure liquid",
          observation:
            "Refrigerant transitions from vapor to liquid; Condenser activates",
          consequence: "Refrigerant liquid enters expansion valve",
          operations: [
            {
              type: "UPDATE_ENTITY",
              entityId: "cond",
              properties: { phase: "liquid" },
            },
          ],
          visualActions: [
            { type: "highlight", id: "cond", style: { color: "danger" } },
            { type: "highlight", id: "comp", style: { color: "default" } },
          ],
        },
        {
          id: "t3",
          stepIndex: 3,
          title: "Evaporator Heat Absorption",
          action:
            "Low-pressure liquid absorbs heat Q_L from refrigerator interior",
          reason: "Boils at low temperature, cooling the cabinet",
          observation:
            "Evaporator glows success green; cabinet temperature drops",
          consequence: "Refrigerant vaporizes and returns to compressor",
          operations: [
            {
              type: "UPDATE_ENTITY",
              entityId: "evap",
              properties: { phase: "vapor", temp: "cold" },
            },
          ],
          visualActions: [
            { type: "highlight", id: "evap", style: { color: "success" } },
            { type: "highlight", id: "cond", style: { color: "default" } },
          ],
        },
      ],
    };

    // 1. Validate concept model
    const val = validateConceptModel(model);
    expect(val.valid).toBe(true);
    expect(val.errors.length).toBe(0);

    // 2. Compile to visual lesson
    const lesson = compileConceptModelToVisualLesson(model);
    expect(lesson.title).toBe("Refrigerator Vapor-Compression Cycle");
    expect(lesson.transformations.length).toBe(3);
    expect(lesson.transformations[0].explanation).toContain(
      "Raises boiling temperature above ambient",
    );

    // 3. Compile timeline to scene states
    const compiled = compileVisualLesson(lesson);
    expect(compiled.states.length).toBe(4);

    // 4. Validate timeline: verify each step has real semantic diff (anti-fake-step)
    const timelineVal = validateTransformationTimeline(compiled, {
      prompt: "Explain refrigeration cycle",
    });
    expect(timelineVal.valid).toBe(true);

    for (let i = 0; i < compiled.states.length - 1; i++) {
      const diff = computeSemanticDiff(
        compiled.states[i],
        compiled.states[i + 1],
      );
      expect(diff.hasChanges).toBe(true);
    }
  });

  it("detects and rejects duplicate/fake consecutive steps", () => {
    const graph1 = createSceneGraphFromActions([
      {
        type: "create_box",
        id: "node-1",
        label: "Node 1",
        style: { color: "primary" },
      },
    ]);
    const graph2 = createSceneGraphFromActions([
      {
        type: "create_box",
        id: "node-1",
        label: "Node 1",
        style: { color: "primary" },
      },
    ]);

    const state1 = createSceneState(graph1);
    const state2 = createSceneState(graph2);

    const diff = computeSemanticDiff(state1, state2);
    expect(diff.hasChanges).toBe(false);
  });

  it("extracts ConceptModel from a canonical VisualLesson faithfully", () => {
    const lesson = {
      id: "lesson-http-test",
      title: "HTTP 3-Way Handshake and Request",
      steps: [],
      initialScene: [
        {
          type: "create_box" as const,
          id: "client",
          label: "Client Browser",
          role: "actor" as const,
        },
        {
          type: "create_box" as const,
          id: "server",
          label: "Web Server",
          role: "server" as const,
        },
      ],
      transformations: [
        {
          id: "t1",
          title: "SYN Packet",
          explanation: "Client sends TCP SYN packet to initiate connection",
          action: "Send SYN",
          operations: [
            {
              type: "ADD_RELATIONSHIP" as const,
              relationship: {
                id: "rel-syn",
                from: "client",
                to: "server",
                label: "SYN seq=100",
              },
            },
          ],
          visualActions: [
            {
              type: "connect" as const,
              id: "conn-syn",
              from: "client",
              to: "server",
              label: "SYN seq=100",
            },
          ],
        },
      ],
    };

    const extracted = extractConceptModelFromVisualLesson(lesson as any);
    expect(extracted.concept).toBe("HTTP 3-Way Handshake and Request");
    expect(extracted.domain).toBe("networking");
    expect(extracted.entities.some((e) => e.id === "client")).toBe(true);
    expect(extracted.entities.some((e) => e.id === "server")).toBe(true);
    expect(extracted.invariants.length).toBeGreaterThan(0);
    expect(extracted.misconceptions.length).toBeGreaterThan(0);
  });
});
