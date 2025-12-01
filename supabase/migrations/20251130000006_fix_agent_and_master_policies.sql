-- Migration: Fix Agent and Master Agent Policies
-- Purpose: Ensure agents can only access their super agent's data, and master agents have full access
-- Updates policies to use direct super_agent_id checks and ensure no conflicts

-- ============================================================================
-- STEP 1: Update messages policies to use threads.super_agent_id
-- ============================================================================

-- Drop existing messages_super_read policy
DROP POLICY IF EXISTS "messages_super_read" ON "public"."messages";

-- Recreate messages_super_read: check threads.super_agent_id directly
CREATE POLICY "messages_super_read" ON "public"."messages" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "t"."super_agent_id" = "auth"."uid"()
    )
  );

-- Drop existing messages_agent_read policy
DROP POLICY IF EXISTS "messages_agent_read" ON "public"."messages";

-- Recreate messages_agent_read: check threads.super_agent_id via super_agent_members
CREATE POLICY "messages_agent_read" ON "public"."messages" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "t"."super_agent_id"
    )
  );

-- Drop existing messages_super_update/delete policies
DROP POLICY IF EXISTS "messages_super_update" ON "public"."messages";
DROP POLICY IF EXISTS "messages_super_delete" ON "public"."messages";

-- Recreate messages_super_update: check threads.super_agent_id directly
CREATE POLICY "messages_super_update" ON "public"."messages" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "t"."super_agent_id" = "auth"."uid"()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "t"."super_agent_id" = "auth"."uid"()
    )
  );

-- Recreate messages_super_delete: check threads.super_agent_id directly
CREATE POLICY "messages_super_delete" ON "public"."messages" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "t"."super_agent_id" = "auth"."uid"()
    )
  );

-- ============================================================================
-- STEP 2: Update contacts policies to use direct super_agent_id
-- ============================================================================

-- Drop existing contacts_super_update/delete policies
DROP POLICY IF EXISTS "contacts_super_update" ON "public"."contacts";
DROP POLICY IF EXISTS "contacts_super_delete" ON "public"."contacts";

-- Recreate contacts_super_update: check contacts.super_agent_id directly
CREATE POLICY "contacts_super_update" ON "public"."contacts" 
  FOR UPDATE 
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "contacts"."super_agent_id" = "auth"."uid"()
    )
  );

-- Recreate contacts_super_delete: check contacts.super_agent_id directly
CREATE POLICY "contacts_super_delete" ON "public"."contacts" 
  FOR DELETE 
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
-- STEP 3: Update threads policies to use direct super_agent_id
-- ============================================================================

-- Drop existing threads_super_update/delete policies
DROP POLICY IF EXISTS "threads_super_update" ON "public"."threads";
DROP POLICY IF EXISTS "threads_super_delete" ON "public"."threads";

-- Recreate threads_super_update: check threads.super_agent_id directly
CREATE POLICY "threads_super_update" ON "public"."threads" 
  FOR UPDATE 
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "threads"."super_agent_id" = "auth"."uid"()
    )
  );

-- Recreate threads_super_delete: check threads.super_agent_id directly
CREATE POLICY "threads_super_delete" ON "public"."threads" 
  FOR DELETE 
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
-- STEP 4: Update threads_agent_update/delete to use direct super_agent_id
-- ============================================================================

-- Drop existing threads_agent_update/delete policies
DROP POLICY IF EXISTS "threads_agent_update" ON "public"."threads";
DROP POLICY IF EXISTS "threads_agent_delete" ON "public"."threads";

-- Recreate threads_agent_update: check threads.super_agent_id via super_agent_members
CREATE POLICY "threads_agent_update" ON "public"."threads" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "threads"."super_agent_id"
        AND (
          "threads"."assignee_user_id" = "auth"."uid"()
          OR "threads"."assigned_by_user_id" = "auth"."uid"()
          OR "threads"."resolved_by_user_id" = "auth"."uid"()
          OR EXISTS (
            SELECT 1
            FROM "public"."thread_collaborators" "tc"
            WHERE "tc"."thread_id" = "threads"."id"
              AND "tc"."user_id" = "auth"."uid"()
          )
          OR EXISTS (
            SELECT 1
            FROM "public"."channel_agents" "ca"
            WHERE "ca"."channel_id" = "threads"."channel_id"
              AND "ca"."user_id" = "auth"."uid"()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "threads"."super_agent_id"
        AND (
          "threads"."assignee_user_id" = "auth"."uid"()
          OR "threads"."assigned_by_user_id" = "auth"."uid"()
          OR "threads"."resolved_by_user_id" = "auth"."uid"()
          OR EXISTS (
            SELECT 1
            FROM "public"."thread_collaborators" "tc"
            WHERE "tc"."thread_id" = "threads"."id"
              AND "tc"."user_id" = "auth"."uid"()
          )
          OR EXISTS (
            SELECT 1
            FROM "public"."channel_agents" "ca"
            WHERE "ca"."channel_id" = "threads"."channel_id"
              AND "ca"."user_id" = "auth"."uid"()
          )
        )
    )
  );

-- Recreate threads_agent_delete: check threads.super_agent_id via super_agent_members
CREATE POLICY "threads_agent_delete" ON "public"."threads" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "threads"."super_agent_id"
        AND (
          "threads"."assignee_user_id" = "auth"."uid"()
          OR "threads"."assigned_by_user_id" = "auth"."uid"()
          OR "threads"."resolved_by_user_id" = "auth"."uid"()
          OR EXISTS (
            SELECT 1
            FROM "public"."thread_collaborators" "tc"
            WHERE "tc"."thread_id" = "threads"."id"
              AND "tc"."user_id" = "auth"."uid"()
          )
          OR EXISTS (
            SELECT 1
            FROM "public"."channel_agents" "ca"
            WHERE "ca"."channel_id" = "threads"."channel_id"
              AND "ca"."user_id" = "auth"."uid"()
          )
        )
    )
  );

-- ============================================================================
-- STEP 5: Drop overly permissive auth policies on messages
-- ============================================================================

-- Drop generic auth policies that might interfere with role-based policies
DROP POLICY IF EXISTS "auth insert" ON "public"."messages";
DROP POLICY IF EXISTS "auth update" ON "public"."messages";
DROP POLICY IF EXISTS "auth delete" ON "public"."messages";

-- ============================================================================
-- STEP 6: Verify master agent policies allow full access
-- Master agent policies should check org_id, which allows access to ALL data
-- in their organization (including where super_agent_id IS NULL or any value)
-- These policies are already correct, but we'll add a comment to document this
-- ============================================================================

-- Master agent policies are already correct:
-- - contacts_master_read: checks org_id (allows all contacts in org)
-- - threads_master_read: checks org_id (allows all threads in org)
-- - channels_master_read: checks org_id (allows all channels in org)
-- - messages_master_read: checks org_id via threads (allows all messages in org)
-- These policies will allow master agents to see ALL data regardless of super_agent_id

