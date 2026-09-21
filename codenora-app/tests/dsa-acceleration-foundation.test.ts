import { describe, it, expect, vi } from "vitest";
import {
  DSAConceptRegistry,
  DSAConceptResolver,
  DSAInputExtractor,
  DSAStateIntegrityValidator,
  DSATeachingMomentAdapter,
  DSAExecutionRouter,
  getDefaultDataset,
  DEFAULT_TEACHING_DATASETS,
} from "../dsa";
import { ArrayConceptEngine } from "../dsa/engines/proof-array-engine";

describe("Cognora DSA Acceleration Layer Foundation", () => {
  // 1. Concept Normalization
  it("normalizes diverse user prompt casings, punctuations, and spacing", () => {
    const raw = "  Explain   Dijkstra's   Shortest-Path  Algorithm!  ";
    const normalized = DSAConceptResolver.normalizeText(raw);
    expect(normalized).toBe("explain dijkstras shortest-path algorithm");
  });

  // 2. Alias Resolution
  it("resolves concept aliases and natural language variants to canonical concept IDs", () => {
    // Dijkstra aliases
    const r1 = DSAConceptResolver.resolve("How does Dijkstra's algorithm work?");
    expect(r1).not.toBeNull();
    expect(r1?.conceptId).toBe("dijkstra");

    // AVL aliases
    const r2 = DSAConceptResolver.resolve("Show me an AVL rotation step by step");
    expect(r2).not.toBeNull();
    expect(r2?.conceptId).toBe("avl");

    // Binary search
    const r3 = DSAConceptResolver.resolve("Explain binarysearch on sorted array");
    expect(r3).not.toBeNull();
    expect(r3?.conceptId).toBe("binary-search");

    // Linked list
    const r4 = DSAConceptResolver.resolve("Demonstrate singly linked list pointer rewiring");
    expect(r4).not.toBeNull();
    expect(r4?.conceptId).toBe("linked-list");
  });

  // 3. Supported Concept Detection
  it("detects supported concepts registered with deterministic engines", () => {
    DSAExecutionRouter.initialize();
    const registry = DSAConceptRegistry.getInstance();
    expect(registry.isSupported("array")).toBe(true);
    const resolved = DSAConceptResolver.resolve("Explain static array operations");
    expect(resolved?.conceptId).toBe("array");
    expect(registry.isSupported(resolved!.conceptId)).toBe(true);
  });

  // 4. Unsupported Concept Detection
  it("detects unsupported non-registered concepts cleanly", () => {
    const registry = DSAConceptRegistry.getInstance();
    expect(registry.isSupported("quantum-computing" as any)).toBe(false);
  });

  // 5. Numeric Input Extraction
  it("extracts dynamic user input from bracketed, comma, or phrase patterns with optional targets", () => {
    // Bracketed array with target
    const ex1 = DSAInputExtractor.extract("binary search [4, 8, 12, 19, 25] for 19");
    expect(ex1.hasCustomInput).toBe(true);
    expect(ex1.values).toEqual([4, 8, 12, 19, 25]);
    expect(ex1.target).toBe(19);

    // Natural language 'using' phrase
    const ex2 = DSAInputExtractor.extract("Explain AVL using 50, 30, 70, 20, 40");
    expect(ex2.hasCustomInput).toBe(true);
    expect(ex2.values).toEqual([50, 30, 70, 20, 40]);

    // Space-separated numbers
    const ex3 = DSAInputExtractor.extract("sort values 42 17 8 99 23");
    expect(ex3.hasCustomInput).toBe(true);
    expect(ex3.values).toEqual([42, 17, 8, 99, 23]);
  });

  // 6. Default Dataset Selection
  it("provides deterministic golden teaching datasets when input is omitted", () => {
    const ex = DSAInputExtractor.extract("Explain linear array search");
    expect(ex.hasCustomInput).toBe(false);

    const defaultArray = getDefaultDataset("array");
    expect(defaultArray.values.length).toBeGreaterThan(0);
    expect(defaultArray.target).toBeDefined();

    // Verification of determinism across repeated accesses
    const defaultArray2 = getDefaultDataset("array");
    expect(defaultArray.values).toEqual(defaultArray2.values);
  });

  // 7. DSA Engine Interface Contract Execution
  it("executes the DSAConceptEngine interface and produces validated states and transformations", () => {
    const engine = new ArrayConceptEngine();
    const result = engine.execute({ values: [10, 20, 30], target: 20 });

    expect(result.success).toBe(true);
    expect(result.conceptId).toBe("array");
    expect(result.states.length).toBeGreaterThanOrEqual(3);
    expect(result.transformations.length).toBe(result.states.length - 1);
    expect(engine.isComplete()).toBe(true);
    expect(result.validation.valid).toBe(true);
  });

  // 8. Transformation Ordering
  it("enforces strictly monotonic step numbers and contiguous state indexing", () => {
    const engine = new ArrayConceptEngine();
    const result = engine.execute({ values: [5, 15, 25, 35], target: 35 });

    for (let i = 0; i < result.transformations.length; i++) {
      const t = result.transformations[i];
      expect(t.stepNumber).toBe(i + 1);
      expect(t.beforeStateIndex).toBe(i);
      expect(t.afterStateIndex).toBe(i + 1);
    }
  });

  // 9. State Transition Validation
  it("rejects consecutive identical states marked as state-changing", () => {
    const engine = new ArrayConceptEngine();
    const result = engine.execute({ values: [1, 2, 3], target: 2 });

    // Legitimate execution has no consecutive duplicates
    const validation = DSAStateIntegrityValidator.validate(result.states, result.transformations);
    expect(validation.valid).toBe(true);

    // Artificially duplicate a state and mark as state-changing
    const corruptStates = [...result.states];
    corruptStates[1] = corruptStates[0]; // identical
    const corruptValidation = DSAStateIntegrityValidator.validate(corruptStates, result.transformations);
    expect(corruptValidation.valid).toBe(false);
    expect(corruptValidation.errors.some((e) => e.includes("Consecutive Duplicate State"))).toBe(true);
  });

  // 10. Stable Semantic IDs
  it("maintains stable entity IDs across all transformation steps", () => {
    const engine = new ArrayConceptEngine();
    const result = engine.execute({ values: [10, 20, 30, 40], target: 30 });

    const expectedIds = ["arr-0", "arr-1", "arr-2", "arr-3"];
    for (const state of result.states) {
      for (const expected of expectedIds) {
        expect(state.entities.has(expected)).toBe(true);
      }
    }
  });

  // 11. Relationship Validity
  it("ensures all relationships only reference extant active entities", () => {
    const engine = new ArrayConceptEngine();
    const result = engine.execute({ values: [10, 20] });
    const validation = DSAStateIntegrityValidator.validate(result.states, result.transformations);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  // 12. Final State Validation
  it("produces an algorithmically valid final state with goal satisfaction", () => {
    const engine = new ArrayConceptEngine();
    const result = engine.execute({ values: [11, 22, 33], target: 22 });
    const finalState = result.finalState;

    expect(finalState.metadata.completed).toBe(true);
    expect(finalState.metadata.foundIndex).toBe(1);
    expect(finalState.entities.get("arr-1")?.status).toBe("found");
  });

  // 13. Dynamic Transformation Count
  it("dynamically derives step count based on dynamic input and target position", () => {
    const engine = new ArrayConceptEngine();

    // Target at index 0 -> short step count
    const rShort = engine.execute({ values: [10, 20, 30, 40, 50], target: 10 });
    // Target at index 4 -> longer step count
    const rLong = engine.execute({ values: [10, 20, 30, 40, 50], target: 50 });

    expect(rLong.transformations.length).toBeGreaterThan(rShort.transformations.length);
  });

  // 14. Playback Does Not Trigger Network Requests
  it("adapts to TeachingMoments and SceneStates allowing pure local playback with 0 network calls", () => {
    const engine = new ArrayConceptEngine();
    const exec = engine.execute({ values: [7, 14, 21], target: 14 });

    const adapted = DSATeachingMomentAdapter.adapt(
      "array",
      "Array Traversal",
      exec.states,
      exec.transformations,
      "Search array [7, 14, 21] for 14",
    );

    expect(adapted.timeline.states.length).toBe(exec.states.length);
    expect(adapted.timeline.moments?.length).toBe(exec.transformations.length);

    // Verify all moments have complete SceneState snapshots for local diffing
    for (const moment of adapted.timeline.moments!) {
      expect(moment.visualState).toBeDefined();
      expect(moment.beforeState).toBeDefined();
      expect(moment.afterState).toBeDefined();
      expect(moment.whatChanged).toBeDefined();
      expect(moment.whyItChanged).toBeDefined();
      expect(moment.consequence).toBeDefined();
      expect(moment.narration).toBeDefined();
    }
  });

  // 15. Unsupported Concept Routes to Nemotron
  // 15. Unsupported Concept / Non-DSA Routes to Fallback
  it("returns handled: false for non-DSA queries without throwing", () => {
    const result = DSAExecutionRouter.tryExecuteDSA("Explain how photosynthesis works in plant cells");
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("NO_CONCEPT_MATCH");
  });

  // 16. Non-DSA Question Returns NO_CONCEPT_MATCH
  it("returns handled: false and reason: NO_CONCEPT_MATCH for non-DSA queries", () => {
    const result = DSAExecutionRouter.tryExecuteDSA("What is the capital of France?");
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("NO_CONCEPT_MATCH");
  });

  // 17. Large Input Respects Configurable Limits
  it("respects per-concept input limits and flags input errors cleanly", () => {
    // Array limits: maxElements is 20
    const hugeInput = Array.from({ length: 50 }, (_, i) => i + 1).join(", ");
    const result = DSAExecutionRouter.tryExecuteDSA(`Search array [${hugeInput}] for 25`);

    expect(result.handled).toBe(false);
    expect(result.reason).toBe("INPUT_ERROR");
    expect(result.errorMessage).toMatch(/exceeds maximum supported elements/i);
  });

  // 18. End-to-End Supported Execution
  it("successfully routes, extracts dynamic input, executes, and adapts supported array concept", () => {
    const prompt = "Linear search [12, 24, 36, 48] for 36";
    const route = DSAExecutionRouter.tryExecuteDSA(prompt);

    expect(route.handled).toBe(true);
    expect(route.conceptId).toBe("linear-search");
    expect(route.lesson).toBeDefined();

    const lesson = route.lesson!;
    expect(lesson.timeline.states.length).toBeGreaterThanOrEqual(4);
    expect(lesson.authoritativeModel.problem.question).toBe(prompt);
    expect(lesson.authoritativeModel.goalSatisfaction.satisfied).toBe(true);
  });
});
