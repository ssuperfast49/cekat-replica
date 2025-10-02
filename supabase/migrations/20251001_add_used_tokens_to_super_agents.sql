-- Add used_tokens column to users_profile to store total tokens for super agents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'used_tokens'
  ) THEN
    ALTER TABLE public.users_profile ADD COLUMN used_tokens bigint NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Helper function to recompute totals for super agents
CREATE OR REPLACE FUNCTION public.refresh_used_tokens_for_super_agents(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  WITH cluster AS (
    SELECT super_agent_id, agent_user_id
    FROM public.super_agent_members
  ),
  logs AS (
    -- Distinct logs mapped to the owning super agent via either explicit user_id
    -- or the thread assignee. This avoids double counting the same log row.
    SELECT DISTINCT t.id,
           COALESCE(c1.super_agent_id, c2.super_agent_id) AS super_agent_id,
           t.total_tokens
    FROM public.token_usage_logs t
    LEFT JOIN public.threads th ON th.id = t.thread_id
    LEFT JOIN cluster c1 ON c1.agent_user_id = t.user_id
    LEFT JOIN cluster c2 ON c2.agent_user_id = th.assignee_user_id
    WHERE (p_from IS NULL OR t.made_at >= p_from)
      AND (p_to   IS NULL OR t.made_at <  p_to)
  ),
  totals AS (
    SELECT super_agent_id, SUM(total_tokens) AS tokens
    FROM logs
    WHERE super_agent_id IS NOT NULL
    GROUP BY super_agent_id
  )
  UPDATE public.users_profile up
  SET used_tokens = COALESCE(t.tokens, 0)
  FROM totals t
  WHERE up.user_id = t.super_agent_id;
END $$;

-- Backfill for all time
SELECT public.refresh_used_tokens_for_super_agents(NULL, NULL);

-- Keep numbers fresh after token log mutations (statement-level to amortize cost)
CREATE OR REPLACE FUNCTION public.after_token_log_refresh_used_tokens()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_used_tokens_for_super_agents(NULL, NULL);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tr_refresh_used_tokens_after_log ON public.token_usage_logs;
CREATE TRIGGER tr_refresh_used_tokens_after_log
AFTER INSERT OR UPDATE OR DELETE ON public.token_usage_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.after_token_log_refresh_used_tokens();



