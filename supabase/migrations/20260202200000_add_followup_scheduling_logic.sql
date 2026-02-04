-- Add followup_at column to threads if it doesn't exist
ALTER TABLE "public"."threads" ADD COLUMN IF NOT EXISTS "followup_at" timestamp with time zone;

-- Function to handle message inserts (Schedule or Cancel followup)
CREATE OR REPLACE FUNCTION "public"."handle_followup_scheduling"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ai_profile_id uuid;
  v_enable_followup boolean;
  v_delay int;
BEGIN
    -- Only proceed if thread_id exists
    IF NEW.thread_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get AI profile setup for this thread's channel
    SELECT 
        c.ai_profile_id 
    INTO 
        v_ai_profile_id
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = NEW.thread_id;

    -- Default values
    v_enable_followup := false;
    v_delay := 0;

    -- If we found an AI profile, get its settings
    IF v_ai_profile_id IS NOT NULL THEN
        SELECT 
            COALESCE(enable_followup_message, false), 
            COALESCE(followup_message_delay, 0)
        INTO 
            v_enable_followup,
            v_delay
        FROM public.ai_profiles
        WHERE id = v_ai_profile_id;
    END IF;

    -- Logic:
    -- 1. If USER sends a message:
    --    - Cancel any pending follow-up (followup_at = NULL).
    --    - Reset is_followup_sent = FALSE (so next time it can trigger again).
    -- 2. If AGENT/AI sends a message:
    --    - If follow-up is enabled by config:
    --      - Schedule new follow-up (followup_at = NOW + delay).
    --      - Reset is_followup_sent = FALSE.
    --    - If follow-up is disabled:
    --      - Clear followup_at to be safe.

    IF (NEW.role = 'user') OR (NEW.actor_kind = 'customer') THEN
        -- User replied, cancel follow-up
        UPDATE public.threads
        SET followup_at = NULL,
            is_followup_sent = FALSE
        WHERE id = NEW.thread_id;
    
    ELSIF (NEW.role IN ('assistant', 'agent')) OR (NEW.actor_kind IN ('agent', 'ai')) THEN
        -- Agent/AI replied, schedule follow-up if enabled
        IF v_enable_followup = true AND v_delay > 0 THEN
             UPDATE public.threads
             SET followup_at = now() + (v_delay || ' minutes')::interval,
                 is_followup_sent = FALSE
             WHERE id = NEW.thread_id;
        ELSE
             -- Config disabled, ensure no pending follow-up
             UPDATE public.threads
             SET followup_at = NULL
             WHERE id = NEW.thread_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Register Trigger
DROP TRIGGER IF EXISTS "tr_handle_followup_scheduling" ON "public"."messages";
CREATE TRIGGER "tr_handle_followup_scheduling"
    AFTER INSERT ON "public"."messages"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."handle_followup_scheduling"();

-- Force Schema Cache Reload for PostgREST
NOTIFY pgrst, 'reload schema';
