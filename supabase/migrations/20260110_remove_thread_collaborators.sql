BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'threads'
      AND column_name = 'collaborator_user_id'
  ) THEN
    ALTER TABLE public.threads
      ADD COLUMN collaborator_user_id uuid;
  END IF;
END;
$$;

ALTER TABLE public.threads
  DROP CONSTRAINT IF EXISTS threads_collaborator_user_id_fkey;

ALTER TABLE public.threads
  ADD CONSTRAINT threads_collaborator_user_id_fkey
    FOREIGN KEY (collaborator_user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

WITH eligible AS (
  SELECT DISTINCT ON (tc.thread_id)
         tc.thread_id,
         tc.user_id
  FROM public.thread_collaborators tc
  JOIN public.threads t ON t.id = tc.thread_id
  LEFT JOIN public.channels ch ON ch.id = t.channel_id
  WHERE tc.user_id IS NOT NULL
    AND (t.assignee_user_id IS NULL OR tc.user_id <> t.assignee_user_id)
    AND (ch.super_agent_id IS NULL OR tc.user_id <> ch.super_agent_id)
  ORDER BY tc.thread_id, tc.added_at ASC
)
UPDATE public.threads t
SET collaborator_user_id = eligible.user_id
FROM eligible
WHERE eligible.thread_id = t.id
  AND t.collaborator_user_id IS DISTINCT FROM eligible.user_id;

DROP TRIGGER IF EXISTS tr_add_default_collaborators ON public.threads;
DROP FUNCTION IF EXISTS public.add_default_collaborators();

DROP POLICY IF EXISTS "messages select perm read_collaborator" ON public.messages;
CREATE POLICY "messages select perm read_collaborator"
ON public.messages
FOR SELECT
TO authenticated
USING (
  has_perm('read_collaborator', 'messages')
  AND EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = public.messages.thread_id
      AND (
        auth.uid() = t.assignee_user_id
        OR auth.uid() = t.collaborator_user_id
        OR auth.uid() = c.super_agent_id
      )
  )
);

DROP POLICY IF EXISTS "messages insert perm create" ON public.messages;
CREATE POLICY "messages insert perm create"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  has_perm('create', 'messages')
  AND EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = public.messages.thread_id
      AND (
        auth.uid() = t.assignee_user_id
        OR auth.uid() = t.collaborator_user_id
        OR auth.uid() = c.super_agent_id
      )
  )
);

DROP POLICY IF EXISTS "threads select perm read_collaborator" ON public.threads;
CREATE POLICY "threads select perm read_collaborator"
ON public.threads
FOR SELECT
TO authenticated
USING (
  has_perm('read_collaborator', 'threads')
  AND (
    auth.uid() = public.threads.assignee_user_id
    OR auth.uid() = public.threads.collaborator_user_id
    OR EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id = public.threads.channel_id
        AND c.super_agent_id = auth.uid()
    )
  )
);

DROP TABLE IF EXISTS public.thread_collaborators;

COMMIT;
