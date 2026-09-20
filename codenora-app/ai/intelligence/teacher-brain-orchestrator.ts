/**
 * Cognora Teacher Brain Orchestrator
 *
 * The single integration surface that wires together:
 *   CognoraWorldModel  ←→  IntentEngine  ←→  TeacherBrain  ←→  StudentStateManager
 *
 * Call `orchestrate(rawInput, source)` from any input handler (voice transcript
 * callback, chat panel onSubmit, keyboard shortcut, etc.) and it will:
 *
 *  1. Classify the raw input into an InputIntent via IntentEngine
 *  2. Pass intent + world state through TeacherBrain.decide()
 *  3. Apply the resulting LearnerStateUpdate to the StudentStateManager
 *  4. Execute all local side-effects (branch entry/exit, pacing, focus, playback)
 *  5. Return the TeacherDecision to the caller for rendering (narration, inspector, canvas)
 *
 * For decisions that requiresLLM = true, the orchestrator does NOT call the LLM.
 * The caller is responsible for forwarding `decision.llmPrompt` to Nemotron 3 Ultra
 * and feeding the response back via `applyLLMResponse()`.
 *
 * Thread safety: All mutations are synchronous and go through CognoraWorldModel
 * which serialises its own notifications. Safe to call from React event handlers.
 */

import { CognoraWorldModel } from "./cognora-world-model";
import { IntentEngine } from "./intent-engine";
import {
  TeacherBrain,
  computeLearnerUpdate,
  type TeacherDecision,
} from "./teacher-brain";
import { StudentStateManager } from "./student-state";
import type { InputSource } from "./input-intent";

export interface OrchestratorResult {
  /** The final decision from TeacherBrain */
  decision: TeacherDecision;

  /**
   * If requiresLLM = true, call Nemotron with this prompt, then call
   * `orchestrator.applyLLMResponse(llmText)` to complete the interaction.
   */
  llmPrompt?: string;

  /** Whether an LLM call is needed to fully satisfy the learner */
  requiresLLM: boolean;
}

export class TeacherBrainOrchestrator {
  private worldModel: CognoraWorldModel;
  private studentManager: StudentStateManager;

  constructor(
    worldModel: CognoraWorldModel,
    studentManager?: StudentStateManager,
  ) {
    this.worldModel = worldModel;
    this.studentManager =
      studentManager ||
      new StudentStateManager(
        worldModel.getState().studentState.currentConcept,
      );
  }

  // ── Primary Entry Point ────────────────────────────────────────────────────

  /**
   * Process any raw user input from any channel into a TeacherDecision.
   * This is the ONLY method that external code should call for handling
   * learner interactions during a lesson.
   */
  public orchestrate(
    rawInput: string,
    source: InputSource = "keyboard",
  ): OrchestratorResult {
    const worldState = this.worldModel.getState();

    // 1. Classify intent
    const intent = IntentEngine.resolveIntent(rawInput, source, worldState);

    // 2. Decide pedagogical action
    const decision = TeacherBrain.decide(intent, worldState);

    // 3. Apply learner state update
    const learnerUpdate = computeLearnerUpdate(decision, worldState.studentState);
    this._applyLearnerUpdate(learnerUpdate, decision);

    // 4. Execute local side-effects that mutate world model
    this._executeSideEffects(decision);

    // 5. Record the question in conversation history
    this.worldModel.appendConversation({
      id: `msg-${Date.now()}`,
      role: "user",
      content: rawInput,
    });

    return {
      decision,
      llmPrompt: decision.requiresLLM ? decision.llmPrompt : undefined,
      requiresLLM: decision.requiresLLM,
    };
  }

  /**
   * Apply the LLM response text back into the world as an assistant turn.
   * Call this after receiving Nemotron's answer when requiresLLM was true.
   */
  public applyLLMResponse(text: string): void {
    this.worldModel.appendConversation({
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: text,
    });

    // If the LLM filled a WHY/HOW answer, record it positively in learner state
    this.worldModel.updateStudentState((s) => {
      if (s.confusionSignals > 0) {
        s.confusionSignals = Math.max(0, s.confusionSignals - 1);
      }
    });
  }

  /**
   * Directly resolve a follow-up WHY/HOW/WHAT from the current moment,
   * bypassing intent classification.  Returns null if no moment is available.
   */
  public resolveFollowUp(
    query: "WHY" | "HOW" | "WHAT",
  ): { explanation: string; narration: string } | null {
    return TeacherBrain.resolveFollowUp(query, this.worldModel.getState());
  }

  /**
   * Get the current adaptive granularity recommendation.
   * Playback controller should call this before advancing to the next step.
   */
  public getGranularityRecommendation(): number {
    const state = this.worldModel.getState();
    return TeacherBrain.computeAdaptiveGranularity(
      state.studentState,
      state.currentMoment,
    );
  }

  // ── Private Side-Effect Execution ─────────────────────────────────────────

  /**
   * Executes the deterministic, side-effect-free world model mutations
   * implied by a local TeacherDecision.
   */
  private _executeSideEffects(decision: TeacherDecision): void {
    // Detour operations
    if (decision.detourToCreate) {
      this.worldModel.enterDetour(decision.detourToCreate);
    }

    // Branch / Detour exit
    if (decision.shouldExitBranch) {
      if (this.worldModel.isInWhatIfBranch()) {
        this.worldModel.exitBranch();
      }
      if (this.worldModel.isInDetour()) {
        this.worldModel.exitDetour();
      }
    }

    if (decision.branchToCreate) {
      this.worldModel.enterBranch(decision.branchToCreate);
    }

    // Focus state
    if (decision.focusEntityId) {
      this.worldModel.setFocusTarget({
        focusedEntityId: decision.focusEntityId,
        label: decision.focusEntityLabel,
      });
    }

    // Playback
    if (decision.playbackAction === "pause") {
      this.worldModel.updatePlaybackState({ status: "PAUSED" });
    } else if (decision.playbackAction === "resume") {
      this.worldModel.updatePlaybackState({ status: "PLAYING" });
    } else if (decision.playbackAction === "replay") {
      this.worldModel.setCurrentMoment(0);
      this.worldModel.updatePlaybackState({ status: "PLAYING", currentIndex: 0 });
    }

    // Pacing
    if (decision.paceChange) {
      const speed =
        decision.paceChange === "slower"
          ? 0.75
          : decision.paceChange === "faster"
          ? 1.3
          : 1.0;
      this.worldModel.updatePlaybackState({ speed });
    }
  }

  /**
   * Applies a LearnerStateUpdate to the StudentStateManager and syncs
   * the result back into the CognoraWorldModel.
   */
  private _applyLearnerUpdate(
    update: ReturnType<typeof computeLearnerUpdate>,
    decision?: TeacherDecision,
  ): void {
    if (decision) {
      this.studentManager.recordStrategy(decision.strategy);
      if (decision.desiredGranularity) {
        this.studentManager.setPreferredGranularity(decision.desiredGranularity);
      }
      this.studentManager.recordInteraction(decision.strategy, decision.reason);
    }

    this.worldModel.updateStudentState((s) => {
      if (update.confusionDelta !== 0) {
        s.confusionSignals = Math.max(0, s.confusionSignals + update.confusionDelta);
        s.confusionSignal = s.confusionSignals;
      }

      if (update.confidenceDelta !== 0) {
        s.confidence = Math.min(1.0, Math.max(0.0, s.confidence + update.confidenceDelta));
      }

      if (update.paceChange) {
        s.pace = update.paceChange;
        s.playbackSpeed =
          update.paceChange === "slower"
            ? 0.8
            : update.paceChange === "faster"
            ? 1.25
            : 1.0;
      }

      if (update.shouldSwitchDepth) {
        s.preferredExplanationDepth = update.shouldSwitchDepth;
      }

      if (decision) {
        s.strategyHistory = [...(s.strategyHistory || []), decision.strategy];
        if (decision.desiredGranularity) {
          s.preferredGranularity = decision.desiredGranularity;
        }
      }

      s.lastInteractionTime = Date.now();
    });

    console.log(
      `[COGNORA][LEARNER][UPDATE] applied confusionDelta=${update.confusionDelta > 0 ? "+" : ""}${update.confusionDelta} confidenceDelta=${update.confidenceDelta > 0 ? "+" : ""}${update.confidenceDelta.toFixed(2)} reason="${update.reason}"`,
    );
  }
}
