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

export const DEMO_CAPTION_TEMPLATES: DemoCaptionTemplate[] = [
  {
    id: "hormozi",
    name: "Creator · Hormozi Viral",
    label: "Hormozi",
    icon: "⚡",
    description: "Viral yellow pop with bold black outline",
    containerClassName: "bg-black/90 backdrop-blur-md border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.9)]",
    textClassName: "font-black uppercase tracking-tight text-white",
    inactiveWordClassName: "text-white drop-shadow-[0_2px_0_#000] drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]",
    activeWordClassName: "bg-[#FFE600] text-black font-black scale-110 shadow-[0_0_20px_rgba(255,230,0,0.9)] -rotate-1 ring-1 ring-black/40",
    badgeText: "⚡ HORMOZI VIRAL",
    badgeClassName: "text-[#FFE600] font-black",
    dotColor: "#FFE600",
  },
  {
    id: "mrbeast",
    name: "Creator · MrBeast Pop",
    label: "MrBeast",
    icon: "💥",
    description: "Punchy lime green pop with high energy",
    containerClassName: "bg-black/90 backdrop-blur-md border border-[#22C55E]/40 shadow-[0_12px_40px_rgba(0,0,0,0.9)]",
    textClassName: "font-black uppercase tracking-tighter text-white",
    inactiveWordClassName: "text-white drop-shadow-[0_3px_0_#000] drop-shadow-[0_6px_12px_rgba(0,0,0,0.9)]",
    activeWordClassName: "bg-[#22C55E] text-white font-black scale-115 rotate-1 shadow-[0_0_25px_rgba(34,197,94,0.95)] ring-2 ring-white/80",
    badgeText: "💥 MRBEAST POP",
    badgeClassName: "text-[#22C55E] font-black",
    dotColor: "#22C55E",
  },
  {
    id: "ali-abdaal",
    name: "Creator · Ali Abdaal Studio",
    label: "Ali Abdaal",
    icon: "🌟",
    description: "Clean aesthetic pastel yellow highlighter",
    containerClassName: "bg-zinc-950/85 backdrop-blur-lg border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.85)]",
    textClassName: "font-bold tracking-normal text-zinc-100",
    inactiveWordClassName: "text-zinc-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
    activeWordClassName: "bg-[#FEF08A] text-zinc-950 font-bold scale-105 shadow-[0_2px_12px_rgba(254,240,138,0.6)] ring-1 ring-amber-200/50",
    badgeText: "🌟 ALI ABDAAL STUDIO",
    badgeClassName: "text-[#FEF08A] font-bold",
    dotColor: "#FEF08A",
  },
  {
    id: "cyber-neon",
    name: "Reels · Cyber Neon Glow",
    label: "Cyber Neon",
    icon: "🔮",
    description: "Electric cyan & magenta futuristic glow",
    containerClassName: "bg-[#080214]/90 backdrop-blur-xl border border-[#00F0FF]/40 shadow-[0_0_35px_rgba(0,240,255,0.25)]",
    textClassName: "font-black uppercase tracking-wider text-[#00F0FF]",
    inactiveWordClassName: "text-[#00F0FF]/90 drop-shadow-[0_0_8px_#00F0FF]",
    activeWordClassName: "bg-[#FF007A] text-white font-black scale-115 shadow-[0_0_30px_#FF007A] ring-2 ring-[#00F0FF]",
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
    containerClassName: "bg-black/90 backdrop-blur-md border border-[#F59E0B]/40 shadow-[0_12px_40px_rgba(0,0,0,0.9)]",
    textClassName: "font-black tracking-tight text-white",
    inactiveWordClassName: "text-amber-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]",
    activeWordClassName: "bg-gradient-to-r from-[#F59E0B] via-[#EF4444] to-[#EC4899] text-white font-black scale-110 shadow-[0_0_25px_rgba(245,158,11,0.85)] ring-1 ring-amber-300/60",
    badgeText: "🔥 DESI BOLLYWOOD HIT",
    badgeClassName: "text-[#F59E0B] font-black",
    dotColor: "#F59E0B",
  },
  {
    id: "red-box",
    name: "Creator · Red Box Studio",
    label: "Red Box",
    icon: "🔴",
    description: "Yourcaptions signature bold crimson badge",
    containerClassName: "bg-black/85 backdrop-blur-md border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.85)]",
    textClassName: "font-black tracking-tight text-white",
    inactiveWordClassName: "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]",
    activeWordClassName: "bg-[#E60000] text-white font-black scale-110 shadow-[0_0_16px_rgba(230,0,0,0.9)] ring-1 ring-white/40",
    badgeText: "🔴 RED BOX STUDIO",
    badgeClassName: "text-[#FF4D4D] font-black",
    dotColor: "#E60000",
  },
  {
    id: "karaoke",
    name: "Reels · 1-Click Karaoke",
    label: "Karaoke Pop",
    icon: "🎤",
    description: "Electric sky blue wave sweep highlight",
    containerClassName: "bg-slate-950/90 backdrop-blur-md border border-sky-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.9)]",
    textClassName: "font-black tracking-wide text-white",
    inactiveWordClassName: "text-white/70 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",
    activeWordClassName: "bg-[#0284C7] text-white font-black scale-112 shadow-[0_0_25px_#38BDF8] ring-2 ring-[#38BDF8]",
    badgeText: "🎤 1-CLICK KARAOKE",
    badgeClassName: "text-[#38BDF8] font-black",
    dotColor: "#38BDF8",
  },
  {
    id: "cinematic",
    name: "Creator · Iman Gadzhi Luxury",
    label: "Cinematic",
    icon: "🎬",
    description: "Minimal luxury documentary film subtitle",
    containerClassName: "bg-black/50 backdrop-blur-sm border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.7)]",
    textClassName: "font-semibold tracking-wider text-white",
    inactiveWordClassName: "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]",
    activeWordClassName: "bg-white/20 text-[#FEF3C7] underline decoration-[#FEF3C7] decoration-2 underline-offset-4 font-bold scale-105 backdrop-blur-sm shadow-[0_0_15px_rgba(254,243,199,0.3)]",
    badgeText: "🎬 CINEMATIC LUXURY",
    badgeClassName: "text-amber-100 font-semibold",
    dotColor: "#FEF3C7",
  },
];

export const DEFAULT_DEMO_TEMPLATE = DEMO_CAPTION_TEMPLATES[0]; // Hormozi
