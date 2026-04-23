/**
 * useGeneratedRecipeImage — fire-and-forget server-side image generation.
 *
 * When a suggestion or search result has no `image_url` (common for AI-
 * generated recipes from Phase 17 Something New), the keyword-matched stock
 * photo only loosely relates to the dish. This hook kicks off a background
 * POST to `/api/v1/recipes/generate-image` which calls Gemini 2.5 Flash
 * Image (nano banana) and returns a cached Supabase Storage URL.
 *
 * Semantics:
 *   - Returns null while loading (or if title is empty, or if the server
 *     returns null).
 *   - Same title + ingredient fingerprint on a second render returns the
 *     cached URL from the shared in-memory map immediately (no HTTP trip).
 *   - Never throws. Always safe to chain with `?? fallbackHeroUri`.
 *
 * Cost control: we dedupe by normalized title + ingredient fingerprint
 * across the whole session. Two cards for the same recipe share one fetch.
 * The server additionally caches in Storage so popular dishes are free
 * across sessions. Description + ingredients are forwarded to the server
 * so Gemini can produce a prompt that matches the *specific* dish rather
 * than a generic rendering of the title alone.
 */
import { useEffect, useState } from 'react';
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

type Entry = { url: string | null; inflight: Promise<string | null> | null };
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

interface HookOptions {
  skip?: boolean;
  description?: string | null;
  ingredients?: ParsedIngredient[] | null;
}

export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options: HookOptions = {},
): string | null {
  const { skip, description, ingredients } = options;
  const [url, setUrl] = useState<string | null>(() => {
    if (!title || skip) return null;
    return cache.get(cacheKeyFor(title, ingredients))?.url ?? null;
  });

  // Serialize the ingredient identity into a stable string so the effect
  // dep array changes only when the fingerprint actually changes.
  const ingredientFp = fingerprintIngredients(ingredients);

  useEffect(() => {
    if (!title || skip) return;
    const key = cacheKeyFor(title, ingredients);
    const hit = cache.get(key);
    if (hit?.url) {
      if (hit.url !== url) setUrl(hit.url);
      return;
    }
    if (hit?.inflight) {
      let cancelled = false;
      hit.inflight.then((u) => {
        if (!cancelled && u) setUrl(u);
      });
      return () => {
        cancelled = true;
      };
    }
    const inflight = fetchGeneratedUrl({
      title,
      description: description ?? null,
      ingredients: ingredients ?? null,
    });
    cache.set(key, { url: null, inflight });
    let cancelled = false;
    inflight.then((u) => {
      cache.set(key, { url: u, inflight: null });
      if (!cancelled && u) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, skip, ingredientFp, description, url]);

  return url;
}
