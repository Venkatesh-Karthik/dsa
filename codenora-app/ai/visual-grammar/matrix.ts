import { newElement, newTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { computeGridLayout } from "../layout-engine";
import { LAYOUT } from "../visual-renderer";
import { createArrayCell } from "../visual-primitives/array-cell";
import { TYPOGRAPHY, FONT_FAMILY } from "../visual-primitives/typography";

import type {
  CreateMatrixAction,
  ArrayElementHighlight,
  SemanticColor,
} from "../visual-dsl";
import type { RenderContext } from "../visual-renderer";

function highlightToColor(
  h?: ArrayElementHighlight,
): SemanticColor | undefined {
  switch (h) {
    case "low":
    case "high":
      return "accent";
    case "mid":
      return "warning";
    case "target":
    case "found":
      return "success";
    case "eliminated":
      return "neutral";
    default:
      return undefined;
  }
}

export function renderMatrixGrammar(
  action: CreateMatrixAction,
  context: RenderContext,
): ExcalidrawElement[] {
  const {
    ARRAY_ELEMENT_WIDTH: W,
    ARRAY_ELEMENT_HEIGHT: H,
    ARRAY_ELEMENT_GAP: GAP,
  } = LAYOUT;
  const elements: ExcalidrawElement[] = [];
  const titleHeight = action.label ? LAYOUT.ARRAY_LABEL_OFFSET : 0;

  const hasRowHeaders = action.rowHeaders && action.rowHeaders.length > 0;
  const hasColHeaders = action.colHeaders && action.colHeaders.length > 0;

  const headerOffset = 40;
  const originX = context.cursor.x + (hasRowHeaders ? headerOffset : 0);
  const originY =
    context.cursor.y + titleHeight + (hasColHeaders ? headerOffset : 0);

  if (action.label) {
    const titleEl = newTextElement({
      text: action.label,
      x: context.cursor.x,
      y: context.cursor.y,
      fontSize: TYPOGRAPHY.Title.fontSize,
      fontFamily: TYPOGRAPHY.Title.fontFamily,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#1e1e1e",
      customData: { dslId: `${action.id}-title` },
    });
    elements.push(titleEl);
  }

  const numRows = action.rows.length;
  const numCols = numRows > 0 ? action.rows[0].length : 0;

  const layout = computeGridLayout(numRows, numCols, {
    x: originX,
    y: originY,
  });

  if (hasColHeaders) {
    for (let c = 0; c < numCols; c++) {
      const text = action.colHeaders![c];
      const cx = originX + c * (W + GAP) + W / 2;
      const cy = originY - headerOffset / 2;
      const headerEl = newTextElement({
        text,
        x: cx,
        y: cy - 9,
        fontSize: 14,
        fontFamily: FONT_FAMILY.SANS,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#868e96",
        customData: { dslId: `${action.id}-col-header-${c}` },
      });
      elements.push(headerEl);
    }
  }

  if (hasRowHeaders) {
    for (let r = 0; r < numRows; r++) {
      const text = action.rowHeaders![r];
      const cx = originX - headerOffset / 2;
      const cy = originY + r * (H + GAP) + H / 2;
      const headerEl = newTextElement({
        text,
        x: cx,
        y: cy - 9,
        fontSize: 14,
        fontFamily: FONT_FAMILY.SANS,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#868e96",
        customData: { dslId: `${action.id}-row-header-${r}` },
      });
      elements.push(headerEl);
    }
  }

  const highlights = new Map(
    action.highlights?.map((h) => [`${h.row}-${h.col}`, h.color]),
  );

  for (const [key, pos] of layout.cellPositions) {
    const parts = key.split("-");
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    const value = action.rows[row]?.[col] ?? "";

    const highlight = highlights.get(`${row}-${col}`);

    const primitive = createArrayCell({
      id: `${action.id}-${row}-${col}`,
      x: pos.x,
      y: pos.y,
      width: W,
      height: H,
      value: String(value),
      highlight,
    });

    elements.push(...primitive.allElements);
    context.register(
      `${action.id}-${row}-${col}`,
      primitive.primaryElement,
      primitive.allElements.find((e) => e.type === "text") as any,
      primitive.allElements,
    );
  }

  const bounds = layout.bounds;
  const matrixContainer = newElement({
    type: "rectangle",
    x: originX,
    y: originY,
    width: bounds.width || W,
    height: bounds.height || H,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    opacity: 0,
    roughness: 0,
    roundness: null,
    customData: { dslId: action.id, role: "container" },
  });
  elements.push(matrixContainer);
  const metadata: ExcalidrawElement[] = [matrixContainer];
  context.register(action.id, matrixContainer, undefined, metadata);

  context.cursor.x =
    originX + (bounds.width || W) + context.options.horizontalGap;

  return elements;
}
