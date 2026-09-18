/**
 * Developer Diagnostics Mode — Cognora 5.0
 *
 * Provides a developer-only visual diagnostics overlay for debugging:
 * - bounding boxes
 * - semantic IDs & primitive types
 * - visual importance hierarchy
 * - connector routes & obstacle regions
 * - label candidate positions & collision scores
 *
 * Disabled completely in production.
 */

import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { VisualHierarchyLevel } from "./visual-hierarchy";

export interface DiagnosticsBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hierarchy?: VisualHierarchyLevel;
  primitiveType?: string;
  collisionScore?: number;
  isObstacle?: boolean;
}

export function isVisualDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return Boolean(
      (window as any).__COGNORA_DEBUG_RENDER__ ||
        window.localStorage?.getItem("cognora_debug_render") === "true",
    );
  } catch {
    return false;
  }
}

export function setVisualDebugEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    (window as any).__COGNORA_DEBUG_RENDER__ = enabled;
    if (enabled) {
      window.localStorage?.setItem("cognora_debug_render", "true");
    } else {
      window.localStorage?.removeItem("cognora_debug_render");
    }
  } catch {
    // Ignore storage errors
  }
}

export function generateDiagnosticsElements(
  boxes: DiagnosticsBox[],
): ExcalidrawElement[] {
  if (!isVisualDebugEnabled() || boxes.length === 0) {
    return [];
  }

  const debugElements: ExcalidrawElement[] = [];

  for (const box of boxes) {
    const strokeColor =
      box.hierarchy === "PRIMARY"
        ? "#ef4444" // red
        : box.hierarchy === "SECONDARY"
        ? "#3b82f6" // blue
        : box.hierarchy === "EXPLANATORY"
        ? "#8b5cf6" // purple
        : "#94a3b8"; // gray

    // Debug bounding box
    const rect = newElement({
      type: "rectangle",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      strokeColor,
      backgroundColor: strokeColor,
      fillStyle: "solid",
      opacity: 12,
      strokeWidth: 1,
      strokeStyle: "dashed",
      roughness: 0,
      customData: {
        isDiagnostic: true,
        debugTargetId: box.id,
      },
    });
    debugElements.push(rect);

    // Debug label tag
    const debugTag = `${box.id} [${
      box.primitiveType || box.hierarchy || "box"
    }]${
      box.collisionScore !== undefined ? ` score:${box.collisionScore}` : ""
    }`;

    const text = newTextElement({
      text: debugTag,
      x: box.x,
      y: Math.max(0, box.y - 14),
      fontSize: 10,
      fontFamily: 3, // Mono
      strokeColor,
      customData: {
        isDiagnostic: true,
        debugTargetId: box.id,
      },
    });
    debugElements.push(text);
  }

  return debugElements;
}
