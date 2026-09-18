/**
 * Universal Visual Reasoning Model — Cognora 5.0
 *
 * Renderer-independent semantic definitions for visual teaching planning:
 * Semantic World
 *       ↓
 * Teaching Objective
 *       ↓
 * Learner Information Priority (Visual Evidence)
 *       ↓
 * Visual Composition Selection
 *       ↓
 * Visual Element Selection
 *       ↓
 * Relationship / Connector Planning
 *       ↓
 * Spatial Hierarchy & Intent Planning
 *       ↓
 * Transformation Visual Planning
 *       ↓
 * Visual Quality Validation & Repair
 *       ↓
 * Deterministic Layout & Scene Graph Compilation
 */

export type InformationPriority =
  | "PRIMARY"
  | "SUPPORTING"
  | "CONTEXT"
  | "TEMPORARY"
  | "DERIVED"
  | "REDUNDANT";

export type CompositionStrategy =
  | "structural"
  | "hierarchical"
  | "sequence"
  | "interaction"
  | "state-transition"
  | "process"
  | "pipeline"
  | "data-flow"
  | "timeline"
  | "cycle"
  | "comparison"
  | "transformation"
  | "before-after"
  | "input-output"
  | "architecture"
  | "layered"
  | "spatial"
  | "tabular"
  | "mathematical"
  | "causal"
  | "dependency"
  | "network"
  | "memory-layout"
  | "composite";

export type ReadingDirection =
  | "left_to_right"
  | "top_to_bottom"
  | "radial"
  | "center_outward"
  | "source_to_destination"
  | "before_to_after";

export type VisualPriority = "PRIMARY" | "SECONDARY" | "TERTIARY";

export type RelationshipCategory =
  | "containment"
  | "dependency"
  | "causality"
  | "data_flow"
  | "control_flow"
  | "message_transmission"
  | "invocation"
  | "reference"
  | "ownership"
  | "transformation"
  | "temporal_sequence"
  | "state_transition"
  | "comparison"
  | "parent_child"
  | "spatial_proximity"
  | "conflict_contradiction"
  | "support"
  | "association";

export type ConnectorRouting = "direct" | "elbowed" | "curved";

export type ConnectorDirection =
  | "forward"
  | "backward"
  | "bidirectional"
  | "none";

export interface VisualEvidenceItem {
  id: string;
  kind: "entity" | "relationship" | "value" | "action";
  priority: InformationPriority;
  reason: string;
  shouldRender: boolean;
  visualWeight: "heavy" | "medium" | "light" | "hidden";
}

export interface VisualEvidencePlan {
  items: Map<string, VisualEvidenceItem>;
  primaryEntityIds: string[];
  supportingEntityIds: string[];
  contextEntityIds: string[];
  temporaryEntityIds: string[];
  redundantEntityIds: string[];
}

export interface VisualCompositionPlan {
  primaryStrategy: CompositionStrategy;
  secondaryStrategies: CompositionStrategy[];
  isComposite: boolean;
  readingDirection: ReadingDirection;
  rankAxis: "horizontal" | "vertical";
  rationale: string;
}

export interface VisualElementPlanItem {
  entityId: string;
  capabilityId: string;
  visualRole: string;
  priority: VisualPriority;
  label: string;
  displayValue?: string | number;
  state?: string;
  shape: "rectangle" | "ellipse" | "container" | "diamond" | "pill" | "table";
  minDimensions: { width: number; height: number };
  containerId?: string;
  highlight?: string;
  properties: Record<string, unknown>;
}

export interface VisualElementPlan {
  elements: Map<string, VisualElementPlanItem>;
}

export interface PlannedRelationship {
  id: string;
  source: string;
  target: string;
  category: RelationshipCategory;
  label?: string;
  direction: ConnectorDirection;
  routing: ConnectorRouting;
  visualWeight: "strong" | "normal" | "subtle";
  isAnimated: boolean;
  isPersistent: boolean;
  isConnectorNeeded: boolean;
  causalMeaning?: string;
  properties: Record<string, unknown>;
}

export interface RelationshipPlan {
  relationships: Map<string, PlannedRelationship>;
}

export interface SpatialRank {
  rankIndex: number;
  entityIds: string[];
  alignment: "start" | "center" | "end";
}

export interface SpatialGroup {
  id: string;
  label?: string;
  entityIds: string[];
  style?: "box" | "cluster" | "swimlane";
}

export interface SpatialIntentPlan {
  readingDirection: ReadingDirection;
  focalEntityId?: string;
  ranks: SpatialRank[];
  groups: SpatialGroup[];
  minSpacingX: number;
  minSpacingY: number;
}

export interface VisualTransformationStepPlan {
  stepIndex: number;
  title: string;
  explanation: string;
  whatChanged: string;
  whyChanged: string;
  learnerObservation: string;
  whatItEnables: string;
  whatMustNowBeTrue: string;
  enteringEntities: string[];
  exitingEntities: string[];
  persistentEntities: string[];
  mutatedEntities: string[];
  activeConnectors: string[];
  decisionEvaluation?: {
    condition: string;
    outcome: string;
  };
}

export interface VisualTransformationPlan {
  steps: VisualTransformationStepPlan[];
  dynamicStepCount: number;
  rationale: string;
}

export interface VisualQualityDimensionScores {
  semanticCoverage: number;
  visualRelevance: number;
  relationshipVisibility: number;
  directionClarity: number;
  spatialClarity: number;
  readingOrder: number;
  collisionSafety: number;
  annotationSafety: number;
  transformationClarity: number;
  explanationSynchronization: number;
  visualHierarchy: number;
  informationDensity: number;
  redundancyControl: number;
  goalVisibility: number;
}

export interface VisualQualityDefect {
  code: string;
  message: string;
  severity: "critical" | "warning";
  stepIndex?: number;
  entityId?: string;
  relationshipId?: string;
  remedyHint?: string;
}

export interface VisualQualityReport {
  overallScore: number; // 0 to 100
  isPassing: boolean;
  dimensions: VisualQualityDimensionScores;
  defects: VisualQualityDefect[];
  repairRecommended: boolean;
}

export interface VisualReasoningPlan {
  id: string;
  concept: string;
  teachingObjective: string;
  intent: string;
  evidencePlan: VisualEvidencePlan;
  compositionPlan: VisualCompositionPlan;
  elementPlan: VisualElementPlan;
  relationshipPlan: RelationshipPlan;
  spatialIntentPlan: SpatialIntentPlan;
  transformationPlan: VisualTransformationPlan;
  qualityReport?: VisualQualityReport;
  timestamp: number;
}
