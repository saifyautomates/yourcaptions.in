// Component tests: render <AuthErrorRecovery /> for each sign-in failure mode
// and assert the correct recovery buttons appear with the enriched request ID.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthErrorRecovery } from "./AuthErrorRecovery";
import type { LoggedAuthError, RecoveryAction, AuthMethod } from "@/lib/authErrorLog";

// Sonner uses matchMedia + createPortal; keep the DOM quiet.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

function build(overrides: Partial<LoggedAuthError> & { recovery: RecoveryAction[]; method: AuthMethod }): LoggedAuthError {
  return {
    requestId: "rid_test_abc123",
    method: overrides.method,
    stage: "initiate",
    friendly: overrides.friendly ?? "Something went wrong",
    recovery: overrides.recovery,
    message: overrides.message ?? "raw error",
    status: overrides.status ?? null,
    code: overrides.code ?? null,
    name: null,
    supabaseRequestId: null,
    raw: overrides.raw ?? { message: overrides.message ?? "raw error" },
    category: overrides.category ?? "unknown",
    categoryLabel: overrides.categoryLabel ?? "Sign-in failed",
  };
}

const cases: Array<{
  name: string;
  err: LoggedAuthError;
  expected: RegExp[];
  forbidden?: RegExp[];
}> = [
  {
    name: "invalid credentials",
    err: build({
      method: "password-signin",
      friendly: "Email or password is incorrect.",
      recovery: ["retry", "reset-password", "try-google"],
      status: 400,
    }),
    expected: [/try again/i, /reset password/i, /continue with google/i],
  },
  {
    name: "user not found",
    err: build({
      method: "password-signin",
      friendly: "No account matches that email.",
      recovery: ["create-account", "try-google"],
    }),
    expected: [/create an account/i, /continue with google/i],
    forbidden: [/try again/i],
  },
  {
    name: "email not confirmed",
    err: build({
      method: "password-signin",
      friendly: "Please confirm your email address before signing in.",
      recovery: ["resend-confirmation", "retry"],
      code: "email_not_confirmed",
    }),
    expected: [/resend confirmation/i, /try again/i],
  },
  {
    name: "rate limited",
    err: build({
      method: "password-signin",
      friendly: "Too many attempts. Please wait a moment and try again.",
      recovery: ["wait-and-retry"],
      status: 429,
    }),
    expected: [/wait 30s/i],
  },
  {
    name: "network failure",
    err: build({
      method: "password-signin",
      friendly: "Network hiccup. Check your connection and retry.",
      recovery: ["check-network", "retry"],
    }),
    expected: [/check connection/i, /try again/i],
  },
  {
    name: "generic fallback",
    err: build({
      method: "password-signin",
      friendly: "Authentication failed.",
      recovery: ["retry", "contact-support"],
    }),
    expected: [/try again/i, /contact support/i],
  },
];

describe("AuthErrorRecovery renders correct actions per failure mode", () => {
  for (const c of cases) {
    it(c.name, () => {
      render(
        <MemoryRouter>
          <AuthErrorRecovery error={c.err} email="user@example.com" />
        </MemoryRouter>,
      );
      // The friendly message is always shown.
      expect(screen.getByText(c.err.friendly)).toBeInTheDocument();
      // The request ID is exposed for support correlation.
      expect(screen.getByText(new RegExp(`req:\\s*${c.err.requestId}`))).toBeInTheDocument();
      // Every expected recovery action is rendered as a button.
      for (const re of c.expected) {
        expect(screen.getByRole("button", { name: re })).toBeInTheDocument();
      }
      // Actions not in the recovery list must not appear.
      for (const re of c.forbidden ?? []) {
        expect(screen.queryByRole("button", { name: re })).not.toBeInTheDocument();
      }
    });
  }

  it("shows status and code when present", () => {
    const err = build({
      method: "password-signin",
      friendly: "Email or password is incorrect.",
      recovery: ["retry"],
      status: 400,
      code: "invalid_credentials",
    });
    render(
      <MemoryRouter>
        <AuthErrorRecovery error={err} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/status:\s*400/)).toBeInTheDocument();
    expect(screen.getByText(/code:\s*invalid_credentials/)).toBeInTheDocument();
  });
});
