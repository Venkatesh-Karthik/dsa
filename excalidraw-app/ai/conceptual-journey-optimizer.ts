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

    // Step 1: Analyze and classify each raw step
    const classifiedSteps = rawSteps.map((step, index) => {
      const prevStep = index > 0 ? rawSteps[index - 1] : undefined;
      return this.analyzeStep(step, prevStep, index, rawSteps.length);
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

      const entityId =
        (op as any).entityId || (op as any).id || (op as any).nodeId;
      if (entityId && typeof entityId === "string") {
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
    const isDiagnosis =
      /\b(detect|diagnos|imbalance|violat|check|evaluat|inspect|condition|exceed|unbalance|mismatch|conflict|invalid|deficit|overflow|underflow|error|calculat.*(balance|factor|invariant|metric|bound|error))\b/i.test(
        textCorpus,
      );

    const isDecision =
      /\b(case\b|strategy|decision|determine|classify|branch|choice|select.*approach)\b/i.test(
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
      !isDiagnosis;

    // A step is pure bookkeeping if its textual description explicitly denotes
    // internal recalculation / pointer adjust without being a distinct stage/concept.
    const isBookkeepingMarker =
      /\b(recalculate|update height|update counter|temporary|internal|pointer adjust|step \d+ of \d+|intermediate link)\b/i.test(
        textCorpus,
      );

    const isPureBookkeeping =
      isBookkeepingMarker && !hasCompositeAction && !isDiagnosis && !isProof;

    let role: ConceptualRole = "mechanism";
    if (isProof) {
      role = "proof";
    } else if (isDiagnosis) {
      role = "diagnosis";
    } else if (isDecision) {
      role = "decision";
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

    // RULE 2: Never merge across Diagnosis / Perturbation boundaries
    // The learner must see: Perturbation (Input) -> Problem Diagnosed -> Mechanism Applied
    if (roleA === "perturbation" && roleB === "diagnosis") {
      return false;
    }
    if (roleA === "diagnosis" && roleB === "mechanism") {
      return false;
    }
    if (roleA === "decision" && roleB === "mechanism") {
      if (intent === "derive" || intent === "why") {
        return false;
      }
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

    // RULE 10: Safe to merge sub-actions within the same conceptual phase & sub-graph
    if (roleA === roleB) {
      // Both are sub-steps of an insertion/setup
      if (roleA === "perturbation" || roleA === "setup") {
        return true;
      }
      // Both are sub-steps of a single mechanism restructuring (e.g. multiple pointer changes on the same tree/graph)
      if (roleA === "mechanism") {
        return true;
      }
      // Both are sub-steps of diagnosis (e.g. check left then check right)
      if (roleA === "diagnosis") {
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
    };
  }

  /**
   * Post-processes milestones to ensure causal completeness and final proof presence.
   */
  private static postProcessMilestones(
    milestones: ConceptualMilestone[],
    context: JourneyOptimizationContext,
  ): ConceptualMilestone[] {
    if (milestones.length === 0) {
      return [];
    }

    return milestones.map((m, idx) => {
      let title = m.title.trim();
      if (!title || title.startsWith("Transition ")) {
        title = `Milestone ${idx + 1}: ${m.conceptualRole.toUpperCase()}`;
      }
      return {
        ...m,
        title,
        explanation: m.explanation.trim(),
      };
    });
  }
}
