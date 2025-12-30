BEGIN;

DROP POLICY IF EXISTS "threads update perm update_own" ON public.threads;

CREATE POLICY "threads update perm update_own"
ON public.threads
FOR UPDATE
TO authenticated
USING (
  has_perm('update', 'threads')
  AND (
    public.threads.super_agent_id = auth.uid()
    OR is_master_agent_in_org(public.threads.org_id)
  )
)
WITH CHECK (
  has_perm('update', 'threads')
  AND (
    public.threads.super_agent_id = auth.uid()
    OR is_master_agent_in_org(public.threads.org_id)
  )
);

COMMIT;
