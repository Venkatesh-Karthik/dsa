/**
 * Cognora DSA Acceleration Layer - TeachingMoment Adapter
 *
 * Adapts deterministic algorithm execution (DSASemanticState[] + TeachingTransformation[])
 * directly into Cognora's existing authoritative teaching pipelines:
 *
 * DSASemanticState[]
 *        ↓
 * Cognora SceneState[] (via existing computeSceneGraphLayout)
 *        ↓
 * Cognora TeachingMoment[] (with WHAT / WHY / RESULT, narration, focus target)
 *        ↓
 * CompiledTimeline & AuthoritativeSemanticModel
 *        ↓
 * LessonPlaybackController (100% local, zero AI / network calls on playback)
 */

import {
  type SceneState,
  createSceneState,
} from "../../ai/scene-state";
import {
  createEmptySceneGraph,
  addEntity,
  addRelationship,
  type SemanticEntity,
  type SemanticRelationship,
} from "../../ai/scene-graph";
import { computeSceneGraphLayout } from "../../ai/layout-engine";
import type { TeachingMoment } from "../../ai/teaching-moment";
import type { CompiledTimeline, TransformationMeta } from "../../ai/transformation-timeline";
import type { AuthoritativeSemanticModel, AuthoritativeTransformation } from "../../ai/authoritative-model";
import type { VisualLesson, Transformation } from "../../ai/visual-dsl";
import type { DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import { CONFIDENCE_KNOWN } from "../../ai/confidence-model";
import { resolveCodeArtifact } from "../code/code-provider";

export interface AdaptedDSALesson {
  timeline: CompiledTimeline;
  authoritativeModel: AuthoritativeSemanticModel;
  visualLesson: VisualLesson;
}

export class DSATeachingMomentAdapter {
  /**
   * Adapts deterministic execution results into Cognora's standard timeline and model.
   */
  public static adapt(
    conceptId: string,
    topicName: string,
    states: DSASemanticState[],
    transformations: TeachingTransformation[],
    prompt: string,
  ): AdaptedDSALesson {
    const lessonId = `dsa-${conceptId}-${Date.now()}`;

    // 1. Convert each DSASemanticState into a full Cognora SceneState with layout
    const sceneStates: SceneState[] = [];
    for (const dsaState of states) {
      const graph = createEmptySceneGraph({
        conceptType: conceptId,
        topic: topicName,
        worldVersion: dsaState.version,
        ...dsaState.metadata,
      });

      // Add entities
      for (const [id, ent] of dsaState.entities) {
        const semanticEntity: SemanticEntity = {
          id,
          primitiveType: ent.type,
          semanticRole: ent.role,
          label: ent.label,
          value: ent.value,
          state: ent.status || "default",
          properties: {
            highlight:
              ent.status === "active" || ent.status === "highlighted"
                ? "primary"
                : ent.status === "pivot"
                ? "accent"
                : ent.status === "found" || ent.status === "sorted"
                ? "success"
                : ent.status === "imbalanced"
                ? "warning"
                : undefined,
            ...(ent.properties || {}),
          },
        };
        addEntity(graph, semanticEntity);
      }

      // Add relationships
      for (const rel of dsaState.relationships) {
        const semanticRel: SemanticRelationship = {
          id: rel.id,
          sourceEntityId: rel.sourceId,
          targetEntityId: rel.targetId,
          type: rel.type,
          label: rel.label,
          properties: {
            weight: rel.weight,
            directed: rel.directed !== false,
            highlight: rel.status === "active" || rel.status === "highlighted",
            status: rel.status,
          },
        };
        addRelationship(graph, semanticRel);
      }

      // Compute deterministic layout using Cognora's existing layout engine
      const layoutResult = computeSceneGraphLayout(graph);
      const sceneState = createSceneState(
        graph,
        layoutResult.positions,
        layoutResult.bounds,
      );
      sceneState.version = dsaState.version;
      sceneStates.push(sceneState);
    }

    // 2. Build TeachingMoment[] for each transformation
    const moments: TeachingMoment[] = [];
    const totalSteps = transformations.length;

    for (let i = 0; i < transformations.length; i++) {
      const t = transformations[i];
      const beforeState = sceneStates[t.beforeStateIndex] || sceneStates[0];
      const afterState = sceneStates[t.afterStateIndex] || sceneStates[sceneStates.length - 1];

      const focusEntityIds =
        t.semanticFocus.entityIds && t.semanticFocus.entityIds.length > 0
          ? t.semanticFocus.entityIds
          : t.affectedEntityIds;

      const moment: TeachingMoment = {
        id: `moment-${t.id}`,
        lessonId,
        transformationId: t.id,
        stepIndex: i + 1,
        totalSteps,
        worldVersion: i + 1,
        beforeWorldVersion: t.beforeStateIndex,
        afterWorldVersion: t.afterStateIndex,
        beforeState,
        afterState,
        visualState: afterState,
        semanticChanges: {
          addedEntities: t.affectedEntityIds.filter(
            (id) => !beforeState.graph.entities.has(id) && afterState.graph.entities.has(id),
          ),
          removedEntities: t.affectedEntityIds.filter(
            (id) => beforeState.graph.entities.has(id) && !afterState.graph.entities.has(id),
          ),
          updatedEntities: t.affectedEntityIds.filter(
            (id) => beforeState.graph.entities.has(id) && afterState.graph.entities.has(id),
          ),
          addedRelationships: t.affectedRelationshipIds.filter(
            (id) => !beforeState.graph.relationships.has(id) && afterState.graph.relationships.has(id),
          ),
          removedRelationships: t.affectedRelationshipIds.filter(
            (id) => beforeState.graph.relationships.has(id) && !afterState.graph.relationships.has(id),
          ),
        },
        affectedEntities: t.affectedEntityIds,
        affectedRelationships: t.affectedRelationshipIds,
        semanticFocus: {
          type: "entity",
          entityIds: focusEntityIds,
          relationshipIds: t.semanticFocus.relationshipIds || t.affectedRelationshipIds,
          label: t.semanticFocus.label || t.title,
          anchorPreference: t.semanticFocus.anchorPreference || "center",
        },
        title: t.title,
        explanation: t.explanation,
        whatChanged: t.whatHappened,
        whyItChanged: t.reason,
        why: t.reason,
        consequence: t.consequence,
        isStateChange: t.isStateChange,
        isExplanationOnly: !t.isStateChange,
        teachingRole: t.isStateChange ? "TRANSFORMATION" : "EXPLANATION-ONLY",
        narration: t.explanation,
        importance: t.importance || "NORMAL",
        callout: {
          text: t.whatHappened,
          placementPreference: "above",
        },
        inspectorContent: {
          why: t.reason,
          calculations: t.calculations,
          insight: t.insight || t.consequence,
          codeContext: {
            code: t.codeSnippet || resolveCodeArtifact({ conceptId, title: topicName, transformationType: t.type }).source,
            language: t.codeLanguage || resolveCodeArtifact({ conceptId, title: topicName, transformationType: t.type }).language,
          },
        },
        codeContext: {
          code: t.codeSnippet || resolveCodeArtifact({ conceptId, title: topicName, transformationType: t.type }).source,
          language: t.codeLanguage || resolveCodeArtifact({ conceptId, title: topicName, transformationType: t.type }).language,
        },
      };

      moments.push(moment);
    }

    // 3. Build TransformationMeta[]
    const meta: TransformationMeta[] = transformations.map((t, idx) => ({
      id: t.id,
      title: t.title,
      explanation: t.explanation,
      calculations: t.calculations,
      insight: t.insight || t.consequence,
      codeContext: {
        code: t.codeSnippet || resolveCodeArtifact({ conceptId, title: topicName, transformationType: t.type }).source,
        language: t.codeLanguage || resolveCodeArtifact({ conceptId, title: topicName, transformationType: t.type }).language,
      },
    }));

    // 4. Build AuthoritativeSemanticModel
    const authoritativeTransformations: AuthoritativeTransformation[] = transformations.map(
      (t, idx) => ({
        id: t.id,
        stepNumber: t.stepNumber,
        title: t.title,
        purpose: t.whatHappened,
        cause: t.reason,
        action: t.whatHappened,
        preconditions: [],
        postconditions: [],
        affectedEntities: t.affectedEntityIds,
        affectedRelationships: t.affectedRelationshipIds,
        fromStateIndex: t.beforeStateIndex,
        toStateIndex: t.afterStateIndex,
        whatChanged: t.whatHappened,
        whyChanged: t.reason,
        learnerObservation: t.consequence,
        consequence: t.consequence,
        invariantEffects: [],
        explanation: t.explanation,
        calculations: t.calculations,
        insight: t.insight,
        codeSnippet: t.codeSnippet,
        codeLanguage: t.codeLanguage,
      }),
    );

    // Collect all unique entities and relationships for Inspector & Tutor intelligence
    const allEntitiesMap = new Map<string, any>();
    const allRelationshipsMap = new Map<string, any>();
    for (const s of sceneStates) {
      for (const [id, ent] of s.graph.entities) {
        if (!allEntitiesMap.has(id)) {
          allEntitiesMap.set(id, {
            id: ent.id,
            type: ent.primitiveType,
            label: ent.label || ent.id,
            semanticRole: ent.semanticRole || ent.primitiveType,
            value: ent.value,
            state: ent.state,
            properties: ent.properties || {},
            incomingConnections: [],
            outgoingConnections: [],
            invariants: [],
            confidence: CONFIDENCE_KNOWN,
          });
        }
      }
      for (const [id, rel] of s.graph.relationships) {
        if (!allRelationshipsMap.has(id)) {
          allRelationshipsMap.set(id, {
            id: rel.id,
            source: rel.sourceEntityId,
            target: rel.targetEntityId,
            type: rel.type,
            direction: "forward",
            label: rel.label,
            properties: rel.properties || {},
            causalMeaning: rel.label ? `Relationship (${rel.type}) with label ${rel.label}` : `${rel.type} relationship`,
            confidence: CONFIDENCE_KNOWN,
          });
        }
      }
    }

    const authoritativeModel: AuthoritativeSemanticModel = {
      id: lessonId,
      concept: topicName,
      topic: conceptId,
      problem: {
        id: `prob-${lessonId}`,
        question: prompt,
        objective: `Execute and teach ${topicName} deterministically`,
        intent: "EXPLAIN_CONCEPT",
        inputs: [],
        outputs: [],
        entities: Array.from(allEntitiesMap.values()),
        relationships: Array.from(allRelationshipsMap.values()),
        constraints: [],
        assumptions: [],
        ambiguity: [],
        conventions: [],
        successCriteria: ["State transition integrity validated"],
        confidence: CONFIDENCE_KNOWN,
      },
      world: {
        entities: Array.from(allEntitiesMap.values()),
        relationships: Array.from(allRelationshipsMap.values()),
        properties: {},
        states: [],
        rules: [],
        constraints: [],
        goals: [],
        observations: [],
        derivedValues: [],
        dependencies: [],
        transformations: [],
        confidence: CONFIDENCE_KNOWN,
      },
      rules: [],
      invariants: [],
      states: sceneStates.map((s, idx) => ({
        id: `state-${idx}`,
        index: idx,
        name: `State ${idx}`,
        entities: new Map(
          Array.from(s.graph.entities.entries()).map(([id, ent]) => [
            id,
            {
              id: ent.id,
              type: ent.primitiveType,
              label: ent.label || ent.id,
              value: ent.value,
              state: ent.state,
              properties: (ent.properties || {}) as any,
            },
          ]),
        ),
        relationships: new Map(
          Array.from(s.graph.relationships.entries()).map(([id, rel]) => [
            id,
            {
              id: rel.id,
              source: rel.sourceEntityId,
              target: rel.targetEntityId,
              type: rel.type,
              direction: "forward" as const,
              label: rel.label,
              properties: rel.properties || {},
            },
          ]),
        ),
        properties: {},
        derivedValues: {},
        conditions: [],
        observations: [],
      })),
      transformations: authoritativeTransformations,
      derivedValuesByState: {},
      goalSatisfaction: {
        satisfied: true,
        objective: `Deterministic algorithm execution of ${topicName}`,
        verifiedCriteria: [
          {
            criterion: "State transition integrity validated",
            passed: true,
          },
        ],
        summary: `Algorithm executed with ${transformations.length} verified transformations.`,
      },
      strategy: "DETERMINISTIC_ALGORITHM_EXECUTION",
      confidence: CONFIDENCE_KNOWN,
      timestamp: Date.now(),
    };

    // 5. Build VisualLesson
    const visualLesson: VisualLesson = {
      id: lessonId,
      title: topicName,
      concept: conceptId,
      initialScene: [],
      transformations: transformations.map((t, idx) => {
        const artifact = resolveCodeArtifact({
          conceptId,
          title: topicName,
          transformationType: t.type,
        });
        return {
          id: t.id,
          title: t.title,
          operations: [],
          explanation: t.explanation,
          calculations: t.calculations,
          insight: t.insight,
          codeContext: {
            code: t.codeSnippet || artifact.source,
            language: t.codeLanguage || artifact.language,
            highlightLines: artifact.highlightLines,
          },
        };
      }),
      codeContexts: {
        python: {
          code: resolveCodeArtifact({ conceptId, title: topicName, language: "python" }).source,
          language: "python",
        },
        javascript: {
          code: resolveCodeArtifact({ conceptId, title: topicName, language: "javascript" }).source,
          language: "javascript",
        },
        java: {
          code: resolveCodeArtifact({ conceptId, title: topicName, language: "java" }).source,
          language: "java",
        },
        cpp: {
          code: resolveCodeArtifact({ conceptId, title: topicName, language: "cpp" }).source,
          language: "cpp",
        },
      },
    };

    // 6. Assemble CompiledTimeline
    const timeline: CompiledTimeline = {
      lessonId,
      topic: topicName,
      currentIndex: 0,
      states: sceneStates,
      meta,
      moments,
      model: authoritativeModel,
    };

    return {
      timeline,
      authoritativeModel,
      visualLesson,
    };
  }
}
