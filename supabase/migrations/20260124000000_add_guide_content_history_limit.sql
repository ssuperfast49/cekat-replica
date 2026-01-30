-- Migration: Add guide_content and history_limit columns to ai_profiles
-- Description: Add guide_content for custom knowledge text and history_limit for message-based history limits

ALTER TABLE ai_profiles 
ADD COLUMN IF NOT EXISTS guide_content TEXT,
ADD COLUMN IF NOT EXISTS history_limit INTEGER DEFAULT 50;

COMMENT ON COLUMN ai_profiles.guide_content IS 'Custom knowledge text content for the AI agent';
COMMENT ON COLUMN ai_profiles.history_limit IS 'Maximum number of conversation messages to include in AI context';
