-- Migration: Drop All Remaining Permissive Policies
-- Purpose: Remove any remaining overly permissive policies that allow unauthorized access
-- This ensures super agents can ONLY see their own data

-- ============================================================================
-- CHANNELS TABLE - Drop all permissive policies
-- ============================================================================

-- Drop anonymous read policies
DROP POLICY IF EXISTS "Allow anonymous read access to channels" ON "public"."channels";

-- Drop any other permissive authenticated policies (in case they weren't dropped)
DROP POLICY IF EXISTS "Allow authenticated access to channels" ON "public"."channels";
DROP POLICY IF EXISTS "auth read" ON "public"."channels";

-- Note: We keep "allow_public_select_web_channels" for anonymous web chat access
-- This is needed for public web chat widgets

-- ============================================================================
-- CONTACTS TABLE - Drop all permissive policies
-- ============================================================================

-- Drop anonymous read policies
DROP POLICY IF EXISTS "Allow anonymous read access to contacts" ON "public"."contacts";

-- Drop any other permissive authenticated policies (in case they weren't dropped)
DROP POLICY IF EXISTS "Allow authenticated access to contacts" ON "public"."contacts";
DROP POLICY IF EXISTS "auth read" ON "public"."contacts";

-- Note: We keep "Allow anonymous insert to contacts" for web chat functionality
-- This allows anonymous users to create contacts when they start a chat

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After this migration, the only policies that should remain are:
-- 
-- CHANNELS:
-- - channels_master_read (master agents: all in org)
-- - channels_super_read (super agents: only their own)
-- - channels_agent_read (agents: assigned channels of their super agent)
-- - channels_master_write/update/delete
-- - channels_super_write/update/delete
-- - allow_public_select_web_channels (anonymous: web channels only)
-- - n8n crud (service_role: full access)
--
-- CONTACTS:
-- - contacts_master_read (master agents: all in org)
-- - contacts_super_read (super agents: linked to their channels)
-- - contacts_agent_read (agents: linked to assigned channels of their super agent)
-- - contacts_master_write/update/delete
-- - contacts_super_write/update/delete
-- - Allow anonymous insert to contacts (for web chat)
--
-- THREADS:
-- - threads_master_read (master agents: all in org)
-- - threads_super_read (super agents: only from their channels)
-- - threads_agent_read (agents: from assigned channels of their super agent)
-- - threads_master_write/update/delete
-- - threads_super_write/update/delete
-- - threads_agent_update/delete
-- - public_read_web_threads (anonymous: web threads only)
--
-- MESSAGES:
-- - messages_master_read (master agents: all in org)
-- - messages_super_read (super agents: from their channels' threads)
-- - messages_agent_read (agents: from assigned channels' threads)
-- - messages_master_write/update/delete
-- - messages_super_write/update/delete
-- - Allow anonymous read access to messages (for web chat)
-- - Allow anonymous insert to messages (for web chat)
-- - public_read_web_messages (anonymous: web messages only)

