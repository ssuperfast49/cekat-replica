// Simple n8n webhook proxy for Supabase Edge
// - Requires authenticated Supabase user (gateway verifies JWT)
// - Looks up route config in Postgres
// - HMAC-signs raw body and forwards to n8n
// - Adds CORS and supports preflight
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ===== Env =====
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FUNCTION_SLUG = Deno.env.get("WEBHOOK_PROXY_SLUG") || "n8n-proxy";
// ===== Supabase client (service role, no RLS) =====
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: {
    persistSession: false
  }
});
// ===== CORS =====
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-timestamp, x-nonce, x-key-id, x-signature",
  "Access-Control-Max-Age": "86400"
};
function withCors(headers) {
  const h = new Headers(headers || {});
  for (const [k, v] of Object.entries(corsHeaders))h.set(k, v);
  return h;
}
// ===== HMAC helper: hex(HMAC-SHA256(body)) =====
async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, body);
  return [
    ...new Uint8Array(sig)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
// ===== Route lookup =====
async function getRoute(routeKey) {
  const { data, error } = await sb.from("n8n_webhook_routes").select("n8n_url, secret_current, key_version, enabled").eq("route_key", routeKey).single();
  if (error || !data || !data.enabled) return null;
  return data;
}
// ===== Route key extractor =====
// URL examples:
//  - /functions/v1/n8n-proxy/telegram.send_message
//  - /functions/v1/n8n-proxy/some-other-key
function extractRouteKey(urlStr) {
  const url = new URL(urlStr);
  const parts = url.pathname.split("/").filter(Boolean);
  // Find the function slug and take the segment after it
  const slugIdx = parts.indexOf(FUNCTION_SLUG);
  if (slugIdx >= 0 && slugIdx + 1 < parts.length) {
    return parts[slugIdx + 1];
  }
  // Fallback: last segment
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
// ===== Allowed HTTP methods =====
const ALLOWED_METHODS = new Set([
  "POST",
  "GET",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS"
]);
// ===== Entry point =====
Deno.serve(async (req)=>{
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: withCors()
    });
  }
  // Method guard
  if (!ALLOWED_METHODS.has(req.method)) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: withCors()
    });
  }
  try {
    // 1) Require Authorization header (Supabase gateway already verified JWT)
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response("Missing token", {
        status: 401,
        headers: withCors()
      });
    }
    // 2) Extract route key from URL
    const routeKey = extractRouteKey(req.url);
    if (!routeKey) {
      return new Response("Missing routeKey", {
        status: 400,
        headers: withCors()
      });
    }
    // 3) Load route config from Postgres
    const route = await getRoute(routeKey);
    if (!route) {
      return new Response("Route not found", {
        status: 404,
        headers: withCors()
      });
    }
    // 4) Read raw body exactly as received
    const raw = new Uint8Array(await req.arrayBuffer());
    // 5) Compute HMAC signature
    const ts = Date.now().toString();
    const nonce = crypto.randomUUID();
    const signature = await hmacHex(route.secret_current, raw);
    const keyId = `${routeKey}:${route.key_version}`;
    // 6) Build n8n upstream URL (preserve query string)
    const incomingUrl = new URL(req.url);
    const upstreamUrl = new URL(route.n8n_url);
    upstreamUrl.search = incomingUrl.search;
    // 7) Forward to n8n
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : raw;
    const upstream = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/octet-stream",
        "x-timestamp": ts,
        "x-nonce": nonce,
        "x-key-id": keyId,
        "x-signature": signature
      },
      body
    });
    // 8) Return n8n response back to client (with CORS)
    const respBody = await upstream.arrayBuffer();
    const headers = withCors(upstream.headers);
    return new Response(respBody, {
      status: upstream.status,
      headers
    });
  } catch (err) {
    console.error("[n8n-proxy] error:", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: withCors()
    });
  }
});
