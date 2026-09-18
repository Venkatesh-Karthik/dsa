/**
 * Domain Knowledge Module Types
 *
 * Provides domain-specific heuristics, invariant checks, typical strategies,
 * misconceptions, and dynamic inspector metric extraction.
 *
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * Domain knowledge modules inform MEANING and METRICS.
 * They do NOT perform layout, visual geometry, or Excalidraw element rendering.
 */

import type {
  ConceptDomain,
  TeachingStrategy,
  ConceptInvariant,
  ConceptMisconception,
  ConceptState,
  ConceptTransformation,
  ConceptModel,
} from "../concept-model";

export interface ExtractedInspectorData {
  title?: string;
  subtitle?: string;
  metrics: Array<{
    label: string;
    value: string | number;
    badgeColor?: string;
  }>;
  properties: Array<{
    label: string;
    value: string | number;
  }>;
  sections?: Array<{
    title: string;
    properties: Array<{ label: string; value: string | number }>;
  }>;
  statusBadge?: string;
  operation?: string;
  resultSummary?: string;
}

export interface DomainKnowledgeModule {
  readonly id: string;
  readonly domain: ConceptDomain;
  readonly name: string;
  readonly description: string;

  /** Checks whether this domain module recognizes the concept or prompt */
  matches(concept: string, prompt?: string): boolean;

  /** Suggests the most pedagogically appropriate teaching strategy */
  suggestStrategy(concept: string, prompt?: string): TeachingStrategy;

  /** Domain-level invariants that must hold */
  getInvariants(concept: string): ConceptInvariant[];

  /** Typical beginner misconceptions in this domain */
  getMisconceptions(concept: string): ConceptMisconception[];

  /** Dynamically extracts Inspector metrics and properties for a given state & transformation */
  extractInspectorData(
    state: ConceptState,
    transformation?: ConceptTransformation,
    model?: ConceptModel,
  ): ExtractedInspectorData;
}
