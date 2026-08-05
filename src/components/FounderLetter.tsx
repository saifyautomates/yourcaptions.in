import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useTilt } from '@/hooks/useTilt';

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

export function FounderLetter() {
  return (
    <div className="max-w-[720px] mx-auto px-6">
      <Reveal className="text-center mb-[80px]">
        <div className="section-label">OUR STORY</div>
        <h2 className="section-headline text-white mt-4">
          We built the tool<br />we always <span className="font-dm-serif italic text-[#E60000] font-normal">needed</span>.
        </h2>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="text-[17px] text-[#888] font-inter leading-[1.9] space-y-6">
          <p>We were creators first.</p>
          <p>
            Spending 3–4 hours per video manually adding captions. Getting frustrated when Western AI tools couldn't understand a single Urdu word. Watching our upload schedule suffer because captioning took longer than filming.
          </p>
          <p>
            So we built Yourcaptions.in.
          </p>
          <p>
            Not as a startup. As a solution to our own pain. We trained our AI on Indian languages, Hinglish, and every dialect we could find. We obsessed over word-level timing. We built the template system because we were tired of plain white text.
          </p>
          <p>
            10,000 creators later — we're still building.
          </p>
          <p>
            For you. For your language. For your audience.
          </p>
          <p className="font-semibold text-white mt-8 pt-4">
            — The Yourcaptions.in team
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.2} className="mt-16 pt-16 border-t border-[#1F1F1F]">
        <div className="flex flex-col md:flex-row gap-6 justify-center">
          <TiltCard className="bg-[#141414] border border-[#1F1F1F] rounded-[12px] p-5 flex items-center gap-4 flex-1 group">
            <div className="w-12 h-12 rounded-full bg-[#E60000] flex items-center justify-center text-white font-bold text-[15px]">SM</div>
            <div>
              <div className="text-white font-semibold text-[15px] group-hover:text-[#E60000] transition-colors">Saify</div>
              <div className="text-[#555] text-[13px]">Co-founder & Product</div>
            </div>
          </TiltCard>
          
          <TiltCard className="bg-[#141414] border border-[#1F1F1F] rounded-[12px] p-5 flex items-center gap-4 flex-1 group">
            <div className="w-12 h-12 rounded-full bg-[#E60000] flex items-center justify-center text-white font-bold text-[15px]">J</div>
            <div>
              <div className="text-white font-semibold text-[15px] group-hover:text-[#E60000] transition-colors">Jack</div>
              <div className="text-[#555] text-[13px]">Co-founder & Engineering</div>
            </div>
          </TiltCard>
        </div>
      </Reveal>
    </div>
  );
}

export default FounderLetter;
