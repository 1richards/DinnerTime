import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  consolidateIngredients,
  subtractPantry,
  suggestVariations,
} from '../services/shoppingList.js';
import { classifyItems } from '../services/ingredientCategories.js';
import { getInstacartClient } from '../services/instacart.js';
import { normalizeIngredientName } from '../services/ingredientMatching.js';
import type {
  ConsolidatedItem,
  GroceryCategory,
  InstacartLineItem,
  ShoppingList,
  ShoppingListItem,
} from '../types/shopping.js';
import type { MealPlanEntry } from '../types/mealPlan.js';
import type { PantryItem } from '../services/pantry.js';

const shopping = new Hono();

shopping.use('*', authMiddleware);

/**
 * True if `name` looks like a spice or seasoning. Used by the Instacart
 * order builder to skip the per-line measurement for spices — "0.5 tsp
 * oregano" doesn't map to a retail SKU (you buy a jar). Conservative
 * keyword set; false-negatives mean we keep the measurement (annoying
 * but not wrong); false-positives drop measurement on a non-spice
 * (still fine — Instacart picks a default size).
 */
function isSpiceItem(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  // Direct names
  const SPICES: ReadonlySet<string> = new Set([
    'salt', 'kosher salt', 'sea salt', 'pepper', 'black pepper', 'white pepper',
    'cumin', 'paprika', 'smoked paprika', 'oregano', 'basil', 'dried basil',
    'thyme', 'dried thyme', 'rosemary', 'dried rosemary', 'sage', 'dried sage',
    'bay leaf', 'bay leaves', 'cinnamon', 'nutmeg', 'cloves', 'allspice',
    'turmeric', 'coriander', 'cardamom', 'fennel seed', 'mustard seed',
    'crushed red pepper', 'red pepper flakes', 'cayenne', 'chili powder',
    'curry powder', 'garam masala', 'five spice', 'italian seasoning',
    'herbs de provence', 'taco seasoning', 'old bay', 'lemon pepper',
    'garlic powder', 'onion powder', 'ground ginger', 'ground cumin',
    'ground coriander', 'ground cinnamon',
  ]);
  if (SPICES.has(n)) return true;
  // Substring matches for compound names (e.g. "freshly ground black pepper")
  const SUBSTRINGS = [
    'salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme',
    'rosemary', 'sage', 'bay leaf', 'cinnamon', 'nutmeg', 'clove',
    'allspice', 'turmeric', 'coriander', 'cardamom', 'cayenne',
    'chili powder', 'curry powder', 'garam masala', 'seasoning',
    'spice blend', 'red pepper flakes', 'garlic powder', 'onion powder',
  ];
  return SUBSTRINGS.some((s) => n.includes(s));
}

const PATCH_ITEM_ALLOWED = ['checked', 'quantity', 'name', 'unit'] as const;
type PatchItemKey = (typeof PATCH_ITEM_ALLOWED)[number];

function pickPatchFields(body: Record<string, unknown>): Partial<Record<PatchItemKey, unknown>> {
  const out: Partial<Record<PatchItemKey, unknown>> = {};
  for (const key of PATCH_ITEM_ALLOWED) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

function errorWithCode(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * POST /lists — create a blank, ad-hoc shopping list (no meal plan).
 *
 * Lets the mobile app lazily create a list the first time the user adds
 * an item from a non-meal-plan flow (e.g. cart-add icon on a recipe
 * preview, "Get more" pantry swipe). Previously these flows threw
 * "No active shopping list" because the only way to create a list was
 * `/generate` from a meal plan, leaving cart-adds dead-ended for users
 * who hadn't planned a week yet.
 */
shopping.post('/lists', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: { title?: string };
  try {
    body = await c.req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const title =
    typeof body.title === 'string' && body.title.trim().length > 0
      ? body.title.trim()
      : 'My shopping list';

  try {
    const { data: listRow, error: listErr } = await supabase
      .from('shopping_lists')
      .insert({
        profile_id: user.id,
        meal_plan_id: null,
        title,
      })
      .select()
      .single();
    if (listErr) return c.json({ error: listErr.message }, 500);
    const list = listRow as ShoppingList;
    return c.json({ data: { ...list, items: [] } }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create shopping list';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /generate — build a fresh shopping list from a meal plan.
 * Consolidates, subtracts pantry, classifies categories, persists.
 */
shopping.post('/generate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: { meal_plan_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.meal_plan_id || typeof body.meal_plan_id !== 'string') {
    return c.json({ error: 'Missing or invalid meal_plan_id' }, 400);
  }

  try {
    // Fetch meal plan scoped to profile
    const { data: plan, error: planErr } = await supabase
      .from('meal_plans')
      .select()
      .eq('id', body.meal_plan_id)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (planErr) return c.json({ error: planErr.message }, 500);
    if (!plan) {
      return c.json({ code: 'MEAL_PLAN_NOT_FOUND', error: 'meal plan not found' }, 404);
    }

    // Fetch entries
    const { data: entriesRaw, error: entriesErr } = await supabase
      .from('meal_plan_entries')
      .select()
      .eq('meal_plan_id', plan.id);
    if (entriesErr) return c.json({ error: entriesErr.message }, 500);

    const entries = (entriesRaw ?? []) as MealPlanEntry[];
    if (entries.length === 0) {
      return c.json({ code: 'EMPTY_PLAN', error: 'meal plan has no entries' }, 400);
    }

    // Fetch pantry
    const { data: pantryRaw, error: pantryErr } = await supabase
      .from('pantry_items')
      .select()
      .eq('profile_id', user.id);
    if (pantryErr) return c.json({ error: pantryErr.message }, 500);
    const pantry = (pantryRaw ?? []) as PantryItem[];

    // Consolidate + subtract
    const needed = consolidateIngredients(entries);
    const remaining = subtractPantry(needed, pantry);

    // Classify (graceful degrade to 'other' on failure)
    let categories: Record<string, GroceryCategory> = {};
    try {
      categories = await classifyItems(remaining);
    } catch (err) {
      console.warn('[shopping/generate] classifyItems failed, defaulting to other:', err);
      categories = {};
    }

    // Insert shopping_list row
    const title = `DinnerTime — week of ${plan.week_start}`;
    const { data: listRow, error: listErr } = await supabase
      .from('shopping_lists')
      .insert({
        profile_id: user.id,
        meal_plan_id: plan.id,
        title,
      })
      .select()
      .single();
    if (listErr) return c.json({ error: listErr.message }, 500);
    const list = listRow as ShoppingList;

    // Bulk insert items
    const itemRows = remaining.map((item) => ({
      shopping_list_id: list.id,
      name: item.name,
      normalized_name: item.normalizedName,
      quantity: item.quantity,
      unit: item.unit,
      category: categories[item.normalizedName] ?? 'other',
      sources: item.sources,
      checked: false,
      user_added: false,
    }));

    let insertedItems: ShoppingListItem[] = [];
    if (itemRows.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from('shopping_list_items')
        .insert(itemRows)
        .select();
      if (itemsErr) return c.json({ error: itemsErr.message }, 500);
      insertedItems = (itemsData ?? []) as ShoppingListItem[];
    }

    return c.json({ data: { ...list, items: insertedItems } }, 201);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'MEAL_PLAN_NOT_FOUND') return c.json({ error: err.message }, 404);
    if (err.code === 'EMPTY_PLAN') return c.json({ error: err.message }, 400);
    return c.json({ error: err.message ?? 'Failed to generate shopping list' }, 500);
  }
});

/**
 * GET /current — most recent shopping list with items (or null).
 */
shopping.get('/current', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  try {
    const { data: list, error } = await supabase
      .from('shopping_lists')
      .select()
      .eq('profile_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return c.json({ error: error.message }, 500);
    if (!list) return c.json({ data: null });

    const { data: items, error: itemsErr } = await supabase
      .from('shopping_list_items')
      .select()
      .eq('shopping_list_id', list.id);
    if (itemsErr) return c.json({ error: itemsErr.message }, 500);

    return c.json({ data: { ...list, items: items ?? [] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch current list';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /orders — past orders for the current profile.
 *
 * NOTE: This MUST be registered before `GET /:id`. Hono matches in registration
 * order and `/orders` would otherwise be captured as `id="orders"` by the UUID param.
 */
shopping.get('/orders', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  try {
    const { data, error } = await supabase
      .from('shopping_orders')
      .select()
      .eq('profile_id', user.id)
      .order('placed_at', { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch orders';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:id — specific shopping list with items.
 */
shopping.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const { data: list, error } = await supabase
      .from('shopping_lists')
      .select()
      .eq('id', id)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (error) return c.json({ error: error.message }, 500);
    if (!list) return c.json({ error: 'not found' }, 404);

    const { data: items, error: itemsErr } = await supabase
      .from('shopping_list_items')
      .select()
      .eq('shopping_list_id', list.id);
    if (itemsErr) return c.json({ error: itemsErr.message }, 500);

    return c.json({ data: { ...list, items: items ?? [] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch list';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /items — add a user-added item to a shopping list.
 */
shopping.post('/items', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: {
    shopping_list_id?: string;
    name?: string;
    quantity?: number;
    unit?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.shopping_list_id || !body.name) {
    return c.json({ error: 'shopping_list_id and name required' }, 400);
  }

  try {
    // Verify list belongs to profile
    const { data: list, error: listErr } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('id', body.shopping_list_id)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (listErr) return c.json({ error: listErr.message }, 500);
    if (!list) return c.json({ error: 'shopping list not found' }, 404);

    const { data: item, error } = await supabase
      .from('shopping_list_items')
      .insert({
        shopping_list_id: body.shopping_list_id,
        name: body.name,
        normalized_name: normalizeIngredientName(body.name),
        quantity: body.quantity ?? null,
        unit: body.unit ?? null,
        category: 'other',
        sources: [],
        checked: false,
        user_added: true,
      })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);

    return c.json({ data: item }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add item';
    return c.json({ error: message }, 500);
  }
});

/**
 * PATCH /items/:id — update checked/quantity/name/unit (whitelist).
 */
shopping.patch('/items/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const patch = pickPatchFields(body);
  if (Object.keys(patch).length === 0) {
    return c.json({ error: 'no valid fields to update' }, 400);
  }

  try {
    // RLS enforces profile scoping via shopping_lists join.
    const { data: item, error } = await supabase
      .from('shopping_list_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    if (!item) return c.json({ error: 'not found' }, 404);

    return c.json({ data: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update item';
    return c.json({ error: message }, 500);
  }
});

/**
 * DELETE /items/:id — remove an item.
 */
shopping.delete('/items/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  try {
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.body(null, 204);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete item';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:id/order — call Instacart, persist shopping_orders row, return URL.
 * Filters out checked items. Only unchecked items become line_items.
 */
shopping.post('/:id/order', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const { data: list, error: listErr } = await supabase
      .from('shopping_lists')
      .select()
      .eq('id', id)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (listErr) return c.json({ error: listErr.message }, 500);
    if (!list) return c.json({ error: 'shopping list not found' }, 404);

    const { data: itemsRaw, error: itemsErr } = await supabase
      .from('shopping_list_items')
      .select()
      .eq('shopping_list_id', list.id);
    if (itemsErr) return c.json({ error: itemsErr.message }, 500);

    const items = (itemsRaw ?? []) as ShoppingListItem[];
    const unchecked = items.filter((i) => !i.checked);

    const lineItems: InstacartLineItem[] = unchecked.map((item) => {
      // Skip the per-line measurement for spices and condiments — pinning
      // "0.5 tsp oregano" or "2 tbsp dijon" makes Instacart show fractional
      // quantities that don't map to retail SKUs (you buy a jar of oregano,
      // not 0.5 tsp), and it inflates the cart math.
      const isSpiceOrCondiment =
        item.category === 'condiment' || isSpiceItem(item.name);
      const hasMeasurement =
        item.quantity != null && item.unit != null && item.unit !== '';
      const sendMeasurement = hasMeasurement && !isSpiceOrCondiment;
      return {
        name: item.name,
        line_item_measurements: sendMeasurement
          ? [{ quantity: item.quantity as number, unit: item.unit as string }]
          : undefined,
      };
    });

    let productsUrl: string;
    try {
      const client = getInstacartClient();
      const result = await client.createShoppingListPage({
        title: list.title,
        line_items: lineItems,
        expires_in: 30,
        partner_linkback_url: 'dinnertime://shopping/done',
      });
      productsUrl = result.products_link_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'instacart error';
      return c.json({ code: 'INSTACART_ERROR', error: message }, 502);
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: order, error: orderErr } = await supabase
      .from('shopping_orders')
      .insert({
        profile_id: user.id,
        shopping_list_id: list.id,
        items_snapshot: lineItems,
        instacart_url: productsUrl,
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (orderErr) return c.json({ error: orderErr.message }, 500);

    return c.json({ data: { url: productsUrl, order_id: order.id } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to place order';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /orders/:id/reorder — create a NEW shopping list seeded from order snapshot.
 * CRITICAL: never returns the old Instacart URL (Pitfall 4). Always builds a fresh list.
 */
shopping.post('/orders/:id/reorder', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const { data: order, error: orderErr } = await supabase
      .from('shopping_orders')
      .select()
      .eq('id', id)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (orderErr) return c.json({ error: orderErr.message }, 500);
    if (!order) return c.json({ error: 'order not found' }, 404);

    const snapshot = (order.items_snapshot ?? []) as InstacartLineItem[];
    const title = `Reorder — ${order.placed_at}`;

    const { data: listRow, error: listErr } = await supabase
      .from('shopping_lists')
      .insert({
        profile_id: user.id,
        meal_plan_id: null,
        title,
      })
      .select()
      .single();
    if (listErr) return c.json({ error: listErr.message }, 500);
    const list = listRow as ShoppingList;

    const itemRows = snapshot.map((snap) => {
      const measurement = snap.line_item_measurements?.[0];
      return {
        shopping_list_id: list.id,
        name: snap.name,
        normalized_name: normalizeIngredientName(snap.name),
        quantity: measurement?.quantity ?? null,
        unit: measurement?.unit ?? null,
        category: 'other' as GroceryCategory,
        sources: [],
        checked: false,
        user_added: false,
      };
    });

    let insertedItems: ShoppingListItem[] = [];
    if (itemRows.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from('shopping_list_items')
        .insert(itemRows)
        .select();
      if (itemsErr) return c.json({ error: itemsErr.message }, 500);
      insertedItems = (itemsData ?? []) as ShoppingListItem[];
    }

    return c.json({ data: { ...list, items: insertedItems } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reorder';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /orders/:id/variations — Claude Haiku swap suggestions for an order.
 */
shopping.post('/orders/:id/variations', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const { data: order, error: orderErr } = await supabase
      .from('shopping_orders')
      .select()
      .eq('id', id)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (orderErr) return c.json({ error: orderErr.message }, 500);
    if (!order) return c.json({ error: 'order not found' }, 404);

    const snapshot = (order.items_snapshot ?? []) as InstacartLineItem[];
    const items: ConsolidatedItem[] = snapshot.map((snap) => {
      const measurement = snap.line_item_measurements?.[0];
      return {
        name: snap.name,
        normalizedName: normalizeIngredientName(snap.name),
        quantity: measurement?.quantity ?? 1,
        unit: measurement?.unit ?? null,
        sources: [],
      };
    });

    const variations = await suggestVariations(items);
    return c.json({ data: variations });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compute variations';
    return c.json({ error: message }, 500);
  }
});

// Unused helper re-export guard (keeps tree-shaker happy if ever imported)
export { errorWithCode };

export default shopping;
