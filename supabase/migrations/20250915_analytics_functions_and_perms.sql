begin;

-- Permissions for analytics
do $$
declare p1 uuid; p2 uuid; p3 uuid; role_id uuid;
begin
  select id into p1 from public.permissions where resource='analytics' and action='view_kpi' limit 1;
  if p1 is null then
    insert into public.permissions (id, name, resource, action, created_at)
    values (gen_random_uuid(), 'Analytics: View KPI', 'analytics', 'view_kpi', now())
    returning id into p1;
  end if;

  select id into p2 from public.permissions where resource='analytics' and action='view_containment_rate' limit 1;
  if p2 is null then
    insert into public.permissions (id, name, resource, action, created_at)
    values (gen_random_uuid(), 'Analytics: View Containment Rate', 'analytics', 'view_containment_rate', now())
    returning id into p2;
  end if;

  select id into p3 from public.permissions where resource='analytics' and action='view_handover_rate' limit 1;
  if p3 is null then
    insert into public.permissions (id, name, resource, action, created_at)
    values (gen_random_uuid(), 'Analytics: View Handover Rate', 'analytics', 'view_handover_rate', now())
    returning id into p3;
  end if;

  select id into role_id from public.roles where name='master_agent' limit 1;
  if role_id is not null then
    if not exists (select 1 from public.role_permissions where role_id=role_id and permission_id=p1) then
      insert into public.role_permissions (role_id, permission_id, created_at) values (role_id, p1, now());
    end if;
    if not exists (select 1 from public.role_permissions where role_id=role_id and permission_id=p2) then
      insert into public.role_permissions (role_id, permission_id, created_at) values (role_id, p2, now());
    end if;
    if not exists (select 1 from public.role_permissions where role_id=role_id and permission_id=p3) then
      insert into public.role_permissions (role_id, permission_id, created_at) values (role_id, p3, now());
    end if;
  end if;
end $$;

-- Function: chats per channel in range
create or replace function public.get_channel_chat_counts(
  p_from timestamptz,
  p_to timestamptz
) returns table(channel_id uuid, provider text, display_name text, thread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ch.id as channel_id,
         ch.provider::text as provider,
         ch.display_name,
         count(t.*) as thread_count
  from public.threads t
  join public.channels ch on ch.id = t.channel_id
  where t.created_at >= p_from and t.created_at < p_to
    and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  group by ch.id, ch.provider, ch.display_name
  order by thread_count desc;
$$;

-- Function: average AI and Agent response times (seconds)
create or replace function public.get_response_times(
  p_from timestamptz,
  p_to timestamptz
) returns table(ai_avg_seconds numeric, agent_avg_seconds numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare ai_avg numeric; agent_avg numeric;
begin
  -- AI responses: first assistant message after each inbound user message
  with base_in as (
    select m.id, m.thread_id, m.created_at
    from public.messages m
    where m.role = 'user' and m.direction = 'in'
      and m.created_at >= p_from and m.created_at < p_to
      and m.thread_id in (
        select id from public.threads where org_id in (
          select org_id from public.org_members where user_id = auth.uid()
        )
      )
  ), ai_pairs as (
    select b.created_at as in_at,
           (select m2.created_at from public.messages m2 where m2.thread_id=b.thread_id and m2.created_at>b.created_at and m2.role='assistant' order by m2.created_at asc limit 1) as out_at
    from base_in b
  ), agent_pairs as (
    select b.created_at as in_at,
           (select m2.created_at from public.messages m2 where m2.thread_id=b.thread_id and m2.created_at>b.created_at and m2.role='agent' order by m2.created_at asc limit 1) as out_at
    from base_in b
  )
  select avg(extract(epoch from (out_at - in_at))) into ai_avg from ai_pairs where out_at is not null;
  select avg(extract(epoch from (out_at - in_at))) into agent_avg from agent_pairs where out_at is not null;

  return query select coalesce(ai_avg,0)::numeric, coalesce(agent_avg,0)::numeric;
end;
$$;

-- Function: containment and handover rates
create or replace function public.get_containment_and_handover(
  p_from timestamptz,
  p_to timestamptz
) returns table(total_threads bigint, ai_resolved_count bigint, containment_rate numeric, handover_count bigint, handover_rate numeric)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  )
  , totals as (
    select count(*) as total from scoped
  )
  , ai_resolved as (
    select count(*) as cnt
    from scoped
    where status='closed' and coalesce(assignee_user_id, assigned_by_user_id) is null and resolved_by_user_id is null
  )
  , handover as (
    select count(*) as cnt
    from scoped
    where ai_handoff_at is not null or assignee_user_id is not null or assigned_by_user_id is not null
  )
  select 
    totals.total::bigint,
    ai_resolved.cnt::bigint,
    case when totals.total>0 then (ai_resolved.cnt::numeric / totals.total::numeric) else 0 end as containment_rate,
    handover.cnt::bigint,
    case when totals.total>0 then (handover.cnt::numeric / totals.total::numeric) else 0 end as handover_rate
  from totals, ai_resolved, handover;
$$;

commit;


