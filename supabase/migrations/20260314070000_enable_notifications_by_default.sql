-- Set notifications_enabled: true for all existing users who do not have it set
-- This ensures the UI toggle and audio/toast notifications default "on" to all legacy accounts.

UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"notifications_enabled": true}'::jsonb
WHERE raw_user_meta_data->>'notifications_enabled' IS NULL;
