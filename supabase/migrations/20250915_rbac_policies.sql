begin;

-- RBAC policies table
create table if not exists public.rbac_policies (
  role_id uuid primary key references public.roles(id) on delete cascade,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rbac_policies enable row level security;

-- Only master_agent can manage/read rbac_policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rbac_policies' and policyname='Master can read policies'
  ) then
    create policy "Master can read policies" on public.rbac_policies
      for select to authenticated using (
        exists (
          select 1 from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name = 'master_agent'
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rbac_policies' and policyname='Master can upsert policies'
  ) then
    create policy "Master can upsert policies" on public.rbac_policies
      for all to authenticated using (
        exists (
          select 1 from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name = 'master_agent'
        )
      ) with check (
        exists (
          select 1 from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name = 'master_agent'
        )
      );
  end if;
end $$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='tr_set_updated_at_rbac_policies') then
    create trigger tr_set_updated_at_rbac_policies
      before update on public.rbac_policies
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- RPCs for policies
create or replace function public.get_role_policy(p_role uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select policy from public.rbac_policies where role_id = p_role), '{}'::jsonb);
$$;

create or replace function public.put_role_policy(p_role uuid, p_policy jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rbac_policies(role_id, policy)
  values (p_role, coalesce(p_policy,'{}'::jsonb))
  on conflict (role_id) do update set policy = excluded.policy, updated_at = now();
end;
$$;

create or replace function public.apply_role_policy(p_role uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Placeholder: policies are evaluated dynamically by has_perm; this exists for future hooks.
  perform 1;
end;
$$;

-- Extend has_perm to also honor rbac_policies.resources mapping
create or replace function public.has_perm(p_action text, p_resource text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_allowed boolean := false; v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;

  -- Existing permission via roles/permissions view (if present)
  begin
    select true into v_allowed
    from public.v_current_user_permissions
    where (resource = p_resource and action = p_action)
    limit 1;
  exception when undefined_table then
    v_allowed := false;
  end;

  if v_allowed then return true; end if;

  -- Policy check: policy.resources[resource] contains action
  if exists (
    select 1
    from public.user_roles ur
    join public.rbac_policies rp on rp.role_id = ur.role_id
    where ur.user_id = v_user
      and jsonb_typeof(rp.policy->'resources'->p_resource) = 'array'
      and jsonb_exists(rp.policy->'resources'->p_resource, p_action)
  ) then
    return true;
  end if;

  return false;
end;
$$;

commit;


