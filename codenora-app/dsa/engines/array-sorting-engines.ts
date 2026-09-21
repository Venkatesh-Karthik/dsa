/**
 * Cognora DSA Acceleration Layer - Array & Sorting Engines
 *
 * Implements deterministic engines for:
 * 1. BinarySearchEngine ("binary-search") - Tier 1 Demo-Critical
 * 2. QuickSortEngine ("quick-sort") - Tier 1 Demo-Critical
 * 3. MergeSortEngine ("merge-sort") - Tier 1 Demo-Critical
 * 4. BubbleSortEngine ("bubble-sort") - Tier 2
 * 5. SelectionSortEngine ("selection-sort") - Tier 2
 * 6. InsertionSortEngine ("insertion-sort") - Tier 2
 * 7. HeapSortEngine ("heap-sort") - Tier 2
 * 8. LinearSearchEngine ("linear-search") - Tier 2
 * 9. TwoPointerEngine ("two-pointer") - Tier 3
 * 10. SlidingWindowEngine ("sliding-window") - Tier 3
 * 11. ArrayOperationsEngine ("array") - Tier 2
 */

import type { DSAExecutionResult } from "../types/dsa-engine";
import type { DSASemanticEntity, DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAInputLimits } from "../types/dsa-concept";
import { BaseDSAEngine } from "./base-engine";
import { getDefaultDataset } from "../datasets/default-datasets";

export interface ArrayEngineInput {
  values?: number[];
  target?: number;
  operation?: string;
  index?: number;
  value?: number;
  k?: number;
}

// Helper: Build Array State Snapshot
function buildArrayState(
  version: number,
  title: string,
  items: Array<{ id: string; value: number; status: string; role?: string; pointer?: string }>,
  metadata: Record<string, unknown> = {},
): DSASemanticState {
  const entities = new Map<string, DSASemanticEntity>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    entities.set(item.id, {
      id: item.id,
      type: "ArrayCell",
      label: item.pointer ? `${item.value}\n[${item.pointer}]` : `${item.value}`,
      value: item.value,
      role: item.role || "element",
      status: item.status,
      properties: {
        index: i,
        pointer: item.pointer || null,
        width: 64,
        height: 64,
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

// =========================================================================
// 1. BINARY SEARCH ENGINE (Tier 1 Demo-Critical)
// =========================================================================
export class BinarySearchEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "binary-search";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("binary-search");
    let rawVals = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const target = input?.target !== undefined ? input.target : (defaultData.target ?? 17);

    const maxElements = limits?.maxElements || 16;
    if (rawVals.length > maxElements) {
      rawVals = rawVals.slice(0, maxElements);
    }
    rawVals.sort((a, b) => a - b);

    const items = rawVals.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    let low = 0;
    let high = items.length - 1;

    items[low].pointer = "low";
    if (high !== low) {
      items[high].pointer = items[high].pointer ? `${items[high].pointer}, high` : "high";
    }

    this.states.push(
      buildArrayState(0, `Binary Search initialized for target ${target}`, items, {
        low,
        high,
        target,
      }),
    );

    let found = false;
    let mid = Math.floor((low + high) / 2);

    while (low <= high) {
      mid = Math.floor((low + high) / 2);
      const prevIdx = this.states.length - 1;

      const currentItems = items.map((it, idx) => {
        let ptr: string | undefined;
        if (idx === low && idx === high && idx === mid) ptr = "L, M, H";
        else if (idx === low && idx === mid) ptr = "low, mid";
        else if (idx === high && idx === mid) ptr = "mid, high";
        else if (idx === low && idx === high) ptr = "low, high";
        else if (idx === mid) ptr = "mid";
        else if (idx === low) ptr = "low";
        else if (idx === high) ptr = "high";

        let st = "default";
        if (idx < low || idx > high) st = "eliminated";
        else if (idx === mid) st = "active";

        return { ...it, status: st, pointer: ptr };
      });

      const midVal = currentItems[mid].value;

      if (midVal === target) {
        found = true;
        currentItems[mid].status = "found";
        this.states.push(
          buildArrayState(this.states.length, `Target ${target} Found at Index ${mid}`, currentItems, {
            low,
            high,
            mid,
            target,
            found: true,
          }),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "FOUND",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [`arr-${mid}`],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [`arr-${mid}`],
            label: `Target ${target} located`,
            anchorPreference: "center",
          },
          whatHappened: `Target ${target} matches element at index ${mid}.`,
          reason: `array[mid] (${midVal}) === target (${target}).`,
          consequence: `Search terminates successfully with index ${mid}.`,
          title: `Target ${target} found at mid (index ${mid})`,
          explanation: `We probe middle element ${midVal} at index ${mid}. It matches search target ${target} exactly.`,
        });
        break;
      }

      this.states.push(
        buildArrayState(this.states.length, `Compare Mid: array[${mid}] = ${midVal} with Target ${target}`, currentItems, {
          low,
          high,
          mid,
          target,
        }),
      );

      const isGreater = midVal > target;
      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "COMPARE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`arr-${mid}`],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [`arr-${mid}`],
          label: `mid index ${mid}: ${midVal}`,
          anchorPreference: "center",
        },
        whatHappened: `Examine middle element ${midVal} at index ${mid}.`,
        reason: isGreater
          ? `mid value ${midVal} is greater than target ${target}. Target must be in left half.`
          : `mid value ${midVal} is less than target ${target}. Target must be in right half.`,
        consequence: isGreater
          ? `Discard indices ${mid} to ${high}. Set high = ${mid - 1}.`
          : `Discard indices ${low} to ${mid}. Set low = ${mid + 1}.`,
        title: `Compare with target ${target}`,
        explanation: `Comparing middle value ${midVal} against ${target}. Since array is sorted, we eliminate half the search space.`,
      });

      if (isGreater) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    if (!found) {
      const prevIdx = this.states.length - 1;
      const finalItems = items.map((it) => ({ ...it, status: "eliminated", pointer: undefined }));
      this.states.push(
        buildArrayState(this.states.length, `Target ${target} Not Found in Array`, finalItems, {
          target,
          found: false,
        }),
      );
      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "NOT_FOUND",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: items.map((it) => it.id),
          label: `Search complete - target not found`,
          anchorPreference: "center",
        },
        whatHappened: `low index exceeded high index (low > high).`,
        reason: `Search interval became empty without encountering ${target}.`,
        consequence: `Search concludes: target is not present in the array.`,
        title: `Target not found`,
        explanation: `The search boundary collapsed (low > high). Target ${target} does not exist in this array.`,
      });
    }

    return this.formatResult({
      length: rawVals.length,
      found,
      target,
    });
  }
}

// =========================================================================
// 2. QUICK SORT ENGINE (Tier 1 Demo-Critical)
// =========================================================================
export class QuickSortEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "quick-sort";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("quick-sort");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const maxElements = limits?.maxElements || 12;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, "Quick Sort: Unsorted Array", items, { range: [0, arr.length - 1] }));

    const sortedIndices = new Set<number>();

    const partition = (low: number, high: number): number => {
      const pivotVal = items[high].value;
      const prevPivotIdx = this.states.length - 1;

      items[high].status = "pivot";
      items[high].pointer = "pivot";
      for (let k = low; k < high; k++) {
        if (!sortedIndices.has(k)) items[k].status = "active";
      }

      this.states.push(
        buildArrayState(
          this.states.length,
          `Select Pivot: ${pivotVal} at Index ${high} (Subarray [${low}..${high}])`,
          items,
          { pivot: pivotVal, low, high },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "SELECT_PIVOT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevPivotIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [items[high].id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [items[high].id],
          label: `Pivot ${pivotVal}`,
          anchorPreference: "center",
        },
        whatHappened: `Chosen ${pivotVal} at index ${high} as partition pivot.`,
        reason: `Lomuto partitioning designates the rightmost element as the comparison anchor.`,
        consequence: `Elements smaller than ${pivotVal} will migrate to left partition.`,
        title: `Pivot selected: ${pivotVal}`,
        explanation: `We designate ${pivotVal} as the pivot element. We scan the subarray from left to right, placing smaller elements before the pivot.`,
      });

      let i = low - 1;

      for (let j = low; j < high; j++) {
        if (items[j].value < pivotVal) {
          i++;
          if (i !== j) {
            const prevSwapIdx = this.states.length - 1;
            const temp = items[i];
            items[i] = items[j];
            items[j] = temp;

            this.states.push(
              buildArrayState(
                this.states.length,
                `Swap ${items[i].value} and ${items[j].value} into smaller partition`,
                items,
                { i, j, pivot: pivotVal },
              ),
            );

            this.transformations.push({
              id: `t-${this.transformations.length + 1}`,
              type: "SWAP",
              stepNumber: this.transformations.length + 1,
              beforeStateIndex: prevSwapIdx,
              afterStateIndex: this.states.length - 1,
              affectedEntityIds: [items[i].id, items[j].id],
              affectedRelationshipIds: [],
              semanticFocus: {
                entityIds: [items[i].id, items[j].id],
                label: `Swap elements`,
                anchorPreference: "center",
              },
              whatHappened: `Swap ${items[i].value} (at index ${i}) with ${items[j].value} (at index ${j}).`,
              reason: `${items[i].value} < pivot (${pivotVal}), so it belongs in the left partition.`,
              consequence: `Left partition expands up to index ${i}.`,
              title: `Swap into left partition`,
              explanation: `We exchange ${items[i].value} and ${items[j].value} so all values smaller than ${pivotVal} accumulate on the left.`,
            });
          }
        }
      }

      const pivotDest = i + 1;
      const prevDestIdx = this.states.length - 1;
      const tempPivot = items[pivotDest];
      items[pivotDest] = items[high];
      items[high] = tempPivot;

      items[pivotDest].status = "sorted";
      items[pivotDest].pointer = "sorted";
      if (pivotDest !== high) {
        items[high].pointer = undefined;
        items[high].status = "default";
      }
      sortedIndices.add(pivotDest);

      this.states.push(
        buildArrayState(
          this.states.length,
          `Pivot ${pivotVal} settled at final sorted index ${pivotDest}`,
          items,
          { pivotIndex: pivotDest },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "PARTITION_COMPLETE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevDestIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [items[pivotDest].id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [items[pivotDest].id],
          label: `Pivot ${pivotVal} settled`,
          anchorPreference: "center",
        },
        whatHappened: `Pivot ${pivotVal} moved to its final sorted position at index ${pivotDest}.`,
        reason: `All elements to the left (<= ${pivotVal}) and all elements to the right (>= ${pivotVal}) are segregated.`,
        consequence: `Subarrays [${low}..${pivotDest - 1}] and [${pivotDest + 1}..${high}] will be recursively sorted.`,
        title: `Partition complete`,
        explanation: `Pivot ${pivotVal} is now locked in its final sorted position. Left elements are <= ${pivotVal}, right elements are >= ${pivotVal}.`,
      });

      return pivotDest;
    };

    const quickSortHelper = (low: number, high: number) => {
      if (low < high) {
        const pi = partition(low, high);
        quickSortHelper(low, pi - 1);
        quickSortHelper(pi + 1, high);
      } else if (low === high) {
        sortedIndices.add(low);
        items[low].status = "sorted";
      }
    };

    quickSortHelper(0, items.length - 1);

    const prevFinalIdx = this.states.length - 1;
    for (const it of items) {
      it.status = "sorted";
      it.pointer = undefined;
    }
    this.states.push(buildArrayState(this.states.length, "Quick Sort Complete: Fully Sorted Array", items));
    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "SORT_COMPLETE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevFinalIdx,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: items.map((it) => it.id),
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: items.map((it) => it.id),
        label: "Fully sorted array",
        anchorPreference: "center",
      },
      whatHappened: "All subproblems resolved and merged.",
      reason: "Recursive divide-and-conquer base cases reached.",
      consequence: "The entire array is now sorted in non-decreasing order.",
      title: "Sorting complete",
      explanation: "All partitions have been processed. The array is fully sorted.",
    });

    return this.formatResult({ length: arr.length });
  }
}

// =========================================================================
// 3. MERGE SORT ENGINE (Tier 1 Demo-Critical)
// =========================================================================
export class MergeSortEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "merge-sort";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("merge-sort");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const maxElements = limits?.maxElements || 12;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, "Merge Sort: Initial Array", items));

    const merge = (low: number, mid: number, high: number) => {
      const prevMergeIdx = this.states.length - 1;
      const leftSlice = items.slice(low, mid + 1).map((x) => ({ ...x }));
      const rightSlice = items.slice(mid + 1, high + 1).map((x) => ({ ...x }));

      for (let k = low; k <= high; k++) {
        items[k].status = "active";
      }

      this.states.push(
        buildArrayState(
          this.states.length,
          `Merging Subarrays: [${low}..${mid}] and [${mid + 1}..${high}]`,
          items,
          { low, mid, high },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "DIVIDE_MERGE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevMergeIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: items.slice(low, high + 1).map((x) => x.id),
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: items.slice(low, high + 1).map((x) => x.id),
          label: `Merge range [${low}..${high}]`,
          anchorPreference: "center",
        },
        whatHappened: `Begin two-finger merge of sorted halves [${low}..${mid}] and [${mid + 1}..${high}].`,
        reason: `Divide-and-conquer merges already-sorted sublists in linear time O(n).`,
        consequence: `Subarray [${low}..${high}] will become fully sorted.`,
        title: `Merge Subarrays`,
        explanation: `We compare the smallest available elements from both sorted halves and write the smaller one back.`,
      });

      let p1 = 0;
      let p2 = 0;
      let writeIdx = low;

      while (p1 < leftSlice.length && p2 < rightSlice.length) {
        if (leftSlice[p1].value <= rightSlice[p2].value) {
          items[writeIdx] = leftSlice[p1];
          p1++;
        } else {
          items[writeIdx] = rightSlice[p2];
          p2++;
        }
        writeIdx++;
      }

      while (p1 < leftSlice.length) {
        items[writeIdx++] = leftSlice[p1++];
      }
      while (p2 < rightSlice.length) {
        items[writeIdx++] = rightSlice[p2++];
      }

      const prevMergedIdx = this.states.length - 1;
      for (let k = low; k <= high; k++) {
        items[k].status = high - low === arr.length - 1 ? "sorted" : "visited";
      }

      this.states.push(
        buildArrayState(
          this.states.length,
          `Merged Range [${low}..${high}] in Sorted Order`,
          items,
          { low, high },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "MERGE_COMPLETE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevMergedIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: items.slice(low, high + 1).map((x) => x.id),
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: items.slice(low, high + 1).map((x) => x.id),
          label: `Sorted sublist [${low}..${high}]`,
          anchorPreference: "center",
        },
        whatHappened: `Subarrays successfully merged into sorted order for range [${low}..${high}].`,
        reason: `All elements in the subrange have been sequentially placed.`,
        consequence: `Ready for higher-level merge passes.`,
        title: `Subarray sorted`,
        explanation: `The merged subrange is now ordered correctly.`,
      });
    };

    const mergeSortHelper = (low: number, high: number) => {
      if (low < high) {
        const mid = Math.floor((low + high) / 2);
        mergeSortHelper(low, mid);
        mergeSortHelper(mid + 1, high);
        merge(low, mid, high);
      }
    };

    mergeSortHelper(0, items.length - 1);

    const prevFinal = this.states.length - 1;
    for (const it of items) it.status = "sorted";
    this.states.push(buildArrayState(this.states.length, "Merge Sort Complete: Sorted Array", items));
    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "SORT_COMPLETE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevFinal,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: items.map((x) => x.id),
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: items.map((x) => x.id),
        label: "Final sorted array",
        anchorPreference: "center",
      },
      whatHappened: "Merge sort completed.",
      reason: "All recursive split-and-merge steps resolved.",
      consequence: "Array is completely sorted in O(n log n) time.",
      title: "Merge sort complete",
      explanation: "All merge passes finished. The output array is fully ordered.",
    });

    return this.formatResult({ length: arr.length });
  }
}

// =========================================================================
// 4. BUBBLE SORT ENGINE (Tier 2)
// =========================================================================
export class BubbleSortEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "bubble-sort";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("bubble-sort");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const maxElements = limits?.maxElements || 10;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, "Bubble Sort: Initial Array", items));

    const n = items.length;
    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;

      for (let j = 0; j < n - 1 - pass; j++) {
        const prevIdx = this.states.length - 1;

        if (items[j].value > items[j + 1].value) {
          const temp = items[j];
          items[j] = items[j + 1];
          items[j + 1] = temp;
          swapped = true;

          items[j].status = "active";
          items[j + 1].status = "active";

          this.states.push(
            buildArrayState(
              this.states.length,
              `Pass ${pass + 1}: Swap ${items[j].value} and ${items[j + 1].value}`,
              items,
              { pass, j },
            ),
          );

          this.transformations.push({
            id: `t-${this.transformations.length + 1}`,
            type: "SWAP",
            stepNumber: this.transformations.length + 1,
            beforeStateIndex: prevIdx,
            afterStateIndex: this.states.length - 1,
            affectedEntityIds: [items[j].id, items[j + 1].id],
            affectedRelationshipIds: [],
            semanticFocus: {
              entityIds: [items[j].id, items[j + 1].id],
              label: `Swap elements`,
              anchorPreference: "center",
            },
            whatHappened: `Swap ${items[j].value} and ${items[j + 1].value} at indices ${j} and ${j + 1}.`,
            reason: `Adjacent inversion detected: previous element was greater than next element.`,
            consequence: `Larger value bubbles toward the end of the array.`,
            title: `Bubble swap`,
            explanation: `Comparing adjacent values. Since ${items[j + 1].value} < ${items[j].value}, we swap them to move the larger value rightward.`,
          });
        }
      }

      items[n - 1 - pass].status = "sorted";
      if (!swapped) break;
    }

    const prevFinal = this.states.length - 1;
    for (const it of items) it.status = "sorted";
    this.states.push(buildArrayState(this.states.length, "Bubble Sort Complete", items));
    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "SORT_COMPLETE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevFinal,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: items.map((x) => x.id),
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: items.map((x) => x.id),
        label: "Sorted array",
        anchorPreference: "center",
      },
      whatHappened: "Bubble sort finished.",
      reason: "No further inversions exist.",
      consequence: "Array is sorted.",
      title: "Bubble sort complete",
      explanation: "All passes complete. The array is sorted.",
    });

    return this.formatResult({ length: arr.length });
  }
}

// =========================================================================
// 5. SELECTION SORT ENGINE (Tier 2)
// =========================================================================
export class SelectionSortEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "selection-sort";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("selection-sort");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const maxElements = limits?.maxElements || 10;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, "Selection Sort: Initial Array", items));

    const n = items.length;
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;

      for (let j = i + 1; j < n; j++) {
        if (items[j].value < items[minIdx].value) {
          minIdx = j;
        }
      }

      const prevIdx = this.states.length - 1;
      if (minIdx !== i) {
        const temp = items[i];
        items[i] = items[minIdx];
        items[minIdx] = temp;
      }
      items[i].status = "sorted";

      this.states.push(
        buildArrayState(
          this.states.length,
          `Pass ${i + 1}: Place minimum ${items[i].value} at index ${i}`,
          items,
          { i, minIdx },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "SELECT_MIN",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [items[i].id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [items[i].id],
          label: `Minimum element ${items[i].value}`,
          anchorPreference: "center",
        },
        whatHappened: `Selected minimum value ${items[i].value} and placed it at index ${i}.`,
        reason: `Selection sort finds the global minimum of the unsorted suffix [${i}..${n - 1}].`,
        consequence: `Prefix [0..${i}] is permanently sorted.`,
        title: `Select minimum element`,
        explanation: `We scan the unsorted portion of the array, find the smallest element, and swap it into position ${i}.`,
      });
    }

    const prevFinal = this.states.length - 1;
    for (const it of items) it.status = "sorted";
    this.states.push(buildArrayState(this.states.length, "Selection Sort Complete", items));
    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "SORT_COMPLETE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevFinal,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: items.map((x) => x.id),
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: items.map((x) => x.id),
        label: "Sorted array",
        anchorPreference: "center",
      },
      whatHappened: "Selection sort completed.",
      reason: "All minimums placed.",
      consequence: "Array is sorted.",
      title: "Sorting complete",
      explanation: "All passes complete. The array is fully sorted.",
    });

    return this.formatResult({ length: arr.length });
  }
}

// =========================================================================
// 6. INSERTION SORT ENGINE (Tier 2)
// =========================================================================
export class InsertionSortEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "insertion-sort";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("insertion-sort");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const maxElements = limits?.maxElements || 10;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: idx === 0 ? "sorted" : "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, "Insertion Sort: Index 0 is trivially sorted", items));

    const n = items.length;
    for (let i = 1; i < n; i++) {
      const prevIdx = this.states.length - 1;
      const key = items[i];
      let j = i - 1;

      while (j >= 0 && items[j].value > key.value) {
        items[j + 1] = items[j];
        j--;
      }
      items[j + 1] = key;

      for (let k = 0; k <= i; k++) items[k].status = "sorted";

      this.states.push(
        buildArrayState(
          this.states.length,
          `Insert ${key.value} into Sorted Prefix at Position ${j + 1}`,
          items,
          { insertedValue: key.value, targetIndex: j + 1 },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "INSERT_SORTED",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [key.id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [key.id],
          label: `Insert ${key.value}`,
          anchorPreference: "center",
        },
        whatHappened: `Shift elements greater than ${key.value} rightward and place ${key.value} at index ${j + 1}.`,
        reason: `Maintains sorted invariant for subarray [0..${i}].`,
        consequence: `Subarray [0..${i}] is now sorted.`,
        title: `Insert element`,
        explanation: `We pick ${key.value} and slide it backward through the sorted prefix until reaching its proper sorted slot.`,
      });
    }

    return this.formatResult({ length: arr.length });
  }
}

// =========================================================================
// 7. HEAP SORT ENGINE (Tier 2)
// =========================================================================
export class HeapSortEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "heap-sort";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("heap-sort");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const maxElements = limits?.maxElements || 10;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, "Heap Sort: Initial Array", items));

    const heapify = (n: number, i: number) => {
      let largest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;

      if (l < n && items[l].value > items[largest].value) largest = l;
      if (r < n && items[r].value > items[largest].value) largest = r;

      if (largest !== i) {
        const temp = items[i];
        items[i] = items[largest];
        items[largest] = temp;
        heapify(n, largest);
      }
    };

    const n = items.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      heapify(n, i);
    }

    const prevHeapBuilt = this.states.length - 1;
    this.states.push(buildArrayState(this.states.length, "Max-Heap Constructed", items));
    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "HEAPIFY",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevHeapBuilt,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: items.map((x) => x.id),
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: [items[0].id],
        label: `Max-heap root`,
        anchorPreference: "center",
      },
      whatHappened: `Transformed array into a valid Max-Heap in O(n) time.`,
      reason: `The largest element is now guaranteed to reside at root index 0.`,
      consequence: `Ready to extract max elements sequentially.`,
      title: `Build Max-Heap`,
      explanation: `We heapify non-leaf nodes bottom-up. Root element ${items[0].value} is now the global maximum.`,
    });

    for (let i = n - 1; i > 0; i--) {
      const prevExtract = this.states.length - 1;
      const maxVal = items[0].value;

      const temp = items[0];
      items[0] = items[i];
      items[i] = temp;
      items[i].status = "sorted";

      heapify(i, 0);

      this.states.push(
        buildArrayState(
          this.states.length,
          `Extracted Max ${maxVal} to Sorted Suffix at Index ${i}`,
          items,
          { extracted: maxVal, heapSize: i },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "EXTRACT_MAX",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevExtract,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [items[i].id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [items[i].id],
          label: `Extracted ${maxVal}`,
          anchorPreference: "center",
        },
        whatHappened: `Swap maximum element ${maxVal} with end of heap, reduce heap size, and restore heap property.`,
        reason: `Heap sort repeatedly moves the maximum element to its final sorted index.`,
        consequence: `Heap size decreases to ${i}; sorted suffix increases.`,
        title: `Extract maximum`,
        explanation: `We swap max element ${maxVal} to the end of the array, lock it as sorted, and sift down the new root.`,
      });
    }

    const prevFinal = this.states.length - 1;
    items[0].status = "sorted";
    this.states.push(buildArrayState(this.states.length, "Heap Sort Complete: Sorted Array", items));
    this.transformations.push({
      id: `t-${this.transformations.length + 1}`,
      type: "SORT_COMPLETE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: prevFinal,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: items.map((x) => x.id),
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: items.map((x) => x.id),
        label: "Sorted array",
        anchorPreference: "center",
      },
      whatHappened: "Heap sort finished.",
      reason: "All elements extracted.",
      consequence: "Array is sorted.",
      title: "Sorting complete",
      explanation: "The entire array is now sorted in O(n log n) time.",
    });

    return this.formatResult({ length: arr.length });
  }
}

// =========================================================================
// 8. LINEAR SEARCH ENGINE (Tier 2)
// =========================================================================
export class LinearSearchEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "linear-search";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("linear-search");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const target = input?.target !== undefined ? input.target : (defaultData.target ?? 20);

    const maxElements = limits?.maxElements || 12;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, `Linear Search initialized for target ${target}`, items));

    let found = false;
    for (let i = 0; i < items.length; i++) {
      const prevIdx = this.states.length - 1;
      const isMatch = items[i].value === target;

      for (let k = 0; k < i; k++) items[k].status = "visited";
      items[i].status = isMatch ? "found" : "active";
      items[i].pointer = "current";

      this.states.push(
        buildArrayState(
          this.states.length,
          isMatch ? `Found Target ${target} at Index ${i}` : `Check Index ${i}: array[${i}] = ${items[i].value}`,
          items,
          { i, target, found: isMatch },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: isMatch ? "FOUND" : "COMPARE",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`arr-${i}`],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [`arr-${i}`],
          label: `Index ${i}: ${items[i].value}`,
          anchorPreference: "center",
        },
        whatHappened: isMatch
          ? `Found matching element ${target} at index ${i}.`
          : `Examine element at index ${i} with value ${items[i].value}.`,
        reason: isMatch
          ? `array[${i}] === target (${target}).`
          : `array[${i}] (${items[i].value}) !== target (${target}). Advance search.`,
        consequence: isMatch ? "Search terminates successfully." : `Advance to index ${i + 1}.`,
        title: isMatch ? "Target found" : `Inspect index ${i}`,
        explanation: isMatch
          ? `Target ${target} matches element at index ${i}. Search succeeds.`
          : `Element ${items[i].value} does not match target ${target}. Check next cell.`,
      });

      if (isMatch) {
        found = true;
        break;
      }
    }

    return this.formatResult({ length: arr.length, found, target });
  }
}

// =========================================================================
// 9. TWO POINTER ENGINE (Tier 3)
// =========================================================================
export class TwoPointerEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "two-pointer";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("two-pointer");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const target = input?.target !== undefined ? input.target : (defaultData.target ?? 15);

    const maxElements = limits?.maxElements || 12;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);
    arr.sort((a, b) => a - b);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    let left = 0;
    let right = items.length - 1;

    items[left].pointer = "left";
    items[right].pointer = "right";
    this.states.push(
      buildArrayState(0, `Two Pointer Target Sum = ${target}`, items, { left, right, target }),
    );

    let found = false;
    while (left < right) {
      const prevIdx = this.states.length - 1;
      const currentSum = items[left].value + items[right].value;

      items[left].status = "active";
      items[right].status = "active";
      items[left].pointer = "left";
      items[right].pointer = "right";

      if (currentSum === target) {
        found = true;
        items[left].status = "found";
        items[right].status = "found";

        this.states.push(
          buildArrayState(
            this.states.length,
            `Pair Found: ${items[left].value} + ${items[right].value} = ${target}`,
            items,
            { left, right, currentSum },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "FOUND",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [items[left].id, items[right].id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [items[left].id, items[right].id],
            label: `Pair matches target sum`,
            anchorPreference: "center",
          },
          whatHappened: `Found pair ${items[left].value} (index ${left}) and ${items[right].value} (index ${right}).`,
          reason: `Sum equals target ${target}.`,
          consequence: `Algorithm terminates successfully.`,
          title: `Target pair found`,
          explanation: `The two pointers point to values summing to ${target}.`,
        });
        break;
      }

      const isTooSmall = currentSum < target;
      this.states.push(
        buildArrayState(
          this.states.length,
          `Sum ${currentSum} ${isTooSmall ? "<" : ">"} Target ${target}: ${isTooSmall ? "Advance Left" : "Decrement Right"}`,
          items,
          { left, right, currentSum },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "MOVE_POINTER",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: isTooSmall ? [items[left].id] : [items[right].id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [items[left].id, items[right].id],
          label: `Sum = ${currentSum}`,
          anchorPreference: "center",
        },
        whatHappened: isTooSmall
          ? `Current sum ${currentSum} < ${target}. Advance left pointer.`
          : `Current sum ${currentSum} > ${target}. Decrement right pointer.`,
        reason: isTooSmall
          ? `Array is sorted; incrementing left increases total sum.`
          : `Array is sorted; decrementing right decreases total sum.`,
        consequence: isTooSmall ? `left = ${left + 1}` : `right = ${right - 1}`,
        title: isTooSmall ? `Advance left pointer` : `Decrement right pointer`,
        explanation: `Since the sum is ${isTooSmall ? "too small" : "too large"}, we adjust the ${isTooSmall ? "left" : "right"} pointer.`,
      });

      items[left].pointer = undefined;
      items[right].pointer = undefined;
      items[left].status = "visited";
      items[right].status = "visited";

      if (isTooSmall) left++;
      else right--;
    }

    return this.formatResult({ found, target });
  }
}

// =========================================================================
// 10. SLIDING WINDOW ENGINE (Tier 3)
// =========================================================================
export class SlidingWindowEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "sliding-window";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("sliding-window");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const k = input?.k || 3;

    const maxElements = limits?.maxElements || 12;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);
    const windowSize = Math.min(k, arr.length);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    let currentSum = 0;
    for (let i = 0; i < windowSize; i++) {
      currentSum += items[i].value;
      items[i].status = "active";
      items[i].pointer = i === 0 ? "W-Start" : i === windowSize - 1 ? "W-End" : undefined;
    }

    let maxSum = currentSum;
    let maxStart = 0;

    this.states.push(
      buildArrayState(0, `Initial Sliding Window of size k=${windowSize}: Sum = ${currentSum}`, items, {
        windowSize,
        currentSum,
        maxSum,
      }),
    );

    for (let i = windowSize; i < items.length; i++) {
      const prevIdx = this.states.length - 1;
      const outgoing = items[i - windowSize].value;
      const incoming = items[i].value;

      currentSum = currentSum - outgoing + incoming;
      const isNewMax = currentSum > maxSum;
      if (isNewMax) {
        maxSum = currentSum;
        maxStart = i - windowSize + 1;
      }

      for (let j = 0; j < items.length; j++) {
        if (j >= i - windowSize + 1 && j <= i) {
          items[j].status = isNewMax ? "found" : "active";
          items[j].pointer = j === i - windowSize + 1 ? "W-Start" : j === i ? "W-End" : undefined;
        } else {
          items[j].status = "default";
          items[j].pointer = undefined;
        }
      }

      this.states.push(
        buildArrayState(
          this.states.length,
          `Slide Window: -${outgoing} +${incoming} -> New Sum = ${currentSum}`,
          items,
          { currentSum, maxSum, maxStart },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "SLIDE_WINDOW",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [items[i - windowSize].id, items[i].id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: items.slice(i - windowSize + 1, i + 1).map((x) => x.id),
          label: `Window Sum = ${currentSum}`,
          anchorPreference: "center",
        },
        whatHappened: `Slide window right: drop element ${outgoing} at index ${i - windowSize}, add ${incoming} at index ${i}.`,
        reason: `Sliding window maintains sum in O(1) time without re-summing all elements.`,
        consequence: `Current window sum is now ${currentSum}. Max sum so far: ${maxSum}.`,
        title: `Slide window`,
        explanation: `By subtracting the exiting element and adding the entering element, we update the window metric in O(1) steps.`,
      });
    }

    return this.formatResult({ maxSum, maxStart, windowSize });
  }
}

// =========================================================================
// 11. ARRAY OPERATIONS ENGINE (Tier 2)
// =========================================================================
export class ArrayOperationsEngine extends BaseDSAEngine<ArrayEngineInput> {
  public readonly conceptId = "array";

  public execute(input: ArrayEngineInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("array");
    let arr = input?.values && input.values.length > 0 ? [...input.values] : [...defaultData.values];
    const maxElements = limits?.maxElements || 12;
    if (arr.length > maxElements) arr = arr.slice(0, maxElements);

    const items = arr.map((val, idx) => ({
      id: `arr-${idx}`,
      value: val,
      status: "default",
      role: "element",
      pointer: undefined as string | undefined,
    }));

    this.states.push(buildArrayState(0, "Array: Initial Allocated Elements", items));

    const op = input?.operation || "insert";
    if (op === "insert") {
      const prevIdx = this.states.length - 1;
      const insertVal = input?.value ?? 99;
      const insertPos = Math.min(input?.index ?? 2, items.length);

      const newItem = {
        id: `arr-${items.length}`,
        value: insertVal,
        status: "found",
        role: "element",
        pointer: "inserted",
      };
      items.splice(insertPos, 0, newItem);

      this.states.push(
        buildArrayState(
          this.states.length,
          `Insert ${insertVal} at Index ${insertPos}`,
          items,
          { insertedValue: insertVal, index: insertPos },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "INSERT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [newItem.id],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [newItem.id],
          label: `Insert ${insertVal}`,
          anchorPreference: "center",
        },
        whatHappened: `Insert value ${insertVal} at position ${insertPos}.`,
        reason: `Subsequent elements shifted right to accommodate new element.`,
        consequence: `Array length increases by 1.`,
        title: `Insert element`,
        explanation: `Array insertion requires shifting all subsequent elements rightward in O(n) time.`,
      });
    }

    return this.formatResult({ length: items.length });
  }
}
