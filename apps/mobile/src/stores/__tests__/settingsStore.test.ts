/**
 * Red-then-green test (Phase 20 Wave 0).
 *
 * Task 2 (plan 20-00) authors this file; Task 3 ships `settingsStore.ts` for
 * real (not a stub) and flips every case green — this is the ONE test file
 * in Wave 0 that goes green inside the same plan because the store is part
 * of the feature-flag contract (SHOP-DC-05) and downstream tests in 20-01/03
 * depend on its existence.
 *
 * Requirement: SHOP-DC-05 (feature flag gates new draft-cart flow; hidden
 * Settings toggle reverts to Phase 8 inline WebBrowser behavior).
 */
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

const STORAGE_KEY = 'dinnertime-settings';

describe('settingsStore', () => {
  beforeEach(async () => {
    asyncStorageMock.store.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("default shoppingHandoffMode is 'draft_cart' (SHOP-DC-05)", async () => {
    const { useSettingsStore } = await import('../settingsStore');
    // Allow any async rehydration microtasks to settle.
    await new Promise((r) => setTimeout(r, 10));
    expect(useSettingsStore.getState().shoppingHandoffMode).toBe('draft_cart');
  });

  it("setShoppingHandoffMode('legacy') flips the mode", async () => {
    const { useSettingsStore } = await import('../settingsStore');
    await new Promise((r) => setTimeout(r, 10));
    expect(useSettingsStore.getState().shoppingHandoffMode).toBe('draft_cart');

    useSettingsStore.getState().setShoppingHandoffMode('legacy');
    expect(useSettingsStore.getState().shoppingHandoffMode).toBe('legacy');

    useSettingsStore.getState().setShoppingHandoffMode('draft_cart');
    expect(useSettingsStore.getState().shoppingHandoffMode).toBe('draft_cart');
  });

  it('persists mode changes to AsyncStorage under dinnertime-settings', async () => {
    const { useSettingsStore } = await import('../settingsStore');
    useSettingsStore.getState().setShoppingHandoffMode('legacy');
    // Allow persist write to flush.
    await new Promise((r) => setTimeout(r, 10));

    const raw = asyncStorageMock.store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    // zustand persist middleware wraps the state under { state, version }.
    expect(parsed.state).toBeDefined();
    expect(parsed.state.shoppingHandoffMode).toBe('legacy');
  });

  it('rehydrates prior mode from AsyncStorage on cold start', async () => {
    // Seed the storage BEFORE first import so rehydrate reads it.
    asyncStorageMock.store.set(
      STORAGE_KEY,
      JSON.stringify({
        state: { shoppingHandoffMode: 'legacy' },
        version: 0,
      }),
    );

    const { useSettingsStore } = await import('../settingsStore');
    // Wait for async hydration to complete.
    await new Promise((r) => setTimeout(r, 20));

    expect(useSettingsStore.getState().shoppingHandoffMode).toBe('legacy');
  });
});
