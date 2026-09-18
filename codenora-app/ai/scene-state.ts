/**
 * Scene State Management
 *
 * Encapsulates complete, immutable semantic scene snapshots.
 * Every timeline step is represented by a complete SceneState.
 */

import {
  type SceneGraph,
  type SemanticEntity,
  type SemanticRelationship,
  type SemanticAnnotation,
  type SemanticEntityId,
  createEmptySceneGraph,
  cloneSceneGraph,
  addEntity,
  addRelationship,
} from "./scene-graph";

import type { LayoutPoint, LayoutBounds } from "./layout-engine";
import type {
  VisualAction,
  CreateTreeAction,
  CreateArrayAction,
  CreateGraphAction,
  CreateLinkedListAction,
  CreateStackAction,
  CreateBoxAction,
  CreateCircleAction,
  CreateTextAction,
  CreateArrowAction,
  AnnotatePointerAction,
} from "./visual-dsl";

export interface SceneState {
  /** The complete semantic graph of entities and relationships */
  graph: SceneGraph;
  /** Spatial layout positions assigned deterministically to each entity */
  layoutState?: Map<SemanticEntityId, LayoutPoint>;
  /** Overall bounding box of the visual scene */
  layoutBounds?: LayoutBounds;
  /** Timestamp / version index of this state */
  version?: number;
}

/**
 * Creates a new SceneState instance
 */
export function createSceneState(
  graph: SceneGraph,
  layoutState?: Map<SemanticEntityId, LayoutPoint>,
  layoutBounds?: LayoutBounds,
): SceneState {
  return {
    graph,
    layoutState: layoutState ? new Map(layoutState) : undefined,
    layoutBounds: layoutBounds ? { ...layoutBounds } : undefined,
  };
}

/**
 * Performs a deep clone of a SceneState ensuring absolute immutability
 */
export function cloneSceneState(state: SceneState): SceneState {
  return {
    graph: cloneSceneGraph(state.graph),
    layoutState: state.layoutState ? new Map(state.layoutState) : undefined,
    layoutBounds: state.layoutBounds ? { ...state.layoutBounds } : undefined,
    version: state.version,
  };
}

/**
 * Normalizes an entity ID so semantic references remain stable whether prefixed or bare
 */
export function normalizeEntityId(containerId: string, nodeId: string): string {
  if (nodeId.startsWith(`${containerId}-`)) {
    return nodeId;
  }
  return `${containerId}-${nodeId}`;
}

/**
 * Compiles legacy or action-based VisualAction[] into a canonical SceneGraph
 */
export function createSceneGraphFromActions(
  actions: readonly VisualAction[],
  metadata?: SceneGraph["metadata"],
): SceneGraph {
  const graph = createEmptySceneGraph(metadata);

  for (const action of actions) {
    switch ((action as any).type) {
      case "create_tree": {
        const tree = action as CreateTreeAction;
        const treeId = tree.id || "tree";
        graph.metadata = {
          ...(graph.metadata || {}),
          conceptType: "tree",
          rootEntityId: normalizeEntityId(treeId, tree.root),
        };

        for (const node of tree.nodes) {
          const entityId = normalizeEntityId(treeId, node.id);
          const entity: SemanticEntity = {
            id: entityId,
            primitiveType: "TreeNode",
            semanticRole: node.id === tree.root ? "root" : "tree-node",
            value: node.value,
            label: String(node.value),
            properties: {
              rawId: node.id,
              treeId,
              highlight: node.highlight,
              left: node.left
                ? normalizeEntityId(treeId, node.left)
                : undefined,
              right: node.right
                ? normalizeEntityId(treeId, node.right)
                : undefined,
              children: node.children
                ? node.children.map((c) => normalizeEntityId(treeId, c))
                : undefined,
            },
          };
          addEntity(graph, entity);
        }

        // Establish first-class relationships for tree edges
        for (const node of tree.nodes) {
          const fromId = normalizeEntityId(treeId, node.id);
          if (node.left) {
            const toId = normalizeEntityId(treeId, node.left);
            addRelationship(graph, {
              id: `edge-${fromId}-${toId}`,
              type: "leftOf",
              sourceEntityId: fromId,
              targetEntityId: toId,
              properties: { directed: true },
            });
          }
          if (node.right) {
            const toId = normalizeEntityId(treeId, node.right);
            addRelationship(graph, {
              id: `edge-${fromId}-${toId}`,
              type: "rightOf",
              sourceEntityId: fromId,
              targetEntityId: toId,
              properties: { directed: true },
            });
          }
          if (node.children) {
            for (const child of node.children) {
              const toId = normalizeEntityId(treeId, child);
              addRelationship(graph, {
                id: `edge-${fromId}-${toId}`,
                type: "parentOf",
                sourceEntityId: fromId,
                targetEntityId: toId,
                properties: { directed: true },
              });
            }
          }
        }
        break;
      }

      case "create_array": {
        const arr = action as CreateArrayAction;
        const arrId = arr.id || "array";
        graph.metadata = {
          ...(graph.metadata || {}),
          conceptType: "array",
          title: arr.label,
        };

        for (let i = 0; i < arr.elements.length; i++) {
          const el = arr.elements[i];
          const cellId = `${arrId}-${i}`;
          addEntity(graph, {
            id: cellId,
            primitiveType: "ArrayCell",
            semanticRole: "array-element",
            value: el.value,
            label: String(el.value),
            properties: {
              index: i,
              containerId: arrId,
              highlight: el.highlight,
              arrayTitle: arr.label,
            },
          });
        }
        break;
      }

      case "create_graph": {
        const g = action as CreateGraphAction;
        const graphId = g.id || "graph";
        graph.metadata = {
          ...(graph.metadata || {}),
          conceptType: "graph",
          title: g.label,
        };

        for (const node of g.nodes) {
          const nodeId = normalizeEntityId(graphId, node.id);
          addEntity(graph, {
            id: nodeId,
            primitiveType: "GraphNode",
            semanticRole: "graph-node",
            value: node.value ?? node.label,
            label: node.label,
            properties: {
              rawId: node.id,
              graphId,
              highlight: node.highlight,
              value: node.value,
            },
          });
        }

        for (const edge of g.edges) {
          const fromId = normalizeEntityId(graphId, edge.from);
          const toId = normalizeEntityId(graphId, edge.to);
          addRelationship(graph, {
            id: `edge-${fromId}-${toId}`,
            type: edge.directed ? "sendsTo" : "connects",
            sourceEntityId: fromId,
            targetEntityId: toId,
            label:
              edge.label ||
              (edge.weight != null ? String(edge.weight) : undefined),
            properties: {
              directed: edge.directed ?? g.directed ?? true,
              weight: edge.weight,
              highlight: edge.highlight,
            },
          });
        }
        break;
      }

      case "create_linked_list": {
        const list = action as CreateLinkedListAction;
        const listId = list.id || "list";
        graph.metadata = {
          ...(graph.metadata || {}),
          conceptType: "linked_list",
          title: list.label,
        };

        let prevId: string | null = null;
        for (let i = 0; i < list.elements.length; i++) {
          const el = list.elements[i];
          const rawId = (el as any).id;
          const nodeId = `${listId}-${i}`;
          const entData = {
            id: nodeId,
            primitiveType: "LinkedListNode" as const,
            semanticRole: i === 0 ? ("head" as const) : ("list-node" as const),
            value: el.value,
            label: String(el.value),
            properties: {
              index: i,
              containerId: listId,
              rawId,
              highlight: el.highlight,
            },
          };
          addEntity(graph, entData);

          if (rawId) {
            const aliasId = `${listId}-${rawId}`;
            if (aliasId !== nodeId && !graph.entities.has(aliasId)) {
              addEntity(graph, {
                ...entData,
                id: aliasId,
                properties: {
                  ...entData.properties,
                  isAliasOf: nodeId,
                },
              });
            }
          }

          if (prevId) {
            addRelationship(graph, {
              id: `edge-${prevId}-${nodeId}`,
              type: "next",
              sourceEntityId: prevId,
              targetEntityId: nodeId,
              properties: { directed: true },
            });
            if (list.variant === "doubly") {
              addRelationship(graph, {
                id: `edge-${nodeId}-${prevId}`,
                type: "previous",
                sourceEntityId: nodeId,
                targetEntityId: prevId,
                properties: { directed: true },
              });
            }
          }
          prevId = nodeId;
        }
        break;
      }

      case "create_stack": {
        const stack = action as CreateStackAction;
        const stackId = stack.id || "stack";
        graph.metadata = {
          ...(graph.metadata || {}),
          conceptType: "stack",
          title: stack.label,
        };

        for (let i = 0; i < stack.elements.length; i++) {
          const el = stack.elements[i];
          const frameId = `${stackId}-${i}`;
          addEntity(graph, {
            id: frameId,
            primitiveType: "StackFrame",
            semanticRole: i === 0 ? "top" : "stack-element",
            value: el.value,
            label: String(el.value),
            properties: {
              index: i,
              containerId: stackId,
              highlight: el.highlight,
            },
          });
        }
        break;
      }

      case "create_box":
      case "create_circle": {
        const box = action as CreateBoxAction | CreateCircleAction;
        const entityId = box.id;
        const isCircle = action.type === "create_circle";
        addEntity(graph, {
          id: entityId,
          primitiveType: "GenericEntity",
          semanticRole: box.role || "entity",
          label: "label" in box ? box.label : undefined,
          properties: {
            shape: isCircle ? "ellipse" : "rectangle",
            color: box.style?.color,
            fill: box.style?.fill,
          },
        });
        break;
      }

      case "create_text": {
        const text = action as CreateTextAction;
        addEntity(graph, {
          id: text.id,
          primitiveType: "Annotation",
          semanticRole: text.role || "label",
          label: text.text,
          properties: {
            color: text.style?.color,
          },
        });
        break;
      }

      case "create_arrow":
      case "connect": {
        const arrow = action as any;
        const from = arrow.from || arrow.source || "";
        const to = arrow.to || arrow.target || "";
        addRelationship(graph, {
          id: arrow.id || `conn-${from}-${to}`,
          type: arrow.role || "connects",
          sourceEntityId: from,
          targetEntityId: to,
          label: arrow.label,
          properties: {
            directed: arrow.direction !== "none",
            color: arrow.style?.color,
            elbowed: arrow.style?.elbowed,
          },
        });
        break;
      }

      case "annotate_pointer": {
        const ptr = action as AnnotatePointerAction;
        graph.annotations.set(ptr.id, {
          id: ptr.id,
          targetEntityId: ptr.target,
          type: "pointer",
          text: ptr.label,
          placement: ptr.placement,
          color: ptr.color,
          properties: {
            offset: ptr.offset,
          },
        });
        break;
      }

      case "highlight": {
        // Apply highlight directly to the target entity in the graph
        const hl = action as any;
        const target = graph.entities.get(hl.target);
        if (target) {
          target.properties = {
            ...(target.properties || {}),
            highlight: hl.color || hl.emphasis || "accent",
          };
        }
        break;
      }
    }
  }

  return graph;
}
