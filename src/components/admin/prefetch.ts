// Central registry of admin route → dynamic import.
// Used to warm chunks on hover and on shell mount so navigation feels instant.
export const ADMIN_ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  "/admin": () => import("@/pages/admin/Overview"),
  "/admin/users": () => import("@/pages/admin/Users"),
  "/admin/projects": () => import("@/pages/admin/Projects"),
  "/admin/subscriptions": () => import("@/pages/admin/Subscriptions"),
  "/admin/exports": () => import("@/pages/admin/Exports"),
  "/admin/reports": () => import("@/pages/admin/Reports"),
  "/admin/settings": () => import("@/pages/admin/Settings"),
  "/dashboard/run-logs": () => import("@/pages/RunLogs"),
};

const warmed = new Set<string>();
export const prefetchAdminRoute = (path: string) => {
  if (warmed.has(path)) return;
  const loader = ADMIN_ROUTE_LOADERS[path];
  if (!loader) return;
  warmed.add(path);
  void loader().catch(() => warmed.delete(path));
};

export const prefetchAllAdminRoutes = () => {
  const idle: (cb: () => void) => void =
    (window as any).requestIdleCallback?.bind(window) ??
    ((cb) => setTimeout(cb, 400));
  idle(() => {
    for (const path of Object.keys(ADMIN_ROUTE_LOADERS)) prefetchAdminRoute(path);
  });
};
