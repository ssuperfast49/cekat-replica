-- Migration: Add separate follow-up settings for Unassigned and Assigned threads
-- This adds new columns to support independent follow-up configurations

-- Add new columns for Assigned thread follow-up (keeping existing columns for Unassigned)
ALTER TABLE public.ai_profiles
ADD COLUMN IF NOT EXISTS enable_followup_assigned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS followup_delay_assigned INTEGER DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.ai_profiles.enable_followup_message IS 'Enable follow-up for Unassigned (open) threads';
COMMENT ON COLUMN public.ai_profiles.followup_message_delay IS 'Delay in minutes for Unassigned thread follow-up';
COMMENT ON COLUMN public.ai_profiles.enable_followup_assigned IS 'Enable follow-up for Assigned (pending) threads';
COMMENT ON COLUMN public.ai_profiles.followup_delay_assigned IS 'Delay in minutes for Assigned thread follow-up';
COMMENT ON COLUMN public.ai_profiles.followup_message IS 'Shared follow-up message text for both Unassigned and Assigned';

-- Update the trigger function to support both statuses
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
        
        -- Get thread status
        SELECT status::text INTO v_thread_status FROM public.threads WHERE id = NEW.thread_id;
        
        -- Only proceed for 'open' (Unassigned) or 'pending' (Assigned)
        -- Do NOT schedule follow-ups for 'closed' (Done)
        IF v_thread_status = 'closed' THEN
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
            -- Use appropriate settings based on thread status
            IF v_thread_status = 'open' THEN
                -- Unassigned: use enable_followup_message / followup_message_delay
                SELECT 
                    COALESCE(enable_followup_message, false), 
                    COALESCE(followup_message_delay, 0)
                INTO 
                    v_enable_followup,
                    v_delay
                FROM public.ai_profiles
                WHERE id = v_ai_profile_id;
            ELSIF v_thread_status = 'pending' THEN
                -- Assigned: use enable_followup_assigned / followup_delay_assigned
                SELECT 
                    COALESCE(enable_followup_assigned, false), 
                    COALESCE(followup_delay_assigned, 0)
                INTO 
                    v_enable_followup,
                    v_delay
                FROM public.ai_profiles
                WHERE id = v_ai_profile_id;
            END IF;
        END IF;

        -- Check if follow-up is enabled for this status
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
             -- Config disabled for this status, ensure no pending follow-up
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
