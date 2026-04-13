import { describe, it, expect, beforeEach, vi } from 'vitest';

const asyncStorageMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock.default,
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn(() => () => {}),
    fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
}));

describe('offlineQueue', () => {
  beforeEach(async () => {
    asyncStorageMock.store.clear();
    vi.resetModules();
  });

  const load = async () => {
    const mod = await import('../offlineQueue');
    return mod;
  };

  it('enqueue → getPending returns that op', async () => {
    const { offlineQueue } = await load();
    await offlineQueue.enqueue({
      type: 'markCooked',
      entryId: 'e1',
      recipeId: 'r1',
    });
    const pending = await offlineQueue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ type: 'markCooked', entryId: 'e1' });
  });

  it('preserves FIFO insertion order', async () => {
    const { offlineQueue } = await load();
    await offlineQueue.enqueue({ type: 'markCooked', entryId: 'a', recipeId: 'r' });
    await offlineQueue.enqueue({ type: 'markCooked', entryId: 'b', recipeId: 'r' });
    await offlineQueue.enqueue({ type: 'markCooked', entryId: 'c', recipeId: 'r' });
    const pending = await offlineQueue.getPending();
    expect(pending.map((o) => (o as { entryId: string }).entryId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('flush with empty queue returns {flushed:0, failed:0}', async () => {
    const { offlineQueue } = await load();
    const result = await offlineQueue.flush();
    expect(result).toEqual({ flushed: 0, failed: 0 });
  });

  it('flush with 2 successful ops removes both', async () => {
    const { offlineQueue, registerExecutor } = await load();
    const exec = vi.fn(async () => {});
    registerExecutor('markCooked', exec);
    await offlineQueue.enqueue({ type: 'markCooked', entryId: 'a', recipeId: 'r' });
    await offlineQueue.enqueue({ type: 'markCooked', entryId: 'b', recipeId: 'r' });
    const result = await offlineQueue.flush();
    expect(result).toEqual({ flushed: 2, failed: 0 });
    expect(exec).toHaveBeenCalledTimes(2);
    const pending = await offlineQueue.getPending();
    expect(pending).toEqual([]);
  });

  it('flush where op2 fails leaves only op2 in queue', async () => {
    const { offlineQueue, registerExecutor } = await load();
    let call = 0;
    registerExecutor('markCooked', async () => {
      call += 1;
      if (call === 2) throw new Error('boom');
    });
    await offlineQueue.enqueue({ type: 'markCooked', entryId: 'a', recipeId: 'r' });
    await offlineQueue.enqueue({ type: 'markCooked', entryId: 'b', recipeId: 'r' });
    const result = await offlineQueue.flush();
    expect(result).toEqual({ flushed: 1, failed: 1 });
    const pending = await offlineQueue.getPending();
    expect(pending).toHaveLength(1);
    expect((pending[0] as { entryId: string }).entryId).toBe('b');
  });
});
