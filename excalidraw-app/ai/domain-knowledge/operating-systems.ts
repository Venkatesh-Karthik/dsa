/**
 * Operating Systems Domain Knowledge Module
 *
 * Covers CPU scheduling, processes, threads, virtual memory, paging,
 * mutexes, semaphores, and race conditions.
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

export const OperatingSystemsDomainModule: DomainKnowledgeModule = {
  id: "operating_systems",
  domain: "operating_systems",
  name: "Operating Systems",
  description: "Processes, Threads, Scheduling, Virtual Memory, Deadlocks, and Concurrency",

  matches(concept: string, prompt: string = ""): boolean {
    const text = `${concept} ${prompt}`.toLowerCase();
    return (
      text.includes("process") ||
      text.includes("thread") ||
      text.includes("cpu schedul") ||
      text.includes("round robin") ||
      text.includes("virtual memory") ||
      text.includes("paging") ||
      text.includes("deadlock") ||
      text.includes("mutex") ||
      text.includes("semaphore") ||
      text.includes("context switch")
    );
  },

  suggestStrategy(concept: string, prompt: string = ""): TeachingStrategy {
    const text = `${concept} ${prompt}`.toLowerCase();
    if (text.includes("schedul") || text.includes("state")) {
      return "STATE_MACHINE";
    }
    if (text.includes("deadlock") || text.includes("concurrency")) {
      return "CAUSAL_PROGRESSION";
    }
    if (text.includes("memory") || text.includes("paging")) {
      return "MEMORY_TRANSFORMATION";
    }
    return "STATE_MACHINE";
  },

  getInvariants(concept: string): ConceptInvariant[] {
    return [
      {
        id: "inv-cpu-single-occupancy",
        description: "CPU execution exclusion",
        rule: "A single CPU core executes at most one process or thread at any instantaneous moment.",
      },
      {
        id: "inv-state-transition",
        description: "Process lifecycle validity",
        rule: "Process state changes follow valid transitions: Ready -> Running -> Waiting/Terminated.",
      },
    ];
  },

  getMisconceptions(concept: string): ConceptMisconception[] {
    return [
      {
        id: "misc-multithreading",
        misunderstanding: "A single core runs multiple threads simultaneously in true physical parallel.",
        misconception: "A single core runs multiple threads simultaneously in true physical parallel.",
        correction: "On a single core, threads time-slice via rapid context switches; true parallelism requires multiple physical cores.",
      },
      {
        id: "misc-deadlock",
        misunderstanding: "High CPU utilization causes deadlocks.",
        misconception: "High CPU utilization causes deadlocks.",
        correction: "Deadlock is caused by circular resource waiting conditions, irrespective of CPU workload.",
      },
    ];
  },

  extractInspectorData(
    state: any,
    transformation?: any,
    model?: ConceptModel,
  ): ExtractedInspectorData {
    const metrics: Array<{ label: string; value: string | number; badgeColor?: string }> = [];
    const properties: Array<{ label: string; value: string | number }> = [];

    if (transformation?.inspectorData?.metrics && transformation.inspectorData.metrics.length > 0) {
      metrics.push(...transformation.inspectorData.metrics);
    }
    if (transformation?.inspectorData?.properties && transformation.inspectorData.properties.length > 0) {
      properties.push(...transformation.inspectorData.properties);
    }

    const graphEntities = state?.graph?.entities ? Array.from(state.graph.entities.values()) : [];
    const modelEntities = model?.entities || [];

    let activeEntities: any[] = [];
    if (state?.activeEntityIds && Array.isArray(state.activeEntityIds)) {
      activeEntities = modelEntities.filter((e) => state.activeEntityIds.includes(e.id));
    } else if (graphEntities.length > 0) {
      activeEntities = graphEntities;
    } else if (modelEntities.length > 0) {
      activeEntities = modelEntities;
    }

    if (metrics.length === 0) {
      const cpu = activeEntities.find(
        (e: any) =>
          e.semanticRole === "server" ||
          (e.label && e.label.toLowerCase().includes("cpu")),
      );
      const runningProc = activeEntities.find(
        (e: any) =>
          e.state === "running" ||
          e.semanticRole === "process" ||
          e.semanticRole === "cpu_running" ||
          (e.label && e.label.toLowerCase().includes("process")),
      );
      const readyQueue = activeEntities.filter(
        (e: any) => e.state === "ready" || e.semanticRole === "queue_item",
      );

      if (cpu) {
        metrics.push({ label: "CPU Core", value: cpu.label || "Core 0" });
      }
      if (runningProc) {
        metrics.push({
          label: "Active Process",
          value: runningProc.label || runningProc.id,
          badgeColor: "#16a34a",
        });
      }
      metrics.push({
        label: "Ready Queue",
        value: readyQueue.length > 0 ? `${readyQueue.length} processes` : "Empty",
      });
      metrics.push({ label: "Total Processes", value: Math.max(1, activeEntities.length) });
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
      title: "OS Runtime State",
      subtitle: "Process state machine, CPU dispatch, and scheduling queue",
      metrics,
      properties,
      sections,
      statusBadge: transformation?.inspectorData?.statusBadge || `State ${stateIdx + 1}`,
      operation: transformation?.action || transformation?.title,
      resultSummary: transformation?.reason || transformation?.learnerObservation,
    };
  },
};
