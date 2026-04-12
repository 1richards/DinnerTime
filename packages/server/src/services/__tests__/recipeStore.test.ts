import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRecipes,
  updateRecipe,
  deleteRecipe,
} from '../recipeStore.js';

// ---------- Chainable Supabase mock helpers ----------

/**
 * Creates a chainable thenable object that records calls and ultimately
 * resolves to { data, error } when awaited.
 *
 * Each chain method records its name + args on `calls` and returns the same
 * thenable so you can assert the entire call chain.
 */
function makeChain(resolved: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const chain: any = {
    calls,
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(resolved).then(onFulfilled, onRejected);
    },
  };
  const methods = [
    'select',
    'eq',
    'ilike',
    'order',
    'update',
    'delete',
    'single',
    'maybeSingle',
    'limit',
    'insert',
  ];
  for (const m of methods) {
    chain[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      return chain;
    });
  }
  return chain;
}

function makeSupabase(chain: any) {
  return {
    from: vi.fn(() => chain),
  } as any;
}

// ---------- getRecipes with options ----------

describe('getRecipes with options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user recipes ordered by created_at desc (no options)', async () => {
    const rows = [{ id: 'r1' }, { id: 'r2' }];
    const chain = makeChain({ data: rows, error: null });
    const supabase = makeSupabase(chain);

    const result = await getRecipes(supabase, 'user-1');

    expect(supabase.from).toHaveBeenCalledWith('recipes');
    expect(chain.select).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.ilike).not.toHaveBeenCalled();
    expect(result).toEqual(rows);
  });

  it('applies ilike on title when q is provided', async () => {
    const chain = makeChain({ data: [], error: null });
    const supabase = makeSupabase(chain);

    await getRecipes(supabase, 'user-1', { q: 'pasta' });

    expect(chain.ilike).toHaveBeenCalledWith('title', '%pasta%');
  });

  it('escapes wildcard characters in q (% and _ and backslash)', async () => {
    const chain = makeChain({ data: [], error: null });
    const supabase = makeSupabase(chain);

    await getRecipes(supabase, 'user-1', { q: '50%_off\\' });

    // % -> \% , _ -> \_ , \ -> \\
    expect(chain.ilike).toHaveBeenCalledWith('title', '%50\\%\\_off\\\\%');
  });

  it('applies eq on is_favorite when favoritesOnly is true', async () => {
    const chain = makeChain({ data: [], error: null });
    const supabase = makeSupabase(chain);

    await getRecipes(supabase, 'user-1', { favoritesOnly: true });

    expect(chain.eq).toHaveBeenCalledWith('is_favorite', true);
  });

  it('combines q and favoritesOnly', async () => {
    const chain = makeChain({ data: [], error: null });
    const supabase = makeSupabase(chain);

    await getRecipes(supabase, 'user-1', { q: 'soup', favoritesOnly: true });

    expect(chain.ilike).toHaveBeenCalledWith('title', '%soup%');
    expect(chain.eq).toHaveBeenCalledWith('is_favorite', true);
  });

  it('throws when supabase returns an error', async () => {
    const chain = makeChain({ data: null, error: { message: 'boom' } });
    const supabase = makeSupabase(chain);

    await expect(getRecipes(supabase, 'user-1')).rejects.toThrow(/boom/);
  });
});

// ---------- updateRecipe ----------

describe('updateRecipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates whitelisted patch and returns updated row', async () => {
    const row = { id: 'r1', title: 'New' };
    const chain = makeChain({ data: row, error: null });
    const supabase = makeSupabase(chain);

    const patch = { title: 'New', is_favorite: true };
    const result = await updateRecipe(supabase, 'user-1', 'r1', patch);

    expect(supabase.from).toHaveBeenCalledWith('recipes');
    expect(chain.update).toHaveBeenCalledWith(patch);
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1');
    expect(chain.eq).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(chain.select).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it('returns null when row not found (PGRST116)', async () => {
    const chain = makeChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    const supabase = makeSupabase(chain);

    const result = await updateRecipe(supabase, 'user-1', 'missing', { title: 'X' });
    expect(result).toBeNull();
  });

  it('throws on non-PGRST116 errors', async () => {
    const chain = makeChain({ data: null, error: { code: 'OTHER', message: 'db fail' } });
    const supabase = makeSupabase(chain);

    await expect(
      updateRecipe(supabase, 'user-1', 'r1', { title: 'X' })
    ).rejects.toThrow(/db fail/);
  });
});

// ---------- deleteRecipe ----------

describe('deleteRecipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes row scoped by id and profile_id', async () => {
    const chain = makeChain({ data: null, error: null });
    const supabase = makeSupabase(chain);

    await deleteRecipe(supabase, 'user-1', 'r1');

    expect(supabase.from).toHaveBeenCalledWith('recipes');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1');
    expect(chain.eq).toHaveBeenCalledWith('profile_id', 'user-1');
  });

  it('throws when supabase returns an error', async () => {
    const chain = makeChain({ data: null, error: { message: 'nope' } });
    const supabase = makeSupabase(chain);

    await expect(deleteRecipe(supabase, 'user-1', 'r1')).rejects.toThrow(/nope/);
  });
});
