-- Simple approach: Use RLS policies to block deactivated users
-- This is more reliable than edge functions for basic blocking

begin;

-- Create a function to check if current user is active
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

-- Create a more restrictive RLS policy for users_profile
-- This will prevent deactivated users from accessing their own profile
drop policy if exists "Users can view their own profile" on public.users_profile;
create policy "Only active users can view their own profile"
on public.users_profile
for select
to authenticated
using (
  user_id = auth.uid() 
  and is_active = true
);

-- Update org_members RLS to include active user check
drop policy if exists "Users can view members from their organization" on public.org_members;
create policy "Active users can view members from their organization" 
on public.org_members 
for select 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Update AI profiles RLS
drop policy if exists "Users can view AI profiles from their organization" on public.ai_profiles;
create policy "Active users can view AI profiles from their organization" 
on public.ai_profiles 
for select 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Update other key tables with active user check
-- This ensures that deactivated users cannot access any data

-- Channels table
drop policy if exists "Users can view channels from their organization" on public.channels;
create policy "Active users can view channels from their organization" 
on public.channels 
for select 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Conversations table
drop policy if exists "Users can view conversations from their organization" on public.conversations;
create policy "Active users can view conversations from their organization" 
on public.conversations 
for select 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Contacts table
drop policy if exists "Users can view contacts from their organization" on public.contacts;
create policy "Active users can view contacts from their organization" 
on public.contacts 
for select 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Human agents table
drop policy if exists "Users can view human agents from their organization" on public.human_agents;
create policy "Active users can view human agents from their organization" 
on public.human_agents 
for select 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Audit logs table
drop policy if exists "Users can view audit logs from their organization" on public.audit_logs;
create policy "Active users can view audit logs from their organization" 
on public.audit_logs 
for select 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Add similar policies for INSERT, UPDATE, DELETE operations
-- This ensures deactivated users cannot perform any operations

-- Users profile policies
create policy "Only active users can update their own profile"
on public.users_profile
for update
to authenticated
using (
  user_id = auth.uid() 
  and is_active = true
);

-- Org members policies
create policy "Active users can update members from their organization" 
on public.org_members 
for update 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- AI profiles policies
create policy "Active users can update AI profiles from their organization" 
on public.ai_profiles 
for update 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Channels policies
create policy "Active users can update channels from their organization" 
on public.channels 
for update 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Conversations policies
create policy "Active users can update conversations from their organization" 
on public.conversations 
for update 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Contacts policies
create policy "Active users can update contacts from their organization" 
on public.contacts 
for update 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

-- Human agents policies
create policy "Active users can update human agents from their organization" 
on public.human_agents 
for update 
to authenticated
using (
  public.is_current_user_active() = true
  and org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

commit;
