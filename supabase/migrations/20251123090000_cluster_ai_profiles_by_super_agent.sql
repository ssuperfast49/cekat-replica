-- Add super agent clustering to AI profiles and ensure channels mirror the assignment.

-- 1. Add the super_agent_id column if it doesn't already exist
do $$
begin
  alter table public.ai_profiles add column if not exists super_agent_id uuid;
exception
  when duplicate_column then null;
end
$$;

-- 2. Ensure an index and foreign key exist for the new column
create index if not exists idx_ai_profiles_super_agent on public.ai_profiles(super_agent_id);

alter table public.ai_profiles
  drop constraint if exists ai_profiles_super_agent_id_fkey;

alter table public.ai_profiles
  add constraint ai_profiles_super_agent_id_fkey
  foreign key (super_agent_id) references auth.users(id) on delete set null;

-- 3. Backfill AI profile assignments from existing channels (one super agent per AI profile)
with ranked_channels as (
  select
    ch.ai_profile_id,
    ch.super_agent_id,
    row_number() over (
      partition by ch.ai_profile_id
      order by ch.updated_at desc nulls last, ch.created_at desc nulls last
    ) as rn
  from public.channels ch
  where ch.ai_profile_id is not null
    and ch.super_agent_id is not null
),
selected_super as (
  select ai_profile_id, super_agent_id
  from ranked_channels
  where rn = 1
)
update public.ai_profiles ap
set super_agent_id = ss.super_agent_id
from selected_super ss
where ap.id = ss.ai_profile_id
  and (ap.super_agent_id is distinct from ss.super_agent_id);

-- 4. Align existing channels with the AI profile assignment
update public.channels ch
set super_agent_id = ap.super_agent_id
from public.ai_profiles ap
where ap.id = ch.ai_profile_id
  and (ch.super_agent_id is distinct from ap.super_agent_id);

-- 4b. If an organisation only has a single super agent, assign unowned AI agents to them
with super_counts as (
  select
    org_id,
    array_agg(user_id order by agent_name nulls last, email nulls last) as super_ids,
    count(*) as super_count
  from public.v_human_agents
  where role_name ilike '%super%'
  group by org_id
),
single_super as (
  select org_id, super_ids[1] as super_agent_id
  from super_counts
  where super_count = 1
)
update public.ai_profiles ap
set super_agent_id = ss.super_agent_id
from single_super ss
where ap.org_id = ss.org_id
  and ap.super_agent_id is null;

-- Ensure channels mirror the update if they were previously null
update public.channels ch
set super_agent_id = ap.super_agent_id
from public.ai_profiles ap
where ap.id = ch.ai_profile_id
  and (ch.super_agent_id is distinct from ap.super_agent_id);

-- 5. Refresh policies to enforce clustered access control
drop policy if exists "Allow authenticated access to ai_profiles" on public.ai_profiles;
drop policy if exists "auth read" on public.ai_profiles;
drop policy if exists "auth insert" on public.ai_profiles;
drop policy if exists "auth update" on public.ai_profiles;
drop policy if exists "auth delete" on public.ai_profiles;

create policy ai_profiles_select_clustered on public.ai_profiles
  for select
  to authenticated
  using (
    auth.uid() is null -- service role / backend operations
    or public.is_master_agent(auth.uid())
    or (super_agent_id is not null and super_agent_id = auth.uid())
    or exists (
      select 1
      from public.super_agent_members sam
      where sam.agent_user_id = auth.uid()
        and sam.super_agent_id = public.ai_profiles.super_agent_id
    )
  );

create policy ai_profiles_insert_clustered on public.ai_profiles
  for insert
  to authenticated
  with check (
    auth.uid() is null
    or public.is_master_agent(auth.uid())
    or (super_agent_id is not null and super_agent_id = auth.uid())
  );

create policy ai_profiles_update_clustered on public.ai_profiles
  for update
  to authenticated
  using (
    auth.uid() is null
    or public.is_master_agent(auth.uid())
    or (super_agent_id is not null and super_agent_id = auth.uid())
  )
  with check (
    auth.uid() is null
    or public.is_master_agent(auth.uid())
    or (super_agent_id is not null and super_agent_id = auth.uid())
  );

create policy ai_profiles_delete_clustered on public.ai_profiles
  for delete
  to authenticated
  using (
    auth.uid() is null
    or public.is_master_agent(auth.uid())
  );

