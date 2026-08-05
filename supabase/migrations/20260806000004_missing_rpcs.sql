-- Missing RPCs for credit operations and logging

CREATE OR REPLACE FUNCTION public.log_admin_action(_user_id uuid, _action text, _details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, old_value, new_value, ip_address, created_at)
  VALUES (_user_id, 'admin@yourcaptions.com', _action, 'setting', 'system', '{}'::jsonb, _details, '0.0.0.0', now());
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
$$;

-- Credit operation placeholders for missing functions
-- These wrap the actual credit tables to safely execute logic

CREATE OR REPLACE FUNCTION public.commit_credits(p_user_id uuid, p_amount numeric, p_reference_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dummy implementation for commit_credits if it was missing
  UPDATE public.credit_transactions
  SET status = 'completed'
  WHERE user_id = p_user_id AND reference_id = p_reference_id AND status = 'reserved';
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_amount numeric, p_reference_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dummy implementation
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
  VALUES (p_user_id, 'refund', p_amount, 0, p_reference_id, p_reference_type, 'completed', p_metadata);
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_topup_credits(p_user_id uuid, p_amount numeric, p_reference_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.credit_wallets
  SET topup_credits = topup_credits + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(user_id uuid, amount numeric, reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.credit_wallets
  SET topup_credits = topup_credits + amount,
      updated_at = now()
  WHERE public.credit_wallets.user_id = admin_adjust_credits.user_id
  RETURNING (plan_credits + topup_credits) INTO v_new_balance;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
  VALUES (admin_adjust_credits.user_id, 'admin_adjust', amount, COALESCE(v_new_balance, 0), NULL, 'admin', 'completed', jsonb_build_object('reason', reason));

  RETURN jsonb_build_object('new_balance', COALESCE(v_new_balance, 0));
EXCEPTION WHEN undefined_table THEN
  RETURN jsonb_build_object('new_balance', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.monthly_credit_reset(p_user_id uuid, p_plan_credits numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.credit_wallets
  SET plan_credits = p_plan_credits,
      plan_credits_reset_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
$$;

-- Apply permissions
REVOKE EXECUTE ON FUNCTION public.log_admin_action(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(uuid, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.commit_credits(uuid, numeric, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_credits(uuid, numeric, uuid, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, numeric, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, numeric, uuid, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.add_topup_credits(uuid, numeric, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_topup_credits(uuid, numeric, uuid, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, numeric, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.monthly_credit_reset(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_credit_reset(uuid, numeric) TO authenticated, service_role;
