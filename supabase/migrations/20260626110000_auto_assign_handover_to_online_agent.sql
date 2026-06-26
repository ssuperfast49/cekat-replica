-- When a thread becomes handover-active (ai_handoff_at transitions from NULL to set),
-- pick an online agent assigned to the channel and set them as the collaborator
-- so the conversation lands on a human in real time instead of staying "Unassigned".
--
-- "Online" = users_profile.is_active = true AND last_seen_at within 3 minutes.
-- (PresenceContext keeps last_seen_at fresh while the agent has the app open.)
-- Tie-break: fewest open/pending threads currently, then most recently seen.
-- Falls through to "no assignee" if no online agents are available - the existing
-- Takeover Chat UI still works as a manual fallback.

create or replace function public.auto_assign_handover_to_online_agent()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pick      uuid;
  v_threshold interval := interval '3 minutes';
begin
  -- Only act when handover just became active and no human is on the thread yet.
  if not (
        new.ai_handoff_at is not null
    and (old.ai_handoff_at is null or old.ai_handoff_at <> new.ai_handoff_at)
    and new.collaborator_user_id is null
  ) then
    return new;
  end if;

  with candidates as (
    -- channel_agents explicitly assigned to this channel
    select ca.user_id
      from public.channel_agents ca
     where ca.channel_id = new.channel_id
    union
    -- the channel's super agent (owner) - always eligible
    select c.super_agent_id as user_id
      from public.channels c
     where c.id = new.channel_id
       and c.super_agent_id is not null
  ),
  online_agents as (
    select c.user_id,
           up.last_seen_at
      from candidates c
      join public.users_profile up on up.user_id = c.user_id
     where up.is_active = true
       and up.last_seen_at is not null
       and up.last_seen_at >= now() - v_threshold
  ),
  workload as (
    select oa.user_id,
           oa.last_seen_at,
           coalesce(t.cnt, 0) as open_threads
      from online_agents oa
      left join (
        select coalesce(collaborator_user_id, assignee_user_id) as agent_uid,
               count(*) as cnt
          from public.threads
         where status in ('open'::public.thread_status, 'pending'::public.thread_status)
           and coalesce(collaborator_user_id, assignee_user_id) is not null
         group by 1
      ) t on t.agent_uid = oa.user_id
  )
  select user_id into v_pick
    from workload
   order by open_threads asc, last_seen_at desc
   limit 1;

  if v_pick is not null then
    new.collaborator_user_id := v_pick;
    new.status               := 'pending'::public.thread_status;
    new.assigned_at          := coalesce(new.assigned_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists tr_auto_assign_handover_to_online_agent on public.threads;
create trigger tr_auto_assign_handover_to_online_agent
before update on public.threads
for each row execute function public.auto_assign_handover_to_online_agent();

comment on function public.auto_assign_handover_to_online_agent is
'When a thread enters handover (ai_handoff_at set), auto-pick an online channel agent (last_seen_at within 3 minutes) as the collaborator. Tiebreaks on lowest current workload.';
