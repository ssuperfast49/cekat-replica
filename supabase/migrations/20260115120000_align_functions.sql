-- Align function definitions with development

BEGIN;

-- takeover_thread: return updated thread, set collaborator and status pending
DROP FUNCTION IF EXISTS public.takeover_thread(uuid);
CREATE OR REPLACE FUNCTION public.takeover_thread(p_thread_id uuid)
RETURNS public.threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_row public.threads;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_row FROM public.threads WHERE id = p_thread_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  UPDATE public.threads
  SET collaborator_user_id = v_uid,
      status = 'pending',
      assigned_at = COALESCE(assigned_at, now())
  WHERE id = p_thread_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- reopen_thread_on_user_message: preserve handled-by fields when reopening
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
           resolved_by_user_id = null
           -- handled-by fields preserved
     where id = new.thread_id
       and status = 'closed';
  end if;
  return new;
end
$$;

CREATE TRIGGER tr_reopen_thread_on_user_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.reopen_thread_on_user_message();

COMMIT;
