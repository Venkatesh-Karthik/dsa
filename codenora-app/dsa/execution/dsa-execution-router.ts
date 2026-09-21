/**
 * Cognora DSA Acceleration Layer - Central Execution Router
 *
 * Provides the single, clean integration boundary between Cognora's Tutor/UI
 * and the deterministic DSA acceleration engines.
 *
 * ROUTING PRINCIPLE (NEW):
 * ========================
 * NEVER: "Does the prompt contain 'linked list'?" → load default dataset.
 * ALWAYS: "What exactly is the user asking me to teach?"
 *
 * Routing logic:
 * 1. Resolve FULL intent: action + concept + variant + operation + input + constraints.
 * 2. Check canExecuteDeterministically(intent, capability):
 *    - Checks concept ∧ variant ∧ operation ∧ constraints (ALL dimensions)
 *    - Returns specific reason code if any dimension fails
 *    - If YES: extract input, execute engine, validate, adapt to TeachingMoments.
 *    - If NO: returns { handled: false, reason: <specific reason code> }
 *      so Tutor falls back to the Nemotron universal AI pipeline.
 * 3. Log every routing decision (dev only, never exposed to user).
 *
 * INVARIANT: No silent downgrade.
 * - DOUBLY_LINKED_LIST → Nemotron (UNSUPPORTED_VARIANT)
 * - CIRCULAR_LINKED_LIST → Nemotron (UNSUPPORTED_VARIANT)
 * - AVL DELETE → Nemotron (UNSUPPORTED_OPERATION)
 * - HEAP DELETE → Nemotron (UNSUPPORTED_OPERATION)
 * - Dijkstra + negative edges → Nemotron (UNSUPPORTED_CONSTRAINT)
 * - Binary search + unsorted → Nemotron (UNSUPPORTED_CONSTRAINT)
 */

import { DSAConceptRegistry } from "../registry/concept-registry";
import { DSAConceptResolver } from "../resolver/concept-resolver";
import { DSAInputExtractor } from "../parsing/input-extractor";
import { DSATeachingMomentAdapter, type AdaptedDSALesson } from "../adapter/teaching-moment-adapter";
import { getDefaultDataset } from "../datasets/default-datasets";
import { resolveDSAFullIntent, formatIntentLog, type DSARoutingReasonCode } from "../intent/dsa-intent-resolver";
import { canExecuteDeterministically } from "../registry/capability-registry";

// Engine Imports
import {
  ArrayOperationsEngine,
  BinarySearchEngine,
  QuickSortEngine,
  MergeSortEngine,
  BubbleSortEngine,
  SelectionSortEngine,
  InsertionSortEngine,
  HeapSortEngine,
  LinearSearchEngine,
  TwoPointerEngine,
  SlidingWindowEngine,
} from "../engines/array-sorting-engines";
import {
  LinkedListEngine,
  StackEngine,
  QueueEngine,
  HashTableEngine,
} from "../engines/linear-engines";
import {
  AVLTreeEngine,
  BSTEngine,
  HeapEngine,
  TreeTraversalEngine,
} from "../engines/tree-engines";
import {
  DijkstraEngine,
  BellmanFordEngine,
  BFSEngine,
  DFSEngine,
  TopologicalSortEngine,
  KruskalMSTEngine,
  PrimMSTEngine,
  FloydWarshallEngine,
} from "../engines/graph-engines";
import {
  DynamicProgrammingEngine,
  GreedyEngine,
  BacktrackingEngine,
} from "../engines/paradigm-engines";

import { DSALessonIntentValidator } from "../validation/lesson-intent-validator";

export interface DSARouteResult {
  handled: boolean;
  conceptId?: string;
  reason?: DSARoutingReasonCode;
  errorMessage?: string;
  lesson?: AdaptedDSALesson;
  intent?: DSAFullIntent;
}

export class DSAExecutionRouter {
  private static bootstrapped = false;

  public static initialize(): void {
    if (this.bootstrapped) {
      return;
    }
    const registry = DSAConceptRegistry.getInstance();

    // 1-4: Linear Containers
    registry.registerEngine("array", () => new ArrayOperationsEngine());
    registry.registerEngine("linked-list", () => new LinkedListEngine());
    registry.registerEngine("stack", () => new StackEngine());
    registry.registerEngine("queue", () => new QueueEngine());
    registry.registerEngine("hash-table", () => new HashTableEngine());

    // 6-9: Searching & Pointers
    registry.registerEngine("linear-search", () => new LinearSearchEngine());
    registry.registerEngine("binary-search", () => new BinarySearchEngine());
    registry.registerEngine("two-pointer", () => new TwoPointerEngine());
    registry.registerEngine("sliding-window", () => new SlidingWindowEngine());

    // 10-15: Sorting
    registry.registerEngine("bubble-sort", () => new BubbleSortEngine());
    registry.registerEngine("selection-sort", () => new SelectionSortEngine());
    registry.registerEngine("insertion-sort", () => new InsertionSortEngine());
    registry.registerEngine("merge-sort", () => new MergeSortEngine());
    registry.registerEngine("quick-sort", () => new QuickSortEngine());
    registry.registerEngine("heap-sort", () => new HeapSortEngine());

    // 16-19: Trees
    registry.registerEngine("bst", () => new BSTEngine());
    registry.registerEngine("avl", () => new AVLTreeEngine());
    registry.registerEngine("heap", () => new HeapEngine());
    registry.registerEngine("tree-traversals", () => new TreeTraversalEngine());

    // 20-27: Graphs
    registry.registerEngine("bfs", () => new BFSEngine());
    registry.registerEngine("dfs", () => new DFSEngine());
    registry.registerEngine("dijkstra", () => new DijkstraEngine());
    registry.registerEngine("bellman-ford", () => new BellmanFordEngine());
    registry.registerEngine("floyd-warshall", () => new FloydWarshallEngine());
    registry.registerEngine("topological-sort", () => new TopologicalSortEngine());
    registry.registerEngine("kruskal", () => new KruskalMSTEngine());
    registry.registerEngine("prim", () => new PrimMSTEngine());

    // 28-30: Paradigms
    registry.registerEngine("recursion-backtracking", () => new BacktrackingEngine());
    registry.registerEngine("greedy", () => new GreedyEngine());
    registry.registerEngine("dynamic-programming", () => new DynamicProgrammingEngine());

    this.bootstrapped = true;
  }

  /**
   * Evaluates prompt using FULL INTENT analysis.
   *
   * If the full intent (concept + variant + operation + constraints) is
   * supported by a deterministic engine → executes and returns lesson.
   * If any dimension is unsupported → returns { handled: false } for Nemotron.
   *
   * NEVER silently substitutes a different concept, variant, or operation.
   */
  public static tryExecuteDSA(prompt: string): DSARouteResult {
    this.initialize();

    if (!prompt || typeof prompt !== "string") {
      return { handled: false, reason: "NO_CONCEPT_MATCH" };
    }

    // =========================================================================
    // STEP 1: Fast Deterministic Concept Resolution (< 2ms)
    // Uses existing scoring-based concept resolver for concept ID.
    // =========================================================================
    const resolved = DSAConceptResolver.resolve(prompt);
    if (!resolved) {
      console.info(`[COGNORA][ROUTER] route=NEMOTRON reason=NO_CONCEPT_MATCH`);
      return { handled: false, reason: "NO_CONCEPT_MATCH" };
    }

    // =========================================================================
    // STEP 2: Full Intent Resolution
    // Extracts action, concept, variant, operation, constraints, etc.
    // Uses the authoritative resolved concept ID to guarantee concept identity.
    // =========================================================================
    const fullIntent = resolveDSAFullIntent(prompt, resolved.conceptId);

    // Log full intent for debugging (never exposed to user)
    console.info(formatIntentLog(fullIntent));

    // =========================================================================
    // STEP 3: Full Capability Match
    // Checks concept + variant + operation + constraints — ALL dimensions.
    // This replaces the old isSupported(conceptId) check.
    // =========================================================================
    const capabilityMatch = canExecuteDeterministically(fullIntent);

    console.info(
      `[COGNORA][ROUTER]` +
      ` concept=${resolved.conceptId}` +
      ` variant=${fullIntent.variant ?? "DEFAULT"}` +
      ` operation=${fullIntent.operation ?? "NONE"}` +
      ` deterministicCompatible=${capabilityMatch.compatible}` +
      ` reason="${capabilityMatch.reason}"` +
      ` route=${capabilityMatch.compatible ? "DETERMINISTIC" : "NEMOTRON"}`
    );

    // If any dimension is incompatible → Nemotron handles it
    if (!capabilityMatch.compatible) {
      return {
        handled: false,
        conceptId: resolved.conceptId,
        reason: capabilityMatch.reasonCode,
      };
    }

    // Also verify the concept is registered in the engine registry
    const registry = DSAConceptRegistry.getInstance();
    const isEngineRegistered = registry.isSupported(resolved.conceptId);
    if (!isEngineRegistered) {
      console.info(
        `[COGNORA][ROUTER] concept=${resolved.conceptId} engineRegistered=false route=NEMOTRON reason=UNSUPPORTED_CONCEPT`
      );
      return {
        handled: false,
        conceptId: resolved.conceptId,
        reason: "UNSUPPORTED_CONCEPT",
      };
    }

    // =========================================================================
    // STEP 4: Extract Dynamic User Input or fallback to default golden dataset
    // =========================================================================
    const limits = registry.getLimits(resolved.conceptId);
    const extracted = DSAInputExtractor.extract(prompt, limits);

    if (extracted.error) {
      console.warn(
        `[COGNORA][DSA][INPUT] concept=${resolved.conceptId} error="${extracted.error}"`,
      );
      return {
        handled: false,
        conceptId: resolved.conceptId,
        reason: "INPUT_ERROR",
        errorMessage: extracted.error,
      };
    }

    const inputSource = extracted.hasCustomInput ? "custom" : "golden_default";
    const valuesCount = extracted.hasCustomInput
      ? extracted.values.length
      : getDefaultDataset(resolved.conceptId).values.length;

    console.info(
      `[COGNORA][DSA][INPUT] concept=${resolved.conceptId} source=${inputSource} count=${valuesCount} target=${extracted.target ?? "none"}`,
    );

    // =========================================================================
    // STEP 5: Instantiate Engine & Execute Real Algorithm
    // =========================================================================
    const engine = registry.createEngine(resolved.conceptId);
    if (!engine) {
      return {
        handled: false,
        conceptId: resolved.conceptId,
        reason: "UNSUPPORTED_CONCEPT",
      };
    }

    const engineInput: Record<string, unknown> = {
      values: extracted.values,
      target: extracted.target,
      operation: extracted.operation || fullIntent.operation,
      // Graph inputs
      graph: extracted.graph,
      nodes: extracted.graph?.nodes,
      edges: extracted.graph?.edges,
      source: extracted.graph?.source,
      destination: extracted.graph?.destination,
      // Linked list inputs
      initialNodes: extracted.linkedList?.chain || (extracted.values.length > 0 ? extracted.values : undefined),
      deleteValues: extracted.linkedList?.deleteValues,
      insertValues: extracted.linkedList?.insertValue !== undefined ? [{
        value: extracted.linkedList.insertValue,
        after: extracted.linkedList.insertAfter,
        before: extracted.linkedList.insertBefore,
      }] : undefined,
      // Container inputs
      initialValues: extracted.values.length > 0 ? extracted.values : undefined,
      keys: extracted.values.length > 0 ? extracted.values : undefined,
      n: extracted.values.length > 0 ? extracted.values[0] : extracted.target,
      k: extracted.target,
    };

    let executionResult;
    try {
      executionResult = engine.execute(engineInput, limits);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[COGNORA][DSA][ENGINE_ERROR] concept=${resolved.conceptId} error="${msg}"`,
      );
      return {
        handled: false,
        conceptId: resolved.conceptId,
        reason: "EXECUTION_ERROR",
        errorMessage: msg,
      };
    }

    console.info(
      `[COGNORA][DSA][ENGINE] concept=${resolved.conceptId} transformations=${executionResult.transformations.length} states=${executionResult.states.length}`,
    );

    // =========================================================================
    // STEP 6: Validate State Transition Integrity
    // =========================================================================
    if (!executionResult.validation.valid) {
      const errSummary = executionResult.validation.errors.join("; ");
      console.error(
        `[COGNORA][DSA][VALIDATION] status=failed errors="${errSummary}"`,
      );
      return {
        handled: false,
        conceptId: resolved.conceptId,
        reason: "EXECUTION_ERROR",
        errorMessage: `DSA Validation Failure: ${errSummary}`,
      };
    }

    console.info(`[COGNORA][DSA][VALIDATION] status=passed`);

    // =========================================================================
    // STEP 7: Adapt to Existing Cognora TeachingMoments & SceneStates
    // =========================================================================
    const reg = registry.get(resolved.conceptId);
    const displayName = reg?.displayName || resolved.conceptId;

    const adapted = DSATeachingMomentAdapter.adapt(
      resolved.conceptId,
      displayName,
      executionResult.states,
      executionResult.transformations,
      prompt,
    );

    console.info(
      `[COGNORA][DSA][TEACHING] moments=${adapted.timeline.moments?.length || 0}`,
    );

    // =========================================================================
    // STEP 8: Semantic Safety Gate — Validate Lesson Against Full Intent
    // =========================================================================
    const semanticValidation = DSALessonIntentValidator.validate(fullIntent, adapted);
    if (!semanticValidation.valid) {
      console.warn(
        `[COGNORA][DSA][SEMANTIC_GATE] rejected: ${semanticValidation.reason}`,
      );
      return {
        handled: false,
        conceptId: resolved.conceptId,
        reason: "EXECUTION_ERROR",
        errorMessage: semanticValidation.reason,
      };
    }

    console.info(`[COGNORA][DSA][COMPLETE] concept=${resolved.conceptId} variant=${fullIntent.variant ?? "DEFAULT"} operation=${fullIntent.operation ?? "NONE"}`);

    return {
      handled: true,
      conceptId: resolved.conceptId,
      lesson: adapted,
      intent: fullIntent,
    };
  }
}
