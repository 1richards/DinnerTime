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
import type { ParsedIngredient } from '../types/recipe';

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

export type GeneratedImageStatus = 'loading' | 'resolved' | 'failed';

export interface GeneratedImageResult {
  url: string | null;
  status: GeneratedImageStatus;
}

interface HookOptions {
  skip?: boolean;
  description?: string | null;
  ingredients?: ParsedIngredient[] | null;
}

export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options: HookOptions = {},
): GeneratedImageResult {
  const { skip, description, ingredients } = options;

  // Derive initial state from the in-memory cache synchronously (even if
  // module-level hydration hasn't completed — we still read whatever is in
  // the Map). Hydration runs on module load and flips the evaluate() branch
  // below from queued to immediate.
  const initialEntry =
    !title || skip ? null : cache.get(cacheKeyFor(title, ingredients)) ?? null;

  const [result, setResult] = useState<GeneratedImageResult>(() => {
    if (!title || skip) return { url: null, status: 'resolved' };
    if (initialEntry?.url) return { url: initialEntry.url, status: 'resolved' };
    if (initialEntry?.attempted && !initialEntry.url)
      return { url: null, status: 'failed' };
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

    const evaluate = () => {
      if (cancelled) return;
      const key = cacheKeyFor(title, ingredients);
      const hit = cache.get(key);

      if (hit?.url) {
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
          if (cancelled) return;
          if (u) setResult({ url: u, status: 'resolved' });
          else setResult({ url: null, status: 'failed' });
        });
        return;
      }

      // No entry — kick off fetch
      setResult({ url: null, status: 'loading' });
      const inflight = fetchGeneratedUrl({
        title,
        description: description ?? null,
        ingredients: ingredients ?? null,
      });
      cache.set(key, { url: null, inflight, attempted: false });
      inflight.then((u) => {
        cache.set(key, { url: u, inflight: null, attempted: true });
        if (u !== null) persistToStorage();
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
  }, [title, skip, ingredientFp, description]);

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
  const { skip, description, ingredients } = options;
  if (!title || skip) return;
  const key = cacheKeyFor(title, ingredients);
  // Already in cache (resolved, in-flight, or attempted+failed) — no-op.
  if (cache.has(key)) return;
  const inflight = fetchGeneratedUrl({
    title,
    description: description ?? null,
    ingredients: ingredients ?? null,
  });
  cache.set(key, { url: null, inflight, attempted: false });
  inflight.then((u) => {
    cache.set(key, { url: u, inflight: null, attempted: true });
    if (u !== null) persistToStorage();
  });
}
