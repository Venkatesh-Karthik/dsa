/**
 * Cognora Voice ORB Component (Legacy Entry Point)
 *
 * Re-exports the procedural 3D Liquid Glass Voice Presence (CognoraOrb)
 * for backward compatibility with existing imports.
 */

import { CognoraOrb } from "./CognoraOrb/CognoraOrb";

import type {
  CognoraOrbProps,
  OrbBaseState,
} from "./CognoraOrb/CognoraOrbState";

export type VoiceOrbState = OrbBaseState;

export type CognoraVoiceOrbProps = CognoraOrbProps;

export const CognoraVoiceOrb = CognoraOrb;
export default CognoraOrb;
