-- Migration: Fix Auto-Resolve Enum Error on Dev
-- This migration replaces the buggy trigger with the stable one from Main.

-- 1. Disable the buggy trigger that causes Enum cast errors
ALTER TABLE public.messages DISABLE TRIGGER tr_set_thread_auto_resolve_after_message;

-- 2. Restore/Create the working trigger function from Main
CREATE OR REPLACE FUNCTION public.set_auto_resolve_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $$
DECLARE
  ai_profile_record RECORD;
BEGIN
  -- Only process if this is an AI response (role = 'agent' or 'assistant')
  -- We use ::text to be safe against any future Enum drift
  IF NEW.role::text IN ('agent', 'assistant') AND NEW.direction = 'out' THEN
    -- Get the AI profile settings for this thread's channel
    SELECT ap.enable_resolve, ap.auto_resolve_after_minutes
    INTO ai_profile_record
    FROM public.threads t
    JOIN public.channels ch ON ch.id = t.channel_id
    JOIN public.ai_profiles ap ON ap.id = ch.ai_profile_id
    WHERE t.id = NEW.thread_id
      AND t.ai_access_enabled = true;
    
    -- If auto-resolve is enabled, set the auto_resolve_at timestamp
    IF ai_profile_record.enable_resolve = true AND ai_profile_record.auto_resolve_after_minutes > 0 THEN
      UPDATE public.threads 
      SET auto_resolve_at = now() + (ai_profile_record.auto_resolve_after_minutes || ' minutes')::interval
      WHERE id = NEW.thread_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Re-create the trigger using the working function
DROP TRIGGER IF EXISTS trigger_set_auto_resolve_timestamp ON public.messages;
CREATE TRIGGER trigger_set_auto_resolve_timestamp
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.set_auto_resolve_timestamp();

-- 4. Ensure the cancel trigger is also using ::text just in case (though it was already working)
CREATE OR REPLACE FUNCTION public.cancel_auto_resolve_on_user_message()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $$
BEGIN
  -- If this is a user message (direction = 'in'), cancel auto-resolve
  IF NEW.direction = 'in' OR NEW.role::text = 'user' THEN
    UPDATE public.threads 
    SET auto_resolve_at = null
    WHERE id = NEW.thread_id;
  END IF;
  
  RETURN NEW;
END;
$$;
