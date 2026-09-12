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
  const rawTimeline = compileVisualLesson(lesson);
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
  switch (op.type) {
    case "update": {
      const updateOp = op as UpdateOperation;
      const targetId = updateOp.target;
      const existing = graph.entities.get(targetId);
      if (existing) {
        updateEntity(graph, targetId, {
          label: updateOp.label ?? existing.label,
          value: updateOp.value ?? existing.value,
          properties: {
            highlight: updateOp.style?.color ?? existing.properties?.highlight,
          },
        });
      }
      break;
    }

    case "connect": {
      const connOp = op as ConnectOperation;
      const relId = connOp.id || `edge-${connOp.from}-${connOp.to}`;
      addRelationship(graph, {
        id: relId,
        type: connOp.role || "connects",
        sourceEntityId: connOp.from,
        targetEntityId: connOp.to,
        label: connOp.label,
        properties: {
          directed: connOp.direction !== "none",
          color: connOp.style?.color,
        },
      });
      break;
    }

    case "disconnect": {
      const disOp = op as DisconnectOperation;
      if (disOp.target) {
        graph.relationships.delete(disOp.target);
      } else if (disOp.from && disOp.to) {
        for (const [id, r] of graph.relationships.entries()) {
          if (r.sourceEntityId === disOp.from && r.targetEntityId === disOp.to) {
            graph.relationships.delete(id);
          }
        }
      }
      break;
    }

    case "highlight": {
      const target = graph.entities.get(op.target);
      if (target) {
        target.properties = {
          ...(target.properties || {}),
          highlight: op.color || op.emphasis || "accent",
        };
      }
      break;
    }

    case "unhighlight": {
      const target = graph.entities.get((op as UnhighlightOperation).target);
      if (target && target.properties) {
        delete target.properties.highlight;
      }
      break;
    }

    case "delete": {
      // If target matches a container (e.g. 'avl-tree'), remove all its children or relationships
      const targetId = op.target;
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
