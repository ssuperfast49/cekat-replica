-- Extend the get_tab_counts_v3 fast path to NON-elevated agents.
-- Previously only master_agent/auditor with no filters were served from the
-- trigger-maintained channel_status_counts counter table; everyone else hit a
-- full threads scan (the ~30%-of-DB-time slow path). Now any no-filter request
-- is served from the counter: elevated users sum all channels, normal agents sum
-- only channels they own (super_agent_id) or are assigned to (channel_agents).
-- Filtered requests still fall through to the dynamic scan (rare, click-driven).

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

  -- FAST PATH: no filters -> serve from the counter table.
  if not v_has_filters then
    if v_is_elevated then
      return query
      select
        case
          when status = 'pending'  then 'assigned'
          when status = 'open'     then 'unassigned'
          when status = 'closed'   then 'done'
          when status = 'assigned' then 'assigned'
          else status
        end as status_category,
        sum(count)::bigint as total_count
      from public.channel_status_counts
      group by 1;
    else
      return query
      select
        case
          when csc.status = 'pending'  then 'assigned'
          when csc.status = 'open'     then 'unassigned'
          when csc.status = 'closed'   then 'done'
          when csc.status = 'assigned' then 'assigned'
          else csc.status
        end as status_category,
        sum(csc.count)::bigint as total_count
      from public.channel_status_counts csc
      where csc.channel_id in (
        select c.id from public.channels c where c.super_agent_id = v_uid
        union
        select ca.channel_id from public.channel_agents ca where ca.user_id = v_uid
      )
      group by 1;
    end if;
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
