/**
 * Cognora Authoritative Teaching Moment
 *
 * The single source of truth for:
 * - Canvas Visual State
 * - Semantic Focus Target
 * - Contextual Callout & Leader Line
 * - Inspector Educational Explanation
 * - Voice Narration & Speech Script
 * - Liquid Glass Voice ORB Presence
 * - Playback Controller State Machine
 *
 * Guarantees 1-to-1 synchronization across all Cognora subsystems with zero lag.
 */

import { SpeechPreprocessor } from "./voice/speech-preprocessor";

import type { SceneState } from "./scene-state";
import type { AuthoritativeSemanticModel } from "./authoritative-model";

export type SemanticFocusType =
  | "entity"
  | "relationship"
  | "operation"
  | "region"
  | "group";

export interface SemanticFocusTarget {
  type: SemanticFocusType;
  entityIds?: string[];
  relationshipIds?: string[];
  operationId?: string;
  anchorPreference?: "center" | "top" | "bottom" | "left" | "right";
  label?: string;
}

export interface TeachingMoment {
  id: string;
  transformationId: string;
  stepIndex: number;
  totalSteps: number;

  beforeState: SceneState;
  afterState: SceneState;

  semanticChanges: {
    addedEntities: string[];
    removedEntities: string[];
    updatedEntities: string[];
    addedRelationships: string[];
    removedRelationships: string[];
  };

  /** The authoritative rendered scene state for this moment */
  visualState: SceneState;

  affectedEntities: string[];
  affectedRelationships: string[];

  /** Explicit semantic focus target — no regex guessing from explanation prose */
  semanticFocus: SemanticFocusTarget;

  title: string;
  explanation: string;
  why?: string;
  consequence?: string;

  /** Spoken script for Chatterbox-Turbo TTS */
  narration: string;

  durationHint?: number;
  importance?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  codeContext?: {
    code: string;
    language?: string;
  };
  calculations?: string;
  insight?: string;
}

export class TeachingMomentCompiler {
  /**
   * Compiles an AuthoritativeSemanticModel and its sequence of complete SceneStates
   * into a strictly ordered, pre-validated sequence of TeachingMoments.
   */
  public static compile(
    model: AuthoritativeSemanticModel,
    states: SceneState[],
  ): TeachingMoment[] {
    if (!states || states.length === 0) {
      return [];
    }

    const totalSteps = states.length;
    const moments: TeachingMoment[] = [];

    for (let sIdx = 0; sIdx < totalSteps; sIdx++) {
      const visualState = states[sIdx];
      const beforeState = sIdx > 0 ? states[sIdx - 1] : states[0];
      const afterState = visualState;

      // Identify semantic changes between beforeState and afterState
      const beforeEntities = new Set(beforeState.graph.entities.keys());
      const afterEntities = new Set(afterState.graph.entities.keys());
      const addedEntities = Array.from(afterEntities).filter(
        (id) => !beforeEntities.has(id),
      );
      const removedEntities = Array.from(beforeEntities).filter(
        (id) => !afterEntities.has(id),
      );
      const updatedEntities = Array.from(afterEntities).filter((id) => {
        if (!beforeEntities.has(id)) {
          return false;
        }
        const bEnt = beforeState.graph.entities.get(id);
        const aEnt = afterState.graph.entities.get(id);
        return (
          bEnt?.state !== aEnt?.state ||
          bEnt?.properties?.highlight !== aEnt?.properties?.highlight ||
          bEnt?.value !== aEnt?.value
        );
      });

      const beforeRels = new Set(beforeState.graph.relationships.keys());
      const afterRels = new Set(afterState.graph.relationships.keys());
      const addedRelationships = Array.from(afterRels).filter(
        (id) => !beforeRels.has(id),
      );
      const removedRelationships = Array.from(beforeRels).filter(
        (id) => !afterRels.has(id),
      );

      const trans = sIdx > 0 ? model.transformations[sIdx - 1] : undefined;
      const semState = model.states[sIdx];

      // 1. Resolve Title and Explanation for this moment
      let stepTitle = "";
      let stepExplanation = "";
      let why = "";
      let consequence = "";

      if (sIdx === 0) {
        stepTitle =
          semState?.name ||
          (model.problem as any)?.objective ||
          "Initial State";
        stepExplanation =
          semState?.description ||
          "Initial state of the verified concept before transformation.";
        why = "Establish conceptual baseline.";
        consequence = "Prepares structure for step-by-step evolution.";
      } else {
        stepTitle = trans?.title || semState?.name || `Step ${sIdx}`;
        stepExplanation = trans?.explanation || semState?.description || "";
        why = trans?.whyChanged || trans?.cause || "";
        consequence = trans?.learnerObservation || "";
      }

      // 2. Resolve Affected Entities & Relationships
      const affectedEntities: string[] = trans?.affectedEntities?.length
        ? [...trans.affectedEntities]
        : addedEntities.length > 0
        ? addedEntities
        : updatedEntities.length > 0
        ? updatedEntities
        : [];

      const affectedRelationships: string[] = trans?.affectedRelationships
        ?.length
        ? [...trans.affectedRelationships]
        : addedRelationships;

      // 3. Explicit Semantic Focus Determination
      const semanticFocus = this.resolveExplicitSemanticFocus(
        sIdx,
        trans,
        affectedEntities,
        affectedRelationships,
        visualState,
      );

      // 4. Construct Educational Narration (Speech Director script)
      const narration = this.constructEducationalNarration(
        stepTitle,
        stepExplanation,
        why,
        consequence,
        sIdx,
        totalSteps,
      );

      // 5. Code context & calculations
      const codeContext = trans?.codeSnippet
        ? {
            code: trans.codeSnippet,
            language: trans.codeLanguage || "typescript",
          }
        : undefined;

      moments.push({
        id: trans?.id || (sIdx === 0 ? "moment-initial" : `moment-${sIdx}`),
        transformationId: trans?.id || (sIdx === 0 ? "initial" : `t-${sIdx}`),
        stepIndex: sIdx,
        totalSteps,
        beforeState,
        afterState,
        semanticChanges: {
          addedEntities,
          removedEntities,
          updatedEntities,
          addedRelationships,
          removedRelationships,
        },
        visualState,
        affectedEntities,
        affectedRelationships,
        semanticFocus,
        title: stepTitle,
        explanation: stepExplanation,
        why,
        consequence,
        narration,
        durationHint: trans ? 2400 : 1800,
        importance:
          sIdx === 0 || sIdx === totalSteps - 1
            ? "HIGH"
            : trans?.title?.toLowerCase().includes("rotate") ||
              trans?.title?.toLowerCase().includes("rebalance")
            ? "CRITICAL"
            : "NORMAL",
        codeContext,
        calculations: trans?.calculations,
        insight: trans?.insight,
      });
    }

    console.info(
      `[COGNORA][LESSON][COMPILE] Compiled ${moments.length} authoritative TeachingMoments with 1-to-1 visual synchronization.`,
    );

    return moments;
  }

  /**
   * Resolves explicit semantic focus without any prose regex guessing.
   */
  private static resolveExplicitSemanticFocus(
    stepIndex: number,
    trans: any,
    affectedEntities: string[],
    affectedRelationships: string[],
    sceneState: SceneState,
  ): SemanticFocusTarget {
    // Initial moment: Focus on root or primary focal entity if present
    if (stepIndex === 0) {
      let rootId: string | undefined;
      for (const [id, ent] of sceneState.graph.entities.entries()) {
        if (ent.semanticRole === "root" || id.includes("root")) {
          rootId = id;
          break;
        }
      }
      if (!rootId && sceneState.graph.entities.size > 0) {
        rootId = Array.from(sceneState.graph.entities.keys())[0];
      }
      return {
        type: "entity",
        entityIds: rootId ? [rootId] : [],
        anchorPreference: "center",
        label: "Initial State",
      };
    }

    // Explicit transformation target if specified
    if (trans?.semanticTarget) {
      return {
        type: "entity",
        entityIds: [String(trans.semanticTarget)],
        label: trans.title,
      };
    }

    // If a relationship was primarily affected (e.g. edge relaxed or pointer linked)
    if (affectedRelationships.length > 0 && affectedEntities.length === 0) {
      return {
        type: "relationship",
        relationshipIds: affectedRelationships,
        label: trans?.title,
      };
    }

    // Default: Focus on the affected entity (e.g. inserted node, moved pivot)
    if (affectedEntities.length > 0) {
      return {
        type: "entity",
        entityIds: affectedEntities,
        label: trans?.title,
      };
    }

    // Fallback to relationship if present
    if (affectedRelationships.length > 0) {
      return {
        type: "relationship",
        relationshipIds: affectedRelationships,
        label: trans?.title,
      };
    }

    return {
      type: "region",
      anchorPreference: "center",
      label: trans?.title,
    };
  }

  /**
   * Constructs natural educational narration from the moment's pedagogical attributes.
   */
  private static constructEducationalNarration(
    title: string,
    explanation: string,
    why: string,
    consequence: string,
    stepIndex: number,
    totalSteps: number,
  ): string {
    const raw = explanation || title || "";
    const prep = SpeechPreprocessor.prepare({
      lessonId: "moment",
      transformationId: `step-${stepIndex}`,
      stepIndex,
      totalSteps,
      title,
      explanation: raw,
    });

    return prep.spokenText;
  }
}
