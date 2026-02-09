-- Migration: Follow-up Message Automation for Production
-- This migration sets up the complete follow-up message automation system.
-- Apply this to bring PROD to parity with DEV.

-- 1. Add columns to threads table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'threads' AND column_name = 'followup_at'
    ) THEN
        ALTER TABLE public.threads ADD COLUMN followup_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'threads' AND column_name = 'is_followup_sent'
    ) THEN
        ALTER TABLE public.threads ADD COLUMN is_followup_sent BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Create or replace the trigger function
CREATE OR REPLACE FUNCTION "public"."handle_followup_scheduling"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ai_profile_id uuid;
  v_enable_followup boolean;
  v_delay int;
  v_user_msg_count int;
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
                 SET followup_at = now() + (v_delay || ' seconds')::interval,
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

-- 3. Create the trigger (drop first if exists to ensure clean state)
DROP TRIGGER IF EXISTS tr_handle_followup_scheduling ON public.messages;
CREATE TRIGGER tr_handle_followup_scheduling
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_followup_scheduling();

-- 4. Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 5. Schedule the cron job (PROD URL)
-- First unschedule if exists
SELECT cron.unschedule('invoke-process-followups') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-process-followups');

-- Schedule to run every minute
SELECT cron.schedule(
  'invoke-process-followups',
  '* * * * *',
  $$
  select net.http_post(
      url:='https://tgrmxlbnutxpewfmofdx.supabase.co/functions/v1/process-followups',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
