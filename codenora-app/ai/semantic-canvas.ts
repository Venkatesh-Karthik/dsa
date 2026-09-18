/**
 * Semantic Canvas & Interaction Engine
 *
 * Translates low-level Excalidraw canvas elements into high-level Computer Science
 * semantic representations and tracks real-time user whiteboard interactions.
 *
 * Core Principles:
 * 1. Semantic Awareness: Featherless AI reasons over structured CS concepts
 *    (arrays, trees, graphs, pointers), not meaningless raw pixel geometry.
 * 2. Real-time Interaction Detection: When a user edits a node value (e.g. 20 -> 9),
 *    this engine captures what changed semantically to feed into dynamic AI reasoning.
 * 3. Pure Computation & Parsing: Zero DOM/React hooks, operates cleanly on ExcalidrawElement arrays.
 */

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

export type SemanticStructureType =
  | "array"
  | "linked_list"
  | "stack"
  | "queue"
  | "tree"
  | "graph"
  | "matrix";

export interface SemanticPointerSummary {
  id: string;
  label: string;
  targetDslId: string;
  placement?: string;
  color?: string;
}

export interface SemanticArraySummary {
  id: string;
  label?: string;
  elements: Array<{
    dslId: string;
    index: number;
    value: string | number;
  }>;
  pointers: SemanticPointerSummary[];
}

export interface SemanticTreeSummary {
  id: string;
  label?: string;
  root?: string;
  nodes: Array<{
    dslId: string;
    nodeId: string;
    value: string | number;
    left?: string;
    right?: string;
    children?: string[];
  }>;
}

export interface SemanticGraphSummary {
  id: string;
  label?: string;
  nodes: Array<{
    dslId: string;
    nodeId: string;
    label: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    weight?: number | string;
    label?: string;
  }>;
}

export interface SemanticStackSummary {
  id: string;
  label?: string;
  elements: Array<{
    dslId: string;
    index: number;
    value: string | number;
  }>;
}

export interface SemanticMatrixSummary {
  id: string;
  label?: string;
  rows: Array<
    Array<{
      row: number;
      col: number;
      value: string | number;
    }>
  >;
}

export interface SemanticCanvasState {
  elementCount: number;
  aiElementCount: number;
  userElementCount: number;
  existingDslIds: string[];
  arrays: SemanticArraySummary[];
  trees: SemanticTreeSummary[];
  graphs: SemanticGraphSummary[];
  stacks: SemanticStackSummary[];
  matrices: SemanticMatrixSummary[];
  pointers: SemanticPointerSummary[];
  summaryText: string;
}

export interface SemanticElementSnapshot {
  dslId: string;
  text?: string;
  value?: string | number;
  role?: string;
  structureId?: string;
  index?: number;
  x: number;
  y: number;
}

export interface CanvasInteractionDelta {
  type: "value_change" | "element_deleted" | "element_moved";
  targetDslId: string;
  role?: string;
  structureId?: string;
  oldValue?: string | number;
  newValue?: string | number;
  description: string;
}

/**
 * Creates a fast lookup snapshot map of all active AI elements on the canvas.
 */
export function createSemanticSnapshot(
  elements: readonly ExcalidrawElement[],
): Map<string, SemanticElementSnapshot> {
  const snapshot = new Map<string, SemanticElementSnapshot>();

  // First pass: collect text values by container ID
  const textByContainer = new Map<string, string>();
  for (const el of elements) {
    if (!el.isDeleted && el.type === "text") {
      const textEl = el as ExcalidrawTextElement;
      if (textEl.containerId) {
        textByContainer.set(textEl.containerId, textEl.text);
      }
    }
  }

  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    const dslId = el.customData?.dslId as string | undefined;
    if (!dslId) {
      continue;
    }

    const role = (el.customData?.role as string) || undefined;
    const structureId =
      (el.customData?.arrayId as string) ||
      (el.customData?.treeId as string) ||
      (el.customData?.graphId as string) ||
      (el.customData?.stackId as string) ||
      (el.customData?.matrixId as string) ||
      undefined;

    let textVal: string | undefined = undefined;
    if (el.type === "text") {
      textVal = (el as ExcalidrawTextElement).text;
    } else if (textByContainer.has(el.id)) {
      textVal = textByContainer.get(el.id);
    }

    const value =
      el.customData?.value !== undefined
        ? (el.customData.value as string | number)
        : textVal;

    snapshot.set(dslId, {
      dslId,
      text: textVal,
      value,
      role,
      structureId,
      index:
        typeof el.customData?.index === "number"
          ? el.customData.index
          : undefined,
      x: Math.round(el.x),
      y: Math.round(el.y),
    });
  }

  return snapshot;
}

/**
 * Detects differences between the previous snapshot and the current scene elements.
 * Emits high-level CS semantic deltas when a user modifies canvas values or elements.
 */
export function detectSemanticCanvasChanges(
  currentElements: readonly ExcalidrawElement[],
  previousSnapshot: Map<string, SemanticElementSnapshot>,
): CanvasInteractionDelta[] {
  if (!previousSnapshot || previousSnapshot.size === 0) {
    return [];
  }

  const currentSnapshot = createSemanticSnapshot(currentElements);
  const deltas: CanvasInteractionDelta[] = [];

  for (const [dslId, prev] of previousSnapshot.entries()) {
    const current = currentSnapshot.get(dslId);

    // 1. Element deleted
    if (!current) {
      deltas.push({
        type: "element_deleted",
        targetDslId: dslId,
        role: prev.role,
        structureId: prev.structureId,
        oldValue: prev.value,
        description: `Element '${dslId}'${
          prev.role ? ` (${prev.role})` : ""
        } was removed from the canvas.`,
      });
      continue;
    }

    // 2. Value edited (e.g. 20 -> 9)
    const prevVal =
      prev.value !== undefined ? String(prev.value).trim() : undefined;
    const currVal =
      current.value !== undefined ? String(current.value).trim() : undefined;

    if (prevVal !== undefined && currVal !== undefined && prevVal !== currVal) {
      let desc = `Value on element '${dslId}' changed from '${prevVal}' to '${currVal}'.`;
      if (prev.role === "array-element" && typeof prev.index === "number") {
        desc = `Array element at index [${prev.index}] was edited from '${prevVal}' to '${currVal}'.`;
      } else if (prev.role === "tree-node") {
        desc = `Tree node '${dslId}' value was edited from '${prevVal}' to '${currVal}'.`;
      } else if (prev.role === "stack-element") {
        desc = `Stack element '${dslId}' was edited from '${prevVal}' to '${currVal}'.`;
      }

      deltas.push({
        type: "value_change",
        targetDslId: dslId,
        role: prev.role,
        structureId: prev.structureId,
        oldValue: prev.value,
        newValue: current.value,
        description: desc,
      });
    }
  }

  return deltas;
}

/**
 * Extracts the full high-level semantic CS state from the Excalidraw canvas.
 */
export function extractSemanticCanvasState(
  elements: readonly ExcalidrawElement[],
): SemanticCanvasState {
  const activeElements = elements.filter((el) => !el.isDeleted);
  const dslIds: string[] = [];
  let aiCount = 0;
  let userCount = 0;

  // Text values map (containerId -> text)
  const containerTextMap = new Map<string, string>();
  for (const el of activeElements) {
    if (el.type === "text") {
      const textEl = el as ExcalidrawTextElement;
      if (textEl.containerId) {
        containerTextMap.set(textEl.containerId, textEl.text);
      }
    }
  }

  const arraysMap = new Map<string, SemanticArraySummary>();
  const treesMap = new Map<string, SemanticTreeSummary>();
  const graphsMap = new Map<string, SemanticGraphSummary>();
  const stacksMap = new Map<string, SemanticStackSummary>();
  const matricesMap = new Map<string, SemanticMatrixSummary>();
  const pointers: SemanticPointerSummary[] = [];

  for (const el of activeElements) {
    const dslId = el.customData?.dslId as string | undefined;
    if (dslId) {
      aiCount++;
      dslIds.push(dslId);

      const role = el.customData?.role as string | undefined;
      const textVal =
        el.type === "text"
          ? (el as ExcalidrawTextElement).text
          : containerTextMap.get(el.id) ??
            (el.customData?.value as string | number | undefined);

      // 1. Array Element
      if (role === "array-element" || el.customData?.arrayId) {
        const arrId = (el.customData?.arrayId as string) || dslId.split("-")[0];
        const idx =
          typeof el.customData?.index === "number"
            ? el.customData.index
            : parseInt(dslId.split("-")[1] || "0", 10);
        const val = textVal ?? (el.customData?.value as string | number) ?? idx;

        if (!arraysMap.has(arrId)) {
          arraysMap.set(arrId, { id: arrId, elements: [], pointers: [] });
        }
        arraysMap.get(arrId)!.elements.push({
          dslId,
          index: isNaN(idx) ? 0 : idx,
          value: val,
        });
      }

      // 2. Tree Node
      else if (role === "tree-node" || el.customData?.treeId) {
        const treeId = (el.customData?.treeId as string) || dslId.split("-")[0];
        const nodeId =
          (el.customData?.nodeId as string) || dslId.replace(`${treeId}-`, "");
        const val =
          textVal ?? (el.customData?.value as string | number) ?? nodeId;

        if (!treesMap.has(treeId)) {
          treesMap.set(treeId, { id: treeId, nodes: [] });
        }
        treesMap.get(treeId)!.nodes.push({
          dslId,
          nodeId,
          value: val,
          left: el.customData?.left as string | undefined,
          right: el.customData?.right as string | undefined,
          children: el.customData?.children as string[] | undefined,
        });
      }

      // 3. Graph Node & Edge
      else if (role === "graph-node" || el.customData?.graphId) {
        const gId = (el.customData?.graphId as string) || dslId.split("-")[0];
        const nodeId =
          (el.customData?.nodeId as string) || dslId.replace(`${gId}-`, "");
        const label = textVal ?? (el.customData?.label as string) ?? nodeId;

        if (!graphsMap.has(gId)) {
          graphsMap.set(gId, { id: gId, nodes: [], edges: [] });
        }
        graphsMap.get(gId)!.nodes.push({ dslId, nodeId, label: String(label) });
      } else if (role === "graph-edge") {
        const gId = (el.customData?.graphId as string) || dslId.split("-")[0];
        const from = (el.customData?.from as string) || "";
        const to = (el.customData?.to as string) || "";
        const weight = el.customData?.weight as number | string | undefined;

        if (!graphsMap.has(gId)) {
          graphsMap.set(gId, { id: gId, nodes: [], edges: [] });
        }
        graphsMap.get(gId)!.edges.push({ from, to, weight });
      }

      // 4. Stack Element
      else if (role === "stack-element" || el.customData?.stackId) {
        const sId = (el.customData?.stackId as string) || dslId.split("-")[0];
        const idx =
          typeof el.customData?.index === "number"
            ? el.customData.index
            : parseInt(dslId.split("-")[1] || "0", 10);
        const val = textVal ?? (el.customData?.value as string | number) ?? idx;

        if (!stacksMap.has(sId)) {
          stacksMap.set(sId, { id: sId, elements: [] });
        }
        stacksMap.get(sId)!.elements.push({
          dslId,
          index: isNaN(idx) ? 0 : idx,
          value: val,
        });
      }

      // 5. Pointer Annotation
      else if (role === "pointer" || el.customData?.targetId) {
        pointers.push({
          id: dslId,
          label:
            (el.customData?.label as string) ||
            (textVal !== undefined ? String(textVal) : "") ||
            "POINTER",
          targetDslId: (el.customData?.targetId as string) || "",
          placement: el.customData?.placement as string | undefined,
          color: el.customData?.color as string | undefined,
        });
      }
    } else {
      userCount++;
    }
  }

  // Sort array elements by index
  for (const arr of arraysMap.values()) {
    arr.elements.sort((a, b) => a.index - b.index);
    // Associate matching pointers
    arr.pointers = pointers.filter((p) =>
      arr.elements.some((e) => e.dslId === p.targetDslId),
    );
  }

  // Build high-level pedagogical summary text
  const summaryLines: string[] = [];

  if (arraysMap.size > 0) {
    for (const arr of arraysMap.values()) {
      const vals = arr.elements.map((e) => e.value).join(", ");
      summaryLines.push(
        `• Array '${arr.id}': [${vals}] (length: ${arr.elements.length})`,
      );
      if (arr.pointers.length > 0) {
        const ptrStrs = arr.pointers.map(
          (p) => `${p.label} -> target '${p.targetDslId}'`,
        );
        summaryLines.push(`  Active Pointers: ${ptrStrs.join(", ")}`);
      }
    }
  }

  if (treesMap.size > 0) {
    for (const tree of treesMap.values()) {
      summaryLines.push(`• Tree '${tree.id}' with ${tree.nodes.length} nodes:`);
      for (const node of tree.nodes.slice(0, 8)) {
        const children = [
          node.left ? `L:${node.left}` : null,
          node.right ? `R:${node.right}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        summaryLines.push(
          `  Node '${node.nodeId}' (val: ${node.value})${
            children ? ` [${children}]` : ""
          }`,
        );
      }
    }
  }

  if (graphsMap.size > 0) {
    for (const g of graphsMap.values()) {
      const nodeLabels = g.nodes.map((n) => n.label).join(", ");
      summaryLines.push(
        `• Graph '${g.id}' (${g.nodes.length} nodes: [${nodeLabels}], ${g.edges.length} edges)`,
      );
    }
  }

  if (stacksMap.size > 0) {
    for (const s of stacksMap.values()) {
      const vals = s.elements.map((e) => e.value).join(", ");
      summaryLines.push(`• Stack '${s.id}' [Top -> Bottom]: [${vals}]`);
    }
  }

  const summaryText =
    summaryLines.length > 0
      ? `Active Whiteboard Data Structures:\n${summaryLines.join("\n")}`
      : "Whiteboard has no active AI data structures.";

  return {
    elementCount: activeElements.length,
    aiElementCount: aiCount,
    userElementCount: userCount,
    existingDslIds: dslIds,
    arrays: Array.from(arraysMap.values()),
    trees: Array.from(treesMap.values()),
    graphs: Array.from(graphsMap.values()),
    stacks: Array.from(stacksMap.values()),
    matrices: Array.from(matricesMap.values()),
    pointers,
    summaryText,
  };
}
