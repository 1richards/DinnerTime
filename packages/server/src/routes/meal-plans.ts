import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const mealPlans = new Hono();

mealPlans.use('*', authMiddleware);

mealPlans.get('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

mealPlans.post('/', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

export default mealPlans;
