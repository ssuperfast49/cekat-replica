-- 1. Enable RLS and Policy on realtime.messages
-- This allows authenticated users to receive the broadcasts securely
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can receive broadcasts" ON realtime.messages;
CREATE POLICY "authenticated can receive broadcasts" 
ON realtime.messages FOR SELECT TO authenticated USING (true);


-- 2. Message Trigger Handler
CREATE OR REPLACE FUNCTION public.broadcast_message_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Broadcast to specific thread chat view
  PERFORM realtime.broadcast_changes(
    'messages:' || NEW.thread_id::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  
  -- Broadcast to all threads (conversation list preview updates)
  PERFORM realtime.broadcast_changes(
    'messages:all',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );

  -- Broadcast to notifications topic for audio alerts
  PERFORM realtime.broadcast_changes(
    'notifications:messages',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );

  RETURN NULL;
END;
$function$;

-- Apply Message Trigger
DROP TRIGGER IF EXISTS messages_broadcast_trigger ON public.messages;
CREATE TRIGGER messages_broadcast_trigger
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.broadcast_message_changes();


-- 3. Thread Trigger Handler
CREATE OR REPLACE FUNCTION public.broadcast_thread_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  record_data record;
BEGIN
  -- Determine whether to use NEW or OLD based on operation
  IF TG_OP = 'DELETE' THEN
    record_data := OLD;
  ELSE
    record_data := NEW;
  END IF;

  -- Broadcast to all threads list
  PERFORM realtime.broadcast_changes(
    'threads:all',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  
  -- Broadcast to specific thread detail view
  PERFORM realtime.broadcast_changes(
    'threads:' || record_data.id::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );

  RETURN NULL;
END;
$function$;

-- Apply Thread Trigger
DROP TRIGGER IF EXISTS threads_broadcast_trigger ON public.threads;
CREATE TRIGGER threads_broadcast_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.threads
FOR EACH ROW EXECUTE FUNCTION public.broadcast_thread_changes();
