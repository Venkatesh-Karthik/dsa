/**
 * AI Teaching Latency Instrumentation Tracker
 *
 * Measures fine-grained end-to-end performance timings (T0 to T7):
 *   T0: User submitted prompt in UI
 *   T1: HTTP request sent to backend
 *   T2: AI model completion received from provider
 *   T3: JSON response parsed
 *   T4: Visual DSL validated and repaired
 *   T5: Semantic state reconstructed / diff computed
 *   T6: Deterministic layout geometry computed
 *   T7: Canvas elements updated and viewport focused
 */

export interface LatencyTimestamps {
  t0_prompt_submit?: number;
  t1_request_sent?: number;
  t2_model_received?: number;
  t3_json_parsed?: number;
  t4_dsl_validated?: number;
  t5_state_reconstructed?: number;
  t6_layout_computed?: number;
  t7_render_complete?: number;
}

export interface LatencyBreakdown {
  totalMs: number;
  clientDispatchMs?: number;
  aiProviderMs?: number;
  validationMs?: number;
  stateEngineMs?: number;
  layoutEngineMs?: number;
  canvasRenderMs?: number;
}

export class LatencyTracker {
  private timestamps: LatencyTimestamps = {};
  private readonly isDev: boolean;

  constructor(isDev: boolean = Boolean(typeof process !== "undefined" ? process.env?.NODE_ENV !== "production" : true)) {
    this.isDev = isDev;
  }

  mark<K extends keyof LatencyTimestamps>(stage: K, time: number = performance.now()): this {
    this.timestamps[stage] = time;
    return this;
  }

  getBreakdown(): LatencyBreakdown {
    const t = this.timestamps;
    const start = t.t0_prompt_submit ?? t.t1_request_sent ?? 0;
    const end = t.t7_render_complete ?? performance.now();
    const totalMs = Math.max(0, Math.round(end - start));

    const clientDispatchMs =
      t.t0_prompt_submit && t.t1_request_sent
        ? Math.max(0, Math.round(t.t1_request_sent - t.t0_prompt_submit))
        : undefined;

    const aiProviderMs =
      t.t1_request_sent && t.t2_model_received
        ? Math.max(0, Math.round(t.t2_model_received - t.t1_request_sent))
        : undefined;

    const validationMs =
      t.t3_json_parsed && t.t4_dsl_validated
        ? Math.max(0, Math.round(t.t4_dsl_validated - t.t3_json_parsed))
        : undefined;

    const stateEngineMs =
      t.t4_dsl_validated && t.t5_state_reconstructed
        ? Math.max(0, Math.round(t.t5_state_reconstructed - t.t4_dsl_validated))
        : undefined;

    const layoutEngineMs =
      t.t5_state_reconstructed && t.t6_layout_computed
        ? Math.max(0, Math.round(t.t6_layout_computed - t.t5_state_reconstructed))
        : undefined;

    const canvasRenderMs =
      t.t6_layout_computed && t.t7_render_complete
        ? Math.max(0, Math.round(t.t7_render_complete - t.t6_layout_computed))
        : undefined;

    return {
      totalMs,
      clientDispatchMs,
      aiProviderMs,
      validationMs,
      stateEngineMs,
      layoutEngineMs,
      canvasRenderMs,
    };
  }

  logSummary(topic?: string): void {
    if (!this.isDev) {
      return;
    }
    const breakdown = this.getBreakdown();
    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `[Cognora Latency] ${topic ? `"${topic}"` : "Lesson"} - Total: ${breakdown.totalMs}ms`,
    );
    // eslint-disable-next-line no-console
    console.table({
      "T0->T1 Client Dispatch": breakdown.clientDispatchMs ? `${breakdown.clientDispatchMs} ms` : "N/A",
      "T1->T2 AI Provider Completion": breakdown.aiProviderMs ? `${breakdown.aiProviderMs} ms` : "N/A",
      "T3->T4 DSL Validation & Repair": breakdown.validationMs ? `${breakdown.validationMs} ms` : "N/A",
      "T4->T5 Semantic State Rebuild": breakdown.stateEngineMs ? `${breakdown.stateEngineMs} ms` : "N/A",
      "T5->T6 Layout Engine": breakdown.layoutEngineMs ? `${breakdown.layoutEngineMs} ms` : "N/A",
      "T6->T7 Canvas Render & Focus": breakdown.canvasRenderMs ? `${breakdown.canvasRenderMs} ms` : "N/A",
      "TOTAL E2E TIME": `${breakdown.totalMs} ms`,
    });
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
}

export function createLatencyTracker(): LatencyTracker {
  return new LatencyTracker();
}
