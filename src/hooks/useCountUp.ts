import { useEffect, useState } from 'react';
import { useInView } from 'framer-motion';
import { RefObject } from 'react';

export function useCountUp(end: number, duration: number = 1500, ref: RefObject<HTMLElement | null>) {
  const [count, setCount] = useState(0);
  const isInView = useInView(ref as any, { once: true, margin: "-10%" });

  useEffect(() => {
    if (!isInView) return;
    
    let startTime: number | null = null;
    let raf: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // ease out expo
      const easePercentage = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      
      setCount(Math.floor(end * easePercentage));

      if (percentage < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(raf);
  }, [end, duration, isInView]);

  return count;
}
