import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  max?: number;
  spotlight?: boolean;
};

export function TiltCard({ children, max = 12, spotlight = true, className = "", style, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateX(${-y * max}deg) rotateY(${x * max}deg) translateZ(8px) scale(1.02)`;
    el.style.setProperty("--mouse-x", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--mouse-y", `${(y + 0.5) * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(1000px) rotateX(0) rotateY(0) translateZ(0) scale(1)";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`tilt-card relative transition-transform duration-300 ease-out will-change-transform ${className}`}
      style={{ transformStyle: "preserve-3d", ...style }}
      {...rest}
    >
      {spotlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-100"
          style={{
            background:
              "radial-gradient(400px circle at var(--mouse-x,50%) var(--mouse-y,50%), rgba(230,0,0,0.08), transparent 60%)",
          }}
        />
      )}
      <div className="relative" style={{ transform: "translateZ(20px)" }}>{children}</div>
    </div>
  );
}
