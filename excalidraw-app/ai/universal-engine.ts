/**
 * Universal Concept Intelligence Engine (Root Layer)
 *
 * Coordinates the entire domain-agnostic semantic pipeline:
 * QUESTION
 * ↓ UNDERSTAND
 * ↓ FORMALIZE
 * ↓ MODEL
 * ↓ INVARIANTS & RULES
 * ↓ SOLVE
 * ↓ VERIFY (CorrectnessEngine & SemanticRepair)
 * ↓ AUTHORITATIVE SEMANTIC MODEL
 * ↓ EXPLAIN
 * ↓ VISUALIZE (GenericConceptGrammar fallback / VisualLesson)
 * ↓ LOCAL PLAYBACK & ADAPTATION
 */

import {
  understandQuestion,
  type QuestionUnderstandingResult,
} from "./question-understanding";
import { formalizeProblem, type ProblemModel } from "./problem-model";
import { createConfidence } from "./confidence-model";
import {
  type SemanticWorld,
  type SemanticState,
  type Entity,
  type Relationship,
  type SemanticStateType,
  type SemanticDecision,
  type StatePersistence,
  createSemanticState,
} from "./semantic-world";
import { InvariantEngine, type Invariant, type Rule } from "./rules-invariants";
import { SolutionEngine } from "./solution-engine";
import { CorrectnessEngine, SemanticRepairEngine } from "./correctness-engine";
import {
  type AuthoritativeSemanticModel,
  type AuthoritativeTransformation,
  type JourneyType,
} from "./authoritative-model";
import {
  ExplanationEngine,
  type SemanticExplanation,
} from "./explanation-engine";
import { SemanticWorldGraph, WhyEngine } from "./world-graph";
import {
  CounterfactualEngine,
  type CounterfactualMutation,
  type CounterfactualResult,
} from "./counterfactual-engine";
import {
  ComparisonEngine,
  type SemanticComparisonReport,
} from "./comparison-engine";
import { VisualSemanticValidator } from "./visual-semantic-validator";
import {
  type VisualLesson,
  type VisualAction,
  type Transformation,
} from "./visual-dsl";
import {
  compileAuthoritativeTimeline,
  type CompiledTimeline,
} from "./transformation-timeline";
import type { VisualReasoningPlan } from "./visual-reasoning";
import { createSceneGraphFromActions } from "./scene-state";
import { ConceptualJourneyOptimizer } from "./conceptual-journey-optimizer";
import { resolveSemanticGrammar } from "./visual-grammar/grammar-resolver";
import {
  createTeachingBlueprint,
  detectCoreMechanism,
  type TeachingBlueprint,
} from "./teaching-planner";
import { TeachingQualityCritic } from "./quality-validator";

export class UniversalConceptIntelligenceEngine {
  /**
   * Universal teach method alias for processQuestion.
   */
  public static async teach(
    prompt: string,
    rawProposal?: Parameters<typeof UniversalConceptIntelligenceEngine.processQuestion>[1],
  ) {
    return this.processQuestion(prompt, rawProposal);
  }

  /**
   * Main entry point: Processes ANY educational question into an authoritative
   * validated semantic lesson with 100% local playback capabilities.
   */
  public static processQuestion(
    prompt: string,
    rawProposal?: {
      topic?: string;
      entities?: Entity[];
      relationships?: Relationship[];
      visual_actions?: VisualAction[];
      initialScene?: VisualAction[];
      initial_scene?: VisualAction[];
      visualLesson?: VisualLesson;
      visual_lesson?: VisualLesson;
      steps?: Array<{
        title: string;
        explanation: string;
        visual_actions?: VisualAction[];
        operations?: any[];
        calculations?: string;
        insight?: string;
        role?: string;
        conceptualRole?: string;
        [key: string]: any;
      }>;
      transformations?: any[];
      invariants?: Array<{
        statement?: string;
        description?: string;
        rule?: string;
      }>;
      misconceptions?: any[];
    },
  ): {
    authoritativeModel: AuthoritativeSemanticModel;
    visualLesson: VisualLesson;
    worldGraph: SemanticWorldGraph;
    timeline: CompiledTimeline;
    visualPlan?: VisualReasoningPlan;
  } {
    // 1. Understand the Question
    const understanding = understandQuestion(prompt);

    // 2. Formalize the Problem
    const candidateEntities: Entity[] = [...(rawProposal?.entities || [])];
    const candidateRelationships: Relationship[] = [
      ...(rawProposal?.relationships || []),
    ];

    // Identify all sources of initial visual actions
    const initialActions: VisualAction[] =
      rawProposal?.visual_actions ||
      (rawProposal as any)?.initialScene ||
      (rawProposal as any)?.initial_scene ||
      (rawProposal as any)?.visualLesson?.initialScene ||
      (rawProposal as any)?.visualLesson?.initial_scene ||
      (rawProposal as any)?.steps?.[0]?.visual_actions ||
      [];

    // If no explicit semantic entities were provided in raw proposal, extract them universally from visual actions
    if (candidateEntities.length === 0 && initialActions.length > 0) {
      const parsedGraph = createSceneGraphFromActions(initialActions);
      for (const ent of parsedGraph.entities.values()) {
        candidateEntities.push({
          id: ent.id,
          type: ent.primitiveType || "GenericEntity",
          label: ent.label || ent.id,
          properties: ent.properties as any,
          state: ent.state,
          value: ent.value,
          semanticRole: ent.semanticRole || "component",
        });
      }
      for (const rel of parsedGraph.relationships.values()) {
        candidateRelationships.push({
          id: rel.id,
          source: rel.sourceEntityId,
          target: rel.targetEntityId,
          type: rel.type || "connects",
          direction: rel.properties?.directed !== false ? "forward" : "none",
          label: rel.label,
          properties: rel.properties || {},
        });
      }

      // Define composite container action types that should not be extracted as visual node entities
      const CONTAINER_ACTION_TYPES = new Set([
        "create_tree",
        "create_graph",
        "create_array",
        "create_linked_list",
        "create_stack",
        "create_queue",
        "create_matrix",
        "create_container",
        "create_system",
        "create_timeline",
      ]);

      // Universal fallback for any action with an id not captured by scene graph
      for (const act of initialActions) {
        if ("id" in act && typeof (act as any).id === "string") {
          const actType = (act as any).type;
          if (CONTAINER_ACTION_TYPES.has(actType)) {
            // Composite container definitions are structural layouts, not individual shape primitives
            continue;
          }
          const actId = (act as any).id;
          if (!candidateEntities.some((e) => e.id === actId)) {
            const label =
              ("label" in act && typeof (act as any).label === "string"
                ? (act as any).label
                : "text" in act && typeof (act as any).text === "string"
                ? (act as any).text
                : actId) || actId;
            candidateEntities.push({
              id: actId,
              type: act.type.replace("create_", ""),
              label,
              properties: (act as any).style || {},
              semanticRole: (act as any).role || "component",
            });
          }
        }
      }
    }

    // Collect all container IDs to prevent composite layout structures from leaking as visual entities
    const containerIds = new Set<string>();
    for (const act of initialActions) {
      if (
        (act as any).type &&
        (act as any).type.startsWith("create_") &&
        [
          "create_tree",
          "create_graph",
          "create_array",
          "create_linked_list",
          "create_stack",
          "create_queue",
          "create_matrix",
          "create_container",
          "create_system",
          "create_timeline",
        ].includes((act as any).type) &&
        "id" in act &&
        typeof (act as any).id === "string"
      ) {
        containerIds.add((act as any).id);
      }
    }

    const filteredEntities = candidateEntities.filter(
      (e) => !containerIds.has(e.id),
    );

    if (filteredEntities.length === 0) {
      const concepts =
        understanding.importantConcepts.length > 0
          ? understanding.importantConcepts
          : [understanding.concept || "Primary Concept", "Secondary Concept"];
      for (let i = 0; i < concepts.length; i++) {
        const cName = concepts[i];
        const cId = `ent-${i + 1}`;
        const entObj: Entity = {
          id: cId,
          type: "GenericEntity",
          label: cName,
          properties: {},
          semanticRole: i === 0 ? "root" : "component",
        };
        filteredEntities.push(entObj);
        candidateEntities.push(entObj);
        if (i > 0) {
          const relObj: Relationship = {
            id: `rel-${i}`,
            source: `ent-${i}`,
            target: cId,
            type: "relates_to",
            direction: "forward",
            label: "flows_to",
            properties: {},
          };
          candidateRelationships.push(relObj);
        }
      }
    }

    const problem = formalizeProblem(understanding, {
      entities: filteredEntities,
      relationships: candidateRelationships,
      objective: `Understand and verify ${understanding.concept}`,
    });

    // 3. Construct Semantic World
    const state0Entities = new Map<string, Entity>();
    filteredEntities.forEach((e) => state0Entities.set(e.id, { ...e }));
    const state0Rels = new Map<string, Relationship>();
    candidateRelationships.forEach((r) => state0Rels.set(r.id, { ...r }));

    let initialRootId: string | undefined;
    for (const ent of state0Entities.values()) {
      if (ent.semanticRole === "root") {
        initialRootId = ent.id;
        break;
      }
    }

    const initialSemanticState = createSemanticState(0, "state-0", {
      name: `${understanding.concept} Baseline`,
      description: "Initial state of the concept",
      entities: state0Entities,
      relationships: state0Rels,
      properties: { phase: "initial", rootEntityId: initialRootId },
    });

    // Helper to resolve entity by canonical ID or alias
    const findEntityInMap = (
      map: Map<string, Entity>,
      targetId: string,
    ): { entity: Entity; id: string } | undefined => {
      if (map.has(targetId)) {
        return { entity: map.get(targetId)!, id: targetId };
      }
      for (const [id, ent] of map.entries()) {
        if (
          ent.properties?.rawId === targetId ||
          ent.properties?.isAliasOf === targetId ||
          (ent.properties?.rawId &&
            targetId.endsWith(`-${ent.properties.rawId}`))
        ) {
          return { entity: ent, id };
        }
      }
      return undefined;
    };

    // Helper to compute quick semantic state fingerprint for state progression check
    const computeStateFingerprint = (st: SemanticState): string => {
      const entKeys = Array.from(st.entities.keys()).sort();
      const entFp = entKeys
        .map((k) => {
          const e = st.entities.get(k)!;
          return `${k}:${e.value}:${e.properties?.highlight || ""}:${
            e.label || ""
          }`;
        })
        .join("|");
      return `${entFp}#${st.relationships.size}`;
    };

    // Non-destructive step-to-state derivation engine
    const deriveStatesFromSteps = (
      stepsToExecute: any[],
    ): {
      states: SemanticState[];
      rawTransformations: AuthoritativeTransformation[];
    } => {
      const derivedStates: SemanticState[] = [initialSemanticState];
      const derivedTransformations: AuthoritativeTransformation[] = [];
      let currentState = initialSemanticState;

      for (let i = 0; i < stepsToExecute.length; i++) {
        const s = stepsToExecute[i];
        const nextIndex = i + 1;

        // Mutate state for step
        const nextEntities = new Map<string, Entity>();
        for (const [id, e] of currentState.entities.entries()) {
          nextEntities.set(id, { ...e, properties: { ...e.properties } });
        }
        const nextRels = new Map<string, Relationship>();
        for (const [id, r] of currentState.relationships.entries()) {
          nextRels.set(id, {
            ...r,
            properties: r.properties ? { ...r.properties } : undefined,
          });
        }

        // Mark affected entities from operations and visual actions
        const affectedEntities: string[] = [];

        // Combine operations and visual actions into a unified operational stream
        const allOperations = [
          ...(s.operations || []),
          ...(s.visual_actions || []),
        ];
        for (const op of allOperations) {
          if (!op || typeof op !== "object") {
            continue;
          }
          const opType = (op.type || "").toLowerCase();

          if (
            opType === "update" ||
            opType === "update_entity" ||
            opType === "update_node"
          ) {
            const tgt = op.target || op.entityId || op.id || (op as any).nodeId;
            const found = tgt ? findEntityInMap(nextEntities, tgt) : undefined;
            if (found) {
              const existing = found.entity;
              nextEntities.set(found.id, {
                ...existing,
                label: op.label ?? op.name ?? existing.label,
                value: op.value ?? existing.value,
                state: op.state ?? existing.state,
                properties: {
                  ...existing.properties,
                  ...(op.properties || {}),
                  color:
                    op.color ?? op.style?.color ?? existing.properties?.color,
                  highlight:
                    op.style?.color ??
                    op.properties?.highlight ??
                    op.highlight ??
                    existing.properties?.highlight,
                },
              });
              affectedEntities.push(found.id);
            }
          } else if (opType === "highlight") {
            const tgt = op.target || op.entityId || op.id;
            const found = tgt ? findEntityInMap(nextEntities, tgt) : undefined;
            if (found) {
              found.entity.properties.highlight =
                op.color || op.highlight || "accent";
              affectedEntities.push(found.id);
            }
          } else if (opType === "unhighlight") {
            const tgt = op.target || op.entityId || op.id;
            const found = tgt ? findEntityInMap(nextEntities, tgt) : undefined;
            if (found) {
              delete found.entity.properties.highlight;
              affectedEntities.push(found.id);
            }
          } else if (
            opType === "connect" ||
            opType === "connect_relation" ||
            opType === "connect_entities" ||
            opType === "create_arrow" ||
            opType === "create_edge"
          ) {
            const src = op.source || op.from;
            const tgt = op.target || op.to;
            if (src && tgt) {
              const relId =
                op.id ||
                `rel-${src}-${tgt}-${Math.random().toString(36).slice(2, 6)}`;
              nextRels.set(relId, {
                id: relId,
                source: src,
                target: tgt,
                type: op.relationType || op.role || op.type || "connects",
                direction:
                  op.direction === "none" || op.directed === false
                    ? "none"
                    : op.direction || "forward",
                label: op.label,
                properties: {
                  ...(op.properties || {}),
                  color: op.color || op.style?.color,
                  highlight: op.highlight,
                },
              });
              affectedEntities.push(src, tgt);
            }
          } else if (
            opType === "disconnect" ||
            opType === "disconnect_relation" ||
            opType === "disconnect_entities" ||
            opType === "delete_edge"
          ) {
            if (op.id) {
              nextRels.delete(op.id);
            } else if (op.source && op.target) {
              for (const [rid, r] of nextRels.entries()) {
                if (r.source === op.source && r.target === op.target) {
                  nextRels.delete(rid);
                }
              }
            }
          } else if (
            opType === "create_entity" ||
            opType === "add_entity" ||
            opType === "create_box" ||
            opType === "create_circle"
          ) {
            const entId = op.id || op.entity?.id;
            if (entId) {
              nextEntities.set(entId, {
                id: entId,
                type:
                  op.entityType ||
                  op.entity?.type ||
                  (opType === "create_circle"
                    ? "CircleEntity"
                    : "GenericEntity"),
                label: op.label || op.entity?.label || entId,
                value: op.value ?? op.entity?.value,
                properties:
                  op.properties || op.entity?.properties || op.style || {},
                semanticRole: op.role || op.semanticRole || "component",
              });
              affectedEntities.push(entId);
            }
          } else if (
            opType === "delete_entity" ||
            opType === "remove_entity" ||
            opType === "delete" ||
            opType === "delete_node"
          ) {
            // op.target takes precedence because op.id is the operation's own ID
            const entId = op.target || op.entityId || op.id;
            if (entId) {
              const toDelete = new Set<string>();
              if (nextEntities.has(entId)) {
                toDelete.add(entId);
              }
              for (const [id, ent] of nextEntities.entries()) {
                if (
                  id === entId ||
                  id.startsWith(`${entId}-`) ||
                  ent.properties?.containerId === entId ||
                  ent.properties?.listId === entId ||
                  ent.properties?.treeId === entId ||
                  ent.properties?.graphId === entId ||
                  ent.properties?.rawId === entId
                ) {
                  toDelete.add(id);
                }
              }
              for (const delId of toDelete) {
                nextEntities.delete(delId);
                for (const [rid, r] of nextRels.entries()) {
                  if (r.source === delId || r.target === delId) {
                    nextRels.delete(rid);
                  }
                }
                affectedEntities.push(delId);
              }
            }
          } else if (
            opType === "create_tree" &&
            Array.isArray((op as any).nodes)
          ) {
            const tree = op as any;
            const treeId = tree.id || "tree";
            const rootNodeId = tree.root
              ? tree.root.startsWith(`${treeId}-`)
                ? tree.root
                : `${treeId}-${tree.root}`
              : undefined;

            // Clear existing tree hierarchy relationships
            for (const [rid, r] of nextRels.entries()) {
              if (
                r.type === "leftOf" ||
                r.type === "rightOf" ||
                r.type === "parentOf" ||
                r.type === "left" ||
                r.type === "right"
              ) {
                nextRels.delete(rid);
              }
            }

            for (const node of tree.nodes) {
              const nodeId = node.id.startsWith(`${treeId}-`)
                ? node.id
                : `${treeId}-${node.id}`;
              const existing = nextEntities.get(nodeId);
              const isRoot = node.id === tree.root || nodeId === rootNodeId;
              nextEntities.set(nodeId, {
                id: nodeId,
                type: "TreeNode",
                label: String(node.value ?? node.id),
                value: node.value,
                semanticRole: isRoot ? "root" : "tree-node",
                properties: {
                  ...(existing?.properties || {}),
                  rawId: node.id,
                  treeId,
                  highlight: node.highlight ?? existing?.properties?.highlight,
                  left: node.left
                    ? node.left.startsWith(`${treeId}-`)
                      ? node.left
                      : `${treeId}-${node.left}`
                    : undefined,
                  right: node.right
                    ? node.right.startsWith(`${treeId}-`)
                      ? node.right
                      : `${treeId}-${node.right}`
                    : undefined,
                },
              });
              affectedEntities.push(nodeId);

              if (node.left) {
                const leftId = node.left.startsWith(`${treeId}-`)
                  ? node.left
                  : `${treeId}-${node.left}`;
                const relId = `rel-${nodeId}-${leftId}`;
                nextRels.set(relId, {
                  id: relId,
                  source: nodeId,
                  target: leftId,
                  type: "leftOf",
                  direction: "forward",
                  label: "L",
                  properties: { directed: true },
                });
              }

              if (node.right) {
                const rightId = node.right.startsWith(`${treeId}-`)
                  ? node.right
                  : `${treeId}-${node.right}`;
                const relId = `rel-${nodeId}-${rightId}`;
                nextRels.set(relId, {
                  id: relId,
                  source: nodeId,
                  target: rightId,
                  type: "rightOf",
                  direction: "forward",
                  label: "R",
                  properties: { directed: true },
                });
              }

              if (node.children && Array.isArray(node.children)) {
                for (const child of node.children) {
                  const childId = child.startsWith(`${treeId}-`)
                    ? child
                    : `${treeId}-${child}`;
                  const relId = `rel-${nodeId}-${childId}`;
                  nextRels.set(relId, {
                    id: relId,
                    source: nodeId,
                    target: childId,
                    type: "parentOf",
                    direction: "forward",
                    properties: { directed: true },
                  });
                }
              }
            }
          } else if (
            opType === "create_linked_list" &&
            Array.isArray((op as any).elements)
          ) {
            const list = op as any;
            const listId = list.id || "list";
            const isDoubly =
              list.variant === "doubly" ||
              list.doubly === true ||
              understanding.concept.toLowerCase().includes("doubl");

            let prevNodeId: string | null = null;
            for (let elIdx = 0; elIdx < list.elements.length; elIdx++) {
              const el = list.elements[elIdx];
              const rawId = el.id ? String(el.id) : undefined;
              const nodeId = `${listId}-${elIdx}`;
              const existing = nextEntities.get(nodeId);
              const entObj: Entity = {
                id: nodeId,
                type: "LinkedListNode",
                label: String(el.value ?? el.label ?? elIdx),
                value: el.value,
                semanticRole:
                  elIdx === 0
                    ? "head"
                    : elIdx === list.elements.length - 1
                    ? "tail"
                    : "list-node",
                properties: {
                  ...(existing?.properties || {}),
                  rawId,
                  listId,
                  containerId: listId,
                  index: elIdx,
                  variant: isDoubly ? "doubly" : "singly",
                  highlight: el.highlight ?? existing?.properties?.highlight,
                },
              };
              nextEntities.set(nodeId, entObj);
              affectedEntities.push(nodeId);

              if (rawId) {
                const aliasId = `${listId}-${rawId}`;
                if (aliasId !== nodeId && !nextEntities.has(aliasId)) {
                  nextEntities.set(aliasId, {
                    ...entObj,
                    id: aliasId,
                    properties: {
                      ...entObj.properties,
                      isAliasOf: nodeId,
                    },
                  });
                }
              }

              if (prevNodeId) {
                const relNext = `edge-${prevNodeId}-${nodeId}`;
                nextRels.set(relNext, {
                  id: relNext,
                  source: prevNodeId,
                  target: nodeId,
                  type: "next",
                  direction: "forward",
                  label: "next",
                  properties: { directed: true },
                });
                if (isDoubly) {
                  const relPrev = `edge-${nodeId}-${prevNodeId}`;
                  nextRels.set(relPrev, {
                    id: relPrev,
                    source: nodeId,
                    target: prevNodeId,
                    type: "previous",
                    direction: "forward",
                    label: "prev",
                    properties: { directed: true },
                  });
                }
              }
              prevNodeId = nodeId;
            }
          } else if (
            opType === "create_stack" &&
            Array.isArray((op as any).elements)
          ) {
            const stack = op as any;
            const stackId = stack.id || "stack";
            for (let elIdx = 0; elIdx < stack.elements.length; elIdx++) {
              const el = stack.elements[elIdx];
              const frameId = `${stackId}-${elIdx}`;
              const existing = nextEntities.get(frameId);
              nextEntities.set(frameId, {
                id: frameId,
                type: "StackFrame",
                label: String(el.value ?? elIdx),
                value: el.value,
                semanticRole:
                  elIdx === stack.elements.length - 1 ? "top" : "stack-frame",
                properties: {
                  ...(existing?.properties || {}),
                  index: elIdx,
                  containerId: stackId,
                  highlight: el.highlight ?? existing?.properties?.highlight,
                },
              });
              affectedEntities.push(frameId);
            }
          } else if (
            opType === "create_queue" &&
            Array.isArray((op as any).elements)
          ) {
            const queue = op as any;
            const queueId = queue.id || "queue";
            for (let elIdx = 0; elIdx < queue.elements.length; elIdx++) {
              const el = queue.elements[elIdx];
              const cellId = `${queueId}-${elIdx}`;
              const existing = nextEntities.get(cellId);
              nextEntities.set(cellId, {
                id: cellId,
                type: "QueueElement",
                label: String(el.value ?? elIdx),
                value: el.value,
                semanticRole:
                  elIdx === 0
                    ? "front"
                    : elIdx === queue.elements.length - 1
                    ? "back"
                    : "queue-element",
                properties: {
                  ...(existing?.properties || {}),
                  index: elIdx,
                  containerId: queueId,
                  highlight: el.highlight ?? existing?.properties?.highlight,
                },
              });
              affectedEntities.push(cellId);
            }
          } else if (
            opType === "create_array" &&
            Array.isArray((op as any).elements)
          ) {
            const arr = op as any;
            const arrId = arr.id || "array";
            for (let elIdx = 0; elIdx < arr.elements.length; elIdx++) {
              const el = arr.elements[elIdx];
              const cellId = `${arrId}-${elIdx}`;
              const existing = nextEntities.get(cellId);
              nextEntities.set(cellId, {
                id: cellId,
                type: "ArrayCell",
                label: String(el.value ?? elIdx),
                value: el.value,
                semanticRole: "array-element",
                properties: {
                  ...(existing?.properties || {}),
                  index: elIdx,
                  containerId: arrId,
                  highlight: el.highlight ?? existing?.properties?.highlight,
                },
              });
              affectedEntities.push(cellId);
            }
          } else if (
            opType === "create_graph" &&
            Array.isArray((op as any).nodes)
          ) {
            const g = op as any;
            const graphId = g.id || "graph";
            for (const node of g.nodes) {
              const nodeId = node.id.startsWith(`${graphId}-`)
                ? node.id
                : `${graphId}-${node.id}`;
              const existing = nextEntities.get(nodeId);
              nextEntities.set(nodeId, {
                id: nodeId,
                type: "GraphNode",
                label: node.label || String(node.value ?? node.id),
                value: node.value ?? node.label,
                semanticRole: "graph-node",
                properties: {
                  ...(existing?.properties || {}),
                  rawId: node.id,
                  graphId,
                  highlight: node.highlight ?? existing?.properties?.highlight,
                },
              });
              affectedEntities.push(nodeId);
            }
            if (Array.isArray(g.edges)) {
              for (const edge of g.edges) {
                const fromId = edge.from.startsWith(`${graphId}-`)
                  ? edge.from
                  : `${graphId}-${edge.from}`;
                const toId = edge.to.startsWith(`${graphId}-`)
                  ? edge.to
                  : `${graphId}-${edge.to}`;
                const relId = edge.id || `rel-${fromId}-${toId}`;
                nextRels.set(relId, {
                  id: relId,
                  source: fromId,
                  target: toId,
                  type: edge.label || "connects",
                  direction: edge.directed === false ? "none" : "forward",
                  label: edge.label,
                  properties: {
                    directed: edge.directed !== false,
                    weight: edge.weight,
                  },
                });
              }
            }
          }
        }

        let stepRootId: string | undefined;
        for (const ent of nextEntities.values()) {
          if (ent.semanticRole === "root") {
            stepRootId = ent.id;
            break;
          }
        }

        const sCorpus = `${s.title || ""} ${s.explanation || ""}`.toLowerCase();
        let stepStateType: SemanticStateType = s.stateType || "normal";
        if (
          s.conceptualRole === "decision" ||
          s.role === "decision" ||
          s.decision ||
          /\bdecision\b/i.test(s.title || "")
        ) {
          stepStateType = "decision";
        } else if (
          s.conceptualRole === "failure" ||
          /\b(fail|failed|failure|error|loss)\b/i.test(sCorpus)
        ) {
          stepStateType = "failure";
        } else if (
          s.conceptualRole === "recovery" ||
          /\b(rollback|rolled back|retry|retransmit|rebalance|compensat|restor)\b/i.test(
            sCorpus,
          )
        ) {
          stepStateType = "recovery";
        } else if (/\b(decision|condition|branch|whether)\b/i.test(sCorpus)) {
          stepStateType = "decision";
        } else if (nextIndex === activeSteps.length) {
          stepStateType = "terminal";
        } else {
          stepStateType = "intermediate";
        }

        let stepDecision: SemanticDecision | undefined = s.decision;
        if (!stepDecision && stepStateType === "decision") {
          stepDecision = {
            id: `dec-${nextIndex}`,
            title: s.title,
            condition: s.title || `Decision at step ${nextIndex}`,
            possibleOutcomes: [
              {
                id: "outcome-success",
                label: "Success Path",
                consequences: ["Normal progression commits"],
              },
              {
                id: "outcome-failure",
                label: "Alternative / Failure Path",
                consequences: ["Alternative branch or rollback recovery"],
              },
            ],
            selectedOutcomeId: "outcome-success",
            consequences: [s.explanation || "Condition evaluated"],
          };
        }

        const persistence: StatePersistence =
          s.persistence ||
          (stepStateType === "failure"
            ? "temporary"
            : stepStateType === "recovery"
            ? "restored"
            : nextIndex === activeSteps.length
            ? "permanent"
            : "temporary");

        let causalRole:
          | "causes"
          | "enables"
          | "requires"
          | "prevents"
          | "restores" = "causes";
        if (stepStateType === "recovery") {
          causalRole = "restores";
        } else if (/\benables?\b/i.test(sCorpus)) {
          causalRole = "enables";
        } else if (/\brequires?\b/i.test(sCorpus)) {
          causalRole = "requires";
        } else if (/\bprevents?\b/i.test(sCorpus)) {
          causalRole = "prevents";
        }

        const nextState = createSemanticState(nextIndex, `state-${nextIndex}`, {
          name: s.title || `Step ${nextIndex}`,
          description: s.explanation,
          entities: nextEntities,
          relationships: nextRels,
          properties: { step: nextIndex, rootEntityId: stepRootId },
          stateType: stepStateType,
          activeDecision: stepDecision,
          decisionOutcome: stepDecision?.selectedOutcomeId,
          persistence,
          isIntermediate:
            stepStateType === "intermediate" || stepStateType === "failure",
        });

        derivedStates.push(nextState);

        derivedTransformations.push({
          id: s.id || `t-${nextIndex}`,
          stepNumber: nextIndex,
          title: s.title || `Transition ${nextIndex}`,
          purpose: s.explanation || `Advance ${understanding.concept}`,
          cause: `Algorithmic rule execution in step ${nextIndex}`,
          action: s.explanation || s.title || "State mutation",
          preconditions: s.preconditions || [`State ${i} completed`],
          postconditions: s.postconditions || (s.title ? [s.title] : undefined),
          affectedEntities,
          affectedRelationships: [],
          fromStateIndex: i,
          toStateIndex: nextIndex,
          whatChanged:
            affectedEntities.length > 0
              ? `Entities updated: ${affectedEntities.join(", ")}`
              : s.title,
          whyChanged: s.explanation || "State transition required",
          learnerObservation: `Observe the transition to step ${nextIndex}`,
          consequence: "Preserves invariant integrity",
          invariantEffects: [],
          explanation: s.explanation || s.title,
          calculations: s.calculations,
          insight: s.insight,
          decision: stepDecision,
          selectedOutcome: stepDecision?.selectedOutcomeId,
          alternativeOutcomes: stepDecision?.possibleOutcomes.filter(
            (o) => o.id !== stepDecision.selectedOutcomeId,
          ),
          branchType:
            s.branchType ||
            (stepStateType === "failure"
              ? "failure"
              : stepStateType === "recovery"
              ? "recovery"
              : "primary"),
          stateType: stepStateType,
          persistence,
          causalRole,
        });

        currentState = nextState;
      }

      return {
        states: derivedStates,
        rawTransformations: derivedTransformations,
      };
    };

    // Extract raw steps from proposal
    let rawSteps =
      rawProposal?.steps ||
      rawProposal?.transformations ||
      (rawProposal as any)?.visualLesson?.transformations ||
      (rawProposal as any)?.visual_lesson?.transformations ||
      [];

    if (rawSteps.length === 0 && filteredEntities.length > 0) {
      const ent0 = filteredEntities[0];
      const ent1 = filteredEntities[1] || filteredEntities[0];
      rawSteps = [
        {
          title: `Initiate ${understanding.concept}`,
          explanation: `System transitions into active processing for ${understanding.concept}.`,
          operations: [
            { type: "update_entity", entityId: ent0.id, state: "active" },
          ],
        },
        {
          title: `Execute ${understanding.concept} Mechanism`,
          explanation: `Primary transformation connects and mutates state.`,
          operations: [
            { type: "update_entity", entityId: ent1.id, state: "success" },
          ],
        },
      ];
    }

    // Tier 1: Try optimizing raw steps into conceptual milestones
    let activeSteps: any[] = rawSteps;
    let usedOptimized = false;

    if (rawSteps.length > 0) {
      try {
        const candidateMilestones = ConceptualJourneyOptimizer.optimize({
          concept: understanding.concept,
          intent: understanding.userIntent || problem.intent,
          targetGoal: problem.objective,
          initialEntities: filteredEntities,
          initialRelationships: candidateRelationships,
          rawSteps,
        });

        const contractValidation =
          ConceptualJourneyOptimizer.validatePlanContract(
            candidateMilestones,
            rawSteps.length,
          );

        if (contractValidation.valid && candidateMilestones.length > 0) {
          activeSteps = candidateMilestones;
          usedOptimized = true;
        } else {
          console.warn(
            `[COGNORA][OPTIMIZER] Discarding invalid optimized plan (${
              contractValidation.reason || "invalid contract"
            }), falling back to raw plan.`,
          );
        }
      } catch (err) {
        console.warn(
          `[COGNORA][OPTIMIZER] Optimizer encountered error (${
            err instanceof Error ? err.message : String(err)
          }), falling back to raw plan.`,
        );
      }
    }

    // Tier 2: Derive states and validate execution
    let derived = deriveStatesFromSteps(activeSteps);
    let states = derived.states;
    let rawTransformations = derived.rawTransformations;

    // Check if optimized execution produced identical start and final states
    if (usedOptimized && states.length > 1) {
      const initialFp = computeStateFingerprint(states[0]);
      const finalFp = computeStateFingerprint(states[states.length - 1]);
      if (initialFp === finalFp) {
        console.warn(
          `[COGNORA][OPTIMIZER] Optimized execution produced identical initial and final state. Discarding optimized plan and falling back to raw plan.`,
        );
        usedOptimized = false;
        activeSteps = rawSteps;
        derived = deriveStatesFromSteps(rawSteps);
        states = derived.states;
        rawTransformations = derived.rawTransformations;
      }
    }

    const allWorldEntities = new Map<string, Entity>();
    for (const ent of candidateEntities) {
      allWorldEntities.set(ent.id, ent);
    }
    for (const st of states) {
      for (const ent of st.entities.values()) {
        if (!allWorldEntities.has(ent.id)) {
          allWorldEntities.set(ent.id, ent);
        }
      }
    }

    const allWorldRels = new Map<string, Relationship>();
    for (const rel of candidateRelationships) {
      allWorldRels.set(rel.id, rel);
    }
    for (const st of states) {
      for (const rel of st.relationships.values()) {
        if (!allWorldRels.has(rel.id)) {
          allWorldRels.set(rel.id, rel);
        }
      }
    }

    const world: SemanticWorld = {
      entities: Array.from(allWorldEntities.values()),
      relationships: candidateRelationships,
      properties: {},
      states,
      rules: [],
      constraints: problem.constraints,
      goals: [
        {
          id: "goal-main",
          description: problem.objective,
          targetCondition: "Final verified state",
        },
      ],
      observations: [],
      derivedValues: [],
      dependencies: [],
      transformations: rawTransformations,
      confidence: understanding.confidence,
    };

    // 4. Invariants
    const customInvariants: Invariant[] = (rawProposal?.invariants || []).map(
      (inv, idx) => ({
        id: `inv-custom-${idx + 1}`,
        statement:
          inv.statement || inv.rule || inv.description || "System Invariant",
        scope: "global",
        severity: "critical",
        source: "proposal",
      }),
    );

    const { model: authoritativeModel, report } =
      CorrectnessEngine.validateAndSynthesize(
        problem,
        world,
        rawTransformations,
        [],
        customInvariants,
      );

    const model: AuthoritativeSemanticModel = authoritativeModel ?? {
      id: `unverified-${problem.id}`,
      problem,
      world,
      rules: [],
      invariants: customInvariants,
      states: world.states,
      transformations: rawTransformations,
      derivedValuesByState: {},
      goalSatisfaction: {
        satisfied: false,
        objective: problem.objective,
        verifiedCriteria: [
          {
            criterion: problem.objective,
            passed: false,
            evidence: "Validation failed critical checks",
          },
        ],
        summary: "Validation failed critical checks",
      },
      strategy: problem.intent,
      confidence: createConfidence(
        0.2,
        "UNCERTAIN",
        "Rejected by correctness engine",
      ),
      timestamp: Date.now(),
    };

    // 5.5. Evaluate and auto-repair via TeachingQualityCritic (5.0)
    const criticReport = TeachingQualityCritic.evaluate(model, prompt);
    const activeModel = criticReport.repairedPlan || model;

    // 6. Build World Graph
    const worldGraph = SemanticWorldGraph.fromAuthoritativeModel(activeModel);

    // 7. Compile into canonical VisualLesson with attached authoritativeModel
    const visualLesson: VisualLesson = {
      id: activeModel.id,
      title: understanding.concept,
      concept: understanding.concept,
      topic: understanding.concept,
      initialScene:
        initialActions.length > 0
          ? initialActions
          : candidateEntities.map((e) => ({
              type: "create_box" as const,
              id: e.id,
              label: e.label,
              role: (e.semanticRole as any) || "component",
            })),
      transformations: activeModel.transformations.map((t, idx) => {
        const matchingStep = activeSteps[idx];
        return {
          id: t.id,
          title: t.title,
          explanation: t.explanation,
          visual_actions: matchingStep?.visual_actions,
          operations: matchingStep?.operations || [],
          calculations: t.calculations,
          insight: t.insight,
          highlights: t.affectedEntities,
        };
      }),
      capabilities: (() => {
        const resolved = resolveSemanticGrammar(
          world,
          understanding.concept,
          problem.intent,
        );
        const caps: string[] = ["explain", "analyze", "practice"];
        const hasCodeSnippet = activeModel.transformations.some(
          (t) => !!t.codeSnippet,
        );
        if (resolved.isCodeRelevant || hasCodeSnippet) {
          caps.push("code");
        }
        return caps;
      })(),
    };

    (visualLesson as any).authoritativeModel = activeModel;

    // Extract decisions and journey topology
    const allDecisions: SemanticDecision[] = [];
    let hasFailureBranch = false;
    let hasRecoveryBranch = false;
    let hasDecisionBranch = false;

    for (const t of activeModel.transformations) {
      if (t.decision) {
        allDecisions.push(t.decision);
        hasDecisionBranch = true;
      }
      if (t.branchType === "failure" || t.stateType === "failure") {
        hasFailureBranch = true;
      }
      if (t.branchType === "recovery" || t.stateType === "recovery") {
        hasRecoveryBranch = true;
      }
    }

    const journeyType: JourneyType = hasRecoveryBranch
      ? "recovery"
      : hasFailureBranch
      ? "failure"
      : hasDecisionBranch
      ? "branching"
      : "linear";

    activeModel.decisions = allDecisions;
    activeModel.journeyType = journeyType;

    // 8. Synthesize universal TeachingBlueprint (Internal Pedagogical Intelligence)
    const blueprint = createTeachingBlueprint({
      concept: understanding.concept,
      understanding,
      entities: Array.from(allWorldEntities.values()),
      relationships: candidateRelationships,
      states: activeModel.states,
      milestones: activeSteps,
      invariants: activeModel.invariants,
      decisions: allDecisions,
    });
    activeModel.blueprint = blueprint;

    // 9. Compile authoritative timeline directly from validated semantic model
    const timeline = compileAuthoritativeTimeline(activeModel, {
      prompt,
      milestones: activeSteps,
    });
    timeline.milestones = activeSteps;

    return {
      authoritativeModel: activeModel,
      visualLesson,
      worldGraph,
      timeline,
      visualPlan: timeline.visualPlan,
    };
  }

  /**
   * Local Semantic Entity Inspection (0 AI calls)
   */
  public static inspectEntity(
    entityId: string,
    model: AuthoritativeSemanticModel,
    stepIndex: number = 0,
  ) {
    const ent = model.world.entities.find((e) => e.id === entityId);
    if (!ent) {
      return null;
    }

    const currentState = model.states[stepIndex] || model.states[0];
    const stateEnt = currentState?.entities.get(entityId) || ent;

    // Outgoing & incoming connections
    const incoming = model.world.relationships.filter(
      (r) => r.target === entityId,
    );
    const outgoing = model.world.relationships.filter(
      (r) => r.source === entityId,
    );

    const relevantInvariants = model.invariants.filter(
      (inv) => inv.scope === "global" || inv.scope === entityId,
    );

    // Causal influences
    const currentTrans =
      stepIndex > 0 ? model.transformations[stepIndex - 1] : undefined;

    const causes = outgoing.map(
      (r) => r.causalMeaning || `${r.type} targeting ${r.target}`,
    );
    const effects = incoming.map(
      (r) => r.causalMeaning || `${r.type} initiated by ${r.source}`,
    );

    return {
      id: ent.id,
      label: ent.label,
      type: ent.type,
      role: ent.semanticRole,
      value: stateEnt.value,
      state: stateEnt.state,
      properties: stateEnt.properties,
      stateType: currentState.stateType || stateEnt.state || "normal",
      persistence: currentState.persistence || "permanent",
      currentTransformation: currentTrans?.title,
      causes,
      effects,
      incomingConnections: incoming.map((r) => ({
        from: r.source,
        type: r.type,
        category: r.category,
      })),
      outgoingConnections: outgoing.map((r) => ({
        to: r.target,
        type: r.type,
        category: r.category,
      })),
      invariants: relevantInvariants.map((i) => i.statement),
    };
  }

  /**
   * Local Semantic Relationship Inspection (0 AI calls)
   */
  public static inspectRelationship(
    relationshipId: string,
    model: AuthoritativeSemanticModel,
    stepIndex: number = 0,
  ) {
    const rel = model.world.relationships.find((r) => r.id === relationshipId);
    if (!rel) {
      return null;
    }

    const currentState = model.states[stepIndex] || model.states[0];
    const isActive = currentState?.relationships.has(relationshipId) ?? false;
    const sourceEnt = model.world.entities.find((e) => e.id === rel.source);
    const targetEnt = model.world.entities.find((e) => e.id === rel.target);

    const causalMeaning =
      rel.causalMeaning ||
      `${rel.type} relationship: '${sourceEnt?.label || rel.source}' -> '${
        targetEnt?.label || rel.target
      }'`;

    const whyExists = `Preserves semantic connectivity and data/control flow from '${
      sourceEnt?.label || rel.source
    }' to '${targetEnt?.label || rel.target}'.`;

    return {
      id: rel.id,
      source: rel.source,
      target: rel.target,
      sourceLabel: sourceEnt?.label || rel.source,
      targetLabel: targetEnt?.label || rel.target,
      type: rel.type,
      category: rel.category || "connected_to",
      causalMeaning,
      whyExists,
      isActive,
      properties: rel.properties || {},
    };
  }

  /**
   * Local "What Changed?" explanation derived from semantic diffs (0 AI calls)
   */
  public static getWhatChanged(
    stepIndex: number,
    model: AuthoritativeSemanticModel,
  ): SemanticExplanation | null {
    if (stepIndex <= 0 || stepIndex > model.transformations.length) {
      return null;
    }
    const t = model.transformations[stepIndex - 1];
    const fromState = model.states[t.fromStateIndex];
    const toState = model.states[t.toStateIndex];

    return ExplanationEngine.deriveExplanation(
      t,
      fromState,
      toState,
      model.invariants,
    );
  }

  /**
   * Local "Why?" causal path tracing (0 AI calls)
   */
  public static getWhy(stepIndex: number, model: AuthoritativeSemanticModel) {
    if (stepIndex <= 0 || stepIndex > model.transformations.length) {
      return null;
    }
    const t = model.transformations[stepIndex - 1];
    return WhyEngine.traceCausalReasoning(t, model);
  }

  /**
   * Local Counterfactual "What If?" evaluation (0 AI calls)
   */
  public static evaluateWhatIf(
    mutation: CounterfactualMutation,
    stepIndex: number,
    model: AuthoritativeSemanticModel,
  ): CounterfactualResult {
    const currentState = model.states[stepIndex] || model.states[0];
    return CounterfactualEngine.evaluateWhatIf(mutation, currentState, model);
  }

  /**
   * Local Interactive Practice Quiz derived from model invariants (0 AI calls)
   */
  public static getPracticeQuiz(
    stepIndex: number,
    model: AuthoritativeSemanticModel,
  ) {
    const inv = model.invariants[0];
    const question = `Which fundamental invariant must remain true throughout ${model.problem.objective}?`;
    const correctAnswer = inv
      ? inv.statement
      : "Every consecutive state transition must preserve identity of continuing entities.";

    const options = [
      correctAnswer,
      "Nodes must never change their states",
      "Pointers must always point in reverse order",
      "Operations must execute without checking constraints",
    ];

    return {
      question,
      options,
      correctIndex: 0,
      explanation: `Correct: "${correctAnswer}" is an essential correctness invariant of this concept.`,
    };
  }

  /**
   * Universal 6-Question Pedagogical Explanation
   * Answers What changed? Why? How? What caused it? What must now be true? What happens next?
   */
  public static getStructuredExplanation(
    stepIndex: number,
    model: AuthoritativeSemanticModel,
  ): {
    whatChanged: string;
    whyChanged: string;
    howItHappened: string;
    whatCausedIt: string;
    whatMustNowBeTrue: string;
    whatHappensNext: string;
  } | null {
    if (stepIndex <= 0 || stepIndex > model.transformations.length) {
      return null;
    }
    const t = model.transformations[stepIndex - 1];
    const isFinal = stepIndex === model.transformations.length;
    const nextTrans = !isFinal ? model.transformations[stepIndex] : undefined;

    return {
      whatChanged: t.whatChanged || t.title,
      whyChanged:
        t.whyChanged ||
        t.purpose ||
        "Preserve system invariant and advance learning goal.",
      howItHappened: t.action || t.explanation,
      whatCausedIt:
        t.cause ||
        (t.causalRole
          ? `Causal role: ${t.causalRole}`
          : "Deterministic progression event"),
      whatMustNowBeTrue:
        t.postconditions && t.postconditions.length > 0
          ? t.postconditions.join("; ")
          : `State index ${stepIndex} invariants and consistency criteria hold.`,
      whatHappensNext: nextTrans
        ? `Transitions to "${nextTrans.title}": ${nextTrans.purpose}`
        : "Final verified state reached. All invariants and objectives are satisfied.",
    };
  }

  /**
   * Dynamic Misconception Intelligence
   * Derives universal misconception patterns from model state persistence and decision topology.
   */
  public static getConceptMisconceptions(
    model: AuthoritativeSemanticModel,
  ): Array<{
    misconception: string;
    correction: string;
    whyConfusing: string;
  }> {
    const list: Array<{
      misconception: string;
      correction: string;
      whyConfusing: string;
    }> = [];

    // 1. Temporary vs permanent state
    const hasIntermediate = model.states.some(
      (s) => s.isIntermediate || s.persistence === "temporary",
    );
    if (hasIntermediate) {
      list.push({
        misconception:
          "Assuming in-flight or intermediate modifications are already permanent.",
        correction:
          "Intermediate states are uncommitted and subject to validation, compensation, or rollback.",
        whyConfusing:
          "Visual changes appear immediately on canvas, so learners often assume they are already permanently committed.",
      });
    }

    // 2. Decision and failure branch
    const hasDecisionsOrBranches =
      (model.decisions && model.decisions.length > 0) ||
      model.transformations.some(
        (t) =>
          t.decision !== undefined ||
          t.stateType === "decision" ||
          t.branchType === "failure" ||
          t.branchType === "recovery",
      ) ||
      model.states.some(
        (s) =>
          s.activeDecision !== undefined ||
          s.stateType === "decision" ||
          s.stateType === "failure",
      );
    if (hasDecisionsOrBranches) {
      list.push({
        misconception: "Assuming a process always succeeds unconditionally.",
        correction:
          "Condition evaluation determines discrete alternative outcomes including failure and recovery branches.",
        whyConfusing:
          "Happy-path bias leads learners to overlook preconditions and error handling branches.",
      });
    }

    // 3. Causality vs correlation
    list.push({
      misconception:
        "Assuming simultaneous visual movements mean independent uncaused actions.",
      correction:
        "Every state transition is causally driven by explicit triggers, message transmissions, or invariant enforcement.",
      whyConfusing:
        "Composite animations can obscure the underlying directional causal dependencies.",
    });

    return list;
  }
}
