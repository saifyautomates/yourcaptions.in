import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function Logo({ onClick }: { onClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => {
        if (onClick) onClick();
        else navigate("/");
      }} 
      data-cursor="hover" 
      className="flex items-center gap-3 z-50 transition-colors group cursor-pointer"
    >
      <motion.div 
        className="relative w-8 h-8 rounded-[8px] bg-[#050505] flex items-center justify-center shadow-[0_0_15px_rgba(230,0,0,0.5)] overflow-hidden shrink-0"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
         {/* Rotating White Border */}
         <motion.div 
           className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(255,255,255,0.8)_360deg)]"
           animate={{ rotate: 360 }}
           transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
         />
         <div className="absolute inset-[1px] bg-[#050505] rounded-[7px] z-0" />
         
         <motion.div 
            className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50 z-10 pointer-events-none"
            animate={{ y: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
         ></motion.div>
         <span className="text-white font-black text-[18px] leading-none absolute left-[4px] z-10 font-inter tracking-tighter">Y</span>
         <span className="text-[#E60000] font-black text-[18px] leading-none absolute left-[12px] font-inter z-0">C</span>
         <div className="absolute right-[3px] top-[10px] flex flex-col gap-[2px] items-start z-10 group-hover:gap-[3px] transition-all duration-300">
           <div className="w-[8px] h-[1.5px] bg-white rounded-full group-hover:w-[10px] transition-all duration-300"></div>
           <div className="w-[11px] h-[1.5px] bg-white rounded-full group-hover:w-[13px] transition-all duration-300"></div>
           <div className="flex items-center gap-[1.5px]">
             <div className="w-[6px] h-[1.5px] bg-white rounded-full group-hover:w-[8px] transition-all duration-300"></div>
             <motion.div 
               className="w-[3px] h-[3px] bg-[#E60000] rounded-full"
               animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
               transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
             ></motion.div>
           </div>
         </div>
      </motion.div>
      <div className="flex items-center">
        <span className="font-inter font-bold text-[18px] sm:text-[20px] tracking-tight text-white transition-colors group-hover:text-white/90">Your</span>
        <span className="font-inter font-bold text-[18px] sm:text-[20px] tracking-tight text-[#E60000] transition-colors group-hover:text-[#FF1A1A]">captions</span>
        <span className="font-inter font-bold text-[18px] sm:text-[20px] tracking-tight text-white transition-colors group-hover:text-white/90">.in</span>
      </div>
    </button>
  );
}
