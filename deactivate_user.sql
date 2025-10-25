-- Deactivate the specific user account
-- Run this in your Supabase SQL Editor

-- First, let's find the user ID
SELECT id, email FROM auth.users WHERE email = 'pouloinoketroi-6559@yopmail.com';

-- Then check if they have a profile
SELECT user_id, is_active FROM public.users_profile 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'pouloinoketroi-6559@yopmail.com'
);

-- If no profile exists, create one with is_active = false
INSERT INTO public.users_profile (user_id, is_active, display_name, created_at)
SELECT 
  id, 
  false, 
  'Deactivated User', 
  NOW()
FROM auth.users 
WHERE email = 'pouloinoketroi-6559@yopmail.com'
ON CONFLICT (user_id) DO UPDATE SET is_active = false;

-- Verify the user is now deactivated
SELECT user_id, is_active, display_name, created_at 
FROM public.users_profile 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'pouloinoketroi-6559@yopmail.com'
);
