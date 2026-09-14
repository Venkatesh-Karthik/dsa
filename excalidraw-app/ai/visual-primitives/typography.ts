import { TOKENS, FONT_FAMILY } from "./design-tokens";

export { FONT_FAMILY };

export interface TextStyle {
  fontSize: number;
  fontFamily: number;
  strokeColor: string;
}

export const TYPOGRAPHY = {
  GraphNode: {
    primary: TOKENS.TYPOGRAPHY.NodePrimary,
    secondary: TOKENS.TYPOGRAPHY.NodeSecondary
  },
  EdgeWeight: TOKENS.TYPOGRAPHY.EdgeWeight,
  TreeNode: {
    primary: TOKENS.TYPOGRAPHY.NodePrimary
  },
  ArrayCell: {
    primary: TOKENS.TYPOGRAPHY.NodePrimary,
    index: TOKENS.TYPOGRAPHY.IndexLabel,
  },
  Annotation: TOKENS.TYPOGRAPHY.Annotation,
  CodeBadge: { fontSize: 13, fontFamily: FONT_FAMILY.MONO },
  Title: TOKENS.TYPOGRAPHY.Title,
  Heading: { fontSize: 16, fontFamily: FONT_FAMILY.SANS },
  Body: { fontSize: 14, fontFamily: FONT_FAMILY.SANS }
} as const;
