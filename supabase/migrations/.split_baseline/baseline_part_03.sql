

--
-- Name: get_containment_and_handover(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_containment_and_handover(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(total_threads bigint, ai_resolved_count bigint, containment_rate numeric, handover_count bigint, handover_rate numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  )
  , totals as (
    select count(*) as total from scoped
  )
  , ai_resolved as (
    select count(*) as cnt
    from scoped
    where status='closed' and coalesce(assignee_user_id, assigned_by_user_id) is null and resolved_by_user_id is null
  )
  , handover as (
    select count(*) as cnt
    from scoped
    where ai_handoff_at is not null or assignee_user_id is not null or assigned_by_user_id is not null
  )
  select 
    totals.total::bigint,
    ai_resolved.cnt::bigint,
    case when totals.total>0 then (ai_resolved.cnt::numeric / totals.total::numeric) else 0 end as containment_rate,
    handover.cnt::bigint,
    case when totals.total>0 then (handover.cnt::numeric / totals.total::numeric) else 0 end as handover_rate
  from totals, ai_resolved, handover;
$$;


--
-- Name: get_database_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_database_activity() RETURNS TABLE(total_inserts bigint, total_updates bigint, total_deletes bigint, total_sequential_scans bigint, total_index_scans bigint, total_blocks_hit bigint, total_blocks_read bigint, cache_hit_percentage numeric)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    (SELECT SUM(n_tup_ins) FROM pg_stat_user_tables)::bigint as total_inserts,
    (SELECT SUM(n_tup_upd) FROM pg_stat_user_tables)::bigint as total_updates,
    (SELECT SUM(n_tup_del) FROM pg_stat_user_tables)::bigint as total_deletes,
    (SELECT SUM(seq_scan) FROM pg_stat_user_tables)::bigint as total_sequential_scans,
    (SELECT SUM(idx_scan) FROM pg_stat_user_tables)::bigint as total_index_scans,
    (SELECT SUM(heap_blks_hit + idx_blks_hit) FROM pg_statio_user_tables)::bigint as total_blocks_hit,
    (SELECT SUM(heap_blks_read + idx_blks_read) FROM pg_statio_user_tables)::bigint as total_blocks_read,
    CASE 
      WHEN (SELECT SUM(heap_blks_hit + heap_blks_read + idx_blks_hit + idx_blks_read) FROM pg_statio_user_tables) > 0
      THEN (SELECT (SUM(heap_blks_hit + idx_blks_hit)::numeric / NULLIF(SUM(heap_blks_hit + heap_blks_read + idx_blks_hit + idx_blks_read), 0)) * 100 FROM pg_statio_user_tables)
      ELSE 0
    END as cache_hit_percentage;
$$;


--
-- Name: get_database_memory_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_database_memory_stats() RETURNS TABLE(shared_buffers_hit numeric, shared_buffers_read numeric, shared_buffers_hit_ratio numeric, cache_hit_ratio numeric, heap_hit_ratio numeric, idx_scan_ratio numeric, total_sequential_scans bigint, total_index_scans bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    (SELECT SUM(heap_blks_hit) FROM pg_statio_user_tables)::numeric as shared_buffers_hit,
    (SELECT SUM(heap_blks_read) FROM pg_statio_user_tables)::numeric as shared_buffers_read,
    CASE 
      WHEN (SELECT SUM(heap_blks_hit) + SUM(heap_blks_read) FROM pg_statio_user_tables) > 0
      THEN (SELECT SUM(heap_blks_hit)::numeric / (SUM(heap_blks_hit) + SUM(heap_blks_read))::numeric FROM pg_statio_user_tables)
      ELSE 0
    END as shared_buffers_hit_ratio,
    CASE 
      WHEN (SELECT SUM(heap_blks_hit + heap_blks_read + idx_blks_hit + idx_blks_read) FROM pg_statio_user_tables) > 0
      THEN (SELECT SUM(heap_blks_hit + idx_blks_hit)::numeric / SUM(heap_blks_hit + heap_blks_read + idx_blks_hit + idx_blks_read)::numeric FROM pg_statio_user_tables)
      ELSE 0
    END as cache_hit_ratio,
    CASE 
      WHEN (SELECT SUM(heap_blks_hit + heap_blks_read) FROM pg_statio_user_tables) > 0
      THEN (SELECT SUM(heap_blks_hit)::numeric / SUM(heap_blks_hit + heap_blks_read)::numeric FROM pg_statio_user_tables)
      ELSE 0
    END as heap_hit_ratio,
    CASE 
      WHEN (SELECT SUM(seq_scan + idx_scan) FROM pg_stat_user_tables) > 0
      THEN (SELECT SUM(idx_scan)::numeric / SUM(seq_scan + idx_scan)::numeric FROM pg_stat_user_tables)
      ELSE 0
    END as idx_scan_ratio,
    (SELECT SUM(seq_scan) FROM pg_stat_user_tables)::bigint as total_sequential_scans,
    (SELECT SUM(idx_scan) FROM pg_stat_user_tables)::bigint as total_index_scans;
$$;


--
-- Name: get_database_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_database_overview() RETURNS TABLE(total_size_bytes bigint, total_size_pretty text, data_size_bytes bigint, data_size_pretty text, indexes_size_bytes bigint, indexes_size_pretty text, total_tables bigint, total_rows bigint, total_indexes bigint, total_sequences bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    pg_database_size(current_database()) as total_size_bytes,
    pg_size_pretty(pg_database_size(current_database())) as total_size_pretty,
    (SELECT SUM(pg_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public') as data_size_bytes,
    pg_size_pretty((SELECT SUM(pg_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public')) as data_size_pretty,
    (SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public') as indexes_size_bytes,
    pg_size_pretty((SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public')) as indexes_size_pretty,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public')::bigint as total_tables,
    (SELECT SUM(n_live_tup) FROM pg_stat_user_tables WHERE schemaname = 'public')::bigint as total_rows,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public')::bigint as total_indexes,
    (SELECT COUNT(*) FROM pg_sequences WHERE schemaname = 'public')::bigint as total_sequences;
$$;


--
-- Name: get_database_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_database_stats() RETURNS TABLE(tablename text, total_size_bytes bigint, total_size_pretty text, table_size_bytes bigint, table_size_pretty text, indexes_size_bytes bigint, indexes_size_pretty text, row_count bigint, sequential_scans bigint, index_scans bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    pg_total_relation_size('public.' || t.tablename) as total_size_bytes,
    pg_size_pretty(pg_total_relation_size('public.' || t.tablename)) as total_size_pretty,
    pg_relation_size('public.' || t.tablename) as table_size_bytes,
    pg_size_pretty(pg_relation_size('public.' || t.tablename)) as table_size_pretty,
    (pg_total_relation_size('public.' || t.tablename) - pg_relation_size('public.' || t.tablename)) as indexes_size_bytes,
    pg_size_pretty(pg_total_relation_size('public.' || t.tablename) - pg_relation_size('public.' || t.tablename)) as indexes_size_pretty,
    COALESCE(s.n_live_tup, 0)::bigint as row_count,
    COALESCE(s.seq_scan, 0)::bigint as sequential_scans,
    COALESCE(s.idx_scan, 0)::bigint as index_scans
  FROM pg_tables t
  LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.schemaname AND s.relname = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size('public.' || t.tablename) DESC;
END;
$$;


--
-- Name: get_database_stats_detailed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_database_stats_detailed() RETURNS TABLE(tablename text, total_size_bytes bigint, total_size_pretty text, table_size_bytes bigint, table_size_pretty text, indexes_size_bytes bigint, indexes_size_pretty text, row_count bigint, dead_rows bigint, sequential_scans bigint, index_scans bigint, table_scan_ratio numeric, last_vacuum timestamp with time zone, last_autovacuum timestamp with time zone, last_analyze timestamp with time zone, last_autoanalyze timestamp with time zone, inserts bigint, updates bigint, deletes bigint, hot_updates bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    pg_total_relation_size('public.' || t.tablename) as total_size_bytes,
    pg_size_pretty(pg_total_relation_size('public.' || t.tablename)) as total_size_pretty,
    pg_relation_size('public.' || t.tablename) as table_size_bytes,
    pg_size_pretty(pg_relation_size('public.' || t.tablename)) as table_size_pretty,
    (pg_total_relation_size('public.' || t.tablename) - pg_relation_size('public.' || t.tablename)) as indexes_size_bytes,
    pg_size_pretty(pg_total_relation_size('public.' || t.tablename) - pg_relation_size('public.' || t.tablename)) as indexes_size_pretty,
    COALESCE(s.n_live_tup, 0)::bigint as row_count,
    COALESCE(s.n_dead_tup, 0)::bigint as dead_rows,
    COALESCE(s.seq_scan, 0)::bigint as sequential_scans,
    COALESCE(s.idx_scan, 0)::bigint as index_scans,
    CASE 
      WHEN (COALESCE(s.seq_scan, 0) + COALESCE(s.idx_scan, 0)) > 0 
      THEN (COALESCE(s.seq_scan, 0)::numeric / (COALESCE(s.seq_scan, 0) + COALESCE(s.idx_scan, 0))::numeric)
      ELSE 0 
    END as table_scan_ratio,
    s.last_vacuum,
    s.last_autovacuum,
    s.last_analyze,
    s.last_autoanalyze,
    COALESCE(s.n_tup_ins, 0)::bigint as inserts,
    COALESCE(s.n_tup_upd, 0)::bigint as updates,
    COALESCE(s.n_tup_del, 0)::bigint as deletes,
    COALESCE(s.n_tup_hot_upd, 0)::bigint as hot_updates
  FROM pg_tables t
  LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.schemaname AND s.relname = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size('public.' || t.tablename) DESC;
END;
$$;


--
-- Name: get_database_total_size(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_database_total_size() RETURNS TABLE(total_size_bytes bigint, total_size_pretty text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    pg_database_size(current_database()) as total_size_bytes,
    pg_size_pretty(pg_database_size(current_database())) as total_size_pretty;
$$;


--
-- Name: get_handover_by_agent(timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_handover_by_agent(p_from timestamp with time zone, p_to timestamp with time zone, p_super_agent_id uuid DEFAULT NULL::uuid) RETURNS TABLE(agent_user_id uuid, agent_name text, super_agent_id uuid, human_resolved bigint, ai_resolved bigint, handover_rate numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ),
  totals as (
    select count(*)::bigint as total from scoped
  ),
  human_threads as (
    select t.*
    from scoped t
    where (t.ai_handoff_at is not null or t.assignee_user_id is not null or t.assigned_by_user_id is not null)
  ),
  humans as (
    select coalesce(t.assignee_user_id, tc.user_id) as agent_user_id,
           coalesce(sam.super_agent_id, t.assignee_user_id) as super_agent_id,
           count(distinct t.id)::bigint as human_count
    from human_threads t
    left join public.thread_collaborators tc on tc.thread_id = t.id
    left join public.super_agent_members sam on sam.agent_user_id = coalesce(t.assignee_user_id, tc.user_id)
    group by 1,2
  ),
  humans_total as (
    select coalesce(sum(h.human_count),0)::bigint as human_total from humans h
  )
  select h.agent_user_id,
         up.display_name as agent_name,
         h.super_agent_id,
         h.human_count as human_resolved,
         (tot.total - ht.human_total) as ai_resolved,
         case when tot.total>0 then (h.human_count::numeric / tot.total::numeric) else 0 end as handover_rate
  from humans h
  cross join totals tot
  cross join humans_total ht
  left join public.users_profile up on up.user_id = h.agent_user_id
  where (p_super_agent_id is null or h.super_agent_id = p_super_agent_id);
$$;