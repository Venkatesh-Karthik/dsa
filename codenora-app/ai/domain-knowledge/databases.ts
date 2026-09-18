/**
 * Databases Domain Knowledge Module
 *
 * Covers SQL queries, INNER / LEFT / RIGHT JOINs, Indexing, B-Trees,
 * Transactions (ACID), and relational tables.
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

export const DatabasesDomainModule: DomainKnowledgeModule = {
  id: "databases",
  domain: "databases",
  name: "Database Systems & SQL",
  description:
    "Relational Tables, SQL JOINs, Indexes, Transactions, and Query Execution Plans",

  matches(concept: string, prompt: string = ""): boolean {
    const text = `${concept} ${prompt}`.toLowerCase();
    return (
      text.includes("sql") ||
      text.includes("database") ||
      text.includes("join") ||
      text.includes("acid") ||
      text.includes("b-tree") ||
      text.includes("indexing") ||
      text.includes("transaction") ||
      text.includes("table") ||
      text.includes("foreign key")
    );
  },

  suggestStrategy(concept: string, prompt: string = ""): TeachingStrategy {
    const text = `${concept} ${prompt}`.toLowerCase();
    if (
      text.includes("join") ||
      text.includes("query") ||
      text.includes("data flow")
    ) {
      return "DATA_FLOW";
    }
    if (
      text.includes("transaction") ||
      text.includes("acid") ||
      text.includes("commit")
    ) {
      return "STATE_MACHINE";
    }
    if (text.includes("index") || text.includes("b-tree")) {
      return "STRUCTURAL_TRANSFORMATION";
    }
    return "DATA_FLOW";
  },

  getInvariants(concept: string): ConceptInvariant[] {
    const invariants: ConceptInvariant[] = [
      {
        id: "inv-join-predicate",
        description: "Join predicate match integrity",
        rule: "Join predicate constraint: Output records must satisfy the declared predicate condition (e.g. tableA.id = tableB.foreign_id).",
      },
      {
        id: "inv-db-schema",
        description: "Table schema integrity",
        rule: "Table schemas and primary-foreign key relationships remain stable across projection operations.",
      },
    ];
    return invariants;
  },

  getMisconceptions(concept: string): ConceptMisconception[] {
    return [
      {
        id: "misc-join-cartesian",
        misunderstanding:
          "A SQL JOIN immediately filters matching rows during row loading without considering the cross product space.",
        misconception:
          "A SQL Cartesian product is the same as an INNER JOIN without filtering.",
        correction:
          "A logical join conceptualizes Cartesian product evaluation followed by predicate filter qualification.",
      },
      {
        id: "misc-left-join-null",
        misunderstanding:
          "LEFT JOIN drops left table rows when there is no matching right table record.",
        misconception:
          "LEFT JOIN drops left table rows when there is no matching right table record.",
        correction:
          "LEFT JOIN preserves all left table records; unmatched right columns are populated with NULL values.",
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

    const graphEntities = state?.graph?.entities
      ? Array.from(state.graph.entities.values())
      : [];
    const graphRelationships = state?.graph?.relationships
      ? Array.from(state.graph.relationships.values())
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
      const tables = activeEntities.filter(
        (e: any) =>
          e.type === "Table" ||
          e.semanticRole === "table" ||
          e.semanticRole === "data" ||
          (e.label && (e.label.includes("(") || e.id.includes("table"))),
      );
      const rows = activeEntities.filter(
        (e: any) =>
          e.type === "Row" ||
          e.semanticRole === "row" ||
          e.semanticRole === "record",
      );

      const allLabels = [
        ...graphRelationships.map((r: any) => r.label || ""),
        transformation?.action || "",
        transformation?.title || "",
      ].join(" ");

      const joinConditionMatch = allLabels.match(
        /(?:ON|where)\s+([\w.]+\s*=\s*[\w.]+)/i,
      );

      if (tables.length > 0) {
        metrics.push({
          label: "Tables Involved",
          value: tables
            .map((t: any) => t.label?.split(" ")[0] || t.id)
            .join(", "),
        });
      }
      if (joinConditionMatch) {
        metrics.push({
          label: "Join Condition",
          value: joinConditionMatch[1],
          badgeColor: "#2563eb",
        });
      }
      metrics.push({
        label: "Matched Rows",
        value: rows.length > 0 ? rows.length : 1,
        badgeColor: "#16a34a",
      });
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
      title: "Database Query State",
      subtitle: "Relational table schemas, join predicates, and matched sets",
      metrics,
      properties,
      sections,
      statusBadge:
        transformation?.inspectorData?.statusBadge || `Step ${stateIdx + 1}`,
      operation: transformation?.action || transformation?.title,
      resultSummary:
        transformation?.reason || transformation?.learnerObservation,
    };
  },
};
