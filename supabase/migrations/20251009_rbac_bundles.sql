begin;

-- Capability bundles to simplify role management
create table if not exists public.permission_bundles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text default ''::text,
  created_at timestamptz not null default now()
);

create table if not exists public.bundle_permissions (
  bundle_id uuid not null references public.permission_bundles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bundle_id, permission_id)
);

create table if not exists public.role_bundles (
  role_id uuid not null references public.roles(id) on delete cascade,
  bundle_id uuid not null references public.permission_bundles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, bundle_id)
);

alter table public.permission_bundles enable row level security;
alter table public.bundle_permissions enable row level security;
alter table public.role_bundles enable row level security;

-- Ensure legacy policies table exists for unified view compatibility
create table if not exists public.rbac_policies (
  role_id uuid primary key references public.roles(id) on delete cascade,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Policies: read for authenticated; writes only to master_agent
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='permission_bundles' and policyname='auth can read bundles'
  ) then
    create policy "auth can read bundles" on public.permission_bundles for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='bundle_permissions' and policyname='auth can read bundle_perms'
  ) then
    create policy "auth can read bundle_perms" on public.bundle_permissions for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='role_bundles' and policyname='members can read role_bundles'
  ) then
    create policy "members can read role_bundles" on public.role_bundles for select to authenticated using (
      exists (
        select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_id = role_id
      )
    );
  end if;
end $$;

-- Backfill role_bundles for existing roles based on current role_permissions
do $$
declare
  b_chat_view uuid; b_contacts_view uuid; b_platforms_view uuid; b_analytics_view uuid; b_logs_view uuid; b_aiagents_view uuid; b_humanagents_view uuid; b_permissions_admin uuid;
  master_role uuid;
begin
  select id into b_chat_view from public.permission_bundles where key='chat.view' limit 1;
  select id into b_contacts_view from public.permission_bundles where key='contacts.view' limit 1;
  select id into b_platforms_view from public.permission_bundles where key='platforms.view' limit 1;
  select id into b_analytics_view from public.permission_bundles where key='analytics.view' limit 1;
  select id into b_logs_view from public.permission_bundles where key='logs.view' limit 1;
  select id into b_aiagents_view from public.permission_bundles where key='aiagents.view' limit 1;
  select id into b_humanagents_view from public.permission_bundles where key='humanagents.view' limit 1;
  select id into b_permissions_admin from public.permission_bundles where key='permissions.admin' limit 1;
  select id into master_role from public.roles where name='master_agent' limit 1;

  -- chat.view ← threads.read or messages.read
  if b_chat_view is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_chat_view
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where (p.resource='threads' and p.action='read') or (p.resource='messages' and p.action='read')
    on conflict do nothing;
  end if;

  -- contacts.view ← contacts.read
  if b_contacts_view is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_contacts_view
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where (p.resource='contacts' and p.action='read')
    on conflict do nothing;
  end if;

  -- platforms.view ← channels.read
  if b_platforms_view is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_platforms_view
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where (p.resource='channels' and p.action='read')
    on conflict do nothing;
  end if;

  -- analytics.view ← analytics.view_kpi or analytics.read or other analytics.*
  if b_analytics_view is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_analytics_view
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where p.resource='analytics' and p.action in ('read','view_kpi','view_containment_rate','view_handover_rate')
    on conflict do nothing;
  end if;

  -- logs.view ← audit_logs.read
  if b_logs_view is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_logs_view
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where (p.resource='audit_logs' and p.action='read')
    on conflict do nothing;
  end if;

  -- aiagents.view ← ai_profiles.read
  if b_aiagents_view is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_aiagents_view
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where (p.resource='ai_profiles' and p.action='read')
    on conflict do nothing;
  end if;

  -- humanagents.view ← super_agents.read
  if b_humanagents_view is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_humanagents_view
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where (p.resource='super_agents' and p.action='read')
    on conflict do nothing;
  end if;

  -- permissions.admin ← access_rules.configure (ensure master gets it)
  if b_permissions_admin is not null then
    insert into public.role_bundles(role_id, bundle_id)
    select distinct rp.role_id, b_permissions_admin
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where (p.resource='access_rules' and p.action='configure')
    on conflict do nothing;

    if master_role is not null then
      insert into public.role_bundles(role_id, bundle_id) values (master_role, b_permissions_admin) on conflict do nothing;
    end if;
  end if;
end $$;

-- Admin helper to check if caller is master_agent
create or replace function public.is_master_agent()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'master_agent'
  );
$$;

-- RPCs for granting/revoking role permissions (ensure present)
create or replace function public.grant_role_permission(p_role uuid, p_perm uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  insert into public.role_permissions(role_id, permission_id)
  values (p_role, p_perm)
  on conflict do nothing;
end;
$$;

create or replace function public.revoke_role_permission(p_role uuid, p_perm uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  delete from public.role_permissions where role_id = p_role and permission_id = p_perm;
end;
$$;

-- RPCs for granting/revoking role bundles
create or replace function public.grant_role_bundle(p_role uuid, p_bundle uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  insert into public.role_bundles(role_id, bundle_id)
  values (p_role, p_bundle)
  on conflict do nothing;
end;
$$;

create or replace function public.revoke_role_bundle(p_role uuid, p_bundle uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  delete from public.role_bundles where role_id = p_role and bundle_id = p_bundle;
end;
$$;

-- Seed default bundles and map to existing permissions where present
do $$
declare
  b_chat_view uuid; b_contacts_view uuid; b_platforms_view uuid; b_analytics_view uuid; b_logs_view uuid; b_aiagents_view uuid; b_humanagents_view uuid; b_permissions_admin uuid;
  perm_id uuid;
begin
  -- Insert bundles if missing
  insert into public.permission_bundles(key, name, description)
  values
    ('chat.view', 'Chat: View', 'Read chat threads and messages'),
    ('contacts.view', 'Contacts: View', 'Read contacts and identities'),
    ('platforms.view', 'Platforms: View', 'View connected channels'),
    ('analytics.view', 'Analytics: View', 'View analytics dashboards'),
    ('logs.view', 'Logs: View', 'View audit logs'),
    ('aiagents.view', 'AI Agents: View', 'View AI agent profiles'),
    ('humanagents.view', 'Human Agents: View', 'View human agents'),
    ('permissions.admin', 'Permissions: Admin', 'Manage roles and permissions')
  on conflict (key) do nothing;

  select id into b_chat_view from public.permission_bundles where key='chat.view' limit 1;
  select id into b_contacts_view from public.permission_bundles where key='contacts.view' limit 1;
  select id into b_platforms_view from public.permission_bundles where key='platforms.view' limit 1;
  select id into b_analytics_view from public.permission_bundles where key='analytics.view' limit 1;
  select id into b_logs_view from public.permission_bundles where key='logs.view' limit 1;
  select id into b_aiagents_view from public.permission_bundles where key='aiagents.view' limit 1;
  select id into b_humanagents_view from public.permission_bundles where key='humanagents.view' limit 1;
  select id into b_permissions_admin from public.permission_bundles where key='permissions.admin' limit 1;

  -- Helper to attach (if permission exists)
  perform 1 from public.permissions limit 1; -- ensure table accessible

  -- chat.view → threads.read, messages.read
  select id into perm_id from public.permissions where resource='threads' and action='read' limit 1;
  if b_chat_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_chat_view, perm_id) on conflict do nothing;
  end if;
  select id into perm_id from public.permissions where resource='messages' and action='read' limit 1;
  if b_chat_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_chat_view, perm_id) on conflict do nothing;
  end if;

  -- contacts.view → contacts.read
  select id into perm_id from public.permissions where resource='contacts' and action='read' limit 1;
  if b_contacts_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_contacts_view, perm_id) on conflict do nothing;
  end if;
  -- platforms.view → channels.read
  select id into perm_id from public.permissions where resource='channels' and action='read' limit 1;
  if b_platforms_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_platforms_view, perm_id) on conflict do nothing;
  end if;
  -- analytics.view → analytics.view_kpi (fallback to analytics.read if exists)
  select id into perm_id from public.permissions where resource='analytics' and action='view_kpi' limit 1;
  if perm_id is null then select id into perm_id from public.permissions where resource='analytics' and action='read' limit 1; end if;
  if b_analytics_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_analytics_view, perm_id) on conflict do nothing;
  end if;
  -- logs.view → audit_logs.read
  select id into perm_id from public.permissions where resource='audit_logs' and action='read' limit 1;
  if b_logs_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_logs_view, perm_id) on conflict do nothing;
  end if;
  -- aiagents.view → ai_profiles.read
  select id into perm_id from public.permissions where resource='ai_profiles' and action='read' limit 1;
  if b_aiagents_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_aiagents_view, perm_id) on conflict do nothing;
  end if;
  -- humanagents.view → super_agents.read
  select id into perm_id from public.permissions where resource='super_agents' and action='read' limit 1;
  if b_humanagents_view is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_humanagents_view, perm_id) on conflict do nothing;
  end if;
  -- permissions.admin → access_rules.configure (or roles.update as fallback)
  select id into perm_id from public.permissions where resource='access_rules' and action='configure' limit 1;
  if perm_id is null then select id into perm_id from public.permissions where resource='roles' and action='update' limit 1; end if;
  if b_permissions_admin is not null and perm_id is not null then
    insert into public.bundle_permissions(bundle_id, permission_id) values (b_permissions_admin, perm_id) on conflict do nothing;
  end if;
end $$;

-- Unified effective permissions for current user (direct + bundles + legacy policy)
create or replace view public.v_current_user_permissions as
select distinct p.id, p.name, p.resource, p.action
from public.user_roles ur
join public.role_permissions rp on rp.role_id = ur.role_id
join public.permissions p on p.id = rp.permission_id
where ur.user_id = auth.uid()
union
select distinct p.id, p.name, p.resource, p.action
from public.user_roles ur
join public.role_bundles rb on rb.role_id = ur.role_id
join public.bundle_permissions bp on bp.bundle_id = rb.bundle_id
join public.permissions p on p.id = bp.permission_id
where ur.user_id = auth.uid()
union
select null::uuid as id,
       ('Policy: ' || res.resource || '.' || act.action) as name,
       res.resource::text as resource,
       act.action::text as action
from public.user_roles ur
join public.rbac_policies pol on pol.role_id = ur.role_id
join lateral jsonb_object_keys(coalesce(pol.policy->'resources','{}'::jsonb)) as res(resource) on true
join lateral jsonb_array_elements_text(pol.policy->'resources'->res.resource) as act(action) on true
where ur.user_id = auth.uid();

commit;


