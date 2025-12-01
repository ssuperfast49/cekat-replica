-- Migration: Fix Master Agent Access and Assign Super Agent
-- Purpose: 
-- 1. Ensure master agents can see ALL contacts and threads (remove restrictive checks)
-- 2. Assign all contacts and threads to super agent with email "pouloinoketroi-6559@yopmail.com"

-- ============================================================================
-- STEP 1: Fix master agent policies to ensure full access
-- ============================================================================

-- Drop and recreate contacts_master_read without restrictive checks
DROP POLICY IF EXISTS "contacts_master_read" ON "public"."contacts";
CREATE POLICY "contacts_master_read" ON "public"."contacts" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."org_members" "om" ON "om"."user_id" = "ur"."user_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'master_agent'
        AND "om"."org_id" = "contacts"."org_id"
    )
  );

-- Drop and recreate threads_master_read - remove users_profile check that might block access
DROP POLICY IF EXISTS "threads_master_read" ON "public"."threads";
CREATE POLICY "threads_master_read" ON "public"."threads" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."org_members" "om" ON "om"."user_id" = "ur"."user_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'master_agent'
        AND "om"."org_id" = "threads"."org_id"
    )
  );

-- ============================================================================
-- STEP 2: Assign all contacts and threads to super agent
-- ============================================================================

-- Get the super agent user_id
DO $$
DECLARE
  v_super_agent_id UUID;
BEGIN
  -- Find the super agent by email
  SELECT id INTO v_super_agent_id
  FROM auth.users
  WHERE email = 'pouloinoketroi-6559@yopmail.com';
  
  IF v_super_agent_id IS NULL THEN
    RAISE EXCEPTION 'Super agent with email pouloinoketroi-6559@yopmail.com not found';
  END IF;
  
  -- Update all contacts to have this super_agent_id
  UPDATE "public"."contacts"
  SET "super_agent_id" = v_super_agent_id
  WHERE "super_agent_id" IS NULL;
  
  -- Update all threads to have this super_agent_id
  UPDATE "public"."threads"
  SET "super_agent_id" = v_super_agent_id
  WHERE "super_agent_id" IS NULL;
  
  RAISE NOTICE 'Assigned % contacts and % threads to super agent %', 
    (SELECT COUNT(*) FROM "public"."contacts" WHERE "super_agent_id" = v_super_agent_id),
    (SELECT COUNT(*) FROM "public"."threads" WHERE "super_agent_id" = v_super_agent_id),
    v_super_agent_id;
END $$;

