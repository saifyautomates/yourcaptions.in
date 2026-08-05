import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PublicNav } from "@/components/public/PublicNav";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ScrollDownIndicator } from "@/components/public/ScrollDownIndicator";

export function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    const cleanupLegacyCursor = () => {
      document.querySelectorAll<HTMLElement>(
        [
          "[data-custom-cursor]",
          "[data-cursor-dot]",
          "[data-cursor-ring]",
          ".custom-cursor",
          ".cursor-dot",
          ".cursor-ring",
          ".mouse-dot",
          ".mouse-ring",
        ].join(",")
      ).forEach((el) => el.remove());
    };

    cleanupLegacyCursor();
    const observer = new MutationObserver(cleanupLegacyCursor);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="public-site min-h-screen bg-[#050505] text-[#F0F0F0] antialiased">

      <PublicNav />
      <main key={pathname} className="yc-fade-in">
        <Outlet />
      </main>
      <ScrollDownIndicator />
      <PublicFooter />
    </div>
  );
}
