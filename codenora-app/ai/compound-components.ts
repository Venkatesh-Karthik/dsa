/**
 * Compound Visual Component System — Cognora 6.0
 *
 * Universal reusable visual compositions created from foundational primitives.
 * Provides 25 domain-independent structural patterns (e.g. MessageExchange,
 * CycleView, MemoryMap, TableView, DecisionFlow, CallStack, etc.) that the
 * visual composer can dynamically instantiate for any concept.
 */

import type { SupportedLayoutStrategy } from "./visual-capabilities";

export interface SemanticContext {
  concept?: string;
  intent?: string;
  entityCount?: number;
  hasCycles?: boolean;
  hasActors?: boolean;
  hasMessages?: boolean;
  hasLifelines?: boolean;
  hasTreeHierarchy?: boolean;
  hasOrderedSequence?: boolean;
  hasDecisions?: boolean;
  hasMemoryPointers?: boolean;
  hasTabularData?: boolean;
  hasScientificRays?: boolean;
  hasCallStack?: boolean;
  hasInputOutput?: boolean;
  hasComparison?: boolean;
}

export type CompoundComponent = CompoundComponentDefinition;

export interface CompoundStructurePlan {
  componentId: string;
  layoutStrategy: SupportedLayoutStrategy;
  primaryPrimitives: string[];
  suggestedConnections: Array<{
    from: string;
    to: string;
    type: string;
    label?: string;
  }>;
  suggestedAnnotations: Array<{
    targetId?: string;
    text: string;
    role: string;
  }>;
}

export type NormalizedSemanticContext = SemanticContext & { concept: string };

export interface CompoundComponentDefinition {
  id: string;
  name: string;
  description: string;
  supportedLayout: SupportedLayoutStrategy;
  constituentCapabilities: string[];
  matches: (context: NormalizedSemanticContext) => number; // 0.0 to 1.0 match score
  planStructure: (
    entities: Array<{
      id: string;
      label?: string;
      role?: string;
      value?: unknown;
    }>,
    relationships: Array<{
      id: string;
      source: string;
      target: string;
      type?: string;
      label?: string;
    }>,
    context?: SemanticContext,
  ) => CompoundStructurePlan;
}

export class CompoundComponentRegistry {
  private static instance: CompoundComponentRegistry | null = null;
  private components = new Map<string, CompoundComponentDefinition>();

  private constructor() {
    this.registerFoundationalCompounds();
  }

  public static getInstance(): CompoundComponentRegistry {
    if (!CompoundComponentRegistry.instance) {
      CompoundComponentRegistry.instance = new CompoundComponentRegistry();
    }
    return CompoundComponentRegistry.instance;
  }

  public register(comp: CompoundComponentDefinition): void {
    this.components.set(comp.id, comp);
    this.components.set(comp.id.toLowerCase(), comp);
  }

  public get(id: string): CompoundComponentDefinition | undefined {
    return this.components.get(id) || this.components.get(id.toLowerCase());
  }

  public has(id: string): boolean {
    return this.components.has(id);
  }

  public listAll(): CompoundComponentDefinition[] {
    const seen = new Set<string>();
    const list: CompoundComponentDefinition[] = [];
    for (const comp of this.components.values()) {
      if (!seen.has(comp.id)) {
        seen.add(comp.id);
        list.push(comp);
      }
    }
    return list;
  }

  public getAll(): CompoundComponentDefinition[] {
    return this.listAll();
  }

  /**
   * Finds the best matching compound visual component based on semantic signals.
   */
  public findBestMatch(rawCtx: SemanticContext): CompoundComponentDefinition {
    const ctx: NormalizedSemanticContext = {
      ...rawCtx,
      concept: rawCtx.concept || "",
    };
    let bestMatch: CompoundComponentDefinition | null = null;
    let highestScore = -1;

    for (const comp of this.listAll()) {
      const score = comp.matches(ctx);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = comp;
      }
    }

    return bestMatch || this.get("FlowDiagram")!;
  }

  private registerFoundationalCompounds(): void {
    // 1. MessageExchange (Actor + Actor + Message + DirectedConnection + State + Annotation)
    this.register({
      id: "MessageExchange",
      name: "Message Exchange",
      description:
        "Dual-party synchronized message transmission across boundaries.",
      supportedLayout: "swimlane",
      constituentCapabilities: [
        "Actor",
        "Client",
        "Server",
        "Message",
        "DirectedEdge",
        "State",
      ],
      matches: (c) =>
        c.hasActors ||
        /\b(protocol|handshake|exchange|send|receive|client|server)\b/i.test(
          c.concept,
        )
          ? 0.95
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "MessageExchange",
        layoutStrategy: "swimlane",
        primaryPrimitives: ["Actor", "Client", "Server"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
          label: r.label,
        })),
        suggestedAnnotations: [
          { text: "Synchronized transmission flow", role: "explanation" },
        ],
      }),
    });

    // 2. ActorInteraction
    this.register({
      id: "ActorInteraction",
      name: "Actor Interaction",
      description:
        "Multi-party decentralized or peer-to-peer interaction graph.",
      supportedLayout: "swimlane",
      constituentCapabilities: ["Actor", "Channel", "DirectedEdge", "Event"],
      matches: (c) =>
        /\b(peer|agent|actor|interaction|negotiation|quorum)\b/i.test(c.concept)
          ? 0.88
          : 0.05,
      planStructure: (ents, rels) => ({
        componentId: "ActorInteraction",
        layoutStrategy: "swimlane",
        primaryPrimitives: ["Actor"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
        })),
        suggestedAnnotations: [],
      }),
    });

    // 3. ProcessLifecycle
    this.register({
      id: "ProcessLifecycle",
      name: "Process Lifecycle",
      description:
        "Stage-by-stage progression through initial, intermediate, and terminal execution states.",
      supportedLayout: "dag",
      constituentCapabilities: [
        "Process",
        "State",
        "ControlFlow",
        "TerminalState",
      ],
      matches: (c) =>
        /\b(lifecycle|process|stage|phase|thread|task)\b/i.test(c.concept)
          ? 0.85
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "ProcessLifecycle",
        layoutStrategy: "dag",
        primaryPrimitives: ["State", "Process"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "ControlFlow",
        })),
        suggestedAnnotations: [
          { text: "Lifecycle progression", role: "explanation" },
        ],
      }),
    });

    // 4. StateMachine
    this.register({
      id: "StateMachine",
      name: "Finite State Machine",
      description:
        "State nodes interconnected by conditional transition edges.",
      supportedLayout: "graph",
      constituentCapabilities: [
        "State",
        "StateTransition",
        "ActiveState",
        "DirectedEdge",
      ],
      matches: (c) =>
        /\b(state machine|automaton|transition|fsm|states)\b/i.test(c.concept)
          ? 0.92
          : 0.15,
      planStructure: (ents, rels) => ({
        componentId: "StateMachine",
        layoutStrategy: "graph",
        primaryPrimitives: ["State"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "StateTransition",
          label: r.label,
        })),
        suggestedAnnotations: [],
      }),
    });

    // 5. DecisionFlow
    this.register({
      id: "DecisionFlow",
      name: "Decision Flow",
      description:
        "Condition evaluation branching into discrete alternative consequences.",
      supportedLayout: "dag",
      constituentCapabilities: [
        "Decision",
        "Condition",
        "Branch",
        "DirectedEdge",
      ],
      matches: (c) =>
        c.hasDecisions ||
        /\b(decision|branch|condition|if.*else|choice)\b/i.test(c.concept)
          ? 0.9
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "DecisionFlow",
        layoutStrategy: "dag",
        primaryPrimitives: ["Decision"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
          label: r.label,
        })),
        suggestedAnnotations: [
          { text: "Evaluates branch condition", role: "decision" },
        ],
      }),
    });

    // 6. DataPipeline
    this.register({
      id: "DataPipeline",
      name: "Data Pipeline",
      description:
        "Multi-stage stream transforms from source ingestion to sink consumption.",
      supportedLayout: "dag",
      constituentCapabilities: [
        "DataStore",
        "DataFlow",
        "Process",
        "DirectedEdge",
      ],
      matches: (c) =>
        /\b(pipeline|etl|stream|ingestion|transform.*sink)\b/i.test(c.concept)
          ? 0.87
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "DataPipeline",
        layoutStrategy: "dag",
        primaryPrimitives: ["Process", "Container"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DataFlow",
        })),
        suggestedAnnotations: [],
      }),
    });

    // 7. TableView
    this.register({
      id: "TableView",
      name: "Tabular View",
      description:
        "Relational record layout with headers, rows, columns, and active row highlights.",
      supportedLayout: "table",
      constituentCapabilities: ["Table", "Row", "Cell", "Header"],
      matches: (c) =>
        c.hasTabularData ||
        /\b(table|database|sql|record|relational|schema)\b/i.test(c.concept)
          ? 0.92
          : 0.1,
      planStructure: (ents) => ({
        componentId: "TableView",
        layoutStrategy: "table",
        primaryPrimitives: ["Table"],
        suggestedConnections: [],
        suggestedAnnotations: [{ text: "Schema records", role: "data" }],
      }),
    });

    // 8. MemoryMap
    this.register({
      id: "MemoryMap",
      name: "Memory Map",
      description:
        "Contiguous or heap memory blocks with address references and pointers.",
      supportedLayout: "memory",
      constituentCapabilities: [
        "MemoryRegion",
        "MemoryBlock",
        "Pointer",
        "Reference",
      ],
      matches: (c) =>
        c.hasMemoryPointers ||
        /\b(memory|pointer|heap|allocation|address|buffer)\b/i.test(c.concept)
          ? 0.94
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "MemoryMap",
        layoutStrategy: "memory",
        primaryPrimitives: ["MemoryBlock", "Pointer"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "Reference",
        })),
        suggestedAnnotations: [{ text: "Memory allocation", role: "memory" }],
      }),
    });

    // 9. CallStack
    this.register({
      id: "CallStack",
      name: "Call Stack",
      description:
        "Vertical activation frame hierarchy illustrating function calls and returns.",
      supportedLayout: "memory",
      constituentCapabilities: ["CallFrame", "StackFrame", "ControlFlow"],
      matches: (c) =>
        c.hasCallStack ||
        /\b(call stack|recursion|stack frame|function call|return)\b/i.test(
          c.concept,
        )
          ? 0.96
          : 0.1,
      planStructure: (ents) => ({
        componentId: "CallStack",
        layoutStrategy: "memory",
        primaryPrimitives: ["CallFrame"],
        suggestedConnections: [],
        suggestedAnnotations: [
          { text: "Active invocation frame", role: "call" },
        ],
      }),
    });

    // 10. TimelineView
    this.register({
      id: "TimelineView",
      name: "Timeline View",
      description: "Linear chronological progression of milestone events.",
      supportedLayout: "sequence",
      constituentCapabilities: ["Timeline", "TimelineEvent", "SequenceLink"],
      matches: (c) =>
        c.hasOrderedSequence ||
        /\b(timeline|chronology|history|phase|progression)\b/i.test(c.concept)
          ? 0.85
          : 0.15,
      planStructure: (ents, rels) => ({
        componentId: "TimelineView",
        layoutStrategy: "sequence",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "SequenceLink",
        })),
        suggestedAnnotations: [],
      }),
    });

    // 11. GraphView
    this.register({
      id: "GraphView",
      name: "Graph Network",
      description:
        "Interconnected network of nodes and weighted/directed edges.",
      supportedLayout: "graph",
      constituentCapabilities: [
        "Graph",
        "Node",
        "DirectedEdge",
        "UndirectedEdge",
      ],
      matches: (c) =>
        /\b(graph|network|dijkstra|bfs|dfs|topology|nodes)\b/i.test(c.concept)
          ? 0.92
          : 0.2,
      planStructure: (ents, rels) => ({
        componentId: "GraphView",
        layoutStrategy: "graph",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
          label: r.label,
        })),
        suggestedAnnotations: [],
      }),
    });

    // 12. TreeView
    this.register({
      id: "TreeView",
      name: "Tree Hierarchy",
      description:
        "Hierarchical parent-child tree layout with level gaps and balance factors.",
      supportedLayout: "tree",
      constituentCapabilities: ["Tree", "Node", "Hierarchy"],
      matches: (c) =>
        c.hasTreeHierarchy ||
        /\b(tree|binary tree|avl|trie|heap|hierarchy|parent.*child)\b/i.test(
          c.concept,
        )
          ? 0.95
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "TreeView",
        layoutStrategy: "tree",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "Hierarchy",
        })),
        suggestedAnnotations: [],
      }),
    });

    // 13. ArrayView
    this.register({
      id: "ArrayView",
      name: "Array Buffer",
      description:
        "Horizontal linear contiguous cells with index positions and pointer flags.",
      supportedLayout: "linear",
      constituentCapabilities: ["Array", "Cell", "Pointer"],
      matches: (c) =>
        /\b(array|buffer|binary search|sorting|sub-array|cells)\b/i.test(
          c.concept,
        )
          ? 0.93
          : 0.1,
      planStructure: (ents) => ({
        componentId: "ArrayView",
        layoutStrategy: "linear",
        primaryPrimitives: ["Cell"],
        suggestedConnections: [],
        suggestedAnnotations: [{ text: "Array indices", role: "index" }],
      }),
    });

    // 14. MatrixView
    this.register({
      id: "MatrixView",
      name: "Matrix Grid",
      description: "2D rectangular matrix with row/col coordinate alignment.",
      supportedLayout: "matrix",
      constituentCapabilities: ["Matrix", "Cell"],
      matches: (c) =>
        /\b(matrix|grid|2d array|tabular grid|board)\b/i.test(c.concept)
          ? 0.89
          : 0.1,
      planStructure: (ents) => ({
        componentId: "MatrixView",
        layoutStrategy: "matrix",
        primaryPrimitives: ["Cell"],
        suggestedConnections: [],
        suggestedAnnotations: [],
      }),
    });

    // 15. FlowDiagram
    this.register({
      id: "FlowDiagram",
      name: "Process Flow",
      description: "Step-by-step procedural workflow with causal connections.",
      supportedLayout: "dag",
      constituentCapabilities: ["Node", "DirectedEdge", "Callout"],
      matches: () => 0.6, // Universal default fallback
      planStructure: (ents, rels) => ({
        componentId: "FlowDiagram",
        layoutStrategy: "dag",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
        })),
        suggestedAnnotations: [],
      }),
    });

    // 16. CauseEffectDiagram
    this.register({
      id: "CauseEffectDiagram",
      name: "Cause and Effect",
      description:
        "Causal cascade showing how initial triggers produce downstream consequences.",
      supportedLayout: "dag",
      constituentCapabilities: ["CausalLink", "Node", "Callout"],
      matches: (c) =>
        /\b(cause|effect|cascade|consequence|reaction|trigger)\b/i.test(
          c.concept,
        )
          ? 0.88
          : 0.15,
      planStructure: (ents, rels) => ({
        componentId: "CauseEffectDiagram",
        layoutStrategy: "dag",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "CausalLink",
        })),
        suggestedAnnotations: [{ text: "Causal cascade", role: "cause" }],
      }),
    });

    // 17. ComparisonView
    this.register({
      id: "ComparisonView",
      name: "Side-by-Side Comparison",
      description:
        "Dual-column comparison demonstrating trade-offs between two options.",
      supportedLayout: "grid",
      constituentCapabilities: ["Container", "Card", "Comparison"],
      matches: (c) =>
        c.hasComparison ||
        /\b(compare|contrast|vs|versus|difference)\b/i.test(c.concept)
          ? 0.94
          : 0.05,
      planStructure: (ents) => ({
        componentId: "ComparisonView",
        layoutStrategy: "grid",
        primaryPrimitives: ["Card", "Container"],
        suggestedConnections: [],
        suggestedAnnotations: [
          { text: "Comparative evaluation", role: "comparison" },
        ],
      }),
    });

    // 18. CycleView (Closed feedback loop: Measure -> Evaluate -> Decide -> Act)
    this.register({
      id: "CycleView",
      name: "Feedback Cycle",
      description:
        "Closed circular or radial loop representing dynamic equilibrium regulation.",
      supportedLayout: "cycle",
      constituentCapabilities: ["Node", "DirectedEdge", "Decision"],
      matches: (c) =>
        c.hasCycles ||
        /\b(feedback|cycle|loop|regulat|equilibrium|thermostat|monitor.*act)\b/i.test(
          c.concept,
        )
          ? 0.95
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "CycleView",
        layoutStrategy: "cycle",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
          label: r.label,
        })),
        suggestedAnnotations: [
          { text: "Closed feedback regulation", role: "cycle" },
        ],
      }),
    });

    // 19. CoordinateSystem
    this.register({
      id: "CoordinateSystem",
      name: "Coordinate System",
      description:
        "Spatial 2D coordinate plane with origin, axes, points, and vector rays.",
      supportedLayout: "coordinate",
      constituentCapabilities: ["Axis", "Point", "Vector", "Curve"],
      matches: (c) =>
        /\b(coordinate|axis|vector|graph.*curve|plot|plane)\b/i.test(c.concept)
          ? 0.88
          : 0.05,
      planStructure: (ents) => ({
        componentId: "CoordinateSystem",
        layoutStrategy: "coordinate",
        primaryPrimitives: ["Axis", "Point"],
        suggestedConnections: [],
        suggestedAnnotations: [],
      }),
    });

    // 20. ScientificProcess
    this.register({
      id: "ScientificProcess",
      name: "Scientific Physical Process",
      description:
        "Physical media interfaces, refraction rays, wave fronts, and particle kinetics.",
      supportedLayout: "coordinate",
      constituentCapabilities: ["Boundary", "Ray", "Particle", "Medium"],
      matches: (c) =>
        c.hasScientificRays ||
        /\b(refraction|ray|optics|light|wave|particle|physics|chemistry)\b/i.test(
          c.concept,
        )
          ? 0.92
          : 0.05,
      planStructure: (ents, rels) => ({
        componentId: "ScientificProcess",
        layoutStrategy: "coordinate",
        primaryPrimitives: ["Ray", "Boundary"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
        })),
        suggestedAnnotations: [
          { text: "Physical boundary interaction", role: "science" },
        ],
      }),
    });

    // 21. SystemArchitecture
    this.register({
      id: "SystemArchitecture",
      name: "System Architecture",
      description:
        "Multi-tier topological architectural layers (client, gateway, service, datastore).",
      supportedLayout: "dag",
      constituentCapabilities: [
        "Container",
        "Component",
        "Database",
        "Client",
        "Server",
      ],
      matches: (c) =>
        /\b(architecture|topology|tier|microservice|distributed system)\b/i.test(
          c.concept,
        )
          ? 0.91
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "SystemArchitecture",
        layoutStrategy: "dag",
        primaryPrimitives: ["Container", "Component"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
        })),
        suggestedAnnotations: [],
      }),
    });

    // 22. InputOutputFlow
    this.register({
      id: "InputOutputFlow",
      name: "Input-Output Transformation",
      description:
        "Linear flow of inputs entering a core mechanism to produce validated outputs.",
      supportedLayout: "linear",
      constituentCapabilities: ["Node", "DirectedEdge", "Container"],
      matches: (c) =>
        c.hasInputOutput ||
        /\b(input.*output|encoder.*decoder|compiler.*ast|flow)\b/i.test(
          c.concept,
        )
          ? 0.86
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "InputOutputFlow",
        layoutStrategy: "linear",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
        })),
        suggestedAnnotations: [
          { text: "Input transformed to output", role: "flow" },
        ],
      }),
    });

    // 23. DependencyGraph
    this.register({
      id: "DependencyGraph",
      name: "Dependency Resolution Graph",
      description:
        "Directed acyclic dependency network resolving topological order.",
      supportedLayout: "dag",
      constituentCapabilities: ["Dependency", "Node"],
      matches: (c) =>
        /\b(dependency|topological|build order|prerequisite)\b/i.test(c.concept)
          ? 0.9
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "DependencyGraph",
        layoutStrategy: "dag",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "Dependency",
        })),
        suggestedAnnotations: [],
      }),
    });

    // 24. SequenceDiagram / Swimlane
    this.register({
      id: "SequenceDiagram",
      name: "Sequence Diagram",
      description:
        "Vertical timeline swimlanes per actor with horizontal message exchanges.",
      supportedLayout: "swimlane",
      constituentCapabilities: [
        "Actor",
        "Message",
        "SequenceLink",
        "DirectedEdge",
      ],
      matches: (c) =>
        /\b(sequence diagram|swimlane|chronological exchange|order of messages)\b/i.test(
          c.concept,
        )
          ? 0.94
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "SequenceDiagram",
        layoutStrategy: "swimlane",
        primaryPrimitives: ["Actor"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "DirectedEdge",
          label: r.label,
        })),
        suggestedAnnotations: [],
      }),
    });

    // 25. HierarchyDiagram
    this.register({
      id: "HierarchyDiagram",
      name: "Hierarchy Decomposition",
      description: "Multi-level structural organizational decomposition.",
      supportedLayout: "tree",
      constituentCapabilities: ["Container", "Node", "Hierarchy"],
      matches: (c) =>
        /\b(hierarchy|breakdown|decomposition|organizational)\b/i.test(
          c.concept,
        )
          ? 0.87
          : 0.1,
      planStructure: (ents, rels) => ({
        componentId: "HierarchyDiagram",
        layoutStrategy: "tree",
        primaryPrimitives: ["Node"],
        suggestedConnections: rels.map((r) => ({
          from: r.source,
          to: r.target,
          type: "Hierarchy",
        })),
        suggestedAnnotations: [],
      }),
    });
  }
}

/** Global singleton accessor */
export const compoundComponents = CompoundComponentRegistry.getInstance();
