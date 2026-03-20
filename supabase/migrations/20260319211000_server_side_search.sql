-- Migration: Server-Side Keyword Search & Dynamic Tab Counts
-- Created at: 2026-03-19 21:10:00

-- 1. Enable pg_trgm for efficient fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GIN trigram indexes for high-performance searching
-- Index on threads.last_message_body
CREATE INDEX IF NOT EXISTS idx_threads_last_message_body_trgm ON public.threads USING gin (last_message_body gin_trgm_ops);

-- Index on contacts.name
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);

-- 3. Create the RPC for dynamic tab counts with Hybrid Optimization
CREATE OR REPLACE FUNCTION public.get_tab_counts_v3(
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  status_category TEXT,
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := p_filters->>'search';
  v_from TIMESTAMPTZ := (p_filters->'dateRange'->>'from')::TIMESTAMPTZ;
  v_to TIMESTAMPTZ := (p_filters->'dateRange'->>'to')::TIMESTAMPTZ;
  v_agent UUID := NULLIF(p_filters->>'agent', '')::UUID;
  v_resolved_by UUID := NULLIF(p_filters->>'resolvedBy', '')::UUID;
  v_inbox TEXT := NULLIF(p_filters->>'inbox', '');
  v_platform_id UUID := NULLIF(p_filters->>'platformId', '')::UUID;
  
  v_has_filters BOOLEAN;
BEGIN
  -- Check if any filters are active (excluding the default 'all' or empty values)
  v_has_filters := (
    (v_search IS NOT NULL AND v_search <> '') OR
    (v_from IS NOT NULL) OR
    (v_to IS NOT NULL) OR
    (v_agent IS NOT NULL) OR
    (v_resolved_by IS NOT NULL) OR
    (v_inbox IS NOT NULL AND v_inbox <> 'all') OR
    (v_platform_id IS NOT NULL)
  );

  -- OPTIMIZATION: If no filters are active, use the pre-calculated summary table
  IF NOT v_has_filters THEN
    RETURN QUERY
    SELECT 
      CASE 
        WHEN status = 'pending' THEN 'assigned'
        WHEN status = 'open' THEN 'unassigned'
        WHEN status = 'closed' THEN 'done'
        ELSE status::text
      END as status_category,
      SUM(count)::BIGINT as total_count
    FROM public.channel_status_counts
    GROUP BY 1;
    RETURN;
  END IF;

  -- DYNAMIC PATH: Query threads directly when filters/search are active
  RETURN QUERY
  SELECT 
    CASE 
      WHEN t.status = 'pending' THEN 'assigned'
      WHEN t.status = 'open' THEN 'unassigned'
      WHEN t.status = 'closed' THEN 'done'
      WHEN t.status = 'assigned' THEN 'assigned' -- backward compatibility
      ELSE t.status::text
    END as status_category,
    COUNT(*)::BIGINT
  FROM public.threads t
  LEFT JOIN public.contacts c ON c.id = t.contact_id
  LEFT JOIN public.channels ch ON ch.id = t.channel_id
  WHERE 
    -- Search filter
    (v_search IS NULL OR v_search = '' OR 
     t.last_message_body ILIKE '%' || v_search || '%' OR 
     c.name ILIKE '%' || v_search || '%')
    
    -- Date Range filter
    AND (v_from IS NULL OR t.last_msg_at >= v_from)
    AND (v_to IS NULL OR t.last_msg_at <= v_to)
    
    -- Agent filter
    AND (v_agent IS NULL OR t.assignee_user_id = v_agent)
    
    -- Resolved By filter
    AND (v_resolved_by IS NULL OR t.resolved_by_user_id = v_resolved_by)
    
    -- Inbox / Platform Provider filter
    AND (v_inbox IS NULL OR v_inbox = 'all' OR ch.provider ILIKE v_inbox)
    
    -- Platform ID filter
    AND (v_platform_id IS NULL OR t.channel_id = v_platform_id)
    
    -- Security: Ensure user only counts threads they have access to 
    -- (This mirrors the RLS logic)
    AND (t.org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  GROUP BY 1;
END;
$$;
