import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const voice = new Hono();

voice.use('*', authMiddleware);

voice.post('/transcribe', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

export default voice;
