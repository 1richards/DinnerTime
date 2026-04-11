import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const ai = new Hono();

ai.use('*', authMiddleware);

ai.post('/suggest', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

export default ai;
