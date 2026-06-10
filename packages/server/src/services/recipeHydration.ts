/**
 * recipeHydration — Phase 29 Plan 02 (D3).
 *
 * The "Something New" flow (29-01) now returns LIGHTWEIGHT recipe previews fast
 * (title + times + nutrition + bare ingredient_names, NO full ingredients[]/steps[]).
 * This service is the background-fill engine the client (29-03) calls per-preview,
 * throttled 2-at-a-time, to fill in the heavy content after the card renders.
 *
 * It REUSES the proven single-call full-recipe primitive rather than inventing a
 * new AI surface: `applyRemixVariation` (recipeParser.ts) already does "title +
 * light context → full ParsedRecipe with ingredients+steps+nutrition" via ONE
 * `callAIParseRecipeText('recipe.parseText', ...)` call (gemini flash), then
 * `toolOutputToRecipe(input, 'ai')`. `hydrateRecipePreview` is modeled on it.
 *
 * The result is content-address cached + inflight-coalesced (mirroring
 * discoveryCache.ts) so re-hydrating the SAME preview within the TTL is free —
 * hydration is deterministic-ish and a repeat round-trip is pure waste.
 */
import { createHash } from 'node:crypto';
import {
  callAIParseRecipeText,
  toolOutputToRecipe,
  type ParsedRecipe,
} from './recipeParser.js';

/**
 * TTL for a cached hydration. 30 min — longer than discoveryCache's 12 min:
 * a preview's full content doesn't change, and the client may re-hydrate the
 * same on-screen card across persistence/relaunch (D7).
 */
export const HYDRATION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Soft cap on cached entries; oldest insertion evicted on overflow. */
const MAX_ENTRIES = 200;

export interface HydratePreviewInput {
  title: string;
  description?: string | null;
  difficulty?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  total_time_minutes?: number | null;
  cuisine?: string | null;
  /** Bare ingredient names from the light preview (D1a) — expanded to full
      quantities during hydration. Optional: a preview may carry none. */
  ingredient_names?: string[];
}

interface CacheEntry {
  value: ParsedRecipe;
  expiresAt: number;
}

// Module-scoped stores. Insertion-ordered Map gives a cheap LRU (delete+re-set
// on hit moves the entry to the tail), matching discoveryCache.
const responseCache = new Map<string, CacheEntry>();
const inflightMap = new Map<string, Promise<ParsedRecipe>>();

/**
 * Content-address key from the fields that determine the hydration output:
 * title + total time + the (sorted) known ingredient names. Sorting makes the
 * key order-insensitive on ingredient_names so the same preview always collides.
 */
function hydrationCacheKey(preview: HydratePreviewInput): string {
  const title = (preview.title ?? '').trim().toLowerCase();
  const time = preview.total_time_minutes ?? 'def';
  const names = [...(preview.ingredient_names ?? [])]
    .map((n) => n.trim().toLowerCase())
    .sort()
    .join('|');
  const composite = `${title}::${time}::${names}`;
  return createHash('sha256').update(composite).digest('hex');
}

/** TTL-checked, LRU-touch lookup. Returns the cached value or null. */
function lookup(key: string, now: number): ParsedRecipe | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
}

/** Insert with soft size-cap eviction of the oldest (head) entry. */
function store(key: string, value: ParsedRecipe, expiresAt: number): void {
  if (responseCache.has(key)) responseCache.delete(key);
  responseCache.set(key, { value, expiresAt });
  while (responseCache.size > MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
}

/**
 * Build the hydration prompt. Mirrors `applyRemixVariation`'s wording: seed the
 * model with the preview's title + description + total time + the known
 * ingredient names, then ask for the COMPLETE recipe with the SAME nutrition
 * instruction block so calories/protein come back populated.
 */
function buildHydrationPrompt(preview: HydratePreviewInput): string {
  const namesBlock =
    preview.ingredient_names && preview.ingredient_names.length > 0
      ? preview.ingredient_names.map((n) => `- ${n}`).join('\n')
      : '(none provided — infer a sensible ingredient list from the title)';

  return `Produce the COMPLETE recipe for the preview below.

Title: ${preview.title}
${preview.description ? `Description: ${preview.description}` : ''}
${preview.cuisine ? `Cuisine: ${preview.cuisine}` : ''}
${preview.difficulty ? `Difficulty: ${preview.difficulty}` : ''}
${preview.total_time_minutes ? `Total time: ${preview.total_time_minutes} minutes` : ''}

Known ingredients (expand to full quantities):
${namesBlock}

Produce the COMPLETE recipe — full structured ingredients (name, quantity, unit, notes), ordered steps, and servings >= 4. Stay faithful to the title and known ingredients above so it matches the card the user saw. Convert fractions to decimals for quantities.

Populate calories_per_serving (integer kcal, ~300-900 typical, round to nearest 10) AND protein_grams_per_serving (integer or 1-decimal grams) from the ingredients + serving math. Use chicken ~25g protein/100g, beef ~26g/100g, fish ~22g/100g, eggs ~6g each, tofu ~8g/100g, beans ~7g/100g cooked. Don't omit — best estimate.`;
}

/**
 * Hydrate a lightweight preview into a full ParsedRecipe (non-empty ingredients
 * + steps + nutrition) via ONE `recipe.parseText` call. Content-address cached
 * and inflight-coalesced: a repeat call with the same preview within the TTL
 * returns the cached result and does NOT re-invoke the AI.
 *
 * @param opts.nowMs  Injectable clock for deterministic TTL tests.
 */
export async function hydrateRecipePreview(
  preview: HydratePreviewInput,
  opts?: { nowMs?: number },
): Promise<ParsedRecipe> {
  const now = opts?.nowMs ?? Date.now();
  const key = hydrationCacheKey(preview);

  const hit = lookup(key, now);
  if (hit) return hit;
  const inflight = inflightMap.get(key);
  if (inflight) return inflight; // coalesce concurrent identical calls

  const promise = (async () => {
    const input = await callAIParseRecipeText('recipe.parseText', buildHydrationPrompt(preview));
    return toolOutputToRecipe(input, 'ai');
  })();

  inflightMap.set(key, promise);
  try {
    const result = await promise;
    store(key, result, now + HYDRATION_CACHE_TTL_MS);
    return result;
  } finally {
    inflightMap.delete(key);
  }
}

/** Test-only — clear both stores so suites don't leak cached state. */
export function __resetHydrationCache(): void {
  responseCache.clear();
  inflightMap.clear();
}
