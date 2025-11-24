begin;

-- Allow non-master users to read their own audit logs
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='Users can read own logs'
  ) then
    create policy "Users can read own logs" on public.audit_logs
      for select to authenticated using (
        user_id = auth.uid()
      );
  end if;
end $$;

-- RPC: get_audit_logs with filters and pagination (server validated)
create or replace function public.get_audit_logs(
  p_user_id uuid default null,
  p_action text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50,
  p_offset int default 0
) returns setof public.audit_logs
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_master boolean;
begin
  -- Only master_agent can read org-wide; others restricted to own user_id
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'master_agent'
  ) into v_is_master;

  return query
  select * from public.audit_logs l
  where
    (case when v_is_master then true else l.user_id = auth.uid() end)
    and (p_user_id is null or l.user_id = p_user_id)
    and (p_action is null or l.action = p_action)
    and (p_from is null or l.created_at >= p_from)
    and (p_to is null or l.created_at < p_to)
  order by l.created_at desc
  limit greatest(0, least(p_limit, 500)) offset greatest(0, p_offset);
end;
$$;

commit;


