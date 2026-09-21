/**
 * Visual Primitive Factory
 *
 * Maps abstract semantic entities to concrete Cognora visual primitives on the Excalidraw canvas.
 * Encapsulates primitive creation and in-place updates while preserving stable element identities.
 */

import { newElementWith } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { createTreeNode } from "./tree-node";
import { createGraphNode } from "./graph-node";
import { createArrayCell } from "./array-cell";
import { createLinkedListNode } from "./linked-list-node";
import { createCallFrame } from "./call-frame";
import { createGenericEntity } from "./generic-entity";
import { createAnnotationPrimitive } from "./annotation-primitive";
import { createTablePrimitive, updateTablePrimitive } from "./table-primitive";
import { TOKENS, mapSemanticStateToNodeTokens } from "./design-tokens";

import type { LayoutPoint } from "../layout-engine";
import type { SemanticEntity } from "../scene-graph";

export interface RenderedPrimitive {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
}

/**
 * Strips internal prefixes (e.g. container prefixes or machine IDs) and formats clean human-facing labels.
 */
export function sanitizeDisplayLabel(
  rawVal: unknown,
  fallbackLabel?: string,
  rawId?: string,
): string {
  // If rawVal is a valid number or non-empty string, prioritize it
  if (
    typeof rawVal === "number" ||
    (typeof rawVal === "string" && rawVal.trim().length > 0)
  ) {
    const s = String(rawVal).trim();
    // If it's a numeric string (e.g. "10", "0", "-5", "42"), always return it directly
    if (!isNaN(Number(s)) && s !== "") {
      return s;
    }
    // If it's a clean semantic label that isn't an internal machine ID
    const isMachineId = (str: string) =>
      str.startsWith("Component ") ||
      /^(?:(?:dijkstra|avl[-_]tree|binary[-_]tree|tree|graph|array|arr|list|stack|queue|dll|sll|tcp|server|client|ent|elem|item|node|dist[-_]table|pq|invariant|ptr)[-_]|t\d+[-_]op\d+|n\d+|pointer)/i.test(
        str,
      );

    if (!isMachineId(s)) {
      return s;
    }
  }

  // Next check fallbackLabel
  if (fallbackLabel && typeof fallbackLabel === "string") {
    const fl = fallbackLabel.trim();
    if (!isNaN(Number(fl)) && fl !== "") {
      return fl;
    }
    const isMachineId = (str: string) =>
      str.startsWith("Component ") ||
      /^(?:(?:dijkstra|avl[-_]tree|binary[-_]tree|tree|graph|array|arr|list|stack|queue|dll|sll|tcp|server|client|ent|elem|item|node|dist[-_]table|pq|invariant|ptr)[-_]|t\d+[-_]op\d+|n\d+|pointer)/i.test(
        str,
      );

    if (fl.length > 0 && !isMachineId(fl)) {
      return fl;
    }
  }

  const candidate = (fallbackLabel || rawId || "").trim();
  if (!candidate) {
    return "";
  }

  // Sanitization for known domain artifacts
  if (/^dist[-_]table/i.test(candidate)) {
    return "Distance Table";
  }
  if (/^pq(?:[-_](?:before|after))?$/i.test(candidate)) {
    return "Priority Queue";
  }
  if (/^invariant[-_]text$/i.test(candidate)) {
    return "Algorithm Invariant";
  }
  if (/^pointer$/i.test(candidate)) {
    return "Pointer";
  }
  const graphNodeMatch = candidate.match(
    /^(?:dijkstra[-_]graph|graph[-_]main)[-_]([A-Za-z0-9]+)$/i,
  );
  if (graphNodeMatch) {
    return graphNodeMatch[1];
  }

  // Check for common machine patterns:
  // dll-e1, dll-0, dll-node-1 -> "1"
  const dllMatch = candidate.match(/^dll[-_](?:e|node[-_]?)?(\d+)$/i);
  if (dllMatch) {
    return dllMatch[1];
  }

  // Client/Server
  if (/^(?:tcp[-_]|network[-_]|app[-_])?client(?:[-_]\w+)?$/i.test(candidate)) {
    return "Client";
  }
  if (/^(?:tcp[-_]|network[-_]|app[-_])?server(?:[-_]\w+)?$/i.test(candidate)) {
    return "Server";
  }

  // Single capital letter like 'A', 'B', 'C'
  const letterMatch = candidate.match(/^(?:[a-zA-Z0-9_-]+[-_])([A-Z])$/);
  if (letterMatch && letterMatch[1]) {
    return letterMatch[1];
  }

  // tree-n30, avl-tree-n20, node-30, n30 -> "30"
  const nodeMatch = candidate.match(/^(?:[a-zA-Z0-9_-]+[-_])?n?(\d+)$/);
  if (nodeMatch && nodeMatch[1]) {
    return nodeMatch[1];
  }

  // Strip leading container/machine names
  const clean = candidate.replace(
    /^(?:avl[-_]tree|binary[-_]tree|tree|graph|array|arr|list|stack|queue|dll|sll|table|db|entity|item|elem|node)[-_]/i,
    "",
  );
  if (clean && !clean.startsWith("Component ")) {
    return clean.replace(/^n(?=\d+)/, "");
  }

  return candidate;
}

/**
 * Creates a visual primitive from a semantic entity at a specified layout position.
 */
export function createVisualPrimitive(
  entity: SemanticEntity,
  pos: LayoutPoint,
): RenderedPrimitive {
  const highlight = entity.properties?.highlight as string | undefined;
  const rawId = entity.id;

  let primitive: RenderedPrimitive;

  switch (entity.primitiveType) {
    case "TreeNode": {
      const diameter =
        (entity.properties?.diameter as number | undefined) ??
        TOKENS.GEOMETRY.nodeDiameter;
      const balanceFactor = entity.properties?.balanceFactor as
        | number
        | undefined;
      const badge = entity.properties?.badge as string | undefined;
      primitive = createTreeNode({
        id: rawId,
        x: pos.x,
        y: pos.y,
        value: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        highlight,
        diameter,
        balanceFactor,
        badge,
      });
      break;
    }

    case "GraphNode": {
      const diameter =
        (entity.properties?.diameter as number | undefined) ??
        TOKENS.GEOMETRY.nodeDiameter;
      const cleanLabel = sanitizeDisplayLabel(
        entity.value,
        entity.label,
        rawId,
      );
      primitive = createGraphNode({
        id: rawId,
        x: pos.x,
        y: pos.y,
        label: cleanLabel,
        value: entity.value as string | number | undefined,
        highlight,
        diameter,
      });
      break;
    }

    case "ArrayCell": {
      const width =
        (entity.properties?.width as number | undefined) ??
        TOKENS.GEOMETRY.cellWidth;
      const height =
        (entity.properties?.height as number | undefined) ??
        TOKENS.GEOMETRY.cellHeight;
      primitive = createArrayCell({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        value:
          typeof entity.value === "string" || typeof entity.value === "number"
            ? entity.value
            : String(entity.value ?? entity.label ?? ""),
        index: entity.properties?.index as number | undefined,
        highlight,
      });
      break;
    }

    case "LinkedListNode": {
      primitive = createLinkedListNode({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width: 80,
        height: 40,
        value:
          typeof entity.value === "string" || typeof entity.value === "number"
            ? entity.value
            : String(entity.value ?? entity.label ?? ""),
        highlight,
      });
      break;
    }

    case "CallFrame":
    case "StackFrame": {
      primitive = createCallFrame({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width: 140,
        height: 40,
        label: entity.label ?? String(entity.value ?? "Frame"),
        highlight,
      });
      break;
    }

    case "Annotation":
    case "Callout": {
      const text =
        (entity.properties?.text as string | undefined) ??
        entity.label ??
        String(entity.value ?? "");
      const title = entity.properties?.title as string | undefined;

      primitive = createAnnotationPrimitive({
        id: rawId,
        x: pos.x,
        y: pos.y,
        text,
        title,
        highlight,
        role: entity.semanticRole ?? "annotation",
      });
      break;
    }

    case "Client":
    case "ClientNode": {
      const width = (entity.properties?.width as number | undefined) ?? 120;
      const height = (entity.properties?.height as number | undefined) ?? 60;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, "Client"),
        shape: "rectangle",
        highlight,
        role: "client",
      });
      break;
    }

    case "Server":
    case "ServerNode": {
      const width = (entity.properties?.width as number | undefined) ?? 120;
      const height = (entity.properties?.height as number | undefined) ?? 60;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, "Server"),
        shape: "rectangle",
        highlight,
        role: "server",
      });
      break;
    }

    case "Actor": {
      const width = (entity.properties?.width as number | undefined) ?? 110;
      const height = (entity.properties?.height as number | undefined) ?? 54;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight,
        role: "actor",
      });
      break;
    }

    case "MessagePacket":
    case "Packet":
    case "Message": {
      const width = (entity.properties?.width as number | undefined) ?? 90;
      const height = (entity.properties?.height as number | undefined) ?? 36;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "accent",
        role: "message",
      });
      break;
    }

    case "DecisionNode":
    case "Decision": {
      const width = (entity.properties?.width as number | undefined) ?? 100;
      const height = (entity.properties?.height as number | undefined) ?? 70;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "diamond",
        highlight: highlight || "warning",
        role: "decision",
      });
      break;
    }

    case "CircleNode": {
      const diameter =
        (entity.properties?.diameter as number | undefined) ?? 70;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width: diameter,
        height: diameter,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "ellipse",
        highlight,
        role: "node",
      });
      break;
    }

    case "QueueItem": {
      const width = (entity.properties?.width as number | undefined) ?? 70;
      const height = (entity.properties?.height as number | undefined) ?? 38;

      const qState = (
        (entity.properties?.queueState as string) ||
        entity.state ||
        ""
      ).toUpperCase();

      const isStale = qState === "STALE" || entity.properties?.isStale === true;
      const isNew = qState === "NEW";
      const isProcessed = qState === "PROCESSED" || qState === "DONE";

      let queueLabel = sanitizeDisplayLabel(entity.value, entity.label, rawId);
      let strokeColor: string | undefined;
      let backgroundColor: string | undefined;
      let qHighlight = highlight;

      if (isStale) {
        queueLabel = `${queueLabel} (stale)`;
        strokeColor = "rgba(140, 140, 150, 0.45)";
        backgroundColor = "rgba(30, 30, 38, 0.35)";
        qHighlight = "muted";
      } else if (isNew) {
        queueLabel = `${queueLabel} (new)`;
        strokeColor = "#38bdf8";
        backgroundColor = "rgba(56, 189, 248, 0.15)";
        qHighlight = "accent";
      } else if (isProcessed) {
        queueLabel = `${queueLabel} ✓`;
        strokeColor = "rgba(100, 116, 139, 0.6)";
        backgroundColor = "rgba(30, 41, 59, 0.4)";
        qHighlight = "subdued";
      } else {
        // ACTIVE
        strokeColor = "#3b82f6";
        backgroundColor = "rgba(59, 130, 246, 0.2)";
        qHighlight = "primary";
      }

      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: queueLabel,
        shape: "rectangle",
        highlight: qHighlight,
        strokeColor,
        backgroundColor,
        role: "queue-element",
      });
      break;
    }

    case "EquationBlock": {
      const width = (entity.properties?.width as number | undefined) ?? 160;
      const height = (entity.properties?.height as number | undefined) ?? 44;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "primary",
        role: "equation",
      });
      break;
    }

    case "StateNode": {
      const diameter =
        (entity.properties?.diameter as number | undefined) ?? 60;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width: diameter,
        height: diameter,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "ellipse",
        highlight,
        role: "state_node",
      });
      break;
    }

    case "Table": {
      const rawTableName =
        (entity.properties?.tableName as string | undefined) ||
        (entity.label && !entity.label.startsWith("Component ")
          ? entity.label
          : undefined) ||
        (typeof entity.value === "string" ? entity.value : undefined) ||
        entity.id;

      // Internal Metadata Firewall: ensure clean human-readable table titles
      let tableName = sanitizeDisplayLabel(undefined, rawTableName, rawId);
      if (/^dist[-_]table/i.test(rawTableName) || rawTableName === "dist-table") {
        tableName = "Distance Table";
      } else if (/^freq[-_]table/i.test(rawTableName)) {
        tableName = "Frequency Table";
      } else if (/^state[-_]table/i.test(rawTableName)) {
        tableName = "State Table";
      } else if (/^table[-_]main$/i.test(rawTableName)) {
        tableName = "Data Table";
      }
      const columns =
        (entity.properties?.columns as any) ||
        (entity.properties?.headers as any);
      const rows = entity.properties?.rows as any;
      const highlightRowIndex = entity.properties?.highlightRowIndex as
        | number
        | undefined;

      const tableRes = createTablePrimitive({
        id: rawId,
        x: pos.x,
        y: pos.y,
        tableName,
        columns,
        rows,
        highlightRowIndex,
        highlight,
      });

      primitive = {
        primaryElement: tableRes.primaryElement,
        allElements: tableRes.allElements,
      };
      break;
    }

    case "DatabaseNode": {
      const width = (entity.properties?.width as number | undefined) ?? 130;
      const height = (entity.properties?.height as number | undefined) ?? 70;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight,
        role: "database",
      });
      break;
    }

    case "ProcessNode": {
      const width = (entity.properties?.width as number | undefined) ?? 130;
      const height = (entity.properties?.height as number | undefined) ?? 50;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight,
        role: "process",
      });
      break;
    }

    case "MemoryBlock": {
      const width = (entity.properties?.width as number | undefined) ?? 120;
      const height = (entity.properties?.height as number | undefined) ?? 40;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight,
        role: "memory",
      });
      break;
    }

    case "TrajectoryRay":
    case "Ray": {
      const width = (entity.properties?.width as number | undefined) ?? 160;
      const height = (entity.properties?.height as number | undefined) ?? 36;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "accent",
        role: "ray",
      });
      break;
    }

    case "Medium": {
      const width = (entity.properties?.width as number | undefined) ?? 220;
      const height = (entity.properties?.height as number | undefined) ?? 140;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "default",
        role: "medium",
      });
      break;
    }

    case "Boundary": {
      const width = (entity.properties?.width as number | undefined) ?? 180;
      const height = (entity.properties?.height as number | undefined) ?? 32;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "default",
        role: "boundary",
      });
      break;
    }

    case "Record":
    case "Header":
    case "Cell": {
      const width =
        (entity.properties?.width as number | undefined) ??
        (entity.primitiveType === "Cell" ? 60 : 140);
      const height = (entity.properties?.height as number | undefined) ?? 36;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight,
        role: entity.semanticRole ?? "data",
      });
      break;
    }

    case "BalanceIndicator": {
      const width = (entity.properties?.width as number | undefined) ?? 56;
      const height = (entity.properties?.height as number | undefined) ?? 24;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "warning",
        role: "indicator",
      });
      break;
    }

    case "ArrayIndex": {
      const width = (entity.properties?.width as number | undefined) ?? 40;
      const height = (entity.properties?.height as number | undefined) ?? 20;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "neutral",
        role: "array-index",
      });
      break;
    }

    case "ArrayRange": {
      const width = (entity.properties?.width as number | undefined) ?? 180;
      const height = (entity.properties?.height as number | undefined) ?? 40;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "accent",
        role: "range",
      });
      break;
    }

    case "Pointer":
    case "Reference": {
      const width = (entity.properties?.width as number | undefined) ?? 70;
      const height = (entity.properties?.height as number | undefined) ?? 32;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "primary",
        role: "pointer",
      });
      break;
    }

    case "ConditionNode": {
      const width = (entity.properties?.width as number | undefined) ?? 110;
      const height = (entity.properties?.height as number | undefined) ?? 70;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "diamond",
        highlight: highlight || "warning",
        role: "condition",
      });
      break;
    }

    case "FunctionNode": {
      const width = (entity.properties?.width as number | undefined) ?? 140;
      const height = (entity.properties?.height as number | undefined) ?? 54;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "primary",
        role: "function",
      });
      break;
    }

    case "ReturnValue":
    case "BaseCase": {
      const width = (entity.properties?.width as number | undefined) ?? 110;
      const height = (entity.properties?.height as number | undefined) ?? 40;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight:
          highlight ||
          (entity.primitiveType === "BaseCase" ? "success" : "accent"),
        role:
          entity.primitiveType === "BaseCase" ? "base-case" : "return-value",
      });
      break;
    }

    case "Request":
    case "Response":
    case "Connection": {
      const width = (entity.properties?.width as number | undefined) ?? 100;
      const height = (entity.properties?.height as number | undefined) ?? 40;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight:
          highlight ||
          (entity.primitiveType === "Response" ? "success" : "primary"),
        role: "message",
      });
      break;
    }

    case "HashBucket":
    case "HashEntry": {
      const width =
        (entity.properties?.width as number | undefined) ??
        (entity.primitiveType === "HashBucket" ? 140 : 100);
      const height = (entity.properties?.height as number | undefined) ?? 40;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "neutral",
        role: "hash-structure",
      });
      break;
    }

    case "Address": {
      const width = (entity.properties?.width as number | undefined) ?? 90;
      const height = (entity.properties?.height as number | undefined) ?? 30;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "neutral",
        role: "address",
      });
      break;
    }

    case "StepInfo":
    case "Label": {
      const width = (entity.properties?.width as number | undefined) ?? 120;
      const height = (entity.properties?.height as number | undefined) ?? 32;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight: highlight || "neutral",
        role: "label",
      });
      break;
    }

    case "Card":
    case "Panel":
    case "Cluster":
    case "Container":
    case "Group": {
      const width = (entity.properties?.width as number | undefined) ?? 200;
      const height = (entity.properties?.height as number | undefined) ?? 120;
      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape: "rectangle",
        highlight,
        role: entity.semanticRole ?? "container",
      });
      break;
    }

    case "GenericEntity":
    default: {
      const width = (entity.properties?.width as number | undefined) ?? 120;
      const height = (entity.properties?.height as number | undefined) ?? 60;
      const shape =
        (entity.properties?.shape as
          | "rectangle"
          | "ellipse"
          | "diamond"
          | undefined) ?? "rectangle";

      primitive = createGenericEntity({
        id: rawId,
        x: pos.x,
        y: pos.y,
        width,
        height,
        label: sanitizeDisplayLabel(entity.value, entity.label, rawId),
        shape,
        highlight,
        role: entity.semanticRole,
      });
      break;
    }
  }

  // Tag every created element with canonical semantic identity, preserving unique sub-dslIds
  const taggedElements = primitive.allElements.map((el) =>
    newElementWith(el, {
      customData: {
        ...(el.customData ?? {}),
        dslId: (el.customData?.dslId as string | undefined) ?? entity.id,
        semanticId: entity.id,
        primitiveType: entity.primitiveType,
        role:
          (el.customData?.role as string | undefined) ?? entity.semanticRole,
        isAiTeaching: true,
      },
    }),
  );

  const primaryElement =
    taggedElements.find((e) => e.id === primitive.primaryElement.id) ??
    taggedElements[0];

  return {
    primaryElement,
    allElements: taggedElements,
  };
}

/**
 * In-place update of existing Excalidraw elements for a semantic entity.
 * Preserves exact element IDs while updating positions, text labels, and styles.
 */
export function updateVisualPrimitive(
  existingElements: readonly ExcalidrawElement[],
  entity: SemanticEntity,
  targetPos: LayoutPoint,
): ExcalidrawElement[] {
  if (existingElements.length === 0) {
    return [];
  }

  // If Table, delegate to updateTablePrimitive for coherent multi-element update
  if (entity.primitiveType === "Table") {
    const tableName =
      (entity.properties?.tableName as string | undefined) ||
      (entity.label && !entity.label.startsWith("Component ")
        ? entity.label
        : undefined) ||
      (typeof entity.value === "string" ? entity.value : undefined) ||
      entity.id;
    const columns =
      (entity.properties?.columns as any) ||
      (entity.properties?.headers as any);
    const rows = entity.properties?.rows as any;
    const highlightRowIndex = entity.properties?.highlightRowIndex as
      | number
      | undefined;
    const highlight = entity.properties?.highlight as string | undefined;

    return updateTablePrimitive(existingElements, {
      id: entity.id,
      x: targetPos.x,
      y: targetPos.y,
      tableName,
      columns,
      rows,
      highlightRowIndex,
      highlight,
    });
  }

  // Identify the primary container or shape
  const primaryEl =
    existingElements.find((el) => el.type !== "text" && el.type !== "arrow") ??
    existingElements[0];

  const dx = targetPos.x - primaryEl.x;
  const dy = targetPos.y - primaryEl.y;

  const highlight = entity.properties?.highlight as string | undefined;
  const style = mapSemanticStateToNodeTokens(highlight);
  const newText = sanitizeDisplayLabel(entity.value, entity.label, entity.id);

  return existingElements.map((el) => {
    const updates: Record<string, unknown> = {
      x: el.x + dx,
      y: el.y + dy,
      isDeleted: false,
    };

    // Update style on shape elements
    if (el.type !== "text" && el.type !== "arrow" && el.type !== "line") {
      updates.strokeColor = style.stroke;
      updates.backgroundColor = style.fill;
      updates.strokeWidth = style.strokeWidth;
    }

    // Update text content on label elements
    if (el.type === "text" && newText != null) {
      const textEl = el as ExcalidrawTextElement;
      const subRole = textEl.customData?.subRole;
      if (subRole === "index") {
        if (entity.properties?.index !== undefined) {
          updates.text = String(entity.properties.index);
        }
      } else if (subRole === "label") {
        const cleanName = sanitizeDisplayLabel(
          entity.label,
          entity.label,
          entity.id,
        );
        updates.text = cleanName || newText;
        updates.strokeColor = style.textPrimary;
      } else if (!textEl.customData?.isSecondary || subRole === "value") {
        updates.text = newText;
        updates.strokeColor = style.textPrimary;
      }
    }

    // Refresh customData while preserving unique sub-dslIds
    updates.customData = {
      ...(el.customData ?? {}),
      dslId: (el.customData?.dslId as string | undefined) ?? entity.id,
      semanticId: entity.id,
      primitiveType: entity.primitiveType,
      role: (el.customData?.role as string | undefined) ?? entity.semanticRole,
      isAiTeaching: true,
    };

    return newElementWith(el, updates);
  });
}
