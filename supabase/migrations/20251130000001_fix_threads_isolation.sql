-- Migration: Fix Threads Isolation for Super Agents
-- Purpose: Ensure super agents can ONLY see threads from their own channels
-- Fixes security leak where super agents could see threads from other super agents' channels

-- ============================================================================
-- THREADS TABLE - Fix isolation policies
-- ============================================================================

-- Step 1: Drop overly permissive policy
DROP POLICY IF EXISTS "Allow authenticated access to threads" ON "public"."threads";

-- Step 2: Drop existing policies that need to be fixed
DROP POLICY IF EXISTS "threads_super_read" ON "public"."threads";
DROP POLICY IF EXISTS "threads_agent_read" ON "public"."threads";

-- Step 3: Recreate threads_super_read with CORRECT isolation
-- Super agents: ONLY threads from their own channels (no agent involvement check)
CREATE POLICY "threads_super_read" ON "public"."threads" 
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
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
    )
    AND EXISTS (
      SELECT 1
      FROM "public"."channels" "ch"
      WHERE "ch"."id" = "threads"."channel_id"
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

-- Step 4: Recreate threads_agent_read with super agent ownership check
-- Agents: threads from channels they are assigned to OR threads they're involved in
-- BUT channel must belong to their super agent
CREATE POLICY "threads_agent_read" ON "public"."threads" 
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
      FROM "public"."org_members" "om"
      WHERE "om"."user_id" = "auth"."uid"()
        AND "om"."org_id" = "threads"."org_id"
    )
    AND (
      -- Condition 1: Agent is assigned to the channel AND channel belongs to their super agent
      EXISTS (
        SELECT 1
        FROM "public"."user_roles" "ur"
        JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
        JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
        JOIN "public"."channel_agents" "ca" ON "ca"."channel_id" = "threads"."channel_id" AND "ca"."user_id" = "auth"."uid"()
        JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
        WHERE "ur"."user_id" = "auth"."uid"()
          AND "r"."name" = 'agent'
          AND "sam"."super_agent_id" = "ch"."super_agent_id"
      )
      OR
      -- Condition 2: Agent is directly involved in the thread AND channel belongs to their super agent
      EXISTS (
        SELECT 1
        FROM "public"."user_roles" "ur"
        JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
        JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
        JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
        WHERE "ur"."user_id" = "auth"."uid"()
          AND "r"."name" = 'agent'
          AND "sam"."super_agent_id" = "ch"."super_agent_id"
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
          )
      )
    )
  );

-- ============================================================================
-- THREADS TABLE - Add write policies for proper isolation
-- ============================================================================

-- Master agents: full write access
CREATE POLICY "threads_master_write" ON "public"."threads" 
  FOR INSERT 
  TO "authenticated"
  WITH CHECK (
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

CREATE POLICY "threads_master_update" ON "public"."threads" 
  FOR UPDATE 
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
  )
  WITH CHECK (
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

CREATE POLICY "threads_master_delete" ON "public"."threads" 
  FOR DELETE 
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

-- Super agents: can write threads in their channels
CREATE POLICY "threads_super_write" ON "public"."threads" 
  FOR INSERT 
  TO "authenticated"
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

CREATE POLICY "threads_super_update" ON "public"."threads" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

CREATE POLICY "threads_super_delete" ON "public"."threads" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

-- Agents: can update/delete threads they're involved in AND channel belongs to their super agent
CREATE POLICY "threads_agent_update" ON "public"."threads" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "ch"."super_agent_id"
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
      JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "ch"."super_agent_id"
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

CREATE POLICY "threads_agent_delete" ON "public"."threads" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      JOIN "public"."channels" "ch" ON "ch"."id" = "threads"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "ch"."super_agent_id"
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
-- SUMMARY
-- ============================================================================
-- After this migration:
-- 1. Super agents can ONLY see threads from their own channels (ch.super_agent_id = auth.uid())
-- 2. Agents can ONLY see threads from channels assigned to them OR threads they're involved in,
--    BUT the channel must belong to their super agent
-- 3. Master agents retain full org-wide access
-- 4. All write operations (INSERT/UPDATE/DELETE) are properly isolated
-- 5. No data leakage between super agents

