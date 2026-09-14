/**
 * Universal Visual Capability Registry — Cognora 6.0
 *
 * Centralized, domain-independent registry of visual capabilities.
 * Decouples educational topics from visual primitives.
 * Provides extensible classification, sizing rules, layout requirements,
 * state styles, connector capabilities, and accessibility metadata.
 */

export type VisualCapabilityCategory =
  | "structural"
  | "relationships"
  | "interaction"
  | "state"
  | "data"
  | "computation"
  | "memory"
  | "mathematics"
  | "science"
  | "timeline"
  | "annotation";

export type SupportedLayoutStrategy =
  | "tree"
  | "graph"
  | "dag"
  | "grid"
  | "matrix"
  | "linear"
  | "radial"
  | "cycle"
  | "swimlane"
  | "sequence"
  | "timeline"
  | "flow"
  | "comparison"
  | "hierarchy"
  | "composite"
  | "coordinate"
  | "memory"
  | "table"
  | "hybrid";

export interface DynamicDimensions {
  width: number;
  height: number;
}

export interface ConnectorCapabilities {
  canBeSource: boolean;
  canBeTarget: boolean;
  supportedRoutings: Array<"straight" | "curved" | "elbowed" | "flow">;
  defaultAnchor?: "center" | "top" | "bottom" | "left" | "right" | "perimeter";
}

export interface LayoutRequirements {
  preferredLayout: SupportedLayoutStrategy;
  minWidth: number;
  minHeight: number;
  resizable: boolean;
  aspectRatio?: number;
  margin?: number;
}

export interface VisualCapability {
  /** Unique canonical capability identifier (e.g. 'Node', 'Actor', 'MemoryBlock') */
  id: string;
  /** High-level pedagogical/visual category */
  category: VisualCapabilityCategory;
  /** Formal semantic role and purpose */
  semanticMeaning: string;
  /** Supported styling and state property keys */
  supportedProperties: string[];
  /** Supported child capability types for hierarchical nesting */
  childrenTypes?: string[];
  /** Supported outgoing/incoming relationship capability IDs */
  relationshipTypes?: string[];
  /** Spatial layout constraints and preferences */
  layoutRequirements: LayoutRequirements;
  /** Function computing dynamic bounding box based on entity payload */
  dynamicSizingRules: (content?: any) => DynamicDimensions;
  /** Predefined visual token overrides per semantic state */
  stateStyles?: Record<string, Record<string, any>>;
  /** Semantic animations supported by this visual primitive */
  animationCapabilities: string[];
  /** Connection attachment capabilities and routing styles */
  connectorCapabilities: ConnectorCapabilities;
  /** Screen reader / accessibility description generator */
  accessibilityLabel: (entity?: any) => string;
  /** Interactive behaviors supported on canvas (e.g. inspect, expand, drag) */
  interactionBehavior?: {
    selectable: boolean;
    expandable?: boolean;
    inspectable: boolean;
    clickable?: boolean;
  };
}

// ============================================================================
// Visual Capability Registry Implementation
// ============================================================================

export class VisualCapabilityRegistry {
  private static instance: VisualCapabilityRegistry | null = null;
  private capabilities = new Map<string, VisualCapability>();
  private categoryIndex = new Map<VisualCapabilityCategory, Set<string>>();

  private constructor() {
    this.registerFoundationalCapabilities();
  }

  public static getInstance(): VisualCapabilityRegistry {
    if (!VisualCapabilityRegistry.instance) {
      VisualCapabilityRegistry.instance = new VisualCapabilityRegistry();
    }
    return VisualCapabilityRegistry.instance;
  }

  /**
   * Registers a new or upgraded visual capability.
   */
  public register(cap: VisualCapability): void {
    const normId = cap.id.trim();
    this.capabilities.set(normId, cap);
    this.capabilities.set(normId.toLowerCase(), cap);

    if (!this.categoryIndex.has(cap.category)) {
      this.categoryIndex.set(cap.category, new Set());
    }
    this.categoryIndex.get(cap.category)!.add(normId);
  }

  /**
   * Retrieves a capability by ID (case-insensitive).
   */
  public get(id: string): VisualCapability | undefined {
    return this.capabilities.get(id) || this.capabilities.get(id.toLowerCase());
  }

  /**
   * Checks if a capability exists.
   */
  public has(id: string): boolean {
    return this.capabilities.has(id) || this.capabilities.has(id.toLowerCase());
  }

  /**
   * Returns all capabilities belonging to a specific category.
   */
  public getByCategory(category: VisualCapabilityCategory): VisualCapability[] {
    const ids = this.categoryIndex.get(category);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.capabilities.get(id))
      .filter((c): c is VisualCapability => c !== undefined);
  }

  /**
   * Returns all canonical visual capabilities.
   */
  public getAll(): VisualCapability[] {
    const unique = new Map<string, VisualCapability>();
    for (const cap of this.capabilities.values()) {
      unique.set(cap.id, cap);
    }
    return Array.from(unique.values());
  }

  /**
   * Returns all registered visual capability categories.
   */
  public getCategories(): VisualCapabilityCategory[] {
    return Array.from(this.categoryIndex.keys());
  }

  /**
   * Finds the best matching visual capability for a given semantic role, primitive name, or concept keyword.
   */
  public findMatching(query: string): VisualCapability {
    const q = query.trim().toLowerCase();

    // 1. Direct match
    const direct = this.get(q);
    if (direct) return direct;

    // 2. Semantic role aliases
    if (/\b(callframe|callstack|activation|activation frame|call stack|stackframe)\b/i.test(q)) {
      return this.get("CallFrame") || this.get("StackFrame")!;
    }
    if (/\bclient\b/i.test(q)) {
      return this.get("Client")!;
    }
    if (/\b(actor|browser|sender|origin|caller)\b/i.test(q)) {
      return this.get("Actor") || this.get("Client")!;
    }
    if (/\b(server|backend|receiver|target|host|service)\b/i.test(q)) {
      return this.get("Server")!;
    }
    if (/\b(message|packet|syn|ack|payload|signal|token)\b/i.test(q) || (/\bframe\b/i.test(q) && !/\b(call|stack|activation)\b/i.test(q))) {
      return this.get("Message")!;
    }
    if (/\b(tree|branch|root|leaf|treenode)\b/i.test(q)) {
      return this.get("Tree") || this.get("Node")!;
    }
    if (/\b(graph|vertex|node|graphnode)\b/i.test(q)) {
      return this.get("Graph") || this.get("Node")!;
    }
    if (/\b(array|slot|element|cell|arraycell)\b/i.test(q)) {
      return this.get("Array") || this.get("Cell")!;
    }
    if (/\b(record|row|tuple|entry)\b/i.test(q)) {
      return this.get("Record") || this.get("Cell") || this.get("Table")!;
    }
    if (/\b(table|database|db|relation|schema)\b/i.test(q)) {
      return this.get("Table") || this.get("Database")!;
    }
    if (/\b(stack)\b/i.test(q)) {
      return this.get("StackFrame") || this.get("CallFrame")!;
    }
    if (/\b(memory|heap|address|pointer|register|buffer)\b/i.test(q)) {
      return this.get("MemoryBlock") || this.get("Pointer")!;
    }
    if (/\b(state|statemachine|status|phase)\b/i.test(q)) {
      return this.get("State")!;
    }
    if (/\b(decision|condition|branch|choice)\b/i.test(q)) {
      return this.get("Decision")!;
    }
    if (/\b(equation|formula|math|variable|constant)\b/i.test(q)) {
      return this.get("Equation")!;
    }
    if (/\b(ray|beam|light|laser|radiation|optical)\b/i.test(q)) {
      return this.get("Ray")!;
    }
    if (/\b(particle|wave|energy|force|velocity|vector|boundary)\b/i.test(q)) {
      return this.get("Particle") || this.get("Object")!;
    }
    if (/\b(callout|note|explanation|warning|badge|invariant)\b/i.test(q)) {
      return this.get("Callout") || this.get("Badge")!;
    }

    // Default universal fallback
    return this.get("GenericEntity") || this.get("Node")!;
  }

  /**
   * Lists all unique registered capabilities.
   */
  public listAll(): VisualCapability[] {
    const seen = new Set<string>();
    const list: VisualCapability[] = [];
    for (const [key, cap] of this.capabilities.entries()) {
      if (!seen.has(cap.id)) {
        seen.add(cap.id);
        list.push(cap);
      }
    }
    return list;
  }

  // ==========================================================================
  // Foundational Capabilities Registration
  // ==========================================================================

  private registerFoundationalCapabilities(): void {
    // ------------------------------------------------------------------------
    // 1. STRUCTURAL CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "Node",
      category: "structural",
      semanticMeaning: "Atomic discrete semantic entity or component in a graph, system, or topology.",
      supportedProperties: ["label", "value", "state", "highlight", "shape", "color", "diameter"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 60, minHeight: 60, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(64, Math.min(180, (String(c?.label || c?.value || "").length + 2) * 10)),
        height: 64,
      }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "MUTATE", "HIGHLIGHT", "PULSE", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "curved", "elbowed"] },
      accessibilityLabel: (e) => `Node ${e?.label || e?.id || ""}: ${e?.value || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "GenericEntity",
      category: "structural",
      semanticMeaning: "Universal foundational entity fallback when no specialized visual capability matches.",
      supportedProperties: ["label", "value", "state", "highlight", "shape", "color"],
      layoutRequirements: { preferredLayout: "hybrid", minWidth: 60, minHeight: 60, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(64, Math.min(180, (String(c?.label || c?.value || "").length + 2) * 10)),
        height: 64,
      }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "curved", "elbowed"] },
      accessibilityLabel: (e) => `Entity ${e?.label || e?.id || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Container",
      category: "structural",
      semanticMeaning: "Bounded spatial enclosure grouping related sub-entities, subsystems, or execution scopes.",
      supportedProperties: ["label", "title", "borderStyle", "fill", "padding"],
      childrenTypes: ["Node", "Cell", "Card", "Row", "Table", "Process"],
      layoutRequirements: { preferredLayout: "hybrid", minWidth: 200, minHeight: 140, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(220, (c?.childrenCount || 1) * 80),
        height: Math.max(160, (c?.childrenCount || 1) * 60),
      }),
      animationCapabilities: ["CREATE", "REMOVE", "EXPAND", "COLLAPSE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Container ${e?.label || e?.id || ""}`,
      interactionBehavior: { selectable: true, expandable: true, inspectable: true },
    });

    this.register({
      id: "Group",
      category: "structural",
      semanticMeaning: "Logical grouping of elements that share semantic coordination or lifecycle.",
      supportedProperties: ["label", "highlight", "role"],
      layoutRequirements: { preferredLayout: "hybrid", minWidth: 100, minHeight: 60, resizable: true },
      dynamicSizingRules: () => ({ width: 140, height: 80 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Group ${e?.label || e?.id || ""}`,
    });

    this.register({
      id: "Card",
      category: "structural",
      semanticMeaning: "Structured informational card with title, property fields, and status badges.",
      supportedProperties: ["title", "fields", "badge", "highlight"],
      layoutRequirements: { preferredLayout: "grid", minWidth: 160, minHeight: 100, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(160, Math.min(260, String(c?.title || "").length * 11)),
        height: Math.max(90, 40 + (c?.fields?.length || 0) * 24),
      }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Card ${e?.title || e?.id || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Panel",
      category: "structural",
      semanticMeaning: "Dedicated side or bottom display panel presenting technical metrics or live code.",
      supportedProperties: ["title", "content", "language"],
      layoutRequirements: { preferredLayout: "linear", minWidth: 260, minHeight: 140, resizable: true },
      dynamicSizingRules: () => ({ width: 280, height: 180 }),
      animationCapabilities: ["CREATE", "REMOVE", "EXPAND", "COLLAPSE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Panel ${e?.title || ""}`,
    });

    this.register({
      id: "Cluster",
      category: "structural",
      semanticMeaning: "Densely coupled collection of nodes or components representing a sub-network or module.",
      supportedProperties: ["name", "density", "boundaryColor"],
      layoutRequirements: { preferredLayout: "radial", minWidth: 180, minHeight: 180, resizable: true },
      dynamicSizingRules: (c) => ({ width: 120 + (c?.count || 3) * 20, height: 120 + (c?.count || 3) * 20 }),
      animationCapabilities: ["CREATE", "REMOVE", "PULSE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["curved", "straight"] },
      accessibilityLabel: (e) => `Cluster ${e?.name || ""}`,
    });

    this.register({
      id: "Tree",
      category: "structural",
      semanticMeaning: "Hierarchical parent-child tree data structure or taxonomy.",
      supportedProperties: ["rootId", "branchingFactor", "levelGap", "siblingGap"],
      layoutRequirements: { preferredLayout: "tree", minWidth: 180, minHeight: 140, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(200, (c?.leavesCount || 2) * 80), height: (c?.depth || 2) * 100 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "BRANCH", "MERGE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "curved"] },
      accessibilityLabel: (e) => `Tree ${e?.label || ""}`,
    });

    this.register({
      id: "Graph",
      category: "structural",
      semanticMeaning: "Interconnected network of vertices and directed or undirected relationships.",
      supportedProperties: ["directed", "weighted", "cyclic"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 240, minHeight: 200, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(240, (c?.nodeCount || 4) * 60), height: Math.max(200, (c?.nodeCount || 4) * 50) }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "CONNECT", "DISCONNECT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "curved"] },
      accessibilityLabel: (e) => `Graph network with ${e?.nodeCount || 0} nodes`,
    });

    this.register({
      id: "Array",
      category: "structural",
      semanticMeaning: "Contiguous sequence of indexed slots representing sequential memory or buffer cells.",
      supportedProperties: ["length", "cellWidth", "cellHeight", "indicesVisible"],
      layoutRequirements: { preferredLayout: "linear", minWidth: 160, minHeight: 60, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(160, (c?.length || 4) * 64), height: 70 }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "MOVE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Array of size ${e?.length || 0}`,
    });

    this.register({
      id: "Matrix",
      category: "structural",
      semanticMeaning: "2D grid of values or mathematical elements indexed by row and column.",
      supportedProperties: ["rows", "cols", "cellGap"],
      layoutRequirements: { preferredLayout: "matrix", minWidth: 140, minHeight: 140, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(140, (c?.cols || 3) * 50), height: Math.max(140, (c?.rows || 3) * 50) }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Matrix ${e?.rows || 0} by ${e?.cols || 0}`,
    });

    this.register({
      id: "Grid",
      category: "structural",
      semanticMeaning: "Multi-row and multi-column visual grid organizing independent or parallel items.",
      supportedProperties: ["columns", "rows", "gap"],
      layoutRequirements: { preferredLayout: "grid", minWidth: 200, minHeight: 160, resizable: true },
      dynamicSizingRules: (c) => ({ width: (c?.columns || 3) * 120, height: (c?.rows || 2) * 100 }),
      animationCapabilities: ["CREATE", "REMOVE", "REORDER"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Grid layout`,
    });

    this.register({
      id: "Column",
      category: "structural",
      semanticMeaning: "Vertical column stack of entities or fields.",
      supportedProperties: ["width", "gap"],
      layoutRequirements: { preferredLayout: "linear", minWidth: 100, minHeight: 120, resizable: true },
      dynamicSizingRules: (c) => ({ width: 120, height: Math.max(100, (c?.itemCount || 2) * 50) }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Column`,
    });

    this.register({
      id: "Row",
      category: "structural",
      semanticMeaning: "Horizontal row sequence of entities or fields.",
      supportedProperties: ["height", "gap"],
      layoutRequirements: { preferredLayout: "linear", minWidth: 160, minHeight: 50, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(160, (c?.itemCount || 3) * 80), height: 50 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Row`,
    });

    // ------------------------------------------------------------------------
    // 2. RELATIONSHIP CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "DirectedEdge",
      category: "relationships",
      semanticMeaning: "Directed directional arrow indicating transfer, dependency, cause, or invocation.",
      supportedProperties: ["label", "weight", "color", "style", "highlight", "arrowhead"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["CONNECT", "DISCONNECT", "HIGHLIGHT", "TRANSFER", "FLOW"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["straight", "curved", "elbowed", "flow"] },
      accessibilityLabel: (e) => `Directed connection from ${e?.source || ""} to ${e?.target || ""}${e?.label ? ` labeled ${e.label}` : ""}`,
    });

    this.register({
      id: "UndirectedEdge",
      category: "relationships",
      semanticMeaning: "Symmetric, bidirectional, or undirected relationship link between entities.",
      supportedProperties: ["label", "weight", "color", "style"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["CONNECT", "DISCONNECT", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["straight", "curved"] },
      accessibilityLabel: (e) => `Undirected connection between ${e?.source || ""} and ${e?.target || ""}`,
    });

    this.register({
      id: "BidirectionalEdge",
      category: "relationships",
      semanticMeaning: "Two-way mutual communication or bidirectional link between entities.",
      supportedProperties: ["label", "color", "style"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["CONNECT", "DISCONNECT", "FLOW"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["straight", "curved"] },
      accessibilityLabel: (e) => `Two-way connection between ${e?.source || ""} and ${e?.target || ""}`,
    });

    this.register({
      id: "Dependency",
      category: "relationships",
      semanticMeaning: "Prerequisite dependency edge indicating that one entity requires another.",
      supportedProperties: ["requiredInvariant", "severity"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["CONNECT", "DISCONNECT", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `${e?.source || ""} depends on ${e?.target || ""}`,
    });

    this.register({
      id: "Association",
      category: "relationships",
      semanticMeaning: "Loose structural or logical association between entities.",
      supportedProperties: ["label", "style"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 50, height: 20 }),
      animationCapabilities: ["CONNECT", "DISCONNECT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Association between ${e?.source || ""} and ${e?.target || ""}`,
    });

    this.register({
      id: "Hierarchy",
      category: "relationships",
      semanticMeaning: "Parent-child structural inheritance or subordination link.",
      supportedProperties: ["depth", "order"],
      layoutRequirements: { preferredLayout: "tree", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 50, height: 20 }),
      animationCapabilities: ["CONNECT", "DISCONNECT", "BRANCH"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["straight", "curved"] },
      accessibilityLabel: (e) => `${e?.source || ""} is parent of ${e?.target || ""}`,
    });

    this.register({
      id: "Reference",
      category: "relationships",
      semanticMeaning: "Memory pointer, reference, or address citation.",
      supportedProperties: ["pointerName", "offset"],
      layoutRequirements: { preferredLayout: "memory", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 50, height: 20 }),
      animationCapabilities: ["CONNECT", "MOVE", "DISCONNECT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["curved", "elbowed"] },
      accessibilityLabel: (e) => `Reference pointing to ${e?.target || ""}`,
    });

    this.register({
      id: "Ownership",
      category: "relationships",
      semanticMeaning: "Exclusive ownership or lifecycle management relationship.",
      supportedProperties: ["role"],
      layoutRequirements: { preferredLayout: "tree", minWidth: 40, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 50, height: 20 }),
      animationCapabilities: ["CONNECT", "DISCONNECT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["elbowed"] },
      accessibilityLabel: (e) => `${e?.source || ""} owns ${e?.target || ""}`,
    });

    this.register({
      id: "Flow",
      category: "relationships",
      semanticMeaning: "Directional stream or continuous flow of items, energy, or data.",
      supportedProperties: ["rate", "direction", "medium"],
      layoutRequirements: { preferredLayout: "sequence", minWidth: 50, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["FLOW", "PULSE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["straight", "curved"] },
      accessibilityLabel: (e) => `Flow from ${e?.source || ""} to ${e?.target || ""}`,
    });

    this.register({
      id: "DataFlow",
      category: "relationships",
      semanticMeaning: "Discrete data transmission or message stream between computing nodes.",
      supportedProperties: ["payloadType", "schema"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 50, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["TRANSFER", "FLOW", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Data flow to ${e?.target || ""}`,
    });

    this.register({
      id: "ControlFlow",
      category: "relationships",
      semanticMeaning: "Execution transfer, call return, or algorithmic sequencing.",
      supportedProperties: ["condition", "callType"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 50, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["TRANSFER", "CONNECT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["elbowed", "curved"] },
      accessibilityLabel: (e) => `Control flow transfer to ${e?.target || ""}`,
    });

    this.register({
      id: "CausalLink",
      category: "relationships",
      semanticMeaning: "Explicit causal dependency indicating that event A caused event B.",
      supportedProperties: ["causeStatement", "consequence"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 50, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["CONNECT", "HIGHLIGHT", "PULSE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["curved", "straight"] },
      accessibilityLabel: (e) => `${e?.source || ""} causes ${e?.target || ""}`,
    });

    this.register({
      id: "SequenceLink",
      category: "relationships",
      semanticMeaning: "Strict temporal ordering connector between consecutive milestones.",
      supportedProperties: ["orderIndex", "timeDelta"],
      layoutRequirements: { preferredLayout: "sequence", minWidth: 50, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 20 }),
      animationCapabilities: ["CONNECT", "FLOW"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Sequence step ${e?.orderIndex || ""}`,
    });

    // ------------------------------------------------------------------------
    // 3. INTERACTION CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "Actor",
      category: "interaction",
      semanticMeaning: "Autonomous active participant, client, user, peer, or agent in a protocol or workflow.",
      supportedProperties: ["name", "role", "avatar", "highlight"],
      layoutRequirements: { preferredLayout: "swimlane", minWidth: 100, minHeight: 80, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(100, String(c?.name || "Actor").length * 11 + 30), height: 80 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "HIGHLIGHT", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Actor ${e?.name || e?.label || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Client",
      category: "interaction",
      semanticMeaning: "Client-side computing agent initiating requests or interactions across a boundary.",
      supportedProperties: ["name", "state", "ip", "highlight"],
      layoutRequirements: { preferredLayout: "swimlane", minWidth: 120, minHeight: 70, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(120, String(c?.name || "Client").length * 11 + 30), height: 70 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Client ${e?.name || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Server",
      category: "interaction",
      semanticMeaning: "Server-side or host computing entity processing requests and serving responses.",
      supportedProperties: ["name", "port", "state", "highlight"],
      layoutRequirements: { preferredLayout: "swimlane", minWidth: 120, minHeight: 70, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(120, String(c?.name || "Server").length * 11 + 30), height: 70 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Server ${e?.name || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Device",
      category: "interaction",
      semanticMeaning: "Hardware unit, sensor, actuator, or peripheral endpoint.",
      supportedProperties: ["deviceType", "reading", "status"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 100, minHeight: 70, resizable: true },
      dynamicSizingRules: () => ({ width: 110, height: 70 }),
      animationCapabilities: ["CREATE", "REMOVE", "PULSE", "MUTATE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Device ${e?.name || ""}`,
    });

    this.register({
      id: "Component",
      category: "interaction",
      semanticMeaning: "Modular software component, sub-routine, or service module.",
      supportedProperties: ["componentName", "version", "status"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 110, minHeight: 65, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(110, String(c?.name || "Component").length * 10), height: 65 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Component ${e?.name || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Message",
      category: "interaction",
      semanticMeaning: "Transient communication message, payload, or protocol packet in transit.",
      supportedProperties: ["payload", "messageType", "seq", "ack"],
      layoutRequirements: { preferredLayout: "sequence", minWidth: 70, minHeight: 34, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(70, String(c?.payload || c?.label || "Msg").length * 9 + 20), height: 34 }),
      animationCapabilities: ["TRANSFER", "CREATE", "REMOVE", "PULSE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Message ${e?.payload || e?.label || ""}`,
    });

    this.register({
      id: "Packet",
      category: "interaction",
      semanticMeaning: "Discrete network packet with headers, sequence numbers, and payload.",
      supportedProperties: ["seq", "ack", "flags", "payloadSize"],
      layoutRequirements: { preferredLayout: "sequence", minWidth: 80, minHeight: 36, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(80, String(c?.label || "Packet").length * 9 + 24), height: 36 }),
      animationCapabilities: ["TRANSFER", "CREATE", "REMOVE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Packet ${e?.label || ""}`,
    });

    this.register({
      id: "Request",
      category: "interaction",
      semanticMeaning: "Outbound request message seeking data or remote state mutation.",
      supportedProperties: ["method", "endpoint", "body"],
      layoutRequirements: { preferredLayout: "sequence", minWidth: 80, minHeight: 36, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(80, String(c?.method || "GET").length * 10 + 40), height: 36 }),
      animationCapabilities: ["TRANSFER", "CREATE", "REMOVE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Request ${e?.method || ""} ${e?.endpoint || ""}`,
    });

    this.register({
      id: "Response",
      category: "interaction",
      semanticMeaning: "Inbound or return message fulfilling a preceding request.",
      supportedProperties: ["statusCode", "payload"],
      layoutRequirements: { preferredLayout: "sequence", minWidth: 80, minHeight: 36, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(80, String(c?.statusCode || "200 OK").length * 9 + 30), height: 36 }),
      animationCapabilities: ["TRANSFER", "CREATE", "REMOVE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Response ${e?.statusCode || ""}`,
    });

    this.register({
      id: "Signal",
      category: "interaction",
      semanticMeaning: "Instantaneous control signal, trigger, interrupt, or pulse.",
      supportedProperties: ["signalName", "level"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 60, minHeight: 30, resizable: true },
      dynamicSizingRules: () => ({ width: 70, height: 30 }),
      animationCapabilities: ["PULSE", "CREATE", "REMOVE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Signal ${e?.signalName || ""}`,
    });

    this.register({
      id: "Event",
      category: "interaction",
      semanticMeaning: "Observable state occurrence or event notification emitted by a component.",
      supportedProperties: ["eventName", "timestamp", "payload"],
      layoutRequirements: { preferredLayout: "timeline", minWidth: 80, minHeight: 36, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(80, String(c?.eventName || "Event").length * 9 + 20), height: 36 }),
      animationCapabilities: ["CREATE", "PULSE", "REMOVE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Event ${e?.eventName || ""}`,
    });

    this.register({
      id: "Channel",
      category: "interaction",
      semanticMeaning: "Communication conduit or FIFO queue mediating communication between actors.",
      supportedProperties: ["capacity", "bufferSize"],
      layoutRequirements: { preferredLayout: "linear", minWidth: 120, minHeight: 40, resizable: true },
      dynamicSizingRules: () => ({ width: 140, height: 44 }),
      animationCapabilities: ["FLOW", "CREATE", "REMOVE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Channel ${e?.name || ""}`,
    });

    this.register({
      id: "Connection",
      category: "interaction",
      semanticMeaning: "Active session connection or socket boundary between two endpoints.",
      supportedProperties: ["status", "protocol"],
      layoutRequirements: { preferredLayout: "swimlane", minWidth: 80, minHeight: 24, resizable: true },
      dynamicSizingRules: () => ({ width: 100, height: 30 }),
      animationCapabilities: ["CONNECT", "DISCONNECT", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Connection status ${e?.status || ""}`,
    });

    this.register({
      id: "Boundary",
      category: "interaction",
      semanticMeaning: "Security boundary, network subnet boundary, or physical medium interface.",
      supportedProperties: ["boundaryName", "mediumLeft", "mediumRight"],
      layoutRequirements: { preferredLayout: "coordinate", minWidth: 200, minHeight: 2, resizable: true },
      dynamicSizingRules: () => ({ width: 280, height: 4 }),
      animationCapabilities: ["CREATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Boundary ${e?.boundaryName || ""}`,
    });

    // ------------------------------------------------------------------------
    // 4. STATE CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "State",
      category: "state",
      semanticMeaning: "Discrete state node in a finite state machine, lifecycle, or protocol.",
      supportedProperties: ["stateName", "isInitial", "isTerminal", "highlight"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 80, minHeight: 50, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(80, String(c?.stateName || c?.label || "").length * 10 + 30), height: 54 }),
      animationCapabilities: ["CREATE", "REMOVE", "STATE_CHANGE", "HIGHLIGHT", "PULSE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["curved", "straight"] },
      accessibilityLabel: (e) => `State ${e?.stateName || e?.label || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Decision",
      category: "state",
      semanticMeaning: "Conditional decision point evaluating predicates to determine alternative branch paths.",
      supportedProperties: ["condition", "selectedOutcomeId", "possibleOutcomes"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 90, minHeight: 70, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(90, String(c?.condition || "").length * 8 + 30), height: 70 }),
      animationCapabilities: ["CREATE", "REMOVE", "BRANCH", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Decision: ${e?.condition || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "ActiveState",
      category: "state",
      semanticMeaning: "Presently active, focused, or evaluating operational state.",
      supportedProperties: ["name", "timer"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 80, minHeight: 50, resizable: true },
      dynamicSizingRules: () => ({ width: 90, height: 54 }),
      animationCapabilities: ["PULSE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["curved"] },
      accessibilityLabel: (e) => `Active State: ${e?.name || ""}`,
    });

    this.register({
      id: "FailureState",
      category: "state",
      semanticMeaning: "Exceptional error, timeout, crash, or invariant breach state requiring recovery.",
      supportedProperties: ["errorReason", "recoveryTargetId"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 90, minHeight: 54, resizable: true },
      dynamicSizingRules: () => ({ width: 100, height: 56 }),
      animationCapabilities: ["CREATE", "PULSE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "curved"] },
      accessibilityLabel: (e) => `Failure: ${e?.errorReason || ""}`,
    });

    this.register({
      id: "RecoveryState",
      category: "state",
      semanticMeaning: "Restorative or compensation state reverting or repairing a prior failure.",
      supportedProperties: ["action", "restoredTargetId"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 90, minHeight: 54, resizable: true },
      dynamicSizingRules: () => ({ width: 100, height: 56 }),
      animationCapabilities: ["CREATE", "STATE_CHANGE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "curved"] },
      accessibilityLabel: (e) => `Recovery State`,
    });

    // ------------------------------------------------------------------------
    // 5. DATA CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "Table",
      category: "data",
      semanticMeaning: "Structured tabular dataset with named schema headers, columns, and rows.",
      supportedProperties: ["tableName", "headers", "rows", "highlightRowIndex"],
      layoutRequirements: { preferredLayout: "table", minWidth: 200, minHeight: 120, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(200, (c?.headers?.length || 2) * 90),
        height: Math.max(100, 40 + (c?.rows?.length || 1) * 32),
      }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Table ${e?.tableName || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Database",
      category: "data",
      semanticMeaning: "Relational, document, or key-value storage engine maintaining ACID records.",
      supportedProperties: ["dbName", "engineType", "status"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 100, minHeight: 110, resizable: true },
      dynamicSizingRules: () => ({ width: 110, height: 120 }),
      animationCapabilities: ["CREATE", "REMOVE", "PULSE", "MUTATE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Database ${e?.dbName || ""}`,
    });

    this.register({
      id: "Record",
      category: "data",
      semanticMeaning: "A single tabular record, tuple, or structured entity entry in a dataset.",
      supportedProperties: ["fields", "recordId", "highlight"],
      layoutRequirements: { preferredLayout: "table", minWidth: 160, minHeight: 36, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(160, (c?.fields ? Object.keys(c.fields).length : 2) * 80),
        height: 36,
      }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Record ${e?.recordId || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "Header",
      category: "data",
      semanticMeaning: "Schema column header or table title defining attribute names and types.",
      supportedProperties: ["title", "columns"],
      layoutRequirements: { preferredLayout: "table", minWidth: 160, minHeight: 32, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(160, (c?.columns?.length || 2) * 80),
        height: 32,
      }),
      animationCapabilities: ["CREATE", "REMOVE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Header: ${e?.title || ""}`,
    });

    this.register({
      id: "Cell",
      category: "data",
      semanticMeaning: "Individual data cell holding a single scalar value or address.",
      supportedProperties: ["value", "index", "highlight"],
      layoutRequirements: { preferredLayout: "matrix", minWidth: 50, minHeight: 40, resizable: true },
      dynamicSizingRules: () => ({ width: 56, height: 44 }),
      animationCapabilities: ["MUTATE", "HIGHLIGHT", "PULSE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Cell: ${e?.value || ""}`,
    });

    // ------------------------------------------------------------------------
    // 6. COMPUTATION CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "CallFrame",
      category: "computation",
      semanticMeaning: "Stack activation record representing an active function call, parameters, and scope.",
      supportedProperties: ["functionName", "parameters", "returnValue", "highlight"],
      layoutRequirements: { preferredLayout: "memory", minWidth: 140, minHeight: 44, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(140, String(c?.functionName || "").length * 10 + 40), height: 44 }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed", "straight"] },
      accessibilityLabel: (e) => `Call Frame: ${e?.functionName || ""}`,
      interactionBehavior: { selectable: true, inspectable: true },
    });

    this.register({
      id: "StackFrame",
      category: "computation",
      semanticMeaning: "Execution stack frame containing local variables and return address.",
      supportedProperties: ["name", "variables"],
      layoutRequirements: { preferredLayout: "memory", minWidth: 140, minHeight: 44, resizable: true },
      dynamicSizingRules: () => ({ width: 140, height: 44 }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["elbowed"] },
      accessibilityLabel: (e) => `Stack Frame: ${e?.name || ""}`,
    });

    this.register({
      id: "Process",
      category: "computation",
      semanticMeaning: "Operating system process with PID, memory address space, and state.",
      supportedProperties: ["pid", "processName", "state"],
      layoutRequirements: { preferredLayout: "dag", minWidth: 120, minHeight: 60, resizable: true },
      dynamicSizingRules: () => ({ width: 130, height: 64 }),
      animationCapabilities: ["CREATE", "REMOVE", "MOVE", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight", "elbowed"] },
      accessibilityLabel: (e) => `Process ${e?.pid || ""}: ${e?.processName || ""}`,
    });

    this.register({
      id: "Queue",
      category: "computation",
      semanticMeaning: "FIFO buffer or task queue holding jobs pending scheduling or dispatch.",
      supportedProperties: ["queueName", "length"],
      layoutRequirements: { preferredLayout: "linear", minWidth: 140, minHeight: 50, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(140, (c?.items?.length || 3) * 40), height: 50 }),
      animationCapabilities: ["CREATE", "REMOVE", "TRANSFER"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Queue ${e?.queueName || ""}`,
    });

    // ------------------------------------------------------------------------
    // 7. MEMORY CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "MemoryBlock",
      category: "memory",
      semanticMeaning: "Allocated memory chunk, heap buffer, or hardware register.",
      supportedProperties: ["address", "size", "allocated", "highlight"],
      layoutRequirements: { preferredLayout: "memory", minWidth: 120, minHeight: 46, resizable: true },
      dynamicSizingRules: () => ({ width: 130, height: 48 }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["curved", "straight"] },
      accessibilityLabel: (e) => `Memory block at ${e?.address || ""}`,
    });

    this.register({
      id: "Pointer",
      category: "memory",
      semanticMeaning: "Reference pointing to an address, node, or pivot in a data structure.",
      supportedProperties: ["name", "targetId", "color"],
      layoutRequirements: { preferredLayout: "graph", minWidth: 50, minHeight: 30, resizable: true },
      dynamicSizingRules: () => ({ width: 60, height: 32 }),
      animationCapabilities: ["MOVE", "CREATE", "REMOVE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: false, supportedRoutings: ["curved", "straight"] },
      accessibilityLabel: (e) => `Pointer ${e?.name || ""}`,
    });

    // ------------------------------------------------------------------------
    // 8. MATHEMATICS & SCIENCE CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "Equation",
      category: "mathematics",
      semanticMeaning: "Mathematical expression, equality, recurrence relation, or proof step.",
      supportedProperties: ["formula", "label", "highlightTerm"],
      layoutRequirements: { preferredLayout: "linear", minWidth: 160, minHeight: 50, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(160, String(c?.formula || "").length * 12 + 40), height: 50 }),
      animationCapabilities: ["MUTATE", "CREATE", "REMOVE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Equation: ${e?.formula || ""}`,
    });

    this.register({
      id: "Axis",
      category: "mathematics",
      semanticMeaning: "Coordinate axis with labels, scale ticks, and bounds.",
      supportedProperties: ["orientation", "range", "label"],
      layoutRequirements: { preferredLayout: "coordinate", minWidth: 200, minHeight: 20, resizable: true },
      dynamicSizingRules: () => ({ width: 240, height: 30 }),
      animationCapabilities: ["CREATE", "REMOVE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Axis ${e?.label || ""}`,
    });

    this.register({
      id: "Ray",
      category: "science",
      semanticMeaning: "Directional light ray, wave front, or particle path through media.",
      supportedProperties: ["angle", "medium", "refractionIndex"],
      layoutRequirements: { preferredLayout: "coordinate", minWidth: 80, minHeight: 40, resizable: true },
      dynamicSizingRules: () => ({ width: 120, height: 60 }),
      animationCapabilities: ["CREATE", "MOVE", "FLOW"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Ray in medium ${e?.medium || ""}`,
    });

    this.register({
      id: "Particle",
      category: "science",
      semanticMeaning: "Physical discrete particle, atom, molecule, or electron.",
      supportedProperties: ["charge", "velocity", "mass"],
      layoutRequirements: { preferredLayout: "coordinate", minWidth: 30, minHeight: 30, resizable: true },
      dynamicSizingRules: () => ({ width: 36, height: 36 }),
      animationCapabilities: ["MOVE", "CREATE", "REMOVE", "PULSE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Particle ${e?.label || ""}`,
    });

    // ------------------------------------------------------------------------
    // 9. ANNOTATION CAPABILITIES
    // ------------------------------------------------------------------------
    // ------------------------------------------------------------------------
    // 10. TIMELINE CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "Timeline",
      category: "timeline",
      semanticMeaning: "Linear chronological track representing sequence of state progressions.",
      supportedProperties: ["direction", "phases", "activeStep"],
      layoutRequirements: { preferredLayout: "timeline", minWidth: 320, minHeight: 60, resizable: true },
      dynamicSizingRules: () => ({ width: 360, height: 70 }),
      animationCapabilities: ["CREATE", "EXPAND", "FLOW"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: () => "Timeline track",
    });

    this.register({
      id: "TimelineEvent",
      category: "timeline",
      semanticMeaning: "Discrete milestone or event along a chronological timeline.",
      supportedProperties: ["time", "label", "status"],
      layoutRequirements: { preferredLayout: "timeline", minWidth: 80, minHeight: 40, resizable: true },
      dynamicSizingRules: () => ({ width: 90, height: 40 }),
      animationCapabilities: ["CREATE", "HIGHLIGHT", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: true, canBeTarget: true, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Event: ${e?.label || ""}`,
    });

    this.register({
      id: "Phase",
      category: "timeline",
      semanticMeaning: "High-level conceptual phase enclosing multiple transformation events.",
      supportedProperties: ["name", "duration", "active"],
      layoutRequirements: { preferredLayout: "timeline", minWidth: 160, minHeight: 80, resizable: true },
      dynamicSizingRules: () => ({ width: 180, height: 90 }),
      animationCapabilities: ["CREATE", "EXPAND", "COLLAPSE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Phase: ${e?.name || ""}`,
    });

    // ------------------------------------------------------------------------
    // 11. ANNOTATION CAPABILITIES
    // ------------------------------------------------------------------------
    this.register({
      id: "Callout",
      category: "annotation",
      semanticMeaning: "Prominent pedagogical callout highlighting what changed, why, and what to notice.",
      supportedProperties: ["title", "text", "role", "highlight"],
      layoutRequirements: { preferredLayout: "hybrid", minWidth: 160, minHeight: 60, resizable: true },
      dynamicSizingRules: (c) => ({
        width: Math.max(160, Math.min(260, String(c?.text || "").length * 7 + 40)),
        height: Math.max(60, Math.ceil(String(c?.text || "").length / 32) * 22 + 36),
      }),
      animationCapabilities: ["CREATE", "REMOVE", "MUTATE", "HIGHLIGHT"],
      connectorCapabilities: { canBeSource: true, canBeTarget: false, supportedRoutings: ["straight"] },
      accessibilityLabel: (e) => `Note: ${e?.text || ""}`,
    });

    this.register({
      id: "Badge",
      category: "annotation",
      semanticMeaning: "Compact status or invariant verification badge attached to an entity.",
      supportedProperties: ["text", "color", "variant"],
      layoutRequirements: { preferredLayout: "hybrid", minWidth: 60, minHeight: 26, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(60, String(c?.text || "").length * 8 + 20), height: 26 }),
      animationCapabilities: ["CREATE", "REMOVE", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Badge: ${e?.text || ""}`,
    });

    this.register({
      id: "InvariantBadge",
      category: "annotation",
      semanticMeaning: "Verified executable correctness badge confirming invariant satisfaction.",
      supportedProperties: ["statement", "satisfied"],
      layoutRequirements: { preferredLayout: "hybrid", minWidth: 90, minHeight: 28, resizable: true },
      dynamicSizingRules: (c) => ({ width: Math.max(90, String(c?.statement || "").length * 8 + 24), height: 28 }),
      animationCapabilities: ["CREATE", "PULSE", "STATE_CHANGE"],
      connectorCapabilities: { canBeSource: false, canBeTarget: false, supportedRoutings: [] },
      accessibilityLabel: (e) => `Invariant: ${e?.statement || ""}`,
    });
  }
}

/** Global singleton accessor */
export const visualCapabilities = VisualCapabilityRegistry.getInstance();
