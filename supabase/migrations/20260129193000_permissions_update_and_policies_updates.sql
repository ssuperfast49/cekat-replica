-- =========================================================
-- RBAC + RLS FULL RESET (DESTRUCTIVE)
-- =========================================================
-- WARNING:
--   This migration wipes ALL rows from:
--     - public.permissions
--     - public.role_permissions
--   and recreates RLS policies on several tables.
--
--   Re-running it is "idempotent" in the sense that it always
--   converges to the same final state, but it *does not* preserve
--   any manually-added permissions or role bindings.
-- =========================================================

BEGIN;

--------------------------------------------------------------
-- 1. RESET PERMISSIONS & ROLE_BINDINGS
--------------------------------------------------------------

DELETE FROM public.role_permissions;
DELETE FROM public.permissions;

--------------------------------------------------------------
-- 2. RECREATE PERMISSIONS (FINALIZED SET)
--------------------------------------------------------------

INSERT INTO public.permissions (name, resource, action) VALUES

  -- -------------------------
  -- Analytics
  -- -------------------------
  ('Analytics: Read',                 'analytics',           'read'),

  -- -------------------------
  -- AI Profiles
  -- -------------------------
  ('AI Profiles: Create',             'ai_profiles',         'create'),
  ('AI Profiles: Update',             'ai_profiles',         'update'),
  ('AI Profiles: Delete',             'ai_profiles',         'delete'),
  ('AI Profiles: Read All',           'ai_profiles',         'read_all'),
  ('AI Profiles: Read Own',           'ai_profiles',         'read_own'),

  -- -------------------------
  -- AI Sessions
  -- -------------------------
  ('AI Sessions: Create',             'ai_sessions',         'create'),
  ('AI Sessions: Update',             'ai_sessions',         'update'),
  ('AI Sessions: Delete',             'ai_sessions',         'delete'),
  ('AI Sessions: Read All',           'ai_sessions',         'read_all'),
  ('AI Sessions: Read Own',           'ai_sessions',         'read_own'),

  -- -------------------------
  -- Channels
  -- -------------------------
  ('Channels: Create',                'channels',            'create'),
  ('Channels: Update',                'channels',            'update'),
  ('Channels: Delete',                'channels',            'delete'),
  ('Channels: Read All',              'channels',            'read_all'),
  ('Channels: Read Own',              'channels',            'read_own'),

  -- -------------------------
  -- Contacts
  -- -------------------------
  ('Contacts: Create',                'contacts',            'create'),
  ('Contacts: Update',                'contacts',            'update'),
  ('Contacts: Delete',                'contacts',            'delete'),
  ('Contacts: Read All',              'contacts',            'read_all'),
  ('Contacts: Read Own',              'contacts',            'read_own'),

  -- -------------------------
  -- Contact Identities
  -- -------------------------
  ('Contact Identities: Create',      'contact_identities',  'create'),
  ('Contact Identities: Update',      'contact_identities',  'update'),
  ('Contact Identities: Delete',      'contact_identities',  'delete'),
  ('Contact Identities: Read All',    'contact_identities',  'read_all'),
  ('Contact Identities: Read Own',    'contact_identities',  'read_own'),

  -- ----------------------------------------------------
  -- Conversation model (Threads + Messages)
  -- ----------------------------------------------------

  -- Threads
  ('Threads: Create',                 'threads',             'create'),
  ('Threads: Update',                 'threads',             'update'),
  ('Threads: Delete',                 'threads',             'delete'),
  ('Threads: Read All',               'threads',             'read_all'),
  ('Threads: Read Channel Owned',     'threads',             'read_channel_owned'),
  ('Threads: Read Collaborator',      'threads',             'read_collaborator'),

  -- Messages
  ('Messages: Create',                'messages',            'create'),
  ('Messages: Update',                'messages',            'update'),
  ('Messages: Delete',                'messages',            'delete'),
  ('Messages: Send',                  'messages',            'send'),
  ('Messages: Read All',              'messages',            'read_all'),
  ('Messages: Read Collaborator',     'messages',            'read_collaborator'),

  -- ----------------------------------------------------
  -- Simple resources
  -- ----------------------------------------------------
  ('AI Agent Files: Create',          'ai_agent_files',      'create'),
  ('AI Agent Files: Read',            'ai_agent_files',      'read'),
  ('AI Agent Files: Delete',          'ai_agent_files',      'delete'),

  -- ----------------------------------------------------
  -- Admin / System permissions
  -- ----------------------------------------------------
  ('Admin Panel: Read',               'admin_panel',         'read'),
  ('Admin Panel: Update Settings',    'admin_panel',         'update'),

  ('Roles: Create',                   'roles',               'create'),
  ('Roles: Read',                     'roles',               'read'),
  ('Roles: Update',                   'roles',               'update'),
  ('Roles: Delete',                   'roles',               'delete'),

  ('Audit Logs: Read',                'audit_logs',          'read'),
  ('Alerts: Read',                    'alerts',              'read'),
  ('Alerts: Acknowledge',             'alerts',              'ack');

--------------------------------------------------------------
-- 3. ROLE_PERMISSIONS (DEFAULT BINDINGS)
--------------------------------------------------------------

-- 3a) SUPER_AGENT: Scoped read permissions only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p 
  ON (
        -- ai_profiles
        (p.resource = 'ai_profiles'  AND p.action = 'read_own')
        OR
        -- channels
        (p.resource = 'channels'     AND p.action = 'read_own')
        OR
        -- contacts
        (p.resource = 'contacts'     AND p.action = 'read_own')
        OR
        -- messages
        (p.resource = 'messages'     AND p.action = 'read_collaborator')
        OR
        -- threads
        (p.resource = 'threads'      AND p.action IN ('read_channel_owned', 'read_collaborator'))
     )
WHERE r.name = 'super_agent';

-- 3b) MASTER_AGENT: wipe + re-grant *all* permissions
--     (this uses the fixed UUID you gave me for master_agent)
DELETE FROM public.role_permissions
WHERE role_id = '4e9d6dea-0744-4678-992a-4470261810ef';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '4e9d6dea-0744-4678-992a-4470261810ef'::uuid, p.id
FROM public.permissions p;

--------------------------------------------------------------
-- 4. RLS POLICIES (PERMISSION-BASED)
--------------------------------------------------------------

--------------------------------------------------------------
-- 4.1 AI PROFILES
--------------------------------------------------------------

ALTER TABLE public.ai_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_profiles', r.policyname);
  END LOOP;
END$$;

-- master_agent / read_all
CREATE POLICY "ai_profiles select perm read_all"
ON public.ai_profiles
FOR SELECT
TO authenticated
USING (
  has_perm('read_all', 'ai_profiles')
);

-- super_agent / read_own (owned by super_agent_id)
CREATE POLICY "ai_profiles select perm read_own"
ON public.ai_profiles
FOR SELECT
TO authenticated
USING (
  has_perm('read_own', 'ai_profiles')
  AND public.ai_profiles.super_agent_id = auth.uid()
);

--------------------------------------------------------------
-- 4.2 CHANNELS
--------------------------------------------------------------

-- Drop ALL existing policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channels'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.channels', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- READ: master -> all
CREATE POLICY "channels select perm read_all"
ON public.channels
FOR SELECT
TO authenticated
USING (
  has_perm('read_all', 'channels')
);

-- READ: super_agent -> own
CREATE POLICY "channels select perm read_own"
ON public.channels
FOR SELECT
TO authenticated
USING (
  has_perm('read_own', 'channels')
  AND public.channels.super_agent_id = auth.uid()
);

-- INSERT: must have create + own
CREATE POLICY "channels insert perm create"
ON public.channels
FOR INSERT
TO authenticated
WITH CHECK (
  has_perm('create', 'channels')
  AND public.channels.super_agent_id = auth.uid()
);

-- UPDATE: update_own
CREATE POLICY "channels update perm update_own"
ON public.channels
FOR UPDATE
TO authenticated
USING (
  has_perm('update', 'channels')
  AND public.channels.super_agent_id = auth.uid()
)
WITH CHECK (
  has_perm('update', 'channels')
  AND public.channels.super_agent_id = auth.uid()
);

-- DELETE: delete_own
CREATE POLICY "channels delete perm delete_own"
ON public.channels
FOR DELETE
TO authenticated
USING (
  has_perm('delete', 'channels')
  AND public.channels.super_agent_id = auth.uid()
);

--------------------------------------------------------------
-- 4.3 CONTACTS
--------------------------------------------------------------

-- Drop ALL existing policies
DO $$
DECLARE r RECORD;
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

-- READ: master -> all
CREATE POLICY "contacts select perm read_all"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_perm('read_all', 'contacts')
);

-- READ: super_agent -> own
CREATE POLICY "contacts select perm read_own"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_perm('read_own', 'contacts')
  AND public.contacts.super_agent_id = auth.uid()
);

-- INSERT
CREATE POLICY "contacts insert perm create"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  has_perm('create', 'contacts')
  AND public.contacts.super_agent_id = auth.uid()
);

-- UPDATE
CREATE POLICY "contacts update perm update_own"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  has_perm('update', 'contacts')
  AND public.contacts.super_agent_id = auth.uid()
)
WITH CHECK (
  has_perm('update', 'contacts')
  AND public.contacts.super_agent_id = auth.uid()
);

-- DELETE
CREATE POLICY "contacts delete perm delete_own"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  has_perm('delete', 'contacts')
  AND public.contacts.super_agent_id = auth.uid()
);

--------------------------------------------------------------
-- 4.4 MESSAGES
--------------------------------------------------------------

-- Drop ALL existing policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- AUTH READ: master / read_all
CREATE POLICY "messages select perm read_all"
ON public.messages
FOR SELECT
TO authenticated
USING (
  has_perm('read_all', 'messages')
);

-- AUTH READ: collaborator scope (for 'read_collaborator')
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

-- ANON READ (web widget)
CREATE POLICY "messages select anon web_widget"
ON public.messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = public.messages.thread_id
      AND c.provider = 'web'::channel_type
      AND COALESCE(c.is_active, true)
      AND c.secret_token IS NOT NULL
      AND c.secret_token = (
        current_setting('request.jwt.claims', true)::jsonb ->> 'channel_secret'
      )
      AND t.id = (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'thread_id')::uuid
      )
  )
);

-- AUTH INSERT (agents, collaborators)
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

-- AUTH UPDATE: own agent messages only
CREATE POLICY "messages update perm update_own"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  has_perm('update', 'messages')
  AND public.messages.actor_kind = 'agent'
  AND public.messages.actor_id   = auth.uid()
)
WITH CHECK (
  has_perm('update', 'messages')
  AND public.messages.actor_kind = 'agent'
  AND public.messages.actor_id   = auth.uid()
);

-- AUTH DELETE: own agent messages only
CREATE POLICY "messages delete perm delete_own"
ON public.messages
FOR DELETE
TO authenticated
USING (
  has_perm('delete', 'messages')
  AND public.messages.actor_kind = 'agent'
  AND public.messages.actor_id   = auth.uid()
);

-- ANON INSERT (web widget visitor)
CREATE POLICY "messages insert anon web_widget"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = public.messages.thread_id
      AND c.provider = 'web'::channel_type
      AND COALESCE(c.is_active, true)
      AND c.secret_token IS NOT NULL
      AND c.secret_token = (
        current_setting('request.jwt.claims', true)::jsonb ->> 'channel_secret'
      )
      AND t.id = (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'thread_id')::uuid
      )
  )
);

--------------------------------------------------------------
-- 4.5 THREADS
--------------------------------------------------------------

-- Drop ALL existing policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'threads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.threads', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

-- READ: master (read_all)
CREATE POLICY "threads select perm read_all"
ON public.threads
FOR SELECT
TO authenticated
USING (
  has_perm('read_all', 'threads')
);

-- READ: channel_owned (threads.super_agent_id = auth.uid())
CREATE POLICY "threads select perm read_channel_owned"
ON public.threads
FOR SELECT
TO authenticated
USING (
  has_perm('read_channel_owned', 'threads')
  AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = public.threads.channel_id AND c.super_agent_id = auth.uid())
);

-- READ: collaborator
CREATE POLICY "threads select perm read_collaborator"
ON public.threads
FOR SELECT
TO authenticated
USING (
  has_perm('read_collaborator', 'threads')
  AND EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = public.threads.channel_id
      AND (
        auth.uid() = public.threads.assignee_user_id
        OR auth.uid() = public.threads.collaborator_user_id
        OR auth.uid() = c.super_agent_id
      )
  )
);

-- ANON READ: web widget
CREATE POLICY "threads select anon web_widget"
ON public.threads
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = public.threads.channel_id
      AND c.provider = 'web'::channel_type
      AND COALESCE(c.is_active, true)
      AND c.secret_token IS NOT NULL
      AND c.secret_token = (
        current_setting('request.jwt.claims', true)::jsonb ->> 'channel_secret'
      )
      AND public.threads.id = (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'thread_id')::uuid
      )
  )
);

-- INSERT: must have create + own (super_agent_id)
CREATE POLICY "threads insert perm create"
ON public.threads
FOR INSERT
TO authenticated
WITH CHECK (
  has_perm('create', 'threads')
  AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = public.threads.channel_id AND c.super_agent_id = auth.uid())
);

-- UPDATE: update_own
CREATE POLICY "threads update perm update_own"
ON public.threads
FOR UPDATE
TO authenticated
USING (
  has_perm('update', 'threads')
  AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = public.threads.channel_id AND c.super_agent_id = auth.uid())
)
WITH CHECK (
  has_perm('update', 'threads')
  AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = public.threads.channel_id AND c.super_agent_id = auth.uid())
);

-- DELETE: delete_own
CREATE POLICY "threads delete perm delete_own"
ON public.threads
FOR DELETE
TO authenticated
USING (
  has_perm('delete', 'threads')
  AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = public.threads.channel_id AND c.super_agent_id = auth.uid())
);

--------------------------------------------------------------
-- 4.6 AUDIT_LOGS (NEW POLICY)
--------------------------------------------------------------

-- Drop ALL existing policies related to public.audit_logs
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Permission-based read (whoever has audit_logs.read)
CREATE POLICY "audit_logs select perm read"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_perm('read', 'audit_logs')
);

COMMIT;
