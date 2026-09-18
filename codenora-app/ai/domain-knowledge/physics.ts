/**
 * Physics Domain Knowledge Module
 *
 * Covers Kinematics, Forces, Momentum, Energy conservation, Projectile motion,
 * and Dynamic vector systems.
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

export const PhysicsDomainModule: DomainKnowledgeModule = {
  id: "physics",
  domain: "physics",
  name: "Physics & Classical Mechanics",
  description:
    "Kinematics, Newtonian Forces, Momentum, Work-Energy Theorem, and Projectile Motion",

  matches(concept: string, prompt: string = ""): boolean {
    const text = `${concept} ${prompt}`.toLowerCase();
    return (
      text.includes("physics") ||
      text.includes("projectile") ||
      text.includes("velocity") ||
      text.includes("acceleration") ||
      text.includes("gravity") ||
      text.includes("momentum") ||
      text.includes("kinetic energy") ||
      text.includes("friction") ||
      text.includes("force vector") ||
      text.includes("trajectory")
    );
  },

  suggestStrategy(concept: string, prompt: string = ""): TeachingStrategy {
    const text = `${concept} ${prompt}`.toLowerCase();
    if (
      text.includes("projectile") ||
      text.includes("trajectory") ||
      text.includes("time") ||
      text.includes("motion")
    ) {
      return "TEMPORAL_PROGRESSION";
    }
    if (text.includes("force") || text.includes("collision")) {
      return "CAUSAL_PROGRESSION";
    }
    return "TEMPORAL_PROGRESSION";
  },

  getInvariants(concept: string): ConceptInvariant[] {
    return [
      {
        id: "inv-energy-conservation",
        description: "Conservation of total mechanical energy",
        rule: "Conservation of Energy: In an isolated conservative system, Total Energy = Kinetic (1/2 mv^2) + Potential (mgh) remains constant.",
      },
      {
        id: "inv-horizontal-velocity",
        description: "Independence of orthogonal motion",
        rule: "In standard projectile motion without air resistance: horizontal velocity vx remains constant throughout flight.",
      },
    ];
  },

  getMisconceptions(concept: string): ConceptMisconception[] {
    return [
      {
        id: "misc-motion-force",
        misunderstanding:
          "An object moving at constant velocity requires a continuous forward net force.",
        misconception:
          "An object moving at constant velocity requires a continuous forward net force.",
        correction:
          "Newton's First Law: A constant velocity object has net force = 0; force is only required to accelerate or decelerate.",
      },
      {
        id: "misc-projectile-mass",
        misunderstanding:
          "Heavier objects fall faster in a vacuum than lighter objects.",
        misconception:
          "Newton Third Law action reaction forces cancel each other out on the same body.",
        correction:
          "Gravitational acceleration g is identical for all masses in vacuum independent of object mass. Action and reaction forces act on different bodies.",
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
      metrics.push({ label: "Simulation Step", value: `Step ${stateIdx + 1}` });
      metrics.push({
        label: "Active Bodies",
        value: Math.max(1, activeEntities.length),
      });

      const projectile = activeEntities.find(
        (e: any) =>
          e.type === "Particle" ||
          e.semanticRole === "body" ||
          e.semanticRole === "projectile" ||
          (e.label && (e.label.includes("Mass") || e.label.includes("m="))),
      );

      if (projectile) {
        metrics.push({
          label: "Mass / Body",
          value: projectile.label || "Mass m",
          badgeColor: "#2563eb",
        });
      }
      metrics.push({
        label: "Time Elapsed",
        value: `t = ${(stateIdx * 0.5).toFixed(1)}s`,
      });
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
      title: "Physical System State",
      subtitle: "Kinematic state, Newtonian vectors, and conservation metrics",
      metrics,
      properties,
      sections,
      statusBadge:
        transformation?.inspectorData?.statusBadge ||
        `t = ${(stateIdx * 0.5).toFixed(1)}s`,
      operation: transformation?.action || transformation?.title,
      resultSummary:
        transformation?.reason || transformation?.learnerObservation,
    };
  },
};
