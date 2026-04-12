-- Optimize get_threads_with_details: SECURITY DEFINER to bypass RLS overhead
--
-- Problem: With 18k+ threads, RLS policies evaluate EXISTS subqueries against
-- channels/channel_agents for EVERY candidate row BEFORE the LIMIT clause
-- takes effect. This makes pagination useless for performance.
--
-- Solution: Make the function SECURITY DEFINER (like get_tab_counts_v3) and
-- implement the same visibility check inside the function. For elevated users
-- (master_agent, auditor), no visibility filter is applied, so LIMIT 10
-- touches only ~11 index rows. For regular agents, the visibility check is
-- part of the WHERE clause inside the picked CTE.

CREATE OR REPLACE FUNCTION public.get_threads_with_details(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, org_id uuid, contact_id uuid, channel_id uuid, account_id text,
  status text, assignee_user_id uuid, collaborator_user_id uuid,
  assigned_by_user_id uuid, resolved_by_user_id uuid,
  ai_handoff_at timestamptz, assigned_at timestamptz, resolved_at timestamptz,
  is_blocked boolean, ai_access_enabled boolean, notes text,
  additional_data jsonb, last_msg_at timestamptz, created_at timestamptz,
  handover_reason text,
  contact_name text, contact_phone text, contact_email text,
  channel_display_name text, channel_type text, channel_provider text,
  channel_external_id text, channel_logo_url text, channel_profile_photo_url text,
  channel_super_agent_id uuid,
  assignee_name text, assignee_last_seen_at timestamptz,
  resolved_by_name text, assigned_by_name text,
  super_agent_name text, super_agent_last_seen_at timestamptz,
  is_assigned boolean,
  last_message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  v_status thread_status;
  v_agent uuid;
  v_resolved_by uuid;
  v_platform_id uuid;
  v_inbox text;
  v_channel_type text;
  v_from timestamptz;
  v_to timestamptz;
  v_search text;

  v_need_channel_join boolean := false;
  v_is_elevated boolean;
  v_uid uuid;
  v_sql text;
  v_where text := '';
BEGIN
  -- Defensive bounds
  p_limit  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- Current user
  v_uid := auth.uid();
  v_is_elevated := (is_master_agent() OR is_auditor());

  -- ----------------------------------------------------------
  -- Normalize filters
  -- ----------------------------------------------------------
  v_status := CASE
    WHEN COALESCE(p_filters->>'status', '') IN ('', 'all') THEN NULL
    WHEN p_filters->>'status' = 'assigned'   THEN 'pending'::thread_status
    WHEN p_filters->>'status' = 'unassigned' THEN 'open'::thread_status
    WHEN p_filters->>'status' = 'done'       THEN 'closed'::thread_status
    ELSE (p_filters->>'status')::thread_status
  END;

  v_agent := CASE
    WHEN COALESCE(p_filters->>'agent', '') IN ('', 'all') THEN NULL
    ELSE (p_filters->>'agent')::uuid
  END;

  v_resolved_by := CASE
    WHEN COALESCE(p_filters->>'resolvedBy', '') IN ('', 'all') THEN NULL
    ELSE (p_filters->>'resolvedBy')::uuid
  END;

  v_platform_id := CASE
    WHEN COALESCE(p_filters->>'platformId', '') IN ('', 'all') THEN NULL
    ELSE (p_filters->>'platformId')::uuid
  END;

  v_inbox := NULLIF(NULLIF(BTRIM(p_filters->>'inbox'), ''), 'all');
  v_channel_type := NULLIF(NULLIF(BTRIM(p_filters->>'channelType'), ''), 'all');

  v_from := NULLIF(p_filters#>>'{dateRange,from}', '')::timestamptz;
  v_to   := NULLIF(p_filters#>>'{dateRange,to}', '')::timestamptz;

  v_search := NULLIF(BTRIM(p_filters->>'search'), '');

  v_need_channel_join := (
    v_inbox IS NOT NULL
    OR v_channel_type IS NOT NULL
    OR v_search IS NOT NULL
  );

  -- ----------------------------------------------------------
  -- Build shared WHERE only from active predicates
  -- ----------------------------------------------------------
  IF v_status IS NOT NULL THEN
    v_where := v_where || format(' AND t.status = %L::thread_status', v_status::text);
  END IF;

  IF v_agent IS NOT NULL THEN
    v_where := v_where || format(' AND t.assignee_user_id = %L::uuid', v_agent);
  END IF;

  IF v_resolved_by IS NOT NULL THEN
    v_where := v_where || format(' AND t.resolved_by_user_id = %L::uuid', v_resolved_by);
  END IF;

  IF v_platform_id IS NOT NULL THEN
    v_where := v_where || format(' AND t.channel_id = %L::uuid', v_platform_id);
  END IF;

  IF v_from IS NOT NULL THEN
    v_where := v_where || format(' AND t.last_msg_at >= %L::timestamptz', v_from);
  END IF;

  IF v_to IS NOT NULL THEN
    v_where := v_where || format(' AND t.last_msg_at <= %L::timestamptz', v_to);
  END IF;

  IF v_inbox IS NOT NULL THEN
    v_where := v_where || format(' AND ch.provider::text = %L', v_inbox);
  END IF;

  IF v_channel_type IS NOT NULL THEN
    v_where := v_where || format(' AND ch.type::text = %L', v_channel_type);
  END IF;

  -- ----------------------------------------------------------
  -- SECURITY: visibility filter (replaces RLS, since SECURITY DEFINER)
  -- Elevated users (master_agent, auditor) see everything.
  -- Others see only threads on channels they are assigned to.
  -- ----------------------------------------------------------
  IF NOT v_is_elevated THEN
    v_where := v_where || format(
      ' AND EXISTS (SELECT 1 FROM channels c_sec WHERE c_sec.id = t.channel_id AND (c_sec.super_agent_id = %L::uuid OR EXISTS (SELECT 1 FROM channel_agents ca_sec WHERE ca_sec.channel_id = c_sec.id AND ca_sec.user_id = %L::uuid)))',
      v_uid, v_uid
    );
  END IF;

  -- ----------------------------------------------------------
  -- FAST PATH: no search
  -- ----------------------------------------------------------
  IF v_search IS NULL THEN
    v_sql := '
      WITH picked AS (
        SELECT t.id, t.last_msg_at
        FROM threads t
    ';

    IF v_need_channel_join THEN
      v_sql := v_sql || '
        JOIN channels ch ON ch.id = t.channel_id
      ';
    END IF;

    v_sql := v_sql || '
        WHERE 1=1
        ' || v_where || '
        ORDER BY t.last_msg_at DESC NULLS LAST, t.id DESC
        LIMIT ' || p_limit || '
        OFFSET ' || p_offset || '
      )
      SELECT
        t.id,
        t.org_id,
        t.contact_id,
        t.channel_id,
        t.account_id,
        t.status::text,
        t.assignee_user_id,
        t.collaborator_user_id,
        t.assigned_by_user_id,
        t.resolved_by_user_id,
        t.ai_handoff_at,
        t.assigned_at,
        t.resolved_at,
        t.is_blocked,
        t.ai_access_enabled,
        t.notes,
        t.additional_data,
        t.last_msg_at,
        t.created_at,
        t.handover_reason,

        c.name AS contact_name,
        c.phone AS contact_phone,
        c.email AS contact_email,

        ch.display_name AS channel_display_name,
        ch.type::text AS channel_type,
        ch.provider::text AS channel_provider,
        ch.external_id AS channel_external_id,
        ch.logo_url AS channel_logo_url,
        ch.profile_photo_url AS channel_profile_photo_url,
        ch.super_agent_id AS channel_super_agent_id,

        up_ass.display_name AS assignee_name,
        up_ass.last_seen_at AS assignee_last_seen_at,
        up_res.display_name AS resolved_by_name,
        up_by.display_name  AS assigned_by_name,
        up_sa.display_name  AS super_agent_name,
        up_sa.last_seen_at  AS super_agent_last_seen_at,

        (t.assignee_user_id IS NOT NULL AND t.status <> ''closed''::thread_status) AS is_assigned,

        jsonb_build_object(
          ''body'', t.last_message_body,
          ''direction'', t.last_message_direction::text,
          ''role'', t.last_message_role::text
        ) AS last_message

      FROM picked p
      JOIN threads t              ON t.id = p.id
      LEFT JOIN contacts c        ON c.id = t.contact_id
      JOIN channels ch            ON ch.id = t.channel_id
      LEFT JOIN users_profile up_ass ON up_ass.user_id = t.assignee_user_id
      LEFT JOIN users_profile up_res ON up_res.user_id = t.resolved_by_user_id
      LEFT JOIN users_profile up_by  ON up_by.user_id  = t.assigned_by_user_id
      LEFT JOIN users_profile up_sa  ON up_sa.user_id  = ch.super_agent_id
      ORDER BY t.last_msg_at DESC NULLS LAST, t.id DESC
    ';

    RETURN QUERY EXECUTE v_sql;
    RETURN;
  END IF;

  -- ----------------------------------------------------------
  -- SEARCH PATH
  -- ----------------------------------------------------------
  v_sql := '
    WITH picked AS (
      SELECT t.id, t.last_msg_at
      FROM threads t
      JOIN channels ch ON ch.id = t.channel_id
      LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE 1=1
      ' || v_where || format('
        AND (
          t.last_message_body ILIKE %L
          OR ch.display_name ILIKE %L
          OR c.name ILIKE %L
        )
        ORDER BY t.last_msg_at DESC NULLS LAST, t.id DESC
        LIMIT %s
        OFFSET %s
      )
      SELECT
        t.id,
        t.org_id,
        t.contact_id,
        t.channel_id,
        t.account_id,
        t.status::text,
        t.assignee_user_id,
        t.collaborator_user_id,
        t.assigned_by_user_id,
        t.resolved_by_user_id,
        t.ai_handoff_at,
        t.assigned_at,
        t.resolved_at,
        t.is_blocked,
        t.ai_access_enabled,
        t.notes,
        t.additional_data,
        t.last_msg_at,
        t.created_at,
        t.handover_reason,

        c.name AS contact_name,
        c.phone AS contact_phone,
        c.email AS contact_email,

        ch.display_name AS channel_display_name,
        ch.type::text AS channel_type,
        ch.provider::text AS channel_provider,
        ch.external_id AS channel_external_id,
        ch.logo_url AS channel_logo_url,
        ch.profile_photo_url AS channel_profile_photo_url,
        ch.super_agent_id AS channel_super_agent_id,

        up_ass.display_name AS assignee_name,
        up_ass.last_seen_at AS assignee_last_seen_at,
        up_res.display_name AS resolved_by_name,
        up_by.display_name  AS assigned_by_name,
        up_sa.display_name  AS super_agent_name,
        up_sa.last_seen_at  AS super_agent_last_seen_at,

        (t.assignee_user_id IS NOT NULL AND t.status <> ''closed''::thread_status) AS is_assigned,

        jsonb_build_object(
          ''body'', t.last_message_body,
          ''direction'', t.last_message_direction::text,
          ''role'', t.last_message_role::text
        ) AS last_message

      FROM picked p
      JOIN threads t              ON t.id = p.id
      LEFT JOIN contacts c        ON c.id = t.contact_id
      JOIN channels ch            ON ch.id = t.channel_id
      LEFT JOIN users_profile up_ass ON up_ass.user_id = t.assignee_user_id
      LEFT JOIN users_profile up_res ON up_res.user_id = t.resolved_by_user_id
      LEFT JOIN users_profile up_by  ON up_by.user_id  = t.assigned_by_user_id
      LEFT JOIN users_profile up_sa  ON up_sa.user_id  = ch.super_agent_id
      ORDER BY t.last_msg_at DESC NULLS LAST, t.id DESC
    ',
      '%%' || v_search || '%%',
      '%%' || v_search || '%%',
      '%%' || v_search || '%%',
      p_limit,
      p_offset
    );

  RETURN QUERY EXECUTE v_sql;
END;
$function$;
