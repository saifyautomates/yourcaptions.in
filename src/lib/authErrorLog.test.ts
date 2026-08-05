// Unit tests: simulate every common sign-in failure mode and verify the
// friendly message + recovery actions + request-id shape are correct.
import { describe, it, expect } from "vitest";
import {
  friendlyAuthMessage,
  recoveryActionsFor,
  newAuthRequestId,
  type AuthMethod,
} from "./authErrorLog";

interface Case {
  name: string;
  err: { message?: string; status?: number | null; code?: string | null };
  method: AuthMethod;
  friendlyMatch: RegExp;
  recovery: string[];
}

const CASES: Case[] = [
  {
    name: "invalid credentials",
    err: { message: "Invalid login credentials", status: 400 },
    method: "password-signin",
    friendlyMatch: /incorrect/i,
    recovery: ["retry", "reset-password", "try-google"],
  },
  {
    name: "user not found",
    err: { message: "User not found", status: 400 },
    method: "password-signin",
    friendlyMatch: /no account/i,
    recovery: ["create-account", "try-google"],
  },
  {
    name: "email not confirmed",
    err: { message: "Email not confirmed", code: "email_not_confirmed", status: 400 },
    method: "password-signin",
    friendlyMatch: /confirm/i,
    recovery: ["resend-confirmation", "retry"],
  },
  {
    name: "rate limited",
    err: { message: "Too many requests", status: 429 },
    method: "password-signin",
    friendlyMatch: /too many/i,
    recovery: ["wait-and-retry"],
  },
  {
    name: "network failure",
    err: { message: "Failed to fetch" },
    method: "password-signin",
    friendlyMatch: /network/i,
    recovery: ["check-network", "retry"],
  },
  {
    name: "user already exists on signup",
    err: { message: "User already registered", status: 400 },
    method: "password-signup",
    friendlyMatch: /already exists/i,
    recovery: ["reset-password"],
  },
  {
    name: "weak password",
    err: { message: "Password is too weak", status: 400 },
    method: "password-signup",
    friendlyMatch: /too weak/i,
    recovery: ["retry"],
  },
  {
    name: "oauth cancelled",
    err: { message: "Popup closed by user" },
    method: "oauth-google",
    friendlyMatch: /cancel/i,
    recovery: ["retry", "try-google"],
  },
  {
    name: "generic fallback",
    err: { message: "Something exploded" },
    method: "password-signin",
    friendlyMatch: /exploded/i,
    recovery: ["retry", "contact-support"],
  },
];

describe("auth failure mapping", () => {
  for (const c of CASES) {
    it(`${c.name} → correct friendly + recovery`, () => {
      const n = {
        message: c.err.message ?? "",
        status: c.err.status ?? null,
        code: c.err.code ?? null,
        name: null,
        supabaseRequestId: null,
        raw: c.err,
      };
      expect(friendlyAuthMessage(n, c.method)).toMatch(c.friendlyMatch);
      expect(recoveryActionsFor(n, c.method)).toEqual(c.recovery);
    });
  }
});

describe("newAuthRequestId", () => {
  it("returns a stable rid_<t>_<r> shape", () => {
    const rid = newAuthRequestId();
    expect(rid).toMatch(/^rid_[a-z0-9]+_[a-z0-9]+$/);
  });
  it("returns unique IDs across calls", () => {
    const a = newAuthRequestId();
    const b = newAuthRequestId();
    expect(a).not.toBe(b);
  });
});
