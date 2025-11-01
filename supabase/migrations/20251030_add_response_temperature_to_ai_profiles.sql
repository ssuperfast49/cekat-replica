-- Add response_temperature column to ai_profiles table
-- This column stores the temperature preset (Conservative, Balanced, Creative)
-- which maps to numeric values: Conservative: 0.3, Balanced: 0.5, Creative: 0.7

begin;

-- Add response_temperature column if it doesn't exist
alter table if exists public.ai_profiles
  add column if not exists response_temperature text null;

comment on column public.ai_profiles.response_temperature is
  'Temperature preset for AI responses: Conservative (0.3), Balanced (0.5), or Creative (0.7)';

-- Add check constraint to ensure valid values
alter table if exists public.ai_profiles
  drop constraint if exists ai_profiles_response_temperature_check;

alter table if exists public.ai_profiles
  add constraint ai_profiles_response_temperature_check
  check (response_temperature is null or response_temperature in ('Conservative', 'Balanced', 'Creative'));

-- Set default value for existing rows that don't have response_temperature
-- Map existing temperature values to closest preset
update public.ai_profiles
set response_temperature = case
  when temperature is null then 'Balanced'
  when temperature <= 0.35 then 'Conservative'
  when temperature <= 0.65 then 'Balanced'
  else 'Creative'
end
where response_temperature is null;

-- For new rows, default to 'Balanced'
alter table if exists public.ai_profiles
  alter column response_temperature set default 'Balanced';

commit;

