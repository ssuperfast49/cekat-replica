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