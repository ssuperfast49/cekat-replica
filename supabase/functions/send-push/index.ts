import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@cekat.local";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "..." : s;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return jsonResponse({ error: "vapid_not_configured", message: "Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Edge Function secrets." }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const thread_id: string | undefined = body.thread_id;
  const message_id: string | undefined = body.message_id;
  const message_body: string | null = body.message_body ?? null;
  const sender_user_id: string | null = body.sender_user_id ?? null;

  if (!thread_id || !message_id) {
    return jsonResponse({ error: "missing_fields", required: ["thread_id", "message_id"] }, 400);
  }

  const { data: targets, error } = await supabase.rpc("get_push_targets", {
    p_thread_id: thread_id,
    p_sender_user_id: sender_user_id,
  });

  if (error) return jsonResponse({ error: "resolve_failed", detail: error.message }, 500);
  if (!targets || targets.length === 0) return jsonResponse({ sent: 0, reason: "no_targets" });

  const contactName = targets[0].contact_name || "Unknown User";
  const preview = message_body && typeof message_body === "string" && message_body.trim().length > 0
    ? truncate(message_body.trim(), 80)
    : "Sent an attachment";

  const payload = JSON.stringify({
    title: `New message from ${contactName}`,
    body: preview,
    thread_id,
    message_id,
    url: `/?menu=chat&thread=${thread_id}`,
    icon: "/favicon.ico",
  });

  const sendOne = async (target: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: 60, urgency: "high" as const }
      );
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", target.subscription_id);
      return { ok: true };
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", target.subscription_id);
      }
      return { ok: false, status, message: err?.message };
    }
  };

  const results = await Promise.allSettled(targets.map(sendOne));
  const sent = results.filter((r) => r.status === "fulfilled" && (r.value as any).ok).length;
  const failed = results.length - sent;

  return jsonResponse({ sent, failed, total: results.length });
});
