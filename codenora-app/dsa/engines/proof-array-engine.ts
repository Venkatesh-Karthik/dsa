/**
 * Cognora DSA Acceleration Layer - Array Proof-of-Integration Engine
 *
 * Implements DSAConceptEngine for canonical linear array traversal & search.
 * Demonstrates:
 * 1. Dynamic user input consumption (e.g. [50, 30, 70, 20, 40] for 20).
 * 2. Real algorithmic execution (not hardcoded steps).
 * 3. Dynamic step count emerging from actual execution.
 * 4. Stable entity IDs ("arr-0", "arr-1", ...).
 * 5. Clean semantic states and transformations without canvas coordinates.
 */

import type { DSAConceptEngine, DSAExecutionResult, DSAValidationResult } from "../types/dsa-engine";
import type { DSASemanticEntity, DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAInputLimits } from "../types/dsa-concept";
import { DSAStateIntegrityValidator } from "../validation/state-integrity-validator";
import { getDefaultDataset } from "../datasets/default-datasets";

export interface ArrayEngineInput {
  values?: number[];
  target?: number;
}

export class ArrayConceptEngine implements DSAConceptEngine<ArrayEngineInput, DSASemanticState> {
  public readonly conceptId = "array";

  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(
    input: ArrayEngineInput,
    limits?: DSAInputLimits,
  ): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    // 1. Resolve input or fallback to golden default dataset
    const defaultData = getDefaultDataset("array");
    let values = input?.values && input.values.length > 0 ? input.values : defaultData.values;
    const target = input?.target !== undefined ? input.target : defaultData.target;

    // Apply limits
    const maxElements = limits?.maxElements || 20;
    if (values.length > maxElements) {
      values = values.slice(0, maxElements);
    }

    // 2. State 0: Initial Array Allocation
    const state0Entities = new Map<string, DSASemanticEntity>();
    for (let i = 0; i < values.length; i++) {
      const id = `arr-${i}`;
      state0Entities.set(id, {
        id,
        type: "ArrayCell",
        label: `${values[i]}`,
        value: values[i],
        role: "element",
        status: "default",
        properties: {
          index: i,
          width: 64,
          height: 64,
        },
      });
    }

    const state0: DSASemanticState = {
      version: 0,
      title: "Initial Array",
      entities: state0Entities,
      relationships: [],
      metadata: {
        length: values.length,
        target,
      },
    };
    this.states.push(state0);

    // 3. Step-by-step Execution: Sequential Search / Traversal
    let foundIndex = -1;

    for (let i = 0; i < values.length; i++) {
      const prevIndex = this.states.length - 1;
      const prev = this.states[prevIndex];

      // Clone entities from previous state
      const nextEntities = new Map<string, DSASemanticEntity>();
      for (const [id, ent] of prev.entities) {
        nextEntities.set(id, { ...ent, properties: { ...ent.properties } });
      }

      // Mark previous active cell as visited
      if (i > 0) {
        const prevActive = nextEntities.get(`arr-${i - 1}`);
        if (prevActive) {
          prevActive.status = "visited";
        }
      }

      // Inspect current element
      const currentVal = values[i];
      const isMatch = target !== undefined && currentVal === target;
      const currentCell = nextEntities.get(`arr-${i}`)!;
      currentCell.status = isMatch ? "found" : "active";

      const nextState: DSASemanticState = {
        version: this.states.length,
        title: isMatch ? `Found Target ${target} at Index ${i}` : `Inspect Index ${i}`,
        entities: nextEntities,
        relationships: [],
        metadata: {
          currentIndex: i,
          target,
          found: isMatch,
        },
      };
      this.states.push(nextState);

      const transId = `t-${this.transformations.length + 1}`;
      const transformation: TeachingTransformation = {
        id: transId,
        type: isMatch ? "SEARCH" : "VISIT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIndex,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: i > 0 ? [`arr-${i - 1}`, `arr-${i}`] : [`arr-${i}`],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [`arr-${i}`],
          label: `Index ${i}: ${currentVal}`,
          anchorPreference: "center",
        },
        whatHappened: isMatch
          ? `Element at index ${i} equals search target ${target}.`
          : `Inspect element at index ${i} with value ${currentVal}.`,
        reason: isMatch
          ? `Condition (array[${i}] === ${target}) is satisfied.`
          : target !== undefined
          ? `Value ${currentVal} does not match target ${target}. Advance pointer to next index.`
          : `Sequential scan evaluates contiguous elements in index order.`,
        consequence: isMatch
          ? `Search terminates successfully with index ${i}.`
          : `Pointer advances to index ${i + 1}.`,
        title: isMatch ? `Match Found: index ${i}` : `Check index ${i}`,
        explanation: isMatch
          ? `Target key ${target} matches the element at index ${i}. We highlight this cell in green as the search goal is satisfied.`
          : `We examine index ${i}. Since ${currentVal} is not equal to ${target ?? "the goal"}, the scan continues sequentially.`,
        isStateChange: true,
        codeSnippet: isMatch
          ? `if (arr[${i}] === target) return ${i};`
          : `i++; // now inspecting index ${i}`,
        codeLanguage: "typescript",
        importance: isMatch ? "CRITICAL" : "NORMAL",
      };
      this.transformations.push(transformation);

      if (isMatch) {
        foundIndex = i;
        break; // Goal satisfied
      }
    }

    // 4. Final State Transformation
    const lastStateIdx = this.states.length - 1;
    const finalEntities = new Map<string, DSASemanticEntity>();
    for (const [id, ent] of this.states[lastStateIdx].entities) {
      finalEntities.set(id, { ...ent, properties: { ...ent.properties } });
    }

    const finalState: DSASemanticState = {
      version: this.states.length,
      title: foundIndex !== -1 ? "Search Complete (Found)" : "Traversal Complete",
      entities: finalEntities,
      relationships: [],
      metadata: {
        completed: true,
        foundIndex,
        target,
      },
    };
    this.states.push(finalState);

    const finalTrans: TeachingTransformation = {
      id: `t-${this.transformations.length + 1}`,
      type: "FINAL_STATE",
      stepNumber: this.transformations.length + 1,
      beforeStateIndex: lastStateIdx,
      afterStateIndex: this.states.length - 1,
      affectedEntityIds: foundIndex !== -1 ? [`arr-${foundIndex}`] : [],
      affectedRelationshipIds: [],
      semanticFocus: {
        entityIds: foundIndex !== -1 ? [`arr-${foundIndex}`] : [],
        label: foundIndex !== -1 ? `Result: Index ${foundIndex}` : "End of Array",
      },
      whatHappened:
        foundIndex !== -1
          ? `Traversal successfully terminated at index ${foundIndex}.`
          : `All ${values.length} elements inspected.`,
      reason:
        foundIndex !== -1
          ? `Search target ${target} was located.`
          : `Linear scan reached end of contiguous memory.`,
      consequence: "Final verified algorithm state reached.",
      title: "Final Result",
      explanation:
        foundIndex !== -1
          ? `The linear array algorithm has concluded. Target ${target} is located at index ${foundIndex}.`
          : `The array traversal has visited all indices.`,
      isStateChange: false, // Pedagogical pause on final state
      importance: "HIGH",
    };
    this.transformations.push(finalTrans);

    this.complete = true;

    const validation = this.validate();

    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
      metadata: {
        inputValues: values,
        target,
        foundIndex,
      },
    };
  }

  public getAllStates(): DSASemanticState[] {
    return this.states;
  }

  public getTransformations(): TeachingTransformation[] {
    return this.transformations;
  }

  public getCurrentState(): DSASemanticState {
    return this.states[this.states.length - 1];
  }

  public getFinalState(): DSASemanticState {
    return this.states[this.states.length - 1];
  }

  public validate(): DSAValidationResult {
    return DSAStateIntegrityValidator.validate(this.states, this.transformations);
  }

  public isComplete(): boolean {
    return this.complete;
  }
}
