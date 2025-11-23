

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