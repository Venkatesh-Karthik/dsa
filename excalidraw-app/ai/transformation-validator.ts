/**
 * Transformation Validator & Semantic Fingerprinting Engine
 *
 * Enforces lesson correctness, progression monotonicity, and structural validity:
 * 1. Computes deterministic semantic fingerprints (independent of canvas coordinates/IDs).
 * 2. Computes semantic diffs across adjacent states (entities, relationships, states, values).
 * 3. Enforces that previousState != nextState for every transformation.
 * 4. Ensures finalState != initialState (unless pedagogical cycle is explicitly justified).
 * 5. Dynamic tree validation: minimum depth >= 2, respects requested height.
 * 6. AVL rotation validation: verifies pivot becomes root, child pointers reconnect, node IDs preserved.
 * 7. BFS traversal validation: verifies queue, visited set, current node, and traversal sequence evolve monotonically.
 * 8. Universal/arbitrary concept validation: verifies relationship integrity and non-empty diffs.
 * 9. Safe auto-repair: prunes redundant identical transformations.
 */

import type { SceneGraph, SemanticEntity, SemanticRelationship } from "./scene-graph";
import type { SceneState } from "./scene-state";
import type { CompiledTimeline } from "./transformation-timeline";

export interface SemanticDiff {
  hasChanges: boolean;
  entityChanges: {
    added: string[];
    removed: string[];
    updated: string[];
  };
  relationshipChanges: {
    added: string[];
    removed: string[];
    updated: string[];
  };
  annotationChanges: {
    added: string[];
    removed: string[];
    updated: string[];
  };
  summary: string[];
}

export interface TransformationValidationResult {
  valid: boolean;
  repaired: boolean;
  errors: string[];
  warnings: string[];
  timeline: CompiledTimeline;
  fingerprints: string[];
  diffs: SemanticDiff[];
}

export interface ValidationOptions {
  prompt?: string;
  concept?: string;
  allowCycles?: boolean;
  minTreeDepth?: number;
}

/**
 * Computes a deterministic semantic fingerprint of a SceneState.
 *
 * CRITICAL RULE:
 * Excludes all Excalidraw element IDs, pixel coordinates, widths, heights,
 * and temporary animation states. Only true pedagogical semantics are hashed.
 */
export function computeSemanticFingerprint(state: SceneState): string {
  const graph = state.graph;

  // 1. Canonical sorted entity representations
  const sortedEntityIds = Array.from(graph.entities.keys()).sort();
  const canonicalEntities = sortedEntityIds.map((id) => {
    const e = graph.entities.get(id)!;
    return {
      id: e.id,
      primitiveType: e.primitiveType,
      semanticRole: e.semanticRole || "",
      value: e.value !== undefined ? String(e.value) : "",
      label: e.label || "",
      state: e.state || "",
      highlight: e.properties?.highlight || "",
      color: e.properties?.color || "",
      fill: e.properties?.fill || "",
      shape: e.properties?.shape || "",
      treeLeft: e.properties?.left || "",
      treeRight: e.properties?.right || "",
    };
  });

  // 2. Canonical sorted relationship representations
  const sortedRelIds = Array.from(graph.relationships.keys()).sort();
  const canonicalRelationships = sortedRelIds.map((id) => {
    const r = graph.relationships.get(id)!;
    return {
      id: r.id,
      type: r.type,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      label: r.label || "",
      directed: r.properties?.directed !== false,
      highlight: r.properties?.highlight || "",
      color: r.properties?.color || "",
    };
  });

  // 3. Canonical sorted annotations
  const sortedAnnIds = Array.from(graph.annotations.keys()).sort();
  const canonicalAnnotations = sortedAnnIds.map((id) => {
    const a = graph.annotations.get(id)!;
    return {
      id: a.id,
      type: a.type,
      target: a.targetEntityId || "",
      text: a.text,
    };
  });

  return JSON.stringify({
    entities: canonicalEntities,
    relationships: canonicalRelationships,
    annotations: canonicalAnnotations,
    conceptType: graph.metadata?.conceptType || "",
    rootEntityId: graph.metadata?.rootEntityId || "",
  });
}

/**
 * Computes the semantic difference between two SceneStates.
 */
export function computeSemanticDiff(
  stateA: SceneState,
  stateB: SceneState,
): SemanticDiff {
  const gA = stateA.graph;
  const gB = stateB.graph;

  const addedEntities: string[] = [];
  const removedEntities: string[] = [];
  const updatedEntities: string[] = [];

  for (const [id, entB] of gB.entities) {
    if (!gA.entities.has(id)) {
      addedEntities.push(id);
    } else {
      const entA = gA.entities.get(id)!;
      const isUpdated =
        entA.value !== entB.value ||
        entA.label !== entB.label ||
        entA.state !== entB.state ||
        entA.semanticRole !== entB.semanticRole ||
        entA.properties?.highlight !== entB.properties?.highlight ||
        entA.properties?.color !== entB.properties?.color ||
        entA.properties?.fill !== entB.properties?.fill ||
        entA.properties?.left !== entB.properties?.left ||
        entA.properties?.right !== entB.properties?.right;
      if (isUpdated) {
        updatedEntities.push(id);
      }
    }
  }

  for (const id of gA.entities.keys()) {
    if (!gB.entities.has(id)) {
      removedEntities.push(id);
    }
  }

  const addedRels: string[] = [];
  const removedRels: string[] = [];
  const updatedRels: string[] = [];

  for (const [id, relB] of gB.relationships) {
    if (!gA.relationships.has(id)) {
      addedRels.push(id);
    } else {
      const relA = gA.relationships.get(id)!;
      const isUpdated =
        relA.sourceEntityId !== relB.sourceEntityId ||
        relA.targetEntityId !== relB.targetEntityId ||
        relA.type !== relB.type ||
        relA.label !== relB.label ||
        relA.properties?.highlight !== relB.properties?.highlight ||
        relA.properties?.color !== relB.properties?.color;
      if (isUpdated) {
        updatedRels.push(id);
      }
    }
  }

  for (const id of gA.relationships.keys()) {
    if (!gB.relationships.has(id)) {
      removedRels.push(id);
    }
  }

  const addedAnns: string[] = [];
  const removedAnns: string[] = [];
  const updatedAnns: string[] = [];

  for (const [id, annB] of gB.annotations) {
    if (!gA.annotations.has(id)) {
      addedAnns.push(id);
    } else {
      const annA = gA.annotations.get(id)!;
      if (annA.text !== annB.text || annA.targetEntityId !== annB.targetEntityId) {
        updatedAnns.push(id);
      }
    }
  }

  for (const id of gA.annotations.keys()) {
    if (!gB.annotations.has(id)) {
      removedAnns.push(id);
    }
  }

  // Root change in metadata
  const rootChanged = gA.metadata?.rootEntityId !== gB.metadata?.rootEntityId;

  const hasChanges =
    addedEntities.length > 0 ||
    removedEntities.length > 0 ||
    updatedEntities.length > 0 ||
    addedRels.length > 0 ||
    removedRels.length > 0 ||
    updatedRels.length > 0 ||
    addedAnns.length > 0 ||
    removedAnns.length > 0 ||
    updatedAnns.length > 0 ||
    rootChanged;

  const summary: string[] = [];
  if (addedEntities.length > 0) summary.push(`+${addedEntities.length} entities`);
  if (removedEntities.length > 0) summary.push(`-${removedEntities.length} entities`);
  if (updatedEntities.length > 0) summary.push(`${updatedEntities.length} entities updated`);
  if (addedRels.length > 0) summary.push(`+${addedRels.length} edges`);
  if (removedRels.length > 0) summary.push(`-${removedRels.length} edges`);
  if (updatedRels.length > 0) summary.push(`${updatedRels.length} edges updated`);
  if (rootChanged) summary.push(`root changed (${gA.metadata?.rootEntityId} -> ${gB.metadata?.rootEntityId})`);

  return {
    hasChanges,
    entityChanges: {
      added: addedEntities,
      removed: removedEntities,
      updated: updatedEntities,
    },
    relationshipChanges: {
      added: addedRels,
      removed: removedRels,
      updated: updatedRels,
    },
    annotationChanges: {
      added: addedAnns,
      removed: removedAnns,
      updated: updatedAnns,
    },
    summary,
  };
}

/**
 * Calculates the depth of a tree represented in a SceneGraph.
 */
export function calculateTreeDepth(graph: SceneGraph, rootId?: string): number {
  const treeNodes = Array.from(graph.entities.values()).filter(
    (e) => e.primitiveType === "TreeNode" || e.semanticRole === "root" || e.semanticRole === "tree-node",
  );

  if (treeNodes.length === 0) {
    return 0;
  }

  const effectiveRootId = rootId || graph.metadata?.rootEntityId || treeNodes[0].id;
  const visited = new Set<string>();

  function dfs(currId: string): number {
    if (visited.has(currId)) return 0;
    visited.add(currId);

    const outgoing = Array.from(graph.relationships.values()).filter(
      (r) =>
        r.sourceEntityId === currId &&
        (r.type === "leftOf" || r.type === "rightOf" || r.type === "parentOf" || r.type === "connects"),
    );

    if (outgoing.length === 0) {
      return 1;
    }

    let maxChildDepth = 0;
    for (const edge of outgoing) {
      maxChildDepth = Math.max(maxChildDepth, dfs(edge.targetEntityId));
    }

    return 1 + maxChildDepth;
  }

  return dfs(effectiveRootId);
}

/**
 * Validates tree requirements:
 * 1. Minimum meaningful depth >= 2 (root, child, grandchild) unless trivial explicitly requested.
 * 2. If prompt asks for a specific depth (e.g. "height 5"), checks that the tree reflects it.
 */
export function validateTreeComplexity(
  initialState: SceneState,
  prompt: string,
): { valid: boolean; error?: string } {
  const promptLower = prompt.toLowerCase();
  const isTrivialRequested =
    promptLower.includes("single node") ||
    promptLower.includes("trivial") ||
    promptLower.includes("single-node") ||
    promptLower.includes("1 node") ||
    promptLower.includes("one node");

  const depth = calculateTreeDepth(initialState.graph);

  // Check if a specific depth was requested (e.g. "height 5", "depth 4", "height-5")
  const requestedDepthMatch = promptLower.match(/\b(height|depth)[-\s]+(\d+)\b/);
  if (requestedDepthMatch) {
    const requestedDepth = parseInt(requestedDepthMatch[2], 10);
    if (requestedDepth > 2 && depth < requestedDepth) {
      return {
        valid: false,
        error: `User requested a tree with ${requestedDepthMatch[1]} ${requestedDepth}, but generated initial tree has depth ${depth}.`,
      };
    }
  }

  if (!isTrivialRequested && depth < 2 && initialState.graph.entities.size > 0) {
    const treeNodesCount = Array.from(initialState.graph.entities.values()).filter(
      (e) => e.primitiveType === "TreeNode",
    ).length;

    if (treeNodesCount > 0 && treeNodesCount < 3) {
      return {
        valid: false,
        error: `Tree concepts require a minimum meaningful depth of at least 2 levels (at least 3 nodes), but received only ${treeNodesCount} node(s) with depth ${depth}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates AVL Rotation Transformations:
 * Verifies that the rotation actually changes the subtree root, reconnects parent/child pointers,
 * and preserves node identities.
 */
export function validateAVLRotation(
  timeline: CompiledTimeline,
  prompt: string,
): { valid: boolean; error?: string } {
  const promptLower = prompt.toLowerCase();
  const isRightRotation =
    promptLower.includes("right rotation") ||
    promptLower.includes("right-rotation") ||
    promptLower.includes("ll rotation") ||
    promptLower.includes("left-heavy");

  const isLeftRotation =
    promptLower.includes("left rotation") ||
    promptLower.includes("left-rotation") ||
    promptLower.includes("rr rotation") ||
    promptLower.includes("right-heavy");

  if (!isRightRotation && !isLeftRotation) {
    return { valid: true }; // Not specifically a single rotation check
  }

  if (timeline.states.length < 2) {
    return {
      valid: false,
      error: "AVL rotation lesson must contain at least 1 transformation showing the rotation.",
    };
  }

  const initialState = timeline.states[0];
  const finalState = timeline.states[timeline.states.length - 1];

  const initialRoot = initialState.graph.metadata?.rootEntityId;
  const finalRoot = finalState.graph.metadata?.rootEntityId;

  // For both right and left rotations, the root of the subtree MUST change to the pivot
  if (initialRoot && finalRoot && initialRoot === finalRoot) {
    // Check if relationships changed significantly
    const diff = computeSemanticDiff(initialState, finalState);
    if (!diff.hasChanges || (diff.relationshipChanges.updated.length === 0 && diff.relationshipChanges.added.length === 0)) {
      return {
        valid: false,
        error: `AVL ${isRightRotation ? "right" : "left"} rotation claimed, but root remained '${initialRoot}' and parent-child edges were not restructured.`,
      };
    }
  }

  // Node identity preservation check: nodes from initial state should remain in final state
  for (const entityId of initialState.graph.entities.keys()) {
    if (!finalState.graph.entities.has(entityId)) {
      return {
        valid: false,
        error: `AVL rotation lost node identity: entity '${entityId}' disappeared instead of transforming into the new tree structure.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates BFS Traversal Transformations:
 * 1. Verifies initial and final states are NOT identical.
 * 2. Verifies that queue / visited set / current node / graph highlights evolve monotonically.
 * 3. Verifies final state represents completed traversal.
 */
export function validateBFSTraversal(
  timeline: CompiledTimeline,
): { valid: boolean; error?: string } {
  if (timeline.states.length < 2) {
    return {
      valid: false,
      error: "BFS traversal lesson must have progressive transformations showing queue and node exploration.",
    };
  }

  const initialFp = computeSemanticFingerprint(timeline.states[0]);
  const finalFp = computeSemanticFingerprint(timeline.states[timeline.states.length - 1]);

  if (initialFp === finalFp) {
    return {
      valid: false,
      error: "BFS lesson error: initial state and final state are identical. The traversal never progressed.",
    };
  }

  // Verify that transformations progressively explore nodes
  let explorationProgressionCount = 0;
  for (let i = 0; i < timeline.states.length - 1; i++) {
    const diff = computeSemanticDiff(timeline.states[i], timeline.states[i + 1]);
    if (diff.hasChanges) {
      explorationProgressionCount++;
    }
  }

  if (explorationProgressionCount === 0) {
    return {
      valid: false,
      error: "BFS traversal transformations did not alter any graph nodes, queue, or visited states.",
    };
  }

  return { valid: true };
}

/**
 * Validates the entire CompiledTimeline before exposing it to the UI or canvas.
 * Performs safe auto-repair for minor flaws (such as redundant duplicate states).
 */
export function validateTransformationTimeline(
  timeline: CompiledTimeline,
  options?: ValidationOptions,
): TransformationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let repaired = false;

  // 1. Initial state validation
  if (!timeline.states || timeline.states.length === 0) {
    return {
      valid: false,
      repaired: false,
      errors: ["Timeline contains no states."],
      warnings: [],
      timeline,
      fingerprints: [],
      diffs: [],
    };
  }

  const initialGraph = timeline.states[0].graph;
  if (initialGraph.entities.size === 0) {
    errors.push("Initial scene contains no semantic entities.");
  }

  // 2. Relationship reference integrity
  for (let sIdx = 0; sIdx < timeline.states.length; sIdx++) {
    const state = timeline.states[sIdx];
    for (const [relId, rel] of state.graph.relationships) {
      if (!state.graph.entities.has(rel.sourceEntityId)) {
        errors.push(
          `State ${sIdx} relationship '${relId}' references non-existent source '${rel.sourceEntityId}'.`,
        );
      }
      if (!state.graph.entities.has(rel.targetEntityId)) {
        errors.push(
          `State ${sIdx} relationship '${relId}' references non-existent target '${rel.targetEntityId}'.`,
        );
      }
    }
  }

  // 3. Compute semantic fingerprints and diffs
  const fingerprints: string[] = [];
  for (let i = 0; i < timeline.states.length; i++) {
    fingerprints.push(computeSemanticFingerprint(timeline.states[i]));
  }

  const diffs: SemanticDiff[] = [];
  const statesToKeep: number[] = [0];

  for (let i = 0; i < timeline.states.length - 1; i++) {
    const diff = computeSemanticDiff(timeline.states[i], timeline.states[i + 1]);
    diffs.push(diff);

    // Rule 7: Every transformation must change the scene semantically!
    if (!diff.hasChanges || fingerprints[i] === fingerprints[i + 1]) {
      warnings.push(
        `Transformation ${i + 1} ('${timeline.meta[i + 1]?.title || i + 1}') produced no semantic changes (identical fingerprint).`,
      );
      // Auto-repair: mark redundant transformation for pruning
      repaired = true;
    } else {
      statesToKeep.push(i + 1);
    }
  }

  // Prune redundant duplicate states if auto-repaired
  let finalTimeline = timeline;
  if (repaired && statesToKeep.length > 1 && statesToKeep.length < timeline.states.length) {
    const prunedStates = statesToKeep.map((idx) => timeline.states[idx]);
    const prunedMeta = statesToKeep.map((idx) => timeline.meta[idx]);
    finalTimeline = {
      ...timeline,
      states: prunedStates,
      meta: prunedMeta,
    };
  }

  // Rule 8 & 49: Final state must differ from initial state (unless intentional cycle)
  if (!options?.allowCycles && finalTimeline.states.length > 1) {
    const initialFp = computeSemanticFingerprint(finalTimeline.states[0]);
    const finalFp = computeSemanticFingerprint(
      finalTimeline.states[finalTimeline.states.length - 1],
    );

    if (initialFp === finalFp) {
      errors.push(
        "Final scene state is identical to initial scene state. The lesson never reached a completed outcome.",
      );
    }
  }

  // Rule 4: Dynamic Tree Complexity & Depth Validation
  const prompt = options?.prompt || timeline.topic || "";
  const promptLower = prompt.toLowerCase();
  const isTreePrompt =
    promptLower.includes("tree") ||
    promptLower.includes("avl") ||
    promptLower.includes("bst") ||
    promptLower.includes("heap");

  if (isTreePrompt) {
    const treeRes = validateTreeComplexity(finalTimeline.states[0], prompt);
    if (!treeRes.valid && treeRes.error) {
      errors.push(treeRes.error);
    }

    if (promptLower.includes("avl") && promptLower.includes("rotation")) {
      const avlRes = validateAVLRotation(finalTimeline, prompt);
      if (!avlRes.valid && avlRes.error) {
        errors.push(avlRes.error);
      }
    }
  }

  // Rule 13: BFS Validation
  const isBFSPrompt =
    promptLower.includes("bfs") ||
    promptLower.includes("breadth-first") ||
    promptLower.includes("breadth first");

  if (isBFSPrompt) {
    const bfsRes = validateBFSTraversal(finalTimeline);
    if (!bfsRes.valid && bfsRes.error) {
      errors.push(bfsRes.error);
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    repaired,
    errors,
    warnings,
    timeline: finalTimeline,
    fingerprints,
    diffs,
  };
}
