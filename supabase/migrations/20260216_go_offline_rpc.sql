-- Drop existing function to allow return type change (and in case it was created by a previous migration)
DROP FUNCTION IF EXISTS public.go_offline();

-- Create a debug log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.debug_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_timestamp timestamptz DEFAULT now(),
    event_type text,
    user_id uuid,
    details jsonb
);

-- Function to log last_seen_at changes
CREATE OR REPLACE FUNCTION log_users_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.last_seen_at IS DISTINCT FROM NEW.last_seen_at) THEN
        INSERT INTO public.debug_events (event_type, user_id, details)
        VALUES (
            'last_seen_at_change',
            NEW.user_id,
            jsonb_build_object(
                'old_val', OLD.last_seen_at,
                'new_val', NEW.last_seen_at,
                'by_user', auth.uid(),
                'role', auth.role()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log changes
DROP TRIGGER IF EXISTS log_last_seen_at_update ON public.users_profile;

CREATE TRIGGER log_last_seen_at_update
AFTER UPDATE ON public.users_profile
FOR EACH ROW
EXECUTE FUNCTION log_users_profile_changes();

-- Update RPC to return boolean and log execution
CREATE OR REPLACE FUNCTION public.go_offline()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows int;
BEGIN
  -- Set last_seen_at to NULL
  UPDATE public.users_profile
  SET last_seen_at = NULL
  WHERE user_id = auth.uid();
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  -- Log the attempt explicitly
  INSERT INTO public.debug_events (event_type, user_id, details)
  VALUES ('go_offline_rpc_called', auth.uid(), jsonb_build_object('affected_rows', affected_rows));

  RETURN affected_rows > 0;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.go_offline() TO authenticated;
GRANT EXECUTE ON FUNCTION public.go_offline() TO service_role;
GRANT EXECUTE ON FUNCTION public.go_offline() TO anon;
