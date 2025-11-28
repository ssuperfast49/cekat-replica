import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const INVITE_TTL_DAYS = 7;
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const body = await req.json();
    const { email, full_name, role, super_agent_id = null, org_id = null } = body;
    if (!email || !role) return jerr("email and role are required", 400);
    if (role === "agent" && !super_agent_id) {
      return jerr("super_agent_id is required for agent role", 400);
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SITE_URL = Deno.env.get("SITE_URL") || "";
    if (!SUPABASE_URL || !SERVICE_ROLE) return jerr("Missing service configuration", 500);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const orgId = org_id ?? DEFAULT_ORG;
    const normalizedEmail = String(email).trim().toLowerCase();
    // --- (A) Look up / create persistent invite in user_invites -----------------
    const roleRow = await getRoleRow(admin, role);
    const inviteRow = await upsertUserInvite({
      admin,
      orgId,
      email: normalizedEmail,
      roleId: roleRow.id,
      fullName: full_name ?? null,
      assignedSuperAgentId: role === "agent" ? super_agent_id : null,
      ttlDays: INVITE_TTL_DAYS
    });
    // --- (B) Send Supabase email invite (or reconcile if user exists) ----------
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: SITE_URL ? `${SITE_URL}/auth/callback` : undefined,
      data: {
        full_name
      }
    });
    let userId = invited?.user?.id ?? null;
    if (inviteErr && !userId) {
      // Try find existing user
      const { data: existing, error: getErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        email: normalizedEmail
      });
      if (getErr) return jerr(getErr.message || "Failed to check existing user", 400);
      const u = existing?.users?.[0];
      if (!u) return jerr(inviteErr.message || "Failed to create user", 400);
      if (!u.email_confirmed_at) {
        // Delete zombie/pending auth user, re-invite
        const { error: delErr } = await admin.rpc("delete_auth_user", {
          user_uuid: u.id
        });
        if (delErr) return jerr(delErr.message || "Failed to delete pending user", 400);
        const res2 = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
          redirectTo: SITE_URL ? `${SITE_URL}/auth/callback` : undefined,
          data: {
            full_name
          }
        });
        if (res2.error) return jerr(res2.error.message || "Failed to re-invite", 400);
        userId = res2.data.user?.id ?? null;
      } else {
        // Already confirmed user → treat as existing member
        userId = u.id;
      // Optional: you can mark the invite "accepted" here if you want,
      // but typically you'd flip status on real acceptance callback.
      }
    }
    if (!userId) return jerr("No user id", 400);
    // --- (C) Ensure profile -----------------------------------------------------
    {
      const { error } = await admin.from("users_profile").upsert({
        user_id: userId,
        display_name: full_name ?? null,
        timezone: "Asia/Jakarta",
        password_set: false
      });
      if (error) return jerr(error.message, 400);
    }
    // --- (D) Assign role --------------------------------------------------------
    {
      const { error } = await admin.from("user_roles").upsert({
        user_id: userId,
        role_id: roleRow.id
      });
      if (error) return jerr(error.message, 400);
    }
    // --- (E) Add to org (owner is your current default; adjust if needed) ------
    {
      const { error } = await admin.from("org_members").upsert({
        org_id: DEFAULT_ORG,
        user_id: userId,
        role: "owner"
      });
      if (error) return jerr(error.message, 400);
    }
    // --- (F) Attach to super agent if agent ------------------------------------
    if (role === "agent" && super_agent_id) {
      const orgForAttach = orgId;
      const { error } = await admin.from("super_agent_members").upsert({
        org_id: orgForAttach,
        super_agent_id,
        agent_user_id: userId
      }, {
        onConflict: "org_id,agent_user_id"
      });
      if (error) return jerr(error.message, 400);
    }
    // Return invite context (if you want to show link in your own UI/email)
    return jok({
      user_id: userId,
      invite: {
        id: inviteRow.id,
        token: inviteRow.token,
        expires_at: inviteRow.expires_at,
        status: inviteRow.status,
        link: `${SITE_URL}/invite?token=${inviteRow.token}` // your custom invite flow (optional)
      }
    });
  } catch (e) {
    return jerr(e?.message || "Unknown error", 500);
  }
});
// ---------------- helpers ----------------
async function getRoleRow(admin, roleName) {
  const { data, error } = await admin.from("roles").select("id,name").eq("name", roleName).single();
  if (error) throw new Error(error.message);
  return data;
}
async function upsertUserInvite({ admin, orgId, email, roleId, fullName, assignedSuperAgentId, ttlDays }) {
  // Find latest invite for (org,email) that’s pending/expired
  const { data: existingRows, error: findErr } = await admin.from("user_invites").select("id,status,expires_at,token").eq("org_id", orgId).eq("email", email).in("status", [
    "pending",
    "expired"
  ]).order("created_at", {
    ascending: false
  }).limit(1);
  if (findErr) throw new Error(findErr.message);
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);
  if (existingRows && existingRows.length > 0) {
    // Re-invite: rotate token + extend expiration + set status 'pending'
    const existing = existingRows[0];
    const { data, error } = await admin.from("user_invites").update({
      token,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      metadata: {
        ...fullName ? {
          full_name: fullName
        } : {},
        reinvited_at: new Date().toISOString()
      },
      assigned_super_agent_id: assignedSuperAgentId
    }).eq("id", existing.id).select("id,token,expires_at,status").maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  // Create brand new invite
  const { data: created, error: createErr } = await admin.from("user_invites").insert({
    org_id: orgId,
    invited_by: null,
    email,
    phone: null,
    role_id: roleId,
    assigned_super_agent_id: assignedSuperAgentId,
    status: "pending",
    token,
    expires_at: expiresAt.toISOString(),
    metadata: {
      ...fullName ? {
        full_name: fullName
      } : {},
      created_via: "edge_function"
    }
  }).select("id,token,expires_at,status").single();
  if (createErr) throw new Error(createErr.message);
  return created;
}
function jok(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
function jerr(message, status = 400) {
  return jok({
    error: message
  }, status);
}
