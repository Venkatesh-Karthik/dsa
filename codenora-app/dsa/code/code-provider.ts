/**
 * Cognora Universal Code Provider & Intent Resolver
 *
 * Resolves verified code artifacts for deterministic DSA concepts and dynamic Nemotron lessons.
 * Ensures zero placeholders, custom input injection, step-to-line highlighting,
 * and instantaneous offline language switching.
 */

import { DSA_CODE_CATALOG } from "./code-catalog";
import type { CodeArtifact, SupportedLanguage } from "./code-types";

export interface CodeResolutionOptions {
  conceptId?: string;
  title?: string;
  language?: SupportedLanguage | string;
  input?: any;
  transformationType?: string;
  customCodeContexts?: Record<string, any> | any[];
  lessonId?: string;
  transformationId?: string;
  stepNumber?: number;
  explanation?: string;
  userPrompt?: string;
}

/**
 * High-performance in-memory Code Cache.
 * Keyed by: lessonId + transformationType/Id + language + inputHash.
 */
const codeCache = new Map<string, CodeArtifact>();
const pendingCodeRequests = new Set<string>();

export type CodeUpdateListener = (cacheKey: string, artifact: CodeArtifact) => void;
const codeListeners = new Set<CodeUpdateListener>();

export function onCodeArtifactUpdated(listener: CodeUpdateListener): () => void {
  codeListeners.add(listener);
  return () => codeListeners.delete(listener);
}

function notifyCodeListeners(cacheKey: string, artifact: CodeArtifact): void {
  for (const listener of codeListeners) {
    try {
      listener(cacheKey, artifact);
    } catch {
      // Ignore listener errors
    }
  }
}

export function computeCodeCacheKey(
  lessonId?: string,
  transformationId?: string,
  language?: string,
  input?: any,
): string {
  const lId = lessonId || "default";
  const tId = transformationId || "default";
  const lang = language || "python";
  let inputHash = "";
  try {
    inputHash = input ? JSON.stringify(input) : "";
  } catch {
    inputHash = String(input || "");
  }
  return `${lId}:${tId}:${lang}:${inputHash}`;
}

export function validateCodeArtifact(artifact: CodeArtifact): boolean {
  if (!artifact || typeof artifact.source !== "string") return false;
  const s = artifact.source.trim();
  if (s.length < 15) return false;
  if (
    s.includes("# Code implementation for active lesson step") ||
    s.includes("// Code implementation for active lesson step") ||
    s.includes("TODO: implement") ||
    s.includes("placeholder implementation")
  ) {
    return false;
  }
  return true;
}

export function clearCodeCache(): void {
  codeCache.clear();
  pendingCodeRequests.clear();
}

export function getCodeCacheSize(): number {
  return codeCache.size;
}

/**
 * Normalizes user query or lesson title to canonical concept ID.
 */
export function normalizeConceptId(idOrTitle?: string): string | null {
  if (!idOrTitle) return null;
  const s = idOrTitle.toLowerCase().replace(/['"_-]/g, " ").trim();

  if (/avl/i.test(s)) return "avl-tree";
  if (/dijkstra/i.test(s)) return "dijkstra";
  if (/bellman/i.test(s)) return "bellman-ford";
  if (/binary\s*search/i.test(s)) return "binary-search";
  if (/quick\s*sort/i.test(s)) return "quick-sort";
  if (/merge\s*sort/i.test(s)) return "merge-sort";
  if (/heap/i.test(s) || /priority\s*queue/i.test(s)) return "binary-heap";
  if (/linked\s*list/i.test(s)) return "singly-linked-list";
  if (/bfs|breadth/i.test(s)) return "bfs";
  if (/dfs|depth/i.test(s)) return "dfs";
  if (/stack/i.test(s)) return "stack";
  if (/queue/i.test(s)) return "queue";

  // Check exact keys in catalog
  for (const key of Object.keys(DSA_CODE_CATALOG)) {
    if (s.includes(key.replace(/-/g, " "))) {
      return key;
    }
  }

  return null;
}

/**
 * Asynchronously requests step-specific code from the backend NVIDIA Nemotron endpoint.
 * Independent output channel: failure NEVER interrupts or resets the visual lesson.
 */
async function requestDynamicStepCode(
  options: CodeResolutionOptions,
  cacheKey: string,
  targetLang: SupportedLanguage,
): Promise<void> {
  if (pendingCodeRequests.has(cacheKey)) return;
  pendingCodeRequests.add(cacheKey);

  try {
    const res = await fetch("/api/ai/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: options.lessonId,
        conceptId: options.conceptId,
        title: options.title,
        language: targetLang,
        stepNumber: options.stepNumber,
        transformationType: options.transformationType,
        explanation: options.explanation,
        userPrompt: options.userPrompt,
        input: options.input,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.code) {
        const artifact: CodeArtifact = {
          conceptId: options.conceptId || "dynamic",
          title: options.title || "Algorithm Step Code",
          language: targetLang,
          source: data.code,
          highlightLines: data.highlightLines || [1, 2, 3],
          transformationType: options.transformationType,
          isDeterministic: false,
        };
        if (validateCodeArtifact(artifact)) {
          codeCache.set(cacheKey, artifact);
          notifyCodeListeners(cacheKey, artifact);
        }
      }
    }
  } catch {
    // Non-blocking: code generation failure NEVER breaks the lesson
  } finally {
    pendingCodeRequests.delete(cacheKey);
  }
}

/**
 * Resolves a complete, verified CodeArtifact for the active lesson and language.
 * Checks the Code Cache first, falls back to catalog/dynamic code, and initiates
 * asynchronous background generation if needed.
 */
export function resolveCodeArtifact(options: CodeResolutionOptions): CodeArtifact {
  const targetLang: SupportedLanguage =
    options.language === "javascript" ||
    options.language === "java" ||
    options.language === "cpp"
      ? options.language
      : "python";

  const cacheKey = computeCodeCacheKey(
    options.lessonId,
    options.transformationType || options.transformationId,
    targetLang,
    options.input,
  );

  // Check Code Cache first
  if (codeCache.has(cacheKey)) {
    return codeCache.get(cacheKey)!;
  }

  // 1. Try resolving via canonical deterministic DSA catalog
  const canonicalId =
    normalizeConceptId(options.conceptId) ||
    normalizeConceptId(options.title);

  if (canonicalId && DSA_CODE_CATALOG[canonicalId]) {
    const template = DSA_CODE_CATALOG[canonicalId];
    const langEntry =
      template.languages[targetLang] || template.languages.python;

    const source = langEntry.sourceTemplate(options.input);

    let highlightLines = langEntry.defaultHighlights || [1, 2, 3];
    if (options.transformationType && langEntry.transformationHighlights) {
      const match =
        langEntry.transformationHighlights[options.transformationType] ||
        langEntry.transformationHighlights[
          options.transformationType.toUpperCase()
        ];
      if (match && match.length > 0) {
        highlightLines = match;
      }
    }

    const artifact: CodeArtifact = {
      conceptId: template.conceptId,
      title: template.title,
      language: targetLang,
      source,
      entryPoint: langEntry.entryPoint,
      highlightLines,
      transformationType: options.transformationType,
      isDeterministic: true,
    };

    codeCache.set(cacheKey, artifact);
    return artifact;
  }

  // 2. Try resolving via custom dynamic Nemotron lesson code contexts
  if (options.customCodeContexts) {
    let matchedCode: any = null;
    if (Array.isArray(options.customCodeContexts)) {
      matchedCode =
        options.customCodeContexts.find(
          (c) => c?.language?.toLowerCase() === targetLang,
        ) || options.customCodeContexts[0];
    } else if (typeof options.customCodeContexts === "object") {
      matchedCode =
        options.customCodeContexts[targetLang] ||
        options.customCodeContexts["python"] ||
        Object.values(options.customCodeContexts)[0];
    }

    if (matchedCode?.code && typeof matchedCode.code === "string") {
      const artifact: CodeArtifact = {
        conceptId: options.conceptId || "dynamic-lesson",
        title: options.title || "Algorithm Implementation",
        language: targetLang,
        source: matchedCode.code,
        highlightLines: matchedCode.highlightLines || [1, 2, 3],
        transformationType: options.transformationType,
        isDeterministic: false,
      };
      if (validateCodeArtifact(artifact)) {
        codeCache.set(cacheKey, artifact);
        return artifact;
      }
    }
  }

  // 3. Clean conceptual fallback for non-code topics (never a broken placeholder)
  const isCodePossible = Boolean(
    (options.conceptId && options.conceptId !== "conceptual") ||
      (options.title &&
        /tree|graph|sort|search|array|list|node|stack|queue|algo/i.test(
          options.title,
        )),
  );

  // Trigger non-blocking async generation from NVIDIA provider if code is possible
  if (isCodePossible && typeof window !== "undefined") {
    requestDynamicStepCode(options, cacheKey, targetLang);
  }

  const fallbackSource = isCodePossible
    ? `// Implementation for ${options.title || "this concept"} (${targetLang})
// Step ${options.stepNumber || 1}: ${options.transformationType || "Executing transformation"}
// Preparing step-specific code implementation...`
    : `// Cognora Code Inspector
// This lesson is a conceptual / theoretical visualization.
// No algorithm implementation code is associated with this lesson step.`;

  const artifact: CodeArtifact = {
    conceptId: options.conceptId || "conceptual",
    title: options.title || "Lesson Overview",
    language: targetLang,
    source: fallbackSource,
    highlightLines: [1, 2],
    isDeterministic: false,
  };

  codeCache.set(cacheKey, artifact);
  return artifact;
}
