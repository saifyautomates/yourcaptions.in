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

export const CAP_PRESETS: { name: string; patch: Partial<CapStyle>; category?: string }[] = [
  {
    // "The Cinematic Story" — bottom-center Helvetica-Neue 700, white fill with
    // a bold black stroke + hard-then-soft double drop shadow so it stays crisp
    // over any footage. Active word flips to Star-Wars yellow (#FFE81F) while
    // keeping the same black outline. Natural case, fade-in entry, no
    // per-word transition — mimics a documentary/story-telling look.
    name: "The Cinematic Story",
    category: "Cinematic",
    patch: {
      fontFamily: font("Helvetica Neue"),
      fontWeight: 700,
      fontSize: 40,
      textCase: "normal",
      color: "#FFFFFF",
      letterSpacing: 0,
      lineHeight: 1.2,
      align: "center",
      posY: 82,
      wordsPerChunk: 4,
      strokeOn: true, strokeColor: "#000000", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 2, shadowY: 2, shadowBlur: 5,
      glowOn: false, bgOn: false,
      transition: "fade", transitionSpeed: 200,
      activeWordOn: true, activeWordBgOn: false,
      activeWordColor: "#FFE81F", activeWordScale: 1.0,
    },
  },

  {
    // "The DOAC Podcast Style" — viral short-form podcast look inspired by The Diary
    // Of A CEO clips. Heavy uppercase Montserrat, deep black stroke + drop-shadow for
    // readability on any background, and per-word impact highlighting in red/yellow.
    // Fill in `impactWordsRed` / `impactWordsYellow` in the style panel per clip.
    name: "The DOAC Podcast Style",
    category: "Podcast",
    patch: {
      fontFamily: font("Montserrat"),
      fontWeight: 900,
      fontSize: 42,
      textCase: "upper",
      color: "#FFFFFF",
      letterSpacing: -0.5,
      lineHeight: 1.1,
      align: "center",
      posY: 80,
      wordsPerChunk: 3,
      strokeOn: true, strokeColor: "rgba(0,0,0,0.9)", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 85, shadowX: 0, shadowY: 6, shadowBlur: 12,
      glowOn: false, bgOn: false,
      transition: "fade", transitionSpeed: 150,
      activeWordOn: true, activeWordBgOn: false,
      activeWordColor: "#FFFFFF", activeWordScale: 1.05,
      impactRedColor: "#E60000",
      impactYellowColor: "#FFEA00",
      impactWordsRed: "never, stop, don't, no, wrong, fail, hate, kill, lost, broken",
      impactWordsYellow: "money, success, secret, truth, win, growth, huge, insane, changed, everything",
    },
  },

  {
    // Matches the reference clip: white sans text with a solid blue box behind the active word,
    // natural case, bottom-centered, one word chunks so every word reads as its own blue pill.
    name: "AI Blue Box",
    category: "Core Pack",
    patch: {
      fontFamily: font("Inter"), fontWeight: 700, fontSize: 46, textCase: "normal",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 3, shadowBlur: 10,
      posY: 86, wordsPerChunk: 3, align: "center",
      transition: "fade", transitionSpeed: 160,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#1E5BFF",
      activeWordColor: "#FFFFFF", activeWordScale: 1.0,
    },
  },
  {
    // One-click: bright yellow highlight behind the active word.
    name: "Yellow Highlight",
    patch: {
      fontFamily: font("Inter"), fontWeight: 800, fontSize: 44, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 2, shadowBlur: 6,
      glowOn: false, bgOn: false, posY: 78, wordsPerChunk: 3,
      transition: "pop", transitionSpeed: 220,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#FACC15",
      activeWordColor: "#111111", activeWordScale: 1.06,
    },
  },
  {
    // One-click: bold text that pops in with a scale bounce, no background.
    name: "Popping Text",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 900, fontSize: 48, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 65, shadowX: 0, shadowY: 3, shadowBlur: 10,
      posY: 72, wordsPerChunk: 2,
      transition: "pop", transitionSpeed: 180,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FDE047", activeWordScale: 1.22,
    },
  },
  {
    // One-click: heavy black stroke outline around white text.
    name: "Stroke Outline",
    patch: {
      fontFamily: font("Anton"), fontWeight: 800, fontSize: 46, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 5,
      shadowOn: false, glowOn: false, bgOn: false,
      posY: 75, wordsPerChunk: 3,
      transition: "pop", transitionSpeed: 220,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FACC15", activeWordScale: 1.08,
    },
  },
  {
    // Elegant cinematic serif in warm gold on softly tinted backdrop — inspired by film title cards.
    name: "Cinematic Serif",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 700, fontSize: 44, textCase: "normal",
      color: "#D9B98A",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 55, shadowX: 0, shadowY: 3, shadowBlur: 14,
      glowOn: false, bgOn: false, strokeOn: false, posY: 50, wordsPerChunk: 3,
      transition: "fade", transitionSpeed: 380,
      activeWordOn: true, activeWordColor: "#F1D9A8", activeWordBgOn: false, activeWordScale: 1.02,
      letterSpacing: 1,
    },
  },
  {
    name: "Ali Abdaal",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 30, textCase: "normal",
      color: "#111111", bgOn: true, bgColor: "#FFFFFF", bgOpacity: 100, bgRadius: 12, bgPadX: 18, bgPadY: 10,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 25, shadowX: 0, shadowY: 6, shadowBlur: 18,
      glowOn: false, strokeOn: false, posY: 82,
      transition: "fade", transitionSpeed: 260,
      activeWordOn: true, activeWordColor: "#9CA3AF", activeWordBgOn: false, activeWordScale: 1,
    },
  },
  {
    name: "Pop Up",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 42, textCase: "upper",
      color: "#FFFFFF", strokeOn: true, strokeColor: "#000000", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 4, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 60, transition: "pop", transitionSpeed: 260,
      activeWordOn: true, activeWordColor: "#22C55E", activeWordBgOn: false, activeWordScale: 1.08,
    },
  },
  {
    name: "Kalakar Shadow",
    patch: {
      fontFamily: font("Bebas Neue"), fontWeight: 700, fontSize: 38, textCase: "normal",
      colorMode: "gradient", gradFrom: "#FBBF24", gradTo: "#F97316", gradAngle: 90,
      shadowOn: true, shadowColor: "#7C2D12", shadowOpacity: 90, shadowX: 0, shadowY: 4, shadowBlur: 12,
      glowOn: false, bgOn: false, strokeOn: false, posY: 55,
      transition: "pop", transitionSpeed: 240,
    },
  },
  {
    name: "Double Trouble",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 30, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 2, shadowBlur: 8,
      glowOn: false, bgOn: false, strokeOn: false, posY: 82, wordsPerChunk: 3,
      transition: "fade", transitionSpeed: 240,
      activeWordOn: true, activeWordColor: "#FDE047", activeWordBgOn: false, activeWordScale: 1.06,
    },
  },
  {
    name: "Bubble Style",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 800, fontSize: 30, textCase: "normal",
      color: "#FFFFFF", bgOn: false,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 86,
      transition: "bounce", transitionSpeed: 320,
      // Bubble = per-word rounded pill on the active word.
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#22C55E", activeWordColor: "#FFFFFF", activeWordScale: 1.04,
    },
  },
  {
    name: "Shamani",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 42, textCase: "upper",
      color: "#FDE047",
      glowOn: true, glowColor: "#FDE047", glowBlur: 28, glowIntensity: 70,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 3, shadowBlur: 4,
      bgOn: false, strokeOn: false, posY: 55,
      transition: "zoom", transitionSpeed: 300,
    },
  },
  {
    name: "Hormozi Style",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 44, textCase: "upper",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 4, shadowBlur: 8,
      strokeOn: true, strokeColor: "#0A0F0A", strokeWidth: 2,
      glowOn: false, bgOn: false, posY: 55,
      transition: "pop", transitionSpeed: 200,
      // Hormozi signature: current word turns lime green.
      activeWordOn: true, activeWordColor: "#A3E635", activeWordBgOn: false, activeWordScale: 1.12,
    },
  },
  {
    name: "Editing Skool",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 800, fontSize: 30, textCase: "normal",
      color: "#FFFFFF", bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 6,
      strokeOn: false, glowOn: false, posY: 55, wordsPerChunk: 1,
      transition: "pop", transitionSpeed: 200,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#F97316", activeWordColor: "#FFFFFF", activeWordScale: 1.08,
    },
  },
  {
    name: "Mr Beast Style 1",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 44, textCase: "upper",
      color: "#FFFFFF", strokeOn: true, strokeColor: "#000000", strokeWidth: 4,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 6, shadowBlur: 0,
      bgOn: false, glowOn: false, posY: 78,
      transition: "pop", transitionSpeed: 240,
      activeWordOn: true, activeWordColor: "#FDE047", activeWordBgOn: false, activeWordScale: 1.12,
    },
  },
  {
    name: "Mr Beast Style 2",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 40, textCase: "normal",
      color: "#FDE047",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 3, shadowY: 4, shadowBlur: 0,
      strokeOn: false, bgOn: false, glowOn: false, posY: 60,
      transition: "pop", transitionSpeed: 240,
      activeWordOn: true, activeWordColor: "#22C55E", activeWordBgOn: false, activeWordScale: 1.1,
    },
  },
  {
    name: "Iman Gadzhi",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 32, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 2, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 85,
      transition: "fade", transitionSpeed: 300,
      activeWordOn: true, activeWordColor: "#FBBF24", activeWordScale: 1.06,
    },
  },
  {
    name: "Devin Jatho",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 46, textCase: "upper",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 4, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 60,
      transition: "zoom", transitionSpeed: 320,
      activeWordOn: true, activeWordColor: "#A78BFA", activeWordBgOn: false, activeWordScale: 1.14,
    },
  },
  {
    name: "Highlighted Word",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 30, textCase: "normal",
      color: "#F97316",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 2, shadowBlur: 8,
      strokeOn: false, bgOn: false, glowOn: false, posY: 82,
      transition: "fade", transitionSpeed: 260,
    },
  },
  {
    name: "Clean Glow Style",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 32, textCase: "normal",
      color: "#FFFFFF",
      glowOn: true, glowColor: "#FFFFFF", glowBlur: 14, glowIntensity: 30,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 3, shadowBlur: 12,
      strokeOn: false, bgOn: false, posY: 85,
      transition: "fade", transitionSpeed: 300,
    },
  },
  {
    name: "Kalakar Clean",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 600, fontSize: 28, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 2, shadowBlur: 8,
      strokeOn: false, bgOn: false, glowOn: false, posY: 85,
      transition: "fade", transitionSpeed: 280,
    },
  },
  {
    name: "Deep Glow",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 44, textCase: "upper",
      color: "#FFFFFF",
      glowOn: true, glowColor: "#FF00FF", glowBlur: 30, glowIntensity: 90,
      shadowOn: false, strokeOn: false, bgOn: false, posY: 55,
      transition: "zoom", transitionSpeed: 320,
    },
  },
  {
    name: "Underline",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 800, fontSize: 32, textCase: "normal",
      color: "#FFFFFF", bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 2, shadowBlur: 6,
      strokeOn: false, glowOn: false, posY: 55, wordsPerChunk: 3,
      transition: "slide-up", transitionSpeed: 300,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#EC4899", activeWordColor: "#FFFFFF", activeWordScale: 1,
    },
  },
  {
    name: "Flicker",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 800, fontSize: 46, textCase: "normal",
      color: "#FFFFFF",
      glowOn: true, glowColor: "#FFFFFF", glowBlur: 24, glowIntensity: 80,
      shadowOn: false, strokeOn: false, bgOn: false, posY: 60,
      transition: "pop", transitionSpeed: 220, wordsPerChunk: 1,
      activeWordOn: true, activeWordColor: "#7CD3A8", activeWordBgOn: false, activeWordScale: 1.1,
    },
  },
  {
    name: "Shamani 2",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 40, textCase: "upper",
      color: "#FFFFFF",
      glowOn: true, glowColor: "#FDE047", glowBlur: 20, glowIntensity: 60,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 6,
      strokeOn: false, bgOn: false, posY: 55, wordsPerChunk: 3,
      transition: "wave", transitionSpeed: 380,
    },
  },
  {
    name: "Kalakar",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 28, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 2, shadowBlur: 8,
      strokeOn: false, bgOn: false, glowOn: false, posY: 88,
      transition: "fade", transitionSpeed: 260,
    },
  },
  {
    name: "Clean Motion",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 32, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 2, shadowBlur: 8,
      strokeOn: false, bgOn: false, glowOn: false, posY: 82,
      transition: "slide-up", transitionSpeed: 380,
      activeWordOn: true, activeWordColor: "#7CD3A8", activeWordScale: 1.05,
    },
  },
  {
    name: "Kalakar Glow",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 42, textCase: "upper",
      color: "#A3E635",
      glowOn: true, glowColor: "#22C55E", glowBlur: 26, glowIntensity: 80,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 3, shadowBlur: 6,
      strokeOn: false, bgOn: false, posY: 60,
      transition: "pop", transitionSpeed: 260,
    },
  },
  {
    name: "Delhi",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 500, italic: true, fontSize: 30, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 2, shadowBlur: 12,
      strokeOn: false, bgOn: false, glowOn: false, posY: 82,
      transition: "slide-up", transitionSpeed: 340,
      activeWordOn: true, activeWordColor: "#FBBF24", activeWordScale: 1.04,
    },
  },
  {
    name: "Pixelated Word",
    patch: {
      fontFamily: font("JetBrains Mono"), fontWeight: 700, fontSize: 34, textCase: "upper",
      color: "#FFFFFF", letterSpacing: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 0,
      strokeOn: false, bgOn: false, glowOn: false, posY: 60,
      transition: "typewriter", transitionSpeed: 320,
    },
  },
  {
    name: "Ziada",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 28, textCase: "normal",
      color: "#FFFFFF", bgOn: true, bgColor: "#000000", bgOpacity: 100, bgRadius: 999, bgPadX: 16, bgPadY: 8,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 78, lineHeight: 1.6, wordsPerChunk: 3,
      transition: "slide-up", transitionSpeed: 320,
    },
  },
  {
    name: "Thora Cinematic",
    patch: {
      fontFamily: font("Space Grotesk"), fontWeight: 500, fontSize: 38, textCase: "upper",
      color: "#FFFFFF", letterSpacing: 6,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 2, shadowBlur: 8,
      strokeOn: false, bgOn: false, glowOn: false, posY: 55,
      transition: "fade", transitionSpeed: 500,
    },
  },
  {
    name: "Zero Gravity",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 26, textCase: "normal",
      color: "#FFFFFF", bgOn: true, bgColor: "#EC4899", bgOpacity: 100, bgRadius: 999, bgPadX: 16, bgPadY: 8,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 40, shadowX: 0, shadowY: 4, shadowBlur: 10,
      strokeOn: false, glowOn: false, posY: 65, lineHeight: 1.8, wordsPerChunk: 3,
      transition: "bounce", transitionSpeed: 340,
    },
  },
  // ── Reference-video inspired presets ─────────────────────────────────
  {
    // Bold lavender uppercase keyword hook at the top of the frame.
    name: "Purple Punch",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 44, textCase: "upper",
      color: "#A78BFA", letterSpacing: 1,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 18,
      transition: "pop", transitionSpeed: 240,
    },
  },
  {
    // Crisp white pill with dark text — green tint reads as a highlight keyword.
    name: "White Pill Highlight",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 800, fontSize: 30, textCase: "normal",
      color: "#0F172A",
      bgOn: true, bgColor: "#FFFFFF", bgOpacity: 100, bgRadius: 10, bgPadX: 14, bgPadY: 7,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 25, shadowX: 0, shadowY: 4, shadowBlur: 14,
      strokeOn: false, glowOn: false, posY: 22,
      transition: "fade", transitionSpeed: 260,
    },
  },
  {
    // Documentary title-card: heavy serif, blood red, uppercase, top-heavy.
    name: "Documentary Serif",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 900, fontSize: 48, textCase: "upper",
      color: "#7F1D1D", letterSpacing: 2, lineHeight: 1.05,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 25, shadowX: 2, shadowY: 4, shadowBlur: 8,
      strokeOn: false, bgOn: false, glowOn: false, posY: 28,
      transition: "slide-down", transitionSpeed: 420,
    },
  },
  {
    // Classic TikTok / reels: bold white with heavy black stroke, centered-lower.
    name: "TikTok Bold",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 900, fontSize: 32, textCase: "normal",
      color: "#FFFFFF", lineHeight: 1.15,
      strokeOn: true, strokeColor: "#000000", strokeWidth: 3,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 6,
      bgOn: false, glowOn: false, posY: 75,
      transition: "pop", transitionSpeed: 220,
    },
  },
  // ── Additional popular creator/social styles ─────────────────────────
  {
    name: "MrBeast Yellow",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 44, textCase: "upper",
      color: "#FDE047", strokeOn: true, strokeColor: "#000000", strokeWidth: 4,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 6, shadowBlur: 0,
      bgOn: false, glowOn: false, posY: 78,
      transition: "pop", transitionSpeed: 220,
      activeWordOn: true, activeWordColor: "#22C55E", activeWordScale: 1.12,
    },
  },
  {
    name: "Karaoke Yellow",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 800, fontSize: 34, textCase: "normal",
      color: "#FFFFFF", strokeOn: true, strokeColor: "#000000", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 6,
      bgOn: false, glowOn: false, posY: 82,
      transition: "fade", transitionSpeed: 220,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#FDE047", activeWordColor: "#000000", activeWordScale: 1,
    },
  },
  {
    name: "Neon Cyan",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 42, textCase: "upper",
      color: "#22D3EE",
      glowOn: true, glowColor: "#06B6D4", glowBlur: 30, glowIntensity: 90,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 2, shadowBlur: 6,
      strokeOn: false, bgOn: false, posY: 58,
      transition: "zoom", transitionSpeed: 260,
    },
  },
  {
    name: "Neon Pink",
    patch: {
      fontFamily: font("Bebas Neue"), fontWeight: 700, fontSize: 44, textCase: "upper", letterSpacing: 2,
      color: "#FFFFFF",
      glowOn: true, glowColor: "#EC4899", glowBlur: 28, glowIntensity: 85,
      shadowOn: true, shadowColor: "#7E22CE", shadowOpacity: 70, shadowX: 0, shadowY: 4, shadowBlur: 14,
      strokeOn: false, bgOn: false, posY: 60,
      transition: "pop", transitionSpeed: 260,
    },
  },
  {
    name: "Retro VHS",
    patch: {
      fontFamily: font("Press Start 2P"), fontWeight: 400, fontSize: 22, textCase: "upper", letterSpacing: 2,
      color: "#F0FDF4",
      shadowOn: true, shadowColor: "#EC4899", shadowOpacity: 100, shadowX: 3, shadowY: 0, shadowBlur: 0,
      glowOn: true, glowColor: "#22D3EE", glowBlur: 14, glowIntensity: 60,
      strokeOn: false, bgOn: false, posY: 60,
      transition: "typewriter", transitionSpeed: 260,
    },
  },
  {
    name: "Newspaper",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 900, fontSize: 40, textCase: "upper", letterSpacing: 1,
      color: "#0A0A0A",
      bgOn: true, bgColor: "#FFFFFF", bgOpacity: 100, bgRadius: 0, bgPadX: 18, bgPadY: 10,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 30,
      transition: "slide-down", transitionSpeed: 320,
    },
  },
  {
    name: "Chalkboard",
    patch: {
      fontFamily: font("Caveat"), fontWeight: 700, fontSize: 44, textCase: "normal",
      color: "#FEF3C7",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 2, shadowBlur: 4,
      strokeOn: false, bgOn: false, glowOn: false, posY: 55,
      transition: "fade", transitionSpeed: 340,
    },
  },
  {
    name: "Comic Pop",
    patch: {
      fontFamily: font("Bangers"), fontWeight: 400, fontSize: 46, textCase: "upper", letterSpacing: 2,
      color: "#FDE047", strokeOn: true, strokeColor: "#000000", strokeWidth: 3,
      shadowOn: true, shadowColor: "#EF4444", shadowOpacity: 100, shadowX: 4, shadowY: 4, shadowBlur: 0,
      bgOn: false, glowOn: false, posY: 55,
      transition: "bounce", transitionSpeed: 260,
    },
  },
  {
    name: "Marker Highlight",
    patch: {
      fontFamily: font("Permanent Marker"), fontWeight: 400, fontSize: 40, textCase: "normal",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#F97316", bgOpacity: 100, bgRadius: 4, bgPadX: 10, bgPadY: 4,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 2, shadowBlur: 4,
      strokeOn: false, glowOn: false, posY: 65,
      transition: "pop", transitionSpeed: 240,
    },
  },
  {
    name: "Reels Minimal",
    patch: {
      fontFamily: font("Inter"), fontWeight: 700, fontSize: 26, textCase: "normal",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#000000", bgOpacity: 55, bgRadius: 6, bgPadX: 10, bgPadY: 5,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 88,
      transition: "fade", transitionSpeed: 220,
    },
  },
  {
    name: "Podcast Clip",
    patch: {
      fontFamily: font("Montserrat"), fontWeight: 800, fontSize: 34, textCase: "upper", letterSpacing: 1,
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 85, shadowX: 0, shadowY: 3, shadowBlur: 8,
      bgOn: false, glowOn: false, posY: 82,
      transition: "slide-up", transitionSpeed: 280,
      activeWordOn: true, activeWordColor: "#FBBF24", activeWordScale: 1.08,
    },
  },
  {
    name: "Cinematic Bar",
    patch: {
      fontFamily: font("Space Grotesk"), fontWeight: 500, fontSize: 30, textCase: "normal", letterSpacing: 3,
      color: "#F5F5F4",
      bgOn: true, bgColor: "#000000", bgOpacity: 85, bgRadius: 0, bgPadX: 20, bgPadY: 10,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 90,
      transition: "fade", transitionSpeed: 480,
    },
  },
  {
    name: "Gaming Streamer",
    patch: {
      fontFamily: font("Russo One"), fontWeight: 400, fontSize: 40, textCase: "upper", letterSpacing: 1,
      color: "#A3E635",
      strokeOn: true, strokeColor: "#0A0A0A", strokeWidth: 3,
      glowOn: true, glowColor: "#22C55E", glowBlur: 20, glowIntensity: 70,
      shadowOn: false, bgOn: false, posY: 78,
      transition: "zoom", transitionSpeed: 240,
    },
  },
  {
    name: "Vlog Bubble",
    patch: {
      fontFamily: font("Fredoka"), fontWeight: 600, fontSize: 30, textCase: "normal",
      color: "#0F172A",
      bgOn: true, bgColor: "#FDE68A", bgOpacity: 100, bgRadius: 999, bgPadX: 18, bgPadY: 10,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 25, shadowX: 0, shadowY: 4, shadowBlur: 12,
      strokeOn: false, glowOn: false, posY: 80,
      transition: "bounce", transitionSpeed: 320,
    },
  },
  {
    name: "Explainer Serif",
    patch: {
      fontFamily: font("DM Serif Display"), fontWeight: 400, fontSize: 36, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 78,
      transition: "fade", transitionSpeed: 360,
    },
  },
  {
    name: "Sunset Gradient",
    patch: {
      fontFamily: font("Outfit"), fontWeight: 900, fontSize: 40, textCase: "upper",
      colorMode: "gradient", gradFrom: "#F97316", gradTo: "#EC4899", gradAngle: 90,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 60,
      transition: "pop", transitionSpeed: 260,
    },
  },
  {
    name: "Ocean Gradient",
    patch: {
      fontFamily: font("Sora"), fontWeight: 800, fontSize: 38, textCase: "normal",
      colorMode: "gradient", gradFrom: "#22D3EE", gradTo: "#6366F1", gradAngle: 135,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 60,
      transition: "slide-up", transitionSpeed: 300,
    },
  },
  {
    name: "Horror",
    patch: {
      fontFamily: font("Creepster"), fontWeight: 400, fontSize: 48, textCase: "normal", letterSpacing: 2,
      color: "#DC2626",
      glowOn: true, glowColor: "#7F1D1D", glowBlur: 24, glowIntensity: 80,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 4, shadowBlur: 10,
      strokeOn: false, bgOn: false, posY: 55,
      transition: "wave", transitionSpeed: 380,
    },
  },
  {
    name: "Kinetic Caps",
    patch: {
      fontFamily: font("Barlow Condensed"), fontWeight: 900, fontSize: 46, textCase: "upper", letterSpacing: 1,
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 4, shadowBlur: 0,
      strokeOn: false, bgOn: false, glowOn: false, posY: 55, wordsPerChunk: 1,
      transition: "pop", transitionSpeed: 180,
      activeWordOn: true, activeWordColor: "#FDE047", activeWordScale: 1.15,
    },
  },
  {
    name: "Instagram Story",
    patch: {
      fontFamily: font("Poppins"), fontWeight: 700, fontSize: 30, textCase: "normal",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#DB2777", bgOpacity: 100, bgRadius: 6, bgPadX: 12, bgPadY: 6,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 55,
      transition: "slide-up", transitionSpeed: 280,
    },
  },
  {
    name: "YouTube Shorts",
    patch: {
      fontFamily: font("Roboto"), fontWeight: 900, fontSize: 36, textCase: "upper",
      color: "#FFFFFF", strokeOn: true, strokeColor: "#000000", strokeWidth: 3,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 4, shadowBlur: 8,
      bgOn: false, glowOn: false, posY: 75,
      transition: "pop", transitionSpeed: 220,
      activeWordOn: true, activeWordColor: "#EF4444", activeWordScale: 1.1,
    },
  },
  {
    name: "Twitch Chat",
    patch: {
      fontFamily: font("Inter"), fontWeight: 700, fontSize: 24, textCase: "normal",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#6441A5", bgOpacity: 100, bgRadius: 4, bgPadX: 10, bgPadY: 5,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 88,
      transition: "fade", transitionSpeed: 200,
    },
  },
  {
    name: "Motivational",
    patch: {
      fontFamily: font("Oswald"), fontWeight: 700, fontSize: 42, textCase: "upper", letterSpacing: 2,
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 4, shadowBlur: 12,
      strokeOn: false, bgOn: false, glowOn: false, posY: 55,
      transition: "zoom", transitionSpeed: 360,
      activeWordOn: true, activeWordColor: "#FDE047", activeWordScale: 1.1,
    },
  },
  {
    name: "Luxury Gold",
    patch: {
      fontFamily: font("Cormorant Garamond"), fontWeight: 700, italic: true, fontSize: 40, textCase: "normal",
      colorMode: "gradient", gradFrom: "#FBBF24", gradTo: "#B45309", gradAngle: 135,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 55,
      transition: "fade", transitionSpeed: 460,
    },
  },
  // ── Reference-pack styles (Align, Volt, Ember, Rebel, Lumen, Magazine,
  //     Film, Ignite, Clarity, Growth, Recess, Cinematic II, Pulse,
  //     Velocity, Blueprint, Core, Analog, Zine, Archive) ─────────────────
  {
    name: "Align",
    patch: {
      fontFamily: font("Special Elite"), fontWeight: 400, fontSize: 22, textCase: "upper", letterSpacing: 6,
      color: "#0F172A",
      bgOn: true, bgColor: "#FFFFFF", bgOpacity: 100, bgRadius: 4, bgPadX: 14, bgPadY: 8,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 82,
      transition: "fade", transitionSpeed: 280,
    },
  },
  {
    name: "Volt",
    patch: {
      fontFamily: font("Inter"), fontWeight: 800, fontSize: 40, textCase: "normal",
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 60,
      transition: "pop", transitionSpeed: 220, wordsPerChunk: 1,
      activeWordOn: true, activeWordColor: "#A3E635", activeWordScale: 1.08,
    },
  },
  {
    name: "Ember",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 34, textCase: "upper", letterSpacing: 1,
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 4, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 82,
      transition: "slide-up", transitionSpeed: 300,
    },
  },
  {
    name: "Rebel",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 34, textCase: "normal",
      color: "#FFFFFF", strokeOn: true, strokeColor: "#000000", strokeWidth: 3,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 3, shadowY: 3, shadowBlur: 0,
      bgOn: false, glowOn: false, posY: 78,
      transition: "pop", transitionSpeed: 220,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#EAFF00", activeWordColor: "#0A0A0A", activeWordScale: 1,
    },
  },
  {
    name: "Lumen",
    patch: {
      fontFamily: font("Inter"), fontWeight: 700, fontSize: 30, textCase: "normal",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#0A0A0A", bgOpacity: 95, bgRadius: 8, bgPadX: 14, bgPadY: 8,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 60,
      transition: "fade", transitionSpeed: 260,
    },
  },
  {
    name: "Magazine",
    patch: {
      fontFamily: font("Great Vibes"), fontWeight: 400, italic: true, fontSize: 46, textCase: "normal",
      color: "#F5F5F4",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 22,
      transition: "fade", transitionSpeed: 460,
    },
  },
  {
    name: "Film",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 50, textCase: "upper", letterSpacing: 2,
      color: "#FDE047",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 4, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 20,
      transition: "slide-down", transitionSpeed: 340,
      activeWordOn: true, activeWordColor: "#FACC15", activeWordScale: 1.05,
    },
  },
  {
    name: "Ignite",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 52, textCase: "upper", letterSpacing: 2,
      color: "#DC2626",
      strokeOn: true, strokeColor: "#7F1D1D", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 4, shadowBlur: 14,
      bgOn: false, glowOn: false, posY: 18,
      transition: "zoom", transitionSpeed: 320,
    },
  },
  {
    name: "Clarity",
    patch: {
      fontFamily: font("Inter"), fontWeight: 700, fontSize: 28, textCase: "normal", lineHeight: 1.4,
      color: "#0F172A",
      bgOn: true, bgColor: "#E5E7EB", bgOpacity: 95, bgRadius: 8, bgPadX: 14, bgPadY: 8,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 25, shadowX: 0, shadowY: 4, shadowBlur: 12,
      strokeOn: false, glowOn: false, posY: 78, wordsPerChunk: 4,
      transition: "fade", transitionSpeed: 260,
    },
  },
  {
    name: "Growth",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 60, textCase: "upper", letterSpacing: 2,
      color: "#B91C1C",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 3, shadowY: 4, shadowBlur: 8,
      strokeOn: false, bgOn: false, glowOn: false, posY: 30,
      transition: "zoom", transitionSpeed: 320,
    },
  },
  {
    name: "Recess",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 44, textCase: "upper", letterSpacing: 1,
      colorMode: "gradient", gradFrom: "#FFFFFF", gradTo: "#A78BFA", gradAngle: 90,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 3, shadowBlur: 12,
      strokeOn: false, bgOn: false, glowOn: false, posY: 55,
      transition: "pop", transitionSpeed: 260,
    },
  },
  {
    name: "Cinematic II",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 700, italic: true, fontSize: 34, textCase: "normal",
      color: "#FBBF24",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 3, shadowBlur: 14,
      strokeOn: false, bgOn: false, glowOn: false, posY: 82,
      transition: "fade", transitionSpeed: 420,
    },
  },
  {
    name: "Pulse",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 34, textCase: "upper", letterSpacing: 1,
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 3, shadowBlur: 10,
      strokeOn: false, bgOn: false, glowOn: false, posY: 78,
      transition: "pop", transitionSpeed: 240,
      activeWordOn: true, activeWordColor: "#22D3EE", activeWordScale: 1.06,
    },
  },
  {
    name: "Velocity",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 46, textCase: "upper", letterSpacing: 1,
      color: "#FDE047",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 2,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 4, shadowY: 4, shadowBlur: 0,
      glowOn: true, glowColor: "#FACC15", glowBlur: 20, glowIntensity: 60,
      bgOn: false, posY: 22,
      transition: "slide-down", transitionSpeed: 300,
    },
  },
  {
    name: "Blueprint",
    patch: {
      fontFamily: font("Archivo Black"), fontWeight: 900, fontSize: 40, textCase: "upper", letterSpacing: 2,
      color: "#3B82F6",
      strokeOn: true, strokeColor: "#1E3A8A", strokeWidth: 1,
      shadowOn: false, glowOn: false, bgOn: false, posY: 22,
      transition: "fade", transitionSpeed: 320,
    },
  },
  {
    name: "Core",
    patch: {
      fontFamily: font("Inter"), fontWeight: 700, fontSize: 28, textCase: "normal",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#0F172A", bgOpacity: 85, bgRadius: 12, bgPadX: 14, bgPadY: 8,
      shadowOn: false, strokeOn: false, glowOn: false, posY: 82,
      transition: "fade", transitionSpeed: 260,
      activeWordOn: true, activeWordColor: "#F5F5F4", activeWordScale: 1,
    },
  },
  {
    name: "Analog",
    patch: {
      fontFamily: font("Special Elite"), fontWeight: 400, fontSize: 26, textCase: "normal", letterSpacing: 1,
      color: "#FFFFFF",
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 2, shadowBlur: 6,
      strokeOn: false, bgOn: false, glowOn: false, posY: 78,
      transition: "typewriter", transitionSpeed: 300,
    },
  },
  {
    name: "Zine",
    patch: {
      fontFamily: font("Caveat"), fontWeight: 700, fontSize: 40, textCase: "normal",
      color: "#0F172A",
      shadowOn: false, strokeOn: false, bgOn: false, glowOn: false, posY: 82,
      transition: "wave", transitionSpeed: 340,
      activeWordOn: true, activeWordColor: "#DB2777", activeWordScale: 1.06,
    },
  },
  {
    name: "Archive",
    patch: {
      fontFamily: font("Bebas Neue"), fontWeight: 700, fontSize: 44, textCase: "upper", letterSpacing: 3,
      color: "#F5F5F4",
      strokeOn: true, strokeColor: "#0A0A0A", strokeWidth: 1,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 3, shadowBlur: 10,
      bgOn: false, glowOn: false, posY: 78,
      transition: "slide-up", transitionSpeed: 320,
    },
  },
  {
    name: "NEET Protest - Bold Alert",
    category: "Protest",
    patch: {
      fontFamily: "var(--font-anton)",
      fontWeight: 400,
      fontStyle: "normal",
      textTransform: "uppercase",
      fontSize: 110,
      fill: "#FFFFFF",
      strokeColor: "#E60000",
      strokeWidth: 10,
      shadowColor: "#000000",
      shadowBlur: 20,
      activeColor: "#FFC107",
      activeScale: 1.1,
      yPos: 80,
      glowIntensity: 0.5,
    },
  },
  {
    name: "NEET Protest - Stark Truth",
    category: "Protest",
    patch: {
      fontFamily: "var(--font-inter)",
      fontWeight: 900,
      fontStyle: "italic",
      textTransform: "uppercase",
      fontSize: 90,
      fill: "#E60000",
      strokeColor: "#000000",
      strokeWidth: 12,
      shadowColor: "#FFFFFF",
      shadowBlur: 5,
      activeColor: "#FFFFFF",
      activeScale: 1.1,
      yPos: 75,
      glowIntensity: 0.8,
    },
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// External template ingestion — core pack + famous-creator pack.
// Compact author-facing schema → CapStyle patches via toCapPatch().
// ─────────────────────────────────────────────────────────────────────────────

type ExtSpec = {
  name: string;
  fontFamily?: string;
  fontWeight?: number | string;
  textTransform?: string;
  textColor?: string;
  highlightColor?: string;
  stroke?: string;
  shadow?: string;
  background?: string;
  animationIn?: string;
  placement?: string;
};

const parseStroke = (s?: string) => {
  if (!s || s === "none") return { strokeOn: false as const };
  const m = /(\d+)\s*px\s+solid\s+(#?[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/.exec(s);
  if (!m) return { strokeOn: false as const };
  return { strokeOn: true as const, strokeWidth: Number(m[1]), strokeColor: m[2] };
};

const parseShadow = (s?: string) => {
  if (!s || s === "none") return { shadowOn: false as const };
  const m = /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+(#?[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/.exec(s);
  if (!m) return { shadowOn: true as const, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 3, shadowBlur: 8 };
  return {
    shadowOn: true as const,
    shadowX: Number(m[1]), shadowY: Number(m[2]), shadowBlur: Number(m[3]),
    shadowColor: m[4], shadowOpacity: 80,
  };
};

const parseBg = (bg?: string) => {
  if (!bg || bg === "transparent" || bg === "none") return { bgOn: false as const };
  return { bgOn: true as const, bgColor: bg, bgOpacity: 90, bgRadius: 6, bgPadX: 10, bgPadY: 4 };
};

const mapCase = (t?: string): TextCase => {
  switch ((t || "").toLowerCase()) {
    case "uppercase": return "upper";
    case "lowercase": return "lower";
    case "capitalize":
    case "title": return "title";
    default: return "normal";
  }
};

const mapPos = (p?: string): number => {
  switch ((p || "").toLowerCase()) {
    case "top-third":
    case "top-left": return 22;
    case "middle-third": return 40;
    case "center": return 50;
    case "bottom-third": return 78;
    case "bottom-edge": return 90;
    default: return 78;
  }
};

const mapAnim = (a?: string): { transition: CapTransition; transitionSpeed: number } => {
  const raw = (a || "").toLowerCase();
  if (raw.startsWith("bounce")) return { transition: "bounce", transitionSpeed: 220 };
  if (raw.startsWith("punch") || raw.startsWith("zoom") || raw.startsWith("pop") || raw.startsWith("spring") || raw.startsWith("shake")) return { transition: "pop", transitionSpeed: 200 };
  if (raw.startsWith("slide-up") || raw.startsWith("fade-up")) return { transition: "slide-up", transitionSpeed: 260 };
  if (raw.startsWith("slide-down")) return { transition: "slide-down", transitionSpeed: 260 };
  if (raw.startsWith("slide-left") || raw.startsWith("color-sweep")) return { transition: "wave", transitionSpeed: 300 };
  if (raw.startsWith("typewriter")) return { transition: "typewriter", transitionSpeed: 260 };
  if (raw.startsWith("blur") || raw.startsWith("slow-fade") || raw.startsWith("fade")) return { transition: "fade", transitionSpeed: 320 };
  if (raw.startsWith("gentle") || raw.startsWith("wave")) return { transition: "wave", transitionSpeed: 300 };
  if (raw.startsWith("hard-cut")) return { transition: "none", transitionSpeed: 0 };
  if (raw.startsWith("glitch")) return { transition: "pop", transitionSpeed: 140 };
  return { transition: "fade", transitionSpeed: 240 };
};

// Known fields on ExtSpec — anything else authored in the compact schema is
// considered unmapped and surfaced via a warning to the UI.
const EXT_SPEC_KNOWN_KEYS = new Set<string>([
  "name", "fontFamily", "fontWeight", "textTransform", "textColor",
  "highlightColor", "stroke", "shadow", "background", "animationIn", "placement",
]);

// Known enum-ish string values per field. Values that don't match still get
// mapped to a sensible default (see mapCase/mapPos/mapAnim above), but we warn
// so authors can tighten up the source pack.
const KNOWN_TEXT_TRANSFORM = new Set(["", "none", "uppercase", "lowercase", "capitalize", "title"]);
const KNOWN_PLACEMENT = new Set([
  "", "top-left", "top-third", "middle-third", "center", "bottom-third", "bottom-edge",
]);
const KNOWN_ANIM_PREFIXES = [
  "bounce", "punch", "zoom", "pop", "spring", "shake", "slide-up", "slide-down",
  "slide-left", "color-sweep", "typewriter", "blur", "slow-fade", "fade-up", "fade-in",
  "fade", "gentle", "wave", "hard-cut", "glitch",
];

export type TemplateWarning = {
  templateName: string;
  field: string;
  value: string;
  reason: string;
};

// Warnings collected during library init. Consumers (e.g. a top-level effect)
// can drain this list and show toasts without pulling `sonner` into a
// framework-agnostic style library.
export const TEMPLATE_WARNINGS: TemplateWarning[] = [];

const warn = (w: TemplateWarning) => {
  TEMPLATE_WARNINGS.push(w);
  // Fire an event so UI shells can react in real time (e.g. hot module reloads
  // that re-import this file). Guarded for non-browser environments.
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try { window.dispatchEvent(new CustomEvent("captions:template-warning", { detail: w })); } catch { /* noop */ }
  }
  if (typeof console !== "undefined") console.warn(`[templates] ${w.templateName}: ${w.field}="${w.value}" — ${w.reason}`);
};

const validateExtSpec = (s: ExtSpec) => {
  // Unknown keys
  for (const key of Object.keys(s)) {
    if (!EXT_SPEC_KNOWN_KEYS.has(key)) {
      warn({ templateName: s.name, field: key, value: String((s as any)[key]), reason: "unmapped field — ignored" });
    }
  }
  // Font: warn if the requested family isn't in FONT_OPTIONS (falls back to Inter).
  if (s.fontFamily) {
    const known = FONT_OPTIONS.some((f) => f.label === s.fontFamily);
    if (!known) warn({ templateName: s.name, field: "fontFamily", value: s.fontFamily, reason: "font not registered — falling back to Inter" });
  }
  // textTransform
  if (s.textTransform && !KNOWN_TEXT_TRANSFORM.has(s.textTransform.toLowerCase())) {
    warn({ templateName: s.name, field: "textTransform", value: s.textTransform, reason: "unknown value — defaulting to normal" });
  }
  // placement
  if (s.placement && !KNOWN_PLACEMENT.has(s.placement.toLowerCase())) {
    warn({ templateName: s.name, field: "placement", value: s.placement, reason: "unknown placement — defaulting to bottom-third" });
  }
  // animationIn: warn if none of the known prefixes match (still falls back to fade).
  if (s.animationIn) {
    const raw = s.animationIn.toLowerCase();
    const matched = KNOWN_ANIM_PREFIXES.some((p) => raw.startsWith(p));
    if (!matched) warn({ templateName: s.name, field: "animationIn", value: s.animationIn, reason: "unknown animation — falling back to fade" });
  }
  // Stroke / shadow: warn if a non-empty value fails to parse.
  if (s.stroke && s.stroke !== "none") {
    const parsed = parseStroke(s.stroke);
    if (!parsed.strokeOn) warn({ templateName: s.name, field: "stroke", value: s.stroke, reason: "could not parse — expected \"<n>px solid <color>\"" });
  }
  if (s.shadow && s.shadow !== "none") {
    const m = /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+(#?[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/.test(s.shadow);
    if (!m) warn({ templateName: s.name, field: "shadow", value: s.shadow, reason: "could not parse — using default drop shadow" });
  }
  // Color sanity (hex only; rgba/named colors are passed through).
  for (const k of ["textColor", "highlightColor"] as const) {
    const v = s[k];
    if (typeof v === "string" && v.startsWith("#") && !/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
      warn({ templateName: s.name, field: k, value: v, reason: "invalid hex color" });
    }
  }
  // fontWeight
  if (s.fontWeight !== undefined) {
    const n = Number(s.fontWeight);
    if (!Number.isFinite(n) || n < 100 || n > 900) {
      warn({ templateName: s.name, field: "fontWeight", value: String(s.fontWeight), reason: "expected number 100–900 — defaulting to 700" });
    }
  }
};

const toCapPatch = (s: ExtSpec): { name: string; patch: Partial<CapStyle> } => {
  try {
    validateExtSpec(s);
    const anim = mapAnim(s.animationIn);
    const stroke = parseStroke(s.stroke);
    const shadow = parseShadow(s.shadow);
    const bg = parseBg(s.background);
    const patch: Partial<CapStyle> = {
      fontFamily: font(s.fontFamily || "Inter"),
      fontWeight: Number(s.fontWeight) || 700,
      fontSize: 44,
      textCase: mapCase(s.textTransform),
      color: s.textColor || "#FFFFFF",
      posY: mapPos(s.placement),
      wordsPerChunk: 3,
      ...anim, ...stroke, ...shadow, ...bg,
      glowOn: false,
      activeWordOn: true,
      activeWordColor: s.highlightColor || "#FACC15",
      activeWordBgOn: false,
      activeWordScale: 1.08,
    };
    return { name: s.name, patch };
  } catch (err: any) {
    // A conversion failure must never break the preset list — return a safe
    // no-op patch and surface a warning so the picker still renders everything.
    warn({
      templateName: s?.name ?? "(unnamed)",
      field: "*",
      value: "",
      reason: `conversion failed: ${err?.message ?? String(err)}`,
    });
    return { name: s?.name ?? "Unnamed template", patch: {} };
  }
};

const CORE_TEMPLATE_PACK: ExtSpec[] = [
  { name: "High-Retention Pop (Yellow)", fontFamily: "Montserrat", fontWeight: 900, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#FFFF00", shadow: "0px 4px 15px rgba(0,0,0,0.8)", animationIn: "bounce-scale", placement: "center" },
  { name: "High-Retention Pop (Green)", fontFamily: "Montserrat", fontWeight: 900, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#00FF00", shadow: "0px 4px 15px rgba(0,0,0,0.8)", animationIn: "bounce-scale", placement: "center" },
  { name: "High-Energy Action (Cyan)", fontFamily: "Anton", fontWeight: 800, textTransform: "capitalize", textColor: "#FFFFFF", highlightColor: "#00FFFF", stroke: "4px solid #000000", animationIn: "punch-zoom", placement: "center" },
  { name: "High-Energy Action (Yellow)", fontFamily: "Anton", fontWeight: 800, textTransform: "capitalize", textColor: "#FFFFFF", highlightColor: "#FFD700", stroke: "5px solid #000000", animationIn: "punch-zoom", placement: "center" },
  { name: "Minimalist Educator", fontFamily: "Inter", fontWeight: 500, textTransform: "none", textColor: "#F3F4F6", highlightColor: "#FDFD96", shadow: "0px 2px 4px rgba(0,0,0,0.3)", animationIn: "fade-up", placement: "bottom-third" },
  { name: "Cinematic Documentary", fontFamily: "Playfair Display", fontWeight: 400, textColor: "#FFFFFF", highlightColor: "#E5E7EB", shadow: "0px 0px 20px rgba(255,255,255,0.4)", animationIn: "slow-fade", placement: "center" },
  { name: "Casual Vlog", fontFamily: "Nunito", fontWeight: 600, textTransform: "lowercase", textColor: "#FFFFFF", highlightColor: "#A7F3D0", shadow: "0px 2px 8px rgba(0,0,0,0.4)", animationIn: "gentle-wiggle", placement: "bottom-third" },
  { name: "Neon Streamer (Purple)", fontFamily: "Barlow Condensed", fontWeight: 800, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#A855F7", shadow: "0px 0px 15px #A855F7", animationIn: "shake-pop", placement: "center" },
  { name: "Neon Streamer (Green)", fontFamily: "Barlow Condensed", fontWeight: 800, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#22C55E", shadow: "0px 0px 15px #22C55E", animationIn: "shake-pop", placement: "center" },
  { name: "Breaking News Ticker", fontFamily: "Roboto", fontWeight: 700, textTransform: "uppercase", textColor: "#000000", highlightColor: "#DC2626", background: "#FFFFFF", animationIn: "slide-left", placement: "bottom-edge" },
  { name: "Gen-Z Rapid Fire", fontFamily: "Poppins", fontWeight: 800, textColor: "#FFFFFF", highlightColor: "#FF0050", stroke: "2px solid #000000", shadow: "2px 2px 0px #00FFFF", animationIn: "pop-in", placement: "middle-third" },
  { name: "Pastel Aesthetic", fontFamily: "Poppins", fontWeight: 500, textTransform: "lowercase", textColor: "#4B5563", highlightColor: "#FBCFE8", background: "#FDF2F8", animationIn: "fade-in", placement: "center" },
  { name: "8-Bit Arcade", fontFamily: "Press Start 2P", fontWeight: 400, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#FACC15", stroke: "4px solid #000000", shadow: "4px 4px 0px #000000", animationIn: "typewriter", placement: "bottom-third" },
  { name: "Cyber Terminal", fontFamily: "Space Mono", fontWeight: 600, textTransform: "lowercase", textColor: "#22C55E", highlightColor: "#FFFFFF", shadow: "0px 0px 8px #22C55E", background: "rgba(0,0,0,0.8)", animationIn: "typewriter-cursor", placement: "top-left" },
  { name: "Karaoke Sing-Along", fontFamily: "Archivo Black", fontWeight: 900, textTransform: "capitalize", textColor: "#FFFFFF", highlightColor: "#3B82F6", stroke: "3px solid #1E3A8A", animationIn: "color-sweep-left-to-right", placement: "bottom-third" },
  { name: "B2B Professional", fontFamily: "Roboto", fontWeight: 400, textColor: "#1F2937", highlightColor: "#2563EB", background: "rgba(255,255,255,0.95)", animationIn: "slide-up", placement: "bottom-edge" },
  { name: "High Contrast Educator", fontFamily: "Inter", fontWeight: 700, textColor: "#FFFF00", highlightColor: "#FFFFFF", background: "#DC2626", animationIn: "hard-cut", placement: "bottom-third" },
  { name: "Luxury Serif", fontFamily: "EB Garamond", fontWeight: 400, textTransform: "capitalize", textColor: "#F3F4F6", highlightColor: "#D4AF37", shadow: "0px 2px 10px rgba(0,0,0,0.9)", animationIn: "slow-fade", placement: "center" },
  { name: "Comic Book Action", fontFamily: "Bangers", fontWeight: 400, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#EF4444", stroke: "2px solid #000000", shadow: "3px 3px 0px #000000", animationIn: "bounce", placement: "top-third" },
  { name: "Cyberpunk Glitch", fontFamily: "Bebas Neue", fontWeight: 700, textTransform: "uppercase", textColor: "#E5E7EB", highlightColor: "#EC4899", shadow: "2px 0px 0px #00FFFF", animationIn: "glitch-reveal", placement: "center" },
  { name: "Bubblegum Pop", fontFamily: "Fredoka", fontWeight: 400, textTransform: "lowercase", textColor: "#FFFFFF", highlightColor: "#F472B6", stroke: "3px solid #831843", animationIn: "spring-up", placement: "center" },
  { name: "Dark Mode Minimal", fontFamily: "Inter", fontWeight: 300, textColor: "#9CA3AF", highlightColor: "#FFFFFF", animationIn: "fade", placement: "bottom-third" },
  { name: "Mechanical Typewriter", fontFamily: "Special Elite", fontWeight: 400, textColor: "#FFFFFF", highlightColor: "#D1D5DB", shadow: "0px 1px 3px rgba(0,0,0,0.8)", animationIn: "typewriter", placement: "center" },
  { name: "Maximum Impact", fontFamily: "Anton", fontWeight: 400, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#F97316", shadow: "0px 6px 0px rgba(0,0,0,0.9)", animationIn: "zoom-in-hard", placement: "center" },
  { name: "Soft Focus Story", fontFamily: "Lora", fontWeight: 500, textColor: "#FFFFFF", highlightColor: "#FDE047", shadow: "0px 0px 30px rgba(255,255,255,0.5)", animationIn: "blur-in", placement: "center" },
];

const CREATOR_TEMPLATE_PACK: ExtSpec[] = [
  { name: "MrBeast Style", fontFamily: "Anton", fontWeight: 800, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#00FFFF", stroke: "4px solid #000000", animationIn: "punch-zoom", placement: "center" },
  { name: "Airrack Style", fontFamily: "Bebas Neue", fontWeight: 900, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#FACC15", stroke: "5px solid #000000", animationIn: "bounce-scale", placement: "center" },
  { name: "Ryan Trahan Style", fontFamily: "Nunito", fontWeight: 700, textTransform: "lowercase", textColor: "#FFFFFF", highlightColor: "#A7F3D0", shadow: "0px 2px 8px rgba(0,0,0,0.5)", animationIn: "gentle-wiggle", placement: "bottom-third" },
  { name: "Zach King Style", fontFamily: "Poppins", fontWeight: 800, textColor: "#FFFFFF", highlightColor: "#FF0050", stroke: "2px solid #000000", animationIn: "pop-in", placement: "middle-third" },
  { name: "Dude Perfect Style", fontFamily: "Anton", fontWeight: 400, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#E11D48", stroke: "3px solid #000000", shadow: "3px 3px 0px #000000", animationIn: "zoom-in-hard", placement: "top-third" },
  { name: "Mark Rober Style", fontFamily: "Archivo Black", fontWeight: 900, textColor: "#FFFF00", highlightColor: "#FFFFFF", stroke: "3px solid #000000", animationIn: "hard-cut", placement: "bottom-third" },
  { name: "Ludwig Style", fontFamily: "Barlow Condensed", fontWeight: 800, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#A855F7", stroke: "3px solid #000000", animationIn: "shake-pop", placement: "center" },
  { name: "Alex Hormozi Style", fontFamily: "Montserrat", fontWeight: 900, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#FFFF00", shadow: "0px 4px 10px rgba(0,0,0,0.9)", animationIn: "bounce-scale", placement: "center" },
  { name: "Leila Hormozi Style", fontFamily: "Montserrat", fontWeight: 900, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#00FF00", shadow: "0px 4px 10px rgba(0,0,0,0.9)", animationIn: "bounce-scale", placement: "center" },
  { name: "Iman Gadzhi Style", fontFamily: "Playfair Display", fontWeight: 400, textColor: "#FFFFFF", highlightColor: "#D4AF37", shadow: "0px 2px 15px rgba(0,0,0,0.6)", animationIn: "slow-fade", placement: "center" },
  { name: "GaryVee Style", fontFamily: "Bebas Neue", fontWeight: 400, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#EA580C", shadow: "2px 2px 0px #000000", animationIn: "pop-in", placement: "bottom-third" },
  { name: "Grant Cardone Style", fontFamily: "Roboto", fontWeight: 700, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#2563EB", animationIn: "slide-up", placement: "bottom-third" },
  { name: "Dan Koe Style", fontFamily: "Inter", fontWeight: 300, textColor: "#9CA3AF", highlightColor: "#FFFFFF", animationIn: "fade", placement: "center" },
  { name: "Codie Sanchez Style", fontFamily: "Montserrat", fontWeight: 800, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#FB923C", shadow: "0px 4px 8px rgba(0,0,0,0.8)", animationIn: "bounce-scale", placement: "center" },
  { name: "Johnny Harris Style", fontFamily: "EB Garamond", fontWeight: 400, textColor: "#F3F4F6", highlightColor: "#F59E0B", shadow: "0px 1px 4px rgba(0,0,0,0.8)", animationIn: "typewriter", placement: "center" },
  { name: "MagnatesMedia Style", fontFamily: "Playfair Display", fontWeight: 600, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#D4AF37", shadow: "0px 0px 12px rgba(212,175,55,0.6)", animationIn: "blur-in", placement: "center" },
  { name: "SunnyV2 Style", fontFamily: "Inter", fontWeight: 600, textColor: "#FFFFFF", highlightColor: "#EF4444", shadow: "0px 2px 8px rgba(0,0,0,0.9)", animationIn: "fade-up", placement: "bottom-third" },
  { name: "Ali Abdaal Style", fontFamily: "Inter", fontWeight: 500, textColor: "#F3F4F6", highlightColor: "#FDFD96", animationIn: "fade-up", placement: "bottom-third" },
  { name: "Alix Earle Style", fontFamily: "Poppins", fontWeight: 500, textTransform: "lowercase", textColor: "#FFFFFF", highlightColor: "#F472B6", shadow: "0px 2px 5px rgba(0,0,0,0.3)", animationIn: "fade-in", placement: "bottom-third" },
  { name: "Emma Chamberlain Style", fontFamily: "Space Mono", fontWeight: 600, textTransform: "lowercase", textColor: "#FFFFFF", highlightColor: "#FBCFE8", animationIn: "gentle-wiggle", placement: "center" },
  { name: "Kai Cenat Style", fontFamily: "Anton", fontWeight: 400, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#10B981", stroke: "2px solid #000000", shadow: "4px 4px 0px #000000", animationIn: "zoom-in-hard", placement: "center" },
  { name: "IShowSpeed Style", fontFamily: "Anton", fontWeight: 400, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#DC2626", stroke: "4px solid #000000", animationIn: "shake-pop", placement: "center" },
  { name: "Dhruv Rathee Style", fontFamily: "Inter", fontWeight: 700, textColor: "#FFFFFF", highlightColor: "#FFFF00", background: "#000000", animationIn: "hard-cut", placement: "bottom-third" },
  { name: "CarryMinati Style", fontFamily: "Roboto", fontWeight: 900, textTransform: "uppercase", textColor: "#FFFFFF", highlightColor: "#E11D48", stroke: "3px solid #000000", animationIn: "punch-zoom", placement: "center" },
  { name: "Technical Guruji Style", fontFamily: "Poppins", fontWeight: 700, textColor: "#FFFF00", highlightColor: "#FFFFFF", background: "#DC2626", animationIn: "slide-up", placement: "bottom-third" },
  { name: "Physics Wallah Style", fontFamily: "Roboto", fontWeight: 700, textColor: "#FFFFFF", highlightColor: "#FACC15", background: "#1E3A8A", animationIn: "fade-in", placement: "bottom-third" },
  { name: "Bhuvan Bam Style", fontFamily: "Nunito", fontWeight: 600, textColor: "#FFFFFF", highlightColor: "#38BDF8", stroke: "2px solid #000000", animationIn: "gentle-wiggle", placement: "center" },
];

// Merge external packs into the exported preset list so they appear in the
// Templates picker alongside the built-ins.
CAP_PRESETS.push(...CORE_TEMPLATE_PACK.map((s) => ({ ...toCapPatch(s), category: "Core Pack" as const })));
CAP_PRESETS.push(...CREATOR_TEMPLATE_PACK.map((s) => ({ ...toCapPatch(s), category: "Creators" as const })));

// ---------------------------------------------------------------------------
// YT Creators pack — 10 spec-precise built-ins requested for the editor Style tab.
// Each entry uses the shared CapStyle schema so the overlay and the FFmpeg WASM
// export render identically. Only "Kai Cenat" is an approximation: true per-word
// rainbow cycling isn't in the schema; we cycle the active word color instead.
// ---------------------------------------------------------------------------
const YT_CREATORS_PACK: { name: string; patch: Partial<CapStyle> }[] = [
  {
    name: "YT · MrBeast",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 52, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 6,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 3, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 82, wordsPerChunk: 3,
      transition: "pop", transitionSpeed: 80,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#FACC15",
      activeWordColor: "#111111", activeWordScale: 1.08,
    },
  },
  {
    name: "YT · Iman Gadzhi",
    patch: {
      fontFamily: font("Montserrat"), fontWeight: 800, fontSize: 46, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 12,
      posY: 50, wordsPerChunk: 2,
      transition: "fade", transitionSpeed: 180,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FACC15", activeWordScale: 1.10,
    },
  },
  {
    name: "YT · Alex Hormozi",
    patch: {
      fontFamily: font("Oswald"), fontWeight: 800, fontSize: 48, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 5,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 50, wordsPerChunk: 3,
      transition: "pop", transitionSpeed: 90,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#DC2626",
      activeWordColor: "#FFFFFF", activeWordScale: 1.06,
    },
  },
  {
    name: "YT · Kai Cenat",
    patch: {
      fontFamily: font("Fredoka"), fontWeight: 700, fontSize: 46, textCase: "upper",
      color: "#FDE047",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 3,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 78, wordsPerChunk: 3,
      transition: "bounce", transitionSpeed: 260,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#22D3EE", activeWordScale: 1.14,
    },
  },
  {
    name: "YT · Andrew Tate",
    patch: {
      fontFamily: font("Bebas Neue"), fontWeight: 700, fontSize: 44, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 70, shadowX: 0, shadowY: 2, shadowBlur: 6,
      glowOn: false, posY: 82, wordsPerChunk: 5,
      transition: "slide-up", transitionSpeed: 220,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#F5D020", activeWordScale: 1.04,
      letterSpacing: 0.5,
    },
  },
  {
    name: "YT · Subtitles (Clean)",
    patch: {
      fontFamily: font("Inter"), fontWeight: 600, fontSize: 32, textCase: "normal",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#000000", bgOpacity: 55, bgRadius: 6, bgPadX: 14, bgPadY: 8,
      strokeOn: false, glowOn: false, shadowOn: false,
      posY: 88, wordsPerChunk: 0,
      transition: "fade", transitionSpeed: 260,
      activeWordOn: false,
    },
  },
  {
    name: "YT · TikTok Viral",
    patch: {
      fontFamily: font("Montserrat"), fontWeight: 900, fontSize: 50, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 5,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 50, wordsPerChunk: 2,
      transition: "pop", transitionSpeed: 120,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FDE047", activeWordScale: 1.20,
    },
  },
  {
    name: "YT · Aesthetic Soft",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 500, fontSize: 38, textCase: "normal",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 35, shadowX: 0, shadowY: 2, shadowBlur: 10,
      posY: 82, wordsPerChunk: 5,
      transition: "fade", transitionSpeed: 380,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FCE7F3", activeWordScale: 1.02,
      letterSpacing: 0.5,
    },
  },
  {
    name: "YT · Neon Glow",
    patch: {
      fontFamily: font("Rajdhani"), fontWeight: 700, fontSize: 46, textCase: "upper",
      color: "#22D3EE",
      strokeOn: false,
      glowOn: true, glowColor: "#22D3EE", glowBlur: 28, glowIntensity: 90,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 80, shadowX: 0, shadowY: 2, shadowBlur: 4,
      bgOn: true, bgColor: "#000000", bgOpacity: 45, bgRadius: 8, bgPadX: 14, bgPadY: 8,
      posY: 78, wordsPerChunk: 3,
      transition: "fade", transitionSpeed: 180,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#A3E635", activeWordScale: 1.06,
    },
  },
  {
    name: "YT · Minimal Elegant",
    patch: {
      fontFamily: font("DM Sans"), fontWeight: 500, fontSize: 34, textCase: "normal",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false, shadowOn: false,
      posY: 88, wordsPerChunk: 5,
      transition: "fade", transitionSpeed: 260,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FFFFFF", activeWordScale: 1.00,
      underline: false, letterSpacing: 0.3,
    },
  },
];
CAP_PRESETS.push(...YT_CREATORS_PACK.map((s) => ({ ...s, category: "YT Creators" as const })));

// ---------------------------------------------------------------------------
// Ultimate Creator pack — imported from user CSV. Uses the shared CapStyle
// schema so overlay + FFmpeg export render identically.
// ---------------------------------------------------------------------------
const ULTIMATE_CREATOR_PACK: { name: string; patch: Partial<CapStyle> }[] = [
  {
    name: "The Hormozi",
    patch: {
      fontFamily: font("Montserrat"), fontWeight: 900, fontSize: 48, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 3,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 50, wordsPerChunk: 3,
      transition: "pop", transitionSpeed: 120,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#FFD700",
      activeWordColor: "#111111", activeWordScale: 1.08,
    },
  },
  {
    name: "The Grant Cardone",
    patch: {
      fontFamily: font("Anton"), fontWeight: 900, fontSize: 50, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 4,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 4, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 50, wordsPerChunk: 2,
      transition: "zoom", transitionSpeed: 140,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#FF0000",
      activeWordColor: "#FFFFFF", activeWordScale: 1.18,
    },
  },
  {
    name: "The Abdaal",
    patch: {
      fontFamily: font("Inter"), fontWeight: 600, fontSize: 36, textCase: "normal",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 40, shadowX: 0, shadowY: 2, shadowBlur: 8,
      posY: 82, wordsPerChunk: 5,
      transition: "fade", transitionSpeed: 320,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#A7F3D0", activeWordScale: 1.03,
    },
  },
  {
    name: "The Huberman",
    patch: {
      fontFamily: font("Inter"), fontWeight: 500, fontSize: 34, textCase: "normal",
      color: "#F3F4F6",
      strokeOn: false, glowOn: false, bgOn: false, shadowOn: false,
      posY: 82, wordsPerChunk: 4,
      transition: "fade", transitionSpeed: 260,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#93C5FD", activeWordScale: 1.04,
    },
  },
  {
    name: "The Gadzhi",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 400, fontSize: 40, textCase: "normal",
      color: "#E5E7EB",
      strokeOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 50, shadowX: 0, shadowY: 3, shadowBlur: 16,
      glowOn: true, glowColor: "#FFFFFF", glowBlur: 20, glowIntensity: 30,
      posY: 50, wordsPerChunk: 4,
      transition: "fade", transitionSpeed: 420,
      activeWordOn: false, letterSpacing: 0.5,
    },
  },
  {
    name: "The Magnate",
    patch: {
      fontFamily: font("Playfair Display"), fontWeight: 500, fontSize: 38, textCase: "normal",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 60, shadowX: 0, shadowY: 2, shadowBlur: 8,
      posY: 78, wordsPerChunk: 4,
      transition: "typewriter", transitionSpeed: 90,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#D1D5DB", activeWordScale: 1.02,
    },
  },
  {
    name: "The Beast",
    patch: {
      fontFamily: font("Luckiest Guy"), fontWeight: 700, fontSize: 52, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 5,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 100, shadowX: 0, shadowY: 4, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 78, wordsPerChunk: 3,
      transition: "bounce", transitionSpeed: 260,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#00FF00",
      activeWordColor: "#111111", activeWordScale: 1.14,
    },
  },
  {
    name: "The Gaming Pro",
    patch: {
      fontFamily: font("Bangers"), fontWeight: 700, fontSize: 48, textCase: "upper",
      color: "#FFFFFF",
      strokeOn: true, strokeColor: "#000000", strokeWidth: 4,
      shadowOn: true, shadowColor: "#000000", shadowOpacity: 90, shadowX: 0, shadowY: 3, shadowBlur: 0,
      glowOn: false, bgOn: false, posY: 78, wordsPerChunk: 3,
      transition: "bounce", transitionSpeed: 280,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FF00FF", activeWordScale: 1.16,
    },
  },
  {
    name: "The Emma",
    patch: {
      fontFamily: font("JetBrains Mono"), fontWeight: 400, fontSize: 30, textCase: "lower",
      color: "#FFFFFF",
      strokeOn: false, glowOn: false, bgOn: false, shadowOn: false,
      posY: 82, wordsPerChunk: 5,
      transition: "slide-up", transitionSpeed: 260,
      activeWordOn: false,
    },
  },
  {
    name: "The Minimalist Vlog",
    patch: {
      fontFamily: font("Manrope"), fontWeight: 300, fontSize: 32, textCase: "lower",
      color: "#FAFAFA",
      strokeOn: false, glowOn: false, bgOn: false, shadowOn: false,
      posY: 84, wordsPerChunk: 5,
      transition: "fade", transitionSpeed: 300,
      activeWordOn: true, activeWordBgOn: false, activeWordColor: "#FCA5A5", activeWordScale: 1.02,
    },
  },
  {
    name: "The Vice",
    patch: {
      fontFamily: font("Inter"), fontWeight: 700, fontSize: 38, textCase: "upper",
      color: "#FFFFFF",
      bgOn: true, bgColor: "#000000", bgOpacity: 100, bgRadius: 0, bgPadX: 14, bgPadY: 8,
      strokeOn: false, glowOn: false, shadowOn: false,
      posY: 84, wordsPerChunk: 4,
      transition: "none", transitionSpeed: 0,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#FFFF00",
      activeWordColor: "#000000", activeWordScale: 1.02,
    },
  },
  {
    name: "The Vox",
    patch: {
      fontFamily: font("Work Sans"), fontWeight: 600, fontSize: 36, textCase: "normal",
      color: "#FFEA00",
      strokeOn: false, glowOn: false, shadowOn: false, bgOn: false,
      posY: 82, wordsPerChunk: 4,
      transition: "fade", transitionSpeed: 200,
      activeWordOn: true, activeWordBgOn: true, activeWordBgColor: "#FFFFFF",
      activeWordColor: "#111111", activeWordScale: 1.04,
    },
  },
];
CAP_PRESETS.push(...ULTIMATE_CREATOR_PACK.map((s) => ({ ...s, category: "Ultimate" as const })));


// Category derivation for the Templates picker. Explicit `category` wins; otherwise
// we infer from the preset name using well-known keywords.
export type PresetCategory =
  | "All"
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
  { label: "Karaoke",       test: /karaoke|sing|word[- ]?highlight|color[- ]?sweep/i },
  { label: "Neon & Glow",   test: /neon|glow|cyber|glitch|streamer/i },
  { label: "Cinematic",     test: /cinemat|luxury|serif|documentary|magnates|johnny|iman/i },
  { label: "Retro & Fun",   test: /8[- ]?bit|arcade|comic|bubble|pastel|typewriter|mechanical|fredoka|bangers/i },
  { label: "News & Pro",    test: /news|b2b|professional|educator|breaking|ticker|physics|guruji|dhruv/i },
  { label: "Bold & Impact", test: /bold|impact|pop|punch|beast|hormozi|action|maximum|carry|ishow|kai|zoom/i },
  { label: "Minimal",       test: /minimal|clean|dark mode|dan koe|ali abdaal|soft|casual/i },
];

export const getPresetCategory = (p: { name: string; category?: string }): PresetCategory => {
  if (p.category === "Core Pack" || p.category === "Creators" || p.category === "YT Creators" || p.category === "Ultimate") return p.category as PresetCategory;
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(p.name)) return rule.label;
  }
  return "Built-in";
};

export const PRESET_CATEGORIES: PresetCategory[] = [
  "All",
  "Ultimate",
  "YT Creators",
  "Built-in",
  "Core Pack",
  "Creators",
  "Bold & Impact",
  "Minimal",
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
  "Yellow Highlight",
  "Popping Text",
  "Stroke Outline",
  "Hormozi Style",
  "AI Blue Box",
  "The Cinematic Story",
];
const FREE_SET = new Set(FREE_PRESET_NAMES.map((n) => n.toLowerCase()));
export const isPresetFree = (name: string): boolean => FREE_SET.has(name.toLowerCase());




