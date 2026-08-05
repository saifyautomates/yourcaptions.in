
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.credit_wallets%rowtype;
  v_from_plan numeric := 0;
  v_from_topup numeric := 0;
  v_txn_id uuid;
  v_admin boolean := public.has_role(p_user_id, 'admin');
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_admin THEN
    INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
    VALUES (p_user_id, 'deduct', p_amount, w.plan_credits + w.topup_credits, p_reference_id, p_reference_type, 'reserved',
            COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('admin_bypass', true))
    RETURNING id INTO v_txn_id;
    RETURN v_txn_id;
  END IF;

  IF (w.plan_credits + w.topup_credits) < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0002';
  END IF;

  v_from_plan := LEAST(w.plan_credits, p_amount);
  v_from_topup := p_amount - v_from_plan;

  UPDATE public.credit_wallets
     SET plan_credits = plan_credits - v_from_plan,
         topup_credits = topup_credits - v_from_topup,
         updated_at = now()
   WHERE user_id = p_user_id
   RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
  VALUES (p_user_id, 'deduct', p_amount, w.plan_credits + w.topup_credits, p_reference_id, p_reference_type, 'reserved',
          COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('from_plan', v_from_plan, 'from_topup', v_from_topup))
  RETURNING id INTO v_txn_id;

  RETURN v_txn_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_credits(uuid, numeric, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, numeric, uuid, text, jsonb) TO service_role;

-- Finalize a reservation. If p_actual_amount is smaller, refund the diff.
CREATE OR REPLACE FUNCTION public.finalize_reservation(
  p_txn_id uuid,
  p_actual_amount numeric DEFAULT NULL
) RETURNS TABLE(balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.credit_transactions%rowtype;
  w public.credit_wallets%rowtype;
  v_meta jsonb;
  v_from_plan numeric;
  v_from_topup numeric;
  v_diff numeric := 0;
  v_return_topup numeric := 0;
  v_return_plan numeric := 0;
BEGIN
  SELECT * INTO t FROM public.credit_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'txn not found' USING ERRCODE='P0001'; END IF;
  IF t.status <> 'reserved' THEN RAISE EXCEPTION 'txn not reserved' USING ERRCODE='P0001'; END IF;
  IF t.type <> 'deduct' THEN RAISE EXCEPTION 'wrong type' USING ERRCODE='P0001'; END IF;

  v_meta := COALESCE(t.metadata, '{}'::jsonb);
  v_from_plan := COALESCE((v_meta->>'from_plan')::numeric, 0);
  v_from_topup := COALESCE((v_meta->>'from_topup')::numeric, 0);

  SELECT * INTO w FROM public.credit_wallets WHERE user_id = t.user_id FOR UPDATE;

  IF p_actual_amount IS NOT NULL AND p_actual_amount < t.amount THEN
    v_diff := t.amount - p_actual_amount;
    -- Refund proportionally: topup first (since it was consumed last), then plan.
    v_return_topup := LEAST(v_from_topup, v_diff);
    v_return_plan := v_diff - v_return_topup;
    UPDATE public.credit_wallets
       SET plan_credits = plan_credits + v_return_plan,
           topup_credits = topup_credits + v_return_topup,
           updated_at = now()
     WHERE user_id = t.user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

    IF v_diff > 0 THEN
      INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
      VALUES (t.user_id, 'refund', v_diff, w.plan_credits + w.topup_credits, t.reference_id, t.reference_type, 'completed',
              jsonb_build_object('reservation', p_txn_id, 'to_plan', v_return_plan, 'to_topup', v_return_topup));
    END IF;
  END IF;

  UPDATE public.credit_transactions
     SET status = 'completed',
         amount = COALESCE(p_actual_amount, amount),
         balance_after = w.plan_credits + w.topup_credits,
         metadata = v_meta || jsonb_build_object('finalized_at', now())
   WHERE id = p_txn_id;

  balance := w.plan_credits + w.topup_credits;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_reservation(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_reservation(uuid, numeric) TO service_role;

-- Full refund / release a reservation.
CREATE OR REPLACE FUNCTION public.refund_reservation(
  p_txn_id uuid,
  p_reason text DEFAULT NULL
) RETURNS TABLE(balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.credit_transactions%rowtype;
  w public.credit_wallets%rowtype;
  v_meta jsonb;
  v_from_plan numeric;
  v_from_topup numeric;
BEGIN
  SELECT * INTO t FROM public.credit_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'txn not found' USING ERRCODE='P0001'; END IF;
  IF t.status NOT IN ('reserved','completed') THEN
    RAISE EXCEPTION 'txn not refundable' USING ERRCODE='P0001';
  END IF;
  IF t.type <> 'deduct' THEN RAISE EXCEPTION 'wrong type' USING ERRCODE='P0001'; END IF;

  v_meta := COALESCE(t.metadata, '{}'::jsonb);
  v_from_plan := COALESCE((v_meta->>'from_plan')::numeric, 0);
  v_from_topup := COALESCE((v_meta->>'from_topup')::numeric, 0);
  -- If the deduct didn't split (admin_bypass), nothing to return.
  IF (v_from_plan + v_from_topup) = 0 AND (v_meta ? 'admin_bypass') THEN
    UPDATE public.credit_transactions
       SET status = 'reversed',
           metadata = v_meta || jsonb_build_object('reversed_at', now(), 'reason', p_reason)
     WHERE id = p_txn_id;
    SELECT plan_credits + topup_credits INTO balance FROM public.credit_wallets WHERE user_id = t.user_id;
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO w FROM public.credit_wallets WHERE user_id = t.user_id FOR UPDATE;

  UPDATE public.credit_wallets
     SET plan_credits = plan_credits + v_from_plan,
         topup_credits = topup_credits + v_from_topup,
         updated_at = now()
   WHERE user_id = t.user_id
   RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
  VALUES (t.user_id, 'refund', t.amount, w.plan_credits + w.topup_credits, t.reference_id, t.reference_type, 'completed',
          jsonb_build_object('reservation', p_txn_id, 'to_plan', v_from_plan, 'to_topup', v_from_topup, 'reason', p_reason));

  UPDATE public.credit_transactions
     SET status = 'reversed',
         metadata = v_meta || jsonb_build_object('reversed_at', now(), 'reason', p_reason)
   WHERE id = p_txn_id;

  balance := w.plan_credits + w.topup_credits;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_reservation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_reservation(uuid, text) TO service_role;
