/**
 * Cognora DSA Acceleration Layer - Linear Container Engines
 *
 * Implements deterministic engines for:
 * 1. LinkedListEngine ("linked-list") - Tier 1 Demo-Critical
 * 2. StackEngine ("stack") - Tier 1 Demo-Critical
 * 3. QueueEngine ("queue") - Tier 1 Demo-Critical
 * 4. HashTableEngine ("hash-table") - Tier 3
 */

import type { DSAExecutionResult } from "../types/dsa-engine";
import type { DSASemanticEntity, DSASemanticRelationship, DSASemanticState } from "../types/dsa-state";
import type { TeachingTransformation } from "../types/dsa-transformation";
import type { DSAInputLimits } from "../types/dsa-concept";
import { BaseDSAEngine } from "./base-engine";
import { getDefaultDataset } from "../datasets/default-datasets";

// =========================================================================
// 1. LINKED LIST ENGINE (Tier 1 Demo-Critical)
// =========================================================================
export interface LinkedListInput {
  initialNodes?: Array<number | string>;
  deleteValues?: Array<number | string>;
  insertValues?: Array<{ value: number | string; after?: number | string; before?: number | string }>;
  operation?: "insert" | "delete" | "traverse";
  target?: number | string;
}

export class LinkedListEngine extends BaseDSAEngine<LinkedListInput> {
  public readonly conceptId = "linked-list";

  private snapshotLinkedList(
    version: number,
    title: string,
    nodes: Array<{ id: string; value: number | string; status: string; isHead?: boolean; isTail?: boolean }>,
    metadata: Record<string, unknown> = {},
  ): DSASemanticState {
    const entities = new Map<string, DSASemanticEntity>();
    const relationships: DSASemanticRelationship[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      let ptrLabel = "";
      if (node.isHead && node.isTail) ptrLabel = " [HEAD/TAIL]";
      else if (node.isHead) ptrLabel = " [HEAD]";
      else if (node.isTail) ptrLabel = " [TAIL]";

      entities.set(node.id, {
        id: node.id,
        type: "LinkedListNode",
        label: `${node.value}${ptrLabel}`,
        value: typeof node.value === "number" ? node.value : i,
        role: "node",
        status: node.status,
        properties: {
          index: i,
          isHead: node.isHead || false,
          isTail: node.isTail || false,
          width: 80,
          height: 50,
        },
      });

      if (i < nodes.length - 1) {
        const nextNode = nodes[i + 1];
        relationships.push({
          id: `rel-${node.id}-to-${nextNode.id}`,
          sourceId: node.id,
          targetId: nextNode.id,
          type: "next",
          label: "next",
          style: "solid",
          directed: true,
          status: "default",
        });
      }
    }

    return {
      version,
      title,
      entities,
      relationships,
      metadata,
    };
  }

  public execute(input: LinkedListInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("linked-list");
    let rawVals = input?.initialNodes && input.initialNodes.length > 0 ? [...input.initialNodes] : [...defaultData.values];

    const maxElements = limits?.maxElements || 12;
    if (rawVals.length > maxElements) rawVals = rawVals.slice(0, maxElements);

    let currentNodes = rawVals.map((v, idx) => ({
      id: `ll-node-${v}`,
      value: v,
      status: "default",
      isHead: idx === 0,
      isTail: idx === rawVals.length - 1,
    }));

    this.states.push(
      this.snapshotLinkedList(0, "Linked List: Initial State", currentNodes, {
        nodeCount: currentNodes.length,
      }),
    );

    const toDelete = input?.deleteValues || [];
    if (toDelete.length > 0) {
      for (const delVal of toDelete) {
        const prevIdx = this.states.length - 1;
        const targetNodeIdx = currentNodes.findIndex((n) => `${n.value}` === `${delVal}`);

        if (targetNodeIdx === -1) continue;

        // Step A: Highlight target node to delete
        const highlightNodes = currentNodes.map((n, idx) => ({
          ...n,
          status: idx === targetNodeIdx ? "active" : "default",
        }));

        this.states.push(
          this.snapshotLinkedList(
            this.states.length,
            `Locate node ${delVal} for deletion`,
            highlightNodes,
            { targetValue: delVal },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "LOCATE_NODE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [highlightNodes[targetNodeIdx].id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [highlightNodes[targetNodeIdx].id],
            label: `Target node ${delVal}`,
            anchorPreference: "center",
          },
          whatHappened: `Traversed list to locate node with value ${delVal}.`,
          reason: `Node removal requires finding its predecessor to rewire pointer links.`,
          consequence: `Node ${delVal} identified; ready to bypass its connection.`,
          title: `Locate node ${delVal}`,
          explanation: `We scan forward until reaching node ${delVal}. We prepare to rewire the predecessor's next pointer.`,
        });

        // Step B: Rewire pointers and delete node
        const prevDeleteIdx = this.states.length - 1;
        const removedNode = currentNodes[targetNodeIdx];
        currentNodes = currentNodes.filter((_, idx) => idx !== targetNodeIdx);

        currentNodes.forEach((n, idx) => {
          n.isHead = idx === 0;
          n.isTail = idx === currentNodes.length - 1;
          n.status = "default";
        });

        this.states.push(
          this.snapshotLinkedList(
            this.states.length,
            `Deleted node ${delVal}: Pointers rewired`,
            currentNodes,
            { deletedValue: delVal },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "DELETE_NODE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevDeleteIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [removedNode.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: currentNodes.length > 0 ? [currentNodes[Math.max(0, targetNodeIdx - 1)].id] : [],
            label: `Rewired connection`,
            anchorPreference: "center",
          },
          whatHappened: `Unlinked node ${delVal} by connecting predecessor directly to successor.`,
          reason: `Bypassing node ${delVal} preserves contiguous traversal without broken links.`,
          consequence: `Node ${delVal} is safely excised; list length is now ${currentNodes.length}.`,
          title: `Delete node ${delVal}`,
          explanation: `We rewire predecessor.next to target.next. Node ${delVal} is unlinked from the chain.`,
        });
      }
    } else if (input?.insertValues && input.insertValues.length > 0) {
      for (const ins of input.insertValues) {
        const prevIdx = this.states.length - 1;
        const newNode = {
          id: `ll-node-${ins.value}`,
          value: ins.value,
          status: "found",
          isHead: false,
          isTail: false,
        };

        let insIdx = currentNodes.length;
        if (ins.after !== undefined) {
          const targetIdx = currentNodes.findIndex((n) => `${n.value}` === `${ins.after}`);
          if (targetIdx !== -1) insIdx = targetIdx + 1;
        }

        currentNodes.splice(insIdx, 0, newNode);
        currentNodes.forEach((n, idx) => {
          n.isHead = idx === 0;
          n.isTail = idx === currentNodes.length - 1;
          n.status = n.id === newNode.id ? "found" : "default";
        });

        this.states.push(
          this.snapshotLinkedList(
            this.states.length,
            `Inserted node ${ins.value} into chain`,
            currentNodes,
            { insertedValue: ins.value },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "INSERT_NODE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [newNode.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [newNode.id],
            label: `Inserted ${ins.value}`,
            anchorPreference: "center",
          },
          whatHappened: `Allocated new node ${ins.value} and spliced it into list.`,
          reason: `Updated predecessor.next to point to new node, and new node.next to successor.`,
          consequence: `List maintains unbroken forward linkage with new node integrated.`,
          title: `Insert node ${ins.value}`,
          explanation: `We allocate node ${ins.value} and update pointer links in O(1) time once position is reached.`,
        });
      }
    } else {
      for (let i = 0; i < currentNodes.length; i++) {
        const prevIdx = this.states.length - 1;
        const highlighted = currentNodes.map((n, idx) => ({
          ...n,
          status: idx === i ? "active" : idx < i ? "visited" : "default",
        }));

        this.states.push(
          this.snapshotLinkedList(
            this.states.length,
            `Traverse Node ${currentNodes[i].value} (Position ${i})`,
            highlighted,
            { currentPosition: i },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "TRAVERSE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [currentNodes[i].id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [currentNodes[i].id],
            label: `Node ${currentNodes[i].value}`,
            anchorPreference: "center",
          },
          whatHappened: `Visited node ${currentNodes[i].value} along next pointer.`,
          reason: `Sequential forward pointer traversal.`,
          consequence: i === currentNodes.length - 1 ? "Reached tail node (next = null)." : "Follow next pointer.",
          title: `Visit node ${currentNodes[i].value}`,
          explanation: `Pointer advances forward through node ${currentNodes[i].value}.`,
        });
      }
    }

    return this.formatResult({ length: currentNodes.length });
  }
}

// =========================================================================
// 2. STACK ENGINE (Tier 1 Demo-Critical)
// =========================================================================
export interface StackInput {
  operations?: Array<{ type: "push" | "pop" | "peek"; value?: number | string }>;
  initialValues?: Array<number | string>;
}

export class StackEngine extends BaseDSAEngine<StackInput> {
  public readonly conceptId = "stack";

  private snapshotStack(
    version: number,
    title: string,
    stack: Array<{ id: string; value: number | string; status: string }>,
    metadata: Record<string, unknown> = {},
  ): DSASemanticState {
    const entities = new Map<string, DSASemanticEntity>();
    const relationships: DSASemanticRelationship[] = [];

    for (let i = 0; i < stack.length; i++) {
      const item = stack[i];
      const isTop = i === stack.length - 1;
      entities.set(item.id, {
        id: item.id,
        type: "StackItem",
        label: isTop ? `${item.value}\n[TOP]` : `${item.value}`,
        value: typeof item.value === "number" ? item.value : i,
        role: isTop ? "top" : "element",
        status: item.status,
        properties: {
          stackIndex: i,
          isTop,
          width: 100,
          height: 48,
        },
      });

      if (i > 0) {
        const belowItem = stack[i - 1];
        relationships.push({
          id: `rel-stack-${item.id}-on-${belowItem.id}`,
          sourceId: item.id,
          targetId: belowItem.id,
          type: "stacked_on",
          label: "on",
          style: "solid",
          directed: true,
          status: "default",
        });
      }
    }

    return {
      version,
      title,
      entities,
      relationships,
      metadata,
    };
  }

  public execute(input: StackInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("stack");
    const initVals = input?.initialValues || defaultData.values;
    const stack: Array<{ id: string; value: number | string; status: string }> = initVals.map((v, idx) => ({
      id: `stack-item-${idx}`,
      value: v,
      status: "default",
    }));

    this.states.push(
      this.snapshotStack(0, "Initial Stack State", stack, { depth: stack.length }),
    );

    const ops = input?.operations && input.operations.length > 0
      ? input.operations
      : [
          { type: "push" as const, value: 99 },
          { type: "peek" as const },
          { type: "pop" as const },
        ];

    let idCounter = stack.length;

    for (const op of ops) {
      const prevIdx = this.states.length - 1;

      if (op.type === "push" && op.value !== undefined) {
        const newItem = {
          id: `stack-item-${idCounter++}`,
          value: op.value,
          status: "found",
        };
        stack.push(newItem);

        this.states.push(
          this.snapshotStack(
            this.states.length,
            `PUSH ${op.value} onto Stack (New TOP)`,
            stack,
            { pushed: op.value, depth: stack.length },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "PUSH",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [newItem.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [newItem.id],
            label: `Top: ${op.value}`,
            anchorPreference: "center",
          },
          whatHappened: `Pushed element ${op.value} onto top of the stack.`,
          reason: `LIFO (Last-In, First-Out) discipline places all new elements at the top.`,
          consequence: `Element ${op.value} becomes the new TOP. Stack depth is ${stack.length}.`,
          title: `Push ${op.value}`,
          explanation: `We push ${op.value} onto the stack. It is now the most accessible element.`,
        });
      } else if (op.type === "pop" && stack.length > 0) {
        const popped = stack.pop()!;

        this.states.push(
          this.snapshotStack(
            this.states.length,
            `POP ${popped.value} from Stack`,
            stack,
            { popped: popped.value, depth: stack.length },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "POP",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [popped.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: stack.length > 0 ? [stack[stack.length - 1].id] : [],
            label: `New top after pop`,
            anchorPreference: "center",
          },
          whatHappened: `Popped top element ${popped.value} from the stack.`,
          reason: `LIFO discipline removes the most recently pushed element.`,
          consequence: `Stack depth decreases to ${stack.length}. Prior element becomes new TOP.`,
          title: `Pop ${popped.value}`,
          explanation: `We remove the top element ${popped.value}. The element immediately below it is now TOP.`,
        });
      } else if (op.type === "peek" && stack.length > 0) {
        const topItem = stack[stack.length - 1];
        topItem.status = "active";

        this.states.push(
          this.snapshotStack(
            this.states.length,
            `PEEK: Top Element is ${topItem.value}`,
            stack,
            { peekValue: topItem.value },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "PEEK",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [topItem.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [topItem.id],
            label: `Peek top: ${topItem.value}`,
            anchorPreference: "center",
          },
          whatHappened: `Inspected top element ${topItem.value} without removing it.`,
          reason: `Peek returns the top value in O(1) time without modifying state.`,
          consequence: `Stack remains unchanged.`,
          title: `Peek top element`,
          explanation: `We inspect ${topItem.value} at the top of the stack. Stack depth is unaltered.`,
        });
        topItem.status = "default";
      }
    }

    return this.formatResult({ depth: stack.length });
  }
}

// =========================================================================
// 3. QUEUE ENGINE (Tier 1 Demo-Critical)
// =========================================================================
export interface QueueInput {
  operations?: Array<{ type: "enqueue" | "dequeue" | "peek"; value?: number | string }>;
  initialValues?: Array<number | string>;
}

export class QueueEngine extends BaseDSAEngine<QueueInput> {
  public readonly conceptId = "queue";

  private snapshotQueue(
    version: number,
    title: string,
    queue: Array<{ id: string; value: number | string; status: string }>,
    metadata: Record<string, unknown> = {},
  ): DSASemanticState {
    const entities = new Map<string, DSASemanticEntity>();
    const relationships: DSASemanticRelationship[] = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      let ptr = "";
      if (queue.length === 1) ptr = " [FRONT/REAR]";
      else if (i === 0) ptr = " [FRONT]";
      else if (i === queue.length - 1) ptr = " [REAR]";

      entities.set(item.id, {
        id: item.id,
        type: "QueueItem",
        label: `${item.value}${ptr}`,
        value: typeof item.value === "number" ? item.value : i,
        role: i === 0 ? "front" : i === queue.length - 1 ? "rear" : "element",
        status: item.status,
        properties: {
          queueIndex: i,
          isFront: i === 0,
          isRear: i === queue.length - 1,
          width: 72,
          height: 52,
        },
      });

      if (i < queue.length - 1) {
        const nextItem = queue[i + 1];
        relationships.push({
          id: `rel-queue-${item.id}-to-${nextItem.id}`,
          sourceId: item.id,
          targetId: nextItem.id,
          type: "queue_link",
          label: "",
          style: "solid",
          directed: true,
          status: "default",
        });
      }
    }

    return {
      version,
      title,
      entities,
      relationships,
      metadata,
    };
  }

  public execute(input: QueueInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("queue");
    const initVals = input?.initialValues || defaultData.values;
    const queue: Array<{ id: string; value: number | string; status: string }> = initVals.map((v, idx) => ({
      id: `queue-item-${idx}`,
      value: v,
      status: "default",
    }));

    this.states.push(
      this.snapshotQueue(0, "Initial FIFO Queue State", queue, { length: queue.length }),
    );

    const ops = input?.operations && input.operations.length > 0
      ? input.operations
      : [
          { type: "enqueue" as const, value: 50 },
          { type: "dequeue" as const },
        ];

    let idCounter = queue.length;

    for (const op of ops) {
      const prevIdx = this.states.length - 1;

      if (op.type === "enqueue" && op.value !== undefined) {
        const newItem = {
          id: `queue-item-${idCounter++}`,
          value: op.value,
          status: "found",
        };
        queue.push(newItem);

        this.states.push(
          this.snapshotQueue(
            this.states.length,
            `ENQUEUE ${op.value} at REAR`,
            queue,
            { enqueued: op.value, length: queue.length },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "ENQUEUE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [newItem.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: [newItem.id],
            label: `Rear: ${op.value}`,
            anchorPreference: "center",
          },
          whatHappened: `Appended ${op.value} to the rear of the queue.`,
          reason: `FIFO (First-In, First-Out) discipline queues all newcomers at the tail.`,
          consequence: `Queue length increases to ${queue.length}.`,
          title: `Enqueue ${op.value}`,
          explanation: `We append ${op.value} at the rear. It will wait behind earlier elements.`,
        });
      } else if (op.type === "dequeue" && queue.length > 0) {
        const dequeued = queue.shift()!;

        this.states.push(
          this.snapshotQueue(
            this.states.length,
            `DEQUEUE ${dequeued.value} from FRONT`,
            queue,
            { dequeued: dequeued.value, length: queue.length },
          ),
        );

        this.transformations.push({
          id: `t-${this.transformations.length + 1}`,
          type: "DEQUEUE",
          stepNumber: this.transformations.length + 1,
          beforeStateIndex: prevIdx,
          afterStateIndex: this.states.length - 1,
          affectedEntityIds: [dequeued.id],
          affectedRelationshipIds: [],
          semanticFocus: {
            entityIds: queue.length > 0 ? [queue[0].id] : [],
            label: `New front of queue`,
            anchorPreference: "center",
          },
          whatHappened: `Removed front element ${dequeued.value} from the queue.`,
          reason: `FIFO discipline serves the oldest waiting element first.`,
          consequence: `Remaining elements advance forward. Next element becomes FRONT.`,
          title: `Dequeue ${dequeued.value}`,
          explanation: `We remove front element ${dequeued.value}. The next element in line becomes FRONT.`,
        });
      }
    }

    return this.formatResult({ length: queue.length });
  }
}

// =========================================================================
// 4. HASH TABLE ENGINE (Tier 3)
// =========================================================================
export interface HashTableInput {
  keys?: Array<number | string>;
  bucketCount?: number;
  lookupKey?: number | string;
}

export class HashTableEngine extends BaseDSAEngine<HashTableInput> {
  public readonly conceptId = "hash-table";

  private snapshotHashTable(
    version: number,
    title: string,
    buckets: Array<Array<{ id: string; key: number | string; status: string }>>,
    metadata: Record<string, unknown> = {},
  ): DSASemanticState {
    const entities = new Map<string, DSASemanticEntity>();
    const relationships: DSASemanticRelationship[] = [];

    for (let b = 0; b < buckets.length; b++) {
      const bId = `bucket-${b}`;
      entities.set(bId, {
        id: bId,
        type: "HashBucket",
        label: `Bucket [${b}]`,
        value: b,
        role: "container",
        status: "default",
        properties: {
          bucketIndex: b,
          chainLength: buckets[b].length,
          width: 80,
          height: 40,
        },
      });

      for (let i = 0; i < buckets[b].length; i++) {
        const item = buckets[b][i];
        entities.set(item.id, {
          id: item.id,
          type: "HashEntry",
          label: `${item.key}`,
          value: typeof item.key === "number" ? item.key : i,
          role: "entry",
          status: item.status,
          properties: {
            bucketIndex: b,
            chainIndex: i,
            width: 60,
            height: 40,
          },
        });

        const sourceId = i === 0 ? bId : buckets[b][i - 1].id;
        relationships.push({
          id: `rel-${sourceId}-to-${item.id}`,
          sourceId,
          targetId: item.id,
          type: "chain",
          label: "",
          style: "solid",
          directed: true,
          status: "default",
        });
      }
    }

    return {
      version,
      title,
      entities,
      relationships,
      metadata,
    };
  }

  public execute(input: HashTableInput, limits?: DSAInputLimits): DSAExecutionResult<DSASemanticState> {
    this.states = [];
    this.transformations = [];

    const defaultData = getDefaultDataset("hash-table");
    const rawKeys = input?.keys || defaultData.values;
    const bucketCount = input?.bucketCount || 5;

    const buckets: Array<Array<{ id: string; key: number | string; status: string }>> = Array.from(
      { length: bucketCount },
      () => [],
    );

    this.states.push(
      this.snapshotHashTable(0, `Hash Table: ${bucketCount} Empty Buckets`, buckets, { bucketCount }),
    );

    let keyIdCounter = 0;

    for (const key of rawKeys) {
      const prevIdx = this.states.length - 1;
      const numVal = typeof key === "number" ? key : key.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const bucketIdx = Math.abs(numVal) % bucketCount;

      const isCollision = buckets[bucketIdx].length > 0;
      const newItem = {
        id: `entry-${keyIdCounter++}`,
        key,
        status: isCollision ? "collision" : "found",
      };

      buckets[bucketIdx].push(newItem);

      this.states.push(
        this.snapshotHashTable(
          this.states.length,
          `Insert '${key}': hash(${key}) % ${bucketCount} = Bucket [${bucketIdx}]${isCollision ? " (Collision)" : ""}`,
          buckets,
          { insertedKey: key, bucket: bucketIdx, collision: isCollision },
        ),
      );

      this.transformations.push({
        id: `t-${this.transformations.length + 1}`,
        type: isCollision ? "COLLISION" : "INSERT",
        stepNumber: this.transformations.length + 1,
        beforeStateIndex: prevIdx,
        afterStateIndex: this.states.length - 1,
        affectedEntityIds: [newItem.id, `bucket-${bucketIdx}`],
        affectedRelationshipIds: [],
        semanticFocus: {
          entityIds: [newItem.id],
          label: `Key '${key}' in Bucket ${bucketIdx}`,
          anchorPreference: "center",
        },
        whatHappened: `Computed hash index ${bucketIdx} for key '${key}' and inserted into bucket chain.`,
        reason: isCollision
          ? `Bucket [${bucketIdx}] already contains entries. Chaining resolves collision.`
          : `Bucket [${bucketIdx}] was empty. Direct insertion succeeds.`,
        consequence: `Key '${key}' is now accessible in O(1) average time.`,
        title: isCollision ? `Collision in bucket ${bucketIdx}` : `Inserted '${key}'`,
        explanation: `hash(${key}) maps to bucket ${bucketIdx}. We append it to the separate chaining list.`,
      });
    }

    return this.formatResult({ bucketCount, totalKeys: rawKeys.length });
  }
}
