--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: channel_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_type AS ENUM (
    'whatsapp',
    'web',
    'telegram'
);


--
-- Name: label_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.label_scope AS ENUM (
    'contact',
    'thread'
);


--
-- Name: message_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_direction AS ENUM (
    'in',
    'out'
);


--
-- Name: message_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_role AS ENUM (
    'user',
    'assistant',
    'agent',
    'system'
);


--
-- Name: message_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_type AS ENUM (
    'text',
    'image',
    'file',
    'voice',
    'event',
    'note'
);


--
-- Name: thread_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.thread_status AS ENUM (
    'open',
    'pending',
    'closed'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'agent',
    'supervisor',
    'super_agent'
);


--
-- Name: add_default_collaborators(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_default_collaborators() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_super uuid;
BEGIN
  IF new.assignee_user_id IS NOT NULL THEN
    INSERT INTO public.thread_collaborators(thread_id, user_id)
    VALUES (new.id, new.assignee_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Try to resolve super agent
  BEGIN
    SELECT (new.additional_data->>'super_agent_id')::uuid INTO v_super;
    IF v_super IS NULL THEN
      SELECT (ch.credentials->>'super_agent_id')::uuid INTO v_super FROM public.channels ch WHERE ch.id = new.channel_id;
    END IF;
    IF v_super IS NOT NULL THEN
      INSERT INTO public.thread_collaborators(thread_id, user_id)
      VALUES (new.id, v_super)
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;


--
-- Name: after_token_log_refresh_daily_monthly(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_token_log_refresh_daily_monthly() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM public.refresh_daily_monthly_tokens();
  RETURN NULL;
END $$;


--
-- Name: after_token_log_refresh_used_tokens(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_token_log_refresh_used_tokens() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform public.refresh_used_tokens_for_super_agents(null, null);
  return null;
end $$;


--
-- Name: auto_close_due_threads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_close_due_threads() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  update public.threads t
     set status = 'closed',
         resolved_at = now()
   where t.auto_resolve_at is not null
     and t.auto_resolve_at <= now()
     and t.status is distinct from 'closed';

  get diagnostics v_count = row_count;
  return v_count;
end $$;


--
-- Name: auto_resolve_threads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_resolve_threads() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update threads that should be auto-resolved
  UPDATE public.threads 
  SET 
    status = 'resolved',
    resolved_at = now(),
    resolved_by_user_id = null, -- Auto-resolved by system
    end_reason = 'auto_resolve'
  WHERE 
    status = 'open'
    AND ai_access_enabled = true
    AND auto_resolve_at IS NOT NULL
    AND auto_resolve_at <= now()
    AND EXISTS (
      SELECT 1 
      FROM public.channels ch
      JOIN public.ai_profiles ap ON ap.id = ch.ai_profile_id
      WHERE ch.id = threads.channel_id
        AND ap.enable_resolve = true
        AND ap.auto_resolve_after_minutes > 0
    );
END;
$$;


--
-- Name: can_read_thread(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_thread(p_thread_id uuid) RETURNS boolean
    LANGUAGE sql
    AS $$
  with me as (
    select auth.uid() as uid
  ),
  my_roles as (
    select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select uid from me)
  )
  select exists (
    select 1 from my_roles where name = 'master_agent'
  )
  or exists (
    select 1 from public.thread_collaborators tc where tc.thread_id = p_thread_id and tc.user_id = (select uid from me)
  )
  or exists (
    select 1
    from public.threads t
    left join public.channels ch on ch.id = t.channel_id
    left join public.super_agent_members sam on sam.org_id = t.org_id and sam.super_agent_id = (select uid from me)
    where t.id = p_thread_id
      and (
        sam.agent_user_id is not null
        or (ch.super_agent_id = (select uid from me))
      )
  );
$$;


--
-- Name: cancel_auto_resolve_on_user_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_auto_resolve_on_user_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If this is a user message (direction = 'in'), cancel auto-resolve
  IF NEW.direction = 'in' THEN
    UPDATE public.threads 
    SET auto_resolve_at = null
    WHERE id = NEW.thread_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_and_auto_resolve_threads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_auto_resolve_threads() RETURNS TABLE(resolved_thread_id uuid, thread_contact_name text, auto_resolve_reason text)
    LANGUAGE plpgsql
    AS $$
DECLARE
  thread_record RECORD;
BEGIN
  -- Find threads that should be auto-resolved
  FOR thread_record IN
    SELECT 
      t.id,
      t.contact_id,
      c.name as contact_name,
      ap.auto_resolve_after_minutes,
      t.auto_resolve_at
    FROM public.threads t
    JOIN public.channels ch ON ch.id = t.channel_id
    JOIN public.ai_profiles ap ON ap.id = ch.ai_profile_id
    JOIN public.contacts c ON c.id = t.contact_id
    WHERE 
      t.status = 'open'
      AND t.ai_access_enabled = true
      AND ap.enable_resolve = true
      AND ap.auto_resolve_after_minutes > 0
      AND t.auto_resolve_at IS NOT NULL
      AND t.auto_resolve_at <= now()
  LOOP
    -- Auto-resolve this thread (use 'closed' instead of 'resolved')
    UPDATE public.threads 
    SET 
      status = 'closed',
      resolved_at = now(),
      resolved_by_user_id = null,
      end_reason = 'auto_resolve',
      resolution = 'Conversation auto-resolved after ' || thread_record.auto_resolve_after_minutes || ' minutes of inactivity'
    WHERE id = thread_record.id;
    
    -- Return the resolved thread info
    resolved_thread_id := thread_record.id;
    thread_contact_name := thread_record.contact_name;
    auto_resolve_reason := 'Auto-resolved after ' || thread_record.auto_resolve_after_minutes || ' minutes of inactivity';
    RETURN NEXT;
  END LOOP;
END;
$$;


--
-- Name: cleanup_old_chat_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_chat_data(p_org_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_retention_days integer;
  v_cutoff_date timestamptz;
  v_deleted_threads integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_contacts integer := 0;
  v_org_count integer := 0;
  v_result jsonb;
begin
  -- If org_id provided, clean only that org; otherwise clean all orgs
  if p_org_id is not null then
    v_org_id := p_org_id;
    
    -- Get retention days for this org (default 90 if not set)
    select coalesce(retention_days, 90)
    into v_retention_days
    from org_settings
    where org_id = v_org_id;
    
    if v_retention_days is null then
      v_retention_days := 90;
    end if;
    
    v_cutoff_date := now() - make_interval(days => v_retention_days);
    
    -- Delete old messages first (due to foreign key)
    with deleted as (
      delete from public.messages m
      using public.threads t
      where m.thread_id = t.id
        and t.org_id = v_org_id
        and t.created_at < v_cutoff_date
      returning m.id
    )
    select count(*) into v_deleted_messages from deleted;
    
    -- Delete old threads
    with deleted as (
      delete from public.threads
      where org_id = v_org_id
        and created_at < v_cutoff_date
      returning id
    )
    select count(*) into v_deleted_threads from deleted;
    
    -- Delete orphaned contacts (no threads referencing them)
    -- Only delete if they're older than retention period
    with deleted as (
      delete from public.contacts c
      where c.org_id = v_org_id
        and c.created_at < v_cutoff_date
        and not exists (
          select 1 from public.threads t
          where t.contact_id = c.id
        )
      returning c.id
    )
    select count(*) into v_deleted_contacts from deleted;
    
    v_org_count := 1;
    
  else
    -- Process all orgs
    for v_org_id, v_retention_days in
      select os.org_id, coalesce(os.retention_days, 90)
      from org_settings os
    loop
      v_cutoff_date := now() - make_interval(days => v_retention_days);
      
      -- Delete messages
      with deleted as (
        delete from public.messages m
        using public.threads t
        where m.thread_id = t.id
          and t.org_id = v_org_id
          and t.created_at < v_cutoff_date
        returning m.id
      )
      select count(*) into v_deleted_messages from deleted;
      
      -- Delete threads
      with deleted as (
        delete from public.threads
        where org_id = v_org_id
          and created_at < v_cutoff_date
        returning id
      )
      select count(*) into v_deleted_threads from deleted;
      
      -- Delete orphaned contacts
      with deleted as (
        delete from public.contacts c
        where c.org_id = v_org_id
          and c.created_at < v_cutoff_date
          and not exists (
            select 1 from public.threads t
            where t.contact_id = c.id
          )
        returning c.id
      )
      select count(*) into v_deleted_contacts from deleted;
      
      v_org_count := v_org_count + 1;
    end loop;
  end if;
  
  v_result := jsonb_build_object(
    'orgs_processed', v_org_count,
    'threads_deleted', v_deleted_threads,
    'messages_deleted', v_deleted_messages,
    'contacts_deleted', v_deleted_contacts,
    'cutoff_date', v_cutoff_date
  );
  
  return v_result;
end $$;


--
-- Name: FUNCTION cleanup_old_chat_data(p_org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_chat_data(p_org_id uuid) IS 'Delete chats, messages, and contacts older than retention_days (default 90) for an org or all orgs. Respects org_settings.retention_days.';


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


--
-- Name: set_ai_resolution_if_closed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_ai_resolution_if_closed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status = 'closed' and (new.resolution is null or new.resolution = '') then
    if not (new.ai_handoff_at is not null or new.assignee_user_id is not null or new.assigned_by_user_id is not null) then
      new.resolution := 'AI';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: set_auto_resolve_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_auto_resolve_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  ai_profile_record RECORD;
BEGIN
  -- Only process if this is an AI response (role = 'agent' or 'assistant')
  IF NEW.role IN ('agent', 'assistant') AND NEW.direction = 'out' THEN
    -- Get the AI profile settings for this thread's channel
    SELECT ap.enable_resolve, ap.auto_resolve_after_minutes
    INTO ai_profile_record
    FROM public.threads t
    JOIN public.channels ch ON ch.id = t.channel_id
    JOIN public.ai_profiles ap ON ap.id = ch.ai_profile_id
    WHERE t.id = NEW.thread_id
      AND t.ai_access_enabled = true;
    
    -- If auto-resolve is enabled, set the auto_resolve_at timestamp
    IF ai_profile_record.enable_resolve = true AND ai_profile_record.auto_resolve_after_minutes > 0 THEN
      UPDATE public.threads 
      SET auto_resolve_at = now() + (ai_profile_record.auto_resolve_after_minutes || ' minutes')::interval
      WHERE id = NEW.thread_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: set_thread_auto_resolve_after_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_thread_auto_resolve_after_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_minutes integer := 0;
  v_enabled boolean := false;
  v_thread_id uuid := new.thread_id;
  v_created_at timestamptz := coalesce(new.created_at, now());
begin
  select coalesce(p.auto_resolve_after_minutes, 0), coalesce(p.enable_resolve, false)
    into v_minutes, v_enabled
  from public.threads t
  join public.channels c on c.id = t.channel_id
  left join public.ai_profiles p on p.id = c.ai_profile_id
  where t.id = v_thread_id;

  if new.role in ('user', 'customer', 'incoming') then
    update public.threads set auto_resolve_at = null where id = v_thread_id;
  elsif new.role in ('agent', 'assistant') then
    if v_enabled and coalesce(v_minutes, 0) > 0 then
      update public.threads
         set auto_resolve_at = v_created_at + make_interval(mins => v_minutes)
       where id = v_thread_id;
    else
      update public.threads set auto_resolve_at = null where id = v_thread_id;
    end if;
  end if;

  return new;
end $$;


--
-- Name: takeover_thread(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.takeover_thread(p_thread_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.threads t
  SET assignee_user_id = auth.uid(),
      assigned_by_user_id = COALESCE(t.assigned_by_user_id, auth.uid()),
      assigned_at = COALESCE(t.assigned_at, now())
  WHERE t.id = p_thread_id
    AND t.org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    );
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_handover_reason(boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_handover_reason(new_handover boolean, reason text) RETURNS boolean
    LANGUAGE sql
    AS $$
  select case when new_handover then reason is not null else true end;
$$;


--
-- Name: verify_email_2fa(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_email_2fa(p_user uuid, p_code text, p_session_minutes integer DEFAULT 15) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_ch public.twofa_challenges%rowtype;
  v_session_id uuid;
begin
  -- Get the most recent unconsumed challenge
  select *
  into v_ch
  from public.twofa_challenges
  where user_id = p_user
    and consumed_at is null
    and expires_at > now()
  order by sent_at desc
  limit 1;

  if not found then
    raise exception 'No active challenge' using errcode = 'P0001';
  end if;

  -- Check code
  if crypt(p_code, v_ch.code_hash) != v_ch.code_hash then
    raise exception 'Invalid code' using errcode = 'P0001';
  end if;

  -- Mark challenge consumed
  update public.twofa_challenges
    set consumed_at = now()
    where id = v_ch.id;

  -- Create session
  insert into public.twofa_sessions (user_id, expires_at)
  values (p_user, now() + (p_session_minutes || ' minutes')::interval)
  returning id into v_session_id;

  return v_session_id;
end;
$$;


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text NOT NULL,
    provider text NOT NULL,
    model_name text NOT NULL,
    cost_per_1m_tokens numeric(10,4) DEFAULT 0.0,
    latency_ms integer DEFAULT 0,
    priority integer DEFAULT 1,
    is_active boolean DEFAULT true,
    is_fallback boolean DEFAULT false,
    max_context_tokens integer DEFAULT 128000,
    temperature numeric(3,2) DEFAULT 0.7,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text
);


--
-- Name: ai_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    system_prompt text,
    welcome_message text,
    transfer_conditions text,
    stop_ai_after_handoff boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    qna jsonb DEFAULT '[]'::jsonb NOT NULL,
    auto_resolve_after_minutes integer DEFAULT 0 NOT NULL,
    enable_resolve boolean DEFAULT false NOT NULL,
    response_temperature text DEFAULT 'Balanced'::text,
    history_limit integer DEFAULT 50000 NOT NULL,
    read_file_limit integer DEFAULT 3 NOT NULL,
    context_limit integer DEFAULT 28 NOT NULL,
    message_limit integer DEFAULT 1000 NOT NULL,
    message_await integer DEFAULT 3 NOT NULL,
    model_id uuid DEFAULT '6f96bba6-bf86-4608-8718-f33dc8956d33'::uuid NOT NULL,
    CONSTRAINT ai_profiles_qna_is_array CHECK ((jsonb_typeof(qna) = 'array'::text)),
    CONSTRAINT ai_profiles_response_temperature_check CHECK (((response_temperature IS NULL) OR (response_temperature = ANY (ARRAY['Conservative'::text, 'Balanced'::text, 'Creative'::text]))))
);


--
-- Name: COLUMN ai_profiles.auto_resolve_after_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.auto_resolve_after_minutes IS 'Minutes after the last agent/assistant reply with no user response to auto-close a thread. 0 disables auto-resolve.';


--
-- Name: COLUMN ai_profiles.enable_resolve; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.enable_resolve IS 'When true, auto-resolve will be applied using auto_resolve_after_minutes.';


--
-- Name: COLUMN ai_profiles.response_temperature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.response_temperature IS 'Temperature preset for AI responses: Conservative (0.3), Balanced (0.5), or Creative (0.7)';


--
-- Name: COLUMN ai_profiles.history_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.history_limit IS 'Maximum conversation history that AI can remember (in tokens). Default: 50000';


--
-- Name: COLUMN ai_profiles.read_file_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.read_file_limit IS 'Maximum number of files AI can read in a single conversation. Default: 3';


--
-- Name: COLUMN ai_profiles.context_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.context_limit IS 'Maximum context that AI can process in a single response (in K tokens). Default: 28';


--
-- Name: COLUMN ai_profiles.message_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.message_limit IS 'Maximum number of messages AI can send in a single conversation. Default: 1000';


--
-- Name: COLUMN ai_profiles.message_await; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_profiles.message_await IS 'Seconds to wait before processing message. Default: 3';


--
-- Name: ai_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    ai_profile_id uuid NOT NULL,
    model text,
    temperature numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    kind text NOT NULL,
    threshold bigint NOT NULL,
    window_minutes integer NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    rule_id uuid,
    kind text NOT NULL,
    value bigint NOT NULL,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    acked_by uuid,
    acked_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb
);


--
-- Name: bundle_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bundle_permissions (
    bundle_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_agents (
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    type text NOT NULL,
    provider public.channel_type NOT NULL,
    credentials jsonb DEFAULT '{}'::jsonb,
    display_name text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    external_id text,
    secret_token text,
    profile_photo_url text,
    ai_profile_id uuid,
    super_agent_id uuid,
    logo_url text
);


--
-- Name: circuit_breaker_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circuit_breaker_metrics (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    operation_type text NOT NULL,
    endpoint text,
    user_id uuid,
    circuit_breaker_state text NOT NULL,
    success boolean NOT NULL,
    error_category text,
    response_time_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: circuit_breaker_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.circuit_breaker_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: circuit_breaker_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.circuit_breaker_metrics_id_seq OWNED BY public.circuit_breaker_metrics.id;


--
-- Name: contact_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    external_id text NOT NULL
);


--
-- Name: contact_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_labels (
    contact_id uuid NOT NULL,
    label_id uuid NOT NULL
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text,
    email text,
    phone text,
    locale text DEFAULT 'id'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    external_id text
);


--
-- Name: csat_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csat_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    thread_id uuid,
    message_id uuid,
    score integer,
    feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT csat_responses_score_check CHECK (((score >= 1) AND (score <= 5)))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id bigint NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(1536)
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    ai_profile_id uuid,
    bucket text NOT NULL,
    path text NOT NULL,
    filename text NOT NULL,
    mime_type text,
    byte_size bigint,
    checksum text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    scope public.label_scope NOT NULL,
    name text NOT NULL,
    color text
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    direction public.message_direction,
    role public.message_role DEFAULT 'user'::public.message_role NOT NULL,
    type public.message_type DEFAULT 'text'::public.message_type NOT NULL,
    body text,
    payload jsonb,
    actor_kind text,
    actor_id uuid,
    seq bigint NOT NULL,
    in_reply_to uuid,
    edited_at timestamp with time zone,
    edit_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_direction_vs_type CHECK ((((type = ANY (ARRAY['event'::public.message_type, 'note'::public.message_type])) AND (direction IS NULL)) OR ((type <> ALL (ARRAY['event'::public.message_type, 'note'::public.message_type])) AND (direction IS NOT NULL)))),
    CONSTRAINT messages_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['customer'::text, 'agent'::text, 'ai'::text, 'system'::text])))
);


--
-- Name: messages_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.messages ALTER COLUMN seq ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.messages_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: n8n_chat_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.n8n_chat_histories (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    message jsonb NOT NULL
);


--
-- Name: n8n_chat_histories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.n8n_chat_histories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: n8n_chat_histories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.n8n_chat_histories_id_seq OWNED BY public.n8n_chat_histories.id;


--
-- Name: n8n_webhook_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.n8n_webhook_routes (
    route_key text NOT NULL,
    n8n_url text NOT NULL,
    secret_current text NOT NULL,
    key_version integer DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: openai_usage_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.openai_usage_snapshots (
    id bigint NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    range_label text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    input_tokens bigint DEFAULT 0 NOT NULL,
    output_tokens bigint DEFAULT 0 NOT NULL,
    total_tokens bigint DEFAULT 0 NOT NULL,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: openai_usage_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.openai_usage_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: openai_usage_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.openai_usage_snapshots_id_seq OWNED BY public.openai_usage_snapshots.id;


--
-- Name: org_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_members (
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'agent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'agent'::text])))
);


--
-- Name: org_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_settings (
    org_id uuid NOT NULL,
    default_locale text DEFAULT 'id'::text,
    retention_days integer DEFAULT 90,
    ai_default_profile_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orgs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    plan text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permission_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    resource text NOT NULL,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: rbac_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_policies (
    role_id uuid NOT NULL,
    policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_bundles (
    role_id uuid NOT NULL,
    bundle_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: super_agent_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_agent_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    super_agent_id uuid NOT NULL,
    agent_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT super_agent_not_self CHECK ((super_agent_id <> agent_user_id))
);


--
-- Name: thread_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_collaborators (
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    contact_id uuid,
    channel_id uuid NOT NULL,
    status public.thread_status DEFAULT 'open'::public.thread_status NOT NULL,
    assignee_user_id uuid,
    last_msg_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by_user_id uuid,
    resolved_by_user_id uuid,
    ai_handoff_at timestamp with time zone,
    assigned_at timestamp with time zone,
    resolved_at timestamp with time zone,
    is_blocked boolean DEFAULT false NOT NULL,
    ai_access_enabled boolean DEFAULT true NOT NULL,
    notes text,
    additional_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolution text,
    end_reason text,
    handover_reason text,
    auto_resolve_at timestamp with time zone,
    CONSTRAINT handover_reason_taxonomy CHECK (((handover_reason IS NULL) OR (handover_reason = ANY (ARRAY['ambiguous'::text, 'payment'::text, 'policy'::text])) OR (handover_reason ~~ 'other:%'::text)))
);


--
-- Name: COLUMN threads.auto_resolve_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.threads.auto_resolve_at IS 'Timestamp when this thread should be auto-closed due to inactivity after an agent/assistant reply.';


--
-- Name: token_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_balances (
    org_id uuid NOT NULL,
    balance_tokens bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: token_topups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_topups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    amount_tokens bigint NOT NULL,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT token_topups_amount_tokens_check CHECK ((amount_tokens > 0))
);


--
-- Name: token_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    thread_id uuid,
    model text NOT NULL,
    provider text DEFAULT 'openai'::text NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    total_tokens integer NOT NULL,
    status text DEFAULT 'ok'::text NOT NULL,
    error_code text,
    made_at timestamp with time zone DEFAULT now() NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    user_id uuid,
    channel_id uuid,
    message_id uuid
);


--
-- Name: twofa_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twofa_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    channel text NOT NULL,
    code_hash text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    CONSTRAINT twofa_challenges_channel_check CHECK ((channel = 'email'::text))
);


--
-- Name: twofa_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twofa_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: user_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    invited_by uuid,
    email text,
    phone text,
    role_id uuid,
    assigned_super_agent_id uuid,
    status text DEFAULT 'pending'::text,
    token text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT user_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_profile (
    user_id uuid NOT NULL,
    display_name text,
    avatar_url text,
    timezone text DEFAULT 'Asia/Jakarta'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    token_limit_enabled boolean DEFAULT false NOT NULL,
    max_tokens_per_day bigint DEFAULT 0 NOT NULL,
    max_tokens_per_month bigint DEFAULT 0 NOT NULL,
    is_2fa_email_enabled boolean DEFAULT true,
    is_active boolean DEFAULT true NOT NULL,
    used_tokens bigint DEFAULT 0 NOT NULL,
    daily_used_tokens bigint DEFAULT 0 NOT NULL,
    monthly_used_tokens bigint DEFAULT 0 NOT NULL,
    daily_reset_at timestamp with time zone,
    monthly_reset_at timestamp with time zone,
    password_set boolean DEFAULT false
);


--
-- Name: v_current_user_permissions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_current_user_permissions AS
 SELECT DISTINCT p.id,
    p.name,
    p.resource,
    p.action
   FROM ((public.user_roles ur
     JOIN public.role_permissions rp ON ((rp.role_id = ur.role_id)))
     JOIN public.permissions p ON ((p.id = rp.permission_id)))
  WHERE (ur.user_id = auth.uid())
UNION
 SELECT DISTINCT p.id,
    p.name,
    p.resource,
    p.action
   FROM (((public.user_roles ur
     JOIN public.role_bundles rb ON ((rb.role_id = ur.role_id)))
     JOIN public.bundle_permissions bp ON ((bp.bundle_id = rb.bundle_id)))
     JOIN public.permissions p ON ((p.id = bp.permission_id)))
  WHERE (ur.user_id = auth.uid())
UNION
 SELECT NULL::uuid AS id,
    ((('Policy: '::text || res.resource) || '.'::text) || act.action) AS name,
    res.resource,
    act.action
   FROM (((public.user_roles ur
     JOIN public.rbac_policies pol ON ((pol.role_id = ur.role_id)))
     JOIN LATERAL jsonb_object_keys(COALESCE((pol.policy -> 'resources'::text), '{}'::jsonb)) res(resource) ON (true))
     JOIN LATERAL jsonb_array_elements_text(((pol.policy -> 'resources'::text) -> res.resource)) act(action) ON (true))
  WHERE (ur.user_id = auth.uid());


--
-- Name: v_human_agents; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_human_agents AS
 WITH base AS (
         SELECT u.id AS user_id,
            ((u.raw_app_meta_data ->> 'org_id'::text))::uuid AS org_id,
            u.email,
            u.invited_at,
            u.confirmed_at,
            u.last_sign_in_at
           FROM auth.users u
          WHERE (u.deleted_at IS NULL)
        )
 SELECT b.org_id,
    b.user_id,
    b.email,
    COALESCE(up.display_name, split_part((b.email)::text, '@'::text, 1)) AS agent_name,
    up.avatar_url,
    up.is_active,
    r.id AS role_id,
    r.name AS role_name,
        CASE
            WHEN (b.confirmed_at IS NOT NULL) THEN 'accepted'::text
            WHEN ((b.invited_at IS NOT NULL) AND (now() <= (b.invited_at + make_interval(secs => (public.invite_ttl_seconds())::double precision)))) THEN 'waiting'::text
            WHEN ((b.invited_at IS NOT NULL) AND (now() > (b.invited_at + make_interval(secs => (public.invite_ttl_seconds())::double precision)))) THEN 'expired'::text
            ELSE 'waiting'::text
        END AS confirmation_status,
    (b.invited_at IS NOT NULL) AS is_invited,
    b.invited_at AS last_invited_at,
    (b.invited_at + make_interval(secs => (public.invite_ttl_seconds())::double precision)) AS invitation_expires_at,
    ((b.invited_at IS NOT NULL) AND (b.confirmed_at IS NULL) AND (now() > (b.invited_at + make_interval(secs => (public.invite_ttl_seconds())::double precision)))) AS can_reinvite,
    b.last_sign_in_at
   FROM (((base b
     LEFT JOIN public.users_profile up ON ((up.user_id = b.user_id)))
     LEFT JOIN public.user_roles ur ON ((ur.user_id = b.user_id)))
     LEFT JOIN public.roles r ON ((r.id = ur.role_id)));


--
-- Name: v_super_agent_token_usage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_super_agent_token_usage AS
 SELECT ch.super_agent_id,
    sum(tul.prompt_tokens) AS prompt_tokens,
    sum(tul.completion_tokens) AS completion_tokens,
    sum(tul.total_tokens) AS total_tokens,
    count(*) AS calls_count,
    min(tul.made_at) AS first_usage_at,
    max(tul.made_at) AS last_usage_at
   FROM (public.token_usage_logs tul
     JOIN public.channels ch ON ((ch.id = tul.channel_id)))
  WHERE (ch.super_agent_id IS NOT NULL)
  GROUP BY ch.super_agent_id;


--
-- Name: v_users; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_users AS
 SELECT u.id,
    u.email,
    p.display_name,
    p.avatar_url,
    p.timezone,
    p.created_at,
    array_agg(r.name) AS roles
   FROM (((auth.users u
     LEFT JOIN public.users_profile p ON ((p.user_id = u.id)))
     LEFT JOIN public.user_roles ur ON ((ur.user_id = u.id)))
     LEFT JOIN public.roles r ON ((r.id = ur.role_id)))
  GROUP BY u.id, u.email, p.display_name, p.avatar_url, p.timezone, p.created_at;


--
-- Name: circuit_breaker_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_metrics ALTER COLUMN id SET DEFAULT nextval('public.circuit_breaker_metrics_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: n8n_chat_histories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_chat_histories ALTER COLUMN id SET DEFAULT nextval('public.n8n_chat_histories_id_seq'::regclass);


--
-- Name: openai_usage_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.openai_usage_snapshots ALTER COLUMN id SET DEFAULT nextval('public.openai_usage_snapshots_id_seq'::regclass);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_provider_model_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_provider_model_name_key UNIQUE (provider, model_name);


--
-- Name: ai_profiles ai_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_profiles
    ADD CONSTRAINT ai_profiles_pkey PRIMARY KEY (id);


--
-- Name: ai_sessions ai_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sessions
    ADD CONSTRAINT ai_sessions_pkey PRIMARY KEY (id);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bundle_permissions bundle_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bundle_permissions
    ADD CONSTRAINT bundle_permissions_pkey PRIMARY KEY (bundle_id, permission_id);


--
-- Name: channel_agents channel_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_agents
    ADD CONSTRAINT channel_agents_pkey PRIMARY KEY (channel_id, user_id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: circuit_breaker_metrics circuit_breaker_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_metrics
    ADD CONSTRAINT circuit_breaker_metrics_pkey PRIMARY KEY (id);


--
-- Name: contact_identities contact_identities_channel_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_channel_id_external_id_key UNIQUE (channel_id, external_id);


--
-- Name: contact_identities contact_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_pkey PRIMARY KEY (id);


--
-- Name: contact_labels contact_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_labels
    ADD CONSTRAINT contact_labels_pkey PRIMARY KEY (contact_id, label_id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: csat_responses csat_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csat_responses
    ADD CONSTRAINT csat_responses_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: labels labels_org_id_scope_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_org_id_scope_name_key UNIQUE (org_id, scope, name);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: n8n_chat_histories n8n_chat_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_chat_histories
    ADD CONSTRAINT n8n_chat_histories_pkey PRIMARY KEY (id);


--
-- Name: n8n_webhook_routes n8n_webhook_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_webhook_routes
    ADD CONSTRAINT n8n_webhook_routes_pkey PRIMARY KEY (route_key);


--
-- Name: openai_usage_snapshots openai_usage_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.openai_usage_snapshots
    ADD CONSTRAINT openai_usage_snapshots_pkey PRIMARY KEY (id);


--
-- Name: org_members org_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_pkey PRIMARY KEY (org_id, user_id);


--
-- Name: org_settings org_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_pkey PRIMARY KEY (org_id);


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: permission_bundles permission_bundles_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_bundles
    ADD CONSTRAINT permission_bundles_key_key UNIQUE (key);


--
-- Name: permission_bundles permission_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_bundles
    ADD CONSTRAINT permission_bundles_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: rbac_policies rbac_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_policies
    ADD CONSTRAINT rbac_policies_pkey PRIMARY KEY (role_id);


--
-- Name: role_bundles role_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_bundles
    ADD CONSTRAINT role_bundles_pkey PRIMARY KEY (role_id, bundle_id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: super_agent_members super_agent_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_agent_members
    ADD CONSTRAINT super_agent_members_pkey PRIMARY KEY (id);


--
-- Name: super_agent_members super_agent_members_unique_per_org; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_agent_members
    ADD CONSTRAINT super_agent_members_unique_per_org UNIQUE (org_id, agent_user_id);


--
-- Name: thread_collaborators thread_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_collaborators
    ADD CONSTRAINT thread_collaborators_pkey PRIMARY KEY (thread_id, user_id);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (id);


--
-- Name: token_balances token_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_balances
    ADD CONSTRAINT token_balances_pkey PRIMARY KEY (org_id);


--
-- Name: token_topups token_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_topups
    ADD CONSTRAINT token_topups_pkey PRIMARY KEY (id);


--
-- Name: token_usage_logs token_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usage_logs
    ADD CONSTRAINT token_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: twofa_challenges twofa_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twofa_challenges
    ADD CONSTRAINT twofa_challenges_pkey PRIMARY KEY (id);


--
-- Name: twofa_sessions twofa_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twofa_sessions
    ADD CONSTRAINT twofa_sessions_pkey PRIMARY KEY (id);


--
-- Name: permissions uq_permissions_resource_action; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action);


--
-- Name: user_invites user_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_pkey PRIMARY KEY (id);


--
-- Name: user_invites user_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_token_key UNIQUE (token);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users_profile users_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_profile
    ADD CONSTRAINT users_profile_pkey PRIMARY KEY (user_id);


--
-- Name: idx_audit_logs_org_action_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_org_action_created_at ON public.audit_logs USING btree (org_id, action, created_at DESC);


--
-- Name: idx_audit_logs_org_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_org_created_at ON public.audit_logs USING btree (org_id, created_at DESC);


--
-- Name: idx_audit_logs_org_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_org_user_created_at ON public.audit_logs USING btree (org_id, user_id, created_at DESC);


--
-- Name: idx_channels_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_id ON public.channels USING btree (id);


--
-- Name: idx_channels_id_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_id_org ON public.channels USING btree (id, org_id);


--
-- Name: idx_channels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_org ON public.channels USING btree (org_id);


--
-- Name: idx_channels_super_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_super_agent ON public.channels USING btree (super_agent_id);


--
-- Name: idx_channels_super_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_super_agent_id ON public.channels USING btree (super_agent_id);


--
-- Name: idx_channels_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_type ON public.channels USING btree (type);


--
-- Name: idx_circuit_breaker_metrics_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circuit_breaker_metrics_created_at ON public.circuit_breaker_metrics USING btree (created_at DESC);


--
-- Name: idx_circuit_breaker_metrics_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circuit_breaker_metrics_operation ON public.circuit_breaker_metrics USING btree (operation_type, endpoint);


--
-- Name: idx_circuit_breaker_metrics_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circuit_breaker_metrics_state ON public.circuit_breaker_metrics USING btree (circuit_breaker_state);


--
-- Name: idx_circuit_breaker_metrics_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circuit_breaker_metrics_success ON public.circuit_breaker_metrics USING btree (success);


--
-- Name: idx_circuit_breaker_metrics_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circuit_breaker_metrics_user ON public.circuit_breaker_metrics USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_contact_identities_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_identities_contact ON public.contact_identities USING btree (contact_id);


--
-- Name: idx_contacts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_org ON public.contacts USING btree (org_id);


--
-- Name: idx_csat_org_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csat_org_time ON public.csat_responses USING btree (org_id, created_at DESC);


--
-- Name: idx_files_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_org ON public.files USING btree (org_id);


--
-- Name: idx_files_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_profile ON public.files USING btree (ai_profile_id);


--
-- Name: idx_messages_thread_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_thread_created ON public.messages USING btree (thread_id, created_at);


--
-- Name: idx_openai_usage_snapshots_captured_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_openai_usage_snapshots_captured_at ON public.openai_usage_snapshots USING btree (captured_at DESC);


--
-- Name: idx_openai_usage_snapshots_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_openai_usage_snapshots_dates ON public.openai_usage_snapshots USING btree (start_date, end_date);


--
-- Name: idx_org_members_user_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user_org ON public.org_members USING btree (user_id, org_id);


--
-- Name: idx_roles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_name ON public.roles USING btree (name);


--
-- Name: idx_sam_org_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_org_agent ON public.super_agent_members USING btree (org_id, agent_user_id);


--
-- Name: idx_sam_super; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_super ON public.super_agent_members USING btree (super_agent_id);


--
-- Name: idx_super_agent_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_super_agent_members_org ON public.super_agent_members USING btree (org_id);


--
-- Name: idx_super_agent_members_org_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_super_agent_members_org_agent ON public.super_agent_members USING btree (org_id, agent_user_id);


--
-- Name: idx_super_agent_members_super; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_super_agent_members_super ON public.super_agent_members USING btree (super_agent_id);


--
-- Name: idx_threads_inbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_inbox ON public.threads USING btree (org_id, status, last_msg_at DESC);


--
-- Name: idx_threads_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_org_created ON public.threads USING btree (org_id, created_at DESC);


--
-- Name: idx_token_usage_logs_channel_made_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_usage_logs_channel_made_at ON public.token_usage_logs USING btree (channel_id, made_at DESC);


--
-- Name: idx_token_usage_logs_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_usage_logs_user_time ON public.token_usage_logs USING btree (user_id, made_at);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: ix_tul_org_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tul_org_time ON public.token_usage_logs USING btree (org_id, made_at);


--
-- Name: uq_ai_profiles_org_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ai_profiles_org_name ON public.ai_profiles USING btree (org_id, name);


--
-- Name: uq_ai_sessions_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ai_sessions_thread ON public.ai_sessions USING btree (thread_id);


--
-- Name: uq_files_bucket_path; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_files_bucket_path ON public.files USING btree (bucket, path);


--
-- Name: threads set_ai_handoff_at_on_assignee_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ai_handoff_at_on_assignee_change BEFORE UPDATE ON public.threads FOR EACH ROW WHEN ((old.assignee_user_id IS DISTINCT FROM new.assignee_user_id)) EXECUTE FUNCTION public.set_ai_handoff_at();


--
-- Name: threads tr_add_default_collaborators; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_add_default_collaborators AFTER INSERT ON public.threads FOR EACH ROW EXECUTE FUNCTION public.add_default_collaborators();


--
-- Name: threads tr_enforce_handover_reason; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_enforce_handover_reason BEFORE INSERT OR UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION public.enforce_handover_reason();


--
-- Name: token_usage_logs tr_refresh_daily_monthly_after_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_refresh_daily_monthly_after_log AFTER INSERT OR DELETE OR UPDATE ON public.token_usage_logs FOR EACH STATEMENT EXECUTE FUNCTION public.after_token_log_refresh_daily_monthly();


--
-- Name: token_usage_logs tr_refresh_used_tokens_after_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_refresh_used_tokens_after_log AFTER INSERT OR DELETE OR UPDATE ON public.token_usage_logs FOR EACH STATEMENT EXECUTE FUNCTION public.after_token_log_refresh_used_tokens();


--
-- Name: messages tr_reopen_thread_on_user_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_reopen_thread_on_user_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.reopen_thread_on_user_message();


--
-- Name: threads tr_set_ai_resolution_if_closed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_set_ai_resolution_if_closed BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION public.set_ai_resolution_if_closed();


--
-- Name: messages tr_set_thread_auto_resolve_after_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_set_thread_auto_resolve_after_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_thread_auto_resolve_after_message();

ALTER TABLE public.messages DISABLE TRIGGER tr_set_thread_auto_resolve_after_message;


--
-- Name: messages trigger_cancel_auto_resolve_on_user_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cancel_auto_resolve_on_user_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.cancel_auto_resolve_on_user_message();


--
-- Name: messages trigger_set_auto_resolve_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_auto_resolve_timestamp AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_auto_resolve_timestamp();


--
-- Name: ai_profiles ai_profiles_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_profiles
    ADD CONSTRAINT ai_profiles_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_profiles ai_profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_profiles
    ADD CONSTRAINT ai_profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: alert_rules alert_rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_org_fk FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: bundle_permissions bundle_permissions_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bundle_permissions
    ADD CONSTRAINT bundle_permissions_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.permission_bundles(id) ON DELETE CASCADE;


--
-- Name: bundle_permissions bundle_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bundle_permissions
    ADD CONSTRAINT bundle_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: channel_agents channel_agents_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_agents
    ADD CONSTRAINT channel_agents_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_agents channel_agents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_agents
    ADD CONSTRAINT channel_agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: channels channels_ai_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_ai_profile_id_fkey FOREIGN KEY (ai_profile_id) REFERENCES public.ai_profiles(id);


--
-- Name: channels channels_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: channels channels_super_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_super_agent_id_fkey FOREIGN KEY (super_agent_id) REFERENCES public.users_profile(user_id) ON DELETE SET NULL;


--
-- Name: contact_identities contact_identities_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: contact_identities contact_identities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_identities contact_identities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: contact_labels contact_labels_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_labels
    ADD CONSTRAINT contact_labels_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_labels contact_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_labels
    ADD CONSTRAINT contact_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: csat_responses csat_responses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csat_responses
    ADD CONSTRAINT csat_responses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: files files_ai_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_ai_profile_id_fkey FOREIGN KEY (ai_profile_id) REFERENCES public.ai_profiles(id) ON DELETE SET NULL;


--
-- Name: files files_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: files files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: labels labels_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: messages messages_in_reply_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_in_reply_to_fkey FOREIGN KEY (in_reply_to) REFERENCES public.messages(id);


--
-- Name: messages messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: org_members org_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: org_members org_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_settings org_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: rbac_policies rbac_policies_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_policies
    ADD CONSTRAINT rbac_policies_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_bundles role_bundles_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_bundles
    ADD CONSTRAINT role_bundles_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.permission_bundles(id) ON DELETE CASCADE;


--
-- Name: role_bundles role_bundles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_bundles
    ADD CONSTRAINT role_bundles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: super_agent_members super_agent_members_agent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_agent_members
    ADD CONSTRAINT super_agent_members_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: super_agent_members super_agent_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_agent_members
    ADD CONSTRAINT super_agent_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: super_agent_members super_agent_members_super_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_agent_members
    ADD CONSTRAINT super_agent_members_super_agent_id_fkey FOREIGN KEY (super_agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: threads threads_assigned_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: threads threads_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: threads threads_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: threads threads_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: threads threads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: threads threads_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: token_balances token_balances_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_balances
    ADD CONSTRAINT token_balances_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: token_topups token_topups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_topups
    ADD CONSTRAINT token_topups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: token_topups token_topups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_topups
    ADD CONSTRAINT token_topups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: token_usage_logs token_usage_logs_channel_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usage_logs
    ADD CONSTRAINT token_usage_logs_channel_fk FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: token_usage_logs token_usage_logs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usage_logs
    ADD CONSTRAINT token_usage_logs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: token_usage_logs token_usage_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usage_logs
    ADD CONSTRAINT token_usage_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: token_usage_logs token_usage_logs_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usage_logs
    ADD CONSTRAINT token_usage_logs_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;


--
-- Name: token_usage_logs token_usage_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usage_logs
    ADD CONSTRAINT token_usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: twofa_challenges twofa_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twofa_challenges
    ADD CONSTRAINT twofa_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: twofa_sessions twofa_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twofa_sessions
    ADD CONSTRAINT twofa_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_invites user_invites_assigned_super_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_assigned_super_agent_id_fkey FOREIGN KEY (assigned_super_agent_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_invites user_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users_profile(user_id) ON DELETE SET NULL;


--
-- Name: user_invites user_invites_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: user_invites user_invites_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users_profile users_profile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_profile
    ADD CONSTRAINT users_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_settings Active users can update org_settings for their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active users can update org_settings for their organization" ON public.org_settings FOR UPDATE TO authenticated USING (((public.is_current_user_active() = true) AND (org_id IN ( SELECT om.org_id
   FROM ((public.org_members om
     JOIN public.user_roles ur ON ((ur.user_id = om.user_id)))
     JOIN public.roles r ON ((r.id = ur.role_id)))
  WHERE ((om.user_id = auth.uid()) AND (lower(r.name) = ANY (ARRAY['master_agent'::text, 'super_agent'::text]))))))) WITH CHECK (((public.is_current_user_active() = true) AND (org_id IN ( SELECT om.org_id
   FROM ((public.org_members om
     JOIN public.user_roles ur ON ((ur.user_id = om.user_id)))
     JOIN public.roles r ON ((r.id = ur.role_id)))
  WHERE ((om.user_id = auth.uid()) AND (lower(r.name) = ANY (ARRAY['master_agent'::text, 'super_agent'::text])))))));


--
-- Name: contacts Allow anonymous insert to contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous insert to contacts" ON public.contacts FOR INSERT WITH CHECK (true);


--
-- Name: messages Allow anonymous insert to messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous insert to messages" ON public.messages FOR INSERT WITH CHECK (true);


--
-- Name: channels Allow anonymous read access to channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous read access to channels" ON public.channels FOR SELECT USING (true);


--
-- Name: contacts Allow anonymous read access to contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous read access to contacts" ON public.contacts FOR SELECT USING (true);


--
-- Name: messages Allow anonymous read access to messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous read access to messages" ON public.messages FOR SELECT USING (true);


--
-- Name: ai_profiles Allow authenticated access to ai_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated access to ai_profiles" ON public.ai_profiles TO authenticated USING (true);


--
-- Name: audit_logs Allow authenticated access to audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated access to audit_logs" ON public.audit_logs TO authenticated USING (true);


--
-- Name: channels Allow authenticated access to channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated access to channels" ON public.channels TO authenticated USING (true);


--
-- Name: contacts Allow authenticated access to contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated access to contacts" ON public.contacts TO authenticated USING (true);


--
-- Name: messages Allow authenticated access to messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated access to messages" ON public.messages TO authenticated USING (true);


--
-- Name: org_members Allow authenticated access to org_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated access to org_members" ON public.org_members TO authenticated USING (true);


--
-- Name: threads Allow authenticated access to threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated access to threads" ON public.threads TO authenticated USING (true);


--
-- Name: circuit_breaker_metrics Allow authenticated to insert metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to insert metrics" ON public.circuit_breaker_metrics FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: circuit_breaker_metrics Allow authenticated to read metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to read metrics" ON public.circuit_breaker_metrics FOR SELECT TO authenticated USING (true);


--
-- Name: openai_usage_snapshots Allow insert for service role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert for service role" ON public.openai_usage_snapshots FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: openai_usage_snapshots Allow read for authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read for authenticated" ON public.openai_usage_snapshots FOR SELECT TO authenticated USING (true);


--
-- Name: audit_logs Master agents can read org logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master agents can read org logs" ON public.audit_logs FOR SELECT TO authenticated USING (((org_id IN ( SELECT org_members.org_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'master_agent'::text))))));


--
-- Name: users_profile Only active users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only active users can update their own profile" ON public.users_profile FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (is_active = true)));


--
-- Name: audit_logs Users can read own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own logs" ON public.audit_logs FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: users_profile Users can view their own profile for status checking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile for status checking" ON public.users_profile FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: ai_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: channels allow_public_select_web_channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_public_select_web_channels ON public.channels FOR SELECT TO anon USING (((provider = 'web'::public.channel_type) AND COALESCE(is_active, true)));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bundle_permissions auth can read bundle_perms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth can read bundle_perms" ON public.bundle_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: permission_bundles auth can read bundles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth can read bundles" ON public.permission_bundles FOR SELECT TO authenticated USING (true);


--
-- Name: ai_profiles auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.ai_profiles FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: ai_sessions auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.ai_sessions FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alert_rules auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.alert_rules FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alerts auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.alerts FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channel_agents auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.channel_agents FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channels auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.channels FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_identities auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.contact_identities FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_labels auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.contact_labels FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contacts auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.contacts FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: csat_responses auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.csat_responses FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: labels auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.labels FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: messages auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.messages FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: n8n_chat_histories auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.n8n_chat_histories FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_members auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.org_members FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_settings auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.org_settings FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: orgs auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.orgs FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: roles auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.roles FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: thread_collaborators auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.thread_collaborators FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: threads auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.threads FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_balances auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.token_balances FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_topups auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.token_topups FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_usage_logs auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.token_usage_logs FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: users_profile auth delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth delete" ON public.users_profile FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: ai_profiles auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.ai_profiles FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: ai_sessions auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.ai_sessions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alert_rules auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.alert_rules FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alerts auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.alerts FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channel_agents auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.channel_agents FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channels auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.channels FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_identities auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.contact_identities FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_labels auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.contact_labels FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contacts auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: csat_responses auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.csat_responses FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: labels auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.labels FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: messages auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.messages FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: n8n_chat_histories auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.n8n_chat_histories FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_members auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.org_members FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_settings auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.org_settings FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: orgs auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.orgs FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: roles auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.roles FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: thread_collaborators auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.thread_collaborators FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: threads auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.threads FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_balances auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.token_balances FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_topups auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.token_topups FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_usage_logs auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.token_usage_logs FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: users_profile auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth insert" ON public.users_profile FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: ai_profiles auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.ai_profiles FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: ai_sessions auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.ai_sessions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alert_rules auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.alert_rules FOR SELECT TO authenticated, anon USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alerts auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.alerts FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channel_agents auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.channel_agents FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channels auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.channels FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_identities auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.contact_identities FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_labels auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.contact_labels FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contacts auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.contacts FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: csat_responses auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.csat_responses FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: labels auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.labels FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: n8n_chat_histories auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.n8n_chat_histories FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_members auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.org_members FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_settings auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.org_settings FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: orgs auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.orgs FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: permissions auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.permissions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: role_permissions auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.role_permissions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: roles auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.roles FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: thread_collaborators auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.thread_collaborators FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_balances auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.token_balances FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_topups auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.token_topups FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_usage_logs auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.token_usage_logs FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: user_roles auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.user_roles FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: users_profile auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read" ON public.users_profile FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: messages auth read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth read messages" ON public.messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.threads t
  WHERE ((t.id = messages.thread_id) AND ((t.assignee_user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.thread_collaborators tc
          WHERE ((tc.thread_id = t.id) AND (tc.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM public.channel_agents ca
          WHERE ((ca.channel_id = t.channel_id) AND (ca.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM (public.user_roles ur
             JOIN public.roles r ON ((r.id = ur.role_id)))
          WHERE ((ur.user_id = auth.uid()) AND (r.name = 'master_agent'::text)))) OR (EXISTS ( SELECT 1
           FROM public.channels c
          WHERE ((c.id = t.channel_id) AND (c.super_agent_id = auth.uid())))))))));


--
-- Name: ai_profiles auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.ai_profiles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: ai_sessions auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.ai_sessions FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alert_rules auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.alert_rules FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: alerts auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.alerts FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channel_agents auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.channel_agents FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: channels auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.channels FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_identities auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.contact_identities FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contact_labels auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.contact_labels FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: contacts auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.contacts FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: csat_responses auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.csat_responses FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: labels auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.labels FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: messages auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.messages FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: n8n_chat_histories auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.n8n_chat_histories FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_members auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.org_members FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: org_settings auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.org_settings FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: orgs auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.orgs FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: roles auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.roles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: thread_collaborators auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.thread_collaborators FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: threads auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.threads FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_balances auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.token_balances FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_topups auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.token_topups FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: token_usage_logs auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.token_usage_logs FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: user_roles auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.user_roles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: users_profile auth update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth update" ON public.users_profile FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: bundle_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bundle_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_agents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_agents ENABLE ROW LEVEL SECURITY;

--
-- Name: channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

--
-- Name: circuit_breaker_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.circuit_breaker_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_identities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_identities ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: csat_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.csat_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

--
-- Name: role_bundles members can read role_bundles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members can read role_bundles" ON public.role_bundles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role_id = ur.role_id)))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_by_thread_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_by_thread_read ON public.messages FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users_profile
  WHERE ((users_profile.user_id = auth.uid()) AND (users_profile.is_active = true)))) AND (EXISTS ( SELECT 1
   FROM public.threads t
  WHERE ((t.id = messages.thread_id) AND ((EXISTS ( SELECT 1
           FROM ((public.user_roles ur
             JOIN public.roles r ON ((r.id = ur.role_id)))
             JOIN public.org_members om ON (((om.user_id = ur.user_id) AND (om.org_id = t.org_id))))
          WHERE ((ur.user_id = auth.uid()) AND (r.name = 'master_agent'::text)))) OR ((EXISTS ( SELECT 1
           FROM (public.user_roles ur
             JOIN public.roles r ON ((r.id = ur.role_id)))
          WHERE ((ur.user_id = auth.uid()) AND (r.name = 'super_agent'::text)))) AND ((EXISTS ( SELECT 1
           FROM public.super_agent_members sam
          WHERE ((sam.org_id = t.org_id) AND (sam.super_agent_id = auth.uid()) AND ((sam.agent_user_id = t.assignee_user_id) OR (sam.agent_user_id = t.assigned_by_user_id) OR (sam.agent_user_id = t.resolved_by_user_id))))) OR (EXISTS ( SELECT 1
           FROM public.channels ch
          WHERE ((ch.id = t.channel_id) AND (ch.super_agent_id = auth.uid())))))) OR ((EXISTS ( SELECT 1
           FROM public.org_members om
          WHERE ((om.user_id = auth.uid()) AND (om.org_id = t.org_id)))) AND ((t.assignee_user_id = auth.uid()) OR (t.assigned_by_user_id = auth.uid()) OR (t.resolved_by_user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.channel_agents ca
          WHERE ((ca.channel_id = t.channel_id) AND (ca.user_id = auth.uid()))))))))))));


--
-- Name: channels n8n crud; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "n8n crud" ON public.channels TO service_role USING (true) WITH CHECK (true);


--
-- Name: n8n_chat_histories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;

--
-- Name: n8n_webhook_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.n8n_webhook_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: openai_usage_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.openai_usage_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: org_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

--
-- Name: org_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: orgs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

--
-- Name: twofa_challenges own challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own challenges" ON public.twofa_challenges FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: twofa_sessions own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own sessions" ON public.twofa_sessions FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: twofa_sessions own twofa sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own twofa sessions" ON public.twofa_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: permission_bundles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permission_bundles ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages public_read_web_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_web_messages ON public.messages FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM (public.threads t
     JOIN public.channels c ON ((c.id = t.channel_id)))
  WHERE ((t.id = messages.thread_id) AND (c.provider = 'web'::public.channel_type) AND COALESCE(c.is_active, true)))));


--
-- Name: threads public_read_web_threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_web_threads ON public.threads FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.channels c
  WHERE ((c.id = threads.channel_id) AND (c.provider = 'web'::public.channel_type) AND COALESCE(c.is_active, true)))));


--
-- Name: users_profile read_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_own_profile ON public.users_profile FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: role_bundles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_bundles ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: super_agent_members sam_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sam_master_read ON public.super_agent_members USING ((EXISTS ( SELECT 1
   FROM ((public.user_roles ur
     JOIN public.roles r ON ((r.id = ur.role_id)))
     JOIN public.org_members om ON ((om.user_id = ur.user_id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'master_agent'::text) AND (om.org_id = super_agent_members.org_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.user_roles ur
     JOIN public.roles r ON ((r.id = ur.role_id)))
     JOIN public.org_members om ON ((om.user_id = ur.user_id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'master_agent'::text) AND (om.org_id = super_agent_members.org_id)))));


--
-- Name: super_agent_members sam_super_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sam_super_delete ON public.super_agent_members FOR DELETE USING ((super_agent_id = auth.uid()));


--
-- Name: super_agent_members sam_super_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sam_super_read ON public.super_agent_members FOR SELECT USING ((super_agent_id = auth.uid()));


--
-- Name: super_agent_members sam_super_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sam_super_write ON public.super_agent_members FOR INSERT WITH CHECK ((super_agent_id = auth.uid()));


--
-- Name: thread_collaborators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_collaborators ENABLE ROW LEVEL SECURITY;

--
-- Name: threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

--
-- Name: threads threads_agent_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY threads_agent_read ON public.threads FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users_profile
  WHERE ((users_profile.user_id = auth.uid()) AND (users_profile.is_active = true)))) AND (EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.user_id = auth.uid()) AND (om.org_id = threads.org_id)))) AND ((assignee_user_id = auth.uid()) OR (assigned_by_user_id = auth.uid()) OR (resolved_by_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.channel_agents ca
  WHERE ((ca.channel_id = threads.channel_id) AND (ca.user_id = auth.uid())))))));


--
-- Name: threads threads_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY threads_master_read ON public.threads FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users_profile
  WHERE ((users_profile.user_id = auth.uid()) AND (users_profile.is_active = true)))) AND (EXISTS ( SELECT 1
   FROM ((public.user_roles ur
     JOIN public.roles r ON ((r.id = ur.role_id)))
     JOIN public.org_members om ON (((om.user_id = ur.user_id) AND (om.org_id = threads.org_id))))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'master_agent'::text))))));


--
-- Name: threads threads_super_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY threads_super_read ON public.threads FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users_profile
  WHERE ((users_profile.user_id = auth.uid()) AND (users_profile.is_active = true)))) AND (EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'super_agent'::text)))) AND ((EXISTS ( SELECT 1
   FROM public.super_agent_members sam
  WHERE ((sam.org_id = threads.org_id) AND (sam.super_agent_id = auth.uid()) AND ((sam.agent_user_id = threads.assignee_user_id) OR (sam.agent_user_id = threads.assigned_by_user_id) OR (sam.agent_user_id = threads.resolved_by_user_id))))) OR (EXISTS ( SELECT 1
   FROM public.channels ch
  WHERE ((ch.id = threads.channel_id) AND (ch.super_agent_id = auth.uid())))))));


--
-- Name: token_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: token_topups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.token_topups ENABLE ROW LEVEL SECURITY;

--
-- Name: token_usage_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.token_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: twofa_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.twofa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: twofa_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.twofa_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: users_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

