import React from 'react';

const row1 = ['Hindi', 'Urdu', 'Arabic', 'English', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Gujarati', 'Marathi', 'Odia', 'Assamese', 'Nepali', 'Sinhala', 'Pashto', 'Sindhi', 'Kashmiri'];
const row2 = ['French', 'Spanish', 'Portuguese', 'Indonesian', 'Turkish', 'Persian', 'Swahili', 'Russian', 'Japanese', 'Korean', 'German', 'Italian', 'Dutch', 'Polish', 'Vietnamese', 'Thai', 'Tagalog', 'Amharic'];

export function LanguageTicker() {
  return (
    <div className="w-full overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
      {/* Row 1 */}
      <div className="ticker-row flex whitespace-nowrap mb-6 w-full" style={{ '--duration': '35s' } as any}>
        <div className="flex animate-marquee-left w-fit">
          {[...row1, ...row1, ...row1, ...row1].map((lang, i) => (
            <div key={i} className="flex items-center text-[24px] md:text-[28px] font-bold font-inter px-4" style={{ color: i % 2 === 0 ? '#F0F0F0' : '#2A2A2A' }}>
              {lang} <span className="text-[#E60000] mx-4 md:mx-8">·</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Row 2 */}
      <div className="ticker-row flex whitespace-nowrap w-full justify-end" style={{ '--duration': '40s' } as any}>
        <div className="flex animate-marquee-right w-fit">
          {[...row2, ...row2, ...row2, ...row2].map((lang, i) => (
            <div key={i} className="flex items-center text-[24px] md:text-[28px] font-bold font-inter px-4" style={{ color: i % 2 === 1 ? '#F0F0F0' : '#2A2A2A' }}>
              {lang} <span className="text-[#E60000] mx-4 md:mx-8">·</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LanguageTicker;
