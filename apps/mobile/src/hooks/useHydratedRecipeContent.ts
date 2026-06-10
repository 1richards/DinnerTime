/**
 * useHydratedRecipeContent — fire-and-forget background content hydration.
 *
 * Phase 29 (D4) "Something New" lightweight-first: `/recipes/search` returns
 * LIGHT previews fast (title + description + times + difficulty + nutrition +
 * bare `ingredient_names`) so cards render in 3-5s. The full
 * `{ ingredients, steps }` fill in afterward via a background POST to
 * `/api/v1/recipes/hydrate` (Plan 29-02). This hook mirrors
 * `useGeneratedRecipeImage.ts` EXACTLY — module-level Map cache, the
 * MAX_CONCURRENT=2 FIFO limiter, AsyncStorage persistence, inflight
 * coalescing — only the payload differs (content instead of an image URL).
 *
 * Return shape: `{ ingredients, steps, status }` where status is one of:
 *   - 'loading'  — no cached entry yet (or inflight) and we haven't given up
 *   - 'resolved' — content fetched (ingredients/steps populated)
 *   - 'failed'   — a completed fetch returned null; do NOT retry this session
 *
 * Cost control: dedupe by normalized title + sorted ingredient-name
 * fingerprint across the whole session (matches the server's content-address
 * key). Two cards for the same preview share one fetch. Resolved entries are
 * persisted to AsyncStorage so previously-hydrated previews render instantly
 * on next session (and self-heal persisted-but-empty previews — D7). Failed
 * attempts are NOT persisted, so the user gets a fresh chance next launch.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logAiEvent, sanitizePayload } from '../ai/telemetry';
import type { ParsedIngredient, ParsedRecipe } from '../types/recipe';

/**
 * Phase 29 (D8-client): emit per-preview time-to-hydrate (fetch start →
 * resolve) so we get real client-side p50/p95 for background content fill.
 * `ms` + `success` are the only payload keys (both whitelisted); NO
 * titles/ingredients (PII guard).
 */
function emitHydrationEvent(startedAt: number, success: boolean): void {
  logAiEvent({
    name: 'recipe.hydrate.visible',
    session_id: 'something-new', // coarse session bucket; no PII
    task_name: 'recipe.hydrate',
    model: 'gemini-flash',
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

/** Light preview shape the hook hydrates into full content. */
export interface HydratePreview {
  title: string;
  description?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  total_time_minutes?: number | null;
  cuisine?: string | null;
  ingredient_names?: string[] | null;
}

/**
 * Phase 29 (D4/D5): map a (possibly light) searchResult ParsedRecipe to the
 * HydratePreview input the hydration hook / `prefetchHydration` POSTs to
 * `/recipes/hydrate`. Light previews carry no full `ingredients[]` — names live
 * on an attached `ingredient_names` field (set by the 29-01 light /search), so
 * prefer that; fall back to mapping any structured ingredients for non-light
 * rows.
 *
 * Exported as the SINGLE source of truth so every save surface (suggestionsStore
 * background hydration, SomethingNewResults card handlers, kitchen.tsx
 * PreviewSheet handlers) maps a recipe identically — the await-hydration gate in
 * Plan 29-04 depends on the same cache key resolving across all of them.
 */
export function previewFrom(r: ParsedRecipe): HydratePreview {
  const names =
    (r as { ingredient_names?: string[] | null }).ingredient_names ??
    (r.ingredients?.length
      ? r.ingredients.map((i) => i.name).filter(Boolean)
      : null);
  return {
    title: r.title,
    description: r.description,
    difficulty: r.difficulty ?? null,
    prep_time_minutes: r.prep_time_minutes,
    cook_time_minutes: r.cook_time_minutes,
    total_time_minutes: r.total_time_minutes,
    cuisine: (r as { cuisine?: string | null }).cuisine ?? null,
    ingredient_names: names,
  };
}

/** The resolved content patched onto a light preview. */
export interface HydratedContent {
  ingredients: ParsedIngredient[];
  steps: string[];
  calories_per_serving?: number | null;
  protein_grams_per_serving?: number | null;
  servings?: number | null;
}

type Entry = {
  content: HydratedContent | null;
  inflight: Promise<HydratedContent | null> | null;
  attempted: boolean;
};
const cache = new Map<string, Entry>();

// ---------- Concurrency limiter ----------
//
// Caps simultaneous hydrate HTTP requests at MAX_CONCURRENT. Without this,
// background-hydrating a full grid of previews fires N concurrent Gemini
// parseText calls that saturate the server and starve the /search call the
// grid depends on. FIFO so the first (top, visible) cards hydrate first.
// Resolved/cached results bypass the limiter entirely.

export const MAX_CONCURRENT = 2;
let _inFlight = 0;
const _waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (_inFlight < MAX_CONCURRENT) {
    _inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    _waitQueue.push(resolve);
  });
}

function releaseSlot(): void {
  const next = _waitQueue.shift();
  if (next) {
    // Hand the slot to the next waiter directly — don't decrement then
    // re-increment, keeps the in-flight count stable.
    next();
  } else {
    _inFlight--;
  }
}

async function fetchHydratedThrottled(
  preview: HydratePreview,
): Promise<HydratedContent | null> {
  await acquireSlot();
  try {
    return await fetchHydrated(preview);
  } finally {
    releaseSlot();
  }
}

function norm(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Session cache key mirroring the server's content-address key (Plan 29-02 =
 * sha256(title|total_time|sorted ingredient_names)). We don't need the exact
 * hash — only that the same preview always collides into one cache slot.
 */
function fingerprintNames(names: string[] | null | undefined): string {
  if (!names || names.length === 0) return '';
  return names
    .map((n) => (n ?? '').trim().toLowerCase())
    .filter((n) => n.length > 0)
    .sort()
    .join('|');
}

/**
 * Stable content-address identity for a preview = `title#fingerprint(names)`.
 * Exported so the store can patch the SAME searchResults row the hook hydrated
 * (two previews sharing a title but with different ingredient_names resolve to
 * DIFFERENT content and must not cross-assign — WR-01).
 */
export function cacheKeyFor(preview: HydratePreview): string {
  const fp = fingerprintNames(preview.ingredient_names);
  return fp ? `${norm(preview.title)}#${fp}` : norm(preview.title);
}

async function fetchHydrated(
  preview: HydratePreview,
): Promise<HydratedContent | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    const res = await fetch(`${getApiBaseUrl()}/api/v1/recipes/hydrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: preview.title,
        description: preview.description ?? null,
        difficulty: preview.difficulty ?? null,
        prep_time_minutes: preview.prep_time_minutes ?? null,
        cook_time_minutes: preview.cook_time_minutes ?? null,
        total_time_minutes: preview.total_time_minutes ?? null,
        cuisine: preview.cuisine ?? null,
        ingredient_names: preview.ingredient_names ?? null,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: HydratedContent | null };
    const data = body?.data ?? null;
    if (!data || !Array.isArray(data.ingredients) || !Array.isArray(data.steps)) {
      return null;
    }
    return {
      ingredients: data.ingredients,
      steps: data.steps,
      calories_per_serving: data.calories_per_serving ?? null,
      protein_grams_per_serving: data.protein_grams_per_serving ?? null,
      servings: data.servings ?? null,
    };
  } catch {
    return null;
  }
}

// ---------- AsyncStorage persistence ----------

const STORAGE_KEY = 'dinnertime-hydration-cache';
let hydrated = false;
// Listeners notified once hydration finishes so mounted hooks can re-evaluate.
const hydrationListeners = new Set<() => void>();

async function hydrateFromStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<
        string,
        { content: HydratedContent }
      >;
      for (const [key, val] of Object.entries(parsed)) {
        // Only merge if not already populated (in-flight fetch wins over disk).
        if (!cache.has(key) && val && val.content) {
          cache.set(key, {
            content: val.content,
            inflight: null,
            attempted: true,
          });
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
  // Fire-and-forget; only persist resolved (non-null content) entries. Failed
  // (null) attempts are intentionally dropped so retry on next session is
  // possible (mirror the image hook).
  const serializable: Record<string, { content: HydratedContent }> = {};
  for (const [key, entry] of cache.entries()) {
    if (entry.content !== null) {
      serializable[key] = { content: entry.content };
    }
  }
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializable)).catch(() => {
    // Persistence is non-critical
  });
}

// ---------- Hook ----------

export type HydrationStatus = 'loading' | 'resolved' | 'failed';

export interface HydratedContentResult {
  ingredients: ParsedIngredient[];
  steps: string[];
  status: HydrationStatus;
}

const EMPTY_INGREDIENTS: ParsedIngredient[] = [];
const EMPTY_STEPS: string[] = [];

export function useHydratedRecipeContent(
  preview: HydratePreview | null | undefined,
): HydratedContentResult {
  // Derive initial state from the in-memory cache synchronously (even if
  // module-level hydration hasn't completed — we still read whatever is in
  // the Map). Hydration runs on module load and flips the evaluate() branch
  // below from queued to immediate.
  const initialEntry =
    !preview || !preview.title ? null : cache.get(cacheKeyFor(preview)) ?? null;

  const [result, setResult] = useState<HydratedContentResult>(() => {
    if (!preview || !preview.title)
      return { ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'resolved' };
    if (initialEntry?.content)
      return {
        ingredients: initialEntry.content.ingredients,
        steps: initialEntry.content.steps,
        status: 'resolved',
      };
    if (initialEntry?.attempted && !initialEntry.content)
      return { ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'failed' };
    return { ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'loading' };
  });

  // Stable identity for the effect dep array — only re-run when the preview's
  // cache key actually changes.
  const key = !preview || !preview.title ? '' : cacheKeyFor(preview);

  useEffect(() => {
    if (!preview || !preview.title) {
      setResult({ ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'resolved' });
      return;
    }

    let cancelled = false;
    // D8-client: fetch-start → resolve clock for per-preview time-to-hydrate.
    const startedAt = Date.now();

    const evaluate = () => {
      if (cancelled) return;
      const k = cacheKeyFor(preview);
      const hit = cache.get(k);

      if (hit?.content) {
        setResult({
          ingredients: hit.content.ingredients,
          steps: hit.content.steps,
          status: 'resolved',
        });
        return;
      }
      if (hit?.attempted && !hit.content) {
        setResult({ ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'failed' });
        return;
      }
      if (hit?.inflight) {
        setResult({ ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'loading' });
        hit.inflight.then((c) => {
          emitHydrationEvent(startedAt, c != null);
          if (cancelled) return;
          if (c)
            setResult({ ingredients: c.ingredients, steps: c.steps, status: 'resolved' });
          else
            setResult({ ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'failed' });
        });
        return;
      }

      // No entry — kick off fetch (throttled to MAX_CONCURRENT in-flight)
      setResult({ ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'loading' });
      const inflight = fetchHydratedThrottled(preview);
      cache.set(k, { content: null, inflight, attempted: false });
      inflight.then((c) => {
        cache.set(k, { content: c, inflight: null, attempted: true });
        if (c !== null) persistToStorage();
        emitHydrationEvent(startedAt, c != null);
        if (cancelled) return;
        if (c)
          setResult({ ingredients: c.ingredients, steps: c.steps, status: 'resolved' });
        else
          setResult({ ingredients: EMPTY_INGREDIENTS, steps: EMPTY_STEPS, status: 'failed' });
      });
    };

    if (hydrated) {
      evaluate();
    } else {
      // Queue evaluation until storage hydration completes — avoids firing an
      // HTTP request for a preview that's about to be found in AsyncStorage.
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
  }, [key]);

  return result;
}

/**
 * Fire-and-forget prefetch + per-index patching seam. Returns the inflight
 * promise resolving to the hydrated content (or null on failure) so the store
 * can await per-card and patch `searchResults[i]` as each lands. No-op-cached:
 * if the preview is already resolved/inflight/failed in the session cache, the
 * existing entry is reused (coalescing) rather than firing a new fetch.
 *
 * Mirrors prefetchGeneratedRecipeImage, with the addition of a return value
 * (the image prefetch is void; here the store needs the result to patch).
 */
export function prefetchHydration(
  preview: HydratePreview | null | undefined,
): Promise<HydratedContent | null> {
  if (!preview || !preview.title) return Promise.resolve(null);
  const key = cacheKeyFor(preview);
  const existing = cache.get(key);
  if (existing) {
    // Resolved or already-attempted (failed) — no-op, return what we have.
    if (existing.inflight) return existing.inflight;
    return Promise.resolve(existing.content);
  }
  const startedAt = Date.now();
  const inflight = fetchHydratedThrottled(preview);
  cache.set(key, { content: null, inflight, attempted: false });
  return inflight.then((c) => {
    cache.set(key, { content: c, inflight: null, attempted: true });
    if (c !== null) persistToStorage();
    emitHydrationEvent(startedAt, c != null);
    return c;
  });
}

/**
 * Synchronous status read (no subscription) — used by the store and Plan
 * 29-04's Save/Cook gating. Returns 'idle' when the preview has never been
 * seen (no cache entry).
 */
export function hydrationStatusFor(
  preview: HydratePreview | null | undefined,
): HydrationStatus | 'idle' {
  if (!preview || !preview.title) return 'idle';
  const hit = cache.get(cacheKeyFor(preview));
  if (!hit) return 'idle';
  if (hit.content) return 'resolved';
  if (hit.attempted && !hit.content) return 'failed';
  return 'loading';
}

/**
 * Test-only: clear the module cache + reset the limiter so each test starts
 * from a clean slate. NOT for production use.
 */
export function __resetHydrationCacheForTests(): void {
  cache.clear();
  _inFlight = 0;
  _waitQueue.length = 0;
}
