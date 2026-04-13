import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { anthropic } from '../config/anthropic.js';

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
  const steps = Array.isArray(typed.steps) ? typed.steps : [];
  const lastIdx = Math.max(0, steps.length - 1);
  const clamped = Math.min(Math.max(0, Math.floor(stepIndex)), lastIdx);
  const currentStep = steps[clamped] ?? '';

  const systemPrompt = buildSystemPrompt(typed, currentStep);

  let answer: string;
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-latest',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    });
    const textBlock = (res.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === 'text'
    );
    answer = textBlock?.text ?? '';
  } catch {
    return c.json({ error: 'CLAUDE_ERROR' }, 502);
  }

  // Belt-and-suspenders truncation (Pitfall 6)
  if (answer.length > 300) {
    answer = answer.slice(0, 297) + '...';
  }

  return c.json({ answer }, 200);
});

export default cooking;
