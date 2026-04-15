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
  updateRecipe,
  deleteRecipe,
} from '../services/recipeStore.js';
import {
  discoverRecipes,
  type DiscoveryPreferences,
} from '../services/recipeDiscovery.js';

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

export default recipes;
