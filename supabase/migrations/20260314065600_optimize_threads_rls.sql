-- Optimize threads and messages RLS policies to prevent API timeout (500 error)
-- Replace slow row-by-row SECURITY DEFINER function calls with native EXISTS SQL joins

BEGIN;

-- 1. Optimize threads policy
DROP POLICY IF EXISTS "threads select perm read super agent and members" ON public.threads;
CREATE POLICY "threads select perm read super agent and members" 
ON public.threads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = threads.channel_id
    AND (
      c.super_agent_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.channel_agents ca 
        WHERE ca.channel_id = c.id AND ca.user_id = auth.uid()
      )
    )
  )
);

-- 2. Optimize messages policy
DROP POLICY IF EXISTS "messages select perm read super agent thread" ON public.messages;
CREATE POLICY "messages select perm read super agent thread" 
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = messages.thread_id
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = t.channel_id
      AND (
        c.super_agent_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM public.channel_agents ca 
          WHERE ca.channel_id = c.id AND ca.user_id = auth.uid()
        )
      )
    )
  )
);

COMMIT;
