import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const recipes = new Hono();

recipes.use('*', authMiddleware);

recipes.get('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

recipes.post('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

export default recipes;
