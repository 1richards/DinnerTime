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
 *   - Same title on a second render returns the cached URL from the shared
 *     in-memory map immediately (no HTTP round-trip).
 *   - Never throws. Always safe to chain with `?? fallbackHeroUri`.
 *
 * Cost control: we dedupe by normalized title across the whole session.
 * Two cards showing "Chicken Tikka Masala" share one fetch. Server
 * additionally caches in Storage so popular dishes are free across sessions.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

async function fetchGeneratedUrl(title: string): Promise<string | null> {
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
        body: JSON.stringify({ title }),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: string | null };
    return body?.url ?? null;
  } catch {
    return null;
  }
}

export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options: { skip?: boolean } = {},
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!title || options.skip) return null;
    return cache.get(norm(title))?.url ?? null;
  });

  useEffect(() => {
    if (!title || options.skip) return;
    const key = norm(title);
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
    const inflight = fetchGeneratedUrl(title);
    cache.set(key, { url: null, inflight });
    let cancelled = false;
    inflight.then((u) => {
      cache.set(key, { url: u, inflight: null });
      if (!cancelled && u) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [title, options.skip, url]);

  return url;
}
