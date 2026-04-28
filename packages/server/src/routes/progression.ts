import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  computeComplexity,
  generateVariationsForContext,
  getCookStats,
  getRecipeVariations,
  rankAmbition,
} from '../services/progression.js';
import type { AmbitionRankRequest } from '../types/progression.js';

const progression = new Hono();

progression.use('*', authMiddleware);

/**
 * GET /cook-stats — aggregated per-recipe cook stats for the profile.
 */
progression.get('/cook-stats', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  try {
    const stats = await getCookStats(supabase, user.id);
    return c.json({ data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch cook stats';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /suggestions — 3 ambition recipes ranked by Claude Sonnet against
 * the user's cook history and recipe library.
 */
progression.get('/suggestions', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  try {
    // 1. Cook stats become "history"
    const stats = await getCookStats(supabase, user.id);
    const cookedIds = new Set(stats.map((s) => s.recipe_id));

    // 2. Pull library (cap 100 -- mirrors meal-plans pattern)
    const { data: recipeRows, error: recipesError } = await supabase
      .from('recipes')
      .select('id, title, steps, ingredients, total_time_minutes')
      .eq('profile_id', user.id)
      .limit(100);

    if (recipesError) {
      return c.json({ error: recipesError.message }, 500);
    }

    type LibraryRow = {
      id: string;
      title: string;
      steps: unknown[] | null;
      ingredients: unknown[] | null;
      total_time_minutes: number | null;
    };
    const libraryRows = (recipeRows ?? []) as LibraryRow[];

    // History: complexity from library row when available; cook_count from stats
    const libraryById = new Map(libraryRows.map((r) => [r.id, r]));
    const history: AmbitionRankRequest['history'] = stats.map((s) => {
      const row = libraryById.get(s.recipe_id);
      const complexity = row
        ? computeComplexity({
            steps: row.steps ?? [],
            ingredients: row.ingredients ?? [],
            total_time_minutes: row.total_time_minutes,
          })
        : 0;
      return {
        recipe_id: s.recipe_id,
        title: s.title,
        complexity,
        cook_count: s.cook_count,
      };
    });

    // Candidates = library minus already-cooked recipes
    const candidates: AmbitionRankRequest['candidates'] = libraryRows
      .filter((r) => !cookedIds.has(r.id))
      .map((r) => ({
        recipe_id: r.id,
        title: r.title,
        complexity: computeComplexity({
          steps: r.steps ?? [],
          ingredients: r.ingredients ?? [],
          total_time_minutes: r.total_time_minutes,
        }),
      }));

    const suggestions = await rankAmbition({ history, candidates });
    return c.json({ data: suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch suggestions';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /variations/:recipeId — 3 creative variations for a recipe.
 * Always available (no cook-count gate). Optional `?mode=surprise|protein|
 * veggies|quicker|healthier` steers the kind of remix produced. Returns 404
 * if the recipe isn't owned by the profile.
 */
const VALID_MODES = ['surprise', 'protein', 'veggies', 'quicker', 'healthier'] as const;
type RemixMode = (typeof VALID_MODES)[number];

progression.get('/variations/:recipeId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const recipeId = c.req.param('recipeId');
  const modeParam = c.req.query('mode');
  const mode: RemixMode = (VALID_MODES as readonly string[]).includes(modeParam ?? '')
    ? (modeParam as RemixMode)
    : 'surprise';
  // Free-form steering forwarded by the mobile remix sheet. Capped server-side
  // to bound prompt size.
  const customInstructions = (c.req.query('custom') ?? '').slice(0, 500);

  try {
    const variations = await getRecipeVariations(
      supabase,
      user.id,
      recipeId,
      mode,
      customInstructions || undefined,
    );
    return c.json({ data: variations, mode });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return c.json({ error: 'NOT_FOUND', message: err.message }, 404);
    }
    const message = err.message ?? 'Failed to fetch variations';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /variations — inline variation generator for unsaved recipes
 * (Home suggestions, Discover previews). Takes { title, description?,
 * ingredients?, total_time_minutes?, mode? } and returns variations
 * without hitting the DB.
 */
progression.post('/variations', async (c) => {
  let body: {
    title?: string;
    description?: string | null;
    ingredients?: Array<string | { name: string }>;
    total_time_minutes?: number | null;
    mode?: string;
    custom_instructions?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.title || typeof body.title !== 'string') {
    return c.json({ error: 'title is required' }, 400);
  }
  const mode: RemixMode = (VALID_MODES as readonly string[]).includes(body.mode ?? '')
    ? (body.mode as RemixMode)
    : 'surprise';
  const customInstructions =
    typeof body.custom_instructions === 'string'
      ? body.custom_instructions.slice(0, 500)
      : '';

  try {
    const variations = await generateVariationsForContext(
      {
        title: body.title,
        description: body.description ?? null,
        ingredients: body.ingredients,
        total_time_minutes: body.total_time_minutes ?? null,
      },
      mode,
      customInstructions || undefined,
    );
    return c.json({ data: variations, mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch variations';
    return c.json({ error: message }, 500);
  }
});

export default progression;
