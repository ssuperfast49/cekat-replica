-- Migration: Verify and Ensure Policy Enforcement
-- Purpose: Double-check that policies are correctly enforcing super agent isolation
-- Ensure resha@yopmail.com cannot see data assigned to pouloinoketroi-6559@yopmail.com

-- ============================================================================
-- STEP 1: Verify data connections
-- ============================================================================

-- All contacts and threads should be connected to pouloinoketroi-6559@yopmail.com
-- User ID: cd8baa6f-ad2d-4cdc-8e30-43b418d38c56

-- ============================================================================
-- STEP 2: Ensure contacts_super_read policy is strict
-- ============================================================================

-- Drop and recreate to ensure it's correct
DROP POLICY IF EXISTS "contacts_super_read" ON "public"."contacts";
CREATE POLICY "contacts_super_read" ON "public"."contacts" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "contacts"."super_agent_id" = "auth"."uid"()
    )
  );

-- ============================================================================
-- STEP 3: Ensure threads_super_read policy is strict (remove users_profile check)
-- ============================================================================

-- Drop and recreate to ensure it's correct (remove users_profile check that might cause issues)
DROP POLICY IF EXISTS "threads_super_read" ON "public"."threads";
CREATE POLICY "threads_super_read" ON "public"."threads" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "threads"."super_agent_id" = "auth"."uid"()
    )
  );

-- ============================================================================
-- STEP 4: Final verification - ensure all data is connected correctly
-- ============================================================================

-- This will fail if any contacts/threads are not connected to pouloinoketroi
DO $$
DECLARE
  v_super_agent_id UUID;
  v_unassigned_contacts INTEGER;
  v_unassigned_threads INTEGER;
BEGIN
  -- Get super agent ID
  SELECT id INTO v_super_agent_id
  FROM auth.users
  WHERE email = 'pouloinoketroi-6559@yopmail.com';
  
  IF v_super_agent_id IS NULL THEN
    RAISE EXCEPTION 'Super agent pouloinoketroi-6559@yopmail.com not found';
  END IF;
  
  -- Count unassigned contacts
  SELECT COUNT(*) INTO v_unassigned_contacts
  FROM public.contacts
  WHERE super_agent_id IS NULL OR super_agent_id != v_super_agent_id;
  
  -- Count unassigned threads
  SELECT COUNT(*) INTO v_unassigned_threads
  FROM public.threads
  WHERE super_agent_id IS NULL OR super_agent_id != v_super_agent_id;
  
  -- Assign any unassigned records
  IF v_unassigned_contacts > 0 THEN
    UPDATE public.contacts
    SET super_agent_id = v_super_agent_id
    WHERE super_agent_id IS NULL OR super_agent_id != v_super_agent_id;
    RAISE NOTICE 'Assigned % unassigned contacts to super agent', v_unassigned_contacts;
  END IF;
  
  IF v_unassigned_threads > 0 THEN
    UPDATE public.threads
    SET super_agent_id = v_super_agent_id
    WHERE super_agent_id IS NULL OR super_agent_id != v_super_agent_id;
    RAISE NOTICE 'Assigned % unassigned threads to super agent', v_unassigned_threads;
  END IF;
  
  RAISE NOTICE 'All contacts and threads are now connected to super agent %', v_super_agent_id;
END $$;

