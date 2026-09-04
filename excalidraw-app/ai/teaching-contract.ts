/**
 * AI Teaching Service Contract
 *
 * Defines the strongly-typed API boundaries between the frontend UI,
 * the backend service layer, and AI model providers.
 */

import type {
  TeachingResponse,
  VisualAction,
  TeachingStep,
  TeachingLesson,
} from "./visual-dsl";

export type { TeachingResponse, VisualAction, TeachingStep, TeachingLesson };

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SelectedSemanticElement {
  dslId: string;
  role?: string;
  type: string;
  label?: string;
  parentStructureId?: string;
  incomingArrows?: Array<{ fromId: string; label?: string }>;
  outgoingArrows?: Array<{ toId: string; label?: string }>;
  stepIndex?: number;
}

export interface TeachingRequestContext {
  currentElementsCount?: number;
  selectedElementIds?: string[];
  selectedElementsContext?: SelectedSemanticElement[];
  theme?: "light" | "dark";
  conversationHistory?: ConversationMessage[];
  existingAIElements?: string[];
  semanticSummary?: string;
  activeLessonState?: {
    topic?: string;
    currentStepIndex?: number;
    totalSteps?: number;
    stepTitle?: string;
  };
  userInteractionDelta?: string;
  [key: string]: unknown;
}

export interface TeachingRequest {
  prompt: string;
  context?: TeachingRequestContext;
}

export interface TeachingErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export interface TeachingProviderInfo {
  id: string;
  name: string;
  model?: string;
  isConfigured: boolean;
}
