# Manual QA — Credit gating for Transcribe / Dub / Translate

Verifies that non-admin users with 0 credits cannot spend paid actions and that
admins are never blocked. Pair with the automated tests:

- `src/test/creditGating.test.ts` — frontend `blocked` rule
- `supabase/functions/_shared/rate-limit.test.ts` — server-side `requireCredits`

## Setup

Prepare two accounts:

1. **Normal user** — no admin role. Set balance to 0 in SQL:
   ```sql
   update public.credit_wallets set plan_credits = 0, topup_credits = 0 where user_id = '<uid>';
   update public.profiles set credits_seconds = 0 where id = '<uid>';
   ```
2. **Admin user** — in `user_roles` with role `admin`. Balance can be 0.

## Cases

| # | Actor       | Action                          | Expected                                                             |
|---|-------------|---------------------------------|----------------------------------------------------------------------|
| 1 | Normal (0)  | Open project → Transcribe re-run| Button disabled + "Upgrade plan" pill in top bar menu                |
| 2 | Normal (0)  | Failed job → Retry              | Retry hidden, `Upgrade to retry` CTA shown instead                   |
| 3 | Normal (0)  | Language dropdown → Translate   | Language buttons disabled, upgrade banner at top of Translate list   |
| 4 | Normal (0)  | Dub modal → Preview / Generate  | Both buttons hidden, `UpgradeCTA` banner shown                       |
| 5 | Normal (0)  | Force call `transcribe` fn      | HTTP 402 with "out of credits"                                        |
| 6 | Normal (>0) | All above                       | Buttons enabled, actions succeed                                      |
| 7 | Admin (0)   | All above                       | Buttons enabled, actions succeed; ledger logs `admin_bypass: true`   |

## Server-side smoke via curl

Replace `<JWT>` with a session token for each actor. Expect `402` for case 5,
`200`/queued for cases 6–7.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/transcribe" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<project-uuid>","force":true}'
```

## Realtime check

While logged in as the normal user, run in SQL:
```sql
select public.add_credits('<uid>', 60, 'topup', 'admin_adjust');
```
The Transcribe / Translate / Dub buttons should re-enable within ~1s without
a page refresh (driven by `useCredits` realtime subscription).
