import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FolderKanban, CreditCard, Download,
  Flag, Settings as SettingsIcon, LogOut, Menu, ShieldCheck,
  Film, Activity, ShieldAlert, ScrollText, Bug, Gauge, MessageSquare,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { prefetchAdminRoute, prefetchAllAdminRoutes } from "@/components/admin/prefetch";


const primary = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/admin/exports", label: "Exports & Renders", icon: Download },
  { to: "/admin/reports", label: "Reports & Flags", icon: Flag },
  { to: "/admin/feedback", label: "User feedback", icon: MessageSquare },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

const advanced = [
  { to: "/admin/hero", label: "Hero video", icon: Film },
  { to: "/admin/usage", label: "Usage summary", icon: Activity },
  { to: "/admin/roles", label: "Role management", icon: ShieldCheck },
  { to: "/admin/alerts", label: "Security alerts", icon: ShieldAlert },
  { to: "/admin/performance", label: "Performance", icon: Gauge },
  { to: "/admin/errors", label: "Error logs", icon: Bug },
  { to: "/dashboard/run-logs", label: "Run logs", icon: ScrollText },
];

const NavList = ({ onNavigate }: { onNavigate?: () => void }) => {
  const renderItem = (i: { to: string; label: string; icon: any; end?: boolean }) => (
    <NavLink
      key={i.to}
      to={i.to}
      end={i.end}
      onClick={onNavigate}
      onMouseEnter={() => prefetchAdminRoute(i.to)}
      onFocus={() => prefetchAdminRoute(i.to)}
      onTouchStart={() => prefetchAdminRoute(i.to)}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
          isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        )
      }
    >
      <i.icon className="h-4 w-4" />
      <span className="truncate">{i.label}</span>
    </NavLink>
  );
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Admin</p>
      {primary.map(renderItem)}
      <p className="mt-4 px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Advanced</p>
      {advanced.map(renderItem)}
    </nav>
  );
};


const SidebarFooter = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (user?.email?.[0] ?? "A").toUpperCase();
  return (
    <div className="mt-auto border-t border-border/60 p-3">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/20 text-primary text-xs">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{user?.email ?? "Admin"}</p>
          <p className="text-[10px] text-muted-foreground">Signed in</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Sign out"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const SidebarHeader = () => (
  <div className="flex flex-col items-start gap-2 border-b border-border/60 px-4 py-4">
    <Link to="/" className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight text-foreground hover:text-foreground/80 transition-colors">
      Home
    </Link>
    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] text-primary">
      Admin
    </Badge>
  </div>
);

const DesktopSidebar = () => (
  <aside className="hidden lg:flex fixed inset-y-0 left-0 z-20 w-60 flex-col border-r border-border/60 bg-card/40 backdrop-blur">
    <SidebarHeader />
    <div className="flex-1 overflow-y-auto">
      <NavList />
    </div>
    <SidebarFooter />
  </aside>
);

const MobileNav = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarHeader />
            <div className="flex h-[calc(100dvh-4rem)] flex-col">
              <div className="flex-1 overflow-y-auto"><NavList onNavigate={() => setOpen(false)} /></div>
              <SidebarFooter />
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Admin</span>
        </div>
        <div className="w-9" />
      </div>
      {children}
    </>
  );
};

export const AdminShell = () => {
  const location = useLocation();
  useEffect(() => { prefetchAllAdminRoutes(); }, []);

  const current =
    [...primary, ...advanced].find((i) =>
      i.to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(i.to)
    )?.label ?? "Admin";
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <DesktopSidebar />
      <MobileNav>
        <main className="lg:pl-60">
          <header className="hidden lg:flex items-center gap-2 border-b border-border/60 px-6 py-3">
            <h1 className="text-sm font-medium text-muted-foreground">Admin</h1>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-semibold">{current}</span>
          </header>
          <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </MobileNav>
    </div>
  );
};

export default AdminShell;
