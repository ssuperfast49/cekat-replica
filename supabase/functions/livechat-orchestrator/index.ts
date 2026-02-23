// livechat-orchestrator — Supabase Edge Function
// Handles all LiveChat CRUD that anon clients can't do due to RLS.
// Actions: ensure_thread, get_ai_context, insert_ai_message,
//          insert_welcome_message, log_token_usage, check_handover
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
});

// ───── CORS ─────
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info, x-account-id",
    "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function err(msg: string, status = 400) {
    return json({ error: msg }, status);
}

// ───── ACTION: ensure_thread ─────
// Find or create contact + thread.  Returns IDs + channel metadata.
async function ensureThread(p: {
    account_id: string;
    channel_id: string;
    session_id: string;
    username: string;
}) {
    // 1. Look for existing thread (replicate n8n's LEFT JOIN query)
    const { data: threads, error: threadErr } = await sb
        .from("threads")
        .select("*, contacts!inner(name)")
        .or(
            `contacts.name.eq.${p.username},account_id.eq.${p.account_id}`
        )
        .eq("channel_id", p.channel_id)
        .limit(1);

    // Fallback: use a direct query for the LEFT JOIN approach the n8n uses
    let thread: any = null;
    if (!threadErr && threads && threads.length > 0) {
        thread = threads[0];
    } else {
        // The inner join above won't find threads without contacts matching name.
        // Try by account_id alone:
        const { data: byAccount } = await sb
            .from("threads")
            .select("*")
            .eq("account_id", p.account_id)
            .eq("channel_id", p.channel_id)
            .limit(1);
        if (byAccount && byAccount.length > 0) thread = byAccount[0];
    }

    if (thread) {
        // Thread exists — return its data
        // Fetch channel for ai_profile_id and super_agent_id
        const { data: channel } = await sb
            .from("channels")
            .select("id, org_id, super_agent_id, ai_profile_id")
            .eq("id", p.channel_id)
            .single();

        return {
            thread_id: thread.id,
            contact_id: thread.contact_id,
            is_new: false,
            channel_id: p.channel_id,
            super_agent_id: channel?.super_agent_id ?? null,
            ai_profile_id: channel?.ai_profile_id ?? null,
            thread_status: thread.status,
        };
    }

    // 2. No thread — get channel
    const { data: channel, error: chErr } = await sb
        .from("channels")
        .select("id, org_id, super_agent_id, ai_profile_id")
        .eq("id", p.channel_id)
        .single();

    if (chErr || !channel) throw new Error("Channel not found: " + p.channel_id);

    // 3. Find or create contact
    const { data: existingContact } = await sb
        .from("contacts")
        .select("id")
        .eq("name", p.username)
        .eq("org_id", channel.org_id)
        .limit(1)
        .maybeSingle();

    let contactId: string;
    if (existingContact) {
        contactId = existingContact.id;
    } else {
        const { data: newContact, error: contactErr } = await sb
            .from("contacts")
            .insert({
                org_id: channel.org_id,
                name: p.username,
                external_id: p.session_id,
            })
            .select("id")
            .single();
        if (contactErr || !newContact)
            throw new Error("Failed to create contact: " + contactErr?.message);
        contactId = newContact.id;
    }

    // 4. Create thread
    const { data: newThread, error: threadCreateErr } = await sb
        .from("threads")
        .insert({
            org_id: channel.org_id,
            contact_id: contactId,
            channel_id: channel.id,
            status: "open",
            assignee_user_id: channel.super_agent_id,
            account_id: p.account_id,
        })
        .select("id")
        .single();

    if (threadCreateErr || !newThread)
        throw new Error("Failed to create thread: " + threadCreateErr?.message);

    return {
        thread_id: newThread.id,
        contact_id: contactId,
        is_new: true,
        channel_id: channel.id,
        super_agent_id: channel.super_agent_id,
        ai_profile_id: channel.ai_profile_id,
        thread_status: "open",
    };
}

// ───── ACTION: get_ai_context ─────
// Fetch AI profile, contact info, and formatted chat history.
async function getAiContext(p: {
    thread_id: string;
    channel_id: string;
    contact_id: string;
}) {
    // 1. AI profile via channel
    const { data: channel } = await sb
        .from("channels")
        .select("ai_profile_id, super_agent_id")
        .eq("id", p.channel_id)
        .single();

    let aiProfile: any = null;
    if (channel?.ai_profile_id) {
        const { data } = await sb
            .from("ai_profiles")
            .select("*")
            .eq("id", channel.ai_profile_id)
            .single();
        aiProfile = data;
    }

    // 2. Contact information (separate table)
    const { data: contactInfo } = await sb
        .from("contact_informations")
        .select("*")
        .eq("contact_id", p.contact_id)
        .maybeSingle();

    // 3. Chat history (replicate Postgres Memory + Normalize Chat History)
    const historyLimit = aiProfile?.history_limit ?? 20;
    const { data: rawMessages } = await sb
        .from("messages")
        .select("role, body, actor_kind, created_at")
        .eq("thread_id", p.thread_id)
        .eq("type", "text")
        .not("body", "is", null)
        .order("created_at", { ascending: false })
        .limit(historyLimit);

    // Normalize: exact same logic as the removed n8n code node
    const chatHistory = (rawMessages ?? [])
        .filter((m: any) => m.body)
        .reverse() // DESC → chronological
        .map((m: any) => {
            const r = m.role;
            const who =
                r === "user"
                    ? "User"
                    : r === "agent" || r === "ai"
                        ? "Assistant"
                        : "System";
            return `${who}: ${m.body}`;
        })
        .join("\n");

    return {
        ai_profile: aiProfile,
        contact_info: contactInfo,
        chat_history: chatHistory,
        super_agent_id: channel?.super_agent_id ?? null,
    };
}

// ───── ACTION: insert_ai_message ─────
async function insertAiMessage(p: {
    thread_id: string;
    body: string;
    ai_agent_id: string;
}) {
    const { error } = await sb.from("messages").insert({
        thread_id: p.thread_id,
        direction: "out",
        role: "agent",
        body: p.body,
        actor_kind: "ai",
        actor_id: p.ai_agent_id,
    });
    if (error) throw new Error("insert_ai_message failed: " + error.message);
    return { ok: true };
}

// ───── ACTION: insert_welcome_message ─────
async function insertWelcomeMessage(p: {
    thread_id: string;
    welcome_message: string;
}) {
    if (!p.welcome_message) return { ok: true, skipped: true };
    const { error } = await sb.from("messages").insert({
        thread_id: p.thread_id,
        direction: "out",
        role: "agent",
        actor_kind: "ai",
        body: p.welcome_message,
    });
    if (error)
        throw new Error("insert_welcome_message failed: " + error.message);
    return { ok: true };
}

// ───── ACTION: log_token_usage ─────
async function logTokenUsage(p: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    thread_id: string;
    user_id: string;
    model: string;
    channel_id: string;
}) {
    // Derive org_id from thread instead of hardcoding
    let orgId = "00000000-0000-0000-0000-000000000001";
    const { data: threadData } = await sb
        .from("threads")
        .select("org_id")
        .eq("id", p.thread_id)
        .maybeSingle();
    if (threadData?.org_id) orgId = threadData.org_id;

    const { error } = await sb.from("token_usage_logs").insert({
        total_tokens: p.total_tokens,
        prompt_tokens: p.prompt_tokens,
        completion_tokens: p.completion_tokens,
        thread_id: p.thread_id,
        org_id: orgId,
        user_id: p.user_id,
        model: p.model,
        provider: "livechat",
        channel_id: p.channel_id,
    });
    if (error) throw new Error("log_token_usage failed: " + error.message);
    return { ok: true };
}

// ───── ACTION: check_handover ─────
async function checkHandover(p: {
    thread_id: string;
    contact_id: string;
    channel_id: string;
}) {
    // Re-fetch thread to check if handover tool set ai_handoff_at
    const { data: thread } = await sb
        .from("threads")
        .select("id, ai_handoff_at")
        .eq("contact_id", p.contact_id)
        .eq("channel_id", p.channel_id)
        .maybeSingle();

    if (!thread) return { is_handoff: false };

    const isHandoff = !!thread.ai_handoff_at;

    if (isHandoff) {
        // Insert system log message
        await sb.from("messages").insert({
            role: "system",
            type: "event",
            body: "Auto-handover triggered by AI agent.",
            thread_id: p.thread_id,
        });
    }

    return { is_handoff: isHandoff };
}

// ───── ROUTER ─────
const ACTIONS: Record<string, (p: any) => Promise<any>> = {
    ensure_thread: ensureThread,
    get_ai_context: getAiContext,
    insert_ai_message: insertAiMessage,
    insert_welcome_message: insertWelcomeMessage,
    log_token_usage: logTokenUsage,
    check_handover: checkHandover,
};

Deno.serve(async (req) => {
    // Preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return err("Method not allowed", 405);
    }

    try {
        const body = await req.json();
        const { action, ...params } = body;

        if (!action || !ACTIONS[action]) {
            return err(`Unknown action: ${action}. Valid: ${Object.keys(ACTIONS).join(", ")}`);
        }

        const result = await ACTIONS[action](params);
        return json(result);
    } catch (e: any) {
        console.error("[livechat-orchestrator]", e);
        return err(e.message || "Internal error", 500);
    }
});
