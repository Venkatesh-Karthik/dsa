/**
 * Cognora DSA Acceleration Layer - Paradigm Engines
 *
 * Implements deterministic engines for:
 * 1. DynamicProgrammingEngine ("dynamic-programming") - Tier 3
 * 2. GreedyEngine ("greedy") - Tier 3
 * 3. BacktrackingEngine ("recursion-backtracking") - Tier 3
 */

import type { DSAExecutionResult } from "../types/dsa-engine";
import type { DSASemanticEntity, DSASemanticRelationship, DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAInputLimits } from "../types/dsa-concept";
import { BaseDSAEngine } from "./base-engine";
import { getDefaultDataset } from "../datasets/default-datasets";

// =========================================================================
// 1. DYNAMIC PROGRAMMING ENGINE (Tier 3)
// =========================================================================
export interface DPInput {
  problem?: "fibonacci" | "climbing-stairs" | "knapsack";
  n?: number;
}

export class DynamicProgrammingEngine extends BaseDSAEngine<DPInput> {
  public readonly conceptId = "dynamic-programming";

  private snapshotDPTable(
    version: number,
    title: string,
    cells: Array<{ id: string; index: number; value: number | null; status: string }>,
    dependencies: Array<{ from: string; to: string }> = [],
    metadata: Record<string, unknown> = {},
  ): DSASemanticState {
    const entities = new Map<string, DSASemanticEntity>();
    const relationships: DSASemanticRelationship[] = [];

    for (const cell of cells) {
      entities.set(cell.id, {
        id: cell.id,
        type: "DPCell",
        label: cell.value !== null ? `dp[${cell.index}] = ${cell.value}` : `dp[${cell.index}] = ?`,
        value: cell.value ?? -1,
        role: "element",
        status: cell.status,
        properties: {
          index: cell.index,
          computed: cell.value !== null,
          width: 80,
          height: 50,
        },
      });
    }

    for (const dep of dependencies) {
      relationships.push({
        id: `rel-${dep.from}-to-${dep.to}`,
        sourceId: dep.from,
        targetId: dep.to,
        type: "dependency",
        label: "+",
        style: "dashed",
        directed: true,
        status: "active",
      });
    }

    return {
      version,
      title,
      entities,
      relationships,
      metadata,
    };
  }

  public execute(input: DPInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("dynamic-programming");
    const n = Math.min(input?.n || (defaultData.values?.[0] ?? 6), limits?.maxElements || 8);

    const cells: Array<{ id: string; index: number; value: number | null; status: string }> = [];
    for (let i = 0; i <= n; i++) {
      cells.push({
        id: `dp-${i}`,
        index: i,
        value: null,
        status: "default",
      });
    }

    this.states.push(
      this.snapshotDPTable(0, `Allocate DP Table dp[0..${n}]`, cells, [], { n }),
    );

    cells[0].value = 0;
    cells[0].status = "sorted";
    const prevBase0 = this.states.length - 1;
    this.states.push(
      this.snapshotDPTable(this.states.length, "Base Case: dp[0] = 0", cells),
    );
    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "BASE_CASE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevBase0,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: ["dp-0"],
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: ["dp-0"],
        label: "dp[0] = 0",
        anchorPreference: "center",
      },
      whatHappened: "Initialized base case dp[0] = 0.",
      reason: "Fibonacci of 0 is defined as 0.",
      consequence: "Base case recorded in DP table.",
      title: "Base case dp[0]",
      explanation: "We set the initial base condition dp[0] = 0.",
    });

    if (n >= 1) {
      cells[1].value = 1;
      cells[1].status = "sorted";
      const prevBase1 = this.states.length - 1;
      this.states.push(
        this.snapshotDPTable(this.states.length, "Base Case: dp[1] = 1", cells),
      );
      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "BASE_CASE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevBase1,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: ["dp-1"],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: ["dp-1"],
          label: "dp[1] = 1",
          anchorPreference: "center",
        },
        whatHappened: "Initialized base case dp[1] = 1.",
        reason: "Fibonacci of 1 is defined as 1.",
        consequence: "Both base conditions ready for recurrence.",
        title: "Base case dp[1]",
        explanation: "We set the base condition dp[1] = 1.",
      });
    }

    for (let i = 2; i <= n; i++) {
      const prevStep = this.states.length - 1;
      const computed = (cells[i - 1].value as number) + (cells[i - 2].value as number);
      cells[i].value = computed;
      cells[i].status = "found";

      const deps = [
        { from: `dp-${i - 2}`, to: `dp-${i}` },
        { from: `dp-${i - 1}`, to: `dp-${i}` },
      ];

      this.states.push(
        this.snapshotDPTable(
          this.states.length,
          `Compute dp[${i}] = dp[${i - 1}] (${cells[i - 1].value}) + dp[${i - 2}] (${cells[i - 2].value}) = ${computed}`,
          cells,
          deps,
          { currentI: i, computed },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "TABULATION_STEP",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevStep,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`dp-${i}`],
        affectedRelationshipIds: deps.map((d) => `rel-${d.from}-to-${d.to}`),
        semanticFocus: {
          entityIds: [`dp-${i}`],
          label: `dp[${i}] = ${computed}`,
          anchorPreference: "center",
        },
        whatHappened: `Evaluated recurrence relation dp[${i}] = dp[${i - 1}] + dp[${i - 2}].`,
        reason: `Overlapping subproblems previously resolved are looked up in O(1) time.`,
        consequence: `Stored ${computed} at dp[${i}].`,
        title: `Compute dp[${i}]`,
        explanation: `By reusing previously stored solutions for dp[${i - 1}] and dp[${i - 2}], we compute dp[${i}] without exponential recomputation.`,
      });

      cells[i].status = "sorted";
    }

    return this.formatResult({ result: cells[n].value });
  }
}

// =========================================================================
// 2. GREEDY ENGINE (Tier 3)
// =========================================================================
export interface GreedyInput {
  activities?: Array<{ id: string; start: number; finish: number }>;
}

export class GreedyEngine extends BaseDSAEngine<GreedyInput> {
  public readonly conceptId = "greedy";

  private snapshotActivities(
    version: number,
    title: string,
    activities: Array<{ id: string; label: string; start: number; finish: number; status: string }>,
    metadata: Record<string, unknown> = {},
  ): DSASemanticState {
    const entities = new Map<string, DSASemanticEntity>();
    for (const act of activities) {
      entities.set(act.id, {
        id: act.id,
        type: "Activity",
        label: `${act.label}\n[${act.start} -> ${act.finish}]`,
        value: act.finish,
        role: "candidate",
        status: act.status,
        properties: {
          start: act.start,
          finish: act.finish,
          duration: act.finish - act.start,
          width: 90,
          height: 50,
        },
      });
    }

    return {
      version,
      title,
      entities,
      relationships: [],
      metadata,
    };
  }

  public execute(input: GreedyInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("greedy");
    let acts = input?.activities || [
      { id: "act-1", start: 1, finish: 4 },
      { id: "act-2", start: 3, finish: 5 },
      { id: "act-3", start: 0, finish: 6 },
      { id: "act-4", start: 5, finish: 7 },
      { id: "act-5", start: 3, finish: 8 },
      { id: "act-6", start: 5, finish: 9 },
      { id: "act-7", start: 6, finish: 10 },
      { id: "act-8", start: 8, finish: 11 },
    ];

    const maxElements = limits?.maxElements || 8;
    if (acts.length > maxElements) acts = acts.slice(0, maxElements);

    acts.sort((a, b) => a.finish - b.finish);

    const activities = acts.map((a, idx) => ({
      id: a.id,
      label: `A${idx + 1}`,
      start: a.start,
      finish: a.finish,
      status: "default",
    }));

    this.states.push(
      this.snapshotActivities(0, "Greedy Activity Selection: Sorted by Finish Time", activities),
    );

    activities[0].status = "found";
    let lastFinish = activities[0].finish;
    const selectedCount = 1;

    const prevFirst = this.states.length - 1;
    this.states.push(
      this.snapshotActivities(
        this.states.length,
        `Select ${activities[0].label} [${activities[0].start}..${activities[0].finish}]: Earliest Finish Time`,
        activities,
        { selected: [activities[0].id], lastFinish },
      ),
    );

    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "GREEDY_SELECT",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevFirst,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: [activities[0].id],
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: [activities[0].id],
        label: `${activities[0].label} selected`,
        anchorPreference: "center",
      },
      whatHappened: `Greedily chose activity ${activities[0].label} with earliest finish time (${activities[0].finish}).`,
      reason: `Finishing as early as possible maximizes remaining available time for future compatible activities.`,
      consequence: `Selected activities count: ${selectedCount}. Next activity must start >= ${lastFinish}.`,
      title: `Select ${activities[0].label}`,
      explanation: `We pick the activity with the earliest finish time to leave the maximum remaining time open.`,
    });

    for (let i = 1; i < activities.length; i++) {
      const prevStep = this.states.length - 1;
      const act = activities[i];

      if (act.start >= lastFinish) {
        act.status = "found";
        lastFinish = act.finish;

        this.states.push(
          this.snapshotActivities(
            this.states.length,
            `Select ${act.label} [${act.start}..${act.finish}]: Compatible with prior finish (${act.start} >= ${lastFinish})`,
            activities,
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "GREEDY_SELECT",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevStep,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [act.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [act.id],
            label: `${act.label} accepted`,
            anchorPreference: "center",
          },
          whatHappened: `Accepted activity ${act.label} (start ${act.start} >= prior finish).`,
          reason: `No temporal overlap with previously selected activities.`,
          consequence: `Current finish time updated to ${act.finish}.`,
          title: `Accept ${act.label}`,
          explanation: `Since ${act.label}'s start time (${act.start}) is at or after the previous finish time, it is compatible.`,
        });
      } else {
        act.status = "eliminated";

        this.states.push(
          this.snapshotActivities(
            this.states.length,
            `Reject ${act.label} [${act.start}..${act.finish}]: Overlaps with prior finish (${act.start} < ${lastFinish})`,
            activities,
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "REJECT",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevStep,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [act.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [act.id],
            label: `${act.label} rejected`,
            anchorPreference: "center",
          },
          whatHappened: `Rejected activity ${act.label} due to scheduling collision.`,
          reason: `Start time ${act.start} is earlier than previous finish time ${lastFinish}.`,
          consequence: `Activity is discarded; schedule continues.`,
          title: `Reject ${act.label}`,
          explanation: `Activity ${act.label} conflicts with already scheduled activities and is skipped.`,
        });
      }
    }

    return this.formatResult();
  }
}

// =========================================================================
// 3. RECURSION / BACKTRACKING ENGINE (Tier 3)
// =========================================================================
export interface BacktrackingInput {
  boardSize?: number;
}

export class BacktrackingEngine extends BaseDSAEngine<BacktrackingInput> {
  public readonly conceptId = "recursion-backtracking";

  private snapshotBoard(
    version: number,
    title: string,
    n: number,
    queens: number[],
    currentRow: number,
    currentCol: number,
    isConflict: boolean,
    metadata: Record<string, unknown> = {},
  ): DSASemanticState {
    const entities = new Map<string, DSASemanticEntity>();

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const id = `cell-${r}-${c}`;
        const hasQueen = queens[r] === c;
        const isCurrentProbe = r === currentRow && c === currentCol;

        let status = "default";
        if (hasQueen) status = "sorted";
        else if (isCurrentProbe && isConflict) status = "eliminated";
        else if (isCurrentProbe) status = "active";

        entities.set(id, {
          id,
          type: "BoardCell",
          label: hasQueen ? "♛ Queen" : isCurrentProbe ? (isConflict ? "✕ Conflict" : "? Probe") : `[${r},${c}]`,
          value: hasQueen ? 1 : 0,
          role: hasQueen ? "queen" : "square",
          status,
          properties: {
            row: r,
            col: c,
            hasQueen,
            width: 50,
            height: 50,
          },
        });
      }
    }

    return {
      version,
      title,
      entities,
      relationships: [],
      metadata,
    };
  }

  public execute(input: BacktrackingInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const n = Math.min(input?.boardSize || 4, limits?.maxElements || 4);
    const queens: number[] = new Array(n).fill(-1);

    this.states.push(
      this.snapshotBoard(0, `N-Queens Backtracking (${n}x${n} Board)`, n, queens, -1, -1, false),
    );

    const isSafe = (row: number, col: number): boolean => {
      for (let r = 0; r < row; r++) {
        const c = queens[r];
        if (c === col || Math.abs(c - col) === Math.abs(r - row)) {
          return false;
        }
      }
      return true;
    };

    let solutionFound = false;

    const solve = (row: number): boolean => {
      if (row === n) {
        solutionFound = true;
        const prevSol = this.states.length - 1;
        this.states.push(
          this.snapshotBoard(this.states.length, `Solution Found: All ${n} Queens Placed Safely!`, n, queens, -1, -1, false),
        );
        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "SOLUTION_FOUND",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevSol,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: queens.map((col, r) => `cell-${r}-${col}`),
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: queens.map((col, r) => `cell-${r}-${col}`),
            label: "All queens placed safely",
            anchorPreference: "center",
          },
          whatHappened: `Successfully placed all ${n} queens without conflicts.`,
          reason: `Every row contains a queen mutually non-attacking along columns and diagonals.`,
          consequence: `Backtracking search terminates with valid solution.`,
          title: "Solution found",
          explanation: `All ${n} queens are in safe, non-attacking positions.`,
        });
        return true;
      }

      for (let col = 0; col < n; col++) {
        const prevTry = this.states.length - 1;
        const safe = isSafe(row, col);

        if (safe) {
          queens[row] = col;
          this.states.push(
            this.snapshotBoard(
              this.states.length,
              `Row ${row}: Place Queen at Column ${col} (Safe)`,
              n,
              queens,
              row,
              col,
              false,
            ),
          );

          this.transformations.push({
            id: `t-${this.transformations.length + 1}`,
            type: "CHOOSE",
            stepNumber: this.transformations.length + 1,
            beforeStateIndex: prevTry,
            afterStateIndex: this.states.length - 1,
            affectedEntityIds: [`cell-${row}-${col}`],
            affectedRelationshipIds: [],
            semanticFocus: {
              entityIds: [`cell-${row}-${col}`],
              label: `Queen placed at (${row}, ${col})`,
              anchorPreference: "center",
            },
            whatHappened: `Placed queen at row ${row}, column ${col}.`,
            reason: `No column or diagonal conflicts with previously placed queens.`,
            consequence: `Recurse to row ${row + 1}.`,
            title: `Place queen at (${row}, ${col})`,
            explanation: `Position (${row}, ${col}) is safe. We recurse to find a safe square in the next row.`,
          });

          if (solve(row + 1)) return true;

          const prevBack = this.states.length - 1;
          queens[row] = -1;
          this.states.push(
            this.snapshotBoard(
              this.states.length,
              `Row ${row}: Backtrack from Column ${col} (Subtree failed)`,
              n,
              queens,
              row,
              col,
              true,
            ),
          );

          this.transformations.push({
            id: `t-${this.transformations.length + 1}`,
            type: "BACKTRACK",
            stepNumber: this.transformations.length + 1,
            beforeStateIndex: prevBack,
            afterStateIndex: this.states.length - 1,
            affectedEntityIds: [`cell-${row}-${col}`],
            affectedRelationshipIds: [],
            semanticFocus: {
              entityIds: [`cell-${row}-${col}`],
              label: `Backtrack from (${row}, ${col})`,
              anchorPreference: "center",
            },
            whatHappened: `Removed queen from row ${row}, column ${col} and backtracked.`,
            reason: `Subsequent queen placements led to dead ends.`,
            consequence: `Try next available column in row ${row}.`,
            title: `Backtrack from (${row}, ${col})`,
            explanation: `Placing a queen at (${row}, ${col}) prevents finding valid placements in subsequent rows. We undo this choice.`,
          });
        }
      }

      return false;
    };

    solve(0);

    return this.formatResult({ solutionFound });
  }
}
