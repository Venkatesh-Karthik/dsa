/**
 * Cognora Structured Transformation Diagnostics & Planning Telemetry
 *
 * Provides authoritative logging and performance tracking across all Cognora layers:
 * [COGNORA][INTENT], [COGNORA][COMMAND], [COGNORA][CONTEXT], [COGNORA][SEMANTIC],
 * [COGNORA][TRANSFORM], [COGNORA][CORRECTNESS], [COGNORA][LAYOUT], [COGNORA][RECONCILE],
 * [COGNORA][ANIMATION], [COGNORA][SCENE], [COGNORA][RENDER], [COGNORA][AI], [COGNORA][ERROR].
 *
 * Also captures internal planning telemetry and metrics for lesson construction:
 * - Count of identified operations
 * - Fine-grained semantic events emitted
 * - Candidate vs final transformations
 * - Essential event coverage percentage
 * - Reasons for pedagogical event grouping or splitting
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

export type CognoraDiagnosticTag =
  | "INTENT"
  | "COMMAND"
  | "CONTEXT"
  | "SEMANTIC"
  | "TRANSFORM"
  | "CORRECTNESS"
  | "LAYOUT"
  | "RECONCILE"
  | "ANIMATION"
  | "SCENE"
  | "RENDER"
  | "AI"
  | "ERROR";

export interface DiagnosticContext {
  generationId?: string;
  requestId?: string;
  lessonId?: string;
  transformationId?: string;
  sceneRevision?: number;
  [key: string]: unknown;
}

class CognoraDiagnosticsLogger {
  private formatPrefix(
    tag: CognoraDiagnosticTag,
    ctx?: DiagnosticContext,
  ): string {
    const metaParts: string[] = [];
    if (ctx?.lessonId) {
      metaParts.push(`lesson=${ctx.lessonId}`);
    }
    if (ctx?.generationId) {
      metaParts.push(`gen=${ctx.generationId}`);
    }
    if (ctx?.transformationId) {
      metaParts.push(`tx=${ctx.transformationId}`);
    }
    if (ctx?.sceneRevision !== undefined) {
      metaParts.push(`rev=${ctx.sceneRevision}`);
    }

    const metaStr = metaParts.length > 0 ? ` [${metaParts.join(" ")}]` : "";
    return `[COGNORA][${tag}]${metaStr}`;
  }

  public log(
    tag: CognoraDiagnosticTag,
    message: string,
    ctx?: DiagnosticContext,
    data?: unknown,
  ): void {
    const prefix = this.formatPrefix(tag, ctx);
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  public info(
    tag: CognoraDiagnosticTag,
    message: string,
    ctx?: DiagnosticContext,
    data?: unknown,
  ): void {
    const prefix = this.formatPrefix(tag, ctx);
    if (data !== undefined) {
      console.info(`${prefix} ${message}`, data);
    } else {
      console.info(`${prefix} ${message}`);
    }
  }

  public warn(
    tag: CognoraDiagnosticTag,
    message: string,
    ctx?: DiagnosticContext,
    data?: unknown,
  ): void {
    const prefix = this.formatPrefix(tag, ctx);
    if (data !== undefined) {
      console.warn(`${prefix} ${message}`, data);
    } else {
      console.warn(`${prefix} ${message}`);
    }
  }

  public error(
    tag: CognoraDiagnosticTag,
    message: string,
    ctx?: DiagnosticContext,
    error?: unknown,
  ): void {
    const prefix = this.formatPrefix(tag, ctx);
    if (error !== undefined) {
      console.error(`${prefix} ${message}`, error);
    } else {
      console.error(`${prefix} ${message}`);
    }
  }
}

export const CognoraDiagnostics = new CognoraDiagnosticsLogger();
