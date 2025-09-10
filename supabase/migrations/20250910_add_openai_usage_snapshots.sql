begin;

create table if not exists public.openai_usage_snapshots (
  id bigserial primary key,
  captured_at timestamptz not null default now(),
  range_label text not null, -- e.g., '7d','30d','60d','1y','today'
  start_date date not null,
  end_date date not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  raw jsonb not null default '{}'::jsonb
);

-- Indexes for time/range query
create index if not exists idx_openai_usage_snapshots_captured_at on public.openai_usage_snapshots (captured_at desc);
create index if not exists idx_openai_usage_snapshots_dates on public.openai_usage_snapshots (start_date, end_date);

-- Enable RLS and allow only service role or authenticated read (optional)
alter table public.openai_usage_snapshots enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'openai_usage_snapshots' and policyname = 'Allow read for authenticated') then
    create policy "Allow read for authenticated" on public.openai_usage_snapshots
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'openai_usage_snapshots' and policyname = 'Allow insert for service role') then
    create policy "Allow insert for service role" on public.openai_usage_snapshots
      for insert to service_role with check (true);
  end if;
end $$;

commit;


