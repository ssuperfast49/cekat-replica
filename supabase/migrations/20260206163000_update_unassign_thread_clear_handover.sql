-- Update unassign_thread to clear ai_handoff_at and handover_reason
CREATE OR REPLACE FUNCTION public.unassign_thread(p_thread_id uuid)
 RETURNS threads
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_thread threads;
BEGIN
  UPDATE threads
  SET 
    collaborator_user_id = NULL,
    status = 'open',
    ai_access_enabled = true,
    ai_handoff_at = NULL,
    handover_reason = NULL
  WHERE id = p_thread_id
  RETURNING * INTO v_thread;

  RETURN v_thread;
END;
$function$
;
