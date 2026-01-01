/**
 * Centralized Supabase configuration (Vite).
 *
 * Required environment variables (no in-source fallbacks):
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)
 */
const env = (import.meta as any).env ?? {};

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const resolveEnvValue = (value: string | undefined, name: string): string => {
  const resolved = (value ?? "").trim();
  if (!resolved) {
    throw new Error(`[Supabase config] Missing ${name}. Set ${name} in your environment.`);
  }
  return resolved;
};

export const SUPABASE_URL: string = trimTrailingSlash(
  resolveEnvValue(env?.VITE_SUPABASE_URL, "VITE_SUPABASE_URL"),
);

export const SUPABASE_ANON_KEY: string = resolveEnvValue(
  env?.VITE_SUPABASE_ANON_KEY ?? env?.VITE_SUPABASE_PUBLISHABLE_KEY,
  "VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)",
);


