/**
 * Cognora DSA Acceleration Layer - Tree Domain Engines
 *
 * Implements deterministic algorithm execution for:
 * 1. AVL Tree (BST insert, height/balance factor calculation, LL/RR/LR/RL rotations)
 * 2. Binary Search Tree (Unbalanced BST insertion & search)
 * 3. Max-Heap / Priority Queue (End insertion, sift-up bubble-up swaps, tree relations)
 * 4. Tree Traversals (Inorder, Preorder, Postorder, Level-Order)
 */

import type { DSAConceptEngine, DSAExecutionResult, DSAValidationResult } from "../types/dsa-engine";
import type { DSASemanticEntity, DSASemanticRelationship, DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAInputLimits } from "../types/dsa-concept";
import { DSAStateIntegrityValidator } from "../validation/state-integrity-validator";
import { getDefaultDataset } from "../datasets/default-datasets";

// ============================================================================
// Internal AVL Tree Node Structure
// ============================================================================
interface InternalAVLNode {
  val: number;
  height: number;
  left: InternalAVLNode | null;
  right: InternalAVLNode | null;
}

function getNodeHeight(node: InternalAVLNode | null): number {
  return node ? node.height : 0;
}

function getBalanceFactor(node: InternalAVLNode | null): number {
  return node ? getNodeHeight(node.left) - getNodeHeight(node.right) : 0;
}

function updateHeight(node: InternalAVLNode): void {
  node.height = 1 + Math.max(getNodeHeight(node.left), getNodeHeight(node.right));
}

function cloneAVLTree(root: InternalAVLNode | null): InternalAVLNode | null {
  if (!root) return null;
  return {
    val: root.val,
    height: root.height,
    left: cloneAVLTree(root.left),
    right: cloneAVLTree(root.right),
  };
}

function snapshotTreeToState(
  root: InternalAVLNode | null,
  version: number,
  title: string,
  focusVal?: number,
  statusOverride?: Record<number, "active" | "imbalanced" | "found" | "visited" | "default">,
): DSASemanticState {
  const entities = new Map<string, DSASemanticEntity>();
  const relationships: DSASemanticRelationship[] = [];

  function traverse(node: InternalAVLNode | null, parentId?: string, isLeft?: boolean) {
    if (!node) return;
    const id = `node-${node.val}`;
    const bf = getBalanceFactor(node);

    let status: "default" | "active" | "imbalanced" | "found" | "visited" = "default";
    if (statusOverride && statusOverride[node.val]) {
      status = statusOverride[node.val];
    } else if (Math.abs(bf) > 1) {
      status = "imbalanced";
    } else if (focusVal === node.val) {
      status = "active";
    }

    entities.set(id, {
      id,
      type: "TreeNode",
      label: `${node.val}`,
      value: node.val,
      role: parentId ? "element" : "primary",
      status,
      properties: {
        balanceFactor: bf,
        height: node.height,
        left: node.left ? `node-${node.left.val}` : undefined,
        right: node.right ? `node-${node.right.val}` : undefined,
      },
    });

    if (parentId) {
      relationships.push({
        id: `edge-${parentId}-${id}`,
        sourceId: parentId,
        targetId: id,
        type: isLeft ? "left_child" : "right_child",
        label: isLeft ? "L" : "R",
        directed: true,
      });
    }

    traverse(node.left, id, true);
    traverse(node.right, id, false);
  }

  traverse(root);

  return {
    version,
    title,
    entities,
    relationships,
    metadata: {
      rootId: root ? `node-${root.val}` : undefined,
    },
  };
}

// ============================================================================
// 1. AVL Tree Engine
// ============================================================================
export class AVLTreeEngine implements DSAConceptEngine<{ values?: number[] }, DSASemanticState> {
  public readonly conceptId = "avl";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(
    input: { values?: number[] },
    limits?: DSAInputLimits,
  ): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const defaultData = getDefaultDataset("avl");
    let values = input?.values && input.values.length > 0 ? input.values : defaultData.values;
    const maxElements = limits?.maxElements || 15;
    if (values.length > maxElements) {
      values = values.slice(0, maxElements);
    }

    // State 0: Empty Tree
    this.states.push({
      version: 0,
      title: "Empty AVL Tree",
      entities: new Map(),
      relationships: [],
      metadata: { rootId: undefined },
    });

    let root: InternalAVLNode | null = null;

    // Helper rotations
    const rotateRight = (y: InternalAVLNode): InternalAVLNode => {
      const x = y.left!;
      const T2 = x.right;
      x.right = y;
      y.left = T2;
      updateHeight(y);
      updateHeight(x);
      return x;
    };

    const rotateLeft = (x: InternalAVLNode): InternalAVLNode => {
      const y = x.right!;
      const T2 = y.left;
      y.left = x;
      x.right = T2;
      updateHeight(x);
      updateHeight(y);
      return y;
    };

    for (let vIdx = 0; vIdx < values.length; vIdx++) {
      const val = values[vIdx];

      // Step A: BST insertion
      const insertBST = (node: InternalAVLNode | null, key: number): InternalAVLNode => {
        if (!node) {
          return { val: key, height: 1, left: null, right: null };
        }
        if (key < node.val) {
          node.left = insertBST(node.left, key);
        } else if (key > node.val) {
          node.right = insertBST(node.right, key);
        }
        updateHeight(node);
        return node;
      };

      root = insertBST(root, val);

      // Snapshot insertion state
      const insertState = snapshotTreeToState(
        root,
        this.states.length,
        `Insert ${val}`,
        val,
        { [val]: "active" },
      );
      const prevIdx = this.states.length - 1;
      this.states.push(insertState);

      const transInsert: TeachingTransformation = {
        id: `t-${this.transformations.length + 1}`,
        type: "INSERT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${val}`],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [`node-${val}`],
          label: `Insert ${val}`,
        },
        whatHappened: `Insert node ${val} into AVL tree according to BST ordering.`,
        reason: `${val} is placed based on binary search comparisons with existing nodes.`,
        consequence: `Node ${val} attached. Heights and balance factors are updated upward.`,
        title: `Insert ${val}`,
        explanation: `Node ${val} is inserted into the BST structure. Next, we verify the balance factor at all ancestors to guarantee |BF| <= 1.`,
        isStateChange: true,
      };
      this.transformations.push(transInsert);

      // Step B: Check and resolve imbalance on ancestors
      // Find deepest unbalanced node
      let unbalancedVal: number | null = null;
      const findUnbalanced = (node: InternalAVLNode | null) => {
        if (!node) return;
        findUnbalanced(node.left);
        findUnbalanced(node.right);
        if (Math.abs(getBalanceFactor(node)) > 1 && unbalancedVal === null) {
          unbalancedVal = node.val;
        }
      };
      findUnbalanced(root);

      if (unbalancedVal !== null) {
        // Diagnosis state
        const diagState = snapshotTreeToState(
          root,
          this.states.length,
          `Imbalance at node ${unbalancedVal}`,
          unbalancedVal,
          { [unbalancedVal]: "imbalanced" },
        );
        const pIdx = this.states.length - 1;
        this.states.push(diagState);

        // Perform rotation on root structure
        const rebalance = (node: InternalAVLNode | null): InternalAVLNode => {
          if (!node) return node as any;
          node.left = rebalance(node.left);
          node.right = rebalance(node.right);
          updateHeight(node);

          const bf = getBalanceFactor(node);

          // LL Case
          if (bf > 1 && getBalanceFactor(node.left) >= 0) {
            return rotateRight(node);
          }
          // LR Case
          if (bf > 1 && getBalanceFactor(node.left) < 0) {
            node.left = rotateLeft(node.left!);
            return rotateRight(node);
          }
          // RR Case
          if (bf < -1 && getBalanceFactor(node.right) <= 0) {
            return rotateLeft(node);
          }
          // RL Case
          if (bf < -1 && getBalanceFactor(node.right) > 0) {
            node.right = rotateRight(node.right!);
            return rotateLeft(node);
          }

          return node;
        };

        const diagTrans: TeachingTransformation = {
          id: `t-${this.transformations.length + 1}`,
          type: "DETECT_IMBALANCE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: pIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [`node-${unbalancedVal}`],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [`node-${unbalancedVal}`],
            label: `Imbalanced: node ${unbalancedVal}`,
          },
          whatHappened: `Detected imbalance at node ${unbalancedVal}.`,
          reason: `Balance factor at node ${unbalancedVal} reached ${getBalanceFactor(root)}. AVL trees require |BF| <= 1.`,
          consequence: `A tree rotation is required to restore height balance.`,
          title: `Imbalance Detected at ${unbalancedVal}`,
          explanation: `Node ${unbalancedVal} violates the AVL invariant. We diagnose the rotation pattern to restore O(log N) operations.`,
          isStateChange: true,
        };
        this.transformations.push(diagTrans);

        // Execute rotation
        root = rebalance(root);

        const balancedState = snapshotTreeToState(
          root,
          this.states.length,
          `Rotated & Balanced around ${unbalancedVal}`,
          unbalancedVal,
        );
        const rotPrevIdx = this.states.length - 1;
        this.states.push(balancedState);

        const rotTrans: TeachingTransformation = {
          id: `t-${this.transformations.length + 1}`,
          type: "ROTATE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: rotPrevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: Array.from(balancedState.entities.keys()),
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [`node-${root!.val}`],
            label: `New Root: node ${root!.val}`,
          },
          whatHappened: `Performed rotation to rebalance tree.`,
          reason: `Subtree rotated to equalize branch heights.`,
          consequence: `Node ${root!.val} is the balanced root. Maximum balance factor across all nodes is now <= 1.`,
          title: `Rotate & Rebalance`,
          explanation: `The tree rotation is complete. The AVL height invariant is fully restored with all balance factors in {-1, 0, 1}.`,
          isStateChange: true,
        };
        this.transformations.push(rotTrans);
      }
    }

    this.complete = true;
    const validation = this.validate();

    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
      metadata: {
        nodeCount: values.length,
        rootVal: root?.val,
      },
    };
  }

  public getAllStates(): DSASemanticState[] {
    return this.states;
  }
  public getTransformations(): TeachingTransformation[] {
    return this.transformations;
  }
  public getCurrentState(): DSASemanticState {
    return this.states[this.states.length - 1];
  }
  public getFinalState(): DSASemanticState {
    return this.states[this.states.length - 1];
  }
  public validate(): DSAValidationResult {
    return DSAStateIntegrityValidator.validate(this.states, this.transformations);
  }
  public isComplete(): boolean {
    return this.complete;
  }
}

// ============================================================================
// 2. Binary Search Tree (BST) Engine
// ============================================================================
export class BSTEngine implements DSAConceptEngine<{ values?: number[] }, DSASemanticState> {
  public readonly conceptId = "bst";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(
    input: { values?: number[] },
    limits?: DSAInputLimits,
  ): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const defaultData = getDefaultDataset("bst");
    let values = input?.values && input.values.length > 0 ? input.values : defaultData.values;
    const maxElements = limits?.maxElements || 15;
    if (values.length > maxElements) {
      values = values.slice(0, maxElements);
    }

    this.states.push({
      version: 0,
      title: "Empty BST",
      entities: new Map(),
      relationships: [],
      metadata: {},
    });

    let root: InternalAVLNode | null = null;

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      const prevIdx = this.states.length - 1;

      const insert = (node: InternalAVLNode | null, key: number): InternalAVLNode => {
        if (!node) return { val: key, height: 1, left: null, right: null };
        if (key < node.val) node.left = insert(node.left, key);
        else if (key > node.val) node.right = insert(node.right, key);
        updateHeight(node);
        return node;
      };

      root = insert(root, val);
      const nextState = snapshotTreeToState(root, this.states.length, `Insert ${val}`, val);
      this.states.push(nextState);

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "INSERT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${val}`],
        affectedRelationshipIds: [],
        semanticFocus: { entityIds: [`node-${val}`], label: `Node ${val}` },
        whatHappened: `Insert node ${val} into BST.`,
        reason: `${val} follows recursive binary search placement.`,
        consequence: `Tree has ${i + 1} elements.`,
        title: `Insert ${val}`,
        explanation: `Node ${val} is placed following BST rules (left is smaller, right is larger).`,
        isStateChange: true,
      });
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 3. Max-Heap / Priority Queue Engine
// ============================================================================
export class HeapEngine implements DSAConceptEngine<{ values?: number[] }, DSASemanticState> {
  public readonly conceptId = "heap";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(
    input: { values?: number[] },
    limits?: DSAInputLimits,
  ): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const defaultData = getDefaultDataset("heap");
    let values = input?.values && input.values.length > 0 ? input.values : defaultData.values;
    const maxElements = limits?.maxElements || 15;
    if (values.length > maxElements) {
      values = values.slice(0, maxElements);
    }

    this.states.push({
      version: 0,
      title: "Empty Max Heap",
      entities: new Map(),
      relationships: [],
      metadata: {},
    });

    const heap: number[] = [];

    const snapshotHeap = (version: number, title: string, activeIdx?: number): DSASemanticState => {
      const entities = new Map<string, DSASemanticEntity>();
      const relationships: DSASemanticRelationship[] = [];

      for (let i = 0; i < heap.length; i++) {
        const id = `node-${heap[i]}`;
        entities.set(id, {
          id,
          type: "TreeNode",
          label: `${heap[i]}`,
          value: heap[i],
          role: i === 0 ? "primary" : "element",
          status: activeIdx === i ? "active" : "default",
          properties: { index: i },
        });

        const leftIdx = 2 * i + 1;
        const rightIdx = 2 * i + 2;
        if (leftIdx < heap.length) {
          relationships.push({
            id: `edge-${id}-node-${heap[leftIdx]}`,
            sourceId: id,
            targetId: `node-${heap[leftIdx]}`,
            type: "left_child",
            directed: true,
          });
        }
        if (rightIdx < heap.length) {
          relationships.push({
            id: `edge-${id}-node-${heap[rightIdx]}`,
            sourceId: id,
            targetId: `node-${heap[rightIdx]}`,
            type: "right_child",
            directed: true,
          });
        }
      }

      return {
        version,
        title,
        entities,
        relationships,
        metadata: { heapSize: heap.length },
      };
    };

    for (let vIdx = 0; vIdx < values.length; vIdx++) {
      const val = values[vIdx];
      heap.push(val);
      let curr = heap.length - 1;

      // 1. Insert at end
      const prevIdx = this.states.length - 1;
      const insertState = snapshotHeap(this.states.length, `Insert ${val} at end`, curr);
      this.states.push(insertState);

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "INSERT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${val}`],
        affectedRelationshipIds: [],
        semanticFocus: { entityIds: [`node-${val}`], label: `Inserted ${val}` },
        whatHappened: `Append ${val} at index ${curr} of the heap.`,
        reason: `Complete binary tree invariant requires inserting at the first available leaf position.`,
        consequence: `Next, bubble up (sift up) if ${val} exceeds its parent.`,
        title: `Insert ${val}`,
        explanation: `We place ${val} at the bottom leaf position. Next, we verify the max-heap property with its parent.`,
        isStateChange: true,
      });

      // 2. Sift up (Bubble up)
      while (curr > 0) {
        const parent = Math.floor((curr - 1) / 2);
        if (heap[curr] > heap[parent]) {
          const pBefore = this.states.length - 1;
          const currVal = heap[curr];
          const parentVal = heap[parent];

          // Swap
          heap[curr] = parentVal;
          heap[parent] = currVal;

          const swapState = snapshotHeap(
            this.states.length,
            `Bubble Up: Swap ${currVal} with parent ${parentVal}`,
            parent,
          );
          this.states.push(swapState);

          this.transformations.push({
            id: `t-${this.transformations.length + 1}`,
            type: "SWAP",
            stepNumber: this.transformations.length + 1,
            beforeStateIndex: pBefore,
            afterStateIndex: this.states.length - 1,
            affectedEntityIds: [`node-${currVal}`, `node-${parentVal}`],
            affectedRelationshipIds: [],
            semanticFocus: { entityIds: [`node-${currVal}`], label: `Bubble Up ${currVal}` },
            whatHappened: `Swap ${currVal} with parent ${parentVal}.`,
            reason: `Child (${currVal}) > Parent (${parentVal}), violating max-heap invariant.`,
            consequence: `${currVal} moves closer to root.`,
            title: `Bubble Up: Swap with Parent`,
            explanation: `Because ${currVal} is greater than ${parentVal}, they are swapped to maintain parent >= child.`,
            isStateChange: true,
          });

          curr = parent;
        } else {
          break;
        }
      }
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}

// ============================================================================
// 4. Tree Traversals Engine (Inorder, Preorder, Postorder, Level-Order)
// ============================================================================
export class TreeTraversalEngine implements DSAConceptEngine<{ values?: number[]; traversal?: string }, DSASemanticState> {
  public readonly conceptId = "tree-traversals";
  private states: DSASemanticState[] = [];
  private transformations: TeachingTransformation[] = [];
  private complete = false;

  public execute(
    input: { values?: number[]; traversal?: string },
    limits?: DSAInputLimits,
  ): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];
    this.complete = false;

    const values = input?.values && input.values.length > 0 ? input.values : [40, 20, 60, 10, 30, 50, 70];
    const traversalMode = (input?.traversal || "inorder").toLowerCase();

    // Construct balanced BST tree
    let root: InternalAVLNode | null = null;
    const insert = (node: InternalAVLNode | null, key: number): InternalAVLNode => {
      if (!node) return { val: key, height: 1, left: null, right: null };
      if (key < node.val) node.left = insert(node.left, key);
      else if (key > node.val) node.right = insert(node.right, key);
      updateHeight(node);
      return node;
    };
    for (const v of values) {
      root = insert(root, v);
    }

    // Determine traversal order
    const order: number[] = [];
    if (traversalMode === "preorder") {
      const pre = (n: InternalAVLNode | null) => {
        if (!n) return;
        order.push(n.val);
        pre(n.left);
        pre(n.right);
      };
      pre(root);
    } else if (traversalMode === "postorder") {
      const post = (n: InternalAVLNode | null) => {
        if (!n) return;
        post(n.left);
        post(n.right);
        order.push(n.val);
      };
      post(root);
    } else if (traversalMode === "levelorder" || traversalMode === "level-order") {
      const q = [root];
      while (q.length > 0) {
        const curr = q.shift();
        if (curr) {
          order.push(curr.val);
          if (curr.left) q.push(curr.left);
          if (curr.right) q.push(curr.right);
        }
      }
    } else {
      // Default: Inorder
      const inord = (n: InternalAVLNode | null) => {
        if (!n) return;
        inord(n.left);
        order.push(n.val);
        inord(n.right);
      };
      inord(root);
    }

    // State 0: Initial full tree
    this.states.push(snapshotTreeToState(root, 0, `Initial Tree for ${traversalMode.toUpperCase()} Traversal`));

    const visitedMap: Record<number, "visited" | "active"> = {};

    for (let i = 0; i < order.length; i++) {
      const val = order[i];
      const prevIdx = this.states.length - 1;

      // Mark previous visited
      if (i > 0) {
        visitedMap[order[i - 1]] = "visited";
      }
      visitedMap[val] = "active";

      const nextState = snapshotTreeToState(
        root,
        this.states.length,
        `Visit ${val} (${i + 1}/${order.length})`,
        val,
        visitedMap,
      );
      this.states.push(nextState);

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: "VISIT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [`node-${val}`],
        affectedRelationshipIds: [],
        semanticFocus: { entityIds: [`node-${val}`], label: `Visit ${val}` },
        whatHappened: `Traverse node ${val}.`,
        reason: `Node ${val} is next in ${traversalMode} ordering.`,
        consequence: `Visited sequence so far: [${order.slice(0, i + 1).join(", ")}].`,
        title: `Traverse ${val}`,
        explanation: `We process node ${val}. In ${traversalMode} traversal, this visits nodes in deliberate structural hierarchy.`,
        isStateChange: true,
      });
    }

    this.complete = true;
    const validation = this.validate();
    return {
      success: validation.valid,
      conceptId: this.conceptId,
      initialState: this.states[0],
      finalState: this.states[this.states.length - 1],
      states: this.states,
      transformations: this.transformations,
      validation,
    };
  }

  public getAllStates() { return this.states; }
  public getTransformations() { return this.transformations; }
  public getCurrentState() { return this.states[this.states.length - 1]; }
  public getFinalState() { return this.states[this.states.length - 1]; }
  public validate() { return DSAStateIntegrityValidator.validate(this.states, this.transformations); }
  public isComplete() { return this.complete; }
}
