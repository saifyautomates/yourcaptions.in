
-- Idempotency guard for topup purchases: at most one completed topup_purchase per (user_id, reference_id)
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_topup_dedup_idx
  ON public.credit_transactions (user_id, reference_id)
  WHERE type = 'topup_purchase' AND status = 'completed' AND reference_id IS NOT NULL;

-- Make add_credits idempotent when a reference_id is provided for topup_purchase.
CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount numeric, _bucket text, _type text, _reference_type text DEFAULT NULL::text, _reference_id uuid DEFAULT NULL::uuid, _metadata jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(plan_credits numeric, topup_credits numeric, balance numeric, tx_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  w public.credit_wallets%rowtype;
  v_tx uuid;
  v_existing uuid;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;
  IF _bucket NOT IN ('plan','topup') THEN
    RAISE EXCEPTION 'invalid bucket' USING ERRCODE = 'P0001';
  END IF;
  IF _type NOT IN ('topup_purchase','plan_grant','admin_adjust','refund') THEN
    RAISE EXCEPTION 'invalid type' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: if a completed topup_purchase already exists for this reference_id,
  -- return current wallet state without double-crediting.
  IF _type = 'topup_purchase' AND _reference_id IS NOT NULL THEN
    SELECT id INTO v_existing
      FROM public.credit_transactions
     WHERE user_id = _user_id
       AND type = 'topup_purchase'
       AND status = 'completed'
       AND reference_id = _reference_id
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id;
      plan_credits := COALESCE(w.plan_credits, 0);
      topup_credits := COALESCE(w.topup_credits, 0);
      balance := plan_credits + topup_credits;
      tx_id := v_existing;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.credit_wallets(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id FOR UPDATE;

  IF _bucket = 'plan' THEN
    UPDATE public.credit_wallets
       SET plan_credits = plan_credits + _amount,
           plan_credits_reset_at = CASE WHEN _type = 'plan_grant' THEN now() ELSE plan_credits_reset_at END,
           updated_at = now()
     WHERE user_id = _user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
  ELSE
    UPDATE public.credit_wallets
       SET topup_credits = topup_credits + _amount,
           updated_at = now()
     WHERE user_id = _user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
  END IF;

  BEGIN
    INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
    VALUES (_user_id, _type, _amount, w.plan_credits + w.topup_credits, _reference_type, _reference_id,
            COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('bucket', _bucket), 'completed')
    RETURNING id INTO v_tx;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent duplicate: roll back the wallet increment and return existing.
    IF _bucket = 'plan' THEN
      UPDATE public.credit_wallets
         SET plan_credits = plan_credits - _amount, updated_at = now()
       WHERE user_id = _user_id
       RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
    ELSE
      UPDATE public.credit_wallets
         SET topup_credits = topup_credits - _amount, updated_at = now()
       WHERE user_id = _user_id
       RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
    END IF;
    SELECT id INTO v_tx
      FROM public.credit_transactions
     WHERE user_id = _user_id AND type = _type AND status = 'completed' AND reference_id = _reference_id
     LIMIT 1;
  END;

  plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := w.plan_credits + w.topup_credits; tx_id := v_tx;
  RETURN NEXT;
END;
$function$;
