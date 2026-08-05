import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';
import { useAnimatedNumber } from '@/lib/animations';
import { useCreditStore } from '@/stores/creditStore';
import { CreditBalanceSkeleton } from '@/components/ui/skeleton';

export function CreditDisplay() {
  const { balance, loading } = useCreditStore();
  const animatedBalance = useAnimatedNumber(balance);

  if (loading) return <CreditBalanceSkeleton />;

  return (
    <motion.div 
      className="flex items-center gap-2 bg-[var(--bg-5)] border border-[var(--border-3)] rounded-full px-3 py-1.5 cursor-pointer hover:bg-[var(--bg-6)] transition-colors"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="bg-[var(--red-tint-5)] rounded-full p-1 text-[var(--red-3)]">
        <Coins size={14} />
      </div>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={animatedBalance}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="text-sm font-semibold text-[var(--text-1)] font-mono"
        >
          {animatedBalance.toLocaleString()}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
