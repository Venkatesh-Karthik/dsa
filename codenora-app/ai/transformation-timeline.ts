/**
 * Universal Transformation Timeline
 *
 * Compiles a VisualLesson into an authoritative sequence of complete SceneState
 * snapshots [State 0, State 1, ..., State N].
 *
 * Guarantees:
 * 1. Complete Scene States: Every timeline position has the entire scene graph.
 *    Previous and Next transitions always render the complete scene.
 * 2. Stable Identity: Nodes, cells, servers, and edges retain permanent IDs.
 * 3. 100% Local Playback: All navigation makes ZERO AI requests.
 * 4. Deterministic In-Place Diffing: Reconciles target states seamlessly onto Excalidraw.
 */

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  type SceneGraph,
  type SemanticEntity,
  type SemanticRelationship,
  cloneSceneGraph,
  addEntity,
  updateEntity,
  removeEntity,
  addRelationship,
} from "./scene-graph";

import {
  type SceneState,
  createSceneState,
  cloneSceneState,
  createSceneGraphFromActions,
  normalizeEntityId,
} from "./scene-state";

import { computeSceneGraphLayout } from "./layout-engine";
import { validateSceneVisualInvariants } from "./visual-validation";
import { reconcileSceneState } from "./scene-reconciler";
import {
  animateSceneTransition,
  cancelActiveSceneAnimation,
} from "./scene-animation";
import { focusOnElements } from "./ai-canvas";

import {
  validateTransformationTimeline,
  type TransformationValidationResult,
} from "./transformation-validator";

import { resolveSemanticGrammar } from "./visual-grammar/grammar-resolver";
import { extractVisualRequirements } from "./visual-requirements";
import { composeVisualScene } from "./scene-composer";
import { VisualEvidenceValidator } from "./visual-evidence-validator";
import {
  deriveSemanticAnimationPlan,
  type SemanticAnimationPlan,
} from "./scene-animation";
import { createConfidence } from "./confidence-model";
import {
  VisualReasoningEngine,
  type VisualReasoningPlan,
} from "./visual-reasoning";

import { TeachingMomentCompiler, type TeachingMoment } from "./teaching-moment";

import type { AuthoritativeSemanticModel } from "./authoritative-model";
import type {
  VisualLesson,
  Transformation,
  TransformationOperation,
  UpdateOperation,
  ConnectOperation,
  DisconnectOperation,
  UnhighlightOperation,
  CreateTreeAction,
  CodeContext,
} from "./visual-dsl";

export interface TransformationMeta {
  id: string;
  title: string;
  explanation: string;
  codeContext?: CodeContext;
  calculations?: string;
  insight?: string;
  animationPlan?: SemanticAnimationPlan;
  evidenceValidation?: any;
  visualStep?: any;
}

export interface CompiledTimeline {
  lessonId: string;
  topic?: string;
  states: SceneState[]; // Index 0 = initialScene, Index 1 = after T1, etc.
  meta: TransformationMeta[];
  moments?: TeachingMoment[];
  model?: AuthoritativeSemanticModel;
  currentIndex: number;
  milestones?: any[];
  visualPlan?: VisualReasoningPlan;
  hasFramedViewport?: boolean;
}

/**
 * Compiles a validated AuthoritativeSemanticModel directly into an immutable sequence
 * of complete SceneStates for local playback.
 * The canvas renders strictly what the authoritative semantic world has validated.
 */
export function compileAuthoritativeTimeline(
  model: AuthoritativeSemanticModel,
  options?: { prompt?: string; milestones?: any[] },
): CompiledTimeline {
  if (!model.world && model.states?.[0]) {
    model.world = {
      entities: Array.from(model.states[0].entities.values()),
      relationships: Array.from(model.states[0].relationships.values()),
      states: [],
    } as any;
  }
  const lessonId = model.id || "authoritative-lesson";
  const states: SceneState[] = [];
  const meta: TransformationMeta[] = [];
  let previousLayoutPositions:
    | Map<string, { x: number; y: number }>
    | undefined;
  let previousGraph: SceneGraph | null = null;

  // Plan visual teaching architecture via Universal Visual Reasoning Engine 5.0
  const visualPlan = VisualReasoningEngine.plan(model, options);

  for (let sIdx = 0; sIdx < model.states.length; sIdx++) {
    const semState = model.states[sIdx];
    // Compile authoritative SceneGraph for this state using the visual reasoning plan
    const graph = VisualReasoningEngine.compileSceneGraphForState(
      model,
      visualPlan,
      sIdx,
    );

    // Compute deterministic layout from graph topology
    const layout = computeSceneGraphLayout(
      graph,
      { x: 140, y: 120 },
      previousLayoutPositions,
    );

    // Pre-render visual invariants validation
    validateSceneVisualInvariants(graph, layout.positions, layout.bounds);

    states.push(createSceneState(graph, layout.positions, layout.bounds));
    previousLayoutPositions = layout.positions;

    // Project transformation metadata
    let stepTitle = "";
    let stepExplanation = "";
    let stepCalculations: string | undefined;
    let stepInsight: string | undefined;
    let stepCodeContext: CodeContext | undefined;
    const trans = sIdx > 0 ? model.transformations[sIdx - 1] : undefined;

    if (sIdx === 0) {
      stepTitle = semState.name || model.problem?.objective || "Initial State";
      stepExplanation =
        semState.description || "Initial state of the verified concept.";
    } else {
      stepTitle = trans?.title || semState.name || `Step ${sIdx}`;
      stepExplanation = trans?.explanation || semState.description || "";
      stepCalculations = trans?.calculations;
      stepInsight = trans?.insight;
      if (trans?.codeSnippet) {
        stepCodeContext = {
          code: trans.codeSnippet,
          language: trans.codeLanguage || "typescript",
        };
      }
    }

    // Semantic Animation Planning
    const animPlan = deriveSemanticAnimationPlan(
      previousGraph,
      graph,
      sIdx,
      trans,
    );

    // Visual Evidence Validation
    const evidenceReport = VisualEvidenceValidator.validateStepEvidence(
      model,
      graph,
      sIdx,
      stepExplanation,
    );

    const stepVisualPlan =
      sIdx > 0 && visualPlan.transformationPlan.steps[sIdx - 1]
        ? visualPlan.transformationPlan.steps[sIdx - 1]
        : undefined;

    meta.push({
      id: trans?.id || (sIdx === 0 ? "initial" : `t-${sIdx}`),
      title: stepTitle,
      explanation: stepExplanation,
      calculations: stepCalculations,
      insight: stepInsight,
      codeContext: stepCodeContext,
      animationPlan: animPlan,
      evidenceValidation: evidenceReport,
      visualStep: stepVisualPlan,
    });

    previousGraph = graph;
  }

  const moments = TeachingMomentCompiler.compile(model, states);

  return {
    lessonId,
    topic:
      (model.problem as any)?.concept ||
      model.problem?.question ||
      options?.prompt,
    states,
    meta,
    moments,
    model,
    currentIndex: 0,
    milestones: options?.milestones || model.transformations,
    visualPlan,
  };
}

/**
 * Compiles any VisualLesson into a sequence of complete canonical SceneStates.
 */
export function compileVisualLesson(lesson: VisualLesson): CompiledTimeline {
  const lessonId = lesson.id || "lesson";
  const states: SceneState[] = [];
  const meta: TransformationMeta[] = [];

  // 1. Compile initialScene into State 0
  const initialGraph = createSceneGraphFromActions(lesson.initialScene, {
    title: lesson.title,
    conceptType: lesson.concept || lesson.domain?.type,
  });

  const initialLayout = computeSceneGraphLayout(initialGraph, {
    x: 140,
    y: 120,
  });
  validateSceneVisualInvariants(
    initialGraph,
    initialLayout.positions,
    initialLayout.bounds,
  );
  states.push(
    createSceneState(
      initialGraph,
      initialLayout.positions,
      initialLayout.bounds,
    ),
  );

  // Initial step metadata
  meta.push({
    id: "initial",
    title: lesson.title,
    explanation:
      lesson.transformations?.[0]?.explanation ||
      "Initial state of the visual concept.",
    codeContext: Array.isArray(lesson.codeContexts)
      ? lesson.codeContexts[0]
      : lesson.codeContexts?.initial,
  });

  // 2. Progressively compile each transformation into a complete target SceneState
  let currentGraph = cloneSceneGraph(initialGraph);
  let previousLayoutPositions = initialLayout.positions;

  const transformations = lesson.transformations ?? [];

  for (let tIdx = 0; tIdx < transformations.length; tIdx++) {
    const t = transformations[tIdx];
    const nextGraph = cloneSceneGraph(currentGraph);

    // Apply transformation operations to the canonical graph
    const ops: TransformationOperation[] = [
      ...(t.operations ?? []),
      ...(t.visual_actions ?? []),
    ];

    for (const op of ops) {
      applyOperationToGraph(nextGraph, op);
    }

    // Compute layout for the new state with layout stability anchored to previous state
    const nextLayout = computeSceneGraphLayout(
      nextGraph,
      { x: 140, y: 120 },
      previousLayoutPositions,
    );

    validateSceneVisualInvariants(
      nextGraph,
      nextLayout.positions,
      nextLayout.bounds,
    );

    const nextState = createSceneState(
      nextGraph,
      nextLayout.positions,
      nextLayout.bounds,
    );
    states.push(nextState);

    meta.push({
      id: t.id || `t-${tIdx + 1}`,
      title: t.title || `Transformation ${tIdx + 1}`,
      explanation: t.explanation,
      codeContext:
        t.codeContext ??
        (Array.isArray(lesson.codeContexts)
          ? lesson.codeContexts[tIdx + 1]
          : lesson.codeContexts?.[t.id]),
      calculations: t.calculations,
      insight: t.insight,
    });

    currentGraph = nextGraph;
    previousLayoutPositions = nextLayout.positions;
  }

  const moments: TeachingMoment[] = states.map((st, i) => ({
    id: meta[i]?.id || `moment-${i}`,
    transformationId: meta[i]?.id || `t-${i}`,
    stepIndex: i,
    totalSteps: states.length,
    beforeState: i > 0 ? states[i - 1] : st,
    afterState: st,
    semanticChanges: {
      addedEntities: [],
      removedEntities: [],
      updatedEntities: [],
      addedRelationships: [],
      removedRelationships: [],
    },
    visualState: st,
    affectedEntities: Array.from(st.graph.entities.keys()),
    affectedRelationships: Array.from(st.graph.relationships.keys()),
    title: meta[i]?.title || (i === 0 ? "Initial State" : `Step ${i}`),
    explanation: meta[i]?.explanation || "",
    narration: meta[i]?.explanation || "",
    semanticFocus: {
      type: "region",
      entityIds: Array.from(st.graph.entities.keys()),
    },
    durationHint: 3000,
    importance: "NORMAL",
  }));

  return {
    lessonId,
    topic: lesson.topic || lesson.title,
    states,
    meta,
    moments,
    currentIndex: 0,
  };
}

/**
 * Compiles and semantically validates a VisualLesson before rendering.
 */
export function compileAndValidateVisualLesson(
  lesson: VisualLesson,
  options?: { prompt?: string; allowCycles?: boolean },
): {
  timeline: CompiledTimeline;
  validation: TransformationValidationResult;
} {
  const model = (lesson as any).authoritativeModel as
    | AuthoritativeSemanticModel
    | undefined;
  const rawTimeline = model
    ? compileAuthoritativeTimeline(model, {
        prompt: options?.prompt || lesson.topic || lesson.title,
      })
    : compileVisualLesson(lesson);

  const validation = validateTransformationTimeline(rawTimeline, {
    prompt: options?.prompt || lesson.topic || lesson.title,
    concept: lesson.concept,
    allowCycles: options?.allowCycles,
  });

  return {
    timeline: validation.timeline,
    validation,
  };
}

/**
 * Applies a single transformation operation directly to the canonical SceneGraph.
 * Enforces stable entity identities across updates and re-connections.
 */
function applyOperationToGraph(
  graph: SceneGraph,
  op: TransformationOperation,
): void {
  const anyOp = op as any;
  const opType = anyOp.type;

  switch (opType) {
    case "update":
    case "UPDATE_ENTITY": {
      const targetId = anyOp.target || anyOp.entityId;
      const existing = graph.entities.get(targetId);
      if (existing) {
        updateEntity(graph, targetId, {
          label: anyOp.label ?? anyOp.name ?? existing.label,
          value: anyOp.value ?? existing.value,
          properties: {
            ...(existing.properties || {}),
            ...(anyOp.properties || {}),
            highlight:
              anyOp.style?.color ??
              anyOp.properties?.highlight ??
              existing.properties?.highlight,
          },
        });
      }
      break;
    }

    case "ADD_ENTITY": {
      const ent = anyOp.entity;
      if (ent) {
        addEntity(graph, {
          id: ent.id,
          primitiveType: ent.type || "Box",
          semanticRole: ent.visualRole || ent.semanticRole || "generic",
          label: ent.label || ent.name || ent.id,
          value: ent.value,
          properties: ent.properties,
        });
      }
      break;
    }

    case "REMOVE_ENTITY": {
      const targetId = anyOp.target || anyOp.entityId;
      if (targetId) {
        removeEntity(graph, targetId);
      }
      break;
    }

    case "connect":
    case "create_arrow":
    case "ADD_RELATIONSHIP": {
      const rel = anyOp.relationship || anyOp;
      const from = rel.from || rel.sourceEntityId || rel.source;
      const to = rel.to || rel.targetEntityId || rel.target;
      const relId = rel.id || `edge-${from}-${to}`;
      addRelationship(graph, {
        id: relId,
        type: rel.role || rel.type || "connects",
        sourceEntityId: from,
        targetEntityId: to,
        label: rel.label,
        properties: {
          directed: rel.direction !== "none",
          color: rel.style?.color || rel.color,
          ...(rel.properties || {}),
        },
      });
      break;
    }

    case "disconnect":
    case "REMOVE_RELATIONSHIP": {
      const relId = anyOp.relationshipId || anyOp.target;
      if (relId) {
        graph.relationships.delete(relId);
      } else if (anyOp.from && anyOp.to) {
        for (const [id, r] of graph.relationships.entries()) {
          if (
            r.sourceEntityId === anyOp.from &&
            r.targetEntityId === anyOp.to
          ) {
            graph.relationships.delete(id);
          }
        }
      }
      break;
    }

    case "highlight":
    case "HIGHLIGHT": {
      const targetId = anyOp.target || anyOp.id || anyOp.entityId;
      const target = graph.entities.get(targetId);
      if (target) {
        target.properties = {
          ...(target.properties || {}),
          highlight:
            anyOp.color || anyOp.style?.color || anyOp.emphasis || "accent",
        };
      }
      break;
    }

    case "unhighlight":
    case "UNHIGHLIGHT": {
      const targetId = anyOp.target || anyOp.id || anyOp.entityId;
      const target = graph.entities.get(targetId);
      if (target && target.properties) {
        delete target.properties.highlight;
      }
      break;
    }

    case "delete": {
      // If target matches a container (e.g. 'avl-tree'), remove all its children or relationships
      const targetId = anyOp.target || anyOp.entityId;
      if (targetId) {
        if (graph.entities.has(targetId)) {
          removeEntity(graph, targetId);
        } else {
          // Check if target is a container ID prefix (e.g. 'avl-tree')
          for (const [id] of graph.entities.entries()) {
            if (id.startsWith(`${targetId}-`)) {
              removeEntity(graph, id);
            }
          }
        }
      }
      break;
    }

    case "create_tree": {
      // Intelligently merge/morph rotated or updated trees into existing entities!
      // This guarantees stable object identity: node 20 remains node 20, node 30 remains node 30!
      const tree = op as CreateTreeAction;
      const treeId = tree.id || "tree";

      graph.metadata = {
        ...(graph.metadata || {}),
        conceptType: "tree",
        rootEntityId: normalizeEntityId(treeId, tree.root),
      };

      // Clear existing tree hierarchy relationships to rebuild new topology
      for (const [relId, rel] of graph.relationships.entries()) {
        if (
          rel.type === "leftOf" ||
          rel.type === "rightOf" ||
          rel.type === "parentOf"
        ) {
          graph.relationships.delete(relId);
        }
      }

      // Update or add tree nodes while preserving IDs
      for (const node of tree.nodes) {
        const entityId = normalizeEntityId(treeId, node.id);
        const existing = graph.entities.get(entityId);

        const entityData: SemanticEntity = {
          id: entityId,
          primitiveType: "TreeNode",
          semanticRole: node.id === tree.root ? "root" : "tree-node",
          value: node.value,
          label: String(node.value),
          properties: {
            ...(existing?.properties || {}),
            rawId: node.id,
            treeId,
            highlight: node.highlight ?? existing?.properties?.highlight,
            left: node.left ? normalizeEntityId(treeId, node.left) : undefined,
            right: node.right
              ? normalizeEntityId(treeId, node.right)
              : undefined,
          },
        };

        addEntity(graph, entityData);

        // Reconnect edges
        if (node.left) {
          const leftId = normalizeEntityId(treeId, node.left);
          addRelationship(graph, {
            id: `edge-${entityId}-${leftId}`,
            type: "leftOf",
            sourceEntityId: entityId,
            targetEntityId: leftId,
            properties: { directed: true },
          });
        }
        if (node.right) {
          const rightId = normalizeEntityId(treeId, node.right);
          addRelationship(graph, {
            id: `edge-${entityId}-${rightId}`,
            type: "rightOf",
            sourceEntityId: entityId,
            targetEntityId: rightId,
            properties: { directed: true },
          });
        }
      }
      break;
    }

    default: {
      // For create_box, create_arrow, annotate_pointer, etc.
      if ("type" in op) {
        const subGraph = createSceneGraphFromActions([op as any]);
        for (const [id, ent] of subGraph.entities) {
          addEntity(graph, ent);
        }
        for (const [id, rel] of subGraph.relationships) {
          addRelationship(graph, rel);
        }
        for (const [id, ann] of subGraph.annotations) {
          graph.annotations.set(id, ann);
        }
      }
      break;
    }
  }
}

// ============================================================================
// Local Timeline Execution (Zero AI Requests)
// ============================================================================

export interface TimelineExecutionOptions {
  animate?: boolean;
  duration?: number;
  onComplete?: () => void;
}

/**
 * Renders a specified timeline step onto the Excalidraw canvas.
 * Guarantees that the complete target SceneState is rendered.
 */
export async function renderTimelineStep(
  excalidrawAPI: ExcalidrawImperativeAPI,
  timeline: CompiledTimeline,
  targetIndex: number,
  options?: TimelineExecutionOptions,
): Promise<void> {
  if (excalidrawAPI.isDestroyed) {
    return;
  }

  const clampedIndex = Math.max(
    0,
    Math.min(targetIndex, timeline.states.length - 1),
  );
  const targetState = timeline.states[clampedIndex];

  const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
  const reconcileRes = reconcileSceneState(
    targetState,
    currentElements,
    timeline.lessonId,
  );

  timeline.currentIndex = clampedIndex;

  // Camera Stability: Frame the scene on initial render, then keep the camera
  // completely stable during Next / Previous navigation without continuous recentering.
  const shouldFocus = !timeline.hasFramedViewport || clampedIndex === 0;

  if (options?.animate) {
    await animateSceneTransition(excalidrawAPI, reconcileRes.elements, {
      duration: options.duration ?? 380,
      onComplete: () => {
        if (shouldFocus) {
          focusOnActiveElements(excalidrawAPI, timeline.lessonId);
          timeline.hasFramedViewport = true;
        }
        options.onComplete?.();
      },
    });
  } else {
    cancelActiveSceneAnimation();
    excalidrawAPI.updateScene({
      elements: reconcileRes.elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    if (shouldFocus) {
      focusOnActiveElements(excalidrawAPI, timeline.lessonId);
      timeline.hasFramedViewport = true;
    }
    options?.onComplete?.();
  }
}

function focusOnActiveElements(
  excalidrawAPI: ExcalidrawImperativeAPI,
  lessonId: string,
): void {
  const visible = excalidrawAPI
    .getSceneElementsIncludingDeleted()
    .filter(
      (el) =>
        !el.isDeleted &&
        el.customData?.isAiTeaching &&
        el.customData?.lessonId === lessonId,
    );
  if (visible.length > 0) {
    focusOnElements(excalidrawAPI, visible);
  }
}
