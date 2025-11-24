begin;

-- Erase channels data as requested (will cascade to dependents)
truncate table public.channels cascade;

-- Ensure required columns exist on channels
alter table public.channels
  add column if not exists display_name text,
  add column if not exists profile_photo_url text,
  add column if not exists ai_profile_id uuid,
  add column if not exists secret_token text;

-- Ensure legacy platforms schema has the columns we rely on before migration
alter table if exists public.platforms add column if not exists display_name text;
alter table if exists public.platforms add column if not exists website_url text;
alter table if exists public.platforms add column if not exists status text;
alter table if exists public.platforms add column if not exists secret_token text;
alter table if exists public.platforms add column if not exists profile_photo_url text;
alter table if exists public.platforms add column if not exists ai_profile_id uuid;

-- Migrate platforms into channels
insert into public.channels (
  id, org_id, type, provider, credentials, display_name, is_active, created_at, external_id, secret_token, profile_photo_url, ai_profile_id
)
select 
  p.id,
  p.org_id,
  'inbox'::text as type,
  (
    case 
      when p.website_url is null or p.display_name ilike '%wa%' then 'whatsapp' 
      else 'web' 
    end
  )::public.channel_type as provider,
  '{}'::jsonb as credentials,
  p.display_name,
  (p.status is null or p.status = 'active') as is_active,
  coalesce(p.created_at, now()) as created_at,
  null::text as external_id,
  p.secret_token,
  p.profile_photo_url,
  p.ai_profile_id
from public.platforms p;

-- Drop deprecated tables
drop table if exists public.platform_human_agents;
drop table if exists public.platforms;

commit;


