import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSuggestions } from '../services/suggestions.js';

const ai = new Hono();

ai.use('*', authMiddleware);

ai.post('/suggest', async (c) => {
  const user = c.get('user');
  const supabase = c.get('supabase');

  try {
    const result = await getSuggestions(supabase, user.id);
    return c.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate suggestions';

    // Return 400 for known validation errors (e.g. not enough pantry items)
    if (message.includes('Not enough pantry items')) {
      return c.json({ error: message }, 400);
    }

    return c.json({ error: message }, 500);
  }
});

export default ai;
