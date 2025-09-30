-- Super Agent Clustering Migration
-- 1) Ownership mapping: agents → super_agents (per org)
-- 2) Ownership on AI Agents: ai_profiles.super_agent_id (NOT NULL)
-- 3) RLS policies for master/super/agent access

begin;

-- 1) Create super_agent_members mapping table
create table if not exists public.super_agent_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  super_agent_id uuid not null references public.v_users(id) on delete cascade,
  agent_user_id uuid not null references public.v_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint super_agent_not_self check (super_agent_id <> agent_user_id),
  constraint super_agent_members_unique_per_org unique (org_id, agent_user_id)
);

create index if not exists idx_super_agent_members_super on public.super_agent_members(super_agent_id);
create index if not exists idx_super_agent_members_org on public.super_agent_members(org_id);

-- 2) Add super_agent_id to ai_profiles
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ai_profiles' and column_name='super_agent_id'
  ) then
    alter table public.ai_profiles
      add column super_agent_id uuid;
  end if;
end $$;

-- Backfill: set ai_profiles.super_agent_id to the user with email 'superagent@example.com' if present
-- Falls back to any super_agent within the same org if email not found
update public.ai_profiles p
set super_agent_id = coalesce(
  (select v.id from public.v_users v where lower(v.email) = lower('superagent@example.com') limit 1),
  (select ur.user_id
     from public.user_roles ur
     join public.roles r on r.id = ur.role_id and r.name = 'super_agent'
     join public.org_members om on om.user_id = ur.user_id and om.org_id = p.org_id
     limit 1)
)
where super_agent_id is null;

-- Make NOT NULL after backfill
alter table public.ai_profiles
  alter column super_agent_id set not null,
  add constraint ai_profiles_super_agent_fk foreign key (super_agent_id) references public.v_users(id) on delete restrict;

create index if not exists idx_ai_profiles_super_agent on public.ai_profiles(super_agent_id);

-- 3) RLS (assumes RLS already enabled on these tables in your project policies)
-- Enable RLS if not already
alter table public.super_agent_members enable row level security;
alter table public.ai_profiles enable row level security;

-- Drop old policies if they exist (idempotent guards)
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='super_agent_members' and policyname='sam_master_read') then
    drop policy sam_master_read on public.super_agent_members;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='super_agent_members' and policyname='sam_super_read') then
    drop policy sam_super_read on public.super_agent_members;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_profiles' and policyname='ai_master_all') then
    drop policy ai_master_all on public.ai_profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_profiles' and policyname='ai_super_read') then
    drop policy ai_super_read on public.ai_profiles;
  end if;
end $$;

-- Policies for super_agent_members
create policy sam_master_read on public.super_agent_members
  for all
  using (
    exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.org_members om on om.user_id = ur.user_id
      where ur.user_id = auth.uid() and r.name = 'master_agent' and om.org_id = super_agent_members.org_id
    )
  ) with check (
    exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.org_members om on om.user_id = ur.user_id
      where ur.user_id = auth.uid() and r.name = 'master_agent' and om.org_id = super_agent_members.org_id
    )
  );

create policy sam_super_read on public.super_agent_members
  for select
  using (
    super_agent_id = auth.uid()
  );

create policy sam_super_write on public.super_agent_members
  for insert
  with check (
    super_agent_id = auth.uid() and exists (
      select 1 from public.org_members om where om.org_id = super_agent_members.org_id and om.user_id = auth.uid()
    )
  );

create policy sam_super_delete on public.super_agent_members
  for delete
  using (
    super_agent_id = auth.uid()
  );

-- Policies for ai_profiles
create policy ai_master_all on public.ai_profiles
  for all
  using (
    exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.org_members om on om.user_id = ur.user_id
      where ur.user_id = auth.uid() and r.name = 'master_agent' and om.org_id = ai_profiles.org_id
    )
  ) with check (
    exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.org_members om on om.user_id = ur.user_id
      where ur.user_id = auth.uid() and r.name = 'master_agent' and om.org_id = ai_profiles.org_id
    )
  );

create policy ai_super_read on public.ai_profiles
  for select using (super_agent_id = auth.uid());

create policy ai_super_update on public.ai_profiles
  for update
  using (super_agent_id = auth.uid())
  with check (super_agent_id = auth.uid());

-- Optional uniqueness enforcement is at schema-level:
--  * super_agent_members UNIQUE(org_id, agent_user_id)
--  * ai_profiles.super_agent_id NOT NULL

commit;


