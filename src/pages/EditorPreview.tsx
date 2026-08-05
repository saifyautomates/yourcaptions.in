import { useState } from "react";
import {
  Captions,
  Type,
  Music2,
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Volume2,
  Sparkles,
  Palette,
  Wand2,
  ChevronDown,
} from "lucide-react";

/**
 * EditorPreview — pixel-perfect layout mock for the redesigned editor.
 * Route: /editor-preview
 *
 * Locked proportions per spec:
 *  - Header 60px
 *  - Tool sidebar 70px
 *  - Left panel 38%  (Actions/Timing 65% + Timeline 35%)
 *  - Center canvas 37%
 *  - Right panel  25%
 *
 * Theme: bg-zinc-950 dark surface, red-500 primary accent.
 * All content is mock — no live state wired.
 */
export default function EditorPreview() {
  const [tool, setTool] = useState<"captions" | "fonts" | "audio">("captions");
  const [tab, setTab] = useState<"text" | "templates" | "transitions">("templates");
  const [playing, setPlaying] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(0);
  const tpl = TEMPLATES[activeTemplate].overlay;

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased">
      {/* 1. TOP HEADER --------------------------------------------------- */}
      <header className="h-[60px] w-full flex justify-between items-center px-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-md bg-red-500/15 border border-red-500/30 grid place-items-center">
            <Sparkles className="h-4 w-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Untitled reel — 21 Jul 2026</div>
            <div className="text-[11px] text-zinc-500 truncate">Auto-saved · 00:34 ago</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-xs text-zinc-400 hover:text-zinc-200 transition">Share</button>
          <button className="text-xs text-zinc-400 hover:text-zinc-200 transition">Export</button>
          <button className="h-8 rounded-md bg-red-500 hover:bg-red-400 px-3 text-xs font-semibold text-zinc-950 transition shadow-[0_0_0_1px_rgba(230,0,0,0.35),0_6px_16px_-6px_rgba(230,0,0,0.6)]">
            Upgrade
          </button>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-400 to-red-700 grid place-items-center text-[11px] font-semibold text-zinc-950 ring-2 ring-zinc-900">
            RS
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE --------------------------------------------- */}
      <div className="flex w-full" style={{ height: "calc(100vh - 60px)" }}>
        {/* 3. FAR-LEFT TOOL SIDEBAR ------------------------------------ */}
        <aside className="w-[70px] shrink-0 flex flex-col items-center py-4 border-r border-zinc-800 bg-zinc-950 gap-1">
          <ToolIcon icon={Captions} label="Captions" active={tool === "captions"} onClick={() => setTool("captions")} />
          <ToolIcon icon={Type}     label="Fonts"    active={tool === "fonts"}    onClick={() => setTool("fonts")} />
          <ToolIcon icon={Music2}   label="Audio"    active={tool === "audio"}    onClick={() => setTool("audio")} />
          <div className="mt-auto flex flex-col items-center gap-1">
            <ToolIcon icon={Wand2}   label="Magic" />
            <ToolIcon icon={Palette} label="Style" />
          </div>
        </aside>

        {/* 4. LEFT PANEL (Settings + Timeline) ------------------------- */}
        <section className="w-[38%] shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950 min-w-0">
          {/* Top 65% — Actions + Timing */}
          <div className="basis-[65%] grow-0 shrink-0 overflow-y-auto px-5 py-4 space-y-6 border-b border-zinc-800">
            <SectionHeader title="Actions" subtitle="One-tap clean-ups" />
            <div className="space-y-2">
              <ToggleRow label="Remove punctuation"       defaultOn={true} />
              <ToggleRow label="Remove emojis"            defaultOn={false} />
              <ToggleRow label="Remove filler words (um, uh)" defaultOn={true} />
              <ToggleRow label="Auto-capitalize sentences" defaultOn={true} />
              <ToggleRow label="Merge short lines"        defaultOn={false} />
            </div>

            <SectionHeader title="Timing" subtitle="Per-word alignment" />
            <div className="space-y-4">
              <SliderRow label="Words per line" value={3} min={1} max={7} unit="w" />
              <SliderRow label="Min duration"   value={420} min={100} max={1500} unit="ms" />
              <SliderRow label="Max duration"   value={2400} min={800} max={5000} unit="ms" />
              <SliderRow label="Lead-in offset" value={-80} min={-400} max={400} unit="ms" />
            </div>
          </div>

          {/* Bottom 35% — Multi-track timeline */}
          <div className="basis-[35%] grow-0 shrink-0 flex flex-col bg-zinc-950/60 min-h-0">
            <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-zinc-800">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                <span>Timeline</span>
                <span className="text-zinc-700">·</span>
                <span className="text-zinc-400 normal-case tracking-normal font-medium">00:12.400 / 00:34.800</span>
              </div>
              <div className="flex items-center gap-1">
                <IconBtn icon={Scissors} />
                <IconBtn icon={Volume2} />
              </div>
            </div>

            {/* Ruler */}
            <div className="h-5 shrink-0 relative border-b border-zinc-800/70 bg-zinc-950">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-800/80" style={{ left: `${(i / 12) * 100}%` }}>
                  <span className="absolute left-1 top-0.5 text-[9px] text-zinc-600 font-mono">{`00:${String(i * 3).padStart(2, "0")}`}</span>
                </div>
              ))}
            </div>

            {/* Tracks */}
            <div className="relative flex-1 overflow-hidden">
              {/* Playhead */}
              <div className="absolute top-0 bottom-0 z-20 w-[2px] bg-red-400 shadow-[0_0_8px_rgba(230,0,0,0.7)]" style={{ left: "36%" }}>
                <div className="absolute -top-[1px] -left-[5px] h-3 w-3 rotate-45 bg-red-400 shadow-[0_0_6px_rgba(230,0,0,0.9)]" />
              </div>

              <div className="flex flex-col gap-1.5 px-2 py-2">
                <TrackRow label="V1" color="bg-red-500/25" border="border-red-500/40" clips={[{ l: 4, w: 62 }]} />
                <TrackRow label="A1" waveform clips={[{ l: 4, w: 62 }]} />
                <TrackRow label="T1" color="bg-sky-500/20" border="border-sky-500/40" clips={[{ l: 8, w: 20 }, { l: 34, w: 14 }, { l: 52, w: 18 }]} />
                <TrackRow label="FX" color="bg-fuchsia-500/20" border="border-fuchsia-500/40" clips={[{ l: 20, w: 10 }, { l: 44, w: 8 }]} />
              </div>
            </div>
          </div>
        </section>

        {/* 5. CENTER CANVAS ------------------------------------------- */}
        <section className="w-[37%] shrink-0 flex flex-col items-center justify-center bg-zinc-900 border-r border-zinc-800 min-w-0 relative">
          <div className="flex-1 w-full flex items-center justify-center p-6 min-h-0">
            <div className="relative h-full aspect-[9/16] max-h-full rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-zinc-800 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
              {/* Mock frame */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(230,0,0,0.15),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.12),transparent_50%)]" />
              {/* Center subject silhouette */}
              <div className="absolute inset-x-0 top-1/3 flex justify-center">
                <div className="h-24 w-24 rounded-full bg-zinc-700/60 backdrop-blur-sm ring-2 ring-white/10" />
              </div>
              {/* Floating caption overlay — driven by the selected template card */}
              <div className="absolute inset-x-0 bottom-16 flex justify-center px-4">
                <div className="rounded-lg bg-black/70 backdrop-blur px-4 py-2 shadow-lg ring-1 ring-white/10">
                  <div
                    className="flex items-baseline gap-1.5 text-lg leading-none tracking-tight transition-all duration-300"
                    style={{
                      fontWeight: tpl.weight,
                      letterSpacing: tpl.tracking,
                      textTransform: tpl.transform,
                    }}
                  >
                    <span style={{ color: tpl.base }}>this</span>
                    <span
                      style={{
                        color: tpl.accent,
                        textShadow: tpl.glowRgba === "rgba(255,255,255,0.0)"
                          ? undefined
                          : `0 0 12px ${tpl.glowRgba}, 0 0 22px ${tpl.glowRgba}`,
                      }}
                    >
                      changes
                    </span>
                    <span style={{ color: tpl.base }}>everything</span>
                  </div>
                </div>
              </div>
              {/* Corner badges */}
              <div className="absolute top-3 left-3 text-[10px] font-mono text-white/70 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded">9:16 · 1080p</div>
              <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(230,0,0,0.9)] animate-pulse" />
            </div>
          </div>

          {/* Playback bar */}
          <div className="w-full shrink-0 h-14 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur px-4 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <IconBtn icon={SkipBack} />
              <button
                onClick={() => setPlaying((p) => !p)}
                className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-400 grid place-items-center text-zinc-950 transition shadow-[0_0_0_1px_rgba(230,0,0,0.35),0_6px_16px_-6px_rgba(230,0,0,0.6)]"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <IconBtn icon={SkipForward} />
            </div>
            <div className="flex-1 flex items-center gap-3">
              <span className="text-[11px] font-mono text-zinc-400 tabular-nums">00:12.4</span>
              <div className="relative flex-1 h-1 rounded-full bg-zinc-800">
                <div className="absolute inset-y-0 left-0 rounded-full bg-red-500" style={{ width: "36%" }} />
                <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md ring-2 ring-red-500" style={{ left: "36%", transform: "translate(-50%,-50%)" }} />
              </div>
              <span className="text-[11px] font-mono text-zinc-500 tabular-nums">00:34.8</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Volume2 className="h-4 w-4" />
              <div className="w-16 h-1 rounded-full bg-zinc-800">
                <div className="h-full w-3/4 rounded-full bg-zinc-400" />
              </div>
            </div>
          </div>
        </section>

        {/* 6. RIGHT PANEL (Templates) --------------------------------- */}
        <section className="w-[25%] shrink-0 flex flex-col p-4 bg-zinc-950 min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1 border border-zinc-800">
            {(["text", "templates", "transitions"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 h-8 rounded-md text-[12px] font-semibold capitalize transition ${
                  tab === t
                    ? "bg-red-500 text-zinc-950 shadow-[0_2px_10px_-2px_rgba(230,0,0,0.55)]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              placeholder="Search templates…"
              className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 pl-9 pr-3 text-[12px] placeholder:text-zinc-600 focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 transition"
            />
          </div>

          {/* Color pickers */}
          <div className="mt-3 flex items-center gap-1.5">
            {["#E60000", "#f43f5e", "#3b82f6", "#f59e0b", "#a855f7", "#ffffff"].map((c, i) => (
              <button
                key={c}
                className={`h-6 w-6 rounded-full ring-2 transition ${i === 0 ? "ring-red-400 scale-110" : "ring-zinc-800 hover:ring-zinc-600"}`}
                style={{ background: c }}
              />
            ))}
            <button className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5">
              More <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Template list */}
          <div className="mt-3 flex-1 overflow-y-auto -mx-1 px-1 space-y-2 min-h-0">
            {TEMPLATES.map((t, i) => (
              <TemplateCard key={t.name} {...t} active={i === activeTemplate} onClick={() => setActiveTemplate(i)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- primitives ---------- */

function ToolIcon({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group h-14 w-14 rounded-lg flex flex-col items-center justify-center gap-0.5 transition ${
        active
          ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className={`text-[9px] font-semibold uppercase tracking-wider ${active ? "text-red-400" : "text-zinc-500 group-hover:text-zinc-300"}`}>
        {label}
      </span>
    </button>
  );
}

function IconBtn({ icon: Icon }: { icon: any }) {
  return (
    <button className="h-8 w-8 rounded-md grid place-items-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition">
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{title}</div>
      {subtitle && <div className="text-[11px] text-zinc-600 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      className="w-full flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 px-3 h-10 transition text-left"
    >
      <span className="text-[13px] text-zinc-200">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-red-500" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function SliderRow({ label, value, min, max, unit }: { label: string; value: number; min: number; max: number; unit: string }) {
  const [v, setV] = useState(value);
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-zinc-300">{label}</span>
        <span className="text-[11px] font-mono text-red-400 tabular-nums">{v}{unit}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-zinc-800">
        <div className="absolute inset-y-0 left-0 rounded-full bg-red-500" style={{ width: `${pct}%` }} />
        <input
          type="range"
          value={v}
          min={min}
          max={max}
          onChange={(e) => setV(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow ring-2 ring-red-500 pointer-events-none" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrackRow({
  label,
  clips,
  color = "bg-zinc-700/60",
  border = "border-zinc-600/60",
  waveform,
}: {
  label: string;
  clips: { l: number; w: number }[];
  color?: string;
  border?: string;
  waveform?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-2 h-10">
      <div className="w-6 shrink-0 grid place-items-center text-[9px] font-bold text-zinc-500 bg-zinc-900 rounded border border-zinc-800">
        {label}
      </div>
      <div className="relative flex-1 rounded bg-zinc-900/50 border border-zinc-800 overflow-hidden">
        {clips.map((c, i) => (
          <div
            key={i}
            className={`absolute top-1 bottom-1 rounded ${color} border ${border} overflow-hidden`}
            style={{ left: `${c.l}%`, width: `${c.w}%` }}
          >
            {waveform && (
              <div className="absolute inset-0 flex items-center gap-[2px] px-1">
                {Array.from({ length: 40 }).map((_, k) => (
                  <div
                    key={k}
                    className="w-[2px] rounded-full bg-red-400/70"
                    style={{ height: `${20 + Math.abs(Math.sin(k * 0.9)) * 70}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- template cards ---------- */

type TemplateDef = {
  name: string;
  sample: string;
  /** Tailwind classes for the swatch preview only. */
  style: string;
  /** Card background gradient class. */
  glow: string;
  /** Live style tokens applied to the canvas overlay when this card is clicked. */
  overlay: {
    base: string;    // hex for idle words
    accent: string;  // hex for the highlighted word
    glowRgba: string; // rgba(...) used in the text-shadow
    weight: number;
    tracking: string; // css letter-spacing
    transform: "uppercase" | "lowercase" | "none";
  };
};

const TEMPLATES: TemplateDef[] = [
  { name: "Neon Red",  sample: "GO VIRAL",     style: "text-red-400 [text-shadow:0_0_10px_rgba(230,0,0,0.9)]", glow: "from-red-500/20",
    overlay: { base: "#ffffff", accent: "#ff4d4d", glowRgba: "rgba(230,0,0,0.75)", weight: 900, tracking: "-0.02em", transform: "uppercase" } },
  { name: "Bubblegum Pop", sample: "hey there",    style: "text-pink-400 [text-shadow:0_0_10px_rgba(244,114,182,0.8)]",   glow: "from-pink-500/20",
    overlay: { base: "#ffffff", accent: "#f472b6", glowRgba: "rgba(244,114,182,0.7)", weight: 800, tracking: "-0.01em", transform: "none" } },
  { name: "Cyber Cyan",    sample: "DROP.IT",      style: "text-cyan-300 [text-shadow:0_0_10px_rgba(34,211,238,0.8)]",    glow: "from-cyan-500/20",
    overlay: { base: "#e5faff", accent: "#22d3ee", glowRgba: "rgba(34,211,238,0.75)", weight: 900, tracking: "0.02em", transform: "uppercase" } },
  { name: "Sunset Blaze",  sample: "warm vibes",   style: "text-amber-300 [text-shadow:0_0_10px_rgba(251,191,36,0.7)]",   glow: "from-amber-500/20",
    overlay: { base: "#fff7ed", accent: "#fbbf24", glowRgba: "rgba(251,191,36,0.7)", weight: 800, tracking: "0",       transform: "none" } },
  { name: "Royal Violet",  sample: "PREMIUM",      style: "text-violet-300 [text-shadow:0_0_10px_rgba(167,139,250,0.8)]", glow: "from-violet-500/20",
    overlay: { base: "#ffffff", accent: "#a78bfa", glowRgba: "rgba(167,139,250,0.7)", weight: 900, tracking: "0.06em", transform: "uppercase" } },
  { name: "Minimal Ivory", sample: "less is more", style: "text-zinc-100",                                                 glow: "from-zinc-500/10",
    overlay: { base: "#fafafa", accent: "#ffffff", glowRgba: "rgba(255,255,255,0.0)", weight: 600, tracking: "-0.01em", transform: "none" } },
  { name: "Fire Red",      sample: "HOT TAKE",     style: "text-red-400 [text-shadow:0_0_10px_rgba(248,113,113,0.8)]",    glow: "from-red-500/20",
    overlay: { base: "#ffffff", accent: "#f87171", glowRgba: "rgba(248,113,113,0.75)", weight: 900, tracking: "0",       transform: "uppercase" } },
  { name: "Lime Punch",    sample: "FRESH",        style: "text-lime-300 [text-shadow:0_0_10px_rgba(163,230,53,0.8)]",    glow: "from-lime-500/20",
    overlay: { base: "#ffffff", accent: "#bef264", glowRgba: "rgba(163,230,53,0.75)", weight: 900, tracking: "0.04em", transform: "uppercase" } },
];

function TemplateCard({
  name, sample, style, glow, active, onClick,
}: {
  name: string; sample: string; style: string; glow: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group w-full rounded-xl border overflow-hidden text-left transition ${
        active
          ? "border-red-500/60 shadow-[0_0_0_1px_rgba(230,0,0,0.35),0_8px_24px_-8px_rgba(230,0,0,0.4)]"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className={`relative h-20 grid place-items-center bg-gradient-to-br ${glow} via-zinc-900 to-zinc-950`}>
        <div className={`text-lg font-black tracking-tight ${style}`}>{sample}</div>
      </div>
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/70 border-t border-zinc-800">
        <span className="text-[12px] font-medium text-zinc-200">{name}</span>
        {active ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Active</span>
        ) : (
          <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">Apply</span>
        )}
      </div>
    </button>
  );
}

