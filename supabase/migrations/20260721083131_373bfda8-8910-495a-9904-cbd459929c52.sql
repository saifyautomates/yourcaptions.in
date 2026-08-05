
-- Credit wallet: one row per user, single source of truth for balance
CREATE TABLE public.credit_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_credits numeric NOT NULL DEFAULT 0,
  topup_credits numeric NOT NULL DEFAULT 0,
  plan_credits_reset_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_wallets TO authenticated;
GRANT ALL ON public.credit_wallets TO service_role;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_owner_read" ON public.credit_wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_credit_wallets_updated_at
  BEFORE UPDATE ON public.credit_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutable ledger: every credit movement
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deduct','refund','topup_purchase','plan_grant','admin_adjust')),
  amount numeric NOT NULL CHECK (amount >= 0),
  balance_after numeric NOT NULL,
  reference_id uuid,
  reference_type text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('reserved','completed','failed','reversed')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_transactions_user_created_idx ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX credit_transactions_reference_idx ON public.credit_transactions(reference_type, reference_id);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_owner_read" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Rate config: editable by admin without redeploying
CREATE TABLE public.credit_rates (
  feature text PRIMARY KEY,
  credits_per_unit numeric NOT NULL CHECK (credits_per_unit >= 0),
  unit text NOT NULL DEFAULT 'minute',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_rates TO authenticated, anon;
GRANT ALL ON public.credit_rates TO service_role;
ALTER TABLE public.credit_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rates_public_read" ON public.credit_rates
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "rates_admin_write" ON public.credit_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_credit_rates_updated_at
  BEFORE UPDATE ON public.credit_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default rates
INSERT INTO public.credit_rates (feature, credits_per_unit, unit) VALUES
  ('transcription', 1, 'minute'),
  ('caption_burn', 1, 'minute'),
  ('ai_dubbing_per_language', 5, 'minute'),
  ('translation', 0.5, 'minute')
ON CONFLICT (feature) DO NOTHING;

-- Atomic deduct RPC. Consumes plan_credits first, then topup_credits.
-- Writes a ledger row and returns the new balance. Admins are logged
-- but never blocked (unlimited).
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id uuid,
  _amount numeric,
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
) RETURNS TABLE(plan_credits numeric, topup_credits numeric, balance numeric, tx_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.credit_wallets%rowtype;
  from_plan numeric := 0;
  from_topup numeric := 0;
  remaining numeric;
  new_balance numeric;
  v_tx uuid;
  v_admin boolean := public.has_role(_user_id, 'admin');
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;

  -- Ensure wallet row exists, lock it
  INSERT INTO public.credit_wallets(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id FOR UPDATE;

  IF v_admin THEN
    -- Admins: record ledger, no balance change
    new_balance := w.plan_credits + w.topup_credits;
    INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
    VALUES (_user_id, 'deduct', _amount, new_balance, _reference_type, _reference_id,
            COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('admin_bypass', true), 'completed')
    RETURNING id INTO v_tx;
    plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := new_balance; tx_id := v_tx;
    RETURN NEXT; RETURN;
  END IF;

  IF (w.plan_credits + w.topup_credits) < _amount THEN
    RAISE EXCEPTION 'insufficient_credits:%/%', (w.plan_credits + w.topup_credits), _amount
      USING ERRCODE = 'P0002';
  END IF;

  from_plan := LEAST(w.plan_credits, _amount);
  remaining := _amount - from_plan;
  from_topup := remaining;

  UPDATE public.credit_wallets
     SET plan_credits = plan_credits - from_plan,
         topup_credits = topup_credits - from_topup,
         updated_at = now()
   WHERE user_id = _user_id
   RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

  new_balance := w.plan_credits + w.topup_credits;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
  VALUES (_user_id, 'deduct', _amount, new_balance, _reference_type, _reference_id,
          COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('from_plan', from_plan, 'from_topup', from_topup),
          'completed')
  RETURNING id INTO v_tx;

  plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := new_balance; tx_id := v_tx;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, jsonb) TO service_role;

-- Add credits (top-up purchase, plan grant, admin adjust, refund)
CREATE OR REPLACE FUNCTION public.add_credits(
  _user_id uuid,
  _amount numeric,
  _bucket text,             -- 'plan' or 'topup'
  _type text,               -- 'topup_purchase' | 'plan_grant' | 'admin_adjust' | 'refund'
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
) RETURNS TABLE(plan_credits numeric, topup_credits numeric, balance numeric, tx_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.credit_wallets%rowtype;
  v_tx uuid;
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

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
  VALUES (_user_id, _type, _amount, w.plan_credits + w.topup_credits, _reference_type, _reference_id,
          COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('bucket', _bucket), 'completed')
  RETURNING id INTO v_tx;

  plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := w.plan_credits + w.topup_credits; tx_id := v_tx;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.add_credits(uuid, numeric, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text, uuid, jsonb) TO service_role;

-- Auto-create wallet row on signup
CREATE OR REPLACE FUNCTION public.create_credit_wallet_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.credit_wallets(user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_credit_wallet_for_new_user();

-- Backfill wallets for existing users
INSERT INTO public.credit_wallets(user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
