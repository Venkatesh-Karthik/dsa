/**
 * Generic Domain Knowledge Module (Fallback)
 *
 * Catches any arbitrary or previously unseen concepts (e.g. Refrigerator cycle,
 * Cell biology, Quantum superposition, CI/CD, Supply chain, Economics).
 * Guarantees that Cognora NEVER crashes or fails on unknown topics.
 */

import { ExplanationEngine } from "../explanation-engine";

import type { DomainKnowledgeModule, ExtractedInspectorData } from "./types";
import type {
  ConceptInvariant,
  ConceptMisconception,
  ConceptState,
  ConceptTransformation,
  ConceptModel,
  TeachingStrategy,
} from "../concept-model";

export const GenericDomainModule: DomainKnowledgeModule = {
  id: "generic",
  domain: "generic",
  name: "Universal Concept Domain",
  description:
    "Fallback domain intelligence for arbitrary, cross-disciplinary, or novel technical concepts",

  matches(_concept: string, _prompt: string = ""): boolean {
    return true; // Catch-all fallback
  },

  suggestStrategy(concept: string, prompt: string = ""): TeachingStrategy {
    const text = `${concept} ${prompt}`.toLowerCase();
    if (
      text.includes("cycle") ||
      text.includes("pipeline") ||
      text.includes("circuit") ||
      text.includes("stages")
    ) {
      return "PIPELINE";
    }
    if (
      text.includes("flow") ||
      text.includes("stream") ||
      text.includes("data")
    ) {
      return "DATA_FLOW";
    }
    if (
      text.includes("step") ||
      text.includes("time") ||
      text.includes("sequence")
    ) {
      return "TEMPORAL_PROGRESSION";
    }
    if (
      text.includes("cause") ||
      text.includes("reaction") ||
      text.includes("effect")
    ) {
      return "CAUSAL_PROGRESSION";
    }
    if (text.includes("system") || text.includes("architecture")) {
      return "HIERARCHICAL_EXPANSION";
    }
    return "GENERIC_CONCEPTUAL_PROGRESSION";
  },

  getInvariants(_concept: string): ConceptInvariant[] {
    return [
      {
        id: "inv-state-transition-valid",
        description: "Semantic continuity between states",
        rule: "Every consecutive state transition must preserve identity of continuing entities.",
      },
      {
        id: "inv-generic-conservation",
        description: "Conservation and Identity Principle",
        rule: "Conservation principle: Total matter, energy, or information flow within the system boundaries must be preserved or explicitly accounted for.",
      },
    ];
  },

  getMisconceptions(_concept: string): ConceptMisconception[] {
    return [
      {
        id: "misc-visual-complexity",
        misunderstanding:
          "A more complex diagram with dozens of overlapping boxes produces better understanding.",
        misconception:
          "A more complex diagram with dozens of overlapping boxes produces better understanding.",
        correction:
          "Effective learning relies on isolating 5-6 core entities and demonstrating their dynamic transformations.",
      },
      {
        id: "misc-generic-causality",
        misunderstanding:
          "Correlated visual state changes imply direct causality.",
        misconception:
          "Correlated visual state changes imply direct causality.",
        correction:
          "State progression requires explicit operations or forces driving the transition.",
      },
    ];
  },

  extractInspectorData(
    state: any,
    transformation?: any,
    model?: ConceptModel,
  ): ExtractedInspectorData {
    const metrics: Array<{
      label: string;
      value: string | number;
      badgeColor?: string;
    }> = [];
    const properties: Array<{ label: string; value: string | number }> = [];

    if (
      transformation?.inspectorData?.metrics &&
      transformation.inspectorData.metrics.length > 0
    ) {
      metrics.push(...transformation.inspectorData.metrics);
    }
    if (
      transformation?.inspectorData?.properties &&
      transformation.inspectorData.properties.length > 0
    ) {
      properties.push(...transformation.inspectorData.properties);
    }

    const stateIdx = state?.stateIndex ?? state?.version ?? 0;
    const graphEntities = state?.graph?.entities
      ? Array.from(state.graph.entities.values())
      : [];
    const modelEntities = model?.entities || [];

    let activeEntities: any[] = [];
    if (state?.activeEntityIds && Array.isArray(state.activeEntityIds)) {
      activeEntities = modelEntities.filter((e) =>
        state.activeEntityIds.includes(e.id),
      );
    } else if (graphEntities.length > 0) {
      activeEntities = graphEntities;
    } else if (modelEntities.length > 0) {
      activeEntities = modelEntities;
    }

    if (metrics.length === 0) {
      metrics.push({ label: "Stage", value: `Step ${stateIdx + 1}` });
      metrics.push({
        label: "Visible Elements",
        value: Math.max(1, activeEntities.length),
      });
      if (activeEntities.length > 0) {
        const primary = activeEntities[0];
        const rawLabel = primary.label || primary.name || primary.id;
        const cleanLabel = ExplanationEngine.scrubMetadata(rawLabel);
        metrics.push({
          label: "Current Focus",
          value: cleanLabel,
          badgeColor: "#2563eb",
        });
      }
    }

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
      title: "System Inspector",
      subtitle: "Universal entity state and relational connections",
      metrics,
      properties,
      sections,
      statusBadge:
        transformation?.inspectorData?.statusBadge || `Phase ${stateIdx + 1}`,
      operation: transformation?.action || transformation?.title,
      resultSummary:
        transformation?.reason || transformation?.learnerObservation,
    };
  },
};
