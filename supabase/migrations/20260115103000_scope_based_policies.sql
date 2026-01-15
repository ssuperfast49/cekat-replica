-- Align RLS with dev branch: scope helpers + scope-based policies
-- Adds helper functions:
--   can_access_super_scope(super_agent_id)
--   can_access_channel_scope(channel_id)
--   can_access_message_scope(thread_id)
-- Rewrites RLS for channels, threads, messages to match dev live state

BEGIN;

-- Helper: can the current user access a super-agent scope?
CREATE OR REPLACE FUNCTION public.can_access_super_scope(p_super_agent_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
  SELECT
    p_super_agent_id IS NOT NULL
    AND (
      auth.uid() = p_super_agent_id
      OR EXISTS (
        SELECT 1
        FROM public.super_agent_members sam
        WHERE sam.super_agent_id = p_super_agent_id
          AND sam.agent_user_id = auth.uid()
      )
    );
$$;

-- Helper: can the current user access a channel by scope?
CREATE OR REPLACE FUNCTION public.can_access_channel_scope(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = p_channel_id
        AND ch.super_agent_id IS NOT NULL
        AND public.can_access_super_scope(ch.super_agent_id)
    );
$$;

-- Helper: can the current user access a message via its thread scope?
CREATE OR REPLACE FUNCTION public.can_access_message_scope(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = p_thread_id
        AND public.can_access_channel_scope(t.channel_id)
    );
$$;

------------------------------------------------------------------------
-- CHANNELS: replace policies with super-agent + members scope
------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channels'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.channels', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Minimal anon read for web channels
CREATE POLICY anon_channels_web_minimal
ON public.channels
FOR SELECT
TO anon
USING (provider = 'web' AND coalesce(is_active, true));

-- Authenticated policies
CREATE POLICY "channels delete perm delete"
ON public.channels
FOR DELETE
TO authenticated
USING (has_perm('delete', 'channels'));

CREATE POLICY "channels insert perm create"
ON public.channels
FOR INSERT
TO authenticated
WITH CHECK (has_perm('create', 'channels'));

CREATE POLICY "channels select perm read_all"
ON public.channels
FOR SELECT
TO authenticated
USING (has_perm('read_all', 'channels'));

CREATE POLICY "channels select perm super agent and members"
ON public.channels
FOR SELECT
TO authenticated
USING (
  (super_agent_id IS NOT NULL)
  AND public.can_access_super_scope(super_agent_id)
);

CREATE POLICY "update channel"
ON public.channels
FOR UPDATE
TO authenticated
USING (has_perm('update', 'channels'))
WITH CHECK (has_perm('update', 'channels'));

------------------------------------------------------------------------
-- THREADS: scope-based access and account anon policies
------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'threads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.threads', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

-- Anon account-based access
CREATE POLICY anon_threads_by_account
ON public.threads
FOR SELECT
TO anon
USING (
  account_id IS NOT NULL
  AND account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
);

CREATE POLICY anon_threads_insert_by_account
ON public.threads
FOR INSERT
TO anon
WITH CHECK (
  account_id IS NOT NULL
  AND account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
);

-- Web widget
CREATE POLICY "threads select anon web_widget"
ON public.threads
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = threads.channel_id
      AND c.provider = 'web'
      AND coalesce(c.is_active, true)
      AND c.secret_token IS NOT NULL
      AND c.secret_token = ((current_setting('request.jwt.claims', true))::jsonb ->> 'channel_secret')
      AND threads.id = (((current_setting('request.jwt.claims', true))::jsonb ->> 'thread_id')::uuid)
  )
);

-- Authenticated
CREATE POLICY "threads delete perm delete_channel_owned"
ON public.threads
FOR DELETE
TO authenticated
USING (
  has_perm('delete', 'threads')
  AND (
    is_master_agent_in_org(org_id)
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = threads.channel_id
        AND c.super_agent_id = auth.uid()
    )
  )
);

CREATE POLICY "threads insert perm create_channel_owned"
ON public.threads
FOR INSERT
TO authenticated
WITH CHECK (
  has_perm('create', 'threads')
  AND (
    is_master_agent_in_org(org_id)
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = threads.channel_id
        AND c.super_agent_id = auth.uid()
    )
  )
);

CREATE POLICY "threads select perm read super agent and members"
ON public.threads
FOR SELECT
TO authenticated
USING (public.can_access_channel_scope(channel_id));

CREATE POLICY "threads select perm read_threads_all"
ON public.threads
FOR SELECT
TO authenticated
USING (has_perm('read_all', 'threads'));

CREATE POLICY "threads update"
ON public.threads
FOR UPDATE
TO authenticated
USING (has_perm('update', 'threads'))
WITH CHECK (has_perm('update', 'threads'));

------------------------------------------------------------------------
-- MESSAGES: scope-based access and account anon policies
------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Anon account-based access
CREATE POLICY anon_messages_by_account
ON public.messages
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = messages.thread_id
      AND t.account_id IS NOT NULL
      AND t.account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
  )
);

CREATE POLICY anon_messages_insert_by_account
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = messages.thread_id
      AND t.account_id IS NOT NULL
      AND t.account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
  )
);

-- Web widget
CREATE POLICY "messages insert anon web_widget"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = messages.thread_id
      AND c.provider = 'web'
      AND coalesce(c.is_active, true)
      AND c.secret_token IS NOT NULL
      AND c.secret_token = ((current_setting('request.jwt.claims', true))::jsonb ->> 'channel_secret')
      AND t.id = (((current_setting('request.jwt.claims', true))::jsonb ->> 'thread_id')::uuid)
  )
);

CREATE POLICY "messages select anon web_widget"
ON public.messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = messages.thread_id
      AND c.provider = 'web'
      AND coalesce(c.is_active, true)
      AND c.secret_token IS NOT NULL
      AND c.secret_token = ((current_setting('request.jwt.claims', true))::jsonb ->> 'channel_secret')
      AND t.id = (((current_setting('request.jwt.claims', true))::jsonb ->> 'thread_id')::uuid)
  )
);

-- Authenticated
CREATE POLICY "messages delete perm delete_own"
ON public.messages
FOR DELETE
TO authenticated
USING (
  has_perm('delete', 'messages')
  AND actor_kind = 'agent'
  AND actor_id = auth.uid()
);

CREATE POLICY "messages insert perm create"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "messages select perm read super agent thread"
ON public.messages
FOR SELECT
TO authenticated
USING (public.can_access_message_scope(thread_id));

CREATE POLICY "messages select perm read_all"
ON public.messages
FOR SELECT
TO authenticated
USING (has_perm('read_all', 'messages'));

CREATE POLICY "update messages perm"
ON public.messages
FOR UPDATE
TO authenticated
USING (has_perm('update', 'message'))
WITH CHECK (has_perm('update', 'message'));

COMMIT;
