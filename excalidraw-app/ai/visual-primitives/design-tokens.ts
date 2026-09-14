/**
 * Cognora Centralized Design Token System
 * 
 * This is the SINGLE SOURCE OF TRUTH for the Cognora Visual Language.
 * It strictly separates Cognora AI visualizations from default Excalidraw styling.
 */

export const FONT_FAMILY = {
  SANS: 2, // Helvetica/Arial for clean UI
  MONO: 3, // Cascadia/Monospace for code/values
} as const;

export const PALETTE = {
  // Base scales
  white: "#ffffff",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",

  // Semantic States (inferred from reference)
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue500: "#3b82f6",
  blue600: "#2563eb", // Visited (soft blue)

  green50: "#f0fdf4",
  green100: "#dcfce7",
  green500: "#22c55e",
  green600: "#16a34a", // Current (green active)

  purple50: "#faf5ff",
  purple100: "#f3e8ff",
  purple500: "#a855f7",
  purple600: "#9333ea", // Target (purple)

  amber50: "#fffbeb",
  amber100: "#fef3c7",
  amber500: "#f59e0b",
  amber600: "#d97706", // Warning / Path

  rose50: "#fff1f2",
  rose100: "#ffe4e6",
  rose500: "#f43f5e",
  rose600: "#e11d48", // Error / Eliminated
} as const;

export const TOKENS = {
  // NODE STATES
  NODE: {
    DEFAULT: {
      fill: PALETTE.white,
      stroke: PALETTE.slate300,
      textPrimary: PALETTE.slate800,
      textSecondary: PALETTE.slate700,
      strokeWidth: 2,
    },
    VISITED: {
      fill: PALETTE.blue50,
      stroke: PALETTE.blue500,
      textPrimary: PALETTE.blue600,
      textSecondary: PALETTE.blue600,
      strokeWidth: 2,
    },
    CURRENT: {
      fill: PALETTE.green50,
      stroke: PALETTE.green500,
      textPrimary: PALETTE.green600,
      textSecondary: PALETTE.green600,
      strokeWidth: 3, // Thicker for active
    },
    TARGET: {
      fill: PALETTE.purple50,
      stroke: PALETTE.purple500,
      textPrimary: PALETTE.purple600,
      textSecondary: PALETTE.purple600,
      strokeWidth: 3,
    },
    SELECTED: {
      fill: PALETTE.amber50,
      stroke: PALETTE.amber500,
      textPrimary: PALETTE.amber600,
      textSecondary: PALETTE.amber600,
      strokeWidth: 2,
    },
    IN_PATH: {
      fill: PALETTE.white,
      stroke: PALETTE.amber500,
      textPrimary: PALETTE.amber600,
      textSecondary: PALETTE.amber600,
      strokeWidth: 3,
    }
  },

  // EDGE STATES
  EDGE: {
    DEFAULT: {
      stroke: PALETTE.slate300,
      strokeWidth: 2,
    },
    VISITED: {
      stroke: PALETTE.blue500,
      strokeWidth: 2,
    },
    IN_PATH: {
      stroke: PALETTE.amber500,
      strokeWidth: 3,
    },
    ACTIVE: {
      stroke: PALETTE.green500,
      strokeWidth: 3,
    }
  },

  // EDGE WEIGHT
  WEIGHT: {
    DEFAULT: {
      fill: PALETTE.white,
      stroke: PALETTE.slate200,
      text: PALETTE.slate700,
      strokeWidth: 1,
    },
    IN_PATH: {
      fill: PALETTE.amber50,
      stroke: PALETTE.amber500,
      text: PALETTE.amber600,
      strokeWidth: 1.5,
    }
  },

  // ANNOTATIONS & CALLOUTS
  ANNOTATION: {
    fill: PALETTE.slate800,
    stroke: "transparent",
    text: PALETTE.white,
    strokeWidth: 0,
  },

  // TYPOGRAPHY SCALES
  TYPOGRAPHY: {
    Title: { fontSize: 24, fontFamily: FONT_FAMILY.SANS },
    NodePrimary: { fontSize: 20, fontFamily: FONT_FAMILY.SANS },
    NodeSecondary: { fontSize: 14, fontFamily: FONT_FAMILY.MONO },
    EdgeWeight: { fontSize: 14, fontFamily: FONT_FAMILY.MONO },
    Annotation: { fontSize: 14, fontFamily: FONT_FAMILY.SANS },
    Callout: { fontSize: 16, fontFamily: FONT_FAMILY.SANS },
  },

  // GEOMETRY
  GEOMETRY: {
    cornerRadius: 8,
    nodeDiameter: 65,
    cellWidth: 60,
    cellHeight: 60,
  },

  // ANIMATION
  ANIMATION: {
    durationMs: 300,
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  }
} as const;

export function mapSemanticStateToNodeTokens(highlight?: string) {
  switch (highlight) {
    case "target": return TOKENS.NODE.TARGET;
    case "found": 
    case "current": return TOKENS.NODE.CURRENT;
    case "visited": return TOKENS.NODE.VISITED;
    case "path": return TOKENS.NODE.IN_PATH;
    case "eliminated": return { ...TOKENS.NODE.DEFAULT, fill: PALETTE.slate100, textPrimary: PALETTE.slate300 };
    default: return TOKENS.NODE.DEFAULT;
  }
}

export function mapSemanticStateToEdgeTokens(highlight?: string) {
  switch (highlight) {
    case "path": return TOKENS.EDGE.IN_PATH;
    case "visited": return TOKENS.EDGE.VISITED;
    case "active": return TOKENS.EDGE.ACTIVE;
    default: return TOKENS.EDGE.DEFAULT;
  }
}
