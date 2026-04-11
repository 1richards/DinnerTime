import { Hono } from 'hono';

const auth = new Hono();

auth.post('/signup', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

auth.post('/login', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

auth.post('/logout', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

export default auth;
