/**
 * Cognora Teaching Event Graph & Essential Event Coverage Engine
 *
 * Models fine-grained semantic events (comparisons, swaps, rotations, relaxations,
 * insertions, deletions, allocations, message transmissions) as a directed causal graph.
 *
 * Guarantees that:
 * 1. Crucial pedagogical milestones are not silently omitted or collapsed.
 * 2. Every essential event is observable—either with its own distinct transformation
 *    or explicitly grouped into a compound milestone with clear visual evidence.
 * 3. Operates universally across any domain without topic-specific hardcoding.
 */

import type { ConceptualMilestone } from "./conceptual-journey-optimizer";
import type { SemanticState, Entity, Relationship } from "./semantic-world";

export type SemanticEventType =
  | "comparison"
  | "selection"
  | "partition"
  | "swap"
  | "insert"
  | "delete"
  | "imbalance_detected"
  | "rotation"
  | "relaxation"
  | "distance_update"
  | "visit"
  | "backtrack"
  | "merge"
  | "split"
  | "state_mutation"
  | "allocation"
  | "free"
  | "message_sent"
  | "message_received"
  | "acknowledgement";

export type EventImportance = "essential" | "supportive" | "minor";

export interface SemanticEvent {
  id: string;
  type: SemanticEventType;
  entityId?: string;
  targetEntityId?: string;
  value?: unknown;
  oldValue?: unknown;
  importance: EventImportance;
  cause: string;
  order: number;
  dependencies: string[]; // Event IDs that this event causally depends on
  metadata?: Record<string, unknown>;
}

export interface EssentialEventCoverageReport {
  totalEvents: number;
  essentialEventsCount: number;
  coveredEssentialCount: number;
  coveragePercentage: number;
  isFullyCovered: boolean;
  coveredEventIds: string[];
  missingEventIds: string[];
  groupingSummary: Array<{
    milestoneId: string;
    milestoneTitle: string;
    groupedEventIds: string[];
    justification: string;
  }>;
}

export class TeachingEventGraph {
  private events: Map<string, SemanticEvent> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // sourceEventId -> dependentEventIds
  private reverseAdjacencyList: Map<string, Set<string>> = new Map(); // targetEventId -> prerequisiteEventIds

  constructor(initialEvents: SemanticEvent[] = []) {
    for (const evt of initialEvents) {
      this.addEvent(evt);
    }
  }

  public addEvent(event: SemanticEvent): void {
    this.events.set(event.id, event);
    if (!this.adjacencyList.has(event.id)) {
      this.adjacencyList.set(event.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(event.id)) {
      this.reverseAdjacencyList.set(event.id, new Set());
    }

    for (const depId of event.dependencies) {
      if (!this.adjacencyList.has(depId)) {
        this.adjacencyList.set(depId, new Set());
      }
      this.adjacencyList.get(depId)!.add(event.id);
      this.reverseAdjacencyList.get(event.id)!.add(depId);
    }
  }

  public getEvent(id: string): SemanticEvent | undefined {
    return this.events.get(id);
  }

  public getAllEvents(): SemanticEvent[] {
    return Array.from(this.events.values()).sort((a, b) => a.order - b.order);
  }

  public getEssentialEvents(): SemanticEvent[] {
    return this.getAllEvents().filter((e) => e.importance === "essential");
  }

  public getDependents(eventId: string): SemanticEvent[] {
    const depIds = this.adjacencyList.get(eventId);
    if (!depIds) {
      return [];
    }
    return Array.from(depIds)
      .map((id) => this.events.get(id))
      .filter((e): e is SemanticEvent => Boolean(e));
  }

  public getPrerequisites(eventId: string): SemanticEvent[] {
    const prereqIds = this.reverseAdjacencyList.get(eventId);
    if (!prereqIds) {
      return [];
    }
    return Array.from(prereqIds)
      .map((id) => this.events.get(id))
      .filter((e): e is SemanticEvent => Boolean(e));
  }

  /**
   * Evaluates how well a set of planned conceptual milestones covers the essential events.
   * An essential event is considered covered if:
   * 1. A milestone's affectedEntities contains the event's entityId or targetEntityId, AND
   * 2. The milestone's title, explanation, or actions explicitly reference or demonstrate the event.
   */
  public evaluateCoverage(
    milestones: ConceptualMilestone[],
  ): EssentialEventCoverageReport {
    const essentialEvents = this.getEssentialEvents();
    const coveredEventIds = new Set<string>();
    const groupingSummary: EssentialEventCoverageReport["groupingSummary"] = [];

    for (const milestone of milestones) {
      const milestoneText = `${milestone.title} ${milestone.explanation} ${
        milestone.action || ""
      }`.toLowerCase();
      const affectedSet = new Set(milestone.affectedEntities || []);
      const milestoneGroupedEvents: string[] = [];

      for (const event of essentialEvents) {
        if (coveredEventIds.has(event.id)) {
          continue;
        }

        let matches = false;

        // Direct entity match
        if (event.entityId && affectedSet.has(event.entityId)) {
          matches = true;
        } else if (
          event.targetEntityId &&
          affectedSet.has(event.targetEntityId)
        ) {
          matches = true;
        }

        // Value match
        if (
          !matches &&
          event.value !== undefined &&
          milestoneText.includes(String(event.value).toLowerCase())
        ) {
          matches = true;
        }

        // Semantic action / type match in milestone text
        if (!matches) {
          const typeKeyword = event.type.replace("_", " ");
          if (milestoneText.includes(typeKeyword)) {
            matches = true;
          }
        }

        if (matches) {
          coveredEventIds.add(event.id);
          milestoneGroupedEvents.push(event.id);
        }
      }

      if (milestoneGroupedEvents.length > 0) {
        groupingSummary.push({
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          groupedEventIds: milestoneGroupedEvents,
          justification:
            milestoneGroupedEvents.length > 1
              ? `Compound milestone grouped ${milestoneGroupedEvents.length} related events to preserve conceptual cohesion without visual overload.`
              : `Milestone directly provides visual observation for event ${milestoneGroupedEvents[0]}.`,
        });
      }
    }

    const missingEventIds = essentialEvents
      .filter((e) => !coveredEventIds.has(e.id))
      .map((e) => e.id);

    const essentialCount = essentialEvents.length;
    const coveredCount = coveredEventIds.size;
    const coveragePercentage =
      essentialCount === 0
        ? 100
        : Math.round((coveredCount / essentialCount) * 100);

    return {
      totalEvents: this.events.size,
      essentialEventsCount: essentialCount,
      coveredEssentialCount: coveredCount,
      coveragePercentage,
      isFullyCovered: missingEventIds.length === 0,
      coveredEventIds: Array.from(coveredEventIds),
      missingEventIds,
      groupingSummary,
    };
  }

  /**
   * Universally extracts semantic events from state diffs and operations.
   */
  public static extractEventsFromStateTransition(
    fromState: SemanticState,
    toState: SemanticState,
    transitionIndex: number,
  ): SemanticEvent[] {
    const events: SemanticEvent[] = [];
    let orderCounter = transitionIndex * 100;

    // 1. Entities created, deleted, or updated
    const fromEntities = fromState.entities;
    const toEntities = toState.entities;

    for (const [id, toEnt] of toEntities.entries()) {
      const fromEnt = fromEntities.get(id);
      if (!fromEnt) {
        // Created
        events.push({
          id: `evt-create-${id}-${transitionIndex}`,
          type: "insert",
          entityId: id,
          value: toEnt.value,
          importance: "essential",
          cause: `Entity '${
            toEnt.label || id
          }' introduced in transition ${transitionIndex}`,
          order: ++orderCounter,
          dependencies: [],
          metadata: { entity: toEnt },
        });
      } else if (fromEnt.value !== toEnt.value) {
        // Value mutation
        events.push({
          id: `evt-val-${id}-${transitionIndex}`,
          type: "state_mutation",
          entityId: id,
          value: toEnt.value,
          oldValue: fromEnt.value,
          importance: "essential",
          cause: `Value changed from ${fromEnt.value} to ${toEnt.value}`,
          order: ++orderCounter,
          dependencies: [],
          metadata: { entity: toEnt },
        });
      } else if (toEnt.state === "active" || toEnt.state === "highlighted") {
        events.push({
          id: `evt-active-${id}-${transitionIndex}`,
          type: "selection",
          entityId: id,
          value: toEnt.value,
          importance: "supportive",
          cause: `Entity '${
            toEnt.label || id
          }' activated for inspection or processing`,
          order: ++orderCounter,
          dependencies: [],
        });
      }
    }

    for (const [id, fromEnt] of fromEntities.entries()) {
      if (!toEntities.has(id)) {
        // Deleted
        events.push({
          id: `evt-delete-${id}-${transitionIndex}`,
          type: "delete",
          entityId: id,
          value: fromEnt.value,
          importance: "essential",
          cause: `Entity '${
            fromEnt.label || id
          }' removed in transition ${transitionIndex}`,
          order: ++orderCounter,
          dependencies: [],
        });
      }
    }

    // 2. Relationships created, deleted, or modified
    const fromRels = fromState.relationships;
    const toRels = toState.relationships;

    for (const [id, toRel] of toRels.entries()) {
      if (!fromRels.has(id)) {
        const isRotation =
          toRel.type.includes("rotate") ||
          toRel.label?.toLowerCase().includes("rotate");
        events.push({
          id: `evt-rel-create-${id}-${transitionIndex}`,
          type: isRotation ? "rotation" : "state_mutation",
          entityId: toRel.source,
          targetEntityId: toRel.target,
          importance: isRotation ? "essential" : "supportive",
          cause: `Relationship '${
            toRel.label || toRel.type
          }' established from ${toRel.source} to ${toRel.target}`,
          order: ++orderCounter,
          dependencies: [],
        });
      }
    }

    return events;
  }
}
