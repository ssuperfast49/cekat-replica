DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'thread_status'
      AND e.enumlabel = 'assigned'
  ) THEN
    ALTER TYPE public.thread_status ADD VALUE 'assigned';
  END IF;
END
$$;

