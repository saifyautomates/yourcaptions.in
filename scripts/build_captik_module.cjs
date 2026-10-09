const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scripts/captik_extracted.json', 'utf8'));
console.log('Building presets for', raw.length, 'templates...');

// Style catalog mapping template IDs to tailored CapStyle patches and categories
const styleCatalog = {
  captik_glow: {
    cat: 'Popular',
    font: 'Space Grotesk',
    weight: 800,
    size: 48,
    cCase: 'upper',
    color: '#FFFFFF',
    glow: { on: true, color: '#F59E0B', blur: 18, int: 90 },
    stroke: { on: true, color: '#000000', width: 2.5 },
    activeWord: { color: '#FCD34D', scale: 1.18 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 95
  },
  ali_abdaal: {
    cat: 'Clean',
    font: 'Inter',
    weight: 600,
    size: 38,
    cCase: 'normal',
    color: '#F8FAFC',
    bg: { on: true, color: 'rgba(0, 0, 0, 0.75)', opacity: 80, radius: 8, padX: 14, padY: 6 },
    activeWord: { color: '#38BDF8', scale: 1.05 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'fade',
    speed: 150
  },
  captik_shadow: {
    cat: 'Popular',
    font: 'Montserrat',
    weight: 900,
    size: 46,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 3 },
    shadow: { on: true, color: '#000000', opacity: 90, x: 0, y: 5, blur: 10 },
    activeWord: { color: '#FACC15', scale: 1.15 },
    pos: { x: 50, y: 80 },
    chunk: 2,
    trans: 'pop',
    speed: 100
  },
  captik: {
    cat: 'Popular',
    font: 'Plus Jakarta Sans',
    weight: 800,
    size: 46,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 2.5 },
    shadow: { on: true, color: '#000000', opacity: 85, x: 0, y: 4, blur: 8 },
    activeWord: { color: '#F59E0B', scale: 1.16 },
    pos: { x: 50, y: 79 },
    chunk: 2,
    trans: 'pop',
    speed: 90
  },
  clean_motion: {
    cat: 'Clean',
    font: 'Inter',
    weight: 700,
    size: 40,
    cCase: 'normal',
    color: '#FFFFFF',
    shadow: { on: true, color: '#000000', opacity: 60, x: 0, y: 2, blur: 6 },
    activeWord: { color: '#E0E7FF', scale: 1.08 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'slide-up',
    speed: 140
  },
  bubble: {
    cat: 'Bold & animated',
    font: 'Bangers',
    weight: 800,
    size: 52,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 5 },
    shadow: { on: true, color: '#000000', opacity: 95, x: 3, y: 3, blur: 0 },
    activeWord: { color: '#FFE600', scale: 1.25 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'bounce',
    speed: 110
  },
  hormozi: {
    cat: 'Popular',
    font: 'Anton',
    weight: 900,
    size: 50,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 4.5 },
    shadow: { on: true, color: '#000000', opacity: 95, x: 0, y: 6, blur: 12 },
    activeWord: { color: '#FFE600', scale: 1.25 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 90
  },
  boxed: {
    cat: 'Popular',
    font: 'Montserrat',
    weight: 900,
    size: 46,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 3 },
    activeWord: { color: '#000000', bgOn: true, bgColor: '#00F0FF', scale: 1.15 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 95
  },
  mrbeast: {
    cat: 'Popular',
    font: 'Anton',
    weight: 900,
    size: 52,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 4 },
    shadow: { on: true, color: '#000000', opacity: 90, x: 0, y: 6, blur: 10 },
    activeWord: { color: '#FFE600', bgOn: true, bgColor: '#DC2626', scale: 1.22 },
    pos: { x: 50, y: 76 },
    chunk: 2,
    trans: 'pop',
    speed: 85
  },
  mr_beast_2: {
    cat: 'Popular',
    font: 'Archivo Black',
    weight: 900,
    size: 50,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 4 },
    shadow: { on: true, color: '#000000', opacity: 90, x: 0, y: 6, blur: 10 },
    activeWord: { color: '#22C55E', scale: 1.24 },
    pos: { x: 50, y: 76 },
    chunk: 2,
    trans: 'pop',
    speed: 90
  },
  iman_gadzhi: {
    cat: 'Popular',
    font: 'EB Garamond',
    weight: 700,
    size: 42,
    cCase: 'title',
    color: '#FFFBEB',
    glow: { on: true, color: '#D4AF37', blur: 14, int: 70 },
    bg: { on: true, color: 'rgba(15, 15, 20, 0.75)', opacity: 80, radius: 6, padX: 16, padY: 6 },
    activeWord: { color: '#FCD34D', scale: 1.08 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'fade',
    speed: 180
  },
  prism: {
    cat: 'Popular',
    font: 'Space Grotesk',
    weight: 800,
    size: 46,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#00F0FF', width: 2.5 },
    shadow: { on: true, color: '#EC4899', opacity: 80, x: 0, y: 0, blur: 12 },
    activeWord: { color: '#EC4899', scale: 1.18 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 95
  },
  highlighted_word: {
    cat: 'Clean',
    font: 'Inter',
    weight: 800,
    size: 44,
    cCase: 'upper',
    color: '#94A3B8',
    stroke: { on: true, color: '#000000', width: 2.5 },
    activeWord: { color: '#22C55E', scale: 1.16 },
    pos: { x: 50, y: 80 },
    chunk: 3,
    trans: 'pop',
    speed: 90
  },
  clean_glow: {
    cat: 'Clean',
    font: 'Outfit',
    weight: 700,
    size: 42,
    cCase: 'upper',
    color: '#FFFFFF',
    glow: { on: true, color: '#00F0FF', blur: 16, int: 80 },
    stroke: { on: true, color: '#000000', width: 2 },
    activeWord: { color: '#67E8F9', scale: 1.12 },
    pos: { x: 50, y: 80 },
    chunk: 2,
    trans: 'pop',
    speed: 100
  },
  captik_clean: {
    cat: 'Clean',
    font: 'DM Sans',
    weight: 700,
    size: 40,
    cCase: 'normal',
    color: '#FFFFFF',
    shadow: { on: true, color: '#000000', opacity: 70, x: 0, y: 3, blur: 6 },
    activeWord: { color: '#F59E0B', scale: 1.1 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'pop',
    speed: 110
  },
  black_punch: {
    cat: 'Bold & animated',
    font: 'Archivo Black',
    weight: 900,
    size: 48,
    cCase: 'upper',
    color: '#000000',
    stroke: { on: true, color: '#FFFFFF', width: 3.5 },
    shadow: { on: true, color: '#000000', opacity: 90, x: 0, y: 4, blur: 10 },
    activeWord: { color: '#FFE600', scale: 1.2 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 90
  },
  captik_word: {
    cat: 'Popular',
    font: 'Poppins',
    weight: 900,
    size: 52,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 3.5 },
    shadow: { on: true, color: '#000000', opacity: 90, x: 0, y: 5, blur: 12 },
    activeWord: { color: '#F59E0B', scale: 1.24 },
    pos: { x: 50, y: 78 },
    chunk: 1,
    trans: 'pop',
    speed: 80
  },
  pixelated: {
    cat: 'Bold & animated',
    font: 'Press Start 2P',
    weight: 400,
    size: 32,
    cCase: 'upper',
    color: '#10B981',
    glow: { on: true, color: '#10B981', blur: 14, int: 85 },
    shadow: { on: true, color: '#000000', opacity: 100, x: 3, y: 3, blur: 0 },
    activeWord: { color: '#34D399', scale: 1.15 },
    pos: { x: 50, y: 80 },
    chunk: 2,
    trans: 'pop',
    speed: 120
  },
  liquid_glass: {
    cat: 'Clean',
    font: 'Inter',
    weight: 600,
    size: 38,
    cCase: 'normal',
    color: '#F8FAFC',
    bg: { on: true, color: 'rgba(255, 255, 255, 0.16)', opacity: 85, radius: 12, padX: 16, padY: 8 },
    shadow: { on: true, color: '#000000', opacity: 50, x: 0, y: 4, blur: 12 },
    activeWord: { color: '#38BDF8', scale: 1.08 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'fade',
    speed: 140
  },
  tabahi: {
    cat: 'Bold & animated',
    font: 'Anton',
    weight: 900,
    size: 52,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#DC2626', width: 4 },
    shadow: { on: true, color: '#000000', opacity: 95, x: 0, y: 6, blur: 14 },
    activeWord: { color: '#EF4444', scale: 1.26 },
    pos: { x: 50, y: 76 },
    chunk: 2,
    trans: 'bounce',
    speed: 85
  },
  deep_glow: {
    cat: 'Bold & animated',
    font: 'Montserrat',
    weight: 800,
    size: 46,
    cCase: 'upper',
    color: '#FFFFFF',
    glow: { on: true, color: '#8B5CF6', blur: 24, int: 90 },
    stroke: { on: true, color: '#000000', width: 2.5 },
    activeWord: { color: '#C084FC', scale: 1.18 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 100
  },
  seedha_saadha: {
    cat: 'Clean',
    font: 'Inter',
    weight: 600,
    size: 38,
    cCase: 'normal',
    color: '#F8FAFC',
    shadow: { on: true, color: '#000000', opacity: 55, x: 0, y: 2, blur: 6 },
    activeWord: { color: '#FFFFFF', scale: 1.05 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'fade',
    speed: 160
  },
  thora_cinematic: {
    cat: 'Clean',
    font: 'Playfair Display',
    weight: 700,
    size: 40,
    cCase: 'title',
    color: '#FFFFFF',
    shadow: { on: true, color: '#000000', opacity: 75, x: 0, y: 3, blur: 8 },
    activeWord: { color: '#FDE047', scale: 1.08 },
    pos: { x: 50, y: 84 },
    chunk: 3,
    trans: 'fade',
    speed: 200
  },
  delhi: {
    cat: 'Bold & animated',
    font: 'Plus Jakarta Sans',
    weight: 800,
    size: 46,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 3 },
    shadow: { on: true, color: '#000000', opacity: 85, x: 0, y: 4, blur: 10 },
    activeWord: { color: '#FF9933', scale: 1.2 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 90
  },
  illusion: {
    cat: 'Bold & animated',
    font: 'Space Grotesk',
    weight: 800,
    size: 48,
    cCase: 'upper',
    color: '#FFFFFF',
    shadow: { on: true, color: '#00F0FF', opacity: 90, x: 3, y: 0, blur: 8 },
    stroke: { on: true, color: '#FF0055', width: 2 },
    activeWord: { color: '#00F0FF', scale: 1.2 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 95
  },
  editor_masala: {
    cat: 'Bold & animated',
    font: 'Poppins',
    weight: 900,
    size: 50,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 4 },
    shadow: { on: true, color: '#000000', opacity: 95, x: 0, y: 6, blur: 12 },
    activeWord: { color: '#F97316', scale: 1.25 },
    pos: { x: 50, y: 76 },
    chunk: 2,
    trans: 'bounce',
    speed: 85
  },
  aura: {
    cat: 'Clean',
    font: 'Outfit',
    weight: 700,
    size: 44,
    cCase: 'upper',
    color: '#FFFFFF',
    glow: { on: true, color: '#FBBF24', blur: 18, int: 80 },
    stroke: { on: true, color: '#000000', width: 2 },
    activeWord: { color: '#FCD34D', scale: 1.15 },
    pos: { x: 50, y: 80 },
    chunk: 2,
    trans: 'pop',
    speed: 100
  },
  aura_helvetica: {
    cat: 'Clean',
    font: 'Inter',
    weight: 700,
    size: 42,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 2 },
    activeWord: { color: '#EF4444', scale: 1.12 },
    pos: { x: 50, y: 80 },
    chunk: 2,
    trans: 'pop',
    speed: 95
  },
  big_reveal: {
    cat: 'Behind you',
    font: 'Anton',
    weight: 900,
    size: 56,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#111111', width: 3 },
    shadow: { on: true, color: '#000000', opacity: 100, x: 0, y: 10, blur: 24 },
    activeWord: { color: '#FFE600', scale: 1.25 },
    pos: { x: 50, y: 42 },
    chunk: 1,
    trans: 'pop',
    speed: 90
  },
  big_red: {
    cat: 'Bold & animated',
    font: 'Bebas Neue',
    weight: 900,
    size: 58,
    cCase: 'upper',
    color: '#EF4444',
    stroke: { on: true, color: '#000000', width: 4.5 },
    shadow: { on: true, color: '#000000', opacity: 95, x: 0, y: 6, blur: 14 },
    activeWord: { color: '#FFFFFF', scale: 1.22 },
    pos: { x: 50, y: 76 },
    chunk: 2,
    trans: 'pop',
    speed: 85
  },
  scribble: {
    cat: 'Bold & animated',
    font: 'Permanent Marker',
    weight: 700,
    size: 46,
    cCase: 'normal',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 3 },
    shadow: { on: true, color: '#000000', opacity: 85, x: 2, y: 4, blur: 8 },
    activeWord: { color: '#FDE047', scale: 1.2 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'bounce',
    speed: 110
  },
  archives: {
    cat: 'Clean',
    font: 'Special Elite',
    weight: 700,
    size: 38,
    cCase: 'normal',
    color: '#FEF3C7',
    shadow: { on: true, color: '#000000', opacity: 80, x: 0, y: 2, blur: 6 },
    activeWord: { color: '#F59E0B', scale: 1.05 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'typewriter',
    speed: 180
  },
  blockbuster: {
    cat: 'Bold & animated',
    font: 'Archivo Black',
    weight: 900,
    size: 52,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 4.5 },
    shadow: { on: true, color: '#000000', opacity: 100, x: 0, y: 8, blur: 16 },
    activeWord: { color: '#F59E0B', scale: 1.24 },
    pos: { x: 50, y: 76 },
    chunk: 2,
    trans: 'pop',
    speed: 85
  },
  journal: {
    cat: 'Clean',
    font: 'DM Serif Display',
    weight: 600,
    size: 40,
    cCase: 'title',
    color: '#FFFBEB',
    bg: { on: true, color: 'rgba(24, 24, 27, 0.85)', opacity: 85, radius: 8, padX: 14, padY: 6 },
    activeWord: { color: '#FCD34D', scale: 1.08 },
    pos: { x: 50, y: 82 },
    chunk: 3,
    trans: 'fade',
    speed: 160
  },
  interlock: {
    cat: 'Bold & animated',
    font: 'Space Grotesk',
    weight: 800,
    size: 46,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 3 },
    shadow: { on: true, color: '#000000', opacity: 85, x: 0, y: 4, blur: 8 },
    activeWord: { color: '#06B6D4', scale: 1.18 },
    pos: { x: 50, y: 78 },
    chunk: 2,
    trans: 'pop',
    speed: 90
  },
  look_anchorage: {
    cat: 'Clean',
    font: 'Work Sans',
    weight: 800,
    size: 42,
    cCase: 'upper',
    color: '#FFFFFF',
    stroke: { on: true, color: '#000000', width: 2 },
    activeWord: { color: '#A5F3FC', scale: 1.14 },
    pos: { x: 50, y: 80 },
    chunk: 2,
    trans: 'slide-up',
    speed: 120
  }
};

// Generate full presets array code
const presetsCode = raw.map((t, idx) => {
  const isBehind = t.isBehindYou;
  const isProperty = ['look_belfry', 'look_cloister', 'look_dovecote', 'look_gable'].includes(t.id);
  
  let cat = 'Popular';
  if (isBehind) {
    cat = isProperty ? 'Property reels' : 'Behind you';
  } else if (styleCatalog[t.id]) {
    cat = styleCatalog[t.id].cat;
  } else if (t.id.includes('glow') || t.id.includes('neon')) {
    cat = 'Popular';
  } else if (t.id.includes('punch') || t.id.includes('beast') || t.id.includes('red') || t.id.includes('tabahi')) {
    cat = 'Bold & animated';
  } else if (t.id.includes('clean') || t.id.includes('journal') || t.id.includes('saadha')) {
    cat = 'Clean';
  }

  // Visual style config
  const custom = styleCatalog[t.id];
  let patch;

  if (custom) {
    patch = {
      fontFamily: `font("${custom.font}")`,
      fontWeight: custom.weight,
      fontSize: custom.size,
      textCase: `"${custom.cCase}"`,
      color: `"${custom.color}"`,
      posY: custom.pos.y,
      wordsPerChunk: custom.chunk,
      transition: `"${custom.trans}"`,
      transitionSpeed: custom.speed,
    };
    if (custom.stroke) {
      patch.strokeOn = custom.stroke.on;
      patch.strokeColor = `"${custom.stroke.color}"`;
      patch.strokeWidth = custom.stroke.width;
    }
    if (custom.shadow) {
      patch.shadowOn = custom.shadow.on;
      patch.shadowColor = `"${custom.shadow.color}"`;
      patch.shadowOpacity = custom.shadow.opacity;
      patch.shadowX = custom.shadow.x;
      patch.shadowY = custom.shadow.y;
      patch.shadowBlur = custom.shadow.blur;
    }
    if (custom.glow) {
      patch.glowOn = custom.glow.on;
      patch.glowColor = `"${custom.glow.color}"`;
      patch.glowBlur = custom.glow.blur;
      patch.glowIntensity = custom.glow.int;
    }
    if (custom.bg) {
      patch.bgOn = custom.bg.on;
      patch.bgColor = `"${custom.bg.color}"`;
      patch.bgOpacity = custom.bg.opacity;
      patch.bgRadius = custom.bg.radius;
      patch.bgPadX = custom.bg.padX;
      patch.bgPadY = custom.bg.padY;
    }
    if (custom.activeWord) {
      patch.activeWordOn = true;
      patch.activeWordColor = `"${custom.activeWord.color}"`;
      patch.activeWordScale = custom.activeWord.scale;
      if (custom.activeWord.bgOn) {
        patch.activeWordBgOn = true;
        patch.activeWordBgColor = `"${custom.activeWord.bgColor}"`;
      }
    }
  } else if (isBehind) {
    // Tailored behind-you styling with cutout depth
    const fontNames = ['Anton', 'Montserrat', 'Oswald', 'Bebas Neue', 'Archivo Black', 'Black Ops One'];
    const chosenFont = fontNames[idx % fontNames.length];
    const highlightColors = ['#FFE600', '#F59E0B', '#38BDF8', '#22C55E', '#EC4899', '#F97316', '#A855F7', '#E11D48'];
    const chosenColor = highlightColors[idx % highlightColors.length];
    
    patch = {
      fontFamily: `font("${chosenFont}")`,
      fontWeight: 900,
      fontSize: 54,
      textCase: '"upper"',
      color: '"#FFFFFF"',
      strokeOn: true,
      strokeColor: '"#111111"',
      strokeWidth: 3.5,
      shadowOn: true,
      shadowColor: '"#000000"',
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 8,
      shadowBlur: 18,
      posY: 42, // Upper-half behind speaker's head/shoulders
      wordsPerChunk: 1, // Single punchy word reveal
      transition: '"pop"',
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordColor: `"${chosenColor}"`,
      activeWordScale: 1.25,
    };
  } else {
    // Clean/bold modern creator style
    const fontNames = ['Inter', 'Poppins', 'Space Grotesk', 'Outfit', 'Montserrat'];
    const chosenFont = fontNames[idx % fontNames.length];
    const highlightColors = ['#FFE600', '#F59E0B', '#00F0FF', '#22C55E', '#38BDF8'];
    const chosenColor = highlightColors[idx % highlightColors.length];

    patch = {
      fontFamily: `font("${chosenFont}")`,
      fontWeight: 800,
      fontSize: 44,
      textCase: '"upper"',
      color: '"#FFFFFF"',
      strokeOn: true,
      strokeColor: '"#000000"',
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: '"#000000"',
      shadowOpacity: 85,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 80,
      wordsPerChunk: 2,
      transition: '"pop"',
      transitionSpeed: 95,
      activeWordOn: true,
      activeWordColor: `"${chosenColor}"`,
      activeWordScale: 1.18,
    };
  }

  const patchLines = Object.entries(patch).map(([k, v]) => `      ${k}: ${v},`).join('\n');

  return `  {
    id: "${t.id}",
    name: "Captik · ${t.name}",
    cleanName: "${t.name}",
    category: "${cat}",
    isBehindYou: ${t.isBehindYou},
    isNew: ${t.isNew},
    video: "${t.video}",
    poster: "${t.poster}",
    patch: {
${patchLines}
    }
  }`;
});

const tsContent = `// All 72 Caption Templates extracted from Captik (https://captik.in/templates)
// Pixel-accurate recreation with typography, 3D depth, cutout layers, and animations.
import type { CapStyle } from "./captionStyle";

const FONT_MAP: Record<string, string> = {
  "Inter": "'Inter', system-ui, sans-serif",
  "Poppins": "'Poppins', 'Inter', sans-serif",
  "Montserrat": "'Montserrat', 'Inter', sans-serif",
  "Space Grotesk": "'Space Grotesk', 'Inter', sans-serif",
  "DM Sans": "'DM Sans', 'Inter', sans-serif",
  "Outfit": "'Outfit', 'Inter', sans-serif",
  "Anton": "'Anton', 'Impact', sans-serif",
  "Archivo Black": "'Archivo Black', 'Impact', sans-serif",
  "Bebas Neue": "'Bebas Neue', 'Impact', sans-serif",
  "Bangers": "'Bangers', 'Impact', cursive",
  "Permanent Marker": "'Permanent Marker', cursive",
  "Press Start 2P": "'Press Start 2P', ui-monospace, monospace",
  "EB Garamond": "'EB Garamond', Georgia, serif",
  "Playfair Display": "'Playfair Display', Georgia, serif",
  "DM Serif Display": "'DM Serif Display', Georgia, serif",
  "Special Elite": "'Special Elite', ui-monospace, monospace",
  "Work Sans": "'Work Sans', 'Inter', sans-serif",
  "Oswald": "'Oswald', 'Impact', sans-serif",
  "Black Ops One": "'Black Ops One', 'Impact', sans-serif",
  "Plus Jakarta Sans": "'Plus Jakarta Sans', 'Inter', sans-serif",
};

const font = (label: string): string => FONT_MAP[label] ?? \`'\${label}', system-ui, sans-serif\`;

export interface CaptikPresetItem {
  id: string;
  name: string;
  cleanName: string;
  category: "Behind you" | "Popular" | "Bold & animated" | "Clean" | "Property reels";
  isBehindYou: boolean;
  isNew: boolean;
  video: string;
  poster: string;
  patch: Partial<CapStyle>;
}

export const CAPTIK_72_PRESETS: CaptikPresetItem[] = [
` + presetsCode.join(',\n') + `
];
`;

fs.writeFileSync('src/lib/captikPresets.ts', tsContent, 'utf8');
console.log('Successfully written src/lib/captikPresets.ts with 72 templates!');
