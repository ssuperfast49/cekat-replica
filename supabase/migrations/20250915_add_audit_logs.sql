begin;

-- Create audit_logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid null,
  action text not null,
  resource text not null,
  resource_id text null,
  context jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  constraint audit_logs_org_fk foreign key (org_id) references public.orgs (id) on delete cascade,
  constraint audit_logs_user_fk foreign key (user_id) references public.v_users (id)
);

-- Indexes for common filters
create index if not exists idx_audit_logs_org_created_at on public.audit_logs (org_id, created_at desc);
create index if not exists idx_audit_logs_org_user_created_at on public.audit_logs (org_id, user_id, created_at desc);
create index if not exists idx_audit_logs_org_action_created_at on public.audit_logs (org_id, action, created_at desc);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Policy: Only master_agent can view logs for their org(s)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'Master agents can read org logs'
  ) then
    create policy "Master agents can read org logs" on public.audit_logs
      for select to authenticated using (
        org_id in (
          select org_id from public.org_members where user_id = auth.uid()
        )
        and exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name = 'master_agent'
        )
      );
  end if;
end $$;

-- Explicitly deny insert/update/delete to clients by omitting policies
-- Writes must go through the SECURITY DEFINER function below

-- Standardized write function (prevents client tampering)
create or replace function public.log_action(
  p_action text,
  p_resource text,
  p_resource_id text default null,
  p_context jsonb default '{}'::jsonb,
  p_ip text default null,
  p_user_agent text default null,
  p_org_id uuid default null,
  p_user_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_org uuid;
begin
  -- Use provided user id or current auth uid
  v_user := p_user_id;
  if v_user is null then
    v_user := auth.uid();
  end if;

  -- Resolve org id from param or from user's first org membership
  v_org := p_org_id;
  if v_org is null then
    select org_id into v_org
    from public.org_members
    where user_id = v_user
    order by created_at asc
    limit 1;
  end if;

  insert into public.audit_logs (org_id, user_id, action, resource, resource_id, context, ip, user_agent)
  values (v_org, p_user_id, p_action, p_resource, p_resource_id, coalesce(p_context, '{}'::jsonb), p_ip, p_user_agent);
end;
$$;

commit;


