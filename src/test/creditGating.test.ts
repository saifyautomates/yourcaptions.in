// Frontend unit test for the blocked-state logic used by useCredits.
// Mirrors the hook's rule: blocked = !isAdmin && !loading && (wallet + legacy) <= 0.

import { describe, it, expect } from "vitest";

function computeBlocked(s: {
  isAdmin: boolean;
  loading: boolean;
  planCredits: number;
  topupCredits: number;
  legacySeconds: number;
}) {
  const total = s.planCredits + s.topupCredits + s.legacySeconds;
  return !s.isAdmin && !s.loading && total <= 0;
}

describe("credit gating — blocked flag", () => {
  const base = { isAdmin: false, loading: false, planCredits: 0, topupCredits: 0, legacySeconds: 0 };

  it("blocks a normal user with 0 credits everywhere", () => {
    expect(computeBlocked(base)).toBe(true);
  });

  it("does not block while still loading", () => {
    expect(computeBlocked({ ...base, loading: true })).toBe(false);
  });

  it("never blocks admins, even at 0 credits", () => {
    expect(computeBlocked({ ...base, isAdmin: true })).toBe(false);
  });

  it("allows a user with plan credits", () => {
    expect(computeBlocked({ ...base, planCredits: 10 })).toBe(false);
  });

  it("allows a user with only top-up credits", () => {
    expect(computeBlocked({ ...base, topupCredits: 5 })).toBe(false);
  });

  it("allows a user with only legacy credits_seconds", () => {
    expect(computeBlocked({ ...base, legacySeconds: 120 })).toBe(false);
  });
});
