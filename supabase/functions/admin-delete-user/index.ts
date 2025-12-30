import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (s, b)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return json(400, {
        error: "user_id is required"
      });
    }
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) {
      return json(500, {
        error: "Missing service configuration"
      });
    }
    const admin = createClient(url, service, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Verify the target user exists
    const { data: target, error: getErr } = await admin.auth.admin.getUserById(user_id);
    if (getErr) {
      return json(404, {
        error: "User not found",
        details: getErr.message
      });
    }
    // Helper to safely count records
    const count = async (q)=>{
      try {
        const { count } = await q;
        return count || 0;
      } catch  {
        return 0;
      }
    };
    // Check all dependencies
    const details = {
      ai_profiles_super_agent_id: await count(admin.from("ai_profiles").select("id", {
        count: "exact",
        head: true
      }).eq("super_agent_id", user_id)),
      channel_agents: await count(admin.from("channel_agents").select("user_id", {
        count: "exact",
        head: true
      }).eq("user_id", user_id)),
      files_uploaded_by: await count(admin.from("files").select("id", {
        count: "exact",
        head: true
      }).eq("uploaded_by", user_id)),
      org_members: await count(admin.from("org_members").select("user_id", {
        count: "exact",
        head: true
      }).eq("user_id", user_id)),
      token_topups_created_by: await count(admin.from("token_topups").select("id", {
        count: "exact",
        head: true
      }).eq("created_by", user_id)),
      token_usage_logs: await count(admin.from("token_usage_logs").select("id", {
        count: "exact",
        head: true
      }).eq("user_id", user_id)),
      threads_assignee: await count(admin.from("threads").select("id", {
        count: "exact",
        head: true
      }).eq("assignee_user_id", user_id)),
      threads_assigned_by: await count(admin.from("threads").select("id", {
        count: "exact",
        head: true
      }).eq("assigned_by_user_id", user_id)),
      threads_resolved_by: await count(admin.from("threads").select("id", {
        count: "exact",
        head: true
      }).eq("resolved_by_user_id", user_id)),
      twofa_challenges: await count(admin.from("twofa_challenges").select("id", {
        count: "exact",
        head: true
      }).eq("user_id", user_id)),
      twofa_sessions: await count(admin.from("twofa_sessions").select("id", {
        count: "exact",
        head: true
      }).eq("user_id", user_id)),
      user_roles: await count(admin.from("user_roles").select("user_id", {
        count: "exact",
        head: true
      }).eq("user_id", user_id)),
      users_profile: await count(admin.from("users_profile").select("user_id", {
        count: "exact",
        head: true
      }).eq("user_id", user_id)),
      sam_super: await count(admin.from("super_agent_members").select("id", {
        count: "exact",
        head: true
      }).eq("super_agent_id", user_id)),
      sam_agent: await count(admin.from("super_agent_members").select("id", {
        count: "exact",
        head: true
      }).eq("agent_user_id", user_id))
    };
    // Block if user still owns AI agents
    if (details.ai_profiles_super_agent_id > 0) {
      return json(409, {
        error: "User is super_agent for AI agents. Reassign first.",
        details
      });
    }
    // Safe wrapper for cleanup operations
    const safe = async (fn)=>{
      try {
        await fn();
      } catch (err) {
        // Optionally log errors for debugging
        console.error("Cleanup error:", err);
      }
    };
    // Cleanup in correct order - delete child records first
    await safe(()=>admin.from("channel_agents").delete().eq("user_id", user_id));
    await safe(()=>admin.from("super_agent_members").delete().or(`agent_user_id.eq.${user_id},super_agent_id.eq.${user_id}`));
    // Nullify foreign key references
    await safe(()=>admin.from("threads").update({
        assignee_user_id: null
      }).eq("assignee_user_id", user_id));
    await safe(()=>admin.from("threads").update({
        assigned_by_user_id: null
      }).eq("assigned_by_user_id", user_id));
    await safe(()=>admin.from("threads").update({
        resolved_by_user_id: null
      }).eq("resolved_by_user_id", user_id));
    await safe(()=>admin.from("files").update({
        uploaded_by: null
      }).eq("uploaded_by", user_id));
    await safe(()=>admin.from("token_topups").update({
        created_by: null
      }).eq("created_by", user_id));
    await safe(()=>admin.from("token_usage_logs").update({
        user_id: null
      }).eq("user_id", user_id));
    // Delete 2FA data
    await safe(()=>admin.from("twofa_sessions").delete().eq("user_id", user_id));
    await safe(()=>admin.from("twofa_challenges").delete().eq("user_id", user_id));
    // Delete role and org memberships
    await safe(()=>admin.from("user_roles").delete().eq("user_id", user_id));
    await safe(()=>admin.from("org_members").delete().eq("user_id", user_id));
    // Delete user profile
    await safe(()=>admin.from("users_profile").delete().eq("user_id", user_id));
    // Delete auth-related data
    await safe(()=>admin.from("auth.identities").delete().eq("user_id", user_id));
    await safe(()=>admin.from("auth.sessions").delete().eq("user_id", user_id));
    await safe(()=>admin.from("auth.refresh_tokens").delete().eq("user_id", user_id));
    await safe(()=>admin.from("auth.mfa_factors").delete().eq("user_id", user_id));
    // Finally delete the user using a custom SQL function
    // First, create this function in your database:
    // CREATE OR REPLACE FUNCTION delete_auth_user(user_uuid UUID)
    // RETURNS void AS $
    // BEGIN
    //   DELETE FROM auth.users WHERE id = user_uuid;
    // END;
    // $ LANGUAGE plpgsql SECURITY DEFINER;
    const { error: delErr } = await admin.rpc("delete_auth_user", {
      user_uuid: user_id
    });
    if (delErr) {
      return json(400, {
        error: delErr.message,
        details
      });
    }
    return json(200, {
      success: true,
      details
    });
  } catch (e) {
    return json(500, {
      error: e?.message || "Unknown error"
    });
  }
});
