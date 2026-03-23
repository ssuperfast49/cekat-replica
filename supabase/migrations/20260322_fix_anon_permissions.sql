-- Migration: Fix Anon Permission Denied (42501) on Threads/Messages
-- Description: Re-scopes agent-specific RLS policies from 'public' to 'authenticated' 
-- to prevent 'anon' users from triggering permission errors on the 'channel_agents' table.

-- 1. Optimized Policies for THREADS
DROP POLICY IF EXISTS "threads select perm read super agent and members" ON public.threads;
CREATE POLICY "threads select perm read super agent and members" ON public.threads
FOR SELECT 
TO authenticated
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

DROP POLICY IF EXISTS "threads delete perm delete_channel_owned" ON public.threads;
CREATE POLICY "threads delete perm delete_channel_owned" ON public.threads
FOR DELETE 
TO authenticated
USING (
  has_perm('delete', 'threads') AND (
    is_master_agent_in_org(org_id) 
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = threads.channel_id AND c.super_agent_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "threads insert perm create_channel_owned" ON public.threads;
CREATE POLICY "threads insert perm create_channel_owned" ON public.threads
FOR INSERT 
TO authenticated
WITH CHECK (
  has_perm('create', 'threads') AND (
    is_master_agent_in_org(org_id)
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = threads.channel_id AND c.super_agent_id = auth.uid()
    )
  )
);

-- 2. Optimized Policies for MESSAGES
DROP POLICY IF EXISTS "messages select perm read super agent thread" ON public.messages;
CREATE POLICY "messages select perm read super agent thread" ON public.messages
FOR SELECT 
TO authenticated
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

DROP POLICY IF EXISTS "messages delete perm delete_own" ON public.messages;
CREATE POLICY "messages delete perm delete_own" ON public.messages
FOR DELETE 
TO authenticated
USING (
  has_perm('delete', 'messages') AND actor_kind = 'agent' AND actor_id = auth.uid()
);

DROP POLICY IF EXISTS "messages insert perm create" ON public.messages;
CREATE POLICY "messages insert perm create" ON public.messages
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 3. Ensure 'threads update' is also restricted 
DROP POLICY IF EXISTS "threads update" ON public.threads;
CREATE POLICY "threads update" ON public.threads
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
