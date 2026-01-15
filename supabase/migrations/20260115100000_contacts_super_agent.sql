-- Migrate contacts ownership from channel-scoped to super-agent-scoped
-- - adds contacts.super_agent_id (FK to auth.users)
-- - backfills from channels.super_agent_id
-- - drops legacy contacts.channel_id
-- - rewrites contacts RLS to match super-agent ownership model

BEGIN;

-- Add new owner column
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS super_agent_id uuid;

-- Backfill ownership from the previous channel-based model
UPDATE public.contacts c
SET super_agent_id = ch.super_agent_id
FROM public.channels ch
WHERE c.channel_id = ch.id
  AND c.super_agent_id IS DISTINCT FROM ch.super_agent_id;

-- Drop old FK and column
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_channel_id_fkey;

ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS channel_id;

-- New FK to auth.users
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_super_agent_id_fkey
    FOREIGN KEY (super_agent_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- Helpful index for ownership lookups
CREATE INDEX IF NOT EXISTS idx_contacts_super_agent_id
  ON public.contacts (super_agent_id);

-- RLS: replace channel-scoped policies with super-agent ownership
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contacts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contacts', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Read all (master)
CREATE POLICY "contacts select perm read_all"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_perm('read_all', 'contacts')
);

-- Read own (super agent)
CREATE POLICY "contacts select perm read_own"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_perm('read_own', 'contacts')
  AND public.contacts.super_agent_id = auth.uid()
);

-- Insert own
CREATE POLICY "contacts insert perm create"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  has_perm('contacts', 'create')
  AND public.contacts.super_agent_id = auth.uid()
);

-- Update own
CREATE POLICY "contacts update perm update_own"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  has_perm('contacts', 'update')
  AND public.contacts.super_agent_id = auth.uid()
)
WITH CHECK (
  has_perm('contacts', 'update')
  AND public.contacts.super_agent_id = auth.uid()
);

-- Delete own
CREATE POLICY "contacts delete perm delete_own"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  has_perm('contacts', 'delete')
  AND public.contacts.super_agent_id = auth.uid()
);

COMMIT;
