-- Migration: Add Direct Super Agent Connections to Contacts and Threads
-- Purpose: Add super_agent_id columns to contacts and threads for direct ownership tracking
-- This ensures super agents can only see contacts/threads directly assigned to them

-- ============================================================================
-- STEP 1: Add super_agent_id columns to contacts and threads
-- ============================================================================

-- Add super_agent_id to contacts table
ALTER TABLE "public"."contacts"
ADD COLUMN IF NOT EXISTS "super_agent_id" UUID;

-- Add foreign key constraint (references auth.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_super_agent_id_fkey'
  ) THEN
    ALTER TABLE "public"."contacts"
    ADD CONSTRAINT "contacts_super_agent_id_fkey"
    FOREIGN KEY ("super_agent_id")
    REFERENCES "auth"."users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add super_agent_id to threads table
ALTER TABLE "public"."threads"
ADD COLUMN IF NOT EXISTS "super_agent_id" UUID;

-- Add foreign key constraint (references auth.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'threads_super_agent_id_fkey'
  ) THEN
    ALTER TABLE "public"."threads"
    ADD CONSTRAINT "threads_super_agent_id_fkey"
    FOREIGN KEY ("super_agent_id")
    REFERENCES "auth"."users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate existing data
-- ============================================================================

-- Migrate contacts: set super_agent_id from contact_identities -> channels
-- Use the first matching channel's super_agent_id (if multiple channels, pick one)
UPDATE "public"."contacts" c
SET "super_agent_id" = (
  SELECT ch."super_agent_id"
  FROM "public"."contact_identities" ci
  JOIN "public"."channels" ch ON ch."id" = ci."channel_id"
  WHERE ci."contact_id" = c."id"
    AND ch."super_agent_id" IS NOT NULL
  LIMIT 1
)
WHERE c."super_agent_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "public"."contact_identities" ci
    JOIN "public"."channels" ch ON ch."id" = ci."channel_id"
    WHERE ci."contact_id" = c."id"
      AND ch."super_agent_id" IS NOT NULL
  );

-- Migrate threads: set super_agent_id from channels
UPDATE "public"."threads" t
SET "super_agent_id" = ch."super_agent_id"
FROM "public"."channels" ch
WHERE t."channel_id" = ch."id"
  AND ch."super_agent_id" IS NOT NULL
  AND t."super_agent_id" IS NULL;

-- ============================================================================
-- STEP 3: Create triggers for automatic assignment
-- ============================================================================

-- Function: Update contact's super_agent_id when contact_identities is created
CREATE OR REPLACE FUNCTION "public"."set_contact_super_agent_from_channel"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the contact's super_agent_id if the channel has a super_agent_id
  -- Only update if contact's super_agent_id is NULL (don't overwrite existing)
  UPDATE "public"."contacts" c
  SET "super_agent_id" = ch."super_agent_id"
  FROM "public"."channels" ch
  WHERE c."id" = NEW."contact_id"
    AND ch."id" = NEW."channel_id"
    AND ch."super_agent_id" IS NOT NULL
    AND c."super_agent_id" IS NULL;
  
  RETURN NEW;
END;
$$;

-- Trigger: When contact_identities is inserted, update contact's super_agent_id
DROP TRIGGER IF EXISTS "tr_set_contact_super_agent_from_channel" ON "public"."contact_identities";
CREATE TRIGGER "tr_set_contact_super_agent_from_channel"
  AFTER INSERT ON "public"."contact_identities"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_contact_super_agent_from_channel"();

-- Function: Update thread's super_agent_id when thread is created
CREATE OR REPLACE FUNCTION "public"."set_thread_super_agent_from_channel"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set thread's super_agent_id from channel's super_agent_id
  IF NEW."channel_id" IS NOT NULL THEN
    SELECT ch."super_agent_id" INTO NEW."super_agent_id"
    FROM "public"."channels" ch
    WHERE ch."id" = NEW."channel_id"
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger: When thread is inserted, set super_agent_id from channel
DROP TRIGGER IF EXISTS "tr_set_thread_super_agent_from_channel" ON "public"."threads";
CREATE TRIGGER "tr_set_thread_super_agent_from_channel"
  BEFORE INSERT ON "public"."threads"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_thread_super_agent_from_channel"();

-- Function: Update contacts and threads when channel's super_agent_id changes
CREATE OR REPLACE FUNCTION "public"."update_contacts_threads_on_channel_super_agent_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all contacts linked to this channel
  UPDATE "public"."contacts" c
  SET "super_agent_id" = NEW."super_agent_id"
  FROM "public"."contact_identities" ci
  WHERE ci."contact_id" = c."id"
    AND ci."channel_id" = NEW."id"
    AND (NEW."super_agent_id" IS NOT NULL OR c."super_agent_id" = OLD."super_agent_id");
  
  -- Update all threads linked to this channel
  UPDATE "public"."threads" t
  SET "super_agent_id" = NEW."super_agent_id"
  WHERE t."channel_id" = NEW."id"
    AND (NEW."super_agent_id" IS NOT NULL OR t."super_agent_id" = OLD."super_agent_id");
  
  RETURN NEW;
END;
$$;

-- Trigger: When channel's super_agent_id is updated, update related contacts and threads
DROP TRIGGER IF EXISTS "tr_update_contacts_threads_on_channel_super_agent_change" ON "public"."channels";
CREATE TRIGGER "tr_update_contacts_threads_on_channel_super_agent_change"
  AFTER UPDATE OF "super_agent_id" ON "public"."channels"
  FOR EACH ROW
  WHEN (OLD."super_agent_id" IS DISTINCT FROM NEW."super_agent_id")
  EXECUTE FUNCTION "public"."update_contacts_threads_on_channel_super_agent_change"();

-- ============================================================================
-- STEP 4: Update RLS policies to use direct super_agent_id checks
-- ============================================================================

-- Drop existing contacts_super_read policy
DROP POLICY IF EXISTS "contacts_super_read" ON "public"."contacts";

-- Recreate contacts_super_read: check super_agent_id directly
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

-- Drop existing contacts_agent_read policy
DROP POLICY IF EXISTS "contacts_agent_read" ON "public"."contacts";

-- Recreate contacts_agent_read: check via super_agent_members
CREATE POLICY "contacts_agent_read" ON "public"."contacts" 
  FOR SELECT 
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "contacts"."super_agent_id"
    )
  );

-- Drop existing threads_super_read policy
DROP POLICY IF EXISTS "threads_super_read" ON "public"."threads";

-- Recreate threads_super_read: check super_agent_id directly
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
        AND "threads"."super_agent_id" = "auth"."uid"()
    )
  );

-- Drop existing threads_agent_read policy
DROP POLICY IF EXISTS "threads_agent_read" ON "public"."threads";

-- Recreate threads_agent_read: check via super_agent_members
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
    AND EXISTS (
      SELECT 1
      FROM "public"."user_roles" "ur"
      JOIN "public"."roles" "r" ON "r"."id" = "ur"."role_id"
      JOIN "public"."super_agent_members" "sam" ON "sam"."agent_user_id" = "auth"."uid"()
      WHERE "ur"."user_id" = "auth"."uid"()
        AND "r"."name" = 'agent'
        AND "sam"."super_agent_id" = "threads"."super_agent_id"
    )
  );

-- ============================================================================
-- STEP 5: Update write policies to set super_agent_id
-- ============================================================================

-- Update contacts_super_write to ensure super_agent_id is set
DROP POLICY IF EXISTS "contacts_super_write" ON "public"."contacts";
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
    AND (
      -- Either super_agent_id is explicitly set to current user
      ("contacts"."super_agent_id" = "auth"."uid"())
      -- Or super_agent_id is NULL (will be set by trigger when contact_identities is created)
      OR ("contacts"."super_agent_id" IS NULL)
    )
  );

-- Update threads_super_write to ensure super_agent_id is set from channel
DROP POLICY IF EXISTS "threads_super_write" ON "public"."threads";
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

-- ============================================================================
-- STEP 6: Add indexes for performance
-- ============================================================================

-- Index on contacts.super_agent_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_contacts_super_agent_id" 
ON "public"."contacts"("super_agent_id")
WHERE "super_agent_id" IS NOT NULL;

-- Index on threads.super_agent_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_threads_super_agent_id" 
ON "public"."threads"("super_agent_id")
WHERE "super_agent_id" IS NOT NULL;

