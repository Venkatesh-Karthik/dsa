/**
 * Cognora Authoritative Runtime World Model
 *
 * Single authoritative source of truth connecting:
 * - Semantic World / Authoritative Model
 * - Lesson & Transformations
 * - TeachingMoments (current, previous, next)
 * - Visual Scene States & Canvas Bounds
 * - Focus & Selection State
 * - Voice & ORB States
 * - Student State
 * - What-If Branching
 *
 * Canvas, Inspector, Callout, Voice, and ORB are projections of this world model.
 */

import type {
  AuthoritativeSemanticModel,
  AuthoritativeTransformation,
} from "../authoritative-model";
import type { Entity, Relationship, SemanticState } from "../semantic-world";
import type { TeachingMoment } from "../teaching-moment";
import type { CompiledTimeline } from "../transformation-timeline";
import type { SceneState } from "../scene-state";
import type { VoiceState } from "../voice/voice-contract";
import type { OrbBaseState } from "../../components/CognoraOrb/CognoraOrbState";
import type {
  VisualLesson,
  Transformation as SemanticTransformation,
} from "../visual-dsl";
import type { ChatMessage } from "../../components/AITeachingAgent";
import { type StudentState, createInitialStudentState } from "./student-state";
import type { CounterfactualResult } from "../counterfactual-engine";

export interface WhatIfBranch {
  branchId: string;
  parentBranchId?: string;
  parentWorldVersion?: number;
  worldVersion?: number;
  description: string;
  parentMomentIndex: number;
  parentMomentId: string;
  baseModel: AuthoritativeSemanticModel;
  mutatedModel: AuthoritativeSemanticModel;
  branchMoments: TeachingMoment[];
  branchSceneState: SceneState;
  counterfactualResult?: CounterfactualResult;
  createdAt: number;
}

export interface TeachingDetour {
  detourId: string;
  parentMomentIndex: number;
  parentMomentId: string;
  reason: string;
  detourMoment: TeachingMoment;
  returnPacing?: "slower" | "faster" | "normal";
  createdAt: number;
}

export interface FocusTargetState {
  focusedEntityId?: string;
  focusedRelationshipId?: string;
  label?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PlaybackStateSnapshot {
  status: "IDLE" | "PLAYING" | "PAUSED" | "COMPLETED" | "TRANSITIONING";
  currentIndex: number;
  totalSteps: number;
  speed: number;
}

/**
 * Authoritative Semantic World Master Contract
 * The single source of truth for Cognora.
 */
export interface AuthoritativeSemanticWorld {
  lesson: VisualLesson | null;
  generationId: string;
  worldVersion: number;
  branchId: string;
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;
  currentState: SemanticState | null;
  transformations: AuthoritativeTransformation[];
  currentTransformation: SemanticTransformation | null;
  focus: FocusTargetState;
  selection: string[];
  playback: PlaybackStateSnapshot;
  learnerContext: StudentState;
}

export interface CognoraWorldState {
  // Authoritative Core
  generationId: string;
  worldVersion: number;
  branchId: string;
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;
  currentState: SemanticState | null;
  transformations: AuthoritativeTransformation[];
  selectedEntityIds: string[];
  learnerContext: StudentState;

  // Projections & Views
  lesson: VisualLesson | null;
  timeline: CompiledTimeline | null;
  currentTransformation: SemanticTransformation | null;
  currentMoment: TeachingMoment | null;
  previousMoment: TeachingMoment | null;
  nextMoment: TeachingMoment | null;
  visualState: SceneState | null;
  canvasBoundIds: string[];
  focusState: FocusTargetState;
  voiceState: VoiceState;
  orbState: OrbBaseState;
  conversationState: ChatMessage[];
  studentState: StudentState;
  playbackState: PlaybackStateSnapshot;
  activeBranch: WhatIfBranch | null;
  activeDetour: TeachingDetour | null;
  verificationState: {
    isValid: boolean;
    lastChecked: number;
    errors: string[];
  };
}

export type WorldModelListener = (state: Readonly<CognoraWorldState>) => void;

export class CognoraWorldModel {
  private state: CognoraWorldState;
  private listeners: Set<WorldModelListener> = new Set();

  constructor() {
    const initialStudent = createInitialStudentState();
    this.state = {
      generationId: "GEN-INIT",
      worldVersion: 1,
      branchId: "MAIN",
      entities: new Map(),
      relationships: new Map(),
      currentState: null,
      transformations: [],
      selectedEntityIds: [],
      learnerContext: initialStudent,

      lesson: null,
      timeline: null,
      currentTransformation: null,
      currentMoment: null,
      previousMoment: null,
      nextMoment: null,
      visualState: null,
      canvasBoundIds: [],
      focusState: {},
      voiceState: "idle",
      orbState: "IDLE",
      conversationState: [],
      studentState: initialStudent,
      playbackState: {
        status: "IDLE",
        currentIndex: 0,
        totalSteps: 0,
        speed: 1.0,
      },
      activeBranch: null,
      activeDetour: null,
      verificationState: {
        isValid: true,
        lastChecked: Date.now(),
        errors: [],
      },
    };
  }

  public getState(): Readonly<CognoraWorldState> {
    return this.state;
  }

  /**
   * Returns the consolidated authoritative semantic world projection.
   */
  public getAuthoritativeWorld(): AuthoritativeSemanticWorld {
    return {
      lesson: this.state.lesson,
      generationId: this.state.generationId,
      worldVersion: this.state.worldVersion,
      branchId: this.state.branchId,
      entities: new Map(this.state.entities),
      relationships: new Map(this.state.relationships),
      currentState: this.state.currentState,
      transformations: [...this.state.transformations],
      currentTransformation: this.state.currentTransformation,
      focus: { ...this.state.focusState },
      selection: [...this.state.selectedEntityIds],
      playback: { ...this.state.playbackState },
      learnerContext: { ...this.state.studentState },
    };
  }

  public setAuthoritativeContext(
    generationId: string,
    worldVersion: number = 1,
    branchId: string = "MAIN",
  ): void {
    this.state.generationId = generationId;
    this.state.worldVersion = worldVersion;
    this.state.branchId = branchId;
    this.notify();
  }

  public setSelection(entityIds: string[]): void {
    this.state.selectedEntityIds = [...entityIds];
    this.notify();
  }

  public subscribe(listener: WorldModelListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const readonlyState = Object.freeze({ ...this.state });
    this.listeners.forEach((l) => {
      try {
        l(readonlyState);
      } catch (err) {
        console.error("[COGNORA][WORLD][LISTENER_ERROR]", err);
      }
    });
  }

  /**
   * Updates active lesson and compiled timeline
   */
  public setLesson(
    lesson: VisualLesson | null,
    timeline: CompiledTimeline | null,
    options?: {
      generationId?: string;
      worldVersion?: number;
      branchId?: string;
    },
  ): void {
    this.state.lesson = lesson;
    this.state.timeline = timeline;
    this.state.activeBranch = null; // Clear branch on new lesson

    if (options?.generationId) {
      this.state.generationId = options.generationId;
    } else if ((lesson as any)?.generationId) {
      this.state.generationId = (lesson as any).generationId;
    }
    if (options?.worldVersion !== undefined) {
      this.state.worldVersion = options.worldVersion;
    }
    if (options?.branchId) {
      this.state.branchId = options.branchId;
    }

    // Populate authoritative transformations
    if (timeline?.model?.transformations) {
      this.state.transformations = [...timeline.model.transformations];
    } else {
      this.state.transformations = [];
    }

    const moments = timeline?.moments || [];
    this.state.playbackState = {
      status: "IDLE",
      currentIndex: 0,
      totalSteps: moments.length,
      speed: 1.0,
    };

    if (moments.length > 0) {
      this.state.currentMoment = moments[0];
      this.state.previousMoment = null;
      this.state.nextMoment = moments[1] || null;
      this.state.visualState = moments[0].visualState || null;
      this.state.currentTransformation = lesson?.transformations?.[0] || null;

      // Extract initial semantic entities and relationships
      const initialSemanticState = timeline?.model?.states?.[0] || null;
      this.state.currentState = initialSemanticState;
      if (initialSemanticState) {
        this.state.entities = new Map(initialSemanticState.entities);
        this.state.relationships = new Map(initialSemanticState.relationships);
      }
    } else {
      this.state.currentMoment = null;
      this.state.previousMoment = null;
      this.state.nextMoment = null;
      this.state.visualState = null;
      this.state.currentTransformation = null;
      this.state.currentState = null;
      this.state.entities.clear();
      this.state.relationships.clear();
    }

    if (lesson?.concept) {
      this.state.studentState.currentConcept = lesson.concept;
      this.state.learnerContext.currentConcept = lesson.concept;
    }

    console.log(
      `[COGNORA][WORLD] lessonSet="${lesson?.title || "none"}" totalMoments=${
        moments.length
      } genId=${this.state.generationId} branch=${this.state.branchId}`,
    );
    this.notify();
  }

  /**
   * Sets the active TeachingMoment atomically
   */
  public setCurrentMoment(stepIndex: number): void {
    const moments = this.state.activeBranch
      ? this.state.activeBranch.branchMoments
      : this.state.timeline?.moments || [];

    if (stepIndex < 0 || stepIndex >= moments.length) {
      return;
    }

    const curr = moments[stepIndex];
    this.state.currentMoment = curr;
    this.state.previousMoment = stepIndex > 0 ? moments[stepIndex - 1] : null;
    this.state.nextMoment =
      stepIndex < moments.length - 1 ? moments[stepIndex + 1] : null;
    this.state.visualState = curr.visualState || null;

    if (this.state.lesson?.transformations) {
      this.state.currentTransformation =
        this.state.lesson.transformations[stepIndex] || null;
    }

    this.state.playbackState.currentIndex = stepIndex;

    const fromVersion = this.state.worldVersion;
    const toVersion = curr.worldVersion ?? stepIndex + 1;
    this.state.worldVersion = toVersion;

    console.log(
      `[COGNORA][WORLD][TRANSITION] fromVersion=${fromVersion} toVersion=${toVersion} transformationId=${curr.transformationId} affectedEntities=${curr.affectedEntities?.join(",") || "none"} affectedRelationships=${curr.affectedRelationships?.join(",") || "none"}`,
    );

    // Update active semantic state from authoritative model
    const baseModel = this.state.activeBranch
      ? this.state.activeBranch.baseModel
      : this.state.timeline?.model;
    const activeSemanticState = baseModel?.states?.[stepIndex] || null;
    this.state.currentState = activeSemanticState;
    if (activeSemanticState) {
      this.state.entities = new Map(activeSemanticState.entities);
      this.state.relationships = new Map(activeSemanticState.relationships);
    }

    // Update focus state from TeachingMoment
    if (curr.semanticFocus) {
      this.state.focusState = {
        focusedEntityId: curr.semanticFocus.entityIds?.[0],
        focusedRelationshipId: curr.semanticFocus.relationshipIds?.[0],
        label: curr.semanticFocus.label,
      };
    }

    console.log(
      `[COGNORA][WORLD] momentChanged index=${stepIndex}/${moments.length} id=${
        curr.id
      } focus=${curr.semanticFocus?.label || "none"}`,
    );
    this.notify();
  }

  /**
   * Updates playback controller status
   */
  public updatePlaybackState(partial: Partial<PlaybackStateSnapshot>): void {
    this.state.playbackState = {
      ...this.state.playbackState,
      ...partial,
    };
    this.notify();
  }

  /**
   * Updates focus target explicitly
   */
  public setFocusTarget(target: FocusTargetState): void {
    this.state.focusState = { ...target };
    console.log(
      `[COGNORA][WORLD] focusUpdated target=${
        target.label || target.focusedEntityId || "none"
      }`,
    );
    this.notify();
  }

  /**
   * Updates voice playback state
   */
  public setVoiceState(voiceState: VoiceState): void {
    this.state.voiceState = voiceState;
    // Synchronize ORB state when voice changes
    if (voiceState === "speaking") {
      this.state.orbState = "SPEAKING";
    } else if (voiceState === "preparing") {
      this.state.orbState = "THINKING";
    } else if (voiceState === "paused") {
      this.state.orbState = "PAUSED";
    } else if (voiceState === "idle" && this.state.orbState === "SPEAKING") {
      this.state.orbState = "IDLE";
    }
    this.notify();
  }

  /**
   * Updates ORB state explicitly
   */
  public setOrbState(orbState: OrbBaseState): void {
    this.state.orbState = orbState;
    console.log(`[COGNORA][WORLD] orbState=${orbState}`);
    this.notify();
  }

  /**
   * Appends conversation turn with bounded memory
   */
  public appendConversation(message: ChatMessage): void {
    // Keep max 12 most recent turns in bounded conversation memory
    this.state.conversationState = [
      ...this.state.conversationState.slice(-11),
      message,
    ];
    if (message.role === "user") {
      this.state.studentState.recentQuestions = [
        message.content,
        ...this.state.studentState.recentQuestions.slice(0, 6),
      ];
    }
    this.notify();
  }

  public getBoundedConversation(): ChatMessage[] {
    return [...this.state.conversationState];
  }

  /**
   * Updates student state
   */
  public updateStudentState(updater: (state: StudentState) => void): void {
    updater(this.state.studentState);
    this.notify();
  }

  /**
   * Sets canvas bound IDs (projected elements)
   */
  public setCanvasBoundIds(ids: string[]): void {
    this.state.canvasBoundIds = [...ids];
  }

  /**
   * Enters a What-If counterfactual branch
   */
  public enterBranch(branch: WhatIfBranch): void {
    this.state.activeBranch = branch;
    this.state.activeDetour = null;
    console.log(
      `[COGNORA][BRANCH][CREATE] parentBranch=${branch.parentBranchId || "MAIN"} branchId=${branch.branchId} parentWorldVersion=${branch.parentWorldVersion ?? this.state.worldVersion} reason="${branch.description}"`,
    );
    if (branch.branchMoments.length > 0) {
      const firstBranchMoment = branch.branchMoments[0];
      this.state.currentMoment = firstBranchMoment;
      this.state.visualState = firstBranchMoment.visualState;
      this.state.playbackState = {
        status: "PAUSED",
        currentIndex: 0,
        totalSteps: branch.branchMoments.length,
        speed: 1.0,
      };
    }
    console.log(
      `[COGNORA][WORLD] enterBranch id=${branch.branchId} desc="${branch.description}"`,
    );
    this.notify();
  }

  /**
   * Exits What-If branch and restores original timeline state
   */
  public exitBranch(): void {
    if (!this.state.activeBranch) {
      return;
    }
    const parentIndex = this.state.activeBranch.parentMomentIndex;
    console.log(
      `[COGNORA][WORLD] exitBranch returning to parentIndex=${parentIndex}`,
    );
    this.state.activeBranch = null;
    this.state.activeDetour = null;

    const moments = this.state.timeline?.moments || [];
    this.state.playbackState = {
      status: "PAUSED",
      currentIndex: parentIndex,
      totalSteps: moments.length,
      speed: 1.0,
    };

    this.setCurrentMoment(parentIndex);
  }

  public isInWhatIfBranch(): boolean {
    return this.state.activeBranch !== null;
  }

  public getActiveBranch(): WhatIfBranch | null {
    return this.state.activeBranch;
  }

  /**
   * Enters a temporary teaching detour without mutating the main lesson
   */
  public enterDetour(detour: TeachingDetour): void {
    this.state.activeDetour = detour;
    this.state.currentMoment = detour.detourMoment;
    this.state.visualState = detour.detourMoment.visualState;
    console.log(
      `[COGNORA][DETOUR][ENTER] id=${detour.detourId} parentIndex=${detour.parentMomentIndex} reason="${detour.reason}"`,
    );
    this.notify();
  }

  /**
   * Exits the current detour and restores the exact main lesson moment
   */
  public exitDetour(): void {
    if (!this.state.activeDetour) {
      return;
    }
    const parentIndex = this.state.activeDetour.parentMomentIndex;
    console.log(
      `[COGNORA][DETOUR][EXIT] returning to parentIndex=${parentIndex}`,
    );
    this.state.activeDetour = null;
    this.setCurrentMoment(parentIndex);
  }

  public isInDetour(): boolean {
    return this.state.activeDetour !== null;
  }

  public getActiveDetour(): TeachingDetour | null {
    return this.state.activeDetour;
  }

  /**
   * Verification invariant check
   */
  public recordVerification(isValid: boolean, errors: string[] = []): void {
    this.state.verificationState = {
      isValid,
      lastChecked: Date.now(),
      errors,
    };
    this.notify();
  }
}
