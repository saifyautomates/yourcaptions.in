import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { CtaButton } from "@/components/ui/cta-button";
import { useAuth } from "@/hooks/useAuth";
import { MaintenanceBanner } from "./MaintenanceBanner";

const nav = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
];


export const SiteHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Escape to close + body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Click outside closes
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate("/");
  };

  return (
    <>
      <MaintenanceBanner />
      <header className="sticky top-3 z-50 mx-auto w-[min(1100px,calc(100%-1rem))] sm:top-4 sm:w-[min(1100px,calc(100%-2rem))]">
        <div className="flex items-center justify-between gap-2 rounded-full border border-border bg-card/80 px-3 py-2 backdrop-blur-lg sm:px-5 sm:py-3">
          <Link to="/" aria-label="home" className="min-w-0 shrink-0 text-lg font-bold tracking-tight text-white hover:text-white/80 transition-colors px-2">
            Home
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm transition-colors hover:text-foreground ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            {user ? (
              <div className="flex items-center gap-2">
                <CtaButton as="link" to="/dashboard" variant="primary" size="sm">
                  Dashboard
                  <ArrowUpRight className="h-4 w-4" />
                </CtaButton>
                <CtaButton variant="secondary" size="sm" onClick={handleSignOut}>
                  Sign out
                </CtaButton>
              </div>
            ) : (
              <CtaButton as="link" to="/signin" variant="primary" size="sm">
                Sign In
                <ArrowUpRight className="h-4 w-4" />
              </CtaButton>
            )}
          </div>

          {/* Mobile trigger */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-mobile-menu"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background/60 text-foreground transition-colors hover:bg-card md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        <div
          id="site-mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={`md:hidden origin-top overflow-hidden transition-[transform,opacity,max-height] duration-200 ease-out ${
            open ? "mt-2 max-h-[80vh] scale-y-100 opacity-100" : "pointer-events-none mt-0 max-h-0 scale-y-95 opacity-0"
          }`}
        >
          <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-lg">
            <nav className="flex flex-col">
              {nav.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {user ? (
                <>
                  <CtaButton
                    as="link"
                    to="/dashboard"
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={() => setOpen(false)}
                  >
                    Dashboard
                    <ArrowUpRight className="h-4 w-4" />
                  </CtaButton>
                  <CtaButton variant="secondary" size="md" fullWidth onClick={handleSignOut}>
                    Sign out
                  </CtaButton>
                </>
              ) : (
                <>
                  <CtaButton
                    as="link"
                    to="/signup"
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={() => setOpen(false)}
                  >
                    Start free
                    <ArrowUpRight className="h-4 w-4" />
                  </CtaButton>
                  <CtaButton
                    as="link"
                    to="/signin"
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </CtaButton>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Scrim behind dropdown — click-outside handled separately, this is only visual */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-background/50 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
    </>
  );
};
