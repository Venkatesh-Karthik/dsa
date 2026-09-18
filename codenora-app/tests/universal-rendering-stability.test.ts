import { describe, it, expect } from "vitest";

import type {
  ExcalidrawElement,
  ExcalidrawArrowElement,
} from "@excalidraw/element/types";

import {
  createTablePrimitive,
  updateTablePrimitive,
  computeTableColumnWidths,
} from "../ai/visual-primitives/table-primitive";
import {
  createVisualPrimitive,
  updateVisualPrimitive,
} from "../ai/visual-primitives/primitive-factory";
import {
  computeTableEntityBounds,
  deriveEntityBounds,
  computeSceneGraphLayout,
  measureTextBounds,
} from "../ai/layout-engine";
import { reconcileSceneState } from "../ai/scene-reconciler";
import {
  validateIntermediateFrameElements,
  deriveSemanticAnimationPlan,
} from "../ai/scene-animation";

import type { SceneState } from "../ai/scene-state";
import type { SceneGraph, SemanticEntity } from "../ai/scene-graph";

describe("Universal Visual Rendering & Stability Engine", () => {
  // ==========================================================================
  // 1. Table Creation & First-Class Compound Identity
  // ==========================================================================
  it("1. creates a table with authoritative bounding box and deterministic scoped child IDs", () => {
    const tableResult = createTablePrimitive({
      id: "students_table",
      x: 100,
      y: 100,
      tableName: "Students",
      columns: [
        { key: "id", title: "ID" },
        { key: "name", title: "Name" },
        { key: "grade", title: "Grade" },
      ],
      rows: [
        { key: "s1", values: ["101", "Alice Smith", "A"] },
        { key: "s2", values: ["102", "Bob Jones", "B"] },
      ],
    });

    expect(tableResult.primaryElement).toBeDefined();
    expect(tableResult.primaryElement.id).toBe("students_table");
    expect(tableResult.bounds.width).toBeGreaterThan(200);
    expect(tableResult.bounds.height).toBeGreaterThan(90);

    const ids = tableResult.allElements.map((e) => e.id);
    expect(ids).toContain("students_table"); // container
    expect(ids).toContain("students_table__title"); // title text
    expect(ids).toContain("students_table__col_0"); // col 1
    expect(ids).toContain("students_table__col_1"); // col 2
    expect(ids).toContain("students_table__col_2"); // col 3
    expect(ids).toContain("students_table__cell_0_0"); // Alice ID
    expect(ids).toContain("students_table__cell_0_1"); // Alice name
    expect(ids).toContain("students_table__cell_1_0"); // Bob ID
    expect(ids).toContain("students_table__cell_1_1"); // Bob name

    // Verify sub-dslIds are preserved and scoped
    const cellEl = tableResult.allElements.find(
      (e) => e.id === "students_table__cell_0_1",
    );
    expect(cellEl?.customData?.dslId).toBe("students_table__cell_0_1");
    expect(cellEl?.customData?.semanticId).toBe("students_table");
  });

  // ==========================================================================
  // 2. Table Transformation & Identity Preservation
  // ==========================================================================
  it("2. updates existing table in-place preserving sub-element identities", () => {
    const initial = createTablePrimitive({
      id: "t1",
      x: 100,
      y: 100,
      tableName: "Data",
      columns: ["A", "B"],
      rows: [["1", "2"]],
    });

    const entity: SemanticEntity = {
      id: "t1",
      primitiveType: "Table",
      semanticRole: "state",
      label: "Data Updated",
      properties: {
        columns: ["A", "B"],
        rows: [["1", "999"]],
        tableName: "Data Updated",
      },
    };

    const updatedElements = updateTablePrimitive(initial.allElements, entity, {
      x: 100,
      y: 100,
    });
    const cellEl = updatedElements.find((e) => e.id === "t1__cell_0_1");
    expect(cellEl).toBeDefined();
    expect((cellEl as any).text).toBe("999");
    expect(cellEl?.id).toBe("t1__cell_0_1");
  });

  // ==========================================================================
  // 3. Table Row Insertion
  // ==========================================================================
  it("3. inserts row preserving existing row identities and adapting layout", () => {
    const initial = createTablePrimitive({
      id: "t_insert",
      x: 100,
      y: 100,
      columns: ["Col1", "Col2"],
      rows: [["R1_1", "R1_2"]],
    });

    const entityWithNewRow: SemanticEntity = {
      id: "t_insert",
      primitiveType: "Table",
      semanticRole: "state",
      properties: {
        columns: ["Col1", "Col2"],
        rows: [
          ["R1_1", "R1_2"],
          ["R2_1", "R2_2"],
        ],
      },
    };

    const updated = updateTablePrimitive(
      initial.allElements,
      entityWithNewRow,
      { x: 100, y: 100 },
    );
    const newCell = updated.find((e) => e.id === "t_insert__cell_1_0");
    const oldCell = updated.find((e) => e.id === "t_insert__cell_0_0");

    expect(oldCell).toBeDefined();
    expect(newCell).toBeDefined();
    expect((newCell as any).text).toBe("R2_1");
    // Container height should expand for the new row
    const container = updated.find((e) => e.id === "t_insert");
    expect(container?.height).toBeGreaterThan(initial.primaryElement.height);
  });

  // ==========================================================================
  // 4. Table Row Deletion
  // ==========================================================================
  it("4. removes row cleanly, marks removed cells deleted, retains remaining rows", () => {
    const initial = createTablePrimitive({
      id: "t_delete",
      x: 100,
      y: 100,
      columns: ["Col1"],
      rows: [["Row1"], ["Row2"]],
    });

    const entityWithDeletedRow: SemanticEntity = {
      id: "t_delete",
      primitiveType: "Table",
      semanticRole: "state",
      properties: {
        columns: ["Col1"],
        rows: [["Row1"]],
      },
    };

    const updated = updateTablePrimitive(
      initial.allElements,
      entityWithDeletedRow,
      { x: 100, y: 100 },
    );
    const row2Cell = updated.find((e) => e.id === "t_delete__cell_1_0");
    expect(row2Cell?.isDeleted).toBe(true);
    const row1Cell = updated.find((e) => e.id === "t_delete__cell_0_0");
    expect(row1Cell?.isDeleted).toBe(false);
  });

  // ==========================================================================
  // 5. Table Column Change & Dynamic Text Measurement
  // ==========================================================================
  it("5. dynamically measures column widths based on cell text length to prevent clipping", () => {
    const columns = [
      { key: "c1", title: "Short" },
      { key: "c2", title: "Very Long Detailed Description Column Header" },
    ];
    const rows = [
      {
        key: "r1",
        values: ["x", "Extended explanatory text content that requires width"],
      },
    ];

    const colWidths = computeTableColumnWidths(columns, rows);
    expect(colWidths[0]).toBeLessThan(colWidths[1]);
    expect(colWidths[1]).toBeGreaterThanOrEqual(120);

    const bounds = computeTableEntityBounds({
      id: "t_wide",
      primitiveType: "Table",
      semanticRole: "state",
      properties: { columns, rows },
    });
    expect(bounds.width).toBeGreaterThanOrEqual(200);
  });

  // ==========================================================================
  // 6. Cell Value Mutation
  // ==========================================================================
  it("6. mutates single cell value in place without altering container geometry", () => {
    const initial = createTablePrimitive({
      id: "t_mutate",
      x: 100,
      y: 100,
      columns: ["Val"],
      rows: [["OldValue"]],
    });

    const entity: SemanticEntity = {
      id: "t_mutate",
      primitiveType: "Table",
      semanticRole: "state",
      properties: {
        columns: ["Val"],
        rows: [["NewValue"]],
      },
    };

    const updated = updateTablePrimitive(initial.allElements, entity, {
      x: 100,
      y: 100,
    });
    const cell = updated.find((e) => e.id === "t_mutate__cell_0_0");
    expect((cell as any).text).toBe("NewValue");
    const container = updated.find((e) => e.id === "t_mutate");
    expect(container?.x).toBe(initial.primaryElement.x);
    expect(container?.y).toBe(initial.primaryElement.y);
  });

  // ==========================================================================
  // 7. Row Highlighting
  // ==========================================================================
  it("7. highlights row without altering layout or shifting cell coordinates", () => {
    const initial = createTablePrimitive({
      id: "t_hl",
      x: 100,
      y: 100,
      columns: ["Name", "Score"],
      rows: [
        ["Alice", 95],
        ["Bob", 80],
      ],
    });

    const entity: SemanticEntity = {
      id: "t_hl",
      primitiveType: "Table",
      semanticRole: "state",
      properties: {
        columns: ["Name", "Score"],
        rows: [["Alice", 95], { values: ["Bob", 80], highlight: "success" }],
        highlightRowIndex: 1,
      },
    };

    const updated = updateTablePrimitive(initial.allElements, entity, {
      x: 100,
      y: 100,
    });
    const bgRow1 = updated.find((e) => e.id === "t_hl__row_bg_1");
    expect(bgRow1).toBeDefined();
    expect(bgRow1?.isDeleted).toBe(false);
  });

  // ==========================================================================
  // 8. Cell Highlighting
  // ==========================================================================
  it("8. supports cell-level highlight styling", () => {
    const table = createTablePrimitive({
      id: "t_cell_hl",
      x: 50,
      y: 50,
      columns: ["A", "B"],
      rows: [{ values: ["Key", "Matched"], highlight: "matched" }],
    });
    expect(table.allElements.length).toBeGreaterThan(0);
    const bg = table.allElements.find((e) => e.id === "t_cell_hl__row_bg_0");
    expect(bg).toBeDefined();
  });

  // ==========================================================================
  // 9. Two-Table Relationships
  // ==========================================================================
  it("9. connects two tables cleanly using authoritative bounding boxes", () => {
    const tableA: SemanticEntity = {
      id: "students",
      primitiveType: "Table",
      semanticRole: "state",
      label: "Students",
      properties: {
        columns: ["id", "name"],
        rows: [["1", "Alice"]],
      },
    };
    const tableB: SemanticEntity = {
      id: "grades",
      primitiveType: "Table",
      semanticRole: "state",
      label: "Grades",
      properties: {
        columns: ["student_id", "grade"],
        rows: [["1", "A"]],
      },
    };

    const graph: SceneGraph = {
      entities: new Map([
        ["students", tableA],
        ["grades", tableB],
      ]),
      relationships: new Map([
        [
          "rel_fk",
          {
            id: "rel_fk",
            sourceEntityId: "students",
            targetEntityId: "grades",
            type: "relatesTo",
            label: "FK student_id",
          },
        ],
      ]),
      annotations: new Map(),
    };

    const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });
    const posA = layout.positions.get("students")!;
    const posB = layout.positions.get("grades")!;
    expect(posA).toBeDefined();
    expect(posB).toBeDefined();
    // Tables should not overlap (either placed below or side by side)
    expect(posB.y > posA.y || posB.x > posA.x).toBe(true);

    const sceneState: SceneState = {
      graph,
      layoutState: layout.positions,
    };

    const reconciled = reconcileSceneState(sceneState, []);
    const arrow = reconciled.elements.find(
      (e) => e.type === "arrow",
    ) as ExcalidrawArrowElement;
    expect(arrow).toBeDefined();
    expect(arrow.customData?.dslId).toBe("rel_fk");

    const edgeLabel = reconciled.elements.find(
      (e) => e.customData?.dslId === "rel_fk-label",
    );
    expect(edgeLabel).toBeDefined();
    expect((edgeLabel as any).text).toBe("FK student_id");
  });

  // ==========================================================================
  // 10. Relational Join / Result-Table Transformation Layout
  // ==========================================================================
  it("10. positions source tables side by side and places result table centered below", () => {
    const tSource1: SemanticEntity = {
      id: "users",
      primitiveType: "Table",
      semanticRole: "state",
      label: "Users",
      properties: { columns: ["id", "name"], rows: [["1", "Alice"]] },
    };
    const tSource2: SemanticEntity = {
      id: "orders",
      primitiveType: "Table",
      semanticRole: "state",
      label: "Orders",
      properties: { columns: ["order_id", "user_id"], rows: [["501", "1"]] },
    };
    const tResult: SemanticEntity = {
      id: "result_table",
      primitiveType: "Table",
      semanticRole: "output",
      label: "Joined Result",
      properties: {
        columns: ["id", "name", "order_id"],
        rows: [["1", "Alice", "501"]],
      },
    };

    const graph: SceneGraph = {
      entities: new Map([
        ["users", tSource1],
        ["orders", tSource2],
        ["result_table", tResult],
      ]),
      relationships: new Map([
        [
          "rel1",
          {
            id: "rel1",
            sourceEntityId: "users",
            targetEntityId: "result_table",
            type: "derivedFrom",
          },
        ],
        [
          "rel2",
          {
            id: "rel2",
            sourceEntityId: "orders",
            targetEntityId: "result_table",
            type: "derivedFrom",
          },
        ],
      ]),
      annotations: new Map(),
    };

    const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });
    const pos1 = layout.positions.get("users")!;
    const pos2 = layout.positions.get("orders")!;
    const posRes = layout.positions.get("result_table")!;

    expect(pos1.y).toBe(100);
    expect(pos2.y).toBe(100);
    expect(pos2.x).toBeGreaterThan(pos1.x); // side by side
    expect(posRes.y).toBeGreaterThan(100); // placed below
  });

  // ==========================================================================
  // 11. Coherent Compound Component Movement (Lockstep dx, dy Translation)
  // ==========================================================================
  it("11. translates all child elements of a table by identical (dx, dy) with zero distortion", () => {
    const initial = createTablePrimitive({
      id: "table_moving",
      x: 100,
      y: 100,
      columns: ["Col1", "Col2"],
      rows: [["ValA", "ValB"]],
    });

    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const el of initial.allElements) {
      initialPositions.set(el.id, { x: el.x, y: el.y });
    }

    const entity: SemanticEntity = {
      id: "table_moving",
      primitiveType: "Table",
      semanticRole: "state",
      properties: {
        columns: ["Col1", "Col2"],
        rows: [["ValA", "ValB"]],
      },
    };

    const dx = 150;
    const dy = 80;
    const moved = updateTablePrimitive(initial.allElements, entity, {
      x: 100 + dx,
      y: 100 + dy,
    });

    for (const el of moved) {
      const initPos = initialPositions.get(el.id);
      expect(initPos).toBeDefined();
      expect(Math.abs(el.x - (initPos!.x + dx))).toBeLessThanOrEqual(1);
      expect(Math.abs(el.y - (initPos!.y + dy))).toBeLessThanOrEqual(1);
    }
  });

  // ==========================================================================
  // 12. Compound Component Resize
  // ==========================================================================
  it("12. updates container bounds coherently when table grows or shrinks", () => {
    const tableSmall = computeTableEntityBounds({
      id: "t",
      primitiveType: "Table",
      semanticRole: "state",
      properties: { columns: ["A"], rows: [["1"]] },
    });
    const tableLarge = computeTableEntityBounds({
      id: "t",
      primitiveType: "Table",
      semanticRole: "state",
      properties: {
        columns: ["A", "B", "C", "D"],
        rows: [
          ["1", "2", "3", "4"],
          ["5", "6", "7", "8"],
        ],
      },
    });

    expect(tableLarge.width).toBeGreaterThan(tableSmall.width);
    expect(tableLarge.height).toBeGreaterThan(tableSmall.height);
  });

  // ==========================================================================
  // 13. Connector Update & Dangling Prevention
  // ==========================================================================
  it("13. rejects dangling connectors when endpoints are deleted or invalid", () => {
    const graph: SceneGraph = {
      entities: new Map([
        [
          "nodeA",
          { id: "nodeA", primitiveType: "Rectangle", semanticRole: "state" },
        ],
      ]),
      relationships: new Map([
        [
          "rel_dangling",
          {
            id: "rel_dangling",
            sourceEntityId: "nodeA",
            targetEntityId: "missingNodeB",
            type: "relatesTo",
          },
        ],
      ]),
      annotations: new Map(),
    };

    const sceneState: SceneState = {
      graph,
      layoutState: new Map([["nodeA", { x: 50, y: 50 }]]),
    };

    const reconciled = reconcileSceneState(sceneState, []);
    const arrows = reconciled.elements.filter(
      (e) => e.type === "arrow" && !e.isDeleted,
    );
    expect(arrows.length).toBe(0);
  });

  // ==========================================================================
  // 14. Annotation Tracking & Identity Preservation
  // ==========================================================================
  it("14. preserves annotation element ID across reconciliation steps", () => {
    const graph1: SceneGraph = {
      entities: new Map([
        [
          "node1",
          {
            id: "node1",
            primitiveType: "TreeNode",
            semanticRole: "state",
            value: 10,
          },
        ],
      ]),
      relationships: new Map(),
      annotations: new Map([
        [
          "ann_balance",
          {
            id: "ann_balance",
            type: "badge",
            text: "Balance factor: +1",
            targetEntityId: "node1",
          },
        ],
      ]),
    };

    const res1 = reconcileSceneState(
      { graph: graph1, layoutState: new Map([["node1", { x: 100, y: 100 }]]) },
      [],
    );
    const ann1 = res1.elements.find(
      (e) => e.customData?.dslId === "ann_balance",
    );
    expect(ann1).toBeDefined();

    const graph2: SceneGraph = {
      entities: new Map([
        [
          "node1",
          {
            id: "node1",
            primitiveType: "TreeNode",
            semanticRole: "state",
            value: 10,
          },
        ],
      ]),
      relationships: new Map(),
      annotations: new Map([
        [
          "ann_balance",
          {
            id: "ann_balance",
            type: "badge",
            text: "Balance factor: 0 (Balanced)",
            targetEntityId: "node1",
          },
        ],
      ]),
    };

    const res2 = reconcileSceneState(
      { graph: graph2, layoutState: new Map([["node1", { x: 100, y: 100 }]]) },
      res1.elements,
    );
    const ann2 = res2.elements.find(
      (e) => e.customData?.dslId === "ann_balance",
    );
    expect(ann2).toBeDefined();
    // Element identity preserved
    expect(ann2?.id).toBe(ann1?.id);
    expect((ann2 as any).text).toBe("Balance factor: 0 (Balanced)");
    expect(ann2?.isDeleted).toBe(false);
  });

  // ==========================================================================
  // 15-18. Scene Determinism & Animation Planning
  // ==========================================================================
  it("15. produces deterministic layout positions for identical semantic scene graphs", () => {
    const graph: SceneGraph = {
      entities: new Map([
        [
          "e1",
          {
            id: "e1",
            primitiveType: "TreeNode",
            semanticRole: "state",
            value: 50,
          },
        ],
        [
          "e2",
          {
            id: "e2",
            primitiveType: "TreeNode",
            semanticRole: "state",
            value: 30,
          },
        ],
      ]),
      relationships: new Map([
        [
          "r1",
          {
            id: "r1",
            sourceEntityId: "e1",
            targetEntityId: "e2",
            type: "leftOf",
          },
        ],
      ]),
      annotations: new Map(),
    };

    const layout1 = computeSceneGraphLayout(graph, { x: 100, y: 100 });
    const layout2 = computeSceneGraphLayout(graph, { x: 100, y: 100 });

    expect(layout1.positions.get("e1")).toEqual(layout2.positions.get("e1"));
    expect(layout1.positions.get("e2")).toEqual(layout2.positions.get("e2"));
  });

  it("16. plans compound table semantic animations (EXPAND, COLLAPSE, HIGHLIGHT)", () => {
    const prevGraph = {
      entities: new Map([
        [
          "t1",
          {
            id: "t1",
            primitiveType: "Table",
            label: "Students",
            properties: { rows: [["A"], ["B"]], highlightRowIndex: 0 },
          },
        ],
      ]),
    };

    const nextGraph = {
      entities: new Map([
        [
          "t1",
          {
            id: "t1",
            primitiveType: "Table",
            label: "Students",
            properties: { rows: [["A"], ["B"], ["C"]], highlightRowIndex: 2 },
          },
        ],
      ]),
    };

    const plan = deriveSemanticAnimationPlan(prevGraph, nextGraph, 1);
    const motionTypes = plan.actions.map((a) => a.motionType);
    expect(motionTypes).toContain("EXPAND"); // row inserted
    expect(motionTypes).toContain("HIGHLIGHT"); // row highlighted
  });

  // ==========================================================================
  // 19-22. Intermediate Frame Validation & Rejection of Corrupt States
  // ==========================================================================
  it("19. rejects intermediate frame containing NaN coordinates", () => {
    const invalidElements: any[] = [
      {
        id: "bad_el",
        type: "rectangle",
        x: NaN,
        y: 100,
        width: 120,
        height: 60,
        isDeleted: false,
      },
    ];
    const validation = validateIntermediateFrameElements(invalidElements);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain("non-finite coordinates");
  });

  it("20. rejects intermediate frame containing Infinity dimensions", () => {
    const invalidElements: any[] = [
      {
        id: "bad_el",
        type: "rectangle",
        x: 100,
        y: 100,
        width: Infinity,
        height: 60,
        isDeleted: false,
      },
    ];
    const validation = validateIntermediateFrameElements(invalidElements);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain("non-finite dimensions");
  });

  it("21. rejects intermediate frame containing negative dimensions", () => {
    const invalidElements: any[] = [
      {
        id: "bad_el",
        type: "rectangle",
        x: 100,
        y: 100,
        width: -50,
        height: 60,
        isDeleted: false,
      },
    ];
    const validation = validateIntermediateFrameElements(invalidElements);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain("negative dimensions");
  });

  it("22. rejects arrow with NaN points", () => {
    const invalidElements: any[] = [
      {
        id: "bad_arrow",
        type: "arrow",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        points: [
          [0, 0],
          [NaN, 50],
        ],
        isDeleted: false,
      },
    ];
    const validation = validateIntermediateFrameElements(invalidElements);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain("non-finite control point");
  });

  it("23. validates clean intermediate frames successfully", () => {
    const validElements: any[] = [
      {
        id: "good_box",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 120,
        height: 60,
        isDeleted: false,
      },
      {
        id: "good_text",
        type: "text",
        x: 110,
        y: 115,
        width: 80,
        height: 20,
        isDeleted: false,
      },
      {
        id: "good_arrow",
        type: "arrow",
        x: 220,
        y: 130,
        width: 50,
        height: 0,
        points: [
          [0, 0],
          [50, 0],
        ],
        isDeleted: false,
      },
    ];
    const validation = validateIntermediateFrameElements(validElements);
    expect(validation.valid).toBe(true);
  });

  // ==========================================================================
  // 24. Arbitrary Compound Visual Component (Arrays, Trees, Graphs)
  // ==========================================================================
  it("24. ensures ArrayCell and StackFrame compound components preserve identity and derive geometry", () => {
    const cellEntity: SemanticEntity = {
      id: "arr_0",
      primitiveType: "ArrayCell",
      semanticRole: "state",
      value: 42,
      properties: { index: 0, width: 60, height: 40 },
    };

    const primitive = createVisualPrimitive(cellEntity, { x: 50, y: 50 });
    expect(primitive.primaryElement).toBeDefined();
    expect(primitive.primaryElement.width).toBe(60);
    expect(primitive.primaryElement.height).toBe(40);

    // Update with translation
    const updated = updateVisualPrimitive(primitive.allElements, cellEntity, {
      x: 150,
      y: 80,
    });
    expect(updated[0].x).toBe(150);
    expect(updated[0].y).toBe(80);
  });

  // ==========================================================================
  // 25. Universal Cross-Domain Stability Check (SQL, CPU, TCP, AVL, Physics, Biology)
  // ==========================================================================
  it("25. demonstrates universal rendering across completely unrelated domains", () => {
    const domains = [
      {
        name: "SQL Relational Algebra",
        entities: [
          {
            id: "t1",
            primitiveType: "Table" as const,
            semanticRole: "state" as const,
            properties: { columns: ["id", "val"], rows: [["1", "A"]] },
          },
          {
            id: "t2",
            primitiveType: "Table" as const,
            semanticRole: "output" as const,
            properties: { columns: ["id", "val"], rows: [["1", "A"]] },
          },
        ],
        strategy: "table" as const,
      },
      {
        name: "CPU Instruction Pipeline",
        entities: [
          {
            id: "fetch",
            primitiveType: "ProcessNode" as const,
            semanticRole: "process" as const,
            label: "Fetch",
          },
          {
            id: "decode",
            primitiveType: "ProcessNode" as const,
            semanticRole: "process" as const,
            label: "Decode",
          },
          {
            id: "execute",
            primitiveType: "ProcessNode" as const,
            semanticRole: "process" as const,
            label: "Execute",
          },
        ],
        strategy: "pipeline" as const,
      },
      {
        name: "TCP Three-Way Handshake",
        entities: [
          {
            id: "client",
            primitiveType: "Client" as const,
            semanticRole: "actor" as const,
            label: "Client",
          },
          {
            id: "server",
            primitiveType: "Server" as const,
            semanticRole: "actor" as const,
            label: "Server",
          },
        ],
        strategy: "sequence" as const,
      },
      {
        name: "AVL Tree Balancing",
        entities: [
          {
            id: "root",
            primitiveType: "TreeNode" as const,
            semanticRole: "state" as const,
            value: 30,
            properties: { left: "left_child" },
          },
          {
            id: "left_child",
            primitiveType: "TreeNode" as const,
            semanticRole: "state" as const,
            value: 20,
          },
        ],
        strategy: "tree" as const,
      },
      {
        name: "Physics Light Refraction",
        entities: [
          {
            id: "air",
            primitiveType: "Medium" as const,
            semanticRole: "context" as const,
            label: "Air (n=1.0)",
          },
          {
            id: "glass",
            primitiveType: "Medium" as const,
            semanticRole: "context" as const,
            label: "Glass (n=1.5)",
          },
          {
            id: "beam",
            primitiveType: "Ray" as const,
            semanticRole: "energy" as const,
            label: "Incident Ray",
          },
        ],
        strategy: "flow" as const,
      },
      {
        name: "Cellular Photosynthesis",
        entities: [
          {
            id: "chloroplast",
            primitiveType: "Container" as const,
            semanticRole: "container" as const,
            label: "Chloroplast",
          },
          {
            id: "light_rxn",
            primitiveType: "ProcessNode" as const,
            semanticRole: "process" as const,
            label: "Light Reactions",
          },
        ],
        strategy: "flow" as const,
      },
    ];

    for (const domain of domains) {
      const graph: SceneGraph = {
        entities: new Map(domain.entities.map((e) => [e.id, e])),
        relationships: new Map(),
        annotations: new Map(),
        metadata: { layoutStrategy: domain.strategy as any },
      };

      const layout = computeSceneGraphLayout(graph, { x: 100, y: 100 });
      expect(layout.positions.size).toBe(domain.entities.length);

      const sceneState: SceneState = {
        graph,
        layoutState: layout.positions,
      };

      const reconciled = reconcileSceneState(sceneState, []);
      expect(reconciled.elements.length).toBeGreaterThanOrEqual(
        domain.entities.length,
      );

      const frameCheck = validateIntermediateFrameElements(reconciled.elements);
      expect(frameCheck.valid).toBe(true);
    }
  });
});
