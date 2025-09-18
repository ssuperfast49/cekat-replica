begin;

-- Enforce reason on new handovers via trigger (non-breaking for legacy rows)
create or replace function public.enforce_handover_reason()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  became_handover boolean := false;
begin
  -- Determine if the new row transitions to a handover state
  if TG_OP = 'INSERT' then
    became_handover := (new.ai_handoff_at is not null) or (new.assignee_user_id is not null) or (new.assigned_by_user_id is not null);
  else
    became_handover := (
      (new.ai_handoff_at is not null and (old.ai_handoff_at is null or new.ai_handoff_at <> old.ai_handoff_at)) or
      (new.assignee_user_id is not null and new.assignee_user_id is distinct from old.assignee_user_id) or
      (new.assigned_by_user_id is not null and new.assigned_by_user_id is distinct from old.assigned_by_user_id)
    );
  end if;

  if became_handover and (new.handover_reason is null or length(trim(new.handover_reason)) = 0) then
    raise exception 'handover_reason is required when a handover occurs';
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='tr_enforce_handover_reason') then
    create trigger tr_enforce_handover_reason
      before insert or update on public.threads
      for each row execute function public.enforce_handover_reason();
  end if;
end $$;

-- Analytics indexes
create index if not exists idx_threads_org_created on public.threads(org_id, created_at desc);
create index if not exists idx_messages_thread_created on public.messages(thread_id, created_at);

commit;


