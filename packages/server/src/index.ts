import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import { requestLoggingMiddleware } from './middleware/requestLogging.js';
import auth from './routes/auth.js';
import recipes from './routes/recipes.js';
import pantry from './routes/pantry.js';
import mealPlans from './routes/meal-plans.js';
import shopping from './routes/shopping.js';
import ai from './routes/ai.js';
import voice from './routes/voice.js';
import cooking from './routes/cooking.js';
import progression from './routes/progression.js';
import telemetry from './routes/telemetry.js';
import account from './routes/account.js';
import feedback from './routes/feedback.js';
import { rateLimitErrorHandler } from './middleware/rateLimitErrors.js';

const app = new Hono().basePath('/api/v1');

// Global middleware
// Phase 23-06 (NFR-16): structured JSON request logger. Replaces Hono's
// built-in `logger()` (human-readable) with a single JSON line per request
// carrying ts/request_id/profile_id/method/path/status/latency_ms. Mount
// FIRST so it wraps auth 401s too.
app.use('*', requestLoggingMiddleware);
app.use('*', cors());

// Global error handler — rewrites upstream 429 / 5xx Anthropic errors
// into a stable user-facing JSON envelope (NFR-14). Must be registered
// after `app.use(...)` middleware but independent of route mount order.
app.onError((err, c) => rateLimitErrorHandler(err, c));

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
app.route('/progression', progression);
app.route('/telemetry', telemetry);
app.route('/account', account);
// Phase 25-01: feedback router declares BOTH /feedback and /admin/beta-invites
// internally, so mount at root.
app.route('/', feedback);

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
