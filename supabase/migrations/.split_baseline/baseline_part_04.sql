

--
-- Name: get_handover_by_super_agent(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_handover_by_super_agent(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(super_agent_id uuid, super_agent_name text, human_resolved bigint, ai_resolved bigint, handover_rate numeric)
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
    select coalesce(sam.super_agent_id, t.assignee_user_id, t.assigned_by_user_id) as super_agent_id,
           count(distinct t.id)::bigint as human_count
    from human_threads t
    left join public.thread_collaborators tc on tc.thread_id = t.id
    left join public.super_agent_members sam on sam.agent_user_id = coalesce(t.assignee_user_id, t.assigned_by_user_id, tc.user_id)
    group by 1
  ),
  humans_total as (
    select coalesce(sum(h.human_count),0)::bigint as human_total from humans h
  )
  select h.super_agent_id,
         up.display_name as super_agent_name,
         h.human_count as human_resolved,
         (tot.total - ht.human_total) as ai_resolved,
         case when tot.total>0 then (h.human_count::numeric / tot.total::numeric) else 0 end as handover_rate
  from humans h
  cross join totals tot
  cross join humans_total ht
  left join public.users_profile up on up.user_id = h.super_agent_id;
$$;


--
-- Name: get_handover_stats(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_handover_stats(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(reason text, count bigint, total bigint, rate numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ),
  total as (
    select count(*)::bigint as total from scoped
  ),
  handovers as (
    select coalesce(handover_reason,'(unspecified)') as reason, count(*)::bigint as cnt
    from scoped
    where (ai_handoff_at is not null or assignee_user_id is not null or assigned_by_user_id is not null)
    group by coalesce(handover_reason,'(unspecified)')
  )
  select h.reason, h.cnt, t.total,
    case when t.total>0 then h.cnt::numeric / t.total::numeric else 0 end as rate
  from handovers h cross join total t;
$$;


--
-- Name: get_index_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_index_stats() RETURNS TABLE(tablename text, indexname text, index_size_bytes bigint, index_size_pretty text, index_scans bigint, index_tup_reads bigint, index_tup_fetches bigint, idx_blks_hit bigint, idx_blks_read bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    t.tablename::text,
    i.indexname::text,
    pg_relation_size(i.schemaname||'.'||i.indexname) as index_size_bytes,
    pg_size_pretty(pg_relation_size(i.schemaname||'.'||i.indexname)) as index_size_pretty,
    COALESCE(ix.idx_scan, 0)::bigint as index_scans,
    COALESCE(ix.idx_tup_read, 0)::bigint as index_tup_reads,
    COALESCE(ix.idx_tup_fetch, 0)::bigint as index_tup_fetches,
    COALESCE(iox.idx_blks_hit, 0)::bigint as idx_blks_hit,
    COALESCE(iox.idx_blks_read, 0)::bigint as idx_blks_read
  FROM pg_indexes i
  JOIN pg_tables t ON t.tablename = i.tablename AND t.schemaname = i.schemaname
  LEFT JOIN pg_stat_user_indexes ix ON ix.schemaname = i.schemaname AND ix.indexrelname = i.indexname
  LEFT JOIN pg_statio_user_indexes iox ON iox.schemaname = i.schemaname AND iox.indexrelname = i.indexname
  WHERE i.schemaname = 'public'
  ORDER BY pg_relation_size(i.schemaname||'.'||i.indexname) DESC;
$$;


--
-- Name: get_non_contained(timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_non_contained(p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, created_at timestamp with time zone, contact_name text, handover_reason text, status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select t.id,
         t.created_at,
         coalesce(c.name,'Unknown Contact') as contact_name,
         t.handover_reason,
         t.status::text
  from public.threads t
  left join public.contacts c on c.id = t.contact_id
  where t.created_at >= p_from and t.created_at < p_to
    and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
    and coalesce(t.resolution,'') <> 'AI'
  order by t.created_at desc
  limit greatest(0, least(p_limit, 500)) offset greatest(0, p_offset);
$$;


--
-- Name: get_response_time_stats(timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_response_time_stats(p_from timestamp with time zone, p_to timestamp with time zone, p_channel text DEFAULT NULL::text) RETURNS TABLE(ai_avg numeric, ai_median numeric, ai_p90 numeric, agent_avg numeric, agent_median numeric, agent_p90 numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with msgs as (
    select m.*, ch.provider
    from public.messages m
    join public.threads t on t.id = m.thread_id
    join public.channels ch on ch.id = t.channel_id
    where m.created_at >= p_from and m.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
      and (p_channel is null or ch.provider::text = p_channel)
  ),
  inbound as (
    select id, thread_id, created_at, provider
    from msgs
    where role='user' and direction='in'
  ),
  ai_pairs as (
    select i.created_at as in_at,
           (select m2.created_at from msgs m2 where m2.thread_id=i.thread_id and m2.created_at>i.created_at and m2.role='assistant' order by m2.created_at asc limit 1) as out_at
    from inbound i
  ),
  agent_pairs as (
    select i.created_at as in_at,
           (select m2.created_at from msgs m2 where m2.thread_id=i.thread_id and m2.created_at>i.created_at and m2.role='agent' order by m2.created_at asc limit 1) as out_at
    from inbound i
  ),
  ai_secs as (
    select extract(epoch from (out_at - in_at)) as sec from ai_pairs where out_at is not null and out_at>=in_at
  ),
  agent_secs as (
    select extract(epoch from (out_at - in_at)) as sec from agent_pairs where out_at is not null and out_at>=in_at
  )
  select
    coalesce(avg(ai_secs.sec),0),
    coalesce(percentile_cont(0.5) within group(order by ai_secs.sec),0),
    coalesce(percentile_cont(0.9) within group(order by ai_secs.sec),0),
    coalesce(avg(agent_secs.sec),0),
    coalesce(percentile_cont(0.5) within group(order by agent_secs.sec),0),
    coalesce(percentile_cont(0.9) within group(order by agent_secs.sec),0)
  from ai_secs, agent_secs;
$$;


--
-- Name: get_response_times(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_response_times(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(ai_avg_seconds numeric, agent_avg_seconds numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare ai_avg numeric; agent_avg numeric;
begin
  -- AI responses: first assistant message after each inbound user message
  with base_in as (
    select m.id, m.thread_id, m.created_at
    from public.messages m
    where m.role = 'user' and m.direction = 'in'
      and m.created_at >= p_from and m.created_at < p_to
      and m.thread_id in (
        select id from public.threads where org_id in (
          select org_id from public.org_members where user_id = auth.uid()
        )
      )
  ), ai_pairs as (
    select b.created_at as in_at,
           (select m2.created_at from public.messages m2 where m2.thread_id=b.thread_id and m2.created_at>b.created_at and m2.role='assistant' order by m2.created_at asc limit 1) as out_at
    from base_in b
  ), agent_pairs as (
    select b.created_at as in_at,
           (select m2.created_at from public.messages m2 where m2.thread_id=b.thread_id and m2.created_at>b.created_at and m2.role='agent' order by m2.created_at asc limit 1) as out_at
    from base_in b
  )
  select avg(extract(epoch from (out_at - in_at))) into ai_avg from ai_pairs where out_at is not null;
  select avg(extract(epoch from (out_at - in_at))) into agent_avg from agent_pairs where out_at is not null;

  return query select coalesce(ai_avg,0)::numeric, coalesce(agent_avg,0)::numeric;
end;
$$;


--
-- Name: grant_role_bundle(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_role_bundle(p_role uuid, p_bundle uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  insert into public.role_bundles(role_id, bundle_id)
  values (p_role, p_bundle)
  on conflict do nothing;
end;
$$;


--
-- Name: grant_role_permission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_role_permission(p_role uuid, p_perm uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  insert into public.role_permissions(role_id, permission_id)
  values (p_role, p_perm)
  on conflict do nothing;
end;
$$;


--
-- Name: handle_user_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_user_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.users_profile WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: has_active_2fa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_active_2fa() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.twofa_sessions s
    where s.user_id = (select auth.uid())
      and s.expires_at > now()
  );
$$;


--
-- Name: has_perm(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_perm(p_action text, p_resource text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.action   = p_action
      and p.resource = p_resource
  );
$$;


--
-- Name: invite_ttl_seconds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_ttl_seconds() RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  -- 24 hours; change if your dashboard expiry differs
  select 24*60*60
$$;


--
-- Name: is_current_user_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_current_user_active() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  user_is_active boolean;
begin
  -- Check if the current user has an active profile
  select is_active into user_is_active
  from public.users_profile
  where user_id = auth.uid();
  
  -- Return true if user is active, false if deactivated or no profile
  return coalesce(user_is_active, false);
end;
$$;