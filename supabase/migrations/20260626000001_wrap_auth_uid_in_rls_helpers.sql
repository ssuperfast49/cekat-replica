-- The advisor flagged RLS policies for re-evaluating auth.uid() per row.
-- The messages/threads policies themselves already use (select auth.uid()),
-- but the helper functions they delegate to (is_master_agent, is_auditor,
-- has_perm, can_access_*_scope) still call auth.uid() unwrapped. When a
-- policy executes those helpers, auth.uid() is re-evaluated per row of the
-- function's internal query. Wrapping in (select auth.uid()) lets the
-- planner cache it as a single InitPlan constant per query.

create or replace function public.is_master_agent()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'master_agent'
  );
$$;

create or replace function public.is_auditor()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'audit'
  );
$$;

create or replace function public.is_master_agent_in_org(target_org uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.org_members om on om.user_id = ur.user_id and om.org_id = target_org
    where ur.user_id = (select auth.uid()) and r.name = 'master_agent'
  );
$$;

create or replace function public.has_perm(p_action text, p_resource text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = (select auth.uid())
      and p.action   = p_action
      and p.resource = p_resource
  );
$$;

create or replace function public.can_access_channel_scope(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.channels c
    where c.id = p_channel_id
      and (
        c.super_agent_id = (select auth.uid())
        or exists (
          select 1
          from public.channel_agents ca
          where ca.channel_id = c.id
            and ca.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.can_access_super_scope(p_row_super_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    (select auth.uid()) = p_row_super_agent_id
    or exists (
      select 1
      from public.super_agent_members sam
      where sam.super_agent_id = p_row_super_agent_id
        and sam.agent_user_id = (select auth.uid())
    );
$$;

create or replace function public.can_access_super_scope(p_org_id uuid, p_row_super_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    (select auth.uid()) = p_row_super_agent_id
    or exists (
      select 1
      from public.super_agent_members sam
      where sam.org_id = p_org_id
        and sam.super_agent_id = p_row_super_agent_id
        and sam.agent_user_id = (select auth.uid())
    );
$$;
