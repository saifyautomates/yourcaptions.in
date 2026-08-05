// Kalakar-style app shell.
// Left rail: Home, Recent Projects, Tutorials, Manage Subscription, Manage
// Plugins, Help & Support. Persistent FREE / MONTHLY usage card at the bottom
// with Storage / Transcription / Audio Clean bars + Upgrade Now.

import { ReactNode, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Clock,
  GraduationCap,
  CreditCard,
  Puzzle,
  LifeBuoy,
  Shield,
  Menu,
  LogOut,
  ArrowUpRight,
  ChevronDown,
  Settings as SettingsIcon,
  Clapperboard,
  Bell,
  Plus,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
//
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/Logo";

const MAIN_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home, end: true },
  { to: "/dashboard/batch", label: "Recent Projects", icon: Clock },
  { to: "/dashboard/new", label: "Uploads", icon: Plus },
  { to: "/dashboard/batch", label: "My Exports", icon: Clapperboard },
];

const CREATE_NAV = [
  { to: "/templates", label: "Templates", icon: LayoutGrid },
  { to: "/dashboard/assets", label: "Brand Kits", icon: Sparkles },
];

const ACCOUNT_NAV = [
  { to: "/pricing", label: "Subscription", icon: CreditCard },
  { to: "/pricing", label: "Billing & Credits", icon: CreditCard },
  { to: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
  { to: "/coming-soon", label: "Help & Support", icon: LifeBuoy },
];

interface UsageBarProps {
  label: string;
  used: number;
  quota: number;
  rightText: string;
}

const UsageBar = ({ label, used, quota, rightText }: UsageBarProps) => {
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const rounded = Math.round(pct);
  return (
    <div className="mt-3 first:mt-0">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground/90">{rightText}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${rightText}`}
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const UNLIMITED_THRESHOLD = 1e12;
const isUnlimited = (q?: number) => (q ?? 0) > UNLIMITED_THRESHOLD;

import { useCredits } from "@/hooks/useCredits";
import { usePlanInfo } from "@/hooks/usePlanInfo";

import { getPlanCapabilities } from "@/lib/plans";
import { format } from "date-fns";

const UsageCard = () => {
  const { planCredits, isAdmin, loading } = useCredits();
  const { planName, planId, renewsAt, isPaid } = usePlanInfo();

  if (loading) return null;

  const caps = getPlanCapabilities(planId);
  const maxMins = caps.monthlyMinutes;
  const pct = Math.min(100, Math.max(0, (planCredits / maxMins) * 100));

  return (
    <div className="mt-4 rounded-2xl border border-border/50 bg-[#101010] p-4">
      <div className="mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {isAdmin ? "ADMIN" : `${planName} PLAN`}
        </span>
      </div>
      
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">
          {isAdmin ? "∞" : planCredits}
        </span>
        {!isAdmin && (
          <span className="text-[14px] font-medium text-muted-foreground">
            / {maxMins} min
          </span>
        )}
      </div>

      {!isAdmin && renewsAt && (
        <div className="mb-4 text-[12px] text-muted-foreground">
          Renews on {format(renewsAt, "d MMM yyyy")}
        </div>
      )}

      {!isAdmin && (
        <>
          <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>

          <Link
            to="/pricing"
            className="flex w-full items-center justify-center rounded-lg bg-primary py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isPaid ? "Change Plan" : "Upgrade Plan"}
          </Link>
          
          <div className="mt-4 flex flex-col items-center gap-1 text-center">
            <span className="text-[12px] text-muted-foreground">Need more minutes?</span>
            <Link to="/pricing" className="text-[12px] font-medium text-primary hover:underline underline-offset-2">
              Buy Add-on Minutes &rarr;
            </Link>
          </div>
        </>
      )}
    </div>
  );
};


// Shared NavLink class factory — kept inline to avoid re-declaration noise.
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar ${
    isActive
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
  }`;

const NavContent = ({
  isAdmin,
  user,
  onSignOut,
  onNavigate,
}: {
  isAdmin: boolean;
  user: any;
  onSignOut: () => void;
  onNavigate?: () => void;
}) => {
  return (
    <>
      <div className="mb-6 px-2 pt-2">
        <Logo onClick={onNavigate} />
      </div>

      <nav className="flex flex-col gap-6" aria-label="Primary">
        <div>
          <div className="mb-2 px-3 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60">Main</div>
          <div className="flex flex-col gap-1">
            {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={label} to={to} end={end} onClick={onNavigate} className={navLinkClass}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 px-3 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60">Create</div>
          <div className="flex flex-col gap-1">
            {CREATE_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={label} to={to} end={end} onClick={onNavigate} className={navLinkClass}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 px-3 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60">Account</div>
          <div className="flex flex-col gap-1">
            {ACCOUNT_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={label} to={to} end={end} onClick={onNavigate} className={navLinkClass}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="border-t border-border/50 pt-4">
            <div className="mb-2 px-3 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Admin
            </div>
            <NavLink to="/admin" onClick={onNavigate} className={navLinkClass}>
              <Shield className="h-[18px] w-[18px]" aria-hidden="true" />
              Admin panel
            </NavLink>
          </div>
        )}
      </nav>

      <div className="mt-auto">
        <UsageCard />
        <div className="mt-4 flex items-center justify-between gap-3 px-2 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2 overflow-hidden">
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold text-foreground">
              {(user?.user_metadata?.full_name ?? user?.email ?? "?").toString().charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-foreground/80 font-medium" title={user?.email}>{user?.user_metadata?.full_name ?? user?.email}</span>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
};

// Icon-only rail shown on tablet widths (md → lg). Same nav targets, no
// labels/UsageCard so it fits in 64px. Tooltips replace the labels.
const IconRail = ({ isAdmin, onSignOut }: { isAdmin: boolean; onSignOut: () => void }) => {
  const items = [
    ...MAIN_NAV,
    ...CREATE_NAV,
    ...ACCOUNT_NAV,
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield, end: undefined }] : []),
  ];
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col items-center gap-1 py-4">
        <Link to="/" className="mb-4" aria-label="Yourcaptions home">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-[16px] font-black text-primary">Y</span>
        </Link>
        {items.map(({ to, label, icon: Icon, end }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <NavLink
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) =>
                  `flex h-11 w-11 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
        <div className="mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

// Fixed bottom navigation bar (mobile only). 60px, safe-area padded.
const MOBILE_TABS = [
  { to: "/dashboard", label: "Home", icon: Home, end: true },
  { to: "/dashboard/batch", label: "Projects", icon: Clock },
  { to: "/dashboard/new", label: "New", icon: Sparkles },
  { to: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary mobile"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex h-[60px] max-w-[520px] items-stretch justify-around">
        {MOBILE_TABS.map(({ to, label, icon: Icon, end }) => {
          const active = end ? pathname === to : pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export const DashboardLayout = ({ children, fullWidth, headerCenter }: { children: ReactNode, fullWidth?: boolean, headerCenter?: ReactNode }) => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Hide the FAB on the /new page (redundant) and on non-dashboard app pages
  const showFab = location.pathname === "/dashboard" || location.pathname === "/dashboard/batch";
  const initial = (user?.user_metadata?.full_name ?? user?.email ?? "?").toString().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh w-full bg-background">
      {/* Skip link — first focusable element for keyboard users */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to main content
      </a>

      {/* Tablet icon rail (md only) — 64px */}
      <aside
        className="sticky top-0 hidden h-dvh w-16 shrink-0 border-r border-border bg-sidebar md:flex lg:hidden"
        aria-label="Sidebar (compact)"
      >
        <IconRail isAdmin={isAdmin} onSignOut={handleSignOut} />
      </aside>

      {/* Desktop full sidebar (lg+) — 256px */}
      <aside
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-5 lg:flex"
        aria-label="Sidebar"
      >
        <NavContent isAdmin={isAdmin} user={user} onSignOut={handleSignOut} />
      </aside>

      <main
        id="dashboard-main"
        tabIndex={-1}
        className="min-w-0 flex-1 overflow-x-hidden pb-[calc(60px+env(safe-area-inset-bottom))] focus:outline-none md:pb-0"
      >
        {/* Top bar — mobile: hamburger | logo | bell+avatar. tablet+: right-side cluster only. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-3 backdrop-blur sm:px-4">
          {/* Left: mobile hamburger */}
          <div className="flex items-center md:hidden">
            <Drawer open={open} onOpenChange={setOpen}>
              <DrawerTrigger asChild>
                <button
                  aria-label="Open navigation menu"
                  aria-expanded={open}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card/60 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </DrawerTrigger>
              <DrawerContent className="flex flex-col bg-sidebar h-[85vh] max-h-[85vh]">
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <div className="flex flex-col min-h-full gap-4 pb-6">
                    <NavContent
                      isAdmin={isAdmin}
                      user={user}
                      onSignOut={handleSignOut}
                      onNavigate={() => setOpen(false)}
                    />
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </div>

          {/* Center: empty on mobile only */}
          <div className="md:hidden -ml-2">
            <Logo />
          </div>
          <div className="hidden flex-1 md:flex items-center px-4">{headerCenter}</div>

          {/* Right: bell + upgrade + avatar */}
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/errors"
              aria-label="Notifications"
              className="hidden h-11 w-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              to="/pricing"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
            >
              Upgrade <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 py-1 pl-1 pr-2 sm:pr-3 ml-2 cursor-pointer hover:bg-card/80 transition-colors">
              <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-[12px] font-bold text-primary">
                {initial}
              </span>
              <span className="hidden max-w-[140px] truncate text-[13px] font-medium sm:inline">
                {user?.user_metadata?.full_name ?? user?.email}
              </span>
            </div>
          </div>
        </header>

        <div className={`mx-auto w-full ${fullWidth ? "max-w-[1600px]" : "max-w-6xl"} px-4 py-6 sm:px-8 sm:py-8`}>
          {children}
        </div>
      </main>

      {/* Mobile floating action button — 56px red circle */}
      {showFab && (
        <Link
          to="/dashboard/new"
          aria-label="New project"
          className="safe-bottom fixed bottom-[76px] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_rgba(230,0,0,0.6)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </Link>
      )}

      <MobileBottomNav />
    </div>
  );
};
