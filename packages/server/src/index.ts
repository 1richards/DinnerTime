import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import auth from './routes/auth.js';
import recipes from './routes/recipes.js';
import pantry from './routes/pantry.js';
import mealPlans from './routes/meal-plans.js';
import shopping from './routes/shopping.js';
import ai from './routes/ai.js';
import voice from './routes/voice.js';
import cooking from './routes/cooking.js';

const app = new Hono().basePath('/api/v1');

// Global middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Mount routes
app.route('/auth', auth);
app.route('/recipes', recipes);
app.route('/pantry', pantry);
app.route('/meal-plans', mealPlans);
app.route('/shopping', shopping);
app.route('/ai', ai);
app.route('/voice', voice);
app.route('/cooking', cooking);

// Start server (only when not imported for testing)
if (process.env.NODE_ENV !== 'test') {
  const port = env.PORT;
  console.log(`Server starting on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export { app };
