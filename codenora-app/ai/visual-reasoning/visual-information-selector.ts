/**
 * Universal Visual Information Selector — Cognora 5.0
 *
 * Decides:
 * 1. WHAT MUST BE VISUAL (Primary Canvas Entities)
 * 2. WHAT SHOULD BE VISUAL (Secondary Entities & Connectors)
 * 3. WHAT SHOULD BE TERTIARY (Compressed Labels & Badges)
 * 4. WHAT SHOULD ONLY BE EXPLAINED (Narrative Metadata)
 * 5. WHAT LIVES IN INSPECTOR (Deep technical properties & raw payloads)
 * 6. WHAT SHOULD NOT APPEAR (Transient operations, internal IDs, temporary noise)
 */

import {
  inferEntityHierarchy,
  type VisualHierarchyLevel,
} from "./visual-hierarchy";
import { sanitizeVisualText, compressSemanticPayload } from "./text-sanitizer";

export type VisualDestination =
  | "canvas-primary"
  | "canvas-secondary"
  | "canvas-tertiary"
  | "inspector-detail"
  | "explanation-only"
  | "suppressed";

export interface SelectedEntityPlan {
  id: string;
  destination: VisualDestination;
  hierarchy: VisualHierarchyLevel;
  renderedLabel: string;
  renderedSubtitle?: string;
  inspectorDetails: Record<string, unknown>;
  shouldRenderOnCanvas: boolean;
}

export interface SelectedRelationshipPlan {
  id: string;
  destination: VisualDestination;
  hierarchy: VisualHierarchyLevel;
  renderedLabel?: string;
  inspectorDetails: Record<string, unknown>;
  shouldRenderOnCanvas: boolean;
}

export interface VisualInformationPlan {
  entities: Map<string, SelectedEntityPlan>;
  relationships: Map<string, SelectedRelationshipPlan>;
  sceneDensityScore: number;
}

export class VisualInformationSelector {
  /**
   * Universal information selection algorithm.
   */
  public static select(input: {
    entities: Array<{
      id: string;
      label?: string;
      value?: unknown;
      semanticRole?: string;
      primitiveType?: string;
      properties?: Record<string, unknown>;
      state?: string;
    }>;
    relationships: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
      type?: string;
      properties?: Record<string, unknown>;
    }>;
    activeTransformation?: {
      affectedEntities?: string[];
      operations?: unknown[];
    };
    sceneDensity?: number;
  }): VisualInformationPlan {
    const density = input.sceneDensity ?? 0.3;
    const entityPlans = new Map<string, SelectedEntityPlan>();
    const relationshipPlans = new Map<string, SelectedRelationshipPlan>();

    // 1. Evaluate Entities
    for (const ent of input.entities) {
      const hierarchy = inferEntityHierarchy(ent);
      const rawText =
        ent.label || (typeof ent.value === "string" ? ent.value : ent.id);
      const sanitized = sanitizeVisualText(rawText);

      // Check if transient action
      const role = (ent.semanticRole || "").toLowerCase();
      const isTransientAction =
        role.includes("action") ||
        role.includes("operation") ||
        role.includes("transient") ||
        ent.properties?.isOperation === true ||
        ent.properties?.shouldRender === false;

      let destination: VisualDestination = "canvas-primary";
      if (isTransientAction) {
        destination = "suppressed";
      } else if (hierarchy === "PRIMARY") {
        destination = "canvas-primary";
      } else if (hierarchy === "SECONDARY") {
        destination = "canvas-secondary";
      } else if (hierarchy === "EXPLANATORY") {
        destination = "canvas-secondary";
      } else {
        destination = density > 0.6 ? "inspector-detail" : "canvas-tertiary";
      }

      // Max display length adapts to scene density
      const maxLen = density > 0.5 ? 24 : 36;
      const compressed = compressSemanticPayload(sanitized, maxLen);

      const inspectorDetails: Record<string, unknown> = {
        id: ent.id,
        semanticRole: ent.semanticRole,
        primitiveType: ent.primitiveType,
        state: ent.state,
        fullValue: ent.value,
        rawLabel: ent.label,
        ...(ent.properties || {}),
      };

      entityPlans.set(ent.id, {
        id: ent.id,
        destination,
        hierarchy,
        renderedLabel: compressed.title || sanitized,
        renderedSubtitle: compressed.subtitle,
        inspectorDetails,
        shouldRenderOnCanvas:
          destination === "canvas-primary" ||
          destination === "canvas-secondary" ||
          destination === "canvas-tertiary",
      });
    }

    // 2. Evaluate Relationships
    for (const rel of input.relationships) {
      const srcPlan = entityPlans.get(rel.source);
      const tgtPlan = entityPlans.get(rel.target);

      // If either endpoint is not rendered on canvas, suppress the connector
      if (!srcPlan?.shouldRenderOnCanvas || !tgtPlan?.shouldRenderOnCanvas) {
        relationshipPlans.set(rel.id, {
          id: rel.id,
          destination: "suppressed",
          hierarchy: "TERTIARY",
          inspectorDetails: { ...rel },
          shouldRenderOnCanvas: false,
        });
        continue;
      }

      const rawLabel =
        rel.label || (rel.properties?.label as string | undefined);
      const sanitizedLabel = sanitizeVisualText(rawLabel);
      const isPrimaryRel =
        rel.properties?.importance === "primary" ||
        input.activeTransformation?.affectedEntities?.includes(rel.source) ||
        input.activeTransformation?.affectedEntities?.includes(rel.target);

      const hierarchy: VisualHierarchyLevel = isPrimaryRel
        ? "SECONDARY"
        : "TERTIARY";
      const maxLabelLen = density > 0.5 ? 20 : 28;
      const compressedLabel = sanitizedLabel
        ? compressSemanticPayload(sanitizedLabel, maxLabelLen)
        : undefined;

      const destination: VisualDestination =
        density > 0.7 && !isPrimaryRel && !sanitizedLabel
          ? "inspector-detail"
          : "canvas-secondary";

      relationshipPlans.set(rel.id, {
        id: rel.id,
        destination,
        hierarchy,
        renderedLabel: compressedLabel?.title || sanitizedLabel || undefined,
        inspectorDetails: {
          id: rel.id,
          source: rel.source,
          target: rel.target,
          type: rel.type,
          fullLabel: sanitizedLabel,
          ...(rel.properties || {}),
        },
        shouldRenderOnCanvas: destination === "canvas-secondary",
      });
    }

    return {
      entities: entityPlans,
      relationships: relationshipPlans,
      sceneDensityScore: density,
    };
  }
}
