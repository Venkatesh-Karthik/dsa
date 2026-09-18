/**
 * Cognora Semantic Focus Resolver
 *
 * Dynamically resolves the semantic focus (primary and secondary target objects)
 * from the active transformation and semantic scene state without concept-specific
 * hardcoding.
 *
 * Pipeline:
 * Transformation Data -> Semantic Focus -> Target Entity ID -> Visual Element -> Callout Anchor
 */

import { ExplanationEngine } from "../ai/explanation-engine";

import type { Transformation } from "../ai/visual-dsl";

export interface ResolvedSemanticFocus {
  primaryTargetId: string | null;
  secondaryTargetIds: string[];
  primaryElement: any | null;
  secondaryElements: any[];
  focusReason: string;
}

/**
 * Normalizes an identifier or label for robust fuzzy resolution.
 */
function normalizeId(val?: string | number): string {
  if (val === undefined || val === null) {
    return "";
  }
  return String(val).toLowerCase().trim();
}

/**
 * Searches the Excalidraw scene for an element that corresponds to a target identifier.
 */
export function resolveElementInScene(
  targetId: string,
  sceneElements?: readonly any[],
): any | null {
  if (!targetId || !sceneElements || sceneElements.length === 0) {
    return null;
  }

  const normTarget = normalizeId(targetId);
  const targetNum = targetId.match(/\d+$/)?.[0];

  // 1. Exact ID or customData match
  for (const el of sceneElements) {
    if (el.isDeleted) {
      continue;
    }
    const dslId = normalizeId(el.customData?.dslId);
    const nodeId = normalizeId(el.customData?.nodeId);
    const rawId = normalizeId(el.id);

    if (dslId === normTarget || nodeId === normTarget || rawId === normTarget) {
      return el;
    }
  }

  // 2. Suffix match (e.g. "tree-node-27" or "ll-node-27" matching "27" or "node-27")
  for (const el of sceneElements) {
    if (el.isDeleted) {
      continue;
    }
    const dslId = normalizeId(el.customData?.dslId);
    const nodeId = normalizeId(el.customData?.nodeId);

    if (
      (dslId &&
        (dslId.endsWith(`-${normTarget}`) ||
          dslId.endsWith(`_${normTarget}`))) ||
      (nodeId &&
        (nodeId.endsWith(`-${normTarget}`) ||
          nodeId.endsWith(`_${normTarget}`)))
    ) {
      return el;
    }

    if (
      targetNum &&
      dslId &&
      (dslId.endsWith(`-${targetNum}`) || dslId.endsWith(`_${targetNum}`))
    ) {
      return el;
    }
  }

  // 3. Label or text element matching
  let matchedTextEl: any | null = null;
  for (const el of sceneElements) {
    if (el.isDeleted) {
      continue;
    }
    const label = normalizeId(el.customData?.label);
    if (label && label === normTarget) {
      return el;
    }

    if (el.type === "text" && normalizeId(el.text) === normTarget) {
      matchedTextEl = el;
    }
  }

  // If a text element was matched and shares a group or container with a shape, prefer the shape
  if (matchedTextEl) {
    if (matchedTextEl.groupIds && matchedTextEl.groupIds.length > 0) {
      const gId = matchedTextEl.groupIds[0];
      const shape = sceneElements.find(
        (e) =>
          !e.isDeleted &&
          e.id !== matchedTextEl.id &&
          e.groupIds?.includes(gId),
      );
      if (shape) {
        return shape;
      }
    }
    return matchedTextEl;
  }

  return null;
}

/**
 * Dynamically resolves the primary and secondary semantic focus from a transformation.
 */
export function resolveSemanticFocus(
  transformation?: Transformation | null,
  sceneElements?: readonly any[],
  selectedContextIds?: string[],
): ResolvedSemanticFocus {
  if (!transformation) {
    return {
      primaryTargetId: null,
      secondaryTargetIds: [],
      primaryElement: null,
      secondaryElements: [],
      focusReason: "none",
    };
  }

  const primaryCandidates: string[] = [];
  const secondaryCandidates: string[] = [];
  let focusReason = "fallback";

  // Strategy 1: Explicit transformation highlights
  if (transformation.highlights && transformation.highlights.length > 0) {
    for (const h of transformation.highlights) {
      const hId =
        typeof h === "string" ? h : (h as any).id || (h as any).target;
      if (hId && !primaryCandidates.includes(hId)) {
        primaryCandidates.push(String(hId));
      }
    }
    if (primaryCandidates.length > 0) {
      focusReason = "explicit_highlights";
    }
  }

  // Strategy 2: High-level operations inspection
  if (
    primaryCandidates.length === 0 &&
    transformation.operations &&
    transformation.operations.length > 0
  ) {
    for (const op of transformation.operations) {
      const opType = (op as any).type;

      if (opType === "highlight" && (op as any).target) {
        primaryCandidates.push(String((op as any).target));
        focusReason = "operation_highlight";
      } else if (opType === "annotate_pointer" && (op as any).target) {
        primaryCandidates.push(String((op as any).target));
        focusReason = "operation_pointer";
      } else if (opType === "reorder" && (op as any).target) {
        primaryCandidates.push(String((op as any).target));
        if ((op as any).swapWith) {
          secondaryCandidates.push(String((op as any).swapWith));
        }
        focusReason = "operation_swap";
      } else if (
        (opType === "connect" || opType === "arrow") &&
        (op as any).to
      ) {
        primaryCandidates.push(String((op as any).to));
        if ((op as any).from) {
          secondaryCandidates.push(String((op as any).from));
        }
        focusReason = "operation_connect";
      } else if (
        (opType === "create_box" || opType === "create_circle") &&
        (op as any).id
      ) {
        primaryCandidates.push(String((op as any).id));
        focusReason = "operation_create";
      } else if (opType === "update" && (op as any).target) {
        primaryCandidates.push(String((op as any).target));
        focusReason = "operation_update";
      } else if (opType === "delete" && (op as any).target) {
        primaryCandidates.push(String((op as any).target));
        focusReason = "operation_delete";
      } else if (
        (opType === "create_linked_list" ||
          opType === "create_tree" ||
          opType === "create_array") &&
        Array.isArray((op as any).elements)
      ) {
        const highlightedEl = (op as any).elements.find(
          (el: any) => el.highlight && el.highlight !== "default",
        );
        if (highlightedEl) {
          primaryCandidates.push(String(highlightedEl.value ?? (op as any).id));
          focusReason = "operation_element_highlight";
        }
      }
    }
  }

  // Strategy 3: Semantic entity tokens in title and explanation
  if (
    primaryCandidates.length === 0 &&
    (transformation.title || transformation.explanation)
  ) {
    const textCorpus = `${transformation.title || ""} ${
      transformation.explanation || ""
    }`;
    const scrubbedCorpus = ExplanationEngine.scrubMetadata(textCorpus);

    // Extract potential values / labels mentioned (numbers, single capital letters, quoted labels)
    const matches = scrubbedCorpus.match(
      /(?:(?:node|element|value|pivot|insert|delete|relax)\s+)?\b([A-Z]|\d+)\b/gi,
    );
    if (matches && sceneElements && sceneElements.length > 0) {
      for (const m of matches) {
        const token = m
          .replace(/^(?:node|element|value|pivot|insert|delete|relax)\s+/i, "")
          .trim();
        const el = resolveElementInScene(token, sceneElements);
        if (el) {
          const elId = (el.customData?.dslId as string) || el.id;
          if (!primaryCandidates.includes(elId)) {
            primaryCandidates.push(elId);
            focusReason = "semantic_text_entity";
          }
        }
      }
    }
  }

  // Strategy 4: Selected Context Fallback
  if (
    primaryCandidates.length === 0 &&
    selectedContextIds &&
    selectedContextIds.length > 0
  ) {
    primaryCandidates.push(selectedContextIds[0]);
    if (selectedContextIds.length > 1) {
      secondaryCandidates.push(...selectedContextIds.slice(1));
    }
    focusReason = "selected_context";
  }

  const primaryTargetId =
    primaryCandidates.length > 0 ? primaryCandidates[0] : null;
  const secondaryTargetIds = [
    ...primaryCandidates.slice(1),
    ...secondaryCandidates,
  ].filter((id) => id !== primaryTargetId);

  // Resolve to actual Excalidraw scene elements
  const primaryElement = primaryTargetId
    ? resolveElementInScene(primaryTargetId, sceneElements)
    : null;

  const secondaryElements = secondaryTargetIds
    .map((id) => resolveElementInScene(id, sceneElements))
    .filter(Boolean);

  return {
    primaryTargetId,
    secondaryTargetIds,
    primaryElement,
    secondaryElements,
    focusReason,
  };
}
