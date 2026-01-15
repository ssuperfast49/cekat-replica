-- Align triggers with development branch
-- - drop thread triggers present only on main
-- - add channels trigger present on development

BEGIN;

-- Drop main-only thread triggers
DROP TRIGGER IF EXISTS set_ai_handoff_at_on_assignee_change ON public.threads;
DROP TRIGGER IF EXISTS tr_enforce_handover_reason ON public.threads;
DROP TRIGGER IF EXISTS tr_set_ai_resolution_if_closed ON public.threads;

-- Ensure channels trigger exists to sync contacts/threads on super_agent change
DROP TRIGGER IF EXISTS tr_update_contacts_threads_on_channel_super_agent_change ON public.channels;
CREATE TRIGGER tr_update_contacts_threads_on_channel_super_agent_change
AFTER UPDATE ON public.channels
FOR EACH ROW
WHEN (OLD.super_agent_id IS DISTINCT FROM NEW.super_agent_id)
EXECUTE FUNCTION public.update_contacts_threads_on_channel_super_agent_change();

COMMIT;
