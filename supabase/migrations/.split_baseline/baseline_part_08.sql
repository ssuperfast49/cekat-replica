

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