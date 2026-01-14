-- RPC: takeover_thread
CREATE OR REPLACE FUNCTION public.takeover_thread(p_thread_id uuid)
RETURNS public.threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- RPC: unassign_thread
CREATE OR REPLACE FUNCTION public.unassign_thread(p_thread_id uuid)
RETURNS public.threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
  SET collaborator_user_id = NULL,
      status = 'open',
      assigned_at = NULL
  WHERE id = p_thread_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.takeover_thread(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unassign_thread(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.takeover_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_thread(uuid) TO authenticated;
