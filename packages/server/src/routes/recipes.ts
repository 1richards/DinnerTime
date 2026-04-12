import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  parseRecipeFromUrl,
  parseRecipeFromPhoto,
  parseRecipeFromText,
} from '../services/recipeParser.js';
import {
  saveRecipe,
  getRecipes,
  getRecipeById,
  findRecipeBySourceUrl,
} from '../services/recipeStore.js';

const recipes = new Hono();

recipes.use('*', authMiddleware);

/**
 * GET / - List all recipes for the authenticated user.
 */
recipes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  try {
    const data = await getRecipes(supabase, user.id);
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch recipes';
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

export default recipes;
