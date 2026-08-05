import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function RedParticles({ count = 30 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    if (window.innerWidth < 768) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parts = Array.from({ length: count }, () => spawn(true));
    function spawn(initial = false) {
      return {
        x: Math.random() * (w || window.innerWidth),
        y: initial ? Math.random() * (h || window.innerHeight) : (h || window.innerHeight) + 10,
        r: 1 + Math.random() * 1.5,
        s: 0.1 + Math.random() * 0.4,
        a: 0.15 + Math.random() * 0.35,
      };
    }
    const resize = () => {
      const rect = c.getBoundingClientRect();
      w = rect.width; h = rect.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.s;
        if (p.y < -10) Object.assign(p, spawn(false));
        ctx.beginPath();
        ctx.fillStyle = `rgba(230,0,0,${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [count, reduced]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
