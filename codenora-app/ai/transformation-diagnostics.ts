/**
 * Cognora Internal Transformation Diagnostics
 *
 * Captures internal planning telemetry and metrics for lesson construction:
 * - Count of identified operations
 * - Fine-grained semantic events emitted
 * - Candidate vs final transformations
 * - Essential event coverage percentage
 * - Reasons for pedagogical event grouping or splitting
 *
 * Purely internal diagnostic telemetry—never exposed or leaked to learner-facing UI.
 */

import type { EssentialEventCoverageReport } from "./teaching-event-graph";

export interface PlanningDiagnostics {
  operationCount: number;
  eventCount: number;
  candidateTransformations: number;
  groupedEvents: number;
  splitEvents: number;
  finalTransformations: number;
  essentialEventsCovered: number; // percentage 0-100
  missingEssentialEvents: string[];
  groupingReasons: string[];
  timestamp: number;
}

export function createEmptyDiagnostics(): PlanningDiagnostics {
  return {
    operationCount: 0,
    eventCount: 0,
    candidateTransformations: 0,
    groupedEvents: 0,
    splitEvents: 0,
    finalTransformations: 0,
    essentialEventsCovered: 100,
    missingEssentialEvents: [],
    groupingReasons: [],
    timestamp: Date.now(),
  };
}

export function buildPlanningDiagnostics(params: {
  operationCount: number;
  eventCount: number;
  candidateTransformations: number;
  groupedEvents: number;
  splitEvents: number;
  finalTransformations: number;
  coverageReport?: EssentialEventCoverageReport;
}): PlanningDiagnostics {
  const {
    operationCount,
    eventCount,
    candidateTransformations,
    groupedEvents,
    splitEvents,
    finalTransformations,
    coverageReport,
  } = params;

  return {
    operationCount,
    eventCount,
    candidateTransformations,
    groupedEvents,
    splitEvents,
    finalTransformations,
    essentialEventsCovered: coverageReport?.coveragePercentage ?? 100,
    missingEssentialEvents: coverageReport?.missingEventIds ?? [],
    groupingReasons: (coverageReport?.groupingSummary || []).map(
      (g) => `${g.milestoneTitle}: ${g.justification}`,
    ),
    timestamp: Date.now(),
  };
}
