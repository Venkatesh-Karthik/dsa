/**
 * Cognora Context Engine
 *
 * Resolves indexicals and deictic references ("that", "this node", "why did we do that", "left side")
 * from the active TeachingMoment, focus state, selection, and recent conversational context.
 *
 * Constructs compact, structured context packages for Nemotron 3 Ultra to avoid sending bloated state.
 */

import type { CognoraWorldState } from "./cognora-world-model";
import type { InputIntent } from "./input-intent";

export interface ResolvedContext {
  concept: string;
  stepIndex: number;
  totalSteps: number;
  momentSummary: string;
  targetEntityId?: string;
  targetEntityLabel?: string;
  affectedEntities: string[];
  affectedRelationships: string[];
  whyCurrentStep: string;
  consequence: string;
  relevantInvariants: string[];
  recentTurns: Array<{ role: string; content: string }>;
  branchActive: boolean;
  branchDescription?: string;
}

export class ContextEngine {
  /**
   * Resolves the ambient semantic context for a given intent and world state
   */
  public static resolveContext(
    intent: InputIntent,
    worldState: Readonly<CognoraWorldState>,
  ): ResolvedContext {
    const currentMoment = worldState.currentMoment;
    const student = worldState.studentState;
    const branch = worldState.activeBranch;

    const concept =
      branch?.description ||
      worldState.lesson?.concept ||
      student.currentConcept ||
      "Algorithm / Data Structure";

    const stepIndex = currentMoment ? currentMoment.stepIndex : 0;
    const totalSteps = currentMoment ? currentMoment.totalSteps : 1;

    // 1. Resolve Target Entity / Indexicals ("this", "that", "node", explicit target)
    let targetEntityId: string | undefined = intent.target;
    let targetEntityLabel: string | undefined;

    if (!targetEntityId) {
      // Check active focus state
      if (worldState.focusState?.focusedEntityId) {
        targetEntityId = worldState.focusState.focusedEntityId;
        targetEntityLabel = worldState.focusState.label;
      } else if (currentMoment?.semanticFocus) {
        targetEntityId = currentMoment.semanticFocus.entityIds?.[0];
        targetEntityLabel = currentMoment.semanticFocus.label;
      } else if (
        currentMoment?.affectedEntities &&
        currentMoment.affectedEntities.length > 0
      ) {
        targetEntityId = currentMoment.affectedEntities[0];
        targetEntityLabel = targetEntityId;
      }
    } else {
      targetEntityLabel = targetEntityId;
    }

    // 2. Extract Invariants from verified state
    const relevantInvariants: string[] = [];
    const invariants =
      worldState.timeline?.model?.invariants ||
      (worldState.timeline as any)?.invariants ||
      [];
    if (invariants.length > 0) {
      relevantInvariants.push(
        ...invariants.map((inv: any) => inv.statement).slice(0, 3),
      );
    }

    // 3. Extract Bounded Conversation Turns (last 4 turns)
    const recentTurns = (worldState.conversationState || [])
      .slice(-4)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    return {
      concept,
      stepIndex,
      totalSteps,
      momentSummary: currentMoment?.explanation || "Current visual state",
      targetEntityId,
      targetEntityLabel,
      affectedEntities: currentMoment?.affectedEntities || [],
      affectedRelationships: currentMoment?.affectedRelationships || [],
      whyCurrentStep: currentMoment?.why || "",
      consequence: currentMoment?.consequence || "",
      relevantInvariants,
      recentTurns,
      branchActive: branch !== null,
      branchDescription: branch?.description,
    };
  }

  /**
   * Produces a compact, structured context string for Nemotron 3 Ultra.
   * Completely strips raw Excalidraw coordinates and redundant JSON bloat.
   */
  public static formatCompactPromptContext(resolved: ResolvedContext): string {
    const lines: string[] = [
      `[COGNORA_CONTEXT]`,
      `Concept: ${resolved.concept}`,
      `Timeline Position: Step ${resolved.stepIndex + 1} of ${
        resolved.totalSteps
      }`,
      `Active Step: ${resolved.momentSummary}`,
    ];

    if (resolved.targetEntityLabel) {
      lines.push(`Focused Entity: ${resolved.targetEntityLabel}`);
    }

    if (resolved.affectedEntities.length > 0) {
      lines.push(`Affected Entities: ${resolved.affectedEntities.join(", ")}`);
    }

    if (resolved.whyCurrentStep) {
      lines.push(`Causal Reason (Why): ${resolved.whyCurrentStep}`);
    }

    if (resolved.consequence) {
      lines.push(`Consequence: ${resolved.consequence}`);
    }

    if (resolved.relevantInvariants.length > 0) {
      lines.push(
        `Verified Invariants: ${resolved.relevantInvariants.join("; ")}`,
      );
    }

    if (resolved.branchActive) {
      lines.push(`What-If Branch Active: ${resolved.branchDescription}`);
    }

    return lines.join("\n");
  }
}
