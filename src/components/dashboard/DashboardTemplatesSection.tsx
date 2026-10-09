import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Wand2, Flame, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface DashboardTemplate {
  id: string;
  creator: string;
  name: string;
  badge: string;
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

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: "hormozi",
    creator: "Alex Hormozi",
    name: "Hormozi Viral Punch",
    badge: "Top Retention",
    avatar: "👑",
    font: "Montserrat / Anton",
    colors: {
      text: "#FFFFFF",
      activeText: "#FFE600",
      stroke: "#000000",
    },
    sampleWords: ["MAKE", "AN", "OFFER", "SO", "GOOD"],
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
    avatar: "⚡",
    font: "Lilita One / Anton",
    colors: {
      text: "#FFFFFF",
      activeText: "#000000",
      activeBg: "#00F0FF",
      stroke: "#000000",
    },
    sampleWords: ["I", "JUST", "GAVE", "AWAY", "100M"],
    animationType: "bounce",
    fontFamily: "'Impact', sans-serif",
    fontWeight: 900,
    textCase: "upper",
  },
  {
    id: "iman",
    creator: "Iman Gadzhi",
    name: "Iman Luxury Gold",
    badge: "Editorial",
    avatar: "💎",
    font: "Cinzel / Playfair",
    colors: {
      text: "#F8FAFC",
      activeText: "#D4AF37",
      glow: "rgba(212, 175, 55, 0.4)",
    },
    sampleWords: ["The", "game", "begins", "right", "now"],
    animationType: "fade",
    fontFamily: "'Cinzel', serif",
    fontWeight: 700,
    textCase: "normal",
  },
  {
    id: "ali",
    creator: "Ali Abdaal",
    name: "Studio Clean Pill",
    badge: "Productivity",
    avatar: "☕",
    font: "Inter Clean",
    colors: {
      text: "#F1F5F9",
      activeText: "#38BDF8",
      pillBg: "rgba(0, 0, 0, 0.8)",
    },
    sampleWords: ["Focus", "on", "systems", "every", "day"],
    animationType: "fade",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    textCase: "normal",
  },
  {
    id: "kalakar",
    creator: "Kalakar / Desi",
    name: "Bollywood High Contrast",
    badge: "Hindi & Urdu",
    avatar: "🎨",
    font: "Rozha One / Poppins",
    colors: {
      text: "#FFFFFF",
      activeText: "#FF2A55",
      stroke: "#000000",
      glow: "rgba(255, 42, 85, 0.5)",
    },
    sampleWords: ["KAHANI", "ABHI", "BAAKI", "HAI", "DOST"],
    animationType: "pop",
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 900,
    textCase: "upper",
  },
  {
    id: "neon",
    creator: "Cyber Glow",
    name: "Electric Magenta",
    badge: "Night / EDM",
    avatar: "🌈",
    font: "Space Grotesk",
    colors: {
      text: "#FFFFFF",
      activeText: "#00F0FF",
      glow: "#00F0FF",
      stroke: "#000000",
    },
    sampleWords: ["10X", "YOUR", "ORGANIC", "REACH", "NOW"],
    animationType: "glow",
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 800,
    textCase: "upper",
  },
];

export function DashboardTemplatesSection() {
  const navigate = useNavigate();
  const [activeWordIndices, setActiveWordIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWordIndices((prev) => {
        const next: Record<string, number> = {};
        for (const t of DASHBOARD_TEMPLATES) {
          const curr = prev[t.id] ?? 0;
          next[t.id] = (curr + 1) % t.sampleWords.length;
        }
        return next;
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  const handleApply = (template: DashboardTemplate) => {
    localStorage.setItem("captions:appliedTemplate", template.id);
    toast.success(`Applied "${template.name}"! Starting your new project...`);
    navigate(`/dashboard/new?applyTemplate=${template.id}`);
  };

  return (
    <div className="w-full mb-10">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E60000]/15 text-[#E60000]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">Viral Creator Templates</h2>
          </div>
          <p className="text-xs text-[#888] mt-1">
            Pre-styled caption animations proven across YouTube Shorts, Reels & TikTok
          </p>
        </div>
        <Link
          to="/templates"
          className="text-xs font-semibold text-[#888] hover:text-white flex items-center gap-1 transition-colors group"
        >
          <span>All 50+ templates</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DASHBOARD_TEMPLATES.map((t) => {
          const activeIdx = activeWordIndices[t.id] ?? 0;

          return (
            <div
              key={t.id}
              onClick={() => handleApply(t)}
              className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0E0E12] p-5 hover:border-[#E60000]/40 transition-all hover:shadow-[0_8px_24px_rgba(230,0,0,0.12)] overflow-hidden smooth-card gpu-accelerated cursor-pointer"
            >
              {/* Top metadata */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.avatar}</span>
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">{t.name}</div>
                      <div className="text-[11px] text-[#777]">{t.creator}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/80">
                    {t.badge}
                  </span>
                </div>

                {/* Live Preview Box */}
                <div className="h-20 w-full rounded-xl bg-black/60 border border-white/5 flex items-center justify-center px-3 py-2 my-2 relative overflow-hidden">
                  <div
                    className="flex flex-wrap items-center justify-center gap-1.5 transition-all duration-200"
                    style={{
                      backgroundColor: t.colors.pillBg || "transparent",
                      padding: t.colors.pillBg ? "4px 8px" : "0",
                      borderRadius: t.colors.pillBg ? "8px" : "0",
                    }}
                  >
                    {t.sampleWords.map((word, wIdx) => {
                      const isActive = wIdx === activeIdx;
                      return (
                        <span
                          key={`${word}-${wIdx}`}
                          className="transition-all duration-150 inline-block"
                          style={{
                            fontFamily: t.fontFamily,
                            fontWeight: t.fontWeight,
                            textTransform: t.textCase === "upper" ? "uppercase" : "none",
                            fontSize: isActive ? "14px" : "12px",
                            transform: isActive ? "scale(1.15)" : "scale(1)",
                            color: isActive ? t.colors.activeText : t.colors.text,
                            backgroundColor: isActive && t.colors.activeBg ? t.colors.activeBg : "transparent",
                            padding: isActive && t.colors.activeBg ? "1px 4px" : "0",
                            borderRadius: isActive && t.colors.activeBg ? "4px" : "0",
                            WebkitTextStroke: t.colors.stroke ? `0.8px ${t.colors.stroke}` : "none",
                            textShadow: isActive && t.colors.glow
                              ? `0 0 10px ${t.colors.glow}`
                              : t.colors.stroke
                              ? "0 2px 4px rgba(0,0,0,0.8)"
                              : "none",
                          }}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#666]">{t.font}</span>
                <Button
                  size="sm"
                  onClick={() => handleApply(t)}
                  className="h-8 rounded-lg bg-[#E60000] hover:bg-[#CC0000] text-white text-xs font-semibold px-3 gap-1 shadow-sm transition-all"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Use Style</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
