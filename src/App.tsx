import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { PublicOnlyRoute } from "@/components/PublicOnlyRoute";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { RealtimeDiagnosticsPanel } from "@/components/RealtimeDiagnosticsPanel";

import { useTemplateWarnings } from "@/hooks/useTemplateWarnings";
import { UpgradeGate } from "@/components/UpgradeGate";
import { PublicLayout } from "./layouts/PublicLayout";
import { AnnouncementBar } from "@/components/AnnouncementBar";

// Public marketing pages (lazy)
const Home = lazy(() => import("./pages/HomePage.tsx"));
const Features = lazy(() => import("./pages/public/Features.tsx"));
const Pricing = lazy(() => import("./pages/public/Pricing.tsx"));
const Templates = lazy(() => import("./pages/public/Templates.tsx"));
const About = lazy(() => import("./pages/public/About.tsx"));
const Login = lazy(() => import("./pages/public/Login.tsx"));
const Signup = lazy(() => import("./pages/public/Signup.tsx"));
const Blog = lazy(() => import("./pages/public/Blog.tsx"));
const Contact = lazy(() => import("./pages/public/Contact.tsx"));
const Privacy = lazy(() => import("./pages/public/Privacy.tsx"));
const Terms = lazy(() => import("./pages/public/Terms.tsx"));

const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NewProject = lazy(() => import("./pages/NewProject.tsx"));
const ProjectView = lazy(() => import("./pages/ProjectView.tsx"));
const Plugins = lazy(() => import("./pages/Plugins.tsx"));
const Testimonials = lazy(() => import("./pages/Testimonials.tsx"));

const AdminControlCenter = lazy(() => import("./pages/admin/AdminControlCenter.tsx"));
const AdminShell = lazy(() => import("./components/admin/AdminShell.tsx"));
const AdminOverview = lazy(() => import("./pages/admin/Overview.tsx"));
const AdminUsersPage = lazy(() => import("./pages/admin/Users.tsx"));
const AdminProjectsPage = lazy(() => import("./pages/admin/Projects.tsx"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/Subscriptions.tsx"));
const AdminExportsPage = lazy(() => import("./pages/admin/Exports.tsx"));
const AdminReportsPage = lazy(() => import("./pages/admin/Reports.tsx"));
const AdminSettingsPage = lazy(() => import("./pages/admin/Settings.tsx"));
const AdminFeedbackPage = lazy(() => import("./pages/admin/Feedback.tsx"));
const BatchUploads = lazy(() => import("./pages/BatchUploads.tsx"));
const AssetLibrary = lazy(() => import("./pages/AssetLibrary.tsx"));
const TeamSpaces = lazy(() => import("./pages/TeamSpaces.tsx"));
const SmokeTest = lazy(() => import("./pages/SmokeTest.tsx"));
const TemplatesSmokeTest = lazy(() => import("./pages/TemplatesSmokeTest.tsx"));
const RunLogs = lazy(() => import("./pages/RunLogs.tsx"));
const SecurityIssues = lazy(() => import("./pages/SecurityIssues.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage.tsx"));
const E2ETest = lazy(() => import("./pages/E2ETest.tsx"));
const EditorPreview = lazy(() => import("./pages/EditorPreview.tsx"));
const EditorApp = lazy(() => import("./editor/EditorApp.tsx"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Boot performance telemetry: Web Vitals (LCP/INP/CLS/FCP/TTFB) and
// React Query timing. Both feed into the existing error_logs pipeline
// with severity=info so slow pages surface on /admin/reports.
if (typeof window !== "undefined") {
  void import("./lib/perf/telemetry").then(({ initWebVitals, attachQueryTiming }) => {
    initWebVitals();
    attachQueryTiming(queryClient);
  });
}

// Warm up the most likely next routes during browser idle time so navigating
// after first paint is instant (no chunk fetch on click). Kept intentionally
// tiny — just triggers the same dynamic imports the <Route> lazies use.
const prefetchLikelyRoutes = () => {
  const idle: (cb: () => void) => void =
    (window as any).requestIdleCallback?.bind(window) ??
    ((cb) => setTimeout(cb, 800));
  idle(() => {
    void import("./pages/public/Login.tsx");
    void import("./pages/public/Signup.tsx");
    void import("./pages/Dashboard.tsx");
    void import("./pages/public/Pricing.tsx");
  });
  idle(() => {
    void import("./pages/ProjectView.tsx");
    void import("./pages/NewProject.tsx");
  });
};

const AppShell = ({ children }: { children: ReactNode }) => {
  useTemplateWarnings();
  useEffectOnce(prefetchLikelyRoutes);
  return (
    <>
      <AnnouncementBar />
      {children}
    </>
  );
};

// Tiny inline "run once on mount" — avoids pulling in another hook file.
function useEffectOnce(fn: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ran = (useEffectOnce as any)._r ?? ((useEffectOnce as any)._r = new WeakSet());
    if (ran.has(fn)) return;
    ran.add(fn);
    fn();
  }, [fn]);
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppShell>
          <Suspense fallback={<LoadingOverlay label="Loading" />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route element={<PublicLayout />}>
                <Route path="/features" element={<Features />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/about" element={<About />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
                {/* Legacy aliases */}
                <Route path="/signin" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              </Route>
              <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/plugins" element={<Plugins />} />
              <Route path="/testimonials" element={<Testimonials />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/new" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
              <Route path="/dashboard/project/:id" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
              <Route path="/editor/:projectId" element={<ProtectedRoute><EditorApp /></ProtectedRoute>} />
              <Route path="/dashboard/batch" element={<ProtectedRoute><BatchUploads /></ProtectedRoute>} />
              <Route path="/dashboard/assets" element={<ProtectedRoute><AssetLibrary /></ProtectedRoute>} />
              <Route path="/dashboard/team" element={<ProtectedRoute><TeamSpaces /></ProtectedRoute>} />
              <Route path="/editor-preview" element={<AdminRoute><EditorPreview /></AdminRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminShell /></AdminRoute>}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="projects" element={<AdminProjectsPage />} />
                <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
                <Route path="exports" element={<AdminExportsPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="feedback" element={<AdminFeedbackPage />} />
                <Route path="control-center" element={<AdminControlCenter />} />
              </Route>
              <Route path="/dashboard/security" element={<AdminRoute><SecurityIssues /></AdminRoute>} />
              <Route path="/dashboard/run-logs" element={<AdminRoute><RunLogs /></AdminRoute>} />
              <Route path="/dashboard/smoke-test" element={<AdminRoute><SmokeTest /></AdminRoute>} />
              <Route path="/dashboard/templates-smoke-test" element={<AdminRoute><TemplatesSmokeTest /></AdminRoute>} />
              <Route path="/dashboard/e2e-test" element={<AdminRoute><E2ETest /></AdminRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </AppShell>
          <UpgradeGate />
        </AuthProvider>
      </BrowserRouter>
      <RealtimeDiagnosticsPanel />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
