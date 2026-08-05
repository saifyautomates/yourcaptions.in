import React, { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTilt } from '@/hooks/useTilt';
import { useMagnetic } from '@/hooks/useMagnetic';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlanPricing } from '@/hooks/usePlanPricing';

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

function TiltCard({ children, className, ...props }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref);
  return (
    <div ref={ref} className={`tilt-card ${className}`} {...props}>
      {children}
    </div>
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

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(true);
  const { data: pricingData } = usePlanPricing('INR');
  
  const getPlanPrice = (plan: string) => {
    const p = pricingData?.find(d => d.plan === plan);
    if (!p) return null;
    return isYearly ? p.yearly_price : p.monthly_price;
  };

  const getPlanOriginalYearly = (plan: string) => {
    const p = pricingData?.find(d => d.plan === plan);
    return p?.original_yearly;
  };

  const faqs = [
    { q: "What counts as a transcription hour?", a: "Every minute of video you transcribe counts toward your monthly limit. A 5-minute video = 5 minutes used." },
    { q: "Can I upgrade or downgrade anytime?", a: "Yes — changes take effect immediately. Unused credits carry over for the billing cycle." },
    { q: "Is 18% GST included in the price shown?", a: "No — GST is added at checkout for Indian users only." },
    { q: "What happens when I run out of transcription hours?", a: "You can buy add-on hours from the billing page, or upgrade your plan." },
    { q: "Do unused credits roll over to next month?", a: "Monthly plan credits reset on your billing date. Top-up credits never expire." }
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="max-w-[1200px] mx-auto px-6">
      <Reveal className="text-center mb-16">
        <div className="section-label">PRICING</div>
        <h2 className="section-headline text-white mt-4">
          Start free.<br />Scale as you <span className="font-dm-serif italic text-[#E60000] font-normal">grow</span>.
        </h2>
      </Reveal>

      <Reveal delay={0.1} className="flex justify-center mb-16 relative">
        <div className="relative">
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-full p-1 flex">
            <button 
              className={`px-8 py-3 rounded-full text-[15px] font-medium transition-colors ${!isYearly ? 'bg-[#1F1F1F] text-white' : 'text-[#888] hover:text-white'}`}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </button>
            <button 
              className={`px-8 py-3 rounded-full text-[15px] font-medium transition-colors ${isYearly ? 'bg-[#1F1F1F] text-white' : 'text-[#888] hover:text-white'}`}
              onClick={() => setIsYearly(true)}
            >
              Yearly
            </button>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-[120px] items-stretch">
                <Reveal delay={0.1} className="h-full">
          <TiltCard className="h-full bg-[#0D0D0D] border border-[#1F1F1F] rounded-[24px] p-8 flex flex-col group relative overflow-hidden">
            <div className="spotlight" />
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[24px] mb-6 relative z-10">○</div>
            <h3 className="text-[20px] font-bold text-white mb-2 relative z-10">Free</h3>
            <div className="h-16 flex items-end gap-2 mb-6 relative z-10">
              <span className="text-[40px] font-black text-white leading-none tracking-tight overflow-hidden relative">
                <AnimatePresence mode="popLayout">
                  <motion.span key={isYearly ? 'y2' : 'm2'} initial={{ opacity: 0, y: -20, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: 20, filter: 'blur(4px)' }} transition={{ duration: 0.3 }} className="inline-block">
                    ₹0
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-[15px] text-[#555] mb-1">/month</span>
            </div>
            <button className="w-full border border-[#2A2A2A] text-white font-semibold text-[15px] py-4 rounded-xl hover:bg-white hover:text-black hover:border-white transition-colors relative z-10" data-cursor="hover" onClick={() => window.location.href = '/signup'}>
              Get Started
            </button>
            <div className="w-full h-px bg-[#1F1F1F] my-8 relative z-10" />
            <div className="text-[12px] font-bold text-white uppercase tracking-wider mb-6 relative z-10">KEY FEATURES</div>
            <ul className="flex flex-col gap-4 relative z-10 mb-8 flex-1">
              {[
                "All Languages",
                "5 Minutes Free Testing (Full Templates)",
                "5 GB Cloud Storage",
                "Max Video Length 2 min",
                "3 Audio Enhancement Credits (1 Credit = 1 Video)",
                "“No Watermark” Free Render (Basic Templates)",
                "Temporary: Two New Templates for NEET Student Protest",
                "Temporary: Free Translation (20 mins) from Desi to English",
                "Temporary: 30mins of Free Transcription"
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={18} className="text-[#888] shrink-0 mt-0.5" />
                  <span className="text-[14px] text-[#888] leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </TiltCard>
        </Reveal>
        <Reveal delay={0.2} className="h-full">
          <TiltCard className="h-full bg-[#0D0D0D] border border-[#1F1F1F] rounded-[24px] p-8 flex flex-col group relative overflow-hidden">
            <div className="spotlight" />
            <div className="w-12 h-12 rounded-full bg-[#E60000]/10 flex items-center justify-center text-[24px] mb-6 relative z-10">💎</div>
            <h3 className="text-[20px] font-bold text-white mb-2 relative z-10">Editor Plan</h3>
            <div className="h-16 flex items-end gap-2 mb-6 relative z-10">
              <span className="text-[40px] font-black text-white leading-none tracking-tight overflow-hidden relative">
                <AnimatePresence mode="popLayout">
                  <motion.span key={isYearly ? 'y' : 'm'} initial={{ opacity: 0, y: -20, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: 20, filter: 'blur(4px)' }} transition={{ duration: 0.3 }} className="inline-block">
                    ₹{getPlanPrice('editor') ?? (isYearly ? '416' : '499')}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-[15px] text-[#555] mb-1">/month</span>
              {isYearly && <span className="text-[13px] text-[#555] line-through mb-1 ml-2">₹{getPlanOriginalYearly('editor') ?? '558'}</span>}
            </div>
            <button className="w-full border border-[#2A2A2A] text-white font-semibold text-[15px] py-4 rounded-xl hover:bg-white hover:text-black hover:border-white transition-colors relative z-10" data-cursor="hover">
              Get started
            </button>
            <div className="w-full h-px bg-[#1F1F1F] my-8 relative z-10" />
            <div className="text-[12px] font-bold text-[#E60000] uppercase tracking-wider mb-6 relative z-10">KEY FEATURES</div>
            <ul className="flex flex-col gap-4 relative z-10 mb-8">
              {['2 Hours Transcription/month', '20 GB Cloud Storage', '1080p / 30 FPS Export', 'Max video length: 2 min', '50 Audio Enhancement Credits', 'Custom Font Upload'].map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={18} className="text-[#E60000] shrink-0 mt-0.5" />
                  <span className="text-[14px] text-[#888]">{f}</span>
                </li>
              ))}
            </ul>
          </TiltCard>
        </Reveal>

        <Reveal delay={0.3} className="h-full">
          <TiltCard className="h-full bg-[#0D0D0D] border border-[#E60000] rounded-[24px] p-8 flex flex-col group relative overflow-hidden shadow-[0_0_60px_rgba(230,0,0,0.15),0_0_120px_rgba(230,0,0,0.06)] md:-translate-y-4">
            <div className="spotlight" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#E60000] text-white text-[12px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-b-lg shadow-md z-20">MOST POPULAR</div>
            <div className="w-12 h-12 rounded-full bg-[#E60000]/20 flex items-center justify-center text-[24px] mb-6 relative z-10 mt-4">🚀</div>
            <h3 className="text-[20px] font-bold text-white mb-2 relative z-10">Creator Plan</h3>
            <div className="h-16 flex items-end gap-2 mb-6 relative z-10">
              <span className="text-[40px] font-black text-white leading-none tracking-tight overflow-hidden relative">
                <AnimatePresence mode="popLayout">
                  <motion.span key={isYearly ? 'y' : 'm'} initial={{ opacity: 0, y: -20, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: 20, filter: 'blur(4px)' }} transition={{ duration: 0.3 }} className="inline-block">
                    ₹{getPlanPrice('creator') ?? (isYearly ? '833' : '999')}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-[15px] text-[#555] mb-1">/month</span>
              {isYearly && <span className="text-[13px] text-[#555] line-through mb-1 ml-2">₹{getPlanOriginalYearly('creator') ?? '1042'}</span>}
            </div>
            <MagneticButton className="w-full bg-[#E60000] text-white font-bold text-[15px] py-4 rounded-xl hover:bg-[#CC0000] transition-colors relative z-10">
              Upgrade now
            </MagneticButton>
            <div className="w-full h-px bg-[#1F1F1F] my-8 relative z-10" />
            <div className="text-[12px] font-bold text-[#E60000] uppercase tracking-wider mb-6 relative z-10">EVERYTHING IN EDITOR, PLUS</div>
            <ul className="flex flex-col gap-4 relative z-10 mb-8">
              {['5 Hours Transcription/month', '60 GB Cloud Storage', '4K / 60 FPS Export', 'Max video length: 5 min', 'Unlimited Audio Enhancement', 'Green/Blue Screen Render', 'SRT Export', 'Audio Only Upload (mp3 etc)', '2 hrs Translation (Desi → English)'].map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={18} className="text-[#E60000] shrink-0 mt-0.5" />
                  <span className="text-[14px] text-[#888]">{f}</span>
                </li>
              ))}
            </ul>
          </TiltCard>
        </Reveal>

        <Reveal delay={0.4} className="h-full">
          <TiltCard className="h-full bg-[#0D0D0D] border border-[#1F1F1F] rounded-[24px] p-8 flex flex-col group relative overflow-hidden">
            <div className="spotlight" />
            <div className="w-12 h-12 rounded-full bg-[#E60000]/10 flex items-center justify-center text-[24px] mb-6 relative z-10">👑</div>
            <h3 className="text-[20px] font-bold text-white mb-2 relative z-10">Studio Plan</h3>
            <div className="h-16 flex items-end gap-2 mb-6 relative z-10">
              <span className="text-[40px] font-black text-white leading-none tracking-tight overflow-hidden relative">
                <AnimatePresence mode="popLayout">
                  <motion.span key={isYearly ? 'y' : 'm'} initial={{ opacity: 0, y: -20, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: 20, filter: 'blur(4px)' }} transition={{ duration: 0.3 }} className="inline-block">
                    ₹{getPlanPrice('studio') ? getPlanPrice('studio')?.toLocaleString('en-IN') : (isYearly ? '2,166' : '2,599')}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-[15px] text-[#555] mb-1">/month</span>
              {isYearly && <span className="text-[13px] text-[#555] line-through mb-1 ml-2">₹{getPlanOriginalYearly('studio')?.toLocaleString('en-IN') ?? '2,833'}</span>}
            </div>
            <button className="w-full border border-[#2A2A2A] text-white font-semibold text-[15px] py-4 rounded-xl hover:bg-white hover:text-black hover:border-white transition-colors relative z-10" data-cursor="hover">
              Upgrade now
            </button>
            <div className="w-full h-px bg-[#1F1F1F] my-8 relative z-10" />
            <div className="text-[12px] font-bold text-[#E60000] uppercase tracking-wider mb-6 relative z-10">EVERYTHING IN CREATOR, PLUS</div>
            <ul className="flex flex-col gap-4 relative z-10 mb-8">
              {['12 Hours Transcription/month', '150 GB Cloud Storage', 'Max video length: 30 min', '5 hrs Translation (Desi → English)', 'Unlimited Team Members (₹480/member/month)', 'Buy Extra Transcription & Storage as Add-on'].map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={18} className="text-[#E60000] shrink-0 mt-0.5" />
                  <span className="text-[14px] text-[#888]">{f}</span>
                </li>
              ))}
            </ul>
          </TiltCard>
        </Reveal>
      </div>

      <div className="max-w-[800px] mx-auto">
        {faqs.map((faq, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div className="border-b border-[#1F1F1F]">
              <button 
                className="w-full flex items-center justify-between py-6 text-left group"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                data-cursor="hover"
              >
                <span className="text-[16px] font-semibold text-white group-hover:text-[#E60000] transition-colors">{faq.q}</span>
                <span className="text-[#E60000] shrink-0 ml-4">
                  {openFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </span>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-6 text-[15px] text-[#888] leading-relaxed pr-8">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export default PricingSection;
