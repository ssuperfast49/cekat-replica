

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