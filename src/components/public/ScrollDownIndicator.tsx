import React, { useEffect, useState } from 'react';
import { motion, useScroll, AnimatePresence } from 'framer-motion';

export function ScrollDownIndicator() {
  const { scrollY } = useScroll();
  const [isVisible, setIsVisible] = useState(true);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    const checkScrollable = () => {
      if (typeof window !== 'undefined') {
        // Only show if the page content is significantly taller than the viewport
        setIsScrollable(document.documentElement.scrollHeight > window.innerHeight + 100);
      }
    };
    
    // Check on mount and after a short delay to allow for content rendering
    checkScrollable();
    const timeoutId = setTimeout(checkScrollable, 500);
    
    window.addEventListener('resize', checkScrollable);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkScrollable);
    };
  }, []);

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      if (latest > 100 && isVisible) {
        setIsVisible(false);
      } else if (latest <= 100 && !isVisible) {
        setIsVisible(true);
      }
    });
  }, [scrollY, isVisible]);

  return (
    <AnimatePresence>
      {isVisible && isScrollable && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-3 z-50 cursor-pointer group"
          onClick={() => window.scrollTo({ top: Math.min(window.innerHeight, document.documentElement.scrollHeight), behavior: 'smooth' })}
        >
          <span className="text-[9px] uppercase tracking-[0.3em] text-[#888] font-semibold group-hover:text-white transition-colors duration-300 drop-shadow-md">Scroll</span>
          <div className="w-6 h-10 border-2 border-[#333] rounded-full flex justify-center p-[3px] group-hover:border-[#555] transition-colors duration-300 bg-[#050505]/60 backdrop-blur-md">
            <motion.div 
              animate={{ 
                y: [0, 16, 0],
                opacity: [1, 0.3, 1]
              }}
              transition={{ 
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-1.5 h-2 bg-[#E60000] rounded-full shadow-[0_0_8px_rgba(230,0,0,0.6)]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
