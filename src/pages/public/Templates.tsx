import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Search, Layers, Play, Check, ArrowRight, X, Flame, ShieldAlert, Cpu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CAP_PRESETS, DEFAULT_CAP_STYLE, type CapStyle } from "@/lib/captionStyle";

const CATEGORIES = [
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
] as const;

const SIGNATURE_PACKS: Record<string, { label: string; badgeClass: string; icon: string }> = {
  "Popular": {
    label: "Popular",
    badgeClass: "bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]",
    icon: "⭐"
  },
  "Behind you": {
    label: "Behind you",
    badgeClass: "bg-blue-950/80 text-blue-300 border border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.35)]",
    icon: "👤"
  },
  "Bold & animated": {
    label: "Bold & animated",
    badgeClass: "bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.35)]",
    icon: "⚡"
  },
  "Clean": {
    label: "Clean",
    badgeClass: "bg-slate-900/80 text-slate-300 border border-slate-500/50 shadow-[0_0_12px_rgba(148,163,184,0.35)]",
    icon: "✨"
  },
  "Property reels": {
    label: "Property reels",
    badgeClass: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]",
    icon: "🏠"
  },
  "Kinetic Motion": {
    label: "Kinetic Motion",
    badgeClass: "bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.35)]",
    icon: "🔥"
  },
  "Shorts & Reels": {
    label: "Shorts & Reels",
    badgeClass: "bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]",
    icon: "⚡"
  },
  "Dynamic Pop": {
    label: "Dynamic Pop",
    badgeClass: "bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.35)]",
    icon: "✨"
  },
  "Desi Viral": {
    label: "Desi Viral",
    badgeClass: "bg-orange-950/80 text-orange-300 border border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.35)]",
    icon: "🇮🇳"
  },
  "Creator Pro": {
    label: "Creator Pro",
    badgeClass: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]",
    icon: "🎬"
  },
};

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [previewTemplate, setPreviewTemplate] = useState<typeof CAP_PRESETS[0] | null>(null);
  const [customPreviewText, setCustomPreviewText] = useState("This viral hook gets 4x more retention! 🚀");
  const [behindPerson, setBehindPerson] = useState(true);

  const { user } = useAuth();
  const nav = useNavigate();

  // Global karaoke word tick for all cards
  const previewWords = ["EVERY", "WORD", "DRIVES", "VIRALITY"];
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveWordIndex((prev) => (prev + 1) % previewWords.length);
    }, 400);
    return () => clearInterval(timer);
  }, []);

  const filteredTemplates = useMemo(() => {
    return CAP_PRESETS.filter((t) => {
      const cat = t.category ? t.category.toLowerCase() : "";
      const name = t.name.toLowerCase();

      const matchesCategory =
        activeCategory === "All" ||
        (t.category && t.category.toLowerCase() === activeCategory.toLowerCase()) ||
        (activeCategory === "Popular" && (cat === "popular" || name.includes("popular") || name.includes("glow") || name.includes("hormozi") || name.includes("beast"))) ||
        (activeCategory === "Behind you" && (cat === "behind you" || t.isBehindYou || name.includes("behind") || name.includes("cutout") || name.includes("reveal"))) ||
        (activeCategory === "Bold & animated" && (cat === "bold & animated" || cat.includes("bold") || cat.includes("animated") || name.includes("punch") || name.includes("masala") || name.includes("tabahi"))) ||
        (activeCategory === "Clean" && (cat === "clean" || cat.includes("minimal") || name.includes("clean") || name.includes("abdaal") || name.includes("swiss"))) ||
        (activeCategory === "Property reels" && (cat === "property reels" || name.includes("belfry") || name.includes("cloister") || name.includes("gable"))) ||
        (activeCategory === "Kinetic Motion" && (cat === "kinetic motion" || name.includes("kinetic"))) ||
        (activeCategory === "Shorts & Reels" && (cat === "shorts & reels" || name.includes("reels"))) ||
        (activeCategory === "Dynamic Pop" && (cat === "dynamic pop" || name.includes("dynamic"))) ||
        (activeCategory === "Desi Viral" && (cat === "desi viral" || name.includes("desi"))) ||
        (activeCategory === "Creator Pro" && (cat === "creator pro" || name.includes("creator")));

      const matchesSearch =
        !searchQuery.trim() ||
        name.includes(searchQuery.toLowerCase()) ||
        (t.category && cat.includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);


  const apply = (templateName: string) => {
    if (!user) {
      toast.info("Sign in to apply this template to your video project");
      nav(`/login?next=/templates`);
      return;
    }
    nav(`/dashboard?applyTemplate=${encodeURIComponent(templateName)}`);
  };

  // Words for the interactive modal
  const modalWords = customPreviewText.split(" ").filter(Boolean);
  const [modalWordIdx, setModalWordIdx] = useState(0);
  useEffect(() => {
    if (!previewTemplate) return;
    const timer = setInterval(() => {
      setModalWordIdx((prev) => (prev + 1) % (modalWords.length || 1));
    }, 380);
    return () => clearInterval(timer);
  }, [previewTemplate, modalWords.length]);

  return (
    <div className="bg-[#050505] min-h-screen pt-32 pb-24 text-[#888] font-inter overflow-x-hidden selection:bg-[#E60000] selection:text-white">
      
      {/* Header Banner */}
      <section className="mx-auto max-w-5xl px-6 py-12 text-center relative">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#E60000]/10 rounded-full blur-[130px] pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E60000]/10 border border-[#E60000]/25 text-[#E60000] text-[12px] font-bold uppercase tracking-wider mb-6">
          <Sparkles size={14} /> {CAP_PRESETS.length}+ Studio-Grade Kinetic Presets
        </div>
        
        <h1
          className="font-extrabold text-white tracking-tight leading-[1.05]"
          style={{ fontSize: "clamp(38px, 5.5vw, 84px)" }}
        >
          {CAP_PRESETS.length}+ Viral Styles.{" "}
          <span className="text-[#E60000] italic font-serif font-normal">
            100% Working
          </span>
          .
        </h1>
        
        <p className="mt-5 text-[#888] text-[16px] md:text-[19px] max-w-[720px] mx-auto leading-relaxed">
          Engineered for explosive watch-time, viral Reels, YouTube Shorts, and TikToks. 
          Real-time kinetic animations, frame-accurate rendering &amp; 3D depth.
        </p>

        {/* Signature Quick-Switch Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
          {Object.entries(SIGNATURE_PACKS).map(([key, meta]) => {
            const isSelected = activeCategory === key;
            const count = CAP_PRESETS.filter((p) => p.category === key || p.name.toLowerCase().includes(key.toLowerCase())).length;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-[#E60000] text-white border-[#E60000] shadow-[0_0_14px_rgba(230,0,0,0.5)] scale-[1.04]"
                    : `${meta.badgeClass} hover:scale-[1.02]`
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="opacity-70 text-[11px]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-8 max-w-xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666] w-4 h-4" />
          <input
            type="text"
            placeholder="Search 120+ styles (e.g. Captik Glow, Ali Abdaal, Big Reveal, Hormozi, MrBeast)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0E0E14] border border-[#222] focus:border-[#E60000] rounded-full pl-11 pr-5 py-3 text-[14px] text-white placeholder-[#555] outline-none shadow-xl transition-colors"
          />
        </div>
      </section>

      {/* Category Pills */}
      <section className="mx-auto max-w-7xl px-6 mb-12">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat;
            const isSignature = Boolean(SIGNATURE_PACKS[cat]);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#E60000] text-white shadow-[0_0_16px_rgba(230,0,0,0.45)] scale-[1.03]"
                    : isSignature
                    ? "bg-[#161622] text-[#DDD] border border-[#E60000]/40 hover:border-[#E60000] hover:text-white"
                    : "bg-[#0D0D12] text-[#777] border border-[#1C1C24] hover:text-white hover:border-[#333]"
                }`}
              >
                {isSignature && <span>{SIGNATURE_PACKS[cat]?.icon}</span>}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Templates Grid */}
      <section className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((t, i) => {
            const fg = t.patch.color ?? DEFAULT_CAP_STYLE.color;
            const bg = t.patch.bgOn ? (t.patch.bgColor ?? DEFAULT_CAP_STYLE.bgColor) : "#0D0D14";
            const fontFam = t.patch.fontFamily ?? DEFAULT_CAP_STYLE.fontFamily;
            const weight = t.patch.fontWeight ?? DEFAULT_CAP_STYLE.fontWeight;
            const textCase = t.patch.textCase === "upper" ? "uppercase" : "none";
            const activeColor = t.patch.activeWordColor ?? "#FFE600";
            const activeBg = t.patch.activeWordBgOn ? (t.patch.activeWordBgColor ?? "#E60000") : "transparent";
            const scale = t.patch.activeWordScale ?? 1.1;
            const hasGlow = t.patch.glowOn;

            const packKey =
              t.category === "Kinetic Motion" || t.name.toLowerCase().startsWith("kinetic ·") ? "Kinetic Motion" :
              t.category === "Shorts & Reels" || t.name.toLowerCase().startsWith("reels ·") ? "Shorts & Reels" :
              t.category === "Dynamic Pop" || t.name.toLowerCase().startsWith("dynamic ·") ? "Dynamic Pop" :
              t.category === "Desi Viral" || t.name.toLowerCase().startsWith("desi ·") ? "Desi Viral" :
              t.category === "Creator Pro" || t.name.toLowerCase().startsWith("creator ·") ? "Creator Pro" :
              t.category === "Popular" ? "Popular" :
              t.category === "Clean" ? "Clean" :
              t.category === "Bold & animated" ? "Bold & animated" :
              t.category === "Property reels" ? "Property reels" :
              null;
            const packInfo = packKey ? SIGNATURE_PACKS[packKey] : null;

            return (
              <div
                key={t.name + i}
                className="group relative bg-[#0B0B10] border border-[#1D1D26] hover:border-[#E60000]/50 rounded-[20px] overflow-hidden transition-all duration-300 shadow-xl flex flex-col justify-between cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(230,0,0,0.15)]"
                onClick={() => setPreviewTemplate(t)}
              >
                {/* Visual Live Karaoke Canvas */}
                <div
                  className="relative aspect-video w-full flex items-center justify-center p-4 overflow-hidden border-b border-[#1A1A22]"
                  style={{ background: bg }}
                >
                  {/* Subtle noise/grid in card */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0,transparent_70%)] pointer-events-none" />

                  {/* Badge */}
                  {t.isBehindYou ? (
                    <div className="absolute top-3 left-3 z-20">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-500 text-black shadow-md font-sans">
                        <span>👤</span>
                        <span>Behind you</span>
                      </span>
                    </div>
                  ) : packInfo ? (
                    <div className="absolute top-3 left-3 z-20">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${packInfo.badgeClass}`}>
                        <span>{packInfo.icon}</span>
                        <span>{packInfo.label}</span>
                      </span>
                    </div>
                  ) : null}

                  {/* Live Karaoke Animated Words */}
                  <div className="relative z-10 flex flex-wrap items-center justify-center gap-1.5 px-2 text-center">
                    {previewWords.map((word, wordIdx) => {
                      const isActive = wordIdx === activeWordIndex;
                      return (
                        <span
                          key={wordIdx}
                          style={{
                            fontFamily: fontFam,
                            fontWeight: weight,
                            textTransform: textCase,
                            color: isActive ? activeColor : fg,
                            background: isActive ? activeBg : "transparent",
                            transform: isActive ? `scale(${scale})` : "scale(1)",
                            textShadow: isActive && hasGlow ? `0 0 16px ${t.patch.glowColor || activeColor}` : "0 2px 6px rgba(0,0,0,0.9)",
                            display: "inline-block",
                            transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                            padding: isActive && t.patch.activeWordBgOn ? "2px 6px" : "0",
                            borderRadius: isActive && t.patch.activeWordBgOn ? "6px" : "0",
                          }}
                          className="text-[18px] sm:text-[20px] leading-tight"
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>

                  {/* Hover Overlay with Action Buttons */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-30 p-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTemplate(t);
                      }}
                      className="bg-white/20 hover:bg-white text-black hover:text-black font-bold px-3 py-2 rounded-xl text-[12px] transition-all flex items-center gap-1"
                    >
                      <Play size={13} fill="currentColor" /> Test 9:16
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        apply(t.name);
                      }}
                      className="bg-[#E60000] hover:bg-[#CC0000] text-white font-bold px-3.5 py-2 rounded-xl text-[12px] transition-all flex items-center gap-1 shadow-[0_0_12px_rgba(230,0,0,0.5)]"
                    >
                      Apply →
                    </button>
                  </div>
                </div>

                {/* Card Footer Details */}
                <div className="p-4 bg-[#0B0B10] flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-white leading-snug line-clamp-1 group-hover:line-clamp-none transition-all" title={t.name}>
                      {t.name}
                    </div>
                    <div className="text-[11px] text-[#777] font-medium mt-1 truncate">
                      {t.patch.transition ? `${t.patch.transition} animation` : "kinetic pop"} • {t.patch.fontFamily || "Inter"}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#E60000] shrink-0 bg-[#E60000]/10 px-2.5 py-0.5 rounded-full border border-[#E60000]/25 mt-0.5">
                    {t.category || "Viral"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 9:16 INTERACTIVE PREVIEW MODAL */}
      <AnimatePresence>
        {previewTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-[900px] bg-[#0E0E16] border border-[#262635] rounded-[28px] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] grid grid-cols-1 md:grid-cols-12 gap-6 p-6 sm:p-8 items-center"
            >
              {/* Close Button */}
              <button
                onClick={() => setPreviewTemplate(null)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-40"
              >
                <X size={18} />
              </button>

              {/* Left Column: Interactive 9:16 Phone Preview */}
              <div className="md:col-span-6 flex justify-center">
                <div className="relative w-[280px] sm:w-[300px] aspect-[9/18] bg-[#050508] rounded-[36px] p-2.5 border-[5px] border-[#252535] shadow-[0_0_50px_rgba(230,0,0,0.2)] overflow-hidden flex flex-col justify-between select-none">
                  {/* Dynamic Notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#14141E] rounded-full z-40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#E60000]/70 animate-pulse" />
                  </div>

                  {/* Gradient Background & Depth Silhouette */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#161622] via-[#0E0E16] to-[#08080C] z-0" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(230,0,0,0.2),transparent_70%)]" />

                  {/* Depth Subject (Silhouette) */}
                  <div className="absolute bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none">
                    <div className="relative w-[210px] h-[300px] flex items-end justify-center">
                      <svg viewBox="0 0 200 280" className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]">
                        <defs>
                          <linearGradient id="modalCreatorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2A2A38" />
                            <stop offset="100%" stopColor="#14141E" />
                          </linearGradient>
                        </defs>
                        <ellipse cx="100" cy="75" rx="34" ry="44" fill="url(#modalCreatorGrad)" stroke="#444" strokeWidth="1.5" />
                        <path d="M 86 115 L 86 140 L 114 140 L 114 115 Z" fill="url(#modalCreatorGrad)" />
                        <path d="M 35 280 L 45 160 C 50 138, 72 135, 100 135 C 128 135, 150 138, 155 160 L 165 280 Z" fill="url(#modalCreatorGrad)" stroke="#3a3a4c" strokeWidth="1.5" />
                      </svg>
                      {behindPerson && (
                        <div className="absolute top-8 right-2 bg-[#E60000] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(230,0,0,0.6)] flex items-center gap-1">
                          <Layers size={10} />
                          <span>3D DEPTH ACTIVE</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Animated Captions Layer (Behind or Front) */}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center px-4 pointer-events-none pb-20 ${behindPerson ? 'z-10' : 'z-30'}`}>
                    <div className="text-center">
                      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                        {modalWords.map((word, idx) => {
                          const isActive = idx === modalWordIdx;
                          const t = previewTemplate.patch;
                          return (
                            <span
                              key={idx}
                              style={{
                                fontFamily: t.fontFamily || DEFAULT_CAP_STYLE.fontFamily,
                                fontWeight: t.fontWeight || DEFAULT_CAP_STYLE.fontWeight,
                                textTransform: t.textCase === "upper" ? "uppercase" : "none",
                                color: isActive ? (t.activeWordColor || "#FFE600") : (t.color || "#FFFFFF"),
                                background: isActive && t.activeWordBgOn ? (t.activeWordBgColor || "#E60000") : "transparent",
                                transform: isActive ? `scale(${t.activeWordScale || 1.15})` : "scale(1)",
                                textShadow: isActive && t.glowOn ? `0 0 16px ${t.glowColor || "#FFE600"}` : "0 2px 8px rgba(0,0,0,0.9)",
                                display: "inline-block",
                                transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                                padding: isActive && t.activeWordBgOn ? "2px 6px" : "0",
                                borderRadius: isActive && t.activeWordBgOn ? "6px" : "0",
                              }}
                              className="text-[20px] sm:text-[22px] leading-tight"
                            >
                              {word}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Simulated Instagram Reel UI */}
                  <div className="absolute bottom-4 left-4 right-4 z-30 flex items-center justify-between text-white/80 text-[11px]">
                    <span className="font-bold">@yourcaptions.in</span>
                    <span className="bg-[#E60000] px-2 py-0.5 rounded text-white font-bold text-[10px]">Follow</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Customizer Controls */}
              <div className="md:col-span-6 flex flex-col gap-5">
                <div>
                  <div className="flex items-center gap-2 text-[#E60000] text-[12px] font-bold uppercase tracking-wider mb-1">
                    <Sparkles size={14} /> Live Style Sandbox
                  </div>
                  <h3 className="text-[24px] sm:text-[28px] font-extrabold text-white">
                    {previewTemplate.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[#888] text-[13px]">Category:</span>
                    <span className="text-white font-semibold text-[13px] bg-[#1A1A24] px-2.5 py-0.5 rounded-full border border-[#2A2A38]">
                      {previewTemplate.category || "Viral Pack"}
                    </span>
                    {(() => {
                      const packKey =
                        previewTemplate.category === "Kinetic Motion" || previewTemplate.name.toLowerCase().startsWith("kinetic ·") ? "Kinetic Motion" :
                        previewTemplate.category === "Shorts & Reels" || previewTemplate.name.toLowerCase().startsWith("reels ·") ? "Shorts & Reels" :
                        previewTemplate.category === "Dynamic Pop" || previewTemplate.name.toLowerCase().startsWith("dynamic ·") ? "Dynamic Pop" :
                        previewTemplate.category === "Desi Viral" || previewTemplate.name.toLowerCase().startsWith("desi ·") ? "Desi Viral" :
                        previewTemplate.category === "Creator Pro" || previewTemplate.name.toLowerCase().startsWith("creator ·") ? "Creator Pro" :
                        null;
                      const info = packKey ? SIGNATURE_PACKS[packKey] : null;
                      if (!info) return null;
                      return (
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${info.badgeClass}`}>
                          <span>{info.icon}</span>
                          <span>{info.label} Verified</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Custom Text Area */}
                <div>
                  <label className="block text-[13px] font-bold text-white mb-2">
                    Test with Your Script:
                  </label>
                  <textarea
                    rows={2}
                    value={customPreviewText}
                    onChange={(e) => setCustomPreviewText(e.target.value)}
                    className="w-full bg-[#08080C] border border-[#252535] focus:border-[#E60000] rounded-xl p-3 text-[13px] text-white outline-none resize-none font-inter transition-colors"
                  />
                </div>

                {/* 3D Depth Cutout Switch */}
                <div className="flex items-center justify-between p-3.5 bg-[#12121C] border border-[#222230] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <Layers size={18} className="text-[#E60000]" />
                    <div className="text-left">
                      <div className="text-[13px] font-bold text-white">Text Behind Subject</div>
                      <div className="text-[11px] text-[#666]">AI 3D Depth Cutout · Text Behind Subject</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setBehindPerson(!behindPerson)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors ${behindPerson ? 'bg-[#E60000]' : 'bg-[#2A2A38]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${behindPerson ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => apply(previewTemplate.name)}
                    className="flex-1 bg-[#E60000] hover:bg-[#CC0000] text-white font-bold py-3.5 rounded-xl text-[14px] shadow-[0_4px_20px_rgba(230,0,0,0.4)] transition-all flex items-center justify-center gap-2"
                  >
                    <span>Apply This Style to Video</span>
                    <ArrowRight size={15} />
                  </button>
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    className="px-4 py-3.5 rounded-xl bg-[#161622] hover:bg-[#202030] text-white font-semibold text-[13px] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
