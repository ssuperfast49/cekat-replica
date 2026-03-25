-- Fix takeover_thread: enforce enum cast for status and return updated thread row
-- Also ensures the caller is authenticated and belongs to the thread org

CREATE OR REPLACE FUNCTION public.takeover_thread(p_thread_id uuid)
RETURNS public.threads
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  IF NOT EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = v_uid AND om.org_id = v_row.org_id
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.threads
  SET collaborator_user_id = v_uid,
      status = 'pending'::public.thread_status,
      assigned_at = COALESCE(assigned_at, now()),
      ai_access_enabled = false
  WHERE id = p_thread_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- Reload schema cache so PostgREST picks up the new return type/signature
NOTIFY pgrst, 'reload schema';
