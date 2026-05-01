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
  get ELEVENLABS_API_KEY() {
    return requireEnv('ELEVENLABS_API_KEY');
  },
  get ELEVENLABS_VOICE_ID() {
    // Daniel — British male. Reverted from Brian (American) per UAT
    // 2026-05-01. The elevenlabs.ts wrapper has the same fallback so
    // a missing env still lands on the British voice.
    return optionalEnv('ELEVENLABS_VOICE_ID', 'onwK4e9ZLuTAKqWW03F9');
  },
  get PORT() {
    return parseInt(optionalEnv('PORT', '3000'), 10);
  },
  /**
   * Phase 25-01 (BETA-11): comma-separated list of admin emails authorized
   * to hit GET /admin/beta-invites. Parsed case-insensitively (lowercased,
   * trimmed, empty filtered). Empty string / unset → no admin access, which
   * is the safe default for a plain dev environment.
   */
  get ADMIN_EMAILS_LIST(): string[] {
    return (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
} as const;
