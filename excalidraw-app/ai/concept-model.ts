/**
 * Universal Concept Model
 *
 * Domain-agnostic semantic ontology for Cognora.
 * Represents ANY technical or conceptual subject (DSA, networking, OS, databases,
 * physics, machine learning, mathematics, system design, or previously unseen concepts)
 * in terms of:
 * - Entities (stable semantic objects)
 * - Relationships (semantic connections between entities)
 * - States (persistent visual scene configurations)
 * - Transformations (meaningful pedagogical transitions with reasons, observations, and consequences)
 * - Invariants (rules that must remain true)
 * - Misconceptions (common learner misunderstandings)
 * - Inspector Data (dynamic metrics and properties for deep inspection)
 */

import type {
  VisualAction,
  TransformationOperation,
  CodeContext,
  SemanticColor,
} from "./visual-dsl";

// ============================================================================
// Teaching Strategies
// ============================================================================

export type TeachingStrategy =
  | "STRUCTURAL_TRANSFORMATION"    // Trees, linked lists, graphs, heaps, rotations
  | "TEMPORAL_PROGRESSION"         // Physics kinematics, animations, timed sequences
  | "CAUSAL_PROGRESSION"           // Chain of events, domino effects, reactive streams
  | "STATE_MACHINE"                // TCP handshake, HTTP lifecycle, process scheduler
  | "PIPELINE"                     // Compilers, ETL, image processing, graphics pipelines
  | "MATHEMATICAL_DERIVATION"      // Proofs, inductive derivations, equation steps
  | "ITERATIVE_OPTIMIZATION"       // Gradient descent, k-means, simulated annealing
  | "MEMORY_TRANSFORMATION"        // Call stack frames, heap allocations, pointer shifts
  | "DATA_FLOW"                    // SQL queries, map-reduce, stream processing
  | "CONTROL_FLOW"                 // Conditionals, loops, branch execution
  | "COMPARISON"                   // Algorithm trade-offs, paradigm contrasts
  | "HIERARCHICAL_EXPANSION"       // System architecture drilldowns, nested subsystems
  | "RELATIONSHIP_CHANGE"          // Dynamic connection rewiring, topological mutations
  | "GENERIC_CONCEPTUAL_PROGRESSION"; // Fallback for unseen concepts

export type ConceptDomain =
  | "data_structures"
  | "algorithms"
  | "networking"
  | "operating_systems"
  | "databases"
  | "programming"
  | "mathematics"
  | "physics"
  | "machine_learning"
  | "system_design"
  | "generic"
  | string;

// ============================================================================
// Universal Entity System
// ============================================================================

export type GenericEntityType =
  | "Node"
  | "ArrayElement"
  | "TreeNode"
  | "LinkedListNode"
  | "StackFrame"
  | "QueueItem"
  | "Process"
  | "Thread"
  | "Packet"
  | "Client"
  | "Server"
  | "Request"
  | "Response"
  | "Database"
  | "Table"
  | "Row"
  | "Column"
  | "Function"
  | "Variable"
  | "MemoryBlock"
  | "Address"
  | "Pointer"
  | "State"
  | "Event"
  | "Particle"
  | "Force"
  | "Equation"
  | "Parameter"
  | "Model"
  | "Object"
  | "Resource"
  | "File"
  | "Component"
  | "Service"
  | "Container"
  | "GenericEntity"
  | string;

export interface ConceptEntity {
  /** Stable semantic identifier that persists across ALL transformations (e.g. 'node-20', 'client-app') */
  id: string;
  /** Semantic primitive classification */
  type: GenericEntityType;
  /** Human-readable display label */
  label: string;
  /** Role within the concept (e.g. 'root', 'pivot', 'sender', 'receiver', 'target', 'loss') */
  semanticRole?: string;
  /** Pedagogical or computational value (e.g. 20, "200 OK", 0.042) */
  value?: unknown;
  /** Current state tag (e.g. 'active', 'visited', 'eliminated', 'balanced', 'pending') */
  state?: string;
  /** Semantic styling and domain-specific attributes */
  properties?: {
    highlight?: string;
    color?: SemanticColor | string;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    shape?: "rectangle" | "ellipse" | "diamond";
    containerId?: string;
    index?: number;
    [key: string]: unknown;
  };
}

// ============================================================================
// Universal Relationship System
// ============================================================================

export type GenericRelationshipType =
  | "next"
  | "previous"
  | "parent"
  | "child"
  | "left"
  | "right"
  | "pointsTo"
  | "contains"
  | "calls"
  | "returns"
  | "dependsOn"
  | "sendsTo"
  | "receivesFrom"
  | "reads"
  | "writes"
  | "produces"
  | "consumes"
  | "connectsTo"
  | "joinsWith"
  | "causes"
  | "transformsInto"
  | "belongsTo"
  | "references"
  | "updates"
  | "generic"
  | string;

export interface ConceptRelationship {
  /** Stable relationship identifier (e.g. 'rel-client-request') */
  id: string;
  /** Source entity ID (must exist in entities) */
  sourceEntityId: string;
  /** Target entity ID (must exist in entities) */
  targetEntityId: string;
  /** Semantic type of relationship */
  type: GenericRelationshipType;
  /** Visual/directed flow */
  direction: "forward" | "backward" | "bidirectional" | "none";
  /** Optional display label (e.g. weight, HTTP method, transition condition) */
  label?: string;
  /** Relationship state (e.g. 'active', 'traversed', 'broken', 'established') */
  state?: string;
  /** Visual intent hints */
  visualIntent?: "hierarchy" | "flow" | "reference" | "association" | "containment";
  /** Properties */
  properties?: {
    weight?: number;
    highlight?: string;
    color?: SemanticColor | string;
    style?: "solid" | "dashed" | "dotted";
    elbowed?: boolean;
    [key: string]: unknown;
  };
}

// ============================================================================
// Universal State Model (Snapshots of One Persistent Scene)
// ============================================================================

export interface ConceptState {
  /** 0-based sequential state index */
  stateIndex: number;
  /** Descriptive name of this semantic state */
  name: string;
  /** Detailed description of this state */
  description?: string;
  /** IDs of entities that are active/present in this state */
  activeEntityIds: string[];
  /** IDs of relationships that are active/present in this state */
  activeRelationshipIds: string[];
  /** Overrides or dynamic states for entities at this point in time */
  entityStates?: Record<
    string,
    {
      state?: string;
      value?: unknown;
      highlight?: string;
      properties?: Record<string, unknown>;
    }
  >;
  /** Overrides or dynamic states for relationships at this point in time */
  relationshipStates?: Record<
    string,
    {
      state?: string;
      highlight?: string;
      properties?: Record<string, unknown>;
    }
  >;
  /** Dynamic context metrics for this state (displayed in Inspector) */
  metrics?: Array<{
    label: string;
    value: string | number;
    badgeColor?: string;
  }>;
  /** Dynamic properties for this state */
  properties?: Array<{
    label: string;
    value: string | number;
  }>;
}

// ============================================================================
// Transformation Model
// ============================================================================

export interface ConceptTransformation {
  /** Stable identifier (e.g. 't-1', 't-rotation-rr') */
  id: string;
  /** 1-based step number */
  stepNumber: number;
  /** Short action title (e.g. 'Execute Right Rotation', 'SYN Packet Dispatched') */
  title: string;
  /** Origin state index */
  fromStateIndex: number;
  /** Resulting state index */
  toStateIndex: number;
  /** WHAT action occurred */
  action: string;
  /** WHY did this change happen? */
  reason: string;
  /** Explicit upstream cause */
  cause?: string;
  /** Observable downstream effect */
  effect?: string;
  /** Physical, logical, or computational mechanism */
  mechanism?: string;
  /** WHAT should the learner notice? */
  learnerObservation: string;
  /** WHAT does this change cause/consequence? */
  consequence: string;
  /** Explicit summary of what changed semantically */
  whatChanged: string;
  /** Core pedagogical rationale */
  whyChanged: string;
  /** IDs of entities directly affected */
  relevantEntityIds: string[];
  /** IDs of relationships directly affected */
  relevantRelationshipIds: string[];
  /** Delta operations to apply to the scene graph */
  operations?: TransformationOperation[];
  /** Concrete visual actions if rendered directly */
  visualActions?: VisualAction[];
  /** Associated programming code snippet for this specific step */
  codeContext?: CodeContext;
  /** Dynamic Inspector data specifically for this step */
  inspectorData?: {
    statusBadge?: string;
    operation?: string;
    resultSummary?: string;
    metrics?: Array<{ label: string; value: string | number; badgeColor?: string }>;
    properties?: Array<{ label: string; value: string | number }>;
  };
  /** Mathematical calculations, metrics, or formulas evaluated at this step */
  calculations?: string;
  /** Key algorithmic rule, invariant takeaway, or mental model insight */
  insight?: string;
}

// ============================================================================
// Invariants, Misconceptions, and Observations
// ============================================================================

export interface ConceptInvariant {
  id: string;
  description: string;
  rule: string;
  /** Optional programmatic check function against a state */
  check?: (state: ConceptState, model: ConceptModel) => boolean;
}

export interface ConceptMisconception {
  id: string;
  misunderstanding: string;
  /** Direct alias for misunderstanding */
  misconception?: string;
  correction: string;
  contextualNote?: string;
}

export interface ConceptObservation {
  transformationId: string;
  notice: string;
  explanation: string;
}

// ============================================================================
// Concept Dependencies (Dynamically Inferred Prerequisites)
// ============================================================================

export interface ConceptDependency {
  id: string;
  concept: string;
  description: string;
  necessity: "foundational" | "required" | "recommended";
  compactExplanation?: string;
}

// ============================================================================
// Causal Relationships (Cause -> Effect -> Mechanism)
// ============================================================================

export interface CausalRelationship {
  id: string;
  cause: string;
  effect: string;
  mechanism: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  transformationId?: string;
}

// ============================================================================
// Practice & Verification Opportunities
// ============================================================================

export type PracticeType =
  | "predict_next_state"
  | "identify_changed_relationship"
  | "explain_why"
  | "repair_incorrect_state"
  | "choose_transformation"
  | "modify_parameter"
  | "identify_invariant"
  | "trace_process";

export interface PracticeOpportunity {
  id: string;
  type: PracticeType;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation: string;
  targetEntityId?: string;
  targetTransformationId?: string;
  hint?: string;
}

// ============================================================================
// Adaptation Hints (Non-Invasive Pedagogical Adaptation)
// ============================================================================

export interface AdaptationHint {
  id: string;
  trigger:
    | "repeated_previous"
    | "repeated_replay"
    | "dwell_long"
    | "why_requested"
    | "what_if_requested"
    | "simplified_requested";
  adaptationType:
    | "simplify"
    | "deepen"
    | "clarify_cause"
    | "show_counterexample"
    | "highlight_prerequisite"
    | "provide_analogy";
  message: string;
  payload?: unknown;
}

// ============================================================================
// Dynamic Inspector Configuration
// ============================================================================

export interface DynamicInspectorModel {
  title?: string;
  subtitle?: string;
  conceptType?: string;
  defaultMetrics?: Array<{ label: string; value: string | number; badgeColor?: string }>;
  defaultProperties?: Array<{ label: string; value: string | number }>;
  capabilities?: Array<"analyze" | "explain" | "code" | "practice">;
}

// ============================================================================
// Root Universal Concept Model
// ============================================================================

export interface ConceptModel {
  /** Concept or topic name */
  concept: string;
  /** Broad technical or scientific domain */
  domain: ConceptDomain;
  /** Specific sub-topic if applicable */
  subConcept?: string;
  /** Clear educational objective for the learner */
  objective: string;
  /** Target learner experience level */
  learnerLevel?: "beginner" | "intermediate" | "advanced";
  /** Pedagogical teaching strategy chosen */
  teachingStrategy: TeachingStrategy;
  /** Semantic entities constituting the persistent visual scene */
  entities: ConceptEntity[];
  /** Semantic relationships between entities */
  relationships: ConceptRelationship[];
  /** States of the persistent scene over time */
  states: ConceptState[];
  /** Meaningful transformations between consecutive states */
  transformations: ConceptTransformation[];
  /** Declarative invariants that must remain true */
  invariants: ConceptInvariant[];
  /** Common beginner misunderstandings and corrections */
  misconceptions: ConceptMisconception[];
  /** Key observations mapped to transformations */
  observations: ConceptObservation[];
  /** Dynamically inferred prerequisite dependencies */
  dependencies?: ConceptDependency[];
  /** Explicit causal chains across transformations */
  causalRelationships?: CausalRelationship[];
  /** Dynamic practice and verification opportunities derived from semantics */
  practiceOpportunities?: PracticeOpportunity[];
  /** Non-invasive pedagogical adaptation hints */
  adaptationHints?: AdaptationHint[];
  /** Associated programming code implementations by phase or language */
  codeContexts?: Record<string, CodeContext> | CodeContext[];
  /** Dynamic inspector configuration */
  inspectorModel?: DynamicInspectorModel;
  /** Additional extensible metadata */
  metadata?: Record<string, unknown>;
}
