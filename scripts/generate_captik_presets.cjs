const fs = require('fs');

const content = fs.readFileSync('C:/Users/jackx/.gemini/antigravity-ide/brain/e87b9af5-ba59-4f56-a809-f9a23825772d/.system_generated/steps/1099/content.md', 'utf8');

const templateRegex = /<video[^>]*src="([^"]+)"[^>]*poster="([^"]+)"[^>]*aria-label="([^"]+) caption template preview"[^>]*>([\s\S]*?)<p[^>]*class="[^"]*truncate[^"]*"[^>]*>([^<]+)<\/p>/g;

const templates = [];
let match;
while ((match = templateRegex.exec(content)) !== null) {
  const cardHtml = match[4];
  const isBehindYou = cardHtml.includes('Behind you');
  const isNew = cardHtml.includes('New');
  
  templates.push({
    id: match[1].replace('/previews/t/', '').replace('.mp4', ''),
    name: match[5].trim(),
    video: match[1],
    poster: match[2],
    isBehindYou,
    isNew,
  });
}

// Generate rich CapStyle patches for each template based on its style type
const code = templates.map((t, i) => {
  let patch = {};
  const name = t.name;
  const id = t.id;

  if (id === 'captik_glow' || name.includes('Glow')) {
    patch = {
      fontFamily: "font('Space Grotesk')",
      fontWeight: 800,
      fontSize: 46,
      textCase: "'upper'",
      color: "'#FFFFFF'",
      glowOn: true,
      glowColor: "'#F59E0B'",
      glowBlur: 16,
      glowIntensity: 85,
      strokeOn: true,
      strokeColor: "'#000000'",
      strokeWidth: 2.5,
      posY: 78,
      wordsPerChunk: 2,
      transition: "'pop'",
      transitionSpeed: 95,
      activeWordOn: true,
      activeWordColor: "'#FCD34D'",
      activeWordScale: 1.18,
    };
  } else if (id === 'ali_abdaal' || name === 'Ali Abdaal' || name.includes('Clean')) {
    patch = {
      fontFamily: "font('Inter')",
      fontWeight: 600,
      fontSize: 38,
      textCase: "'normal'",
      color: "'#F1F5F9'",
      bgOn: true,
      bgColor: "'rgba(0, 0, 0, 0.72)'",
      bgOpacity: 80,
      bgRadius: 8,
      bgPadX: 14,
      bgPadY: 6,
      posY: 82,
      wordsPerChunk: 3,
      transition: "'fade'",
      transitionSpeed: 160,
      activeWordOn: true,
      activeWordColor: "'#38BDF8'",
      activeWordScale: 1.05,
    };
  } else if (id === 'hormozi' || name.includes('Hormozi')) {
    patch = {
      fontFamily: "font('Montserrat')",
      fontWeight: 900,
      fontSize: 50,
      textCase: "'upper'",
      color: "'#FFFFFF'",
      strokeOn: true,
      strokeColor: "'#000000'",
      strokeWidth: 4.5,
      shadowOn: true,
      shadowColor: "'#000000'",
      shadowOpacity: 95,
      shadowX: 0,
      shadowY: 5,
      shadowBlur: 10,
      posY: 78,
      wordsPerChunk: 2,
      transition: "'pop'",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordColor: "'#FFE600'",
      activeWordScale: 1.25,
      impactWordsRed: "'money, profit, secret, free, never, viral'",
      impactRedColor: "'#EF4444'",
    };
  } else if (id.includes('mrbeast') || id.includes('mr_beast') || name.includes('Mr Beast')) {
    patch = {
      fontFamily: "font('Impact')",
      fontWeight: 900,
      fontSize: 52,
      textCase: "'upper'",
      color: "'#FFFFFF'",
      strokeOn: true,
      strokeColor: "'#000000'",
      strokeWidth: 5,
      shadowOn: true,
      shadowColor: "'#000000'",
      shadowOpacity: 100,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 0,
      posY: 76,
      wordsPerChunk: 2,
      transition: "'bounce'",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordBgOn: true,
      activeWordBgColor: id.includes('2') ? "'#FFE600'" : "'#00F0FF'",
      activeWordColor: "'#000000'",
      activeWordScale: 1.2,
    };
  } else if (id === 'iman_gadzhi' || name.includes('Iman')) {
    patch = {
      fontFamily: "font('Montserrat')",
      fontWeight: 800,
      fontSize: 44,
      textCase: "'upper'",
      letterSpacing: 2,
      color: "'#FAF5E9'",
      shadowOn: true,
      shadowColor: "'#000000'",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 3,
      shadowBlur: 12,
      posY: 52,
      wordsPerChunk: 2,
      transition: "'fade'",
      transitionSpeed: 180,
      activeWordOn: true,
      activeWordColor: "'#D4AF37'",
      activeWordScale: 1.08,
    };
  } else if (id === 'bubble' || name.includes('Bubble')) {
    patch = {
      fontFamily: "font('Fredoka')",
      fontWeight: 700,
      fontSize: 44,
      textCase: "'normal'",
      color: "'#1E1B4B'",
      bgOn: true,
      bgColor: "'#FEF08A'",
      bgRadius: 24,
      bgPadX: 18,
      bgPadY: 8,
      posY: 78,
      wordsPerChunk: 3,
      transition: "'bounce'",
      transitionSpeed: 110,
      activeWordOn: true,
      activeWordColor: "'#4338CA'",
      activeWordScale: 1.15,
    };
  } else if (t.isBehindYou) {
    // Cutout style behind person (upper center/mid)
    patch = {
      fontFamily: "font('Montserrat')",
      fontWeight: 900,
      fontSize: 54,
      textCase: "'upper'",
      color: id.includes('garnet') ? "'#EF4444'" : id.includes('amber') || id.includes('beacon') ? "'#F59E0B'" : "'#FFFFFF'",
      strokeOn: true,
      strokeColor: "'#000000'",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "'#000000'",
      shadowOpacity: 90,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 14,
      posY: 42, // Behind head / shoulder area
      wordsPerChunk: 1,
      transition: "'pop'",
      transitionSpeed: 90,
      activeWordOn: true,
      activeWordColor: "'#FFE600'",
      activeWordScale: 1.2,
    };
  } else if (name.includes('Masala') || name.includes('Delhi') || name.includes('Tabahi') || name.includes('Seedha')) {
    // Desi / Hinglish creator style
    patch = {
      fontFamily: "font('Poppins')",
      fontWeight: 800,
      fontSize: 46,
      textCase: "'upper'",
      color: "'#FFFFFF'",
      strokeOn: true,
      strokeColor: "'#000000'",
      strokeWidth: 3.5,
      shadowOn: true,
      shadowColor: "'#000000'",
      shadowOpacity: 85,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 10,
      posY: 78,
      wordsPerChunk: 3,
      transition: "'pop'",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordColor: name.includes('Masala') ? "'#FF9933'" : "'#22C55E'",
      activeWordScale: 1.18,
    };
  } else {
    // Standard bold modern reel style
    patch = {
      fontFamily: "font('Inter')",
      fontWeight: 800,
      fontSize: 44,
      textCase: "'upper'",
      color: "'#FFFFFF'",
      strokeOn: true,
      strokeColor: "'#000000'",
      strokeWidth: 3,
      shadowOn: true,
      shadowColor: "'#000000'",
      shadowOpacity: 80,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 8,
      posY: 80,
      wordsPerChunk: 2,
      transition: "'pop'",
      transitionSpeed: 100,
      activeWordOn: true,
      activeWordColor: "'#FACC15'",
      activeWordScale: 1.15,
    };
  }

  // Format patch into clean code
  const patchLines = Object.entries(patch).map(([k, v]) => `      ${k}: ${v},`).join('\n');
  const category = t.isBehindYou ? 'Behind you' : (id.includes('mrbeast') || id.includes('hormozi') || id.includes('bubble')) ? 'Bold & animated' : (id.includes('ali') || id.includes('clean') || id.includes('journal')) ? 'Clean' : 'Popular';

  return `  {
    name: "Captik · ${name}",
    category: "${category}",
    patch: {
${patchLines}
    }
  },`;
});

const output = `export const CAPTIK_72_PRESETS: { name: string; patch: Partial<CapStyle>; category?: string }[] = [\n${code.join('\n')}\n];\n`;

fs.writeFileSync('scripts/captik_presets.ts', output, 'utf8');
console.log('Successfully generated scripts/captik_presets.ts with 72 templates!');
