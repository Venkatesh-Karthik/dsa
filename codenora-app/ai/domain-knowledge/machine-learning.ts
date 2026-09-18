/**
 * Machine Learning Domain Knowledge Module
 *
 * Covers Gradient Descent, Loss Landscapes, Neural Networks, Backpropagation,
 * Weights, Biases, and Optimization.
 */

import type { DomainKnowledgeModule, ExtractedInspectorData } from "./types";
import type {
  ConceptInvariant,
  ConceptMisconception,
  ConceptState,
  ConceptTransformation,
  ConceptModel,
  TeachingStrategy,
} from "../concept-model";

export const MachineLearningDomainModule: DomainKnowledgeModule = {
  id: "machine_learning",
  domain: "machine_learning",
  name: "Machine Learning & Optimization",
  description:
    "Gradient Descent, Loss Functions, Weights, Biases, Backpropagation, and Neural Layers",

  matches(concept: string, prompt: string = ""): boolean {
    const text = `${concept} ${prompt}`.toLowerCase();
    return (
      text.includes("gradient descent") ||
      text.includes("machine learning") ||
      text.includes("neural") ||
      text.includes("loss function") ||
      text.includes("backpropagation") ||
      text.includes("weights") ||
      text.includes("learning rate") ||
      text.includes("epoch") ||
      text.includes("convergence")
    );
  },

  suggestStrategy(concept: string, prompt: string = ""): TeachingStrategy {
    const text = `${concept} ${prompt}`.toLowerCase();
    if (
      text.includes("gradient") ||
      text.includes("optimization") ||
      text.includes("epoch")
    ) {
      return "ITERATIVE_OPTIMIZATION";
    }
    if (text.includes("backprop") || text.includes("feedforward")) {
      return "DATA_FLOW";
    }
    return "ITERATIVE_OPTIMIZATION";
  },

  getInvariants(concept: string): ConceptInvariant[] {
    return [
      {
        id: "inv-loss-minimization",
        description: "Gradient descent direction",
        rule: "Parameter updates move in the opposite direction of the gradient: w_new = w_old - learningRate * gradient.",
      },
      {
        id: "inv-learning-rate-bounds",
        description: "Learning rate positivity",
        rule: "Learning rate alpha must remain strictly positive (alpha > 0) to ensure meaningful gradient steps.",
      },
    ];
  },

  getMisconceptions(concept: string): ConceptMisconception[] {
    return [
      {
        id: "misc-learning-rate-large",
        misunderstanding:
          "A larger learning rate always accelerates convergence to the minimum.",
        misconception:
          "A larger learning rate always accelerates convergence to the minimum.",
        correction:
          "An excessively large learning rate causes catastrophic divergence or oscillating overshoots across the valley.",
      },
      {
        id: "misc-local-global-min",
        misunderstanding:
          "Gradient descent always converges to the absolute global minimum on non-convex surfaces.",
        misconception:
          "Gradient descent always converges to the absolute global minimum on non-convex surfaces.",
        correction:
          "Standard gradient descent can settle into local minima, saddle points, or plateaus depending on initialization.",
      },
    ];
  },

  extractInspectorData(
    state: any,
    transformation?: any,
    model?: ConceptModel,
  ): ExtractedInspectorData {
    const metrics: Array<{
      label: string;
      value: string | number;
      badgeColor?: string;
    }> = [];
    const properties: Array<{ label: string; value: string | number }> = [];

    if (
      transformation?.inspectorData?.metrics &&
      transformation.inspectorData.metrics.length > 0
    ) {
      metrics.push(...transformation.inspectorData.metrics);
    }
    if (
      transformation?.inspectorData?.properties &&
      transformation.inspectorData.properties.length > 0
    ) {
      properties.push(...transformation.inspectorData.properties);
    }

    const stateIdx = state?.stateIndex ?? state?.version ?? 0;
    const graphEntities = state?.graph?.entities
      ? Array.from(state.graph.entities.values())
      : [];
    const modelEntities = model?.entities || [];

    if (metrics.length === 0) {
      metrics.push({
        label: "Current Step",
        value: `Iteration ${stateIdx + 1}`,
      });
      const lossVal = Math.max(0.01, +(1.0 / (stateIdx + 1.2)).toFixed(3));
      metrics.push({
        label: "Loss (MSE)",
        value: lossVal,
        badgeColor: "#2563eb",
      });
      metrics.push({ label: "Learning Rate (α)", value: "0.01" });
      if (graphEntities.length > 0 || modelEntities.length > 0) {
        metrics.push({
          label: "Active Parameters",
          value: graphEntities.length || modelEntities.length,
        });
      }
    }

    const sections = [
      {
        title: "Metrics",
        properties: metrics.map((m) => ({ label: m.label, value: m.value })),
      },
      ...(properties.length > 0
        ? [
            {
              title: "Properties",
              properties,
            },
          ]
        : []),
    ];

    return {
      title: "Model Training State",
      subtitle: "Gradient trajectory, loss convergence, and parameter updates",
      metrics,
      properties,
      sections,
      statusBadge:
        transformation?.inspectorData?.statusBadge ||
        `Iteration ${stateIdx + 1}`,
      operation: transformation?.action || transformation?.title,
      resultSummary:
        transformation?.reason || transformation?.learnerObservation,
    };
  },
};
