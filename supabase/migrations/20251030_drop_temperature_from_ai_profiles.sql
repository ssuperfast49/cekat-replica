-- Drop temperature column from ai_profiles table
-- This column is being replaced by response_temperature for preset-based temperature control

begin;

-- Drop the temperature column
alter table if exists public.ai_profiles
  drop column if exists temperature;

commit;

