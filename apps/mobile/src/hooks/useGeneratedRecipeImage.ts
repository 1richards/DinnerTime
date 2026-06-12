/**
 * useGeneratedRecipeImage — fire-and-forget server-side image generation.
 *
 * When a suggestion or search result has no `image_url` (common for AI-
 * generated recipes from Phase 17 Something New), the keyword-matched stock
 * photo only loosely relates to the dish. This hook kicks off a background
 * POST to `/api/v1/recipes/generate-image` which calls Gemini 2.5 Flash
 * Image (nano banana) and returns a cached Supabase Storage URL.
 *
 * Return shape: `{ url, status }` where status is one of:
 *   - 'loading'  — no cached entry yet (or inflight) and we haven't given up
 *   - 'resolved' — url is non-null OR there is nothing to fetch (no title/skip)
 *   - 'failed'   — a completed fetch returned null; do NOT retry this session
 *
 * Cost control: we dedupe by normalized title + ingredient fingerprint across
 * the whole session. Two cards for the same recipe share one fetch. Resolved
 * (non-null) URLs are persisted to AsyncStorage so popular dishes render
 * instantly on next session. Failed (null) attempts are NOT persisted, so the
 * user gets a fresh chance on the next app launch.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logAiEvent, sanitizePayload } from '../ai/telemetry';
import type { ParsedIngredient } from '../types/recipe';

/**
 * Phase 28 (T3): emit per-image time-to-visible (hook-mount → resolved) so
 * we get real client-side p50/p95 for recipe-image rendering, split by
 * cache-hit vs cold-gen. `ms` + `success` are the only payload keys (both
 * whitelisted); NO titles/ingredients (PII guard).
 */
function emitImageEvent(
  kind: 'cache_hit' | 'cold_gen',
  startedAt: number,
  success: boolean,
): void {
  logAiEvent({
    name: 'recipe.image.visible',
    session_id: 'recipe-box', // coarse session bucket; no PII
    task_name: `recipe.image.${kind}`,
    model: 'gemini-2.5-flash-image',
    payload: sanitizePayload({ ms: Date.now() - startedAt, success }),
  });
}

function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

type Entry = {
  url: string | null;
  inflight: Promise<string | null> | null;
  attempted: boolean;
};
const cache = new Map<string, Entry>();

// ---------- Concurrency limiter ----------
//
// Caps simultaneous generate-image HTTP requests at MAX_CONCURRENT.
// Without this, mounting a library of 30 uncached recipes fires 30
// concurrent Gemini calls that saturate the server and starve the
// fetchRecipes call that the list depends on.
//
// When the queue is full, new requests wait for a slot. The wait queue is a
// MIN-PRIORITY queue keyed on the caller's `priority` number (lower = higher
// priority = served first; stable for ties via an insertion sequence). On
// Something New each card passes its list index as priority, so when a slot
// frees the TOP-most waiting card always generates next — the hero finishes
// before lower cards regardless of which fired first. Resolved/cached results
// bypass the limiter entirely.

// Lead-then-steady concurrency. The FIRST image of each burst runs ALONE
// (LEAD=1) so the top-most card's photo is guaranteed to land before any other
// starts (fixes "2nd photo appeared before the 1st"). Once it resolves, the
// rest fill in STEADY=2 at a time for speed. Measured: pure serial made 8
// images take ~50s (each ~7s, zero overlap); pure 2-wide was ~28s but let the
// 2nd beat the 1st. Lead-then-steady is hero-first AND ~32s — near 2-wide.
const LEAD_CONCURRENT = 1;
const STEADY_CONCURRENT = 2;
const DEFAULT_PRIORITY = Number.MAX_SAFE_INTEGER;
let _inFlight = 0;
// Completions since the limiter was last fully idle. 0 ⇒ we're at the start of
// a burst, so only the lead (top) image runs; >0 ⇒ open up to STEADY.
let _completedSinceIdle = 0;

interface Waiter {
  resolve: () => void;
  priority: number;
  // Monotonic insertion order — tiebreaker so equal priorities stay FIFO
  // (stable). Without it, two index-0 cards (e.g. two surfaces) could swap.
  seq: number;
}
const _waitQueue: Waiter[] = [];
let _waitSeq = 0;
let _flushScheduled = false;

// Drain the queue in PRIORITY order up to MAX_CONCURRENT. Runs on a microtask
// so every acquireSlot() call made in the same tick (all the cards mounting at
// once) is collected BEFORE we pick a winner — otherwise the first caller to
// hit a free slot would start regardless of priority (the original bug: top-2
// started in mount/effect order, not list order).
function currentMax(): number {
  return _completedSinceIdle === 0 ? LEAD_CONCURRENT : STEADY_CONCURRENT;
}

function flushQueue(): void {
  _flushScheduled = false;
  while (_inFlight < currentMax() && _waitQueue.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < _waitQueue.length; i++) {
      const w = _waitQueue[i]!;
      const best = _waitQueue[bestIdx]!;
      if (w.priority < best.priority ||
        (w.priority === best.priority && w.seq < best.seq)) {
        bestIdx = i;
      }
    }
    const [next] = _waitQueue.splice(bestIdx, 1);
    _inFlight++;
    next!.resolve();
  }
}

function scheduleFlush(): void {
  if (_flushScheduled) return;
  _flushScheduled = true;
  queueMicrotask(flushQueue);
}

// ALWAYS enqueue (never grant a free slot synchronously) so the priority
// scheduler — not call order — decides who starts.
function acquireSlot(priority: number = DEFAULT_PRIORITY): Promise<void> {
  return new Promise<void>((resolve) => {
    _waitQueue.push({ resolve, priority, seq: _waitSeq++ });
    scheduleFlush();
  });
}

function releaseSlot(): void {
  _inFlight--;
  _completedSinceIdle++;
  // Fully idle (nothing running, nothing queued) ⇒ the next request begins a
  // fresh burst and should lead alone again.
  if (_inFlight === 0 && _waitQueue.length === 0) {
    _completedSinceIdle = 0;
  }
  scheduleFlush();
}

async function fetchGeneratedUrlThrottled(
  req: ImageRequest,
  priority: number = DEFAULT_PRIORITY,
): Promise<string | null> {
  await acquireSlot(priority);
  try {
    return await fetchGeneratedUrl(req);
  } finally {
    releaseSlot();
  }
}

function norm(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Short client-side fingerprint mirroring the server's ingredient hash so
 * our session cache key matches the server's Storage cache key. Exact hash
 * doesn't need to match — it only needs to differ between distinct recipes
 * sharing a title.
 */
function fingerprintIngredients(
  ingredients: ParsedIngredient[] | null | undefined,
): string {
  if (!ingredients || ingredients.length === 0) return '';
  const top = ingredients
    .slice(0, 6)
    .map((i) => (i.name ?? '').trim().toLowerCase())
    .filter((n) => n.length > 0)
    .sort()
    .join('|');
  return top;
}

function cacheKeyFor(
  title: string,
  ingredients: ParsedIngredient[] | null | undefined,
): string {
  const fp = fingerprintIngredients(ingredients);
  return fp ? `${norm(title)}#${fp}` : norm(title);
}

interface ImageRequest {
  title: string;
  description?: string | null;
  ingredients?: ParsedIngredient[] | null;
  /**
   * Saved recipe id. When present, the server (Plan 27-01) persists the
   * resolved hero URL to recipes.image_url so later cold starts skip
   * generate-image entirely. Unsaved "Something New" previews have no id
   * and pass undefined, keeping them AsyncStorage-only.
   */
  recipeId?: string | null;
}

async function fetchGeneratedUrl(
  req: ImageRequest,
): Promise<string | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    const res = await fetch(
      `${getApiBaseUrl()}/api/v1/recipes/generate-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: req.title,
          description: req.description ?? null,
          ingredients: req.ingredients ?? null,
          recipeId: req.recipeId ?? null,
        }),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: string | null };
    return body?.url ?? null;
  } catch {
    return null;
  }
}

// ---------- AsyncStorage persistence ----------

const STORAGE_KEY = 'dinnertime-image-cache';
let hydrated = false;
// Listeners notified once hydration finishes so mounted hooks can re-evaluate.
const hydrationListeners = new Set<() => void>();

async function hydrateFromStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { url: string | null }>;
      for (const [key, val] of Object.entries(parsed)) {
        // Only merge if not already populated (in-flight fetch wins over disk).
        if (!cache.has(key) && val && typeof val.url === 'string') {
          cache.set(key, { url: val.url, inflight: null, attempted: true });
        }
      }
    }
  } catch {
    // Non-critical; cache just stays empty
  } finally {
    hydrated = true;
    hydrationListeners.forEach((l) => l());
    hydrationListeners.clear();
  }
}
// Kick off hydration on module load — no await, no blocking
void hydrateFromStorage();

function persistToStorage(): void {
  // Fire-and-forget; only persist resolved non-null URLs. Failed (null)
  // attempts are intentionally dropped so retry on next session is possible.
  const serializable: Record<string, { url: string }> = {};
  for (const [key, entry] of cache.entries()) {
    if (entry.url !== null) {
      serializable[key] = { url: entry.url };
    }
  }
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializable)).catch(() => {
    // Persistence is non-critical
  });
}

// ---------- Hook ----------

export type GeneratedImageStatus =
  | 'deferred'
  | 'loading'
  | 'resolved'
  | 'failed';

export interface GeneratedImageResult {
  url: string | null;
  status: GeneratedImageStatus;
}

interface HookOptions {
  skip?: boolean;
  description?: string | null;
  ingredients?: ParsedIngredient[] | null;
  /**
   * Saved recipe id forwarded to the server so the resolved URL is persisted
   * back to recipes.image_url (Plan 27-01). Omit/undefined for unsaved
   * previews — they stay AsyncStorage-only.
   */
  recipeId?: string | null;
  /**
   * Viewport gate (Something New lazy-load polish). Default true. When false,
   * the hook does NOT acquire a concurrency slot or fire /generate-image — it
   * reports status 'deferred' so the card can render a shimmer placeholder
   * instead of a blank/fallback image.
   *
   * Crucially, this gate is "sticky" with respect to work that has already
   * started: if a cache entry already exists for the key (in-flight, resolved,
   * or attempted+failed), the hook surfaces that real state regardless of
   * `enabled` — flipping enabled back to false after generation started never
   * cancels or re-defers it. This relies on the module-level cache to record
   * "already attempted", so scrolling a card off-screen and back never
   * re-generates.
   */
  enabled?: boolean;
  /**
   * Top-first ordering hint for the concurrency limiter. Lower number = higher
   * priority = served first when a slot frees. Something New passes each card's
   * list index here so the TOP card always generates before lower ones, even
   * though all visible cards fire their effect at roughly the same time.
   * Defaults to the lowest priority (Number.MAX_SAFE_INTEGER) so unprioritized
   * callers keep their previous best-effort FIFO-ish behavior.
   */
  priority?: number;
}

export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options: HookOptions = {},
): GeneratedImageResult {
  const {
    skip,
    description,
    ingredients,
    recipeId,
    enabled = true,
    priority,
  } = options;

  // Derive initial state from the in-memory cache synchronously (even if
  // module-level hydration hasn't completed — we still read whatever is in
  // the Map). Hydration runs on module load and flips the evaluate() branch
  // below from queued to immediate.
  const initialEntry =
    !title || skip ? null : cache.get(cacheKeyFor(title, ingredients)) ?? null;

  const [result, setResult] = useState<GeneratedImageResult>(() => {
    if (!title || skip) return { url: null, status: 'resolved' };
    // A pre-existing cache entry wins over the viewport gate: work already
    // started/resolved for this key, so surface its real state (never re-defer).
    if (initialEntry?.url) return { url: initialEntry.url, status: 'resolved' };
    if (initialEntry?.attempted && !initialEntry.url)
      return { url: null, status: 'failed' };
    if (initialEntry?.inflight) return { url: null, status: 'loading' };
    // No work yet AND viewport-gated → deferred (card shows shimmer, no fetch).
    if (!enabled) return { url: null, status: 'deferred' };
    return { url: null, status: 'loading' };
  });

  // Serialize the ingredient identity into a stable string so the effect
  // dep array changes only when the fingerprint actually changes.
  const ingredientFp = fingerprintIngredients(ingredients);

  useEffect(() => {
    if (!title || skip) {
      setResult({ url: null, status: 'resolved' });
      return;
    }

    let cancelled = false;
    // Phase 28 (T3): mount→visible clock for per-image time-to-visible.
    const mountedAt = Date.now();

    const evaluate = () => {
      if (cancelled) return;
      const key = cacheKeyFor(title, ingredients);
      const hit = cache.get(key);

      if (hit?.url) {
        emitImageEvent('cache_hit', mountedAt, true);
        setResult({ url: hit.url, status: 'resolved' });
        return;
      }
      if (hit?.attempted && !hit.url) {
        setResult({ url: null, status: 'failed' });
        return;
      }
      if (hit?.inflight) {
        setResult({ url: null, status: 'loading' });
        hit.inflight.then((u) => {
          emitImageEvent('cold_gen', mountedAt, u != null);
          if (cancelled) return;
          if (u) setResult({ url: u, status: 'resolved' });
          else setResult({ url: null, status: 'failed' });
        });
        return;
      }

      // No cache entry yet. If this card is viewport-gated (not enabled), stay
      // deferred — do NOT acquire a concurrency slot or fire /generate-image.
      // When the card scrolls into view, `enabled` flips true, the effect
      // re-runs, and we fall through to the fetch branch below. Because the
      // first started fetch writes a cache entry, scrolling away/back can never
      // re-trigger generation (the hit?.inflight / hit?.attempted branches win).
      if (!enabled) {
        setResult({ url: null, status: 'deferred' });
        return;
      }

      // No entry — kick off fetch (throttled to MAX_CONCURRENT in-flight)
      setResult({ url: null, status: 'loading' });
      const inflight = fetchGeneratedUrlThrottled(
        {
          title,
          description: description ?? null,
          ingredients: ingredients ?? null,
          recipeId: recipeId ?? null,
        },
        priority ?? DEFAULT_PRIORITY,
      );
      cache.set(key, { url: null, inflight, attempted: false });
      inflight.then((u) => {
        cache.set(key, { url: u, inflight: null, attempted: true });
        if (u !== null) persistToStorage();
        // mount→resolve ms encompasses queue wait + Gemini gen — single event
        // per resolution, no double-count.
        emitImageEvent('cold_gen', mountedAt, u != null);
        if (cancelled) return;
        if (u) setResult({ url: u, status: 'resolved' });
        else setResult({ url: null, status: 'failed' });
      });
    };

    if (hydrated) {
      evaluate();
    } else {
      // Queue evaluation until hydration completes — avoids firing an HTTP
      // request for a title that's about to be found in AsyncStorage.
      const listener = () => evaluate();
      hydrationListeners.add(listener);
      return () => {
        cancelled = true;
        hydrationListeners.delete(listener);
      };
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, skip, ingredientFp, description, enabled, priority]);

  return result;
}

/**
 * Fire-and-forget prefetch — call this BEFORE the consuming card mounts so
 * the Gemini round-trip is in flight by the time `useGeneratedRecipeImage`
 * runs. The hook's session cache holds the inflight promise, so the card's
 * effect picks it up on first render rather than starting a fresh request.
 *
 * Use case: in RemixSheet, kick this off the moment variations resolve so
 * the existing "Brewing ideas..." spinner overlaps the image generation.
 * No-op when title is empty or already cached.
 */
export function prefetchGeneratedRecipeImage(
  title: string | null | undefined,
  options: HookOptions = {},
): void {
  const { skip, description, ingredients, recipeId, priority } = options;
  if (!title || skip) return;
  const key = cacheKeyFor(title, ingredients);
  // Already in cache (resolved, in-flight, or attempted+failed) — no-op.
  if (cache.has(key)) return;
  const inflight = fetchGeneratedUrlThrottled(
    {
      title,
      description: description ?? null,
      ingredients: ingredients ?? null,
      recipeId: recipeId ?? null,
    },
    priority ?? DEFAULT_PRIORITY,
  );
  cache.set(key, { url: null, inflight, attempted: false });
  inflight.then((u) => {
    cache.set(key, { url: u, inflight: null, attempted: true });
    if (u !== null) persistToStorage();
  });
}
