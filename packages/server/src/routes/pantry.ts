import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const pantry = new Hono();

pantry.use('*', authMiddleware);

pantry.get('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

pantry.post('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

export default pantry;
