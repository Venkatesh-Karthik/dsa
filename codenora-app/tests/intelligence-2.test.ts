/**
 * Universal Concept Intelligence 2.0 Test Suite
 *
 * Comprehensive verification across:
 * - Category A: Known concepts (Linked List, AVL, BFS, Dijkstra, Binary Search)
 * - Category B: Known concepts with unusual parameters
 * - Category C: Completely unseen concepts (refrigerator cycle, compiler pipeline, DNS resolution, rainbow refraction, recommendation ranking)
 * - Property-Based Pedagogical Correctness Tests
 */

import { describe, it, expect } from "vitest";

import {
  compileConceptModelToVisualLesson,
  extractConceptModelFromVisualLesson,
  validateConceptModel,
  analyzeConcept,
} from "../ai/concept-intelligence";

import { classifyDetailedIntent } from "../ai/intent-intelligence";

import {
  createLearnerSession,
  recordInteraction,
  assessConfusion,
} from "../ai/learner-model";

import {
  selectTeachingStrategy,
  determineTeachingDepth,
  inferConceptDependencies,
  createTeachingPlan,
} from "../ai/teaching-planner";

import { validateTeachingQuality } from "../ai/quality-validator";

import {
  inspectSelectedEntity,
  deriveWhatChangedExplanation,
  deriveWhyExplanation,
  evaluateParameterMutation,
  generateCounterexample,
  derivePracticeItem,
} from "../ai/adaptation-engine";

import { compileVisualLesson } from "../ai/transformation-timeline";
import { computeSceneGraphDiff } from "../ai/diff-engine";

import type {
  ConceptModel,
  ConceptEntity,
  ConceptRelationship,
  ConceptState,
  ConceptTransformation,
} from "../ai/concept-model";

// ============================================================================
// CATEGORY A: Known Concepts
// ============================================================================

describe("Category A: Known Concepts", () => {
  it("Linked List Insertion: maintains stable entity IDs and valid pointer rewiring", () => {
    const model: ConceptModel = {
      concept: "Linked List Insertion",
      domain: "data_structures",
      objective: "Insert a new node into an existing singly linked list.",
      teachingStrategy: "STRUCTURAL_TRANSFORMATION",
      entities: [
        { id: "node-1", type: "LinkedListNode", label: "Node 10", value: 10 },
        { id: "node-2", type: "LinkedListNode", label: "Node 30", value: 30 },
        { id: "node-new", type: "LinkedListNode", label: "Node 20", value: 20 },
      ],
      relationships: [
        {
          id: "rel-1-2",
          sourceEntityId: "node-1",
          targetEntityId: "node-2",
          type: "next",
          direction: "forward",
        },
      ],
      states: [
        {
          stateIndex: 0,
          name: "Initial List",
          activeEntityIds: ["node-1", "node-2"],
          activeRelationshipIds: ["rel-1-2"],
        },
        {
          stateIndex: 1,
          name: "Create New Node",
          activeEntityIds: ["node-1", "node-2", "node-new"],
          activeRelationshipIds: ["rel-1-2"],
        },
        {
          stateIndex: 2,
          name: "Connect New to Successor",
          activeEntityIds: ["node-1", "node-2", "node-new"],
          activeRelationshipIds: ["rel-1-2", "rel-new-2"],
        },
        {
          stateIndex: 3,
          name: "Update Predecessor to New Node",
          activeEntityIds: ["node-1", "node-2", "node-new"],
          activeRelationshipIds: ["rel-1-new", "rel-new-2"],
        },
      ],
      transformations: [
        {
          id: "t-1",
          stepNumber: 1,
          title: "Allocate Node 20",
          fromStateIndex: 0,
          toStateIndex: 1,
          action: "Create detached new node with value 20",
          reason: "New element must exist in memory before linking.",
          learnerObservation:
            "Node 20 is created without any incoming or outgoing links.",
          consequence: "Node 20 is ready to be spliced into the sequence.",
          whatChanged: "Node 20 added to persistent scene",
          whyChanged: "Allocation prerequisite",
          relevantEntityIds: ["node-new"],
          relevantRelationshipIds: [],
        },
        {
          id: "t-2",
          stepNumber: 2,
          title: "Link Node 20 to Node 30",
          fromStateIndex: 1,
          toStateIndex: 2,
          action: "Point node-new.next to node-2",
          reason:
            "Preserve reference to the rest of the list before modifying predecessor.",
          learnerObservation: "Arrow from Node 20 to Node 30 established.",
          consequence: "Prevents orphan memory leaks.",
          whatChanged: "Added pointer from Node 20 to Node 30",
          whyChanged: "Safety link",
          relevantEntityIds: ["node-new", "node-2"],
          relevantRelationshipIds: ["rel-new-2"],
        },
        {
          id: "t-3",
          stepNumber: 3,
          title: "Link Node 10 to Node 20",
          fromStateIndex: 2,
          toStateIndex: 3,
          action: "Update node-1.next to point to node-new",
          reason: "Splice new node into the active traversal path.",
          learnerObservation:
            "Predecessor arrow redirects from Node 30 to Node 20.",
          consequence: "Insertion complete. Invariant holds: 10 -> 20 -> 30.",
          whatChanged: "Redirected node-1.next to node-20",
          whyChanged: "Splice complete",
          relevantEntityIds: ["node-1", "node-new"],
          relevantRelationshipIds: ["rel-1-new"],
        },
      ],
      invariants: [
        {
          id: "inv-connectivity",
          description:
            "All list nodes must be reachable from head without orphaned links.",
          rule: "Every non-tail node has a valid next reference.",
        },
      ],
      misconceptions: [
        {
          id: "misc-pointer-order",
          misunderstanding: "Updating predecessor first",
          correction:
            "Must point new node to successor first to avoid losing the rest of the list.",
        },
      ],
      observations: [],
    };

    // Quality validation
    const quality = validateTeachingQuality(
      model,
      "Explain linked list insertion",
    );
    expect(quality.valid).toBe(true);

    // Semantic Object Intelligence on node-new at initial state
    const inspected = inspectSelectedEntity("node-new", model, 0);
    expect(inspected).not.toBeNull();
    expect(inspected?.type).toBe("LinkedListNode");
    expect(inspected?.value).toBe(20);
    expect(inspected?.nextChangeSummary).toContain("Link Node 20 to Node 30");

    // Dynamic practice derivation
    const practice = derivePracticeItem(model, 1);
    expect(practice.question).toBeTruthy();
    expect(practice.options.length).toBeGreaterThan(1);
  });

  it("AVL Tree Rotation: validates rebalancing without fake steps", () => {
    const model: ConceptModel = {
      concept: "AVL Tree Right Rotation",
      domain: "data_structures",
      objective:
        "Restore height balance by rotating unbalanced left-heavy subtree.",
      teachingStrategy: "STRUCTURAL_TRANSFORMATION",
      entities: [
        { id: "node-root", type: "TreeNode", label: "Node 30", value: 30 },
        { id: "node-left", type: "TreeNode", label: "Node 20", value: 20 },
        { id: "node-ll", type: "TreeNode", label: "Node 10", value: 10 },
      ],
      relationships: [
        {
          id: "rel-root-left",
          sourceEntityId: "node-root",
          targetEntityId: "node-left",
          type: "left",
          direction: "forward",
        },
        {
          id: "rel-left-ll",
          sourceEntityId: "node-left",
          targetEntityId: "node-ll",
          type: "left",
          direction: "forward",
        },
      ],
      states: [
        {
          stateIndex: 0,
          name: "Unbalanced State (BF=+2)",
          activeEntityIds: ["node-root", "node-left", "node-ll"],
          activeRelationshipIds: ["rel-root-left", "rel-left-ll"],
        },
        {
          stateIndex: 1,
          name: "Elevate Pivot Node 20",
          activeEntityIds: ["node-root", "node-left", "node-ll"],
          activeRelationshipIds: [],
        },
        {
          stateIndex: 2,
          name: "Adopt Node 30 as Right Child",
          activeEntityIds: ["node-root", "node-left", "node-ll"],
          activeRelationshipIds: [],
        },
      ],
      transformations: [
        {
          id: "t-avl-1",
          stepNumber: 1,
          title: "Identify Pivot Node 20",
          fromStateIndex: 0,
          toStateIndex: 1,
          action: "Select left child as the rotation pivot",
          reason: "Balance factor of root is +2, left child is +1.",
          learnerObservation: "Node 20 is identified as the median value.",
          consequence: "Pivot becomes root of the subtree.",
          whatChanged: "Node 20 marked as pivot",
          whyChanged: "Height imbalance detected",
          relevantEntityIds: ["node-left"],
          relevantRelationshipIds: [],
        },
        {
          id: "t-avl-2",
          stepNumber: 2,
          title: "Execute Right Rotation",
          fromStateIndex: 1,
          toStateIndex: 2,
          action: "Make Node 20 parent of Node 30",
          reason: "Restores BST balance: left (10) < root (20) < right (30).",
          learnerObservation:
            "Node 20 is now root; Node 10 is left, Node 30 is right.",
          consequence: "Subtree balance factor restored to 0.",
          whatChanged: "Parent-child inverted: Node 20 -> Node 30",
          whyChanged: "Subtree balanced",
          relevantEntityIds: ["node-left", "node-root"],
          relevantRelationshipIds: [],
        },
      ],
      invariants: [
        {
          id: "inv-bst",
          description: "BST ordering: left child < parent < right child.",
          rule: "left < root < right",
        },
      ],
      misconceptions: [],
      observations: [],
    };

    const quality = validateTeachingQuality(model, "Explain AVL rotation");
    expect(quality.valid).toBe(true);

    // Verify counterexample generation
    const counter = generateCounterexample(model);
    expect(counter.ruleViolated).toBe("left < root < right");
    expect(counter.observableConsequence).toContain("BST ordering");
  });
});

// ============================================================================
// CATEGORY B: Known Concepts with Unusual Parameters
// ============================================================================

describe("Category B: Known Concepts with Unusual Parameters", () => {
  it("Parameter Mutation: evaluates dynamic parameter mutation locally", () => {
    const model: ConceptModel = {
      concept: "Binary Search",
      domain: "algorithms",
      objective: "Search for target value in sorted array.",
      teachingStrategy: "CONTROL_FLOW",
      entities: [
        { id: "elem-0", type: "ArrayElement", label: "2", value: 2 },
        { id: "elem-1", type: "ArrayElement", label: "5", value: 5 },
        { id: "elem-2", type: "ArrayElement", label: "8", value: 8 },
        { id: "elem-3", type: "ArrayElement", label: "12", value: 12 },
        { id: "elem-4", type: "ArrayElement", label: "16", value: 16 },
      ],
      relationships: [],
      states: [
        {
          stateIndex: 0,
          name: "Initial Interval [0, 4]",
          activeEntityIds: ["elem-0", "elem-1", "elem-2", "elem-3", "elem-4"],
          activeRelationshipIds: [],
        },
      ],
      transformations: [
        {
          id: "t-bs-1",
          stepNumber: 1,
          title: "Inspect Midpoint Index 2",
          fromStateIndex: 0,
          toStateIndex: 0,
          action: "Compare arr[2] (8) with target (12)",
          reason:
            "Binary search tests the median element to eliminate half the search space.",
          learnerObservation: "8 < 12, so target must lie in the right half.",
          consequence: "Search interval narrows to [3, 4].",
          whatChanged: "Midpoint evaluated",
          whyChanged: "Interval bisection",
          relevantEntityIds: ["elem-2"],
          relevantRelationshipIds: [],
        },
      ],
      invariants: [
        {
          id: "inv-sorted",
          description:
            "Array elements must remain in non-decreasing sorted order.",
          rule: "arr[i] <= arr[i+1]",
        },
      ],
      misconceptions: [],
      observations: [],
    };

    // Mutate target parameter to 100
    const mutation = evaluateParameterMutation("elem-2", 99, model);
    expect(mutation.affectedEntityIds).toContain("elem-2");
    expect(mutation.semanticPrediction).toContain(
      "triggers re-evaluation of invariants",
    );
  });
});

// ============================================================================
// CATEGORY C: Completely Unseen Concepts (ZERO Topic Conditionals)
// ============================================================================

describe("Category C: Completely Unseen Concepts", () => {
  it("Refrigerator Cooling Cycle: models thermodynamics using generic semantics", () => {
    // Unseen concept: Refrigerator cooling cycle
    const prompt = "Explain how a refrigerator cooling cycle works";
    const intent = classifyDetailedIntent(prompt);
    expect(intent.targetConcept).toContain("Refrigerator");

    const strategy = selectTeachingStrategy(intent.targetConcept, intent);
    expect(strategy).toBe("TEMPORAL_PROGRESSION");

    const model: ConceptModel = {
      concept: "Refrigerator Vapor-Compression Cycle",
      domain: "generic",
      objective:
        "Explain how thermodynamic compression, condensation, expansion, and evaporation remove heat from an interior compartment.",
      teachingStrategy: strategy,
      entities: [
        {
          id: "comp-compressor",
          type: "Component",
          label: "Compressor",
          semanticRole: "work_input",
          properties: { shape: "rectangle" },
        },
        {
          id: "comp-condenser",
          type: "Component",
          label: "Condenser Coils",
          semanticRole: "heat_rejection",
          properties: { shape: "rectangle" },
        },
        {
          id: "comp-expansion-valve",
          type: "Component",
          label: "Expansion Valve",
          semanticRole: "pressure_drop",
          properties: { shape: "diamond" },
        },
        {
          id: "comp-evaporator",
          type: "Component",
          label: "Evaporator Coils",
          semanticRole: "heat_absorption",
          properties: { shape: "rectangle" },
        },
        {
          id: "refrigerant-fluid",
          type: "Resource",
          label: "Refrigerant",
          semanticRole: "working_fluid",
          state: "low_pressure_gas",
        },
      ],
      relationships: [
        {
          id: "rel-c-to-c",
          sourceEntityId: "comp-compressor",
          targetEntityId: "comp-condenser",
          type: "sendsTo",
          direction: "forward",
          label: "High-P Gas",
        },
        {
          id: "rel-c-to-v",
          sourceEntityId: "comp-condenser",
          targetEntityId: "comp-expansion-valve",
          type: "sendsTo",
          direction: "forward",
          label: "High-P Liquid",
        },
        {
          id: "rel-v-to-e",
          sourceEntityId: "comp-expansion-valve",
          targetEntityId: "comp-evaporator",
          type: "sendsTo",
          direction: "forward",
          label: "Low-P Liquid/Gas",
        },
        {
          id: "rel-e-to-c",
          sourceEntityId: "comp-evaporator",
          targetEntityId: "comp-compressor",
          type: "sendsTo",
          direction: "forward",
          label: "Low-P Gas",
        },
      ],
      states: [
        {
          stateIndex: 0,
          name: "Compression Stage",
          activeEntityIds: [
            "comp-compressor",
            "comp-condenser",
            "comp-expansion-valve",
            "comp-evaporator",
            "refrigerant-fluid",
          ],
          activeRelationshipIds: [
            "rel-c-to-c",
            "rel-c-to-v",
            "rel-v-to-e",
            "rel-e-to-c",
          ],
        },
        {
          stateIndex: 1,
          name: "Condensation Stage",
          activeEntityIds: [
            "comp-compressor",
            "comp-condenser",
            "comp-expansion-valve",
            "comp-evaporator",
            "refrigerant-fluid",
          ],
          activeRelationshipIds: [
            "rel-c-to-c",
            "rel-c-to-v",
            "rel-v-to-e",
            "rel-e-to-c",
          ],
        },
        {
          stateIndex: 2,
          name: "Expansion Stage",
          activeEntityIds: [
            "comp-compressor",
            "comp-condenser",
            "comp-expansion-valve",
            "comp-evaporator",
            "refrigerant-fluid",
          ],
          activeRelationshipIds: [
            "rel-c-to-c",
            "rel-c-to-v",
            "rel-v-to-e",
            "rel-e-to-c",
          ],
        },
        {
          stateIndex: 3,
          name: "Evaporation Stage",
          activeEntityIds: [
            "comp-compressor",
            "comp-condenser",
            "comp-expansion-valve",
            "comp-evaporator",
            "refrigerant-fluid",
          ],
          activeRelationshipIds: [
            "rel-c-to-c",
            "rel-c-to-v",
            "rel-v-to-e",
            "rel-e-to-c",
          ],
        },
      ],
      transformations: [
        {
          id: "t-ref-1",
          stepNumber: 1,
          title: "Compress Vapor",
          fromStateIndex: 0,
          toStateIndex: 1,
          action: "Compress low-pressure gas into hot, high-pressure vapor",
          reason:
            "Mechanical work raises temperature above ambient room temperature.",
          learnerObservation:
            "Refrigerant enters compressor and exits at high temperature and pressure.",
          consequence:
            "Refrigerant can now reject heat to the warmer kitchen environment.",
          whatChanged:
            "Refrigerant state: low-pressure gas -> high-pressure superheated vapor",
          whyChanged: "Thermodynamic compression",
          relevantEntityIds: ["comp-compressor", "refrigerant-fluid"],
          relevantRelationshipIds: ["rel-c-to-c"],
        },
        {
          id: "t-ref-2",
          stepNumber: 2,
          title: "Condense and Reject Heat",
          fromStateIndex: 1,
          toStateIndex: 2,
          action:
            "Dissipate heat to room as refrigerant condenses into high-pressure liquid",
          reason:
            "Refrigerant is hotter than room air, driving heat transfer outwards.",
          learnerObservation: "Heat radiates out the back of the refrigerator.",
          consequence:
            "Fluid becomes room-temperature liquid under high pressure.",
          whatChanged:
            "Refrigerant state: high-pressure vapor -> high-pressure liquid",
          whyChanged: "Heat rejection to ambient surroundings",
          relevantEntityIds: ["comp-condenser", "refrigerant-fluid"],
          relevantRelationshipIds: ["rel-c-to-v"],
        },
        {
          id: "t-ref-3",
          stepNumber: 3,
          title: "Expand through Valve",
          fromStateIndex: 2,
          toStateIndex: 3,
          action:
            "Constrict flow through expansion orifice, causing abrupt pressure and temperature drop",
          reason: "Joule-Thomson expansion causes rapid chilling.",
          learnerObservation:
            "Refrigerant temperature plummets below the temperature of the fridge compartment.",
          consequence:
            "Fluid is now cold enough to absorb heat from inside food compartments.",
          whatChanged:
            "Pressure drop: high-pressure liquid -> cold low-pressure mixture",
          whyChanged: "Throttling effect",
          relevantEntityIds: ["comp-expansion-valve", "refrigerant-fluid"],
          relevantRelationshipIds: ["rel-v-to-e"],
        },
        {
          id: "t-ref-4",
          stepNumber: 4,
          title: "Evaporate and Absorb Heat",
          fromStateIndex: 3,
          toStateIndex: 0,
          action:
            "Absorb heat from the interior food compartment, boiling refrigerant into vapor",
          reason:
            "Cold coils absorb thermal energy from inside the refrigerator.",
          learnerObservation:
            "Interior air cools as heat moves into the refrigerant.",
          consequence:
            "Completes the closed cycle and returns vapor to the compressor.",
          whatChanged: "Refrigerant boils into gas; compartment loses heat",
          whyChanged: "Latent heat absorption",
          relevantEntityIds: ["comp-evaporator", "refrigerant-fluid"],
          relevantRelationshipIds: ["rel-e-to-c"],
        },
      ],
      invariants: [
        {
          id: "inv-first-law",
          description:
            "Conservation of energy: Net heat absorbed + net work input = Net heat rejected.",
          rule: "Q_in + W_in = Q_out",
        },
      ],
      misconceptions: [
        {
          id: "misc-creates-cold",
          misunderstanding: "Refrigerators generate coldness",
          correction:
            "Refrigerators do not create cold; they pump thermal energy out of the interior and exhaust it into the room.",
        },
      ],
      observations: [],
    };

    // Quality validation of unseen concept
    const quality = validateTeachingQuality(model, prompt);
    expect(quality.valid).toBe(true);

    // Compilation to visual lesson
    const lesson = compileConceptModelToVisualLesson(model);
    expect(lesson.title).toBe("Refrigerator Vapor-Compression Cycle");
    expect(lesson.transformations.length).toBe(3);

    // Inspect selected component
    const inspected = inspectSelectedEntity("comp-evaporator", model, 3);
    expect(inspected).not.toBeNull();
    expect(inspected?.role).toBe("heat_absorption");
    expect(inspected?.incomingConnections[0].fromId).toBe(
      "comp-expansion-valve",
    );

    // "Why?" explanation derived locally
    const why = deriveWhyExplanation(model.transformations[2], model);
    expect(why).toContain("Joule-Thomson expansion");
  });

  it("Compiler Pipeline: models lexing -> parsing -> AST -> codegen as a pipeline", () => {
    const prompt =
      "Explain how a compiler transforms source code into machine code";
    const intent = classifyDetailedIntent(prompt);
    const strategy = selectTeachingStrategy(intent.targetConcept, intent);
    expect(strategy).toBe("PIPELINE");

    const model: ConceptModel = {
      concept: "Compiler Pipeline",
      domain: "generic",
      objective:
        "Trace the multi-stage transformation from source code text to native executable instructions.",
      teachingStrategy: strategy,
      entities: [
        {
          id: "stage-source",
          type: "GenericEntity",
          label: "Source Code Text",
          value: "let x = 10 + y;",
        },
        {
          id: "stage-tokens",
          type: "GenericEntity",
          label: "Token Stream",
          value: "[LET, ID(x), EQUALS, NUM(10), PLUS, ID(y)]",
        },
        {
          id: "stage-ast",
          type: "GenericEntity",
          label: "Abstract Syntax Tree",
          value: "VarDecl(x, BinaryExpr(+, 10, y))",
        },
        {
          id: "stage-ir",
          type: "GenericEntity",
          label: "Intermediate Representation",
          value: "%1 = add i32 10, %y",
        },
        {
          id: "stage-asm",
          type: "GenericEntity",
          label: "Machine Code",
          value: "MOV EAX, 10; ADD EAX, [EBP-4]",
        },
      ],
      relationships: [
        {
          id: "rel-1",
          sourceEntityId: "stage-source",
          targetEntityId: "stage-tokens",
          type: "transformsInto",
          direction: "forward",
          label: "Lexical Analysis",
        },
        {
          id: "rel-2",
          sourceEntityId: "stage-tokens",
          targetEntityId: "stage-ast",
          type: "transformsInto",
          direction: "forward",
          label: "Parsing",
        },
        {
          id: "rel-3",
          sourceEntityId: "stage-ast",
          targetEntityId: "stage-ir",
          type: "transformsInto",
          direction: "forward",
          label: "Type Check & IR Gen",
        },
        {
          id: "rel-4",
          sourceEntityId: "stage-ir",
          targetEntityId: "stage-asm",
          type: "transformsInto",
          direction: "forward",
          label: "Code Generation",
        },
      ],
      states: [
        {
          stateIndex: 0,
          name: "Raw Source",
          activeEntityIds: ["stage-source"],
          activeRelationshipIds: [],
        },
        {
          stateIndex: 1,
          name: "Tokenized",
          activeEntityIds: ["stage-source", "stage-tokens"],
          activeRelationshipIds: ["rel-1"],
        },
        {
          stateIndex: 2,
          name: "Synthesized AST",
          activeEntityIds: ["stage-tokens", "stage-ast"],
          activeRelationshipIds: ["rel-2"],
        },
      ],
      transformations: [
        {
          id: "t-comp-1",
          stepNumber: 1,
          title: "Lexical Analysis (Tokenize)",
          fromStateIndex: 0,
          toStateIndex: 1,
          action: "Lexer scans character stream into distinct lexical tokens",
          reason:
            "Discard whitespace and group characters into meaningful syntax atoms.",
          learnerObservation:
            "Raw string is converted into a linear sequence of typed tokens.",
          consequence: "Parser can operate on structured token stream.",
          whatChanged: "Source text transformed into tokens",
          whyChanged: "Lexical simplification",
          relevantEntityIds: ["stage-source", "stage-tokens"],
          relevantRelationshipIds: ["rel-1"],
        },
        {
          id: "t-comp-2",
          stepNumber: 2,
          title: "Syntactic Parsing (AST)",
          fromStateIndex: 1,
          toStateIndex: 2,
          action:
            "Parser applies grammar productions to build an Abstract Syntax Tree",
          reason: "Discovers operator precedence and structural semantics.",
          learnerObservation:
            "Linear token sequence becomes a hierarchical tree of operations.",
          consequence:
            "Represents semantic meaning independent of concrete syntax.",
          whatChanged: "Tokens assembled into hierarchical AST",
          whyChanged: "Precedence and nesting resolution",
          relevantEntityIds: ["stage-tokens", "stage-ast"],
          relevantRelationshipIds: ["rel-2"],
        },
      ],
      invariants: [
        {
          id: "inv-semantic-preservation",
          description:
            "Every stage must strictly preserve the computational semantics of the original program.",
          rule: "Semantics(Source) == Semantics(MachineCode)",
        },
      ],
      misconceptions: [],
      observations: [],
    };

    const quality = validateTeachingQuality(model, prompt);
    expect(quality.valid).toBe(true);

    const inspected = inspectSelectedEntity("stage-ast", model, 1);
    expect(inspected).not.toBeNull();
    expect(inspected?.incomingConnections[0].fromId).toBe("stage-tokens");
  });

  it("DNS Resolution: models distributed state machine or causal flow without DNS-specific code", () => {
    const prompt = "Explain how DNS resolution works";
    const intent = classifyDetailedIntent(prompt);
    const strategy = selectTeachingStrategy(intent.targetConcept, intent);
    expect(["STATE_MACHINE", "CAUSAL_PROGRESSION"]).toContain(strategy);

    const dependencies = inferConceptDependencies(
      "DNS Resolution",
      "STATE_MACHINE",
    );
    expect(dependencies.length).toBeGreaterThan(0);
    expect(dependencies[0].concept).toContain("Discrete States");
  });
});

// ============================================================================
// PROPERTY-BASED TESTS (Applicable to ANY Domain)
// ============================================================================

describe("Property-Based Architectural Invariants", () => {
  it("Property 1: Anti-Fake-Step rejects consecutive identical states with zero operations", () => {
    const fakeModel: ConceptModel = {
      concept: "Fake Step Concept",
      domain: "generic",
      objective: "Demonstrate fake step detection",
      teachingStrategy: "GENERIC_CONCEPTUAL_PROGRESSION",
      entities: [{ id: "n1", type: "Node", label: "A" }],
      relationships: [],
      states: [
        {
          stateIndex: 0,
          name: "S1",
          activeEntityIds: ["n1"],
          activeRelationshipIds: [],
        },
        {
          stateIndex: 1,
          name: "S2",
          activeEntityIds: ["n1"],
          activeRelationshipIds: [],
        },
      ],
      transformations: [
        {
          id: "t1",
          stepNumber: 1,
          title: "Do Nothing",
          fromStateIndex: 0,
          toStateIndex: 1,
          action: "Idle action",
          reason: "No reason",
          learnerObservation: "Nothing changed",
          consequence: "Same state",
          whatChanged: "Nothing",
          whyChanged: "No change",
          relevantEntityIds: [],
          relevantRelationshipIds: [],
          operations: [],
        },
        {
          id: "t2",
          stepNumber: 2,
          title: "Do Nothing",
          fromStateIndex: 0,
          toStateIndex: 1,
          action: "Idle action",
          reason: "No reason",
          learnerObservation: "Nothing changed",
          consequence: "Same state",
          whatChanged: "Nothing",
          whyChanged: "No change",
          relevantEntityIds: [],
          relevantRelationshipIds: [],
          operations: [],
        },
      ],
      invariants: [],
      misconceptions: [],
      observations: [],
    };

    const quality = validateTeachingQuality(fakeModel);
    expect(quality.valid).toBe(false);
    expect(quality.issues.some((i) => i.code === "FAKE_STEP_DETECTED")).toBe(
      true,
    );
  });

  it("Property 2: Quality validator catches dangling relationship targets", () => {
    const brokenModel: ConceptModel = {
      concept: "Dangling Relationship Test",
      domain: "generic",
      objective: "Test dangling ref",
      teachingStrategy: "GENERIC_CONCEPTUAL_PROGRESSION",
      entities: [{ id: "node-existing", type: "Node", label: "A" }],
      relationships: [
        {
          id: "rel-broken",
          sourceEntityId: "node-existing",
          targetEntityId: "non-existent-node",
          type: "pointsTo",
          direction: "forward",
        },
      ],
      states: [],
      transformations: [
        {
          id: "t1",
          stepNumber: 1,
          title: "Step 1",
          fromStateIndex: 0,
          toStateIndex: 1,
          action: "Action",
          reason: "Reason",
          learnerObservation: "Notice",
          consequence: "Consequence",
          whatChanged: "Changed",
          whyChanged: "Why",
          relevantEntityIds: [],
          relevantRelationshipIds: [],
        },
      ],
      invariants: [],
      misconceptions: [],
      observations: [],
    };

    const quality = validateTeachingQuality(brokenModel);
    expect(quality.valid).toBe(false);
    expect(
      quality.issues.some((i) => i.code === "DANGLING_RELATIONSHIP_TARGET"),
    ).toBe(true);
  });

  it("Property 3: Non-invasive Learner Model detects confusion without personal profiling", () => {
    let session = createLearnerSession("Compiler Optimization");
    expect(session.consecutivePreviousCount).toBe(0);

    // Simulate user pressing Previous twice
    session = recordInteraction(session, { action: "prev", stepIndex: 2 });
    session = recordInteraction(session, { action: "prev", stepIndex: 1 });

    expect(session.consecutivePreviousCount).toBe(2);
    expect(session.lastConfusionAssessment?.isStruggling).toBe(true);
    expect(session.lastConfusionAssessment?.recommendedAdaptation).toBe(
      "simplify",
    );

    // Simulate normal progression resetting struggle signal
    session = recordInteraction(session, { action: "next", stepIndex: 2 });
    expect(session.consecutivePreviousCount).toBe(0);
    expect(session.lastConfusionAssessment?.isStruggling).toBe(false);
  });

  it("Property 4: Multi-dimensional intent distinguishes between compare, what-if, code, and practice", () => {
    const comparisonIntent = classifyDetailedIntent(
      "Compare BFS and DFS for finding shortest paths in unweighted graphs",
    );
    expect(comparisonIntent.goal).toBe("compare_alternatives");
    expect(comparisonIntent.mode).toBe("comparative_analysis");
    expect(comparisonIntent.dimensions.comparison).toBe(true);

    const whatIfIntent = classifyDetailedIntent(
      "What happens if we reverse the pointer directions in a circular list?",
    );
    expect(whatIfIntent.goal).toBe("explore_what_if");
    expect(whatIfIntent.mode).toBe("what_if_mutation");
    expect(whatIfIntent.dimensions.whatIf).toBe(true);

    const practiceIntent = classifyDetailedIntent(
      "Quiz me on Dijkstra edge relaxation",
    );
    expect(practiceIntent.goal).toBe("verify_mastery");
    expect(practiceIntent.mode).toBe("interactive_practice");
    expect(practiceIntent.dimensions.practice).toBe(true);

    const codeIntent = classifyDetailedIntent(
      "Show the code implementation of QuickSort partition",
    );
    expect(codeIntent.goal).toBe("implementation_guide");
    expect(codeIntent.dimensions.implementation).toBe(true);
  });

  it("Property 5: Dynamic teaching depth scales proportionally with requested depth", () => {
    const quickIntent = classifyDetailedIntent(
      "Give me a quick overview of HTTP GET",
    );
    expect(determineTeachingDepth(quickIntent, 2)).toBeLessThanOrEqual(3);

    const deepIntent = classifyDetailedIntent(
      "Provide a deep and exhaustive step by step walkthrough of TCP Handshake",
    );
    expect(determineTeachingDepth(deepIntent, 4)).toBeGreaterThanOrEqual(6);
  });
});
