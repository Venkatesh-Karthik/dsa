/**
 * Cognora DSA Command System - Parser
 *
 * Deterministically parses slash commands and arguments.
 * Supports:
 * - /array(10) or /array(1,2,3,4)
 * - /linked-list(10,20,30) or /ll(10,20,30)
 * - /stack(1,2,3)
 * - /queue(10,20,30)
 * - /binary-tree(10,5,15) or /tree(10,5,15) or /bst(10,5,15)
 * - /heap(10,5,20,3)
 * - /graph(A-B,B-C,C-A) or /graph(A->B,B->C) or /graph(A-B:5,B-C:3)
 * - /matrix(3,4) or /matrix(1,2,3;4,5,6)
 */

import type { CommandArgs, ParsedGraphEdge } from "./command-types";

export function parseCommand(rawInput: string): CommandArgs {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error(
      `Invalid command format. Commands must start with '/': '${trimmed}'`,
    );
  }

  // Match /command(args) or /command args or /command
  const parenMatch = trimmed.match(/^\/([a-zA-Z0-9_-]+)\s*\((.*)\)\s*$/);
  let commandName: string;
  let rawArgs: string;

  if (parenMatch) {
    commandName = parenMatch[1].toLowerCase();
    rawArgs = parenMatch[2].trim();
  } else {
    // Space separated syntax: /array 1, 2, 3
    const spaceMatch = trimmed.match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
    if (!spaceMatch) {
      throw new Error(`Unable to parse command: '${trimmed}'`);
    }
    commandName = spaceMatch[1].toLowerCase();
    rawArgs = (spaceMatch[2] || "").trim();
  }

  // Parse graph edges if graph command or contains edge indicators (- or ->)
  if (
    (commandName === "graph" || commandName === "dag") &&
    (rawArgs.includes("-") || rawArgs.includes("->"))
  ) {
    const graphEdges = parseGraphEdges(rawArgs);
    return {
      rawInput,
      commandName,
      numericArgs: [],
      stringArgs: [],
      graphEdges,
    };
  }

  // Parse matrix if contains semicolons
  if (rawArgs.includes(";")) {
    const matrixRows = parseMatrixRows(rawArgs);
    return {
      rawInput,
      commandName,
      numericArgs: [],
      stringArgs: [],
      matrixRows,
    };
  }

  // Parse list of values or size
  if (!rawArgs) {
    return {
      rawInput,
      commandName,
      numericArgs: [],
      stringArgs: [],
    };
  }

  // Split by comma or whitespace (if no commas)
  const tokens = rawArgs.includes(",")
    ? rawArgs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : rawArgs
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

  const numericArgs: number[] = [];
  const stringArgs: string[] = [];

  for (const token of tokens) {
    const num = Number(token);
    if (!isNaN(num) && token !== "") {
      numericArgs.push(num);
      stringArgs.push(String(num));
    } else {
      stringArgs.push(token);
    }
  }

  // Single number for /array(10) or /matrix(3,4)
  const isSizeOnly =
    tokens.length === 1 &&
    numericArgs.length === 1 &&
    Number.isInteger(numericArgs[0]) &&
    numericArgs[0] > 0;

  return {
    rawInput,
    commandName,
    numericArgs,
    stringArgs,
    isSizeOnly,
  };
}

/**
 * Parses graph edge specifications like:
 * A-B, B-C, C-A (undirected)
 * A->B, B->C (directed)
 * A-B:5, B-C:10 or A->B(5) (weighted)
 */
export function parseGraphEdges(argsStr: string): ParsedGraphEdge[] {
  const edgeTokens = argsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const edges: ParsedGraphEdge[] = [];

  for (const token of edgeTokens) {
    // Check for weight: A-B:5 or A->B:5 or A-B(5)
    let edgePart = token;
    let weight: number | string | undefined;

    const colonMatch = token.match(/^([^:]+):(.*)$/);
    if (colonMatch) {
      edgePart = colonMatch[1].trim();
      const wNum = Number(colonMatch[2].trim());
      weight = !isNaN(wNum) ? wNum : colonMatch[2].trim();
    } else {
      const parenWeightMatch = token.match(/^([^(]+)\(([^)]+)\)$/);
      if (parenWeightMatch) {
        edgePart = parenWeightMatch[1].trim();
        const wNum = Number(parenWeightMatch[2].trim());
        weight = !isNaN(wNum) ? wNum : parenWeightMatch[2].trim();
      }
    }

    // Check directed (->) vs undirected (-)
    if (edgePart.includes("->")) {
      const [from, to] = edgePart.split("->").map((s) => s.trim());
      if (from && to) {
        edges.push({ from, to, weight, directed: true });
      }
    } else if (edgePart.includes("-")) {
      const [from, to] = edgePart.split("-").map((s) => s.trim());
      if (from && to) {
        edges.push({ from, to, weight, directed: false });
      }
    }
  }

  if (edges.length === 0) {
    throw new Error(
      `Invalid graph edges: '${argsStr}'. Use syntax like '/graph(A-B, B-C)' or '/graph(A->B, B->C)'.`,
    );
  }

  return edges;
}

/**
 * Parses matrix row specifications like:
 * 1,2,3;4,5,6 -> [[1,2,3],[4,5,6]]
 */
export function parseMatrixRows(argsStr: string): (number | string)[][] {
  const rowTokens = argsStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const rows: (number | string)[][] = [];

  for (const rowToken of rowTokens) {
    const colTokens = rowToken.includes(",")
      ? rowToken
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : rowToken
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean);

    const row = colTokens.map((t) => {
      const num = Number(t);
      return !isNaN(num) && t !== "" ? num : t;
    });

    if (row.length > 0) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new Error(
      `Invalid matrix format: '${argsStr}'. Use syntax like '/matrix(1,2,3;4,5,6)'.`,
    );
  }

  return rows;
}
