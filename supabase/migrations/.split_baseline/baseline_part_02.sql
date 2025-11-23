

--
-- Name: cleanup_old_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_metrics() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DELETE FROM public.circuit_breaker_metrics
  WHERE created_at < now() - INTERVAL '30 days';
$$;


--
-- Name: create_email_2fa_challenge(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_email_2fa_challenge(p_user uuid, p_ttl_seconds integer DEFAULT 600) RETURNS TABLE(challenge_id uuid, code_plain text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$declare
  v_code text;
  v_hash text;
  v_id uuid;
  v_expires timestamptz := now() + make_interval(secs => p_ttl_seconds);
begin
  -- OPTIONAL rate-limit: refuse if one was sent in the last 30s
  if exists (
    select 1
    from public.twofa_challenges
    where user_id = p_user
      and sent_at > now() - interval '30 seconds'
      and consumed_at is null
  ) then
    raise exception 'Please wait before requesting another code' using errcode = 'P0001';
  end if;

  -- Generate a 6-digit code
  v_code := lpad((floor(random()*1000000))::int::text, 6, '0');
  v_hash := crypt(v_code, gen_salt('bf'));

  insert into public.twofa_challenges (user_id, code_hash, expires_at, channel)
  values (p_user, v_hash, v_expires, 'email')
  returning id into v_id;

  challenge_id := v_id;
  code_plain   := v_code;
  return next;
end;$$;


--
-- Name: delete_auth_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_auth_user(user_uuid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_uuid;
END;
$$;


--
-- Name: enforce_handover_reason(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_handover_reason() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  became_handover boolean := false;
begin
  if TG_OP = 'INSERT' then
    became_handover := (new.ai_handoff_at is not null) or (new.assignee_user_id is not null) or (new.assigned_by_user_id is not null);
  else
    became_handover := (
      (new.ai_handoff_at is not null and (old.ai_handoff_at is null or new.ai_handoff_at <> old.ai_handoff_at)) or
      (new.assignee_user_id is not null and new.assignee_user_id is distinct from old.assignee_user_id) or
      (new.assigned_by_user_id is not null and new.assigned_by_user_id is distinct from old.assigned_by_user_id)
    );
  end if;

  if became_handover and (new.handover_reason is null or length(trim(new.handover_reason)) = 0) then
    raise exception 'handover_reason is required when a handover occurs';
  end if;
  return new;
end;
$$;


--
-- Name: gdpr_delete_user_data(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gdpr_delete_user_data(p_contact_id uuid, p_org_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_contact_id uuid := p_contact_id;
  v_deleted_threads integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_contact integer := 0;
  v_result jsonb;
begin
  -- Verify org_id matches if provided
  if p_org_id is not null then
    v_org_id := p_org_id;
    
    -- Verify contact belongs to org
    if not exists (
      select 1 from public.contacts
      where id = v_contact_id and org_id = v_org_id
    ) then
      raise exception 'Contact not found in specified organization';
    end if;
  else
    -- Get org_id from contact
    select org_id into v_org_id
    from public.contacts
    where id = v_contact_id;
    
    if v_org_id is null then
      raise exception 'Contact not found';
    end if;
  end if;
  
  -- Delete all messages for threads belonging to this contact
  with deleted as (
    delete from public.messages m
    using public.threads t
    where m.thread_id = t.id
      and t.contact_id = v_contact_id
      and t.org_id = v_org_id
    returning m.id
  )
  select count(*) into v_deleted_messages from deleted;
  
  -- Delete all threads for this contact
  with deleted as (
    delete from public.threads
    where contact_id = v_contact_id
      and org_id = v_org_id
    returning id
  )
  select count(*) into v_deleted_threads from deleted;
  
  -- Delete the contact itself
  with deleted as (
    delete from public.contacts
    where id = v_contact_id
      and org_id = v_org_id
    returning id
  )
  select count(*) into v_deleted_contact from deleted;
  
  v_result := jsonb_build_object(
    'contact_id', v_contact_id,
    'org_id', v_org_id,
    'threads_deleted', v_deleted_threads,
    'messages_deleted', v_deleted_messages,
    'contact_deleted', v_deleted_contact,
    'success', true
  );
  
  return v_result;
end $$;


--
-- Name: FUNCTION gdpr_delete_user_data(p_contact_id uuid, p_org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.gdpr_delete_user_data(p_contact_id uuid, p_org_id uuid) IS 'GDPR/PDPA compliant deletion of all user data for a specific contact. Deletes all threads, messages, and the contact record.';


--
-- Name: get_agent_kpis(timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_agent_kpis(p_from timestamp with time zone, p_to timestamp with time zone, p_super_agent_id uuid DEFAULT NULL::uuid) RETURNS TABLE(agent_user_id uuid, agent_name text, resolved_count bigint, avg_resolution_minutes numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ), agents as (
    select t.id, t.resolved_by_user_id, t.assignee_user_id, t.assigned_at, t.resolved_at
    from scoped t
    where t.resolved_by_user_id is not null
  ), clusters as (
    select a.*, sam.super_agent_id
    from agents a
    left join public.super_agent_members sam on sam.agent_user_id = a.resolved_by_user_id
  )
  select a.resolved_by_user_id as agent_user_id,
         up.display_name as agent_name,
         count(*)::bigint as resolved_count,
         avg(extract(epoch from (a.resolved_at - a.assigned_at)) / 60.0) as avg_resolution_minutes
  from clusters a
  left join public.users_profile up on up.user_id = a.resolved_by_user_id
  where (p_super_agent_id is null or a.super_agent_id = p_super_agent_id)
  group by a.resolved_by_user_id, up.display_name;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource text NOT NULL,
    resource_id text,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: get_audit_logs(uuid, text, timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_audit_logs(p_user_id uuid DEFAULT NULL::uuid, p_action text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS SETOF public.audit_logs
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_master boolean;
begin
  -- Only master_agent can read org-wide; others restricted to own user_id
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'master_agent'
  ) into v_is_master;

  return query
  select * from public.audit_logs l
  where
    (case when v_is_master then true else l.user_id = auth.uid() end)
    and (p_user_id is null or l.user_id = p_user_id)
    and (p_action is null or l.action = p_action)
    and (p_from is null or l.created_at >= p_from)
    and (p_to is null or l.created_at < p_to)
  order by l.created_at desc
  limit greatest(0, least(p_limit, 500)) offset greatest(0, p_offset);
end;
$$;


--
-- Name: get_channel_chat_counts(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_channel_chat_counts(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(channel_id uuid, provider text, display_name text, thread_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select ch.id as channel_id,
         ch.provider::text as provider,
         ch.display_name,
         count(t.*) as thread_count
  from public.threads t
  join public.channels ch on ch.id = t.channel_id
  where t.created_at >= p_from and t.created_at < p_to
    and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  group by ch.id, ch.provider, ch.display_name
  order by thread_count desc;
$$;


--
-- Name: get_chats_timeseries(timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chats_timeseries(p_from timestamp with time zone, p_to timestamp with time zone, p_channel text DEFAULT NULL::text) RETURNS TABLE(bucket timestamp with time zone, provider text, count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scoped as (
    select t.created_at, ch.provider
    from public.threads t
    join public.channels ch on ch.id = t.channel_id
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
      and (p_channel is null or ch.provider::text = p_channel)
  )
  select (date_trunc('day', created_at at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta' as bucket,
         provider::text,
         count(*)::bigint
  from scoped
  group by 1,2
  order by 1 asc, 2 asc;
$$;


--
-- Name: get_containment(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_containment(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(total_threads bigint, ai_resolved_count bigint, rate numeric, prev_total_threads bigint, prev_ai_resolved_count bigint, prev_rate numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_len interval;
begin
  v_len := (p_to - p_from);

  return query
  with scoped as (
    select * from public.threads t
    where t.created_at >= p_from and t.created_at < p_to
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ), totals as (
    select count(*)::bigint as total from scoped
  ), ai as (
    select count(*)::bigint as cnt from scoped
    where coalesce(resolution,'') = 'AI'
  ), prev_scoped as (
    select * from public.threads t
    where t.created_at >= (p_from - v_len) and t.created_at < p_from
      and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
  ), prev_totals as (
    select count(*)::bigint as total from prev_scoped
  ), prev_ai as (
    select count(*)::bigint as cnt from prev_scoped
    where coalesce(resolution,'') = 'AI'
  )
  select totals.total,
         ai.cnt,
         case when totals.total>0 then (ai.cnt::numeric / totals.total::numeric) else 0 end,
         prev_totals.total,
         prev_ai.cnt,
         case when prev_totals.total>0 then (prev_ai.cnt::numeric / prev_totals.total::numeric) else 0 end
  from totals, ai, prev_totals, prev_ai;
end;
$$;