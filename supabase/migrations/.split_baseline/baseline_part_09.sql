

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