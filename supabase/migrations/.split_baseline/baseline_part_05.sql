

--
-- Name: is_master_agent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_master_agent() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'master_agent'
  );
$$;


--
-- Name: is_master_agent_in_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_master_agent_in_org(target_org uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.org_members om on om.user_id = ur.user_id and om.org_id = target_org
    where ur.user_id = auth.uid() and r.name = 'master_agent'
  );
$$;


--
-- Name: is_regular_agent_for_channel(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_regular_agent_for_channel(target_org uuid, target_channel uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  with ch as (
    select c.super_agent_id
    from public.channels c
    where c.id = target_channel
      and c.org_id = target_org
      and c.super_agent_id is not null
  )
  select exists (
    select 1
    from ch
    join public.super_agent_members sam
      on sam.org_id = target_org
     and sam.agent_user_id = auth.uid()
     and sam.super_agent_id = ch.super_agent_id
  );
$$;


--
-- Name: is_super_agent_for_channel(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_agent_for_channel(target_org uuid, target_channel uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.channels c
    join public.org_members om
      on om.org_id = c.org_id and om.user_id = auth.uid()
    join public.user_roles ur
      on ur.user_id = auth.uid()
    join public.roles r
      on r.id = ur.role_id and r.name = 'super_agent'
    where c.id = target_channel
      and c.org_id = target_org
      and c.super_agent_id = auth.uid()       -- ownership by column
  );
$$;


--
-- Name: jakarta_day_start_utc(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.jakarta_day_start_utc(p_now timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE v timestamptz;
BEGIN
  v := date_trunc('day', (p_now + interval '7 hours')) - interval '7 hours';
  return v;
END$$;


--
-- Name: jakarta_month_start_utc(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.jakarta_month_start_utc(p_now timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE v timestamptz;
BEGIN
  v := date_trunc('month', (p_now + interval '7 hours')) - interval '7 hours';
  return v;
END$$;


--
-- Name: log_action(text, text, text, jsonb, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_action(p_action text, p_resource text, p_resource_id text DEFAULT NULL::text, p_context jsonb DEFAULT '{}'::jsonb, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_org_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid;
  v_org uuid;
begin
  -- Use provided user id or current auth uid
  v_user := p_user_id;
  if v_user is null then
    v_user := auth.uid();
  end if;

  -- Resolve org id from param or from user's first org membership
  v_org := p_org_id;
  if v_org is null then
    select org_id into v_org
    from public.org_members
    where user_id = v_user
    order by created_at asc
    limit 1;
  end if;

  insert into public.audit_logs (org_id, user_id, action, resource, resource_id, context, ip, user_agent)
  values (v_org, p_user_id, p_action, p_resource, p_resource_id, coalesce(p_context, '{}'::jsonb), p_ip, p_user_agent);
end;
$$;


--
-- Name: match_documents(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_documents(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: path_channel_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.path_channel_id(name text) RETURNS uuid
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(split_part(name,'/',2),'')::uuid
$$;


--
-- Name: path_org_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.path_org_id(name text) RETURNS uuid
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(split_part(name,'/',1),'')::uuid
$$;


--
-- Name: refresh_daily_monthly_tokens(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_daily_monthly_tokens() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE v_now timestamptz := now();
DECLARE v_day_start timestamptz := public.jakarta_day_start_utc(v_now);
DECLARE v_month_start timestamptz := public.jakarta_month_start_utc(v_now);
BEGIN
  WITH cluster AS (
    SELECT super_agent_id, agent_user_id FROM public.super_agent_members
  ), super_ids AS (
    SELECT DISTINCT super_agent_id FROM public.super_agent_members
    UNION
    SELECT DISTINCT super_agent_id FROM public.channels WHERE super_agent_id IS NOT NULL
  ), logs AS (
    SELECT DISTINCT l.id,
           COALESCE(ch.super_agent_id, c1.super_agent_id, c2.super_agent_id, si.super_agent_id) AS super_agent_id,
           l.total_tokens, l.made_at
    FROM public.token_usage_logs l
    LEFT JOIN public.threads th   ON th.id = l.thread_id
    LEFT JOIN public.channels ch  ON ch.id = th.channel_id
    LEFT JOIN cluster c1 ON c1.agent_user_id = l.user_id
    LEFT JOIN cluster c2 ON c2.agent_user_id = th.assignee_user_id
    LEFT JOIN super_ids si ON si.super_agent_id = l.user_id
    WHERE COALESCE(ch.super_agent_id, c1.super_agent_id, c2.super_agent_id, si.super_agent_id) IS NOT NULL
  ), agg_day AS (
    SELECT super_agent_id, SUM(total_tokens) AS tokens
    FROM logs WHERE made_at >= v_day_start
    GROUP BY super_agent_id
  ), agg_month AS (
    SELECT super_agent_id, SUM(total_tokens) AS tokens
    FROM logs WHERE made_at >= v_month_start
    GROUP BY super_agent_id
  )
  UPDATE public.users_profile up
  SET daily_used_tokens = COALESCE(d.tokens, 0),
      monthly_used_tokens = COALESCE(m.tokens, 0),
      daily_reset_at = v_day_start,
      monthly_reset_at = v_month_start
  FROM agg_day d
  FULL OUTER JOIN agg_month m ON m.super_agent_id = d.super_agent_id
  WHERE up.user_id = COALESCE(d.super_agent_id, m.super_agent_id);
END
$$;


--
-- Name: refresh_used_tokens_for_super_agents(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_used_tokens_for_super_agents(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  with cluster as (
    select super_agent_id, agent_user_id from public.super_agent_members
  ), super_ids as (
    select distinct super_agent_id from public.super_agent_members
    union
    select distinct super_agent_id from public.channels where super_agent_id is not null
  ), logs as (
    select distinct l.id,
           coalesce(ch.super_agent_id, c1.super_agent_id, c2.super_agent_id, si.super_agent_id) as super_agent_id,
           l.total_tokens, l.made_at
    from public.token_usage_logs l
    left join public.threads th on th.id = l.thread_id
    left join public.channels ch on ch.id = th.channel_id
    left join cluster c1 on c1.agent_user_id = l.user_id
    left join cluster c2 on c2.agent_user_id = th.assignee_user_id
    left join super_ids si on si.super_agent_id = l.user_id
    where (p_from is null or l.made_at >= p_from)
      and (p_to   is null or l.made_at <  p_to)
      and coalesce(ch.super_agent_id, c1.super_agent_id, c2.super_agent_id, si.super_agent_id) is not null
  ), totals as (
    select super_agent_id, sum(total_tokens) as tokens from logs group by super_agent_id
  )
  update public.users_profile up
  set used_tokens = coalesce(t.tokens, 0)
  from totals t
  where up.user_id = t.super_agent_id;
end
$$;


--
-- Name: reopen_thread_on_user_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reopen_thread_on_user_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Only react to inbound/user messages
  if (new.role = 'user' or new.direction = 'in') then
    update public.threads
       set status = 'open',
           resolved_at = null,
           resolved_by_user_id = null,
           assignee_user_id = null,
           assigned_at = null,
           assigned_by_user_id = null
     where id = new.thread_id
       and status = 'closed';
  end if;
  return new;
end
$$;


--
-- Name: revoke_role_bundle(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_role_bundle(p_role uuid, p_bundle uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  delete from public.role_bundles where role_id = p_role and bundle_id = p_bundle;
end;
$$;


--
-- Name: revoke_role_permission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_role_permission(p_role uuid, p_perm uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_master_agent() then raise exception 'insufficient_privilege'; end if;
  delete from public.role_permissions where role_id = p_role and permission_id = p_perm;
end;
$$;


--
-- Name: schedule_auto_resolve_for_open_threads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_auto_resolve_for_open_threads() RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with last_msg as (
    select m.thread_id, m.created_at, m.role
    from public.messages m
    join (
      select thread_id, max(created_at) as max_created_at
      from public.messages
      group by thread_id
    ) mm on mm.thread_id = m.thread_id and m.created_at = mm.max_created_at
  ),
  candidates as (
    select t.id as thread_id,
           (lm.created_at + make_interval(mins => p.auto_resolve_after_minutes)) as next_at
    from public.threads t
    join public.channels c on c.id = t.channel_id
    left join public.ai_profiles p on p.id = c.ai_profile_id
    join last_msg lm on lm.thread_id = t.id
    where t.status <> 'closed'
      and lm.role in ('agent','assistant')
      and coalesce(p.enable_resolve, false) = true
      and coalesce(p.auto_resolve_after_minutes, 0) > 0
  )
  update public.threads t
     set auto_resolve_at = c.next_at
   from candidates c
  where t.id = c.thread_id
    and (t.auto_resolve_at is null or t.auto_resolve_at <> c.next_at)
  returning 1
$$;


--
-- Name: set_ai_handoff_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_ai_handoff_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.assignee_user_id IS NOT NULL AND OLD.assignee_user_id IS NULL AND NEW.ai_handoff_at IS NULL THEN
    NEW.ai_handoff_at := now();
  END IF;
  RETURN NEW;
END;
$$;