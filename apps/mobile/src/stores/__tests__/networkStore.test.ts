import { describe, it, expect, beforeEach, vi } from 'vitest';

type NetState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};
type Listener = (state: NetState) => void;

const netInfoMock = vi.hoisted(() => {
  const listeners: Listener[] = [];
  return {
    listeners,
    default: {
      addEventListener: vi.fn((cb: Listener) => {
        listeners.push(cb);
        return () => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      }),
      fetch: vi.fn(async () => ({
        isConnected: true,
        isInternetReachable: true,
      })),
    },
  };
});

vi.mock('@react-native-community/netinfo', () => ({
  default: netInfoMock.default,
}));

describe('networkStore', () => {
  beforeEach(() => {
    netInfoMock.listeners.length = 0;
    vi.resetModules();
  });

  const loadStore = async () => {
    const mod = await import('../networkStore');
    return mod.useNetworkStore;
  };

  const emit = (state: NetState) => {
    for (const cb of netInfoMock.listeners) cb(state);
  };

  it('starts with isOnline=true', async () => {
    const useNetworkStore = await loadStore();
    expect(useNetworkStore.getState().isOnline).toBe(true);
  });

  it('isConnected=true + isInternetReachable=true → isOnline=true', async () => {
    const useNetworkStore = await loadStore();
    emit({ isConnected: true, isInternetReachable: true });
    expect(useNetworkStore.getState().isOnline).toBe(true);
  });

  it('isConnected=false → isOnline=false', async () => {
    const useNetworkStore = await loadStore();
    emit({ isConnected: false, isInternetReachable: false });
    expect(useNetworkStore.getState().isOnline).toBe(false);
  });

  it('isConnected=true + isInternetReachable=false → isOnline=false', async () => {
    const useNetworkStore = await loadStore();
    emit({ isConnected: true, isInternetReachable: false });
    expect(useNetworkStore.getState().isOnline).toBe(false);
  });

  it('isConnected=true + isInternetReachable=null → isOnline=true (unknown ≠ offline)', async () => {
    const useNetworkStore = await loadStore();
    emit({ isConnected: true, isInternetReachable: null });
    expect(useNetworkStore.getState().isOnline).toBe(true);
  });
});
