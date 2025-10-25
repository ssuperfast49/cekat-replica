-- Check the current status of the user account
-- Run this in your Supabase SQL Editor to see the user's current status

-- First, let's find the user ID for the email
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
WHERE email = 'pouloinoketroi-6559@yopmail.com';

-- Then check their profile status
SELECT user_id, is_active, created_at, display_name
FROM public.users_profile 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email = 'pouloinoketroi-6559@yopmail.com'
);

-- If no profile exists, that's the issue - we need to create one or handle missing profiles
-- Let's also check if RLS policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users_profile';
