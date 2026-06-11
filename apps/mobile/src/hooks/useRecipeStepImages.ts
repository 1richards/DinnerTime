/**
 * useRecipeStepImages — lazily fetch a recipe's preparation-step photos.
 *
 * The detail page shows a single finished-dish hero by default. When the user
 * opens a recipe (a signal of real interest) this hook ensures a couple of
 * preparation-step images exist: if the recipe already has `step_image_urls`
 * it returns them immediately; otherwise it fires a one-shot background POST
 * to `/api/v1/recipes/:id/step-images`, which generates + persists them
 * server-side, then merges the returned URLs into local recipe state so the
 * slider fills in without a reload.
 *
 * Fire-and-forget and non-blocking: the hero renders instantly regardless.
 * Generation is deduped per recipe id across the session (module-level set)
 * so re-mounts and the React strict double-invoke don't double-spend.
 *
 * Returns `{ urls, loading }`: `loading` is true ONLY while a background
 * generation POST is in flight for a recipe that had no persisted step images
 * — so the detail/preview UI can show a "Generating step photos…" indicator.
 * It's false when images already exist (instant) or after generation settles.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRecipeStore } from '../stores/recipeStore';
import type { Recipe } from '../types/recipe';

export interface RecipeStepImagesResult {
  urls: string[];
  /** True while a background generation request is in flight (no persisted
      images yet). Drives the "Generating step photos…" indicator. */
  loading: boolean;
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

// Recipe ids whose generation has already been kicked off this session.
// Prevents duplicate POSTs from re-mounts / repeated opens.
const requested = new Set<string>();

export function useRecipeStepImages(
  recipe: Recipe | undefined,
): RecipeStepImagesResult {
  const stored = recipe?.step_image_urls ?? [];
  const [urls, setUrls] = useState<string[]>(stored);
  const [loading, setLoading] = useState(false);
  const mergeRecipeLocal = useRecipeStore((s) => s.mergeRecipeLocal);

  const id = recipe?.id;
  // Re-sync when the recipe (or its stored images) changes underneath us.
  const storedKey = stored.join('|');

  useEffect(() => {
    if (!id) return;

    // Already have persisted images — use them, nothing to generate.
    if (stored.length > 0) {
      setUrls(stored);
      setLoading(false);
      return;
    }

    // No steps to illustrate, or already requested this session — skip.
    if (!recipe || (recipe.steps?.length ?? 0) === 0) return;
    if (requested.has(id)) return;
    requested.add(id);

    let cancelled = false;
    // Surface the background-generation indicator the moment we kick off the
    // POST (recipe content already rendered — this is non-blocking).
    setLoading(true);
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          requested.delete(id); // allow a retry once authed
          if (!cancelled) setLoading(false);
          return;
        }
        const res = await fetch(
          `${getApiBaseUrl()}/api/v1/recipes/${id}/step-images`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!res.ok) {
          requested.delete(id); // transient failure — let a later open retry
          if (!cancelled) setLoading(false);
          return;
        }
        const body = (await res.json()) as { step_image_urls?: string[] };
        const next = Array.isArray(body.step_image_urls)
          ? body.step_image_urls.filter((u) => typeof u === 'string' && u)
          : [];
        if (next.length === 0) {
          // Model produced nothing this time — drop the guard so opening the
          // recipe again can try once more.
          requested.delete(id);
          if (!cancelled) setLoading(false);
          return;
        }
        if (!cancelled) {
          setUrls(next);
          setLoading(false);
        }
        // Persist into local store so navigating away + back is instant.
        mergeRecipeLocal(id, { step_image_urls: next });
      } catch {
        requested.delete(id);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, storedKey]);

  return { urls, loading };
}
