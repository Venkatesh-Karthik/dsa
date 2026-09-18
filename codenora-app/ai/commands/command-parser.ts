/**
 * Cognora Universal Command System - Parser
 *
 * Deterministically parses slash commands, targets, arguments, and options.
 * Supports:
 * - Natural syntax: /array 10, /array [4, 8, 15, 16], /linked-list [10, 20, 30]
 * - Parentheses syntax: /array(10), /array(1, 2, 3), /ll(10, 20)
 * - Structures: /heap max [15, 10, 20], /heap min [10, 5, 20], /bst [50, 30, 70], /avl [30, 20, 10]
 * - Operations: /insert 25, /insert heap 25, /delete 40, /push 30, /pop, /enqueue 40, /dequeue
 * - Graphs: /graph A-B A-C B-D C-D, /graph A-B:4 A-C:2 B-D:5, /connect A B, /edge A B 5
 * - Algorithms: /sort quick, /search binary 23, /traverse bfs A, /run merge-sort
 * - Teaching: /teach, /teach /heap [10, 20], /why, /trace, /explain, /see, /compare, /diff
 * - View & Playback: /focus 25, /show tree, /hide labels, /fit, /step 5, /next, /play
 * - Session: /undo, /redo, /reset, /clear, /code java, /make array 10, /seed array 20
 */

import type { ParsedCommand, ParsedGraphEdge } from "./command-types";

/**
 * Tokenizes raw command text preserving quoted strings, array literals, and flags.
 */
export function tokenizeCommandInput(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
    } else if (char === "[" && !inDoubleQuote && !inSingleQuote) {
      bracketDepth++;
      current += char;
    } else if (char === "]" && !inDoubleQuote && !inSingleQuote) {
      if (bracketDepth > 0) {
        bracketDepth--;
      }
      current += char;
    } else if (
      (char === " " || char === "\t" || char === "\n") &&
      !inDoubleQuote &&
      !inSingleQuote &&
      bracketDepth === 0
    ) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
  }

  if (bracketDepth > 0) {
    throw new Error(`Malformed array literal: unclosed bracket in '${input}'.`);
  }

  if (inDoubleQuote || inSingleQuote) {
    throw new Error(`Unterminated string quote in '${input}'.`);
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Parses bracketed array literals like '[4, 8, 15, 16, 23, 42]' or '[10 20 30]'.
 */
export function parseArrayLiteral(literal: string): (number | string)[] {
  const inner = literal
    .trim()
    .replace(/^\[\s*/, "")
    .replace(/\s*\]$/, "");
  if (!inner) {
    return [];
  }

  const parts = inner.includes(",")
    ? inner.split(",").map((s) => s.trim())
    : inner.split(/\s+/).map((s) => s.trim());

  return parts.filter(Boolean).map((p) => {
    // Strip outer quotes if any
    const unquoted = p.replace(/^["'](.*)["']$/, "$1");
    const num = Number(unquoted);
    return !isNaN(num) && unquoted !== "" ? num : unquoted;
  });
}

/**
 * Parses graph edge specifications:
 * e.g. "A-B A-C B-D C-D" or "A-B, B-C, C-A" (undirected)
 * e.g. "A->B, B->C" (directed)
 * e.g. "A-B:4 A-C:2 B-D:5" or "A-B(5)" (weighted)
 */
export function parseGraphEdges(argsStr: string): ParsedGraphEdge[] {
  const clean = argsStr.trim();
  const rawTokens = clean.includes(",")
    ? clean.split(",").map((s) => s.trim())
    : clean.split(/\s+/).map((s) => s.trim());

  const edgeTokens = rawTokens.filter(Boolean);
  const edges: ParsedGraphEdge[] = [];

  for (const token of edgeTokens) {
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
      `Invalid graph edges: '${argsStr}'. Use syntax like '/graph A-B A-C B-D' or '/graph A-B:4 B-C:2'.`,
    );
  }

  return edges;
}

/**
 * Parses matrix row specifications:
 * e.g. "1,2,3;4,5,6" -> [[1,2,3],[4,5,6]]
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
      `Invalid matrix format: '${argsStr}'. Use syntax like '/matrix(1,2,3;4,5,6)' or '/grid 3 3'.`,
    );
  }

  return rows;
}

const KNOWN_STRUCTURE_TARGETS = new Set([
  "array",
  "heap",
  "tree",
  "bst",
  "avl",
  "linked-list",
  "list",
  "stack",
  "queue",
  "graph",
  "table",
  "grid",
  "matrix",
]);

export const parseUniversalCommand = (rawInput: string): ParsedCommand =>
  parseCommand(rawInput);

/**
 * Deterministically parses ANY Cognora slash command into a structured ParsedCommand.
 */
export function parseCommand(rawInput: string): ParsedCommand {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error(
      `Invalid command format. Commands must start with '/': '${trimmed}'`,
    );
  }

  // Check parenthesized format e.g. /array(10, 20, 30) or /graph(A-B, B-C)
  const parenMatch = trimmed.match(/^\/([a-zA-Z0-9_-]+)\s*\((.*)\)\s*$/);
  let commandName: string;
  let rawArgsString: string;

  if (parenMatch) {
    commandName = parenMatch[1].toLowerCase();
    rawArgsString = parenMatch[2].trim();
  } else {
    // Space format e.g. /array 10, 20 or /heap max [10, 20]
    const firstSpaceIndex = trimmed.indexOf(" ");
    if (firstSpaceIndex === -1) {
      commandName = trimmed.slice(1).toLowerCase();
      rawArgsString = "";
    } else {
      commandName = trimmed.slice(1, firstSpaceIndex).toLowerCase();
      rawArgsString = trimmed.slice(firstSpaceIndex + 1).trim();
    }
  }

  // Tokenize arguments
  const rawTokens = rawArgsString ? tokenizeCommandInput(rawArgsString) : [];

  const flags = new Set<string>();
  const options: Record<string, string | number | boolean> = {};
  const positionalTokens: string[] = [];

  for (const tok of rawTokens) {
    if (tok.startsWith("--")) {
      const optPart = tok.slice(2);
      if (optPart.includes("=")) {
        const [k, v] = optPart.split("=");
        options[k] = !isNaN(Number(v)) ? Number(v) : v;
      } else {
        flags.add(optPart);
        options[optPart] = true;
      }
    } else if (tok.startsWith("-") && tok.length > 1 && !/^-?\d+$/.test(tok)) {
      flags.add(tok.slice(1));
    } else {
      positionalTokens.push(tok);
    }
  }

  // Support /teach /subcommand or /make <structure> <args>
  let subcommand: string | undefined;
  if (commandName === "teach" && positionalTokens[0]?.startsWith("/")) {
    subcommand = positionalTokens.join(" ");
  } else if (commandName === "make" && positionalTokens.length > 0) {
    subcommand = positionalTokens[0].toLowerCase();
  }

  // Check graph edge indicators
  let graphEdges: ParsedGraphEdge[] | undefined;
  if (
    (commandName === "graph" || commandName === "dag") &&
    (rawArgsString.includes("-") || rawArgsString.includes("->"))
  ) {
    graphEdges = parseGraphEdges(rawArgsString);
  }

  // Check matrix indicators
  let matrixRows: (number | string)[][] | undefined;
  if (
    (commandName === "matrix" ||
      commandName === "grid" ||
      commandName === "table") &&
    rawArgsString.includes(";")
  ) {
    matrixRows = parseMatrixRows(rawArgsString);
  }

  // Parse target and values
  let target: string | undefined;
  const args: (string | number)[] = [];
  const numericArgs: number[] = [];
  const stringArgs: string[] = [];
  let arrayValues: (number | string)[] | undefined;

  const remainingTokens = [...positionalTokens];

  // Specific targeting for operations: /insert heap 25, /delete avl 10, /push stack 40
  if (
    (commandName === "insert" ||
      commandName === "add" ||
      commandName === "delete" ||
      commandName === "remove" ||
      commandName === "push" ||
      commandName === "pop" ||
      commandName === "peek" ||
      commandName === "rotate" ||
      commandName === "reverse" ||
      commandName === "sort" ||
      commandName === "search" ||
      commandName === "traverse") &&
    remainingTokens.length >= 2
  ) {
    const candidateTarget = remainingTokens[0].toLowerCase();
    const secondToken = remainingTokens[1];
    // If candidateTarget is a known structure keyword or single identifier (e.g. "A" or "heap")
    // and second token is a value or array
    if (
      KNOWN_STRUCTURE_TARGETS.has(candidateTarget) ||
      (!/^-?\d+$/.test(candidateTarget) && !candidateTarget.startsWith("["))
    ) {
      target = candidateTarget;
      remainingTokens.shift();
    }
  }

  // Special options for heap: /heap max [15, 10, 20] or /heap min [10, 5]
  if (commandName === "heap" && remainingTokens.length > 0) {
    const mode = remainingTokens[0].toLowerCase();
    if (mode === "max" || mode === "min") {
      options.mode = mode;
      stringArgs.push(mode);
      args.push(mode);
      remainingTokens.shift();
    }
  }

  for (let idx = 0; idx < remainingTokens.length; idx++) {
    const tok = remainingTokens[idx];

    // Check bracketed array literal e.g. [4, 8, 15, 16, 23, 42]
    if (tok.startsWith("[") && tok.endsWith("]")) {
      const parsedArr = parseArrayLiteral(tok);
      arrayValues = parsedArr;
      for (const item of parsedArr) {
        if (typeof item === "number") {
          numericArgs.push(item);
          args.push(item);
          stringArgs.push(String(item));
        } else {
          stringArgs.push(item);
          args.push(item);
        }
      }
      continue;
    }

    // Check quoted string
    if (
      (tok.startsWith('"') && tok.endsWith('"')) ||
      (tok.startsWith("'") && tok.endsWith("'"))
    ) {
      const unquoted = tok.slice(1, -1);
      stringArgs.push(unquoted);
      args.push(unquoted);
      continue;
    }

    // Comma-separated list within token (e.g. 10,20,30)
    if (tok.includes(",")) {
      const subTokens = tok
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const sub of subTokens) {
        const num = Number(sub);
        if (!isNaN(num) && sub !== "") {
          numericArgs.push(num);
          args.push(num);
          stringArgs.push(String(num));
        } else {
          stringArgs.push(sub);
          args.push(sub);
        }
      }
      continue;
    }

    const num = Number(tok);
    if (!isNaN(num) && tok !== "") {
      numericArgs.push(num);
      args.push(num);
      stringArgs.push(String(num));
    } else {
      stringArgs.push(tok);
      args.push(tok);
    }
  }

  // If arrayValues wasn't explicitly bracketed but multiple numeric arguments exist
  if (!arrayValues && numericArgs.length > 1) {
    arrayValues = [...numericArgs];
  }

  const isSizeOnly =
    args.length === 1 &&
    numericArgs.length === 1 &&
    Number.isInteger(numericArgs[0]) &&
    numericArgs[0] > 0;

  // Validation rules for common syntax errors
  validateParsedCommand(commandName, {
    rawInput,
    commandName,
    target,
    args,
    numericArgs,
    stringArgs,
    arrayValues,
    matrixRows,
    graphEdges,
    flags,
    options,
    isSizeOnly,
    subcommand,
  });

  return {
    rawInput,
    commandName,
    target,
    args,
    numericArgs,
    stringArgs,
    arrayValues,
    matrixRows,
    graphEdges,
    flags,
    options,
    isSizeOnly,
    subcommand,
  };
}

/**
 * Validates syntax contracts and throws deterministic, learner-friendly errors.
 */
function validateParsedCommand(cmd: string, parsed: ParsedCommand): void {
  // 1. /array validation
  if (cmd === "array") {
    if (
      parsed.args.length === 1 &&
      parsed.numericArgs.length === 0 &&
      !parsed.arrayValues
    ) {
      throw new Error(
        `Invalid /array command. Expected: /array <count> or /array [value1,value2,...]. Example: /array 10`,
      );
    }
  }

  // 2. /heap validation
  if (cmd === "heap") {
    if (
      parsed.args.length > 0 &&
      parsed.numericArgs.length === 0 &&
      !parsed.arrayValues &&
      !parsed.options.mode
    ) {
      throw new Error(
        `Invalid /heap command. Expected: /heap [max|min] [values...]. Example: /heap max [15,10,20,8,25]`,
      );
    }
  }

  // 3. /connect validation
  if (cmd === "connect") {
    if (parsed.args.length < 2) {
      throw new Error(
        `Invalid /connect command. Expected: /connect <source> <target> [label]. Example: /connect A B`,
      );
    }
  }

  // 4. /edge validation
  if (cmd === "edge") {
    if (parsed.args.length < 2) {
      throw new Error(
        `Invalid /edge command. Expected: /edge <source> <target> [weight]. Example: /edge A B 5`,
      );
    }
  }

  // 5. /disconnect validation
  if (cmd === "disconnect") {
    if (parsed.args.length < 2) {
      throw new Error(
        `Invalid /disconnect command. Expected: /disconnect <source> <target>. Example: /disconnect A B`,
      );
    }
  }

  // 6. /insert validation
  if (cmd === "insert" || cmd === "add") {
    if (parsed.args.length === 0) {
      throw new Error(
        `Invalid /${cmd} command. Expected: /${cmd} [target] <value>. Example: /${cmd} 25 or /${cmd} heap 25`,
      );
    }
  }

  // 7. /push validation
  if (cmd === "push") {
    if (parsed.args.length === 0) {
      throw new Error(
        `Invalid /push command. Expected: /push <value>. Example: /push 40`,
      );
    }
  }

  // 8. /enqueue validation
  if (cmd === "enqueue") {
    if (parsed.args.length === 0) {
      throw new Error(
        `Invalid /enqueue command. Expected: /enqueue <value>. Example: /enqueue 40`,
      );
    }
  }
}
