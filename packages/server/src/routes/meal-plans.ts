import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  generateMealPlan,
  regenerateDay,
  markCooked,
} from '../services/mealPlanner.js';

const mealPlans = new Hono();

mealPlans.use('*', authMiddleware);

/**
 * Compute the Monday (ISO week start) for the given date as YYYY-MM-DD (UTC).
 * JS getUTCDay(): Sun=0, Mon=1..Sat=6. Shift so Mon=0.
 */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const jsDay = d.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /current — Active meal plan for the current Monday week_start.
 */
mealPlans.get('/current', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const weekStart = mondayOf(new Date());

  try {
    const { data: plan, error } = await supabase
      .from('meal_plans')
      .select()
      .eq('profile_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (error) {
      return c.json({ error: error.message }, 500);
    }
    if (!plan) {
      return c.json({ error: 'No meal plan for current week' }, 404);
    }

    const { data: entries, error: entriesError } = await supabase
      .from('meal_plan_entries')
      .select()
      .eq('meal_plan_id', plan.id)
      .order('day_of_week', { ascending: true });

    if (entriesError) {
      return c.json({ error: entriesError.message }, 500);
    }

    return c.json({ data: { ...plan, entries: entries ?? [] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch current plan';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /generate — Generate a 7-day plan for the given week_start.
 */
mealPlans.post('/generate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: { week_start?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.week_start || typeof body.week_start !== 'string') {
    return c.json({ error: 'Missing or invalid week_start' }, 400);
  }

  try {
    const plan = await generateMealPlan(supabase, user.id, body.week_start);
    return c.json({ data: plan }, 201);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'EMPTY_PANTRY') {
      return c.json({ error: err.message }, 400);
    }
    if (err.code === 'INVALID_PLAN_LENGTH') {
      return c.json({ error: err.message }, 502);
    }
    const message = err.message ?? 'Failed to generate meal plan';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/entries/:day/regenerate — Swap a single day's entry.
 */
mealPlans.post('/:id/entries/:day/regenerate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const planId = c.req.param('id');
  const dayParam = c.req.param('day');
  const day = Number.parseInt(dayParam, 10);

  if (Number.isNaN(day) || day < 0 || day > 6) {
    return c.json({ error: 'day must be an integer in 0..6' }, 400);
  }

  try {
    const entry = await regenerateDay(supabase, user.id, planId, day);
    return c.json({ data: entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to regenerate day';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/entries/:day/cook — Mark entry cooked and deduct pantry.
 */
mealPlans.post('/:id/entries/:day/cook', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const planId = c.req.param('id');
  const dayParam = c.req.param('day');
  const day = Number.parseInt(dayParam, 10);

  if (Number.isNaN(day) || day < 0 || day > 6) {
    return c.json({ error: 'day must be an integer in 0..6' }, 400);
  }

  try {
    const result = await markCooked(supabase, user.id, planId, day);
    return c.json({ data: result });
  } catch (error) {
    const err = error as Error & { code?: string; status?: number };
    if (err.code === 'ALREADY_COOKED') {
      return c.json({ error: err.message }, 409);
    }
    const message = err.message ?? 'Failed to mark cooked';
    return c.json({ error: message }, 500);
  }
});

export default mealPlans;
