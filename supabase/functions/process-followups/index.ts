import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Adjust this if your proxy function slug is different (e.g. from env) but default is proxy-n8n
const PROXY_FUNCTION_SLUG = Deno.env.get("WEBHOOK_PROXY_SLUG") || "proxy-n8n";
const PROXY_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/${PROXY_FUNCTION_SLUG}`;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
    try {
        // 1. Fetch threads due for follow-up
        const now = new Date().toISOString();

        // We fetch threads where followup_at is passed AND hasn't been sent yet
        const { data: threads, error } = await supabase
            .from("threads")
            .select(`
        id,
        channel_id,
        contact_id,
        channels!inner (
          id,
          provider,
          ai_profile_id,
          ai_profiles!inner (
            followup_message
          )
        ),
        contacts (
          phone,
          external_id
        )
      `)
            .lte("followup_at", now)
            .eq("is_followup_sent", false)
            .in("status", ["open", "pending"])  // Process both Unassigned (open) AND Assigned (pending) threads
            .not("followup_at", "is", null);

        if (error) throw error;

        if (!threads || threads.length === 0) {
            return new Response(JSON.stringify({ message: "No follow-ups due" }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const results = [];

        // 2. Process each thread
        for (const thread of threads) {
            // @ts-ignore
            const channels = thread.channels;
            // @ts-ignore
            const contacts = thread.contacts;
            // @ts-ignore
            const aiProfile = channels.ai_profiles;

            const messageText = aiProfile?.followup_message;

            if (!messageText) {
                console.warn(`Thread ${thread.id} due but no followup_message in profile`);
                // We might want to mark it as sent so we don't loop forever?
                // Or set followup_at to null?
                await supabase.from("threads").update({ followup_at: null }).eq("id", thread.id);
                continue;
            }

            // Determine provider route
            let routeKey = "";
            const provider = (channels.provider || "").toLowerCase();
            const isWeb = provider === "web";

            if (provider === "whatsapp" || provider === "waha" || provider === "whatsapp_cloud") {
                routeKey = "whatsapp.send_message";
            } else if (provider === "telegram" || provider === "tele") {
                routeKey = "telegram.send_message";
            } else if (!isWeb) {
                console.warn(`Unsupported provider ${provider} for thread ${thread.id}`);
                continue;
            }

            // 3. Idempotency Check: Prevent duplicate sends if run recently
            const { data: recentMsgs } = await supabase
                .from("messages")
                .select("id")
                .eq("thread_id", thread.id)
                .eq("role", "assistant")
                .eq("body", messageText)
                .gt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // last 5 mins
                .limit(1);

            if (recentMsgs && recentMsgs.length > 0) {
                console.warn(`Followup already sent for thread ${thread.id} recently. Skipping.`);
                await supabase.from("threads").update({ is_followup_sent: true }).eq("id", thread.id);
                results.push({ thread_id: thread.id, status: "skipped_duplicate" });
                continue;
            }

            try {
                if (isWeb) {
                    // --- WEB PROVIDER: Insert directly to DB, No Webhook ---
                    const { error: msgError } = await supabase.from("messages").insert({
                        thread_id: thread.id,
                        direction: "out",
                        role: "assistant",
                        type: "text",
                        body: messageText,
                        actor_kind: "ai",
                        payload: { is_auto_followup: true }
                    });

                    if (msgError) {
                        console.error(`Failed to insert message for ${thread.id}: ${msgError.message}`);
                        results.push({ thread_id: thread.id, status: "db_error", error: msgError.message });
                        continue;
                    }

                    // Update thread state
                    await supabase
                        .from("threads")
                        .update({ is_followup_sent: true })
                        .eq("id", thread.id);

                    results.push({ thread_id: thread.id, status: "sent_db_only" });

                } else {
                    // --- EXTERNAL PROVIDER: Send Webhook, No DB Insert (Webhook handles it) ---
                    const webhookUrl = `${PROXY_FUNCTION_URL}/${routeKey}`;

                    const payload = {
                        channel_id: channels.id,
                        contact_id: thread.contact_id,
                        contact_phone: contacts?.phone || null,
                        external_id: contacts?.external_id || null,
                        text: messageText,
                        type: "text",
                        direction: "out",
                        role: "assistant",
                        payload: {
                            is_auto_followup: true
                        }
                    };

                    console.log(`Sending followup for thread ${thread.id} via ${routeKey}`);

                    const res = await fetch(webhookUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${SERVICE_KEY}`,
                        },
                        body: JSON.stringify(payload),
                    });

                    if (res.ok) {
                        // Update thread state so we don't send again
                        await supabase
                            .from("threads")
                            .update({ is_followup_sent: true })
                            .eq("id", thread.id);

                        results.push({ thread_id: thread.id, status: "sent_webhook" });
                    } else {
                        const txt = await res.text();
                        console.error(`Webhook failed for ${thread.id}: ${txt}`);
                        // Do NOT update is_followup_sent so it retries? 
                        // Or update to prevent loop? 
                        // For safety, let's update it but log error, similar to before.
                        await supabase
                            .from("threads")
                            .update({ is_followup_sent: true })
                            .eq("id", thread.id);

                        results.push({ thread_id: thread.id, status: "failed_webhook", error: txt });
                    }
                }
            } catch (err: any) {
                console.error(`Error processing ${thread.id}`, err);
                results.push({ thread_id: thread.id, status: "error", error: err.message });
            }
        }

        return new Response(JSON.stringify({ processed: results.length, details: results }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Global error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
