import { Link } from "react-router-dom";
import { Reveal } from "@/components/public/vfx/Reveal";
import { MagneticCTA } from "@/components/public/vfx/MagneticCTA";
import { useAuth } from "@/hooks/useAuth";
import { HeroFeedbackForm } from "@/components/public/HeroFeedbackForm";
import { motion } from "framer-motion";

export default function Home() {
  const { user } = useAuth();
  const ctaTo = user ? "/dashboard" : "/signup";

  return (
    <>
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#050505] px-6 pt-24">      
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 800px 600px at 50% 40%, rgba(230,0,0,0.08), transparent 70%)",
        }}
      />
      <motion.div 
        className="relative z-10 mx-auto flex max-w-[1440px] flex-col items-center text-center"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, staggerChildren: 0.2 }}
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#888]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#E60000]" />
          AI-Powered · 100+ Languages · Frame-Accurate
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="mt-8 font-extrabold text-white"
          style={{
            fontSize: "clamp(48px, 8vw, 112px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.88,
            fontFamily: '"Inter", sans-serif',
          }}
        >
          Captions that make
          <br />
          people <span style={{ color: "#E60000" }}>watch till the end</span>.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-8 max-w-[780px] text-[18px] leading-relaxed text-[#B8B8B8]"
        >
          Built for creators who speak{" "}
          <span className="font-semibold text-white">Hindi</span>,{" "}
          <span className="font-semibold text-white">English</span>,{" "}
          <span className="font-semibold text-white">Hinglish</span>,{" "}
          <span className="font-semibold text-white">Urdu</span>,{" "}
          <span className="font-semibold text-white">Punjabi</span>,{" "}
          <span className="font-semibold text-white">Tamil</span>{" "}
          <span className="text-[#A3A3A3]">— and</span>{" "}
          <span className="font-semibold text-[#E60000]">100+ more languages</span>.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6"
        >
          <Link to={ctaTo}>
            <MagneticCTA className="rounded-lg bg-[#E60000] px-8 py-4 text-[16px] font-bold text-white shadow-[0_0_60px_rgba(230,0,0,0.35)] hover:bg-[#CC0000]">
              {user ? "Open dashboard →" : "Start for free →"}
            </MagneticCTA>
          </Link>
          <Link to="/features" data-cursor="hover" className="text-[15px] text-[#888] hover:text-white">
            See how it works ▶
          </Link>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 flex flex-wrap items-center justify-center gap-8 text-[13px]"
        >
          <Stat n="10,000+" l="creators" />
          <span className="h-8 w-px bg-[#2A2A2A]" />
          <Stat n="100+" l="languages" />
          <span className="h-8 w-px bg-[#2A2A2A]" />
          <Stat n="< 2 min" l="turnaround" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <HeroFeedbackForm />
        </motion.div>
      </motion.div>
      <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="h-10 w-px bg-gradient-to-b from-transparent via-[#E60000] to-transparent animate-pulse" />
      </div>
    </section>{/* ============ FEATURES ============ */}
    <section className="relative bg-[#050505] px-6 py-32">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <div className="mb-16 text-center">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FF4D4D]">Built for creators</div>
            <h2 className="text-white" style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              Everything you need.<br /><span className="text-[#8A8A8A]">Nothing you don't.</span>
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { t: "Frame-accurate AI", d: "Word-level timing tuned for TikTok, Reels and Shorts. Zero drift.", i: "◈" },
            { t: "100+ languages", d: "Auto-detect, translate and dub in one pass. Native accents included.", i: "◉" },
            { t: "150+ templates", d: "Karaoke, kinetic type, emoji pops. All editable in real time.", i: "◇" },
            { t: "One-click export", d: "MP4, MOV, burned-in or SRT. 4K supported. No watermark on Pro.", i: "▲" },
            { t: "Team-ready", d: "Roles, shared brand kits, comments and version history built in.", i: "●" },
            { t: "Blazing fast", d: "< 2 min turnaround on a 5-minute video. Cloud-rendered at scale.", i: "⚡" },
          ].map((f, i) => (
            <Reveal key={f.t} delay={i * 60}>
              <div className="group h-full rounded-2xl border border-[#1F1F1F] bg-[#0B0B0B] p-8 transition-all hover:border-[#E60000]/50 hover:bg-[#111]">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E60000]/10 text-[24px] text-[#E60000]">{f.i}</div>
                <div className="mb-2 text-[18px] font-bold text-white">{f.t}</div>
                <div className="text-[14px] leading-relaxed text-[#888]">{f.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    {/* ============ HOW IT WORKS ============ */}
    <section className="relative bg-[#0A0A0A] px-6 py-32">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <div className="mb-20 text-center">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E60000]">How it works</div>
            <h2 className="text-white" style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              Three steps. Under two minutes.
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-10 md:grid-cols-3">
          {[
            { n: "01", t: "Upload", d: "Drop any video — up to 4K, any length, any language." },
            { n: "02", t: "Style", d: "Pick a template or design your own. Edit words live." },
            { n: "03", t: "Export", d: "Download burned-in captions or SRT. Share instantly." },
          ].map((step, i) => (
            <Reveal key={step.n} delay={i * 120}>
              <div className="relative">
                <div className="mb-6 text-[80px] font-black leading-none text-[#E60000]/20">{step.n}</div>
                <div className="mb-2 text-[22px] font-bold text-white">{step.t}</div>
                <div className="text-[15px] leading-relaxed text-[#888]">{step.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    {/* ============ LANGUAGES ============ */}
    <section className="relative overflow-hidden border-y border-[#1F1F1F] bg-[#050505] py-16">
      <div className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B0B0B0]">
        Supported in 100+ languages
      </div>
      <div className="flex gap-12 whitespace-nowrap opacity-70" style={{ animation: "marquee-x 40s linear infinite" }}>
        {[..."English · Español · हिन्दी · العربية · 中文 · Français · Português · Deutsch · 日本語 · 한국어 · Italiano · Nederlands · Türkçe · Русский · Bahasa · ไทย · Tiếng Việt · Polski · Українська · Tagalog".split(" · "), ..."English · Español · हिन्दी · العربية · 中文 · Français · Português · Deutsch · 日本語 · 한국어".split(" · ")].map((l, i) => (
          <span key={i} className="text-[24px] font-medium text-white">{l}</span>
        ))}
      </div>
    </section>




    {/* ============ FINAL CTA ============ */}
    <section className="relative overflow-hidden bg-[#050505] px-6 py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 900px 400px at 50% 50%, rgba(230,0,0,0.15), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-[900px] text-center">
        <Reveal>
          <h2 className="text-white" style={{ fontSize: "clamp(40px,6vw,88px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 0.95 }}>
            Ready to caption<br />in every language?
          </h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="mx-auto mt-6 max-w-[560px] text-[17px] text-[#888]">
            Free forever plan. No credit card. Export your first video in under 2 minutes.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            <Link to={ctaTo}>
              <MagneticCTA className="rounded-lg bg-[#E60000] px-10 py-5 text-[17px] font-bold text-white shadow-[0_0_80px_rgba(230,0,0,0.45)] hover:bg-[#CC0000]">
                {user ? "Open dashboard →" : "Start for free →"}
              </MagneticCTA>
            </Link>
            <Link to="/pricing" data-cursor="hover" className="text-[15px] text-[#888] hover:text-white">
              See pricing
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
    </>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[24px] font-bold text-white">{n}</div>
      <div className="text-[13px] text-[#888]">{l}</div>
    </div>
  );
}
