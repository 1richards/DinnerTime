import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  parseRecipeFromUrl,
  parseRecipeFromPhoto,
  parseRecipeFromText,
  applyRemixVariation,
} from '../services/recipeParser.js';
import {
  saveRecipe,
  getRecipes,
  getRecipeById,
  findRecipeBySourceUrl,
  findRecipeByNormalizedTitle,
  updateRecipe,
  deleteRecipe,
} from '../services/recipeStore.js';
import {
  discoverRecipes,
  type DiscoveryPreferences,
} from '../services/recipeDiscovery.js';
import { generateRecipeImage } from '../services/recipeImageGen.js';
import { SEED_RECIPES, templateKey } from '../data/seedRecipes.js';
import { supabaseAdmin } from '../config/supabase.js';

// Fields a client is allowed to patch. Anything else in the body is ignored.
const PATCHABLE_FIELDS = [
  'title',
  'description',
  'ingredients',
  'steps',
  'prep_time_minutes',
  'cook_time_minutes',
  'total_time_minutes',
  'servings',
  'is_favorite',
  'image_url',
  'labels',
  // Quick-task 6 — symmetric PATCH support for skill scaffolding so users
  // can hand-edit difficulty + skills + skill_note on saved recipes.
  'difficulty',
  'practiced_skills',
  'skill_note',
] as const;

const recipes = new Hono();

recipes.use('*', authMiddleware);

/**
 * GET / - List all recipes for the authenticated user.
 */
recipes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  const q = c.req.query('q');
  const favorites = c.req.query('favorites');

  try {
    const data = await getRecipes(supabase, user.id, {
      q,
      favoritesOnly: favorites === 'true',
    });
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch recipes';
    return c.json({ error: message }, 500);
  }
});

/**
 * PATCH /:id - Update whitelisted fields on a recipe.
 * Unknown fields in the body are silently dropped.
 */
recipes.patch('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) =>
      (PATCHABLE_FIELDS as readonly string[]).includes(k)
    )
  );

  try {
    const data = await updateRecipe(supabase, user.id, id, patch);
    if (!data) {
      return c.json({ error: 'Recipe not found' }, 404);
    }
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update recipe';
    return c.json({ error: message }, 500);
  }
});

/**
 * DELETE /:id - Remove a recipe owned by the authenticated user.
 */
recipes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    await deleteRecipe(supabase, user.id, id);
    return c.body(null, 204);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete recipe';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /search - Phase 17 (P17-04) keyword-driven AI recipe search.
 *
 * Body: { query: string; pantryOnly?: boolean }
 *   - query: the user's typed phrase (e.g., "quick weeknight pasta"). Required.
 *   - pantryOnly: when true, server loads the user's pantry (confidence-ordered,
 *     capped at 50 -- Pitfall 3) and passes names as a pantryManifest into the
 *     discovery prompt. The AI then constrains its output to recipes that are
 *     100% feasible from those items + common staples.
 *
 * Returns: { data: ParsedRecipe[] } on success.
 *
 * D-07: NEW route (not an extension of /discover). /discover stays byte-exact
 * for RECP-10 zero-input library discovery; /search is the keyword-driven
 * Phase 17 sibling. They share the recipeDiscovery service but have
 * independent external contracts.
 */
recipes.post('/search', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  // Strict body validation. Empty query is accepted when pantryOnly=true
  // (the "dinner ideas from my pantry" flow — the pantry manifest IS the
  // signal, no text query needed). Otherwise a text query is required.
  let body: { query?: string; pantryOnly?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof body.query !== 'string') {
    return c.json({ error: 'Query is required' }, 400);
  }
  if (body.query.trim().length === 0 && body.pantryOnly !== true) {
    return c.json({ error: 'Query is required' }, 400);
  }

  try {
    // NOTE: mirrors /discover preference assembly -- keep in sync.
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select()
      .eq('profile_id', user.id);

    if (membersError) {
      throw new Error(`Failed to fetch household members: ${membersError.message}`);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cuisine_preferences, skill_level')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    const memberRows = (members ?? []) as Array<{
      dietary_allergies?: string[] | null;
      dietary_restrictions?: string[] | null;
      disliked_ingredients?: string[] | null;
    }>;

    const preferences: DiscoveryPreferences = {
      allergies: [
        ...new Set(memberRows.flatMap((m) => m.dietary_allergies ?? [])),
      ],
      dietary_restrictions: [
        ...new Set(memberRows.flatMap((m) => m.dietary_restrictions ?? [])),
      ],
      disliked_ingredients: [
        ...new Set(memberRows.flatMap((m) => m.disliked_ingredients ?? [])),
      ],
      cuisine_preferences:
        (profile as { cuisine_preferences?: string[] | null })?.cuisine_preferences ?? [],
    };

    // Pantry manifest branch (D-04 + Pitfall 3).
    // Only fetch when pantryOnly:true -- avoids an unnecessary DB round-trip
    // on the default path. Ordered by confidence desc, capped at 50.
    let pantryManifest: string[] | undefined;
    if (body.pantryOnly === true) {
      const { data: pantry, error: pantryError } = await supabase
        .from('pantry_items')
        .select('name, confidence, status')
        .eq('profile_id', user.id)
        .order('confidence', { ascending: false })
        .limit(50);

      if (pantryError) {
        throw new Error(`Failed to fetch pantry: ${pantryError.message}`);
      }

      // Apply status='available' filter in-memory. Rationale:
      // - Real pantry_items rows carry a `status` column; we only want
      //   currently-available items (matches services/suggestions.ts convention).
      // - Filtering after .limit(50) is acceptable because upstream confidence
      //   ordering already prioritizes high-signal items.
      // - Rows without a status (e.g., unit tests) pass through unchanged.
      pantryManifest = (pantry ?? [])
        .filter((p: { status?: string | null }) =>
          p.status === undefined || p.status === null || p.status === 'available',
        )
        .map((p: { name: string }) => p.name);
    }

    // Existing library titles feed the AVOID list (same pattern as /discover)
    const library = await getRecipes(supabase, user.id);
    const existingTitles = library.map((r) => r.title);

    const data = await discoverRecipes({
      preferences,
      existingTitles,
      prompt: body.query,
      pantryManifest,
    });

    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search recipes';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /discover - AI-generated recipe suggestions (RECP-10).
 *
 * Loads household preferences + existing library titles, calls Claude Sonnet
 * via the recipeDiscovery service, and returns a list of ParsedRecipe.
 * Does NOT persist anything -- saving is an explicit user action via POST /.
 */
recipes.post('/discover', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  // Body is optional; empty/invalid JSON should not 400 this endpoint.
  const body = await c.req
    .json<{ prompt?: string }>()
    .catch(() => ({} as { prompt?: string }));

  try {
    // Load household members (allergies / restrictions / dislikes)
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select()
      .eq('profile_id', user.id);

    if (membersError) {
      throw new Error(`Failed to fetch household members: ${membersError.message}`);
    }

    // Load profile (cuisine preferences)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cuisine_preferences, skill_level')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    const memberRows = (members ?? []) as Array<{
      dietary_allergies?: string[] | null;
      dietary_restrictions?: string[] | null;
      disliked_ingredients?: string[] | null;
    }>;

    // Dedupe allergies / restrictions / dislikes across all members
    const preferences: DiscoveryPreferences = {
      allergies: [
        ...new Set(memberRows.flatMap((m) => m.dietary_allergies ?? [])),
      ],
      dietary_restrictions: [
        ...new Set(memberRows.flatMap((m) => m.dietary_restrictions ?? [])),
      ],
      disliked_ingredients: [
        ...new Set(memberRows.flatMap((m) => m.disliked_ingredients ?? [])),
      ],
      cuisine_preferences:
        (profile as { cuisine_preferences?: string[] | null })?.cuisine_preferences ?? [],
    };

    // Existing library titles feed the AVOID list to prevent duplicates
    const library = await getRecipes(supabase, user.id);
    const existingTitles = library.map((r) => r.title);

    const data = await discoverRecipes({
      preferences,
      existingTitles,
      prompt: body.prompt,
    });

    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to discover recipes';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id - Get a single recipe by ID.
 */
recipes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const data = await getRecipeById(supabase, user.id, id);
    if (!data) {
      return c.json({ error: 'Recipe not found' }, 404);
    }
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch recipe';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST / - Save a reviewed/parsed recipe.
 * Body: ParsedRecipe shape
 */
recipes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.title || !body.ingredients || !body.steps) {
    return c.json({ error: 'Missing required fields: title, ingredients, steps' }, 400);
  }

  try {
    // Dedup: if the user already has a recipe with this title (case-
    // insensitive, trimmed), return that row with `duplicate: true`
    // instead of inserting a second copy. Catches both rapid double-
    // taps and AI re-surfacing the same suggestion in a later Discover
    // fetch.
    const existing = await findRecipeByNormalizedTitle(
      supabase,
      user.id,
      body.title,
    );
    if (existing) {
      return c.json({ data: existing, duplicate: true });
    }

    const data = await saveRecipe(supabase, user.id, body);
    return c.json({ data }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save recipe';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /import/url - Import a recipe from a URL.
 * Body: { url: string }
 * Returns existing recipe with duplicate flag if URL already imported.
 */
recipes.post('/import/url', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ url: string }>();

  if (!body.url || typeof body.url !== 'string') {
    return c.json({ error: 'Missing required field: url' }, 400);
  }

  try {
    // Check for duplicate
    const existing = await findRecipeBySourceUrl(supabase, user.id, body.url);
    if (existing) {
      return c.json({ data: existing, duplicate: true });
    }

    const data = await parseRecipeFromUrl(body.url);
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import recipe from URL';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /import/photo - Import a recipe from a photo.
 * Body: { image: string } (base64)
 */
recipes.post('/import/photo', async (c) => {
  const body = await c.req.json<{ image: string }>();

  if (!body.image || typeof body.image !== 'string') {
    return c.json({ error: 'Missing required field: image (base64)' }, 400);
  }

  try {
    const data = await parseRecipeFromPhoto(body.image);
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import recipe from photo';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /import/text - Import a recipe from freeform text.
 * Body: { text: string }
 */
recipes.post('/import/text', async (c) => {
  const body = await c.req.json<{ text: string }>();

  if (!body.text || typeof body.text !== 'string') {
    return c.json({ error: 'Missing required field: text' }, 400);
  }

  try {
    const data = await parseRecipeFromText(body.text);
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import recipe from text';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /remix - Apply a remix variation to a base recipe and return a
 * full parsed recipe (not yet saved). The client then POSTs the result
 * to POST /recipes to persist.
 *
 * Body: {
 *   base: { title, description?, ingredients?, steps?, total_time_minutes? },
 *   variation: { title, description }
 * }
 */
recipes.post('/remix', async (c) => {
  let body: {
    base?: {
      title?: string;
      description?: string | null;
      ingredients?: Array<string | { name: string; quantity?: number; unit?: string; notes?: string }>;
      steps?: string[];
      total_time_minutes?: number | null;
    };
    variation?: { title?: string; description?: string };
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.base?.title) return c.json({ error: 'base.title is required' }, 400);
  if (!body.variation?.title || !body.variation?.description) {
    return c.json({ error: 'variation.title and variation.description are required' }, 400);
  }

  try {
    const data = await applyRemixVariation(
      {
        title: body.base.title,
        description: body.base.description ?? null,
        ingredients: body.base.ingredients,
        steps: body.base.steps,
        total_time_minutes: body.base.total_time_minutes ?? null,
      },
      { title: body.variation.title, description: body.variation.description },
    );
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply remix';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /generate-image — generate an AI hero image for a recipe.
 *
 * Body: {
 *   title: string,
 *   description?: string | null,
 *   ingredients?: Array<{ name: string; quantity?: number | null; unit?: string | null }> | null,
 * }
 * Returns: { url: string | null }
 *
 * Fire-and-forget friendly: mobile cards call this asynchronously and swap
 * their placeholder/keyword-match hero once the URL arrives. Server caches
 * by sha256(title + ingredient fingerprint) in the recipe-images Storage
 * bucket, so repeat recipes return instantly on cache hit. Passing
 * description + ingredients dramatically improves specificity of the
 * generated image — titles alone produced off-target "generic food photo"
 * renders for dishes whose title didn't encode visual details.
 */
recipes.post('/generate-image', async (c) => {
  let body: {
    title?: string;
    description?: string | null;
    ingredients?: Array<{
      name?: string;
      quantity?: number | null;
      unit?: string | null;
    }> | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof body.title !== 'string' || body.title.trim().length === 0) {
    return c.json({ error: 'title is required' }, 400);
  }
  const cleanedIngredients = Array.isArray(body.ingredients)
    ? body.ingredients
        .map((ing) => ({
          name: typeof ing?.name === 'string' ? ing.name : '',
          quantity: typeof ing?.quantity === 'number' ? ing.quantity : null,
          unit: typeof ing?.unit === 'string' ? ing.unit : null,
        }))
        .filter((ing) => ing.name.trim().length > 0)
    : null;
  const url = await generateRecipeImage({
    title: body.title,
    description: typeof body.description === 'string' ? body.description : null,
    ingredients: cleanedIngredients,
  });
  // null is a valid response — mobile keeps its fallback image. Return 200
  // either way so callers don't need error-handling branches for the common
  // "model safety block" case.
  return c.json({ url });
});

/**
 * POST /seed-templates - one-time idempotent upsert of the baseline recipe
 * library into `recipe_templates`. Reads from packages/server/src/data/
 * seedRecipes.ts so editing/adding recipes is a one-file edit + redeploy.
 *
 * Safe to call from any authed user — the route writes via the user's
 * supabase client and RLS allows authenticated INSERTs (no policy yet
 * blocks them). Will be wired into server startup so a fresh deploy
 * automatically seeds. Returns the count of templates after upsert.
 */
recipes.post('/seed-templates', async (c) => {
  // recipe_templates has RLS that allows SELECT to authenticated users
  // but no INSERT policy — the table is admin-managed reference data,
  // not user-writable. Use the service-role client to bypass RLS for the
  // seed upsert; the endpoint is still auth-gated (authMiddleware above)
  // so this requires a valid logged-in user to call.
  const supabase = supabaseAdmin;
  const rows = SEED_RECIPES.map((r) => ({
    template_key: templateKey(r),
    cuisine_type: r.cuisine_type,
    title: r.title,
    description: r.description,
    ingredients: r.ingredients,
    steps: r.steps,
    prep_time_minutes: r.prep_time_minutes,
    cook_time_minutes: r.cook_time_minutes,
    total_time_minutes: r.total_time_minutes,
    servings: r.servings,
    difficulty: r.difficulty,
    practiced_skills: r.practiced_skills,
    skill_note: r.skill_note,
    labels: r.labels,
    calories_per_serving: r.calories_per_serving,
    protein_grams_per_serving: r.protein_grams_per_serving,
    fat_grams_per_serving: r.fat_grams_per_serving,
  }));
  const { error } = await supabase
    .from('recipe_templates')
    .upsert(rows, { onConflict: 'template_key' });
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  const { count } = await supabase
    .from('recipe_templates')
    .select('*', { count: 'exact', head: true });
  return c.json({ seeded: rows.length, total: count ?? rows.length });
});

/**
 * POST /seed-baseline - copy cuisine-matching templates into the calling
 * user's `recipes` table. Called by mobile at onboarding completion.
 *
 * Idempotent via `profiles.baseline_recipes_seeded` — if the flag is true
 * the route is a no-op. Otherwise:
 *   1. Reads the user's `cuisine_preferences` from profile
 *   2. Selects all `recipe_templates` matching those cuisines
 *      (or ALL templates if the user picked none — at least seed something)
 *   3. INSERTs them as personal `recipes` rows with source_type='ai',
 *      cuisine stored in labels[0], all other fields copied as-is
 *   4. Flips `baseline_recipes_seeded` true so subsequent calls no-op
 *
 * Returns the number of recipes seeded.
 */
recipes.post('/seed-baseline', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('cuisine_preferences, baseline_recipes_seeded')
    .eq('id', user.id)
    .single();

  if (profileError) {
    return c.json({ error: profileError.message }, 500);
  }

  if ((profile as { baseline_recipes_seeded?: boolean })?.baseline_recipes_seeded) {
    return c.json({ seeded: 0, skipped: 'already_seeded' });
  }

  const cuisines = (profile as { cuisine_preferences?: string[] | null })
    ?.cuisine_preferences ?? [];

  // Build the template query. When the user picked specific cuisines we
  // filter to those; when they skipped or picked none, we seed the whole
  // baseline so they still land on a populated app. Better than empty.
  let q = supabase.from('recipe_templates').select('*');
  if (cuisines.length > 0) {
    q = q.in('cuisine_type', cuisines);
  }
  const { data: templates, error: tplError } = await q;
  if (tplError) {
    return c.json({ error: tplError.message }, 500);
  }

  const tplRows = (templates ?? []) as Array<{
    cuisine_type: string;
    title: string;
    description: string | null;
    ingredients: unknown;
    steps: unknown;
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    total_time_minutes: number | null;
    servings: number | null;
    difficulty: string | null;
    practiced_skills: string[] | null;
    skill_note: string | null;
    labels: string[];
    calories_per_serving: number | null;
    protein_grams_per_serving: number | null;
    fat_grams_per_serving: number | null;
    image_url: string | null;
  }>;

  if (tplRows.length === 0) {
    // No templates matched. Mark seeded so we don't retry forever, but the
    // user lands empty. This is a server-config issue (templates table was
    // never populated) — caller can still recover by visiting Discover.
    await supabase
      .from('profiles')
      .update({ baseline_recipes_seeded: true })
      .eq('id', user.id);
    return c.json({ seeded: 0, reason: 'no_templates_matched' });
  }

  const recipeRows = tplRows.map((t) => ({
    profile_id: user.id,
    title: t.title,
    description: t.description,
    ingredients: t.ingredients,
    steps: t.steps,
    prep_time_minutes: t.prep_time_minutes,
    cook_time_minutes: t.cook_time_minutes,
    total_time_minutes: t.total_time_minutes,
    servings: t.servings,
    source_type: 'ai' as const,
    image_url: t.image_url,
    is_favorite: false,
    // Cuisine rides along in labels[0] so the existing RecipeCard
    // cuisineLabel pipeline can pick it up without a schema change.
    labels: [t.cuisine_type, ...(t.labels ?? [])],
    calories_per_serving: t.calories_per_serving,
    protein_grams_per_serving: t.protein_grams_per_serving,
    fat_grams_per_serving: t.fat_grams_per_serving,
    difficulty: t.difficulty,
    practiced_skills: t.practiced_skills,
    skill_note: t.skill_note,
  }));

  const { error: insertError } = await supabase
    .from('recipes')
    .insert(recipeRows);

  if (insertError) {
    return c.json({ error: insertError.message }, 500);
  }

  await supabase
    .from('profiles')
    .update({ baseline_recipes_seeded: true })
    .eq('id', user.id);

  return c.json({ seeded: recipeRows.length });
});

export default recipes;
