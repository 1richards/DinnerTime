import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStore } from '../stores/networkStore';

export type QueuedOp =
  | {
      type: 'markCooked';
      entryId: string;
      recipeId: string;
    }
  | {
      type: 'pantryEdit';
      itemId: string;
      patch: Record<string, unknown>;
    };

const STORAGE_KEY = 'dinnertime-offline-queue';

type Executor = (op: QueuedOp) => Promise<void>;
const executors = new Map<QueuedOp['type'], Executor>();

export const registerExecutor = (
  type: QueuedOp['type'],
  fn: Executor
): void => {
  executors.set(type, fn);
};

const readQueue = async (): Promise<QueuedOp[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOp[]) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: QueuedOp[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

const enqueue = async (op: QueuedOp): Promise<void> => {
  const queue = await readQueue();
  queue.push(op);
  await writeQueue(queue);
};

const getPending = async (): Promise<QueuedOp[]> => {
  return readQueue();
};

const flush = async (): Promise<{ flushed: number; failed: number }> => {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { flushed: 0, failed: 0 };
  }

  const remaining: QueuedOp[] = [];
  let flushed = 0;
  let failed = 0;

  for (const op of queue) {
    const exec = executors.get(op.type);
    if (!exec) {
      // No executor registered — keep op for later.
      remaining.push(op);
      failed += 1;
      continue;
    }
    try {
      await exec(op);
      flushed += 1;
    } catch {
      remaining.push(op);
      failed += 1;
    }
  }

  await writeQueue(remaining);
  return { flushed, failed };
};

export const offlineQueue = {
  enqueue,
  getPending,
  flush,
};

// Auto-flush on offline → online transition. We track previous state
// in a closure so we only fire on the false→true edge.
let wasOnline = useNetworkStore.getState().isOnline;
useNetworkStore.subscribe((state) => {
  const nowOnline = state.isOnline;
  if (!wasOnline && nowOnline) {
    void flush();
  }
  wasOnline = nowOnline;
});
