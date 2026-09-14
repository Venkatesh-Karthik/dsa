/**
 * Semantic Grammar Resolver
 *
 * Inspects a SemanticWorld (its entities, relationships, roles, and concept metadata)
 * and resolves the optimal visual grammar and layout strategy.
 *
 * Supported Grammars:
 * - TreeGrammar: Hierarchical trees (BST, AVL, Trie, Heaps)
 * - GraphGrammar: General network topologies, cyclic or acyclic graphs
 * - ArrayGrammar: Indexed sequential collections (arrays, vectors, buffers)
 * - LinkedListGrammar: Singly and doubly linked pointer structures
 * - StackGrammar: LIFO stacks, execution call frames
 * - QueueGrammar: FIFO queues, message queues, buffers
 * - InteractionGrammar: Distributed 2-party/multi-party protocols (TCP, HTTP, client/server)
 * - StateMachineGrammar: Automata, DFA, NFA, lifecycle state transitions
 * - ProcessGrammar: Execution pipelines, CPU scheduling, stages, workflows
 * - DatabaseGrammar: Relational tables, columns, rows, schemas, transactions
 * - MemoryGrammar: Memory blocks, addresses, heap/stack allocation
 * - TimelineGrammar: Chronological stages, historical phases, versioning
 * - MathematicalGrammar: Matrices, equations, formula derivations
 * - CompositeGrammar: Heterogeneous multi-container systems (e.g. HashMap, LRU Cache)
 * - GenericConceptGrammar: Universal fallback for arbitrary domains (Biology, Physics, Economics, etc.)
 */

import type { SemanticWorld } from "../semantic-world";

export type GrammarType =
  | "TreeGrammar"
  | "GraphGrammar"
  | "ArrayGrammar"
  | "LinkedListGrammar"
  | "StackGrammar"
  | "QueueGrammar"
  | "InteractionGrammar"
  | "StateMachineGrammar"
  | "ProcessGrammar"
  | "DatabaseGrammar"
  | "MemoryGrammar"
  | "TimelineGrammar"
  | "MathematicalGrammar"
  | "CompositeGrammar"
  | "GenericConceptGrammar";

export type LayoutStrategy =
  | "tree"
  | "graph"
  | "array"
  | "linked-list"
  | "stack"
  | "queue"
  | "two-party"
  | "pipeline"
  | "cycle"
  | "dag"
  | "grid"
  | "composite";

export interface ResolvedGrammar {
  type: GrammarType;
  confidence: number;
  layoutStrategy: LayoutStrategy;
  primaryEntities: string[];
  containerRole?: string;
  reason: string;
  isCodeRelevant: boolean;
}

export function resolveSemanticGrammar(
  world: SemanticWorld,
  conceptName?: string,
  userIntent?: string,
): ResolvedGrammar {
  const concept = (conceptName || "").toLowerCase();
  const intent = (userIntent || "").toLowerCase();
  const entities = world.entities || [];
  const relationships = world.relationships || [];

  const entityTypes = new Set(
    entities.map((e) => (e.type || "").toLowerCase()),
  );
  const entityRoles = new Set(
    entities.map((e) => (e.semanticRole || "").toLowerCase()),
  );
  const relTypes = new Set(
    relationships.map((r) => (r.type || "").toLowerCase()),
  );

  // 1. Check for Composite Multi-Container Systems
  const hasMultipleContainers =
    [
      entityTypes.has("arraycell"),
      entityTypes.has("linkedlistnode"),
      entityTypes.has("treenode"),
      entityTypes.has("stackframe"),
    ].filter(Boolean).length >= 2;

  if (
    hasMultipleContainers ||
    concept.includes("lru cache") ||
    concept.includes("hash map") ||
    concept.includes("hash table")
  ) {
    return {
      type: "CompositeGrammar",
      confidence: 0.95,
      layoutStrategy: "composite",
      primaryEntities: entities.map((e) => e.id),
      reason:
        "Detected heterogeneous multi-container data structures (Composite)",
      isCodeRelevant: true,
    };
  }

  // 2. Check for Interaction / Protocol / Client-Server (Networking / Distributed)
  const isClientServerEntities =
    entities.some((e) => {
      const s = (e.label || e.id).toLowerCase();
      return s.includes("client") || s.includes("sender");
    }) &&
    entities.some((e) => {
      const s = (e.label || e.id).toLowerCase();
      return s.includes("server") || s.includes("receiver");
    });

  const isProtocolConcept =
    concept.includes("tcp") ||
    concept.includes("handshake") ||
    concept.includes("http") ||
    concept.includes("protocol") ||
    concept.includes("client-server") ||
    concept.includes("websocket") ||
    concept.includes("rpc") ||
    concept.includes("dns");

  if (isClientServerEntities || isProtocolConcept) {
    return {
      type: "InteractionGrammar",
      confidence: isClientServerEntities ? 0.96 : 0.88,
      layoutStrategy: "two-party",
      primaryEntities: entities.map((e) => e.id),
      reason:
        "Identified two-party protocol or client-server interaction model",
      isCodeRelevant: false, // Network protocols are conceptually diagrams/packets, code is secondary
    };
  }

  // 3. Check for Tree Structures
  const isTreeEntities =
    entityTypes.has("treenode") ||
    entityRoles.has("root") ||
    relTypes.has("leftof") ||
    relTypes.has("rightof") ||
    relTypes.has("parentof");

  const isTreeConcept =
    concept.includes("tree") ||
    concept.includes("bst") ||
    concept.includes("avl") ||
    concept.includes("trie") ||
    concept.includes("heap") ||
    concept.includes("b-tree") ||
    concept.includes("red-black");

  if (isTreeEntities || isTreeConcept) {
    return {
      type: "TreeGrammar",
      confidence: isTreeEntities ? 0.98 : 0.85,
      layoutStrategy: "tree",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified hierarchical tree topology or tree concept keywords",
      isCodeRelevant: true,
    };
  }

  // 4. Check for Linked List Structures
  const isLinkedListEntities =
    entityTypes.has("linkedlistnode") ||
    (relTypes.has("next") &&
      (relTypes.has("previous") || relTypes.has("prev"))) ||
    entityRoles.has("head") ||
    entityRoles.has("tail");

  const isLinkedListConcept =
    concept.includes("linked list") ||
    concept.includes("linkedlist") ||
    concept.includes("doubly linked") ||
    concept.includes("singly linked") ||
    concept.includes("dll") ||
    concept.includes("sll");

  if (isLinkedListEntities || isLinkedListConcept) {
    return {
      type: "LinkedListGrammar",
      confidence: isLinkedListEntities ? 0.98 : 0.88,
      layoutStrategy: "linked-list",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified sequential node-pointer chain structure",
      isCodeRelevant: true,
    };
  }

  // 5. Check for Stack Structures
  const isStackEntities =
    entityTypes.has("stackframe") ||
    entityRoles.has("top") ||
    entityRoles.has("stack-frame");

  const isStackConcept =
    concept.includes("stack") ||
    concept.includes("call stack") ||
    concept.includes("lifo") ||
    concept.includes("recursion stack");

  if (isStackEntities || isStackConcept) {
    return {
      type: "StackGrammar",
      confidence: isStackEntities ? 0.96 : 0.86,
      layoutStrategy: "stack",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified LIFO stack structure or frame hierarchy",
      isCodeRelevant: true,
    };
  }

  // 6. Check for Queue Structures
  const isQueueEntities =
    entityTypes.has("queueelement") ||
    entityRoles.has("front") ||
    entityRoles.has("back");

  const isQueueConcept =
    concept.includes("queue") ||
    concept.includes("fifo") ||
    concept.includes("message queue") ||
    concept.includes("priority queue");

  if (isQueueEntities || isQueueConcept) {
    return {
      type: "QueueGrammar",
      confidence: isQueueEntities ? 0.96 : 0.86,
      layoutStrategy: "queue",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified FIFO queue structure",
      isCodeRelevant: true,
    };
  }

  // 7. Check for Array Structures
  const isArrayEntities =
    entityTypes.has("arraycell") ||
    (entities.length > 0 &&
      entities.every((e) => e.properties && e.properties.index !== undefined));

  const isArrayConcept =
    concept.includes("array") ||
    concept.includes("binary search") ||
    concept.includes("two pointer") ||
    concept.includes("sliding window") ||
    concept.includes("sorting") ||
    concept.includes("quicksort") ||
    concept.includes("mergesort");

  if (isArrayEntities || isArrayConcept) {
    return {
      type: "ArrayGrammar",
      confidence: isArrayEntities ? 0.96 : 0.85,
      layoutStrategy: "array",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified indexed sequence or array algorithm",
      isCodeRelevant: true,
    };
  }

  // 8. Check for Database Structures
  const isDatabaseEntities =
    entityTypes.has("table") ||
    entityTypes.has("record") ||
    entityTypes.has("row") ||
    entityRoles.has("table") ||
    entityRoles.has("transaction");

  const isDatabaseConcept =
    concept.includes("database") ||
    concept.includes("sql") ||
    concept.includes("acid") ||
    concept.includes("transaction") ||
    concept.includes("rdbms") ||
    concept.includes("schema") ||
    concept.includes("relational");

  if (isDatabaseEntities || isDatabaseConcept) {
    return {
      type: "DatabaseGrammar",
      confidence: isDatabaseEntities ? 0.95 : 0.86,
      layoutStrategy: "grid",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified relational schema, table, or transaction structure",
      isCodeRelevant: concept.includes("sql") || concept.includes("query"),
    };
  }

  // 9. Check for State Machine Structures
  const isStateMachineEntities =
    entityRoles.has("state_node") ||
    relTypes.has("transitions_to") ||
    entities.some(
      (e) => e.state !== undefined && e.type.toLowerCase().includes("state"),
    );

  const isStateMachineConcept =
    concept.includes("state machine") ||
    concept.includes("automata") ||
    concept.includes("dfa") ||
    concept.includes("nfa") ||
    concept.includes("fsm") ||
    concept.includes("lifecycle");

  if (isStateMachineEntities || isStateMachineConcept) {
    return {
      type: "StateMachineGrammar",
      confidence: isStateMachineEntities ? 0.95 : 0.86,
      layoutStrategy: "dag",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified state transitions and finite state topology",
      isCodeRelevant: false,
    };
  }

  // 10. Check for Process / Pipeline Structures (CPU Scheduling, CI/CD, Workflows)
  const isProcessEntities =
    entityTypes.has("process") ||
    entityTypes.has("stage") ||
    entityRoles.has("process");

  const isProcessConcept =
    concept.includes("cpu") ||
    concept.includes("scheduling") ||
    concept.includes("round robin") ||
    concept.includes("pipeline") ||
    concept.includes("workflow") ||
    concept.includes("assembly line");

  if (isProcessEntities || isProcessConcept) {
    return {
      type: "ProcessGrammar",
      confidence: isProcessEntities ? 0.94 : 0.85,
      layoutStrategy: "pipeline",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified execution stages or scheduled process pipeline",
      isCodeRelevant: concept.includes("cpu") || concept.includes("scheduler"),
    };
  }

  // 11. Check for Memory Structures
  const isMemoryConcept =
    concept.includes("memory") ||
    concept.includes("paging") ||
    concept.includes("virtual memory") ||
    concept.includes("heap allocation") ||
    concept.includes("buffer overflow");

  if (isMemoryConcept) {
    return {
      type: "MemoryGrammar",
      confidence: 0.88,
      layoutStrategy: "stack",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified memory address space and allocation blocks",
      isCodeRelevant: true,
    };
  }

  // 12. Check for Timeline / Historical Structures
  const isTimelineConcept =
    concept.includes("timeline") ||
    concept.includes("history") ||
    concept.includes("evolution") ||
    concept.includes("chronology");

  if (isTimelineConcept) {
    return {
      type: "TimelineGrammar",
      confidence: 0.88,
      layoutStrategy: "pipeline",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified chronological or phase-based sequence",
      isCodeRelevant: false,
    };
  }

  // 13. Check for Mathematical / Matrix Structures
  const isMathConcept =
    concept.includes("matrix") ||
    concept.includes("vector") ||
    concept.includes("equation") ||
    concept.includes("formula") ||
    concept.includes("calculus") ||
    concept.includes("linear algebra");

  if (isMathConcept) {
    return {
      type: "MathematicalGrammar",
      confidence: 0.88,
      layoutStrategy: "grid",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified mathematical matrices, equations, or vectors",
      isCodeRelevant: false,
    };
  }

  // 14. Check for Closed Cycles in Generic Concepts (e.g. Refrigerator cycle, Krebs cycle)
  const inDegrees = new Map<string, number>();
  const outDegrees = new Map<string, number>();
  for (const ent of entities) {
    inDegrees.set(ent.id, 0);
    outDegrees.set(ent.id, 0);
  }
  for (const rel of relationships) {
    inDegrees.set(rel.target, (inDegrees.get(rel.target) ?? 0) + 1);
    outDegrees.set(rel.source, (outDegrees.get(rel.source) ?? 0) + 1);
  }

  const isCycle =
    entities.length >= 3 &&
    entities.length <= 8 &&
    Array.from(inDegrees.values()).every((d) => d >= 1) &&
    Array.from(outDegrees.values()).every((d) => d >= 1);

  // 15. Check for Graph Structures
  const isGraphEntities = entityTypes.has("graphnode");

  const isGraphConcept =
    concept.includes("graph") ||
    concept.includes("dijkstra") ||
    concept.includes("bfs") ||
    concept.includes("dfs") ||
    concept.includes("shortest path") ||
    concept.includes("topological");

  if (!isCycle && (isGraphEntities || isGraphConcept)) {
    return {
      type: "GraphGrammar",
      confidence: isGraphEntities ? 0.94 : 0.85,
      layoutStrategy: "graph",
      primaryEntities: entities.map((e) => e.id),
      reason: "Identified general graph network with nodes and edges",
      isCodeRelevant: true,
    };
  }

  // Determine if domain is code-relevant
  const nonCodeDomains = [
    "biology",
    "photosynthesis",
    "cell",
    "physics",
    "gravity",
    "thermodynamics",
    "refrigeration",
    "refrigerator",
    "chemistry",
    "molecule",
    "history",
    "economics",
    "inflation",
    "ecology",
  ];
  const isExplicitlyNonCode = nonCodeDomains.some((d) => concept.includes(d));

  // 16. Universal Fallback: GenericConceptGrammar
  return {
    type: "GenericConceptGrammar",
    confidence: 0.8,
    layoutStrategy: isCycle
      ? "cycle"
      : relationships.length > 0
      ? "dag"
      : "pipeline",
    primaryEntities: entities.map((e) => e.id),
    reason: isCycle
      ? "Generic concept forming a closed thermodynamic or metabolic loop (Cycle Layout)"
      : "Generic concept represented through causal connections and pipeline stages",
    isCodeRelevant: !isExplicitlyNonCode,
  };
}
