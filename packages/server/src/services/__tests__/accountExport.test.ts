/**
 * Phase 23-02: buildExportDump — aggregates a user's rows across 5 tables
 * into a single JSON payload for GET /account/export (NFR-03).
 *
 * The service runs 5 parallel queries filtered by profile_id == userId and
 * returns a stable shape { profile, pantry, recipes, meal_plans, cook_history,
 * exported_at }. Mobile writes the payload to disk and opens the share sheet.
 *
 * RLS is the real enforcement layer for cross-profile leaks (profiles,
 * pantry_items, recipes, meal_plans, recipe_cooks all enforce auth.uid() =
 * profile_id SELECT); the service belt-and-suspenders by ALSO passing
 * `.eq('profile_id', userId)` on every row query — so even a misconfigured
 * RLS policy or an accidental service-role client can't leak cross-user rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildExportDump } from '../accountExport.js';

// ---------- Chainable Supabase mock ----------

type Resp = { data: unknown; error: unknown };

function makeChain(resolved: Resp) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const chain: any = {
    calls,
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(resolved).then(onFulfilled, onRejected);
    },
  };
  const methods = ['select', 'eq', 'single', 'order', 'maybeSingle', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      return chain;
    });
  }
  return chain;
}

function makeSupabase(byTable: Record<string, Resp>) {
  const chains: Record<string, any> = {};
  return {
    chains,
    client: {
      from: vi.fn((table: string) => {
        const chain = makeChain(byTable[table] ?? { data: null, error: null });
        chains[table] = chain;
        return chain;
      }),
    } as any,
  };
}

describe('buildExportDump', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries all 5 expected tables with profile_id filter', async () => {
    const { client, chains } = makeSupabase({
      profiles: { data: { id: 'user-1', name: 'Pat' }, error: null },
      pantry_items: { data: [{ id: 'p1' }], error: null },
      recipes: { data: [{ id: 'r1' }], error: null },
      meal_plans: { data: [{ id: 'm1' }], error: null },
      recipe_cooks: { data: [{ id: 'c1' }], error: null },
    });

    await buildExportDump(client, 'user-1');

    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(client.from).toHaveBeenCalledWith('pantry_items');
    expect(client.from).toHaveBeenCalledWith('recipes');
    expect(client.from).toHaveBeenCalledWith('meal_plans');
    expect(client.from).toHaveBeenCalledWith('recipe_cooks');

    // Every row-returning table filters by profile_id == userId (RLS belt +
    // suspenders so a service-role client can't accidentally leak).
    for (const t of ['pantry_items', 'recipes', 'meal_plans', 'recipe_cooks']) {
      const chain = chains[t];
      const eqCall = chain.calls.find(
        (c: any) => c.method === 'eq' && c.args[0] === 'profile_id',
      );
      expect(eqCall, `${t} must filter by profile_id`).toBeDefined();
      expect(eqCall.args[1]).toBe('user-1');
    }

    // profiles is single-row lookup keyed by id
    const profilesChain = chains['profiles'];
    const profilesEq = profilesChain.calls.find(
      (c: any) => c.method === 'eq' && c.args[0] === 'id',
    );
    expect(profilesEq).toBeDefined();
    expect(profilesEq.args[1]).toBe('user-1');
  });

  it('returns the canonical shape { profile, pantry, recipes, meal_plans, cook_history, exported_at }', async () => {
    const { client } = makeSupabase({
      profiles: { data: { id: 'user-1', name: 'Pat' }, error: null },
      pantry_items: { data: [{ id: 'p1' }, { id: 'p2' }], error: null },
      recipes: { data: [{ id: 'r1' }], error: null },
      meal_plans: { data: [{ id: 'm1' }], error: null },
      recipe_cooks: { data: [{ id: 'c1' }, { id: 'c2' }], error: null },
    });

    const dump = await buildExportDump(client, 'user-1');

    expect(dump).toHaveProperty('profile');
    expect(dump).toHaveProperty('pantry');
    expect(dump).toHaveProperty('recipes');
    expect(dump).toHaveProperty('meal_plans');
    expect(dump).toHaveProperty('cook_history');
    expect(dump).toHaveProperty('exported_at');

    expect(dump.profile).toEqual({ id: 'user-1', name: 'Pat' });
    expect(dump.pantry).toHaveLength(2);
    expect(dump.recipes).toHaveLength(1);
    expect(dump.meal_plans).toHaveLength(1);
    expect(dump.cook_history).toHaveLength(2);

    // exported_at must be an ISO-8601 string parseable by new Date().
    expect(typeof dump.exported_at).toBe('string');
    expect(Number.isFinite(Date.parse(dump.exported_at))).toBe(true);
  });

  it('coerces null arrays to [] for pantry / recipes / meal_plans / cook_history', async () => {
    // Supabase returns { data: null, error: {...} } on miss; we want the
    // exported shape to stay array-typed so mobile consumers don't have to
    // branch on null.
    const { client } = makeSupabase({
      profiles: { data: { id: 'user-1' }, error: null },
      pantry_items: { data: null, error: null },
      recipes: { data: null, error: null },
      meal_plans: { data: null, error: null },
      recipe_cooks: { data: null, error: null },
    });

    const dump = await buildExportDump(client, 'user-1');
    expect(dump.pantry).toEqual([]);
    expect(dump.recipes).toEqual([]);
    expect(dump.meal_plans).toEqual([]);
    expect(dump.cook_history).toEqual([]);
  });

  it('runs the 5 queries in parallel (not sequentially)', async () => {
    // Regression guard against an accidental `await` inside a for-loop
    // implementation. If all 5 queries resolve under the same tick when
    // buildExportDump awaits Promise.all, any intermediate microtask in the
    // test can observe all 5 `from(...)` calls before buildExportDump
    // returns.
    const { client } = makeSupabase({
      profiles: { data: {}, error: null },
      pantry_items: { data: [], error: null },
      recipes: { data: [], error: null },
      meal_plans: { data: [], error: null },
      recipe_cooks: { data: [], error: null },
    });

    const p = buildExportDump(client, 'user-1');
    // Run a microtask; if queries were serial, client.from would have been
    // called < 5 times at this point.
    await Promise.resolve();
    await Promise.resolve();
    expect((client.from as any).mock.calls.length).toBe(5);
    await p;
  });
});
