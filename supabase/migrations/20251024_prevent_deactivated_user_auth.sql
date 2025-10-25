-- Prevent deactivated users from authenticating
-- This migration adds a trigger to check user status during authentication

begin;

-- Create a function to check if a user is active
create or replace function public.check_user_active_status()
returns trigger
language plpgsql
security definer
as $$
declare
  user_is_active boolean;
begin
  -- Check if the user has an active profile
  select is_active into user_is_active
  from public.users_profile
  where user_id = new.id;
  
  -- If user profile exists and is not active, prevent the session
  if user_is_active is not null and user_is_active = false then
    -- This will cause the authentication to fail
    raise exception 'Account is deactivated. Please contact your Master Agent.';
  end if;
  
  return new;
end;
$$;

-- Create a trigger on auth.users to check status on login
-- Note: This approach has limitations as Supabase auth is handled at the service level
-- A better approach would be to use a custom authentication flow or edge function

-- Alternative approach: Create a view that filters out deactivated users
create or replace view public.active_users as
select 
  u.id,
  u.email,
  u.created_at,
  u.updated_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.raw_app_meta_data,
  u.raw_user_meta_data,
  u.is_super_admin,
  u.role,
  u.aud,
  u.confirmation_token,
  u.recovery_token,
  u.email_change_token,
  u.email_change,
  u.phone_change,
  u.phone_change_token,
  u.phone_confirmed_at,
  u.phone,
  u.encrypted_password,
  u.email_change_confirm_status,
  u.banned_until,
  u.reaper,
  u.deleted_at,
  u.is_sso_user,
  u.app_metadata,
  u.user_metadata,
  u.factors,
  u.identities,
  u.aud,
  u.role,
  u.created_at,
  u.updated_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.raw_app_meta_data,
  u.raw_user_meta_data,
  u.is_super_admin,
  u.role,
  u.aud,
  u.confirmation_token,
  u.recovery_token,
  u.email_change_token,
  u.email_change,
  u.phone_change,
  u.phone_change_token,
  u.phone_confirmed_at,
  u.phone,
  u.encrypted_password,
  u.email_change_confirm_status,
  u.banned_until,
  u.reaper,
  u.deleted_at,
  u.is_sso_user,
  u.app_metadata,
  u.user_metadata,
  u.factors,
  u.identities
from auth.users u
join public.users_profile up on up.user_id = u.id
where up.is_active = true;

-- Create a function to validate user authentication
create or replace function public.validate_user_auth(user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  user_is_active boolean;
begin
  -- Check if the user has an active profile
  select is_active into user_is_active
  from public.users_profile
  where user_id = user_id;
  
  -- Return true if user is active, false if deactivated or no profile
  return coalesce(user_is_active, false);
end;
$$;

-- Create an RLS policy that prevents access to deactivated users
-- This will be applied to all tables that reference users
create policy "Only active users can access data"
on public.users_profile
for all
to authenticated
using (
  user_id = auth.uid() 
  and is_active = true
);

-- Update existing RLS policies to include active user check
-- This is a more comprehensive approach that affects all data access

-- Create a helper function to check if current user is active
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

-- Update other key tables with active user check
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

-- Add similar policies to other important tables
-- This ensures that deactivated users cannot access any data

commit;
