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
    // ENV
    stage = "env";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SITE_URL = Deno.env.get("SITE_URL"); // e.g. https://app.yourdomain.com
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY || !SITE_URL) {
      return json({
        error: "Missing server env"
      }, 500);
    }
    // AUTH (caller must be logged in; add your own org-admin check if needed)
    stage = "auth";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({
      error: "Unauthorized"
    }, 401);
    const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user?.id) return json({
      error: "Unauthorized"
    }, 401);
    // PAYLOAD
    stage = "payload";
    const body = await req.json();
    const email = String(body?.email || "").trim();
    const super_agent_id = body?.super_agent_id || null;
    const role = String(body?.role || "agent");
    const org_id = body?.org_id || null;
    const expires_at = body?.expires_at || null;
    if (!email) return json({
      error: "email required"
    }, 400);
    if (!org_id) return json({
      error: "org_id required"
    }, 400);
    if (!super_agent_id) return json({
      error: "super_agent_id required"
    }, 400);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    // 0) Check if user exists in auth
    stage = "check_auth_user";
    const { data: existingAuthUser, error: authUserErr } = await admin.auth.admin.getUserByEmail(email);
    if (authUserErr && authUserErr.message !== "User not found") {
      throw {
        stage,
        ...authUserErr
      };
    }
    // 0.1) If auth user exists, check if they already accepted a previous invite
    if (existingAuthUser?.user) {
      const { data: acceptedInvite } = await admin.from("invites").select("id, status").eq("email", email).eq("org_id", org_id).eq("status", "accepted").maybeSingle();
      if (acceptedInvite) {
        return json({
          error: "email already exists"
        }, 409);
      }
    }
    // 1) Find or create an ACTIVE business invite (scoped to org)
    stage = "find_or_create_invite";
    const { data: existing } = await admin.from("invites").select("*").eq("org_id", org_id).eq("super_agent_id", super_agent_id).ilike("email", email).eq("status", "active").maybeSingle();
    let invite = existing;
    if (!invite) {
      const { data: created, error: insErr } = await admin.from("invites").insert([
        {
          email,
          org_id,
          super_agent_id,
          role,
          expires_at: expires_at ?? null,
          status: "active"
        }
      ]).select().single();
      if (insErr) throw {
        stage,
        ...insErr
      };
      invite = created;
    }
    // 2) Send/Resend using Supabase's mailer → triggers your "Invite user" template
    stage = "send_invite";
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(invite.email, {
      redirectTo: `${SITE_URL}/auth/callback?org=${encodeURIComponent(org_id)}`
    });
    if (inviteErr) throw {
      stage,
      ...inviteErr
    };
    // 3) Save invited_user_id (if present)
    const invitedUserId = invited.user?.id ?? null;
    if (invitedUserId) {
      await admin.from("invites").update({
        invited_user_id: invitedUserId
      }).eq("id", invite.id);
    }
    return json({
      ok: true,
      inviteId: invite.id
    });
  } catch (e) {
    console.error("invite-create-or-resend error:", e);
    return json({
      error: {
        stage,
        message: e?.message ?? String(e),
        code: e?.code,
        details: e?.details
      }
    }, 500);
  }
});
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
