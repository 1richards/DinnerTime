import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const env = {
  get SUPABASE_URL() {
    return requireEnv('SUPABASE_URL');
  },
  get SUPABASE_ANON_KEY() {
    return requireEnv('SUPABASE_ANON_KEY');
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  },
  get ANTHROPIC_API_KEY() {
    return requireEnv('ANTHROPIC_API_KEY');
  },
  get GOOGLE_API_KEY() {
    return requireEnv('GOOGLE_API_KEY');
  },
  get PORT() {
    return parseInt(optionalEnv('PORT', '3000'), 10);
  },
} as const;
