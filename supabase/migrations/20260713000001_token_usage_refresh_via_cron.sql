-- The token_usage_logs insert took ~2.5s because two FOR EACH STATEMENT triggers
-- (tr_refresh_daily_monthly_after_log, tr_refresh_used_tokens_after_log) each
-- recomputed usage aggregates over the ENTIRE token_usage_logs table (with large
-- joins) on every insert -- O(all logs) per insert. Those counters only feed usage
-- dashboards on users_profile (the AI message limit counts messages directly, not
-- these counters), so a small lag is fine. Move the refresh to a periodic cron job.

drop trigger if exists tr_refresh_daily_monthly_after_log on public.token_usage_logs;
drop trigger if exists tr_refresh_used_tokens_after_log on public.token_usage_logs;

create or replace function public.refresh_token_usage_counters()
returns void
language plpgsql
as $$
begin
  perform public.refresh_daily_monthly_tokens();
  perform public.refresh_used_tokens_for_super_agents();
end;
$$;

-- Run every 2 minutes. Replaces per-insert recompute; dashboards lag <= 2 min.
-- cron.schedule upserts by job name, so this is idempotent.
select cron.schedule('refresh_token_usage_counters', '*/2 * * * *',
  'select public.refresh_token_usage_counters();');
