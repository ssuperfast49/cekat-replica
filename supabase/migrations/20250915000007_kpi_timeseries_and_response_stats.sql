begin;

-- Chat counts time-series per provider (optional filter)
create or replace function public.get_chats_timeseries(
  p_from timestamptz,
  p_to timestamptz,
  p_channel text default null
) returns table(bucket timestamptz, provider text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select t.created_at, ch.provider
    from public.threads t
    join public.channels ch on ch.id = t.channel_id
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
      and (p_channel is null or ch.provider::text = p_channel)
  )
  select (date_trunc('day', created_at at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta' as bucket,
         provider::text,
         count(*)::bigint
  from scoped
  group by 1,2
  order by 1 asc, 2 asc;
$$;

-- Response time stats (AI and Agent): avg/median/p90 seconds
create or replace function public.get_response_time_stats(
  p_from timestamptz,
  p_to timestamptz,
  p_channel text default null
) returns table(
  ai_avg numeric, ai_median numeric, ai_p90 numeric,
  agent_avg numeric, agent_median numeric, agent_p90 numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with msgs as (
    select m.*, ch.provider
    from public.messages m
    join public.threads t on t.id = m.thread_id
    join public.channels ch on ch.id = t.channel_id
    where m.created_at >= p_from and m.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
      and (p_channel is null or ch.provider::text = p_channel)
  ),
  inbound as (
    select id, thread_id, created_at, provider
    from msgs
    where role='user' and direction='in'
  ),
  ai_pairs as (
    select i.created_at as in_at,
           (select m2.created_at from msgs m2 where m2.thread_id=i.thread_id and m2.created_at>i.created_at and m2.role='assistant' order by m2.created_at asc limit 1) as out_at
    from inbound i
  ),
  agent_pairs as (
    select i.created_at as in_at,
           (select m2.created_at from msgs m2 where m2.thread_id=i.thread_id and m2.created_at>i.created_at and m2.role='agent' order by m2.created_at asc limit 1) as out_at
    from inbound i
  ),
  ai_secs as (
    select extract(epoch from (out_at - in_at)) as sec from ai_pairs where out_at is not null and out_at>=in_at
  ),
  agent_secs as (
    select extract(epoch from (out_at - in_at)) as sec from agent_pairs where out_at is not null and out_at>=in_at
  )
  select
    coalesce(avg(ai_secs.sec),0),
    coalesce(percentile_cont(0.5) within group(order by ai_secs.sec),0),
    coalesce(percentile_cont(0.9) within group(order by ai_secs.sec),0),
    coalesce(avg(agent_secs.sec),0),
    coalesce(percentile_cont(0.5) within group(order by agent_secs.sec),0),
    coalesce(percentile_cont(0.9) within group(order by agent_secs.sec),0)
  from ai_secs, agent_secs;
$$;

commit;


