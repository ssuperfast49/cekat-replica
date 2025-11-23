

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