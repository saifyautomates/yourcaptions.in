import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  strength?: number;
};

export const MagneticCTA = forwardRef<HTMLButtonElement, Props>(function MagneticCTA(
  { children, strength = 0.25, className = "", ...rest },
  fwdRef
) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const setRefs = (n: HTMLButtonElement | null) => {
    ref.current = n;
    if (typeof fwdRef === "function") fwdRef(n);
    else if (fwdRef) (fwdRef as any).current = n;
  };

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (reduced || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "translate(0,0)";
  };

  return (
    <button
      ref={setRefs}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-cursor="hover"
      className={`transition-transform duration-200 ease-out active:scale-[0.97] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
