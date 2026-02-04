-- Migration to add followup automation settings to ai_profiles
ALTER TABLE ai_profiles 
ADD COLUMN IF NOT EXISTS followup_message TEXT,
ADD COLUMN IF NOT EXISTS enable_followup_message BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS followup_message_delay INTEGER DEFAULT 60;

-- Refresh schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
