-- Migration: Restore Auto-Resolve Functionality on Dev
-- This migration syncs Dev with the working auto-resolve mechanism from Main.

-- 1. Create the resolution function (Missing on Dev)
CREATE OR REPLACE FUNCTION public.auto_close_due_threads()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_count integer := 0;
begin
  -- Resolve threads where auto_resolve_at has passed
  update public.threads t
     set status = 'closed',
         resolved_at = now(),
         resolution = 'AI' -- Mark as AI resolution if it was automated
   where t.auto_resolve_at is not null
     and t.auto_resolve_at <= now()
     and t.status is distinct from 'closed';

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 2. Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 3. Schedule the cron job to run every minute
-- First unschedule to avoid duplicates
SELECT cron.unschedule('auto_close_due_threads') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto_close_due_threads');

SELECT cron.schedule(
  'auto_close_due_threads',
  '* * * * *',
  'select public.auto_close_due_threads();'
);

-- 4. Re-enable the superior trigger (was disabled in schema)
ALTER TABLE public.messages ENABLE TRIGGER tr_set_thread_auto_resolve_after_message;

-- 5. Disable the redundant/inferior trigger to avoid conflicts
-- Note: This trigger doesn't clear the timestamp on user message, unlike the one above.
DROP TRIGGER IF EXISTS trigger_set_auto_resolve_timestamp ON public.messages;
