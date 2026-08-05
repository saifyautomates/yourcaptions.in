import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Menu, X, Play } from 'lucide-react';
import { CAP_PRESETS } from "@/lib/captionStyle";
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
            Trusted by 10,000+ creators · 100+ languages · Free to start
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
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8"
          >
            <div className="flex flex-col items-center"><span className="text-white font-bold text-[22px]">10,000+</span><span className="text-[13px] text-[#555]">creators</span></div>
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
      <section className="h-[72px] bg-[#0D0D0D] border-y border-[#1F1F1F] flex items-center">
        <div className="max-w-[1440px] w-full mx-auto px-6 overflow-x-auto snap-x no-scrollbar">
          <div className="flex items-center justify-between min-w-max md:min-w-0">
            {[
              { n: "10,000+", l: "Creators" },
              { n: "100+", l: "Languages" },
              { n: "4.9 ★", l: "Rating" },
              { n: "< 2 min", l: "Turnaround" },
              { n: "Free to start", l: "No card needed" }
            ].map((stat, i) => (
              <React.Fragment key={stat.n}>
                <div className="flex flex-col items-center px-8 snap-center">
                  <div className="text-[18px] font-bold text-white leading-none">{stat.n}</div>
                  <div className="text-[12px] text-[#555] mt-1">{stat.l}</div>
                </div>
                {i < 4 && <div className="w-px h-8 bg-[#1F1F1F] hidden md:block" />}
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

      {/* SECTION 4 — TEMPLATE SHOWCASE */}
      <section id="templates" className="py-[80px] md:py-[140px] bg-[#050505]">
        <div className="max-w-[1440px] mx-auto text-center px-6">
          <Reveal>
            <div className="section-label">CAPTION TEMPLATES</div>
            <h2 className="section-headline text-white mt-4">
              Styles used by<br />the <span className="font-dm-serif italic text-[#E60000] font-normal">biggest</span> creators.
            </h2>
            <p className="mt-6 text-[18px] text-[#888] max-w-[600px] mx-auto">
              {CAP_PRESETS.length}+ curated templates. One click to apply. Fully customizable.
            </p>
          </Reveal>
        </div>

        <div className="mt-[60px] w-full overflow-hidden px-6">
          <div className="max-w-[1440px] mx-auto overflow-x-auto snap-x no-scrollbar pb-8">
            <div className="flex md:grid md:grid-cols-5 gap-6 min-w-max md:min-w-0">
              {[
                { n: "Hormozi Style", c: "High Impact", s: "HORMOZI" },
                { n: "MrBeast Style", c: "Gaming / Viral", s: "MRBEAST" },
                { n: "Minimal Clean", c: "Corporate", s: "MINIMAL" },
                { n: "Desi Bold", c: "Regional", s: "देसी" },
                { n: "News Ticker", c: "Information", s: "NEWS" }
              ].map((tpl, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <TiltCard className="w-[280px] md:w-auto bg-[#0D0D0D] border border-[#1F1F1F] rounded-[16px] overflow-hidden snap-center group relative cursor-pointer">
                    <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-[#050505] opacity-50 group-hover:opacity-30 transition-opacity" />
                      <div className="text-white text-2xl font-black relative z-10 transition-transform duration-500 group-hover:scale-105">{tpl.s}</div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                        <div className="bg-[#E60000] text-white text-[13px] font-bold px-4 py-2 rounded-full">Apply →</div>
                      </div>
                    </div>
                    <div className="p-4 bg-[#0D0D0D] border-t border-[#1F1F1F] relative z-30">
                      <div className="text-[15px] font-semibold text-white">{tpl.n}</div>
                      <div className="text-[12px] text-[#E60000] font-medium mt-1">{tpl.c}</div>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="text-center mt-4">
            <Link to="/templates" className="text-[#E60000] text-[15px] font-semibold hover:underline" data-cursor="hover">
              See all {CAP_PRESETS.length}+ templates →
            </Link>
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
                { n: "3", t: "Style, edit & export", d: "Apply templates, burn captions, export in 1 click." }
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
              rev: false
            },
            {
              n: "02",
              t: "Visual Caption Editor",
              d: "Style every word. Drag to position. See changes live on canvas. Ghost effects, keyword highlights, RTL.",
              m: `🎨 ${CAP_PRESETS.length}+ styles`,
              rev: true
            },
            {
              n: "03",
              t: "AI Voice Dubbing",
              d: "Clone any voice. Translate to any language. Sounds completely human.",
              m: "🗣️ 100+ voices",
              rev: false
            },
            {
              n: "04",
              t: "One-Click Export",
              d: "Burn captions into video. Export MP4, SRT, VTT, TXT. 4K supported on Pro plans.",
              m: "🎬 4K support",
              rev: true
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
                <div className="aspect-[4/3] bg-[#0D0D0D] border border-[#1F1F1F] rounded-[20px] shadow-[0_0_80px_rgba(230,0,0,0.05)] w-full flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full opacity-50 bg-[radial-gradient(circle_at_center,rgba(230,0,0,0.1)_0,transparent_60%)]" />
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
                <div className="h-24 bg-[#0D0D0D] rounded-xl flex items-center justify-center border border-[#1F1F1F] relative overflow-hidden">
                   <div className="absolute left-4 top-4 text-[12px] font-bold text-[#555]">RAW AUDIO</div>
                   <div className="w-[80%] h-[40%] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxwYXRoIGQ9Ik0wIDUwaDEwbDVcLTUwbDVcMTAwbDVcLTUwbDEwdjAiIHN0cm9rZT0icmdiYSgyMzAsMCwwLDAuMikiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==')] opacity-50 bg-repeat-x" />
                </div>
                <div className="h-24 bg-[#0D0D0D] rounded-xl flex items-center justify-center border border-[#1F1F1F] relative overflow-hidden">
                   <div className="absolute left-4 top-4 text-[12px] font-bold text-white">ENHANCED AUDIO</div>
                   <div className="w-[80%] h-[20%] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxwYXRoIGQ9Ik0wIDUwaDEwMHYwIiBzdHJva2U9IiNmZmYiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==')] opacity-80 bg-repeat-x" />
                </div>
              </div>
              <div className="mt-8 flex justify-center">
                <button className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-[14px] flex items-center gap-2 hover:scale-105 transition-transform" data-cursor="hover">
                  Toggle to hear the difference
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
              <div className="flex gap-4">
                {['Twitter', 'Instagram', 'Youtube'].map(s => (
                  <a key={s} href="#" className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-white transition-colors" data-cursor="hover">
                    <span className="text-[12px]">{s[0]}</span>
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-[15px] mb-6">Product</h4>
              <ul className="flex flex-col gap-4">
                {['Features', 'Pricing', 'Templates', 'Changelog'].map(l => (
                  <li key={l}><Link to="#" className="text-[14px] text-[#888] hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-[15px] mb-6">Company</h4>
              <ul className="flex flex-col gap-4">
                {['About', 'Blog', 'Contact', 'Privacy', 'Terms'].map(l => (
                  <li key={l}><Link to="#" className="text-[14px] text-[#888] hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[#1F1F1F] flex flex-col md:flex-row items-center justify-between gap-4 text-[13px]">
            <div className="text-[#555]">© 2025 Yourcaptions.in</div>
            <div className="text-[#333]">Made with ♥ for creators</div>
            <div className="flex gap-4 text-[#555]">
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
