-- Data Retention and GDPR Compliance
-- Implements 90-day default retention policy and GDPR/PDPA right to erasure

begin;

-- 0) Ensure is_current_user_active() function exists (dependency check)
create or replace function public.is_current_user_active()
returns boolean
language plpgsql
security definer
as $$
declare
  user_is_active boolean;
begin
  -- Check if the current user has an active profile
  select is_active into user_is_active
  from public.users_profile
  where user_id = auth.uid();
  
  -- Return true if user is active, false if deactivated or no profile
  return coalesce(user_is_active, false);
end;
$$;

-- 1) Function: Clean up old chats and messages based on retention_days
create or replace function public.cleanup_old_chat_data(
  p_org_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_retention_days integer;
  v_cutoff_date timestamptz;
  v_deleted_threads integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_contacts integer := 0;
  v_org_count integer := 0;
  v_result jsonb;
begin
  -- If org_id provided, clean only that org; otherwise clean all orgs
  if p_org_id is not null then
    v_org_id := p_org_id;
    
    -- Get retention days for this org (default 90 if not set)
    select coalesce(retention_days, 90)
    into v_retention_days
    from org_settings
    where org_id = v_org_id;
    
    if v_retention_days is null then
      v_retention_days := 90;
    end if;
    
    v_cutoff_date := now() - make_interval(days => v_retention_days);
    
    -- Delete old messages first (due to foreign key)
    with deleted as (
      delete from public.messages m
      using public.threads t
      where m.thread_id = t.id
        and t.org_id = v_org_id
        and t.created_at < v_cutoff_date
      returning m.id
    )
    select count(*) into v_deleted_messages from deleted;
    
    -- Delete old threads
    with deleted as (
      delete from public.threads
      where org_id = v_org_id
        and created_at < v_cutoff_date
      returning id
    )
    select count(*) into v_deleted_threads from deleted;
    
    -- Delete orphaned contacts (no threads referencing them)
    -- Only delete if they're older than retention period
    with deleted as (
      delete from public.contacts c
      where c.org_id = v_org_id
        and c.created_at < v_cutoff_date
        and not exists (
          select 1 from public.threads t
          where t.contact_id = c.id
        )
      returning c.id
    )
    select count(*) into v_deleted_contacts from deleted;
    
    v_org_count := 1;
    
  else
    -- Process all orgs
    for v_org_id, v_retention_days in
      select os.org_id, coalesce(os.retention_days, 90)
      from org_settings os
    loop
      v_cutoff_date := now() - make_interval(days => v_retention_days);
      
      -- Delete messages
      with deleted as (
        delete from public.messages m
        using public.threads t
        where m.thread_id = t.id
          and t.org_id = v_org_id
          and t.created_at < v_cutoff_date
        returning m.id
      )
      select count(*) into v_deleted_messages from deleted;
      
      -- Delete threads
      with deleted as (
        delete from public.threads
        where org_id = v_org_id
          and created_at < v_cutoff_date
        returning id
      )
      select count(*) into v_deleted_threads from deleted;
      
      -- Delete orphaned contacts
      with deleted as (
        delete from public.contacts c
        where c.org_id = v_org_id
          and c.created_at < v_cutoff_date
          and not exists (
            select 1 from public.threads t
            where t.contact_id = c.id
          )
        returning c.id
      )
      select count(*) into v_deleted_contacts from deleted;
      
      v_org_count := v_org_count + 1;
    end loop;
  end if;
  
  v_result := jsonb_build_object(
    'orgs_processed', v_org_count,
    'threads_deleted', v_deleted_threads,
    'messages_deleted', v_deleted_messages,
    'contacts_deleted', v_deleted_contacts,
    'cutoff_date', v_cutoff_date
  );
  
  return v_result;
end $$;

comment on function public.cleanup_old_chat_data is
  'Delete chats, messages, and contacts older than retention_days (default 90) for an org or all orgs. Respects org_settings.retention_days.';

-- 2) Function: GDPR/PDPA delete user data on request
create or replace function public.gdpr_delete_user_data(
  p_contact_id uuid,
  p_org_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_contact_id uuid := p_contact_id;
  v_deleted_threads integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_contact integer := 0;
  v_result jsonb;
begin
  -- Verify org_id matches if provided
  if p_org_id is not null then
    v_org_id := p_org_id;
    
    -- Verify contact belongs to org
    if not exists (
      select 1 from public.contacts
      where id = v_contact_id and org_id = v_org_id
    ) then
      raise exception 'Contact not found in specified organization';
    end if;
  else
    -- Get org_id from contact
    select org_id into v_org_id
    from public.contacts
    where id = v_contact_id;
    
    if v_org_id is null then
      raise exception 'Contact not found';
    end if;
  end if;
  
  -- Delete all messages for threads belonging to this contact
  with deleted as (
    delete from public.messages m
    using public.threads t
    where m.thread_id = t.id
      and t.contact_id = v_contact_id
      and t.org_id = v_org_id
    returning m.id
  )
  select count(*) into v_deleted_messages from deleted;
  
  -- Delete all threads for this contact
  with deleted as (
    delete from public.threads
    where contact_id = v_contact_id
      and org_id = v_org_id
    returning id
  )
  select count(*) into v_deleted_threads from deleted;
  
  -- Delete the contact itself
  with deleted as (
    delete from public.contacts
    where id = v_contact_id
      and org_id = v_org_id
    returning id
  )
  select count(*) into v_deleted_contact from deleted;
  
  v_result := jsonb_build_object(
    'contact_id', v_contact_id,
    'org_id', v_org_id,
    'threads_deleted', v_deleted_threads,
    'messages_deleted', v_deleted_messages,
    'contact_deleted', v_deleted_contact,
    'success', true
  );
  
  return v_result;
end $$;

comment on function public.gdpr_delete_user_data is
  'GDPR/PDPA compliant deletion of all user data for a specific contact. Deletes all threads, messages, and the contact record.';

-- 3) RLS: Allow users to update org_settings.retention_days for their org (master/super agents only)
drop policy if exists "Active users can update org_settings for their organization" on public.org_settings;
create policy "Active users can update org_settings for their organization"
on public.org_settings
for update
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members om
    join public.user_roles ur on ur.user_id = om.user_id
    join public.roles r on r.id = ur.role_id
    where om.user_id = auth.uid()
      and lower(r.name) in ('master_agent', 'super_agent')
  )
)
with check (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members om
    join public.user_roles ur on ur.user_id = om.user_id
    join public.roles r on r.id = ur.role_id
    where om.user_id = auth.uid()
      and lower(r.name) in ('master_agent', 'super_agent')
  )
);

-- 4) RLS: Allow execution of cleanup function (same role check)
grant execute on function public.cleanup_old_chat_data(uuid) to authenticated;
grant execute on function public.gdpr_delete_user_data(uuid, uuid) to authenticated;

-- 5) Try to schedule automatic cleanup job (daily at 2 AM UTC)
do $$
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if not found then
    begin
      create extension if not exists pg_cron with schema cron;
    exception when others then
      null;
    end;
  end if;

  begin
    -- Unschedule existing job if it exists
    perform cron.unschedule('daily_cleanup_old_chat_data');
  exception when others then
    null;
  end;

  begin
    -- Schedule daily cleanup at 2 AM UTC
    perform cron.schedule(
      'daily_cleanup_old_chat_data',
      '0 2 * * *',
      'select public.cleanup_old_chat_data();'
    );
  exception when others then
    -- Ignore if scheduling fails (may not have permissions)
    null;
  end;
exception when others then
  -- Ignore if pg_cron not available
  null;
end $$;

-- 6) Initialize default retention_days for existing orgs without settings
insert into public.org_settings (org_id, retention_days)
select id, 90
from public.orgs
where id not in (select org_id from public.org_settings)
on conflict (org_id) do nothing;

commit;

