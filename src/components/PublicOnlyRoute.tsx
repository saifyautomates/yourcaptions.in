import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { sanitizeRedirectUrl } from "@/lib/authRedirect";
import { logOAuth } from "@/lib/oauthDebug";

/**
 * Guards pages that only make sense for signed-out visitors (sign-in / sign-up
 * / password recovery). If the user is already authenticated we send them to
 * the intended destination or the dashboard — never back to an auth page or the
 * same page, which would cause a redirect loop.
 */
export const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, hydrating } = useAuth();
  const location = useLocation();

  if (loading || hydrating) {
    return <LoadingOverlay label="Loading..." />;
  }

  if (session) {
    const stateFrom = (location.state as { from?: string } | null)?.from;
    const searchParams = new URLSearchParams(location.search);
    const queryNext = searchParams.get("next") || searchParams.get("returnTo") || searchParams.get("redirect");

    const rawCandidate = stateFrom || queryNext || "/dashboard";
    const target = sanitizeRedirectUrl(rawCandidate, "/dashboard");

    logOAuth("public-only-route-redirect", {
      currentPath: location.pathname,
      stateFrom,
      queryNext,
      rawCandidate,
      resolvedTarget: target,
      userId: session.user?.id,
    });

    // Guard against redirecting to current page or an auth path
    const currentFull = `${location.pathname}${location.search}${location.hash}`;
    if (target === currentFull || target === location.pathname) {
      logOAuth("public-only-route-loop-prevented", {
        currentPath: location.pathname,
        target,
        fallbackTo: "/dashboard",
      });
      return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};
