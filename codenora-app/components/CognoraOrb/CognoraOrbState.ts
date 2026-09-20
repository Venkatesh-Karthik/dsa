/**
 * Cognora Voice ORB State Types & Definitions
 *
 * Tier 1 + Tier 2 + Tier 3 procedural 3D Liquid Glass Voice Presence.
 */

export type OrbBaseState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "PAUSED"
  | "COMPLETED"
  | "ERROR"
  | "VOICE_OFF";

export type OrbModifier = "HOVERING" | "DRAGGING" | "EMPHASIS";

export interface OrbPositionRatio {
  xRatio: number; // 0.0 to 1.0 (viewport width fraction)
  yRatio: number; // 0.0 to 1.0 (viewport height fraction)
}

export interface OrbPixelPosition {
  x: number;
  y: number;
}

export interface ViewportObstacle {
  id: string;
  name: string;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  priority: "critical" | "high" | "medium";
}

export interface AudioBands {
  low: number; // Bass (80 - 300 Hz) -> slow volumetric deformation
  mid: number; // Vocal formants (300 - 2000 Hz) -> surface wave caustics
  high: number; // Consonants (2000 - 5000 Hz) -> specular sparkle & rim glint
  energy: number; // Overall smoothed RMS amplitude (0.0 to 1.0)
}

export interface OrbVisualState {
  scale: number;
  deformation: number;
  rotation: number;
  internalLightPosition: [number, number, number];
  internalLightIntensity: number;
  refraction: number;
  glassOpacity: number;
  edgeHighlight: number;
  auraIntensity: number;
  particleIntensity: number;
  shadowIntensity: number;
  squishX: number;
  squishY: number;
}

/**
 * Procedural WebGL Shader Uniforms
 */
export interface OrbShaderUniforms {
  u_time: number;
  u_resolution: [number, number];
  u_pointer: [number, number]; // Normalized [-1, 1] for 3D parallax
  u_state: number; // Numeric enum for shader branches
  u_audio_energy: number;
  u_audio_low: number;
  u_audio_mid: number;
  u_audio_high: number;
  u_teaching_intensity: number;
  u_squish: [number, number];
  u_drag_velocity: [number, number];
  u_reduced_motion: number; // 0.0 or 1.0
  u_accent_color: [number, number, number]; // Cognora Primary [r, g, b]
  u_core_color: [number, number, number]; // Internal Illumination [r, g, b]
  u_aura_color: [number, number, number]; // Soft atmospheric aura [r, g, b]
  u_tap_time?: number; // Seconds elapsed since last tap (for tactile optical ripple)
  u_screen_pos?: [number, number]; // Viewport pixel coordinates [left, top] for dot refraction
  u_camera_parallax?: [number, number]; // Virtual camera micro-tilt vector [dx, dy]
}

export interface CognoraOrbProps {
  state: OrbBaseState;
  caption?: string;
  showCaption?: boolean;
  analyzer?: any;
  audioElement?: HTMLAudioElement | null;
  teachingIntensity?: number; // 0.0 to 1.0 derived from TeachingMoment
  semanticFocusLabel?: string;
  obstacles?: ViewportObstacle[];
  isVoiceEnabled?: boolean;
  onVoiceToggle?: () => void;
  onClick?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onReplay?: () => void;
  onResetPosition?: () => void;
}

/**
 * Cognora Material Palette Colors for the Procedural 3D Liquid Glass Shader
 * Derived strictly from Cognora tokens:
 * Primary accent: #2563eb (0.145, 0.388, 0.921)
 * Glass tint: #e0eeff (0.878, 0.933, 1.0)
 * Core glow: #3b82f6 (0.231, 0.510, 0.965)
 * Error tint: #ef4444 (0.937, 0.267, 0.267)
 * Warning tint: #f59e0b (0.961, 0.620, 0.043)
 * Paused tint: #64748b (0.392, 0.455, 0.545)
 */
export const COGNORA_PALETTE = {
  primary: [0.145, 0.388, 0.921] as [number, number, number],
  core: [0.231, 0.51, 0.965] as [number, number, number],
  aura: [0.38, 0.68, 0.98] as [number, number, number],
  ambientGlass: [0.95, 0.97, 1.0] as [number, number, number],
  paused: [0.392, 0.455, 0.545] as [number, number, number],
  error: [0.937, 0.267, 0.267] as [number, number, number],
  warning: [0.961, 0.62, 0.043] as [number, number, number],
};

export const ORB_CONSTANTS = {
  DEFAULT_SIZE: 110, // ~110px visual diameter
  MIN_SIZE: 100,
  MAX_SIZE: 130,
  DRAG_THRESHOLD_PX: 5,
  STORAGE_KEY_POSITION: "cognora_voice_orb_position",
  STORAGE_KEY_MANUAL_FLAG: "cognora_voice_orb_is_manual",
};
