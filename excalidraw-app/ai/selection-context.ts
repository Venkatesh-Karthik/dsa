/**
 * Selection-Aware Semantic Context Engine
 *
 * Extracts structured computer science semantic context from user-selected
 * whiteboard elements to inform follow-up questions and targeted AI tutoring.
 */

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";
import type { SelectedSemanticElement } from "./teaching-contract";

/**
 * Extracts compact semantic context for all currently selected canvas elements.
 */
export function extractSelectedElementsContext(
  sceneElements: readonly ExcalidrawElement[],
  selectedElementIds: Record<string, boolean> | readonly string[] | null | undefined,
): SelectedSemanticElement[] {
  if (!selectedElementIds || !sceneElements.length) {
    return [];
  }

  const selectedSet = new Set<string>();
  if (Array.isArray(selectedElementIds)) {
    for (const id of selectedElementIds) {
      selectedSet.add(id);
    }
  } else if (typeof selectedElementIds === "object") {
    for (const [id, isSelected] of Object.entries(selectedElementIds)) {
      if (isSelected) {
        selectedSet.add(id);
      }
    }
  }

  if (selectedSet.size === 0) {
    return [];
  }

  // Build element lookup maps
  const elementById = new Map<string, ExcalidrawElement>();
  const elementByDslId = new Map<string, ExcalidrawElement>();
  const arrowElements: ExcalidrawLinearElement[] = [];

  for (const el of sceneElements) {
    if (el.isDeleted) {
      continue;
    }
    elementById.set(el.id, el);
    if (el.customData?.dslId) {
      elementByDslId.set(el.customData.dslId as string, el);
    }
    if (el.type === "arrow") {
      arrowElements.push(el as ExcalidrawLinearElement);
    }
  }

  const results: SelectedSemanticElement[] = [];
  const processedDslIds = new Set<string>();

  for (const id of selectedSet) {
    const el = elementById.get(id);
    if (!el || el.isDeleted) {
      continue;
    }

    const dslId = (el.customData?.dslId as string) || el.id;
    if (processedDslIds.has(dslId)) {
      continue;
    }
    processedDslIds.add(dslId);

    const role = el.customData?.role as string | undefined;
    const stepIndex = el.customData?.stepIndex as number | undefined;

    // Determine label / value
    let label: string | undefined;
    if (el.type === "text") {
      label = (el as ExcalidrawTextElement).text;
    } else if (el.customData?.value !== undefined) {
      label = String(el.customData.value);
    } else if (el.customData?.label !== undefined) {
      label = String(el.customData.label);
    } else if (el.boundElements) {
      // Find bound text
      for (const bound of el.boundElements) {
        if (bound.type === "text") {
          const boundEl = elementById.get(bound.id) as ExcalidrawTextElement;
          if (boundEl?.text) {
            label = boundEl.text;
            break;
          }
        }
      }
    }

    // Determine parent structure
    let parentStructureId: string | undefined = el.customData
      ?.structureId as string | undefined;

    if (!parentStructureId && dslId.includes("-")) {
      // e.g. "tree-node-10" or "arr-0"
      const parts = dslId.split("-");
      if (parts.length > 1) {
        parentStructureId = parts.slice(0, -1).join("-");
      }
    }

    // Inspect incoming and outgoing arrows
    const incomingArrows: Array<{ fromId: string; label?: string }> = [];
    const outgoingArrows: Array<{ toId: string; label?: string }> = [];

    for (const arrow of arrowElements) {
      // Direct binding check
      const startBoundId = arrow.startBinding?.elementId;
      const endBoundId = arrow.endBinding?.elementId;

      const arrowLabel =
        (arrow.customData?.label as string) ||
        (arrow.customData?.text as string) ||
        undefined;

      if (startBoundId === el.id) {
        const targetEl = endBoundId ? elementById.get(endBoundId) : null;
        const toId =
          (targetEl?.customData?.dslId as string) || endBoundId || "unknown";
        outgoingArrows.push({ toId, label: arrowLabel });
      } else if (endBoundId === el.id) {
        const sourceEl = startBoundId ? elementById.get(startBoundId) : null;
        const fromId =
          (sourceEl?.customData?.dslId as string) || startBoundId || "unknown";
        incomingArrows.push({ fromId, label: arrowLabel });
      } else if (arrow.customData?.dslFrom === dslId) {
        outgoingArrows.push({
          toId: (arrow.customData?.dslTo as string) || "unknown",
          label: arrowLabel,
        });
      } else if (arrow.customData?.dslTo === dslId) {
        incomingArrows.push({
          fromId: (arrow.customData?.dslFrom as string) || "unknown",
          label: arrowLabel,
        });
      }
    }

    results.push({
      dslId,
      role,
      type: el.type,
      label,
      parentStructureId,
      incomingArrows: incomingArrows.length > 0 ? incomingArrows : undefined,
      outgoingArrows: outgoingArrows.length > 0 ? outgoingArrows : undefined,
      stepIndex,
    });
  }

  return results;
}

/**
 * Creates a human-readable badge or summary chip label for the active selection.
 */
export function formatSelectedElementChip(
  selected: SelectedSemanticElement[],
): string | null {
  if (!selected.length) {
    return null;
  }
  const first = selected[0];
  const name = first.label ? `"${first.label}"` : first.dslId;
  const roleText = first.role ? ` (${first.role})` : "";
  if (selected.length === 1) {
    return `Selected: ${name}${roleText}`;
  }
  return `Selected: ${name} +${selected.length - 1} more`;
}
