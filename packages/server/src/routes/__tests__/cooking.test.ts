import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Cooking Q&A route tests.
 *
 * Mocks @anthropic-ai/sdk default export (the SDK itself, NOT the config
 * wrapper) per Phase 08-02 decision. The mock captures messages.create
 * calls so we can assert prompt contents.
 */
const {
  mockMessagesCreate,
  mockAuthMiddleware,
  supabase,
  tableState,
} = vi.hoisted(() => {
  type Resp = { data: unknown; error: unknown };
  const tableState: Record<
    string,
    {
      maybeSingleResult?: Resp;
      singleResult?: Resp;
    }
  > = {};

  function makeBuilder(table: string) {
    const s = tableState[table] ?? {};
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => s.maybeSingleResult ?? { data: null, error: null }),
      single: vi.fn(async () => s.singleResult ?? { data: null, error: null }),
    };
    return builder;
  }

  const supabase = {
    from: vi.fn((table: string) => makeBuilder(table)),
  };

  return {
    mockMessagesCreate: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) return c.json({ error: 'Missing auth' }, 401);
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    supabase,
    tableState,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate };
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic };
});

const { default: cooking } = await import('../cooking.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/cooking', cooking);
  return app;
}

function resetTables() {
  for (const k of Object.keys(tableState)) delete tableState[k];
}

function setTable(name: string, cfg: any) {
  tableState[name] = cfg;
}

function claudeTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
  };
}

const RECIPE_ROW = {
  id: 'recipe-1',
  profile_id: 'user-1',
  title: 'Buttermilk Pancakes',
  ingredients: [
    { name: 'flour', quantity: 2, unit: 'cup' },
    { name: 'buttermilk', quantity: 1, unit: 'cup' },
    { name: 'egg', quantity: 2, unit: null },
  ],
  steps: [
    'Whisk dry ingredients.',
    'Add wet ingredients and stir until just combined.',
    'Cook on a hot griddle until bubbles form.',
  ],
};

describe('cooking routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
  });

  it('returns 401 without auth', async () => {
    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: 'recipe-1',
        current_step_index: 0,
        question: 'what now?',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('200 happy path: returns answer, injects recipe context and short-answer rule', async () => {
    setTable('recipes', {
      maybeSingleResult: { data: RECIPE_ROW, error: null },
    });
    mockMessagesCreate.mockResolvedValue(
      claudeTextResponse('Use one cup of milk with a tablespoon of vinegar.')
    );

    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: 'recipe-1',
        current_step_index: 1,
        question: "what's a substitute for buttermilk?",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toBe('Use one cup of milk with a tablespoon of vinegar.');

    // Assert Claude call shape
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const call = mockMessagesCreate.mock.calls[0][0];
    expect(call.model).toBe('claude-sonnet-4-latest');
    expect(call.max_tokens).toBe(200);

    // System prompt must contain recipe title, current step text, ingredient, and short-answer rule verbatim
    expect(call.system).toContain('Buttermilk Pancakes');
    expect(call.system).toContain('Add wet ingredients and stir until just combined.');
    expect(call.system).toContain('buttermilk');
    expect(call.system).toContain(
      'Answers MUST be 1-3 sentences, spoken conversationally, no markdown, no bullet lists, no preamble.'
    );

    // User message is verbatim question
    expect(call.messages).toEqual([
      { role: 'user', content: "what's a substitute for buttermilk?" },
    ]);
  });

  it('404 when recipe not found or not owned by user', async () => {
    setTable('recipes', {
      maybeSingleResult: { data: null, error: null },
    });

    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: 'nope',
        current_step_index: 0,
        question: 'hi',
      }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('RECIPE_NOT_FOUND');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('400 when required body fields missing', async () => {
    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: 'recipe-1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_REQUEST');
  });

  it('400 on invalid JSON body', async () => {
    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('502 CLAUDE_ERROR when Anthropic throws', async () => {
    setTable('recipes', {
      maybeSingleResult: { data: RECIPE_ROW, error: null },
    });
    mockMessagesCreate.mockRejectedValueOnce(new Error('boom'));

    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: 'recipe-1',
        current_step_index: 0,
        question: 'why?',
      }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('CLAUDE_ERROR');
  });

  it('truncates answers longer than 300 chars (belt-and-suspenders)', async () => {
    setTable('recipes', {
      maybeSingleResult: { data: RECIPE_ROW, error: null },
    });
    const longAnswer = 'a'.repeat(500);
    mockMessagesCreate.mockResolvedValue(claudeTextResponse(longAnswer));

    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: 'recipe-1',
        current_step_index: 0,
        question: 'tell me a long story',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer.length).toBe(300);
    expect(body.answer.endsWith('...')).toBe(true);
  });

  // ----------------------------------------------------------
  // GET /cooking/tips (Phase 10-03)
  // ----------------------------------------------------------

  describe('GET /tips', () => {
    it('401 without auth', async () => {
      const app = makeApp();
      const res = await app.request(
        '/cooking/tips?recipe_id=recipe-1&step_index=0&step_text=Whisk',
        { method: 'GET' }
      );
      expect(res.status).toBe(401);
    });

    it('400 when recipe_id missing', async () => {
      const app = makeApp();
      const res = await app.request(
        '/cooking/tips?step_index=0&step_text=Whisk',
        { method: 'GET', headers: { Authorization: 'Bearer t' } }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_REQUEST');
    });

    it('400 when step_index missing or non-numeric', async () => {
      const app = makeApp();
      const res = await app.request(
        '/cooking/tips?recipe_id=recipe-1&step_text=Whisk',
        { method: 'GET', headers: { Authorization: 'Bearer t' } }
      );
      expect(res.status).toBe(400);
    });

    it('404 when recipe not owned by user', async () => {
      setTable('recipes', {
        maybeSingleResult: { data: null, error: null },
      });
      const app = makeApp();
      const res = await app.request(
        '/cooking/tips?recipe_id=nope&step_index=0&step_text=Whisk',
        { method: 'GET', headers: { Authorization: 'Bearer t' } }
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('RECIPE_NOT_FOUND');
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it('200 returns cached tip without calling Claude', async () => {
      setTable('recipes', {
        maybeSingleResult: { data: { id: 'recipe-1' }, error: null },
      });
      setTable('recipe_step_tips', {
        maybeSingleResult: { data: { tip: 'cached tip' }, error: null },
      });

      const app = makeApp();
      const res = await app.request(
        '/cooking/tips?recipe_id=recipe-1&step_index=0&step_text=Whisk',
        { method: 'GET', headers: { Authorization: 'Bearer t' } }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tip).toBe('cached tip');
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it('200 returns empty tip when Haiku returns empty (uncertainty)', async () => {
      setTable('recipes', {
        maybeSingleResult: { data: { id: 'recipe-1' }, error: null },
      });
      setTable('recipe_step_tips', {
        maybeSingleResult: { data: null, error: null },
      });
      mockMessagesCreate.mockResolvedValueOnce(claudeTextResponse(''));

      const app = makeApp();
      const res = await app.request(
        '/cooking/tips?recipe_id=recipe-1&step_index=0&step_text=Some+obscure+technique',
        { method: 'GET', headers: { Authorization: 'Bearer t' } }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tip).toBe('');
    });

    it('502 when Anthropic throws on cache miss', async () => {
      setTable('recipes', {
        maybeSingleResult: { data: { id: 'recipe-1' }, error: null },
      });
      setTable('recipe_step_tips', {
        maybeSingleResult: { data: null, error: null },
      });
      mockMessagesCreate.mockRejectedValueOnce(new Error('boom'));

      const app = makeApp();
      const res = await app.request(
        '/cooking/tips?recipe_id=recipe-1&step_index=0&step_text=Whisk',
        { method: 'GET', headers: { Authorization: 'Bearer t' } }
      );
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe('CLAUDE_ERROR');
    });
  });

  it('clamps current_step_index out of range to last step', async () => {
    setTable('recipes', {
      maybeSingleResult: { data: RECIPE_ROW, error: null },
    });
    mockMessagesCreate.mockResolvedValue(claudeTextResponse('ok'));

    const app = makeApp();
    const res = await app.request('/cooking/ask', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: 'recipe-1',
        current_step_index: 999,
        question: 'now?',
      }),
    });
    expect(res.status).toBe(200);

    const call = mockMessagesCreate.mock.calls[0][0];
    // Last step must appear in system prompt
    expect(call.system).toContain('Cook on a hot griddle until bubbles form.');
  });
});
