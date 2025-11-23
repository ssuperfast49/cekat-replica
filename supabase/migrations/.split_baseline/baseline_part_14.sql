

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