/**
 * Compact Teaching Glimpse / Callout Export
 *
 * Re-exports SemanticTeachingCallout as CompactTeachingGlimpse for seamless backwards compatibility.
 */

export {
  SemanticTeachingCallout,
  CompactTeachingCallout,
  CompactTeachingGlimpse,
} from "./SemanticTeachingCallout";

export type {
  SemanticTeachingCalloutProps,
  SemanticTeachingCalloutProps as CompactTeachingGlimpseProps,
  SemanticTeachingCalloutProps as CompactTeachingCalloutProps,
} from "./SemanticTeachingCallout";
