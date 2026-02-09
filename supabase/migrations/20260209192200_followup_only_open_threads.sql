-- Migration: Fix follow-up to only trigger for OPEN (Unassigned) threads
-- Follow-ups should NOT trigger when:
-- - status = 'pending' (Assigned tab)
-- - status = 'closed' (Done tab)

-- Update the trigger function to check thread status
CREATE OR REPLACE FUNCTION "public"."handle_followup_scheduling"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ai_profile_id uuid;
  v_enable_followup boolean;
  v_delay int;
  v_user_msg_count int;
  v_thread_status text;
BEGIN
    -- Only proceed if thread_id exists
    IF NEW.thread_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- LOGIC 1: IF Incoming Message (User) -> Cancel Follow-up
    IF (NEW.direction = 'in') OR (NEW.role = 'user') OR (NEW.actor_kind = 'customer') THEN
        UPDATE public.threads
        SET followup_at = NULL,
            is_followup_sent = FALSE
        WHERE id = NEW.thread_id;
        
        RETURN NEW;
    END IF;

    -- LOGIC 2: IF Outgoing Message (Agent/AI) -> Schedule Follow-up (Maybe)
    IF (NEW.direction = 'out') OR (NEW.role IN ('assistant', 'agent')) OR (NEW.actor_kind IN ('agent', 'ai')) THEN
        
        -- Get thread status first - only schedule for OPEN (Unassigned) threads
        SELECT status::text INTO v_thread_status FROM public.threads WHERE id = NEW.thread_id;
        
        -- Only proceed if thread is OPEN (Unassigned tab)
        -- Do NOT schedule follow-ups for:
        --   - 'pending' (Assigned tab) - human agent is handling
        --   - 'closed' (Done tab) - conversation is resolved
        IF v_thread_status != 'open' THEN
            -- Clear any pending follow-up since thread is no longer unassigned
            UPDATE public.threads
            SET followup_at = NULL
            WHERE id = NEW.thread_id;
            RETURN NEW;
        END IF;
        
        -- Get AI profile settings
        SELECT c.ai_profile_id 
        INTO v_ai_profile_id
        FROM public.threads t
        JOIN public.channels c ON c.id = t.channel_id
        WHERE t.id = NEW.thread_id;

        -- Default values
        v_enable_followup := false;
        v_delay := 0;

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

        -- Check if follow-up is enabled
        IF v_enable_followup = true AND v_delay > 0 THEN
             
             -- Count user messages (ignore 'test' messages)
             SELECT count(*)
             INTO v_user_msg_count
             FROM public.messages
             WHERE thread_id = NEW.thread_id
               AND (direction = 'in' OR role = 'user' OR actor_kind = 'customer')
               AND LOWER(TRIM(body)) != 'test';
             
             -- If user has sent at least one valid message, schedule follow-up
             IF v_user_msg_count > 0 THEN
                 UPDATE public.threads
                 SET followup_at = now() + (v_delay || ' minutes')::interval,
                     is_followup_sent = FALSE
                 WHERE id = NEW.thread_id;
             ELSE
                 -- User hasn't spoken yet. Do NOT schedule follow-up.
                 UPDATE public.threads
                 SET followup_at = NULL
                 WHERE id = NEW.thread_id;
             END IF;
             
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
