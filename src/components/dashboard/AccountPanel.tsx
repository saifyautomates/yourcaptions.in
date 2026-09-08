import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Settings,
  CreditCard,
  Star,
  Activity,
  Plus,
  Bell,
  HelpCircle,
  FileText,
  LogOut,
  Shield,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { useCredits } from "@/hooks/useCredits";

export const AccountPanel = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { planName } = usePlanInfo();
  const { planCredits } = useCredits();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (!user) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/60 p-2 shadow-sm backdrop-blur-xl md:flex-row">
        <Link
          to="/login"
          className="flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign In
        </Link>
        <Link
          to="/signup"
          className="flex items-center justify-center rounded-xl bg-secondary px-4 py-2 text-[13px] font-medium text-foreground hover:bg-secondary/80 transition-colors"
        >
          Create Account
        </Link>
      </div>
    );
  }

  const initial = (profile?.fullName ?? user?.user_metadata?.full_name ?? user?.email ?? "?").toString().charAt(0).toUpperCase();
  const fullName = profile?.fullName ?? user?.user_metadata?.full_name ?? user?.email;
  const email = profile?.email ?? user?.email;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`group relative flex items-center justify-center rounded-full border border-border/40 bg-card/70 p-1 shadow-sm backdrop-blur-xl transition-all hover:bg-card/90 hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${open ? "bg-card/90 border-border/60" : ""}`}
        >
          <div className="relative">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {initial}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
          </div>
          {/* Text is hidden to keep it small as requested */}
          <div className="hidden flex-col items-start text-left">
            <span className="text-[12px] font-semibold text-foreground/90 max-w-[100px] truncate leading-tight">{fullName}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{isAdmin ? "Admin" : planName}</span>
          </div>
          <ChevronUp className={`hidden text-muted-foreground transition-transform duration-300`} />
        </button>
      </DropdownMenuTrigger>
        
        <DropdownMenuContent
          align="end"
          sideOffset={16}
          className="w-72 rounded-2xl border-border/40 bg-card/80 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
        >
          <div className="flex flex-col gap-1 p-2">
            <span className="text-[14px] font-semibold truncate">{fullName}</span>
            <span className="text-[12px] text-muted-foreground truncate">{email}</span>
          </div>

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/dashboard/settings">
                <User className="mr-3 h-4 w-4" />
                <span>My Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/dashboard/settings">
                <Settings className="mr-3 h-4 w-4" />
                <span>Account Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/pricing">
                <CreditCard className="mr-3 h-4 w-4" />
                <span>Billing & Subscription</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/pricing">
                <Star className="mr-3 h-4 w-4" />
                <span>Current Plan: {planName}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/dashboard">
                <Activity className="mr-3 h-4 w-4" />
                <div className="flex flex-1 items-center justify-between">
                  <span>Usage & Minutes</span>
                  <span className="text-xs font-semibold text-muted-foreground">{isAdmin ? '∞' : planCredits}</span>
                </div>
              </Link>
            </DropdownMenuItem>
            {!isAdmin && (
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
                <Link to="/pricing">
                  <Plus className="mr-3 h-4 w-4" />
                  <span>Buy More Minutes</span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/dashboard/errors">
                <Bell className="mr-3 h-4 w-4" />
                <span>Notifications</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/contact">
                <HelpCircle className="mr-3 h-4 w-4" />
                <span>Help & Support</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
              <Link to="/terms">
                <FileText className="mr-3 h-4 w-4" />
                <span>Documentation</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {isAdmin && (
            <>
              <DropdownMenuSeparator className="my-1 bg-border/40" />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary">
                  <Link to="/admin">
                    <Shield className="mr-3 h-4 w-4" />
                    <span>Admin Dashboard</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer rounded-xl py-2.5 text-red-500 focus:bg-red-500/10 focus:text-red-500"
          >
            <LogOut className="mr-3 h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  );
};
