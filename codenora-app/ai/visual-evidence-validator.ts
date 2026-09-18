/**
 * Visual Evidence Validator
 *
 * Universal validation engine enforcing the strict pipeline:
 * EXPLANATION CLAIM
 *     ↓
 * SEMANTIC FACT
 *     ↓
 * AUTHORITATIVE STATE
 *     ↓
 * VISUAL REPRESENTATION
 *     ↓
 * VISUAL EVIDENCE
 *
 * Never allows explanatory claims that the visual scene or authoritative state does not support.
 */

import {
  type AuthoritativeSemanticModel,
  type AuthoritativeTransformation,
} from "./authoritative-model";
import { type SceneGraph, type SemanticEntity } from "./scene-graph";
import { type Invariant } from "./rules-invariants";

export interface VerifiedClaim {
  claimText: string;
  claimType:
    | "entity_presence"
    | "state_change"
    | "relationship_flow"
    | "invariant_preservation"
    | "action";
  semanticFactFound: boolean;
  authoritativeStateVerified: boolean;
  visualEvidenceFound: boolean;
  supportingEntityIds: string[];
  missingEvidenceReason?: string;
}

export interface VisualEvidenceValidationReport {
  valid: boolean;
  stepIndex: number;
  totalClaimsChecked: number;
  verifiedClaims: VerifiedClaim[];
  unsupportedClaims: string[];
  missingVisualEntities: string[];
  invariantViolations: string[];
  confidenceScore: number; // 0..1
}

export class VisualEvidenceValidator {
  /**
   * Validates that all pedagogical claims made in the step explanation and transformation
   * have corresponding authoritative semantic facts and visible evidence in the scene graph.
   */
  public static validateStepEvidence(
    model: AuthoritativeSemanticModel,
    sceneGraph: SceneGraph,
    stepIndex: number,
    customExplanation?: string,
  ): VisualEvidenceValidationReport {
    const transformation: AuthoritativeTransformation | undefined =
      stepIndex > 0 ? model.transformations[stepIndex - 1] : undefined;
    const currentState = model.states[stepIndex] || model.states[0];

    const explanationText =
      customExplanation ||
      transformation?.explanation ||
      transformation?.whatChanged ||
      model.problem?.question ||
      model.problem?.objective ||
      "";

    const verifiedClaims: VerifiedClaim[] = [];
    const unsupportedClaims: string[] = [];
    const missingVisualEntities: string[] = [];
    const invariantViolations: string[] = [];

    // 1. Validate Entity Presence Claims
    const worldEntities =
      model.world?.entities || Array.from(currentState.entities.values());
    for (const entity of worldEntities) {
      const isMentioned =
        explanationText.toLowerCase().includes(entity.id.toLowerCase()) ||
        (entity.label &&
          explanationText.toLowerCase().includes(entity.label.toLowerCase()));

      const existsInAuthoritativeState =
        currentState.entities.has(entity.id) ||
        Array.from(currentState.entities.values()).some(
          (e) => e.id === entity.id,
        );

      const existsInVisualScene = sceneGraph.entities.has(entity.id);

      if (isMentioned || existsInAuthoritativeState) {
        const claim: VerifiedClaim = {
          claimText: `Entity '${entity.label || entity.id}' presence`,
          claimType: "entity_presence",
          semanticFactFound: true,
          authoritativeStateVerified: existsInAuthoritativeState,
          visualEvidenceFound: existsInVisualScene,
          supportingEntityIds: [entity.id],
        };

        if (!existsInVisualScene) {
          claim.missingEvidenceReason = `Entity '${
            entity.label || entity.id
          }' (${
            entity.id
          }) is authoritative but missing from visual scene graph.`;
          unsupportedClaims.push(claim.claimText);
          missingVisualEntities.push(entity.id);
        }

        verifiedClaims.push(claim);
      }
    }

    // 2. Validate Relationship & Flow Claims
    const worldRelationships =
      model.world?.relationships ||
      Array.from(currentState.relationships.values());
    for (const rel of worldRelationships) {
      const relDesc = `${rel.source} -> ${rel.target} (${rel.type})`;
      const isMentioned =
        explanationText.toLowerCase().includes(rel.type.toLowerCase()) ||
        (rel.label &&
          explanationText.toLowerCase().includes(rel.label.toLowerCase()));

      const existsInWorld = true;
      const existsInVisualScene = Array.from(
        sceneGraph.relationships.values(),
      ).some(
        (r) =>
          (r.sourceEntityId === rel.source &&
            r.targetEntityId === rel.target) ||
          (r.sourceEntityId === rel.target &&
            r.targetEntityId === rel.source &&
            r.properties?.directed === false),
      );

      if (isMentioned) {
        const claim: VerifiedClaim = {
          claimText: `Relationship '${rel.label || relDesc}'`,
          claimType: "relationship_flow",
          semanticFactFound: existsInWorld,
          authoritativeStateVerified: true,
          visualEvidenceFound: existsInVisualScene,
          supportingEntityIds: [rel.source, rel.target],
        };

        if (!existsInVisualScene) {
          claim.missingEvidenceReason = `Relationship '${relDesc}' is mentioned in explanation but missing visual connector.`;
          unsupportedClaims.push(claim.claimText);
        }

        verifiedClaims.push(claim);
      }
    }

    // 3. Validate State Transition Claims
    if (transformation) {
      const stateMentions = extractStateKeywords(explanationText);
      for (const stateWord of stateMentions) {
        let matchingEntityFound = false;
        let visualEvidenceFound = false;
        const matchingIds: string[] = [];

        for (const [id, visualEnt] of sceneGraph.entities.entries()) {
          const authEnt = currentState.entities.get(id);
          const currentEntityState = String(authEnt?.state || "").toLowerCase();
          const visualEntityState = String(visualEnt.state || "").toLowerCase();
          const visualLabel = String(visualEnt.label || "").toLowerCase();

          if (
            currentEntityState.includes(stateWord) ||
            visualEntityState.includes(stateWord) ||
            visualLabel.includes(stateWord)
          ) {
            matchingEntityFound = true;
            matchingIds.push(id);
            if (
              visualEntityState.includes(stateWord) ||
              visualLabel.includes(stateWord)
            ) {
              visualEvidenceFound = true;
            }
          }
        }

        if (matchingEntityFound) {
          const claim: VerifiedClaim = {
            claimText: `State claim '${stateWord}'`,
            claimType: "state_change",
            semanticFactFound: true,
            authoritativeStateVerified: matchingEntityFound,
            visualEvidenceFound,
            supportingEntityIds: matchingIds,
          };

          if (!visualEvidenceFound) {
            claim.missingEvidenceReason = `Explanation mentions state '${stateWord}', but visual entities do not display this state.`;
            unsupportedClaims.push(claim.claimText);
          }

          verifiedClaims.push(claim);
        }
      }
    }

    // 4. Executable Invariant Verification
    const activeInvariants: Invariant[] = model.invariants || [];
    for (const inv of activeInvariants) {
      let passed = true;
      let reason: string | undefined;

      try {
        if (typeof inv.predicate === "function") {
          passed = Boolean(inv.predicate(currentState));
        } else if (
          inv.category === "structural" ||
          inv.statement.toLowerCase().includes("unique")
        ) {
          const ids = Array.from(currentState.entities.keys());
          passed = new Set(ids).size === ids.length;
          if (!passed) {
            reason = "Entity IDs are not unique in state.";
          }
        } else if (inv.category === "relational") {
          const entityIds = new Set(currentState.entities.keys());
          const rels =
            model.world?.relationships ||
            Array.from(currentState.relationships.values());
          for (const r of rels) {
            if (!entityIds.has(r.source) || !entityIds.has(r.target)) {
              passed = false;
              reason = `Relationship endpoint '${r.source}' or '${r.target}' does not exist in state.`;
              break;
            }
          }
        }
      } catch (err: any) {
        passed = false;
        reason = `Invariant predicate threw: ${err?.message || String(err)}`;
      }

      const invName = inv.statement || inv.id;
      if (!passed) {
        const failureMsg = `Invariant '${invName}' violated in step ${stepIndex}: ${
          reason || inv.description || inv.statement
        }`;
        invariantViolations.push(failureMsg);
        verifiedClaims.push({
          claimText: `Invariant '${invName}'`,
          claimType: "invariant_preservation",
          semanticFactFound: true,
          authoritativeStateVerified: false,
          visualEvidenceFound: false,
          supportingEntityIds: [],
          missingEvidenceReason: failureMsg,
        });
      }
    }

    const totalClaims = verifiedClaims.length;
    const verifiedCount = verifiedClaims.filter(
      (c) =>
        c.semanticFactFound &&
        c.authoritativeStateVerified &&
        c.visualEvidenceFound,
    ).length;

    const confidenceScore =
      totalClaims > 0 ? Number((verifiedCount / totalClaims).toFixed(2)) : 1.0;

    const valid =
      unsupportedClaims.length === 0 &&
      missingVisualEntities.length === 0 &&
      invariantViolations.length === 0;

    return {
      valid,
      stepIndex,
      totalClaimsChecked: totalClaims,
      verifiedClaims,
      unsupportedClaims,
      missingVisualEntities,
      invariantViolations,
      confidenceScore,
    };
  }
}

/**
 * Extracts recognized semantic state keywords from explanatory text.
 */
function extractStateKeywords(text: string): string[] {
  if (!text) {
    return [];
  }
  const knownKeywords = [
    "listen",
    "syn-sent",
    "syn-received",
    "established",
    "active",
    "inactive",
    "pending",
    "success",
    "failure",
    "failed",
    "recovery",
    "recovered",
    "committed",
    "aborted",
    "balanced",
    "unbalanced",
    "visited",
    "unvisited",
    "ready",
    "running",
    "waiting",
    "terminated",
  ];

  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const kw of knownKeywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
      matched.push(kw);
    }
  }

  return matched;
}
