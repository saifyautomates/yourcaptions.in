import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Menu, X, Play } from 'lucide-react';
import './HomePage.css';

import ParticleCanvas from '@/components/ParticleCanvas';
import LanguageTicker from '@/components/LanguageTicker';
import TestimonialGrid from '@/components/TestimonialGrid';
import PricingSection from '@/components/PricingSection';
import FounderLetter from '@/components/FounderLetter';

import { useMagnetic } from '@/hooks/useMagnetic';
import { useTilt } from '@/hooks/useTilt';
import { ScrollDownIndicator } from '@/components/public/ScrollDownIndicator';
import InteractiveLanguageDemo from '@/components/public/InteractiveLanguageDemo';
import { PublicNav } from '@/components/public/PublicNav';

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function MagneticButton({ children, className, ...props }: any) {
  const ref = useRef<HTMLButtonElement>(null);
  useMagnetic(ref);
  return (
    <button ref={ref} className={`magnetic-btn ${className}`} {...props}>
      {children}
    </button>
  );
}

function TiltCard({ children, className, ...props }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref);
  return (
    <div ref={ref} className={`tilt-card ${className}`} {...props}>
      {children}
    </div>
  );
}

export default function HomePage() {
  const [demoLanguage, setDemoLanguage] = useState('English');
  const [enhancedAudioActive, setEnhancedAudioActive] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="bg-[#050505] min-h-screen text-[#888] font-inter overflow-x-hidden selection:bg-[#E60000] selection:text-white">
      {/* NAVBAR */}
      <PublicNav />

      {/* SECTION 1 — HERO */}
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center pt-24 pb-16 px-6 overflow-hidden">
        <ParticleCanvas />
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-[1000px] mx-auto w-full">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-2 border border-[#2A2A2A] rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-[0.1em] text-[#888] uppercase mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E60000]" />
            Trusted by 10,000+ creators · 100+ Languages · 99.2% Accuracy
          </motion.div>

          <h1 className="hero-headline text-white font-extrabold flex flex-col items-center justify-center">
            <motion.span initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: [0.16,1,0.3,1] }}>Caption everything.</motion.span>
            <motion.span initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.25, ease: [0.16,1,0.3,1] }}>Reach <span className="font-dm-serif italic text-[#E60000] font-normal">everyone</span>.</motion.span>
            <motion.span initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4, ease: [0.16,1,0.3,1] }}>Miss nothing.</motion.span>
          </h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-6 text-[15px] md:text-[18px] text-[#888] max-w-[540px] leading-[1.65]"
          >
            The AI caption studio built for creators who speak every language. Frame-accurate timing. Native-quality dubbing. Minutes, not days.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55 }}
            className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Link to="/signup" className="w-full sm:w-auto">
              <MagneticButton className="w-full sm:w-auto bg-[#E60000] text-white font-bold text-[16px] px-8 py-4 rounded-[10px] hover:bg-[#CC0000] transition-colors hover:-translate-y-[2px] shadow-[0_4px_14px_rgba(230,0,0,0.3)]">
                Start captioning free →
              </MagneticButton>
            </Link>
            <button className="w-full sm:w-auto bg-transparent text-[#888] font-medium text-[16px] px-5 py-4 hover:text-white transition-colors flex items-center justify-center gap-2" data-cursor="hover">
              <Play fill="currentColor" size={16} /> Watch 60s demo
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.65 }}
            className="mt-12 grid grid-cols-2 sm:flex sm:flex-row items-center justify-center gap-6 sm:gap-8"
          >
            <div className="flex flex-col items-center"><span className="text-white font-bold text-[22px]">10,000+</span><span className="text-[13px] text-[#555]">creators</span></div>
            <div className="hidden sm:block w-px h-10 bg-[#1F1F1F]" />
            <div className="flex flex-col items-center"><span className="text-white font-bold text-[22px]">99.2%</span><span className="text-[13px] text-[#E60000] font-semibold">accuracy</span></div>
            <div className="hidden sm:block w-px h-10 bg-[#1F1F1F]" />
            <div className="flex flex-col items-center"><span className="text-white font-bold text-[22px]">100+</span><span className="text-[13px] text-[#555]">languages</span></div>
            <div className="hidden sm:block w-px h-10 bg-[#1F1F1F]" />
            <div className="flex flex-col items-center"><span className="text-white font-bold text-[22px]">&lt; 2 min</span><span className="text-[13px] text-[#555]">turnaround</span></div>
          </motion.div>
        </div>

        <InteractiveLanguageDemo />

        <ScrollDownIndicator />
      </section>

      {/* SECTION 2 — SOCIAL PROOF BAR */}
      <section className="h-auto py-4 md:h-[72px] md:py-0 bg-[#0D0D0D] border-y border-[#1F1F1F] flex items-center">
        <div className="max-w-[1440px] w-full mx-auto px-6 overflow-x-auto snap-x no-scrollbar">
          <div className="flex items-center justify-between min-w-max md:min-w-0">
            {[
              { n: "10,000+", l: "Creators" },
              { n: "99.2%", l: "Accuracy" },
              { n: "100+", l: "Languages" },
              { n: "4.9 ★", l: "Rating" },
              { n: "< 2 min", l: "Turnaround" },
              { n: "Free to start", l: "No card needed" }
            ].map((stat, i) => (
              <React.Fragment key={stat.n}>
                <div className="flex flex-col items-center px-6 sm:px-8 snap-center">
                  <div className="text-[18px] font-bold text-white leading-none">{stat.n}</div>
                  <div className="text-[12px] text-[#555] mt-1">{stat.l}</div>
                </div>
                {i < 5 && <div className="w-px h-8 bg-[#1F1F1F] hidden md:block" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — LANGUAGE GRID */}
      <section className="py-[80px] md:py-[140px] bg-[#050505]">
        <div className="max-w-[1440px] mx-auto text-center px-6">
          <Reveal>
            <div className="section-label">WE SPEAK YOUR LANGUAGE</div>
            <h2 className="section-headline text-white mt-4">
              Hindi. Urdu. Arabic.<br />English. And <span className="font-dm-serif italic text-[#E60000] font-normal">97 more</span>.
            </h2>
            <p className="mt-6 text-[18px] text-[#888] max-w-[600px] mx-auto">
              Native accuracy in every language. Auto-detected. No setup needed.
            </p>
          </Reveal>
        </div>

        <div className="mt-[80px]">
          <LanguageTicker />
        </div>

        <div className="max-w-[1200px] mx-auto px-6 mt-[60px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Reveal delay={0.1}>
              <TiltCard className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-[16px] p-8 hover:border-[#E60000]/30 transition-colors relative overflow-hidden group">
                <div className="spotlight" />
                <div className="text-[56px] font-extrabold text-white leading-none">100+</div>
                <div className="text-[14px] text-[#888] mt-2 font-medium">Languages supported</div>
              </TiltCard>
            </Reveal>
            <Reveal delay={0.2}>
              <TiltCard className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-[16px] p-8 hover:border-[#E60000]/30 transition-colors relative overflow-hidden group">
                <div className="spotlight" />
                <div className="text-[56px] font-extrabold text-white leading-none">99.2%</div>
                <div className="text-[14px] text-[#888] mt-2 font-medium">Transcription accuracy</div>
              </TiltCard>
            </Reveal>
            <Reveal delay={0.3}>
              <TiltCard className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-[16px] p-8 hover:border-[#E60000]/30 transition-colors relative overflow-hidden group">
                <div className="spotlight" />
                <div className="text-[56px] font-extrabold text-white leading-none">30+</div>
                <div className="text-[14px] text-[#888] mt-2 font-medium">Indian languages</div>
              </TiltCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SECTION 5 — HOW IT WORKS */}
      <section className="py-[80px] md:py-[140px] bg-[#0D0D0D] border-t border-[#1F1F1F]">
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <div className="text-center">
              <div className="section-label">HOW IT WORKS</div>
              <h2 className="section-headline text-white mt-4">
                Upload. Caption. Export.<br />Done in 2 <span className="font-dm-serif italic text-[#E60000] font-normal">minutes</span>.
              </h2>
            </div>
          </Reveal>

          <div className="mt-20 relative">
            <div className="hidden md:block absolute top-[120px] left-[15%] right-[15%] h-[2px] border-t-2 border-dashed border-[#E60000]/20 z-0" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {[
                { n: "1", t: "Upload your video", d: "MP4, MOV, WebM — any format. Up to 30 minutes." },
                { n: "2", t: "AI captions in 2 min", d: "Word-perfect timing in 100+ languages. Auto-detected." },
                { n: "3", t: "Style, edit & export", d: "Customize font & styles, burn captions, export in 1 click." }
              ].map((step, i) => (
                <Reveal key={i} delay={i * 0.15}>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-[16px] p-8 hover:border-[#E60000]/20 transition-colors flex flex-col h-full relative group">
                    <div className="absolute top-0 right-8 -translate-y-1/2 md:translate-y-0 md:-top-10 text-[80px] font-black text-[#1A1A1A] group-hover:text-[#1F1F1F] transition-colors leading-none">{step.n}</div>
                    <div className="mt-auto">
                      <div className="text-[24px] font-bold text-white mb-3">{step.t}</div>
                      <div className="text-[15px] text-[#888] leading-relaxed">{step.d}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — FEATURE DEEP DIVE */}
      <section id="features" className="py-[80px] md:py-[120px] bg-[#050505]">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col gap-[80px]">
          {[
            {
              n: "01",
              t: "Instant Transcription",
              d: "Upload any video. Get word-perfect captions in under 2 minutes. 100+ languages auto-detected.",
              m: "⚡ 2 min avg",
              rev: false,
              visual: (
                <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-[#12121A] to-[#0A0A0E] text-left">
                  <div className="flex items-center justify-between border-b border-[#222] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E60000] animate-pulse" />
                      <span className="text-[12px] font-bold text-white tracking-wide">AI Speech-to-Text Engine</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded-full border border-[#00E5FF]/30">
                      99.8% Accuracy
                    </span>
                  </div>

                  {/* Audio Waveform Spikes */}
                  <div className="my-4 flex items-end justify-between gap-1 h-14 px-2 bg-[#09090D] rounded-xl border border-[#1C1C26] p-2">
                    {[35, 60, 45, 85, 95, 40, 70, 100, 65, 80, 50, 90, 75, 40, 95, 60, 85, 30, 70, 90, 100, 55, 75, 95, 40, 85, 65, 50].map((h, i) => (
                      <div
                        key={i}
                        className={`w-full rounded-full transition-all duration-300 ${
                          i >= 7 && i <= 16
                            ? "bg-gradient-to-t from-[#E60000] to-[#FF4D4D] shadow-[0_0_8px_rgba(230,0,0,0.6)]"
                            : "bg-[#2A2A38]"
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>

                  {/* Live Stream Tokens */}
                  <div className="space-y-2 bg-[#0E0E16] rounded-xl p-3 border border-[#222]">
                    <div className="flex items-center justify-between text-[11px] text-[#666]">
                      <span className="font-mono text-[#888]">TIMECODE 00:01:24.40</span>
                      <span className="text-emerald-400 font-semibold">● Hinglish Auto-Detected</span>
                    </div>
                    <div className="text-[14px] font-medium text-white leading-relaxed">
                      Yeh viral hook aapki video retention ko{" "}
                      <span className="bg-[#E60000] text-white px-2 py-0.5 rounded-md font-bold text-[15px] shadow-[0_0_12px_rgba(230,0,0,0.6)] inline-block scale-105">
                        4X BOOST
                      </span>{" "}
                      kar dega instantly 🚀
                    </div>
                  </div>
                </div>
              ),
            },
            {
              n: "02",
              t: "Visual Caption Editor",
              d: "Style every word. Drag to position. See changes live on canvas. Ghost effects, keyword highlights, RTL.",
              m: "🎨 Fully customizable",
              rev: true,
              visual: (
                <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-[#12121A] to-[#0A0A0E] text-left">
                  <div className="flex items-center justify-between border-b border-[#222] pb-3">
                    <span className="text-[12px] font-bold text-white tracking-wide">Live Kinetic Canvas</span>
                    <span className="text-[11px] font-semibold text-[#FFE600] bg-[#FFE600]/10 px-2 py-0.5 rounded-full border border-[#FFE600]/30">
                      Real-time 60fps
                    </span>
                  </div>

                  {/* Live Caption Render Box */}
                  <div className="relative my-3 h-28 rounded-xl bg-black border border-[#222] flex flex-col items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(230,0,0,0.15)_0,transparent_70%)]" />
                    <div className="relative z-10 text-center">
                      <div className="text-[24px] font-black tracking-tight text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                        EXPLODE YOUR{" "}
                        <span className="text-[#FFE600] underline decoration-[#E60000] decoration-wavy decoration-2 drop-shadow-[0_0_15px_rgba(255,230,0,0.6)]">
                          VIRALITY
                        </span>
                      </div>
                      <div className="text-[11px] text-[#888] font-mono mt-1">Font: Montserrat Black • Active: Glow Pop</div>
                    </div>
                  </div>

                  {/* Inspector Tool Chips */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#14141E] border border-[#262638] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-[#777] uppercase font-bold">Highlight</div>
                      <div className="text-[12px] text-white font-bold flex items-center justify-center gap-1 mt-0.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFE600]" /> Yellow Pop
                      </div>
                    </div>
                    <div className="bg-[#14141E] border border-[#262638] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-[#777] uppercase font-bold">Animation</div>
                      <div className="text-[12px] text-emerald-400 font-bold mt-0.5">3D Kinetic</div>
                    </div>
                    <div className="bg-[#14141E] border border-[#262638] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-[#777] uppercase font-bold">Depth Cutout</div>
                      <div className="text-[12px] text-[#00E5FF] font-bold mt-0.5">Behind Person</div>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              n: "03",
              t: "AI Voice Dubbing",
              d: "Clone any voice. Translate to any language. Sounds completely human.",
              m: "🗣️ 100+ voices",
              rev: false,
              visual: (
                <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-[#12121A] to-[#0A0A0E] text-left">
                  <div className="flex items-center justify-between border-b border-[#222] pb-3">
                    <span className="text-[12px] font-bold text-white tracking-wide">Neural Multi-Language Dub</span>
                    <span className="text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">
                      Zero Lip Lag
                    </span>
                  </div>

                  {/* Multi-language voice chips */}
                  <div className="space-y-2 my-2">
                    {[
                      { lang: "Original Voice (English)", pitch: "100% Match", flag: "🇺🇸", active: true },
                      { lang: "AI Dubbed: Hindi (Bollywood)", pitch: "Native Tone", flag: "🇮🇳", active: true },
                      { lang: "AI Dubbed: Spanish (Castilian)", pitch: "Ultra Crisp", flag: "🇪🇸", active: false },
                    ].map((v, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-xl border ${
                          idx === 1
                            ? "bg-[#E60000]/10 border-[#E60000]/40 text-white"
                            : "bg-[#0E0E14] border-[#1F1F2A] text-[#888]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[16px]">{v.flag}</span>
                          <span className="text-[12px] font-semibold">{v.lang}</span>
                        </div>
                        <span className="text-[11px] font-mono text-[#00E5FF]">{v.pitch}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#666] pt-1">
                    <span>Natural emotion &amp; breath retention</span>
                    <span className="text-[#E60000] font-bold">100+ Voices</span>
                  </div>
                </div>
              ),
            },
            {
              n: "04",
              t: "One-Click Export",
              d: "Burn captions into video. Export MP4, SRT, VTT, TXT. 4K supported on Pro plans.",
              m: "🎬 4K support",
              rev: true,
              visual: (
                <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-[#12121A] to-[#0A0A0E] text-left">
                  <div className="flex items-center justify-between border-b border-[#222] pb-3">
                    <span className="text-[12px] font-bold text-white tracking-wide">Multi-Format Render Hub</span>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Hardware Accelerated
                    </span>
                  </div>

                  {/* Format Pills Grid */}
                  <div className="grid grid-cols-2 gap-2 my-2">
                    <div className="p-2.5 rounded-xl bg-[#E60000]/15 border border-[#E60000]/50 text-white">
                      <div className="text-[11px] text-[#E60000] font-bold">BURNT-IN MP4</div>
                      <div className="text-[13px] font-bold mt-0.5">4K Ultra HDR 60fps</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#14141E] border border-[#222] text-[#AAA]">
                      <div className="text-[11px] text-[#666] font-bold">TIMECODED SRT</div>
                      <div className="text-[13px] font-medium mt-0.5">Word-Level Sync</div>
                    </div>
                  </div>

                  {/* Render progress bar */}
                  <div className="bg-[#0E0E16] p-3 rounded-xl border border-[#222] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white font-semibold">Ready to post to Reels &amp; Shorts</span>
                      <span className="text-emerald-400 font-mono font-bold">100% Done</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#1A1A26] overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-r from-[#E60000] via-[#FF4D4D] to-emerald-400" />
                    </div>
                  </div>
                </div>
              ),
            }
          ].map((f, i) => (
            <div key={i} className={`flex flex-col ${f.rev ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12`}>
              <Reveal className="flex-1" delay={0.1}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#E60000]/10 text-[#E60000] flex items-center justify-center text-[12px] font-bold">{f.n}</div>
                  <div className="px-3 py-1 rounded-full border border-[#2A2A2A] text-[12px] text-[#888] font-medium">{f.m}</div>
                </div>
                <h3 className="text-[32px] md:text-[40px] font-bold text-white leading-tight mb-4">{f.t}</h3>
                <p className="text-[17px] text-[#888] leading-[1.6]">{f.d}</p>
              </Reveal>
              <Reveal className="flex-1 w-full" delay={0.2}>
                <div className="aspect-[4/3] bg-[#0D0D0D] border border-[#1F1F1F] rounded-[20px] shadow-[0_0_80px_rgba(230,0,0,0.08)] w-full flex items-center justify-center overflow-hidden">
                  {f.visual}
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 7 — AUDIO ENHANCEMENT */}
      <section className="py-[80px] md:py-[140px] bg-[#0D0D0D] border-t border-[#1F1F1F]">
        <div className="max-w-[1000px] mx-auto px-6 text-center">
          <Reveal>
            <div className="section-label">AI AUDIO ENHANCEMENT</div>
            <h2 className="section-headline text-white mt-4">
              Studio quality audio.<br />From any <span className="font-dm-serif italic text-[#E60000] font-normal">recording</span>.
            </h2>
            <p className="mt-6 text-[18px] text-[#888] max-w-[600px] mx-auto">
              Remove background noise, enhance voice clarity, normalize levels — automatically.
            </p>
          </Reveal>

          <Reveal delay={0.2} className="mt-16">
            <div className="bg-[#050505] border border-[#1F1F1F] rounded-[20px] p-8 max-w-[800px] mx-auto">
              <div className="flex flex-col gap-6">
                <div className={`h-24 rounded-xl flex items-center justify-center border transition-all duration-300 relative overflow-hidden ${
                  !enhancedAudioActive ? "bg-[#181111] border-[#E60000]/60 ring-2 ring-[#E60000]/30" : "bg-[#0D0D0D] border-[#1F1F1F] opacity-60"
                }`}>
                   <div className="absolute left-4 top-4 text-[12px] font-bold text-[#888] flex items-center gap-1.5">
                     <span>RAW AUDIO (NOISE &amp; ECHO)</span>
                     {!enhancedAudioActive && <span className="bg-[#E60000] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">PLAYING</span>}
                   </div>
                   <div className="w-[85%] h-[45%] flex items-center justify-center gap-1">
                     {Array.from({ length: 36 }).map((_, i) => (
                       <div key={i} className="w-1.5 bg-[#666]/40 rounded-full" style={{ height: `${20 + Math.sin(i * 1.3) * 60 + (i % 3) * 20}%` }} />
                     ))}
                   </div>
                </div>
                <div className={`h-24 rounded-xl flex items-center justify-center border transition-all duration-300 relative overflow-hidden ${
                  enhancedAudioActive ? "bg-[#0A1A12] border-emerald-500/60 ring-2 ring-emerald-500/30" : "bg-[#0D0D0D] border-[#1F1F1F] opacity-60"
                }`}>
                   <div className="absolute left-4 top-4 text-[12px] font-bold text-white flex items-center gap-1.5">
                     <span>ENHANCED AUDIO (STUDIO CLARITY)</span>
                     {enhancedAudioActive && <span className="bg-emerald-500 text-black text-[10px] px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
                   </div>
                   <div className="w-[85%] h-[35%] flex items-center justify-center gap-1">
                     {Array.from({ length: 36 }).map((_, i) => (
                       <div key={i} className="w-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" style={{ height: `${15 + Math.sin(i * 0.4) * 75}%` }} />
                     ))}
                   </div>
                </div>
              </div>
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setEnhancedAudioActive(!enhancedAudioActive)}
                  className="bg-white text-black hover:bg-[#E60000] hover:text-white px-7 py-3 rounded-full font-bold text-[14px] flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
                  data-cursor="hover"
                >
                  {enhancedAudioActive ? "Switch to Raw Audio" : "Switch to Enhanced Studio Audio"}
                </button>
              </div>
            </div>
            
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {['🎙 Noise Removal', '🔊 Voice Enhancement', '📊 Auto Normalize'].map((p, i) => (
                <div key={i} className="bg-[#141414] border border-[#1F1F1F] px-5 py-2.5 rounded-full text-[14px] font-medium text-white">
                  {p}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 8 — CREATOR TESTIMONIALS */}
      <section className="py-[80px] md:py-[140px] bg-[#050505]">
        <div className="max-w-[1440px] mx-auto px-6">
          <Reveal className="text-center mb-[80px]">
            <div className="section-label">WALL OF LOVE</div>
            <h2 className="section-headline text-white mt-4">
              10,000 creators.<br />All <span className="font-dm-serif italic text-[#E60000] font-normal">saying the same thing</span>.
            </h2>
          </Reveal>
          <TestimonialGrid />
        </div>
      </section>

      {/* SECTION 9 — PRICING */}
      <section id="pricing" className="py-[80px] md:py-[140px] bg-[#050505]">
        <PricingSection />
      </section>

      {/* SECTION 10 — FOUNDER STORY */}
      <section id="about" className="py-[80px] md:py-[120px] bg-[#0D0D0D] border-t border-[#1F1F1F]">
        <FounderLetter />
      </section>

      {/* SECTION 11 — COMING SOON */}
      <section className="py-[80px] md:py-[120px] bg-[#050505]">
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal className="text-center mb-[80px]">
            <div className="section-label">WHAT'S COMING</div>
            <h2 className="section-headline text-white mt-4">
              This is just<br />the <span className="font-dm-serif italic text-[#E60000] font-normal">beginning</span>.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { i: "🎭", t: "AI Avatar Generation", d: "Generate a photorealistic avatar. Give it your script. It speaks." },
              { i: "🎬", t: "AI Video Generation", d: "Text to video. Describe your scene. Watch it render." },
              { i: "🗣️", t: "Real-Time Voice Clone", d: "10 seconds of your voice. Clone it. Use it anywhere." }
            ].map((c, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <TiltCard className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-[20px] p-10 hover:shadow-[0_0_40px_rgba(230,0,0,0.1)] transition-shadow">
                  <div className="w-12 h-12 rounded-full bg-[#E60000]/10 flex items-center justify-center text-[24px] mb-8">{c.i}</div>
                  <div className="inline-block border border-[#E60000] text-[#E60000] text-[12px] font-bold uppercase px-3 py-1 rounded-full mb-4">COMING SOON</div>
                  <h3 className="text-[22px] font-bold text-white mb-3">{c.t}</h3>
                  <p className="text-[15px] text-[#888] leading-relaxed">{c.d}</p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 12 — FINAL CTA */}
      <section className="py-[120px] md:py-[200px] bg-[#050505] relative overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_50%,rgba(230,0,0,0.04),transparent)] pointer-events-none" />
        <Reveal className="text-center relative z-10 px-6">
          <h2 className="text-[clamp(48px,7vw,120px)] font-extrabold text-white tracking-[-0.04em] leading-[0.9]">
            Your first caption<br />is <span className="font-dm-serif italic text-[#E60000] font-normal">free</span>.
          </h2>
          <div className="mt-[80px]">
            <Link to="/signup">
              <MagneticButton className="bg-[#E60000] text-white font-bold text-[18px] px-12 py-5 rounded-[10px] hover:bg-[#CC0000] transition-transform hover:-translate-y-[3px]">
                Start captioning now →
              </MagneticButton>
            </Link>
          </div>
          <p className="mt-[40px] text-[14px] text-[#555]">
            No credit card required · Cancel anytime · Free forever plan available
          </p>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0D0D0D] border-t border-[#1F1F1F] pt-16 pb-10 px-6">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-[8px] sm:rounded-[10px] border border-white/20 bg-[#050505] flex items-center justify-center shadow-[0_0_15px_rgba(230,0,0,0.5)] overflow-hidden shrink-0">
                   <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50"></div>
                   <span className="text-white font-black text-[18px] sm:text-[22px] leading-none absolute left-[4px] sm:left-[5px] z-10 font-inter tracking-tighter">Y</span>
                   <span className="text-[#E60000] font-black text-[18px] sm:text-[22px] leading-none absolute left-[12px] sm:left-[15px] font-inter z-0">C</span>
                   <div className="absolute right-[3px] sm:right-[4px] top-[10px] sm:top-[14px] flex flex-col gap-[2px] sm:gap-[3px] items-start z-10">
                     <div className="w-[8px] sm:w-[10px] h-[1.5px] sm:h-[2px] bg-white rounded-full"></div>
                     <div className="w-[11px] sm:w-[14px] h-[1.5px] sm:h-[2px] bg-white rounded-full"></div>
                     <div className="flex items-center gap-[1.5px] sm:gap-[2px]">
                       <div className="w-[6px] sm:w-[8px] h-[1.5px] sm:h-[2px] bg-white rounded-full"></div>
                       <div className="w-[3px] sm:w-1 h-[3px] sm:h-1 bg-[#E60000] rounded-full"></div>
                     </div>
                   </div>
                </div>
                <div className="flex items-center">
                  <span className="font-inter font-bold text-[18px] sm:text-[20px] tracking-tight text-white">Your</span>
                  <span className="font-inter font-bold text-[18px] sm:text-[20px] tracking-tight text-[#E60000]">captions</span>
                  <span className="font-inter font-bold text-[18px] sm:text-[20px] tracking-tight text-white">.in</span>
                </div>
              </div>
              <p className="text-[#888] text-[14px] mb-6">The AI caption studio for every creator.</p>
              <div className="flex gap-3">
                {[
                  { name: 'Twitter', icon: 'X', href: 'https://twitter.com' },
                  { name: 'Instagram', icon: 'IG', href: 'https://instagram.com' },
                  { name: 'YouTube', icon: 'YT', href: 'https://youtube.com' },
                ].map(s => (
                  <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#141414] border border-[#222] flex items-center justify-center text-[#888] hover:text-white hover:border-[#E60000]/40 transition-all" data-cursor="hover" title={s.name}>
                    <span className="text-[11px] font-bold">{s.icon}</span>
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-[15px] mb-6">Product</h4>
              <ul className="flex flex-col gap-4">
                {[
                  { name: 'Features', href: '/features' },
                  { name: 'Pricing', href: '/pricing' },
                  { name: 'Try Demo', href: '#playground' },
                ].map(l => (
                  <li key={l.name}><Link to={l.href} className="text-[14px] text-[#888] hover:text-white transition-colors">{l.name}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-[15px] mb-6">Company</h4>
              <ul className="flex flex-col gap-4">
                {[
                  { name: 'About Us', href: '/about' },
                  { name: 'Blog', href: '/blog' },
                  { name: 'Contact', href: '/contact' },
                  { name: 'Privacy Policy', href: '/privacy' },
                  { name: 'Terms of Service', href: '/terms' },
                ].map(l => (
                  <li key={l.name}><Link to={l.href} className="text-[14px] text-[#888] hover:text-white transition-colors">{l.name}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[#1F1F1F] flex flex-col md:flex-row items-center justify-between gap-4 text-[13px]">
            <div className="text-[#555]">© {new Date().getFullYear()} Yourcaptions.in. All rights reserved.</div>
            <div className="text-[#444]">Crafted with <span className="text-[#E60000]">♥</span> for 10,000+ creators worldwide</div>
            <div className="flex gap-6 text-[#777]">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
