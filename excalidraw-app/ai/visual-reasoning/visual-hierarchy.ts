/**
 * Universal Visual Hierarchy — Cognora 5.0
 *
 * Establishes formal visual importance levels for all semantic objects.
 * Priority rules:
 * 1. PRIMARY objects (core entities, major structures, tables, arrays, focal nodes)
 *    must NEVER be occluded by secondary or tertiary information.
 * 2. SECONDARY objects (relationships, arrows, data transfers, intermediate states)
 *    must NEVER destroy the readability of primary objects.
 * 3. TERTIARY objects (relationship labels, indices, metadata)
 *    must be compressed or abbreviated when space is constrained.
 * 4. EXPLANATORY objects (callouts, badges, teaching annotations)
 *    must NEVER cover the structure they explain.
 */

export type VisualHierarchyLevel =
  | "PRIMARY"
  | "SECONDARY"
  | "TERTIARY"
  | "EXPLANATORY";

export interface HierarchyClassification {
  level: VisualHierarchyLevel;
  zIndex: number;
  minPadding: number;
  allowOcclusion: boolean;
  canBeAbbreviated: boolean;
  minClearance: number; // minimum distance in px from other elements
}

export const HIERARCHY_CONFIG: Record<VisualHierarchyLevel, HierarchyClassification> = {
  PRIMARY: {
    level: "PRIMARY",
    zIndex: 10,
    minPadding: 16,
    allowOcclusion: false,
    canBeAbbreviated: false,
    minClearance: 32,
  },
  SECONDARY: {
    level: "SECONDARY",
    zIndex: 6,
    minPadding: 12,
    allowOcclusion: false,
    canBeAbbreviated: false,
    minClearance: 20,
  },
  TERTIARY: {
    level: "TERTIARY",
    zIndex: 4,
    minPadding: 8,
    allowOcclusion: false,
    canBeAbbreviated: true,
    minClearance: 12,
  },
  EXPLANATORY: {
    level: "EXPLANATORY",
    zIndex: 12,
    minPadding: 10,
    allowOcclusion: false,
    canBeAbbreviated: true,
    minClearance: 16,
  },
};

/**
 * Universally infers the visual hierarchy level from semantic properties.
 * Purely role- and property-based: ZERO topic checks.
 */
export function inferEntityHierarchy(entity: {
  semanticRole?: string;
  primitiveType?: string;
  properties?: Record<string, unknown>;
  state?: string;
}): VisualHierarchyLevel {
  const role = (entity.semanticRole || "").toLowerCase();
  const primitive = (entity.primitiveType || "").toLowerCase();
  const importance = (entity.properties?.importance as string | undefined)?.toLowerCase();

  if (importance === "primary" || importance === "core" || importance === "focal") {
    return "PRIMARY";
  }
  if (importance === "explanatory" || importance === "annotation") {
    return "EXPLANATORY";
  }
  if (importance === "secondary" || importance === "support") {
    return "SECONDARY";
  }
  if (importance === "tertiary" || importance === "metadata") {
    return "TERTIARY";
  }

  // Explanatory primitives
  if (
    primitive.includes("annotation") ||
    primitive.includes("callout") ||
    primitive.includes("pointer") ||
    role.includes("annotation") ||
    role.includes("callout") ||
    role.includes("explanation")
  ) {
    return "EXPLANATORY";
  }

  // Primary primitives: major computational, physical, structural, or actor entities
  if (
    primitive.includes("table") ||
    primitive.includes("array") ||
    primitive.includes("tree") ||
    primitive.includes("client") ||
    primitive.includes("server") ||
    primitive.includes("node") ||
    primitive.includes("actor") ||
    primitive.includes("register") ||
    primitive.includes("memory") ||
    primitive.includes("alu") ||
    primitive.includes("container") ||
    role.includes("focal") ||
    role.includes("root") ||
    role.includes("endpoint") ||
    role.includes("host") ||
    role.includes("actor") ||
    role.includes("structure")
  ) {
    return "PRIMARY";
  }

  // Secondary primitives: packets, tokens, transient payloads, decision nodes
  if (
    primitive.includes("packet") ||
    primitive.includes("message") ||
    primitive.includes("item") ||
    primitive.includes("decision") ||
    primitive.includes("equation") ||
    primitive.includes("ray") ||
    role.includes("packet") ||
    role.includes("message") ||
    role.includes("value") ||
    role.includes("decision") ||
    role.includes("transition")
  ) {
    return "SECONDARY";
  }

  // Default to PRIMARY for standalone entities to ensure they are never occluded
  return "PRIMARY";
}

/**
 * Infers hierarchy level for relationships and edge labels.
 */
export function inferRelationshipHierarchy(rel: {
  type?: string;
  label?: string;
  properties?: Record<string, unknown>;
}): { connectorLevel: VisualHierarchyLevel; labelLevel: VisualHierarchyLevel } {
  const importance = (rel.properties?.importance as string | undefined)?.toLowerCase();

  if (importance === "primary") {
    return { connectorLevel: "PRIMARY", labelLevel: "SECONDARY" };
  }

  return {
    connectorLevel: "SECONDARY",
    labelLevel: "TERTIARY",
  };
}

/**
 * Checks if element A has higher priority than element B.
 */
export function hasHigherPriority(
  a: VisualHierarchyLevel,
  b: VisualHierarchyLevel,
): boolean {
  return HIERARCHY_CONFIG[a].zIndex > HIERARCHY_CONFIG[b].zIndex;
}
