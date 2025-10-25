-- Comprehensive fix for deactivated user blocking
-- Run this in your Supabase SQL Editor

BEGIN;

-- Step 1: Deactivate the specific user
INSERT INTO public.users_profile (user_id, is_active, display_name, created_at)
SELECT 
  id, 
  false, 
  'Deactivated User', 
  NOW()
FROM auth.users 
WHERE email = 'pouloinoketroi-6559@yopmail.com'
ON CONFLICT (user_id) DO UPDATE SET is_active = false;

-- Step 2: Create the helper function
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_is_active boolean;
BEGIN
  -- Check if the current user has an active profile
  SELECT is_active INTO user_is_active
  FROM public.users_profile
  WHERE user_id = auth.uid();
  
  -- Return true if user is active, false if deactivated or no profile
  RETURN COALESCE(user_is_active, false);
END;
$$;

-- Step 3: Create restrictive RLS policies
-- Users profile policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users_profile;
CREATE POLICY "Only active users can view their own profile"
ON public.users_profile
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  AND is_active = true
);

-- Org members policies
DROP POLICY IF EXISTS "Users can view members from their organization" ON public.org_members;
CREATE POLICY "Active users can view members from their organization" 
ON public.org_members 
FOR SELECT 
TO authenticated
USING (
  public.is_current_user_active() = true
  AND org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- AI profiles policies
DROP POLICY IF EXISTS "Users can view AI profiles from their organization" ON public.ai_profiles;
CREATE POLICY "Active users can view AI profiles from their organization" 
ON public.ai_profiles 
FOR SELECT 
TO authenticated
USING (
  public.is_current_user_active() = true
  AND org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Channels policies
DROP POLICY IF EXISTS "Users can view channels from their organization" ON public.channels;
CREATE POLICY "Active users can view channels from their organization" 
ON public.channels 
FOR SELECT 
TO authenticated
USING (
  public.is_current_user_active() = true
  AND org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Conversations policies
DROP POLICY IF EXISTS "Users can view conversations from their organization" ON public.conversations;
CREATE POLICY "Active users can view conversations from their organization" 
ON public.conversations 
FOR SELECT 
TO authenticated
USING (
  public.is_current_user_active() = true
  AND org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Contacts policies
DROP POLICY IF EXISTS "Users can view contacts from their organization" ON public.contacts;
CREATE POLICY "Active users can view contacts from their organization" 
ON public.contacts 
FOR SELECT 
TO authenticated
USING (
  public.is_current_user_active() = true
  AND org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Human agents policies
DROP POLICY IF EXISTS "Users can view human agents from their organization" ON public.human_agents;
CREATE POLICY "Active users can view human agents from their organization" 
ON public.human_agents 
FOR SELECT 
TO authenticated
USING (
  public.is_current_user_active() = true
  AND org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Audit logs policies
DROP POLICY IF EXISTS "Users can view audit logs from their organization" ON public.audit_logs;
CREATE POLICY "Active users can view audit logs from their organization" 
ON public.audit_logs 
FOR SELECT 
TO authenticated
USING (
  public.is_current_user_active() = true
  AND org_id IN (
    SELECT org_id FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Step 4: Add UPDATE policies to prevent modifications
CREATE POLICY "Only active users can update their own profile"
ON public.users_profile
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  AND is_active = true
);

-- Step 5: Verify the user is deactivated
SELECT 
  u.email,
  up.user_id,
  up.is_active,
  up.display_name,
  up.created_at
FROM auth.users u
LEFT JOIN public.users_profile up ON up.user_id = u.id
WHERE u.email = 'pouloinoketroi-6559@yopmail.com';

COMMIT;
