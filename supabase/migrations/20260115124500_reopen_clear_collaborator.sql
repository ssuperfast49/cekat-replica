-- Clear collaborator when reopening a thread on inbound/user message

BEGIN;

-- Recreate function to nullify collaborator on reopen
DROP TRIGGER IF EXISTS tr_reopen_thread_on_user_message ON public.messages;
DROP FUNCTION IF EXISTS public.reopen_thread_on_user_message();

CREATE OR REPLACE FUNCTION public.reopen_thread_on_user_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  -- Only react to inbound/user messages
  if (new.role = 'user' or new.direction = 'in') then
    update public.threads
       set status = 'open',
           resolved_at = null,
           resolved_by_user_id = null,
           collaborator_user_id = null
     where id = new.thread_id
       and status = 'closed';
  end if;
  return new;
end
$$;

-- Recreate trigger
CREATE TRIGGER tr_reopen_thread_on_user_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.reopen_thread_on_user_message();

COMMIT;
