import React, { useRef } from 'react';
import { useTilt } from '@/hooks/useTilt';

function TiltCard({ children, className, ...props }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref);
  return (
    <div ref={ref} className={`tilt-card ${className}`} {...props}>
      {children}
    </div>
  );
}

const testimonials = [
  { n: 'Arjun Mehta', r: '@arjunmehta · YouTube, 800K', bg: '#E60000', in: 'AM', text: 'Maine pehle manually captions lagata tha — 3 ghante per video. Ab sirf 2 minute mein perfect captions. Yeh tool ne meri zindagi badal di.', highlight: 'zindagi badal di' },
  { n: 'Zaryab Khan', r: '@zaryabkhan · TikTok Creator', bg: '#4A90E2', in: 'ZK', text: 'Urdu captions itne accurate hain ki mujhe believe nahi hua. Even Hinglish perfectly samajhta hai. Kalakar se 10x better.', highlight: '10x better' },
  { n: 'Priya Sharma', r: '@priyasharma · Instagram Reels', bg: '#50E3C2', in: 'PS', text: 'The template styles are insane. Applied Hormozi style to my reel and my views tripled in one week.', highlight: 'views tripled' },
  { n: 'James Carter', r: '@jamescarter · Podcast Creator', bg: '#F5A623', in: 'JC', text: 'As an English creator covering South Asian topics, I needed accurate Hindi transcription for interviews. This is the only tool that actually works.', highlight: 'actually works' },
  { n: 'Fatima Al-Rashidi', r: '@fatimarashidi · Arabic Content Creator', bg: '#D0021B', in: 'FA', text: "Arabic RTL captions that actually render correctly. I've tried 6 tools before this. Nothing came close.", highlight: 'Nothing came close' },
  { n: 'Rohit Verma', r: '@rohitverma · Tech YouTuber, 1.2M', bg: '#B8E986', in: 'RV', text: 'Export quality is insane. 4K burned captions with zero quality loss. My editor loves it.', highlight: 'zero quality loss' },
  { n: 'Aisha Malik', r: '@aishamalik · Urdu Podcast', bg: '#9013FE', in: 'AM', text: 'Sarvam AI integration means my Urdu is transcribed perfectly. Not even one word wrong in my last 10 episodes.', highlight: 'Not even one word wrong' },
  { n: 'Khalid Omar', r: '@khalidomar · Business Creator', bg: '#417505', in: 'KO', text: 'The dubbing feature is what got me. I dubbed my entire Arabic course to Hindi in one afternoon. Mind blown.', highlight: 'Mind blown' },
  { n: 'Meenu Singh', r: '@meenubeauty · Beauty Creator, 300K', bg: '#F8E71C', in: 'MS', text: 'Free plan se start kiya, ab Pro pe hoon. Ek baar try karo — wapas nahi jaoge kisi aur tool pe.', highlight: 'wapas nahi jaoge' }
];

export function TestimonialGrid() {
  return (
    <div className="w-full overflow-x-auto snap-x no-scrollbar md:overflow-visible relative z-10">
      <div className="flex md:grid md:grid-cols-3 gap-6 min-w-max md:min-w-0 pb-8 md:pb-0">
        {testimonials.map((t, i) => (
          <TiltCard key={i} className="w-[300px] md:w-auto bg-[#0D0D0D] border border-[#1F1F1F] rounded-[16px] p-6 snap-center group relative overflow-hidden">
            <div className="spotlight" />
            <div className="flex gap-4 items-center mb-4 relative z-10">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[14px]" style={{ backgroundColor: t.bg }}>{t.in}</div>
              <div>
                <div className="text-[15px] font-semibold text-white">{t.n}</div>
                <div className="text-[13px] text-[#555]">{t.r}</div>
              </div>
            </div>
            <div className="flex gap-1 mb-4 text-[#E60000] text-[14px] relative z-10">
              ★★★★★
            </div>
            <p className="text-[14px] text-[#888] leading-[1.7] relative z-10">
              {t.text.split(t.highlight).map((part, j) => (
                <React.Fragment key={j}>
                  {part}
                  {j === 0 && <strong className="text-white font-medium">{t.highlight}</strong>}
                </React.Fragment>
              ))}
            </p>
          </TiltCard>
        ))}
      </div>
    </div>
  );
}

export default TestimonialGrid;
