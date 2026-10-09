export interface DemoCaptionTemplate {
  id: string;
  name: string;
  label: string;
  icon: string;
  description: string;
  containerClassName: string;
  textClassName: string;
  inactiveWordClassName: string;
  activeWordClassName: string;
  badgeText: string;
  badgeClassName: string;
  dotColor: string;
}

// Pure floating typography with balanced, creator-grade sizes and NO ugly box container
export const DEMO_CAPTION_TEMPLATES: DemoCaptionTemplate[] = [
  {
    id: "hormozi",
    name: "Creator · Hormozi Viral",
    label: "Hormozi",
    icon: "⚡",
    description: "Viral yellow pop with thick black outline",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-black uppercase tracking-tight text-white text-[17px] sm:text-[21px] md:text-[24px]",
    inactiveWordClassName: "text-white [text-shadow:_0_2px_0_#000,_2px_0_0_#000,_0_-2px_0_#000,_-2px_0_0_#000,_1.5px_1.5px_0_#000,_-1.5px_-1.5px_0_#000,_0_6px_12px_rgba(0,0,0,0.95)]",
    activeWordClassName: "bg-[#FFE600] text-black font-black px-2 py-0.5 rounded-md shadow-[0_0_20px_rgba(255,230,0,0.9)] scale-105 -rotate-1 ring-1 ring-black/80",
    badgeText: "⚡ HORMOZI",
    badgeClassName: "text-[#FFE600] font-black",
    dotColor: "#FFE600",
  },
  {
    id: "mrbeast",
    name: "Creator · MrBeast Pop",
    label: "MrBeast",
    icon: "💥",
    description: "Punchy electric lime green pop with high energy",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-black uppercase tracking-tighter text-white text-[18px] sm:text-[22px] md:text-[25px]",
    inactiveWordClassName: "text-white [text-shadow:_0_3px_0_#000,_3px_0_0_#000,_0_-3px_0_#000,_-3px_0_0_#000,_2px_2px_0_#000,_-2px_-2px_0_#000,_0_8px_16px_rgba(0,0,0,0.95)]",
    activeWordClassName: "bg-[#22C55E] text-white font-black px-2.5 py-0.5 rounded-lg shadow-[0_0_25px_rgba(34,197,94,0.9)] ring-1.5 ring-white scale-105 rotate-0.5",
    badgeText: "💥 MRBEAST",
    badgeClassName: "text-[#22C55E] font-black",
    dotColor: "#22C55E",
  },
  {
    id: "ali-abdaal",
    name: "Creator · Ali Abdaal Studio",
    label: "Ali Abdaal",
    icon: "🌟",
    description: "Clean aesthetic pastel yellow highlighter",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-extrabold tracking-normal text-zinc-100 text-[16px] sm:text-[20px] md:text-[22px]",
    inactiveWordClassName: "text-zinc-100 [text-shadow:_0_2px_6px_rgba(0,0,0,0.9),_0_1px_2px_rgba(0,0,0,1)]",
    activeWordClassName: "bg-[#FEF08A] text-zinc-950 font-black px-2 py-0.5 rounded shadow-[0_2px_12px_rgba(254,240,138,0.7)] scale-105 ring-1 ring-amber-300",
    badgeText: "🌟 ALI ABDAAL",
    badgeClassName: "text-[#FEF08A] font-bold",
    dotColor: "#FEF08A",
  },
  {
    id: "cyber-neon",
    name: "Reels · Cyber Neon Glow",
    label: "Cyber Neon",
    icon: "🔮",
    description: "Electric cyan & magenta futuristic glow",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-black uppercase tracking-wider text-[#00F0FF] text-[16px] sm:text-[20px] md:text-[23px]",
    inactiveWordClassName: "text-[#00F0FF] drop-shadow-[0_0_10px_#00F0FF] drop-shadow-[0_0_20px_rgba(0,240,255,0.6)] [text-shadow:_0_2px_4px_rgba(0,0,0,0.9)]",
    activeWordClassName: "bg-[#FF007A] text-white font-black px-2.5 py-0.5 rounded-lg shadow-[0_0_25px_#FF007A] ring-1.5 ring-[#00F0FF] scale-105",
    badgeText: "🔮 CYBER NEON",
    badgeClassName: "text-[#00F0FF] font-black",
    dotColor: "#00F0FF",
  },
  {
    id: "bollywood",
    name: "Desi · Bollywood Hit",
    label: "Desi Hit",
    icon: "🔥",
    description: "Saffron & golden gradient viral reel style",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-black tracking-tight text-white text-[17px] sm:text-[21px] md:text-[24px]",
    inactiveWordClassName: "text-white [text-shadow:_0_2px_0_#000,_2px_0_0_#000,_0_-2px_0_#000,_-2px_0_0_#000,_0_6px_12px_rgba(0,0,0,0.95)]",
    activeWordClassName: "bg-gradient-to-r from-[#F59E0B] via-[#EF4444] to-[#EC4899] text-white font-black px-2.5 py-0.5 rounded-lg shadow-[0_0_25px_rgba(245,158,11,0.85)] scale-105 ring-1.5 ring-amber-300",
    badgeText: "🔥 DESI HIT",
    badgeClassName: "text-[#F59E0B] font-black",
    dotColor: "#F59E0B",
  },
  {
    id: "red-box",
    name: "Creator · Red Box Studio",
    label: "Red Box",
    icon: "🔴",
    description: "Yourcaptions signature bold crimson badge",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-black tracking-tight text-white text-[17px] sm:text-[21px] md:text-[24px]",
    inactiveWordClassName: "text-white [text-shadow:_0_2px_0_#000,_2px_0_0_#000,_0_-2px_0_#000,_-2px_0_0_#000,_0_6px_12px_rgba(0,0,0,0.95)]",
    activeWordClassName: "bg-[#E60000] text-white font-black px-2.5 py-0.5 rounded-lg shadow-[0_0_25px_rgba(230,0,0,0.95)] ring-1.5 ring-white scale-105",
    badgeText: "🔴 RED BOX",
    badgeClassName: "text-[#FF4D4D] font-black",
    dotColor: "#E60000",
  },
  {
    id: "karaoke",
    name: "Reels · 1-Click Karaoke",
    label: "Karaoke Pop",
    icon: "🎤",
    description: "Electric sky blue wave sweep highlight",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-black tracking-wide text-white text-[16px] sm:text-[20px] md:text-[22px]",
    inactiveWordClassName: "text-white/85 [text-shadow:_0_2px_6px_rgba(0,0,0,0.95),_0_1px_2px_rgba(0,0,0,1)]",
    activeWordClassName: "bg-[#0284C7] text-white font-black px-2.5 py-0.5 rounded-full shadow-[0_0_25px_#38BDF8] ring-1.5 ring-[#38BDF8] scale-105",
    badgeText: "🎤 KARAOKE",
    badgeClassName: "text-[#38BDF8] font-black",
    dotColor: "#38BDF8",
  },
  {
    id: "cinematic",
    name: "Creator · Iman Gadzhi Luxury",
    label: "Cinematic",
    icon: "🎬",
    description: "Minimal luxury documentary film subtitle",
    containerClassName: "bg-transparent border-none shadow-none p-0",
    textClassName: "font-semibold tracking-wider text-white text-[15px] sm:text-[18px] md:text-[21px]",
    inactiveWordClassName: "text-white [text-shadow:_0_2px_4px_rgba(0,0,0,1),_0_4px_12px_rgba(0,0,0,0.95)]",
    activeWordClassName: "text-[#FEF3C7] underline decoration-[#FEF3C7] decoration-2 underline-offset-6 font-black scale-105 drop-shadow-[0_0_20px_rgba(254,243,199,0.9)]",
    badgeText: "🎬 CINEMATIC",
    badgeClassName: "text-amber-100 font-semibold",
    dotColor: "#FEF3C7",
  },
];

export const DEFAULT_DEMO_TEMPLATE = DEMO_CAPTION_TEMPLATES[0]; // Hormozi
