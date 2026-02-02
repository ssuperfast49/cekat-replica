/**
 * Centralized URL/base configuration.
 *
 * - Keep deploy-domain differences out of components.
 * - Allow overrides via Vite env vars (VITE_*).
 *
 * Env overrides:
 * - VITE_APP_ORIGIN: override the SPA origin (no trailing slash)
 * - VITE_WAHA_BASE_URL: override WAHA base (no trailing slash)
 */
const env = (import.meta as any).env ?? {};

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

/**
 * Public app origin used for deep links / embeds.
 *
 * Production default is the new Netlify site:
 * `synkaai.netlify.app`
 */
export const APP_ORIGIN: string = (() => {
  const override = env?.VITE_APP_ORIGIN as string | undefined;
  if (override) return trimTrailingSlash(override);

  return "https://synkaai.netlify.app";
})();

/**
 * Convenience deep link to the "assigned" admin tab (as requested).
 */
export const ADMIN_ASSIGNED_URL = `${APP_ORIGIN}/?tab=assigned&menu=admin`;

/**
 * LiveChat deep link builder.
 * Note: we intentionally do NOT encode `platformId` so placeholders like `{platform_id}`
 * remain readable when shown to users.
 */
export const livechatUrl = (platformId: string) => `${APP_ORIGIN}/livechat/${platformId}`;

/**
 * WAHA service base URL.
 */
export const WAHA_BASE_URL: string = (() => {
  const override = env?.VITE_WAHA_BASE_URL as string | undefined;
  return trimTrailingSlash(override || "https://waha-plus-production-97c1.up.railway.app");
})();


