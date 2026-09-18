/**
 * Universal Visual Composition Planner — Cognora 5.0
 *
 * Dynamically decides WHICH visual compositions and combinations best communicate
 * the concept structure based on semantic topology, roles, and transitions.
 * Zero topic hardcoding (`if topic === 'AVL'`).
 */

import type { AuthoritativeSemanticModel } from "../authoritative-model";
import type {
  CompositionStrategy,
  ReadingDirection,
  VisualCompositionPlan,
  VisualEvidencePlan,
} from "./visual-reasoning-model";

export class VisualCompositionPlanner {
  /**
   * Dynamically selects primary and secondary composition strategies.
   */
  public static plan(
    model: AuthoritativeSemanticModel,
    evidencePlan: VisualEvidencePlan,
  ): VisualCompositionPlan {
    const entities =
      model.world?.entities ||
      (Array.isArray(model.states?.[0]?.entities)
        ? model.states[0].entities
        : Array.from(model.states?.[0]?.entities?.values() || []));
    const relationships =
      model.world?.relationships ||
      (Array.isArray(model.states?.[0]?.relationships)
        ? model.states[0].relationships
        : Array.from(model.states?.[0]?.relationships?.values() || []));
    const states = model.states || [];
    const transformations = model.transformations || [];

    // Detect Topological Features
    const entityTypes = new Set(
      entities.map((e) => (e.type || "").toLowerCase()),
    );
    const entityRoles = new Set(
      entities.map((e) => (e.semanticRole || "").toLowerCase()),
    );
    const relTypes = new Set(
      relationships.map((r) => (r.type || "").toLowerCase()),
    );

    // 1. Two-party / Multi-actor communication check
    const hasActors =
      entities.some((e) => {
        const s = `${e.label || ""} ${e.type || ""} ${
          e.semanticRole || ""
        }`.toLowerCase();
        return (
          s.includes("client") ||
          s.includes("sender") ||
          s.includes("requester") ||
          s.includes("browser")
        );
      }) &&
      entities.some((e) => {
        const s = `${e.label || ""} ${e.type || ""} ${
          e.semanticRole || ""
        }`.toLowerCase();
        return (
          s.includes("server") ||
          s.includes("receiver") ||
          s.includes("responder") ||
          s.includes("backend")
        );
      });

    const hasMessages =
      entities.some((e) => {
        const s = `${e.label || ""} ${e.type || ""}`.toLowerCase();
        return (
          s.includes("packet") ||
          s.includes("message") ||
          s.includes("syn") ||
          s.includes("ack") ||
          s.includes("request") ||
          s.includes("response")
        );
      }) ||
      relationships.some((r) => {
        const s = `${r.type || ""} ${r.label || ""}`.toLowerCase();
        return (
          s.includes("sends") ||
          s.includes("transmits") ||
          s.includes("syn") ||
          s.includes("ack") ||
          s.includes("request") ||
          s.includes("response") ||
          s.includes("message") ||
          s.includes("packet") ||
          s.includes("req")
        );
      });

    // 2. Tabular / Record structure check
    const hasTables =
      entityTypes.has("table") ||
      entityTypes.has("record") ||
      entityRoles.has("table") ||
      entities.some((e) => {
        const s = (e.label || "").toLowerCase();
        return (
          s.includes("account") || s.includes("table") || s.includes("ledger")
        );
      });

    // 3. Tree hierarchy check
    const hasTreeHierarchy =
      entityTypes.has("treenode") ||
      entityRoles.has("root") ||
      relTypes.has("leftof") ||
      relTypes.has("rightof") ||
      relTypes.has("parentof");

    // 4. Sequential list / array check
    const hasSequence =
      entityTypes.has("arraycell") ||
      entityTypes.has("linkedlistnode") ||
      entityRoles.has("array-element") ||
      entityRoles.has("head") ||
      relTypes.has("next");

    // 5. Memory layout check
    const hasMemory =
      entityTypes.has("memoryblock") ||
      entityTypes.has("stackframe") ||
      entityRoles.has("top") ||
      entityRoles.has("stack-frame");

    // 6. Cyclic / closed loop check
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();
    for (const e of entities) {
      inDegrees.set(e.id, 0);
      outDegrees.set(e.id, 0);
    }
    for (const r of relationships) {
      if (inDegrees.has(r.target)) {
        inDegrees.set(r.target, (inDegrees.get(r.target) ?? 0) + 1);
      }
      if (outDegrees.has(r.source)) {
        outDegrees.set(r.source, (outDegrees.get(r.source) ?? 0) + 1);
      }
    }
    const isCycle =
      entities.length >= 3 &&
      Array.from(inDegrees.values()).every((d) => d >= 1) &&
      Array.from(outDegrees.values()).every((d) => d >= 1);

    // 7. Decision / Branching check
    const hasDecisions =
      Boolean(model.decisions && model.decisions.length > 0) ||
      states.some(
        (s) => s.stateType === "decision" || s.stateType === "failure",
      ) ||
      transformations.some(
        (t) =>
          t.decision || t.branchType === "failure" || t.stateType === "failure",
      );

    // 8. Mathematical / spatial physics check
    const hasMathOrSpatial = entities.some((e) => {
      const s = `${e.type || ""} ${e.label || ""}`.toLowerCase();
      return (
        s.includes("equation") ||
        s.includes("vector") ||
        s.includes("velocity") ||
        s.includes("trajectory") ||
        s.includes("ray") ||
        s.includes("angle")
      );
    });

    // Select primary and secondary strategies dynamically
    let primaryStrategy: CompositionStrategy = "structural";
    const secondaryStrategies: CompositionStrategy[] = [];
    let readingDirection: ReadingDirection = "left_to_right";
    let rankAxis: "horizontal" | "vertical" = "horizontal";
    let rationale = "";

    if (hasActors && (hasMessages || relationships.length > 0)) {
      primaryStrategy = "interaction";
      secondaryStrategies.push("sequence", "data-flow");
      if (hasDecisions) {
        secondaryStrategies.push("state-transition");
      }
      readingDirection = "top_to_bottom";
      rankAxis = "horizontal"; // Actors horizontally arranged, timeline progresses top to bottom
      rationale =
        "Identified two-party/multi-actor communication: composing vertical lifelines with horizontal message connectors.";
    } else if (hasTables) {
      primaryStrategy = "tabular";
      if (hasDecisions) {
        secondaryStrategies.push("process", "state-transition");
      } else {
        secondaryStrategies.push("data-flow", "transformation");
      }
      readingDirection = "left_to_right";
      rankAxis = "horizontal";
      rationale =
        "Identified structured records/tables: composing tabular state layout with state-transition flow connectors.";
    } else if (hasTreeHierarchy) {
      primaryStrategy = "hierarchical";
      secondaryStrategies.push("structural", "transformation");
      readingDirection = "top_to_bottom";
      rankAxis = "vertical";
      rationale =
        "Identified hierarchical tree topology: composing vertical level ranks with child connectors.";
    } else if (isCycle) {
      primaryStrategy = "cycle";
      secondaryStrategies.push("process", "causal");
      readingDirection = "radial";
      rankAxis = "horizontal";
      rationale =
        "Identified closed topological loop: composing radial cycle with clockwise causal progression.";
    } else if (hasMemory) {
      primaryStrategy = "memory-layout";
      secondaryStrategies.push("sequence", "structural");
      readingDirection = "top_to_bottom";
      rankAxis = "vertical";
      rationale =
        "Identified memory blocks/stack frames: composing vertical address stack layout.";
    } else if (hasSequence) {
      primaryStrategy = "sequence";
      secondaryStrategies.push("structural", "data-flow");
      readingDirection = "left_to_right";
      rankAxis = "horizontal";
      rationale =
        "Identified linear sequence: composing horizontal chain layout with index and pointer annotations.";
    } else if (hasMathOrSpatial) {
      primaryStrategy = "spatial";
      secondaryStrategies.push("mathematical", "transformation");
      readingDirection = "source_to_destination";
      rankAxis = "horizontal";
      rationale =
        "Identified spatial vectors and equations: composing physical coordinate layout with trajectory rays.";
    } else {
      // General pipeline / causal DAG fallback
      primaryStrategy = "pipeline";
      secondaryStrategies.push("causal", "process");
      readingDirection = "left_to_right";
      rankAxis = "horizontal";
      rationale =
        "Universal concept pipeline: composing multi-rank DAG layout with causal flow connectors.";
    }

    return {
      primaryStrategy,
      secondaryStrategies,
      isComposite: secondaryStrategies.length > 0,
      readingDirection,
      rankAxis,
      rationale,
    };
  }
}
