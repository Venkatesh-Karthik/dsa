/**
 * AI Response Extractor & Structured JSON Recovery Layer
 *
 * Dedicated, robust extractor that isolates learner-facing structured responses
 * from LLM completions across all providers (NVIDIA Nemotron, Featherless, Ollama, etc.).
 *
 * Guarantees:
 * 1. STRICT ISOLATION: Isolates message.content. Treats reasoning_content (<think> / <thought>)
 *    as private internal reasoning and never exposes it to the learner.
 * 2. MARKDOWN & PROSE STRIPPING: Extracts JSON regardless of surrounding conversational
 *    text, code fences (```json ... ``` or ``` ... ```), or whitespace.
 * 3. ADVANCED TRUNCATION REPAIR: Automatically completes unclosed quotes, removes trailing
 *    commas/colons, and balances unclosed brackets ] and braces } in reverse stack order.
 * 4. CANDIDATE SELECTION: Selects the outermost teaching lesson object rather than inner leaf
 *    nodes or sub-actions when multiple JSON structures are present.
 */

/**
 * Strips model reasoning tags like <think>...</think> or <thought>...</thought>
 * from text so internal thought chains are never confused with JSON payloads.
 */
export function stripReasoningTags(text: string): string {
  if (!text) {
    return "";
  }
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, "");

  // If text has an unclosed leading reasoning tag, strip the unclosed block
  if (/^<(think|thought|reflection)\b/i.test(cleaned.trim())) {
    cleaned = cleaned.replace(/^<(think|thought|reflection)\b[\s\S]*$/gi, "");
  }

  return cleaned;
}

/**
 * Deterministically repairs minor JSON syntax quirks:
 * 1. Strips wrapping markdown code fences
 * 2. Removes trailing commas before closing braces/brackets
 * 3. Trims surrounding whitespace
 */
export function deterministicJsonRepair(raw: string): string {
  let cleaned = raw.trim();
  // Strip code fences if wrapping the payload
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  return cleaned;
}

/**
 * Safely parses a JSON string, handling nested code fences if present.
 */
export function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    const genericFence = text.match(/```\s*([\s\S]*?)\s*```/i);
    if (genericFence && genericFence[1]) {
      return JSON.parse(genericFence[1].trim());
    }
    throw new Error("Failed to parse JSON string");
  }
}

/**
 * Recovers valid JSON from model responses truncated by token limits.
 * Closes unescaped quotes, dangling keys, and unclosed arrays/objects in reverse stack order.
 */
export function closeTruncatedJson(raw: string): string {
  let str = raw.trim();
  if (!str.startsWith("{") && !str.startsWith("[")) {
    const firstBrace = str.indexOf("{");
    const firstBracket = str.indexOf("[");
    const firstStart =
      firstBrace === -1
        ? firstBracket
        : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
    if (firstStart === -1) {
      return str;
    }
    str = str.slice(firstStart);
  }

  // 1. Check if string ends inside an unclosed quoted literal
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
  }

  if (inString) {
    str = str.replace(/\\+$/, "");
    str += '"';
  }

  // 2. Clean dangling trailing delimiters
  str = str.replace(/,\s*$/, "");
  str = str.replace(/:\s*$/, ': ""');
  str = str.replace(/"[^"]*"\s*:\s*$/, "");
  str = str.replace(/,\s*$/, "");

  // 3. Scan open braces/brackets stack
  const finalStack: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{" || char === "[") {
        finalStack.push(char === "{" ? "}" : "]");
      } else if (char === "}" || char === "]") {
        if (
          finalStack.length > 0 &&
          finalStack[finalStack.length - 1] === char
        ) {
          finalStack.pop();
        }
      }
    }
  }

  // 4. Close all unclosed containers in reverse order
  while (finalStack.length > 0) {
    str += finalStack.pop();
  }

  return str;
}

/**
 * Extracts a complete, balanced JSON object ({ ... }) from text.
 * Safely handles string escapes, quotes containing braces, and nested structures.
 */
export function extractBalancedJson(text: string): unknown | null {
  let firstValidFallback: unknown | null = null;

  for (let start = 0; start < text.length; start++) {
    if (text[start] !== "{") {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          depth++;
        } else if (char === "}") {
          depth--;
          if (depth === 0) {
            const candidate = text.slice(start, i + 1).trim();
            const tryParse = (raw: string): unknown | null => {
              try {
                return safeParseJson(raw);
              } catch {
                try {
                  return safeParseJson(deterministicJsonRepair(raw));
                } catch {
                  return null;
                }
              }
            };

            const parsed = tryParse(candidate);
            if (
              parsed &&
              typeof parsed === "object" &&
              !Array.isArray(parsed)
            ) {
              const p = parsed as Record<string, unknown>;
              const isTeachingLessonCandidate = Boolean(
                p.visualLesson ||
                  p.visual_lesson ||
                  p.steps ||
                  p.visual_actions ||
                  p.topic ||
                  p.message,
              );

              if (isTeachingLessonCandidate) {
                return parsed;
              }

              const isInnerVisualAction =
                typeof p.type === "string" &&
                (p.type.startsWith("create_") ||
                  p.type === "highlight" ||
                  p.type === "delete" ||
                  p.type === "move" ||
                  p.type === "resize" ||
                  p.type === "annotate_pointer") &&
                Boolean(p.id);

              const isDataElement =
                Boolean(
                  p.id &&
                    (p.value !== undefined ||
                      p.left !== undefined ||
                      p.right !== undefined ||
                      p.children !== undefined),
                ) &&
                !p.type &&
                !p.topic &&
                !p.visualLesson;

              if (
                !isInnerVisualAction &&
                !isDataElement &&
                !firstValidFallback
              ) {
                firstValidFallback = parsed;
              }
            }
          }
        }
      }
    }
  }

  return firstValidFallback;
}

/**
 * Primary Extraction Function:
 * Extracts valid structured JSON from any raw model response.
 *
 * Pipeline:
 * 1. Strip reasoning tags (<think>...)
 * 2. Try direct JSON parse
 * 3. Try deterministic repair parse
 * 4. Try markdown code block extraction
 * 5. Try truncated JSON closing recovery
 * 6. Try balanced brace scanner
 */
export function extractJsonFromText(rawText: string): unknown | null {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  const cleaned = stripReasoningTags(rawText).trim();
  if (!cleaned) {
    return null;
  }

  // 1. Direct JSON check
  try {
    const parsed = safeParseJson(cleaned);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Continue
  }

  // 2. Direct parse after deterministic repair
  try {
    const repaired = deterministicJsonRepair(cleaned);
    const parsed = safeParseJson(repaired);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Continue
  }

  // 3. Markdown code block extraction
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    const fenceContent = jsonMatch[1].trim();
    try {
      const parsed = safeParseJson(fenceContent);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      try {
        const parsed = safeParseJson(deterministicJsonRepair(fenceContent));
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch {
        // Continue
      }
    }
  }

  // 3b. Prose-preamble skip: model output reasoning text before the JSON object.
  // Scan forward to find the first '{' that opens a teaching-lesson root object
  // (has "topic", "visualLesson", "message", "steps", or "visual_actions").
  // This handles cases where the model ignored the "no reasoning" instruction.
  if (!cleaned.startsWith("{")) {
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace > 0) {
      const fromBrace = cleaned.slice(firstBrace);
      try {
        const parsed = safeParseJson(fromBrace);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const p = parsed as Record<string, unknown>;
          if (
            p.topic ||
            p.visualLesson ||
            p.visual_lesson ||
            p.message ||
            p.visual_actions ||
            p.steps
          ) {
            return parsed;
          }
        }
      } catch {
        // Try repair and truncation closure
        try {
          const repaired = deterministicJsonRepair(fromBrace);
          const parsed = safeParseJson(repaired);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const p = parsed as Record<string, unknown>;
            if (
              p.topic ||
              p.visualLesson ||
              p.visual_lesson ||
              p.message ||
              p.visual_actions ||
              p.steps
            ) {
              return parsed;
            }
          }
        } catch {
          // Continue to truncation repair below
        }
        try {
          const closed = closeTruncatedJson(fromBrace);
          const parsed = safeParseJson(deterministicJsonRepair(closed));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const p = parsed as Record<string, unknown>;
            if (
              p.topic ||
              p.visualLesson ||
              p.visual_lesson ||
              p.message ||
              p.visual_actions ||
              p.steps
            ) {
              return parsed;
            }
          }
        } catch {
          // Continue
        }
      }
    }
  }

  // 4. Attempt truncated JSON closing repair for outer lesson object
  if (
    cleaned.includes("visualLesson") ||
    cleaned.includes("topic") ||
    cleaned.includes("initialScene") ||
    cleaned.includes("transformations") ||
    cleaned.includes("steps")
  ) {
    try {
      const closed = closeTruncatedJson(cleaned);
      const parsed = safeParseJson(deterministicJsonRepair(closed));
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  // 5. Robust balanced brace extraction
  const balancedResult = extractBalancedJson(cleaned);
  if (balancedResult !== null) {
    return balancedResult;
  }

  return null;
}

export function isolateMessageContent(message?: unknown): string {
  if (!message) {
    return "";
  }
  if (typeof message === "string") {
    return stripReasoningTags(message);
  }
  if (typeof message === "object" && message !== null) {
    const msg = message as Record<string, unknown>;
    if (typeof msg.content === "string") {
      return stripReasoningTags(msg.content);
    }
    if (Array.isArray(msg.content)) {
      const combined = msg.content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (
            part &&
            typeof part === "object" &&
            "text" in part &&
            typeof (part as any).text === "string"
          ) {
            return (part as any).text;
          }
          return "";
        })
        .join("");
      return stripReasoningTags(combined);
    }
  }
  return "";
}
