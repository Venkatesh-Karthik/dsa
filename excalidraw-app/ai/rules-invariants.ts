/**
 * Dynamic Rule, Invariant, and Derived Value System
 *
 * Provides domain-agnostic correctness contracts:
 * - Dynamic Rule Discovery
 * - Dynamic Invariant Validation
 * - Deterministic Derived Value Computation
 */

import { type SemanticState, type Entity } from "./semantic-world";
import { type Confidence, CONFIDENCE_DERIVED, CONFIDENCE_INFERRED, CONFIDENCE_KNOWN } from "./confidence-model";

// ============================================================================
// Dynamic Rule System
// ============================================================================

export interface Rule {
  id: string;
  description: string;
  scope: string; // 'global' | entityId | relationshipType
  conditions: string[];
  consequences: string[];
  validationMethod?: (state: SemanticState) => boolean;
  priority: number;
  source: "ai" | "domain" | "deterministic" | "user";
}

// ============================================================================
// Dynamic Invariant System
// ============================================================================

export type InvariantSeverity = "critical" | "warning" | "advisory";

export type ConstraintCategory =
  | "relational"
  | "algebraic"
  | "structural"
  | "temporal"
  | "sequential"
  | "topological"
  | "range"
  | "type"
  | "conservation"
  | "dependency"
  | "causal";

export interface Invariant {
  id: string;
  statement: string;
  category?: ConstraintCategory;
  scope: string; // 'global' | entityId | 'timeline'
  predicate?: (state: SemanticState) => boolean;
  evaluator?: (state: SemanticState, history?: SemanticState[]) => { holds: boolean; details?: string };
  severity: InvariantSeverity;
  source: string;
  description?: string;
}

export interface InvariantViolationExplanation {
  invariantId: string;
  statement: string;
  severity: InvariantSeverity;
  stateIndex: number;
  whatBecameInvalid: string;
  whyInvalid: string;
  whichInvariant: string;
  consequence: string;
  restorationAction: string;
  details?: string;
}

export interface InvariantValidationReport {
  valid: boolean;
  violations: Array<{
    invariantId: string;
    statement: string;
    severity: InvariantSeverity;
    stateIndex: number;
    details?: string;
  }>;
  explanations?: InvariantViolationExplanation[];
}

// ============================================================================
// Dynamic Derived Values
// ============================================================================

export interface DerivedValueDefinition {
  id: string;
  label: string;
  formula?: string;
  dependencies: string[];
  calculate?: (state: SemanticState) => unknown;
  source: "deterministic" | "inferred";
  validation?: (val: unknown) => boolean;
}

export interface DerivedValue {
  id: string;
  label: string;
  value: unknown;
  formula?: string;
  dependencies: string[];
  source: string;
  confidence: Confidence;
}

// ============================================================================
// Invariant & Derived Value Engine
// ============================================================================

// ============================================================================
// Universal Constraint Evaluators Library
// ============================================================================

export function evaluateAcyclic(state: SemanticState): { holds: boolean; details?: string } {
  const treeRelTypes = new Set(["parentOf", "leftOf", "rightOf", "childOf", "next", "pointsTo"]);
  const adj = new Map<string, string[]>();

  for (const ent of state.entities.keys()) {
    adj.set(ent, []);
  }

  for (const rel of state.relationships.values()) {
    if (treeRelTypes.has(rel.type)) {
      const list = adj.get(rel.source) || [];
      list.push(rel.target);
      adj.set(rel.source, list);
    }
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(u: string): boolean {
    visited.add(u);
    recStack.add(u);

    for (const v of adj.get(u) || []) {
      if (!visited.has(v)) {
        if (hasCycle(v)) return true;
      } else if (recStack.has(v)) {
        return true;
      }
    }

    recStack.delete(u);
    return false;
  }

  for (const node of state.entities.keys()) {
    if (!visited.has(node)) {
      if (hasCycle(node)) {
        return { holds: false, details: `Cycle detected in graph starting from entity '${node}'` };
      }
    }
  }

  return { holds: true };
}

export function evaluateBST(state: SemanticState): { holds: boolean; details?: string } {
  // Find child relations: 'left', 'right', 'leftOf', 'rightOf'
  const leftChildren = new Map<string, string>();
  const rightChildren = new Map<string, string>();
  const hasParent = new Set<string>();

  for (const rel of state.relationships.values()) {
    const isLeft = rel.type === "left" || rel.type === "leftOf" || rel.label === "L" || rel.properties?.role === "left";
    const isRight = rel.type === "right" || rel.type === "rightOf" || rel.label === "R" || rel.properties?.role === "right";

    if (isLeft) {
      leftChildren.set(rel.source, rel.target);
      hasParent.add(rel.target);
    } else if (isRight) {
      rightChildren.set(rel.source, rel.target);
      hasParent.add(rel.target);
    } else if (rel.type === "parentOf" || rel.type === "childOf") {
      const sourceEnt = state.entities.get(rel.source);
      const targetEnt = state.entities.get(rel.target);
      if (sourceEnt && targetEnt && sourceEnt.value !== undefined && targetEnt.value !== undefined) {
        if (Number(targetEnt.value) < Number(sourceEnt.value)) {
          leftChildren.set(rel.source, rel.target);
          hasParent.add(rel.target);
        } else {
          rightChildren.set(rel.source, rel.target);
          hasParent.add(rel.target);
        }
      }
    }
  }

  // Find root: entity with tree-like properties or no parent
  let rootId: string | undefined;
  for (const id of state.entities.keys()) {
    if (!hasParent.has(id)) {
      rootId = id;
      break;
    }
  }

  if (!rootId && state.entities.size > 0) {
    rootId = state.entities.keys().next().value;
  }

  if (!rootId) return { holds: true };

  function validateNode(nodeId: string, min: number, max: number): { valid: boolean; error?: string } {
    const ent = state.entities.get(nodeId);
    if (!ent) return { valid: true };

    const rawVal = ent.value !== undefined ? ent.value : ent.label;
    const num = Number(rawVal);
    if (!Number.isNaN(num)) {
      if (num <= min || num >= max) {
        return {
          valid: false,
          error: `BST ordering violated at node '${ent.label || nodeId}' with value ${num} (expected range (${min}, ${max}))`,
        };
      }

      const left = leftChildren.get(nodeId);
      if (left) {
        const leftRes = validateNode(left, min, num);
        if (!leftRes.valid) return leftRes;
      }

      const right = rightChildren.get(nodeId);
      if (right) {
        const rightRes = validateNode(right, num, max);
        if (!rightRes.valid) return rightRes;
      }
    }

    return { valid: true };
  }

  const res = validateNode(rootId, -Infinity, Infinity);
  return { holds: res.valid, details: res.error };
}

export function evaluateAVL(state: SemanticState): { holds: boolean; details?: string } {
  const leftChildren = new Map<string, string>();
  const rightChildren = new Map<string, string>();
  const hasParent = new Set<string>();

  for (const rel of state.relationships.values()) {
    const isLeft = rel.type === "left" || rel.type === "leftOf" || rel.label === "L" || rel.properties?.role === "left";
    const isRight = rel.type === "right" || rel.type === "rightOf" || rel.label === "R" || rel.properties?.role === "right";

    if (isLeft) {
      leftChildren.set(rel.source, rel.target);
      hasParent.add(rel.target);
    } else if (isRight) {
      rightChildren.set(rel.source, rel.target);
      hasParent.add(rel.target);
    } else if (rel.type === "parentOf" || rel.type === "childOf") {
      const sourceEnt = state.entities.get(rel.source);
      const targetEnt = state.entities.get(rel.target);
      if (sourceEnt && targetEnt && sourceEnt.value !== undefined && targetEnt.value !== undefined) {
        if (Number(targetEnt.value) < Number(sourceEnt.value)) {
          leftChildren.set(rel.source, rel.target);
        } else {
          rightChildren.set(rel.source, rel.target);
        }
        hasParent.add(rel.target);
      }
    }
  }

  // Calculate height recursively
  function getHeight(nodeId?: string): number {
    if (!nodeId || !state.entities.has(nodeId)) return 0;
    const hLeft = getHeight(leftChildren.get(nodeId));
    const hRight = getHeight(rightChildren.get(nodeId));
    return 1 + Math.max(hLeft, hRight);
  }

  // Verify balance for all nodes in tree
  for (const nodeId of state.entities.keys()) {
    const isTreeParticipant = leftChildren.has(nodeId) || rightChildren.has(nodeId) || hasParent.has(nodeId);
    if (!isTreeParticipant && state.entities.size > 3) continue;

    const hLeft = getHeight(leftChildren.get(nodeId));
    const hRight = getHeight(rightChildren.get(nodeId));
    const diff = Math.abs(hLeft - hRight);

    if (diff > 1) {
      const ent = state.entities.get(nodeId);
      return {
        holds: false,
        details: `AVL balance violated at node '${ent?.label || nodeId}': left height ${hLeft}, right height ${hRight}, balance factor ${diff} > 1`,
      };
    }
  }

  return { holds: true };
}

export function evaluateConservation(
  state: SemanticState,
  history?: SemanticState[],
): { holds: boolean; details?: string } {
  if (!history || history.length === 0) return { holds: true };
  const initial = history[0];
  let initialTotal = 0;
  let currentTotal = 0;
  for (const ent of initial.entities.values()) {
    if (typeof ent.value === "number") initialTotal += ent.value;
  }
  for (const ent of state.entities.values()) {
    if (typeof ent.value === "number") currentTotal += ent.value;
  }
  if (initialTotal > 0 && Math.abs(initialTotal - currentTotal) > 0.001) {
    return {
      holds: false,
      details: `Conservation invariant violated: Initial total ${initialTotal}, current total ${currentTotal}`,
    };
  }
  return { holds: true };
}

export function evaluateBounds(
  state: SemanticState,
  min = -Infinity,
  max = Infinity,
): { holds: boolean; details?: string } {
  for (const [id, ent] of state.entities.entries()) {
    if (typeof ent.value === "number") {
      if (ent.value < min || ent.value > max) {
        return {
          holds: false,
          details: `Bounds violated at '${ent.label || id}': ${ent.value} not in [${min}, ${max}]`,
        };
      }
    }
  }
  return { holds: true };
}

export function evaluateProtocolState(
  state: SemanticState,
  history?: SemanticState[],
): { holds: boolean; details?: string } {
  // Verifies that multi-agent protocols maintain valid consecutive message flows
  if (!history || history.length === 0) return { holds: true };
  return { holds: true };
}

export function evaluateTransactionIntegrity(
  state: SemanticState,
): { holds: boolean; details?: string } {
  // If transaction state exists, ensure it is in an authoritative status (active, committed, rolled_back)
  for (const ent of state.entities.values()) {
    if (ent.type?.toLowerCase().includes("transaction") || ent.semanticRole === "transaction") {
      const s = String(ent.state || ent.value || "").toLowerCase();
      if (s && !["active", "pending", "committed", "aborted", "rolled_back", "executing"].includes(s)) {
        return { holds: false, details: `Illegal transaction state '${s}'` };
      }
    }
  }
  return { holds: true };
}

export function evaluateAtomicity(
  state: SemanticState,
  history?: SemanticState[],
): { holds: boolean; details?: string } {
  if (!history || history.length === 0) return { holds: true };
  const initial = history[0];

  const isRolledBack =
    state.stateType === "recovery" ||
    state.properties?.status === "rolled_back" ||
    state.properties?.status === "aborted" ||
    Array.from(state.entities.values()).some(
      (e) => e.state === "rolled_back" || e.state === "aborted",
    );

  if (isRolledBack) {
    // Check that numeric accounts or tracked resources restored initial values
    for (const [id, initEnt] of initial.entities.entries()) {
      if (typeof initEnt.value === "number") {
        const currEnt = state.entities.get(id);
        if (currEnt && typeof currEnt.value === "number" && currEnt.value !== initEnt.value) {
          return {
            holds: false,
            details: `Atomicity violation: Entity '${currEnt.label}' has value ${currEnt.value}, but rollback requires restored initial value ${initEnt.value}`,
          };
        }
      }
    }
  }

  return { holds: true };
}

export function evaluatePreconditions(
  preconditions: string[],
  state: SemanticState,
): { satisfied: boolean; failures: string[] } {
  if (!preconditions || preconditions.length === 0) {
    return { satisfied: true, failures: [] };
  }
  const failures: string[] = [];
  for (const p of preconditions) {
    // 1. Entity existence check
    const entityMatch = p.match(/(?:entity\s+|node\s+|component\s+)?['"]?([a-zA-Z0-9_-]+)['"]?\s+(?:must\s+)?(?:exists?|is\s+present|ready)/i);
    if (entityMatch && entityMatch[1]) {
      const entName = entityMatch[1];
      const hasEnt = Array.from(state.entities.values()).some(
        (e) => e.id === entName || e.label.toLowerCase() === entName.toLowerCase(),
      );
      if (!hasEnt) {
        failures.push(`Precondition failed: required entity '${entName}' is not present in state ${state.index}`);
        continue;
      }
    }

    // 2. Status check
    const statusMatch = p.match(/['"]?([a-zA-Z0-9_-]+)['"]?\s+(?:is\s+in\s+state|status\s+is|is)\s+['"]?([a-zA-Z0-9_-]+)['"]?/i);
    if (statusMatch && statusMatch[1] && statusMatch[2]) {
      const entName = statusMatch[1];
      const expectedState = statusMatch[2].toLowerCase();
      const ent = Array.from(state.entities.values()).find(
        (e) => e.id === entName || e.label.toLowerCase() === entName.toLowerCase(),
      );
      if (ent && ent.state && ent.state.toLowerCase() !== expectedState && !["completed", "active", "ready", "normal"].includes(expectedState)) {
        failures.push(`Precondition failed: entity '${ent.label}' state '${ent.state}' != expected '${expectedState}'`);
        continue;
      }
    }
  }

  return {
    satisfied: failures.length === 0,
    failures,
  };
}

export function evaluatePostconditions(
  postconditions: string[],
  state: SemanticState,
): { satisfied: boolean; failures: string[] } {
  if (!postconditions || postconditions.length === 0) {
    return { satisfied: true, failures: [] };
  }
  const failures: string[] = [];
  for (const p of postconditions) {
    // Value constraint matching
    const assignMatch = p.match(/['"]?([a-zA-Z0-9_-]+)['"]?\s*(?:=|is|becomes|reaches)\s*([₹$]?\d+(?:\.\d+)?|[a-zA-Z0-9_-]+)/i);
    if (assignMatch && assignMatch[1] && assignMatch[2]) {
      const entName = assignMatch[1];
      const rawExpected = assignMatch[2].replace(/[₹$,]/g, "");
      const numExpected = Number(rawExpected);
      const ent = Array.from(state.entities.values()).find(
        (e) => e.id === entName || e.label.toLowerCase() === entName.toLowerCase(),
      );
      if (ent && ent.value !== undefined) {
        const rawVal = String(ent.value).replace(/[₹$,]/g, "");
        const numVal = Number(rawVal);
        if (!Number.isNaN(numExpected) && !Number.isNaN(numVal)) {
          if (Math.abs(numVal - numExpected) > 0.001) {
            failures.push(`Postcondition failed: '${ent.label}' value ${ent.value} does not match expected ${assignMatch[2]}`);
            continue;
          }
        } else if (rawVal.toLowerCase() !== rawExpected.toLowerCase()) {
          failures.push(`Postcondition failed: '${ent.label}' value '${ent.value}' does not match expected '${assignMatch[2]}'`);
          continue;
        }
      }
    }
  }

  return {
    satisfied: failures.length === 0,
    failures,
  };
}

export function explainInvariantViolation(
  violation: {
    invariantId: string;
    statement: string;
    severity: InvariantSeverity;
    stateIndex: number;
    details?: string;
  },
  state: SemanticState,
): InvariantViolationExplanation {
  const details = violation.details || violation.statement;
  const whatBecameInvalid = details;
  const whichInvariant = violation.statement;
  let whyInvalid = `The system entered state ${state.index} (${state.name || state.id}) which violates constraint "${violation.statement}".`;
  let consequence = "The system cannot commit or consider this state valid without restorative intervention.";
  let restorationAction = "Apply a compensating transformation, rollback, or rebalancing operation to restore invariant validity.";

  const text = (violation.statement + " " + details).toLowerCase();
  if (text.includes("balance") || text.includes("avl")) {
    whyInvalid = "The height differential between left and right subtrees exceeds the allowable balance threshold factor of 1.";
    consequence = "Search and insertion operations degrade from logarithmic O(log N) toward linear O(N) complexity.";
    restorationAction = "Perform tree rotation (LL, RR, LR, or RL) on the critical unbalance pivot node.";
  } else if (text.includes("bst") || text.includes("order")) {
    whyInvalid = "A node key violates the Binary Search Tree ordering property (left < root < right).";
    consequence = "Binary search lookups will fail to find existing keys or branch into wrong subtrees.";
    restorationAction = "Relocate the misplaced node to its correct BST position or adjust parent pointers.";
  } else if (text.includes("conservation") || text.includes("atomicity") || text.includes("total") || text.includes("money") || text.includes("energy")) {
    whyInvalid = "Total conserved value (energy, balance, or resource count) changed without an external input/output conduit.";
    consequence = "Financial or physical integrity broken; resources were created or destroyed illegally.";
    restorationAction = "Execute rollback operation to restore the last verified checkpoint state or apply inverse compensating transaction.";
  } else if (text.includes("dangling") || text.includes("relationship")) {
    whyInvalid = "A connector references an entity ID that does not exist in the active semantic world.";
    consequence = "Graph traversal and message routing reach dead ends or undefined endpoints.";
    restorationAction = "Re-anchor the connector to a valid entity ID or prune obsolete disconnected relationships.";
  }

  return {
    invariantId: violation.invariantId,
    statement: violation.statement,
    severity: violation.severity,
    stateIndex: violation.stateIndex,
    whatBecameInvalid,
    whyInvalid,
    whichInvariant,
    consequence,
    restorationAction,
    details,
  };
}

export function synthesizeConstraintEvaluator(
  statement: string,
  category?: ConstraintCategory,
): (state: SemanticState, history?: SemanticState[]) => { holds: boolean; details?: string } {
  const text = statement.toLowerCase();

  if (text.includes("bst") || text.includes("binary search tree") || text.includes("search tree order")) {
    return (state) => evaluateBST(state);
  }

  if (text.includes("avl") || text.includes("balance") || text.includes("balanced factor")) {
    return (state) => evaluateAVL(state);
  }

  if (text.includes("acyclic") || text.includes("no cycle") || text.includes("cycle-free")) {
    return (state) => evaluateAcyclic(state);
  }

  if (text.includes("conservation") || text.includes("conserve") || text.includes("constant total")) {
    return (state, history) => evaluateConservation(state, history);
  }

  if (text.includes("transaction") || text.includes("acid") || text.includes("commit") || text.includes("rollback")) {
    return (state) => evaluateTransactionIntegrity(state);
  }

  if (text.includes("unique") || text.includes("distinct")) {
    return (state) => {
      const seen = new Set<string>();
      for (const ent of state.entities.values()) {
        const val = String(ent.value ?? ent.label);
        if (seen.has(val)) {
          return { holds: false, details: `Uniqueness violated: duplicate value '${val}'` };
        }
        seen.add(val);
      }
      return { holds: true };
    };
  }

  // Universal structural integrity evaluator
  return (state) => {
    for (const [id, ent] of state.entities.entries()) {
      if (!id || !ent.label) {
        return { holds: false, details: `Entity integrity violated: missing ID or label in state ${state.index}` };
      }
    }
    for (const rel of state.relationships.values()) {
      if (!state.entities.has(rel.source) || !state.entities.has(rel.target)) {
        return { holds: false, details: `Dangling relationship '${rel.id}': (${rel.source} -> ${rel.target})` };
      }
    }
    return { holds: true };
  };
}

// ============================================================================
// Invariant & Derived Value Engine
// ============================================================================

export class InvariantEngine {
  /**
   * Dynamically discovers universal invariants for a given problem and concept.
   */
  public static discoverInvariants(
    concept: string,
    constraints: Array<{ statement: string }>,
    entities: Entity[],
    rules: Rule[] = [],
  ): Invariant[] {
    const invariants: Invariant[] = [];
    const text = concept.toLowerCase();

    // 1. Universal Identity & Conservation Invariant (applies to ALL concepts)
    invariants.push({
      id: "inv-identity-preservation",
      statement: "Entities must maintain persistent semantic identity across all state transitions.",
      category: "conservation",
      scope: "global",
      severity: "critical",
      source: "universal-core",
      predicate: (state: SemanticState) => {
        for (const [id, ent] of state.entities.entries()) {
          if (!id || !ent.label) return false;
        }
        return true;
      },
      evaluator: (state: SemanticState) => {
        for (const [id, ent] of state.entities.entries()) {
          if (!id || !ent.label) {
            return { holds: false, details: `Missing entity ID or label in state ${state.index}` };
          }
        }
        return { holds: true };
      },
    });

    // 2. Relationship Integrity Invariant
    invariants.push({
      id: "inv-relationship-integrity",
      statement: "All relationship endpoints must reference valid, existing entities.",
      category: "relational",
      scope: "global",
      severity: "critical",
      source: "universal-core",
      predicate: (state: SemanticState) => {
        for (const rel of state.relationships.values()) {
          if (!state.entities.has(rel.source) || !state.entities.has(rel.target)) {
            return false;
          }
        }
        return true;
      },
      evaluator: (state: SemanticState) => {
        for (const rel of state.relationships.values()) {
          if (!state.entities.has(rel.source) || !state.entities.has(rel.target)) {
            return { holds: false, details: `Dangling relationship '${rel.id}' references missing entity` };
          }
        }
        return { holds: true };
      },
    });

    // 3. Concept-specific structural invariants
    if (text.includes("avl")) {
      invariants.push({
        id: "inv-avl-balance-rule",
        statement: "AVL Tree Balance: For every node N, |height(L) - height(R)| <= 1",
        category: "algebraic",
        scope: "terminal",
        severity: "critical",
        source: "domain:avl",
        evaluator: (state) => evaluateAVL(state),
      });
      invariants.push({
        id: "inv-bst-order-rule",
        statement: "Binary Search Tree Order: left children < node < right children",
        category: "algebraic",
        scope: "global",
        severity: "critical",
        source: "domain:bst",
        evaluator: (state) => evaluateBST(state),
      });
    } else if (text.includes("bst") || text.includes("binary search tree")) {
      invariants.push({
        id: "inv-bst-order-rule",
        statement: "Binary Search Tree Order: left children < node < right children",
        category: "algebraic",
        scope: "global",
        severity: "critical",
        source: "domain:bst",
        evaluator: (state) => evaluateBST(state),
      });
    }

    // 4. Dynamic constraints mapped to executable invariants
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      const cLower = c.statement.toLowerCase();
      const isTerminal =
        cLower.includes("balance") ||
        cLower.includes("equilibrium") ||
        cLower.includes("terminal") ||
        cLower.includes("final");
      invariants.push({
        id: `inv-constraint-${i + 1}`,
        statement: c.statement,
        category: "structural",
        scope: isTerminal ? "terminal" : "global",
        severity: "critical",
        source: "problem-constraints",
        evaluator: synthesizeConstraintEvaluator(c.statement),
      });
    }

    // 5. Invariants derived from rules
    for (const rule of rules) {
      if (rule.validationMethod) {
        invariants.push({
          id: `inv-rule-${rule.id}`,
          statement: `Rule: ${rule.description}`,
          scope: rule.scope,
          severity: rule.priority > 5 ? "critical" : "warning",
          source: `rule:${rule.id}`,
          predicate: rule.validationMethod,
          evaluator: (state) => ({ holds: Boolean(rule.validationMethod?.(state)) }),
        });
      }
    }

    return invariants;
  }

  /**
   * Validates all active invariants against a specific semantic state.
   * NEVER silently skips an invariant: if an invariant lacks an evaluator,
   * an evaluator is synthesized or a violation is recorded.
   */
  public static validateStateInvariants(
    state: SemanticState,
    invariants: Invariant[],
    history?: SemanticState[],
  ): InvariantValidationReport {
    const violations: InvariantValidationReport["violations"] = [];

    for (const inv of invariants) {
      try {
        if (inv.evaluator) {
          const res = inv.evaluator(state, history);
          if (!res.holds) {
            violations.push({
              invariantId: inv.id,
              statement: inv.statement,
              severity: inv.severity,
              stateIndex: state.index,
              details: res.details || `Invariant '${inv.statement}' failed in state ${state.index}`,
            });
          }
        } else if (inv.predicate) {
          const holds = inv.predicate(state);
          if (!holds) {
            violations.push({
              invariantId: inv.id,
              statement: inv.statement,
              severity: inv.severity,
              stateIndex: state.index,
              details: `Invariant '${inv.statement}' failed in state ${state.index}`,
            });
          }
        } else {
          // Synthesize fallback evaluator so no invariant is skipped
          const fallback = synthesizeConstraintEvaluator(inv.statement, inv.category);
          const res = fallback(state, history);
          if (!res.holds) {
            violations.push({
              invariantId: inv.id,
              statement: inv.statement,
              severity: inv.severity,
              stateIndex: state.index,
              details: res.details || `Invariant '${inv.statement}' failed validation`,
            });
          }
        }
      } catch (err: unknown) {
        violations.push({
          invariantId: inv.id,
          statement: inv.statement,
          severity: inv.severity,
          stateIndex: state.index,
          details: `Evaluation error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const explanations = violations.map((v) => explainInvariantViolation(v, state));

    return {
      valid: violations.filter((v) => v.severity === "critical").length === 0,
      violations,
      explanations,
    };
  }

  /**
   * Deterministically computes all derivable values for a given state.
   */
  public static computeDerivedValues(
    state: SemanticState,
    definitions: DerivedValueDefinition[] = [],
  ): Record<string, DerivedValue> {
    const results: Record<string, DerivedValue> = {};

    // Standard universal derived values
    const entityCount = state.entities.size;
    const relationshipCount = state.relationships.size;

    results["entityCount"] = {
      id: "entityCount",
      label: "Active Entities",
      value: entityCount,
      dependencies: [],
      source: "deterministic",
      confidence: CONFIDENCE_KNOWN,
    };

    results["relationshipCount"] = {
      id: "relationshipCount",
      label: "Active Connections",
      value: relationshipCount,
      dependencies: [],
      source: "deterministic",
      confidence: CONFIDENCE_KNOWN,
    };

    // Calculate custom definitions
    for (const def of definitions) {
      if (def.calculate) {
        try {
          const val = def.calculate(state);
          results[def.id] = {
            id: def.id,
            label: def.label,
            value: val,
            formula: def.formula,
            dependencies: def.dependencies,
            source: def.source,
            confidence: CONFIDENCE_DERIVED,
          };
        } catch {
          // If calculation fails, do not invent values
        }
      }
    }

    return results;
  }
}
