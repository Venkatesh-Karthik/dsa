/**
 * Universal Table Visual Primitive — Cognora
 *
 * First-class compound visual primitive representing structured tabular data,
 * relational schemas, database result sets, matrices, and records.
 *
 * Guarantees:
 * 1. Single authoritative bounding box enclosing all headers, rows, and cells.
 * 2. Deterministic, collision-free sub-IDs for every child element:
 *    - Container: `${tableId}`
 *    - Title: `${tableId}__title`
 *    - Column Header: `${tableId}__col_${c}`
 *    - Row Highlight: `${tableId}__row_bg_${r}`
 *    - Row Divider: `${tableId}__row_line_${r}`
 *    - Cell: `${tableId}__cell_${r}_${c}`
 * 3. Geometry calculated strictly top-down:
 *    Parent position & bounds -> Column widths -> Cell coordinates.
 * 4. Text measurement prevents clipping, text overflow, or unnatural wrapping.
 */

import {
  newElement,
  newTextElement,
  newElementWith,
} from "@excalidraw/element";

import { ROUNDNESS } from "@excalidraw/common";

import type { ExcalidrawElement, FillStyle } from "@excalidraw/element/types";

import { measureTextBounds } from "../layout-engine";

import { TOKENS, PALETTE, FONT_FAMILY } from "./design-tokens";

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
}

export interface TableRow {
  key?: string;
  values: (string | number)[];
  highlight?:
    | "active"
    | "matched"
    | "filtered"
    | "danger"
    | "success"
    | "warning"
    | "default"
    | string;
}

export interface TablePrimitiveProps {
  id: string;
  x: number;
  y: number;
  tableName?: string;
  columns?: (string | TableColumn)[];
  rows?: (TableRow | (string | number)[] | Record<string, any>)[];
  highlightRowIndex?: number;
  highlight?: string;
  width?: number;
  height?: number;
  strokeColor?: string;
  backgroundColor?: string;
}

export interface TablePrimitiveResult {
  primaryElement: ExcalidrawElement;
  allElements: ExcalidrawElement[];
  bounds: { x: number; y: number; width: number; height: number };
  columnWidths: number[];
  headerHeight: number;
  rowHeight: number;
}

/**
 * Normalizes input column specifications.
 */
export function normalizeColumns(
  rawColumns?: (string | TableColumn)[],
  rows?: (TableRow | (string | number)[] | Record<string, any>)[],
): TableColumn[] {
  if (rawColumns && rawColumns.length > 0) {
    return rawColumns.map((col, idx) => {
      if (typeof col === "string") {
        return { key: `col_${idx}`, title: col };
      }
      return {
        key: col.key || `col_${idx}`,
        title: col.title || col.key || `Col ${idx + 1}`,
        width: col.width,
      };
    });
  }

  // If no explicit columns, infer from first row if object
  if (rows && rows.length > 0) {
    const first = rows[0];
    if (
      first &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      !("values" in first)
    ) {
      return Object.keys(first).map((k) => ({ key: k, title: k }));
    }
    if (Array.isArray(first)) {
      return first.map((_, i) => ({ key: `col_${i}`, title: `Col ${i + 1}` }));
    }
    if ("values" in first && Array.isArray(first.values)) {
      return first.values.map((_, i) => ({
        key: `col_${i}`,
        title: `Col ${i + 1}`,
      }));
    }
  }

  return [
    { key: "col_0", title: "ID" },
    { key: "col_1", title: "Value" },
  ];
}

/**
 * Normalizes input row specifications.
 */
export function normalizeRows(
  rawRows?: (TableRow | (string | number)[] | Record<string, any>)[],
  columns?: TableColumn[],
): TableRow[] {
  if (!rawRows || rawRows.length === 0) {
    return [];
  }

  return rawRows.map((row, rIdx) => {
    if (Array.isArray(row)) {
      return { key: `row_${rIdx}`, values: row };
    }
    if ("values" in row && Array.isArray(row.values)) {
      return {
        key: row.key || `row_${rIdx}`,
        values: row.values,
        highlight: row.highlight,
      };
    }
    if (typeof row === "object" && row !== null && columns) {
      const vals = columns.map(
        (c) => (row as Record<string, any>)[c.key] ?? "",
      );
      return {
        key: `row_${rIdx}`,
        values: vals,
        highlight: (row as any).highlight,
      };
    }
    return { key: `row_${rIdx}`, values: [String(row)] };
  });
}

/**
 * Computes deterministic, collision-free geometry for table columns based on text measurement.
 */
export function computeTableColumnWidths(
  columns: TableColumn[],
  rows: TableRow[],
  minColWidth = 72,
  padding = 24,
): number[] {
  const colWidths: number[] = [];

  for (let c = 0; c < columns.length; c++) {
    const col = columns[c];
    if (col.width && col.width > 0) {
      colWidths.push(col.width);
      continue;
    }

    // Measure column title
    const titleBounds = measureTextBounds(col.title || "", 12, 16);
    let maxW = titleBounds.width;

    // Measure each row's cell value for this column
    for (const r of rows) {
      const val = String(r.values[c] ?? "");
      if (val) {
        const valBounds = measureTextBounds(val, 12, 16);
        if (valBounds.width > maxW) {
          maxW = valBounds.width;
        }
      }
    }

    colWidths.push(
      Math.max(minColWidth, Math.min(260, Math.round(maxW + padding))),
    );
  }

  return colWidths;
}

/**
 * Creates an authoritative, compound Table visual primitive on Excalidraw canvas.
 */
export function createTablePrimitive(
  props: TablePrimitiveProps,
): TablePrimitiveResult {
  const {
    id,
    x,
    y,
    tableName,
    columns: rawCols,
    rows: rawRows,
    highlightRowIndex,
    highlight,
    strokeColor = PALETTE.slate300,
    backgroundColor = PALETTE.white,
  } = props;

  const columns = normalizeColumns(rawCols, rawRows);
  const rows = normalizeRows(rawRows, columns);
  const colWidths = computeTableColumnWidths(columns, rows);

  const totalTableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const hasTitle = Boolean(tableName && tableName.trim().length > 0);
  const titleHeight = hasTitle ? 30 : 0;
  const headerHeight = 32;
  const rowHeight = 30;
  const totalTableHeight =
    titleHeight + headerHeight + Math.max(1, rows.length) * rowHeight;

  const groupId = `${id}-table-group`;
  const allElements: ExcalidrawElement[] = [];

  // 1. Outer Container Box (The authoritative parent element)
  const container = newElement({
    type: "rectangle",
    x,
    y,
    width: totalTableWidth,
    height: totalTableHeight,
    strokeColor: highlight ? PALETTE.blue500 : strokeColor,
    backgroundColor,
    fillStyle: "solid",
    strokeWidth: highlight ? 2 : 1.5,
    roughness: 0,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    groupIds: [groupId],
    customData: {
      dslId: id,
      semanticId: id,
      subId: "container",
      role: "table",
      tableName,
      rowCount: rows.length,
      colCount: columns.length,
      isAiTeaching: true,
    },
  });
  allElements.push(container);

  let currentY = y;

  // 2. Title Bar (if present)
  if (hasTitle) {
    const titleText = newTextElement({
      text: tableName!,
      x: x + 12,
      y: currentY + 6,
      fontSize: 13,
      fontFamily: FONT_FAMILY.SANS,
      textAlign: "left",
      verticalAlign: "middle",
      strokeColor: PALETTE.slate800,
      groupIds: [groupId],
      customData: {
        dslId: `${id}__title`,
        semanticId: id,
        subId: "title",
        role: "table-title",
        isAiTeaching: true,
      },
    });
    allElements.push(titleText);
    currentY += titleHeight;
  }

  // 3. Header Background Strip
  const headerBg = newElement({
    type: "rectangle",
    x,
    y: currentY,
    width: totalTableWidth,
    height: headerHeight,
    strokeColor: "transparent",
    backgroundColor: PALETTE.slate100,
    fillStyle: "solid",
    strokeWidth: 0,
    roughness: 0,
    roundness: null,
    groupIds: [groupId],
    customData: {
      dslId: `${id}__header_bg`,
      semanticId: id,
      subId: "header_bg",
      role: "table-header-bg",
      isAiTeaching: true,
    },
  });
  allElements.push(headerBg);

  // 4. Header Columns
  let colX = x;
  for (let c = 0; c < columns.length; c++) {
    const col = columns[c];
    const w = colWidths[c];

    const colTitleEl = newTextElement({
      text: col.title,
      x: colX + 10,
      y: currentY + 8,
      fontSize: 12,
      fontFamily: FONT_FAMILY.SANS,
      textAlign: "left",
      verticalAlign: "middle",
      strokeColor: PALETTE.slate700,
      groupIds: [groupId],
      customData: {
        dslId: `${id}__col_${c}`,
        semanticId: id,
        subId: `col_${c}`,
        colKey: col.key,
        role: "column-header",
        isAiTeaching: true,
      },
    });
    allElements.push(colTitleEl);

    // Vertical column separator (internal dividers only)
    if (c > 0) {
      const vLine = newElement({
        type: "rectangle",
        x: colX,
        y: currentY,
        width: 1,
        height: totalTableHeight - (currentY - y),
        strokeColor: PALETTE.slate200,
        backgroundColor: PALETTE.slate200,
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        groupIds: [groupId],
        customData: {
          dslId: `${id}__vline_${c}`,
          semanticId: id,
          subId: `vline_${c}`,
          role: "table-vdivider",
          isAiTeaching: true,
        },
      });
      allElements.push(vLine);
    }

    colX += w;
  }

  currentY += headerHeight;

  // Header bottom divider line
  const headerDivider = newElement({
    type: "rectangle",
    x,
    y: currentY,
    width: totalTableWidth,
    height: 1,
    strokeColor: PALETTE.slate300,
    backgroundColor: PALETTE.slate300,
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    groupIds: [groupId],
    customData: {
      dslId: `${id}__header_line`,
      semanticId: id,
      subId: "header_line",
      role: "table-hdivider",
      isAiTeaching: true,
    },
  });
  allElements.push(headerDivider);

  // 5. Data Rows and Cells
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const isRowActive =
      r === highlightRowIndex ||
      row.highlight === "active" ||
      row.highlight === "matched" ||
      row.highlight === "match";

    const isRowDanger =
      row.highlight === "danger" || row.highlight === "eliminated";
    const isRowSuccess = row.highlight === "success";

    // Row background highlight element (instantiated for all rows for stable identity)
    const isHighlighted = isRowActive || isRowDanger || isRowSuccess;
    const rowBgColor = isRowDanger
      ? PALETTE.rose50
      : isRowSuccess
      ? PALETTE.green50
      : PALETTE.blue50;

    const rowBg = newElement({
      type: "rectangle",
      x: x + 1,
      y: currentY,
      width: totalTableWidth - 2,
      height: rowHeight,
      strokeColor: "transparent",
      backgroundColor: rowBgColor,
      fillStyle: "solid",
      strokeWidth: 0,
      roughness: 0,
      roundness: null,
      groupIds: [groupId],
      customData: {
        dslId: `${id}__row_bg_${r}`,
        semanticId: id,
        subId: `row_bg_${r}`,
        rowIdx: r,
        role: "row-highlight",
        isAiTeaching: true,
      },
    });
    if (!isHighlighted) {
      (rowBg as any).isDeleted = true;
    }
    allElements.push(rowBg);

    // Cells in this row
    let cellX = x;
    for (let c = 0; c < columns.length; c++) {
      const cellVal = String(row.values[c] ?? "");
      const w = colWidths[c];

      const textColor = isRowDanger
        ? PALETTE.rose600
        : isRowActive
        ? PALETTE.blue600
        : PALETTE.slate800;

      const cellText = newTextElement({
        text: cellVal,
        x: cellX + 10,
        y: currentY + 7,
        fontSize: 12,
        fontFamily: FONT_FAMILY.MONO,
        textAlign: "left",
        verticalAlign: "middle",
        strokeColor: textColor,
        groupIds: [groupId],
        customData: {
          dslId: `${id}__cell_${r}_${c}`,
          semanticId: id,
          subId: `cell_${r}_${c}`,
          rowIdx: r,
          colIdx: c,
          value: cellVal,
          role: "cell",
          isAiTeaching: true,
        },
      });
      allElements.push(cellText);
      cellX += w;
    }

    currentY += rowHeight;

    // Row bottom divider line (between rows, omit for last row to keep bottom rounded border clean)
    if (r < rows.length - 1) {
      const rowLine = newElement({
        type: "rectangle",
        x,
        y: currentY,
        width: totalTableWidth,
        height: 1,
        strokeColor: PALETTE.slate200,
        backgroundColor: PALETTE.slate200,
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        groupIds: [groupId],
        customData: {
          dslId: `${id}__row_line_${r}`,
          semanticId: id,
          subId: `row_line_${r}`,
          rowIdx: r,
          role: "table-hdivider",
          isAiTeaching: true,
        },
      });
      allElements.push(rowLine);
    }
  }

  // Authoritative deterministic ID stamping
  for (const el of allElements) {
    const dslId = el.customData?.dslId as string | undefined;
    if (dslId) {
      (el as any).id = dslId;
    }
  }

  return {
    primaryElement: container,
    allElements,
    bounds: {
      x,
      y,
      width: totalTableWidth,
      height: totalTableHeight,
    },
    columnWidths: colWidths,
    headerHeight,
    rowHeight,
  };
}

/**
 * Updates an existing Table primitive in place without regenerating random element IDs.
 * Translates all child elements coherently by (dx, dy).
 * Updates cell text values, row highlights, and handles row insertion / deletion.
 */
export function updateTablePrimitive(
  existingElements: readonly ExcalidrawElement[],
  propsOrEntity: TablePrimitiveProps | any,
  pos?: { x: number; y: number },
): ExcalidrawElement[] {
  let props: TablePrimitiveProps;
  if ("primitiveType" in propsOrEntity) {
    const entity = propsOrEntity;
    props = {
      id: entity.id,
      x: pos?.x ?? 0,
      y: pos?.y ?? 0,
      tableName: (entity.properties?.tableName as string) || entity.label,
      columns: entity.properties?.columns as any,
      rows: entity.properties?.rows as any,
      highlightRowIndex: entity.properties?.highlightRowIndex as
        | number
        | undefined,
      highlight: entity.properties?.isHighlighted ? "active" : undefined,
    };
  } else {
    props = { ...propsOrEntity };
    if (pos) {
      props.x = pos.x;
      props.y = pos.y;
    }
  }

  if (existingElements.length === 0) {
    return createTablePrimitive(props).allElements;
  }

  // Find container
  const container =
    existingElements.find((e) => e.customData?.subId === "container") ||
    existingElements[0];

  const targetX = props.x ?? container.x;
  const targetY = props.y ?? container.y;
  const dx = Math.round(targetX - container.x);
  const dy = Math.round(targetY - container.y);

  // Index existing elements by subId for precise in-place updates
  const existingBySubId = new Map<string, ExcalidrawElement>();
  for (const el of existingElements) {
    const subId = el.customData?.subId as string | undefined;
    if (subId) {
      existingBySubId.set(subId, el);
    }
  }

  const prevRows = (container.customData?.rowCount as number | undefined) ?? -1;
  const prevCols = (container.customData?.colCount as number | undefined) ?? -1;
  const columns = normalizeColumns(props.columns, props.rows);
  const rows = normalizeRows(props.rows, columns);
  const newCols = columns.length;
  const newRows = rows.length;

  if (prevRows !== newRows || prevCols !== newCols) {
    // Structure changed: row inserted, row removed, or column structure updated
    const fresh = createTablePrimitive(props);
    const result: ExcalidrawElement[] = [];
    const usedSubIds = new Set<string>();

    for (const freshEl of fresh.allElements) {
      const subId = freshEl.customData?.subId as string | undefined;
      if (subId && existingBySubId.has(subId)) {
        const existingEl = existingBySubId.get(subId)!;
        usedSubIds.add(subId);
        const merged = newElementWith(freshEl as any, {
          isDeleted: false,
        });
        (merged as any).id = existingEl.id;
        result.push(merged);
      } else {
        result.push(freshEl);
      }
    }

    // Mark removed sub-elements as deleted
    for (const [subId, existingEl] of existingBySubId.entries()) {
      if (!usedSubIds.has(subId) && !existingEl.isDeleted) {
        result.push(newElementWith(existingEl as any, { isDeleted: true }));
      }
    }

    return result;
  }

  // Same structure: Update cell text values, highlights, and perform coherent lockstep translation
  return existingElements.map((el) => {
    const subId = el.customData?.subId as string | undefined;
    const updates: any = {
      x: Math.round(el.x + dx),
      y: Math.round(el.y + dy),
      isDeleted: false,
    };

    if (subId && subId.startsWith("cell_")) {
      const match = subId.match(/^cell_(\d+)_(\d+)$/);
      if (match) {
        const r = parseInt(match[1], 10);
        const c = parseInt(match[2], 10);
        const cellVal = rows[r]?.values?.[c];
        if (cellVal !== undefined) {
          updates.text = String(cellVal);
        }
      }
    }

    if (subId && subId.startsWith("row_bg_")) {
      const match = subId.match(/^row_bg_(\d+)$/);
      if (match) {
        const r = parseInt(match[1], 10);
        const isHl =
          props.highlightRowIndex === r || Boolean(rows[r]?.highlight);
        updates.isDeleted = !isHl;
      }
    }

    return newElementWith(el as any, updates);
  });
}
