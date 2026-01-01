/**
 * Centralized Supabase configuration (Vite).
 *
 * Prefer setting these as environment variables in Netlify / local `.env`:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY (required – no hardcoded fallback)
 *
 * Defaults:
 * - DEV  → bkynymyhbfrhvwxqqttk.supabase.co
 * - PROD → api.cssuper.com
 */
const env = (import.meta as any).env ?? {};

const DEV_URL = "https://bkynymyhbfrhvwxqqttk.supabase.co";
const PROD_URL = "https://api.cssuper.com";

// Existing keys were previously hardcoded in-source; keep as fallback to avoid breaking builds.
// Strongly recommend moving to env vars and rotating these keys.
const DEV_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreW55bXloYmZyaHZ3eHFxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Mzk1NzIsImV4cCI6MjA3OTUxNTU3Mn0.4ELI9s6908SdW2jd1BM_ht8pTIyLAwPpsqGiGNCdcC0";
const PROD_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncm14bGJudXR4cGV3Zm1vZmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDY0NzgsImV4cCI6MjA3MDQ4MjQ3OH0.ijDctaGPXK3Ce9uao72YaaYCX9fpPFZGpmrsWp9IfU8";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

/**
 * NOTE ON "dev deploys":
 * Netlify/Vite builds typically run with `import.meta.env.PROD === true` even for branch/previews.
 * To avoid accidentally pointing previews at PROD (and/or mixing URL+key), we:
 * - Prefer explicit VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY if provided
 * - If only one is provided, infer the correct pair based on the URL host
 * - Default to DEV unless the resolved URL clearly targets PROD_URL
 */
const overrideUrlRaw = env?.VITE_SUPABASE_URL as string | undefined;
const overrideKeyRaw = env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const normalizeUrl = (u: string) => trimTrailingSlash(u.trim());

const inferEnvFromUrl = (u: string): 'prod' | 'dev' => {
  const url = normalizeUrl(u);
  // if (url.includes('api.cssuper.com')) return 'prod';
  if (url.includes('tgrmxlbnutxpewfmofdx.supabase.co')) return 'prod';
  if (url.includes('bkynymyhbfrhvwxqqttk.supabase.co')) return 'dev';
  // Unknown host: treat as dev-safe by default.
  return 'dev';
};

// Start with safest default.
let targetEnv: 'prod' | 'dev' = 'dev';
if (overrideUrlRaw) targetEnv = inferEnvFromUrl(overrideUrlRaw);

const defaultUrl = targetEnv === 'prod' ? PROD_URL : DEV_URL;
const defaultKey = targetEnv === 'prod' ? PROD_ANON_KEY : DEV_ANON_KEY;

export const SUPABASE_URL: string = normalizeUrl(overrideUrlRaw || defaultUrl);
export const SUPABASE_ANON_KEY: string = (overrideKeyRaw || defaultKey).trim();


