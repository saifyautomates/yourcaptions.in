
-- jobs: allow owners to write their own rows; service_role bypasses RLS
CREATE POLICY "Users insert own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- usage_events: writes only via service_role (edge functions). Explicit deny for clients.
CREATE POLICY "No client inserts on usage_events" ON public.usage_events FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates on usage_events" ON public.usage_events FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on usage_events" ON public.usage_events FOR DELETE TO authenticated USING (false);

-- usage_meters: writes only via service_role. Explicit deny for clients.
CREATE POLICY "No client inserts on usage_meters" ON public.usage_meters FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates on usage_meters" ON public.usage_meters FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on usage_meters" ON public.usage_meters FOR DELETE TO authenticated USING (false);
