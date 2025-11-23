

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