/**
 * Cognora Competitive Programming & Coding Problem Solver
 *
 * Dedicated prompt engineering and response structuring for competitive programming
 * problems (CodeChef, LeetCode, Codeforces, HackerRank, etc.).
 *
 * Guarantees:
 * 1. Problem Overview
 * 2. Input/Output Format & Constraints
 * 3. Key Observations & Mathematical Insights
 * 4. Optimal Algorithm Breakdown
 * 5. Why the Algorithm Works
 * 6. Time & Space Complexity
 * 7. Edge Cases
 * 8. Submission-ready code in requested language (C++, Java, Python, C, JavaScript)
 * 9. Accompanying visual diagram illustrating the algorithm on a sample testcase
 */

import {
  detectProgrammingLanguage,
  type ProgrammingLanguage,
} from "../intent-router";

import type { TeachingRequest, TeachingResponse } from "../teaching-contract";

export interface CodingSolutionDetails {
  problemSummary?: string;
  inputOutputFormat?: string;
  constraints?: string;
  keyObservations?: string[];
  algorithm?: string;
  correctness?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  edgeCases?: string[];
  language: string;
  code: string;
}

export const CODING_SYSTEM_PROMPT = `You are Cognora's Competitive Programming & Algorithm Specialist.
Your tagline is "Learn by seeing."
When presented with a coding problem (e.g. from CodeChef, LeetCode, Codeforces, or user-provided problem statements):

You MUST provide:
1. A comprehensive, beautifully formatted Markdown teaching explanation in "message" covering:
   - **Problem Overview**: Concise summary of what is given and what to find.
   - **Input / Output Format & Constraints**: Exact format and constraint deduction (e.g. N <= 10^5 requires O(N) or O(N log N)).
   - **Key Observations & Mathematical Insights**: The non-obvious intuition, greedy choice, invariant, or DP relation.
   - **Optimal Algorithm Breakdown**: Step-by-step logic.
   - **Why It Works**: Correctness invariant.
   - **Complexity**: Time Complexity and Space Complexity with Big-O justifications.
   - **Edge Cases**: Empty/single element, duplicate values, extreme bounds, integer overflow (e.g. long long).
   - **Submission-Ready Code**: A complete, self-contained, working solution in the requested language (C++, Java, Python, C, or JavaScript).
     * For C++: Include <bits/stdc++.h> (or standard headers), fast I/O (cin.tie(NULL)), long long for 64-bit sums, and solve() function with test cases loop.
     * For Python: Include sys.stdin.readline, sys.setrecursionlimit if needed.
     * For Java: Include Scanner/BufferedReader, proper class Solution/Main.

2. A PROGRESSIVE VISUAL DIAGRAM in "visual_lesson" that visualizes the algorithm executing on a small sample test case:
   - Use ONE-SCENE TRANSFORMATION MODEL. Do NOT create slide-like duplicated steps.
   - initial_scene creates the input data structures (e.g. array, tree, graph) with semantic IDs.
   - transformations array mutates the scene incrementally (e.g. update pointers, highlight cells, connect edges).
   - Include code_context in transformations to link the visual state to the code logic.

3. Return ONLY a single valid JSON object with NO conversational filler and NO backticks wrapping the whole JSON:
{
  "topic": "<Problem Title or Code>",
  "message": "<Full structured markdown explanation including the complete code snippet>",
  "explanation_steps": ["<Point 1>", "<Point 2>", "<Point 3>"],
  "visual_lesson": {
    "id": "algo-trace",
    "title": "Algorithm Trace",
    "concept": "Sample Test Case",
    "initial_scene": [<Visual actions creating the sample input>],
    "transformations": [
      {
        "id": "t1",
        "title": "Initial Algorithm State",
        "operations": [<operations setting up pointers/state>],
        "explanation": "Explanation of initial state...",
        "code_context": { "language": "cpp", "code": "...", "highlight_lines": [5] }
      },
      {
        "id": "t2",
        "title": "Transition",
        "operations": [<operations moving pointers or updating state>],
        "explanation": "Explanation of the transition...",
        "code_context": { "language": "cpp", "code": "...", "highlight_lines": [7, 8] }
      }
    ]
  }
}`;

/**
 * Augments the prompt for competitive programming questions to ensure all 8 required
 * structural components and requested language code are produced.
 */
export function formatCodingProblemPrompt(
  request: TeachingRequest,
  language?: ProgrammingLanguage,
): string {
  const targetLang =
    language || detectProgrammingLanguage(request.prompt) || "cpp";

  const langNames: Record<ProgrammingLanguage, string> = {
    cpp: "C++ (C++17 / C++20 with fast I/O and long long if sum > 2*10^9)",
    java: "Java (Java 11 / Java 17)",
    python: "Python (Python 3.x)",
    c: "C (C99 / C11)",
    javascript: "JavaScript (Node.js)",
  };

  return `COMPETITIVE PROGRAMMING PROBLEM REQUEST:
Problem Statement:
${request.prompt}

Target Programming Language:
${langNames[targetLang]}

Please provide:
1. Problem Overview
2. Constraints & Complexity requirement
3. Core Observation & Invariant
4. Step-by-Step Algorithm
5. Why it works
6. Time & Space Complexity
7. Edge Cases & Overflows
8. Full submission-ready ${targetLang.toUpperCase()} code
9. Visual diagram illustrating the algorithm on a sample testcase using Visual DSL actions (e.g. create_array, create_matrix, etc.).`;
}

/**
 * Extracts code solution block from markdown message if present.
 */
export function extractCodeBlockFromMessage(
  message: string,
): { language: string; code: string } | null {
  const codeBlockMatch = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/.exec(message);
  if (codeBlockMatch) {
    return {
      language: codeBlockMatch[1] || "code",
      code: codeBlockMatch[2].trim(),
    };
  }
  return null;
}

/**
 * Post-processes a TeachingResponse for a coding problem to ensure
 * code blocks and visual representations are harmonized.
 */
export function enrichCodingResponse(
  response: TeachingResponse,
  detectedLanguage?: ProgrammingLanguage,
): TeachingResponse {
  const codeInfo = extractCodeBlockFromMessage(response.message);

  return {
    ...response,
    topic: response.topic || "Competitive Programming Solution",
    ...(codeInfo && {
      code_solution: {
        language: codeInfo.language || detectedLanguage || "cpp",
        code: codeInfo.code,
        problem_summary: response.topic,
      },
    }),
  };
}
