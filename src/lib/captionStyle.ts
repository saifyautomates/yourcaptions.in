// Caption style model + helpers. Shared between the overlay and the style panel.

export type ColorMode = "solid" | "gradient";
export type TextCase = "normal" | "upper" | "lower" | "title";
export type TextAlign = "left" | "center" | "right";
export type CapTransition =
  | "none"
  | "fade"
  | "pop"
  | "slide-up"
  | "slide-down"
  | "zoom"
  | "typewriter"
  | "wave"
  | "bounce";

export interface CapStyle {
  transition: CapTransition;
  transitionSpeed: number; // ms
  // Fonts
  fontFamily: string;
  fontWeight: number;   // 300..900
  italic: boolean;
  underline: boolean;
  fontSize: number;     // px
  // Format
  textCase: TextCase;
  align: TextAlign;
  // Position (percent within container; center of caption)
  posX: number;
  posY: number;
  // Color
  colorMode: ColorMode;
  color: string;
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  // Spacing
  letterSpacing: number; // px
  lineHeight: number;    // unitless
  // Effects — drop shadow
  shadowOn: boolean;
  shadowColor: string;
  shadowOpacity: number; // 0..100
  shadowX: number;       // px
  shadowY: number;       // px
  shadowBlur: number;    // px
  // Effects — glow
  glowOn: boolean;
  glowColor: string;
  glowBlur: number;
  glowIntensity: number; // 0..100
  // Effects — stroke
  strokeOn: boolean;
  strokeColor: string;
  strokeWidth: number;   // px
  // Effects — background
  bgOn: boolean;
  bgColor: string;
  bgOpacity: number;     // 0..100
  bgRadius: number;      // px
  bgPadX: number;        // px
  bgPadY: number;        // px
  // Reveal — how many words to show at a time (0 = full segment line)
  wordsPerChunk: number; // 0..6
  // Active-word highlight (Kalakar-style burnt-in captions)
  activeWordOn: boolean;
  activeWordColor: string;
  activeWordBgOn: boolean;
  activeWordBgColor: string;
  activeWordScale: number; // 1..1.4
  // Auto-emoji chips — auto-tag keywords with a floating emoji pill
  autoEmojiOn: boolean;
  emojiSize: number; // px, 12..64
  // Fit-to-video — auto scale + clamp captions so they never leave the frame
  fitToVideo: boolean;
  // Extra safe margin (percent of the shorter frame edge) added around the frame's
  // safe zone so captions always stay inside the visible area. 0..20
  safeMargin: number;
  // Impact-word highlighting — comma/space separated word lists that get
  // re-colored (red / yellow) wherever they appear in the caption. Match is
  // case-insensitive and strips punctuation. Used by "The DOAC Podcast Style"
  // and any other preset that wants per-word emphasis colors.
  impactWordsRed: string;
  impactWordsYellow: string;
  impactRedColor: string;
  impactYellowColor: string;
}


export const FONT_OPTIONS: { label: string; value: string }[] = [
  // Sans-serif — modern
  { label: "Inter", value: "'Inter', system-ui, sans-serif" },
  { label: "Poppins", value: "'Poppins', 'Inter', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', 'Inter', sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', 'Inter', sans-serif" },
  { label: "DM Sans", value: "'DM Sans', 'Inter', sans-serif" },
  { label: "Roboto", value: "'Roboto', 'Inter', sans-serif" },
  { label: "Lato", value: "'Lato', 'Inter', sans-serif" },
  { label: "Nunito", value: "'Nunito', 'Inter', sans-serif" },
  { label: "Raleway", value: "'Raleway', 'Inter', sans-serif" },
  { label: "Work Sans", value: "'Work Sans', 'Inter', sans-serif" },
  { label: "Manrope", value: "'Manrope', 'Inter', sans-serif" },
  { label: "Plus Jakarta Sans", value: "'Plus Jakarta Sans', 'Inter', sans-serif" },
  { label: "Outfit", value: "'Outfit', 'Inter', sans-serif" },
  { label: "Sora", value: "'Sora', 'Inter', sans-serif" },
  { label: "Rubik", value: "'Rubik', 'Inter', sans-serif" },
  { label: "Barlow", value: "'Barlow', 'Inter', sans-serif" },
  { label: "Barlow Condensed", value: "'Barlow Condensed', 'Impact', sans-serif" },
  { label: "Roboto Condensed", value: "'Roboto Condensed', 'Impact', sans-serif" },

  // Display / Impact
  { label: "Bebas Neue", value: "'Bebas Neue', 'Impact', sans-serif" },
  { label: "Anton", value: "'Anton', 'Impact', sans-serif" },
  { label: "Archivo Black", value: "'Archivo Black', 'Impact', sans-serif" },
  { label: "Oswald", value: "'Oswald', 'Impact', sans-serif" },
  { label: "Fjalla One", value: "'Fjalla One', 'Impact', sans-serif" },
  { label: "Passion One", value: "'Passion One', 'Impact', sans-serif" },
  { label: "Righteous", value: "'Righteous', 'Impact', sans-serif" },
  { label: "Teko", value: "'Teko', 'Impact', sans-serif" },
  { label: "Yanone Kaffeesatz", value: "'Yanone Kaffeesatz', 'Impact', sans-serif" },
  { label: "Squada One", value: "'Squada One', 'Impact', sans-serif" },
  { label: "Staatliches", value: "'Staatliches', 'Impact', sans-serif" },
  { label: "Russo One", value: "'Russo One', 'Impact', sans-serif" },
  { label: "Black Ops One", value: "'Black Ops One', 'Impact', sans-serif" },
  { label: "Rammetto One", value: "'Rammetto One', 'Impact', sans-serif" },
  { label: "Titan One", value: "'Titan One', 'Impact', sans-serif" },
  { label: "Alfa Slab One", value: "'Alfa Slab One', 'Impact', serif" },
  { label: "Ultra", value: "'Ultra', 'Impact', serif" },
  { label: "Abril Fatface", value: "'Abril Fatface', Georgia, serif" },
  { label: "Bungee", value: "'Bungee', 'Impact', sans-serif" },
  { label: "Bungee Shade", value: "'Bungee Shade', 'Impact', sans-serif" },
  { label: "Monoton", value: "'Monoton', 'Impact', sans-serif" },

  // Fun / Cartoon
  { label: "Bangers", value: "'Bangers', 'Impact', cursive" },
  { label: "Luckiest Guy", value: "'Luckiest Guy', 'Impact', cursive" },
  { label: "Fredoka", value: "'Fredoka', 'Inter', sans-serif" },
  { label: "Chewy", value: "'Chewy', 'Impact', cursive" },

  // Handwriting / Script
  { label: "Permanent Marker", value: "'Permanent Marker', cursive" },
  { label: "Kalam", value: "'Kalam', cursive" },
  { label: "Caveat", value: "'Caveat', cursive" },
  { label: "Shadows Into Light", value: "'Shadows Into Light', cursive" },
  { label: "Dancing Script", value: "'Dancing Script', cursive" },
  { label: "Pacifico", value: "'Pacifico', cursive" },
  { label: "Lobster", value: "'Lobster', cursive" },
  { label: "Great Vibes", value: "'Great Vibes', cursive" },
  { label: "Satisfy", value: "'Satisfy', cursive" },
  { label: "Amatic SC", value: "'Amatic SC', cursive" },

  // Themed
  { label: "Special Elite", value: "'Special Elite', ui-monospace, monospace" },
  { label: "Creepster", value: "'Creepster', 'Impact', cursive" },
  { label: "Press Start 2P", value: "'Press Start 2P', ui-monospace, monospace" },

  // Serif
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Instrument Serif", value: "'Instrument Serif', Georgia, serif" },
  { label: "Merriweather", value: "'Merriweather', Georgia, serif" },
  { label: "Lora", value: "'Lora', Georgia, serif" },
  { label: "EB Garamond", value: "'EB Garamond', Georgia, serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', Georgia, serif" },
  { label: "Libre Baskerville", value: "'Libre Baskerville', Georgia, serif" },
  { label: "DM Serif Display", value: "'DM Serif Display', Georgia, serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },

  // Monospace
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Roboto Mono", value: "'Roboto Mono', ui-monospace, monospace" },
  { label: "Fira Code", value: "'Fira Code', ui-monospace, monospace" },
  { label: "Space Mono", value: "'Space Mono', ui-monospace, monospace" },
];

/** Look up a font's CSS value by label. Falls back to Inter. */
export const font = (label: string): string =>
  FONT_OPTIONS.find((f) => f.label === label)?.value ?? font("Inter");

export const WEIGHT_OPTIONS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semi Bold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Extra Bold", value: 800 },
  { label: "Black", value: 900 },
];

export const DEFAULT_CAP_STYLE: CapStyle = {
  transition: "pop",
  transitionSpeed: 320,
  fontFamily: font("Poppins"),
  fontWeight: 700,
  italic: false,
  underline: false,
  fontSize: 28,
  textCase: "normal",
  align: "center",
  posX: 50,
  posY: 85,
  colorMode: "solid",
  color: "#FFFFFF",
  gradFrom: "#7CD3A8",
  gradTo: "#60A5FA",
  gradAngle: 135,
  letterSpacing: 0,
  lineHeight: 1.2,
  shadowOn: true,
  shadowColor: "#000000",
  shadowOpacity: 80,
  shadowX: 0,
  shadowY: 2,
  shadowBlur: 8,
  glowOn: false,
  glowColor: "#7CD3A8",
  glowBlur: 16,
  glowIntensity: 60,
  strokeOn: false,
  strokeColor: "#000000",
  strokeWidth: 2,
  bgOn: false,
  bgColor: "#000000",
  bgOpacity: 60,
  bgRadius: 10,
  bgPadX: 14,
  bgPadY: 6,
  wordsPerChunk: 0,
  activeWordOn: true,
  activeWordColor: "#7CD3A8",
  activeWordBgOn: false,
  activeWordBgColor: "#7CD3A8",
  activeWordScale: 1.05,
  autoEmojiOn: true,
  emojiSize: 28,
  fitToVideo: true,
  safeMargin: 4,
  impactWordsRed: "",
  impactWordsYellow: "",
  impactRedColor: "#E60000",
  impactYellowColor: "#FFEA00",


};

// Split a segment's text into evenly-timed word chunks and return the one
// visible at `t`. When wordsPerChunk <= 0, returns the full text.
export const getVisibleChunk = (
  text: string,
  start: number,
  end: number,
  t: number,
  wordsPerChunk: number,
): string => {
  if (!text) return "";
  const n = Math.floor(wordsPerChunk);
  if (n <= 0) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= n) return text;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += n) chunks.push(words.slice(i, i + n).join(" "));
  const dur = Math.max(0.001, end - start);
  const per = dur / chunks.length;
  const idx = Math.max(0, Math.min(chunks.length - 1, Math.floor((t - start) / per)));
  return chunks[idx];
};

// Per-word timing metadata. `start`/`end` are absolute seconds (same clock
// as the parent segment). When present we use them directly instead of
// dividing the segment duration evenly across words — this makes the
// active-word highlight lock to the actual audio.
export interface WordTiming { text: string; start: number; end: number }

// Return the currently visible words for a segment along with the index of
// the word that should be highlighted at time `t`. When `wordsMeta` is
// provided we use real per-word timestamps; otherwise we fall back to an
// even split across the segment duration.
export const getVisibleWords = (
  text: string,
  start: number,
  end: number,
  t: number,
  wordsPerChunk: number,
  wordsMeta?: WordTiming[],
): { words: string[]; activeIndex: number } => {
  if (!text && !(wordsMeta && wordsMeta.length)) return { words: [], activeIndex: -1 };
  const n = Math.floor(wordsPerChunk);

  // Preferred path: real per-word timings.
  if (wordsMeta && wordsMeta.length) {
    const all = wordsMeta;
    let slice = all;
    let chunkStart = start;
    let chunkEnd = end;
    if (n > 0 && all.length > n) {
      const chunks: WordTiming[][] = [];
      for (let i = 0; i < all.length; i += n) chunks.push(all.slice(i, i + n));
      // Pick chunk whose time window contains t (with clamp).
      let idx = chunks.findIndex((c) => t < c[c.length - 1].end + 0.001);
      if (idx < 0) idx = chunks.length - 1;
      slice = chunks[idx];
      chunkStart = slice[0].start;
      chunkEnd = slice[slice.length - 1].end;
    }
    const words = slice.map((w) => w.text);
    // Find active word by real timing.
    // - Before first word starts: no active highlight (-1).
    // - Inside a word window [start, end): that word is active.
    // - In a gap after word i but before word i+1: keep word i active (last spoken).
    // - After last word ends: last word remains active until segment ends.
    let activeIndex = -1;
    if (t < slice[0].start) activeIndex = -1;
    else if (t >= slice[slice.length - 1].end) activeIndex = slice.length - 1;
    else {
      for (let i = 0; i < slice.length; i++) {
        if (t < slice[i].start) { activeIndex = Math.max(0, i - 1); break; }
        if (t < slice[i].end)   { activeIndex = i; break; }
      }
      if (activeIndex < 0) activeIndex = slice.length - 1;
    }
    void chunkStart;
    return { words, activeIndex };
  }

  // Fallback: even split (no per-word timings from provider).
  const all = text.split(/\s+/).filter(Boolean);
  if (all.length === 0) return { words: [], activeIndex: -1 };
  const dur = Math.max(0.001, end - start);
  let words = all;
  let chunkStart = start;
  let chunkDur = dur;
  if (n > 0 && all.length > n) {
    const chunks: string[][] = [];
    for (let i = 0; i < all.length; i += n) chunks.push(all.slice(i, i + n));
    const per = dur / chunks.length;
    const idx = Math.max(0, Math.min(chunks.length - 1, Math.floor((t - start) / per)));
    words = chunks[idx];
    chunkStart = start + idx * per;
    chunkDur = per;
  }
  const perWord = chunkDur / Math.max(1, words.length);
  const rel = Math.max(0, t - chunkStart);
  const activeIndex = Math.max(0, Math.min(words.length - 1, Math.floor(rel / perWord)));
  return { words, activeIndex };
};

// Hex #RRGGBB -> "r,g,b"
export const hexToRgbTuple = (hex: string): string => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "000000", 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export const applyTextCase = (t: string, tc: TextCase): string => {
  if (tc === "upper") return t.toUpperCase();
  if (tc === "lower") return t.toLowerCase();
  if (tc === "title") return t.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return t;
};

// Parse a user-entered word list ("game changer, insane, huge") into a
// normalized Set of lowercase tokens for O(1) lookup during render.
export const parseImpactWords = (raw: string): Set<string> => {
  const set = new Set<string>();
  if (!raw) return set;
  for (const tok of raw.split(/[,\n]+/)) {
    const t = tok.trim().toLowerCase();
    if (t) set.add(t);
  }
  return set;
};

// Strip punctuation off a rendered word before matching against impact lists.
const normalizeWordForMatch = (w: string): string =>
  w.toLowerCase().replace(/[^\p{L}\p{N}'\-]/gu, "");

export const matchImpactTier = (
  word: string,
  red: Set<string>,
  yellow: Set<string>,
): "red" | "yellow" | null => {
  const norm = normalizeWordForMatch(word);
  if (!norm) return null;
  if (red.has(norm)) return "red";
  if (yellow.has(norm)) return "yellow";
  return null;
};


const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
};

export const normalizeCapStyle = (style: Partial<CapStyle> = {}): CapStyle => {
  const merged = { ...DEFAULT_CAP_STYLE, ...style } as CapStyle;
  return {
    ...merged,
    transitionSpeed: clampNumber(merged.transitionSpeed, 80, 1200, DEFAULT_CAP_STYLE.transitionSpeed),
    fontWeight: clampNumber(merged.fontWeight, 300, 900, DEFAULT_CAP_STYLE.fontWeight),
    fontSize: clampNumber(merged.fontSize, 10, 120, DEFAULT_CAP_STYLE.fontSize),
    posX: clampNumber(merged.posX, 0, 100, DEFAULT_CAP_STYLE.posX),
    posY: clampNumber(merged.posY, 0, 100, DEFAULT_CAP_STYLE.posY),
    gradAngle: clampNumber(merged.gradAngle, 0, 360, DEFAULT_CAP_STYLE.gradAngle),
    letterSpacing: clampNumber(merged.letterSpacing, -2, 12, DEFAULT_CAP_STYLE.letterSpacing),
    lineHeight: clampNumber(merged.lineHeight, 0.75, 2.5, DEFAULT_CAP_STYLE.lineHeight),
    shadowOpacity: clampNumber(merged.shadowOpacity, 0, 100, DEFAULT_CAP_STYLE.shadowOpacity),
    shadowX: clampNumber(merged.shadowX, -30, 30, DEFAULT_CAP_STYLE.shadowX),
    shadowY: clampNumber(merged.shadowY, -30, 30, DEFAULT_CAP_STYLE.shadowY),
    shadowBlur: clampNumber(merged.shadowBlur, 0, 60, DEFAULT_CAP_STYLE.shadowBlur),
    glowBlur: clampNumber(merged.glowBlur, 0, 80, DEFAULT_CAP_STYLE.glowBlur),
    glowIntensity: clampNumber(merged.glowIntensity, 0, 100, DEFAULT_CAP_STYLE.glowIntensity),
    strokeWidth: clampNumber(merged.strokeWidth, 0, 12, DEFAULT_CAP_STYLE.strokeWidth),
    bgOpacity: clampNumber(merged.bgOpacity, 0, 100, DEFAULT_CAP_STYLE.bgOpacity),
    bgRadius: clampNumber(merged.bgRadius, 0, 999, DEFAULT_CAP_STYLE.bgRadius),
    bgPadX: clampNumber(merged.bgPadX, 0, 80, DEFAULT_CAP_STYLE.bgPadX),
    bgPadY: clampNumber(merged.bgPadY, 0, 60, DEFAULT_CAP_STYLE.bgPadY),
    wordsPerChunk: clampNumber(Math.round(merged.wordsPerChunk), 0, 12, DEFAULT_CAP_STYLE.wordsPerChunk),
    activeWordScale: clampNumber(merged.activeWordScale, 1, 1.6, DEFAULT_CAP_STYLE.activeWordScale),
    emojiSize: clampNumber(merged.emojiSize, 12, 72, DEFAULT_CAP_STYLE.emojiSize),
    safeMargin: clampNumber(merged.safeMargin, 0, 20, DEFAULT_CAP_STYLE.safeMargin),

  };
};

// Build the inline `style` object for the caption <span>.
export const captionSpanStyle = (s: CapStyle): React.CSSProperties => {
  const safe = normalizeCapStyle(s);
  const shadows: string[] = [];
  if (safe.shadowOn) {
    shadows.push(`${safe.shadowX}px ${safe.shadowY}px ${safe.shadowBlur}px rgba(${hexToRgbTuple(safe.shadowColor)},${safe.shadowOpacity / 100})`);
  }
  if (safe.glowOn) {
    const a = safe.glowIntensity / 100;
    shadows.push(`0 0 ${safe.glowBlur}px rgba(${hexToRgbTuple(safe.glowColor)},${a})`);
    shadows.push(`0 0 ${Math.round(safe.glowBlur * 1.6)}px rgba(${hexToRgbTuple(safe.glowColor)},${a * 0.7})`);
  }
  const style: React.CSSProperties = {
    fontFamily: safe.fontFamily,
    fontSize: `${safe.fontSize}px`,
    fontWeight: safe.fontWeight,
    fontStyle: safe.italic ? "italic" : "normal",
    textDecoration: safe.underline ? "underline" : "none",
    textAlign: safe.align,
    letterSpacing: `${safe.letterSpacing}px`,
    lineHeight: safe.lineHeight,
    borderRadius: `${safe.bgRadius}px`,
    padding: safe.bgOn ? `${safe.bgPadY}px ${safe.bgPadX}px` : "2px 6px",
    background: safe.bgOn ? `rgba(${hexToRgbTuple(safe.bgColor)},${safe.bgOpacity / 100})` : "transparent",
    textShadow: shadows.length ? shadows.join(", ") : undefined,
    WebkitTextStroke: safe.strokeOn ? `${safe.strokeWidth}px ${safe.strokeColor}` : undefined,
  };
  if (safe.colorMode === "gradient") {
    style.background = `linear-gradient(${safe.gradAngle}deg, ${safe.gradFrom}, ${safe.gradTo})`;
    style.WebkitBackgroundClip = "text";
    style.backgroundClip = "text";
    style.color = "transparent";
    // gradient text can't have a background box concurrently; if bg is on, keep bg via a wrapper (skip here)
  } else {
    style.color = safe.color;
  }
  return style;
};

export type TemplateWarning = {
  templateName: string;
  field: string;
  value: string;
  reason: string;
};

// Warnings collected during library init.
export const TEMPLATE_WARNINGS: TemplateWarning[] = [];

// ---------------------------------------------------------------------------
// 1. Kinetic Motion Pack — high-retention short-form templates with kinetic glow,
// 3D depth layer positioning, punch scale, and creator hooks.
// ---------------------------------------------------------------------------
export const KINETIC_TEMPLATE_PACK: { name: string; patch: Partial<CapStyle> }[] = [
  {
    name: "Kinetic · Viral Flow",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 48,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 4,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 95,
      shadowX: 0,
      shadowY: 6,
      shadowBlur: 14,
      glowOn: true,
      glowColor: "rgba(255, 230, 0, 0.5)",
      glowBlur: 16,
      glowIntensity: 80,
      posY: 75,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 120,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.15,
    }
  },
  {
    name: "Kinetic · 3D Depth Cutout",
    patch: {
      fontFamily: font("Anton"),
      fontWeight: 900,
      fontSize: 54,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#111111",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 8,
      shadowBlur: 20,
      posY: 52,
      wordsPerChunk: 2,
      transition: "fade",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#E60000",
      activeWordColor: "#FFFFFF",
      activeWordScale: 1.1,
    }
  },
  {
    name: "Kinetic · Beast Punch",
    patch: {
      fontFamily: font("Bangers"),
      fontWeight: 800,
      fontSize: 52,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 6,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 3,
      shadowY: 3,
      shadowBlur: 0,
      posY: 80,
      wordsPerChunk: 2,
      transition: "bounce",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#00F0FF",
      activeWordScale: 1.2,
    }
  },
  {
    name: "Kinetic · Word Highlighter",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 900,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 80,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 78,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 140,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#22C55E",
      activeWordColor: "#000000",
      activeWordScale: 1.08,
    }
  },
  {
    name: "Kinetic · Storyteller",
    patch: {
      fontFamily: font("Outfit"),
      fontWeight: 800,
      fontSize: 42,
      textCase: "normal",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "rgba(0,0,0,0.8)",
      strokeWidth: 2,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 76,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#F43F5E",
      activeWordScale: 1.12,
    }
  },
  {
    name: "Kinetic · Dark Minimal",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 700,
      fontSize: 40,
      textCase: "upper",
      color: "#E2E8F0",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 12,
      posY: 82,
      wordsPerChunk: 2,
      transition: "fade",
      transitionSpeed: 150,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFFFFF",
      activeWordScale: 1.05,
    }
  },
  {
    name: "Kinetic · Supreme Red Hook",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 46,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 5,
      shadowBlur: 12,
      posY: 74,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#EF4444",
      activeWordColor: "#FFFFFF",
      activeWordScale: 1.18,
    }
  },
  {
    name: "Kinetic · Studio Clean",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 600,
      fontSize: 36,
      textCase: "normal",
      color: "#F8FAFC",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 60,
      shadowX: 0,
      shadowY: 2,
      shadowBlur: 6,
      bgOn: true,
      bgColor: "rgba(15, 23, 42, 0.75)",
      bgOpacity: 80,
      bgRadius: 10,
      bgPadX: 16,
      bgPadY: 8,
      posY: 82,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 160,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FDE047",
      activeWordScale: 1.05,
    }
  },
  {
    name: "Kinetic · Bounce 3D",
    patch: {
      fontFamily: font("Bebas Neue"),
      fontWeight: 900,
      fontSize: 52,
      textCase: "upper",
      color: "#FFFFFF",
      letterSpacing: 1,
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 4,
      shadowOn: true,
      shadowColor: "#06B6D4",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 16,
      posY: 75,
      wordsPerChunk: 2,
      transition: "bounce",
      transitionSpeed: 95,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#06B6D4",
      activeWordScale: 1.22,
    }
  },
  {
    name: "Kinetic · Dual Layer Overlay",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 800,
      fontSize: 42,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "rgba(0,0,0,0.9)",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 85,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 84,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FBBF24",
      activeWordScale: 1.12,
    }
  }
];
export const MOONSHOT_TEMPLATE_PACK = KINETIC_TEMPLATE_PACK;

// ---------------------------------------------------------------------------
// 2. Dynamic Pop Pack — signature pill containers, teleprompter typewriter,
// cyber neon strokes, and hyper-clean creator aesthetics.
// ---------------------------------------------------------------------------
export const DYNAMIC_POP_TEMPLATE_PACK: { name: string; patch: Partial<CapStyle> }[] = [
  {
    name: "Dynamic · Classic Pill",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 800,
      fontSize: 42,
      textCase: "normal",
      color: "#F1F5F9",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 60,
      shadowX: 0,
      shadowY: 3,
      shadowBlur: 8,
      bgOn: true,
      bgColor: "rgba(0, 0, 0, 0.65)",
      bgOpacity: 75,
      bgRadius: 12,
      bgPadX: 18,
      bgPadY: 10,
      posY: 80,
      wordsPerChunk: 2,
      transition: "fade",
      transitionSpeed: 160,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#3B82F6",
      activeWordColor: "#FFFFFF",
      activeWordScale: 1.06,
    }
  },
  {
    name: "Dynamic · Kinetic Pop",
    patch: {
      fontFamily: font("Outfit"),
      fontWeight: 800,
      fontSize: 48,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 5,
      shadowBlur: 12,
      posY: 76,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#06B6D4",
      activeWordScale: 1.18,
    }
  },
  {
    name: "Dynamic · Typewriter Glow",
    patch: {
      fontFamily: font("JetBrains Mono"),
      fontWeight: 700,
      fontSize: 38,
      textCase: "normal",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "rgba(0, 240, 255, 0.5)",
      shadowOpacity: 80,
      shadowX: 0,
      shadowY: 0,
      shadowBlur: 15,
      posY: 82,
      wordsPerChunk: 4,
      transition: "typewriter",
      transitionSpeed: 200,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#00F0FF",
      activeWordScale: 1.0,
    }
  },
  {
    name: "Dynamic · Neon Cyber",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 46,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#FF0055",
      strokeWidth: 2,
      glowOn: true,
      glowColor: "#FF0055",
      glowBlur: 20,
      glowIntensity: 90,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 8,
      posY: 78,
      wordsPerChunk: 3,
      transition: "bounce",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.12,
    }
  },
  {
    name: "Dynamic · Editorial Clean",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 600,
      fontSize: 36,
      textCase: "normal",
      color: "#E2E8F0",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 50,
      shadowX: 0,
      shadowY: 2,
      shadowBlur: 6,
      posY: 84,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 180,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FBBF24",
      activeWordScale: 1.05,
    }
  },
  {
    name: "Dynamic · Boxed Highlight",
    patch: {
      fontFamily: font("Archivo Black"),
      fontWeight: 900,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 70,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 80,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#FACC15",
      activeWordColor: "#000000",
      activeWordScale: 1.1,
    }
  },
  {
    name: "Dynamic · Glitch Twitch",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 48,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#00F0FF",
      strokeWidth: 2,
      shadowOn: true,
      shadowColor: "#FF0055",
      shadowOpacity: 90,
      shadowX: 3,
      shadowY: -2,
      shadowBlur: 6,
      posY: 76,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 80,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.15,
    }
  },
  {
    name: "Dynamic · High Retention Beast",
    patch: {
      fontFamily: font("Bangers"),
      fontWeight: 900,
      fontSize: 52,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 6,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 3,
      shadowY: 3,
      shadowBlur: 0,
      posY: 78,
      wordsPerChunk: 2,
      transition: "bounce",
      transitionSpeed: 95,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFEA00",
      activeWordScale: 1.25,
    }
  },
  {
    name: "Dynamic · Floating Emoji Hook",
    patch: {
      fontFamily: font("Poppins"),
      fontWeight: 800,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      autoEmojiOn: true,
      emojiSize: 32,
      posY: 78,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.16,
    }
  },
  {
    name: "Dynamic · Cinematic Serif",
    patch: {
      fontFamily: font("Playfair Display"),
      fontWeight: 700,
      fontSize: 40,
      textCase: "normal",
      italic: true,
      color: "#F8FAFC",
      letterSpacing: 1,
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 80,
      shadowX: 0,
      shadowY: 3,
      shadowBlur: 12,
      posY: 80,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 220,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#F59E0B",
      activeWordScale: 1.08,
    }
  }
];
export const CAPTIONS_AI_TEMPLATE_PACK = DYNAMIC_POP_TEMPLATE_PACK;

// ---------------------------------------------------------------------------
// 3. Desi Viral Pack — Bharat-first Hinglish & 22 Indian languages templates,
// karaoke word flow, bold drop shadows, and podcast duo presets.
// ---------------------------------------------------------------------------
export const DESI_VIRAL_TEMPLATE_PACK: { name: string; patch: Partial<CapStyle> }[] = [
  {
    name: "Desi · Karaoke Flow",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 900,
      fontSize: 46,
      textCase: "normal",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 78,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#F59E0B", // Warm amber gold
      activeWordScale: 1.14,
    }
  },
  {
    name: "Desi · Bold Drop",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 50,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "rgba(0,0,0,0.9)",
      strokeWidth: 4,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 8,
      shadowBlur: 16,
      posY: 50, // Center aligned
      wordsPerChunk: 2,
      transition: "fade",
      transitionSpeed: 120,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#EF4444", // Bold red
      activeWordScale: 1.12,
    }
  },
  {
    name: "Desi · Reels Clean",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 600,
      fontSize: 34,
      textCase: "normal",
      color: "#F3F4F6",
      letterSpacing: -0.5,
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 70,
      shadowX: 0,
      shadowY: 2,
      shadowBlur: 6,
      posY: 84,
      wordsPerChunk: 4,
      transition: "fade",
      transitionSpeed: 180,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#60A5FA", // Soft blue
      activeWordScale: 1.04,
    }
  },
  {
    name: "Desi · Podcast Duo",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 800,
      fontSize: 42,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 80,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      bgOn: true,
      bgColor: "rgba(15, 15, 20, 0.8)",
      bgOpacity: 85,
      bgRadius: 8,
      bgPadX: 14,
      bgPadY: 8,
      posY: 80,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 120,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#E11D48", // Duo speaker accent
      activeWordScale: 1.08,
    }
  },
  {
    name: "Desi · Bollywood Hit",
    patch: {
      fontFamily: font("Impact"),
      fontWeight: 900,
      fontSize: 48,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 5,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 2,
      shadowY: 4,
      shadowBlur: 0,
      posY: 76,
      wordsPerChunk: 2,
      transition: "bounce",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#F59E0B",
      activeWordColor: "#000000",
      activeWordScale: 1.15,
    }
  },
  {
    name: "Desi · Bhashini Bharat",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 700,
      fontSize: 40,
      textCase: "normal",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "rgba(0,0,0,0.85)",
      strokeWidth: 2,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 75,
      shadowX: 0,
      shadowY: 3,
      shadowBlur: 8,
      posY: 82,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 150,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#10B981", // Emerald Bharat green
      activeWordScale: 1.08,
    }
  },
  {
    name: "Desi · Hinglish Viral Hook",
    patch: {
      fontFamily: font("Poppins"),
      fontWeight: 900,
      fontSize: 48,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#EA580C",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 95,
      shadowX: 0,
      shadowY: 5,
      shadowBlur: 12,
      posY: 75,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 95,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FACC15",
      activeWordScale: 1.18,
    }
  },
  {
    name: "Desi · Finance Guru Hindi",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 800,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 85,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 80,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#10B981",
      activeWordColor: "#FFFFFF",
      activeWordScale: 1.12,
    }
  },
  {
    name: "Desi · Motivation Spark",
    patch: {
      fontFamily: font("Outfit"),
      fontWeight: 800,
      fontSize: 46,
      textCase: "upper",
      color: "#FFFBEB",
      glowOn: true,
      glowColor: "#FBBF24",
      glowBlur: 16,
      glowIntensity: 80,
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 95,
      shadowX: 0,
      shadowY: 6,
      shadowBlur: 14,
      posY: 78,
      wordsPerChunk: 2,
      transition: "bounce",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#F59E0B",
      activeWordScale: 1.16,
    }
  },
  {
    name: "Desi · Marathi & Hindi Bold",
    patch: {
      fontFamily: font("Archivo Black"),
      fontWeight: 900,
      fontSize: 48,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 5,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 2,
      shadowY: 4,
      shadowBlur: 2,
      posY: 76,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FF5722", // Fiery saffron
      activeWordScale: 1.2,
    }
  }
];
export const CAPTIK_TEMPLATE_PACK = DESI_VIRAL_TEMPLATE_PACK;

// ---------------------------------------------------------------------------
// 4. Creator Pro Pack — viral creator presets, Hormozi, MrBeast,
// Ali Abdaal, Iman Gadzhi, and Raj Shamani style templates.
// ---------------------------------------------------------------------------
export const CREATOR_PRO_TEMPLATE_PACK: { name: string; patch: Partial<CapStyle> }[] = [
  {
    name: "Creator · Hormozi Viral",
    patch: {
      fontFamily: font("Impact"),
      fontWeight: 900,
      fontSize: 50,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 4,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 95,
      shadowX: 0,
      shadowY: 6,
      shadowBlur: 12,
      posY: 78,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.2,
    }
  },
  {
    name: "Creator · MrBeast Pop",
    patch: {
      fontFamily: font("Anton"),
      fontWeight: 900,
      fontSize: 52,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 6,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 0,
      posY: 80,
      wordsPerChunk: 2,
      transition: "bounce",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#00F0FF",
      activeWordColor: "#000000",
      activeWordScale: 1.15,
    }
  },
  {
    name: "Creator · Ali Abdaal Studio",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 600,
      fontSize: 38,
      textCase: "normal",
      color: "#F8FAFC",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 60,
      shadowX: 0,
      shadowY: 2,
      shadowBlur: 6,
      bgOn: true,
      bgColor: "rgba(15, 23, 42, 0.7)",
      bgOpacity: 80,
      bgRadius: 10,
      bgPadX: 16,
      bgPadY: 8,
      posY: 82,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 160,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FDE047", // Pastel yellow
      activeWordScale: 1.05,
    }
  },
  {
    name: "Creator · Iman Gadzhi Luxury",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 800,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 95,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 14,
      posY: 52,
      wordsPerChunk: 2,
      transition: "fade",
      transitionSpeed: 180,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#D4AF37", // Gold
      activeWordScale: 1.08,
    }
  },
  {
    name: "Creator · Raj Shamani Podcast",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 800,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 80,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FF9933", // Saffron Hindi accent
      activeWordScale: 1.15,
    }
  },
  {
    name: "Creator · Alpha Channel Overlay",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 46,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "rgba(0,0,0,0.95)",
      strokeWidth: 4,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 8,
      posY: 75,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 120,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#22C55E",
      activeWordColor: "#000000",
      activeWordScale: 1.1,
    }
  },
  {
    name: "Creator · Ranveer Spiritual Vibe",
    patch: {
      fontFamily: font("Instrument Serif"),
      fontWeight: 700,
      fontSize: 44,
      textCase: "normal",
      italic: true,
      color: "#FEF08A",
      glowOn: true,
      glowColor: "#EAB308",
      glowBlur: 18,
      glowIntensity: 75,
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 80,
      shadowX: 0,
      shadowY: 3,
      shadowBlur: 10,
      posY: 82,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 200,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFFFFF",
      activeWordScale: 1.06,
    }
  },
  {
    name: "Creator · Sharan Hegde Finance",
    patch: {
      fontFamily: font("Plus Jakarta Sans"),
      fontWeight: 800,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 85,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 8,
      posY: 78,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#22C55E",
      activeWordColor: "#000000",
      activeWordScale: 1.12,
    }
  },
  {
    name: "Creator · Raw & Real Hindi Podcast",
    patch: {
      fontFamily: font("Barlow Condensed"),
      fontWeight: 900,
      fontSize: 50,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 4,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 6,
      shadowBlur: 14,
      posY: 80,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFEA00",
      activeWordScale: 1.18,
    }
  },
  {
    name: "Creator · Storytelling Hook",
    patch: {
      fontFamily: font("Outfit"),
      fontWeight: 900,
      fontSize: 48,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "rgba(0,0,0,0.9)",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 60,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FACC15",
      activeWordScale: 1.2,
    }
  }
];
export const KALAKAR_TEMPLATE_PACK = CREATOR_PRO_TEMPLATE_PACK;

// ---------------------------------------------------------------------------
// 5. Shorts & Reels Pack — frictionless word-by-word subtitles, 1-click mobile reels,
// bold pop drop shadows, and clean bottom-third subtitles.
// ---------------------------------------------------------------------------
export const SHORTS_REELS_TEMPLATE_PACK: { name: string; patch: Partial<CapStyle> }[] = [
  {
    name: "Reels · 1-Click Karaoke",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 800,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 85,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 78,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.15,
    }
  },
  {
    name: "Reels · Ultra Clean",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 500,
      fontSize: 34,
      textCase: "normal",
      color: "#F8FAFC",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 80,
      shadowX: 0,
      shadowY: 2,
      shadowBlur: 6,
      posY: 84,
      wordsPerChunk: 4,
      transition: "fade",
      transitionSpeed: 150,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFFFFF",
      activeWordScale: 1.05,
    }
  },
  {
    name: "Reels · Bold Pop",
    patch: {
      fontFamily: font("Impact"),
      fontWeight: 900,
      fontSize: 50,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 4,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 2,
      shadowY: 4,
      shadowBlur: 0,
      posY: 76,
      wordsPerChunk: 2,
      transition: "bounce",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#00F0FF",
      activeWordScale: 1.2,
    }
  },
  {
    name: "Reels · Classic Subtitle",
    patch: {
      fontFamily: font("Arial"),
      fontWeight: 700,
      fontSize: 36,
      textCase: "normal",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: false,
      bgOn: true,
      bgColor: "rgba(0, 0, 0, 0.75)",
      bgOpacity: 85,
      bgRadius: 4,
      bgPadX: 12,
      bgPadY: 6,
      posY: 86,
      wordsPerChunk: 4,
      transition: "fade",
      transitionSpeed: 160,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.0,
    }
  },
  {
    name: "Reels · Dynamic Color Flow",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 46,
      textCase: "upper",
      color: "#E0E7FF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 5,
      shadowBlur: 12,
      posY: 78,
      wordsPerChunk: 3,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#A855F7", // Electric purple
      activeWordScale: 1.15,
    }
  },
  {
    name: "Reels · Hormozi Punch",
    patch: {
      fontFamily: font("Anton"),
      fontWeight: 900,
      fontSize: 52,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 5,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 95,
      shadowX: 0,
      shadowY: 5,
      shadowBlur: 10,
      posY: 78,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#22C55E", // Hormozi green
      activeWordScale: 1.25,
    }
  },
  {
    name: "Reels · Single Word Blitz",
    patch: {
      fontFamily: font("Impact"),
      fontWeight: 900,
      fontSize: 56,
      textCase: "upper",
      color: "#FFE600",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 5,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 6,
      shadowBlur: 14,
      posY: 50,
      wordsPerChunk: 1,
      transition: "pop",
      transitionSpeed: 80,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#FFE600",
      activeWordScale: 1.2,
    }
  },
  {
    name: "Reels · Marker Highlighter",
    patch: {
      fontFamily: font("Inter"),
      fontWeight: 800,
      fontSize: 44,
      textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 70,
      shadowX: 0,
      shadowY: 3,
      shadowBlur: 8,
      posY: 80,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: "#FACC15",
      activeWordColor: "#000000",
      activeWordScale: 1.1,
    }
  },
  {
    name: "Reels · Minimalist Story",
    patch: {
      fontFamily: font("DM Sans"),
      fontWeight: 600,
      fontSize: 36,
      textCase: "normal",
      color: "#F1F5F9",
      strokeOn: false,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 60,
      shadowX: 0,
      shadowY: 2,
      shadowBlur: 8,
      posY: 85,
      wordsPerChunk: 3,
      transition: "fade",
      transitionSpeed: 180,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#38BDF8",
      activeWordScale: 1.04,
    }
  },
  {
    name: "Reels · Cyber Neon Glow",
    patch: {
      fontFamily: font("Righteous"),
      fontWeight: 700,
      fontSize: 46,
      textCase: "upper",
      color: "#FFFFFF",
      glowOn: true,
      glowColor: "#00F0FF",
      glowBlur: 18,
      glowIntensity: 85,
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowOn: true,
      shadowColor: "#000000",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 76,
      wordsPerChunk: 2,
      transition: "pop",
      transitionSpeed: 95,
      activeWordOn: true,
      activeWordBgOn: false,
      activeWordColor: "#00F0FF",
      activeWordScale: 1.18,
    }
  }
];
export const DIVEO_TEMPLATE_PACK = SHORTS_REELS_TEMPLATE_PACK;

import { CAPTIK_72_PRESETS, type CaptikPresetItem } from "./captikPresets";
export { CAPTIK_72_PRESETS, type CaptikPresetItem };

// Top World-Class Curated Presets: Signature 50 studio packs + All 72 Captik templates
export const CAP_PRESETS: {
  name: string;
  patch: Partial<CapStyle>;
  category?: string;
  id?: string;
  cleanName?: string;
  isBehindYou?: boolean;
  isNew?: boolean;
  video?: string;
  poster?: string;
}[] = [
  ...KINETIC_TEMPLATE_PACK.map((s) => ({ ...s, category: "Kinetic Motion" as const })),
  ...SHORTS_REELS_TEMPLATE_PACK.map((s) => ({ ...s, category: "Shorts & Reels" as const })),
  ...DYNAMIC_POP_TEMPLATE_PACK.map((s) => ({ ...s, category: "Dynamic Pop" as const })),
  ...DESI_VIRAL_TEMPLATE_PACK.map((s) => ({ ...s, category: "Desi Viral" as const })),
  ...CREATOR_PRO_TEMPLATE_PACK.map((s) => ({ ...s, category: "Creator Pro" as const })),
  ...CAPTIK_72_PRESETS,
];

// Category derivation for the Templates picker. Explicit `category` wins; otherwise
// we infer from the preset name using well-known keywords.
export type PresetCategory =
  | "All"
  | "Popular"
  | "Behind you"
  | "Bold & animated"
  | "Clean"
  | "Property reels"
  | "Kinetic Motion"
  | "Shorts & Reels"
  | "Dynamic Pop"
  | "Desi Viral"
  | "Creator Pro"
  | "Moonshot"
  | "Captions.ai"
  | "Captik"
  | "Kalakar"
  | "Diveo"
  | "Built-in"
  | "Core Pack"
  | "Creators"
  | "YT Creators"
  | "Ultimate"
  | "Bold & Impact"
  | "Minimal"
  | "Neon & Glow"
  | "Cinematic"
  | "Karaoke"
  | "Retro & Fun"
  | "News & Pro";

const CATEGORY_RULES: { label: Exclude<PresetCategory, "All" | "Built-in">; test: RegExp }[] = [
  { label: "Behind you",     test: /behind|depth cutout|reveal|beacon|cove|driftwood|ellis|ferrier|garnet|hawser|ibis|jetty|keel|lanyard|mizzen|netting|outhaul|painter|quay|scupper|taffrail|underway|vang|windlass|yawl|abbey|effigy|font|hassock|iron|jamb|lintel|mullion/i },
  { label: "Property reels", test: /property|real estate|belfry|cloister|dovecote|gable/i },
  { label: "Bold & animated",test: /bold & animated|animated|punch|masala|tabahi|blockbuster|big red|scribble|interlock/i },
  { label: "Clean",          test: /clean|minimal|swiss|journal|anchorage|saadha|seedha/i },
  { label: "Popular",        test: /popular|glow|abdaal|shadow|captik|bubble|hormozi|boxed|beast|gadzhi|prism/i },
  { label: "Kinetic Motion", test: /kinetic|viral flow|3d depth|moonshot/i },
  { label: "Shorts & Reels", test: /reels|shorts|blitz|marker|diveo/i },
  { label: "Dynamic Pop",   test: /dynamic|classic pill|typewriter|captions\.ai/i },
  { label: "Desi Viral",    test: /desi|bhashini|hinglish|bollywood/i },
  { label: "Creator Pro",   test: /creator|podcast|sharan|ranveer|shamani|kalakar/i },
  { label: "Karaoke",       test: /karaoke|sing|word[- ]?highlight|color[- ]?sweep/i },
  { label: "Neon & Glow",   test: /neon|glow|cyber|glitch|streamer/i },
  { label: "Cinematic",     test: /cinemat|luxury|serif|documentary|magnates|johnny|iman/i },
  { label: "Retro & Fun",   test: /8[- ]?bit|arcade|comic|bubble|pastel|typewriter|mechanical|fredoka|bangers/i },
  { label: "News & Pro",    test: /news|b2b|professional|educator|breaking|ticker|physics|guruji|dhruv/i },
  { label: "Bold & Impact", test: /bold|impact|pop|punch|beast|action|maximum|carry|ishow|kai|zoom/i },
  { label: "Minimal",       test: /minimal|clean|dark mode|dan koe|soft|casual/i },
];

export const getPresetCategory = (p: { name: string; category?: string }): PresetCategory => {
  if (p.category) return p.category as PresetCategory;
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(p.name)) return rule.label;
  }
  return "Built-in";
};

export const PRESET_CATEGORIES: PresetCategory[] = [
  "All",
  "Popular",
  "Behind you",
  "Bold & animated",
  "Clean",
  "Property reels",
  "Kinetic Motion",
  "Shorts & Reels",
  "Dynamic Pop",
  "Desi Viral",
  "Creator Pro",
  "Neon & Glow",
  "Cinematic",
  "Karaoke",
  "Retro & Fun",
  "News & Pro",
];


// -----------------------------------------------------------------------------
// Free vs Premium templates
// -----------------------------------------------------------------------------
// Only these 6 world-class presets are free for everyone. Every other preset in
// CAP_PRESETS is premium (paid plan or admin required). Curated to cover the
// core caption looks: highlight, pop, outline, viral, box, cinematic.
export const FREE_PRESET_NAMES: readonly string[] = [
  "Kinetic · Viral Flow",
  "Kinetic · 3D Depth Cutout",
  "Reels · 1-Click Karaoke",
  "Dynamic · Classic Pill",
  "Desi · Bollywood Hit",
  "Creator · Hormozi Viral",
  "Creator · MrBeast Pop",
  "Creator · Ali Abdaal Studio",
  "Creator · Iman Gadzhi Luxury",
  "Reels · Cyber Neon Glow",
];
const FREE_SET = new Set(FREE_PRESET_NAMES.map((n) => n.toLowerCase()));
export const isPresetFree = (name: string): boolean => FREE_SET.has(name.toLowerCase());
