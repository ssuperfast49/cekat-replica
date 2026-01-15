-- Add account_id to threads for account-scoped live chat re-use
alter table public.threads
  add column if not exists account_id uuid;

-- Enforce one thread per account per channel (when account_id is set)
create unique index if not exists threads_channel_account_unique
  on public.threads (channel_id, account_id)
  where account_id is not null;
