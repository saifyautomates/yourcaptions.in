import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

// 1. SCROLL REVEAL — every element enters beautifully
export const scrollReveal = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.7,
    ease: [0.16, 1, 0.3, 1]  // snappy deceleration
  }
};

// Staggered children
export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.08 }
  }
};

// 2. BUTTON HOVER — magnetic + lift
export const buttonHover = {
  whileHover: { scale: 1.02, y: -2 },
  whileTap: { scale: 0.97 },
  transition: { type: 'spring', stiffness: 400, damping: 17 }
};

// 3. CARD HOVER — subtle lift
export const cardHover = {
  whileHover: { y: -4, transition: { duration: 0.2 } }
};

// 4. NUMBER COUNT-UP
export function useCountUp(target: number, duration: number = 1500) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { 
        setCount(target); 
        clearInterval(timer); 
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return { count, ref };
}

// 5. CREDIT NUMBER ANIMATION
export function useAnimatedNumber(value: number) {
  const [display, setDisplay] = useState(value);
  const [prev, setPrev] = useState(value);

  useEffect(() => {
    if (value === prev) return;
    const diff = value - prev;
    const steps = 20;
    const step = diff / steps;
    let current = prev;
    let i = 0;
    const timer = setInterval(() => {
      current += step;
      i++;
      if (i >= steps) { 
        setDisplay(value); 
        setPrev(value); 
        clearInterval(timer); 
      } else {
        setDisplay(Math.round(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, prev]);

  return display;
}

// 6. PAGE TRANSITION
export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};

// 7. TOAST NOTIFICATION
export const toastAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.95 },
  transition: { type: 'spring', stiffness: 500, damping: 30 }
};

// 8. MODAL ANIMATION
export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

export const modalContent = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
  transition: { type: 'spring', stiffness: 400, damping: 25 }
};

// 9. BOTTOM SHEET (mobile modal)
export const bottomSheet = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  transition: { type: 'spring', stiffness: 400, damping: 40 }
};
