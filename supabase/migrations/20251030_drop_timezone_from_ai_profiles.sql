-- Drop timezone column from ai_profiles table

begin;

-- Drop the timezone column
alter table if exists public.ai_profiles
  drop column if exists timezone;

commit;

