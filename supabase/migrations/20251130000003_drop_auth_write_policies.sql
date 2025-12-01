-- Migration: Drop Overly Permissive Auth Write Policies
-- Purpose: Remove permissive INSERT/UPDATE/DELETE policies that allow any authenticated user
-- These should be replaced by our role-specific write policies

-- ============================================================================
-- CHANNELS TABLE - Drop permissive write policies
-- ============================================================================

DROP POLICY IF EXISTS "auth insert" ON "public"."channels";
DROP POLICY IF EXISTS "auth update" ON "public"."channels";
DROP POLICY IF EXISTS "auth delete" ON "public"."channels";

-- ============================================================================
-- CONTACTS TABLE - Drop permissive write policies
-- ============================================================================

DROP POLICY IF EXISTS "auth insert" ON "public"."contacts";
DROP POLICY IF EXISTS "auth update" ON "public"."contacts";
DROP POLICY IF EXISTS "auth delete" ON "public"."contacts";

-- ============================================================================
-- NOTE
-- ============================================================================
-- These policies were replaced by our role-specific policies:
-- - channels_master_write/update/delete (master agents)
-- - channels_super_write/update/delete (super agents)
-- - contacts_master_write/update/delete (master agents)
-- - contacts_super_write/update/delete (super agents)
-- - contacts_agent_read (agents - read only, no write needed)

