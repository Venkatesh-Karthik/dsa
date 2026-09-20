/**
 * Lesson-Scoped Student State
 *
 * Tracks temporary learner state within the active lesson to drive pedagogical adaptation.
 * Does NOT store permanent profiles or surveillance data.
 */

export type ExplanationDepth = "simple" | "normal" | "detailed" | "technical";
export type PacingPreference = "slower" | "normal" | "faster";

export interface MisconceptionRecord {
  id: string;
  timestamp: number;
  assertion: string;
  contradiction: string;
  correctedConcept: string;
  resolved: boolean;
}

export interface StudentState {
  currentConcept: string;
  confidence: number; // 0.0 (confused) to 1.0 (mastered)
  confusionSignals: number; // Count of "why", "i don't understand", or error pauses
  pace: PacingPreference;
  playbackSpeed: number; // 1.0 default, 0.75 slower, 1.25 faster
  preferredExplanationDepth: ExplanationDepth;
  recentQuestions: string[];
  misconceptions: MisconceptionRecord[];
  consecutiveSuccessfulPredictions: number;
  lastInteractionTime: number;
}

export function createInitialStudentState(concept: string = ""): StudentState {
  return {
    currentConcept: concept,
    confidence: 0.7,
    confusionSignals: 0,
    pace: "normal",
    playbackSpeed: 1.0,
    preferredExplanationDepth: "normal",
    recentQuestions: [],
    misconceptions: [],
    consecutiveSuccessfulPredictions: 0,
    lastInteractionTime: Date.now(),
  };
}

export class StudentStateManager {
  private state: StudentState;

  constructor(initialConcept: string = "") {
    this.state = createInitialStudentState(initialConcept);
  }

  public getState(): Readonly<StudentState> {
    return { ...this.state };
  }

  public setConcept(concept: string): void {
    this.state.currentConcept = concept;
    this.state.lastInteractionTime = Date.now();
  }

  public recordQuestion(question: string): void {
    this.state.recentQuestions = [
      question,
      ...this.state.recentQuestions.slice(0, 7),
    ];
    this.state.lastInteractionTime = Date.now();
  }

  public recordConfusionSignal(): void {
    this.state.confusionSignals += 1;
    this.state.confidence = Math.max(0.2, this.state.confidence - 0.15);
    // If multiple confusion signals occur, automatically suggest simpler explanation
    if (
      this.state.confusionSignals >= 2 &&
      this.state.preferredExplanationDepth === "normal"
    ) {
      this.state.preferredExplanationDepth = "simple";
    }
  }

  public recordPacingChange(pace: PacingPreference): void {
    this.state.pace = pace;
    if (pace === "slower") {
      this.state.playbackSpeed = 0.8;
    } else if (pace === "faster") {
      this.state.playbackSpeed = 1.25;
    } else {
      this.state.playbackSpeed = 1.0;
    }
  }

  public setExplanationDepth(depth: ExplanationDepth): void {
    this.state.preferredExplanationDepth = depth;
  }

  public recordMisconception(
    assertion: string,
    contradiction: string,
    concept: string,
  ): MisconceptionRecord {
    const record: MisconceptionRecord = {
      id: `misc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      assertion,
      contradiction,
      correctedConcept: concept,
      resolved: false,
    };
    this.state.misconceptions = [record, ...this.state.misconceptions];
    this.state.confidence = Math.max(0.1, this.state.confidence - 0.2);
    return record;
  }

  public resolveMisconception(id: string): void {
    const item = this.state.misconceptions.find((m) => m.id === id);
    if (item) {
      item.resolved = true;
      this.state.confidence = Math.min(1.0, this.state.confidence + 0.15);
    }
  }

  public recordPredictionResult(isCorrect: boolean): void {
    if (isCorrect) {
      this.state.consecutiveSuccessfulPredictions += 1;
      this.state.confidence = Math.min(1.0, this.state.confidence + 0.1);
      if (this.state.confusionSignals > 0) {
        this.state.confusionSignals -= 1;
      }
    } else {
      this.state.consecutiveSuccessfulPredictions = 0;
      this.recordConfusionSignal();
    }
  }

  public reset(concept: string = ""): void {
    this.state = createInitialStudentState(concept);
  }
}
