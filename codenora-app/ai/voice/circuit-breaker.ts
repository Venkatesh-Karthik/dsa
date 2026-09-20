/**
 * Chatterbox Circuit Breaker & Health Guard
 *
 * Prevents cascade request storms and UI latency locks when the local or remote
 * Chatterbox TTS service is slow, timing out, or offline.
 *
 * Finite State Machine:
 * - CLOSED: Service is healthy. Requests pass through normally.
 * - OPEN: Consecutive failures exceeded threshold. Rapidly rejects requests without hammering service.
 * - HALF_OPEN: Cooldown period elapsed. Allows a single probe request to test service recovery.
 */

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  timeoutThreshold?: number;
  cooldownPeriodMs?: number;
  cooldownMs?: number;
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private consecutiveTimeouts = 0;
  private readonly failureThreshold: number;
  private readonly timeoutThreshold: number;
  private readonly cooldownPeriodMs: number;
  private lastStateChangeTime = Date.now();
  private halfOpenProbeInFlight = false;
  private onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.timeoutThreshold = options?.timeoutThreshold ?? 2;
    this.cooldownPeriodMs = options?.cooldownMs ?? options?.cooldownPeriodMs ?? 15_000;
    this.onStateChange = options?.onStateChange;
  }

  public getState(): CircuitBreakerState {
    if (this.state === "OPEN") {
      const elapsed = Date.now() - this.lastStateChangeTime;
      if (elapsed >= this.cooldownPeriodMs) {
        this.transitionTo("HALF_OPEN");
      }
    }
    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();
    if (currentState === "CLOSED") {
      return true;
    }
    if (currentState === "HALF_OPEN") {
      if (!this.halfOpenProbeInFlight) {
        this.halfOpenProbeInFlight = true;
        return true;
      }
      return false; // Only 1 probe at a time
    }
    // OPEN
    return false;
  }

  public canAttempt(): boolean {
    return this.canExecute();
  }

  public recordSuccess(): void {
    const previousState = this.state;
    this.consecutiveFailures = 0;
    this.consecutiveTimeouts = 0;
    this.halfOpenProbeInFlight = false;
    if (previousState !== "CLOSED") {
      this.transitionTo("CLOSED");
    }
  }

  public recordFailure(isTimeout = false): void {
    this.consecutiveFailures++;
    if (isTimeout) {
      this.consecutiveTimeouts++;
    }
    this.halfOpenProbeInFlight = false;

    if (this.state === "HALF_OPEN") {
      // Probe failed: back to OPEN with fresh cooldown
      this.transitionTo("OPEN");
    } else if (
      this.consecutiveFailures >= this.failureThreshold ||
      this.consecutiveTimeouts >= this.timeoutThreshold
    ) {
      this.transitionTo("OPEN");
    }
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.consecutiveTimeouts = 0;
    this.halfOpenProbeInFlight = false;
    this.transitionTo("CLOSED");
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public getConsecutiveTimeouts(): number {
    return this.consecutiveTimeouts;
  }

  private transitionTo(nextState: CircuitBreakerState): void {
    if (this.state === nextState) {
      return;
    }
    const from = this.state;
    this.state = nextState;
    this.lastStateChangeTime = Date.now();
    console.info(
      `[COGNORA][VOICE][CIRCUIT_BREAKER] State change: ${from} -> ${nextState} (failures=${this.consecutiveFailures})`,
    );
    this.onStateChange?.(from, nextState);
  }
}

export const circuitBreaker = new CircuitBreaker();
