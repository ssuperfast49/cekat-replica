-- Migration: Fix Master Agent Access to Contacts and Threads
-- Purpose: Ensure master agents can see ALL contacts and threads in their organization
-- Issue: threads_master_read has wrong role (public instead of authenticated) and generic auth policies interfere

-- ============================================================================
-- THREADS TABLE - Fix master agent read policy
-- ============================================================================

-- Drop the incorrectly configured threads_master_read policy
DROP POLICY IF EXISTS "threads_master_read" ON "public"."threads";

-- Recreate threads_master_read with correct role (authenticated instead of public)
CREATE POLICY "threads_master_read" ON "public"."threads" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."users_profile"
      WHERE "users_profile"."user_id" = "auth"."uid"()
        AND "users_profile"."is_active" = true
    )
    AND EXISTS (
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
-- THREADS TABLE - Drop overly permissive auth policies
-- ============================================================================

-- Drop generic auth policies that allow any authenticated user to modify threads
DROP POLICY IF EXISTS "auth insert" ON "public"."threads";
DROP POLICY IF EXISTS "auth update" ON "public"."threads";
DROP POLICY IF EXISTS "auth delete" ON "public"."threads";

-- ============================================================================
-- CONTACTS TABLE - Verify master agent read policy is correct
-- ============================================================================

-- The contacts_master_read policy should already be correct, but let's verify
-- it exists and has the right structure. If it doesn't exist, create it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'contacts' 
      AND policyname = 'contacts_master_read'
  ) THEN
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
  END IF;
END $$;

