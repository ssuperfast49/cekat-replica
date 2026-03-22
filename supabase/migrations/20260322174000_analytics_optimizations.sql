-- 1. Create Token Usage Analytics RPC
CREATE OR REPLACE FUNCTION public.get_token_usage_stats(
    p_from timestamp with time zone,
    p_to timestamp with time zone
)
RETURNS TABLE (
    day text,
    model text,
    prompt_tokens bigint,
    completion_tokens bigint,
    total_tokens bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        to_char(made_at, 'YYYY-MM-DD') as day,
        model,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        SUM(total_tokens) as total_tokens
    FROM public.token_usage_logs
    WHERE made_at >= p_from AND made_at < p_to
    GROUP BY to_char(made_at, 'YYYY-MM-DD'), model
    ORDER BY day ASC;
$$;

-- 2. Drop duplicate indexes
DROP INDEX IF EXISTS public.idx_channels_super_agent_id;
DROP INDEX IF EXISTS public.idx_super_agent_members_org_agent;
DROP INDEX IF EXISTS public.idx_super_agent_members_super;

-- 3. Optimize RLS Policies on `messages`
DROP POLICY IF EXISTS "messages delete perm delete_own" ON messages;
CREATE POLICY "messages delete perm delete_own" ON messages FOR DELETE USING (
  (has_perm('delete'::text, 'messages'::text) AND (actor_kind = 'agent'::text) AND (actor_id = (select auth.uid())))
);

DROP POLICY IF EXISTS "messages insert perm create" ON messages;
CREATE POLICY "messages insert perm create" ON messages FOR INSERT WITH CHECK (
  ((select auth.uid()) IS NOT NULL)
);

DROP POLICY IF EXISTS "messages select perm read super agent thread" ON messages;
CREATE POLICY "messages select perm read super agent thread" ON messages FOR SELECT USING (
  (EXISTS ( SELECT 1
   FROM threads t
  WHERE ((t.id = messages.thread_id) AND (EXISTS ( SELECT 1
           FROM channels c
          WHERE ((c.id = t.channel_id) AND ((c.super_agent_id = (select auth.uid())) OR (EXISTS ( SELECT 1
                   FROM channel_agents ca
                  WHERE ((ca.channel_id = c.id) AND (ca.user_id = (select auth.uid()))))))))))))
);

-- 4. Optimize RLS Policies on `threads`
DROP POLICY IF EXISTS "threads delete perm delete_channel_owned" ON threads;
CREATE POLICY "threads delete perm delete_channel_owned" ON threads FOR DELETE USING (
  (has_perm('delete'::text, 'threads'::text) AND (is_master_agent_in_org(org_id) OR (EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = threads.channel_id) AND (c.super_agent_id = (select auth.uid())))))))
);

DROP POLICY IF EXISTS "threads insert perm create_channel_owned" ON threads;
CREATE POLICY "threads insert perm create_channel_owned" ON threads FOR INSERT WITH CHECK (
  (has_perm('create'::text, 'threads'::text) AND (is_master_agent_in_org(org_id) OR (EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = threads.channel_id) AND (c.super_agent_id = (select auth.uid())))))))
);

DROP POLICY IF EXISTS "threads select perm read super agent and members" ON threads;
CREATE POLICY "threads select perm read super agent and members" ON threads FOR SELECT USING (
  (EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = threads.channel_id) AND ((c.super_agent_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM channel_agents ca
          WHERE ((ca.channel_id = c.id) AND (ca.user_id = (select auth.uid())))))))))
);

DROP POLICY IF EXISTS "threads update" ON threads;
CREATE POLICY "threads update" ON threads FOR UPDATE USING (
  ((select auth.uid()) IS NOT NULL)
) WITH CHECK (
  ((select auth.uid()) IS NOT NULL)
);
