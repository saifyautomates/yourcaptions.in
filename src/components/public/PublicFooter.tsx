import { Link, NavLink } from "react-router-dom";
import { Twitter, Instagram, Youtube } from "lucide-react";
import { Logo } from "@/components/Logo";

const col = (title: string, items: { label: string; to: string }[]) => (
  <div>
    <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FF4D4D]">{title}</div>
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <NavLink
            to={i.to}
            end
            data-cursor="hover"
            className={({ isActive }) =>
              `text-[14px] transition-colors ${
                isActive
                  ? "text-white font-medium border-l-2 border-[#E60000] pl-2"
                  : "text-[#B8B8B8] hover:text-white"
              }`
            }
          >
            {i.label}
          </NavLink>
        </li>
      ))}
    </ul>
  </div>
);

export function PublicFooter() {
  return (
    <footer className="border-t border-[#1F1F1F] bg-[#0D0D0D] pt-16 pb-10">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[#B8B8B8]">
              AI captions, styling and one-click export.
              <br />Built for creators who speak every language.
            </p>
            <div className="mt-6 flex gap-4">
              <a href="https://twitter.com/Yourcaptions" target="_blank" rel="noopener noreferrer" data-cursor="hover" aria-label="Twitter" className="text-[#B8B8B8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E60000] rounded">
                <Twitter aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </a>
              <a href="https://instagram.com/Yourcaptions" target="_blank" rel="noopener noreferrer" data-cursor="hover" aria-label="Instagram" className="text-[#B8B8B8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E60000] rounded">
                <Instagram aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </a>
              <a href="https://youtube.com/@Yourcaptions" target="_blank" rel="noopener noreferrer" data-cursor="hover" aria-label="YouTube" className="text-[#B8B8B8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E60000] rounded">
                <Youtube aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">YouTube</span>
              </a>
            </div>
          </div>
          {col("Product", [
            { label: "Features", to: "/features" },
            { label: "Pricing", to: "/pricing" },
            { label: "Live Demo", to: "/#playground" },
          ])}
          {col("Company", [
            { label: "About", to: "/about" },
            { label: "Blog", to: "/blog" },
            { label: "Contact", to: "/contact" },
            { label: "Support", to: "/contact" },
            { label: "Privacy Policy", to: "/privacy" },
            { label: "Terms of Service", to: "/terms" },
          ])}
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-[#1F1F1F] pt-6 text-[13px] md:flex-row">
          <div className="text-[#B8B8B8]">© {new Date().getFullYear()} Yourcaptions.in</div>
          <div className="text-[#8A8A8A]">Made with ♥ for creators</div>
          <div className="flex gap-3 text-[#B8B8B8]">
            <Link to="/contact" className="hover:text-white">Support</Link>
            <span aria-hidden="true" className="text-[#555]">·</span>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <span aria-hidden="true" className="text-[#555]">·</span>
            <Link to="/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
