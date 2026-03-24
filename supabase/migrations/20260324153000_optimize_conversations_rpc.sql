-- Optimize Conversation Fetching RPC and Indexes

-- 1. Explicit Index for Latest Message Extraction
CREATE INDEX IF NOT EXISTS idx_messages_thread_latest ON messages (thread_id, created_at DESC, seq DESC);

-- 2. Ensure users_profile allows read access for the RPC's SECURITY INVOKER
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to read users_profile" ON users_profile;
    CREATE POLICY "Allow authenticated users to read users_profile" 
        ON users_profile FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping policy creation/drop due to existing conditions: %', SQLERRM;
END $$;

-- 3. Create the Main Fetching RPC
CREATE OR REPLACE FUNCTION get_threads_with_details(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  contact_id uuid,
  channel_id uuid,
  account_id text,
  status text,
  assignee_user_id uuid,
  collaborator_user_id uuid,
  assigned_by_user_id uuid,
  resolved_by_user_id uuid,
  ai_handoff_at timestamptz,
  assigned_at timestamptz,
  resolved_at timestamptz,
  is_blocked boolean,
  ai_access_enabled boolean,
  notes text,
  additional_data jsonb,
  last_msg_at timestamptz,
  created_at timestamptz,
  handover_reason text,
  
  -- Joined cols
  contact_name text,
  contact_phone text,
  contact_email text,
  channel_display_name text,
  channel_type text,
  channel_provider text,
  channel_external_id text,
  channel_logo_url text,
  channel_profile_photo_url text,
  channel_super_agent_id uuid,

  -- Profiles
  assignee_name text,
  assignee_last_seen_at timestamptz,
  resolved_by_name text,
  assigned_by_name text,
  super_agent_name text,
  super_agent_last_seen_at timestamptz,

  -- Computed
  is_assigned boolean,

  -- JSON latest message
  last_message jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.org_id, t.contact_id, t.channel_id, t.account_id,
    t.status::text, t.assignee_user_id, t.collaborator_user_id, t.assigned_by_user_id, t.resolved_by_user_id,
    t.ai_handoff_at, t.assigned_at, t.resolved_at,
    t.is_blocked, t.ai_access_enabled, t.notes, t.additional_data,
    t.last_msg_at, t.created_at, t.handover_reason,
    
    -- Contact
    c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email,
    -- Channel
    ch.display_name AS channel_display_name, ch.type::text AS channel_type, ch.provider::text AS channel_provider,
    ch.external_id AS channel_external_id, ch.logo_url AS channel_logo_url,
    ch.profile_photo_url AS channel_profile_photo_url, ch.super_agent_id AS channel_super_agent_id,
    
    -- Users Profiles
    up_ass.display_name AS assignee_name,
    up_ass.last_seen_at AS assignee_last_seen_at,
    up_res.display_name AS resolved_by_name,
    up_by.display_name AS assigned_by_name,
    up_sa.display_name AS super_agent_name,
    up_sa.last_seen_at AS super_agent_last_seen_at,

    -- Computed assignment (status = 'pending' or 'assigned')
    (t.status::text IN ('pending', 'assigned') AND t.status::text != 'closed') AS is_assigned,

    -- Last Message
    (
      SELECT jsonb_build_object(
        'id', m.id,
        'body', m.body,
        'role', m.role::text,
        'direction', m.direction::text,
        'created_at', m.created_at,
        'seq', m.seq
      )
      FROM messages m
      WHERE m.thread_id = t.id
      ORDER BY m.created_at DESC, m.seq DESC
      LIMIT 1
    ) AS last_message

  FROM threads t
  LEFT JOIN contacts c ON t.contact_id = c.id
  JOIN channels ch ON t.channel_id = ch.id
  LEFT JOIN users_profile up_ass ON t.assignee_user_id = up_ass.user_id
  LEFT JOIN users_profile up_res ON t.resolved_by_user_id = up_res.user_id
  LEFT JOIN users_profile up_by  ON t.assigned_by_user_id = up_by.user_id
  LEFT JOIN users_profile up_sa  ON ch.super_agent_id = up_sa.user_id

  WHERE 
    -- Status filtering mapping
    (p_filters->>'status' IS NULL OR p_filters->>'status' = 'all' OR p_filters->>'status' = '' OR t.status::text = (p_filters->>'status'))
    -- Assignee mapping
    AND (p_filters->>'agent' IS NULL OR p_filters->>'agent' = 'all' OR p_filters->>'agent' = '' OR t.assignee_user_id::text = (p_filters->>'agent'))
    -- Resolved_by mapping
    AND (p_filters->>'resolvedBy' IS NULL OR p_filters->>'resolvedBy' = 'all' OR p_filters->>'resolvedBy' = '' OR t.resolved_by_user_id::text = (p_filters->>'resolvedBy'))
    -- Provider mapping (inbox / channelType)
    AND (p_filters->>'inbox' IS NULL OR p_filters->>'inbox' = 'all' OR p_filters->>'inbox' = '' OR ch.provider::text = (p_filters->>'inbox'))
    AND (p_filters->>'channelType' IS NULL OR p_filters->>'channelType' = 'all' OR p_filters->>'channelType' = '' OR ch.provider::text = (p_filters->>'channelType'))
    -- Platform id
    AND (p_filters->>'platformId' IS NULL OR p_filters->>'platformId' = 'all' OR p_filters->>'platformId' = '' OR t.channel_id::text = (p_filters->>'platformId'))

    -- Date range
    AND (p_filters#>'{dateRange,from}' IS NULL OR t.last_msg_at >= (p_filters#>'{dateRange,from}')::text::timestamptz)
    AND (p_filters#>'{dateRange,to}' IS NULL OR t.last_msg_at <= (p_filters#>'{dateRange,to}')::text::timestamptz)
    
    -- Strict narrowed search scope
    AND (
      p_filters->>'search' IS NULL 
      OR p_filters->>'search' = ''
      OR c.name ILIKE '%' || (p_filters->>'search') || '%'
      OR ch.display_name ILIKE '%' || (p_filters->>'search') || '%'
      OR EXISTS (
        SELECT 1 FROM messages sm 
        WHERE sm.thread_id = t.id 
        AND sm.body ILIKE '%' || (p_filters->>'search') || '%'
        ORDER BY sm.created_at DESC, sm.seq DESC
        LIMIT 1
      )
    )

  ORDER BY t.last_msg_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;
