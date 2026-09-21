/**
 * Cognora DSA Acceleration Layer - Generic Dynamic Input Extractor
 *
 * THE ALGORITHM IS STATIC. THE INPUT IS DYNAMIC.
 *
 * Extracts structured numbers, arrays, search targets, graph nodes/edges,
 * and linked-list chains/deletions from natural language user prompts.
 */

import { type DSAInputLimits } from "../types/dsa-concept";

export interface ExtractedGraphEdge {
  from: string;
  to: string;
  weight?: number;
}

export interface ExtractedGraph {
  nodes: Array<{ id: string; label: string }>;
  edges: ExtractedGraphEdge[];
  source?: string;
  destination?: string;
}

export interface ExtractedLinkedListInput {
  chain: number[];
  insertValue?: number;
  insertAfter?: number;
  insertBefore?: number;
  deleteValues?: number[];
}

export interface ExtractedInput {
  hasCustomInput: boolean;
  /** Primary list of numeric elements (e.g. [50, 30, 70, 20]) */
  values: number[];
  /** Search target if specified in prompt (e.g. "for 19" -> 19) */
  target?: number;
  /** Operation keyword if detected */
  operation?: string;
  /** Graph topology if detected */
  graph?: ExtractedGraph;
  /** Linked list specialized input */
  linkedList?: ExtractedLinkedListInput;
  error?: string;
}

export class DSAInputExtractor {
  /**
   * Comprehensive input extraction supporting arrays, graphs, and linked lists.
   */
  public static extract(prompt: string, limits?: DSAInputLimits): ExtractedInput {
    if (!prompt || typeof prompt !== "string") {
      return { hasCustomInput: false, values: [] };
    }

    // 1. Try Linked List Extraction (e.g., Delete 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50)
    const listInput = this.extractLinkedList(prompt, limits);
    if (listInput) {
      return listInput;
    }

    // 2. Try Graph Extraction (e.g., A->B(4), A-B:4, A-B, from A to F)
    const graphInput = this.extractGraph(prompt, limits);
    if (graphInput) {
      return graphInput;
    }

    // 3. Target specifier: "for 19", "target 19", "find 19", "value 19"
    let target: number | undefined;
    const targetMatch = prompt.match(
      /\b(?:for|target|find|search(?:ing)? for|key)\s*[:=]?\s*(-?\d+)\b/i,
    );
    if (targetMatch) {
      target = parseInt(targetMatch[1], 10);
    }

    // 4. Bracketed list: "[4, 8, 12, 19, 25]"
    const bracketMatch = prompt.match(/\[([\s\d,\-.]+)\]/);
    if (bracketMatch) {
      const inside = bracketMatch[1];
      const numbers = inside
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && /^-?\d+$/.test(s))
        .map((s) => parseInt(s, 10));

      if (numbers.length > 0) {
        return this.validateLimits(
          { hasCustomInput: true, values: numbers, target },
          limits,
        );
      }
    }

    // 5. Introductory phrase: "using 50, 30, 70, 20, 40", "values 50 30 70", "with 10, 20, 30"
    const phraseMatch = prompt.match(
      /\b(?:using|with|values?|elements?|array|list|input|numbers?|keys?)\s*[:=]?\s*([0-9\s,\-]+)/i,
    );
    if (phraseMatch) {
      const phraseContent = phraseMatch[1];
      const numbers = phraseContent
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && /^-?\d+$/.test(s))
        .map((s) => parseInt(s, 10));

      if (numbers.length >= 2) {
        return this.validateLimits(
          { hasCustomInput: true, values: numbers, target },
          limits,
        );
      }
    }

    // 6. Contiguous sequence of 3 or more numbers
    const allNumberMatches = Array.from(prompt.matchAll(/\b(-?\d+)\b/g)).map((m) =>
      parseInt(m[1], 10),
    );

    let candidateValues = allNumberMatches;
    if (target !== undefined && candidateValues.length > 1) {
      if (candidateValues[candidateValues.length - 1] === target) {
        candidateValues = candidateValues.slice(0, -1);
      }
    }

    if (candidateValues.length >= 3) {
      return this.validateLimits(
        { hasCustomInput: true, values: candidateValues, target },
        limits,
      );
    }

    // No reliable custom input detected; signal caller to use default golden dataset
    return {
      hasCustomInput: false,
      values: [],
      target,
    };
  }

  /**
   * Extracts graph edge definitions (e.g. A->B(4), A-B:4, A-B, from A to F).
   */
  /**
   * Prohibited words that must NEVER be extracted as graph vertex entities.
   * Prevents natural-language prose, algorithm names, or explanation text from corrupting graphs.
   */
  private static readonly PROHIBITED_GRAPH_WORDS = new Set<string>([
    "BELLMAN", "FORD", "CYCLE", "NEGATIVE", "STEP", "GRAPH", "PATH", "ALGORITHM",
    "FINI", "FINITE", "CHECK", "EDGE", "EDGES", "VERTEX", "VERTICES", "UPDATE",
    "DIST", "DISTANCE", "USING", "SHOW", "WITH", "GIVE", "EACH", "FINAL", "CODE",
    "FIND", "WHAT", "WHY", "EXPLAIN", "RELAXATION", "START", "DESTINATION", "TARGET",
    "SOURCE", "TRUE", "FALSE", "NULL", "NONE", "NODE", "NODES", "TREE", "TABLE",
    "SHORT", "SHORTEST", "TIME", "COMPLEXITY", "PASS", "PASSES", "STATE", "SCENE",
    "PREV", "NEXT", "LINE", "COST", "WEIGHT", "VALUE"
  ]);

  /**
   * Extracts graph edge definitions (e.g. A->B=4, A→B=4, A->B(4), A-B:4, from A to F).
   * Enforces the Graph Entity Contract:
   * 1. Vertices must be explicitly structured semantic entities.
   * 2. Natural language explanation/titles/hyphenated words MUST NEVER become graph entities.
   */
  private static extractGraph(
    prompt: string,
    limits?: DSAInputLimits,
  ): ExtractedInput | null {
    const edges: ExtractedGraphEdge[] = [];
    const nodeSet = new Set<string>();

    // 1. Explicit vertex/node declarations: "vertices A, B, C, D" or "nodes: [A, B, C, D]"
    const explicitNodesMatch = prompt.match(
      /\b(?:vertices|nodes|vertexes)\s*[:=]?\s*(\[[^\]]+\]|[A-Za-z0-9\s,]+?)(?=\s+(?:with|edges?|from|to|show|explain|where|in|$))/i,
    );
    const explicitNodeSet = new Set<string>();
    if (explicitNodesMatch) {
      const rawNodes = explicitNodesMatch[1].replace(/[\[\]]/g, "");
      const tokens = rawNodes
        .split(/[\s,]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(
          (t) =>
            t.length > 0 &&
            !DSAInputExtractor.PROHIBITED_GRAPH_WORDS.has(t) &&
            t.length <= 4,
        );
      for (const tok of tokens) {
        explicitNodeSet.add(tok);
        nodeSet.add(tok);
      }
    }

    const addEdge = (u: string, v: string, weight?: number) => {
      if (
        DSAInputExtractor.PROHIBITED_GRAPH_WORDS.has(u) ||
        DSAInputExtractor.PROHIBITED_GRAPH_WORDS.has(v)
      ) {
        return;
      }
      if (explicitNodeSet.size > 0 && (!explicitNodeSet.has(u) || !explicitNodeSet.has(v))) {
        return;
      }
      if (u.length > 4 || v.length > 4) {
        return;
      }
      edges.push({ from: u, to: v, weight });
      nodeSet.add(u);
      nodeSet.add(v);
    };

    // 2. Arrow edge pattern: A->B=4, A→B=4, A->B(4), A->B: 4, A->B, B→C=-3
    const arrowRegex =
      /\b([A-Za-z0-9]+)\s*(?:->|→|-->)\s*([A-Za-z0-9]+)(?:\s*(?:[:=]\s*([-]?\d+)|\(([-]?\d+)\)))?/g;
    let match: RegExpExecArray | null;
    while ((match = arrowRegex.exec(prompt)) !== null) {
      const u = match[1].toUpperCase();
      const v = match[2].toUpperCase();
      const weightStr = match[3] || match[4];
      const weight = weightStr !== undefined ? parseInt(weightStr, 10) : undefined;
      addEdge(u, v, weight);
    }

    // 3. Hyphen edge pattern: requires explicit numeric weight (e.g. A-B:4, A-B=4, A-B(4), A-B=-3)
    // NEVER match English hyphenated words like Bellman-Ford or negative-cycle
    const hyphenRegex =
      /\b([A-Za-z0-9]+)\s*-\s*([A-Za-z0-9]+)\s*(?:[:=]\s*([-]?\d+)|\(([-]?\d+)\))/g;
    while ((match = hyphenRegex.exec(prompt)) !== null) {
      const u = match[1].toUpperCase();
      const v = match[2].toUpperCase();
      const weightStr = match[3] || match[4];
      const weight = weightStr !== undefined ? parseInt(weightStr, 10) : undefined;
      addEdge(u, v, weight);
    }

    if (edges.length < 2 && nodeSet.size < 2) {
      return null;
    }

    // Extract source/destination: "from A to F", "source A", "start A"
    let source: string | undefined;
    let destination: string | undefined;

    const fromMatch = prompt.match(/\b(?:from|source|start(?:ing)? at)\s+([A-Za-z0-9]+)\b/i);
    if (fromMatch) {
      const cand = fromMatch[1].toUpperCase();
      if (nodeSet.has(cand)) {
        source = cand;
      }
    }
    if (!source && edges.length > 0) {
      source = edges[0].from;
    } else if (!source && nodeSet.size > 0) {
      source = Array.from(nodeSet).sort()[0];
    }

    const toMatch = prompt.match(/\b(?:to|destination|target|end(?:ing)? at)\s+([A-Za-z0-9]+)\b/i);
    if (toMatch) {
      const cand = toMatch[1].toUpperCase();
      if (nodeSet.has(cand)) {
        destination = cand;
      }
    } else if (edges.length > 0 && edges[edges.length - 1].to !== source) {
      destination = edges[edges.length - 1].to;
    }

    const nodes = Array.from(nodeSet)
      .sort()
      .map((id) => ({ id, label: id }));

    if (limits?.maxNodes && nodes.length > limits.maxNodes) {
      return {
        hasCustomInput: true,
        values: [],
        error: `Graph node count (${nodes.length}) exceeds maximum limit (${limits.maxNodes}).`,
      };
    }

    if (limits?.maxEdges && edges.length > limits.maxEdges) {
      return {
        hasCustomInput: true,
        values: [],
        error: `Graph edge count (${edges.length}) exceeds maximum limit (${limits.maxEdges}).`,
      };
    }

    return {
      hasCustomInput: true,
      values: [],
      graph: {
        nodes,
        edges,
        source: source || (nodes[0] ? nodes[0].id : "A"),
        destination,
      },
    };
  }

  /**
   * Extracts linked list chains and operations:
   * e.g. "Delete 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50"
   * e.g. "insert 25 between 10 and 40 in 10 -> 40 -> 60"
   */
  private static extractLinkedList(
    prompt: string,
    limits?: DSAInputLimits,
  ): ExtractedInput | null {
    // Check if there is an arrow-separated chain: 10 -> 20 -> 30
    const arrowChainMatch = prompt.match(/(\d+(?:\s*(?:->|→)\s*\d+)+)/);
    if (!arrowChainMatch) {
      return null;
    }

    const chainStr = arrowChainMatch[1];
    const chain = chainStr
      .split(/(?:->|→)/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map((s) => parseInt(s, 10));

    if (chain.length < 2) {
      return null;
    }

    // Check for deletion values: "delete 20 and 30", "remove 20, 30"
    let deleteValues: number[] | undefined;
    const deleteMatch = prompt.match(
      /\b(?:delete|remove)\s+([0-9\s,and]+?)\s+(?:from|in|of)\b/i,
    );
    if (deleteMatch) {
      deleteValues = Array.from(deleteMatch[1].matchAll(/\b(\d+)\b/g)).map((m) =>
        parseInt(m[1], 10),
      );
    }

    // Check for insertion values: "insert 25 between 10 and 40" or "insert 25 after 20"
    let insertValue: number | undefined;
    let insertAfter: number | undefined;
    let insertBefore: number | undefined;

    const insertMatch = prompt.match(
      /\binsert\s+(\d+)\s+(?:between\s+(\d+)\s+and\s+(\d+)|after\s+(\d+)|before\s+(\d+))\b/i,
    );
    if (insertMatch) {
      insertValue = parseInt(insertMatch[1], 10);
      if (insertMatch[2] && insertMatch[3]) {
        insertAfter = parseInt(insertMatch[2], 10);
        insertBefore = parseInt(insertMatch[3], 10);
      } else if (insertMatch[4]) {
        insertAfter = parseInt(insertMatch[4], 10);
      } else if (insertMatch[5]) {
        insertBefore = parseInt(insertMatch[5], 10);
      }
    }

    if (limits?.maxElements && chain.length > limits.maxElements) {
      return {
        hasCustomInput: true,
        values: chain,
        error: `Linked list length (${chain.length}) exceeds limit (${limits.maxElements}).`,
      };
    }

    return {
      hasCustomInput: true,
      values: chain,
      linkedList: {
        chain,
        deleteValues,
        insertValue,
        insertAfter,
        insertBefore,
      },
    };
  }

  private static validateLimits(
    input: ExtractedInput,
    limits?: DSAInputLimits,
  ): ExtractedInput {
    if (!limits) {
      return input;
    }

    if (limits.maxElements && input.values.length > limits.maxElements) {
      return {
        ...input,
        error: `Input length (${input.values.length}) exceeds maximum supported elements (${limits.maxElements}).`,
      };
    }

    return input;
  }
}
