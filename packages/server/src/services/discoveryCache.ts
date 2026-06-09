/**
 * discoveryCache — server-side response cache + in-flight coalescing for the
 * recipe-discovery path (Phase 27 Decision 2 / RC1, Fix 1 + Fix 2).
 *
 * Both `/recipes/search` and `/recipes/discover` make a fresh, blocking Gemini
 * call on every request — no cache, no coalescing. A re-trigger with the same
 * (user + normalized query + pantry signature + count) repeats a multi-second
 * AI round-trip, and a double-tap / autoFetch race fires two identical upstream
 * calls. This module fixes both:
 *
 *  - **Response cache:** a TTL'd, insertion-ordered LRU Map keyed on a
 *    sha256 content signature. A repeat identical request within the TTL
 *    returns the prior result in DB-time instead of re-calling the model.
 *  - **In-flight coalescing:** a `Map<key, Promise<ParsedRecipe[]>>` so two
 *    concurrent identical requests await a single upstream call.
 *
 * Mirrors the content-addressed `createHash('sha256')` pattern already proven
 * in `recipeImageGen.ts`, keeping one hashing convention across the server.
 *
 * Design note — `excludeTitles` is DELIBERATELY excluded from the key. The
 * initial (excludeTitles-free) load and a subsequent re-trigger differ only in
 * the not-yet-saved on-screen titles; folding those into the key would make the
 * canonical first load uncacheable. Load-more requests (count + non-empty
 * excludeTitles) are meant to be novel, so callers pass `cacheable: false` to
 * bypass the cache for those.
 *
 * Design note (ME-03) — the saved-recipe library IS folded into the key via
 * `libraryTitles`. `discoverRecipes` feeds the library titles into the model's
 * AVOID list, so the library is a genuine input to the response. Omitting it
 * let a recipe the user just saved re-surface from a stale cache entry within
 * the TTL (the model was told to avoid it, but the pre-save cached response
 * was returned). Folding a stable, order-insensitive digest of the library
 * into the key means a save (which grows the library) changes the key → a
 * fresh discovery that honors the AVOID list. The pre-save entry ages out via
 * TTL/LRU. This is distinct from `excludeTitles`: the library reflects durable
 * saved state (changes rarely), whereas `excludeTitles` reflects transient
 * on-screen titles (changes every re-trigger) and would defeat caching.
 */
import { createHash } from 'node:crypto';
import type { ParsedRecipe } from './recipeParser.js';

/** TTL for a cached discovery response. Within Decision 2's 10–15 min window. */
export const DISCOVERY_CACHE_TTL_MS = 12 * 60 * 1000; // 12 minutes

/** Soft cap on cached entries; oldest insertion evicted on overflow. */
const MAX_ENTRIES = 200;

export interface DiscoveryCacheKeyInput {
  userId: string;
  /** Raw query/prompt — normalized (trim + lowercase) before hashing. */
  prompt: string;
  pantryOnly: boolean;
  /** Optional pantry manifest — sorted before hashing so order can't shift the key. */
  pantryManifest?: string[];
  /** Optional forced recipe count (load-more uses this). */
  count?: number;
  /**
   * Saved-recipe library titles feeding the model's AVOID list (ME-03).
   * Normalized + sorted into an order-insensitive digest so a save (library
   * growth) invalidates the cache and the AVOID contract is honored, while
   * reordering the same library does not shift the key.
   */
  libraryTitles?: string[];
}

/**
 * Build a deterministic cache key. Order-insensitive on the pantry manifest
 * AND the library titles, case/whitespace-insensitive on the prompt, and
 * EXCLUDES `excludeTitles` by design (see module header) so the initial load
 * is cacheable. The library digest is folded in so a saved recipe can't
 * re-surface from a stale entry within the TTL (ME-03).
 */
export function discoveryCacheKey(input: DiscoveryCacheKeyInput): string {
  const norm = (input.prompt ?? '').trim().toLowerCase();
  const manifest = [...(input.pantryManifest ?? [])].sort().join('|');
  // Order-insensitive, normalized digest of the library. Count + sorted-title
  // hash keeps the composite bounded regardless of library size.
  const libNorm = [...(input.libraryTitles ?? [])]
    .map((t) => t.trim().toLowerCase())
    .sort();
  const libDigest =
    libNorm.length === 0
      ? '0'
      : `${libNorm.length}:${createHash('sha256').update(libNorm.join('|')).digest('hex')}`;
  const composite = `${input.userId}::${norm}::${input.pantryOnly ? 1 : 0}::${manifest}::${input.count ?? 'def'}::${libDigest}`;
  return createHash('sha256').update(composite).digest('hex');
}

interface CacheEntry {
  value: ParsedRecipe[];
  expiresAt: number;
}

// Module-scoped stores. Insertion-ordered Map gives a cheap LRU: on a hit we
// delete+re-set to move the entry to the most-recently-used (tail) position.
const responseCache = new Map<string, CacheEntry>();
const inflightMap = new Map<string, Promise<ParsedRecipe[]>>();

/** TTL-checked, LRU-touch lookup. Returns the cached value or null. */
function lookup(key: string, now: number): ParsedRecipe[] | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    responseCache.delete(key);
    return null;
  }
  // LRU touch: move to the tail so it isn't the next eviction victim.
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
}

/** Insert with soft size-cap eviction of the oldest (head) entry. */
function store(key: string, value: ParsedRecipe[], expiresAt: number): void {
  // If updating an existing key, drop it first so re-insert lands at the tail.
  if (responseCache.has(key)) responseCache.delete(key);
  responseCache.set(key, { value, expiresAt });
  while (responseCache.size > MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
}

/**
 * Return a cached discovery result for `key`, or compute it. Coalesces
 * concurrent identical cacheable requests to a single `compute()` call.
 *
 * @param opts.cacheable  When false (load-more), bypass the cache entirely —
 *   neither read nor write, and don't coalesce. Defaults to true.
 * @param opts.nowMs      Injectable clock for deterministic TTL tests.
 */
export async function getOrComputeDiscovery(
  key: string,
  compute: () => Promise<ParsedRecipe[]>,
  opts?: { cacheable?: boolean; nowMs?: number },
): Promise<ParsedRecipe[]> {
  const cacheable = opts?.cacheable !== false;
  const now = opts?.nowMs ?? Date.now();

  if (cacheable) {
    const hit = lookup(key, now);
    if (hit) return hit;
    const inflight = inflightMap.get(key);
    if (inflight) return inflight; // coalesce concurrent identical calls
  }

  const promise = compute();
  if (cacheable) inflightMap.set(key, promise);
  try {
    const result = await promise;
    if (cacheable) store(key, result, now + DISCOVERY_CACHE_TTL_MS);
    return result;
  } finally {
    if (cacheable) inflightMap.delete(key);
  }
}

/** Test-only — clear both stores so suites don't leak cached state. */
export function __resetDiscoveryCache(): void {
  responseCache.clear();
  inflightMap.clear();
}
