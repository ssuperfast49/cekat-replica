begin;

-- Ensure permission exists
insert into public.permissions (id, name, resource, action, created_at)
values (
  gen_random_uuid(),
  'Audit Logs: Read',
  'audit_logs',
  'read',
  now()
)
on conflict (id) do nothing;

-- Upsert by (resource, action) in case id differs
do $$
declare p_id uuid;
begin
  select id into p_id from public.permissions where resource='audit_logs' and action='read' limit 1;
  if p_id is null then
    insert into public.permissions (id, name, resource, action, created_at)
    values (gen_random_uuid(), 'Audit Logs: Read', 'audit_logs', 'read', now())
    returning id into p_id;
  end if;

  -- Assign to master_agent role
  perform 1 from public.roles r
  join public.role_permissions rp on rp.role_id = r.id and rp.permission_id = p_id
  where r.name = 'master_agent';
  if not found then
    insert into public.role_permissions (role_id, permission_id, created_at)
    select r.id, p_id, now() from public.roles r where r.name='master_agent';
  end if;
end $$;

commit;


