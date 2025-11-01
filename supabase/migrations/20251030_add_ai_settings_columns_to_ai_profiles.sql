-- Add AI agent settings columns to ai_profiles table
-- These columns store configuration limits for AI behavior

begin;

-- Add history_limit column
alter table if exists public.ai_profiles
  add column if not exists history_limit integer not null default 50000;

comment on column public.ai_profiles.history_limit is
  'Maximum conversation history that AI can remember (in tokens). Default: 50000';

-- Add read_file_limit column
alter table if exists public.ai_profiles
  add column if not exists read_file_limit integer not null default 3;

comment on column public.ai_profiles.read_file_limit is
  'Maximum number of files AI can read in a single conversation. Default: 3';

-- Add context_limit column
alter table if exists public.ai_profiles
  add column if not exists context_limit integer not null default 28;

comment on column public.ai_profiles.context_limit is
  'Maximum context that AI can process in a single response (in K tokens). Default: 28';

-- Add message_limit column
alter table if exists public.ai_profiles
  add column if not exists message_limit integer not null default 1000;

comment on column public.ai_profiles.message_limit is
  'Maximum number of messages AI can send in a single conversation. Default: 1000';

-- Add message_await column
alter table if exists public.ai_profiles
  add column if not exists message_await integer not null default 3;

comment on column public.ai_profiles.message_await is
  'Seconds to wait before processing message. Default: 3';

-- Add timezone column
alter table if exists public.ai_profiles
  add column if not exists timezone text null default (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

comment on column public.ai_profiles.timezone is
  'Timezone for the AI agent. Default: UTC';

-- Update timezone default using SQL (since JS isn't available in SQL)
alter table if exists public.ai_profiles
  alter column timezone set default 'UTC';

commit;

