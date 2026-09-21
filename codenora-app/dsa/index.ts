/**
 * Cognora DSA Acceleration Subsystem
 *
 * ARCHITECTURAL BOUNDARY:
 * This module is a TEMPORARY HACKATHON ACCELERATION LAYER designed to provide
 * guaranteed deterministic algorithm execution on dynamic user input for supported
 * DSA concepts.
 *
 * 1. For supported DSA concepts:
 *    Executes the deterministic engine, validates state transitions, and adapts
 *    directly into Cognora's existing TeachingMoment → Layout → Excalidraw pipeline.
 *
 * 2. For unsupported concepts:
 *    Returns { handled: false, reason: "UNSUPPORTED" } so the tutor seamlessly
 *    falls back to the existing Nemotron universal AI pipeline.
 *
 * 3. Isolation:
 *    Can be completely removed or disabled after the hackathon without modifying
 *    Cognora's universal reasoning, visual composition, or layout architecture.
 */

export * from "./types/dsa-concept";
export * from "./types/dsa-state";
export * from "./types/dsa-transformation";
export * from "./types/dsa-engine";
export * from "./types/dsa-errors";

export { DSAConceptRegistry } from "./registry/concept-registry";
export { DSAConceptResolver } from "./resolver/concept-resolver";
export { DSAInputExtractor } from "./parsing/input-extractor";
export { DEFAULT_TEACHING_DATASETS, getDefaultDataset } from "./datasets/default-datasets";
export { DSAStateIntegrityValidator } from "./validation/state-integrity-validator";
export { DSATeachingMomentAdapter, type AdaptedDSALesson } from "./adapter/teaching-moment-adapter";
export { DSAExecutionRouter, type DSARouteResult } from "./execution/dsa-execution-router";

// Full-intent routing layer (new)
export { resolveDSAFullIntent, formatIntentLog, type DSAFullIntent, type DSARoutingReasonCode } from "./intent/dsa-intent-resolver";
export { resolveAction, resolveVariant, resolveOperation, type DSAAction, type DSAVariant, type DSAOperation } from "./intent/dsa-vocabulary";
export { canExecuteDeterministically, getCapability, type DSACapabilityEntry, type CapabilityMatchResult } from "./registry/capability-registry";
export { DSALessonIntentValidator, type LessonIntentValidationResult } from "./validation/lesson-intent-validator";

