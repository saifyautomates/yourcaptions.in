import { Link } from "react-router-dom";
import { TiltCard } from "@/components/public/vfx/TiltCard";
import { MagneticCTA } from "@/components/public/vfx/MagneticCTA";
import { Reveal } from "@/components/public/vfx/Reveal";
import { CAP_PRESETS } from "@/lib/captionStyle";

const stats = [
  { n: "10,000+", l: "creators" },
  { n: `${CAP_PRESETS.length}+`, l: "viral templates" },
  { n: "100+", l: "languages" },
  { n: "4.9★", l: "user rating" },
];

export default function About() {
  return (
    <div className="bg-[#050505] pt-32 pb-24">
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E60000]">About</div>
        </Reveal>
        <Reveal delay={100}>
          <h1
            className="mt-6 font-extrabold text-white"
            style={{ fontSize: "clamp(40px,6vw,96px)", letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            We built the tool we always{" "}
            <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: "italic", color: "#E60000", fontWeight: 400 }}>
              needed
            </span>
            .
          </h1>
        </Reveal>
        <Reveal delay={250}>
          <p className="mx-auto mt-8 max-w-xl text-[17px] leading-relaxed text-[#888]">
            Yourcaptions.in was built by creators, for creators. We know the pain of wrong timings, broken fonts,
            and hours lost to manual captioning.
          </p>
        </Reveal>
      </section>

      <section className="border-y border-[#1F1F1F] bg-[#0D0D0D] px-6 py-24 text-center">
        <Reveal>
          <p
            className="mx-auto max-w-3xl font-bold text-white"
            style={{ fontSize: "clamp(28px,4vw,56px)", lineHeight: 1.2 }}
          >
            "Every creator deserves tools that speak their language."
          </p>
          <p className="mt-6 text-[16px] text-[#555]">— Yourcaptions.in</p>
        </Reveal>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-24 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <TiltCard key={s.l} className="rounded-[16px] border border-[#1F1F1F] bg-[#0D0D0D] p-8 text-center">
            <div className="font-extrabold text-[#E60000]" style={{ fontSize: "clamp(40px,5vw,64px)" }}>{s.n}</div>
            <div className="mt-2 text-[14px] text-[#888]">{s.l}</div>
          </TiltCard>
        ))}
      </section>

      <section className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-2">
        <Reveal>
          <h2 className="text-[40px] font-bold leading-tight text-white">Why we built this</h2>
        </Reveal>
        <Reveal delay={150}>
          <div className="space-y-6 text-[17px] leading-[1.8] text-[#888]">
            <p>We were creators first. Every reel, every podcast cut, every ad — captions took longer than the edit itself.</p>
            <p>Existing tools were expensive, English-first, and never nailed the timing on Hindi, Punjabi, or Tamil. So we built one that does.</p>
            <p>Today, Yourcaptions.in powers thousands of creators across 100+ languages — with word-level control, on-brand templates, and one-click 4K export.</p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-extrabold text-white" style={{ fontSize: "clamp(32px,4vw,64px)", lineHeight: 1.1 }}>
            Join 10,000+ creators today.
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <Link to="/signup" className="mt-10 inline-block">
            <MagneticCTA className="rounded-lg bg-[#E60000] px-8 py-4 text-[16px] font-bold text-white hover:bg-[#CC0000]">
              Start for free →
            </MagneticCTA>
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
