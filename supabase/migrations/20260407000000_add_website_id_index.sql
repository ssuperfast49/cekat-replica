-- 20260407000000_add_website_id_index.sql
-- Optimizes Smart Channel Resolution by indexing (website_id, provider)
-- Uses composite key to support platform-specific lookups.

DROP INDEX IF EXISTS idx_channels_website_id;
CREATE INDEX IF NOT EXISTS idx_channels_website_id_provider ON channels (website_id, provider) WHERE website_id IS NOT NULL;
