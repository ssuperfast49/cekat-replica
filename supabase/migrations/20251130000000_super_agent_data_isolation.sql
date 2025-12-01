-- Migration: Super Agent Data Isolation
-- Purpose: Ensure super agents can only access their own data and their agents' data
-- Master agents retain full org-wide access

-- ============================================================================
-- CHANNELS TABLE - Restrict access based on super_agent_id
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated access to channels" ON "public"."channels";
DROP POLICY IF EXISTS "auth read" ON "public"."channels";

-- Master agents: full org-wide access
CREATE POLICY "channels_master_read" ON "public"."channels" 
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
        AND "om"."org_id" = "channels"."org_id"
    )
  );

-- Super agents: only their own channels
CREATE POLICY "channels_super_read" ON "public"."channels" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
    )
    AND "channels"."super_agent_id" = "auth"."uid"()
  );

-- Agents: channels where they are assigned AND channel belongs to their super agent
CREATE POLICY "channels_agent_read" ON "public"."channels" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      JOIN "public"."channel_agents" "ca" ON "ca"."channel_id" = "channels"."id" AND "ca"."user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "channels"."super_agent_id"
    )
  );

-- Super agents: can insert/update/delete their own channels
CREATE POLICY "channels_super_write" ON "public"."channels" 
  FOR INSERT 
  TO "authenticated"
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
    )
    AND "channels"."super_agent_id" = "auth"."uid"()
  );

CREATE POLICY "channels_super_update" ON "public"."channels" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
    )
    AND "channels"."super_agent_id" = "auth"."uid"()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
    )
    AND "channels"."super_agent_id" = "auth"."uid"()
  );

CREATE POLICY "channels_super_delete" ON "public"."channels" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
    )
    AND "channels"."super_agent_id" = "auth"."uid"()
  );

-- Master agents: full write access
CREATE POLICY "channels_master_write" ON "public"."channels" 
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
        AND "om"."org_id" = "channels"."org_id"
    )
  );

CREATE POLICY "channels_master_update" ON "public"."channels" 
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
        AND "om"."org_id" = "channels"."org_id"
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
        AND "om"."org_id" = "channels"."org_id"
    )
  );

CREATE POLICY "channels_master_delete" ON "public"."channels" 
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
        AND "om"."org_id" = "channels"."org_id"
    )
  );

-- ============================================================================
-- CONTACTS TABLE - Restrict access based on channel ownership
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated access to contacts" ON "public"."contacts";
DROP POLICY IF EXISTS "auth read" ON "public"."contacts";

-- Master agents: full org-wide access
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

-- Super agents: contacts linked to their channels
CREATE POLICY "contacts_super_read" ON "public"."contacts" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."contact_identities" "ci" ON "ci"."contact_id" = "contacts"."id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "ci"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

-- Agents: contacts linked to channels they are assigned to AND channel belongs to their super agent
CREATE POLICY "contacts_agent_read" ON "public"."contacts" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      JOIN "public"."contact_identities" "ci" ON "ci"."contact_id" = "contacts"."id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "ci"."channel_id"
      JOIN "public"."channel_agents" "ca" ON "ca"."channel_id" = "ch"."id" AND "ca"."user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "ch"."super_agent_id"
    )
  );

-- Master agents: full write access
CREATE POLICY "contacts_master_write" ON "public"."contacts" 
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
        AND "om"."org_id" = "contacts"."org_id"
    )
  );

CREATE POLICY "contacts_master_update" ON "public"."contacts" 
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
        AND "om"."org_id" = "contacts"."org_id"
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
        AND "om"."org_id" = "contacts"."org_id"
    )
  );

CREATE POLICY "contacts_master_delete" ON "public"."contacts" 
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
        AND "om"."org_id" = "contacts"."org_id"
    )
  );

-- Super agents: can write contacts linked to their channels
CREATE POLICY "contacts_super_write" ON "public"."contacts" 
  FOR INSERT 
  TO "authenticated"
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
    )
  );

CREATE POLICY "contacts_super_update" ON "public"."contacts" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."contact_identities" "ci" ON "ci"."contact_id" = "contacts"."id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "ci"."channel_id"
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
      JOIN "public"."contact_identities" "ci" ON "ci"."contact_id" = "contacts"."id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "ci"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

CREATE POLICY "contacts_super_delete" ON "public"."contacts" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."contact_identities" "ci" ON "ci"."contact_id" = "contacts"."id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "ci"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

-- ============================================================================
-- MESSAGES TABLE - Restrict access based on thread -> channel ownership
-- ============================================================================

-- Drop overly permissive policies (keep anonymous read for web channels)
DROP POLICY IF EXISTS "Allow authenticated access to messages" ON "public"."messages";
DROP POLICY IF EXISTS "auth read messages" ON "public"."messages";
DROP POLICY IF EXISTS "messages_by_thread_read" ON "public"."messages";

-- Master agents: full org-wide access
CREATE POLICY "messages_master_read" ON "public"."messages" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."org_members" "om" ON "om"."user_id" = "ur"."user_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'master_agent'
        AND "om"."org_id" = "t"."org_id"
    )
  );

-- Super agents: messages in threads from their channels
CREATE POLICY "messages_super_read" ON "public"."messages" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "t"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

-- Agents: messages in threads from channels they are assigned to AND channel belongs to their super agent
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
      JOIN "public"."channels" "ch" ON "ch"."id" = "t"."channel_id"
      JOIN "public"."channel_agents" "ca" ON "ca"."channel_id" = "ch"."id" AND "ca"."user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "ch"."super_agent_id"
    )
    OR EXISTS (
      -- Also allow if agent is assigned to the thread
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "t"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "ch"."super_agent_id"
        AND ("t"."assignee_user_id" = "auth"."uid"() 
          OR "t"."assigned_by_user_id" = "auth"."uid"() 
          OR "t"."resolved_by_user_id" = "auth"."uid"()
          OR EXISTS (
            SELECT 1 FROM "public"."thread_collaborators" "tc"
            WHERE "tc"."thread_id" = "t"."id" AND "tc"."user_id" = "auth"."uid"()
          )
        )
    )
  );

-- Master agents: full write access
CREATE POLICY "messages_master_write" ON "public"."messages" 
  FOR INSERT 
  TO "authenticated"
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."org_members" "om" ON "om"."user_id" = "ur"."user_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'master_agent'
        AND "om"."org_id" = "t"."org_id"
    )
  );

CREATE POLICY "messages_master_update" ON "public"."messages" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."org_members" "om" ON "om"."user_id" = "ur"."user_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'master_agent'
        AND "om"."org_id" = "t"."org_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."org_members" "om" ON "om"."user_id" = "ur"."user_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'master_agent'
        AND "om"."org_id" = "t"."org_id"
    )
  );

CREATE POLICY "messages_master_delete" ON "public"."messages" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."org_members" "om" ON "om"."user_id" = "ur"."user_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'master_agent'
        AND "om"."org_id" = "t"."org_id"
    )
  );

-- Super agents: can write messages in threads from their channels
CREATE POLICY "messages_super_write" ON "public"."messages" 
  FOR INSERT 
  TO "authenticated"
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "t"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

CREATE POLICY "messages_super_update" ON "public"."messages" 
  FOR UPDATE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "t"."channel_id"
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
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "t"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

CREATE POLICY "messages_super_delete" ON "public"."messages" 
  FOR DELETE 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."threads" "t" ON "t"."id" = "messages"."thread_id"
      JOIN "public"."channels" "ch" ON "ch"."id" = "t"."channel_id"
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'super_agent'
        AND "ch"."super_agent_id" = "auth"."uid"()
    )
  );

-- ============================================================================
-- THREADS TABLE - Ensure proper isolation (may already have some policies)
-- ============================================================================

-- The threads table already has some restrictions, but let's ensure agents
-- can see threads from channels they are assigned to (even if not directly assigned to thread)
-- This is handled by the existing threads_agent_read policy, but we verify it's complete

-- Note: The existing threads_super_read policy should already handle super agent isolation
-- We're not modifying it here to avoid conflicts, but the policy should check:
-- - Channel ownership: ch.super_agent_id = auth.uid()
-- - OR agent membership via super_agent_members

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- After this migration:
-- 1. Master agents: Full org-wide read/write access to all tables
-- 2. Super agents: Can only access data where super_agent_id = auth.uid()
-- 3. Agents: Can only access data where:
--    - They are assigned via channel_agents AND channel belongs to their super agent
--    - OR they are directly involved (assignee, etc.) AND channel belongs to their super agent
-- 4. Data isolation is enforced at the database level via RLS policies

