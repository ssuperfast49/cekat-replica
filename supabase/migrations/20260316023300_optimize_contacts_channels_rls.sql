BEGIN;

-- 1. Optimize channels select perm read_all
DROP POLICY IF EXISTS "channels select perm read_all" ON public.channels;
CREATE POLICY "channels select perm read_all" 
ON public.channels FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('master_agent', 'audit')
  )
);

-- 2. Optimize channels select perm super agent and members
DROP POLICY IF EXISTS "channels select perm super agent and members" ON public.channels;
CREATE POLICY "channels select perm super agent and members" 
ON public.channels FOR SELECT TO authenticated
USING (
  super_agent_id IS NOT NULL 
  AND (
    auth.uid() = super_agent_id
    OR EXISTS (
      SELECT 1 FROM public.super_agent_members sam 
      WHERE sam.super_agent_id = channels.super_agent_id 
        AND sam.agent_user_id = auth.uid()
    )
  )
);

-- 3. Optimize contacts select perm read_all
DROP POLICY IF EXISTS "contacts select perm read_all" ON public.contacts;
CREATE POLICY "contacts select perm read_all" 
ON public.contacts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('master_agent', 'audit')
  )
);

-- 4. Optimize contacts select perm read_own
DROP POLICY IF EXISTS "contacts select perm read_own" ON public.contacts;
CREATE POLICY "contacts select perm read_own" 
ON public.contacts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.contact_id = contacts.id
    AND (
      c.super_agent_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.channel_agents ca 
        WHERE ca.channel_id = c.id AND ca.user_id = auth.uid()
      )
    )
  )
);

-- 5. Optimize contacts delete perm delete
DROP POLICY IF EXISTS "contacts delete perm delete" ON public.contacts;
CREATE POLICY "contacts delete perm delete" 
ON public.contacts FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_agent', 'master_agent')
  )
);

COMMIT;
