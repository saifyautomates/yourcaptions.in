import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/templates", label: "Templates" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
];

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 md:px-6 pointer-events-none transition-all duration-300">
      <div
        className={`w-full max-w-[1440px] pointer-events-auto rounded-[24px] relative overflow-hidden transition-all duration-300 shadow-2xl border ${
          scrolled ? "bg-[#0A0A0A]/90 border-white/20 backdrop-blur-xl" : "bg-black/60 border-white/15 backdrop-blur-md"
        }`}
      >
        <div 
          className="relative z-10 mx-auto flex items-center justify-between px-6 py-3 w-full h-full transition-all duration-300"
        >
          <Logo />

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                data-cursor="hover"
                className={({ isActive }) =>
                  `text-[14px] font-medium transition-colors ${isActive ? "text-white" : "text-[#888] hover:text-white"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-5 md:flex">
            <Link
              to={user ? "/dashboard" : "/signup"}
              data-cursor="hover"
              className="rounded-full bg-[#E60000] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#CC0000]"
            >
              {user ? "Dashboard" : "Get Started"}
            </Link>
          </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2A2A2A] text-white md:hidden"
        >
          <span className="text-lg">{open ? "×" : "≡"}</span>
        </button>
      </div>

      {open && (
        <div className="border-t border-[#1F1F1F] bg-[#050505] px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-[15px] text-[#888]">
                {l.label}
              </Link>
            ))}
            {user && (
              <Link to="/dashboard" onClick={() => setOpen(false)} className="text-[15px] text-white">
                Dashboard
              </Link>
            )}
            <Link
              to={user ? "/dashboard" : "/signup"}
              onClick={() => setOpen(false)}
              className="rounded-md bg-[#E60000] px-4 py-2 text-center text-[14px] font-semibold text-white"
            >
              {user ? "Open app" : "Get Started"}
            </Link>
          </nav>
        </div>
      )}
      </div>
    </header>
  );
}
