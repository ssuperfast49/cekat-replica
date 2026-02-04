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

            if (provider === "whatsapp" || provider === "waha" || provider === "whatsapp_cloud") {
                routeKey = "whatsapp.send_message";
            } else if (provider === "telegram" || provider === "tele") {
                routeKey = "telegram.send_message";
            } else if (provider === "web") {
                routeKey = "web.send_message";
            } else {
                console.warn(`Unsupported provider ${provider} for thread ${thread.id}`);
                continue;
            }

            const webhookUrl = `${PROXY_FUNCTION_URL}/${routeKey}`;

            // Construct payload compatible with the webhook handlers
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

            try {
                // Insert message first to DB (so it shows in UI)
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
                    // If DB insert fails, we probably shouldn't send the webhook?
                    // Or we attempt anyway? Let's be safe and skip.
                    results.push({ thread_id: thread.id, status: "db_error", error: msgError.message });
                    continue;
                }

                // Call Webhook to actually send it
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

                    results.push({ thread_id: thread.id, status: "sent" });
                } else {
                    const txt = await res.text();
                    console.error(`Webhook failed for ${thread.id}: ${txt}`);
                    // Note: we already inserted the message. Should we delete it? 
                    // Ideally yes, but for now we leave it or user sees "ghost" message.
                    // We won't mark is_followup_sent=true, so it might retry? 
                    // Retrying inserts duplicate messages. 
                    // Complex error handling needed. For MVP, we'll mark as sent to avoid spam loop, but log error.
                    await supabase
                        .from("threads")
                        .update({ is_followup_sent: true }) // Prevent infinite loop of failed sends
                        .eq("id", thread.id);

                    results.push({ thread_id: thread.id, status: "failed_webhook", error: txt });
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
