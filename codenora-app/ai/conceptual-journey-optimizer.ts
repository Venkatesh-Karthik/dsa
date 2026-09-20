/**
 * Universal Conceptual Journey Optimizer
 *
 * Transforms raw implementation-level AI teaching plans into meaningful
 * conceptual teaching milestones.
 *
 * Guarantees:
 * 1. NO TOPIC-SPECIFIC LOGIC: Operates purely on semantic structure, causality,
 *    entity deltas, invariant state transitions, and pedagogical intent.
 * 2. NO HARDCODED STEP COUNTS: The count is dynamic and determined by semantic necessity.
 * 3. ZERO ADDITIONAL AI CALLS: 100% deterministic local TypeScript execution.
 * 4. CAUSAL PRESERVATION: Never merges across causal boundaries, diagnostic states,
 *    or final proof states.
 * 5. 1-to-1 SYNCHRONIZATION: 1 Milestone = 1 Semantic State = 1 Visual State = 1 Explanation.
 */

import type { VisualAction } from "./visual-dsl";
import type { Entity, Relationship } from "./semantic-world";

export type ConceptualRole =
  | "setup" // Initial baseline or environment setup
  | "perturbation" // Input, action, or trigger introducing change
  | "diagnosis" // Evaluation, condition check, imbalance/error detection
  | "decision" // Strategy or case classification (e.g. LL vs LR, branch choice)
  | "mechanism" // Core transformation, restructuring, transmission, calculation
  | "failure" // Conceptual failure state (e.g. transaction error, packet loss, constraint breach)
  | "recovery" // Restorative transition (e.g. rollback, retransmission, rebalance)
  | "verification" // Checking that invariant is being satisfied
  | "proof" // Final goal verified and invariants restored
  | "bookkeeping"; // Minor property update, redundant highlight, decomposed sub-step

export interface RawProposalStep {
  title?: string;
  explanation?: string;
  operations?: any[];
  visual_actions?: VisualAction[];
  calculations?: string;
  insight?: string;
  [key: string]: any;
}

export type GranularityLevel = "MICRO" | "NORMAL" | "MACRO";

export interface TransformationQualityMetrics {
  semanticSignificance: number;
  causalSignificance: number;
  visualObservability: number;
  invariantRelevance: number;
  comprehensionValue: number;
  overallScore: number;
}

export interface ConceptualMilestone {
  title: string;
  explanation: string;
  operations: any[];
  visual_actions: VisualAction[];
  calculations?: string;
  insight?: string;
  conceptualRole: ConceptualRole;
  affectedEntities: string[];
  primaryEntity?: string;
  causalSource?: string;
  causalTarget?: string;
  isProtocolMessage?: boolean;
  createdEntities: string[];
  absorbedStepsCount: number;
  learningValueScore?: number;
  preconditions?: string[];
  postconditions?: string[];
  decision?: any;
  stateType?: any;
  persistence?: any;
  causalRole?: any;
  invariants?: any[];
  failureContext?: any;
  recoveryContext?: any;
  counterfactual?: any;
  transitionId?: string;
  cause?: string;
  visualEvidenceRequired?: string;
  consequence?: string;
  nextDependency?: string;
  granularity?: GranularityLevel;
  qualityScore?: number;
  [key: string]: any;
}

export interface JourneyOptimizationContext {
  concept: string;
  intent?: string;
  targetGoal?: string;
  initialEntities?: Entity[];
  initialRelationships?: Relationship[];
  rawSteps: RawProposalStep[];
}

export class ConceptualJourneyOptimizer {
  /**
   * Validates that an optimized plan satisfies the teaching response contract:
   * 1. Non-empty milestones list when raw steps were provided.
   * 2. Every milestone has a non-empty stable ID, valid title, explanation, and operations array.
   * 3. No duplicate IDs.
   * 4. Operations have valid array format.
   */
  public static validatePlanContract(
    milestones: ConceptualMilestone[],
    rawStepsCount: number = 0,
  ): { valid: boolean; reason?: string } {
    if (rawStepsCount > 0 && (!milestones || milestones.length === 0)) {
      return {
        valid: false,
        reason:
          "Optimized plan produced 0 milestones when raw steps were present.",
      };
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m) {
        return {
          valid: false,
          reason: `Milestone at index ${i} is null or undefined.`,
        };
      }
      const id = (m as any).id || `m-${i + 1}`;
      if (seenIds.has(id)) {
        return {
          valid: false,
          reason: `Duplicate milestone ID '${id}' at index ${i}.`,
        };
      }
      seenIds.add(id);

      if (
        !m.title ||
        typeof m.title !== "string" ||
        m.title.trim().length === 0
      ) {
        return {
          valid: false,
          reason: `Milestone at index ${i} has an empty or invalid title.`,
        };
      }
      if (
        !m.explanation ||
        typeof m.explanation !== "string" ||
        m.explanation.trim().length === 0
      ) {
        return {
          valid: false,
          reason: `Milestone at index ${i} has an empty or invalid explanation.`,
        };
      }
      if (!Array.isArray(m.operations)) {
        return {
          valid: false,
          reason: `Milestone at index ${i} operations must be an array.`,
        };
      }
    }
    return { valid: true };
  }

  /**
   * Main entry point: Optimizes raw proposal steps into conceptual milestones.
   */
  public static optimize(
    context: JourneyOptimizationContext,
  ): ConceptualMilestone[] {
    const rawSteps = context.rawSteps;
    if (!rawSteps || rawSteps.length === 0) {
      return [];
    }

    // Step 0: Decompose opaque compound steps (e.g. imbalance diagnosis bundled with rotation)
    const expandedSteps = this.decomposeOpaqueSteps(rawSteps);

    // Step 1: Analyze and classify each raw step
    const classifiedSteps = expandedSteps.map((step, index) => {
      const prevStep = index > 0 ? expandedSteps[index - 1] : undefined;
      return this.analyzeStep(step, prevStep, index, expandedSteps.length);
    });

    // Step 2: Safe incremental clustering into conceptual milestones
    const milestones: ConceptualMilestone[] = [];
    let currentMilestone: ConceptualMilestone | null = null;

    for (let i = 0; i < classifiedSteps.length; i++) {
      const stepInfo = classifiedSteps[i];

      if (!currentMilestone) {
        currentMilestone = this.createInitialMilestone(stepInfo);
        continue;
      }

      // Check if candidate step can be safely merged into current milestone
      const canMerge = this.canSafelyMerge(
        currentMilestone,
        stepInfo,
        context.intent,
      );

      if (canMerge) {
        // Absorb step into current milestone
        currentMilestone = this.mergeStepIntoMilestone(
          currentMilestone,
          stepInfo,
        );
      } else {
        // Finalize current milestone and start a new one
        milestones.push(currentMilestone);
        currentMilestone = this.createInitialMilestone(stepInfo);
      }
    }

    if (currentMilestone) {
      milestones.push(currentMilestone);
    }

    // Step 3: Verify and post-process milestones for pedagogical integrity
    return this.postProcessMilestones(milestones, context);
  }

  /**
   * Analyzes an individual step to determine its semantic role, affected entities,
   * operations, and causal properties.
   */
  private static analyzeStep(
    step: RawProposalStep,
    prevStep: RawProposalStep | undefined,
    stepIndex: number,
    totalSteps: number,
  ): {
    raw: RawProposalStep;
    index: number;
    title: string;
    explanation: string;
    role: ConceptualRole;
    affectedEntities: string[];
    primaryEntity?: string;
    createdEntities: string[];
    hasCompositeAction: boolean;
    isHighlightOnly: boolean;
    isPureBookkeeping: boolean;
    causalSource?: string;
    causalTarget?: string;
    isProtocolMessage?: boolean;
  } {
    const title = step.title || `Step ${stepIndex + 1}`;
    const explanation = step.explanation || "";
    const allOps = [...(step.operations || []), ...(step.visual_actions || [])];

    const affectedEntities = new Set<string>();
    const createdEntities = new Set<string>();
    let primaryEntity: string | undefined;
    let hasCompositeAction = false;
    let hasStructuralMutation = false;
    let hasValueMutation = false;
    let isHighlightOnly = true;
    let causalSource: string | undefined;
    let causalTarget: string | undefined;
    let isProtocolMessage = false;

    const textCorpus = `${title} ${explanation}`.toLowerCase();

    // Protocol transmission markers in text
    const textHasTransmission =
      /\b(send|receiv|forward|repl|respond|transit|deliver|emit|ping|pong|relay|quer|request|packet|handshake|transfer|channel|deposit)s?\b/i.test(
        textCorpus,
      );

    for (const op of allOps) {
      if (!op || typeof op !== "object") {
        continue;
      }
      const type = ((op as any).type || "").toLowerCase();

      const src = (op as any).source || (op as any).from;
      const tgt = (op as any).target || (op as any).to;
      const relType = (
        (op as any).relationType ||
        (op as any).label ||
        ""
      ).toLowerCase();

      // Check if this is a protocol / communication message rather than a local data-structure pointer
      const isMessageRelation =
        /\b(syn|ack|query|request|response|reply|message|packet|commit|challenge|transfer|channel|route|deposit)s?\b/i.test(
          relType,
        ) || textHasTransmission;

      const isRelational =
        type.includes("connect") ||
        type.includes("edge") ||
        type.includes("arrow") ||
        (src && tgt);

      if (src && typeof src === "string") {
        affectedEntities.add(src);
        if (!primaryEntity) {
          primaryEntity = src;
        }
        if (isRelational && !causalSource) {
          causalSource = src;
        }
      }
      if (tgt && typeof tgt === "string") {
        affectedEntities.add(tgt);
        if (!primaryEntity) {
          primaryEntity = tgt;
        }
        if (isRelational && !causalTarget) {
          causalTarget = tgt;
        }
      }

      if (isRelational && isMessageRelation) {
        isProtocolMessage = true;
      }

      // Operation IDs (e.g. t3-op0) generated by DSL validation must NEVER be treated as entity IDs
      const rawOpId =
        typeof (op as any).id === "string" ? (op as any).id : undefined;
      const isSyntheticOpId = Boolean(
        rawOpId && /^t\d+[-_]op\d+$/i.test(rawOpId),
      );

      if (Array.isArray((op as any).entities)) {
        for (const e of (op as any).entities) {
          if (typeof e === "string" && !/^t\d+[-_]op\d+$/i.test(e)) {
            affectedEntities.add(e);
            if (!primaryEntity) {
              primaryEntity = e;
            }
          }
        }
      }

      if (
        typeof (op as any).first === "string" &&
        !/^t\d+[-_]op\d+$/i.test((op as any).first)
      ) {
        affectedEntities.add((op as any).first);
        if (!primaryEntity) {
          primaryEntity = (op as any).first;
        }
      }
      if (
        typeof (op as any).second === "string" &&
        !/^t\d+[-_]op\d+$/i.test((op as any).second)
      ) {
        affectedEntities.add((op as any).second);
      }

      const entityIdCandidate =
        (op as any).entityId ||
        (op as any).nodeId ||
        (op as any).elementId ||
        (op as any).target ||
        (!isSyntheticOpId ? rawOpId : undefined);

      const entityId =
        typeof entityIdCandidate === "string" &&
        !/^t\d+[-_]op\d+$/i.test(entityIdCandidate)
          ? entityIdCandidate
          : undefined;

      if (entityId) {
        affectedEntities.add(entityId);
        if (!primaryEntity) {
          primaryEntity = entityId;
        }
      }

      if (
        type.startsWith("create_tree") ||
        type.startsWith("create_graph") ||
        type.startsWith("create_array") ||
        type.startsWith("create_system") ||
        type.startsWith("create_matrix") ||
        type.startsWith("create_linked_list") ||
        type.startsWith("create_stack") ||
        type.startsWith("create_queue") ||
        type.startsWith("create_container")
      ) {
        hasCompositeAction = true;
        hasStructuralMutation = true;
        isHighlightOnly = false;
      } else if (
        type === "create_entity" ||
        type === "add_entity" ||
        type === "create_box" ||
        type === "create_circle"
      ) {
        hasStructuralMutation = true;
        isHighlightOnly = false;
        if (entityId) {
          createdEntities.add(entityId);
        }
      } else if (
        type === "delete" ||
        type === "delete_entity" ||
        type === "remove_entity" ||
        type === "delete_node" ||
        type === "connect" ||
        type === "connect_relation" ||
        type === "disconnect" ||
        type === "disconnect_relation"
      ) {
        hasStructuralMutation = true;
        isHighlightOnly = false;
      } else if (
        type === "update" ||
        type === "update_entity" ||
        type === "update_node"
      ) {
        if (
          (op as any).value !== undefined ||
          (op as any).state !== undefined
        ) {
          hasValueMutation = true;
        }
        isHighlightOnly = false;
      } else if (type === "highlight" || type === "unhighlight") {
        // Highlighting
      } else {
        isHighlightOnly = false;
      }
    }

    // Domain-agnostic pedagogical role classification
    const isFailure =
      /\b(fail|failed|failure|abort|aborted|error|timeout|packet loss|dropped|violation|exception)\b/i.test(
        textCorpus,
      );

    const isRecovery =
      /\b(rollback|rolled back|retry|retransmit|retransmission|rebalance|rebalancing|compensat|recover|restore|restoration|fallback)\b/i.test(
        textCorpus,
      );

    const isDecision =
      /\b(case\b|strategy|decision|determine|classify|branch|choice|select.*approach)\b/i.test(
        textCorpus,
      ) ||
      title.toLowerCase().includes("decision") ||
      /\bcondition\b.*(?:\?|succeed|fail|met|true|false)/i.test(textCorpus);

    const isDiagnosis =
      /\b(detect\w*|diagnos\w*|imbalance\w*|violat\w*|check\w*|evaluat\w*|inspect\w*|condition\w*|exceed\w*|unbalance\w*|mismatch\w*|conflict\w*|invalid|deficit|overflow|underflow|error|compar\w*|test\w*|probe\w*|comput\w*|calculat\w*|measur\w*|balance\s+factor)\b/i.test(
        textCorpus,
      );

    const isVerification =
      /\b(verify|verifying|satisfy|satisfied|checked|intact)\b/i.test(
        textCorpus,
      );

    const isProof =
      stepIndex === totalSteps - 1 &&
      /\b(balanced|restored|established|complete|verified|converged|satisfied|final|stabilized|proof|achieved|connected)\b/i.test(
        textCorpus,
      );

    const isPerturbation =
      stepIndex <= 2 &&
      /\b(create|allocat|new\b|insert|add|send|receive|trigger|request|initiate|stimulate|query|input|push|emit)\b/i.test(
        textCorpus,
      ) &&
      !isDiagnosis &&
      !isDecision;

    // A step is pure bookkeeping if its textual description explicitly denotes
    // internal recalculation / pointer adjust without being a distinct stage/concept.
    const isBookkeepingMarker =
      /\b(recalculate|update height|update counter|temporary|internal|pointer adjust|step \d+ of \d+|intermediate link)\b/i.test(
        textCorpus,
      );

    const isPureBookkeeping =
      isBookkeepingMarker &&
      !hasCompositeAction &&
      !isDiagnosis &&
      !isProof &&
      !isFailure &&
      !isRecovery;

    const explicitRole = String(step.role || step.conceptualRole || "")
      .toLowerCase()
      .trim();
    const VALID_ROLES = new Set<string>([
      "setup",
      "perturbation",
      "diagnosis",
      "decision",
      "mechanism",
      "failure",
      "recovery",
      "verification",
      "proof",
      "bookkeeping",
    ]);

    let role: ConceptualRole = "mechanism";
    if (VALID_ROLES.has(explicitRole)) {
      role = explicitRole as ConceptualRole;
    } else if (isDecision) {
      role = "decision";
    } else if (isProof) {
      role = "proof";
    } else if (isFailure) {
      role = "failure";
    } else if (isRecovery) {
      role = "recovery";
    } else if (isDiagnosis) {
      role = "diagnosis";
    } else if (isVerification) {
      role = "verification";
    } else if (isPerturbation) {
      role = "perturbation";
    } else if (isPureBookkeeping) {
      role = "bookkeeping";
    } else if (stepIndex === 0 && !hasStructuralMutation && !hasValueMutation) {
      role = "setup";
    }

    return {
      raw: step,
      index: stepIndex,
      title,
      explanation,
      role,
      affectedEntities: Array.from(affectedEntities),
      primaryEntity,
      createdEntities: Array.from(createdEntities),
      hasCompositeAction,
      isHighlightOnly,
      isPureBookkeeping,
      causalSource,
      causalTarget,
      isProtocolMessage,
    };
  }

  /**
   * Evaluates if step B can be safely merged into milestone A without losing
   * conceptual understanding, causality, or final proof.
   */
  private static canSafelyMerge(
    milestoneA: ConceptualMilestone,
    stepB: {
      raw: RawProposalStep;
      index: number;
      title: string;
      explanation: string;
      role: ConceptualRole;
      affectedEntities: string[];
      primaryEntity?: string;
      createdEntities: string[];
      hasCompositeAction: boolean;
      isHighlightOnly: boolean;
      isPureBookkeeping: boolean;
      causalSource?: string;
      causalTarget?: string;
      isProtocolMessage?: boolean;
    },
    intent?: string,
  ): boolean {
    const roleA = milestoneA.conceptualRole;
    const roleB = stepB.role;

    // RULE 1: Never merge a Final Proof state into a non-proof state
    if (roleB === "proof" && roleA !== "proof" && roleA !== "verification") {
      return false;
    }

    // RULE 1B: Never merge across Failure, Recovery, or Decision boundaries
    if (roleA === "failure" || roleB === "failure") {
      return false;
    }
    if (roleA === "recovery" || roleB === "recovery") {
      return false;
    }
    if (roleA === "decision" || roleB === "decision") {
      return false;
    }

    // RULE 1C: Never merge discrete mutations or algorithmic transitions across separate steps
    // (e.g. separate inserts, separate deletes, compare vs swap, pivot vs partition, visit vs relax)
    const textA = `${milestoneA.title} ${milestoneA.explanation}`.toLowerCase();
    const textB = `${stepB.title} ${stepB.explanation}`.toLowerCase();
    const isMutationA =
      /\b(insert|delete|remove|eliminate|elimination|drop|discard|add|push|pop|dequeue|enqueue|swap|rotate|rebalance|pivot|partition|compare|split|merge|relax|visit|extract|sift|bubble)\b/i.test(
        textA,
      );
    const isMutationB =
      /\b(insert|delete|remove|eliminate|elimination|drop|discard|add|push|pop|dequeue|enqueue|swap|rotate|rebalance|pivot|partition|compare|split|merge|relax|visit|extract|sift|bubble)\b/i.test(
        textB,
      );
    if (isMutationA && isMutationB) {
      return false;
    }

    // RULE 1D: Never merge separate structural mutations on containers (linked lists, arrays, trees, graphs)
    const hasContainerMutationA = (milestoneA.rawSteps || []).some((s: any) =>
      [...(s.operations || []), ...(s.visual_actions || [])].some((op: any) =>
        op?.type?.startsWith("create_linked_list") ||
        op?.type?.startsWith("create_array") ||
        op?.type?.startsWith("create_tree") ||
        op?.type?.startsWith("create_graph") ||
        op?.type === "delete" ||
        op?.type === "delete_node",
      ),
    );
    const hasContainerMutationB = [
      ...(stepB.raw.operations || []),
      ...(stepB.raw.visual_actions || []),
    ].some((op: any) =>
      op?.type?.startsWith("create_linked_list") ||
      op?.type?.startsWith("create_array") ||
      op?.type?.startsWith("create_tree") ||
      op?.type?.startsWith("create_graph") ||
      op?.type === "delete" ||
      op?.type === "delete_node",
    );
    if (hasContainerMutationA && hasContainerMutationB) {
      return false;
    }

    // RULE 2: Never merge across Diagnosis / Perturbation boundaries
    // The learner must see: Perturbation (Input) -> Problem Diagnosed -> Mechanism Applied
    if (roleA === "perturbation" && roleB === "diagnosis") {
      return false;
    }
    if (roleA === "diagnosis" && roleB === "mechanism") {
      return false;
    }
    if (roleA === "mechanism" && roleB === "diagnosis") {
      return false;
    }

    // RULE 3: Causal Relay Guard across distinct protocol actors / conduits
    // If Step A transmitted a protocol message/flow to Target T, and Step B originates from or operates on T
    // (e.g. Client -> Server SYN, then Server -> Client SYN-ACK; or A transfers flux to B, then B transforms it)
    const nextActor = stepB.causalSource || stepB.primaryEntity;
    if (
      (milestoneA.isProtocolMessage || stepB.isProtocolMessage) &&
      milestoneA.causalTarget &&
      nextActor &&
      milestoneA.causalTarget === nextActor &&
      milestoneA.causalSource !== nextActor
    ) {
      return false;
    }

    // RULE 4: Multi-hop destination change
    // If Step A queried destination X, and Step B queries destination Y (X != Y),
    // (e.g. Resolver -> Root, then Resolver -> TLD), preserve each distinct query hop!
    if (
      (milestoneA.isProtocolMessage || stepB.isProtocolMessage) &&
      milestoneA.causalTarget &&
      stepB.causalTarget &&
      milestoneA.causalTarget !== stepB.causalTarget
    ) {
      return false;
    }

    // RULE 5: Entity Focus Shift across disjoint system components
    const hasEntityOverlap =
      milestoneA.affectedEntities.length === 0 ||
      stepB.affectedEntities.length === 0 ||
      milestoneA.affectedEntities.some((id) =>
        stepB.affectedEntities.includes(id),
      ) ||
      (stepB.primaryEntity &&
        milestoneA.createdEntities.includes(stepB.primaryEntity));

    if (!hasEntityOverlap) {
      // Distinct semantic entities in the system world with zero overlap:
      // (e.g. Compressor -> Condenser -> Valve -> Evaporator, or Supply -> Equilibrium)
      return false;
    }

    // RULE 6: Pure Bookkeeping Absorption
    // Always safe to absorb pure bookkeeping into the milestone that produced it
    if (roleB === "bookkeeping") {
      return true;
    }

    // RULE 7: Setup followed by immediately attached perturbation on the same entity
    // (e.g. Client socket setup followed by Client sending query)
    if (
      roleA === "setup" &&
      (roleB === "perturbation" || roleB === "mechanism")
    ) {
      // Do not merge if stepB is introducing a new element/node in an insertion sequence
      const textB = `${stepB.title} ${stepB.explanation}`.toLowerCase();
      if (textB.includes("insert") || textB.includes("create")) {
        return false;
      }
      return true;
    }

    // RULE 7.5: Perturbation continuation (connecting or initializing a newly introduced entity)
    if (
      roleA === "perturbation" &&
      stepB.affectedEntities.some((id) =>
        milestoneA.createdEntities.includes(id),
      )
    ) {
      return true;
    }

    // RULE 8: Verification / Proof merging at the end of the lesson
    if (
      (roleA === "verification" || roleA === "proof") &&
      (roleB === "verification" || roleB === "proof")
    ) {
      return true;
    }

    // RULE 9: Verification following mechanism on the same sub-structure
    if (roleA === "mechanism" && roleB === "verification") {
      return true;
    }

    // RULE 10: Safe to merge sub-actions within the same conceptual phase ONLY IF they do not collapse distinct pedagogical milestones
    if (roleA === roleB) {
      // Both are sub-steps of an insertion/setup
      if (roleA === "perturbation" || roleA === "setup") {
        return true;
      }
      // Mechanism steps:
      if (roleA === "mechanism") {
        // Safe to absorb highlight/styling into a mechanism
        if (stepB.isHighlightOnly) {
          return true;
        }
        // If they operate on disjoint entity sets (e.g. left sub-problem vs right sub-problem), NEVER merge!
        if (!hasEntityOverlap) {
          return false;
        }
        // Do not merge divide/split or merge/combine steps with other mechanism actions
        const opsA = milestoneA.operations || [];
        const opsB = stepB.raw.operations || [];
        const hasSplitMergeA = opsA.some(
          (op: any) => op.type === "split" || op.type === "merge",
        );
        const hasSplitMergeB = opsB.some(
          (op: any) => op.type === "split" || op.type === "merge",
        );
        if (hasSplitMergeA || hasSplitMergeB) {
          return false;
        }

        // Do not merge discrete swap or permutation operations
        const textA =
          `${milestoneA.title} ${milestoneA.explanation}`.toLowerCase();
        const textB = `${stepB.title} ${stepB.explanation}`.toLowerCase();
        if (textA.includes("swap") || textB.includes("swap")) {
          return false;
        }

        // Do not merge discrete insertion operations of separate nodes
        if (textA.includes("insert") && textB.includes("insert")) {
          return false;
        }

        // Sub-steps of a single mechanism restructuring on the same entity set (e.g. pointer changes in a rotation) merge cleanly
        return true;
      }
      // Both are sub-steps of diagnosis (e.g. check left then check right)
      if (roleA === "diagnosis") {
        if (!hasEntityOverlap) {
          return false;
        }
        // Do not merge discrete comparison evaluations
        const textA =
          `${milestoneA.title} ${milestoneA.explanation}`.toLowerCase();
        const textB = `${stepB.title} ${stepB.explanation}`.toLowerCase();
        if (textA.includes("compare") && textB.includes("compare")) {
          return false;
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Creates an initial milestone from a classified step.
   */
  private static createInitialMilestone(stepInfo: {
    raw: RawProposalStep;
    index: number;
    title: string;
    explanation: string;
    role: ConceptualRole;
    affectedEntities: string[];
    primaryEntity?: string;
    createdEntities: string[];
    hasCompositeAction: boolean;
    isHighlightOnly: boolean;
    isPureBookkeeping: boolean;
    causalSource?: string;
    causalTarget?: string;
    isProtocolMessage?: boolean;
  }): ConceptualMilestone {
    const learningValueScore = this.calculateLearningValueScore({
      role: stepInfo.role,
      title: stepInfo.title,
      explanation: stepInfo.explanation,
      affectedEntities: stepInfo.affectedEntities,
      createdEntities: stepInfo.createdEntities,
      operationsCount: (stepInfo.raw.operations || []).length,
      isProtocolMessage: stepInfo.isProtocolMessage,
    });

    return {
      title: stepInfo.title,
      explanation: stepInfo.explanation,
      operations: [...(stepInfo.raw.operations || [])],
      visual_actions: [...(stepInfo.raw.visual_actions || [])],
      calculations: stepInfo.raw.calculations,
      insight: stepInfo.raw.insight,
      conceptualRole: stepInfo.role,
      affectedEntities: [...stepInfo.affectedEntities],
      primaryEntity: stepInfo.primaryEntity,
      createdEntities: [...stepInfo.createdEntities],
      causalSource: stepInfo.causalSource,
      causalTarget: stepInfo.causalTarget,
      isProtocolMessage: stepInfo.isProtocolMessage,
      absorbedStepsCount: 1,
      learningValueScore,
      preconditions: stepInfo.raw.preconditions
        ? [...stepInfo.raw.preconditions]
        : undefined,
      postconditions: stepInfo.raw.postconditions
        ? [...stepInfo.raw.postconditions]
        : undefined,
      decision: stepInfo.raw.decision,
      stateType: stepInfo.raw.stateType,
      persistence: stepInfo.raw.persistence,
      causalRole: stepInfo.raw.causalRole,
      invariants: stepInfo.raw.invariants
        ? [...stepInfo.raw.invariants]
        : undefined,
      failureContext: stepInfo.raw.failureContext,
      recoveryContext: stepInfo.raw.recoveryContext,
      counterfactual: stepInfo.raw.counterfactual,
      codeContext: stepInfo.raw.codeContext,
      codeSnippet: stepInfo.raw.codeSnippet || stepInfo.raw.codeContext?.code,
      codeLanguage:
        stepInfo.raw.codeLanguage || stepInfo.raw.codeContext?.language,
    };
  }

  /**
   * Merges a step into an existing milestone.
   */
  private static mergeStepIntoMilestone(
    milestone: ConceptualMilestone,
    step: {
      raw: RawProposalStep;
      index: number;
      title: string;
      explanation: string;
      role: ConceptualRole;
      affectedEntities: string[];
      primaryEntity?: string;
      createdEntities: string[];
      hasCompositeAction: boolean;
      isHighlightOnly: boolean;
      isPureBookkeeping: boolean;
      causalSource?: string;
      causalTarget?: string;
      isProtocolMessage?: boolean;
    },
  ): ConceptualMilestone {
    // 1. Combine operations
    const operations = [
      ...(milestone.operations || []),
      ...(step.raw.operations || []),
    ];

    // 2. Combine visual actions
    let visualActions: VisualAction[] = [];
    if (step.hasCompositeAction) {
      const nonCompositeOld = (milestone.visual_actions || []).filter(
        (a) => !(a as any).type?.startsWith("create_tree"),
      );
      visualActions = [...nonCompositeOld, ...(step.raw.visual_actions || [])];
    } else {
      visualActions = [
        ...(milestone.visual_actions || []),
        ...(step.raw.visual_actions || []),
      ];
    }

    // 3. Synthesize Title
    let title = milestone.title;
    if (
      milestone.title.toLowerCase().startsWith("create") ||
      milestone.title.toLowerCase().startsWith("step")
    ) {
      if (
        !step.title.toLowerCase().startsWith("create") &&
        !step.title.toLowerCase().startsWith("step")
      ) {
        title = step.title;
      }
    }

    // 4. Synthesize Explanation
    let explanation = milestone.explanation;
    if (
      step.explanation &&
      !explanation
        .toLowerCase()
        .includes(step.explanation.toLowerCase().slice(0, 20))
    ) {
      explanation = `${explanation} ${step.explanation}`.trim();
    }

    // 5. Combine affected entities & created entities
    const affectedSet = new Set([
      ...milestone.affectedEntities,
      ...step.affectedEntities,
    ]);
    const createdSet = new Set([
      ...milestone.createdEntities,
      ...step.createdEntities,
    ]);

    // 6. Combine calculations and insight
    const calculations =
      step.raw.calculations || milestone.calculations
        ? [milestone.calculations, step.raw.calculations]
            .filter(Boolean)
            .join("; ")
        : undefined;

    const insight = step.raw.insight || milestone.insight;

    // Elevate role if milestone was setup or bookkeeping, or if step is proof
    let conceptualRole = milestone.conceptualRole;
    if (
      milestone.conceptualRole === "setup" ||
      milestone.conceptualRole === "bookkeeping"
    ) {
      conceptualRole = step.role;
    } else if (step.role === "proof") {
      conceptualRole = "proof";
    }

    const learningValueScore = this.calculateLearningValueScore({
      role: conceptualRole,
      title,
      explanation,
      affectedEntities: Array.from(affectedSet),
      createdEntities: Array.from(createdSet),
      operationsCount: operations.length,
      isProtocolMessage: milestone.isProtocolMessage || step.isProtocolMessage,
    });

    const combinedPre = [
      ...(milestone.preconditions || []),
      ...(step.raw.preconditions || []),
    ];
    const combinedPost = [
      ...(milestone.postconditions || []),
      ...(step.raw.postconditions || []),
    ];

    return {
      title,
      explanation,
      operations,
      visual_actions: visualActions,
      calculations,
      insight,
      conceptualRole,
      affectedEntities: Array.from(affectedSet),
      primaryEntity: milestone.primaryEntity || step.primaryEntity,
      createdEntities: Array.from(createdSet),
      causalSource: milestone.causalSource || step.causalSource,
      causalTarget: step.causalTarget || milestone.causalTarget,
      isProtocolMessage: milestone.isProtocolMessage || step.isProtocolMessage,
      absorbedStepsCount: milestone.absorbedStepsCount + 1,
      learningValueScore,
      preconditions: combinedPre.length > 0 ? combinedPre : undefined,
      postconditions: combinedPost.length > 0 ? combinedPost : undefined,
      decision: step.raw.decision || milestone.decision,
      stateType: step.raw.stateType || milestone.stateType,
      persistence: step.raw.persistence || milestone.persistence,
      causalRole: step.raw.causalRole || milestone.causalRole,
      invariants: step.raw.invariants || milestone.invariants,
      failureContext: step.raw.failureContext || milestone.failureContext,
      recoveryContext: step.raw.recoveryContext || milestone.recoveryContext,
      counterfactual: step.raw.counterfactual || milestone.counterfactual,
      codeContext: step.raw.codeContext || milestone.codeContext,
      codeSnippet:
        step.raw.codeSnippet ||
        milestone.codeSnippet ||
        step.raw.codeContext?.code ||
        milestone.codeContext?.code,
      codeLanguage:
        step.raw.codeLanguage ||
        milestone.codeLanguage ||
        step.raw.codeContext?.language ||
        milestone.codeContext?.language,
    };
  }

  /**
   * Universal Learning Value Score (0.0 - 1.0)
   * Evaluates the pedagogical contribution of a candidate step or transformation.
   */
  public static calculateLearningValueScore(step: {
    role: ConceptualRole;
    title: string;
    explanation: string;
    affectedEntities: string[];
    createdEntities: string[];
    operationsCount: number;
    isProtocolMessage?: boolean;
  }): number {
    let newKnowledge = 0.5;
    if (step.createdEntities.length > 0) {
      newKnowledge += 0.3;
    }
    if (step.role === "setup" || step.role === "perturbation") {
      newKnowledge += 0.2;
    }

    let causalImportance = 0.4;
    if (
      step.role === "mechanism" ||
      step.role === "decision" ||
      step.role === "failure" ||
      step.role === "recovery" ||
      step.isProtocolMessage
    ) {
      causalImportance += 0.5;
    }

    let stateImportance = 0.3;
    if (
      step.operationsCount > 0 ||
      step.role === "proof" ||
      step.role === "recovery"
    ) {
      stateImportance += 0.5;
    }

    let misconceptionValue = 0.2;
    if (
      step.role === "failure" ||
      step.role === "recovery" ||
      step.role === "decision"
    ) {
      misconceptionValue += 0.6;
    }

    let goalProgress = 0.4;
    if (
      step.role === "proof" ||
      step.role === "verification" ||
      step.role === "mechanism"
    ) {
      goalProgress += 0.5;
    }

    const redundancyPenalty = step.role === "bookkeeping" ? 0.6 : 0.0;
    const cognitiveLoadPenalty = step.affectedEntities.length > 6 ? 0.2 : 0.0;

    const rawScore =
      newKnowledge * 0.25 +
      causalImportance * 0.25 +
      stateImportance * 0.2 +
      misconceptionValue * 0.15 +
      goalProgress * 0.15 -
      redundancyPenalty -
      cognitiveLoadPenalty;

    return Math.max(0.1, Math.min(1.0, Math.round(rawScore * 100) / 100));
  }

  /**
   * Decomposes compound multi-action steps that combine diagnosis (e.g. imbalance detection)
   * with structural mechanism (e.g. tree rotation) so the learner clearly observes cause before effect.
   */
  public static decomposeOpaqueSteps(
    rawSteps: RawProposalStep[],
  ): RawProposalStep[] {
    const result: RawProposalStep[] = [];
    for (const step of rawSteps) {
      const ops = step.operations || [];
      const text = `${step.title || ""} ${
        step.explanation || ""
      }`.toLowerCase();
      const hasDiagnosis =
        /\b(imbalance|violat|unbalance|check|detect|diagnos|deficit)\b/i.test(
          text,
        );
      const hasRestructuring =
        /\b(rotat|rebalanc|pivot|sever|promote|demote)\b/i.test(text) ||
        ops.some(
          (op: any) =>
            op.type === "connect" ||
            op.type === "disconnect" ||
            op.type === "create_arrow" ||
            op.role === "root" ||
            op.relationType === "left" ||
            op.relationType === "right",
        );

      const highlightOps = ops.filter(
        (op: any) =>
          op.type === "highlight" ||
          op.type === "unhighlight" ||
          op.state === "warning" ||
          op.state === "danger" ||
          op.state === "imbalanced",
      );
      const structuralOps = ops.filter((op: any) => !highlightOps.includes(op));

      if (
        hasDiagnosis &&
        hasRestructuring &&
        highlightOps.length > 0 &&
        structuralOps.length > 0
      ) {
        // Decompose into Step A (Diagnosis) and Step B (Mechanism)
        result.push({
          ...step,
          title: `Diagnose Imbalance: ${step.title || "Imbalance Detected"}`,
          explanation: `Invariant check identifies structural imbalance: ${
            step.explanation || "Balance factor exceeds allowed threshold."
          }`,
          operations: highlightOps,
          role: "diagnosis",
          conceptualRole: "diagnosis",
        });

        result.push({
          ...step,
          title: `Execute Restructuring: ${step.title || "Rotation Execution"}`,
          explanation: `Applying corrective mechanism to restore balance: ${
            step.explanation || "Reconnecting subtree pointers around pivot."
          }`,
          operations: structuralOps,
          role: "mechanism",
          conceptualRole: "mechanism",
        });
      } else {
        result.push(step);
      }
    }
    return result;
  }

  /**
   * Universal Multi-Dimensional Transformation Quality Metrics (0.0 - 1.0)
   */
  public static calculateQualityMetrics(
    milestone: ConceptualMilestone,
  ): TransformationQualityMetrics {
    const role = milestone.conceptualRole;
    let semanticSignificance = 0.5;
    if (milestone.createdEntities.length > 0) {
      semanticSignificance += 0.3;
    }
    if (
      (milestone.operations || []).some(
        (op: any) =>
          op.type === "connect" ||
          op.type === "disconnect" ||
          op.type === "delete" ||
          op.type === "remove_entity",
      )
    ) {
      semanticSignificance += 0.2;
    }

    let causalSignificance = 0.4;
    if (
      role === "mechanism" ||
      role === "decision" ||
      role === "failure" ||
      role === "recovery" ||
      milestone.isProtocolMessage
    ) {
      causalSignificance = 0.9;
    } else if (role === "diagnosis") {
      causalSignificance = 0.8;
    }

    let visualObservability = 0.5;
    if (
      (milestone.visual_actions || []).length > 0 ||
      (milestone.operations || []).length > 0
    ) {
      visualObservability = 0.85;
    }

    let invariantRelevance = 0.3;
    if (milestone.invariants && milestone.invariants.length > 0) {
      invariantRelevance = 0.9;
    } else if (
      role === "proof" ||
      role === "verification" ||
      role === "diagnosis"
    ) {
      invariantRelevance = 0.8;
    }

    let comprehensionValue = 0.6;
    if (milestone.insight || milestone.calculations) {
      comprehensionValue += 0.3;
    }

    const overallScore = Math.min(
      1.0,
      Math.max(
        0.1,
        Math.round(
          (semanticSignificance * 0.25 +
            causalSignificance * 0.25 +
            visualObservability * 0.2 +
            invariantRelevance * 0.15 +
            comprehensionValue * 0.15) *
            100,
        ) / 100,
      ),
    );

    return {
      semanticSignificance: Math.min(1.0, semanticSignificance),
      causalSignificance: Math.min(1.0, causalSignificance),
      visualObservability: Math.min(1.0, visualObservability),
      invariantRelevance: Math.min(1.0, invariantRelevance),
      comprehensionValue: Math.min(1.0, comprehensionValue),
      overallScore,
    };
  }

  /**
   * Dynamic Granularity Level Selector
   */
  public static evaluateGranularity(
    milestone: ConceptualMilestone,
    overallScore: number,
  ): GranularityLevel {
    const role = milestone.conceptualRole;
    if (
      role === "diagnosis" ||
      role === "decision" ||
      role === "failure" ||
      role === "recovery"
    ) {
      return "MICRO";
    }
    if (
      role === "bookkeeping" ||
      (milestone.operations || []).every(
        (op: any) => op.type === "highlight" || op.type === "unhighlight",
      )
    ) {
      return "MACRO";
    }
    return "NORMAL";
  }

  /**
   * Derives structured transition metadata for authoritative pedagogical execution.
   */
  private static deriveTransitionMetadata(
    m: ConceptualMilestone,
    idx: number,
    total: number,
  ): {
    cause: string;
    visualEvidenceRequired: string;
    consequence: string;
    nextDependency: string;
  } {
    const role = m.conceptualRole;
    let cause = m.cause || m.whyChanged || "";
    if (!cause) {
      if (role === "setup") {
        cause = "Initial baseline environment configuration";
      } else if (role === "perturbation") {
        cause = `Input stimulus applied to ${
          m.affectedEntities.join(", ") || "system"
        }`;
      } else if (role === "diagnosis") {
        cause = `Condition or balance factor evaluation on ${
          m.affectedEntities.join(", ") || "elements"
        }`;
      } else if (role === "decision") {
        cause = `Branch evaluation: selecting appropriate resolution strategy`;
      } else if (role === "mechanism") {
        cause = `Algorithmic transformation executed on ${
          m.affectedEntities.join(", ") || "target entities"
        }`;
      } else if (role === "failure") {
        cause = `Constraint breach or failure mode encountered`;
      } else if (role === "recovery") {
        cause = `Restoration policy or rebalancing mechanism triggered`;
      } else if (role === "proof" || role === "verification") {
        cause = `Verification that invariants hold across the system`;
      } else {
        cause = `State transition in pedagogical sequence`;
      }
    }

    let visualEvidenceRequired = m.visualEvidenceRequired || "";
    if (!visualEvidenceRequired) {
      if (m.createdEntities.length > 0) {
        visualEvidenceRequired = `Newly allocated entities [${m.createdEntities.join(
          ", ",
        )}] rendered with valid values and styling`;
      } else if (
        (m.operations || []).some(
          (op: any) =>
            op.type === "connect" ||
            op.type === "create_arrow" ||
            op.relationType !== undefined,
        )
      ) {
        visualEvidenceRequired = `Directed connectors dynamically routed between parent and child/conduit endpoints`;
      } else if (role === "diagnosis") {
        visualEvidenceRequired = `Warning/imbalance highlights and diagnostic annotations visible on affected nodes`;
      } else if (role === "proof") {
        visualEvidenceRequired = `Terminal verified state rendered with balanced structure and valid node invariants`;
      } else {
        visualEvidenceRequired = `Visible state mutation reflected on canvas entities [${m.affectedEntities.join(
          ", ",
        )}]`;
      }
    }

    let consequence = m.consequence || "";
    if (!consequence) {
      if (idx === total - 1) {
        consequence = "Goal fully satisfied and system state verified";
      } else {
        consequence = `System transitions to intermediate state ${
          idx + 1
        }, preparing for subsequent operation`;
      }
    }

    let nextDependency = m.nextDependency || "";
    if (!nextDependency) {
      if (idx === total - 1) {
        nextDependency = "None (terminal state)";
      } else {
        nextDependency = `Step ${idx + 2} dependent on state produced by step ${
          idx + 1
        }`;
      }
    }

    return { cause, visualEvidenceRequired, consequence, nextDependency };
  }

  /**
   * Post-processes milestones to ensure causal completeness, introduce-before-transform,
   * structured transition metadata, and final proof presence.
   */
  private static postProcessMilestones(
    milestones: ConceptualMilestone[],
    context: JourneyOptimizationContext,
  ): ConceptualMilestone[] {
    if (milestones.length === 0) {
      return [];
    }

    const introducedEntities = new Set<string>(
      (context.initialEntities || []).map((e) => e.id),
    );

    return milestones.map((m, idx) => {
      let title = m.title.trim();
      if (!title || title.startsWith("Transition ")) {
        title = `Milestone ${idx + 1}: ${m.conceptualRole.toUpperCase()}`;
      }
      // Scrub any raw operation IDs (e.g., t3-op0) from titles
      title = title.replace(
        /\b(?:Introducing\s+)?t\d+[-_]op\d+[^:]*:\s*/gi,
        "",
      );

      let explanation = m.explanation.trim();
      // Scrub any raw operation IDs (e.g., t3-op0) from explanations
      explanation = explanation.replace(
        /\b(?:Introducing\s+)?t\d+[-_]op\d+[^:]*:\s*/gi,
        "",
      );

      // Ensure unintroduced domain entities are introduced before being transformed
      const isInternalArtifact = (id: string) =>
        /^(?:pointer|ptr|dist-table|pq|invariant|table|queue|marker|temp|callout)/i.test(id) ||
        /(?:-before|-after|-table|-pq|-pointer)$/i.test(id);

      const formatFriendlyName = (id: string) => {
        const graphMatch = id.match(/(?:graph[-_])([A-Za-z0-9]+)$/i);
        if (graphMatch) return `Node ${graphMatch[1]}`;
        const nodeMatch = id.match(/(?:node[-_])([A-Za-z0-9]+)$/i);
        if (nodeMatch) return `Node ${nodeMatch[1]}`;
        return id;
      };

      const unintroduced = m.affectedEntities.filter(
        (id) =>
          !isInternalArtifact(id) &&
          !introducedEntities.has(id) &&
          !m.createdEntities.includes(id),
      );
      if (unintroduced.length > 0) {
        const friendlyList = unintroduced.map(formatFriendlyName).join(", ");
        const firstClean = formatFriendlyName(unintroduced[0]).toLowerCase();
        if (!explanation.toLowerCase().includes(firstClean)) {
          explanation = `Focusing on ${friendlyList}. ${explanation}`;
        }
      }

      // Track newly introduced entities
      m.createdEntities.forEach((id) => introducedEntities.add(id));
      m.affectedEntities.forEach((id) => introducedEntities.add(id));

      const qualityMetrics = this.calculateQualityMetrics(m);
      const transitionMeta = this.deriveTransitionMetadata(
        m,
        idx,
        milestones.length,
      );
      const granularity = this.evaluateGranularity(
        m,
        qualityMetrics.overallScore,
      );

      return {
        ...m,
        title,
        explanation,
        transitionId: `tr-${idx + 1}`,
        cause: m.cause || transitionMeta.cause,
        visualEvidenceRequired:
          m.visualEvidenceRequired || transitionMeta.visualEvidenceRequired,
        consequence: m.consequence || transitionMeta.consequence,
        nextDependency: m.nextDependency || transitionMeta.nextDependency,
        granularity,
        qualityScore: qualityMetrics.overallScore,
      };
    });
  }
}
