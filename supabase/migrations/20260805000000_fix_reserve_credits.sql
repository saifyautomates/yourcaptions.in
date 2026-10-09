DROP FUNCTION IF EXISTS public.reserve_credits(uuid, numeric, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.reserve_credits;

CREATE OR REPLACE FUNCTION public.reserve_credits(p_user_id uuid, p_amount numeric, p_reference_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_wallet record;
  v_plan_deduct numeric := 0;
  v_topup_deduct numeric := 0;
  v_balance_after numeric := 0;
BEGIN
  -- 1) Lock the wallet row to prevent race conditions
  SELECT * INTO v_wallet
  FROM public.credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF (v_wallet.plan_credits + v_wallet.topup_credits) < p_amount THEN
    RETURN FALSE;
  END IF;

  -- 2) Calculate deduction (prefer plan credits)
  IF v_wallet.plan_credits >= p_amount THEN
    v_plan_deduct := p_amount;
  ELSE
    v_plan_deduct := v_wallet.plan_credits;
    v_topup_deduct := p_amount - v_wallet.plan_credits;
  END IF;

  -- 3) Update wallet
  UPDATE public.credit_wallets
  SET 
    plan_credits = plan_credits - v_plan_deduct,
    topup_credits = topup_credits - v_topup_deduct,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING (plan_credits + topup_credits) INTO v_balance_after;

  -- 4) Log transaction
  INSERT INTO public.credit_transactions (
    user_id, amount, type, reference_id, reference_type, metadata, balance_after
  ) VALUES (
    p_user_id, -p_amount, 'reserve', p_reference_id, p_reference_type, p_metadata, v_balance_after
  );

  RETURN TRUE;
END;
$function$;

-- Also fix the refund job (CHECK 2 / BUG: Credits not refunded when worker crashes)
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.refund_stuck_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT id, user_id, type 
    FROM public.render_jobs 
    WHERE status = 'processing' AND updated_at < now() - interval '30 minutes'
  LOOP
    -- Mark as error
    UPDATE public.render_jobs SET status = 'failed', error = 'Worker timeout' WHERE id = v_job.id;
    
    -- Refund credits (dummy 1 for now, or calculate based on job if needed, but since it's reserve we just refund 1 for example, but actually let's call a refund function or just give back topup_credits if we don't know the exact amount. Assuming 1 minute = 1 credit = 1 deducted. Let's just give back 1 topup_credit as a fallback.)
    -- To be proper, we should find the transaction.
    -- Better yet, we can look up the transaction amount.
    DECLARE
      v_amount numeric;
      v_balance_after numeric;
    BEGIN
      SELECT ABS(amount) INTO v_amount FROM public.credit_transactions 
      WHERE reference_id = v_job.id AND type = 'reserve' LIMIT 1;
      
      IF v_amount IS NOT NULL THEN
        UPDATE public.credit_wallets
        SET topup_credits = topup_credits + v_amount, updated_at = now()
        WHERE user_id = v_job.user_id
        RETURNING (plan_credits + topup_credits) INTO v_balance_after;
        
        INSERT INTO public.credit_transactions (
          user_id, amount, type, reference_id, reference_type, metadata, balance_after
        ) VALUES (
          v_job.user_id, v_amount, 'refund', v_job.id, 'render_job', '{"reason": "timeout refund"}'::jsonb, v_balance_after
        );
      END IF;
    END;
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('refund_stuck_jobs_cron');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('refund_stuck_jobs_cron', '*/5 * * * *', 'SELECT public.refund_stuck_jobs()');

-- BUG: Plan credits reset on wrong date (1st of month instead of billing anniversary)
-- We need to check DATE_PART('day', now()) = DATE_PART('day', plan_credits_reset_at)
CREATE OR REPLACE FUNCTION public.reset_plan_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.credit_wallets cw
  SET 
    plan_credits = p.credits_seconds,
    plan_credits_reset_at = cw.plan_credits_reset_at + interval '1 month',
    updated_at = now()
  FROM public.profiles p
  WHERE cw.user_id = p.id
  AND DATE_PART('day', now()) = DATE_PART('day', cw.plan_credits_reset_at)
  AND cw.plan_credits_reset_at <= now();
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('reset_plan_credits_cron');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('reset_plan_credits_cron', '0 0 * * *', 'SELECT public.reset_plan_credits()');


REVOKE ALL ON FUNCTION public.refund_stuck_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_stuck_jobs() TO service_role;

REVOKE ALL ON FUNCTION public.reset_plan_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_plan_credits() TO service_role;
