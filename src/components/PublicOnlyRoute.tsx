import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingOverlay } from "@/components/LoadingOverlay";

/**
 * Guards pages that only make sense for signed-out visitors (sign-in / sign-up
 * / password recovery). If the user is already authenticated we send them to
 * the intended destination or the dashboard — never back to the same page,
 * which would cause a redirect loop.
 */
export const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingOverlay label="Loading" />;
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    const target = from && from !== location.pathname ? from : "/dashboard";
    // No-op guard: don't navigate to the page we're already on.
    if (target === `${location.pathname}${location.search}${location.hash}`) {
      return <>{children}</>;
    }
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};
