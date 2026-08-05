import { Reveal } from "@/components/public/vfx/Reveal";
import { CAP_PRESETS } from "@/lib/captionStyle";

type F = { n: string; name: string; desc: string; pill: string; mock: React.ReactNode };

const features: F[] = [
  {
    n: "01",
    name: "Instant Transcription",
    desc: "Upload any video. Word-perfect captions in under 2 minutes. 100+ languages detected automatically.",
    pill: "⚡ 2 min avg",
    mock: <MockWaveform />,
  },
  {
    n: "02",
    name: "Visual Caption Editor",
    desc: "Style every word. Drag anything. See live on canvas. Ghost effects, keyword highlights, RTL support.",
    pill: "🎨 Live canvas",
    mock: <MockEditor />,
  },
  {
    n: "03",
    name: "AI Voice Dubbing",
    desc: "Clone any voice. Translate. Dub in any language. Indistinguishable from human.",
    pill: "🌐 100+ langs",
    mock: <MockDub />,
  },
  {
    n: "04",
    name: "Burn & Export",
    desc: "Burn styled captions permanently. Export MP4, SRT, VTT, TXT in one click.",
    pill: "📤 4 formats",
    mock: <MockExport />,
  },
  {
    n: "05",
    name: "Team Collaboration",
    desc: "Invite your editor. Share projects. Comment on captions. Ship together.",
    pill: "👥 Unlimited seats",
    mock: <MockTeam />,
  },
  {
    n: "06",
    name: "Template Library",
    desc: `${CAP_PRESETS.length}+ curated caption styles from top YouTube and Instagram creators.`,
    pill: `✨ ${CAP_PRESETS.length}+ styles`,
    mock: <MockTemplates />,
  },
];

export default function Features() {
  return (
    <div className="bg-[#050505] pb-32 pt-32">
      <section className="mx-auto max-w-7xl px-6 py-24">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E60000]">Features</div>
        </Reveal>
        <Reveal delay={100}>
          <h1
            className="mt-6 max-w-4xl font-extrabold text-white"
            style={{ fontSize: "clamp(48px,7vw,112px)", letterSpacing: "-0.03em", lineHeight: 0.95 }}
          >
            Built for every word. Every{" "}
            <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: "italic", color: "#E60000", fontWeight: 400 }}>
              creator
            </span>
            .
          </h1>
        </Reveal>
        <Reveal delay={250}>
          <p className="mt-8 max-w-xl text-[18px] text-[#888]">One tool. Every language. Zero compromise.</p>
        </Reveal>
      </section>

      <div className="space-y-32">
        {features.map((f, i) => (
          <section key={f.n} className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div
                className={`grid items-center gap-16 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E60000]">{f.n}</div>
                  <h3 className="mt-4 text-[40px] font-bold leading-tight text-white">{f.name}</h3>
                  <p className="mt-6 max-w-[440px] text-[17px] leading-[1.7] text-[#888]">{f.desc}</p>
                  <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-3 py-1.5 text-[12px] text-[#888]">
                    {f.pill}
                  </div>
                </div>
                <div
                  className="relative aspect-[4/3] overflow-hidden rounded-[20px] border border-[#1F1F1F] bg-[#0D0D0D] p-6"
                  style={{ boxShadow: "0 0 80px rgba(230,0,0,0.06)" }}
                >
                  {f.mock}
                </div>
              </div>
            </Reveal>
          </section>
        ))}
      </div>
    </div>
  );
}

function MockWaveform() {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-end gap-1 h-24">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="w-1 rounded-full bg-[#E60000]/60" style={{ height: `${20 + Math.abs(Math.sin(i)) * 80}%` }} />
        ))}
      </div>
      <div className="space-y-2 text-[13px]">
        <div className="text-[#555]">00:00:02 →</div>
        <div className="text-white">The future of captioning</div>
        <div className="text-white">is <span className="text-[#E60000]">right</span> here<span className="animate-pulse text-[#E60000]">|</span></div>
      </div>
    </div>
  );
}
function MockEditor() {
  return (
    <div className="grid h-full grid-cols-[1fr_140px] gap-3">
      <div className="flex items-center justify-center rounded-lg bg-[#141414] text-white">
        <div className="text-center">
          <div className="text-[22px] font-bold">EVERY <span className="text-[#E60000]">WORD</span></div>
          <div className="text-[14px] text-[#888]">counts.</div>
        </div>
      </div>
      <div className="space-y-2 text-[11px]">
        {["Font", "Size", "Color", "Weight", "Glow"].map((l) => (
          <div key={l} className="rounded border border-[#2A2A2A] bg-[#141414] px-2 py-1.5 text-[#888]">{l}</div>
        ))}
      </div>
    </div>
  );
}
function MockDub() {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center gap-2 text-[13px]"><span className="text-[#E60000]">●</span> <span className="text-white">Voice cloning</span></div>
      <div className="flex items-center justify-center gap-1">
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} className="w-1 rounded bg-[#E60000]/70" style={{ height: `${10 + Math.sin(i * 0.6) * 30 + 20}px` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {["EN", "HI", "ES", "FR", "AR", "JA", "KO", "DE"].map((l) => (
          <span key={l} className="rounded border border-[#2A2A2A] px-2 py-1 text-[#888]">{l}</span>
        ))}
      </div>
    </div>
  );
}
function MockExport() {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="text-[13px] text-white">Export</div>
      <div className="grid grid-cols-2 gap-2">
        {["MP4", "SRT", "VTT", "TXT"].map((f, i) => (
          <div key={f} className={`rounded-lg border p-3 text-[13px] ${i === 0 ? "border-[#E60000] bg-[#E60000]/10 text-white" : "border-[#2A2A2A] text-[#888]"}`}>
            {f}
          </div>
        ))}
      </div>
      <button className="rounded-lg bg-[#E60000] px-4 py-2 text-[13px] font-semibold text-white">Export video</button>
    </div>
  );
}
function MockTeam() {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex -space-x-2">
        {["S", "A", "R", "K"].map((l, i) => (
          <div key={i} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0D0D0D] bg-[#E60000] text-[12px] font-bold text-white">{l}</div>
        ))}
      </div>
      <div className="space-y-2">
        {["Reel 01 · Shared", "Podcast · In review", "Ad cut · Live"].map((p, i) => (
          <div key={i} className="flex items-center justify-between rounded border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-[13px]">
            <span className="text-white">{p}</span><span className="text-[#E60000]">●</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function MockTemplates() {
  return (
    <div className="grid h-full grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center rounded-lg bg-[#141414] text-[11px] font-bold text-white">
          <span style={{ color: i % 2 === 0 ? "#E60000" : "#fff" }}>Style {i + 1}</span>
        </div>
      ))}
    </div>
  );
}
