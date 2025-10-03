begin;

-- Ensure RLS is enabled on core conversation tables
alter table public.threads enable row level security;
alter table public.messages enable row level security;

-- Drop old policies if they exist (idempotent)
drop policy if exists threads_master_read on public.threads;
drop policy if exists threads_super_read on public.threads;
drop policy if exists threads_agent_read on public.threads;

drop policy if exists messages_by_thread_read on public.messages;

-- Helper predicates embedded directly in policies to avoid function dependencies
-- 1) Master agents: full read within their organizations
create policy threads_master_read on public.threads
  for select using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.org_members om on om.user_id = ur.user_id and om.org_id = threads.org_id
      where ur.user_id = auth.uid() and r.name = 'master_agent'
    )
  );

-- 2) Super agents: read only threads in their cluster OR created on channels owned by their AI agents
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
      -- Threads on channels whose AI profile belongs to this super agent
      exists (
        select 1
        from public.channels ch
        join public.ai_profiles ap on ap.id = ch.ai_profile_id
        where ch.id = threads.channel_id and ap.super_agent_id = auth.uid()
      )
    )
  );

-- 3) Agents: read their own threads or channels where they are assigned
create policy threads_agent_read on public.threads
  for select using (
    exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.org_id = threads.org_id)
    and (
      threads.assignee_user_id = auth.uid() or
      threads.assigned_by_user_id = auth.uid() or
      threads.resolved_by_user_id = auth.uid() or
      exists (
        select 1 from public.channel_agents ca
        where ca.channel_id = threads.channel_id and ca.user_id = auth.uid()
      )
    )
  );

-- Messages inherit visibility from their parent thread
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
          -- super-agent cluster or AI-ownership
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
                join public.ai_profiles ap on ap.id = ch.ai_profile_id
                where ch.id = t.channel_id and ap.super_agent_id = auth.uid()
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


