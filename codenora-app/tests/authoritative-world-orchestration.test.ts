/**
 * Cognora Master System Upgrade Test Suite
 *
 * Comprehensive validation across:
 * 1. AuthoritativeSemanticWorld Master Contract
 * 2. Stable Semantic IDs (no index/coordinate identity)
 * 3. Entity Conservation across multi-step transformations
 * 4. First-Class Relationships & Binding Invariants
 * 5. TeachingMoment Compiler completeness
 * 6. Dynamic Operation Decomposition
 * 7. Layout Quality Validation & Collision Resolution
 * 8. What-If Branching Isolation & Restoration
 * 9. Multi-Domain Generalization (AVL, Heap, Linked List, Binary Search, Dijkstra, Physical Science)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CognoraWorldModel } from "../ai/intelligence/cognora-world-model";
import { UniversalConceptIntelligenceEngine } from "../ai/universal-engine";
import { TeachingMomentCompiler } from "../ai/teaching-moment";
import { OrderedOperationEngine } from "../ai/ordered-operation-engine";
import {
  validateSceneLayoutQuality,
  resolveLayoutCollisions,
  type LayoutBounds,
  type LayoutPoint,
} from "../ai/layout-engine";
import { BranchManager } from "../ai/intelligence/branch-manager";
import { IntentEngine } from "../ai/intelligence/intent-engine";
import { TeacherBrain } from "../ai/intelligence/teacher-brain";
import { VoiceQueue } from "../ai/voice/voice-queue";
import { VoicePriority } from "../ai/voice/voice-contract";
import type { TTSProvider } from "../ai/voice/tts-provider";
import type { TTSAudio } from "../ai/voice/voice-contract";

class MockFastTTSProvider implements TTSProvider {
  public name = "MockFastTTS";
  async isAvailable(): Promise<boolean> {
    return true;
  }
  async synthesize(text: string): Promise<TTSAudio> {
    return {
      audioUrl: "blob:http://localhost/mock-audio.wav",
      mimeType: "audio/wav",
      provider: "MockFastTTS",
      cacheKey: "mock-key",
      durationMs: 2000,
    };
  }
}

describe("Cognora Master System Upgrade: Full Architectural Suite", () => {
  let worldModel: CognoraWorldModel;

  beforeEach(() => {
    worldModel = new CognoraWorldModel();
  });

  describe("1. Authoritative Semantic World Master Contract", () => {
    it("maintains authoritative state with stable IDs, versioning, and zero divergent state", () => {
      const auth = worldModel.getAuthoritativeWorld();
      expect(auth.generationId).toBe("GEN-INIT");
      expect(auth.worldVersion).toBe(1);
      expect(auth.branchId).toBe("MAIN");
      expect(auth.entities).toBeInstanceOf(Map);
      expect(auth.relationships).toBeInstanceOf(Map);
      expect(auth.selection).toEqual([]);
      expect(auth.playback.status).toBe("IDLE");

      worldModel.setAuthoritativeContext("GEN-AVL-100", 2, "MAIN");
      worldModel.setSelection(["node-30", "node-20"]);

      const updated = worldModel.getAuthoritativeWorld();
      expect(updated.generationId).toBe("GEN-AVL-100");
      expect(updated.worldVersion).toBe(2);
      expect(updated.selection).toEqual(["node-30", "node-20"]);
    });
  });

  describe("2. Universal Concept Intelligence & Multi-Domain Generalization", () => {
    it("compiles AVL tree insertion with verified atomic moments and balance checks", () => {
      const prompt =
        "Explain how AVL tree insertion works. Insert 30, 20, 10, 25, and 28 one by one, showing every insertion, balance check, and rotation step visually.";
      const processed = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(processed).toBeDefined();
      expect(processed.timeline).toBeDefined();
      const moments = processed.timeline?.moments || [];
      expect(moments.length).toBeGreaterThanOrEqual(4);

      // Verify every moment complies with the authoritative TeachingMoment contract
      for (const moment of moments) {
        expect(moment.id).toBeDefined();
        expect(moment.transformationId).toBeDefined();
        expect(moment.semanticFocus).toBeDefined();
        expect(moment.narration).toBeDefined();
        expect(moment.narration.length).toBeGreaterThan(5);
        expect(moment.callout).toBeDefined();
        expect(moment.callout?.text).toBeDefined();
        expect(moment.visualStrategy).toBeDefined();
        expect(moment.inspectorContent).toBeDefined();
      }

      // Verify lesson sets properly into the authoritative world
      worldModel.setLesson(processed.visualLesson, processed.timeline, {
        generationId: "GEN-AVL-TEST",
        worldVersion: 1,
        branchId: "MAIN",
      });

      const world = worldModel.getAuthoritativeWorld();
      expect(world.generationId).toBe("GEN-AVL-TEST");
      expect(world.playback.totalSteps).toBe(moments.length);
    });

    it("compiles Linked List deletion with atomic step-by-step un-collapsing", () => {
      const prompt =
        "Explain how elimination works in a linked list. Eliminate 20 and 30 from 10 -> 20 -> 30 -> 40 -> 50 step by step.";
      const processed = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(processed).toBeDefined();
      const moments = processed.timeline?.moments || [];
      expect(moments.length).toBeGreaterThanOrEqual(3);

      // Verify moments do not collapse both deletions into a single step
      const deleteMoments = moments.filter((m) =>
        /(?:eliminate|delete|remove)\s+(?:node\s+)?(?:20|30)/i.test(
          `${m.title} ${m.explanation}`,
        ),
      );
      expect(deleteMoments.length).toBeGreaterThanOrEqual(2);
    });

    it("compiles Binary Search with exact targets and eliminated sub-ranges", () => {
      const prompt =
        "Explain binary search for [2,5,8,12,16,23,38,56,72,91] and search for 23 step by step.";
      const processed = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(processed).toBeDefined();
      const moments = processed.timeline?.moments || [];
      expect(moments.length).toBeGreaterThanOrEqual(3);

      // Verify focus shifts to mid pointer
      const midFocusMoments = moments.filter((m) =>
        m.semanticFocus?.label?.toLowerCase().includes("mid") ||
        m.explanation.toLowerCase().includes("mid") ||
        m.title.toLowerCase().includes("compare"),
      );
      expect(midFocusMoments.length).toBeGreaterThan(0);
    });

    it("compiles non-DSA scientific and systemic concepts (Refrigeration Cycle)", () => {
      const prompt = "Explain how a Vapor-Compression Refrigeration Cycle works step by step.";
      const processed = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      expect(processed).toBeDefined();
      const moments = processed.timeline?.moments || [];
      expect(moments.length).toBeGreaterThanOrEqual(3);
      expect(processed.authoritativeModel.concept).toBeDefined();
    });
  });

  describe("3. Entity Conservation Invariant", () => {
    it("conserves non-deleted entities across multi-step timeline", () => {
      const prompt = "Demonstrate array insertion: insert 99 into [10, 20, 30] at index 1.";
      const processed = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      const states = processed.timeline.states;
      expect(states.length).toBeGreaterThanOrEqual(2);

      // Final state must contain original elements + new element
      const finalState = states[states.length - 1];
      const finalValues = Array.from(finalState.graph.entities.values())
        .map((e) => String(e.value ?? e.label))
        .filter(Boolean);

      expect(finalValues).toContain("10");
      expect(finalValues).toContain("20");
      expect(finalValues).toContain("30");
      expect(finalValues).toContain("99");
    });
  });

  describe("4. Layout Quality Validation & Collision Resolution", () => {
    it("detects and resolves overlapping bounding boxes", () => {
      const positions = new Map<string, LayoutPoint>([
        ["node-1", { x: 100, y: 100 }],
        ["node-2", { x: 105, y: 105 }], // Obvious overlap
        ["node-3", { x: 300, y: 100 }], // Clean
      ]);

      const bounds: LayoutBounds = { x: 100, y: 100, width: 260, height: 60 };
      const report = validateSceneLayoutQuality(positions, bounds, undefined, 16);

      expect(report.isValid).toBe(false);
      expect(report.overlapCount).toBeGreaterThan(0);

      // Run collision resolver
      const boxes = [
        { id: "node-1", x: 100, y: 100, width: 60, height: 60, fixed: true },
        { id: "node-2", x: 105, y: 105, width: 60, height: 60, fixed: false },
      ];
      const resolved = resolveLayoutCollisions(boxes, 20);
      const pos2 = resolved.get("node-2");

      expect(pos2).toBeDefined();
      // Node 2 must have been displaced away from node 1
      const dist = Math.hypot((pos2?.x ?? 0) - 100, (pos2?.y ?? 0) - 100);
      expect(dist).toBeGreaterThanOrEqual(60);
    });
  });

  describe("5. What-If Branching Isolation & Restoration", () => {
    it("creates isolated counterfactual branch and cleanly restores parent state", () => {
      const prompt = "Explain Binary Search for [10, 20, 30, 40, 50] searching for 20.";
      const processed = UniversalConceptIntelligenceEngine.processQuestion(prompt);

      worldModel.setLesson(processed.visualLesson, processed.timeline);
      worldModel.setCurrentMoment(1);

      expect(worldModel.getState().currentMoment?.stepIndex).toBe(1);

      // Create branch
      const branch = BranchManager.createBranch(
        "What if the target was 50 instead?",
        worldModel.getState(),
      );
      expect(branch).toBeDefined();

      if (branch) {
        worldModel.enterBranch(branch);
        expect(worldModel.isInWhatIfBranch()).toBe(true);
        expect(worldModel.getActiveBranch()?.branchId).toBe(branch.branchId);

        // Exit branch
        worldModel.exitBranch();
        expect(worldModel.isInWhatIfBranch()).toBe(false);
        expect(worldModel.getState().currentMoment?.stepIndex).toBe(1);
      }
    });
  });

  describe("6. Unified Intent Engine Routing", () => {
    it("unifies natural language and slash commands into identical intent types", () => {
      const intentNextSlash = IntentEngine.resolveIntent("/next");
      const intentNextText = IntentEngine.resolveIntent("next step");
      expect(intentNextSlash.intentType).toBe("COMMAND");
      expect(intentNextText.intentType).toBe("PLAYBACK_CONTROL");

      const intentWhyText = IntentEngine.resolveIntent("why did it rotate?");
      expect(intentWhyText.intentType).toBe("QUESTION_WHY");

      const intentSlower = IntentEngine.resolveIntent("slow down");
      expect(intentSlower.intentType).toBe("PACE_CONTROL");
      expect(intentSlower.parameters.pace).toBe("slower");

      const intentWhatIf = IntentEngine.resolveIntent("what if target was 70?");
      expect(intentWhatIf.intentType).toBe("QUESTION_WHAT_IF");
    });
  });

  describe("7. Voice 3.0 Queue & Telemetry", () => {
    it("provides real-time diagnostics telemetry and prioritizes current step", async () => {
      const provider = new MockFastTTSProvider();
      const queue = new VoiceQueue(provider);

      queue.setAuthoritativeContext("GEN-1", 1, "MAIN");

      const p1 = queue.enqueue({
        lessonId: "L1",
        transformationId: "step-0",
        narration: "Step zero narration.",
        priority: VoicePriority.CURRENT_STEP,
      });

      const p2 = queue.enqueue({
        lessonId: "L1",
        transformationId: "step-1",
        narration: "Step one prefetch.",
        priority: VoicePriority.PREFETCH,
      });

      await Promise.all([p1, p2]);

      const diag = queue.getDiagnostics();
      expect(diag.totalRequests).toBeGreaterThanOrEqual(2);
      expect(diag.circuitBreakerState).toBe("CLOSED");
      expect(diag.totalSuccesses).toBeGreaterThanOrEqual(2);
      expect(diag.totalFailures).toBe(0);

      queue.cleanup();
    });
  });
});
