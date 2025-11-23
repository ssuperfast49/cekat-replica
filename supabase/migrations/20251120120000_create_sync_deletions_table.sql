create table if not exists public.sync_deletions (
  id bigserial primary key,
  table_name text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.sync_deletions is 'Tracks row deletions for cross-database synchronization.';

create index if not exists sync_deletions_processed_at_idx
  on public.sync_deletions using brin (processed_at);

create or replace function public.log_sync_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sync_deletions (table_name, payload)
  values (tg_table_name, to_jsonb(old));
  return old;
end;
$$;

grant usage on sequence public.sync_deletions_id_seq to authenticated, service_role, anon;

do $$
declare
  table_name text;
  tables text[] := array[
    'orgs',
    'org_members',
    'users_profile',
    'roles',
    'permissions',
    'permission_bundles',
    'bundle_permissions',
    'role_permissions',
    'role_bundles',
    'super_agent_members',
    'channels',
    'channel_agents',
    'thread_collaborators',
    'threads',
    'messages',
    'contacts',
    'contact_identities',
    'contact_labels',
    'labels',
    'csat_responses',
    'ai_profiles',
    'ai_models',
    'ai_sessions',
    'documents',
    'files',
    'token_balances',
    'token_topups',
    'token_usage_logs',
    'openai_usage_snapshots',
    'audit_logs',
    'alerts',
    'alert_rules',
    'n8n_chat_histories',
    'n8n_webhook_routes',
    'user_invites',
    'user_roles'
  ];
begin
  foreach table_name in array tables loop
    begin
      execute format(
        'drop trigger if exists sync_deletion_log on public.%I',
        table_name
      );
      execute format(
        'create trigger sync_deletion_log after delete on public.%I
           for each row execute function public.log_sync_deletion();',
        table_name
      );
    exception
      when undefined_table then
        raise notice 'Skipping sync_deletion trigger for missing table: %', table_name;
    end;
  end loop;
end;
$$;

