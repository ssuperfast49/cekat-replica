create or replace function public.get_push_targets(
  p_thread_id uuid,
  p_sender_user_id uuid default null
)
returns table (
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  contact_name text,
  channel_id uuid
)
language sql
security definer
set search_path = public, auth
as $$
  with thread as (
    select t.id, t.assignee_user_id, t.collaborator_user_id, t.channel_id,
           coalesce(c.name, 'Unknown User') as contact_name
    from public.threads t
    left join public.contacts c on c.id = t.contact_id
    where t.id = p_thread_id
  ),
  recipients as (
    select t.assignee_user_id as user_id from thread t where t.assignee_user_id is not null
    union
    select t.collaborator_user_id from thread t where t.collaborator_user_id is not null
    union
    select ur.user_id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.name = 'superadmin'
  )
  select ps.id, ps.endpoint, ps.p256dh, ps.auth, t.contact_name, t.channel_id
  from public.push_subscriptions ps
  join recipients rec on rec.user_id = ps.user_id
  join auth.users u on u.id = ps.user_id
  cross join thread t
  where (p_sender_user_id is null or rec.user_id <> p_sender_user_id)
    and coalesce((u.raw_user_meta_data->>'notifications_enabled')::boolean, true) = true
$$;

revoke all on function public.get_push_targets(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_push_targets(uuid, uuid) to service_role;

comment on function public.get_push_targets is 'Resolves Web Push targets for a new inbound message. Mirrors GlobalMessageListener.tsx recipient rules.';
