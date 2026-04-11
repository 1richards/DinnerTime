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
  get PORT() {
    return parseInt(optionalEnv('PORT', '3000'), 10);
  },
} as const;
