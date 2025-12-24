/**
 * Centralized Supabase configuration (Vite).
 *
 * Prefer setting these as environment variables in Netlify / local `.env`:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
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

export const SUPABASE_URL: string = trimTrailingSlash(
  (env?.VITE_SUPABASE_URL as string | undefined) || (import.meta.env.PROD ? PROD_URL : DEV_URL)
);

export const SUPABASE_ANON_KEY: string =
  (env?.VITE_SUPABASE_ANON_KEY as string | undefined) || (import.meta.env.PROD ? PROD_ANON_KEY : DEV_ANON_KEY);


