/**
 * Cognora DSA Acceleration Layer - Graph Domain Engines
 *
 * Implements deterministic graph algorithm execution sharing a unified graph semantic model:
 * 1. Dijkstra's Algorithm (Tentative distance table, min-vertex selection, edge relaxations, shortest paths)
 * 2. Bellman-Ford (|V|-1 passes, edge relaxations, negative cycle detection)
 * 3. BFS (Queue-based layer traversal, visited set, neighbor enqueuing)
 * 4. DFS (Recursion/call stack, edge traversal, backtracking)
 * 5. Topological Sort (In-degrees, zero in-degree queue, DAG ordering)
 * 6. Prim MST (Cut-property, candidate edges, minimum connecting edge)
 * 7. Kruskal MST (Sorted edges, DSU find/union, cycle check)
 * 8. Floyd-Warshall (All-pairs distance matrix with intermediate vertex k)
 */

import type { DSAConceptEngine, DSAExecutionResult, DSAValidationResult } from "../types/dsa-engine";
import type { DSASemanticEntity, DSASemanticRelationship, DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAInputLimits } from "../types/dsa-concept";
import { DSAStateIntegrityValidator } from "../validation/state-integrity-validator";
import { getDefaultDataset } from "../datasets/default-datasets";
import type { ExtractedGraph, ExtractedGraphEdge } from "../parsing/input-extractor";

interface InternalGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string; weight: number }>;
  source: string;
  destination?: string;
}

const PROHIBITED_GRAPH_NODES = new Set<string>([
  "BELLMAN", "FORD", "CYCLE", "NEGATIVE", "STEP", "GRAPH", "PATH", "ALGORITHM",
  "FINI", "FINITE", "CHECK", "EDGE", "EDGES", "VERTEX", "VERTICES", "UPDATE",
  "DIST", "DISTANCE", "USING", "SHOW", "WITH", "GIVE", "EACH", "FINAL", "CODE",
  "FIND", "WHAT", "WHY", "EXPLAIN", "RELAXATION"
]);

function resolveGraphInput(
  conceptId: "dijkstra" | "bellman-ford" | "bfs" | "dfs" | "topological-sort" | "prim" | "kruskal" | "floyd-warshall",
  input?: { graph?: ExtractedGraph },
): InternalGraph {
  if (input?.graph && input.graph.edges.length > 0) {
    const validNodes = input.graph.nodes
      .map((n) => n.id.trim())
      .filter(
        (id) =>
          id.length > 0 &&
          id.length <= 4 &&
          !PROHIBITED_GRAPH_NODES.has(id.toUpperCase()),
      );
    const validNodeSet = new Set(validNodes);

    const validEdges = input.graph.edges
      .filter((e) => validNodeSet.has(e.from) && validNodeSet.has(e.to))
      .map((e) => ({
        from: e.from,
        to: e.to,
        weight: e.weight !== undefined ? e.weight : 1,
      }));

    if (validNodes.length >= 2 && validEdges.length > 0) {
      const source =
        input.graph.source && validNodeSet.has(input.graph.source)
          ? input.graph.source
          : validNodes[0];
      const destination =
        input.graph.destination && validNodeSet.has(input.graph.destination)
          ? input.graph.destination
          : undefined;

      return {
        nodes: validNodes,
        edges: validEdges,
        source,
        destination,
      };
    }
  }

  const defaultData = getDefaultDataset(conceptId);
  const defNodes = defaultData.graph?.nodes.map((n) => n.id) || ["A", "B", "C", "D"];
  const defEdges = defaultData.graph?.edges.map((e) => ({
    from: e.from,
    to: e.to,
    weight: e.weight !== undefined ? e.weight : 1,
  })) || [{ from: "A", to: "B", weight: 1 }];

  return {
    nodes: defNodes,
    edges: defEdges,
    source: defaultData.graph?.source || defNodes[0],
    destination: defaultData.graph?.destination,
  };
}

function snapshotGraphToState(
  graph: InternalGraph,
  version: number,
  title: string,
  nodeStatuses: Record<string, "default" | "active" | "visited" | "found" | "highlighted">,
  edgeStatuses: Record<string, "default" | "active" | "highlighted" | "relaxed">,
  distances?: Record<string, number>,
  tableRows?: string[][],
): DSASemanticState {
  const entities = new Map<string, DSASemanticEntity>();
  const relationships: DSASemanticRelationship[] = [];

  for (const n of graph.nodes) {
    const id = `node-${n}`;
    const dist = distances ? distances[n] : undefined;
    const label = dist !== undefined ? (dist === Infinity ? `${n} (∞)` : `${n} (${dist})`) : n;

    entities.set(id, {
      id,
      type: "GraphNode",
      label,
      value: dist,
      role: n === graph.source ? "primary" : "element",
      status: nodeStatuses[n] || "default",
      properties: {
        distance: dist,
      },
    });
  }

  for (const e of graph.edges) {
    const edgeId = `edge-${e.from}-${e.to}`;
    const status = edgeStatuses[edgeId] || "default";

    relationships.push({
      id: edgeId,
      sourceId: `node-${e.from}`,
      targetId: `node-${e.to}`,
      type: "edge",
      label: e.weight !== 1 ? `${e.weight}` : undefined,
      weight: e.weight,
      directed: true,
      status,
    });
  }

  // Supporting distance table if applicable
  if (tableRows && tableRows.length > 0) {
    entities.set("table-distance", {
      id: "table-distance",
      type: "Table",
      label: "Distance Table",
      role: "auxiliary",
      status: "default",
      properties: {
        columns: ["Vertex", "Distance", "Predecessor"],
        rows: tableRows,
      },
    });
  }

  return {
    version,
    title,
    entities,
    relationships,
    metadata: {
      source: graph.source,
      destination: graph.destination,
      distances,
    },
  };
}

// ============================================================================
// 1. Dijkstra's Shortest Path Engine
// ============================================================================
export class DijkstraEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "dijkstra";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(
    input: { graph?: ExtractedGraph },
    limits?: DSAInputLimits,
  ): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("dijkstra", input);
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const visited = new Set<string>();

    for (const n of g.nodes) {
      dist[n] = Infinity;
      prev[n] = null;
    }

    const nodeStatuses: Record<string, "default" | "active" | "visited" | "found" | "highlighted"> = {};
    const edgeStatuses: Record<string, "default" | "active" | "highlighted" | "relaxed"> = {};

    const buildTableRows = (): string[][] => {
      return g.nodes.map((n) => [
        n,
        dist[n] === Infinity ? "∞" : `${dist[n]}`,
        prev[n] || "-",
      ]);
    };

    // State 0: Baseline - All distances Infinity
    this.states.push(
      snapshotGraphToState(
        g,
        0,
        "Initial Graph (All Distances = ∞)",
        nodeStatuses,
        edgeStatuses,
        { ...dist },
        buildTableRows(),
      ),
    );

    // Step 1: Initialize source at distance 0
    dist[g.source] = 0;
    nodeStatuses[g.source] = "default";
    const s1Prev = this.states.length - 1;
    this.states.push(
      snapshotGraphToState(
        g,
        this.states.length,
        `Initialize Source ${g.source} (dist = 0)`,
        nodeStatuses,
        edgeStatuses,
        { ...dist },
        buildTableRows(),
      ),
    );

    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "UPDATE_DISTANCE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: s1Prev,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: [`node-${g.source}`, "table-distance"],
      affectedRelationshipIds: [],
      semanticFocus: { entityIds: [`node-${g.source}`], label: `Source ${g.source}: 0` },
      whatHappened: `Set source vertex ${g.source} distance to 0.`,
      reason: `Starting point has a path length of zero to itself.`,
      consequence: `Vertex ${g.source} is the initial candidate with minimum distance.`,
      title: `Initialize Source ${g.source}`,
      explanation: `Dijkstra begins by assigning distance 0 to source vertex ${g.source} and ∞ to all other vertices.`,
      isStateChange: true,
      importance: "HIGH",
    });

    // Dijkstra Loop: Select min unvisited vertex
    while (visited.size < g.nodes.length) {
      let u: string | null = null;
      let minD = Infinity;

      for (const n of g.nodes) {
        if (!visited.has(n) && dist[n] < minD) {
          minD = dist[n];
          u = n;
        }
      }

      if (u === null || minD === Infinity) {
        break; // Unreachable remaining vertices
      }

      visited.add(u);
      nodeStatuses[u] = "active";

      // Select Min Vertex Step
      const selPrev = this.states.length - 1;
      this.states.push(
        snapshotGraphToState(
          g,
          this.states.length,
          `Select Min Vertex ${u} (dist = ${minD})`,
          nodeStatuses,
          edgeStatuses,
          { ...dist },
          buildTableRows(),
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "VISIT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: selPrev,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${u}`],
        affectedRelationshipIds: [],
        semanticFocus: { entityIds: [`node-${u}`], label: `Selected Min ${u}` },
        whatHappened: `Select unvisited vertex ${u} with minimum distance ${minD}.`,
        reason: `Greedy choice property: Shortest path to ${u} is now finalized.`,
        consequence: `We will now relax all outgoing edges from ${u}.`,
        title: `Select Min Vertex ${u}`,
        explanation: `Vertex ${u} has the smallest tentative distance among unvisited nodes. Its distance is now locked.`,
        isStateChange: true,
      });

      // Relax outgoing edges from u
      const outgoing = g.edges.filter((e) => e.from === u);
      for (const edge of outgoing) {
        const v = edge.to;
        const edgeId = `edge-${edge.from}-${edge.to}`;
        if (!visited.has(v)) {
          const newDist = dist[u] + edge.weight;
          if (newDist < dist[v]) {
            const oldDist = dist[v];
            dist[v] = newDist;
            prev[v] = u;
            edgeStatuses[edgeId] = "relaxed";

            const relaxPrev = this.states.length - 1;
            this.states.push(
              snapshotGraphToState(
                g,
                this.states.length,
                `Relax Edge ${u} → ${v} (${oldDist === Infinity ? "∞" : oldDist} → ${newDist})`,
                nodeStatuses,
                edgeStatuses,
                { ...dist },
                buildTableRows(),
              ),
            );

            this.transformations.push({
              id: `t-${this.transformations.length + 1}`,
              type: "RELAX_EDGE",
              stepNumber: this.transformations.length + 1,
              beforeStateIndex: relaxPrev,
              afterStateIndex: this.states.length - 1,
              affectedEntityIds: [`node-${v}`, "table-distance"],
              affectedRelationshipIds: [edgeId],
              semanticFocus: { relationshipIds: [edgeId], label: `Relax ${u} → ${v}` },
              whatHappened: `Relax edge ${u} → ${v}: distance updated from ${oldDist === Infinity ? "∞" : oldDist} to ${newDist}.`,
              reason: `dist[${u}] (${minD}) + weight (${edge.weight}) = ${newDist} < current dist[${v}].`,
              consequence: `Distance table updated: ${v} tentative distance is now ${newDist}. Predecessor set to ${u}.`,
              title: `Relax Edge ${u} → ${v}`,
              explanation: `A shorter path to ${v} was discovered through ${u}. We update the distance table and record ${u} as predecessor.`,
              isStateChange: true,
            });
          }
        }
      }

      nodeStatuses[u] = "visited";
    }

    // Final Shortest Path Highlight
    if (g.destination && dist[g.destination] !== Infinity) {
      let curr: string | null = g.destination;
      while (curr && prev[curr]) {
        const p = prev[curr]!;
        edgeStatuses[`edge-${p}-${curr}`] = "highlighted";
        nodeStatuses[curr] = "found";
        curr = p;
      }
      if (curr) nodeStatuses[curr] = "found";
    }

    const finPrev = this.states.length - 1;
    this.states.push(
      snapshotGraphToState(
        g,
        this.states.length,
        "Final Shortest Paths",
        nodeStatuses,
        edgeStatuses,
        { ...dist },
        buildTableRows(),
      ),
    );

    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "FINAL_STATE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: finPrev,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: Array.from(this.states[finPrev].entities.keys()),
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: g.destination ? [`node-${g.destination}`] : [`node-${g.source}`],
        label: "Shortest Paths Complete",
      },
      whatHappened: `All reachable vertices finalized with true shortest paths from ${g.source}.`,
      reason: `No unvisited reachable vertices remain.`,
      consequence: `Final shortest path distances displayed in distance table.`,
      title: "Shortest Paths Complete",
      explanation: `Dijkstra's algorithm terminates. All shortest paths and distances from ${g.source} have been derived deterministically.`,
      isStateChange: false,
      importance: "HIGH",
    });

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
      metadata: {
        distances: dist,
        predecessors: prev,
      },
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 2. Bellman-Ford Algorithm Engine
// ============================================================================
export class BellmanFordEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "bellman-ford";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(
    input: { graph?: ExtractedGraph },
    limits?: DSAInputLimits,
  ): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("bellman-ford", input);
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};

    for (const n of g.nodes) {
      dist[n] = Infinity;
      prev[n] = null;
    }
    dist[g.source] = 0;

    const buildTableRows = (): string[][] => {
      return g.nodes.map((n) => [
        n,
        dist[n] === Infinity ? "∞" : `${dist[n]}`,
        prev[n] || "-",
      ]);
    };

    // State 0: Initialization
    this.states.push(
      snapshotGraphToState(
        g,
        0,
        `Bellman-Ford Initialization (source = ${g.source})`,
        { [g.source]: "active" },
        {},
        { ...dist },
        buildTableRows(),
      ),
    );

    const V = g.nodes.length;
    let hasNegativeCycle = false;

    // |V|-1 Relaxation passes
    for (let pass = 1; pass <= V - 1; pass++) {
      let anyUpdate = false;
      const passPrev = this.states.length - 1;

      for (const e of g.edges) {
        if (dist[e.from] !== Infinity && dist[e.from] + e.weight < dist[e.to]) {
          dist[e.to] = dist[e.from] + e.weight;
          prev[e.to] = e.from;
          anyUpdate = true;
        }
      }

      this.states.push(
        snapshotGraphToState(
          g,
          this.states.length,
          `Pass ${pass} of ${V - 1}`,
          {},
          {},
          { ...dist },
          buildTableRows(),
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "RELAX_EDGE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: passPrev,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: ["table-distance"],
        affectedRelationshipIds: [],
        semanticFocus: { label: `Pass ${pass}` },
        whatHappened: `Completed relaxation pass ${pass} of ${V - 1}.`,
        reason: `In pass ${pass}, shortest paths of up to ${pass} edges are established.`,
        consequence: anyUpdate ? `Distances updated.` : `Distances converged early.`,
        title: `Relaxation Pass ${pass}`,
        explanation: `We relax all edges in the graph. After pass ${pass}, shortest paths using at most ${pass} edges are guaranteed accurate.`,
        isStateChange: anyUpdate,
      });

      if (!anyUpdate) {
        break; // Early convergence
      }
    }

    // Final Negative Cycle Check Pass
    for (const e of g.edges) {
      if (dist[e.from] !== Infinity && dist[e.from] + e.weight < dist[e.to]) {
        hasNegativeCycle = true;
        break;
      }
    }

    const lastPrev = this.states.length - 1;
    this.states.push(
      snapshotGraphToState(
        g,
        this.states.length,
        hasNegativeCycle ? "Negative Cycle Detected!" : "No Negative Cycles - Final Shortest Distances",
        {},
        {},
        { ...dist },
        buildTableRows(),
      ),
    );

    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "FINAL_STATE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: lastPrev,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: [],
      affectedRelationshipIds: [],
      semanticFocus: { label: hasNegativeCycle ? "Negative Cycle" : "Bellman-Ford Verified" },
      whatHappened: hasNegativeCycle
        ? "Negative cycle detected in the graph!"
        : "Final pass verified: No reachable negative cycles detected.",
      reason: hasNegativeCycle
        ? "Distances continue to decrease on the V-th pass."
        : "No edge can be relaxed further after V-1 passes.",
      consequence: hasNegativeCycle
        ? "Shortest paths are undefined due to negative cycle."
        : "All shortest paths are mathematically optimal.",
      title: hasNegativeCycle ? "Negative Cycle Detected" : "Negative Cycle Check: Verified",
      explanation: hasNegativeCycle
        ? "The V-th pass revealed an edge whose distance can still decrease, proving a reachable negative-weight cycle exists."
        : "The V-th pass confirms convergence. No negative cycles exist and all distances are verified optimal.",
      isStateChange: false,
      importance: "HIGH",
    });

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
      metadata: { hasNegativeCycle, distances: dist },
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 3. Breadth-First Search (BFS) Engine
// ============================================================================
export class BFSEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "bfs";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(input: { graph?: ExtractedGraph }): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("bfs", input);
    const visited = new Set<string>();
    const queue: string[] = [g.source];
    visited.add(g.source);

    const nodeStatuses: Record<string, "default" | "active" | "visited"> = { [g.source]: "active" };
    const edgeStatuses: Record<string, "default" | "active" | "relaxed"> = {};

    this.states.push(snapshotGraphToState(g, 0, `BFS Start at ${g.source}`, nodeStatuses, edgeStatuses));

    while (queue.length > 0) {
      const u = queue.shift()!;
      nodeStatuses[u] = "visited";
      const pIdx = this.states.length - 1;

      // Find unvisited neighbors
      const neighbors = g.edges
        .filter((e) => e.from === u)
        .map((e) => e.to)
        .filter((v) => !visited.has(v));

      for (const v of neighbors) {
        visited.add(v);
        queue.push(v);
        nodeStatuses[v] = "active";
        edgeStatuses[`edge-${u}-${v}`] = "relaxed";
      }

      const nextState = snapshotGraphToState(
        g,
        this.states.length,
        `Dequeue ${u} & Enqueue [${neighbors.join(", ")}]`,
        nodeStatuses,
        edgeStatuses,
      );
      this.states.push(nextState);

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "DEQUEUE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: pIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${u}`, ...neighbors.map((n) => `node-${n}`)],
        affectedRelationshipIds: neighbors.map((n) => `edge-${u}-${n}`),
        semanticFocus: { entityIds: [`node-${u}`], label: `Visit ${u}` },
        whatHappened: `Visit ${u} and discover neighbors [${neighbors.join(", ")}].`,
        reason: `FIFO queue orders exploration by unweighted distance from ${g.source}.`,
        consequence: `Queue now contains: [${queue.join(", ")}].`,
        title: `BFS Visit ${u}`,
        explanation: `We dequeue ${u}, mark it visited, and enqueue all undiscovered neighbors into the FIFO queue.`,
        isStateChange: true,
      });
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 4. Depth-First Search (DFS) Engine
// ============================================================================
export class DFSEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "dfs";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(input: { graph?: ExtractedGraph }): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("dfs", input);
    const visited = new Set<string>();
    const nodeStatuses: Record<string, "default" | "active" | "visited"> = {};
    const edgeStatuses: Record<string, "default" | "active" | "relaxed"> = {};

    this.states.push(snapshotGraphToState(g, 0, `DFS Start at ${g.source}`, nodeStatuses, edgeStatuses));

    const dfs = (u: string, parent?: string) => {
      visited.add(u);
      nodeStatuses[u] = "active";
      if (parent) edgeStatuses[`edge-${parent}-${u}`] = "relaxed";

      const pBefore = this.states.length - 1;
      this.states.push(snapshotGraphToState(g, this.states.length, `DFS Visit ${u}`, nodeStatuses, edgeStatuses));

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "VISIT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: pBefore,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${u}`],
        affectedRelationshipIds: parent ? [`edge-${parent}-${u}`] : [],
        semanticFocus: { entityIds: [`node-${u}`], label: `DFS ${u}` },
        whatHappened: `Traverse deeply to vertex ${u}.`,
        reason: `DFS explores deep branches before backtracking.`,
        consequence: `Vertex ${u} pushed onto call stack.`,
        title: `DFS Visit ${u} (Descend)`,
        explanation: `We move deep along the active edge to ${u} and add a new call stack frame.`,
        isStateChange: true,
      });

      const neighbors = g.edges.filter((e) => e.from === u).map((e) => e.to);
      for (const v of neighbors) {
        if (!visited.has(v)) {
          dfs(v, u);
        }
      }

      nodeStatuses[u] = "visited";
    };

    dfs(g.source);

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 5. Topological Sort Engine (Kahn's Algorithm)
// ============================================================================
export class TopologicalSortEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "topological-sort";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(input: { graph?: ExtractedGraph }): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("topological-sort", input);
    const inDegree: Record<string, number> = {};
    for (const n of g.nodes) inDegree[n] = 0;
    for (const e of g.edges) inDegree[e.to] = (inDegree[e.to] || 0) + 1;

    const queue: string[] = g.nodes.filter((n) => inDegree[n] === 0);
    const sortedOrder: string[] = [];

    const nodeStatuses: Record<string, "default" | "active" | "visited"> = {};
    this.states.push(snapshotGraphToState(g, 0, "Initial In-Degrees", nodeStatuses, {}));

    while (queue.length > 0) {
      const u = queue.shift()!;
      sortedOrder.push(u);
      nodeStatuses[u] = "visited";
      const pIdx = this.states.length - 1;

      const outgoing = g.edges.filter((e) => e.from === u);
      for (const e of outgoing) {
        inDegree[e.to] -= 1;
        if (inDegree[e.to] === 0) {
          queue.push(e.to);
          nodeStatuses[e.to] = "active";
        }
      }

      this.states.push(
        snapshotGraphToState(
          g,
          this.states.length,
          `Select ${u} (in-degree 0)`,
          nodeStatuses,
          {},
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "VISIT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: pIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${u}`],
        affectedRelationshipIds: outgoing.map((e) => `edge-${e.from}-${e.to}`),
        semanticFocus: { entityIds: [`node-${u}`], label: `In-degree 0: ${u}` },
        whatHappened: `Emit ${u} into topological order. Decrement neighbor in-degrees.`,
        reason: `Node ${u} has in-degree 0 (all prerequisite dependencies satisfied).`,
        consequence: `Topological order: [${sortedOrder.join(", ")}].`,
        title: `Topological Select ${u}`,
        explanation: `With all prerequisites satisfied, ${u} is added to the valid execution sequence.`,
        isStateChange: true,
      });
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
      metadata: { sortedOrder },
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 6. Kruskal's MST Engine
// ============================================================================
export class KruskalMSTEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "kruskal";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(input: { graph?: ExtractedGraph }): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("kruskal", input);
    const sortedEdges = [...g.edges].sort((a, b) => a.weight - b.weight);

    // DSU
    const parent: Record<string, string> = {};
    for (const n of g.nodes) parent[n] = n;
    const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (x: string, y: string) => {
      parent[find(x)] = find(y);
    };

    const edgeStatuses: Record<string, "default" | "active" | "highlighted" | "relaxed"> = {};
    this.states.push(snapshotGraphToState(g, 0, "Kruskal Initial Graph (Sorted Edges)", {}, edgeStatuses));

    for (const e of sortedEdges) {
      const rootU = find(e.from);
      const rootV = find(e.to);
      const edgeId = `edge-${e.from}-${e.to}`;
      const pIdx = this.states.length - 1;

      if (rootU !== rootV) {
        union(e.from, e.to);
        edgeStatuses[edgeId] = "highlighted";

        this.states.push(snapshotGraphToState(g, this.states.length, `Include Edge ${e.from}-${e.to} (w=${e.weight})`, {}, edgeStatuses));

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "CONNECT",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: pIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [`node-${e.from}`, `node-${e.to}`],
          affectedRelationshipIds: [edgeId],
          semanticFocus: { relationshipIds: [edgeId], label: `MST Edge ${e.from}-${e.to}` },
          whatHappened: `Accept edge ${e.from}-${e.to} (weight ${e.weight}) into MST.`,
          reason: `Connects disjoint components without forming a cycle.`,
          consequence: `Components merged in Disjoint Set Union.`,
          title: `Accept Edge ${e.from}-${e.to}`,
          explanation: `Because vertices ${e.from} and ${e.to} are not yet connected, this minimum-weight edge is safely added to the tree.`,
          isStateChange: true,
        });
      }
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 7. Prim's MST Engine
// ============================================================================
export class PrimMSTEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "prim";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(input: { graph?: ExtractedGraph }): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("prim", input);
    const inMST = new Set<string>([g.source]);
    const edgeStatuses: Record<string, "default" | "active" | "highlighted" | "relaxed"> = {};
    const nodeStatuses: Record<string, "default" | "active" | "visited"> = { [g.source]: "visited" };

    this.states.push(snapshotGraphToState(g, 0, `Prim Start at Root ${g.source}`, nodeStatuses, edgeStatuses));

    while (inMST.size < g.nodes.length) {
      let bestEdge: { from: string; to: string; weight: number } | null = null;

      for (const e of g.edges) {
        if (inMST.has(e.from) && !inMST.has(e.to)) {
          if (!bestEdge || e.weight < bestEdge.weight) {
            bestEdge = e;
          }
        }
      }

      if (!bestEdge) break;

      inMST.add(bestEdge.to);
      nodeStatuses[bestEdge.to] = "visited";
      const edgeId = `edge-${bestEdge.from}-${bestEdge.to}`;
      edgeStatuses[edgeId] = "highlighted";

      const pIdx = this.states.length - 1;
      this.states.push(
        snapshotGraphToState(
          g,
          this.states.length,
          `Add ${bestEdge.to} via Edge ${bestEdge.from}-${bestEdge.to} (w=${bestEdge.weight})`,
          nodeStatuses,
          edgeStatuses,
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "CONNECT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: pIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${bestEdge.to}`],
        affectedRelationshipIds: [edgeId],
        semanticFocus: { relationshipIds: [edgeId], label: `Cut edge: ${bestEdge.weight}` },
        whatHappened: `Include vertex ${bestEdge.to} via minimum cut edge of weight ${bestEdge.weight}.`,
        reason: `Prim's cut property guarantees minimum crossing edge belongs to MST.`,
        consequence: `MST now spans ${inMST.size} vertices.`,
        title: `Prim Cut: Add ${bestEdge.to}`,
        explanation: `We greedily pick the lowest weight edge crossing from the existing tree to an unvisited vertex.`,
        isStateChange: true,
      });
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 8. Floyd-Warshall All-Pairs Engine
// ============================================================================
export class FloydWarshallEngine implements DSAConceptEngine<{ graph?: ExtractedGraph }, DSASemanticState> {
  public readonly conceptId = "floyd-warshall";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(input: { graph?: ExtractedGraph }): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const g = resolveGraphInput("floyd-warshall", input);
    const n = g.nodes.length;
    const matrix: Record<string, Record<string, number>> = {};

    for (const u of g.nodes) {
      matrix[u] = {};
      for (const v of g.nodes) {
        matrix[u][v] = u === v ? 0 : Infinity;
      }
    }
    for (const e of g.edges) {
      matrix[e.from][e.to] = Math.min(matrix[e.from][e.to], e.weight);
    }

    const buildMatrixTable = (): string[][] => {
      return g.nodes.map((u) => [
        u,
        ...g.nodes.map((v) => (matrix[u][v] === Infinity ? "∞" : `${matrix[u][v]}`)),
      ]);
    };

    // State 0: Initial adjacency matrix
    this.states.push(
      snapshotGraphToState(
        g,
        0,
        "Initial All-Pairs Distance Matrix D(0)",
        {},
        {},
        undefined,
        buildMatrixTable(),
      ),
    );

    // K-loop: Intermediate vertices
    for (let k = 0; k < n; k++) {
      const intermediate = g.nodes[k];
      let anyUpdate = false;
      const pIdx = this.states.length - 1;

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const u = g.nodes[i];
          const v = g.nodes[j];
          if (
            matrix[u][intermediate] !== Infinity &&
            matrix[intermediate][v] !== Infinity &&
            matrix[u][intermediate] + matrix[intermediate][v] < matrix[u][v]
          ) {
            matrix[u][v] = matrix[u][intermediate] + matrix[intermediate][v];
            anyUpdate = true;
          }
        }
      }

      this.states.push(
        snapshotGraphToState(
          g,
          this.states.length,
          `Intermediate Vertex k = ${intermediate}`,
          { [intermediate]: "active" },
          {},
          undefined,
          buildMatrixTable(),
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "UPDATE_DISTANCE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: pIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: ["table-distance", `node-${intermediate}`],
        affectedRelationshipIds: [],
        semanticFocus: { entityIds: [`node-${intermediate}`], label: `Intermediate ${intermediate}` },
        whatHappened: `Evaluate all paths using ${intermediate} as intermediate vertex.`,
        reason: `D[i][j] = min(D[i][j], D[i][k] + D[k][j]).`,
        consequence: anyUpdate ? `Matrix updated with shorter multi-hop paths.` : `No paths improved through ${intermediate}.`,
        title: `Intermediate ${intermediate}`,
        explanation: `All pairs (u, v) are checked to see if detouring through ${intermediate} yields a shorter distance.`,
        isStateChange: true,
      });
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}
