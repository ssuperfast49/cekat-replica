-- Migration to add is_followup_sent to threads
ALTER TABLE threads ADD COLUMN IF NOT EXISTS is_followup_sent BOOLEAN DEFAULT false;

-- Refresh schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
