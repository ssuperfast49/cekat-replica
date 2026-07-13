-- Fix drifting tab counts. The channel_status_counts counter table accumulated
-- permanent drift (negative rows observed in production: assigned showed -9561
-- while the real pending count was single digits) because bulk/imported thread
-- status changes bypassed its maintenance trigger. Since the "done" count is
-- hidden in the UI and the active (open/pending) set is tiny, we count active
-- threads directly for the no-filter fast path -- always accurate, no counter.
--
-- Note: on existing databases the partial index below was created with
-- CREATE INDEX CONCURRENTLY out-of-band to avoid a write lock; this IF NOT EXISTS
-- form is a no-op there and provides reproducibility for fresh databases.

create index if not exists idx_threads_active_status
  on public.threads (status, channel_id)
  where status in ('open'::public.thread_status, 'pending'::public.thread_status);

create or replace function public.get_tab_counts_v3(p_filters jsonb default '{}'::jsonb)
returns table(status_category text, total_count bigint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_search       text        := p_filters->>'search';
  v_from         timestamptz := (p_filters->'dateRange'->>'from')::timestamptz;
  v_to           timestamptz := (p_filters->'dateRange'->>'to')::timestamptz;
  v_agent        uuid        := nullif(p_filters->>'agent', '')::uuid;
  v_resolved_by  uuid        := nullif(p_filters->>'resolvedBy', '')::uuid;
  v_inbox        text        := nullif(p_filters->>'inbox', '');
  v_platform_id  uuid        := nullif(p_filters->>'platformId', '')::uuid;
  v_has_filters  boolean;
  v_is_elevated  boolean;
  v_uid          uuid        := (select auth.uid());
begin
  v_is_elevated := (is_master_agent() or is_auditor());

  v_has_filters := (
    (v_search is not null and v_search <> '') or
    (v_from is not null) or
    (v_to is not null) or
    (v_agent is not null) or
    (v_resolved_by is not null) or
    (v_inbox is not null and v_inbox <> 'all') or
    (v_platform_id is not null)
  );

  -- FAST PATH: no filters. Count ACTIVE threads (open/pending) directly. This set
  -- is small and always accurate (no counter drift). The "done"/closed count is
  -- intentionally not computed: it is hidden in the UI and counting ~130k closed
  -- rows would be wasteful.
  if not v_has_filters then
    return query
    select
      case t.status::text
        when 'pending' then 'assigned'
        when 'open'    then 'unassigned'
        else t.status::text
      end as status_category,
      count(*)::bigint
    from public.threads t
    where t.status in ('open'::public.thread_status, 'pending'::public.thread_status)
      and (
        v_is_elevated
        or exists (
          select 1 from public.channels c_inner
          where c_inner.id = t.channel_id
            and (
              c_inner.super_agent_id = v_uid
              or exists (
                select 1 from public.channel_agents ca
                where ca.channel_id = c_inner.id and ca.user_id = v_uid
              )
            )
        )
      )
      and (v_is_elevated or t.org_id in (select org_id from public.org_members where user_id = v_uid))
    group by 1;
    return;
  end if;

  -- DYNAMIC PATH: filters active -> scan threads with the same visibility check as RLS.
  return query
  select
    case
      when t.status::text = 'pending' then 'assigned'
      when t.status::text = 'open' then 'unassigned'
      when t.status::text = 'closed' then 'done'
      when t.status::text = 'assigned' then 'assigned'
      else t.status::text
    end as status_category,
    count(*)::bigint
  from public.threads t
  left join public.contacts c on c.id = t.contact_id
  left join public.channels ch on ch.id = t.channel_id
  where
    (
      v_is_elevated or
      exists (
        select 1 from public.channels c_inner
        where c_inner.id = t.channel_id
        and (
          c_inner.super_agent_id = v_uid or
          exists (
            select 1 from public.channel_agents ca
            where ca.channel_id = c_inner.id and ca.user_id = v_uid
          )
        )
      )
    )
    and (t.org_id in (select org_id from public.org_members where user_id = v_uid))
    and (v_search is null or v_search = '' or
         t.last_message_body ilike '%' || v_search || '%' or
         c.name ilike '%' || v_search || '%')
    and (v_from is null or t.last_msg_at >= v_from)
    and (v_to is null or t.last_msg_at <= v_to)
    and (v_agent is null or t.assignee_user_id = v_agent)
    and (v_resolved_by is null or t.resolved_by_user_id = v_resolved_by)
    and (v_inbox is null or v_inbox = 'all' or ch.provider::text ilike v_inbox)
    and (v_platform_id is null or t.channel_id = v_platform_id)
  group by 1;
end;
$function$;
