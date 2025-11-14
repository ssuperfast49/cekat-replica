begin;

do $$
declare
  perm_id uuid;
begin
  select id into perm_id
  from public.permissions
  where resource = 'users_profile' and action = 'create'
  limit 1;

  if perm_id is null then
    insert into public.permissions (id, name, resource, action, created_at)
    values (
      gen_random_uuid(),
      'Users Profile: Create',
      'users_profile',
      'create',
      now()
    )
    returning id into perm_id;
  end if;

  if perm_id is null then
    raise exception 'Failed to resolve users_profile.create permission id';
  end if;

  perform 1
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  where r.name = 'master_agent' and rp.permission_id = perm_id;
  if not found then
    insert into public.role_permissions (role_id, permission_id, created_at)
    select r.id, perm_id, now()
    from public.roles r
    where r.name = 'master_agent';
  end if;

  perform 1
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  where r.name = 'super_agent' and rp.permission_id = perm_id;
  if not found then
    insert into public.role_permissions (role_id, permission_id, created_at)
    select r.id, perm_id, now()
    from public.roles r
    where r.name = 'super_agent';
  end if;
end $$;

commit;


