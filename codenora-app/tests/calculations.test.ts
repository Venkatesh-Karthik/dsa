import { describe, it, expect } from "vitest";

import {
  calculateTreeMetrics,
  calculateArrayMetrics,
  verifyAndEnrichStepCalculations,
} from "../ai/calculations";

import type { TeachingStep, TreeNodeDef, ArrayElement } from "../ai/visual-dsl";

describe("Semantic Calculations & Invariant Verification Engine", () => {
  describe("calculateTreeMetrics", () => {
    it("computes exact heights and balance factors for a perfectly balanced BST", () => {
      const nodes: TreeNodeDef[] = [
        { id: "root", value: 50, left: "l", right: "r" },
        { id: "l", value: 25 },
        { id: "r", value: 75 },
      ];

      const result = calculateTreeMetrics(nodes, "root");

      expect(result.treeHeight).toBe(2);
      expect(result.isAvlBalanced).toBe(true);
      expect(result.imbalancedNodes).toHaveLength(0);

      const rootMetric = result.nodeMetrics.get("root");
      expect(rootMetric?.leftHeight).toBe(1);
      expect(rootMetric?.rightHeight).toBe(1);
      expect(rootMetric?.balanceFactor).toBe(0);
      expect(rootMetric?.isBalanced).toBe(true);
    });

    it("detects Left-Left (LL) imbalance with balance factor +2 at the root", () => {
      // 30 -> Left: 20 -> Left: 10
      const nodes: TreeNodeDef[] = [
        { id: "n30", value: 30, left: "n20" },
        { id: "n20", value: 20, left: "n10" },
        { id: "n10", value: 10 },
      ];

      const result = calculateTreeMetrics(nodes, "n30");

      expect(result.treeHeight).toBe(3);
      expect(result.isAvlBalanced).toBe(false);
      expect(result.imbalancedNodes).toHaveLength(1);

      const rootMetric = result.nodeMetrics.get("n30");
      expect(rootMetric?.leftHeight).toBe(2);
      expect(rootMetric?.rightHeight).toBe(0);
      expect(rootMetric?.balanceFactor).toBe(2);
      expect(rootMetric?.isBalanced).toBe(false);

      const childMetric = result.nodeMetrics.get("n20");
      expect(childMetric?.balanceFactor).toBe(1);
      expect(childMetric?.isBalanced).toBe(true);
    });

    it("detects Right-Right (RR) imbalance with balance factor -2 at the root", () => {
      // 10 -> Right: 20 -> Right: 30
      const nodes: TreeNodeDef[] = [
        { id: "n10", value: 10, right: "n20" },
        { id: "n20", value: 20, right: "n30" },
        { id: "n30", value: 30 },
      ];

      const result = calculateTreeMetrics(nodes, "n10");

      expect(result.treeHeight).toBe(3);
      expect(result.isAvlBalanced).toBe(false);
      expect(result.imbalancedNodes).toHaveLength(1);

      const rootMetric = result.nodeMetrics.get("n10");
      expect(rootMetric?.leftHeight).toBe(0);
      expect(rootMetric?.rightHeight).toBe(2);
      expect(rootMetric?.balanceFactor).toBe(-2);
      expect(rootMetric?.isBalanced).toBe(false);
    });

    it("detects Left-Right (LR) imbalance with BF(root)=+2 and BF(child)=-1", () => {
      // 30 -> Left: 10 -> Right: 20
      const nodes: TreeNodeDef[] = [
        { id: "n30", value: 30, left: "n10" },
        { id: "n10", value: 10, right: "n20" },
        { id: "n20", value: 20 },
      ];

      const result = calculateTreeMetrics(nodes, "n30");

      expect(result.isAvlBalanced).toBe(false);
      const rootMetric = result.nodeMetrics.get("n30");
      expect(rootMetric?.balanceFactor).toBe(2);

      const childMetric = result.nodeMetrics.get("n10");
      expect(childMetric?.balanceFactor).toBe(-1); // Right-leaning child
    });

    it("detects Right-Left (RL) imbalance with BF(root)=-2 and BF(child)=+1", () => {
      // 10 -> Right: 30 -> Left: 20
      const nodes: TreeNodeDef[] = [
        { id: "n10", value: 10, right: "n30" },
        { id: "n30", value: 30, left: "n20" },
        { id: "n20", value: 20 },
      ];

      const result = calculateTreeMetrics(nodes, "n10");

      expect(result.isAvlBalanced).toBe(false);
      const rootMetric = result.nodeMetrics.get("n10");
      expect(rootMetric?.balanceFactor).toBe(-2);

      const childMetric = result.nodeMetrics.get("n30");
      expect(childMetric?.balanceFactor).toBe(1); // Left-leaning child
    });
  });

  describe("calculateArrayMetrics", () => {
    it("computes bounds, length, and detects midpointer element", () => {
      const elements: ArrayElement[] = [
        { value: 10, highlight: "low" },
        { value: 20 },
        { value: 30 },
        { value: 40, highlight: "mid" },
        { value: 50 },
        { value: 60 },
        { value: 70, highlight: "high" },
      ];

      const pointers = [
        {
          type: "annotate_pointer" as const,
          id: "p-low",
          label: "LOW",
          target: "arr-0",
          placement: "above" as const,
        },
        {
          type: "annotate_pointer" as const,
          id: "p-mid",
          label: "MID",
          target: "arr-3",
          placement: "above" as const,
        },
        {
          type: "annotate_pointer" as const,
          id: "p-high",
          label: "HIGH",
          target: "arr-6",
          placement: "above" as const,
        },
      ];

      const metrics = calculateArrayMetrics(elements, "arr", pointers);

      expect(metrics.length).toBe(7);
      expect(metrics.lowIndex).toBe(0);
      expect(metrics.highIndex).toBe(6);
      expect(metrics.computedMidIndex).toBe(3);
      expect(metrics.actualMidIndex).toBe(3);
      expect(metrics.midValue).toBe(40);
    });
  });

  describe("verifyAndEnrichStepCalculations", () => {
    it("enriches step with tree height and balance factor when tree is present", () => {
      const step: TeachingStep = {
        id: "step-1",
        title: "AVL LL Imbalance",
        explanation: "Inserting 10 causes node 30 to become unbalanced.",
        visual_actions: [
          {
            type: "create_tree",
            id: "tree-1",
            root: "n30",
            nodes: [
              { id: "n30", value: 30, left: "n20" },
              { id: "n20", value: 20, left: "n10" },
              { id: "n10", value: 10 },
            ],
          },
        ],
      };

      const enriched = verifyAndEnrichStepCalculations(step);

      expect(enriched.calculations).toBeDefined();
      expect(enriched.calculations).toContain("Node 30");
      expect(enriched.calculations).toContain("BF = +2");
      expect(enriched.calculations).toContain("Imbalance detected");
    });

    it("preserves AI-provided calculations while appending verified metrics", () => {
      const step: TeachingStep = {
        id: "step-2",
        title: "Binary Search Midpoint",
        explanation: "Check the middle element.",
        calculations: "Target = 60\nmid = (0 + 6) / 2 = 3",
        visual_actions: [
          {
            type: "create_array",
            id: "arr-bs",
            elements: [
              { value: 10, highlight: "low" },
              { value: 20 },
              { value: 30 },
              { value: 40, highlight: "mid" },
              { value: 50 },
              { value: 60 },
              { value: 70, highlight: "high" },
            ],
          },
        ],
      };

      const enriched = verifyAndEnrichStepCalculations(step);

      expect(enriched.calculations).toContain("Target = 60");
      expect(enriched.calculations).toContain("mid = (0 + 6) / 2 = 3");
    });
  });
});
