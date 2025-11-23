

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