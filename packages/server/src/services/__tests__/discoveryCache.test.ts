import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  discoveryCacheKey,
  getOrComputeDiscovery,
  __resetDiscoveryCache,
  DISCOVERY_CACHE_TTL_MS,
} from '../discoveryCache.js';
import type { ParsedRecipe } from '../recipeParser.js';

// Minimal ParsedRecipe-shaped fixtures. The cache treats the value as an
// opaque ParsedRecipe[] — only identity/contents matter for these tests.
function recipe(title: string): ParsedRecipe {
  return {
    title,
    description: null,
    ingredients: [],
    steps: [],
    cuisine: null,
    difficulty: null,
    prep_time_minutes: null,
    cook_time_minutes: null,
    total_time_minutes: null,
    servings: null,
    source_url: null,
    source_type: 'ai',
    image_url: null,
  } as unknown as ParsedRecipe;
}

describe('discoveryCache', () => {
  beforeEach(() => {
    __resetDiscoveryCache();
  });

  // Test 1 — key stability + manifest order-insensitivity.
  it('produces a deterministic, manifest-order-insensitive key', () => {
    const a = discoveryCacheKey({
      userId: 'u1',
      prompt: 'Quick Pasta',
      pantryOnly: false,
      pantryManifest: ['eggs', 'spinach', 'feta'],
      count: 3,
    });
    const b = discoveryCacheKey({
      userId: 'u1',
      prompt: '  quick pasta ', // trim + lowercase normalized
      pantryOnly: false,
      pantryManifest: ['feta', 'eggs', 'spinach'], // different order
      count: 3,
    });
    expect(a).toBe(b);

    // A different user must produce a different key.
    const c = discoveryCacheKey({
      userId: 'u2',
      prompt: 'quick pasta',
      pantryOnly: false,
      pantryManifest: ['eggs', 'spinach', 'feta'],
      count: 3,
    });
    expect(c).not.toBe(a);
  });

  // Test 2 — excludeTitles is NOT part of the base key (initial load cacheable).
  it('excludes excludeTitles from the key (not part of the signature)', () => {
    // The key input deliberately has no excludeTitles field; two logically
    // different load states (with/without on-screen titles) must collapse to
    // the same base key so the initial load is a cache hit.
    const base = discoveryCacheKey({
      userId: 'u1',
      prompt: 'soups',
      pantryOnly: false,
    });
    const sameBase = discoveryCacheKey({
      userId: 'u1',
      prompt: 'soups',
      pantryOnly: false,
    });
    expect(base).toBe(sameBase);
    // pantryOnly flips the key.
    const pantryVariant = discoveryCacheKey({
      userId: 'u1',
      prompt: 'soups',
      pantryOnly: true,
    });
    expect(pantryVariant).not.toBe(base);
  });

  it('folds the library AVOID list into the key but stays order-insensitive (ME-03)', () => {
    const noLib = discoveryCacheKey({
      userId: 'u1',
      prompt: 'soups',
      pantryOnly: false,
    });
    const withLib = discoveryCacheKey({
      userId: 'u1',
      prompt: 'soups',
      pantryOnly: false,
      libraryTitles: ['Pesto Orzo', 'Chili'],
    });
    // A non-empty library changes the key — a saved recipe can't re-surface
    // from a pre-save cache entry within the TTL.
    expect(withLib).not.toBe(noLib);

    // Saving another recipe (library grows) changes the key again.
    const grownLib = discoveryCacheKey({
      userId: 'u1',
      prompt: 'soups',
      pantryOnly: false,
      libraryTitles: ['Pesto Orzo', 'Chili', 'Ramen'],
    });
    expect(grownLib).not.toBe(withLib);

    // Reordering / re-casing the same library does NOT shift the key
    // (order-insensitive, normalized digest).
    const reordered = discoveryCacheKey({
      userId: 'u1',
      prompt: 'soups',
      pantryOnly: false,
      libraryTitles: ['  chili ', 'PESTO ORZO'],
    });
    expect(reordered).toBe(withLib);
  });

  // Phase 29 (29-01) — `light` folded into the key so a light response and a
  // full response for the same query can NEVER collide in the cache (the old
  // app must never receive a light cached payload, and vice versa).
  it('folds the light flag into the key (light vs full differ)', () => {
    const full = discoveryCacheKey({
      userId: 'u1',
      prompt: 'pasta',
      pantryOnly: true,
    });
    const lightTrue = discoveryCacheKey({
      userId: 'u1',
      prompt: 'pasta',
      pantryOnly: true,
      light: true,
    });
    const lightFalse = discoveryCacheKey({
      userId: 'u1',
      prompt: 'pasta',
      pantryOnly: true,
      light: false,
    });
    // light:true must differ from the default (no flag) and from light:false.
    expect(lightTrue).not.toBe(full);
    expect(lightTrue).not.toBe(lightFalse);
    // default (omitted) === light:false — both represent the full contract.
    expect(lightFalse).toBe(full);
  });

  // Test 3 — cache hit: second call within TTL does not recompute.
  it('returns the cached value without recomputing within TTL', async () => {
    const key = discoveryCacheKey({ userId: 'u1', prompt: 'x', pantryOnly: false });
    const compute = vi.fn(async () => [recipe('A')]);

    const first = await getOrComputeDiscovery(key, compute, { nowMs: 1000 });
    const second = await getOrComputeDiscovery(key, compute, { nowMs: 1000 });

    expect(first).toEqual([recipe('A')]);
    expect(second).toBe(first); // same cached array instance
    expect(compute).toHaveBeenCalledTimes(1);
  });

  // Test 4 — TTL expiry triggers recompute (injectable clock, no real timers).
  it('recomputes after the TTL elapses', async () => {
    const key = discoveryCacheKey({ userId: 'u1', prompt: 'y', pantryOnly: false });
    const compute = vi
      .fn<[], Promise<ParsedRecipe[]>>()
      .mockResolvedValueOnce([recipe('A')])
      .mockResolvedValueOnce([recipe('B')]);

    const first = await getOrComputeDiscovery(key, compute, { nowMs: 0 });
    // Still within TTL → cached.
    const cached = await getOrComputeDiscovery(key, compute, {
      nowMs: DISCOVERY_CACHE_TTL_MS - 1,
    });
    // After TTL → recompute.
    const refreshed = await getOrComputeDiscovery(key, compute, {
      nowMs: DISCOVERY_CACHE_TTL_MS + 1,
    });

    expect(first).toEqual([recipe('A')]);
    expect(cached).toBe(first);
    expect(refreshed).toEqual([recipe('B')]);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  // Test 5 — coalescing: concurrent identical calls compute exactly once.
  it('coalesces concurrent identical calls to a single compute', async () => {
    const key = discoveryCacheKey({ userId: 'u1', prompt: 'z', pantryOnly: false });
    let resolveCompute: (v: ParsedRecipe[]) => void = () => {};
    const compute = vi.fn(
      () =>
        new Promise<ParsedRecipe[]>((resolve) => {
          resolveCompute = resolve;
        }),
    );

    const p1 = getOrComputeDiscovery(key, compute, { nowMs: 1000 });
    const p2 = getOrComputeDiscovery(key, compute, { nowMs: 1000 });

    // Release the single in-flight compute.
    resolveCompute([recipe('shared')]);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
    expect(r1).toEqual([recipe('shared')]);
  });

  // Test 6 — load-more (cacheable:false) bypasses the cache entirely.
  it('bypasses the cache for non-cacheable (load-more) calls', async () => {
    const key = discoveryCacheKey({ userId: 'u1', prompt: 'lm', pantryOnly: false });
    const compute = vi
      .fn<[], Promise<ParsedRecipe[]>>()
      .mockResolvedValueOnce([recipe('batch1')])
      .mockResolvedValueOnce([recipe('batch2')]);

    const r1 = await getOrComputeDiscovery(key, compute, {
      cacheable: false,
      nowMs: 1000,
    });
    const r2 = await getOrComputeDiscovery(key, compute, {
      cacheable: false,
      nowMs: 1000,
    });

    // Each load-more call recomputes — nothing is read from or written to cache.
    expect(compute).toHaveBeenCalledTimes(2);
    expect(r1).toEqual([recipe('batch1')]);
    expect(r2).toEqual([recipe('batch2')]);

    // And a non-cacheable call must not have populated the cache for a later
    // cacheable read.
    const cacheableCompute = vi.fn(async () => [recipe('fresh')]);
    const r3 = await getOrComputeDiscovery(key, cacheableCompute, { nowMs: 1000 });
    expect(cacheableCompute).toHaveBeenCalledTimes(1);
    expect(r3).toEqual([recipe('fresh')]);
  });
});
