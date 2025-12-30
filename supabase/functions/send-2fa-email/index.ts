// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }
  let stage = "start";
  try {
    // --- ENV ---
    stage = "env";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const N8N_WEBHOOK_URL = Deno.env.get("N8N_WEBHOOK_URL");
    const N8N_SECRET = Deno.env.get("N8N_SECRET") || ""; // optional
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "yourgmail@gmail.com";
    // --- AUTH ---
    stage = "auth";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user?.id || !user.email) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // --- RPC: create OTP challenge ---
    stage = "rpc";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await admin.schema("public").rpc("create_email_2fa_challenge", {
      p_user: user.id,
      p_ttl_seconds: 600
    });
    if (error) throw {
      stage,
      ...error
    };
    const code = (Array.isArray(data) ? data[0]?.code_plain : data?.code_plain) ?? null;
    if (!code) throw {
      stage,
      message: "no code_plain from RPC"
    };
    // --- EMAIL: send via n8n (Gmail SMTP behind the scenes) ---
    stage = "smtp-webhook";
    const payload = {
      to: user.email,
      from: FROM_EMAIL,
      subject: "Your 2FA Code",
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
    };
    const hookRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...N8N_SECRET ? {
          "X-N8N-Secret": N8N_SECRET
        } : {}
      },
      body: JSON.stringify(payload)
    });
    if (!hookRes.ok) {
      const body = await hookRes.text();
      throw {
        stage,
        message: "n8n webhook failed",
        details: body
      };
    }
    // --- SUCCESS ---
    return new Response(JSON.stringify({
      ok: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    const payload = {
      stage,
      message: e?.message ?? e?.error ?? String(e),
      code: e?.code,
      details: e?.details,
      hint: e?.hint
    };
    console.error("send-2fa-email error:", e);
    return new Response(JSON.stringify({
      error: payload
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
