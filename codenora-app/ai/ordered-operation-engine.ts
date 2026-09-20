/**
 * Cognora Ordered Operation Execution Engine
 *
 * Prevents premature final-state rendering and un-collapses coarse plans into
 * true step-by-step progressive execution.
 *
 * Guarantees:
 * 1. State 0 genuinely represents the initial baseline (e.g. empty tree before insert 1,
 *    or unsorted array before first comparison, or graph with unrelaxed distances).
 * 2. If an upstream proposal skips intermediate operations or provides fewer steps than
 *    the essential operations requested, this engine synthesizes the full ordered sequence.
 * 3. Works universally for any ordered operation sequence (insertions, deletions,
 *    partitioning, relaxations, state transitions).
 */

import type { ParsedOperation } from "./question-understanding";
import type { RawProposalStep } from "./conceptual-journey-optimizer";

export class OrderedOperationEngine {
  /**
   * Determines if the current steps represent a collapsed plan that needs ordered synthesis.
   */
  public static shouldSynthesize(
    parsedOperations: ParsedOperation[],
    existingSteps: any[],
    concept: string,
    prompt: string = "",
  ): boolean {
    const corpus = `${concept} ${prompt}`.toLowerCase();

    // 1. Check for LRU Cache operations
    if (
      corpus.includes("lru") ||
      parsedOperations.some((op) => op.op === "put" || op.op === "get")
    ) {
      if (
        !existingSteps ||
        existingSteps.length < Math.max(4, parsedOperations.length)
      ) {
        return true;
      }
    }

    // 2. Check for Search on Container (e.g. Binary Search)
    if (
      !corpus.includes("tree") &&
      !corpus.includes("bst") &&
      (corpus.includes("binary search") ||
        parsedOperations.some((op) => op.op === "search"))
    ) {
      const hasRealCustomSteps =
        existingSteps &&
        existingSteps.length >= 2 &&
        existingSteps.some(
          (s: any) =>
            !s.title?.startsWith("Initiate") && !s.title?.includes("Mechanism"),
        );
      if (hasRealCustomSteps) {
        return false;
      }
      return true;
    }

    // 3. Check for Positional Linked List Insertion
    if (
      corpus.includes("between") &&
      (parsedOperations.some((op) => op.op === "insert") ||
        corpus.includes("insert"))
    ) {
      if (!existingSteps || existingSteps.length < 3) {
        return true;
      }
    }

    // 4. Check for Dijkstra specifically
    if (corpus.includes("dijkstra") || corpus.includes("shortest path")) {
      if (!existingSteps || existingSteps.length < 4) {
        return true;
      }
    }

    // 5. Check for Partitioning / Quick Sort
    if (
      corpus.includes("quick") ||
      corpus.includes("lomuto") ||
      corpus.includes("hoare") ||
      corpus.includes("partition") ||
      parsedOperations.some((op) => op.op === "partition" || op.op === "sort")
    ) {
      if (!existingSteps || existingSteps.length < 6) {
        return true;
      }
    }

    if (!parsedOperations || parsedOperations.length < 1) {
      return false;
    }

    if (parsedOperations.length === 1) {
      const singleOp = parsedOperations[0];
      if (
        (singleOp.op === "insert" ||
          singleOp.op === "delete" ||
          singleOp.op === "swap") &&
        (!existingSteps || existingSteps.length < 2)
      ) {
        return true;
      }
      return false;
    }

    // If existing steps are too coarse compared to the operations requested
    // (e.g. 2 deletions collapsed into 1 step, or 9 inserts into 2 steps)
    const minExpectedSteps = Math.min(parsedOperations.length, 8);
    if (!existingSteps || existingSteps.length < minExpectedSteps) {
      return true;
    }

    // If existing steps collapse multiple deletions into a single step
    const deleteOps = parsedOperations.filter((op) => op.op === "delete");
    if (deleteOps.length >= 2) {
      const distinctDeleteSteps = existingSteps.filter((s) =>
        /\b(delete|remove|popped|eliminate|elimination|discard)\b/i.test(
          `${s.title || ""} ${s.explanation || ""}`,
        ),
      );
      if (distinctDeleteSteps.length < deleteOps.length) {
        return true;
      }
    } else if (deleteOps.length === 1) {
      const stepsMentionDelete = existingSteps.some((s) =>
        /\b(delete|remove|popped|eliminate|elimination|discard)\b/i.test(
          `${s.title || ""} ${s.explanation || ""}`,
        ),
      );
      if (!stepsMentionDelete) {
        return true;
      }
    }

    return false;
  }

  /**
   * Synthesizes a progressive, step-by-step operational sequence from ordered operations.
   */
  public static synthesizeOrderedSteps(
    concept: string,
    parsedOperations: ParsedOperation[],
    inputs: unknown[],
    prompt: string = "",
  ): RawProposalStep[] {
    const corpus = `${concept} ${prompt}`.toLowerCase();

    // 1. Check for LRU Cache
    if (
      corpus.includes("lru") ||
      parsedOperations.some((op) => op.op === "put" || op.op === "get")
    ) {
      return this.synthesizeLruCacheSteps(concept, parsedOperations, prompt);
    }

    // 2. Check for Binary Search
    if (
      corpus.includes("binary search") ||
      parsedOperations.some((op) => op.op === "search")
    ) {
      return this.synthesizeBinarySearchSteps(
        concept,
        parsedOperations,
        inputs,
        prompt,
      );
    }

    // 3. Check for Positional Linked List Insertion
    if (
      corpus.includes("between") &&
      (parsedOperations.some((op) => op.op === "insert") ||
        corpus.includes("insert"))
    ) {
      return this.synthesizeLinkedListPositionalSteps(
        concept,
        parsedOperations,
        prompt,
      );
    }

    // 4. Check for Partitioning / Quick Sort
    if (
      corpus.includes("quick") ||
      corpus.includes("lomuto") ||
      corpus.includes("hoare") ||
      parsedOperations.some((op) => op.op === "partition" || op.op === "sort")
    ) {
      return this.synthesizeQuickSortSteps(parsedOperations, inputs, prompt);
    }

    // 5. Check for Dijkstra / Shortest Path
    if (
      corpus.includes("dijkstra") ||
      corpus.includes("shortest path") ||
      parsedOperations.some(
        (op) => op.op === "relax" || op.op === "shortest_path",
      )
    ) {
      return this.synthesizeDijkstraSteps(parsedOperations, inputs, prompt);
    }

    // 6. Check for Heap (Min-Heap / Max-Heap / Priority Queue)
    if (
      corpus.includes("heap") ||
      corpus.includes("priority queue") ||
      parsedOperations.some(
        (op) => op.metadata?.target === "min" || op.metadata?.target === "max",
      )
    ) {
      return this.synthesizeHeapSteps(concept, parsedOperations, prompt);
    }

    // 7. Check for Tree Operations (AVL / BST / Binary Tree)
    if (
      corpus.includes("tree") ||
      corpus.includes("avl") ||
      corpus.includes("bst")
    ) {
      return this.synthesizeTreeSteps(concept, parsedOperations, prompt);
    }

    // 8. Check for Linear Sequences (Linked List / Stack / Queue / Array)
    if (
      corpus.includes("list") ||
      corpus.includes("stack") ||
      corpus.includes("queue") ||
      corpus.includes("array") ||
      corpus.includes("chain") ||
      prompt.includes("->") ||
      prompt.includes("→")
    ) {
      return this.synthesizeLinearSteps(concept, parsedOperations, inputs, prompt);
    }

    // 9. Universal General Operations Fallback
    return this.synthesizeUniversalSteps(concept, parsedOperations);
  }

  /**
   * Synthesizes ordered Min-Heap / Max-Heap steps (insertions, bubble up / sift up, extract min/max, bubble down / sift down).
   */
  private static synthesizeHeapSteps(
    concept: string,
    operations: ParsedOperation[],
    prompt: string = "",
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];
    const isMaxHeap = /\b(max-?heap|maximum\s+heap)\b/i.test(
      `${concept} ${prompt}`,
    );
    const heapType = isMaxHeap ? "Max-Heap" : "Min-Heap";

    const heap: number[] = [];

    const emitHeapSnapshot = (
      activeIdx?: number,
      highlightState: string = "active",
      comparisonIdx?: number,
    ): any[] => {
      const actions: any[] = [];
      const arrayElements = heap.map((v, i) => {
        let hl: string | undefined = undefined;
        if (i === activeIdx) {
          hl =
            highlightState === "danger"
              ? "eliminated"
              : highlightState === "warning"
              ? "mid"
              : "target";
        } else if (i === comparisonIdx) {
          hl = "low";
        }
        return { value: v, highlight: hl };
      });

      actions.push({
        type: "create_array",
        id: "heap-array",
        label: `${heapType} Array`,
        elements:
          arrayElements.length > 0 ? arrayElements : [{ value: "(empty)" }],
      });

      if (heap.length > 0) {
        const treeNodes = heap.map((v, i) => {
          const leftIdx = 2 * i + 1;
          const rightIdx = 2 * i + 2;
          let hl: string | undefined = undefined;
          if (i === activeIdx) {
            hl = highlightState;
          } else if (i === comparisonIdx) {
            hl = "warning";
          }
          return {
            id: `hn-${i}`,
            value: v,
            left: leftIdx < heap.length ? `hn-${leftIdx}` : undefined,
            right: rightIdx < heap.length ? `hn-${rightIdx}` : undefined,
            highlight: hl,
          };
        });

        actions.push({
          type: "create_tree",
          id: "heap-tree",
          root: "hn-0",
          nodes: treeNodes,
        });
      }

      return actions;
    };

    // State 0: Empty baseline
    steps.push({
      title: `Empty ${heapType} Baseline`,
      explanation: `Initial empty state. The ${heapType} maintains the invariant where ${
        isMaxHeap
          ? "every parent is ≥ its children"
          : "every parent is ≤ its children"
      }.`,
      role: "setup",
      operations: emitHeapSnapshot(),
    });

    for (let opIdx = 0; opIdx < operations.length; opIdx++) {
      const op = operations[opIdx];

      if (op.op === "insert" || op.op === "add") {
        const val = typeof op.value === "number" ? op.value : Number(op.value);
        if (isNaN(val)) {
          continue;
        }

        let currIdx = heap.length;
        heap.push(val);

        if (currIdx === 0) {
          steps.push({
            title: `Insert Root ${val}`,
            explanation: `Heap was empty. ${val} is inserted at index 0 as the root of the ${heapType}.`,
            role: "setup",
            operations: emitHeapSnapshot(0, "success"),
            calculations: `Index 0: Value ${val} is root`,
          });
          continue;
        }

        const parentIdx = Math.floor((currIdx - 1) / 2);
        const parentVal = heap[parentIdx];
        const violatesInitial = isMaxHeap ? val > parentVal : val < parentVal;

        // Step: Insertion at next available leaf
        steps.push({
          title: `Insert ${val} at Index ${currIdx}`,
          explanation: `Append ${val} at index ${currIdx} (child of parent ${parentVal} at index ${parentIdx}) to preserve complete binary tree structure.`,
          role: "perturbation",
          operations: emitHeapSnapshot(
            currIdx,
            violatesInitial ? "warning" : "active",
            parentIdx,
          ),
          calculations: `Parent index: floor((${currIdx} - 1) / 2) = ${parentIdx}. Parent value: ${parentVal}.`,
        });

        // Bubble up
        let bubbleCount = 0;
        while (currIdx > 0) {
          const pIdx = Math.floor((currIdx - 1) / 2);
          const pVal = heap[pIdx];
          const cVal = heap[currIdx];
          const hasViolation = isMaxHeap ? cVal > pVal : cVal < pVal;

          if (hasViolation) {
            bubbleCount++;
            // Emit violation step
            steps.push({
              title: `Bubble Up: Swap ${cVal} & ${pVal}`,
              explanation: `Heap invariant violated: ${cVal} ${
                isMaxHeap ? ">" : "<"
              } parent ${pVal}. Swap element at index ${currIdx} with parent at index ${pIdx} to restore ${heapType} order.`,
              role: "mechanism",
              operations: emitHeapSnapshot(currIdx, "danger", pIdx),
              calculations: `Swap: heap[${currIdx}] (${cVal}) ↔ heap[${pIdx}] (${pVal})`,
            });

            heap[currIdx] = pVal;
            heap[pIdx] = cVal;
            currIdx = pIdx;
          } else {
            break;
          }
        }

        if (bubbleCount > 0) {
          steps.push({
            title: `Heap Property Restored for ${val}`,
            explanation: `Element ${val} has settled at index ${currIdx}. All parent-child relationships satisfy the ${heapType} property.`,
            role: "verification",
            operations: emitHeapSnapshot(currIdx, "success"),
          });
        }
      } else if (
        op.op === "delete" ||
        op.op === "remove" ||
        op.op === "extract"
      ) {
        if (heap.length === 0) {
          continue;
        }

        if (heap.length === 1) {
          const removed = heap.pop()!;
          steps.push({
            title: `Remove Root Element ${removed}`,
            explanation: `Removed the only element ${removed} from root. The ${heapType} is now empty.`,
            role: "mechanism",
            operations: emitHeapSnapshot(),
          });
          continue;
        }

        const extracted = heap[0];
        const lastVal = heap.pop()!;
        heap[0] = lastVal;

        // Step 1: Extract root and place last element at root
        steps.push({
          title: `Extract ${
            isMaxHeap ? "Max" : "Min"
          } (${extracted}) & Move Last (${lastVal}) to Root`,
          explanation: `Extract root value ${extracted}. Replace root with the last leaf element ${lastVal} (from index ${heap.length}) to preserve the complete binary tree structure.`,
          role: "perturbation",
          operations: emitHeapSnapshot(0, "warning"),
          calculations: `Extracted: ${extracted}. New root candidate: ${lastVal}.`,
        });

        // Bubble down
        let currIdx = 0;
        let siftCount = 0;
        while (true) {
          const leftIdx = 2 * currIdx + 1;
          const rightIdx = 2 * currIdx + 2;
          if (leftIdx >= heap.length) {
            break;
          }

          let targetChildIdx = leftIdx;
          if (rightIdx < heap.length) {
            if (isMaxHeap) {
              if (heap[rightIdx] > heap[leftIdx]) {
                targetChildIdx = rightIdx;
              }
            } else if (heap[rightIdx] < heap[leftIdx]) {
              targetChildIdx = rightIdx;
            }
          }

          const currVal = heap[currIdx];
          const childVal = heap[targetChildIdx];
          const hasViolation = isMaxHeap
            ? currVal < childVal
            : currVal > childVal;

          if (hasViolation) {
            siftCount++;
            steps.push({
              title: `Bubble Down: Swap Root/Parent ${currVal} with Child ${childVal}`,
              explanation: `Invariant violation at index ${currIdx}: ${currVal} ${
                isMaxHeap ? "<" : ">"
              } ${
                isMaxHeap ? "larger" : "smaller"
              } child ${childVal} at index ${targetChildIdx}. Swap them to push ${currVal} downward.`,
              role: "mechanism",
              operations: emitHeapSnapshot(currIdx, "danger", targetChildIdx),
              calculations: `Swap: heap[${currIdx}] (${currVal}) ↔ heap[${targetChildIdx}] (${childVal})`,
            });

            heap[currIdx] = childVal;
            heap[targetChildIdx] = currVal;
            currIdx = targetChildIdx;
          } else {
            break;
          }
        }

        steps.push({
          title: `Restored ${heapType} After Extraction`,
          explanation: `Extraction complete. Current root is now ${
            heap[0]
          }. Full heap array: [${heap.join(", ")}].`,
          role: "proof",
          operations: emitHeapSnapshot(0, "success"),
        });
      }
    }

    return steps;
  }

  /**
   * Synthesizes ordered BST / AVL Tree steps (insertions, balance checks, rotations, deletions).
   */
  private static synthesizeTreeSteps(
    concept: string,
    operations: ParsedOperation[],
    prompt: string = "",
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];
    const corpus = `${concept} ${prompt}`.toLowerCase();
    const isAVL = corpus.includes("avl") || corpus.includes("balance");

    interface TreeNode {
      id: string;
      value: number;
      left?: TreeNode;
      right?: TreeNode;
      parent?: TreeNode;
      height: number;
    }

    let root: TreeNode | undefined;

    const getHeight = (n?: TreeNode): number => (n ? n.height : 0);
    const updateHeight = (n: TreeNode) => {
      n.height = 1 + Math.max(getHeight(n.left), getHeight(n.right));
    };
    const getBalance = (n?: TreeNode): number =>
      n ? getHeight(n.left) - getHeight(n.right) : 0;

    // Helper to generate tree snapshot operations
    const emitTreeSnapshot = (
      activeNodeId?: string,
      highlightState: string = "active",
    ): any[] => {
      if (!root) {
        return [];
      }
      const nodes: any[] = [];
      const queue: TreeNode[] = [root];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        nodes.push({
          id: curr.id,
          value: curr.value,
          left: curr.left?.id,
          right: curr.right?.id,
          highlight: curr.id === activeNodeId ? highlightState : undefined,
          balanceFactor: isAVL ? getBalance(curr) : undefined,
        });
        if (curr.left) {
          queue.push(curr.left);
        }
        if (curr.right) {
          queue.push(curr.right);
        }
      }

      return [{ type: "create_tree", id: "tree-main", root: root.id, nodes }];
    };

    // Process operations in strict chronological order
    for (let opIdx = 0; opIdx < operations.length; opIdx++) {
      const op = operations[opIdx];
      const val = typeof op.value === "number" ? op.value : Number(op.value);

      if (op.op === "insert" && !isNaN(val)) {
        const nodeId = `node-${val}`;
        const newNode: TreeNode = { id: nodeId, value: val, height: 1 };

        if (!root) {
          root = newNode;
          steps.push({
            title: `Insert Root Node ${val}`,
            explanation: `Tree was empty. Node ${val} is inserted as the root of the ${concept}.`,
            role: "setup",
            operations: emitTreeSnapshot(nodeId, "success"),
            calculations: isAVL
              ? `Balance Factor at root ${val} = 0`
              : undefined,
          });
        } else {
          // BST insert
          let curr = root;
          let parent: TreeNode | undefined;
          let isLeft = false;

          while (curr) {
            parent = curr;
            if (val < curr.value) {
              curr = curr.left!;
              isLeft = true;
            } else {
              curr = curr.right!;
              isLeft = false;
            }
          }

          newNode.parent = parent;
          if (isLeft) {
            parent!.left = newNode;
          } else {
            parent!.right = newNode;
          }

          // Recalculate heights up the tree
          let walk: TreeNode | undefined = parent;
          while (walk) {
            updateHeight(walk);
            walk = walk.parent;
          }

          steps.push({
            title: `Insert Node ${val}`,
            explanation: `Node ${val} traverses ${
              val < parent!.value ? "left" : "right"
            } of parent ${parent!.value} maintaining BST invariant.`,
            role: "mechanism",
            operations: emitTreeSnapshot(nodeId, "active"),
            calculations: isAVL
              ? `Balance Factor at ${parent!.value} = ${getBalance(parent)}`
              : undefined,
          });

          // If AVL, check for imbalance
          if (isAVL) {
            let ancestor: TreeNode | undefined = parent;
            let imbalancedNode: TreeNode | undefined;

            while (ancestor) {
              const bf = getBalance(ancestor);
              if (Math.abs(bf) > 1) {
                imbalancedNode = ancestor;
                break;
              }
              ancestor = ancestor.parent;
            }

            if (imbalancedNode) {
              const bf = getBalance(imbalancedNode);
              const isLeftHeavy = bf > 1;
              const child = isLeftHeavy
                ? imbalancedNode.left!
                : imbalancedNode.right!;
              const childBf = getBalance(child);

              steps.push({
                title: `Diagnose Imbalance at Node ${imbalancedNode.value}`,
                explanation: `Node ${imbalancedNode.value} has balance factor ${
                  bf > 0 ? `+${bf}` : bf
                } (threshold $|\\Delta h| \\le 1$ violated). Requires ${
                  isLeftHeavy
                    ? childBf >= 0
                      ? "Right Rotation (LL)"
                      : "Left-Right Rotation (LR)"
                    : childBf <= 0
                    ? "Left Rotation (RR)"
                    : "Right-Left Rotation (RL)"
                }.`,
                role: "diagnosis",
                operations: emitTreeSnapshot(imbalancedNode.id, "warning"),
                calculations: `Left Subtree Height = ${getHeight(
                  imbalancedNode.left,
                )}, Right Subtree Height = ${getHeight(
                  imbalancedNode.right,
                )} -> BF = ${bf}`,
              });

              const rotateRight = (p: TreeNode): TreeNode => {
                const c = p.left!;
                const parentOfP = p.parent;

                p.left = c.right;
                if (c.right) {
                  c.right.parent = p;
                }
                c.right = p;
                p.parent = c;
                c.parent = parentOfP;

                if (!parentOfP) {
                  root = c;
                } else if (parentOfP.left === p) {
                  parentOfP.left = c;
                } else {
                  parentOfP.right = c;
                }

                updateHeight(p);
                updateHeight(c);
                return c;
              };

              const rotateLeft = (p: TreeNode): TreeNode => {
                const c = p.right!;
                const parentOfP = p.parent;

                p.right = c.left;
                if (c.left) {
                  c.left.parent = p;
                }
                c.left = p;
                p.parent = c;
                c.parent = parentOfP;

                if (!parentOfP) {
                  root = c;
                } else if (parentOfP.left === p) {
                  parentOfP.left = c;
                } else {
                  parentOfP.right = c;
                }

                updateHeight(p);
                updateHeight(c);
                return c;
              };

              // Apply rotation to restore balance
              if (isLeftHeavy && childBf >= 0) {
                // LL Case -> Right Rotation
                const newSubtreeRoot = rotateRight(imbalancedNode);
                steps.push({
                  title: `Right Rotation on Node ${imbalancedNode.value}`,
                  explanation: `Right rotation pivots node ${child.value} to subtree root. Node ${imbalancedNode.value} descends as right child. Balance factor restored to 0.`,
                  role: "equilibrium",
                  operations: emitTreeSnapshot(newSubtreeRoot.id, "success"),
                  calculations: `Restored Balance Factors: Node ${
                    newSubtreeRoot.value
                  } = ${getBalance(newSubtreeRoot)}`,
                });
              } else if (!isLeftHeavy && childBf <= 0) {
                // RR Case -> Left Rotation
                const newSubtreeRoot = rotateLeft(imbalancedNode);
                steps.push({
                  title: `Left Rotation on Node ${imbalancedNode.value}`,
                  explanation: `Left rotation pivots node ${child.value} to subtree root. Node ${imbalancedNode.value} descends as left child. Balance restored.`,
                  role: "equilibrium",
                  operations: emitTreeSnapshot(newSubtreeRoot.id, "success"),
                  calculations: `Restored Balance Factors: Node ${
                    newSubtreeRoot.value
                  } = ${getBalance(newSubtreeRoot)}`,
                });
              } else if (isLeftHeavy && childBf < 0) {
                // LR Case -> Left Rotation on child, then Right Rotation on imbalancedNode
                rotateLeft(child);
                const newSubtreeRoot = rotateRight(imbalancedNode);
                steps.push({
                  title: `Left-Right (LR) Double Rotation Resolving Imbalance at Node ${imbalancedNode.value}`,
                  explanation: `Left rotation on child ${child.value} followed by Right rotation on node ${imbalancedNode.value} restores AVL balance invariant.`,
                  role: "equilibrium",
                  operations: emitTreeSnapshot(newSubtreeRoot.id, "success"),
                  calculations: `Restored Balance Factors: Node ${
                    newSubtreeRoot.value
                  } = ${getBalance(newSubtreeRoot)}`,
                });
              } else {
                // RL Case -> Right Rotation on child, then Left Rotation on imbalancedNode
                rotateRight(child);
                const newSubtreeRoot = rotateLeft(imbalancedNode);
                steps.push({
                  title: `Right-Left (RL) Double Rotation Resolving Imbalance at Node ${imbalancedNode.value}`,
                  explanation: `Right rotation on child ${child.value} followed by Left rotation on node ${imbalancedNode.value} restores AVL balance invariant.`,
                  role: "equilibrium",
                  operations: emitTreeSnapshot(newSubtreeRoot.id, "success"),
                  calculations: `Restored Balance Factors: Node ${
                    newSubtreeRoot.value
                  } = ${getBalance(newSubtreeRoot)}`,
                });
              }

              // Update heights all the way to root
              let hWalk: TreeNode | undefined = imbalancedNode.parent;
              while (hWalk) {
                updateHeight(hWalk);
                hWalk = hWalk.parent;
              }
            }
          }
        }
      } else if (op.op === "delete" && !isNaN(val)) {
        // Deletion operation
        const targetNodeId = `node-${val}`;

        // Find node
        const findNode = (n?: TreeNode): TreeNode | undefined => {
          if (!n) {
            return undefined;
          }
          if (n.value === val) {
            return n;
          }
          return val < n.value ? findNode(n.left) : findNode(n.right);
        };

        const target = findNode(root);

        if (target) {
          // Identify deletion case
          if (!target.left && !target.right) {
            // Case 1: Leaf
            steps.push({
              title: `Delete Leaf Node ${val}`,
              explanation: `Node ${val} has no children. It is safely detached from its parent ${
                target.parent?.value ?? "root"
              } without restructuring subtrees.`,
              role: "mechanism",
              operations: [
                { type: "highlight", target: targetNodeId, color: "warning" },
                { type: "delete_entity", target: targetNodeId },
              ],
            });

            if (target.parent) {
              if (target.parent.left === target) {
                target.parent.left = undefined;
              } else {
                target.parent.right = undefined;
              }
            } else {
              root = undefined;
            }
          } else if (target.left && target.right) {
            // Case 3: Two children -> find in-order successor
            let successor = target.right;
            while (successor.left) {
              successor = successor.left;
            }

            steps.push({
              title: `Delete Node ${val} (Two Children Case)`,
              explanation: `Node ${val} has two children. Locate in-order successor (${successor.value}), copy its value, and remove the successor leaf node.`,
              role: "mechanism",
              operations: [
                { type: "highlight", target: targetNodeId, color: "warning" },
                { type: "highlight", target: successor.id, color: "active" },
              ],
              calculations: `In-order successor = ${successor.value}`,
            });

            target.value = successor.value;
            if (successor.parent?.left === successor) {
              successor.parent.left = successor.right;
            } else if (successor.parent?.right === successor) {
              successor.parent.right = successor.right;
            }
            if (successor.right) {
              successor.right.parent = successor.parent;
            }

            steps.push({
              title: `Replaced Node ${val} with Successor ${target.value}`,
              explanation: `Value ${target.value} copied into position. Invariant ordering and structure maintained.`,
              role: "equilibrium",
              operations: emitTreeSnapshot(target.id, "success"),
            });
          } else {
            // Case 2: One child
            const child = target.left || target.right!;
            steps.push({
              title: `Delete Node ${val} (One Child Case)`,
              explanation: `Node ${val} has one child (${child.value}). Bypass node ${val} by linking parent directly to child.`,
              role: "mechanism",
              operations: [
                { type: "highlight", target: targetNodeId, color: "warning" },
              ],
            });

            child.parent = target.parent;
            if (target.parent) {
              if (target.parent.left === target) {
                target.parent.left = child;
              } else {
                target.parent.right = child;
              }
            } else {
              root = child;
            }
          }
        }
      }
    }

    // Final verification milestone
    if (steps.length > 0) {
      steps.push({
        title: `Verified Final ${concept} State`,
        explanation: `All requested operations completed successfully. Invariants, ordered relationships, and structure verified.`,
        role: "proof",
        operations: emitTreeSnapshot(root?.id, "success"),
      });
    }

    return steps;
  }

  /**
   * Synthesizes step-by-step Lomuto Partitioning / Quick Sort steps.
   */
  private static synthesizeQuickSortSteps(
    operations: ParsedOperation[],
    inputs: unknown[],
    prompt?: string,
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];

    // Extract numbers array from inputs or operations or prompt
    let arr: number[] = [];
    if (Array.isArray(inputs[0])) {
      arr = (inputs[0] as unknown[]).map(Number).filter((n) => !isNaN(n));
    }
    if (arr.length === 0) {
      arr = operations
        .filter((op) => typeof op.value === "number")
        .map((op) => op.value as number);
    }
    if (arr.length === 0 && prompt) {
      const match = prompt.match(/\[([\d\s,]+)\]/);
      if (match) {
        arr = match[1]
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
      }
    }
    if (arr.length === 0) {
      arr = [38, 27, 43, 3, 9, 82, 10, 19, 50, 61, 72, 15, 4, 33, 8];
    }

    const currentArr = [...arr];
    const n = currentArr.length;
    const low = 0;
    const high = n - 1;
    const pivotVal = currentArr[high];

    // Helper to emit array snapshot
    const emitArraySnapshot = (
      highlightIdxs: Record<number, string> = {},
      iIdx?: number,
      jIdx?: number,
    ): any[] => {
      const elements = currentArr.map((v, idx) => ({
        id: `elem-${idx}`,
        value: v,
        index: idx,
        highlight: highlightIdxs[idx] || (idx === high ? "accent" : undefined),
      }));

      const ops: any[] = [{ type: "create_array", id: "arr-main", elements }];

      if (iIdx !== undefined && iIdx >= 0 && iIdx < n) {
        ops.push({
          type: "create_pointer",
          id: "ptr-i",
          label: "i (boundary)",
          target: `elem-${iIdx}`,
          direction: "down",
        });
      }
      if (jIdx !== undefined && jIdx >= 0 && jIdx < n) {
        ops.push({
          type: "create_pointer",
          id: "ptr-j",
          label: "j (scan)",
          target: `elem-${jIdx}`,
          direction: "down",
        });
      }

      return ops;
    };

    // Step 0: Setup baseline
    steps.push({
      title: `Initialize Lomuto Partition on Array (n = ${n})`,
      explanation: `Lomuto partition chooses rightmost element ${pivotVal} as the pivot. Pointer i is initialized to low - 1 (-1), and pointer j scans from index 0.`,
      role: "setup",
      operations: emitArraySnapshot({ [high]: "accent" }, undefined, 0),
      calculations: `Pivot = ${pivotVal} at index ${high}`,
    });

    let i = low - 1;

    for (let j = low; j < high; j++) {
      const currVal = currentArr[j];
      const isSmaller = currVal <= pivotVal;

      steps.push({
        title: `Compare Element ${currVal} with Pivot ${pivotVal}`,
        explanation: `Inspect A[${j}] = ${currVal} vs Pivot ${pivotVal}. ${
          isSmaller
            ? `${currVal} <= ${pivotVal}: advance pointer i and swap into smaller elements region.`
            : `${currVal} > ${pivotVal}: remains in larger elements partition.`
        }`,
        role: "diagnosis",
        operations: emitArraySnapshot(
          {
            [j]: "warning",
            [high]: "accent",
            ...(i >= 0 ? { [i]: "active" } : {}),
          },
          i >= 0 ? i : undefined,
          j,
        ),
        calculations: `Comparison: ${currVal} ${
          isSmaller ? "<=" : ">"
        } ${pivotVal}`,
      });

      if (isSmaller) {
        i++;
        if (i !== j) {
          const temp = currentArr[i];
          currentArr[i] = currentArr[j];
          currentArr[j] = temp;

          steps.push({
            title: `Swap A[${i}] (${temp}) with A[${j}] (${currentArr[i]})`,
            explanation: `Swapped smaller element ${currentArr[i]} into position i = ${i}, maintaining the partition invariant.`,
            role: "mechanism",
            operations: emitArraySnapshot(
              { [i]: "success", [j]: "success", [high]: "accent" },
              i,
              j,
            ),
          });
        }
      }
    }

    // Place pivot in correct position
    const pivotFinalPos = i + 1;
    const oldValAtPivotPos = currentArr[pivotFinalPos];
    currentArr[pivotFinalPos] = currentArr[high];
    currentArr[high] = oldValAtPivotPos;

    steps.push({
      title: `Finalize Pivot Placement at Index ${pivotFinalPos}`,
      explanation: `Swap pivot ${pivotVal} into its sorted position A[${pivotFinalPos}]. All elements to left are <= ${pivotVal}, and all elements to right are > ${pivotVal}.`,
      role: "equilibrium",
      operations: emitArraySnapshot(
        { [pivotFinalPos]: "success" },
        pivotFinalPos,
      ),
      calculations: `Partition complete at index ${pivotFinalPos}`,
    });

    return steps;
  }

  /**
   * Synthesizes step-by-step Dijkstra shortest path relaxation steps.
   */
  private static synthesizeDijkstraSteps(
    operations: ParsedOperation[],
    inputs: unknown[],
    prompt?: string,
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];
    let vertices = ["A", "B", "C", "D", "E"];
    let startVertex = "A";

    let graphEdges = [
      { from: "A", to: "B", weight: 4 },
      { from: "A", to: "C", weight: 2 },
      { from: "B", to: "C", weight: 1 },
      { from: "B", to: "D", weight: 5 },
      { from: "C", to: "D", weight: 8 },
      { from: "C", to: "E", weight: 10 },
      { from: "D", to: "E", weight: 2 },
    ];

    if (prompt) {
      const edgeMatches = [
        ...prompt.matchAll(/([A-Za-z]+)\s*-\s*([A-Za-z]+)\s*\((\d+)\)/g),
      ];
      if (edgeMatches.length > 0) {
        graphEdges = [];
        const vertexSet = new Set<string>();
        for (const m of edgeMatches) {
          const u = m[1].toUpperCase();
          const v = m[2].toUpperCase();
          const w = Number(m[3]);
          graphEdges.push({ from: u, to: v, weight: w });
          graphEdges.push({ from: v, to: u, weight: w });
          vertexSet.add(u);
          vertexSet.add(v);
        }
        vertices = Array.from(vertexSet).sort();
      }
      const stMatch = prompt.match(/from\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)/i);
      if (stMatch) {
        startVertex = stMatch[1].toUpperCase();
      }
    }

    const dist: Record<string, number> = {};
    const visited = new Set<string>();
    for (const v of vertices) {
      dist[v] = v === startVertex ? 0 : Infinity;
    }

    const emitGraphAndTable = (
      activeNode?: string,
      relaxedEdge?: { from: string; to: string },
    ): any[] => {
      const nodes = vertices.map((v) => ({
        id: `node-${v}`,
        label: `${v} (${dist[v] === Infinity ? "inf" : dist[v]})`,
        value: dist[v],
        highlight:
          v === activeNode ? "active" : visited.has(v) ? "success" : undefined,
      }));

      const edges = graphEdges.map((e) => ({
        id: `edge-${e.from}-${e.to}`,
        from: `node-${e.from}`,
        to: `node-${e.to}`,
        label: String(e.weight),
        weight: e.weight,
        highlight:
          relaxedEdge && relaxedEdge.from === e.from && relaxedEdge.to === e.to
            ? "active"
            : undefined,
      }));

      // Supporting distance table
      const rows = vertices.map((v) => [
        v,
        dist[v] === Infinity ? "Infinity" : String(dist[v]),
        visited.has(v) ? "Finalized" : "Tentative",
      ]);

      return [
        { type: "create_graph", id: "graph-main", nodes, edges },
        {
          type: "create_table",
          id: "dist-table",
          headers: ["Vertex", "Shortest Distance", "Status"],
          rows,
        },
      ];
    };

    // Step 0: Initial state
    steps.push({
      title: `Initialize Dijkstra Shortest Path from Source ${startVertex}`,
      explanation: `Set dist[${startVertex}] = 0 and all other vertices to Infinity. Priority queue holds (${startVertex}, 0). Distance table initialized.`,
      role: "setup",
      operations: emitGraphAndTable(startVertex),
      calculations: `dist[A] = 0, dist[B..E] = inf`,
    });

    // Progressive relaxation simulation
    while (visited.size < vertices.length) {
      // Find unvisited min
      let minV: string | undefined;
      let minD = Infinity;
      for (const v of vertices) {
        if (!visited.has(v) && dist[v] < minD) {
          minD = dist[v];
          minV = v;
        }
      }

      if (!minV || minD === Infinity) {
        break;
      }

      visited.add(minV);

      steps.push({
        title: `Extract Minimum Distance Vertex ${minV} (dist = ${minD})`,
        explanation: `Vertex ${minV} has minimum tentative distance (${minD}). Its shortest path from ${startVertex} is permanently finalized.`,
        role: "diagnosis",
        operations: emitGraphAndTable(minV),
      });

      // Relax outgoing edges
      const outgoing = graphEdges.filter(
        (e) => e.from === minV && !visited.has(e.to),
      );
      for (const edge of outgoing) {
        const newDist = dist[minV] + edge.weight;
        if (newDist < dist[edge.to]) {
          const oldDist = dist[edge.to];
          dist[edge.to] = newDist;

          steps.push({
            title: `Relax Edge (${edge.from} -> ${edge.to}, w = ${edge.weight})`,
            explanation: `Alternative path to ${edge.to} found via ${
              edge.from
            }: ${dist[minV]} + ${edge.weight} = ${newDist} < ${
              oldDist === Infinity ? "inf" : oldDist
            }. Updated distance in table.`,
            role: "mechanism",
            operations: emitGraphAndTable(edge.to, edge),
            calculations: `dist[${edge.to}] updated: ${
              oldDist === Infinity ? "inf" : oldDist
            } -> ${newDist}`,
          });
        }
      }
    }

    steps.push({
      title: `Dijkstra Shortest Paths Finalized`,
      explanation: `All reachable vertices finalized. Shortest distance table and spanning paths completely established.`,
      role: "proof",
      operations: emitGraphAndTable(),
    });

    return steps;
  }

  /**
   * Synthesizes step-by-step linear data structure operations (Linked List, Array, Stack, Queue).
   * Universally preserves entity conservation and relationship/pointer redirection semantics.
   */
  private static synthesizeLinearSteps(
    concept: string,
    operations: ParsedOperation[],
    inputs?: unknown[],
    prompt: string = "",
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];
    const corpus = `${concept} ${prompt}`.toLowerCase();

    // 1. Resolve initial elements
    let elements: number[] = [];
    if (Array.isArray(inputs?.[0]) && inputs[0].length > 0) {
      elements = (inputs[0] as unknown[])
        .map((x) => Number(x))
        .filter((n) => !isNaN(n));
    }

    if (elements.length === 0 && operations.length > 0) {
      const fromOp =
        operations[0].metadata?.baselineElements ||
        operations[0].arguments?.baselineChain ||
        operations[0].arguments?.baselineArray;
      if (Array.isArray(fromOp) && fromOp.length > 0) {
        elements = (fromOp as unknown[])
          .map((x) => Number(x))
          .filter((n) => !isNaN(n));
      }
    }

    if (elements.length === 0) {
      const chainMatch = prompt.match(
        /([A-Za-z0-9_-]+(?:\s*(?:->|→)\s*[A-Za-z0-9_-]+)+)/,
      );
      if (chainMatch) {
        elements = chainMatch[1]
          .split(/\s*(?:->|→)\s*/)
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
      }
    }

    if (elements.length === 0) {
      const arrayMatch = prompt.match(/\[([\d\s,.-]+)\]/);
      if (arrayMatch) {
        elements = arrayMatch[1]
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
      }
    }

    // Fallback baseline if operations are deletes and no container was found
    if (elements.length === 0) {
      const deleteVals = operations
        .filter((op) => op.op === "delete" && op.value !== undefined)
        .map((op) => Number(op.value))
        .filter((n) => !isNaN(n));
      if (deleteVals.length > 0) {
        elements = [10, ...deleteVals, 40, 50];
      }
    }

    // Determine visual structure type
    const isArray = corpus.includes("array");
    const isStack = corpus.includes("stack");
    const isQueue = corpus.includes("queue");
    const isLinkedList = !isArray && !isStack && !isQueue;

    const structType = isArray
      ? "create_array"
      : isStack
      ? "create_stack"
      : isQueue
      ? "create_queue"
      : "create_linked_list";
    const structId = isArray
      ? "arr-main"
      : isStack
      ? "stack-main"
      : isQueue
      ? "queue-main"
      : "ll-main";

    // Baseline step
    if (elements.length > 0) {
      steps.push({
        title: `Initial ${concept}`,
        explanation: `Baseline state of the ${concept} with initial elements: [${elements.join(", ")}].`,
        role: "baseline",
        operations: [
          {
            type: structType,
            id: structId,
            elements: elements.map((v) => ({
              id: `node-${v}`,
              value: v,
            })),
          },
        ],
      });
    }

    // Track sequential execution
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const val = typeof op.value === "number" ? op.value : Number(op.value);

      if (op.op === "delete" && !isNaN(val)) {
        const idx = elements.indexOf(val);
        if (idx !== -1) {
          const pred = idx > 0 ? elements[idx - 1] : undefined;
          const succ = idx + 1 < elements.length ? elements[idx + 1] : undefined;

          // MOMENT A: Focus / Identify target element before mutating
          const focusElements = elements.map((v) => ({
            id: `node-${v}`,
            value: v,
            highlight: v === val ? ("warning" as const) : undefined,
          }));

          const focusExplanation =
            isLinkedList && pred !== undefined
              ? `Identify node ${val} for elimination. Predecessor node ${pred} currently points to node ${val}.`
              : isLinkedList && pred === undefined
              ? `Identify head node ${val} for elimination. The head pointer currently references node ${val}.`
              : `Locate element ${val} at index ${idx} for removal from ${concept}.`;

          steps.push({
            title: `Identify Node ${val} for Elimination`,
            explanation: focusExplanation,
            role: "exploration",
            operations: [
              {
                type: structType,
                id: structId,
                elements: focusElements,
              },
            ],
          });

          // MOMENT B: Execute removal & rewire pointers / connectors
          elements.splice(idx, 1);
          const mutatedElements = elements.map((v) => ({
            id: `node-${v}`,
            value: v,
            highlight:
              isLinkedList && succ !== undefined && v === succ
                ? ("success" as const)
                : isLinkedList && pred !== undefined && v === pred
                ? ("success" as const)
                : undefined,
          }));

          const removalExplanation =
            isLinkedList && pred !== undefined && succ !== undefined
              ? `Node ${val} is removed. Node ${pred}'s next pointer is redirected to point directly to node ${succ}.`
              : isLinkedList && pred !== undefined
              ? `Node ${val} is removed. Node ${pred} now points to null (tail).`
              : isLinkedList && succ !== undefined
              ? `Head node ${val} is removed. The list now begins at node ${succ}.`
              : `Element ${val} removed from ${concept}. Remaining elements shifted to maintain continuity.`;

          steps.push({
            title: isLinkedList && pred !== undefined && succ !== undefined
              ? `Remove Node ${val}: Pointer ${pred} -> ${succ}`
              : `Remove Element ${val}`,
            explanation: removalExplanation,
            role: "mechanism",
            operations: [
              {
                type: structType,
                id: structId,
                elements: mutatedElements,
              },
            ],
          });
        }
      } else if (op.op === "insert" && !isNaN(val)) {
        const atIdx =
          typeof op.index === "number" && op.index >= 0 && op.index <= elements.length
            ? op.index
            : elements.length;
        elements.splice(atIdx, 0, val);
        steps.push({
          title: `Insert Element ${val}${typeof op.index === "number" ? ` at Index ${op.index}` : ""}`,
          explanation: `Element ${val} added to ${concept}${typeof op.index === "number" ? ` at index ${op.index}` : ""}. Structure updated maintaining order.`,
          role: "mechanism",
          operations: [
            {
              type: structType,
              id: structId,
              elements: elements.map((v) => ({
                id: `node-${v}`,
                value: v,
                highlight: v === val ? ("success" as const) : undefined,
              })),
            },
          ],
        });
      } else if (op.op === "swap" && Array.isArray(op.value)) {
        const [a, b] = op.value as [number, number];
        const idxA = elements.indexOf(a);
        const idxB = elements.indexOf(b);
        if (idxA !== -1 && idxB !== -1) {
          elements[idxA] = b;
          elements[idxB] = a;
          steps.push({
            title: `Swap Elements ${a} and ${b}`,
            explanation: `Swapped element ${a} at index ${idxA} with element ${b} at index ${idxB}.`,
            role: "mechanism",
            operations: [
              {
                type: structType,
                id: structId,
                elements: elements.map((v) => ({
                  value: v,
                  highlight: v === a || v === b ? ("accent" as const) : undefined,
                })),
              },
            ],
          });
        }
      } else if (op.op === "reverse") {
        elements.reverse();
        steps.push({
          title: `Reverse Sequence`,
          explanation: `Reversed all elements in ${concept}, flipping the order of links.`,
          role: "mechanism",
          operations: [
            {
              type: structType,
              id: structId,
              elements: elements.map((v) => ({ value: v })),
            },
          ],
        });
      }
    }

    return steps;
  }

  /**
   * Synthesizes authoritative LRU Cache steps using HashMap + Doubly Linked List.
   * Tracks recency ordering (MRU -> ... -> LRU) and enforces capacity constraints with eviction.
   */
  private static synthesizeLruCacheSteps(
    concept: string,
    operations: ParsedOperation[],
    prompt: string,
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];

    // Extract capacity from prompt (e.g. Capacity = 3, capacity 3)
    const capMatch = prompt.match(/\bcapacity\s*(?:=|:|\s)\s*(\d+)\b/i);
    const capacity = capMatch ? parseInt(capMatch[1], 10) : 3;

    // Filter operations to PUT and GET
    const lruOps = operations.filter(
      (op) => op.op === "put" || op.op === "get",
    );

    // Fallback if operations were not parsed from structured list
    if (lruOps.length === 0) {
      const functionOpRegex = /\b(PUT|GET)\s*\(\s*([^)]*?)\s*\)/gi;
      let fnMatch: RegExpExecArray | null;
      let order = 0;
      while ((fnMatch = functionOpRegex.exec(prompt)) !== null) {
        const rawOp = fnMatch[1].toLowerCase();
        const args = fnMatch[2]
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
        const key = args[0];
        const val =
          args[1] !== undefined
            ? !isNaN(Number(args[1]))
              ? Number(args[1])
              : args[1]
            : undefined;
        lruOps.push({
          op: rawOp,
          key,
          value: val,
          target: "cache",
          order: ++order,
        });
      }
    }

    const map = new Map<string, unknown>(); // key -> value
    const dll: string[] = []; // MRU at 0, LRU at dll.length - 1

    const emitLruSnapshot = (
      activeKey?: string,
      evictedKey?: string,
      isHit?: boolean,
    ): any[] => {
      const actions: any[] = [];

      // 1. HashMap: create_matrix
      const mapRows: (string | number)[][] = Array.from(map.entries()).map(
        ([k, v]) => [String(k), String(v)],
      );
      if (mapRows.length === 0) {
        mapRows.push(["(empty)", "-"]);
      }

      actions.push({
        type: "create_matrix",
        id: "lru-hashmap",
        label: "HashMap (O(1) Key -> Node Reference)",
        colHeaders: ["Key", "Value"],
        rows: mapRows,
        x: 100,
        y: 100,
        highlights:
          activeKey && map.has(activeKey)
            ? [
                {
                  row: Array.from(map.keys()).indexOf(activeKey),
                  col: 0,
                  color: "success",
                },
              ]
            : undefined,
      });

      // 2. Doubly Linked List: create_linked_list with variant "doubly"
      const listElements = dll.map((k) => {
        let hl: string | undefined = undefined;
        if (k === activeKey) {
          hl = isHit ? "found" : "target";
        } else if (k === evictedKey) {
          hl = "eliminated";
        }
        return {
          value: `${k}:${map.get(k)}`,
          highlight: hl,
        };
      });

      actions.push({
        type: "create_linked_list",
        id: "lru-dll",
        label: `Doubly Linked List (Head: MRU -> Tail: LRU) [Usage: ${dll.length}/${capacity}]`,
        variant: "doubly",
        elements:
          listElements.length > 0 ? listElements : [{ value: "(empty)" }],
        x: 100,
        y: 350,
      });

      return actions;
    };

    // State 0: Baseline empty cache
    const initialSnapshot = emitLruSnapshot();
    steps.push({
      title: `Initial Empty LRU Cache (Capacity = ${capacity})`,
      explanation: `The LRU Cache starts empty with fixed capacity ${capacity}. A HashMap provides O(1) key access, while a Doubly Linked List maintains recency from Most Recently Used (MRU) at the head to Least Recently Used (LRU) at the tail.`,
      role: "setup",
      operations: initialSnapshot,
      visual_actions: initialSnapshot,
    });

    for (let i = 0; i < lruOps.length; i++) {
      const op = lruOps[i];
      const k = String(op.key ?? op.value ?? "");
      const v = op.value !== undefined ? op.value : 1;

      if (op.op === "put") {
        if (map.has(k)) {
          // Update value and move to MRU
          map.set(k, v);
          const oldIdx = dll.indexOf(k);
          if (oldIdx !== -1) {
            dll.splice(oldIdx, 1);
          }
          dll.unshift(k);

          const snap = emitLruSnapshot(k, undefined, true);
          steps.push({
            title: `PUT(${k}, ${v}): Update Existing Key '${k}' and Move to MRU`,
            explanation: `Key '${k}' already exists in the cache. Its value is updated to ${v} in the HashMap and its node is moved to the MRU head of the Doubly Linked List.`,
            role: "mechanism",
            operations: snap,
            visual_actions: snap,
            codeContext: {
              language: "typescript",
              code: `// PUT(${k}, ${v}) - Update existing key\nthis.map.get("${k}").val = ${v};\nthis.dll.moveToHead(this.map.get("${k}"));`,
              highlightLines: [2, 3],
            },
          });
        } else if (dll.length < capacity) {
          // Insert new key with available capacity
          map.set(k, v);
          dll.unshift(k);

          const snap = emitLruSnapshot(k);
          steps.push({
            title: `PUT(${k}, ${v}): Insert New Key '${k}' at MRU (Size ${dll.length}/${capacity})`,
            explanation: `Cache has available capacity (${dll.length}/${capacity}). A new node for key '${k}' with value ${v} is added to the HashMap and linked at the MRU head of the Doubly Linked List.`,
            role: "mechanism",
            operations: snap,
            visual_actions: snap,
            codeContext: {
              language: "typescript",
              code: `// PUT(${k}, ${v}) - Insert with capacity available\nconst node = new Node("${k}", ${v});\nthis.map.set("${k}", node);\nthis.dll.addToHead(node);`,
              highlightLines: [2, 3, 4],
            },
          });
        } else {
          // Capacity exceeded: evict LRU tail
          const evictedKey = dll.pop()!;
          map.delete(evictedKey);

          map.set(k, v);
          dll.unshift(k);

          const snap = emitLruSnapshot(k, evictedKey);
          steps.push({
            title: `PUT(${k}, ${v}): Capacity Exceeded (${capacity}/${capacity}) — Evict LRU Key '${evictedKey}'`,
            explanation: `Cache is at maximum capacity (${capacity}/${capacity}). The Least Recently Used key '${evictedKey}' at the tail of the Doubly Linked List is evicted from both the HashMap and the list. The new key '${k}' is then inserted at the MRU head.`,
            role: "mechanism",
            operations: snap,
            visual_actions: snap,
            codeContext: {
              language: "typescript",
              code: `// PUT(${k}, ${v}) - Evict LRU tail and insert\nconst tail = this.dll.removeTail(); // Evicts '${evictedKey}'\nthis.map.delete(tail.key);\nconst node = new Node("${k}", ${v});\nthis.map.set("${k}", node);\nthis.dll.addToHead(node);`,
              highlightLines: [2, 3, 4, 5, 6],
            },
          });
        }
      } else if (op.op === "get") {
        if (map.has(k)) {
          // Cache hit: move to MRU
          const val = map.get(k);
          const oldIdx = dll.indexOf(k);
          if (oldIdx !== -1) {
            dll.splice(oldIdx, 1);
          }
          dll.unshift(k);

          const snap = emitLruSnapshot(k, undefined, true);
          steps.push({
            title: `GET(${k}): Cache Hit — Return ${val} and Move '${k}' to MRU`,
            explanation: `Key '${k}' is found in the HashMap with value ${val} (O(1) time). Accessing '${k}' marks it as Most Recently Used, promoting its node to the head of the Doubly Linked List.`,
            role: "mechanism",
            operations: snap,
            visual_actions: snap,
            codeContext: {
              language: "typescript",
              code: `// GET(${k}) - Cache Hit\nconst node = this.map.get("${k}");\nthis.dll.moveToHead(node);\nreturn node.val; // returns ${val}`,
              highlightLines: [2, 3, 4],
            },
          });
        } else {
          // Cache miss
          const snap = emitLruSnapshot();
          steps.push({
            title: `GET(${k}): Cache Miss — Key Not Present`,
            explanation: `Key '${k}' does not exist in the HashMap. A cache miss occurs (-1 / null returned), and the Doubly Linked List recency ordering remains unchanged.`,
            role: "diagnosis",
            operations: snap,
            visual_actions: snap,
            codeContext: {
              language: "typescript",
              code: `// GET(${k}) - Cache Miss\nif (!this.map.has("${k}")) {\n  return -1; // Cache miss\n}`,
              highlightLines: [2, 3],
            },
          });
        }
      }
    }

    return steps;
  }

  /**
   * Synthesizes authoritative step-by-step Binary Search progression.
   * Eliminates data vs. operation confusion by treating array elements as DATA.
   */
  private static synthesizeBinarySearchSteps(
    concept: string,
    operations: ParsedOperation[],
    inputs: unknown[],
    prompt: string,
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];

    // 1. Resolve array data
    let arr: number[] = [];
    if (
      operations.length > 0 &&
      operations[0].arguments?.container &&
      Array.isArray(operations[0].arguments.container)
    ) {
      arr = operations[0].arguments.container as number[];
    } else if (inputs.length > 0 && Array.isArray(inputs[0])) {
      arr = inputs[0] as number[];
    } else {
      const arrMatch = prompt.match(/\[([\d\s,.-]+)\]/);
      if (arrMatch) {
        arr = arrMatch[1]
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
      }
    }

    if (arr.length === 0) {
      arr = [2, 5, 8, 12, 17, 23, 29, 34, 37, 42, 51, 63, 78, 91];
    }

    // 2. Resolve target
    let target = 37;
    if (operations.length > 0 && operations[0].target !== undefined) {
      target = Number(operations[0].target);
    } else if (operations.length > 0 && operations[0].value !== undefined) {
      target = Number(operations[0].value);
    } else {
      const targetMatch = prompt.match(
        /\b(?:target|search(?:ing)?\s+for|find(?:ing)?|looking\s+for)\s*[:\s]*(\d+)\b/i,
      );
      if (targetMatch) {
        target = Number(targetMatch[1]);
      }
    }

    const emitArraySnapshot = (
      low: number,
      high: number,
      mid?: number,
      found?: boolean,
    ): any[] => {
      const elements = arr.map((v, i) => {
        let hl: string | undefined = undefined;
        if (found && i === mid) {
          hl = "found";
        } else if (i === mid) {
          hl = "mid";
        } else if (i < low || i > high) {
          hl = "eliminated";
        } else if (i === low) {
          hl = "low";
        } else if (i === high) {
          hl = "high";
        }
        return { value: v, highlight: hl };
      });

      const actions: any[] = [
        {
          type: "create_array",
          id: "bs-array",
          label: `Binary Search Array [N=${arr.length}, Target=${target}]`,
          elements,
        },
      ];

      if (mid !== undefined && mid >= 0 && mid < arr.length) {
        actions.push({
          type: "annotate_pointer",
          id: "ptr-mid",
          label: "MID",
          target: `bs-array-${mid}`,
          placement: "below",
          color: found ? "success" : "warning",
        });
      }
      if (low >= 0 && low < arr.length) {
        actions.push({
          type: "annotate_pointer",
          id: "ptr-low",
          label: "LOW",
          target: `bs-array-${low}`,
          placement: "above",
          color: "primary",
        });
      }
      if (high >= 0 && high < arr.length) {
        actions.push({
          type: "annotate_pointer",
          id: "ptr-high",
          label: "HIGH",
          target: `bs-array-${high}`,
          placement: "above",
          color: "primary",
        });
      }

      return actions;
    };

    let low = 0;
    let high = arr.length - 1;

    // State 0: Baseline initial search range
    const initialSnap = emitArraySnapshot(low, high);
    steps.push({
      title: `Start with the Full Search Range [0..${high}]`,
      explanation: `Search begins across the complete sorted array of ${arr.length} elements looking for target ${target}. The low pointer starts at index 0 and high pointer at index ${high}.`,
      role: "setup",
      operations: initialSnap,
      visual_actions: initialSnap,
      codeContext: {
        language: "typescript",
        code: `let low = 0;\nlet high = array.length - 1; // ${high}\nconst target = ${target};`,
        highlightLines: [1, 2, 3],
      },
    });

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midVal = arr[mid];

      // Comparison step
      const compSnap = emitArraySnapshot(low, high, mid);
      steps.push({
        title: `Compare Target ${target} with Midpoint Index ${mid} (${midVal})`,
        explanation: `Calculate midpoint index mid = floor((${low} + ${high}) / 2) = ${mid}. Inspect value array[${mid}] = ${midVal} and compare with target ${target}.`,
        role: "diagnosis",
        operations: compSnap,
        visual_actions: compSnap,
        codeContext: {
          language: "typescript",
          code: `const mid = Math.floor((low + high) / 2); // ${mid}\nif (array[mid] === target) { ... }\nelse if (array[mid] < target) { ... }`,
          highlightLines: [1, 2, 3],
        },
      });

      if (midVal === target) {
        // Target found!
        const foundSnap = emitArraySnapshot(low, high, mid, true);
        steps.push({
          title: `Target ${target} Found at Index ${mid}`,
          explanation: `array[${mid}] equals target ${target}! The search terminates successfully and returns index ${mid}.`,
          role: "proof",
          operations: foundSnap,
          visual_actions: foundSnap,
          codeContext: {
            language: "typescript",
            code: `if (array[mid] === target) {\n  return mid; // Found at index ${mid}\n}`,
            highlightLines: [1, 2],
          },
        });
        break;
      } else if (midVal < target) {
        // Target is in right half
        const oldLow = low;
        low = mid + 1;
        const elimSnap = emitArraySnapshot(low, high);
        steps.push({
          title: `Target ${target} > ${midVal}: Eliminate Left Half [${oldLow}..${mid}]`,
          explanation: `Since the array is sorted and target ${target} is strictly greater than array[${mid}] (${midVal}), the target cannot exist at or before index ${mid}. The left half [${oldLow}..${mid}] is discarded and low advances to ${low}.`,
          role: "mechanism",
          operations: elimSnap,
          visual_actions: elimSnap,
          codeContext: {
            language: "typescript",
            code: `else if (array[mid] < target) {\n  low = mid + 1; // Discard left half, new low = ${low}\n}`,
            highlightLines: [2],
          },
        });
      } else {
        // Target is in left half
        const oldHigh = high;
        high = mid - 1;
        const elimSnap = emitArraySnapshot(low, high);
        steps.push({
          title: `Target ${target} < ${midVal}: Eliminate Right Half [${mid}..${oldHigh}]`,
          explanation: `Since the array is sorted and target ${target} is strictly less than array[${mid}] (${midVal}), the target cannot exist at or after index ${mid}. The right half [${mid}..${oldHigh}] is discarded and high contracts to ${high}.`,
          role: "mechanism",
          operations: elimSnap,
          visual_actions: elimSnap,
          codeContext: {
            language: "typescript",
            code: `else {\n  high = mid - 1; // Discard right half, new high = ${high}\n}`,
            highlightLines: [2],
          },
        });
      }
    }

    return steps;
  }

  /**
   * Synthesizes step-by-step linked list insertion between two nodes.
   */
  private static synthesizeLinkedListPositionalSteps(
    concept: string,
    operations: ParsedOperation[],
    prompt: string,
  ): RawProposalStep[] {
    const steps: RawProposalStep[] = [];

    // Extract inserted value and boundary values
    const betweenMatch = prompt.match(
      /\b(?:insert(?:ing)?|add(?:ing)?)\s+(\d+|[A-Za-z0-9_-]+)\s+between\s+(\d+|[A-Za-z0-9_-]+)\s+and\s+(\d+|[A-Za-z0-9_-]+)/i,
    );
    const insertVal = betweenMatch ? betweenMatch[1] : "25";
    const predVal = betweenMatch ? betweenMatch[2] : "10";
    const succVal = betweenMatch ? betweenMatch[3] : "40";

    const chainMatch = prompt.match(
      /([A-Za-z0-9_-]+(?:\s*->\s*[A-Za-z0-9_-]+)+)/,
    );
    const initialNodes = chainMatch
      ? chainMatch[1].split("->").map((s) => s.trim())
      : [predVal, succVal, "60"];

    // Step 1: Baseline Initial State
    steps.push({
      title: `Initial Linked List: ${initialNodes.join(" -> ")}`,
      explanation: `The initial linked list consists of nodes ${initialNodes.join(
        ", ",
      )} connected sequentially. Goal is to insert new node ${insertVal} between ${predVal} and ${succVal}.`,
      role: "setup",
      operations: [
        {
          type: "create_linked_list",
          id: "ll-main",
          label: "Linked List (Initial State)",
          elements: initialNodes.map((v) => ({ value: v })),
        },
      ],
    });

    // Step 2: Locate Insertion Point
    steps.push({
      title: `Locate Insertion Point: Traversal Confirms ${predVal} < ${insertVal} < ${succVal}`,
      explanation: `Traversing from head locates predecessor node ${predVal} and successor node ${succVal}. New node ${insertVal} must be inserted between them to preserve sorted order.`,
      role: "diagnosis",
      operations: [
        {
          type: "create_linked_list",
          id: "ll-main",
          label: "Linked List (Insertion Site Located)",
          elements: initialNodes.map((v) => ({
            value: v,
            highlight:
              v === predVal ? "low" : v === succVal ? "high" : undefined,
          })),
        },
      ],
    });

    // Step 3: Allocate Node & Link to Successor
    steps.push({
      title: `Allocate Node ${insertVal} and Link ${insertVal} -> ${succVal}`,
      explanation: `New node ${insertVal} is allocated in memory. To preserve list continuity without losing the reference to node ${succVal}, node ${insertVal}'s next pointer is set to point to successor node ${succVal} before modifying the predecessor.`,
      role: "mechanism",
      operations: [
        {
          type: "create_linked_list",
          id: "ll-main",
          label: `Linked List (Node ${insertVal} Linked to Successor ${succVal})`,
          elements: [
            { value: predVal },
            { value: insertVal, highlight: "target" },
            { value: succVal },
            ...initialNodes
              .filter((v) => v !== predVal && v !== succVal)
              .map((v) => ({ value: v })),
          ],
        },
      ],
    });

    // Step 4: Rewire Predecessor -> Final State
    const finalNodes = [
      predVal,
      insertVal,
      succVal,
      ...initialNodes.filter((v) => v !== predVal && v !== succVal),
    ];

    steps.push({
      title: `Rewire Predecessor: ${predVal} -> ${insertVal} (Insertion Complete)`,
      explanation: `Predecessor node ${predVal}'s next pointer is redirected to point to node ${insertVal}. All links are intact and the list successfully becomes: ${finalNodes.join(
        " -> ",
      )}.`,
      role: "proof",
      operations: [
        {
          type: "create_linked_list",
          id: "ll-main",
          label: `Linked List (Final State: ${finalNodes.join(" -> ")})`,
          elements: finalNodes.map((v) => ({
            value: v,
            highlight: v === insertVal ? "found" : undefined,
          })),
        },
      ],
    });

    return steps;
  }

  /**
   * General fallback for universal operation sequences.
   * Produces clean learner-facing titles without internal implementation IDs.
   */
  private static synthesizeUniversalSteps(
    concept: string,
    operations: ParsedOperation[],
  ): RawProposalStep[] {
    return operations.map((op, idx) => {
      const opName = op.op.charAt(0).toUpperCase() + op.op.slice(1);
      const targetLabel =
        op.value !== undefined
          ? `value ${op.value}`
          : op.target !== undefined
          ? `target ${op.target}`
          : `step ${idx + 1}`;
      return {
        title: `${opName}: Process ${targetLabel}`,
        explanation: `State transformation executing ${op.op} on ${targetLabel} in ${concept}, preserving domain rules and invariant consistency.`,
        role: "mechanism",
        operations: [
          {
            type: "create_entity",
            id: `entity-${op.value ?? idx}`,
            label: String(op.value ?? op.target ?? `Step ${idx + 1}`),
            value: op.value,
            state: "active",
          },
        ],
      };
    });
  }
}
