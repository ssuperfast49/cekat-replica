-- ============================================================
-- Migration: Change threads.account_id from uuid to text
-- Allows non-UUID identifiers (e.g. usernames) as account_id
-- ============================================================

-- 1. Drop all RLS policies that reference threads.account_id

-- threads policies
DROP POLICY IF EXISTS anon_threads_by_account ON public.threads;
DROP POLICY IF EXISTS anon_threads_insert_by_account ON public.threads;

-- messages policies (reference threads.account_id via subquery)
DROP POLICY IF EXISTS anon_messages_by_account ON public.messages;
DROP POLICY IF EXISTS anon_messages_insert_by_account ON public.messages;
DROP POLICY IF EXISTS anon_messages_update_by_account ON public.messages;

-- 2. Alter the column type
ALTER TABLE public.threads
  ALTER COLUMN account_id TYPE text
  USING account_id::text;

-- 3. Recreate all policies with text comparison (no ::uuid cast)

-- threads SELECT: match account_id OR additional_data->>'account_id' against x-account-id header
CREATE POLICY anon_threads_by_account ON public.threads
  FOR SELECT TO anon
  USING (
    (account_id = ((current_setting('request.headers', true))::jsonb ->> 'x-account-id'))
    OR
    ((additional_data ->> 'account_id') = ((current_setting('request.headers', true))::jsonb ->> 'x-account-id'))
  );

-- threads INSERT: account_id must match the x-account-id header
CREATE POLICY anon_threads_insert_by_account ON public.threads
  FOR INSERT
  WITH CHECK (
    (account_id IS NOT NULL)
    AND
    (account_id = COALESCE(((current_setting('request.headers', true))::jsonb ->> 'x-account-id'), ''))
  );

-- messages SELECT: thread must belong to account
CREATE POLICY anon_messages_by_account ON public.messages
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = messages.thread_id
        AND (
          (t.account_id = ((current_setting('request.headers', true))::jsonb ->> 'x-account-id'))
          OR
          ((t.additional_data ->> 'account_id') = ((current_setting('request.headers', true))::jsonb ->> 'x-account-id'))
        )
    )
  );

-- messages INSERT: thread must belong to account
CREATE POLICY anon_messages_insert_by_account ON public.messages
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = messages.thread_id
        AND t.account_id IS NOT NULL
        AND (t.account_id = COALESCE(((current_setting('request.headers', true))::jsonb ->> 'x-account-id'), ''))
    )
  );

-- messages UPDATE: thread must belong to account
CREATE POLICY anon_messages_update_by_account ON public.messages
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = messages.thread_id
        AND (
          (t.account_id IS NOT NULL AND t.account_id = COALESCE(((current_setting('request.headers', true))::jsonb ->> 'x-account-id'), ''))
          OR
          ((t.additional_data ->> 'account_id') = COALESCE(((current_setting('request.headers', true))::jsonb ->> 'x-account-id'), ''))
        )
    )
  );
