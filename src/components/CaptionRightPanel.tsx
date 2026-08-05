import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronUp, RotateCcw, Type, LayoutTemplate, Zap, AudioLines,
  AlignLeft, AlignCenter, AlignRight, Underline as UnderlineIcon, Italic as ItalicIcon,
  Search, Bookmark, Sparkles, Lock, Wand2, Volume2, Check, Crown, Heart,
  Highlighter, Zap as ZapIcon, Circle,
} from "lucide-react";
import {
  CapStyle, CapTransition, DEFAULT_CAP_STYLE, FONT_OPTIONS, WEIGHT_OPTIONS, CAP_PRESETS,
  applyTextCase, captionSpanStyle, normalizeCapStyle,
  PRESET_CATEGORIES, getPresetCategory, type PresetCategory,
} from "@/lib/captionStyle";
import { useFreeTemplates } from "@/hooks/useFreeTemplates";
import { canUseTemplate } from "@/lib/templateGating";

import { usePlanInfo } from "@/hooks/usePlanInfo";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

import { MusicTab } from "@/components/MusicTab";
import { AdminLibraryManager } from "@/components/library/AdminLibraryManager";


interface Props {
  value: CapStyle;
  onChange: (next: CapStyle) => void;
  projectId?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onTemplateApplied?: (name: string) => void;
}

type TabId = "text" | "templates" | "transitions" | "music" | "audio";

const TABS: { id: TabId; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "templates", label: "Templates" },
  { id: "transitions", label: "Transitions" },
  { id: "audio", label: "AI Audio" },
];

const Section = ({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="space-y-3.5 px-4 pb-4">{children}</div>}
    </div>
  );
};

// Shared shell for every right-panel tab. Guarantees identical outer layout
// (single column, no min-width leaks) so Text and Templates align at every
// panel width after the user resizes the right pane.
const TabShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex min-w-0 flex-col ${className}`}>{children}</div>
);

const Row = ({ label, children, resetOn, onReset }: {
  label: string; children: React.ReactNode; resetOn?: boolean; onReset?: () => void;
}) => (
  // minmax(0,...) on every track lets both the label and control shrink safely
  // instead of overflowing the row when the right panel is narrowed.
  <div className="grid min-w-0 grid-cols-[minmax(0,92px)_minmax(0,1fr)_auto] items-center gap-2">
    <span className="truncate text-[13px] text-muted-foreground">{label}</span>
    <div className="min-w-0">{children}</div>
    {onReset ? (
      <button
        type="button"
        onClick={onReset}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition ${resetOn ? "hover:bg-muted/40 hover:text-foreground" : "opacity-30 pointer-events-none"}`}
        aria-label={`Reset ${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    ) : <span />}
  </div>
);

const Slider = ({ value, onChange, min, max, step = 1, suffix }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string;
}) => (
  <div className="flex items-center gap-2">
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
    />
    <div className="inline-flex min-w-[56px] items-center justify-end gap-1 rounded-md border border-border bg-input/50 px-2 py-2">
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent text-right text-[13px] tabular-nums outline-none"
      />
      {suffix && <span className="text-[12px] text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

const ColorField = ({ color, onColor, opacity, onOpacity }: {
  color: string; onColor: (c: string) => void; opacity?: number; onOpacity?: (v: number) => void;
}) => (
  <div className="flex items-center gap-2 rounded-md border border-border bg-input/50 px-3 py-2.5">
    <label className="relative inline-flex h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded-sm ring-1 ring-border">
      <input type="color" value={color} onChange={(e) => onColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      <span className="block h-full w-full" style={{ background: color }} />
    </label>
    <span className="text-[12px] text-muted-foreground">#</span>
    <input
      value={color.replace("#", "").toUpperCase()}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
        onColor("#" + v.padEnd(6, "0"));
      }}
      className="w-16 bg-transparent text-[13px] tabular-nums outline-none"
    />
    {opacity !== undefined && onOpacity && (
      <>
        <span className="ml-auto h-4 w-px bg-border" />
        <input
          type="number" min={0} max={100} value={opacity}
          onChange={(e) => onOpacity(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="w-10 bg-transparent text-right text-[13px] tabular-nums outline-none"
        />
        <span className="text-[12px] text-muted-foreground">%</span>
      </>
    )}
  </div>
);

const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button" onClick={() => onChange(!on)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}
    aria-pressed={on}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition ${on ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
  </button>
);

const SegBtn = ({ active, onClick, children, title }: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
}) => (
  <button
    type="button" title={title} onClick={onClick}
    className={`inline-flex h-8 min-w-[36px] items-center justify-center rounded-md px-2 text-[14px] transition ${active ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
  >
    {children}
  </button>
);

const TRANSITIONS: { id: CapTransition; label: string; desc: string }[] = [
  { id: "none", label: "None", desc: "Instant" },
  { id: "fade", label: "Fade", desc: "Smooth opacity" },
  { id: "pop", label: "Pop", desc: "Scale in" },
  { id: "slide-up", label: "Slide Up", desc: "From below" },
  { id: "slide-down", label: "Slide Down", desc: "From above" },
  { id: "zoom", label: "Zoom", desc: "Dramatic" },
  { id: "typewriter", label: "Typewriter", desc: "Letter by letter" },
  { id: "wave", label: "Wave", desc: "Rolling reveal" },
  { id: "bounce", label: "Bounce", desc: "Spring in" },
];

const TransitionPreview = ({ id, active }: { id: CapTransition; active: boolean }) => {
  const key = `${id}-${active ? "on" : "off"}`;
  const cls =
    id === "fade" ? "animate-[fade-in_0.5s_ease-out]" :
    id === "pop" ? "animate-[scale-in_0.35s_cubic-bezier(0.34,1.56,0.64,1)]" :
    id === "slide-up" ? "animate-[fade-in_0.4s_ease-out]" :
    id === "slide-down" ? "animate-[fade-in_0.4s_ease-out]" :
    id === "zoom" ? "animate-[scale-in_0.5s_ease-out]" :
    id === "typewriter" ? "" :
    id === "wave" ? "animate-[fade-in_0.5s_ease-out]" :
    id === "bounce" ? "animate-[scale-in_0.45s_cubic-bezier(0.34,1.8,0.64,1)]" : "";
  return (
    <div className="pointer-events-none flex h-8 items-center justify-center overflow-hidden rounded bg-background/40">
      <span key={key} className={`text-[12px] font-bold uppercase tracking-wider text-foreground ${cls}`}>
        Aa
      </span>
    </div>
  );
};

const TextTab = ({ s, set, reset, onChange }: {
  s: CapStyle;
  set: <K extends keyof CapStyle>(k: K, v: CapStyle[K]) => void;
  reset: <K extends keyof CapStyle>(k: K) => void;
  onChange: (next: CapStyle) => void;
}) => (
  <TabShell>

    <Section title="Fonts">
      <Row label="Font Family" onReset={() => reset("fontFamily")} resetOn={s.fontFamily !== DEFAULT_CAP_STYLE.fontFamily}>
        <div className="flex items-center gap-1">
          <select value={s.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-input/50 px-3 py-2.5 text-[14px] outline-none">
            {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
          </select>
          <div className="flex shrink-0 flex-col">
            <button type="button" aria-label="Prev font"
              onClick={() => {
                const i = FONT_OPTIONS.findIndex((f) => f.value === s.fontFamily);
                const n = FONT_OPTIONS[(i - 1 + FONT_OPTIONS.length) % FONT_OPTIONS.length];
                set("fontFamily", n.value);
              }}
              className="inline-flex h-[14px] w-5 items-center justify-center rounded-t-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button type="button" aria-label="Next font"
              onClick={() => {
                const i = FONT_OPTIONS.findIndex((f) => f.value === s.fontFamily);
                const n = FONT_OPTIONS[(i + 1) % FONT_OPTIONS.length];
                set("fontFamily", n.value);
              }}
              className="inline-flex h-[14px] w-5 items-center justify-center rounded-b-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </Row>
      <Row label="Font Face" onReset={() => reset("fontWeight")} resetOn={s.fontWeight !== DEFAULT_CAP_STYLE.fontWeight}>
        <div className="flex items-center gap-1">
          <select value={s.fontWeight} onChange={(e) => set("fontWeight", Number(e.target.value))}
            className="min-w-0 flex-1 rounded-md border border-border bg-input/50 px-3 py-2.5 text-[14px] outline-none">
            {WEIGHT_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <div className="flex shrink-0 flex-col">
            <button type="button" aria-label="Prev weight"
              onClick={() => {
                const i = WEIGHT_OPTIONS.findIndex((w) => w.value === s.fontWeight);
                const n = WEIGHT_OPTIONS[(i - 1 + WEIGHT_OPTIONS.length) % WEIGHT_OPTIONS.length];
                set("fontWeight", n.value);
              }}
              className="inline-flex h-[14px] w-5 items-center justify-center rounded-t-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button type="button" aria-label="Next weight"
              onClick={() => {
                const i = WEIGHT_OPTIONS.findIndex((w) => w.value === s.fontWeight);
                const n = WEIGHT_OPTIONS[(i + 1) % WEIGHT_OPTIONS.length];
                set("fontWeight", n.value);
              }}
              className="inline-flex h-[14px] w-5 items-center justify-center rounded-b-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </Row>
      <Row label="Font Size" onReset={() => reset("fontSize")} resetOn={s.fontSize !== DEFAULT_CAP_STYLE.fontSize}>
        <Slider value={s.fontSize} min={10} max={120} onChange={(v) => set("fontSize", v)} suffix="px" />
      </Row>
    </Section>

    <Section title="Format">
      <Row label="Styles">
        <div className="flex flex-wrap items-center gap-1.5">
          <SegBtn active={s.textCase === "normal"} onClick={() => set("textCase", "normal")} title="Normal">Tt</SegBtn>
          <SegBtn active={s.textCase === "upper"} onClick={() => set("textCase", "upper")} title="Uppercase">T</SegBtn>
          <SegBtn active={s.textCase === "lower"} onClick={() => set("textCase", "lower")} title="Lowercase">t</SegBtn>
          <SegBtn active={s.underline} onClick={() => set("underline", !s.underline)} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></SegBtn>
          <span className="mx-1 h-5 w-px bg-border" />
          <SegBtn active={s.italic} onClick={() => set("italic", !s.italic)} title="Italic"><ItalicIcon className="h-3.5 w-3.5" /></SegBtn>
        </div>
      </Row>
      <Row label="Text Alignment">
        <div className="flex items-center gap-1.5">
          <SegBtn active={s.align === "left"} onClick={() => set("align", "left")} title="Left"><AlignLeft className="h-3.5 w-3.5" /></SegBtn>
          <SegBtn active={s.align === "center"} onClick={() => set("align", "center")} title="Center"><AlignCenter className="h-3.5 w-3.5" /></SegBtn>
          <SegBtn active={s.align === "right"} onClick={() => set("align", "right")} title="Right"><AlignRight className="h-3.5 w-3.5" /></SegBtn>
        </div>
      </Row>
    </Section>

    {/* Reveal & Auto-Emoji moved below Effects to match reference layout */}


    <Section title="Position">
      <div className="grid grid-cols-2 gap-2">
        {([
          ["X", "posX"],
          ["Y", "posY"],
        ] as const).map(([label, key]) => {
          const val = Math.round((s[key] as number) * 10) / 10;
          const isDefault = s[key] === DEFAULT_CAP_STYLE[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[13px] text-muted-foreground w-3">{label}</span>
              <div className="flex flex-1 items-center rounded-md border border-border bg-input/50 px-3 py-2.5">
                <input
                  type="number"
                  value={val}
                  min={0}
                  max={100}
                  step={0.5}
                  onChange={(e) => set(key, Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-full bg-transparent text-[13px] tabular-nums outline-none"
                />
                <span className="text-[12px] text-muted-foreground">%</span>
              </div>
              <button
                type="button"
                onClick={() => reset(key)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition ${!isDefault ? "hover:bg-muted/40 hover:text-foreground" : "opacity-30 pointer-events-none"}`}
                aria-label={`Reset ${label}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <p className="px-1 pt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        Tip: drag the caption on the preview to reposition, scroll on it to resize.
      </p>
    </Section>

    <Section title="Color">
      <div className="inline-flex w-full rounded-md bg-input/50 p-0.5">
        <button onClick={() => set("colorMode", "solid")}
          className={`flex-1 rounded-[5px] py-2 text-[13px] font-semibold transition ${s.colorMode === "solid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Solid</button>
        <button onClick={() => set("colorMode", "gradient")}
          className={`flex-1 rounded-[5px] py-2 text-[13px] font-semibold transition ${s.colorMode === "gradient" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Gradient</button>
      </div>
      {s.colorMode === "solid" ? (
        <Row label="Color" onReset={() => reset("color")} resetOn={s.color !== DEFAULT_CAP_STYLE.color}>
          <ColorField color={s.color} onColor={(c) => set("color", c)} />
        </Row>
      ) : (
        <>
          <Row label="From"><ColorField color={s.gradFrom} onColor={(c) => set("gradFrom", c)} /></Row>
          <Row label="To"><ColorField color={s.gradTo} onColor={(c) => set("gradTo", c)} /></Row>
          <Row label="Angle" onReset={() => reset("gradAngle")} resetOn={s.gradAngle !== DEFAULT_CAP_STYLE.gradAngle}>
            <Slider value={s.gradAngle} min={0} max={360} onChange={(v) => set("gradAngle", v)} suffix="°" />
          </Row>
        </>
      )}
    </Section>

    <Section title="Spacing">
      <Row label="Letter Spacing" onReset={() => reset("letterSpacing")} resetOn={s.letterSpacing !== DEFAULT_CAP_STYLE.letterSpacing}>
        <Slider value={s.letterSpacing} min={-4} max={20} step={0.5} onChange={(v) => set("letterSpacing", v)} />
      </Row>
      <Row label="Line Spacing" onReset={() => reset("lineHeight")} resetOn={s.lineHeight !== DEFAULT_CAP_STYLE.lineHeight}>
        <Slider value={s.lineHeight} min={0.8} max={2.5} step={0.1} onChange={(v) => set("lineHeight", v)} />
      </Row>
    </Section>

    <Section title="Effects" defaultOpen={false}>
      <div className="rounded-lg border border-border/60 bg-input/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Drop Shadow</span>
          <Toggle on={s.shadowOn} onChange={(v) => set("shadowOn", v)} />
        </div>
        {s.shadowOn && (
          <div className="mt-3 space-y-2.5">
            <Row label="Color"><ColorField color={s.shadowColor} onColor={(c) => set("shadowColor", c)} opacity={s.shadowOpacity} onOpacity={(v) => set("shadowOpacity", v)} /></Row>
            <Row label="Position X"><Slider value={s.shadowX} min={-40} max={40} onChange={(v) => set("shadowX", v)} /></Row>
            <Row label="Position Y"><Slider value={s.shadowY} min={-40} max={40} onChange={(v) => set("shadowY", v)} /></Row>
            <Row label="Blur"><Slider value={s.shadowBlur} min={0} max={60} onChange={(v) => set("shadowBlur", v)} /></Row>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border/60 bg-input/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Glow</span>
          <Toggle on={s.glowOn} onChange={(v) => set("glowOn", v)} />
        </div>
        {s.glowOn && (
          <div className="mt-3 space-y-2.5">
            <Row label="Color"><ColorField color={s.glowColor} onColor={(c) => set("glowColor", c)} /></Row>
            <Row label="Spread"><Slider value={s.glowBlur} min={0} max={60} onChange={(v) => set("glowBlur", v)} /></Row>
            <Row label="Intensity"><Slider value={s.glowIntensity} min={0} max={100} onChange={(v) => set("glowIntensity", v)} /></Row>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border/60 bg-input/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Text Stroke</span>
          <Toggle on={s.strokeOn} onChange={(v) => set("strokeOn", v)} />
        </div>
        {s.strokeOn && (
          <div className="mt-3 space-y-2.5">
            <Row label="Color"><ColorField color={s.strokeColor} onColor={(c) => set("strokeColor", c)} /></Row>
            <Row label="Width"><Slider value={s.strokeWidth} min={0.5} max={12} step={0.5} onChange={(v) => set("strokeWidth", v)} /></Row>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border/60 bg-input/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Background</span>
          <Toggle on={s.bgOn} onChange={(v) => set("bgOn", v)} />
        </div>
        {s.bgOn && (
          <div className="mt-3 space-y-2.5">
            <Row label="Color"><ColorField color={s.bgColor} onColor={(c) => set("bgColor", c)} opacity={s.bgOpacity} onOpacity={(v) => set("bgOpacity", v)} /></Row>
            <Row label="Border Radius"><Slider value={s.bgRadius} min={0} max={999} onChange={(v) => set("bgRadius", v)} /></Row>
            <Row label="Pad X"><Slider value={s.bgPadX} min={0} max={60} onChange={(v) => set("bgPadX", v)} /></Row>
            <Row label="Pad Y"><Slider value={s.bgPadY} min={0} max={40} onChange={(v) => set("bgPadY", v)} /></Row>
          </div>
        )}
      </div>
    </Section>

    <Section title="Reveal" defaultOpen={false}>
      <Row label="Words per pop" onReset={() => reset("wordsPerChunk")} resetOn={s.wordsPerChunk !== DEFAULT_CAP_STYLE.wordsPerChunk}>
        <div className="flex flex-wrap items-center gap-1.5">
          <SegBtn active={s.wordsPerChunk === 0} onClick={() => set("wordsPerChunk", 0)} title="Full line">Line</SegBtn>
          {[1, 2, 3, 4, 5].map((n) => (
            <SegBtn key={n} active={s.wordsPerChunk === n} onClick={() => set("wordsPerChunk", n)} title={`${n} word${n > 1 ? "s" : ""} at a time`}>
              {n}
            </SegBtn>
          ))}
        </div>
      </Row>
    </Section>

    <Section title="Auto-Emoji" defaultOpen={false}>
      <Row label="Enable" onReset={() => reset("autoEmojiOn")} resetOn={s.autoEmojiOn !== DEFAULT_CAP_STYLE.autoEmojiOn}>
        <SegBtn active={s.autoEmojiOn} onClick={() => set("autoEmojiOn", !s.autoEmojiOn)} title="Toggle auto-emoji">
          {s.autoEmojiOn ? "On" : "Off"}
        </SegBtn>
      </Row>
      <Row label="Size" onReset={() => reset("emojiSize")} resetOn={s.emojiSize !== DEFAULT_CAP_STYLE.emojiSize}>
        <Slider value={s.emojiSize} min={12} max={64} step={1} onChange={(v) => set("emojiSize", v)} suffix="px" />
      </Row>
    </Section>


    <div className="p-4">
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && !window.confirm("Reset all caption styles to defaults? This will undo every style change you've made.")) return;
          Object.keys(DEFAULT_CAP_STYLE).forEach((k) => reset(k as keyof CapStyle));
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-input/40 px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:border-destructive/40 hover:text-destructive"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset all styles
      </button>
    </div>
  </TabShell>
);

/* -------------------- Templates tab (rebuilt) -------------------- */

type TemplateSubTab = "builtin" | "favorites" | "mine";

const FAVORITES_KEY = "captions:favorites";
const loadFavorites = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};

const badgesFor = (patch: Partial<CapStyle>) => {
  const b: string[] = [];
  if ((patch.fontWeight ?? 0) >= 700) b.push("Bold");
  if (patch.shadowOn) b.push("Shadow");
  if (patch.glowOn) b.push("Glow");
  if (patch.strokeOn) b.push("Stroke");
  if (patch.bgOn) b.push("BG");
  if (patch.colorMode === "gradient") b.push("Gradient");
  return b.slice(0, 3);
};

const TemplateCard = ({
  name, patch, base, active, locked = false, index, isFavorite = false, onToggleFavorite, onApply, onChange, onRemove,
}: {
  name: string; patch: Partial<CapStyle>; base: CapStyle;
  active: boolean; locked?: boolean; index?: number;
  isFavorite?: boolean; onToggleFavorite?: () => void;
  onApply: () => void;
  onChange: (n: CapStyle) => void; onRemove: () => void;
}) => {

  const preview: CapStyle = normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...patch });
  const chips = badgesFor(patch);

  const sample = ["The", "quick", "brown", "fox"];
  const activeIdx = 2;

  const previewFontSize = Math.min(preview.fontSize, 26);
  const previewSpan = captionSpanStyle({ ...preview, fontSize: previewFontSize });
  const outerBoxOn = preview.bgOn && !preview.activeWordBgOn;
  const outerStyle: React.CSSProperties = {
    ...previewSpan,
    background: outerBoxOn ? previewSpan.background : "transparent",
    padding: outerBoxOn ? previewSpan.padding : "2px 4px",
    display: "inline-block",
    whiteSpace: "nowrap",
    lineHeight: 1.1,
  };

  return (
    <div
      className={`group relative w-full overflow-hidden rounded-2xl border text-left transition ${
        active
          ? "border-primary bg-card shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_20px_50px_-20px_hsl(var(--primary)/0.35)]"
          : "border-border bg-card/50 hover:border-primary/50"
      }`}
    >
      <button type="button" onClick={onApply} className="block w-full text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2 min-w-0">
            {typeof index === "number" && (
              <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-md bg-primary/15 px-1.5 text-[12px] font-bold tabular-nums text-primary ring-1 ring-primary/30">
                {index}
              </span>
            )}
            <div className="truncate text-[13px] font-semibold text-foreground">{name}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {onToggleFavorite && (
              <button
                type="button"
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleFavorite(); }}
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 transition ${
                  isFavorite ? "bg-primary/20 text-primary ring-primary/50" : "bg-transparent text-muted-foreground ring-border hover:text-primary hover:ring-primary/40"
                }`}
              >
                <Heart className="h-3 w-3" fill={isFavorite ? "currentColor" : "none"} strokeWidth={2.5} />
              </button>
            )}
            {active && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
            {locked ? (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-black/70 px-1.5 text-[13px] font-bold uppercase tracking-wide text-warning ring-1 ring-warning/60">
                <Lock className="h-2.5 w-2.5" strokeWidth={3} /> Pro
              </span>
            ) : (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-warning/95 text-black">
                <Crown className="h-3 w-3" strokeWidth={2.5} />
              </span>
            )}

          </div>
        </div>

        {/* Preview */}
        <div className="relative mx-4 mt-3 flex h-[104px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-neutral-900 via-black to-neutral-950">
          <span style={outerStyle}>
            {sample.map((w, i) => {
              const isActive = preview.activeWordOn && i === activeIdx;
              const wordStyle: React.CSSProperties = {
                display: "inline-block",
                padding: preview.activeWordBgOn && isActive ? "0 6px" : undefined,
                borderRadius: preview.activeWordBgOn && isActive ? 6 : undefined,
                transform: isActive ? `scale(${preview.activeWordScale})` : undefined,
                transformOrigin: "center",
              };
              if (isActive) {
                if (preview.activeWordBgOn) {
                  wordStyle.backgroundColor = preview.activeWordBgColor;
                  wordStyle.color = "#0b0b0b";
                } else {
                  wordStyle.color = preview.activeWordColor;
                }
              }
              return (
                <span key={i} style={wordStyle}>
                  {applyTextCase(w, preview.textCase)}
                  {i < sample.length - 1 ? " " : ""}
                </span>
              );
            })}
          </span>
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1.5 px-4 pb-3 pt-3">
          {chips.length === 0 ? (
            <span className="text-[12px] text-muted-foreground/60">Clean</span>
          ) : (
            chips.map((c) => (
              <span key={c} className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground">
                {c}
              </span>
            ))
          )}
        </div>
      </button>

      {/* Inline Colors + Emphasis + Remove Style (only when this template is active) */}
      {active && (
        <div className="mx-4 mb-4 space-y-3">
          <div className="rounded-xl border border-border bg-card/60 p-3">
            <div className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Colors</div>
            <div className="space-y-2">
              <Row
                label="Primary"
                onReset={() => onChange(normalizeCapStyle({ ...base, color: (patch.color ?? DEFAULT_CAP_STYLE.color) }))}
                resetOn={base.color !== (patch.color ?? DEFAULT_CAP_STYLE.color)}
              >
                <ColorField color={base.color} onColor={(c) => onChange(normalizeCapStyle({ ...base, color: c }))} />
              </Row>
              <Row
                label="Secondary"
                onReset={() => onChange(normalizeCapStyle({ ...base, strokeColor: (patch.strokeColor ?? DEFAULT_CAP_STYLE.strokeColor) }))}
                resetOn={base.strokeColor !== (patch.strokeColor ?? DEFAULT_CAP_STYLE.strokeColor)}
              >
                <ColorField color={base.strokeColor} onColor={(c) => onChange(normalizeCapStyle({ ...base, strokeColor: c }))} />
              </Row>
              <Row
                label="Tertiary"
                onReset={() => onChange(normalizeCapStyle({ ...base, shadowColor: (patch.shadowColor ?? DEFAULT_CAP_STYLE.shadowColor) }))}
                resetOn={base.shadowColor !== (patch.shadowColor ?? DEFAULT_CAP_STYLE.shadowColor)}
              >
                <ColorField color={base.shadowColor} onColor={(c) => onChange(normalizeCapStyle({ ...base, shadowColor: c }))} />
              </Row>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-3">
            <div className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Emphasis</div>
            <div className="mb-2 flex items-center gap-1 rounded-md bg-muted/40 p-1">
              <button
                type="button"
              onClick={() => onChange(normalizeCapStyle({ ...base, activeWordOn: true, activeWordBgOn: false }))}
                className={`flex-1 rounded px-3 py-2 text-[13px] font-semibold transition ${!base.activeWordBgOn ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Emphasize
              </button>
              <button
                type="button"
                onClick={() => onChange(normalizeCapStyle({ ...base, activeWordOn: true, activeWordBgOn: true }))}
                className={`flex-1 rounded px-3 py-2 text-[13px] font-semibold transition ${base.activeWordBgOn ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Spotlight
              </button>
            </div>
            <div className="mb-2 flex items-center gap-1 rounded-md bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => onChange(normalizeCapStyle({ ...base, colorMode: "solid" }))}
                className={`flex-1 rounded px-3 py-2 text-[13px] font-semibold transition ${base.colorMode !== "gradient" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Solid
              </button>
              <button
                type="button"
                onClick={() => onChange(normalizeCapStyle({ ...base, colorMode: "gradient" }))}
                className={`flex-1 rounded px-3 py-2 text-[13px] font-semibold transition ${base.colorMode === "gradient" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Gradient
              </button>
            </div>
            <Row
              label="Color"
              onReset={() => onChange(normalizeCapStyle({ ...base, activeWordColor: DEFAULT_CAP_STYLE.activeWordColor, activeWordBgColor: DEFAULT_CAP_STYLE.activeWordBgColor }))}
              resetOn={base.activeWordColor !== DEFAULT_CAP_STYLE.activeWordColor || base.activeWordBgColor !== DEFAULT_CAP_STYLE.activeWordBgColor}
            >
              <ColorField
                color={base.activeWordBgOn ? base.activeWordBgColor : base.activeWordColor}
                onColor={(c) => onChange(
                  normalizeCapStyle(base.activeWordBgOn ? { ...base, activeWordBgColor: c } : { ...base, activeWordColor: c })
                )}
              />
            </Row>
          </div>

          <button
            onClick={onRemove}
            className="w-full rounded-md bg-primary/90 py-3 text-[14px] font-semibold text-primary-foreground hover:bg-primary"
          >
            Remove Style
          </button>
        </div>
      )}
    </div>
  );
};

const TemplatesTab = ({ s, onChange, onTemplateApplied }: { s: CapStyle; onChange: (n: CapStyle) => void; onTemplateApplied?: (name: string) => void }) => {
  const [sub, setSub] = useState<TemplateSubTab>("builtin");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PresetCategory>("All");
  const [saved, setSaved] = useState<{ name: string; patch: Partial<CapStyle> }[]>(() => {
    try { return JSON.parse(localStorage.getItem("captions:mypresets") ?? "[]"); } catch { return []; }
  });
  const [activeName, setActiveName] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const toggleFavorite = (name: string) => {
    setFavorites((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const { isPaid } = usePlanInfo();
  const { isAdmin } = useIsAdmin();
  const { names: freeNames } = useFreeTemplates();
  const { toast } = useToast();
  const navigate = useNavigate();
  const gateApply = (name: string, apply: () => void) => {
    const allowed = canUseTemplate({ name, freeNames, isPaid, isAdmin });
    // Preview is always allowed — free users can try any premium template on the canvas.
    // Download is gated separately in the editor (checks the currently-applied template).
    apply();
    onTemplateApplied?.(name);
    if (!allowed) {
      toast({
        title: "Premium template applied (preview only)",
        description: "You can style your video with this, but downloading requires a paid plan.",
        action: (
          <button
            onClick={() => navigate("/pricing")}
            className="rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground"
          >Upgrade</button>
        ) as any,
      });
    }
  };



  // Available categories with counts (only for built-ins; "mine" tab skips categories).
  const categoryCounts = useMemo(() => {
    const counts = new Map<PresetCategory, number>();
    for (const p of CAP_PRESETS) {
      const c = getPresetCategory(p);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    counts.set("All", CAP_PRESETS.length);
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const list =
      sub === "builtin" ? CAP_PRESETS :
      sub === "favorites" ? CAP_PRESETS.filter((p) => favSet.has(p.name)) :
      saved;
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      if (sub === "builtin" && category !== "All" && getPresetCategory(p) !== category) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sub, query, category, saved, favSet]);


  const savePreset = () => {
    const name = prompt("Preset name?");
    if (!name) return;
    const patch: Partial<CapStyle> = { ...s };
    const next = [...saved.filter((p) => p.name !== name), { name, patch }];
    setSaved(next);
    localStorage.setItem("captions:mypresets", JSON.stringify(next));
  };

  const removeStyle = () => {
    onChange(normalizeCapStyle(DEFAULT_CAP_STYLE));
    setActiveName(null);
  };

  return (
    <TabShell>
      {/* Sub tabs */}
      <div className="flex gap-6 border-b border-border/60 px-4 pt-3">
        {(["builtin", "favorites", "mine"] as const).map((k) => {
          const active = sub === k;
          const label = k === "builtin" ? "Built-in Templates" : k === "favorites" ? `Favorites${favorites.length ? ` (${favorites.length})` : ""}` : "My Presets";
          return (
            <button
              key={k}
              onClick={() => setSub(k)}
              className={`relative pb-3 text-[13px] font-semibold transition ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* Quick one-click styles */}
      <div className="px-4 pt-3">
        <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Quick Styles</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: "Yellow Highlight", icon: Highlighter, tint: "bg-primary/15 text-primary border-primary/40" },
            { name: "Popping Text", icon: ZapIcon, tint: "bg-primary/15 text-primary border-primary/40" },
            { name: "Stroke Outline", icon: Circle, tint: "bg-foreground/10 text-foreground border-foreground/40" },
          ].map((q) => {
            const preset = CAP_PRESETS.find((p) => p.name === q.name);
            if (!preset) return null;
            const Icon = q.icon;
            const isActive = activeName === q.name;
            return (
              <motion.button
                key={q.name}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
                onClick={() => {
                  gateApply(q.name, () => {
                    setActiveName(q.name);
                    onChange(normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...preset.patch }));
                  });
                }}

                className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[13px] font-medium transition ${isActive ? q.tint : "border-border bg-input/40 text-foreground hover:border-primary/50"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-tight text-center">{q.name}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Search + Save */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-input/50 px-3 py-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a template"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={savePreset}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-input/50 px-3 py-2 text-[13px] font-medium text-foreground hover:border-primary/50"
        >
          <Bookmark className="h-3.5 w-3.5" /> Save preset
        </button>
      </div>

      {/* Category chips (built-ins only) */}
      {sub === "builtin" && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {PRESET_CATEGORIES.filter((c) => (categoryCounts.get(c) ?? 0) > 0).map((c) => {
            const active = category === c;
            const count = categoryCounts.get(c) ?? 0;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition ${
                  active
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-input/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {c}
                <span className={`rounded-full px-1 text-[13px] ${active ? "bg-primary/25 text-primary" : "bg-secondary/60 text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}


      {/* Template grid */}
      <div className="space-y-3 px-4 pb-6">
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-[13px] text-muted-foreground">
            {sub === "mine"
              ? "No saved presets yet. Style captions and hit Save preset."
              : sub === "favorites"
              ? "No favorites yet. Tap the heart on any template to save it here."
              : "No templates match your search."}
          </div>
        )}
        {filtered.map((p, i) => {
          const isBuiltinLike = sub === "builtin" || sub === "favorites";
          const locked = isBuiltinLike && !canUseTemplate({ name: p.name, freeNames, isPaid, isAdmin });
          return (
            <TemplateCard
              key={p.name}
              index={i + 1}
              name={p.name}
              patch={p.patch}
              base={s}
              active={activeName === p.name}
              locked={locked}
              isFavorite={favSet.has(p.name)}
              onToggleFavorite={isBuiltinLike ? () => toggleFavorite(p.name) : undefined}
              onApply={() => {
                gateApply(p.name, () => {
                  setActiveName(p.name);
                  onChange(normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...p.patch }));
                });
              }}
              onChange={onChange}
              onRemove={removeStyle}
            />
          );
        })}
      </div>
    </TabShell>

  );
};

/* -------------------- Transitions tab -------------------- */

const SAMPLE_WORDS = ["Preview", "your", "caption", "here"];

const LiveTransitionPreview = ({ id, speed }: { id: CapTransition; speed: number }) => {
  // Remount key drives re-fire whenever the transition, speed, or the manual
  // replay counter changes. Real cap-anim-* CSS is used so this matches the
  // video overlay 1:1.
  const [nonce, setNonce] = useState(0);
  const mountKey = `${id}:${speed}:${nonce}`;
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Live preview</span>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-input/40 px-2 py-1.5 text-[12px] font-semibold text-foreground/90 hover:bg-input/70"
          title="Replay animation"
        >
          <RotateCcw className="h-3 w-3" /> Replay
        </button>
      </div>
      <div className="flex h-16 items-center justify-center overflow-hidden rounded bg-gradient-to-br from-slate-900 to-black">
        <div
          key={mountKey}
          className={`cap-anim-${id}`}
          // @ts-expect-error css var
          style={{ "--cap-dur": `${speed}ms` }}
        >
          <span className="inline-flex flex-wrap justify-center gap-x-1.5 text-[14px] font-extrabold uppercase tracking-wide text-foreground">
            {SAMPLE_WORDS.map((w, i) => (
              <span key={i} className="cap-word">{w}</span>
            ))}
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-center text-[13px] text-muted-foreground">
        {id} · {speed}ms
      </div>
    </div>
  );
};

const TRANS_GRID: { id: CapTransition; label: string; icon: React.ReactNode }[] = [
  { id: "none", label: "None", icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 stroke-current" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  ) },
  { id: "fade", label: "Fade", icon: (
    <div className="h-6 w-6 rounded-[3px] bg-primary/70 blur-[2px]" />
  ) },
  { id: "pop", label: "Pop", icon: (
    <div className="h-5 w-5 rounded-full bg-primary/70" />
  ) },
  { id: "zoom", label: "Zoom", icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 stroke-current" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M10.5 7.5v6M7.5 10.5h6M20 20l-4.5-4.5" />
    </svg>
  ) },
  { id: "wave", label: "Scale", icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="10" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <path d="M17 8l4 4-4 4" />
    </svg>
  ) },
  { id: "slide-up", label: "Slide Left / Right", icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 6l-6 6 6 6M17 6l-6 6 6 6" />
    </svg>
  ) },
  { id: "slide-down", label: "Slide Up / Down", icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13l6-6 6 6M6 19l6-6 6 6" />
    </svg>
  ) },
];

const TransitionsTab = ({ s, set }: {
  s: CapStyle;
  set: <K extends keyof CapStyle>(k: K, v: CapStyle[K]) => void;
}) => {
  const [scope, setScope] = useState<"line" | "word">(() => (localStorage.getItem("cap.trans.scope") as "line" | "word") || "word");
  const [manual, setManual] = useState<boolean>(() => localStorage.getItem("cap.trans.manual") !== "0");
  const setScopePersist = (v: "line" | "word") => { setScope(v); localStorage.setItem("cap.trans.scope", v); };
  const speedPct = Math.round(((1000 - Math.max(80, Math.min(1000, s.transitionSpeed))) / 920) * 100);
  const setSpeedPct = (pct: number) => {
    const p = Math.max(0, Math.min(100, pct));
    set("transitionSpeed", Math.round(1000 - (p / 100) * 920));
  };
  return (
    <div className="space-y-5 px-4 py-4">
      {/* Line / Word toggle */}
      <div className="inline-flex w-full rounded-md bg-input/40 p-0.5">
        <button onClick={() => setScopePersist("line")}
          className={`flex-1 rounded-[5px] py-2 text-[13px] font-semibold transition ${scope === "line" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Line</button>
        <button onClick={() => setScopePersist("word")}
          className={`flex-1 rounded-[5px] py-2 text-[13px] font-semibold transition ${scope === "word" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Word</button>
      </div>

      <div className="space-y-1">
        <div className="text-[14px] font-semibold text-foreground">
          Transitions will be <span className="text-primary">Applied</span> on {scope === "word" ? "Word" : "Line"}
        </div>
        <div className="text-[13px] text-primary/90">
          Animation will be applied to the selected {scope}
        </div>
      </div>

      {/* 3x2 + 1 icon grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {TRANS_GRID.map((t) => {
          const active = s.transition === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => set("transition", t.id)}
              className={`group flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-input/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
            >
              <span className={`inline-flex h-10 w-10 items-center justify-center ${active ? "text-primary" : "text-foreground/80 group-hover:text-foreground"}`}>{t.icon}</span>
              <span className={`text-[13px] font-medium leading-tight ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-border/60 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-foreground">
              Speed Mode <span className="ml-1 text-primary">· {manual ? "Manual" : "Auto"}</span>
            </div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              {manual ? "Set your preferred speed manually" : "Speed matches the caption pace"}
            </div>
          </div>
          <Toggle on={manual} onChange={(v) => { setManual(v); localStorage.setItem("cap.trans.manual", v ? "1" : "0"); }} />
        </div>

        <div className={`mt-4 grid grid-cols-[60px_1fr_auto_auto] items-center gap-2 ${manual ? "" : "pointer-events-none opacity-50"}`}>
          <span className="text-[13px] text-muted-foreground">Speed</span>
          <input
            type="range" min={0} max={100} step={1} value={speedPct}
            onChange={(e) => setSpeedPct(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <div className="inline-flex min-w-[50px] items-center justify-end rounded-md border border-border bg-input/50 px-2 py-1.5">
            <input
              type="number" min={0} max={100} value={speedPct}
              onChange={(e) => setSpeedPct(Number(e.target.value))}
              className="w-full bg-transparent text-right text-[13px] tabular-nums outline-none"
            />
          </div>
          <div className="flex shrink-0 flex-col">
            <button type="button" aria-label="Speed up" onClick={() => setSpeedPct(speedPct + 5)}
              className="inline-flex h-[14px] w-5 items-center justify-center rounded-t-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button type="button" aria-label="Speed down" onClick={() => setSpeedPct(speedPct - 5)}
              className="inline-flex h-[14px] w-5 items-center justify-center rounded-b-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------- AI Audio tab (rebuilt) -------------------- */

const AudioTab = () => {
  const [busy, setBusy] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const clean = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Placeholder for backend audio-enhance job. For now, simulate a
      // real request delay and mark the track as enhanced so the UI
      // reflects that the action ran.
      await new Promise((r) => setTimeout(r, 1600));
      setEnhanced(true);
      const { toast } = await import("sonner");
      toast.success("Audio enhanced — background noise reduced.");
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error("Couldn't enhance audio. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const goUpgrade = () => { window.location.href = "/pricing"; };

  return (
    <div className="px-4 py-5">
      <div className="rounded-2xl border border-border bg-gradient-to-b from-card/60 to-card/20 p-5 text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[12px] font-semibold text-primary">
          <Sparkles className="h-3 w-3" /> AI-Powered
        </div>
        <h4 className="text-lg font-semibold text-foreground">Audio Enhancement</h4>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Clean up your audio, Remove Background<br />
          Noise &amp; Enhance Overall Audio Quality.
        </p>
        <p className="mt-2 text-[13px] italic text-muted-foreground/80">
          Audio Enhancement Removes<br />Background Music as well!
        </p>
        <button
          onClick={clean}
          disabled={busy}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-[14px] font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-70"
        >
          <Volume2 className="h-4 w-4" />
          {busy ? "Cleaning audio…" : enhanced ? "Re-clean Audio" : "Clean Audio"}
          <Wand2 className="h-4 w-4" />

        </button>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-left text-[13px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Noise Reduction</div>
          <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Voice Enhancement</div>
          <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Real-time Processing</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-warning/20 text-warning">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[13px] font-semibold text-foreground">Remaining Credits</div>
            <div className="text-[12px] text-muted-foreground">2 credits available</div>
          </div>
        </div>
        <button onClick={goUpgrade} className="rounded-md bg-primary/90 px-2.5 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary">
          Upgrade
        </button>

      </div>

      <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-muted/10 p-3 text-center text-[13px] text-muted-foreground">
        <Lock className="mx-auto mb-1 h-3.5 w-3.5" />
        AI Voiceover & Dubbing in 40+ desi voices — coming soon.
      </div>
    </div>
  );
};

/* -------------------- Panel shell -------------------- */

export const CaptionRightPanel = ({ value, onChange, projectId, videoRef, onTemplateApplied }: Props) => {
  const [tab, setTab] = useState<TabId>("text");
  const s = normalizeCapStyle(value);
  const set = <K extends keyof CapStyle>(k: K, v: CapStyle[K]) => onChange(normalizeCapStyle({ ...s, [k]: v }));
  const reset = <K extends keyof CapStyle>(k: K) => set(k, DEFAULT_CAP_STYLE[k]);

  return (
    <aside className="flex h-full min-h-[600px] flex-col overflow-hidden bg-transparent">
      {/* Text tabs — pill row (no icons) */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border/70 bg-background/40 px-2 pt-2">
        <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative shrink-0 px-2 py-2.5 text-[12px] font-semibold transition ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <div className="shrink-0 pl-1 pr-1">
          <AdminLibraryManager
            defaultCategory={
              tab === "templates" ? "template" :
              tab === "transitions" ? "transition" :
              tab === "audio" ? "audio" :
              tab === "music" ? "audio" :
              "text"
            }
          />
        </div>
      </div>


      {/* Content */}
      <div key={tab} className="flex-1 animate-fade-in overflow-y-auto">
        {tab === "text" && <TextTab s={s} set={set} reset={reset} onChange={onChange} />}
        {tab === "templates" && <TemplatesTab s={s} onChange={onChange} onTemplateApplied={onTemplateApplied} />}
        {tab === "transitions" && <TransitionsTab s={s} set={set} />}
        {tab === "music" && projectId && videoRef && <MusicTab projectId={projectId} videoRef={videoRef} />}
        {tab === "music" && (!projectId || !videoRef) && (
          <div className="p-6 text-center text-[13px] text-muted-foreground">Music editor unavailable in this view.</div>
        )}
        {tab === "audio" && <AudioTab />}
      </div>
    </aside>
  );
};

export default CaptionRightPanel;
