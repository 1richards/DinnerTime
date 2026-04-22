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
 * GET / — Range query for meal plans across multiple weeks.
 *
 * Query params:
 *   from=YYYY-MM-DD (required): lower-bound week_start (inclusive).
 *   to=YYYY-MM-DD (required):   upper-bound week_start (inclusive).
 *   projection=month (optional): returns a lightweight entry shape for
 *     month-view performance (omits ingredients/ingredients_needed arrays).
 *
 * Returns { data: Array<{ id, week_start, generated_at, entries }> }.
 *
 * Bounds: |to - from| <= 70 days; 400 otherwise. Phase 22 plan 22-03
 * (month view) uses up to ~35 days; 70-day ceiling leaves headroom for a
 * two-month projection without requiring pagination.
 *
 * NOTE on route ordering: Hono matches static segments (/current) before
 * this root GET, so /current is preserved. Verified at boot.
 */
mealPlans.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const projection = c.req.query('projection');

  if (!from || !to || from.length !== 10 || to.length !== 10) {
    return c.json({ error: 'from and to required (YYYY-MM-DD)' }, 400);
  }

  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return c.json({ error: 'from and to must be valid YYYY-MM-DD dates' }, 400);
  }
  const diffDays = Math.abs(
    (toDate.getTime() - fromDate.getTime()) / 86_400_000,
  );
  if (diffDays > 70) {
    return c.json({ error: 'range too large (max 70 days)' }, 400);
  }

  try {
    const { data: plans, error: plansErr } = await supabase
      .from('meal_plans')
      .select('id, week_start, generated_at')
      .eq('profile_id', user.id)
      .gte('week_start', from)
      .lte('week_start', to)
      .order('week_start', { ascending: true });

    if (plansErr) {
      return c.json({ error: plansErr.message }, 500);
    }

    const planIds = (plans ?? []).map((p: { id: string }) => p.id);
    let entries: Array<{ meal_plan_id: string }> = [];
    if (planIds.length > 0) {
      const entryCols =
        projection === 'month'
          ? 'id, meal_plan_id, day_of_week, status, title, recipe_id, estimated_time_minutes, difficulty'
          : '*';
      const { data: es, error: esErr } = await supabase
        .from('meal_plan_entries')
        .select(entryCols)
        .in('meal_plan_id', planIds)
        .order('day_of_week', { ascending: true });
      if (esErr) {
        return c.json({ error: esErr.message }, 500);
      }
      entries = (es ?? []) as Array<{ meal_plan_id: string }>;
    }

    const entriesByPlan = new Map<string, unknown[]>();
    for (const e of entries) {
      const bucket = entriesByPlan.get(e.meal_plan_id);
      if (bucket) {
        bucket.push(e);
      } else {
        entriesByPlan.set(e.meal_plan_id, [e]);
      }
    }
    const data = (plans ?? []).map((p: { id: string }) => ({
      ...p,
      entries: entriesByPlan.get(p.id) ?? [],
    }));

    return c.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch meal plans';
    return c.json({ error: message }, 500);
  }
});

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
 * POST /entries/assign — Assign a specific meal (from a Home suggestion,
 * a Discover preview, a saved recipe, etc.) to a specific day of a week.
 * Creates the meal plan for the week if none exists. Upserts the entry
 * for the given day.
 *
 * Body: {
 *   date?: 'YYYY-MM-DD', // Phase 22: if provided, derives week_start (Monday)
 *                        // and day_of_week from the date. Overrides `day`.
 *   day?: 0..6 (0 = Monday), // back-compat: current week when no `date`
 *   title: string,
 *   description?: string,
 *   ingredients?: Array<{name, quantity?, unit?}>,
 *   estimated_time_minutes?: number,
 *   difficulty?: 'easy'|'medium'|'hard',
 *   kid_friendly?: boolean,
 *   why_suggested?: string,
 *   recipe_id?: string  // optional link to a saved recipe
 * }
 *
 * Precedence: `date` wins over `day` (deterministic — avoids silent bugs
 * when both are accidentally sent).
 */
mealPlans.post('/entries/assign', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: {
    date?: string | null;
    day?: number;
    title?: string;
    description?: string | null;
    ingredients?: Array<{ name: string; quantity?: number; unit?: string }> | null;
    estimated_time_minutes?: number | null;
    difficulty?: 'easy' | 'medium' | 'hard' | null;
    kid_friendly?: boolean | null;
    why_suggested?: string | null;
    recipe_id?: string | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Phase 22: prefer explicit `date` (YYYY-MM-DD), fall back to legacy `day`.
  const rawDate =
    typeof body.date === 'string' && body.date.length === 10 ? body.date : null;
  let resolvedDay: number;
  let weekStart: string;
  if (rawDate) {
    const parsed = new Date(`${rawDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return c.json({ error: 'date must be a valid YYYY-MM-DD' }, 400);
    }
    weekStart = mondayOf(parsed);
    // getUTCDay(): Sun=0..Sat=6 → shift so Mon=0..Sun=6
    resolvedDay = (parsed.getUTCDay() + 6) % 7;
  } else {
    const dayNum = Number(body.day);
    if (!Number.isInteger(dayNum) || dayNum < 0 || dayNum > 6) {
      return c.json(
        { error: 'day must be an integer 0..6 (or provide date)' },
        400,
      );
    }
    resolvedDay = dayNum;
    weekStart = mondayOf(new Date());
  }

  if (!body.title || typeof body.title !== 'string') {
    return c.json({ error: 'title is required' }, 400);
  }

  try {
    // 1. Ensure a meal_plan row exists for this week.
    const { data: existingPlan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('profile_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    let planId: string;
    if (existingPlan) {
      planId = (existingPlan as { id: string }).id;
    } else {
      const { data: newPlan, error: insertPlanErr } = await supabase
        .from('meal_plans')
        .insert({ profile_id: user.id, week_start: weekStart })
        .select('id')
        .single();
      if (insertPlanErr || !newPlan) {
        return c.json({ error: `Failed to create meal plan: ${insertPlanErr?.message ?? 'unknown'}` }, 500);
      }
      planId = (newPlan as { id: string }).id;
    }

    // 2. Upsert the entry for the target day. meal_plan_entries has a UNIQUE
    //    constraint on (meal_plan_id, day_of_week).
    const entryPayload = {
      meal_plan_id: planId,
      day_of_week: resolvedDay,
      recipe_id: body.recipe_id ?? null,
      title: body.title,
      description: body.description ?? null,
      ingredients: body.ingredients ?? [],
      ingredients_needed: [],
      estimated_time_minutes: body.estimated_time_minutes ?? null,
      difficulty: body.difficulty ?? null,
      kid_friendly: body.kid_friendly ?? false,
      why_suggested: body.why_suggested ?? null,
      status: 'planned' as const,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from('meal_plan_entries')
      .upsert(entryPayload, { onConflict: 'meal_plan_id,day_of_week' })
      .select()
      .single();

    if (upsertErr || !upserted) {
      return c.json({ error: `Failed to assign entry: ${upsertErr?.message ?? 'unknown'}` }, 500);
    }

    return c.json({ data: upserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign meal';
    return c.json({ error: message }, 500);
  }
});

/**
 * PATCH /:id — Update plan-level properties (Phase 22-05: focus_theme).
 *
 * Body: { focus_theme?: string | null }
 *
 * Returns { data: MealPlan } on success. 400 when the JSON body is malformed
 * or when no updatable field is supplied. 404 when the plan does not exist
 * OR is owned by a different profile (ownership guard keyed on profile_id).
 *
 * Current updatable fields: focus_theme only. Extend the schema check here
 * when new fields are added — keep the "no updatable fields" 400 strict so
 * typo callers (e.g. `{ focusTheme: ... }`) fail fast.
 */
mealPlans.patch('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const planId = c.req.param('id');

  let body: { focus_theme?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!('focus_theme' in body)) {
    return c.json({ error: 'No updatable fields provided' }, 400);
  }

  // focus_theme accepted as string or null. Coerce undefined→null (caller
  // explicitly passed `{ focus_theme: undefined }` — treat as clear).
  const nextTheme =
    typeof body.focus_theme === 'string' ? body.focus_theme : null;

  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .update({ focus_theme: nextTheme })
      .eq('id', planId)
      .eq('profile_id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      return c.json({ error: error.message }, 500);
    }
    if (!data) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update meal plan';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/entries/:day/skip — Mark a day's entry as skipped.
 *
 * Body (optional): { reason?: string | null }
 *   - When the body is missing, malformed, or omits `reason`, skip_reason is
 *     stored as null. Free-form reasons ("travel", "ate out", etc.) are
 *     pass-through — no controlled vocabulary.
 *
 * Returns { data: <updated meal_plan_entry row> } on success.
 *
 * Response codes:
 *   - 400 when `day` is not an integer in 0..6.
 *   - 404 when the plan does not exist OR is owned by a different profile
 *     (ownership guard via `.eq('profile_id', user.id)` → maybeSingle → null).
 *   - 404 when the entry row doesn't exist for the given (plan, day) pair.
 *
 * Phase 22-06 consumes migration 00026 (`meal_plan_entries.skip_reason`
 * column already shipped in 22-00). Mirrors the PATCH /:id ownership pattern:
 * a compound .eq on (id, profile_id) returning null is the ownership failure
 * signal, distinct from a DB-level error which returns 500.
 */
mealPlans.post('/:id/entries/:day/skip', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const planId = c.req.param('id');
  const day = Number.parseInt(c.req.param('day') ?? '', 10);

  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return c.json({ error: 'day must be an integer in 0..6' }, 400);
  }

  let body: { reason?: string | null } = {};
  try {
    body = await c.req.json();
  } catch {
    // Empty/malformed body is OK — default reason to null.
    body = {};
  }

  try {
    // 1. Verify plan ownership. Returning null here means either the plan
    //    doesn't exist or it belongs to a different profile — both should
    //    surface as 404 to avoid leaking plan existence across accounts.
    const { data: plan, error: planErr } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('id', planId)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (planErr) {
      return c.json({ error: planErr.message }, 500);
    }
    if (!plan) {
      return c.json({ error: 'Not found' }, 404);
    }

    // 2. Update the entry row. `skip_reason` accepts string or null; empty
    //    string is left as-is (caller's choice) but undefined → null.
    const nextReason =
      typeof body.reason === 'string' ? body.reason : null;

    const { data: updated, error: updateErr } = await supabase
      .from('meal_plan_entries')
      .update({ status: 'skipped', skip_reason: nextReason })
      .eq('meal_plan_id', planId)
      .eq('day_of_week', day)
      .select()
      .maybeSingle();

    if (updateErr) {
      return c.json({ error: updateErr.message }, 500);
    }
    if (!updated) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    return c.json({ data: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to skip entry';
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
