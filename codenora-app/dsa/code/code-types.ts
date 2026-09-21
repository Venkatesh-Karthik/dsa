/**
 * Cognora Code Intelligence Layer — Types & Contracts
 */

export type SupportedLanguage = "python" | "javascript" | "java" | "cpp";

export interface CodeArtifact {
  conceptId: string;
  title: string;
  language: SupportedLanguage;
  source: string;
  explanation?: string;
  entryPoint?: string;
  highlightLines?: number[];
  transformationType?: string;
  isDeterministic?: boolean;
}

export interface CodeTemplate {
  conceptId: string;
  title: string;
  languages: Record<
    SupportedLanguage,
    {
      sourceTemplate: (input?: any) => string;
      transformationHighlights?: Record<string, number[]>;
      defaultHighlights?: number[];
      entryPoint?: string;
    }
  >;
}
