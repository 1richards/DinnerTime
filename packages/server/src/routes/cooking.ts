import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getClientFor } from '../ai/clientFactory.js';
import { getOrGenerateTip } from '../services/cookingTips.js';

const cooking = new Hono();

cooking.use('*', authMiddleware);

interface RecipeRowLite {
  id: string;
  title: string;
  ingredients: unknown[];
  steps: string[];
}

interface IngredientLike {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
}

const SHORT_ANSWER_RULE =
  'Answers MUST be 1-3 sentences, spoken conversationally, no markdown, no bullet lists, no preamble.';

function formatIngredient(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return String(raw ?? '');
  const i = raw as IngredientLike;
  if (!i.name) return '';
  const qty = i.quantity != null ? String(i.quantity) : '';
  const unit = i.unit ?? '';
  const amount = [qty, unit].filter(Boolean).join(' ').trim();
  return amount ? `${amount} ${i.name}` : i.name;
}

function buildSystemPrompt(recipe: RecipeRowLite, currentStep: string): string {
  const ingredientLines = (recipe.ingredients ?? [])
    .map(formatIngredient)
    .filter((s) => s.length > 0)
    .map((s) => `- ${s}`)
    .join('\n');

  return [
    `You are a hands-free cooking assistant helping a user prepare "${recipe.title}".`,
    '',
    'CURRENT STEP:',
    currentStep,
    '',
    'RECIPE INGREDIENTS:',
    ingredientLines,
    '',
    SHORT_ANSWER_RULE,
  ].join('\n');
}

/**
 * POST /ask — free-form cooking question answered by Claude with recipe context.
 * Returns a spoken-style <=300 char answer.
 */
cooking.post('/ask', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: {
    recipe_id?: unknown;
    current_step_index?: unknown;
    question?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }

  const recipeId = body.recipe_id;
  const stepIndex = body.current_step_index;
  const question = body.question;

  if (
    typeof recipeId !== 'string' ||
    recipeId.length === 0 ||
    typeof stepIndex !== 'number' ||
    !Number.isFinite(stepIndex) ||
    typeof question !== 'string' ||
    question.trim().length === 0
  ) {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }

  // Load recipe scoped to authed user
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .select('id, title, ingredients, steps')
    .eq('id', recipeId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (recipeErr) {
    return c.json({ error: 'RECIPE_NOT_FOUND' }, 404);
  }
  if (!recipe) {
    return c.json({ error: 'RECIPE_NOT_FOUND' }, 404);
  }

  const typed = recipe as RecipeRowLite;
  // Defensively coerce steps: Supabase usually returns a parsed JSONB array,
  // but a legacy row or a test fixture may store it as a JSON-encoded string.
  let steps: string[] = [];
  if (Array.isArray(typed.steps)) {
    steps = typed.steps as string[];
  } else if (typeof typed.steps === 'string') {
    try {
      const parsed = JSON.parse(typed.steps);
      if (Array.isArray(parsed)) steps = parsed as string[];
    } catch {
      // Swallow — steps stays [].
    }
  }
  const lastIdx = Math.max(0, steps.length - 1);
  const clamped = Math.min(Math.max(0, Math.floor(stepIndex)), lastIdx);
  const currentStep = steps[clamped] ?? '';

  const systemPrompt = buildSystemPrompt(typed, currentStep);

  let answer: string;
  try {
    const ai = getClientFor('cooking.voiceAsk');
    answer = await ai.generateText({
      system: systemPrompt,
      user: question,
      maxTokens: 300,
    });
  } catch {
    return c.json({ error: 'CLAUDE_ERROR' }, 502);
  }

  // Belt-and-suspenders truncation (Pitfall 6)
  if (answer.length > 300) {
    answer = answer.slice(0, 297) + '...';
  }

  return c.json({ answer }, 200);
});

/**
 * GET /tips — Per-step cooking tip with Haiku-backed cache (Phase 10-03).
 *
 * Query params: recipe_id, step_index, step_text
 * Returns: { tip: string }  (empty string when Haiku is uncertain)
 */
cooking.get('/tips', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  const recipeId = c.req.query('recipe_id');
  const stepIndexRaw = c.req.query('step_index');
  const stepText = c.req.query('step_text');

  if (
    typeof recipeId !== 'string' ||
    recipeId.length === 0 ||
    typeof stepIndexRaw !== 'string' ||
    stepIndexRaw.length === 0 ||
    typeof stepText !== 'string'
  ) {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }

  const stepIndex = Number(stepIndexRaw);
  if (!Number.isFinite(stepIndex) || stepIndex < 0) {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }

  // Ownership check: load recipe scoped to authed user (mirrors /ask)
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', recipeId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (recipeErr || !recipe) {
    return c.json({ error: 'RECIPE_NOT_FOUND' }, 404);
  }

  let tip: string;
  try {
    tip = await getOrGenerateTip(supabase, recipeId, Math.floor(stepIndex), stepText);
  } catch {
    return c.json({ error: 'CLAUDE_ERROR' }, 502);
  }

  return c.json({ tip }, 200);
});

export default cooking;
