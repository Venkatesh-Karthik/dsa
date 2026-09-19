/**
 * Visual Invariants Validation Engine — Cognora
 *
 * Enforces rigorous pre-render visual invariants:
 * 1. ENTITY_CONSERVATION: Every intended semantic entity appears exactly once.
 * 2. RELATIONSHIP_VALIDITY: Every relationship references existing entities.
 * 3. HIERARCHY_VALIDITY: Tree/hierarchy parent-child structures have branching with no accidental vertical collapse.
 * 4. SEQUENCE_VALIDITY: Ordered chains preserve visual progression.
 * 5. LAYOUT_VALIDITY: All primary entities have valid, finite, visible bounds.
 * 6. OVERLAP_VALIDITY: Primary entities do not severely overlap.
 * 7. CONNECTOR_VALIDITY: Connectors have distinct, valid endpoints.
 * 8. FOCUS_VALIDITY: Teaching focus resolves to a valid entity.
 * 9. DETERMINISM: Identical inputs produce identical layout coordinates.
 */

import type { SceneGraph } from "./scene-graph";
import type { LayoutBounds, LayoutPoint } from "./layout-engine";

export interface VisualInvariantViolation {
  code:
    | "ENTITY_CONSERVATION"
    | "RELATIONSHIP_VALIDITY"
    | "HIERARCHY_VALIDITY"
    | "SEQUENCE_VALIDITY"
    | "LAYOUT_VALIDITY"
    | "OVERLAP_VALIDITY"
    | "CONNECTOR_VALIDITY"
    | "FOCUS_VALIDITY"
    | "DETERMINISM";
  entityId?: string;
  relationshipId?: string;
  message: string;
  severity: "error" | "warning";
}

export interface VisualValidationResult {
  valid: boolean;
  violations: VisualInvariantViolation[];
  metrics: {
    entityCount: number;
    relationshipCount: number;
    bounds: LayoutBounds;
    overlapCount: number;
    hierarchyBranches?: number;
  };
}

/**
 * Validates all visual invariants on a laid out SceneGraph.
 */
export function validateSceneVisualInvariants(
  graph: SceneGraph,
  positions: Map<string, LayoutPoint>,
  bounds: LayoutBounds,
  entityBoundsMap?: Map<string, { width: number; height: number }>,
): VisualValidationResult {
  const violations: VisualInvariantViolation[] = [];
  const entities = Array.from(graph.entities.values());
  const relationships = Array.from(graph.relationships.values());

  // 1. ENTITY_CONSERVATION
  const seenIds = new Set<string>();
  for (const entity of entities) {
    if (seenIds.has(entity.id)) {
      violations.push({
        code: "ENTITY_CONSERVATION",
        entityId: entity.id,
        message: `Duplicate entity ID detected: "${entity.id}".`,
        severity: "error",
      });
    }
    seenIds.add(entity.id);

    if (!positions.has(entity.id)) {
      violations.push({
        code: "ENTITY_CONSERVATION",
        entityId: entity.id,
        message: `Entity "${entity.id}" exists in semantic graph but has no assigned layout position.`,
        severity: "error",
      });
    }
  }

  // 2. RELATIONSHIP_VALIDITY
  for (const rel of relationships) {
    const hasSource = graph.entities.has(rel.sourceEntityId);
    const hasTarget = graph.entities.has(rel.targetEntityId);

    if (!hasSource) {
      violations.push({
        code: "RELATIONSHIP_VALIDITY",
        relationshipId: rel.id,
        message: `Relationship "${rel.id}" references non-existent source entity "${rel.sourceEntityId}".`,
        severity: "error",
      });
    }
    if (!hasTarget) {
      violations.push({
        code: "RELATIONSHIP_VALIDITY",
        relationshipId: rel.id,
        message: `Relationship "${rel.id}" references non-existent target entity "${rel.targetEntityId}".`,
        severity: "error",
      });
    }
    if (hasSource && hasTarget && rel.sourceEntityId === rel.targetEntityId) {
      violations.push({
        code: "RELATIONSHIP_VALIDITY",
        relationshipId: rel.id,
        message: `Relationship "${rel.id}" is a self-loop on entity "${rel.sourceEntityId}".`,
        severity: "warning",
      });
    }
  }

  // 3. HIERARCHY_VALIDITY
  // Check that tree branching actually branches horizontally instead of collapsing into a single vertical line
  const parentChildMap = new Map<string, string[]>();
  for (const rel of relationships) {
    if (
      rel.type === "parentOf" ||
      rel.type === "leftOf" ||
      rel.type === "rightOf" ||
      rel.type === "left" ||
      rel.type === "right" ||
      rel.type === "childOf"
    ) {
      const parentId =
        rel.type === "childOf" ? rel.targetEntityId : rel.sourceEntityId;
      const childId =
        rel.type === "childOf" ? rel.sourceEntityId : rel.targetEntityId;
      const children = parentChildMap.get(parentId) || [];
      if (!children.includes(childId)) {
        children.push(childId);
        parentChildMap.set(parentId, children);
      }
    }
  }

  let totalBranches = 0;
  for (const [parentId, children] of parentChildMap.entries()) {
    if (children.length >= 2) {
      totalBranches++;
      const pos0 = positions.get(children[0]);
      const pos1 = positions.get(children[1]);
      if (pos0 && pos1) {
        // If two siblings have the exact same X coordinate, the tree has vertically collapsed!
        if (Math.abs(pos0.x - pos1.x) < 10) {
          violations.push({
            code: "HIERARCHY_VALIDITY",
            entityId: parentId,
            message: `Parent "${parentId}" has multiple children "${
              children[0]
            }" and "${
              children[1]
            }" with nearly identical X coordinate (${Math.round(
              pos0.x,
            )} vs ${Math.round(
              pos1.x,
            )}). Tree has collapsed vertically into a column.`,
            severity: "error",
          });
        }
      }
    }
  }

  // 4. LAYOUT_VALIDITY
  for (const entity of entities) {
    const pos = positions.get(entity.id);
    if (pos) {
      if (
        isNaN(pos.x) ||
        isNaN(pos.y) ||
        !isFinite(pos.x) ||
        !isFinite(pos.y)
      ) {
        violations.push({
          code: "LAYOUT_VALIDITY",
          entityId: entity.id,
          message: `Entity "${entity.id}" has invalid non-finite coordinates (${pos.x}, ${pos.y}).`,
          severity: "error",
        });
      }
    }
  }

  // 5. OVERLAP_VALIDITY
  let overlapCount = 0;
  const primaryEntities = entities.filter(
    (e) =>
      e.primitiveType !== "Annotation" &&
      e.primitiveType !== "Callout" &&
      e.primitiveType !== "Pointer",
  );

  for (let i = 0; i < primaryEntities.length; i++) {
    for (let j = i + 1; j < primaryEntities.length; j++) {
      const eA = primaryEntities[i];
      const eB = primaryEntities[j];
      const posA = positions.get(eA.id);
      const posB = positions.get(eB.id);
      if (!posA || !posB) {
        continue;
      }

      const dimA = entityBoundsMap?.get(eA.id) ?? { width: 60, height: 60 };
      const dimB = entityBoundsMap?.get(eB.id) ?? { width: 60, height: 60 };

      // Calculate intersection area
      const xOverlap = Math.max(
        0,
        Math.min(posA.x + dimA.width, posB.x + dimB.width) -
          Math.max(posA.x, posB.x),
      );
      const yOverlap = Math.max(
        0,
        Math.min(posA.y + dimA.height, posB.y + dimB.height) -
          Math.max(posA.y, posB.y),
      );

      const intersectionArea = xOverlap * yOverlap;
      const minArea = Math.min(
        dimA.width * dimA.height,
        dimB.width * dimB.height,
      );

      if (minArea > 0 && intersectionArea / minArea > 0.6) {
        // Severe overlap
        overlapCount++;
        violations.push({
          code: "OVERLAP_VALIDITY",
          entityId: eA.id,
          message: `Entities "${eA.id}" and "${
            eB.id
          }" severely overlap (overlap ratio: ${(
            intersectionArea / minArea
          ).toFixed(2)}).`,
          severity: "error",
        });
      }
    }
  }

  // 6. SEQUENCE_VALIDITY
  // In linear ordered sequences (e.g. linked lists), adjacent elements in a row must progress left-to-right
  for (const rel of relationships) {
    if (
      rel.type === "next" ||
      (rel.type === "points_to" &&
        graph.metadata?.conceptType === "linked_list")
    ) {
      const srcPos = positions.get(rel.sourceEntityId);
      const tgtPos = positions.get(rel.targetEntityId);
      if (srcPos && tgtPos) {
        // If they are on the same vertical line/row (no wrapping)
        if (Math.abs(srcPos.y - tgtPos.y) < 30) {
          if (tgtPos.x <= srcPos.x) {
            violations.push({
              code: "SEQUENCE_VALIDITY",
              relationshipId: rel.id,
              message: `Sequence entity "${rel.targetEntityId}" (x=${tgtPos.x}) does not follow predecessor "${rel.sourceEntityId}" (x=${srcPos.x}) from left to right.`,
              severity: "error",
            });
          }
        }
      }
    }
  }

  // 7. CONNECTOR_VALIDITY
  // Every relationship connector must terminate on distinct, valid points
  for (const rel of relationships) {
    const srcPos = positions.get(rel.sourceEntityId);
    const tgtPos = positions.get(rel.targetEntityId);
    if (srcPos && tgtPos && rel.sourceEntityId !== rel.targetEntityId) {
      const dist = Math.hypot(tgtPos.x - srcPos.x, tgtPos.y - srcPos.y);
      if (dist < 5) {
        violations.push({
          code: "CONNECTOR_VALIDITY",
          relationshipId: rel.id,
          message: `Connector for relationship "${
            rel.id
          }" has nearly zero length (dist=${dist.toFixed(1)}px) between "${
            rel.sourceEntityId
          }" and "${rel.targetEntityId}".`,
          severity: "error",
        });
      }
    }
  }

  // 8. FOCUS_VALIDITY
  const focalId =
    typeof graph.metadata?.focalEntityId === "string"
      ? graph.metadata.focalEntityId
      : undefined;
  if (focalId) {
    if (!graph.entities.has(focalId)) {
      violations.push({
        code: "FOCUS_VALIDITY",
        entityId: focalId,
        message: `Focal entity ID "${focalId}" does not exist in the scene entities.`,
        severity: "warning",
      });
    }
  }

  const hasErrors = violations.some((v) => v.severity === "error");

  return {
    valid: !hasErrors,
    violations,
    metrics: {
      entityCount: entities.length,
      relationshipCount: relationships.length,
      bounds,
      overlapCount,
      hierarchyBranches: totalBranches,
    },
  };
}

/**
 * Validates DETERMINISM invariant: Given identical inputs and layout engine,
 * the layout coordinates and bounds must be strictly identical across multiple runs.
 */
export function validateLayoutDeterminism(
  graph: SceneGraph,
  layoutFn: (g: SceneGraph) => {
    positions: Map<string, LayoutPoint>;
    bounds: LayoutBounds;
  },
): { deterministic: boolean; differences: string[] } {
  const run1 = layoutFn(graph);
  const run2 = layoutFn(graph);

  const differences: string[] = [];

  for (const [id, pos1] of run1.positions) {
    const pos2 = run2.positions.get(id);
    if (!pos2) {
      differences.push(`Entity "${id}" missing in run 2`);
      continue;
    }
    if (
      Math.abs(pos1.x - pos2.x) > 0.001 ||
      Math.abs(pos1.y - pos2.y) > 0.001
    ) {
      differences.push(
        `Entity "${id}" coordinate mismatch: run1=(${pos1.x}, ${pos1.y}) vs run2=(${pos2.x}, ${pos2.y})`,
      );
    }
  }

  if (
    Math.abs(run1.bounds.x - run2.bounds.x) > 0.001 ||
    Math.abs(run1.bounds.y - run2.bounds.y) > 0.001 ||
    Math.abs(run1.bounds.width - run2.bounds.width) > 0.001 ||
    Math.abs(run1.bounds.height - run2.bounds.height) > 0.001
  ) {
    differences.push(
      `Bounds mismatch: run1=(${run1.bounds.x}, ${run1.bounds.y}, ${run1.bounds.width}, ${run1.bounds.height}) vs run2=(${run2.bounds.x}, ${run2.bounds.y}, ${run2.bounds.width}, ${run2.bounds.height})`,
    );
  }

  return {
    deterministic: differences.length === 0,
    differences,
  };
}

export interface PreRenderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedElements: any[];
}

/**
 * 13-Rule Pre-Render Visual Validation Gate
 * Validates elements before they are submitted to Excalidraw's canvas renderer.
 */
export function validatePreRenderElements(
  elements: readonly any[],
  graph?: SceneGraph,
  options?: { maxElements?: number },
): PreRenderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxElements = options?.maxElements ?? 500;

  // Rule 13: Unbounded element growth
  if (elements.length > maxElements) {
    errors.push(
      `Rule 13 (Unbounded Element Growth): Element count (${elements.length}) exceeds maximum safe threshold (${maxElements}).`,
    );
  }

  const activeElements = elements.filter((e) => !e.isDeleted);
  const elementIdMap = new Map<string, any>();
  const seenSemanticIds = new Set<string>();

  for (const el of activeElements) {
    // Rule 12: Valid Excalidraw element structure
    if (!el || typeof el.id !== "string" || typeof el.type !== "string") {
      errors.push(
        `Rule 12 (Invalid Element): Found malformed element without valid id or type.`,
      );
      continue;
    }

    // Rule 5 & 6: Duplicate IDs
    if (elementIdMap.has(el.id)) {
      errors.push(
        `Rule 5/6 (Duplicate Visual Representation): Duplicate element ID "${el.id}" detected.`,
      );
    }
    elementIdMap.set(el.id, el);

    const dslId = el.customData?.dslId;
    if (dslId) {
      if (seenSemanticIds.has(dslId)) {
        warnings.push(
          `Rule 6 (Multiple Elements for Semantic ID): Semantic ID "${dslId}" is attached to multiple visual elements.`,
        );
      }
      seenSemanticIds.add(dslId);
    }

    // Rule 8: Internal operational tokens must not be rendered
    const checkId = (dslId || el.id).toLowerCase();
    if (
      /^t\d+[-_]op\d+/i.test(checkId) ||
      /^op-\d+/i.test(checkId) ||
      /^step-\d+/i.test(checkId) ||
      checkId === "focuscomponent" ||
      checkId === "activecomponents" ||
      checkId === "create_arrow"
    ) {
      errors.push(
        `Rule 8 (Operational Token Leakage): Operational token "${checkId}" leaked as a visual element.`,
      );
    }

    // Rule 9: Finite coordinates
    if (!Number.isFinite(el.x) || !Number.isFinite(el.y)) {
      errors.push(
        `Rule 9 (Non-Finite Coordinates): Element "${el.id}" has non-finite coordinates (${el.x}, ${el.y}).`,
      );
    }

    // Rule 10: Finite and non-negative dimensions
    if (
      !Number.isFinite(el.width) ||
      el.width < 0 ||
      !Number.isFinite(el.height) ||
      el.height < 0
    ) {
      errors.push(
        `Rule 10 (Invalid Dimensions): Element "${el.id}" has invalid dimensions (${el.width}x${el.height}).`,
      );
    }

    // Rule 11: Valid Bindings
    if (el.startBinding && el.startBinding.elementId) {
      if (
        !elementIdMap.has(el.startBinding.elementId) &&
        !elements.some(
          (e) => e.id === el.startBinding.elementId && !e.isDeleted,
        )
      ) {
        warnings.push(
          `Rule 11 (Broken Start Binding): Element "${el.id}" references deleted or missing startBinding "${el.startBinding.elementId}".`,
        );
      }
    }
    if (el.endBinding && el.endBinding.elementId) {
      if (
        !elementIdMap.has(el.endBinding.elementId) &&
        !elements.some((e) => e.id === el.endBinding.elementId && !e.isDeleted)
      ) {
        warnings.push(
          `Rule 11 (Broken End Binding): Element "${el.id}" references deleted or missing endBinding "${el.endBinding.elementId}".`,
        );
      }
    }
  }

  // Graph Semantic Checks (Rules 1-4)
  if (graph) {
    // Rule 2: Required semantic entities have visual representations
    for (const [entId, ent] of graph.entities.entries()) {
      if (
        ent.primitiveType !== "Annotation" &&
        ent.primitiveType !== "Callout"
      ) {
        const hasVisual = Array.from(elementIdMap.values()).some(
          (el) => el.id === entId || el.customData?.dslId === entId,
        );
        if (!hasVisual) {
          warnings.push(
            `Rule 2 (Missing Visual Entity): Semantic entity "${entId}" has no active visual representation.`,
          );
        }
      }
    }

    // Rule 3: Relationships reference valid entities
    for (const [relId, rel] of graph.relationships.entries()) {
      if (!graph.entities.has(rel.sourceEntityId)) {
        errors.push(
          `Rule 3 (Invalid Relationship Source): Relationship "${relId}" references non-existent source "${rel.sourceEntityId}".`,
        );
      }
      if (!graph.entities.has(rel.targetEntityId)) {
        errors.push(
          `Rule 3 (Invalid Relationship Target): Relationship "${relId}" references non-existent target "${rel.targetEntityId}".`,
        );
      }
    }
  }

  // Sanitize elements for safe rendering
  const sanitizedElements = elements.map((el) => {
    if (!el || el.isDeleted) {
      return el;
    }
    const safeX = Number.isFinite(el.x) ? el.x : 100;
    const safeY = Number.isFinite(el.y) ? el.y : 100;
    const safeW = Number.isFinite(el.width) && el.width >= 0 ? el.width : 60;
    const safeH = Number.isFinite(el.height) && el.height >= 0 ? el.height : 60;

    if (
      safeX !== el.x ||
      safeY !== el.y ||
      safeW !== el.width ||
      safeH !== el.height
    ) {
      return { ...el, x: safeX, y: safeY, width: safeW, height: safeH };
    }
    return el;
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedElements,
  };
}
