-- Live Chat RLS for account-scoped anon access
-- Threads: allow anon select/insert when x-account-id matches account_id
-- Messages: allow anon select/insert when parent thread account_id matches x-account-id
-- Channels: allow anon select minimal data for web channels (to fetch org_id/metadata)
-- Remove legacy null-account fallback policies

DO $$
BEGIN
  -- Threads: anon select by account_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'anon_threads_by_account'
      AND tablename = 'threads'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY anon_threads_by_account
    ON public.threads FOR SELECT TO anon
    USING (
      account_id IS NOT NULL
      AND account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
    );
  END IF;

  -- Threads: anon insert by account_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'anon_threads_insert_by_account'
      AND tablename = 'threads'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY anon_threads_insert_by_account
    ON public.threads FOR INSERT TO anon
    WITH CHECK (
      account_id IS NOT NULL
      AND account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
    );
  END IF;

  -- Messages: anon select by parent thread account_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'anon_messages_by_account'
      AND tablename = 'messages'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY anon_messages_by_account
    ON public.messages FOR SELECT TO anon
    USING (
      EXISTS (
        SELECT 1 FROM public.threads t
        WHERE t.id = messages.thread_id
          AND t.account_id IS NOT NULL
          AND t.account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
      )
    );
  END IF;

  -- Messages: anon insert by parent thread account_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'anon_messages_insert_by_account'
      AND tablename = 'messages'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY anon_messages_insert_by_account
    ON public.messages FOR INSERT TO anon
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.threads t
        WHERE t.id = messages.thread_id
          AND t.account_id IS NOT NULL
          AND t.account_id::text = coalesce((current_setting('request.headers', true)::jsonb ->> 'x-account-id'), '')
      )
    );
  END IF;

  -- Channels: allow anon to read minimal web channel info
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'anon_channels_web_minimal'
      AND tablename = 'channels'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY anon_channels_web_minimal
    ON public.channels FOR SELECT TO anon
    USING (provider = 'web' AND coalesce(is_active, true));
  END IF;

  -- Remove legacy null-account fallbacks (they re-exposed old threads)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'anon_threads_select_legacy_null_account'
      AND tablename = 'threads'
      AND schemaname = 'public'
  ) THEN
    DROP POLICY anon_threads_select_legacy_null_account ON public.threads;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'anon_messages_select_legacy_null_account'
      AND tablename = 'messages'
      AND schemaname = 'public'
  ) THEN
    DROP POLICY anon_messages_select_legacy_null_account ON public.messages;
  END IF;
END$$;
