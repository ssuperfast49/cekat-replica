// Webhook configuration with proxy-aware routing.
// Environment variables:
// - VITE_WEBHOOK_BASE_URL: direct (legacy) WAHA/N8N base URL.
// - VITE_WEBHOOK_PROXY_SLUG: optional override for the proxy function slug.
// - VITE_WEBHOOK_PROXY_BASE_URL: optional explicit base URL for the proxy function.
import { SUPABASE_URL } from "@/integrations/supabase/client";
const env = (import.meta as any).env ?? {};

const LEGACY_BASE_URL = (env?.VITE_WEBHOOK_BASE_URL || "https://primary-production-376c.up.railway.app/webhook").replace(/\/$/, "");

// Build proxy base URL from environment override or Supabase functions endpoint
const PROXY_FUNCTION_SLUG = (env?.VITE_WEBHOOK_PROXY_SLUG || 'proxy-n8n');
const overrideProxyBase = env?.VITE_WEBHOOK_PROXY_BASE_URL as string | undefined;
const resolvedProxyBase = overrideProxyBase
  ? overrideProxyBase.replace(/\/$/, "")
  : `${SUPABASE_URL}/functions/v1/${PROXY_FUNCTION_SLUG}`.replace(/\/$/, "");
const PROXY_BASE_URL = resolvedProxyBase;

const ROUTE_PREFIX = "route:";

const ensureLeadingSlash = (endpoint: string) => endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

const isProxyEndpoint = (endpoint: string) => endpoint.startsWith(ROUTE_PREFIX);
const extractRouteKey = (endpoint: string) => isProxyEndpoint(endpoint) ? endpoint.slice(ROUTE_PREFIX.length) : null;

const isBareSupabaseHost = (urlValue: string): boolean => {
  try {
    const parsed = new URL(urlValue);
    const bareHost = parsed.hostname.endsWith(".supabase.co");
    const path = parsed.pathname || "";
    const hasFunctionsPath = path.includes("/functions/");
    return bareHost && !hasFunctionsPath;
  } catch {
    return false;
  }
};

export const WEBHOOK_CONFIG = {
  // Maintain legacy base for compatibility / fallback use-cases
  BASE_URL: LEGACY_BASE_URL,
  LEGACY_BASE_URL,
  PROXY_BASE_URL,
  ROUTE_PREFIX,

  // Specific endpoints
  ENDPOINTS: {
    // WhatsApp endpoints
    WHATSAPP: {
      GET_LOGIN_QR: `${ROUTE_PREFIX}session.get_login_qr`,
      GET_SESSIONS: "/get_sessions",
      LOGOUT_SESSION: `${ROUTE_PREFIX}session.logout`,
      CREATE_PLATFORM: "/whatsapp/create-platform",
      CREATE_SESSION: `${ROUTE_PREFIX}session.create`,
      DISCONNECT_SESSION: `${ROUTE_PREFIX}session.logout`,
      DELETE_SESSION: `${ROUTE_PREFIX}session.delete`,
    },
    // Telegram endpoints
    TELEGRAM: {
      CREATE_PLATFORM: `${ROUTE_PREFIX}telegram.create_platform`,
      SEND_MESSAGE: `${ROUTE_PREFIX}telegram.send_message`,
      DELETE_WEBHOOK: `${ROUTE_PREFIX}telegram.delete_webhook`,
      VERIFY_TOKEN: `${SUPABASE_URL}/functions/v1/telegram-verify-token`,
    },

    // AI Agent endpoints
    AI_AGENT: {
      CHAT_SETTINGS: `${ROUTE_PREFIX}chat.settings`,
      CHAT_TEST: `${ROUTE_PREFIX}chat.test`,
    },
    // Knowledgebase endpoints
    KNOWLEDGE: {
      FILE_UPLOAD: "/knowledge/file-upload",
      FILE_DELETE: `${ROUTE_PREFIX}knowledge.file_delete`,
    },

    // Message endpoints
    MESSAGE: {
      // Default generic send endpoint
      DEFAULT: "/send-message",
      SEND_MESSAGE: "/send-message",
      // Provider-specific send endpoints
      WHATSAPP_SEND_MESSAGE: `${ROUTE_PREFIX}whatsapp.send_message`,
      TELEGRAM_SEND_MESSAGE: `${ROUTE_PREFIX}telegram.send_message`,
      WEB_SEND_MESSAGE: `${ROUTE_PREFIX}web.send_message`,
    },
  },

  // Helper function to build full URLs based on endpoint type
  buildUrl: (endpoint: string, opts: { forceLegacy?: boolean } = {}): string => {
    if (!endpoint) throw new Error("Endpoint must be provided");
    if (endpoint.startsWith("http")) return endpoint;

    if (isProxyEndpoint(endpoint)) {
      const routeKey = extractRouteKey(endpoint);
      if (!routeKey) throw new Error("Invalid proxy route key");

      const canUseLegacyRoute = Boolean(opts.forceLegacy) && !isBareSupabaseHost(LEGACY_BASE_URL);
      const base = canUseLegacyRoute ? LEGACY_BASE_URL : PROXY_BASE_URL;
      return `${base}/${routeKey}`;
    }

    return `${LEGACY_BASE_URL}${ensureLeadingSlash(endpoint)}`;
  },

  // Helper function to build test URLs (legacy only)
  buildTestUrl: (endpoint: string): string => {
    if (isProxyEndpoint(endpoint)) {
      const routeKey = extractRouteKey(endpoint);
      if (!routeKey) throw new Error("Invalid proxy route key");
      return `${PROXY_BASE_URL}/${routeKey}`;
    }
    const baseUrl = LEGACY_BASE_URL.replace('/webhook', '/webhook-test');
    return `${baseUrl}${ensureLeadingSlash(endpoint)}`;
  },

  isProxyEndpoint,
  extractRouteKey,
};

// Map provider to its send-message route key
const PROVIDER_SEND_PATHS: Record<string, string> = {
  telegram: WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.TELEGRAM_SEND_MESSAGE,
  whatsapp: WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.WHATSAPP_SEND_MESSAGE,
  web: WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.WEB_SEND_MESSAGE,
};

// Setter to switch the active send-message endpoint based on provider
const normalizeProvider = (provider: string | null | undefined): string => {
  const p = (provider || '').toLowerCase();
  if (p === 'wa' || p === 'waha' || p === 'whatsapp_cloud') return 'whatsapp';
  if (p === 'tg' || p === 'tele') return 'telegram';
  return p;
};

export const setSendMessageProvider = (provider: string) => {
  const key = normalizeProvider(provider);
  const newPath = PROVIDER_SEND_PATHS[key] || WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.DEFAULT;
  WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.SEND_MESSAGE = newPath;
};

// Compute the send-message endpoint without mutating global state
export const resolveSendMessageEndpoint = (provider: string | null | undefined): string => {
  const key = normalizeProvider(provider);
  return PROVIDER_SEND_PATHS[key] || WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.DEFAULT;
};

export default WEBHOOK_CONFIG;
