import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { supabase } from "@/integrations/supabase/client";

/**
 * Guards admin-only routes. Requires an authenticated user AND the 'admin'
 * role. Every attempt is recorded via `log_admin_access_attempt` so the admin
 * security dashboard can flag repeated denied access.
 */
export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, slow, error, retry } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const location = useLocation();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || roleLoading || !user) return;
    const key = `${location.pathname}|${isAdmin}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    void (supabase.rpc as any)("log_admin_access_attempt", {
      _path: location.pathname,
      _allowed: isAdmin,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
    });
  }, [authLoading, roleLoading, user, isAdmin, location.pathname]);

  if (authLoading || roleLoading || error) {
    return (
      <LoadingOverlay
        label={error ? "Auth check failed" : "Checking access"}
        hint={slow && !error ? "Still verifying your admin role…" : undefined}
        error={error}
        onRetry={retry}
      />
    );
  }
  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};
