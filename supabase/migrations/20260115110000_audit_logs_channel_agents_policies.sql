-- Align audit_logs and channel_agents RLS with development branch state

BEGIN;

--------------------------------------------------------------------
-- audit_logs: restrict to has_perm('read', 'audit_logs')
--------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs read by master"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_perm('read', 'audit_logs'));

--------------------------------------------------------------------
-- channel_agents: match dev (single authenticated policy)
--------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_agents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.channel_agents', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.channel_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_agents auth all"
ON public.channel_agents
FOR ALL
TO authenticated
USING ((SELECT auth.uid() IS NOT NULL));

COMMIT;
