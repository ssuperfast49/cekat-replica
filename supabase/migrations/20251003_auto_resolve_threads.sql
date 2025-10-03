-- Auto-resolve inactive threads based on AI profile setting
-- Adds per-AI auto-resolve minutes, tracks next auto_resolve_at on threads,
-- triggers it on new messages, and schedules a periodic closer if pg_cron is available.

-- 1) Add configuration on ai_profiles
alter table if exists public.ai_profiles
  add column if not exists auto_resolve_after_minutes integer not null default 0;

comment on column public.ai_profiles.auto_resolve_after_minutes is
  'Minutes after the last agent/assistant reply with no user response to auto-close a thread. 0 disables auto-resolve.';

-- 2) Track the next auto-resolve timestamp on threads
alter table if exists public.threads
  add column if not exists auto_resolve_at timestamptz null;

comment on column public.threads.auto_resolve_at is
  'Timestamp when this thread should be auto-closed due to inactivity after an agent/assistant reply.';

-- 3) Trigger: whenever a message is inserted, (re)compute thread.auto_resolve_at
create or replace function public.set_thread_auto_resolve_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes integer := 0;
  v_thread_id uuid := new.thread_id;
  v_created_at timestamptz := coalesce(new.created_at, now());
begin
  -- Fetch per-AI minutes from the channel's ai_profile
  select coalesce(p.auto_resolve_after_minutes, 0)
    into v_minutes
  from public.threads t
  join public.channels c on c.id = t.channel_id
  left join public.ai_profiles p on p.id = c.ai_profile_id
  where t.id = v_thread_id;

  if new.role in ('user', 'customer', 'incoming') then
    -- Any user response cancels pending auto-resolve
    update public.threads set auto_resolve_at = null where id = v_thread_id;
  elsif new.role in ('agent', 'assistant') then
    if coalesce(v_minutes, 0) > 0 then
      update public.threads
         set auto_resolve_at = v_created_at + make_interval(mins => v_minutes)
       where id = v_thread_id;
    end if;
  end if;

  return new;
end $$;

do $$ begin
  -- Ensure single trigger in case of re-run
  if not exists (select 1 from pg_trigger where tgname = 'tr_set_thread_auto_resolve_after_message') then
    create trigger tr_set_thread_auto_resolve_after_message
      after insert on public.messages
      for each row execute function public.set_thread_auto_resolve_after_message();
  end if;
end $$;

-- 4) Function: close due threads
create or replace function public.auto_close_due_threads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.threads t
     set status = 'closed',
         resolved_at = now()
   where t.auto_resolve_at is not null
     and t.auto_resolve_at <= now()
     and t.status is distinct from 'closed';

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 5) Try to schedule background job every minute (best effort)
do $$
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if not found then
    -- Attempt to enable pg_cron where permitted
    begin
      create extension if not exists pg_cron with schema cron;
    exception when others then
      -- ignore if not permitted
      null;
    end;
  end if;

  begin
    -- Create or replace task
    perform cron.schedule('auto_close_due_threads', '* * * * *', 'select public.auto_close_due_threads();');
  exception when undefined_function or insufficient_privilege or others then
    -- ignore if cron is unavailable; function can be called manually
    null;
  end;
end $$;


