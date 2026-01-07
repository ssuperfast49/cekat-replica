import WEBHOOK_CONFIG from "@/config/webhook";
import { supabase } from "@/lib/supabase";
import { SUPABASE_URL } from "@/integrations/supabase/client";

type CallWebhookOptions = {
  forceLegacy?: boolean;
  skipAuth?: boolean;
};

const getAnonKey = (): string | null => {
  const env = (import.meta as any).env ?? {};
  return env?.VITE_SUPABASE_ANON_KEY ?? null;
};

export async function callWebhook(endpoint: string, init: RequestInit = {}, options: CallWebhookOptions = {}): Promise<Response> {
  const { forceLegacy = false, skipAuth = false } = options;

  const url = WEBHOOK_CONFIG.buildUrl(endpoint, { forceLegacy });
  const usingProxyBase = url.startsWith(WEBHOOK_CONFIG.PROXY_BASE_URL);
  const effectiveForceLegacy = forceLegacy && !usingProxyBase;
  const headers = new Headers(init.headers as HeadersInit | undefined);
  const isSupabaseFunctionUrl = url.startsWith(SUPABASE_URL) && url.includes("/functions/v1/");
  const requiresAuth =
    (!effectiveForceLegacy && WEBHOOK_CONFIG.isProxyEndpoint(endpoint)) ||
    isSupabaseFunctionUrl ||
    usingProxyBase;

  if (requiresAuth && !skipAuth && !headers.has("Authorization")) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch {
      // ignore session lookup errors; we'll attempt the call without Authorization
    }
  }

  const anonKey = getAnonKey();
  if (anonKey && (requiresAuth || usingProxyBase || isSupabaseFunctionUrl || url.startsWith(SUPABASE_URL)) && !headers.has("apikey")) {
    headers.set("apikey", anonKey);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

export function buildWebhookUrl(endpoint: string, opts?: { forceLegacy?: boolean }): string {
  return WEBHOOK_CONFIG.buildUrl(endpoint, opts);
}

