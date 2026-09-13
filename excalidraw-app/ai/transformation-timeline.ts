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
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

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
import { reconcileSceneState } from "./scene-reconciler";
import { animateSceneTransition, cancelActiveSceneAnimation } from "./scene-animation";
import { focusOnElements } from "./ai-canvas";

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

import {
  validateTransformationTimeline,
  type TransformationValidationResult,
} from "./transformation-validator";
import type { AuthoritativeSemanticModel } from "./authoritative-model";

export interface TransformationMeta {
  id: string;
  title: string;
  explanation: string;
  codeContext?: CodeContext;
  calculations?: string;
  insight?: string;
}

export interface CompiledTimeline {
  lessonId: string;
  topic?: string;
  states: SceneState[]; // Index 0 = initialScene, Index 1 = after T1, etc.
  meta: TransformationMeta[];
  currentIndex: number;
}

/**
 * Compiles a validated AuthoritativeSemanticModel directly into an immutable sequence
 * of complete SceneStates for local playback.
 * The canvas renders strictly what the authoritative semantic world has validated.
 */
export function compileAuthoritativeTimeline(
  model: AuthoritativeSemanticModel,
  options?: { prompt?: string },
): CompiledTimeline {
  const lessonId = model.id || "authoritative-lesson";
  const states: SceneState[] = [];
  const meta: TransformationMeta[] = [];
  let previousLayoutPositions: Map<string, { x: number; y: number }> | undefined;

  const conceptType = (model.problem as any)?.concept || model.problem?.question || options?.prompt || "generic";

  for (let sIdx = 0; sIdx < model.states.length; sIdx++) {
    const semState = model.states[sIdx];
    const graph: SceneGraph = {
      entities: new Map(),
      relationships: new Map(),
      annotations: new Map(),
      metadata: {
        conceptType,
        title: semState.name || model.problem?.objective,
      },
    };

    // 1. Project Entities maintaining stable IDs
    for (const [id, ent] of semState.entities.entries()) {
      let primType = ent.type;
      const lowerType = ent.type.toLowerCase();
      if (lowerType.includes("tree")) primType = "TreeNode";
      else if (lowerType.includes("graph")) primType = "GraphNode";
      else if (lowerType.includes("array") || lowerType.includes("cell")) primType = "ArrayCell";
      else if (lowerType.includes("list") || lowerType.includes("link")) primType = "LinkedListNode";
      else if (lowerType.includes("stack") || lowerType.includes("frame")) primType = "StackFrame";
      else if (lowerType.includes("queue")) primType = "GenericEntity";

      graph.entities.set(id, {
        id: ent.id,
        primitiveType: primType,
        semanticRole: ent.semanticRole || "component",
        label: ent.label || ent.id,
        value: ent.value,
        state: ent.state,
        properties: {
          ...(ent.properties || {}),
          highlight: ent.properties?.highlight,
          color: ent.properties?.color,
        },
      });
    }

    // 2. Project Relationships maintaining stable IDs
    for (const [id, rel] of semState.relationships.entries()) {
      graph.relationships.set(id, {
        id: rel.id,
        sourceEntityId: rel.source,
        targetEntityId: rel.target,
        type: rel.type,
        label: rel.label,
        properties: {
          directed: rel.direction !== "none" && rel.direction !== "bidirectional",
          ...(rel.properties || {}),
          highlight: (rel.properties as any)?.highlight,
          color: (rel.properties as any)?.color,
        },
      });
    }

    // 3. Compute deterministic layout from graph topology
    const layout = computeSceneGraphLayout(
      graph,
      { x: 140, y: 120 },
      previousLayoutPositions,
    );

    states.push(createSceneState(graph, layout.positions, layout.bounds));
    previousLayoutPositions = layout.positions;

    // 4. Project transformation metadata
    if (sIdx === 0) {
      meta.push({
        id: "initial",
        title: semState.name || model.problem?.objective || "Initial State",
        explanation: semState.description || "Initial state of the verified concept.",
      });
    } else {
      const trans = model.transformations[sIdx - 1];
      meta.push({
        id: trans?.id || `t-${sIdx}`,
        title: trans?.title || semState.name || `Step ${sIdx}`,
        explanation: trans?.explanation || semState.description || "",
        calculations: trans?.calculations,
        insight: trans?.insight,
        codeContext: trans?.codeSnippet
          ? {
              code: trans.codeSnippet,
              language: trans.codeLanguage || "typescript",
            }
          : undefined,
      });
    }
  }

  return {
    lessonId,
    topic: (model.problem as any)?.concept || model.problem?.question || options?.prompt,
    states,
    meta,
    currentIndex: 0,
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

  const initialLayout = computeSceneGraphLayout(initialGraph, { x: 140, y: 120 });
  states.push(createSceneState(initialGraph, initialLayout.positions, initialLayout.bounds));

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

  return {
    lessonId,
    topic: lesson.topic || lesson.title,
    states,
    meta,
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
  const model = (lesson as any).authoritativeModel as AuthoritativeSemanticModel | undefined;
  const rawTimeline = model
    ? compileAuthoritativeTimeline(model, { prompt: options?.prompt || lesson.topic || lesson.title })
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
            highlight: anyOp.style?.color ?? anyOp.properties?.highlight ?? existing.properties?.highlight,
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
          if (r.sourceEntityId === anyOp.from && r.targetEntityId === anyOp.to) {
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
          highlight: anyOp.color || anyOp.style?.color || anyOp.emphasis || "accent",
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
            right: node.right ? normalizeEntityId(treeId, node.right) : undefined,
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

  const clampedIndex = Math.max(0, Math.min(targetIndex, timeline.states.length - 1));
  const targetState = timeline.states[clampedIndex];

  const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
  const reconcileRes = reconcileSceneState(
    targetState,
    currentElements,
    timeline.lessonId,
  );

  timeline.currentIndex = clampedIndex;

  if (options?.animate) {
    await animateSceneTransition(excalidrawAPI, reconcileRes.elements, {
      duration: options.duration ?? 380,
      onComplete: () => {
        focusOnActiveElements(excalidrawAPI, timeline.lessonId);
        options.onComplete?.();
      },
    });
  } else {
    cancelActiveSceneAnimation();
    excalidrawAPI.updateScene({
      elements: reconcileRes.elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    focusOnActiveElements(excalidrawAPI, timeline.lessonId);
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
