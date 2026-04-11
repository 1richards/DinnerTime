import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const shopping = new Hono();

shopping.use('*', authMiddleware);

shopping.get('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

shopping.post('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

export default shopping;
