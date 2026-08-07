import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { sanitizeRedirectUrl } from "@/lib/authRedirect";
import { logOAuth } from "@/lib/oauthDebug";

/**
 * Guards authenticated-only routes.
 * - Waits for the auth session to hydrate before deciding.
 * - Shows a "still checking" hint after ~6s and a retry button on failure.
 * - Preserves the intended destination in `location.state.from`.
 */
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, slow, error, retry } = useAuth();
  const location = useLocation();

  if (loading || error) {
    return (
      <LoadingOverlay
        label={error ? "Auth check failed" : "Loading"}
        hint={slow && !error ? "Still checking your session — this is taking longer than usual." : undefined}
        error={error}
        onRetry={retry}
      />
    );
  }

  if (!session) {
    const rawIntended = `${location.pathname}${location.search}${location.hash}`;
    const sanitizedFrom = sanitizeRedirectUrl(rawIntended, "/dashboard");

    logOAuth("protected-route-denied", {
      pathname: location.pathname,
      rawIntended,
      sanitizedFrom,
    });

    return (
      <Navigate
        to="/login"
        replace
        state={{ from: sanitizedFrom }}
      />
    );
  }

  return <>{children}</>;
};

