import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TiltCard } from "@/components/public/vfx/TiltCard";
import { Reveal } from "@/components/public/vfx/Reveal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CAP_PRESETS, DEFAULT_CAP_STYLE } from "@/lib/captionStyle";

const cats = ["All", "Core Pack", "Creators", "YT Creators", "Ultimate", "Podcast", "Cinematic"] as const;

export default function Templates() {
  const [active, setActive] = useState<string>("All");
  const { user } = useAuth();
  const nav = useNavigate();

  const shown = useMemo(() => {
    return active === "All"
      ? CAP_PRESETS
      : CAP_PRESETS.filter((t) => (t.category || "Core Pack") === active);
  }, [active]);

  const apply = (id: string) => {
    if (!user) { toast.info("Sign in to apply this template"); nav(`/login?next=/templates`); return; }
    nav(`/dashboard?applyTemplate=${encodeURIComponent(id)}`);
  };

  return (
    <div className="bg-[#050505] pt-32 pb-24">
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E60000]">Templates</div>
        </Reveal>
        <Reveal delay={100}>
          <h1
            className="mt-6 font-extrabold text-white"
            style={{ fontSize: "clamp(40px,6vw,96px)", letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            {CAP_PRESETS.length}+ styles. One{" "}
            <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: "italic", color: "#E60000", fontWeight: 400 }}>
              click
            </span>{" "}
            to apply.
          </h1>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-6">
        <div className="scroll-row mb-12 flex flex-wrap justify-center gap-2">
          {cats.map((c) => {
            const on = c === active;
            return (
              <button
                key={c}
                data-cursor="hover"
                onClick={() => setActive(c)}
                className={`rounded-full border px-4 py-1.5 text-[13px] transition-colors ${
                  on ? "border-white text-white" : "border-[#1F1F1F] text-[#555] hover:text-white"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((t, i) => {
            const fg = t.patch.color ?? DEFAULT_CAP_STYLE.color;
            const bg = t.patch.bgOn ? (t.patch.bgColor ?? DEFAULT_CAP_STYLE.bgColor) : "#0D0D0D";
            const fontFam = t.patch.fontFamily ?? DEFAULT_CAP_STYLE.fontFamily;
            const weight = t.patch.fontWeight ?? DEFAULT_CAP_STYLE.fontWeight;
            const italic = t.patch.italic ?? DEFAULT_CAP_STYLE.italic;
            
            return (
            <TiltCard
              key={t.name + i}
              max={10}
              className="cursor-pointer overflow-hidden rounded-[16px] border border-[#1F1F1F] bg-[#0D0D0D]"
              onClick={() => apply(t.name)}
            >
              <div
                className="group relative flex aspect-video items-center justify-center overflow-hidden"
                style={{ background: bg }}
              >
                <div
                  className="px-4 text-center transition-transform duration-500 group-hover:scale-[1.05]"
                  style={{
                    color: fg,
                    fontWeight: weight,
                    fontStyle: italic ? "italic" : "normal",
                    fontFamily: fontFam,
                    fontSize: "clamp(18px, 2.4vw, 28px)",
                    letterSpacing: weight >= 800 ? "-0.01em" : 0,
                  }}
                >
                  Every word matters
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="rounded-md bg-[#E60000] px-4 py-2 text-[13px] font-semibold text-white">Apply</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="text-[15px] font-semibold text-white">{t.name}</div>
                <div className="text-[12px] uppercase tracking-wider text-[#E60000]">{t.category || "Core"}</div>
              </div>
            </TiltCard>
          )})}
        </div>
      </section>
    </div>
  );
}
