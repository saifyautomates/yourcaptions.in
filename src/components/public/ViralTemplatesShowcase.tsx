import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Play, Check, Flame, Crown, Wand2 } from "lucide-react";
import { Reveal } from "@/components/public/vfx/Reveal";

export interface CreatorTemplate {
  id: string;
  creator: string;
  name: string;
  badge: string;
  tagline: string;
  avatar: string;
  font: string;
  colors: {
    text: string;
    activeText: string;
    activeBg?: string;
    stroke?: string;
    glow?: string;
    pillBg?: string;
  };
  sampleWords: string[];
  animationType: "pop" | "bounce" | "fade" | "glow";
  fontFamily: string;
  fontWeight: number;
  textCase: "upper" | "normal";
}

export const VIRAL_CREATOR_TEMPLATES: CreatorTemplate[] = [
  {
    id: "hormozi",
    creator: "Alex Hormozi",
    name: "Hormozi Viral Punch",
    badge: "Most Popular",
    tagline: "Bold, punchy uppercase text with neon yellow pop & thick stroke that commands 100% viewer focus.",
    avatar: "👑",
    font: "Montserrat / Anton",
    colors: {
      text: "#FFFFFF",
      activeText: "#FFE600",
      stroke: "#000000",
    },
    sampleWords: ["MAKE", "AN", "OFFER", "SO", "GOOD", "THEY", "FEEL", "STUPID", "SAYING", "NO"],
    animationType: "pop",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 900,
    textCase: "upper",
  },
  {
    id: "mrbeast",
    creator: "MrBeast",
    name: "MrBeast Cyber Pop",
    badge: "High Energy",
    tagline: "Explosive bouncy pop with cyan highlight boxes that spike viewer retention across YouTube Shorts.",
    avatar: "⚡",
    font: "Lilita One / Anton",
    colors: {
      text: "#FFFFFF",
      activeText: "#000000",
      activeBg: "#00F0FF",
      stroke: "#000000",
    },
    sampleWords: ["I", "JUST", "GAVE", "AWAY", "100", "MILLION", "DOLLARS", "ON", "LIVE", "STREAM"],
    animationType: "bounce",
    fontFamily: "'Impact', sans-serif",
    fontWeight: 900,
    textCase: "upper",
  },
  {
    id: "iman",
    creator: "Iman Gadzhi",
    name: "Iman Gadzhi Luxury",
    badge: "Editorial & Rich",
    tagline: "Warm champagne gold text with gentle cinematic fade and sophisticated tracking for high-ticket niches.",
    avatar: "💎",
    font: "Playfair / Cinzel",
    colors: {
      text: "#F8FAFC",
      activeText: "#D4AF37",
      glow: "rgba(212, 175, 55, 0.4)",
    },
    sampleWords: ["The", "real", "game", "begins", "when", "you", "stop", "playing", "by", "their", "rules"],
    animationType: "fade",
    fontFamily: "'Cinzel', 'Times New Roman', serif",
    fontWeight: 700,
    textCase: "normal",
  },
  {
    id: "ali",
    creator: "Ali Abdaal",
    name: "Ali Abdaal Studio Clean",
    badge: "Productivity & Clean",
    tagline: "Minimalist dark pill background with soft sky-blue active words. Ultra-readable, zero visual clutter.",
    avatar: "☕",
    font: "Inter / DM Sans",
    colors: {
      text: "#F1F5F9",
      activeText: "#38BDF8",
      pillBg: "rgba(0, 0, 0, 0.75)",
    },
    sampleWords: ["Focus", "on", "the", "system", "not", "the", "goal", "and", "results", "follow", "naturally"],
    animationType: "fade",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 600,
    textCase: "normal",
  },
  {
    id: "neon",
    creator: "Cyber Hype",
    name: "Neon Glow Electric",
    badge: "Vibrant / Night",
    tagline: "Electric magenta and cyan neon glow pulses that give podcast clips and EDM shorts a futuristic edge.",
    avatar: "🌈",
    font: "Space Grotesk / Righteous",
    colors: {
      text: "#FFFFFF",
      activeText: "#00F0FF",
      glow: "#00F0FF",
      stroke: "#000000",
    },
    sampleWords: ["THIS", "SECRET", "ALGORITHM", "WILL", "10X", "YOUR", "ORGANIC", "REACH", "OVERNIGHT"],
    animationType: "glow",
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 800,
    textCase: "upper",
  },
];

export function ViralTemplatesShowcase() {
  const [activeTemplate, setActiveTemplate] = useState<CreatorTemplate>(VIRAL_CREATOR_TEMPLATES[0]);
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  // Live word ticker simulating real subtitle sync
  useEffect(() => {
    setActiveWordIndex(0);
    const interval = setInterval(() => {
      setActiveWordIndex((prev) => (prev + 1) % activeTemplate.sampleWords.length);
    }, 450);
    return () => clearInterval(interval);
  }, [activeTemplate]);

  return (
    <section id="templates" className="py-24 md:py-32 bg-[#050508] relative overflow-hidden border-y border-[#1A1A24]">
      {/* Background glow ambient effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-red-600/10 via-purple-600/10 to-blue-600/10 blur-[140px] pointer-events-none rounded-full" />
      
      <div className="max-w-[1320px] mx-auto px-6 relative z-10">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E60000]/10 border border-[#E60000]/25 text-[#FF4D4D] text-[12px] font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(230,0,0,0.2)]">
              <Sparkles className="w-3.5 h-3.5 text-[#E60000]" />
              Signature Caption Templates
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Style Your Captions Like the <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-[#E60000]">
                World's Top 1% Creators
              </span>
            </h2>
            <p className="mt-4 text-[16px] md:text-[18px] text-[#8E8E9F] leading-relaxed">
              Don't spend hours tweaking CSS and keyframes. Apply the exact viral styles tested by top YouTubers and reel creators in a single click.
            </p>
          </div>
        </Reveal>

        {/* Creator Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
          {VIRAL_CREATOR_TEMPLATES.map((tmpl) => {
            const isSelected = activeTemplate.id === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setActiveTemplate(tmpl)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border text-[14px] font-bold transition-all duration-300 ${
                  isSelected
                    ? "bg-[#181824] border-[#E60000] text-white shadow-[0_0_20px_rgba(230,0,0,0.3)] scale-105"
                    : "bg-[#0E0E16]/80 border-[#1E1E2C] text-[#8E8E9F] hover:text-white hover:border-[#333348]"
                }`}
              >
                <span className="text-[18px]">{tmpl.avatar}</span>
                <span>{tmpl.creator}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E60000] animate-ping" />
                )}
              </button>
            );
          })}
        </div>

        {/* Interactive Live Preview Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#0B0B12] border border-[#1E1E2C] rounded-[28px] p-6 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Left: Template Details & Badges */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#E60000]/15 text-[#FF5555] border border-[#E60000]/30">
                  {activeTemplate.badge}
                </span>
                <span className="text-[13px] font-mono text-[#666680]">
                  Typography: {activeTemplate.font}
                </span>
              </div>

              <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
                {activeTemplate.name}
              </h3>
              <p className="text-[15px] text-[#9E9EB2] leading-relaxed">
                {activeTemplate.tagline}
              </p>
            </div>

            {/* Feature specs list */}
            <div className="space-y-3 bg-[#11111B] border border-[#1F1F2F] rounded-2xl p-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#7A7A90]">Active Word Sync</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Millisecond Accurate
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#7A7A90]">Recommended Formats</span>
                <span className="font-semibold text-white">9:16 Reels, Shorts, TikTok</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#7A7A90]">Render Engine</span>
                <span className="font-semibold text-[#00E5FF]">Hardware WebCodecs 4K</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Link
                to="/dashboard"
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-[#E60000] hover:bg-[#CC0000] text-white px-6 py-3.5 rounded-xl font-bold text-[14px] transition-all shadow-[0_0_20px_rgba(230,0,0,0.4)]"
              >
                <span>Use This Style Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/templates"
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-[#2B2B3D] text-[#8E8E9F] hover:text-white hover:border-white/30 text-[14px] font-semibold transition-all text-center"
              >
                Browse All 50+
              </Link>
            </div>
          </div>

          {/* Right: Phone-mockup Live Subtitle Stage */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-[500px] rounded-[32px] border-4 border-[#222233] bg-[#07070C] overflow-hidden shadow-2xl flex flex-col justify-between p-6">
              {/* Fake phone notch & status */}
              <div className="flex items-center justify-between text-[11px] font-mono text-[#555] px-2">
                <span>9:41</span>
                <div className="w-20 h-4 bg-[#141420] rounded-full" />
                <span className="text-emerald-400 font-bold">LIVE PREVIEW</span>
              </div>

              {/* Dynamic canvas subtitle staging area */}
              <div className="my-auto py-12 flex flex-col items-center justify-center text-center">
                {/* Simulated creator persona badge */}
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                  <span className="text-sm">{activeTemplate.avatar}</span>
                  <span className="text-[12px] font-semibold text-white/80">{activeTemplate.creator} Preset</span>
                </div>

                {/* Subtitle Words Rendering */}
                <div
                  className="px-4 py-3 rounded-2xl transition-all duration-300 max-w-[95%]"
                  style={{
                    backgroundColor: activeTemplate.colors.pillBg || "transparent",
                    backdropFilter: activeTemplate.colors.pillBg ? "blur(12px)" : "none",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
                    {activeTemplate.sampleWords.slice(
                      Math.max(0, activeWordIndex - 1),
                      Math.min(activeTemplate.sampleWords.length, activeWordIndex + 3)
                    ).map((word, idx) => {
                      const actualIdx = Math.max(0, activeWordIndex - 1) + idx;
                      const isActive = actualIdx === activeWordIndex;

                      return (
                        <motion.span
                          key={`${word}-${actualIdx}`}
                          initial={{ scale: 0.9, opacity: 0.7 }}
                          animate={{
                            scale: isActive ? 1.2 : 1.0,
                            opacity: 1,
                          }}
                          transition={{ type: "spring", stiffness: 450, damping: 25 }}
                          className="inline-block transition-colors duration-150"
                          style={{
                            fontFamily: activeTemplate.fontFamily,
                            fontWeight: activeTemplate.fontWeight,
                            textTransform: activeTemplate.textCase === "upper" ? "uppercase" : "none",
                            fontSize: isActive ? "28px" : "24px",
                            color: isActive
                              ? activeTemplate.colors.activeText
                              : activeTemplate.colors.text,
                            backgroundColor: isActive && activeTemplate.colors.activeBg
                              ? activeTemplate.colors.activeBg
                              : "transparent",
                            padding: isActive && activeTemplate.colors.activeBg ? "2px 8px" : "0px",
                            borderRadius: isActive && activeTemplate.colors.activeBg ? "8px" : "0px",
                            WebkitTextStroke: activeTemplate.colors.stroke
                              ? `1.5px ${activeTemplate.colors.stroke}`
                              : "none",
                            textShadow: isActive && activeTemplate.colors.glow
                              ? `0 0 20px ${activeTemplate.colors.glow}, 0 0 40px ${activeTemplate.colors.glow}`
                              : activeTemplate.colors.stroke
                              ? "0 4px 12px rgba(0,0,0,0.9)"
                              : "0 2px 8px rgba(0,0,0,0.7)",
                          }}
                        >
                          {word}
                        </motion.span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Reel UI Simulator */}
              <div className="flex items-center justify-between border-t border-[#181826] pt-3 text-[12px] text-[#666]">
                <span className="flex items-center gap-1.5 text-white/70 font-semibold">
                  <Flame className="w-3.5 h-3.5 text-[#E60000]" /> 4.2x Retention Hook
                </span>
                <span className="text-[11px] font-mono text-[#555]">60 FPS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
