begin;

-- Schema additions for containment and handover
alter table public.threads
  add column if not exists resolution text,
  add column if not exists end_reason text,
  add column if not exists handover_reason text;

-- Handover reason taxonomy and requirement when handover occurred
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'handover_reason_taxonomy'
  ) then
    alter table public.threads add constraint handover_reason_taxonomy
      check (
        handover_reason is null or
        handover_reason in ('ambiguous','payment','policy') or
        handover_reason like 'other:%'
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'handover_reason_required_if_handover'
  ) then
    alter table public.threads add constraint handover_reason_required_if_handover
      check (
        (not (ai_handoff_at is not null or assignee_user_id is not null or assigned_by_user_id is not null))
        or handover_reason is not null
      );
  end if;
end $$;

-- Trigger: set resolution to 'AI' on close without handover
create or replace function public.set_ai_resolution_if_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'closed' and (new.resolution is null or new.resolution = '') then
    if not (new.ai_handoff_at is not null or new.assignee_user_id is not null or new.assigned_by_user_id is not null) then
      new.resolution := 'AI';
    end if;
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tr_set_ai_resolution_if_closed'
  ) then
    create trigger tr_set_ai_resolution_if_closed
      before update on public.threads
      for each row execute function public.set_ai_resolution_if_closed();
  end if;
end $$;

-- Containment RPC: current and previous period comparison
create or replace function public.get_containment(
  p_from timestamptz,
  p_to timestamptz
) returns table(
  total_threads bigint,
  ai_resolved_count bigint,
  rate numeric,
  prev_total_threads bigint,
  prev_ai_resolved_count bigint,
  prev_rate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_len interval;
begin
  v_len := (p_to - p_from);

  return query
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ), totals as (
    select count(*)::bigint as total from scoped
  ), ai as (
    select count(*)::bigint as cnt from scoped
    where coalesce(resolution,'') = 'AI'
  ), prev_scoped as (
    select * from public.threads t
    where t.created_at >= (p_from - v_len) and t.created_at < p_from
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ), prev_totals as (
    select count(*)::bigint as total from prev_scoped
  ), prev_ai as (
    select count(*)::bigint as cnt from prev_scoped
    where coalesce(resolution,'') = 'AI'
  )
  select totals.total,
         ai.cnt,
         case when totals.total>0 then (ai.cnt::numeric / totals.total::numeric) else 0 end,
         prev_totals.total,
         prev_ai.cnt,
         case when prev_totals.total>0 then (prev_ai.cnt::numeric / prev_totals.total::numeric) else 0 end
  from totals, ai, prev_totals, prev_ai;
end;
$$;

-- Handover stats RPC: breakdown by reason
create or replace function public.get_handover_stats(
  p_from timestamptz,
  p_to timestamptz
) returns table(reason text, count bigint, total bigint, rate numeric)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ),
  total as (
    select count(*)::bigint as total from scoped
  ),
  handovers as (
    select handover_reason as reason, count(*)::bigint as cnt
    from scoped
    where (ai_handoff_at is not null or assignee_user_id is not null or assigned_by_user_id is not null)
    group by handover_reason
  )
  select h.reason, h.cnt, t.total,
    case when t.total>0 then h.cnt::numeric / t.total::numeric else 0 end as rate
  from handovers h cross join total t;
$$;

commit;


