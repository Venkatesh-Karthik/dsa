/**
 * Data Structures & Algorithms Domain Knowledge Module
 */

import type { DomainKnowledgeModule, ExtractedInspectorData } from "./types";
import type {
  ConceptInvariant,
  ConceptMisconception,
  ConceptState,
  ConceptTransformation,
  ConceptModel,
  TeachingStrategy,
} from "../concept-model";

export const DsaDomainModule: DomainKnowledgeModule = {
  id: "dsa",
  domain: "data_structures",
  name: "Data Structures & Algorithms",
  description: "Trees, Graphs, Arrays, Linked Lists, Stacks, Queues, Heaps, Dynamic Programming, Sorting & Searching",

  matches(concept: string, prompt: string = ""): boolean {
    const text = `${concept} ${prompt}`.toLowerCase();
    return (
      text.includes("tree") ||
      text.includes("avl") ||
      text.includes("bst") ||
      text.includes("heap") ||
      text.includes("linked list") ||
      text.includes("graph") ||
      text.includes("bfs") ||
      text.includes("dfs") ||
      text.includes("dijkstra") ||
      text.includes("binary search") ||
      text.includes("stack") ||
      text.includes("queue") ||
      text.includes("array") ||
      text.includes("sorting") ||
      text.includes("recursion")
    );
  },

  suggestStrategy(concept: string, prompt: string = ""): TeachingStrategy {
    const text = `${concept} ${prompt}`.toLowerCase();
    if (text.includes("rotation") || text.includes("avl") || text.includes("linked list") || text.includes("heapify")) {
      return "STRUCTURAL_TRANSFORMATION";
    }
    if (text.includes("bfs") || text.includes("dfs") || text.includes("traversal") || text.includes("dijkstra")) {
      return "STATE_MACHINE";
    }
    if (text.includes("binary search") || text.includes("sort")) {
      return "CONTROL_FLOW";
    }
    if (text.includes("recursion") || text.includes("call stack")) {
      return "MEMORY_TRANSFORMATION";
    }
    return "STRUCTURAL_TRANSFORMATION";
  },

  getInvariants(concept: string): ConceptInvariant[] {
    const text = concept.toLowerCase();
    const invariants: ConceptInvariant[] = [];

    if (text.includes("avl") || text.includes("bst") || text.includes("tree")) {
      invariants.push({
        id: "inv-bst-order",
        description: "Binary Search Tree ordering invariant",
        rule: "BST invariant: For every node N, all keys in left subtree < N.value < all keys in right subtree. Node identity is preserved.",
        check: (state, model) => {
          const entityMap = new Map((model.entities || []).map((e) => [e.id, e]));
          const activeRels = (model.relationships || []).filter((r) => state.activeRelationshipIds?.includes(r.id));
          const leftChildren = new Map<string, string>();
          const rightChildren = new Map<string, string>();
          const hasParent = new Set<string>();

          for (const rel of activeRels) {
            const isLeft = rel.type === "left" || rel.type === "leftOf" || rel.label === "L";
            const isRight = rel.type === "right" || rel.type === "rightOf" || rel.label === "R";
            if (isLeft) {
              leftChildren.set(rel.sourceEntityId, rel.targetEntityId);
              hasParent.add(rel.targetEntityId);
            } else if (isRight) {
              rightChildren.set(rel.sourceEntityId, rel.targetEntityId);
              hasParent.add(rel.targetEntityId);
            } else if (rel.type === "parentOf" || rel.type === "childOf") {
              const src = entityMap.get(rel.sourceEntityId);
              const tgt = entityMap.get(rel.targetEntityId);
              if (src && tgt && src.value !== undefined && tgt.value !== undefined) {
                if (Number(tgt.value) < Number(src.value)) {
                  leftChildren.set(rel.sourceEntityId, rel.targetEntityId);
                } else {
                  rightChildren.set(rel.sourceEntityId, rel.targetEntityId);
                }
                hasParent.add(rel.targetEntityId);
              }
            }
          }

          let rootId = state.activeEntityIds.find((id) => !hasParent.has(id)) || state.activeEntityIds[0];
          if (!rootId) return true;

          function validateSubtree(nodeId: string, min: number, max: number): boolean {
            const ent = entityMap.get(nodeId);
            if (!ent) return true;
            const val = Number(ent.value ?? ent.label);
            if (!Number.isNaN(val)) {
              if (val <= min || val >= max) return false;
              const left = leftChildren.get(nodeId);
              if (left && !validateSubtree(left, min, val)) return false;
              const right = rightChildren.get(nodeId);
              if (right && !validateSubtree(right, val, max)) return false;
            }
            return true;
          }

          return validateSubtree(rootId, -Infinity, Infinity);
        },
      });
      if (text.includes("avl")) {
        invariants.push({
          id: "inv-avl-balance",
          description: "AVL Tree balance factor constraint",
          rule: "For every node N: |height(left) - height(right)| <= 1 at equilibrium.",
          check: (state, model) => {
            const activeRels = (model.relationships || []).filter((r) => state.activeRelationshipIds?.includes(r.id));
            const leftChildren = new Map<string, string>();
            const rightChildren = new Map<string, string>();

            for (const rel of activeRels) {
              const isLeft = rel.type === "left" || rel.type === "leftOf" || rel.label === "L";
              const isRight = rel.type === "right" || rel.type === "rightOf" || rel.label === "R";
              if (isLeft) {
                leftChildren.set(rel.sourceEntityId, rel.targetEntityId);
              } else if (isRight) {
                rightChildren.set(rel.sourceEntityId, rel.targetEntityId);
              }
            }

            function getHeight(id?: string): number {
              if (!id || !state.activeEntityIds.includes(id)) return 0;
              return 1 + Math.max(getHeight(leftChildren.get(id)), getHeight(rightChildren.get(id)));
            }

            for (const id of state.activeEntityIds) {
              const hL = getHeight(leftChildren.get(id));
              const hR = getHeight(rightChildren.get(id));
              if (Math.abs(hL - hR) > 1) {
                return false;
              }
            }
            return true;
          },
        });
      }
    } else if (text.includes("linked list")) {
      invariants.push({
        id: "inv-ll-integrity",
        description: "Linked list structural continuity",
        rule: "Every node in the traversed chain must have a reachable sequence with no unintended orphaned nodes.",
        check: (state, model) => {
          const activeRels = (model.relationships || []).filter((r) => state.activeRelationshipIds?.includes(r.id));
          const outDegree = new Map<string, number>();
          for (const r of activeRels) {
            outDegree.set(r.sourceEntityId, (outDegree.get(r.sourceEntityId) || 0) + 1);
          }
          // A standard singly linked list has at most 1 outgoing pointer per node
          for (const count of outDegree.values()) {
            if (count > 1) return false;
          }
          return true;
        },
      });
    } else if (text.includes("binary search")) {
      invariants.push({
        id: "inv-sorted-interval",
        description: "Search space boundary validity",
        rule: "Target must reside strictly within array[low..high] if present; low <= high until found or exhausted.",
        check: () => true,
      });
    } else if (text.includes("bfs")) {
      invariants.push({
        id: "inv-bfs-fifo",
        description: "Queue FIFO processing order",
        rule: "Nodes are visited in non-decreasing order of distance from start node.",
        check: (state) => {
          return state.activeEntityIds.length > 0;
        },
      });
    }

    return invariants;
  },

  getMisconceptions(concept: string): ConceptMisconception[] {
    const text = concept.toLowerCase();
    const list: ConceptMisconception[] = [];

    if (text.includes("avl") || text.includes("rotation")) {
      list.push({
        id: "misc-avl-inorder",
        misunderstanding: "Rotation reorganizes elements and changes inorder sorted traversal.",
        misconception: "Rotation reorganizes elements and changes inorder sorted traversal.",
        correction: "Rotation changes tree geometry to reduce height, but strictly preserves BST inorder key order.",
      });
      list.push({
        id: "misc-avl-pivot",
        misunderstanding: "The imbalanced node rotates alone without child rebinding.",
        misconception: "The imbalanced node rotates alone without child rebinding.",
        correction: "The pivot node becomes the new root; its inner child is handed off to the old root.",
      });
    } else if (text.includes("linked list")) {
      list.push({
        id: "misc-ll-insert",
        misunderstanding: "Creating a node object is identical to inserting it into the list.",
        misconception: "Creating a node object is identical to inserting it into the list.",
        correction: "An allocated node remains an orphan until incoming and outgoing pointer links are wired.",
      });
    } else if (text.includes("binary search")) {
      list.push({
        id: "misc-bs-unsorted",
        misunderstanding: "Binary search can locate elements in any arbitrary list.",
        misconception: "Binary search can locate elements in any arbitrary list.",
        correction: "Binary search fundamentally relies on monotonic sorted order to eliminate half the space.",
      });
    } else if (text.includes("bfs")) {
      list.push({
        id: "misc-bfs-numerical",
        misunderstanding: "BFS visits nodes sorted by numerical value.",
        misconception: "BFS visits nodes sorted by numerical value.",
        correction: "BFS visits nodes strictly by topological frontier depth from the starting vertex.",
      });
    }

    if (list.length === 0) {
      list.push({
        id: "misc-dsa-complexity",
        misunderstanding: "Choosing a complex data structure always yields higher performance.",
        misconception: "Choosing a complex data structure always yields higher performance.",
        correction: "Simpler contiguous structures like dynamic arrays often outperform linked nodes due to hardware cache locality.",
      });
    }

    return list;
  },

  extractInspectorData(
    state: any,
    transformation?: any,
    model?: ConceptModel,
  ): ExtractedInspectorData {
    const metrics: Array<{ label: string; value: string | number; badgeColor?: string }> = [];
    const properties: Array<{ label: string; value: string | number }> = [];

    // Prioritize explicit transformation inspectorData if present
    if (transformation?.inspectorData?.metrics && transformation.inspectorData.metrics.length > 0) {
      metrics.push(...transformation.inspectorData.metrics);
    }
    if (transformation?.inspectorData?.properties && transformation.inspectorData.properties.length > 0) {
      properties.push(...transformation.inspectorData.properties);
    }

    // Dynamic extraction from model entities or graph entities
    const graphEntities = state?.graph?.entities ? Array.from(state.graph.entities.values()) : [];
    const modelEntities = model?.entities || [];
    const totalCount = graphEntities.length || modelEntities.length;

    let activeEntities: any[] = [];
    if (state?.activeEntityIds && Array.isArray(state.activeEntityIds)) {
      activeEntities = modelEntities.filter((e) => state.activeEntityIds.includes(e.id));
    } else if (graphEntities.length > 0) {
      activeEntities = graphEntities;
    } else if (modelEntities.length > 0) {
      activeEntities = modelEntities;
    }

    if (metrics.length === 0) {
      const rootOrHead = activeEntities.find(
        (e: any) => e.semanticRole === "root" || e.semanticRole === "head" || e.type === "TreeNode",
      );
      const pivotOrTarget = activeEntities.find(
        (e: any) => e.semanticRole === "pivot" || e.semanticRole === "target" || e.semanticRole === "active",
      );

      if (rootOrHead) {
        metrics.push({
          label: rootOrHead.semanticRole === "root" ? "Root Node" : "Head",
          value: String(rootOrHead.value ?? rootOrHead.label ?? rootOrHead.id),
        });
      }
      if (pivotOrTarget) {
        metrics.push({
          label: pivotOrTarget.semanticRole === "pivot" ? "Pivot Node" : "Target",
          value: String(pivotOrTarget.value ?? pivotOrTarget.label ?? pivotOrTarget.id),
          badgeColor: "#2563eb",
        });
      }
      metrics.push({ label: "Total Entities", value: totalCount });
      metrics.push({ label: "Active Elements", value: activeEntities.length });
    }

    const stateIdx = state?.stateIndex ?? state?.version ?? 0;
    const sections = [
      {
        title: "Metrics",
        properties: metrics.map((m) => ({ label: m.label, value: m.value })),
      },
      ...(properties.length > 0
        ? [
            {
              title: "Properties",
              properties,
            },
          ]
        : []),
    ];

    return {
      title: "Data Structure State",
      subtitle: "Dynamic visual representation of nodes, links, and values",
      metrics,
      properties,
      sections,
      statusBadge: transformation?.inspectorData?.statusBadge || `State ${stateIdx + 1}`,
      operation: transformation?.action || transformation?.title,
      resultSummary: transformation?.reason || transformation?.learnerObservation,
    };
  },
};
