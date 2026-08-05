// Deno tests for the shared credit-gating helper used by transcribe,
// translate-captions, dub-video, and elevenlabs-dub. Run with:
//   deno test supabase/functions/_shared/rate-limit.test.ts --allow-env

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requireCredits } from "./rate-limit.ts";

// Minimal stub that mimics the small surface of SupabaseClient we use.
function fakeClient(opts: {
  isAdmin?: boolean;
  credits?: number | null;
  profileError?: boolean;
}) {
  return {
    rpc: (_fn: string, _args: unknown) =>
      Promise.resolve({ data: opts.isAdmin === true, error: null }),
    from: (_t: string) => ({
      select: (_c: string) => ({
        eq: (_k: string, _v: string) => ({
          single: () =>
            Promise.resolve(
              opts.profileError
                ? { data: null, error: { message: "boom" } }
                : { data: { credits_seconds: opts.credits ?? 0 }, error: null },
            ),
        }),
      }),
    }),
     
  } as any;
}

Deno.test("admin bypasses credit gating even at 0 credits", async () => {
  const res = await requireCredits(fakeClient({ isAdmin: true, credits: 0 }), "u", 60);
  assertEquals(res.ok, true);
});

Deno.test("non-admin with 0 credits is blocked with 402", async () => {
  const res = await requireCredits(fakeClient({ isAdmin: false, credits: 0 }), "u", 10);
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.status, 402);
    assertEquals(res.message.includes("out of credits"), true);
  }
});

Deno.test("non-admin with fewer credits than needed is blocked with 402", async () => {
  const res = await requireCredits(fakeClient({ isAdmin: false, credits: 5 }), "u", 60);
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.status, 402);
});

Deno.test("non-admin with enough credits is allowed", async () => {
  const res = await requireCredits(fakeClient({ isAdmin: false, credits: 300 }), "u", 60);
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.available, 300);
});

Deno.test("profile read failure returns 500", async () => {
  const res = await requireCredits(fakeClient({ isAdmin: false, profileError: true }), "u", 60);
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.status, 500);
});
