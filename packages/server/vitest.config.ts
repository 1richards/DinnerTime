import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load root .env so integration tests can reach the real Supabase and server
function loadDotEnv(): Record<string, string> {
  try {
    const envPath = resolve(__dirname, '../../.env');
    const content = readFileSync(envPath, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      vars[key] = val;
    }
    return vars;
  } catch {
    return {};
  }
}

const dotEnv = loadDotEnv();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    // Allow individual test files up to 120s for AI-backed routes
    testTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      ...dotEnv,
    },
  },
});
