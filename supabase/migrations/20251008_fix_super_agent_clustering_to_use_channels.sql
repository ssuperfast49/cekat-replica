begin;

-- Drop existing policies that use ai_profiles.super_agent_id
drop policy if exists threads_super_read on public.threads;
drop policy if exists messages_by_thread_read on public.messages;

-- Recreate threads_super_read policy using channels.super_agent_id instead of ai_profiles.super_agent_id
create policy threads_super_read on public.threads
  for select using (
    exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.name = 'super_agent'
    )
    and (
      -- Threads handled by agents in this super-agent's cluster (any of the staff columns)
      exists (
        select 1 from public.super_agent_members sam
        where sam.org_id = threads.org_id
          and sam.super_agent_id = auth.uid()
          and (
            sam.agent_user_id = threads.assignee_user_id or
            sam.agent_user_id = threads.assigned_by_user_id or
            sam.agent_user_id = threads.resolved_by_user_id
          )
      )
      or
      -- Threads on channels owned by this super agent (using channels.super_agent_id)
      exists (
        select 1
        from public.channels ch
        where ch.id = threads.channel_id and ch.super_agent_id = auth.uid()
      )
    )
  );

-- Recreate messages_by_thread_read policy using channels.super_agent_id
create policy messages_by_thread_read on public.messages
  for select using (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (
          -- master within org of the thread
          exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            join public.org_members om on om.user_id = ur.user_id and om.org_id = t.org_id
            where ur.user_id = auth.uid() and r.name = 'master_agent'
          )
          or
          -- super-agent cluster or channel-ownership
          (
            exists (
              select 1 from public.user_roles ur
              join public.roles r on r.id = ur.role_id
              where ur.user_id = auth.uid() and r.name = 'super_agent'
            ) and (
              exists (
                select 1 from public.super_agent_members sam
                where sam.org_id = t.org_id and sam.super_agent_id = auth.uid()
                  and (
                    sam.agent_user_id = t.assignee_user_id or
                    sam.agent_user_id = t.assigned_by_user_id or
                    sam.agent_user_id = t.resolved_by_user_id
                  )
              )
              or exists (
                select 1 from public.channels ch
                where ch.id = t.channel_id and ch.super_agent_id = auth.uid()
              )
            )
          )
          or
          -- agent visibility
          (
            exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.org_id = t.org_id)
            and (
              t.assignee_user_id = auth.uid() or
              t.assigned_by_user_id = auth.uid() or
              t.resolved_by_user_id = auth.uid() or
              exists (
                select 1 from public.channel_agents ca
                where ca.channel_id = t.channel_id and ca.user_id = auth.uid()
              )
            )
          )
        )
    )
  );

commit;
