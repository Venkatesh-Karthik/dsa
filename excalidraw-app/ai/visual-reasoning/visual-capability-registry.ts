/**
 * Universal Visual Capability Registry — Cognora 5.0
 *
 * Defines the complete catalog of universal visual capabilities and their
 * semantic affordances, sizing rules, connector capabilities, and styling.
 * Completely domain-independent: no topic hardcoding.
 */

import type {
  CompositionStrategy,
  ConnectorDirection,
  ConnectorRouting,
  VisualPriority,
} from "./visual-reasoning-model";

export interface CapabilitySizing {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  aspectRatio?: number;
}

export interface CapabilityConnectorAffordance {
  canBeSource: boolean;
  canBeTarget: boolean;
  preferredRoutings: ConnectorRouting[];
  defaultDirection: ConnectorDirection;
}

export interface VisualCapabilityDescriptor {
  id: string;
  category:
    | "structural"
    | "tabular"
    | "interaction"
    | "state"
    | "flow"
    | "memory"
    | "computation"
    | "mathematical"
    | "temporal"
    | "annotation";
  shape: "rectangle" | "ellipse" | "container" | "diamond" | "pill" | "table";
  semanticAffordance: string;
  sizing: CapabilitySizing;
  connectorAffordance: CapabilityConnectorAffordance;
  supportsContainment: boolean;
  preferredCompositionStrategies: CompositionStrategy[];
  semanticKeywords: string[];
}

export class VisualCapabilityRegistry {
  private static registry: Map<string, VisualCapabilityDescriptor> = new Map();

  static {
    VisualCapabilityRegistry.initialize();
  }

  private static initialize(): void {
    const list: VisualCapabilityDescriptor[] = [
      // 1. Structural Primitives
      {
        id: "GenericEntity",
        category: "structural",
        shape: "rectangle",
        semanticAffordance: "Universal conceptual entity representation",
        sizing: { defaultWidth: 120, defaultHeight: 60, minWidth: 80, minHeight: 40 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct", "elbowed"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["structural", "pipeline", "causal", "network"],
        semanticKeywords: ["entity", "component", "item", "object", "element", "thing"],
      },
      {
        id: "CircleNode",
        category: "structural",
        shape: "ellipse",
        semanticAffordance: "Compact symmetric node for trees, graphs, or atomic units",
        sizing: { defaultWidth: 70, defaultHeight: 70, minWidth: 50, minHeight: 50, aspectRatio: 1 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["hierarchical", "network", "cycle"],
        semanticKeywords: ["node", "circle", "vertex", "atom", "point", "unit"],
      },
      {
        id: "TreeNode",
        category: "structural",
        shape: "ellipse",
        semanticAffordance: "Hierarchical tree node with parent/child connectivity",
        sizing: { defaultWidth: 70, defaultHeight: 70, minWidth: 60, minHeight: 60, aspectRatio: 1 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["hierarchical", "structural"],
        semanticKeywords: ["root", "tree-node", "leaf", "subtree", "branch", "child"],
      },
      {
        id: "GraphNode",
        category: "structural",
        shape: "ellipse",
        semanticAffordance: "Graph vertex participating in network topology",
        sizing: { defaultWidth: 60, defaultHeight: 60, minWidth: 50, minHeight: 50, aspectRatio: 1 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["network", "cycle", "causal"],
        semanticKeywords: ["graph-node", "vertex", "intersection", "hub", "station"],
      },
      {
        id: "Container",
        category: "structural",
        shape: "container",
        semanticAffordance: "Grouping boundary or enclosing context holding child entities",
        sizing: { defaultWidth: 260, defaultHeight: 180, minWidth: 160, minHeight: 100 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed"],
          defaultDirection: "forward",
        },
        supportsContainment: true,
        preferredCompositionStrategies: ["layered", "architecture", "spatial"],
        semanticKeywords: ["container", "system", "subsystem", "module", "package", "scope", "cluster"],
      },

      // 2. Tabular & Structured Data
      {
        id: "Table",
        category: "tabular",
        shape: "table",
        semanticAffordance: "Structured relational or tabular collection of records with rows/columns",
        sizing: { defaultWidth: 260, defaultHeight: 140, minWidth: 180, minHeight: 80 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed", "direct"],
          defaultDirection: "forward",
        },
        supportsContainment: true,
        preferredCompositionStrategies: ["tabular", "data-flow", "comparison"],
        semanticKeywords: ["table", "database", "relation", "sheet", "dataset", "records", "accounts"],
      },
      {
        id: "ArrayCell",
        category: "tabular",
        shape: "rectangle",
        semanticAffordance: "Single indexed element within a sequential array/vector",
        sizing: { defaultWidth: 60, defaultHeight: 40, minWidth: 44, minHeight: 36 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct", "elbowed"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["sequence", "tabular"],
        semanticKeywords: ["array-element", "cell", "slot", "index", "vector-cell"],
      },
      {
        id: "Record",
        category: "tabular",
        shape: "rectangle",
        semanticAffordance: "Structured tuple or entity record with field-value pairs",
        sizing: { defaultWidth: 200, defaultHeight: 70, minWidth: 140, minHeight: 50 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed", "direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["tabular", "data-flow", "transformation"],
        semanticKeywords: ["record", "row", "tuple", "account", "entry", "profile"],
      },

      // 3. Interaction & Multi-Party Communication
      {
        id: "Actor",
        category: "interaction",
        shape: "rectangle",
        semanticAffordance: "Autonomous communicating entity or protocol participant with lifeline",
        sizing: { defaultWidth: 120, defaultHeight: 60, minWidth: 90, minHeight: 50 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed", "direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["interaction", "sequence"],
        semanticKeywords: ["actor", "peer", "agent", "participant", "entity", "user"],
      },
      {
        id: "Client",
        category: "interaction",
        shape: "rectangle",
        semanticAffordance: "Initiating or consuming endpoint in distributed communication",
        sizing: { defaultWidth: 120, defaultHeight: 60, minWidth: 90, minHeight: 50 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed", "direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["interaction", "sequence"],
        semanticKeywords: ["client", "requester", "browser", "sender", "consumer"],
      },
      {
        id: "Server",
        category: "interaction",
        shape: "rectangle",
        semanticAffordance: "Responding or processing endpoint in distributed communication",
        sizing: { defaultWidth: 120, defaultHeight: 60, minWidth: 90, minHeight: 50 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed", "direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["interaction", "sequence"],
        semanticKeywords: ["server", "responder", "host", "backend", "receiver", "provider"],
      },
      {
        id: "MessagePacket",
        category: "interaction",
        shape: "pill",
        semanticAffordance: "Communicated payload, datagram, or message traveling between endpoints",
        sizing: { defaultWidth: 100, defaultHeight: 36, minWidth: 70, minHeight: 28 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["interaction", "data-flow"],
        semanticKeywords: ["message", "packet", "payload", "request", "response", "syn", "ack", "signal"],
      },

      // 4. State & Decision
      {
        id: "StateNode",
        category: "state",
        shape: "pill",
        semanticAffordance: "Discrete system state, phase, or lifecycle milestone",
        sizing: { defaultWidth: 120, defaultHeight: 46, minWidth: 80, minHeight: 36 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct", "curved"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["state-transition", "cycle"],
        semanticKeywords: ["state", "phase", "status", "stage", "mode", "condition"],
      },
      {
        id: "DecisionNode",
        category: "state",
        shape: "diamond",
        semanticAffordance: "Evaluated condition with branching outcomes",
        sizing: { defaultWidth: 110, defaultHeight: 66, minWidth: 80, minHeight: 50 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed", "direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["process", "causal", "state-transition"],
        semanticKeywords: ["decision", "condition", "branch", "predicate", "check", "test", "if"],
      },

      // 5. Memory & Storage
      {
        id: "MemoryBlock",
        category: "memory",
        shape: "rectangle",
        semanticAffordance: "Memory allocation block, variable slot, or memory register",
        sizing: { defaultWidth: 140, defaultHeight: 44, minWidth: 100, minHeight: 34 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["elbowed", "direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["memory-layout", "structural"],
        semanticKeywords: ["memory", "register", "slot", "variable", "address", "heap-block"],
      },
      {
        id: "StackFrame",
        category: "memory",
        shape: "rectangle",
        semanticAffordance: "LIFO call stack activation frame or execution context",
        sizing: { defaultWidth: 150, defaultHeight: 40, minWidth: 110, minHeight: 32 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["memory-layout", "sequence"],
        semanticKeywords: ["stack-frame", "call-frame", "activation", "frame", "call-stack"],
      },
      {
        id: "LinkedListNode",
        category: "memory",
        shape: "rectangle",
        semanticAffordance: "Pointer-connected linear node containing value and address link",
        sizing: { defaultWidth: 80, defaultHeight: 40, minWidth: 60, minHeight: 34 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["sequence", "structural"],
        semanticKeywords: ["list-node", "linkedlistnode", "head", "tail", "link"],
      },

      // 6. Computation & Process
      {
        id: "ProcessNode",
        category: "computation",
        shape: "rectangle",
        semanticAffordance: "Computational function, transformation engine, or processor",
        sizing: { defaultWidth: 130, defaultHeight: 56, minWidth: 90, minHeight: 40 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct", "elbowed"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["pipeline", "process", "data-flow"],
        semanticKeywords: ["process", "function", "processor", "alu", "engine", "handler", "transformer"],
      },
      {
        id: "QueueItem",
        category: "computation",
        shape: "rectangle",
        semanticAffordance: "FIFO queued item or buffered task",
        sizing: { defaultWidth: 60, defaultHeight: 40, minWidth: 44, minHeight: 32 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["sequence", "pipeline"],
        semanticKeywords: ["queue-element", "queue-item", "task", "job", "buffer-item"],
      },

      // 7. Mathematics & Science
      {
        id: "EquationBlock",
        category: "mathematical",
        shape: "rectangle",
        semanticAffordance: "Mathematical formula, governing equation, or physical law",
        sizing: { defaultWidth: 160, defaultHeight: 44, minWidth: 100, minHeight: 32 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["mathematical", "spatial"],
        semanticKeywords: ["equation", "formula", "law", "derivation", "expression", "math"],
      },
      {
        id: "TrajectoryRay",
        category: "mathematical",
        shape: "rectangle",
        semanticAffordance: "Directional vector, ray, beam, or motion path",
        sizing: { defaultWidth: 120, defaultHeight: 28, minWidth: 70, minHeight: 20 },
        connectorAffordance: {
          canBeSource: true,
          canBeTarget: true,
          preferredRoutings: ["direct"],
          defaultDirection: "forward",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["spatial", "mathematical"],
        semanticKeywords: ["ray", "beam", "vector", "trajectory", "path", "light", "wave"],
      },

      // 8. Annotation & Auxiliary
      {
        id: "AnnotationCallout",
        category: "annotation",
        shape: "rectangle",
        semanticAffordance: "Contextual educational note anchored to an element without covering it",
        sizing: { defaultWidth: 180, defaultHeight: 56, minWidth: 120, minHeight: 40 },
        connectorAffordance: {
          canBeSource: false,
          canBeTarget: false,
          preferredRoutings: ["direct"],
          defaultDirection: "none",
        },
        supportsContainment: false,
        preferredCompositionStrategies: ["structural", "hierarchical", "interaction"],
        semanticKeywords: ["annotation", "callout", "note", "badge", "pointer-label", "hint"],
      },
    ];

    for (const item of list) {
      VisualCapabilityRegistry.registry.set(item.id, item);
      VisualCapabilityRegistry.registry.set(item.id.toLowerCase(), item);
    }
  }

  public static get(id: string): VisualCapabilityDescriptor | undefined {
    return (
      VisualCapabilityRegistry.registry.get(id) ||
      VisualCapabilityRegistry.registry.get(id.toLowerCase())
    );
  }

  public static listAll(): VisualCapabilityDescriptor[] {
    const seen = new Set<string>();
    const res: VisualCapabilityDescriptor[] = [];
    for (const c of VisualCapabilityRegistry.registry.values()) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        res.push(c);
      }
    }
    return res;
  }

  public static getAll(): VisualCapabilityDescriptor[] {
    return VisualCapabilityRegistry.listAll();
  }

  public static getByCategory(
    category: VisualCapabilityDescriptor["category"],
  ): VisualCapabilityDescriptor[] {
    return VisualCapabilityRegistry.listAll().filter(
      (c) => c.category === category,
    );
  }

  /**
   * Universal dynamic capability resolver matching semantic cues without topic hardcoding.
   */
  public static resolveMatchingCapability(
    semanticRole?: string,
    entityType?: string,
    label?: string,
  ): VisualCapabilityDescriptor {
    const query = `${semanticRole || ""} ${entityType || ""} ${label || ""}`.toLowerCase().trim();

    // Direct lookup by ID
    if (entityType && VisualCapabilityRegistry.get(entityType)) {
      return VisualCapabilityRegistry.get(entityType)!;
    }
    if (semanticRole && VisualCapabilityRegistry.get(semanticRole)) {
      return VisualCapabilityRegistry.get(semanticRole)!;
    }

    // Role-based heuristics (domain agnostic)
    if (/\b(client|browser|requester|sender|caller)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("Client")!;
    }
    if (/\b(server|host|responder|receiver|service|backend)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("Server")!;
    }
    if (/\b(actor|user|agent|participant|endpoint)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("Actor")!;
    }
    if (/\b(table|dataset|relation|database|accounts?|ledger)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("Table")!;
    }
    if (/\b(record|row|tuple|entry|profile)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("Record")!;
    }
    if (/\b(packet|message|payload|syn|ack|datagram|signal)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("MessagePacket")!;
    }
    if (/\b(state|phase|status|mode)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("StateNode")!;
    }
    if (/\b(decision|branch|condition|predicate|if)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("DecisionNode")!;
    }
    if (/\b(tree|root|leaf|subtree)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("TreeNode")!;
    }
    if (/\b(linkedlist|listnode|list-node|head|tail)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("LinkedListNode")!;
    }
    if (/\b(array|vector|cell|slot)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("ArrayCell")!;
    }
    if (/\b(stack|call-frame|activation)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("StackFrame")!;
    }
    if (/\b(queue|fifo|buffer-item)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("QueueItem")!;
    }
    if (/\b(memory|register|address|heap)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("MemoryBlock")!;
    }
    if (/\b(process|function|processor|alu|worker|transformer)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("ProcessNode")!;
    }
    if (/\b(equation|formula|law|expression)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("EquationBlock")!;
    }
    if (/\b(ray|beam|trajectory|vector|wave)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("TrajectoryRay")!;
    }
    if (/\b(annotation|callout|note|hint)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("AnnotationCallout")!;
    }
    if (/\b(container|system|cluster|module|scope)\b/i.test(query)) {
      return VisualCapabilityRegistry.get("Container")!;
    }

    // Default fallback
    return VisualCapabilityRegistry.get("GenericEntity")!;
  }
}
