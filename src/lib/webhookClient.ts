import WEBHOOK_CONFIG from "@/config/webhook";
import { supabase } from "@/lib/supabase";

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
  const headers = new Headers(init.headers as HeadersInit | undefined);
  const requiresAuth = !forceLegacy && WEBHOOK_CONFIG.isProxyEndpoint(endpoint);

  if (requiresAuth && !skipAuth && !headers.has("Authorization")) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error("Unable to call webhook without an active Supabase session");
    }

    headers.set("Authorization", `Bearer ${token}`);

    const anonKey = getAnonKey();
    if (anonKey && !headers.has("apikey")) {
      headers.set("apikey", anonKey);
    }
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

export function buildWebhookUrl(endpoint: string, opts?: { forceLegacy?: boolean }): string {
  return WEBHOOK_CONFIG.buildUrl(endpoint, opts);
}

