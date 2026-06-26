-- Fallback for the AI handover instruction.
--
-- The ai_profiles.system_prompt instructs the model to invoke the Handover
-- Tool whenever it emits a phrase like "aku bantu transfer chat ke senior".
-- Small models (e.g. gemini-3.1-flash-lite) sometimes emit the text but
-- forget the tool_call in the same turn, leaving the customer chatting with
-- the bot after being told they'd be transferred.
--
-- This trigger watches every AI message INSERT for that intent phrase and,
-- if found on a thread that hasn't been handed over yet, programmatically:
--   * stamps ai_handoff_at = now()
--   * fills handover_reason (required by enforce_handover_reason trigger)
--   * sets ai_access_enabled = false so the AI stops responding
--
-- Only fires for messages authored by the AI (actor_kind = 'ai').
-- The existing orchestrator check_handover action will pick the new state up
-- and insert the "Auto-handover triggered by AI agent." system event as usual.

create or replace function public.force_handover_on_ai_trigger_phrase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_kind = 'ai'
     and new.role = 'agent'
     and coalesce(new.body, '') ilike '%transfer chat ke senior%'
  then
    update public.threads
       set ai_handoff_at      = now(),
           handover_reason    = coalesce(nullif(trim(handover_reason), ''),
                                         'Auto-handover (AI emitted trigger phrase but did not invoke tool)'),
           ai_access_enabled  = false
     where id = new.thread_id
       and ai_handoff_at is null;
  end if;
  return null;
end;
$$;

drop trigger if exists tr_force_handover_on_ai_trigger_phrase on public.messages;
create trigger tr_force_handover_on_ai_trigger_phrase
after insert on public.messages
for each row execute function public.force_handover_on_ai_trigger_phrase();

comment on function public.force_handover_on_ai_trigger_phrase is
'Fallback: when an AI message contains the prompt-defined trigger phrase but the AI did not actually invoke the Handover Tool, force the handover so the customer is not stuck with the bot.';
