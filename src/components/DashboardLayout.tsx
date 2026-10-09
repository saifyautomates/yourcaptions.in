// Studio-grade creator app shell.
// 240px dark sidebar, top bar with breadcrumbs and user avatar, main content. Subscription, Manage
// Plugins, Help & Support. Persistent FREE / MONTHLY usage card at the bottom
// with Storage / Transcription / Audio Clean bars + Upgrade Now.

import { ReactNode, useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { getPlanCapabilities, PLANS } from "@/lib/plans";
import { Progress } from "@/components/ui/progress";

import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { AccountPanel } from "./dashboard/AccountPanel";
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
  { to: "/pricing", label: "Billing & Subscription", icon: CreditCard },
  { to: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
  { to: "/contact", label: "Help & Support", icon: LifeBuoy },
];



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
  const { planId, planName } = usePlanInfo();
  const { balance } = useCredits();
  const caps = getPlanCapabilities(planId);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 px-2 pt-2">
        <Logo onClick={onNavigate} />
      </div>

      <nav className="flex flex-col gap-6 flex-1" aria-label="Primary">
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
      
        {!isAdmin && (
          <div className="mt-auto pt-8 pb-4">
            <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-[14px] text-white uppercase tracking-wide">{planName}</span>
                <span className="text-[10px] font-bold text-[#4ba475] border border-[#4ba475]/30 bg-[#4ba475]/10 px-2 py-0.5 rounded uppercase tracking-wider">Monthly</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span className="text-[#a1a1aa] font-medium">Storage</span>
                    <span className="text-[#71717a] font-medium"><span className="text-[#4ba475]">0 GB</span> / 5.0 GB</span>
                  </div>
                  <div className="h-2 w-full bg-[#24352b] rounded-full overflow-hidden">
                    <div className="h-full bg-[#4ba475] rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span className="text-[#a1a1aa] font-medium">Transcription</span>
                    <span className="text-[#71717a] font-medium"><span className="text-[#4ba475]">{Number(Math.max(0, balance)).toFixed(1)} mins</span> left</span>
                  </div>
                  <div className="h-2 w-full bg-[#24352b] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#4ba475] rounded-full" 
                      style={{ width: `${Math.min(100, Math.max(0, (balance / caps.monthlyMinutes) * 100))}%` }} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span className="text-[#a1a1aa] font-medium">Audio Clean</span>
                    <span className="text-[#71717a] font-medium"><span className="text-[#4ba475]">0</span> / 3</span>
                  </div>
                  <div className="h-2 w-full bg-[#24352b] rounded-full overflow-hidden">
                    <div className="h-full bg-[#4ba475] rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
              </div>
              
              <Link to="/pricing" onClick={onNavigate}>
                <button className="w-full mt-6 bg-[#4ba475] hover:bg-[#3f8c63] text-white font-semibold text-[14px] py-2.5 rounded-lg transition-colors">
                  Upgrade Now
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </div>
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

          {/* Right section: Account Panel */}
          <div className="flex items-center gap-2">
            <AccountPanel />
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
          className="safe-bottom fixed bottom-[76px] left-1/2 -translate-x-1/2 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_rgba(230,0,0,0.6)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </Link>
      )}

      <MobileBottomNav />
    </div>
  );
};
